const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseManager {
  constructor(appInstance) {
    this.app = appInstance || app;
    this.db = null;
    this.dbPath = null;
    this.ready = this.init();
  }

  async init() {
    const wasmPath = this.app.isPackaged
      ? path.join(process.resourcesPath, 'sql-wasm.wasm')
      : undefined;

    const SQL = await initSqlJs(wasmPath ? {
      locateFile: () => wasmPath
    } : {});
    const userDataPath = this.app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'petshop-stok.db');
    
    // Improved Migration: Look for old app data folder globally
    const appDataParent = path.dirname(userDataPath);
    const oldAppFolder = path.join(appDataParent, 'yemmama-stok');
    const oldDbGlobalPath = path.join(oldAppFolder, 'yemmama-stok.db');
    const oldImagesGlobalPath = path.join(oldAppFolder, 'product_images');
    
    const localOldDbPath = path.join(userDataPath, 'yemmama-stok.db');

    // If new DB doesn't exist, try migrations
    if (!fs.existsSync(this.dbPath)) {
      if (fs.existsSync(localOldDbPath)) {
        try {
          fs.renameSync(localOldDbPath, this.dbPath);
          console.log('Database migrated from local yemmama-stok.db');
        } catch (err) {
          console.error('Local Migration failed:', err);
        }
      } else if (fs.existsSync(oldDbGlobalPath)) {
        try {
          fs.copyFileSync(oldDbGlobalPath, this.dbPath);
          console.log('Database completely copied from yemmama-stok folder.');
          
          const newImagesDir = path.join(userDataPath, 'product-images');
          if (!fs.existsSync(newImagesDir)) {
            fs.mkdirSync(newImagesDir, { recursive: true });
          }
          
          if (fs.existsSync(oldImagesGlobalPath)) {
            const images = fs.readdirSync(oldImagesGlobalPath);
            for(const img of images) {
              fs.copyFileSync(path.join(oldImagesGlobalPath, img), path.join(newImagesDir, img));
            }
            console.log('Images also auto-migrated.');
          }
        } catch (err) {
          console.error('Global Migration failed:', err);
        }
      }
    }

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initTables();
    this.save();
    try { setTimeout(() => this.backup(), 5000); } catch (e) { } // Auto-backup on start (delayed)
    return true;
  }

  save() {
    if (!this.db || !this.dbPath) return;

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        const tempPath = this.dbPath + '.tmp';

        // 1. Write to temp file
        fs.writeFileSync(tempPath, buffer);

        // 2. Try atomic rename first
        try {
          if (fs.existsSync(this.dbPath)) {
            // Windows: sometimes requires unlinking target first or ensuring it's not locked
            // We'll try direct rename first, which is atomic on POSIX
            fs.renameSync(tempPath, this.dbPath);
          } else {
            fs.renameSync(tempPath, this.dbPath);
          }
        } catch (renameErr) {
          // 3. Fallback: Copy and Delete (Windows friendly)
          // If rename fails (e.g. cross-device or locked), try copy + unlink
          console.log('Rename failed, trying copy/unlink strategy...');
          try {
            fs.copyFileSync(tempPath, this.dbPath);
            fs.unlinkSync(tempPath);
          } catch (copyErr) {
            // If copy fails, maybe target is locked. cleaning temp and throwing to retry
            try { fs.unlinkSync(tempPath); } catch (e) { }
            throw copyErr;
          }
        }

        // Success
        return;

      } catch (err) {
        console.error(`Database Save Attempt ${retryCount + 1} Failed:`, err.message);
        retryCount++;
        // Write simple error log to check if this is happening
        try {
          fs.appendFileSync(path.join(this.app.getPath('userData'), 'db-errors.log'),
            `${new Date().toISOString()} - Save Error: ${err.message}\n`);
        } catch (e) { }

        if (retryCount >= maxRetries) {
          console.error('CRITICAL: All database save attempts failed!');
        } else {
          // Small delay before retry (100ms)
          const start = Date.now();
          while (Date.now() - start < 100) { }
        }
      }
    }
  }

  // Create a backup copy
  backup() {
    try {
      if (!this.db || !this.dbPath) return null;

      const userDataPath = this.app.getPath('userData');
      const backupsDir = path.join(userDataPath, 'backups');

      // Ensure backups directory exists
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `petshop-stok_${timestamp}.db`);

      // Save current state first
      this.save();

      // Copy file
      fs.copyFileSync(this.dbPath, backupPath);
      console.log('Database backup created:', backupPath);

      // Cleanup old backups (keep last 20)
      this.cleanupBackups(backupsDir);

      return backupPath;
    } catch (err) {
      console.error('Backup creation failed:', err);
      return null;
    }
  }

  cleanupBackups(dir) {
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .map(f => ({ name: f, path: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time); // Newest first

      // Cleanup old backups (keep last 100)
      if (files.length > 100) {
        const toDelete = files.slice(100);
        toDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (e) {
      console.error('Cleanup backups error:', e);
    }
  }

  initTables() {
    // Products table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT,
        name TEXT NOT NULL,
        image_url TEXT,
        purchase_price REAL NOT NULL DEFAULT 0,
        sale_price REAL NOT NULL DEFAULT 0,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        critical_stock_level INTEGER NOT NULL DEFAULT 5,
        expiration_date TEXT,
        skt_discount_rate REAL NOT NULL DEFAULT 0,
        skt_alert_days INTEGER NOT NULL DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add barcode and image_url columns for existing databases
    try {
      const productColumns = this.all("PRAGMA table_info(products)");

      const hasBarcode = productColumns.some(col => col.name === 'barcode');
      if (!hasBarcode) {
        this.db.run("ALTER TABLE products ADD COLUMN barcode TEXT");
        console.log('Migration: barcode column added to products table');
      }

      const hasImage = productColumns.some(col => col.name === 'image_url');
      if (!hasImage) {
        this.db.run("ALTER TABLE products ADD COLUMN image_url TEXT");
        console.log('Migration: image_url column added to products table');
      }

      const hasExpiration = productColumns.some(col => col.name === 'expiration_date');
      if (!hasExpiration) {
        this.db.run("ALTER TABLE products ADD COLUMN expiration_date TEXT");
        this.db.run("ALTER TABLE products ADD COLUMN skt_discount_rate REAL NOT NULL DEFAULT 0");
        this.db.run("ALTER TABLE products ADD COLUMN skt_alert_days INTEGER NOT NULL DEFAULT 30");
        console.log('Migration: SKT columns added to products table');
      }
    } catch (e) {
      console.log('Products migration check skipped:', e.message);
    }

    // Migration: Fix broken image paths from restored backups
    try {
      const allProducts = this.all("SELECT id, image_url FROM products WHERE image_url IS NOT NULL AND image_url != ''");
      const userDataPath = this.app.getPath('userData');
      const expectedImagesDir = path.join(userDataPath, 'product-images');
      let fixedCount = 0;

      for (const product of allProducts) {
        // Parse the existing url. E.g. "file:///C:/Users/OldUser/..."
        const oldUrl = product.image_url;
        if (oldUrl.startsWith('file://')) {
          const oldPath = decodeURIComponent(oldUrl.replace('file://', ''));
          const filename = path.basename(oldPath);

          // Construct the new path expected on this machine
          const newPath = path.join(expectedImagesDir, filename);
          const newUrl = `file://${newPath}`;

          // Only update if the base path is actually different
          if (oldUrl !== newUrl) {
            this.db.run("UPDATE products SET image_url = ? WHERE id = ?", [newUrl, product.id]);
            fixedCount++;
          }
        }
      }
      if (fixedCount > 0) {
        console.log(`Migration: Fixed ${fixedCount} broken image paths after restore.`);
      }
    } catch (e) {
      console.error('Image path restoration skipped/failed:', e.message);
    }

    // Categories table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `);

    // Migration: Add category column to products
    try {
      const productColumns = this.all("PRAGMA table_info(products)");
      const hasCategory = productColumns.some(col => col.name === 'category');
      if (!hasCategory) {
        this.db.run("ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'Genel'");
        console.log('Migration: category column added to products table');
      }
    } catch (e) {
      console.log('Category migration check skipped:', e.message);
    }

    // Default categories if empty
    const categoryCount = this.get('SELECT COUNT(*) as count FROM categories');
    if (categoryCount.count === 0) {
      this.run("INSERT INTO categories (name) VALUES ('Genel'), ('Kedi Maması'), ('Köpek Maması'), ('Kuş Yemi'), ('Aksesuar')");
    }

    // Sales table (individual items)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        category TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        purchase_price REAL NOT NULL,
        total_price REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        profit REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'nakit',
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (order_id) REFERENCES sale_orders(id)
      )
    `);

    // Migration: Add category column to sales
    try {
      const salesColumns = this.all("PRAGMA table_info(sales)");
      const hasCategory = salesColumns.some(col => col.name === 'category');
      if (!hasCategory) {
        this.db.run("ALTER TABLE sales ADD COLUMN category TEXT");
        console.log('Migration: category column added to sales table');
      }
    } catch (e) {
      console.log('Sales category migration check skipped:', e.message);
    }

    // ... (Rest of initTables)

    // Sale orders table (batch sales with discount)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sale_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        final_amount REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        profit REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'nakit',
        cash_amount REAL NOT NULL DEFAULT 0,
        card_amount REAL NOT NULL DEFAULT 0,
        sale_note TEXT,
        order_type TEXT NOT NULL DEFAULT 'Dükkan',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration for sale_orders
    try {
      const orderColumns = this.all("PRAGMA table_info(sale_orders)");
      const hasPaymentMethod = orderColumns.some(col => col.name === 'payment_method');
      if (!hasPaymentMethod) {
        this.db.run("ALTER TABLE sale_orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'nakit'");
        console.log('Migration: payment_method column added to sale_orders table');
      }

      const hasCashAmount = orderColumns.some(col => col.name === 'cash_amount');
      if (!hasCashAmount) {
        this.db.run("ALTER TABLE sale_orders ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0");
        console.log('Migration: cash_amount column added to sale_orders table');
      }

      const hasCardAmount = orderColumns.some(col => col.name === 'card_amount');
      if (!hasCardAmount) {
        this.db.run("ALTER TABLE sale_orders ADD COLUMN card_amount REAL NOT NULL DEFAULT 0");
        console.log('Migration: card_amount column added to sale_orders table');
      }

      const hasSaleNote = orderColumns.some(col => col.name === 'sale_note');
      if (!hasSaleNote) {
        this.db.run("ALTER TABLE sale_orders ADD COLUMN sale_note TEXT");
        console.log('Migration: sale_note column added to sale_orders table');
      }

      const hasOrderType = orderColumns.some(col => col.name === 'order_type');
      if (!hasOrderType) {
        this.db.run("ALTER TABLE sale_orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'Dükkan'");
        console.log('Migration: order_type column added to sale_orders table');
      }
    } catch (e) {
      console.log('Order Migration check skipped:', e.message);
    }

    // Customers table for credit tracking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Credit transactions table (debts and payments)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('debt', 'payment')),
        amount REAL NOT NULL,
        description TEXT,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Waste logs table (zayi/fire kayıtları)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS waste_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        cost_price REAL NOT NULL,
        reason TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Expenses table (Giderler)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table for RBAC
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        pin_code TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'cashier'
      )
    `);

    // Migration / Seeding: Ensure default users exist
    try {
      const userCount = this.get('SELECT COUNT(*) as count FROM users');
      if (userCount.count === 0) {
        this.run("INSERT INTO users (fullname, pin_code, role) VALUES ('Patron', '1234', 'admin')");
        this.run("INSERT INTO users (fullname, pin_code, role) VALUES ('Kasiyer', '5678', 'cashier')");
        console.log('Migration: Default Admin and Cashier accounts created.');
      }
    } catch (e) {
      console.log('RBAC Seeding skipped:', e.message);
    }
  }

  // ============ AUTH / RBAC MANAGEMENT ============

  verifyUserPin(pin) {
    const user = this.get('SELECT id, fullname, role FROM users WHERE pin_code = ?', [pin]);
    if (!user) throw new Error('Geçersiz PIN Kodu!');
    return user;
  }

  verifyAdminPin(pin) {
    const user = this.get('SELECT id, fullname, role FROM users WHERE pin_code = ? AND role = ?', [pin, 'admin']);
    return !!user;
  }

  getAllUsers() {
    return this.all('SELECT id, fullname, role FROM users ORDER BY id ASC');
  }

  updateUserPin(id, oldPin, newPin) {
    if (!newPin || newPin.length !== 4) throw new Error('Yeni PIN 4 haneli olmalıdır.');
    
    // Validate old PIN
    const user = this.get('SELECT pin_code FROM users WHERE id = ?', [id]);
    if (!user) throw new Error('Kullanıcı bulunamadı.');
    if (user.pin_code !== oldPin) throw new Error('Mevcut PIN hatalı!');

    // Check if new PIN is already used
    const existing = this.get('SELECT id FROM users WHERE pin_code = ? AND id != ?', [newPin, id]);
    if (existing) throw new Error('Bu PIN kodu başka bir kullanıcı tarafından kullanılıyor!');

    this.run('UPDATE users SET pin_code = ? WHERE id = ?', [newPin, id]);
    return { success: true };
  }

  // ... (Helper methods)

  // ============ CATEGORY MANAGEMENT ============

  getAllCategories() {
    return this.all('SELECT * FROM categories ORDER BY name');
  }

  addCategory(name) {
    try {
      const result = this.run('INSERT INTO categories (name) VALUES (?)', [name]);
      return { id: result.lastInsertRowid, name };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('Bu kategori zaten mevcut.');
      }
      throw err;
    }
  }

  deleteCategory(id) {
    // Check if used? Maybe just set products to 'Genel'
    const category = this.get('SELECT name FROM categories WHERE id = ?', [id]);
    if (category) {
      this.run("UPDATE products SET category = 'Genel' WHERE category = ?", [category.name]);
      this.run('DELETE FROM categories WHERE id = ?', [id]);
    }
    return { success: true };
  }

  // Product CRUD (Updated)
  getAllProducts() {
    return this.all('SELECT * FROM products ORDER BY name');
  }

  getProductById(id) {
    return this.get('SELECT * FROM products WHERE id = ?', [id]);
  }

  createProduct(product) {
    const result = this.run(`
      INSERT INTO products (barcode, name, category, image_url, purchase_price, sale_price, stock_quantity, critical_stock_level, expiration_date, skt_discount_rate, skt_alert_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.barcode || null,
      product.name,
      product.category || 'Genel',
      product.image_url || null,
      product.purchase_price,
      product.sale_price,
      product.stock_quantity,
      product.critical_stock_level,
      product.expiration_date || null,
      product.skt_discount_rate || 0,
      product.skt_alert_days || 30
    ]);
    return { id: result.lastInsertRowid, ...product };
  }

  updateProduct(id, product) {
    this.run(`
      UPDATE products 
      SET barcode = ?,
          name = ?, 
          category = ?,
          image_url = ?,
          purchase_price = ?, 
          sale_price = ?, 
          stock_quantity = ?,
          critical_stock_level = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      product.barcode || null,
      product.name,
      product.category || 'Genel',
      product.image_url || null,
      product.purchase_price,
      product.sale_price,
      product.stock_quantity,
      product.critical_stock_level,
      id
    ]);
    return this.getProductById(id);
  }





  // Helper to run queries
  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  get(sql, params = []) {
    const results = this.all(sql, params);
    return results[0] || null;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.save();
    return { lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
  }

  // Performans: disk'e yazmadan çalıştır (toplu işlemler için)
  runBatch(sql, params = []) {
    this.db.run(sql, params);
    return { lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
  }

  // Product CRUD
  getAllProducts() {
    return this.all('SELECT * FROM products ORDER BY name');
  }

  getProductById(id) {
    return this.get('SELECT * FROM products WHERE id = ?', [id]);
  }

  createProduct(product) {
    const result = this.run(`
      INSERT INTO products (barcode, name, category, image_url, purchase_price, sale_price, stock_quantity, critical_stock_level, expiration_date, skt_discount_rate, skt_alert_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product.barcode || null,
      product.name,
      product.category || 'Genel',
      product.image_url || null,
      product.purchase_price,
      product.sale_price,
      product.stock_quantity,
      product.critical_stock_level,
      product.expiration_date || null,
      product.skt_discount_rate || 0,
      product.skt_alert_days || 30
    ]);
    return { id: result.lastInsertRowid, ...product };
  }

  updateProduct(id, product) {
    this.run(`
      UPDATE products 
      SET barcode = ?,
          name = ?, 
          category = ?,
          image_url = ?,
          purchase_price = ?, 
          sale_price = ?, 
          stock_quantity = ?,
          critical_stock_level = ?,
          expiration_date = ?,
          skt_discount_rate = ?,
          skt_alert_days = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      product.barcode || null,
      product.name,
      product.category || 'Genel',
      product.image_url || null,
      product.purchase_price,
      product.sale_price,
      product.stock_quantity,
      product.critical_stock_level,
      product.expiration_date || null,
      product.skt_discount_rate || 0,
      product.skt_alert_days || 30,
      id
    ]);
    return this.getProductById(id);
  }

  deleteProduct(id) {
    // We intentionally DO NOT delete from 'sales' and 'waste_logs'.
    // If we delete the product, past reports and accounting will be preserved 
    // because they store their own textual snapshot (product_name, etc).
    this.run('DELETE FROM products WHERE id = ?', [id]);
    return { success: true };
  }


  searchProducts(query, limit = 0) {
    if (!query || query.trim() === '') {
      return this.getAllProducts();
    }
    const sql = limit > 0
      ? `SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name LIMIT ${limit}`
      : `SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name`;
    return this.all(sql, [`%${query}%`, `%${query}%`]);
  }

  getProductByBarcode(barcode) {
    return this.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
  }

  // ============ EXPENSE MANAGEMENT (GİDERLER) ============

  addExpense(title, amount, date) {
    if (isNaN(amount) || amount < 0) throw new Error('Geçersiz gider tutarı!');
    const result = this.run(`
      INSERT INTO expenses (title, amount, date) VALUES (?, ?, ?)
    `, [title, amount, date || new Date().toISOString()]);
    return { id: result.lastInsertRowid, title, amount, date };
  }

  deleteExpense(id) {
    this.run('DELETE FROM expenses WHERE id = ?', [id]);
    return { success: true };
  }

  getExpensesByDateRange(start, end) {
    return this.all(`
      SELECT * FROM expenses
      WHERE date(date, 'localtime') BETWEEN ? AND ?
      ORDER BY date DESC
    `, [start, end]);
  }

  getExpensesByDate(date) {
    return this.all(`
      SELECT * FROM expenses
      WHERE date(date, 'localtime') = ?
      ORDER BY date DESC
    `, [date]);
  }

  // ============ WASTE MANAGEMENT ============

  createWasteLog(productId, quantity, reason) {
    if (isNaN(quantity) || quantity <= 0) throw new Error('Geçersiz silme miktarı!');
    const product = this.getProductById(productId);
    if (!product) throw new Error('Ürün bulunamadı');
    if (product.stock_quantity < quantity) throw new Error('Yetersiz stok! Mevcut: ' + product.stock_quantity);

    // Zayi kaydı oluştur
    const result = this.run(`
      INSERT INTO waste_logs (product_id, product_name, quantity, cost_price, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [productId, product.name, quantity, product.purchase_price, reason]);

    // Stoku azalt
    this.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [quantity, productId]);

    return {
      id: result.lastInsertRowid,
      product_name: product.name,
      quantity,
      cost_price: product.purchase_price,
      total_loss: product.purchase_price * quantity,
      reason
    };
  }

  getWasteByDate(date) {
    const logs = this.all(`
      SELECT * FROM waste_logs
      WHERE date(date, 'localtime') = ?
      ORDER BY date DESC
    `, [date]);

    const totalCost = logs.reduce((sum, w) => sum + (w.quantity * w.cost_price), 0);
    return { logs, total_waste_cost: totalCost };
  }

  getWasteByDateRange(start, end) {
    const logs = this.all(`
      SELECT * FROM waste_logs
      WHERE date(date, 'localtime') BETWEEN ? AND ?
      ORDER BY date DESC
    `, [start, end]);

    const totalCost = logs.reduce((sum, w) => sum + (w.quantity * w.cost_price), 0);
    return { logs, total_waste_cost: totalCost };
  }

  getCriticalStockProducts() {
    return this.all(`
      SELECT * FROM products 
      WHERE stock_quantity <= critical_stock_level 
      ORDER BY stock_quantity ASC
    `);
  }

  // ============ EXPIRATION DATE (SKT) MANAGEMENT ============
  getExpiringProducts() {
    // Get products that are not expired yet, but within their alert threshold
    // date(expiration_date, '-X days') <= today -> meaning expiration_date is within X days of today (or already expired)
    return this.all(`
      SELECT * FROM products 
      WHERE expiration_date IS NOT NULL 
        AND expiration_date != ''
        AND date('now', 'localtime') >= date(expiration_date, '-' || skt_alert_days || ' days')
      ORDER BY expiration_date ASC
    `);
  }

  // Sales - Single item (backward compatibility)
  createSale(sale) {
    const { product_id, quantity } = sale;

    // Get product info
    const product = this.getProductById(product_id);
    if (!product) throw new Error('Ürün bulunamadı');
    if (product.stock_quantity < quantity) throw new Error('Yetersiz stok');

    const total_price = product.sale_price * quantity;
    const profit = (product.sale_price - product.purchase_price) * quantity;

    // Create sale record
    const result = this.run(`
      INSERT INTO sales (product_id, product_name, category, quantity, unit_price, purchase_price, total_price, profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [product_id, product.name, product.category || 'Genel', quantity, product.sale_price, product.purchase_price, total_price, profit]);

    // Update stock
    this.run(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`, [quantity, product_id]);

    return {
      id: result.lastInsertRowid,
      product_name: product.name,
      quantity,
      total_price,
      profit
    };
  }

  // Batch sale with discount and split payment support
  createBatchSale(items, discount = 0, paymentDetails = {}) {
    const { 
      method = 'nakit', 
      cashAmount = 0, 
      cardAmount = 0, 
      note = '', 
      orderType = 'Dükkan' 
    } = paymentDetails;

    console.log('createBatchSale called with:', { items, discount, paymentDetails });

    // Calculate totals first
    let total_amount = 0;
    let total_cost = 0;
    const salesData = [];

    for (const item of items) {
      const product = this.getProductById(item.product_id);
      if (!product) throw new Error(`Ürün bulunamadı: ${item.product_id}`);
      if (product.stock_quantity < item.quantity) throw new Error(`Yetersiz stok: ${product.name}`);

      const item_total = product.sale_price * item.quantity;
      const item_cost = product.purchase_price * item.quantity;

      total_amount += item_total;
      total_cost += item_cost;

      salesData.push({
        product_id: item.product_id,
        product_name: product.name,
        category: product.category || 'Genel',
        quantity: item.quantity,
        unit_price: product.sale_price,
        purchase_price: product.purchase_price,
        total_price: item_total,
        item_cost: item_cost
      });
    }

    // Calculate final amounts with discount
    const final_amount = total_amount - discount;
    const profit = final_amount - total_cost;

    console.log('Order totals:', { total_amount, discount, final_amount, total_cost, profit });

    // Create order record (batch mode - no disk save yet)
    const orderResult = this.runBatch(`
      INSERT INTO sale_orders (total_amount, discount, final_amount, total_cost, profit, payment_method, cash_amount, card_amount, sale_note, order_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [total_amount, discount, final_amount, total_cost, profit, method, cashAmount, cardAmount, note, orderType]);

    const order_id = orderResult.lastInsertRowid;
    console.log('Created order with id:', order_id);

    // Calculate discount ratio for distributing across items (guard against division by zero)
    const discountRatio = total_amount > 0 ? (discount / total_amount) : 0;

    // Create individual sale records and update stock (batch mode)
    for (const sale of salesData) {
      // Proportionally distribute discount to each item
      const itemDiscount = sale.total_price * discountRatio;
      const adjustedTotal = sale.total_price - itemDiscount;
      const itemProfit = adjustedTotal - sale.item_cost;

      this.runBatch(`
        INSERT INTO sales (order_id, product_id, product_name, category, quantity, unit_price, purchase_price, total_price, discount_amount, profit, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [order_id, sale.product_id, sale.product_name, sale.category, sale.quantity, sale.unit_price, sale.purchase_price, adjustedTotal, itemDiscount, itemProfit, method]);

      // Update stock
      this.runBatch(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`, [sale.quantity, sale.product_id]);
    }

    // Tek seferde disk'e yaz
    this.save();
    console.log('Batch sale completed successfully');

    return {
      order_id,
      total_amount,
      discount,
      final_amount,
      profit,
      items_count: items.length
    };
  }

  // Delete Sale & Restore Stock
  deleteSale(saleId) {
    console.log('Deleting sale:', saleId);

    // 1. Get Sale Info
    const sale = this.get('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (!sale) throw new Error('Satış bulunamadı');

    // 2. Restore Stock
    this.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [sale.quantity, sale.product_id]);

    // 3. Delete Sale Record
    this.run('DELETE FROM sales WHERE id = ?', [saleId]);

    // 4. Update Order (if exists)
    if (sale.order_id) {
      // Recalculate order totals
      const remainingSales = this.all('SELECT * FROM sales WHERE order_id = ?', [sale.order_id]);

      if (remainingSales.length === 0) {
        // No items left, delete order
        this.run('DELETE FROM sale_orders WHERE id = ?', [sale.order_id]);
      } else {
        // Recalculate totals
        const newTotal = remainingSales.reduce((sum, s) => sum + s.total_price, 0);
        const newCost = remainingSales.reduce((sum, s) => sum + (s.purchase_price * s.quantity), 0);

        const order = this.get('SELECT * FROM sale_orders WHERE id = ?', [sale.order_id]);
        const newFinal = Math.max(0, newTotal - (order.discount || 0));
        const newProfit = newFinal - newCost;

        this.run(`
          UPDATE sale_orders 
          SET total_amount = ?, final_amount = ?, total_cost = ?, profit = ?
          WHERE id = ?
        `, [newTotal, newFinal, newCost, newProfit, sale.order_id]);
      }
    }

    return { success: true };
  }

  // Get orders with discount info
  getTodayOrders() {
    return this.all(`
      SELECT * FROM sale_orders 
      WHERE date(created_at) = date('now', 'localtime')
      ORDER BY created_at DESC
    `);
  }

  getTodaySales() {
    return this.all(`
      SELECT * FROM sales 
      WHERE date(sale_date) = date('now', 'localtime')
      ORDER BY sale_date DESC
    `);
  }

  getSalesByDateRange(start, end) {
    return this.all(`
      SELECT * FROM sales 
      WHERE date(sale_date, 'localtime') BETWEEN ? AND ?
      ORDER BY sale_date DESC
    `, [start, end]);
  }

  // Reports
  getDailyReport(date) {
    const report = this.get(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(quantity), 0) as total_items
      FROM sales 
      WHERE date(sale_date, 'localtime') = ?
    `, [date]);

    // Get sales with order discount info
    const sales = this.all(`
      SELECT 
        s.*,
        o.total_amount as order_total,
        o.discount as order_discount,
        o.final_amount as order_final,
        o.order_type,
        o.sale_note,
        o.cash_amount,
        o.card_amount,
        o.payment_method as order_payment_method
      FROM sales s
      LEFT JOIN sale_orders o ON s.order_id = o.id
      WHERE date(s.sale_date, 'localtime') = ?
      ORDER BY s.sale_date DESC
    `, [date]);

    // Get orders for the day (for summary)
    const orders = this.all(`
      SELECT * FROM sale_orders 
      WHERE date(created_at, 'localtime') = ?
      ORDER BY created_at DESC
    `, [date]);

    // Calculate total discount for the day
    const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

    // Zayi/Fire maliyeti
    const wasteData = this.getWasteByDate(date);

    // Giderler (Expenses)
    const expenses = this.getExpensesByDate(date);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Payment method breakdown
    const p = this.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'nakit' THEN final_amount ELSE cash_amount END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'kart' THEN final_amount ELSE card_amount END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'iban' THEN final_amount ELSE 0 END), 0) as iban_total,
        COALESCE(SUM(CASE WHEN payment_method = 'online' THEN final_amount ELSE 0 END), 0) as online_total,
        SUM(CASE WHEN payment_method = 'nakit' OR (payment_method = 'parçalı' AND cash_amount > 0) THEN 1 ELSE 0 END) as cash_count,
        SUM(CASE WHEN payment_method = 'kart' OR (payment_method = 'parçalı' AND card_amount > 0) THEN 1 ELSE 0 END) as card_count,
        SUM(CASE WHEN payment_method = 'iban' THEN 1 ELSE 0 END) as iban_count,
        SUM(CASE WHEN payment_method = 'online' THEN 1 ELSE 0 END) as online_count
      FROM sale_orders
      WHERE date(created_at, 'localtime') = ? 
    `, [date]);

    const paymentBreakdown = [];
    if (p.cash_total > 0 || p.cash_count > 0) paymentBreakdown.push({payment_method: 'nakit', count: p.cash_count, total: p.cash_total});
    if (p.card_total > 0 || p.card_count > 0) paymentBreakdown.push({payment_method: 'kart', count: p.card_count, total: p.card_total});
    if (p.iban_total > 0 || p.iban_count > 0) paymentBreakdown.push({payment_method: 'iban', count: p.iban_count, total: p.iban_total});
    if (p.online_total > 0 || p.online_count > 0) paymentBreakdown.push({payment_method: 'online', count: p.online_count, total: p.online_total});

    return {
      ...report,
      sales,
      orders,
      total_discount: totalDiscount,
      total_waste_cost: wasteData.total_waste_cost,
      waste_logs: wasteData.logs,
      total_expenses: totalExpenses,
      expenses,
      payment_breakdown: paymentBreakdown
    };
  }

  getMonthlyReport(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const report = this.get(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(quantity), 0) as total_items
      FROM sales 
      WHERE date(sale_date, 'localtime') BETWEEN ? AND ?
    `, [startDate, endDate]);

    const daily_breakdown = this.all(`
      SELECT 
        date(sale_date) as date,
        COUNT(*) as sales_count,
        SUM(total_price) as revenue,
        SUM(profit) as profit
      FROM sales 
      WHERE date(sale_date, 'localtime') BETWEEN ? AND ?
      GROUP BY date(sale_date, 'localtime')
      ORDER BY date
    `, [startDate, endDate]);

    // Zayi/Fire maliyeti
    const wasteData = this.getWasteByDateRange(startDate, endDate);

    // Giderler (Expenses)
    const expenses = this.getExpensesByDateRange(startDate, endDate);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Payment method breakdown
    const p = this.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'nakit' THEN final_amount ELSE cash_amount END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'kart' THEN final_amount ELSE card_amount END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'iban' THEN final_amount ELSE 0 END), 0) as iban_total,
        COALESCE(SUM(CASE WHEN payment_method = 'online' THEN final_amount ELSE 0 END), 0) as online_total,
        SUM(CASE WHEN payment_method = 'nakit' OR (payment_method = 'parçalı' AND cash_amount > 0) THEN 1 ELSE 0 END) as cash_count,
        SUM(CASE WHEN payment_method = 'kart' OR (payment_method = 'parçalı' AND card_amount > 0) THEN 1 ELSE 0 END) as card_count,
        SUM(CASE WHEN payment_method = 'iban' THEN 1 ELSE 0 END) as iban_count,
        SUM(CASE WHEN payment_method = 'online' THEN 1 ELSE 0 END) as online_count
      FROM sale_orders
      WHERE date(created_at, 'localtime') BETWEEN ? AND ?
    `, [startDate, endDate]);

    const paymentBreakdown = [];
    if (p.cash_total > 0 || p.cash_count > 0) paymentBreakdown.push({payment_method: 'nakit', count: p.cash_count, total: p.cash_total});
    if (p.card_total > 0 || p.card_count > 0) paymentBreakdown.push({payment_method: 'kart', count: p.card_count, total: p.card_total});
    if (p.iban_total > 0 || p.iban_count > 0) paymentBreakdown.push({payment_method: 'iban', count: p.iban_count, total: p.iban_total});
    if (p.online_total > 0 || p.online_count > 0) paymentBreakdown.push({payment_method: 'online', count: p.online_count, total: p.online_total});

    return {
      ...report,
      daily_breakdown,
      total_waste_cost: wasteData.total_waste_cost,
      total_expenses: totalExpenses,
      expenses,
      payment_breakdown: paymentBreakdown
    };
  }

  getDashboardStats() {
    const today = this.get(`
      SELECT 
        COALESCE(SUM(total_price), 0) as revenue,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(*) as sales_count
      FROM sales 
      WHERE date(sale_date, 'localtime') = date('now', 'localtime')
    `);

    const thisMonth = this.get(`
      SELECT 
        COALESCE(SUM(total_price), 0) as revenue,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(*) as sales_count
      FROM sales 
      WHERE strftime('%Y-%m', sale_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `);

    const totalProducts = this.get('SELECT COUNT(*) as count FROM products');
    const criticalStockProducts = this.getCriticalStockProducts();

    const recentSales = this.all(`
      SELECT * FROM sales 
      ORDER BY sale_date DESC 
      LIMIT 5
    `);

    // Bugünkü zayi maliyeti (yerel saat kullan)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayWaste = this.getWasteByDate(todayStr);

    // Bu ayki zayi maliyeti
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
    const monthWaste = this.getWasteByDateRange(monthStart, monthEnd);

    return {
      today: today || { revenue: 0, profit: 0, sales_count: 0 },
      thisMonth: thisMonth || { revenue: 0, profit: 0, sales_count: 0 },
      totalProducts: totalProducts?.count || 0,
      criticalStockCount: criticalStockProducts.length,
      criticalStockProducts: criticalStockProducts.slice(0, 5),
      recentSales,
      todayWasteCost: todayWaste.total_waste_cost,
      monthWasteCost: monthWaste.total_waste_cost
    };
  }

  // ============ CUSTOMER MANAGEMENT ============

  getAllCustomers() {
    return this.all(`
      SELECT c.*, 
        COALESCE(SUM(CASE WHEN ct.type = 'debt' THEN ct.amount ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as total_paid
      FROM customers c
      LEFT JOIN credit_transactions ct ON c.id = ct.customer_id
      GROUP BY c.id
      ORDER BY c.name
    `);
  }

  getCustomerById(id) {
    const customer = this.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (customer) {
      const balance = this.getCustomerBalance(id);
      return { ...customer, ...balance };
    }
    return null;
  }

  createCustomer(customer) {
    const result = this.run(`
      INSERT INTO customers (name, phone, notes)
      VALUES (?, ?, ?)
    `, [customer.name, customer.phone || '', customer.notes || '']);
    return { id: result.lastInsertRowid, ...customer };
  }

  updateCustomer(id, customer) {
    this.run(`
      UPDATE customers 
      SET name = ?, phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [customer.name, customer.phone || '', customer.notes || '', id]);
    return this.getCustomerById(id);
  }

  deleteCustomer(id) {
    // Delete all transactions first
    this.run('DELETE FROM credit_transactions WHERE customer_id = ?', [id]);
    this.run('DELETE FROM customers WHERE id = ?', [id]);
    return { success: true };
  }

  searchCustomers(query) {
    return this.all(`
      SELECT c.*, 
        COALESCE(SUM(CASE WHEN ct.type = 'debt' THEN ct.amount ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as total_paid
      FROM customers c
      LEFT JOIN credit_transactions ct ON c.id = ct.customer_id
      WHERE c.name LIKE ? OR c.phone LIKE ?
      GROUP BY c.id
      ORDER BY c.name
      LIMIT 20
    `, [`%${query}%`, `%${query}%`]);
  }

  getCustomerBalance(customerId) {
    const result = this.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as total_paid
      FROM credit_transactions 
      WHERE customer_id = ?
    `, [customerId]);

    const total_debt = result?.total_debt || 0;
    const total_paid = result?.total_paid || 0;
    const balance = total_debt - total_paid;

    return { total_debt, total_paid, balance };
  }

  // ============ CREDIT TRANSACTIONS ============

  addDebt(customerId, amount, description) {
    if (isNaN(amount) || amount <= 0) throw new Error('Geçersiz borç tutarı!');
    const result = this.run(`
      INSERT INTO credit_transactions (customer_id, type, amount, description)
      VALUES (?, 'debt', ?, ?)
    `, [customerId, amount, description || 'Veresiye satış']);
    return { id: result.lastInsertRowid, type: 'debt', amount, description };
  }

  addPayment(customerId, amount, description) {
    if (isNaN(amount) || amount <= 0) throw new Error('Geçersiz ödeme tutarı!');
    const result = this.run(`
      INSERT INTO credit_transactions (customer_id, type, amount, description)
      VALUES (?, 'payment', ?, ?)
    `, [customerId, amount, description || 'Ödeme']);
    return { id: result.lastInsertRowid, type: 'payment', amount, description };
  }

  getCustomerTransactions(customerId) {
    return this.all(`
      SELECT * FROM credit_transactions 
      WHERE customer_id = ?
      ORDER BY transaction_date DESC
    `, [customerId]);
  }

  deleteTransaction(id) {
    this.run('DELETE FROM credit_transactions WHERE id = ?', [id]);
    return { success: true };
  }

  getCustomersWithDebt() {
    return this.all(`
      SELECT c.*, 
        COALESCE(SUM(CASE WHEN ct.type = 'debt' THEN ct.amount ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as total_paid
      FROM customers c
      LEFT JOIN credit_transactions ct ON c.id = ct.customer_id
      GROUP BY c.id
      HAVING (total_debt - total_paid) > 0
      ORDER BY (total_debt - total_paid) DESC
    `);
  }

  getTotalDebtStats() {
    const result = this.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) as total_paid
      FROM credit_transactions
    `);

    const customerCount = this.get('SELECT COUNT(*) as count FROM customers');
    const debtorCount = this.getCustomersWithDebt().length;

    return {
      total_debt: result?.total_debt || 0,
      total_paid: result?.total_paid || 0,
      outstanding: (result?.total_debt || 0) - (result?.total_paid || 0),
      customer_count: customerCount?.count || 0,
      debtor_count: debtorCount
    };
  }

  // ============ DATA RESET METHODS ============

  resetSalesData() {
    this.runBatch('DELETE FROM sales');
    this.runBatch('DELETE FROM sale_orders');
    this.run('DELETE FROM waste_logs');
    return { success: true, message: 'Satış ve zayi verileri silindi' };
  }

  resetCustomerData() {
    this.runBatch('DELETE FROM credit_transactions');
    this.run('DELETE FROM customers');
    return { success: true, message: 'Müşteri verileri silindi' };
  }

  resetProductData() {
    this.runBatch('DELETE FROM sales');
    this.runBatch('DELETE FROM sale_orders');
    this.runBatch('DELETE FROM waste_logs');
    this.run('DELETE FROM products');
    return { success: true, message: 'Ürün, satış ve zayi verileri silindi' };
  }

  resetAllData() {
    this.runBatch('DELETE FROM credit_transactions');
    this.runBatch('DELETE FROM customers');
    this.runBatch('DELETE FROM sales');
    this.runBatch('DELETE FROM sale_orders');
    this.runBatch('DELETE FROM waste_logs');
    this.run('DELETE FROM products');
    return { success: true, message: 'Tüm veriler silindi' };
  }

  // ============ EXPORT METHODS ============

  async exportDailyReport(date) {
    const report = this.getDailyReport(date);
    const { generateDailyPDF } = require('./pdfExport');
    const pdfBuffer = await generateDailyPDF(report, date);
    return { buffer: pdfBuffer, filename: `Gunluk_Rapor_${date}.pdf` };
  }

  async exportMonthlyReport(year, month) {
    const report = this.getMonthlyReport(year, month);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    const wasteData = this.getWasteByDateRange(startDate, endDate);
    // Fetch expenses for the month
    const expenses = this.getExpensesByDateRange(startDate, endDate);
    const { generateMonthlyPDF } = require('./pdfExport');
    // Pass expenses to PDF generator
    const pdfBuffer = await generateMonthlyPDF(report, year, month, wasteData, expenses);
    return { buffer: pdfBuffer, filename: `Aylik_Rapor_${year}_${String(month).padStart(2, '0')}.pdf` };
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0);
  }
}

module.exports = DatabaseManager;

