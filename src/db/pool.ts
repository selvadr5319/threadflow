import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data.sqlite');

export const db = new Database(dbPath);

// WAL mode — better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export async function testConnection(): Promise<void> {
  db.prepare('SELECT 1').get();
  console.log(`[DB] SQLite connected ✓  (${dbPath})`);
}
