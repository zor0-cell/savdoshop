// Database connections: PostgreSQL (pg Pool) + MongoDB (official driver)
import 'dotenv/config';
import pg from 'pg';
import { MongoClient } from 'mongodb';

if (!process.env.DATABASE_URL || !process.env.MONGODB_URI) {
  console.error('Missing DATABASE_URL or MONGODB_URI. Did you create the .env file?');
  process.exit(1);
}

// A pool keeps a few connections open and reuses them for every request
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5
});

const mongoClient = new MongoClient(process.env.MONGODB_URI);
let mongoDb = null;

export async function connectMongo() {
  await mongoClient.connect();
  mongoDb = mongoClient.db(process.env.MONGODB_DB || 'savdoshop');
  return mongoDb;
}

export function mongo() {
  if (!mongoDb) throw new Error('MongoDB is not connected yet');
  return mongoDb;
}
