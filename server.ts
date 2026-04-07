import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'burger-manager-super-secret-key';

app.use(express.json());

// Initialize SQLite Database
const db = new Database('burger_manager.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    price REAL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    type TEXT, -- 'Local' or 'Delivery'
    status TEXT, -- 'pending', 'preparing', 'completed', 'cancelled'
    total REAL,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    waiter_id INTEGER,
    commercial_date TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    menu_item_id INTEGER,
    quantity INTEGER,
    notes TEXT,
    price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
  );
`);

// Seed initial admin user if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedAdminPassword, 'ADM');
}

// Seed initial menu items if empty
const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get() as { count: number };
if (menuCount.count === 0) {
  const insertMenu = db.prepare('INSERT INTO menu_items (name, category, price) VALUES (?, ?, ?)');
  insertMenu.run('X-Burger', 'Lanches', 25.00);
  insertMenu.run('X-Bacon', 'Lanches', 28.50);
  insertMenu.run('Batata Frita', 'Porções', 15.00);
  insertMenu.run('Coca-Cola 350ml', 'Bebidas', 6.00);
  insertMenu.run('Suco de Laranja', 'Bebidas', 8.00);
}

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Routes

// Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?').get(username) as any;
  
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword, token });
  } else {
    res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }
});

// Users
app.get('/api/users', authenticateToken, (req, res) => {
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

app.post('/api/users', authenticateToken, (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ success: false, message: 'Erro ao criar usuário' });
  }
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Menu
app.get('/api/menu', authenticateToken, (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items WHERE active = 1').all();
  res.json(items);
});

app.post('/api/menu', authenticateToken, (req, res) => {
  const { name, category, price } = req.body;
  const info = db.prepare('INSERT INTO menu_items (name, category, price) VALUES (?, ?, ?)').run(name, category, price);
  res.json({ success: true, id: info.lastInsertRowid });
});

app.put('/api/menu/:id', authenticateToken, (req, res) => {
  const { name, category, price } = req.body;
  db.prepare('UPDATE menu_items SET name = ?, category = ?, price = ? WHERE id = ?').run(name, category, price, req.params.id);
  res.json({ success: true });
});

app.delete('/api/menu/:id', authenticateToken, (req, res) => {
  db.prepare('UPDATE menu_items SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Orders
app.get('/api/orders', authenticateToken, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50').all();
  const ordersWithItems = orders.map((order: any) => {
    order.items = db.prepare(`
      SELECT oi.*, m.name 
      FROM order_items oi 
      JOIN menu_items m ON oi.menu_item_id = m.id 
      WHERE oi.order_id = ?
    `).all(order.id);
    return order;
  });
  res.json(ordersWithItems);
});

app.post('/api/orders', authenticateToken, (req, res) => {
  const { customer_name, type, items, waiter_id, payment_method } = req.body;
  
  // Calculate commercial date (e.g., 18:00 to 05:00 is one day) using America/Sao_Paulo timezone
  const now = new Date();
  const spTimeStr = now.toLocaleString('en-US', {timeZone: 'America/Sao_Paulo', hour12: false});
  const spDate = new Date(spTimeStr);
  if (spDate.getHours() < 5) {
    spDate.setDate(spDate.getDate() - 1);
  }
  const year = spDate.getFullYear();
  const month = String(spDate.getMonth() + 1).padStart(2, '0');
  const day = String(spDate.getDate()).padStart(2, '0');
  const commercialDateStr = `${year}-${month}-${day}`;

  let total = 0;
  items.forEach((item: any) => {
    total += item.price * item.quantity;
  });

  const insertOrder = db.transaction(() => {
    const info = db.prepare('INSERT INTO orders (customer_name, type, status, total, payment_method, waiter_id, commercial_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      customer_name, type, 'pending', total, payment_method || '', waiter_id, commercialDateStr
    );
    
    const orderId = info.lastInsertRowid;
    
    const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, notes, price) VALUES (?, ?, ?, ?, ?)');
    items.forEach((item: any) => {
      insertItem.run(orderId, item.menu_item_id, item.quantity, item.notes || '', item.price);
    });
    
    return orderId;
  });

  try {
    const orderId = insertOrder();
    
    // Trigger Print
    console.log(`--- PRINTING ORDER #${orderId} ---`);
    console.log(`Customer: ${customer_name} (${type})`);
    items.forEach((item: any) => {
      console.log(`${item.quantity}x ${item.name} - Obs: ${item.notes}`);
    });
    console.log(`---------------------------`);

    // Actual ESC/POS integration (commented out/mocked for cloud environment)
    /*
    try {
      const escpos = require('escpos');
      escpos.Network = require('escpos-network');
      
      // Replace with your Elgin i8 IP address
      const device = new escpos.Network('192.168.1.100', 9100);
      const printer = new escpos.Printer(device, { encoding: "860" });

      device.open((error: any) => {
        if (error) {
          console.error('Erro na impressora:', error);
          return;
        }

        printer
          .font('a')
          .align('ct')
          .style('b')
          .size(2, 2)
          .text('HAMBURGUERIA')
          .size(1, 1)
          .text(`Pedido #${orderId}`)
          .text(`Tipo: ${type}`)
          .text(`Cliente: ${customer_name}`)
          .drawLine()
          .align('lt');

        items.forEach((item: any) => {
          printer.style('b').text(`${item.quantity}x ${item.name}`);
          if (item.notes) {
            printer.style('normal').text(`  * Obs: ${item.notes}`);
          }
        });

        printer
          .drawLine()
          .align('rt')
          .style('b')
          .size(1, 1)
          .text(`TOTAL: R$ ${total.toFixed(2)}`)
          .feed(3)
          .cut()
          .close();
      });
    } catch (printErr) {
      console.error('Erro ao inicializar impressora:', printErr);
    }
    */

    res.json({ success: true, id: orderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Erro ao criar pedido' });
  }
});

app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
  const { status, payment_method } = req.body;
  if (payment_method) {
    db.prepare('UPDATE orders SET status = ?, payment_method = ? WHERE id = ?').run(status, payment_method, req.params.id);
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  res.json({ success: true });
});

// Financial Reports
app.get('/api/reports/commercial-day', authenticateToken, (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const orders = db.prepare('SELECT * FROM orders WHERE commercial_date = ? AND status != ?').all(date, 'cancelled') as any[];
  
  const total = orders.reduce((sum: number, order: any) => sum + order.total, 0);
  const ticketMedio = orders.length > 0 ? total / orders.length : 0;
  
  const paymentMethods: Record<string, number> = {};
  orders.forEach((order: any) => {
    if (order.payment_method) {
      paymentMethods[order.payment_method] = (paymentMethods[order.payment_method] || 0) + order.total;
    }
  });

  res.json({
    date,
    total_orders: orders.length,
    total_revenue: total,
    average_ticket: ticketMedio,
    payment_methods: paymentMethods
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
