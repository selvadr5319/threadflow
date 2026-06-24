import { db } from './pool';

const MIGRATION_SQL = /* sql */ `
  CREATE TABLE IF NOT EXISTS tasks (
    id               TEXT    PRIMARY KEY,
    title            TEXT    NOT NULL,
    description      TEXT,
    slack_channel_id TEXT    NOT NULL DEFAULT '',
    slack_message_ts TEXT    NOT NULL DEFAULT '',
    slack_permalink  TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'Backlog',
    created_by       TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks (created_by, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (status);
`;

export async function runMigrations(): Promise<void> {
  console.log('[DB] Running migrations…');
  db.exec(MIGRATION_SQL);
  console.log('[DB] Migrations complete ✓');
}
