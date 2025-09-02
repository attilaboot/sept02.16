const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Helyi backend szerver
let localServer;
let mainWindow;

// SQLite adatbázis inicializálás
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'turbo-service.db');
  const db = new sqlite3.Database(dbPath);
  
  // Táblák létrehozása
  db.serialize(() => {
    // Ügyfelek tábla
    db.run(`CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      company_name TEXT,
      tax_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Munkalapok tábla
    db.run(`CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      work_number TEXT NOT NULL,
      work_sequence INTEGER,
      client_id TEXT,
      turbo_code TEXT NOT NULL,
      car_make TEXT,
      car_model TEXT,
      car_year INTEGER,
      engine_code TEXT,
      general_notes TEXT,
      received_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'DRAFT',
      cleaning_price REAL DEFAULT 170.0,
      reconditioning_price REAL DEFAULT 170.0,
      turbo_price REAL DEFAULT 240.0,
      is_finalized BOOLEAN DEFAULT 0,
      quote_sent BOOLEAN DEFAULT 0,
      quote_accepted BOOLEAN DEFAULT 0,
      estimated_completion DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`);

    // Autó márkák tábla
    db.run(`CREATE TABLE IF NOT EXISTS car_makes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Alkatrészek tábla
    db.run(`CREATE TABLE IF NOT EXISTS turbo_parts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      part_code TEXT NOT NULL UNIQUE,
      supplier TEXT NOT NULL,
      price REAL DEFAULT 0.0,
      in_stock BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Munkafolyamatok tábla
    db.run(`CREATE TABLE IF NOT EXISTS work_processes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      estimated_time INTEGER DEFAULT 0,
      base_price REAL DEFAULT 0.0,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Alapadatok beszúrása ha üres a DB
    db.get("SELECT COUNT(*) as count FROM car_makes", (err, row) => {
      if (err) return;
      if (row.count === 0) {
        insertInitialData(db);
      }
    });
  });
  
  return db;
}

// Alapadatok beszúrása
function insertInitialData(db) {
  const carMakes = ['BMW', 'Audi', 'Mercedes-Benz', 'Volkswagen', 'Ford', 'Peugeot', 'Renault', 'Opel', 'Citroen', 'Skoda'];
  
  carMakes.forEach(make => {
    const id = generateId();
    db.run("INSERT INTO car_makes (id, name) VALUES (?, ?)", [id, make]);
  });

  // Munkafolyamatok
  const processes = [
    {name: 'Szétszerelés', category: 'Disassembly', time: 60, price: 80.0},
    {name: 'Tisztítás', category: 'Cleaning', time: 90, price: 120.0},
    {name: 'Diagnosztika', category: 'Diagnosis', time: 45, price: 60.0},
    {name: 'Alkatrész csere', category: 'Repair', time: 120, price: 150.0},
    {name: 'Összeszerelés', category: 'Assembly', time: 90, price: 100.0},
    {name: 'Tesztelés', category: 'Testing', time: 30, price: 40.0}
  ];

  processes.forEach(proc => {
    const id = generateId();
    db.run("INSERT INTO work_processes (id, name, category, estimated_time, base_price) VALUES (?, ?, ?, ?, ?)", 
      [id, proc.name, proc.category, proc.time, proc.price]);
  });

  // Alkatrészek
  const parts = [
    {category: 'C.H.R.A', code: '1303-090-400', supplier: 'Melett', price: 450.0},
    {category: 'C.H.R.A', code: '1303-090-401', supplier: 'Vallion', price: 420.0},
    {category: 'GEO', code: '5306-016-071-0001', supplier: 'Melett', price: 85.0},
    {category: 'GEO', code: '5306-016-072-0001', supplier: 'Vallion', price: 80.0},
    {category: 'ACT', code: '2061-016-006', supplier: 'Melett', price: 120.0},
    {category: 'ACT', code: '2061-016-007', supplier: 'Vallion', price: 115.0},
    {category: 'SET.GAR', code: 'K7-110690', supplier: 'Melett', price: 25.0},
    {category: 'SET.GAR', code: 'K7-110691', supplier: 'Vallion', price: 22.0}
  ];

  parts.forEach(part => {
    const id = generateId();
    db.run("INSERT INTO turbo_parts (id, category, part_code, supplier, price) VALUES (?, ?, ?, ?, ?)", 
      [id, part.category, part.code, part.supplier, part.price]);
  });
}

// UUID generátor
function generateId() {
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helyi API szerver indítása
function startLocalServer() {
  const app = express();
  const db = initDatabase();
  
  app.use(cors());
  app.use(express.json());

  // API végpontok
  app.get('/api/', (req, res) => {
    res.json({ message: 'Turbó Szerviz Kezelő API működik (Desktop verzió)' });
  });

  // Ügyfelek
  app.get('/api/clients', (req, res) => {
    const search = req.query.search;
    let query = "SELECT * FROM clients";
    let params = [];
    
    if (search) {
      query += " WHERE name LIKE ? OR phone LIKE ? OR company_name LIKE ?";
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    query += " ORDER BY name";
    
    db.all(query, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  app.post('/api/clients', (req, res) => {
    const { name, phone, email, address, company_name, tax_number, notes } = req.body;
    const id = generateId();
    
    db.run("INSERT INTO clients (id, name, phone, email, address, company_name, tax_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name, phone, email || '', address || '', company_name || '', tax_number || '', notes || ''],
      function(err) {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        db.get("SELECT * FROM clients WHERE id = ?", [id], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(row);
        });
      });
  });

  // Autó márkák
  app.get('/api/car-makes', (req, res) => {
    db.all("SELECT * FROM car_makes ORDER BY name", (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // Munkafolyamatok
  app.get('/api/work-processes', (req, res) => {
    db.all("SELECT * FROM work_processes WHERE active = 1 ORDER BY category", (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // Alkatrészek
  app.get('/api/turbo-parts', (req, res) => {
    const category = req.query.category;
    let query = "SELECT * FROM turbo_parts";
    let params = [];
    
    if (category) {
      query += " WHERE category = ?";
      params = [category];
    }
    query += " ORDER BY category";
    
    db.all(query, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  // Munkalapok
  app.get('/api/work-orders', (req, res) => {
    const query = `
      SELECT wo.*, c.name as client_name, c.phone as client_phone,
             (wo.car_make || ' ' || wo.car_model || 
              CASE WHEN wo.car_year IS NOT NULL THEN ' (' || wo.car_year || ')' ELSE '' END) as car_info,
             (wo.cleaning_price + wo.reconditioning_price + wo.turbo_price) as total_amount
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      ORDER BY wo.created_at DESC
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    });
  });

  app.post('/api/work-orders', (req, res) => {
    const { client_id, turbo_code, car_make, car_model, car_year, engine_code, general_notes } = req.body;
    
    // Következő sorszám generálás
    db.get("SELECT MAX(work_sequence) as max_seq FROM work_orders", (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const nextSeq = (row.max_seq || 0) + 1;
      const workNumber = String(nextSeq).padStart(5, '0');
      const id = generateId();
      
      db.run(`INSERT INTO work_orders 
        (id, work_number, work_sequence, client_id, turbo_code, car_make, car_model, car_year, engine_code, general_notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, workNumber, nextSeq, client_id, turbo_code, car_make || '', car_model || '', car_year || null, engine_code || '', general_notes || ''],
        function(err) {
          if (err) {
            res.status(400).json({ error: err.message });
            return;
          }
          
          db.get("SELECT * FROM work_orders WHERE id = ?", [id], (err, row) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            res.json(row);
          });
        });
    });
  });

  const port = 8001;
  localServer = app.listen(port, 'localhost', () => {
    console.log(`Helyi API szerver fut: http://localhost:${port}`);
  });
}

// Electron app events
function createWindow() {
  // Helyi szerver indítása
  startLocalServer();

  // Fő ablak létrehozása
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    title: 'Turbó Szerviz Kezelő',
    icon: path.join(__dirname, 'assets', 'icon.png'), // ha van icon
    show: false // Ne jelenjen meg azonnal
  });

  // Menü eltávolítása (opcionális)
  Menu.setApplicationMenu(null);

  // React app betöltése a helyi szerverről
  mainWindow.loadURL('http://localhost:3000');

  // Ablak megjelenítése amikor kész
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Dev tools (fejlesztéshez)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (localServer) {
      localServer.close();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (localServer) {
    localServer.close();
  }
});