// server.js — Node.js + Express + SQLite + Telegram уведомление
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const XLSX = require('xlsx');
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
  stmt.run(name, price, image || '', stock || 1, category_id || null, function(err){
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
    [name, price, image || '', stock || 1, category_id || null, id], function(err) {
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
    
    let imported = 0;
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

      // Вставляем товар
      await new Promise((resolve, reject) => {
        const stmt = db.prepare(
          `INSERT INTO products (name, price, image, stock, category_id) VALUES (?, ?, ?, ?, ?)`
        );
        stmt.run(name, price, image, stockValue, category_id, function(err) {
          if (err) {
            errors.push(`Строка ${i + 2}: ошибка БД - ${err.message}`);
            reject(err);
          } else {
            imported++;
            resolve();
          }
        });
        stmt.finalize();
      }).catch(() => {});
    }

    // Файл в памяти, не нужно удалять

    res.json({
      success: true,
      imported,
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
  const { name, phone, address, items, total, location } = req.body || {};
  if(!name || !phone) return res.status(400).send('name and phone are required');

  const stmt = db.prepare(`INSERT INTO orders (name,phone,address,items,total) VALUES (?,?,?,?,?)`);
  stmt.run(name, phone, address || '', JSON.stringify(items||{}), total || 0, async function(err){
    if(err) {
      console.error(err);
      return res.status(500).send('db error');
    }

    // 📩 Отправляем заказ в Telegram с координатами
    await sendOrderToTelegram({ name, phone, address, items, total, location });

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