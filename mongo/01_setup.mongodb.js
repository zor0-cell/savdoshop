// =============================================================
// SavdoShop - MongoDB setup (Week 1, Step 1.13)
// Run it in one of three ways:
//   A. VS Code + "MongoDB for VS Code": open the folder, click Run (Ctrl+Alt+R)
//   B. Compass: paste the whole file into the _MONGOSH bar
//   C. Terminal: mongosh "mongodb://localhost:27017" --file 01_setup.mongodb.js
// Expected output:  reviews: 7  events: 50000
// =============================================================
use("savdoshop");

db.reviews.drop();
db.events.drop();

// 1) Reviews: flexible documents (tags array, optional photos)
db.reviews.insertMany([
  { productId: 1,  customerId: 1, rating: 5, comment: "Beautiful atlas, fast delivery",   tags: ["quality", "delivery"], createdAt: new Date() },
  { productId: 1,  customerId: 3, rating: 4, comment: "Nice colours, a bit long",         tags: ["size"],                createdAt: new Date() },
  { productId: 4,  customerId: 2, rating: 5, comment: "Very comfortable",                 tags: ["comfort"],             createdAt: new Date() },
  { productId: 4,  customerId: 6, rating: 3, comment: "Size runs small",                  tags: ["size"], photos: ["s1.jpg"], createdAt: new Date() },
  { productId: 7,  customerId: 2, rating: 4, comment: "Smells great",                     tags: ["quality"],             createdAt: new Date() },
  { productId: 10, customerId: 4, rating: 5, comment: "Perfect gift",                     tags: ["gift", "quality"],     createdAt: new Date() },
  { productId: 11, customerId: 8, rating: 2, comment: "Battery weaker than promised",     tags: ["battery"],             createdAt: new Date() }
]);

// 2) Events: clickstream - the "big" data (50 000 documents)
const types = ["view", "view", "view", "view", "add_to_cart", "add_to_cart", "purchase"];
const cities = ["Tashkent", "Samarkand", "Bukhara", "Namangan", "Andijan", "Fergana", "Khiva", "Nukus"];
const devices = ["android", "ios", "desktop"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
  if (batch.length === 5000) { db.events.insertMany(batch); batch = []; }
}
if (batch.length) db.events.insertMany(batch);

// 3) Indexes
db.reviews.createIndex({ productId: 1, createdAt: -1 });
db.events.createIndex({ type: 1, ts: -1 });
db.events.createIndex({ productId: 1 });

print("reviews:", db.reviews.countDocuments(), " events:", db.events.countDocuments());
