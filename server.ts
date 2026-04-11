import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'burger-manager-super-secret-key';

app.use(express.json());

// Initialize LibSQL Database (Turso or Local SQLite)
const db = createClient({
  url: process.env.DATABASE_URL || 'file:burger_manager.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

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
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.execute({
    sql: 'SELECT id, username, password, role FROM users WHERE username = ?',
    args: [username]
  });
  const user = result.rows[0] as any;
  
  if (user && bcrypt.compareSync(password, user.password as string)) {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword, token });
  } else {
    res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }
});

// Users
app.get('/api/users', authenticateToken, async (req, res) => {
  const result = await db.execute('SELECT id, username, role FROM users');
  res.json(result.rows);
});

app.post('/api/users', authenticateToken, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const info = await db.execute({
      sql: 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      args: [username, hashedPassword, role]
    });
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    console.error('Error adding user:', e);
    res.status(400).json({ success: false, message: 'Erro ao criar usuário', error: String(e) });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [req.params.id]
  });
  res.json({ success: true });
});

// Menu
app.get('/api/menu', authenticateToken, async (req, res) => {
  const result = await db.execute('SELECT * FROM menu_items WHERE active = 1');
  res.json(result.rows);
});

app.post('/api/menu', authenticateToken, async (req, res) => {
  try {
    const { name, category, price } = req.body;
    const info = await db.execute({
      sql: 'INSERT INTO menu_items (name, category, price) VALUES (?, ?, ?)',
      args: [name, category, price]
    });
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.put('/api/menu/:id', authenticateToken, async (req, res) => {
  const { name, category, price } = req.body;
  await db.execute({
    sql: 'UPDATE menu_items SET name = ?, category = ?, price = ? WHERE id = ?',
    args: [name, category, price, req.params.id]
  });
  res.json({ success: true });
});

app.delete('/api/menu/:id', authenticateToken, async (req, res) => {
  await db.execute({
    sql: 'UPDATE menu_items SET active = 0 WHERE id = ?',
    args: [req.params.id]
  });
  res.json({ success: true });
});

// Orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  const result = await db.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
  const ordersWithItems = await Promise.all(result.rows.map(async (order: any) => {
    const itemsResult = await db.execute({
      sql: `
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id = ?
      `,
      args: [order.id]
    });
    order.items = itemsResult.rows;
    return order;
  }));
  res.json(ordersWithItems);
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { customer_name, type, items, waiter_id, payment_method } = req.body;
  
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

  try {
    const transaction = await db.transaction('write');
    
    const info = await transaction.execute({
      sql: 'INSERT INTO orders (customer_name, type, status, total, payment_method, waiter_id, commercial_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [customer_name, type, 'pending', total, payment_method || '', waiter_id, commercialDateStr]
    });
    
    const orderId = Number(info.lastInsertRowid);
    
    for (const item of items) {
      await transaction.execute({
        sql: 'INSERT INTO order_items (order_id, menu_item_id, quantity, notes, price) VALUES (?, ?, ?, ?, ?)',
        args: [orderId, item.menu_item_id, item.quantity, item.notes || '', item.price]
      });
    }
    
    await transaction.commit();
    
    res.json({ success: true, id: orderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Erro ao criar pedido' });
  }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status, payment_method, tip, total } = req.body;
  if (payment_method) {
    await db.execute({
      sql: 'UPDATE orders SET status = ?, payment_method = ?, tip = ?, total = ? WHERE id = ?',
      args: [status, payment_method, tip || 0, total, req.params.id]
    });
  } else {
    await db.execute({
      sql: 'UPDATE orders SET status = ? WHERE id = ?',
      args: [status, req.params.id]
    });
  }
  res.json({ success: true });
});

// Financial Reports
app.get('/api/reports/commercial-day', authenticateToken, async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const result = await db.execute({
    sql: 'SELECT * FROM orders WHERE commercial_date = ? AND status != ?',
    args: [date as string, 'cancelled']
  });
  const orders = result.rows;
  
  const total = orders.reduce((sum: number, order: any) => sum + (order.total as number), 0);
  const totalTips = orders.reduce((sum: number, order: any) => sum + ((order.tip as number) || 0), 0);
  const ticketMedio = orders.length > 0 ? total / orders.length : 0;
  
  const paymentMethods: Record<string, number> = {};
  orders.forEach((order: any) => {
    if (order.payment_method) {
      paymentMethods[order.payment_method] = (paymentMethods[order.payment_method] || 0) + (order.total as number);
    }
  });

  res.json({
    date,
    total_orders: orders.length,
    total_revenue: total,
    total_tips: totalTips,
    average_ticket: ticketMedio,
    payment_methods: paymentMethods
  });
});

async function initializeDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category TEXT,
      price REAL,
      active INTEGER DEFAULT 1
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      type TEXT,
      status TEXT,
      total REAL,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      waiter_id INTEGER,
      commercial_date TEXT,
      tip REAL DEFAULT 0
    );
  `);
  try {
    await db.execute('ALTER TABLE orders ADD COLUMN tip REAL DEFAULT 0');
  } catch (e) {}
  await db.execute(`
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

  const adminExists = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: ['admin']
  });
  if (adminExists.rows.length === 0) {
    const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
    await db.execute({
      sql: 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      args: ['admin', hashedAdminPassword, 'ADM']
    });
  }

  const menuCount = await db.execute('SELECT COUNT(*) as count FROM menu_items');
  if (menuCount.rows[0].count === 0) {
    const insertMenu = async (name: string, category: string, price: number) => {
      await db.execute({
        sql: 'INSERT INTO menu_items (name, category, price) VALUES (?, ?, ?)',
        args: [name, category, price]
      });
    };
    await insertMenu('X-Burger', 'Lanches', 25.00);
    await insertMenu('X-Bacon', 'Lanches', 28.50);
    await insertMenu('Batata Frita', 'Porções', 15.00);
    await insertMenu('Coca-Cola 350ml', 'Bebidas', 6.00);
    await insertMenu('Suco de Laranja', 'Bebidas', 8.00);
  }
}

async function startServer() {
  await initializeDatabase();

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
