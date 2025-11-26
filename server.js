// server.js — Node.js + Express + SQLite + Telegram уведомление
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const XLSX = require('xlsx');
const crypto = require('crypto');
require('dotenv').config();

console.log('BOT_TOKEN =', process.env.BOT_TOKEN);
console.log('ADMIN_CHAT_ID =', process.env.ADMIN_CHAT_ID);

// --- TELEGRAM НАСТРОЙКИ ---
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Обработчики бота
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
  bot.sendMessage(chatId, `👋 Привет, ${username}!\n\nЯ бот магазина "Мерос".\n\n📱 Используйте команду /phone чтобы поделиться номером телефона для автозаполнения при заказах на сайте.`);
});

bot.onText(/\/phone/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '📱 Поделитесь вашим номером телефона для автозаполнения при заказах:', {
    reply_markup: {
      keyboard: [[{
        text: '📱 Отправить номер телефона',
        request_contact: true
      }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const contact = msg.contact;
  
  if (contact.user_id === telegramId) {
    const phone = contact.phone_number;
    
    // Сохраняем номер в базу данных
    db.run(`
      UPDATE users 
      SET phone = ? 
      WHERE telegram_id = ?
    `, [phone, telegramId], (err) => {
      if (err) {
        console.error('Error saving phone:', err);
        bot.sendMessage(chatId, '❌ Ошибка сохранения номера. Попробуйте позже.', {
          reply_markup: { remove_keyboard: true }
        });
      } else {
        bot.sendMessage(chatId, `✅ Номер ${phone} успешно сохранен!\n\nТеперь при оформлении заказа на сайте он будет автоматически заполнен.`, {
          reply_markup: { remove_keyboard: true }
        });
      }
    });
  } else {
    bot.sendMessage(chatId, '❌ Пожалуйста, отправьте свой номер телефона.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

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
      user_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    
    db.run(`CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      icon TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
    )`);
    
    db.run(`CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      image TEXT,
      stock INTEGER DEFAULT 1,
      category_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`);
    
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      photo_url TEXT,
      phone TEXT,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      user_agent TEXT,
      referrer TEXT,
      visited_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Добавляем начальные категории
    const initialCategories = [
      ['ЦЕМЕНТ', null, '📦', 1],
      ['АРМАТУРА', null, '🔩', 2],
      ['КРОВЛЯ', null, '🏠', 3],
      ['ЛЕС', null, '🌲', 4],
      ['ЛИСТОВОЙ ПРОКАТ', null, '📄', 5],
      ['ПРОВОЛОКА', null, '🔗', 6],
      ['ПРОФИЛЬНАЯ ТРУБА', null, '⬜', 7],
      ['РАЗНОЕ', null, '📦', 8],
      ['ТРУБА', null, '⭕', 9],
      ['УГОЛОК', null, '📐', 10],
      ['ШВЕЛЛЕР', null, '🔨', 11]
    ];
    
    const catStmt = db.prepare('INSERT INTO categories (name, parent_id, icon, order_index) VALUES (?, ?, ?, ?)');
    initialCategories.forEach(cat => catStmt.run(cat));
    catStmt.finalize(() => {
      // После создания категорий получаем ID категории "ЦЕМЕНТ"
      db.get("SELECT id FROM categories WHERE name='ЦЕМЕНТ'", [], (err, row) => {
        const cementCategoryId = row ? row.id : null;
        
        // Добавляем начальные товары с категорией
        const initialProducts = [
          ['Цемент Шымкент 450', 2000, '/assets/450ch.jpg', 1, cementCategoryId],
          ['Цемент Шымкент 500', 2100, '/assets/500ch.jpg', 1, cementCategoryId],
          ['Цемент Стандарт 450', 2000, '/assets/450st.jpg', 1, cementCategoryId],
          ['Цемент Аккерман 500', 2200, '/assets/500akk.jpg', 1, cementCategoryId]
        ];
        
        const prodStmt = db.prepare('INSERT INTO products (name, price, image, stock, category_id) VALUES (?, ?, ?, ?, ?)');
        initialProducts.forEach(product => prodStmt.run(product));
        prodStmt.finalize();
      });
    });
    
    console.log('Database and tables created.');
  });
} else {
  // Проверяем и создаем таблицу categories если нет
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'", (err, row) => {
    if (!row) {
      db.run(`CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        icon TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          console.error('Error creating categories table:', err);
        } else {
          // Добавляем начальные категории
          const initialCategories = [
            ['ЦЕМЕНТ', null, '📦', 1],
            ['АРМАТУРА', null, '🔩', 2],
            ['КРОВЛЯ', null, '🏠', 3],
            ['ЛЕС', null, '🌲', 4],
            ['ЛИСТОВОЙ ПРОКАТ', null, '📄', 5],
            ['ПРОВОЛОКА', null, '🔗', 6],
            ['ПРОФИЛЬНАЯ ТРУБА', null, '⬜', 7],
            ['РАЗНОЕ', null, '📦', 8],
            ['ТРУБА', null, '⭕', 9],
            ['УГОЛОК', null, '📐', 10],
            ['ШВЕЛЛЕР', null, '🔨', 11]
          ];
          
          const catStmt = db.prepare('INSERT INTO categories (name, parent_id, icon, order_index) VALUES (?, ?, ?, ?)');
          initialCategories.forEach(cat => catStmt.run(cat));
          catStmt.finalize();
          
          console.log('Categories table created and populated.');
        }
      });
    }
  });

  // Проверяем существование таблицы products
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'", (err, row) => {
    if (!row) {
      db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image TEXT,
        stock INTEGER DEFAULT 1,
        category_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )`, (err) => {
        if (err) {
          console.error('Error creating products table:', err);
        } else {
          db.get("SELECT id FROM categories WHERE name='ЦЕМЕНТ'", [], (err, row) => {
            const cementCategoryId = row ? row.id : null;
            
            const initialProducts = [
              ['Цемент Шымкент 450', 2000, '/assets/450ch.jpg', 1, cementCategoryId],
              ['Цемент Шымкент 500', 2100, '/assets/500ch.jpg', 1, cementCategoryId],
              ['Цемент Стандарт 450', 2000, '/assets/450st.jpg', 1, cementCategoryId],
              ['Цемент Аккерман 500', 2200, '/assets/500akk.jpg', 1, cementCategoryId]
            ];
            
            const stmt = db.prepare('INSERT INTO products (name, price, image, stock, category_id) VALUES (?, ?, ?, ?, ?)');
            initialProducts.forEach(product => stmt.run(product));
            stmt.finalize();
            
            console.log('Products table created and populated.');
          });
        }
      });
    } else {
      // Проверяем наличие поля category_id в существующей таблице products
      db.all("PRAGMA table_info(products)", [], (err, columns) => {
        const hasCategoryId = columns.some(col => col.name === 'category_id');
        if (!hasCategoryId) {
          db.run("ALTER TABLE products ADD COLUMN category_id INTEGER", (err) => {
            if (err) {
              console.error('Error adding category_id column:', err);
            } else {
              console.log('Added category_id column to products table.');
            }
          });
        }
      });
    }
  });
}

// --- EXPRESS ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'assets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  }
});

// Отдельный multer для Excel файлов
const uploadExcel = multer({ 
  storage: multer.memoryStorage(), // Храним в памяти
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только Excel файлы разрешены!'));
    }
  }
});

// ✅ ИСПРАВЛЕНО: serve frontend from current directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для отслеживания посещений
app.use((req, res, next) => {
  // Отслеживаем только главную страницу и страницы товаров, пропускаем API и статику
  if (req.path === '/' || req.path === '/index.html') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers['referer'] || req.headers['referrer'] || 'direct';
    
    db.run(
      'INSERT INTO visits (ip_address, user_agent, referrer) VALUES (?, ?, ?)',
      [ip, userAgent, referrer],
      (err) => {
        if (err) console.error('Error logging visit:', err);
      }
    );
  }
  next();
});

// --- Уведомление в Telegram ---
async function sendOrderToTelegram(order) {
  if (!ADMIN_CHAT_ID || !process.env.BOT_TOKEN) return;

  let msg = `🧾 *Новый заказ с сайта*\n\n`;
  msg += `👤 *Имя:* ${order.name}\n📞 *Телефон:* ${order.phone}\n🏠 *Адрес:* ${order.address || '-'}\n`;
  
  // Добавляем координаты если есть
  if (order.location && order.location.lat && order.location.lon) {
    msg += `📍 *Координаты:* ${order.location.lat}, ${order.location.lon}\n`;
  }
  
  msg += `\n🛒 *Товары:*\n`;
  for (const id in order.items) {
    const product = getProductName(parseInt(id));
    msg += `• ${product} × ${order.items[id]}\n`;
  }

  msg += `\n💰 *Итого:* ${order.total.toLocaleString('ru-RU')} ₸`;

  try {
    await bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    console.log('✅ Заказ отправлен в Telegram');
    
    // Если есть координаты, отправляем локацию отдельным сообщением
    if (order.location && order.location.lat && order.location.lon) {
      await bot.sendLocation(ADMIN_CHAT_ID, order.location.lat, order.location.lon);
      console.log('✅ Геолокация отправлена в Telegram');
    }
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

// --- API: CATEGORIES (CRUD) ---

// Получить все категории
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY order_index ASC, name ASC', [], (err, rows) => {
    if(err) return res.status(500).send('db error');
    res.json(rows);
  });
});

// Создать новую категорию
app.post('/api/categories', (req, res) => {
  const { name, parent_id, icon, order_index } = req.body || {};
  if(!name) return res.status(400).send('name is required');

  const stmt = db.prepare(`INSERT INTO categories (name, parent_id, icon, order_index) VALUES (?, ?, ?, ?)`);
  stmt.run(name, parent_id || null, icon || '📦', order_index || 0, function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }
    res.json({ id: this.lastID, name, parent_id, icon, order_index });
  });
});

// Обновить категорию
app.put('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  const { name, parent_id, icon, order_index } = req.body;
  
  if(!name) return res.status(400).send('name is required');

  db.run('UPDATE categories SET name = ?, parent_id = ?, icon = ?, order_index = ? WHERE id = ?', 
    [name, parent_id || null, icon || '📦', order_index || 0, id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// Удалить категорию
app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM categories WHERE id = ?', [id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// --- API: PRODUCTS (CRUD) ---

// Загрузка изображения
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  res.json({ 
    success: true, 
    filename: req.file.filename,
    path: `/assets/${req.file.filename}`
  });
});

// Получить все товары
app.get('/api/products', (req, res) => {
  const { category_id } = req.query;
  
  let query = 'SELECT * FROM products';
  let params = [];
  
  if (category_id) {
    query += ' WHERE category_id = ?';
    params.push(category_id);
  }
  
  query += ' ORDER BY id ASC';
  
  db.all(query, params, (err, rows) => {
    if(err) return res.status(500).send('db error');
    res.json(rows);
  });
});

// Создать новый товар
app.post('/api/products', (req, res) => {
  const { name, price, image, stock, category_id } = req.body || {};
  if(!name || !price) return res.status(400).send('name and price are required');

  const stmt = db.prepare(`INSERT INTO products (name, price, image, stock, category_id) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(name, price, image || '', stock !== undefined ? stock : 1, category_id || null, function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }
    res.json({ id: this.lastID, name, price, image, stock, category_id });
  });
});

// Обновить товар
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, image, stock, category_id } = req.body;
  
  if(!name || !price) return res.status(400).send('name and price are required');

  db.run('UPDATE products SET name = ?, price = ?, image = ?, stock = ?, category_id = ? WHERE id = ?', 
    [name, price, image || '', stock !== undefined ? stock : 1, category_id || null, id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// Удалить товар
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if(err) return res.status(500).send('db error');
    res.json({ success: true, changes: this.changes });
  });
});

// Импорт товаров из Excel
app.post('/api/products/import', uploadExcel.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  try {
    // Читаем Excel файл из буфера памяти
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
  let imported = 0; // вставлено новых
  let updated = 0;  // обновлено существующих цен
    let errors = [];

    // Получаем все категории для поиска по имени
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Обрабатываем каждую строку
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Ожидаемые колонки: Название, Цена, Категория, Изображение, В_наличии
      const name = row['Название'] || row['название'] || row['name'];
      const price = parseInt(row['Цена'] || row['цена'] || row['price']) || 0;
      const categoryName = row['Категория'] || row['категория'] || row['category'];
      const image = row['Изображение'] || row['изображение'] || row['image'] || '';
      const stock = row['В_наличии'] || row['в_наличии'] || row['stock'];

      if (!name || !price) {
        errors.push(`Строка ${i + 2}: отсутствует название или цена`);
        continue;
      }

      // Ищем категорию по имени
      let category_id = null;
      if (categoryName) {
        const category = categories.find(c => 
          c.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (category) {
          category_id = category.id;
        }
      }

      // Определяем наличие
      let stockValue = 1;
      if (stock !== undefined) {
        if (typeof stock === 'string') {
          stockValue = (stock.toLowerCase() === 'да' || stock.toLowerCase() === 'yes') ? 1 : 0;
        } else {
          stockValue = stock ? 1 : 0;
        }
      }

      // Находим существующий товар по названию (без учета регистра)
      const existing = await new Promise((resolve) => {
        db.get(
          `SELECT id, price, image FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1`,
          [name],
          (err, row) => {
            if (err) {
              errors.push(`Строка ${i + 2}: ошибка поиска товара - ${err.message}`);
              resolve(null);
            } else {
              resolve(row || null);
            }
          }
        );
      });

      if (existing && existing.id) {
  // Обновляем цену. Если у товара нет картинки и в excel тоже пусто — поставим дефолт /assets/pch.webp.
        const normalizedImage = (image && String(image).trim()) ? String(image).trim() : '';
        const needSetDefaultImage = (!existing.image || String(existing.image).trim() === '') && normalizedImage === '';
  const imageToSet = needSetDefaultImage ? '/assets/pch.webp' : (normalizedImage || null);

        await new Promise((resolve) => {
          if (imageToSet !== null) {
            db.run(
              `UPDATE products SET price = ?, image = ? WHERE id = ?`,
              [price, imageToSet, existing.id],
              (err) => {
                if (err) {
                  errors.push(`Строка ${i + 2}: ошибка обновления товара - ${err.message}`);
                } else {
                  updated++;
                }
                resolve();
              }
            );
          } else {
            db.run(
              `UPDATE products SET price = ? WHERE id = ?`,
              [price, existing.id],
              (err) => {
                if (err) {
                  errors.push(`Строка ${i + 2}: ошибка обновления цены - ${err.message}`);
                } else {
                  updated++;
                }
                resolve();
              }
            );
          }
        });
      } else {
        // Вставляем новый товар
        await new Promise((resolve) => {
          const stmt = db.prepare(
            `INSERT INTO products (name, price, image, stock, category_id) VALUES (?, ?, ?, ?, ?)`
          );
          const insertImage = (image && String(image).trim()) ? String(image).trim() : '/assets/pch.webp';
          stmt.run(name, price, insertImage, stockValue, category_id, function(err) {
            if (err) {
              errors.push(`Строка ${i + 2}: ошибка вставки - ${err.message}`);
            } else {
              imported++;
            }
            resolve();
          });
          stmt.finalize();
        });
      }
    }

    // Файл в памяти, не нужно удалять

    res.json({
      success: true,
      imported,
      updated,
      total: data.length,
      errors
    });

  } catch (error) {
    console.error('Ошибка импорта:', error);
    
    res.status(500).json({ 
      error: 'Ошибка обработки файла', 
      details: error.message 
    });
  }
});

// Экспорт товаров в Excel (шаблон)
app.get('/api/products/export-template', (req, res) => {
  // Создаем шаблон Excel файла
  const template = [
    {
      'Название': 'Цемент Пример 450',
      'Цена': 2000,
      'Категория': 'ЦЕМЕНТ',
      'Изображение': '/assets/cement.jpg',
      'В_наличии': 'да'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Товары');

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 30 }, // Название
    { wch: 10 }, // Цена
    { wch: 15 }, // Категория
    { wch: 25 }, // Изображение
    { wch: 12 }  // В_наличии
  ];

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', 'attachment; filename=shablon-tovarov.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// --- API: создание заказа ---
app.post('/api/orders', (req, res) => {
  const { name, phone, address, items, total, location, telegram_id } = req.body || {};
  if(!name || !phone) return res.status(400).send('name and phone are required');

  // Если есть telegram_id, найдем user_id
  if (telegram_id) {
    db.get('SELECT id FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
      const userId = user ? user.id : null;
      insertOrder(name, phone, address, items, total, location, userId, res);
    });
  } else {
    insertOrder(name, phone, address, items, total, location, null, res);
  }
});

function insertOrder(name, phone, address, items, total, location, userId, res) {
  const stmt = db.prepare(`INSERT INTO orders (name,phone,address,items,total,user_id) VALUES (?,?,?,?,?,?)`);
  stmt.run(name, phone, address || '', JSON.stringify(items||{}), total || 0, userId, async function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }

    // Если пользователь авторизован, обновляем его контактные данные
    if (userId && phone) {
      db.run(`UPDATE users SET phone = ?, address = ? WHERE id = ?`, [phone, address || '', userId], (err) => {
        if (err) console.error('Error updating user contact info:', err);
      });
    }

    // 📩 Отправляем заказ в Telegram с координатами
    await sendOrderToTelegram({ name, phone, address, items, total, location });

    res.json({ id: this.lastID });
  });
}

// --- TELEGRAM АВТОРИЗАЦИЯ ---
// Проверка подписи данных от Telegram
function checkTelegramAuthorization(data) {
  const secret = crypto.createHash('sha256')
    .update(process.env.BOT_TOKEN)
    .digest();
  
  const { hash, ...userData } = data;
  
  const dataCheckString = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`)
    .join('\n');
  
  const hmac = crypto.createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');
  
  return hmac === hash;
}

// API: авторизация через Telegram
app.post('/api/auth/telegram', express.json(), (req, res) => {
  const telegramData = req.body;
  
  // Проверяем подпись данных
  if (!checkTelegramAuthorization(telegramData)) {
    return res.status(401).json({ success: false, error: 'Invalid authorization data' });
  }
  
  // Сохраняем или обновляем пользователя в базе
  const { id, first_name, last_name, username, photo_url } = telegramData;
  
  db.run(`
    INSERT INTO users (telegram_id, first_name, last_name, username, photo_url)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id) 
    DO UPDATE SET 
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      username = excluded.username,
      photo_url = excluded.photo_url
  `, [id, first_name, last_name || '', username || '', photo_url || ''], function(err) {
    if (err) {
      console.error('Error saving user:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    res.json({ 
      success: true, 
      user: { id, first_name, last_name, username, photo_url },
      dbUserId: this.lastID
    });
  });
});

// API: получить данные пользователя
app.get('/api/user/:telegram_id', (req, res) => {
  const { telegram_id } = req.params;
  
  db.get(`
    SELECT first_name, last_name, username, phone, address, photo_url
    FROM users
    WHERE telegram_id = ?
  `, [telegram_id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// API: получить историю заказов пользователя
app.get('/api/user/orders/:telegram_id', (req, res) => {
  const { telegram_id } = req.params;
  
  db.all(`
    SELECT o.* 
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE u.telegram_id = ?
    ORDER BY o.created_at DESC
  `, [telegram_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(r => ({...r, items: JSON.parse(r.items || '{}')})));
  });
});

// --- API: статистика посещений ---
app.get('/api/stats/visits', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Общее количество посещений
  db.get('SELECT COUNT(*) as total FROM visits', [], (err1, totalRow) => {
    if (err1) return res.status(500).send('db error');
    
    // Посещения сегодня
    db.get('SELECT COUNT(*) as today FROM visits WHERE DATE(visited_at) = ?', [today], (err2, todayRow) => {
      if (err2) return res.status(500).send('db error');
      
      // Уникальные IP
      db.get('SELECT COUNT(DISTINCT ip_address) as unique_ips FROM visits', [], (err3, uniqueRow) => {
        if (err3) return res.status(500).send('db error');
        
        // Последние 10 посещений
        db.all('SELECT ip_address, user_agent, referrer, visited_at FROM visits ORDER BY visited_at DESC LIMIT 10', [], (err4, recent) => {
          if (err4) return res.status(500).send('db error');
          
          res.json({
            total: totalRow.total,
            today: todayRow.today,
            unique_ips: uniqueRow.unique_ips,
            recent: recent
          });
        });
      });
    });
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