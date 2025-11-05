// server.js — Node.js + Express + SQLite + Telegram уведомление
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

console.log('BOT_TOKEN =', process.env.BOT_TOKEN);
console.log('ADMIN_CHAT_ID =', process.env.ADMIN_CHAT_ID);

// --- TELEGRAM НАСТРОЙКИ ---
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// --- DATABASE ---
const DB_PATH = path.join(__dirname, 'db.sqlite');
const dbExists = fs.existsSync(DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if(err) return console.error('DB error', err);
});

if(!dbExists){
  db.serialize(()=>{
    db.run(`CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT,
      items TEXT,
      total INTEGER,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Database and table created.');
  });
}

// --- EXPRESS ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ ИСПРАВЛЕНО: serve frontend from current directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Уведомление в Telegram ---
async function sendOrderToTelegram(order) {
  if (!ADMIN_CHAT_ID || !process.env.BOT_TOKEN) return;

  let msg = `🧾 *Новый заказ с сайта*\n\n`;
  msg += `👤 *Имя:* ${order.name}\n📞 *Телефон:* ${order.phone}\n🏠 *Адрес:* ${order.address || '-'}\n\n`;

  msg += `🛒 *Товары:*\n`;
  for (const id in order.items) {
    const product = getProductName(parseInt(id));
    msg += `• ${product} × ${order.items[id]}\n`;
  }

  msg += `\n💰 *Итого:* ${order.total.toLocaleString('ru-RU')} ₸`;

  try {
    await bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    console.log('✅ Заказ отправлен в Telegram');
  } catch (err) {
    console.error('Ошибка отправки в Telegram:', err);
  }
}

// Функция для получения названия товара по ID
function getProductName(id) {
  const products = {
    1: 'Цемент Шымкент 450',
    2: 'Цемент Шымкент 500', 
    3: 'Цемент Стандарт 450',
    4: 'Цемент Аккерман 500'
  };
  return products[id] || `Товар #${id}`;
}

// --- API: создание заказа ---
app.post('/api/orders', (req, res) => {
  const { name, phone, address, items, total } = req.body || {};
  if(!name || !phone) return res.status(400).send('name and phone are required');

  const stmt = db.prepare(`INSERT INTO orders (name,phone,address,items,total) VALUES (?,?,?,?,?)`);
  stmt.run(name, phone, address || '', JSON.stringify(items||{}), total || 0, async function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }

    // 📩 Отправляем заказ в Telegram
    await sendOrderToTelegram({ name, phone, address, items, total });

    res.json({ id: this.lastID });
  });
});

// --- API: список заказов ---
app.get('/api/orders', (req, res) => {
  db.all('SELECT id,name,phone,address,items,total,status,created_at FROM orders ORDER BY id DESC', [], (err, rows)=>{
    if(err) return res.status(500).send('db error');
    res.json(rows.map(r => ({...r, items: JSON.parse(r.items||'{}')})));
  });
});

// --- API: обновление статуса заказа ---
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['new', 'processing', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).send('Invalid status');
  }

  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// --- API: удаление заказа ---
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// --- API: создание заказа через админку ---
app.post('/api/admin/orders', (req, res) => {
  const { name, phone, address, items, total } = req.body || {};
  if(!name || !phone) return res.status(400).send('name and phone are required');

  const stmt = db.prepare(`INSERT INTO orders (name,phone,address,items,total) VALUES (?,?,?,?,?)`);
  stmt.run(name, phone, address || '', JSON.stringify(items||{}), total || 0, function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }
    res.json({ id: this.lastID });
  });
});

// ✅ ИСПРАВЛЕНО: Добавляем маршрут для корневой страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Simple admin page ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('✅ Server running at http://localhost:' + PORT));