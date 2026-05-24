const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./ecommerce.db');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'ecommerce-secret',
  resave: false,
  saveUninitialized: true
}));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    image TEXT,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)");
      stmt.run("Smart Watch", 99.99, "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=1200&auto=format&fit=crop", "Modern smartwatch with fitness tracking.");
      stmt.run("Wireless Headphones", 79.99, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200&auto=format&fit=crop", "Noise cancelling wireless headphones.");
      stmt.run("Gaming Mouse", 49.99, "https://images.unsplash.com/photo-1527814050087-3793815479db?q=80&w=1200&auto=format&fit=crop", "RGB gaming mouse with high precision.");
      stmt.finalize();
    }
  });
});

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.cart = req.session.cart || [];
  next();
});

app.get('/', (req, res) => {
  db.all("SELECT * FROM products", (err, products) => {
    res.render('index', { products });
  });
});

app.get('/product/:id', (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
    res.render('product', { product });
  });
});

app.post('/cart/add/:id', (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
    req.session.cart.push(product);
    res.redirect('/cart');
  });
});

app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  res.render('cart', { cart, total });
});

app.post('/checkout', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  db.run("INSERT INTO orders (user_id, total) VALUES (?, ?)",
    [req.session.user.id, total],
    () => {
      req.session.cart = [];
      res.render('success');
    });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  db.run("INSERT INTO users (username, password) VALUES (?, ?)",
    [req.body.username, hash],
    function(err) {
      if (err) return res.send("Username already exists.");
      res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  db.get("SELECT * FROM users WHERE username = ?", [req.body.username], async (err, user) => {
    if (!user) return res.send("User not found");

    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) return res.send("Invalid password");

    req.session.user = user;
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
