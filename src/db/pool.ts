import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Singleton PostgreSQL connection pool.
 * Uses environment variables for configuration.
 */
export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'slack_kanban',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

/**
 * Run a simple SELECT 1 to verify connectivity on startup.
 */
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] Connected to PostgreSQL ✓');
  } finally {
    client.release();
  }
}
