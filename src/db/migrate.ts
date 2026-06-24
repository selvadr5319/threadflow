import { pool } from './pool';

/**
 * Idempotent schema migration.
 * Runs on every startup — safe to re-run because of IF NOT EXISTS guards.
 */
const MIGRATION_SQL = /* sql */ `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS tasks (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL,
    description      TEXT,
    slack_channel_id TEXT        NOT NULL,
    slack_message_ts TEXT        NOT NULL,
    slack_permalink  TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'Backlog',
    created_by       TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Index for the common query: tasks by user, ordered newest-first
  CREATE INDEX IF NOT EXISTS idx_tasks_created_by
    ON tasks (created_by, created_at DESC);

  -- Index for status-based filtering
  CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks (status);

  -- Auto-update updated_at via trigger
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS set_updated_at ON tasks;
  CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[DB] Running migrations…');
    await client.query(MIGRATION_SQL);
    console.log('[DB] Migrations complete ✓');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
