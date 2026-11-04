// =============================================================
// SavdoShop - MongoDB query practice, M1-M14 (Week 1, Step 1.14)
// Run ONE block at a time: select it and "Run Selected Lines",
// or paste it into Compass _MONGOSH.
// The events are random, so your numbers differ from the guide's,
// but the shape of every result must be the same.
// =============================================================
use("savdoshop");

// M1 CREATE
db.reviews.insertOne({ productId: 2, customerId: 5, rating: 5, comment: "Great shirt", tags: ["quality"], createdAt: new Date() });

// M2 READ: all 5-star reviews, newest first, only some fields
db.reviews.find({ rating: 5 }, { _id: 0, productId: 1, comment: 1 }).sort({ createdAt: -1 });

// M3 READ with operators: rating 3 or lower OR tagged "size"
db.reviews.find({ $or: [{ rating: { $lte: 3 } }, { tags: "size" }] });

// M4 UPDATE: add a tag to one review, increase "helpful" counter
db.reviews.updateOne({ productId: 2, customerId: 5 }, { $push: { tags: "recommended" }, $inc: { helpful: 1 } });

// M5 DELETE
db.reviews.deleteOne({ productId: 2, customerId: 5 });

// M6 Average rating and number of reviews per product
db.reviews.aggregate([
  { $group: { _id: "$productId", avgRating: { $avg: "$rating" }, reviews: { $sum: 1 } } },
  { $sort: { avgRating: -1 } }
]);

// M7 Funnel: how many views / add_to_cart / purchases
db.events.aggregate([
  { $group: { _id: "$type", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

// M8 Top 5 most viewed products in the last 30 days
db.events.aggregate([
  { $match: { type: "view", ts: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } },
  { $group: { _id: "$productId", views: { $sum: 1 } } },
  { $sort: { views: -1 } },
  { $limit: 5 }
]);

// M9 Purchases per city and device (two-field group key)
db.events.aggregate([
  { $match: { type: "purchase" } },
  { $group: { _id: { city: "$city", device: "$device" }, n: { $sum: 1 } } },
  { $sort: { "_id.city": 1, n: -1 } }
]);

// M10 Daily activity (time series) for the last 14 days
db.events.aggregate([
  { $match: { ts: { $gte: new Date(Date.now() - 14 * 24 * 3600 * 1000) } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } }, events: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// M11 Most common review tags ($unwind turns an array into separate rows)
db.reviews.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

// M12 BEFORE a new index: how many documents must MongoDB read?
const before = db.events.find({ city: "Khiva", type: "purchase" }).explain("executionStats").executionStats;
({ returned: before.nReturned, examined: before.totalDocsExamined, ms: before.executionTimeMillis });

// M13 Create a compound index, then measure the same query again
db.events.createIndex({ city: 1, type: 1 });
const after = db.events.find({ city: "Khiva", type: "purchase" }).explain("executionStats").executionStats;
({ returned: after.nReturned, examined: after.totalDocsExamined, ms: after.executionTimeMillis });

// M14 List all indexes of the collection
db.events.getIndexes();
