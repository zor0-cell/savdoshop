// SavdoShop API + website (Express, PostgreSQL, MongoDB)
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, connectMongo, mongo } from './db.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());                                       // read JSON bodies
app.use(express.static(path.join(__dirname, '..', 'public'))); // serve the website

// Small helper so every async route sends errors to the error handler
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- Placeholder product picture (works offline) ----------
// <img src="/placeholder.svg?text=Atlas+dress"> - replace with real photo URLs later
app.get('/placeholder.svg', (req, res) => {
  const text = String(req.query.text || 'Product').slice(0, 30).replace(/[<>&"']/g, '');
  const hue = [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  res.type('image/svg+xml').send(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
       <rect width="400" height="300" fill="hsl(${hue},55%,85%)"/>
       <text x="200" y="160" font-family="Arial" font-size="30" text-anchor="middle"
             fill="hsl(${hue},45%,30%)">${text}</text></svg>`);
});

// ---------- Health check: is everything connected? ----------
app.get('/api/health', wrap(async (req, res) => {
  const pg = await pool.query('SELECT now() AS time');
  const reviews = await mongo().collection('reviews').estimatedDocumentCount();
  res.json({ ok: true, postgresTime: pg.rows[0].time, mongoReviews: reviews });
}));

// ---------- Categories (PostgreSQL) ----------
app.get('/api/categories', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT category_id, name FROM categories ORDER BY name');
  res.json(rows);
}));

// ---------- Product list with search, filter, pagination ----------
// GET /api/products?q=silk&category=1&page=1
app.get('/api/products', wrap(async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const category = req.query.category ? Number(req.query.category) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 12;

  // $1, $2 ... are parameters: the driver escapes them (protects against SQL injection)
  const { rows } = await pool.query(
    `SELECT p.product_id, p.name, p.price, p.stock, p.image_url, c.name AS category
       FROM products p
       JOIN categories c ON c.category_id = p.category_id
      WHERE ($1::text IS NULL OR p.name ILIKE $1)
        AND ($2::int IS NULL OR p.category_id = $2)
      ORDER BY p.product_id
      LIMIT $3 OFFSET $4`,
    [q, category, pageSize, (page - 1) * pageSize]
  );
  res.json(rows);
}));

// ---------- Product detail: PostgreSQL row + MongoDB reviews ----------
app.get('/api/products/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category FROM products p
       JOIN categories c ON c.category_id = p.category_id
      WHERE p.product_id = $1`, [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

  const reviews = await mongo().collection('reviews')
    .find({ productId: id }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 }).limit(20).toArray();

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  // log a "view" event for analytics (do not wait for it)
  mongo().collection('events').insertOne({ type: 'view', productId: id, ts: new Date(), device: 'web' })
    .catch((e) => console.error('event log failed', e.message));

  res.json({ ...rows[0], reviews, avgRating: avg });
}));

// ---------- Add a review (MongoDB) ----------
app.post('/api/products/:id/reviews', wrap(async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || '').trim();
  if (!(rating >= 1 && rating <= 5) || comment.length < 3) {
    return res.status(400).json({ error: 'Rating 1-5 and a comment (min 3 letters) are required' });
  }
  const doc = { productId: Number(req.params.id), rating, comment,
                author: String(req.body.author || 'Guest'), createdAt: new Date() };
  await mongo().collection('reviews').insertOne(doc);
  res.status(201).json({ ok: true });
}));

// ---------- Place an order: one SQL transaction ----------
// body: { customer: {fullName, email, phone, city}, items: [{productId, quantity}], paymentMethod }
app.post('/api/orders', wrap(async (req, res) => {
  const { customer, items, paymentMethod = 'cash' } = req.body;
  if (!customer?.email || !customer?.fullName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name, email and at least one item are required' });
  }
  if (!['cash', 'card', 'payme', 'click'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Unknown payment method' });
  }

  const client = await pool.connect();      // all queries below use the SAME connection
  try {
    await client.query('BEGIN');

    const c = await client.query(
      `INSERT INTO customers (full_name, email, phone, city)
       VALUES ($1, $2, $3, COALESCE($4, 'Tashkent'))
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING customer_id`,
      [customer.fullName, customer.email, customer.phone || null, customer.city || null]);
    const customerId = c.rows[0].customer_id;

    const o = await client.query(
      'INSERT INTO orders (customer_id) VALUES ($1) RETURNING order_id', [customerId]);
    const orderId = o.rows[0].order_id;

    let total = 0;
    for (const it of items) {
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw Object.assign(new Error('Bad quantity'), { status: 400 });
      // decrease stock only if enough is left - atomic check
      const p = await client.query(
        `UPDATE products SET stock = stock - $1
          WHERE product_id = $2 AND stock >= $1
          RETURNING price, name`, [qty, it.productId]);
      if (p.rowCount === 0) {
        throw Object.assign(new Error(`Not enough stock for product ${it.productId}`), { status: 409 });
      }
      const price = Number(p.rows[0].price);
      total += price * qty;
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, it.productId, qty, price]);
    }

    await client.query('UPDATE orders SET total = $1 WHERE order_id = $2', [total, orderId]);
    await client.query(
      'INSERT INTO payments (order_id, method, amount) VALUES ($1, $2, $3)',
      [orderId, paymentMethod, total]);

    await client.query('COMMIT');

    // analytics events go to MongoDB after the money part is safe
    mongo().collection('events').insertMany(items.map((it) => ({
      type: 'purchase', productId: Number(it.productId), customerId, city: customer.city || 'Tashkent',
      device: 'web', ts: new Date()
    }))).catch((e) => console.error('event log failed', e.message));

    res.status(201).json({ orderId, total });
  } catch (err) {
    await client.query('ROLLBACK');             // undo EVERYTHING from this order
    throw err;
  } finally {
    client.release();                           // give the connection back to the pool
  }
}));

// ---------- Order history of one customer (worked example: "how to add a route") ----------
// GET /api/customers/1/orders -> every order with its items as a JSON array
app.get('/api/customers/:id/orders', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.order_id, o.status, o.total, o.created_at,
            json_agg(json_build_object('product', p.name, 'quantity', oi.quantity,
                                                 'unit_price', oi.unit_price)) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN products p     ON p.product_id = oi.product_id
      WHERE o.customer_id = $1
      GROUP BY o.order_id
      ORDER BY o.created_at DESC`, [Number(req.params.id)]);
  res.json(rows);
}));

// ---------- Dashboard statistics ----------
app.get('/api/stats/sales-by-city', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cu.city, COUNT(*)::int AS orders, SUM(o.total)::float AS revenue
       FROM orders o JOIN customers cu ON cu.customer_id = o.customer_id
      WHERE o.status <> 'cancelled'
      GROUP BY cu.city ORDER BY revenue DESC`);
  res.json(rows);
}));

app.get('/api/stats/top-viewed', wrap(async (req, res) => {
  const top = await mongo().collection('events').aggregate([
    { $match: { type: 'view' } },
    { $group: { _id: '$productId', views: { $sum: 1 } } },
    { $sort: { views: -1 } },
    { $limit: 5 }
  ]).toArray();
  // enrich with product names from PostgreSQL
  const ids = top.map((t) => t._id);
  const { rows } = await pool.query(
    'SELECT product_id, name FROM products WHERE product_id = ANY($1::int[])', [ids]);
  const names = Object.fromEntries(rows.map((r) => [r.product_id, r.name]));
  res.json(top.map((t) => ({ productId: t._id, name: names[t._id] || '?', views: t.views })));
}));

app.get('/api/stats/funnel', wrap(async (req, res) => {
  const rows = await mongo().collection('events').aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]).toArray();
  res.json(Object.fromEntries(rows.map((r) => [r._id, r.count])));
}));

// ---------- Errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
connectMongo()
  .then(() => app.listen(PORT, () => console.log(`SavdoShop running on http://localhost:${PORT}`)))
  .catch((err) => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
