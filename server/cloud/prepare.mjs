// Заливка проекта в облако: Supabase (PostgreSQL) + MongoDB Atlas.
// Запуск: node cloud/prepare.mjs          — схемы, сид, события, индексы
//         node cloud/prepare.mjs --serve  — то же + сайт на http://localhost:3200 против облака
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { MongoClient } from 'mongodb';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const envFile = path.join(here, 'cloud.env');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(here, 'cloud.env.example'), envFile);
  console.log('Создан cloud.env — впиши в него две строки из Supabase и Atlas, затем запусти снова.');
  process.exit(0);
}

const conf = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m && !m[1].startsWith('#')) conf[m[1]] = m[2];
}
for (const key of ['DATABASE_URL', 'MONGODB_URI']) {
  const v = conf[key] || '';
  if (!v || v.includes('вставь-')) {
    console.log(`В cloud.env не заполнен ${key}.`);
    process.exit(1);
  }
}
const dbName = conf.MONGODB_DB || 'savdoshop';
const useSsl = String(conf.PGSSL || '').toLowerCase() === 'true' || /sslmode=require/.test(conf.DATABASE_URL);

// --- PostgreSQL: схема + сид ---
const pgClient = new pg.Client({ connectionString: conf.DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : false });
await pgClient.connect();
console.log('PostgreSQL подключён:', (await pgClient.query('select current_database() d, version() v')).rows[0].d);
for (const file of ['sql/01_schema.sql', 'sql/02_seed.sql']) {
  await pgClient.query(fs.readFileSync(path.join(root, file), 'utf8'));
  console.log('выполнен', file);
}
const counts = await pgClient.query(`select
  (select count(*) from categories) c, (select count(*) from products) p,
  (select count(*) from customers) u, (select count(*) from orders) o,
  (select count(*) from order_items) i, (select count(*) from payments) y`);
console.log('строки:', counts.rows[0]);
await pgClient.end();

// --- MongoDB: отзывы + события + индексы ---
const mongo = new MongoClient(conf.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
await mongo.connect();
const db = mongo.db(dbName);
const haveEvents = await db.collection('events').countDocuments();
console.log('MongoDB подключён, база', dbName, ', событий сейчас:', haveEvents);

if (haveEvents < 50000 || process.argv.includes('--force')) {
  const reviews = [
    { productId: 1, customerId: 1, rating: 5, comment: 'Beautiful atlas, fast delivery', tags: ['quality', 'delivery'] },
    { productId: 1, customerId: 3, rating: 4, comment: 'Nice colours, a bit long', tags: ['size'] },
    { productId: 4, customerId: 2, rating: 5, comment: 'Very comfortable', tags: ['comfort'] },
    { productId: 4, customerId: 6, rating: 3, comment: 'Size runs small', tags: ['size'], photos: ['s1.jpg'] },
    { productId: 7, customerId: 2, rating: 4, comment: 'Smells great', tags: ['quality'] },
    { productId: 10, customerId: 4, rating: 5, comment: 'Perfect gift', tags: ['gift', 'quality'] },
    { productId: 11, customerId: 8, rating: 2, comment: 'Battery weaker than promised', tags: ['battery'] }
  ].map((r) => ({ ...r, createdAt: new Date() }));

  await db.collection('reviews').deleteMany({});
  await db.collection('events').deleteMany({});
  await db.collection('reviews').insertMany(reviews);

  const types = ['view', 'view', 'view', 'view', 'add_to_cart', 'add_to_cart', 'purchase'];
  const cities = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Khiva', 'Nukus'];
  const devices = ['android', 'ios', 'desktop'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const started = Date.now();
  let batch = [];
  for (let i = 0; i < 50000; i++) {
    batch.push({
      type: pick(types),
      productId: 1 + Math.floor(Math.random() * 12),
      customerId: 1 + Math.floor(Math.random() * 10),
      city: pick(cities),
      device: pick(devices),
      ts: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 3600 * 1000))
    });
    if (batch.length === 5000) {
      await db.collection('events').insertMany(batch);
      batch = [];
      process.stdout.write('.');
    }
  }
  if (batch.length) await db.collection('events').insertMany(batch);

  await db.collection('reviews').createIndex({ productId: 1, createdAt: -1 });
  await db.collection('events').createIndex({ type: 1, ts: -1 });
  await db.collection('events').createIndex({ productId: 1 });
  console.log('\nсобытия залиты за', ((Date.now() - started) / 1000).toFixed(1), 'с');
}

console.log('итоги Mongo: reviews', await db.collection('reviews').countDocuments(),
  'events', await db.collection('events').countDocuments());
await mongo.close();

console.log(`
Готово. В Render (Environment Variables) добавь:
  DATABASE_URL = ${conf.DATABASE_URL.replace(/:[^:@/]+@/, ':ПОСМОТРИ_В_cloud.env@')}
  PGSSL        = true
  MONGODB_URI  = ${conf.MONGODB_URI.replace(/:[^:@/]+@/, ':ПОСМОТРИ_В_cloud.env@')}
  MONGODB_DB   = ${dbName}
Root Directory в Render: server`);

if (process.argv.includes('--serve')) {
  process.env.DATABASE_URL = conf.DATABASE_URL;
  process.env.PGSSL = useSsl ? 'true' : 'false';
  process.env.MONGODB_URI = conf.MONGODB_URI;
  process.env.MONGODB_DB = dbName;
  process.env.PORT = '3200';
  console.log('Поднимаю сайт против облачных баз: http://localhost:3200');
  await import('../src/server.js');
}
