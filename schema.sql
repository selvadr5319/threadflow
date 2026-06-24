-- ─────────────────────────────────────────────────────────────────
--  Slack Kanban — PostgreSQL Schema
--  Compatible with PostgreSQL 14+
--  This file is for reference; the app runs migrations automatically
--  via src/db/migrate.ts on startup.
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
--  Tasks
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title            TEXT        NOT NULL,
  description      TEXT,                    -- full original message text

  -- Slack references (for deep-linking back)
  slack_channel_id TEXT        NOT NULL,
  slack_message_ts TEXT        NOT NULL,
  slack_permalink  TEXT        NOT NULL,

  -- Workflow
  status           TEXT        NOT NULL DEFAULT 'Backlog'
                               CHECK (status IN ('Backlog', 'In Progress', 'Waiting', 'Done')),

  -- Ownership
  created_by       TEXT        NOT NULL,    -- Slack user ID (e.g. U0123456789)

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
--  Indexes
-- ─────────────────────────────────────────────

-- Primary query: all tasks for a user, newest first
CREATE INDEX IF NOT EXISTS idx_tasks_created_by
  ON tasks (created_by, created_at DESC);

-- Status-based filtering / column grouping
CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks (status);

-- ─────────────────────────────────────────────
--  Auto-updated timestamp trigger
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
--  Sample data (dev only — remove in prod)
-- ─────────────────────────────────────────────

-- INSERT INTO tasks (title, slack_channel_id, slack_message_ts, slack_permalink, created_by)
-- VALUES
--   ('Investigate login timeout bug',   'C01234567', '1720000000.000100', 'https://example.slack.com/p/1', 'U0123456789'),
--   ('Update deployment documentation', 'C01234567', '1720000001.000200', 'https://example.slack.com/p/2', 'U0123456789'),
--   ('Review PR #142',                  'C01234567', '1720000002.000300', 'https://example.slack.com/p/3', 'U0123456789');
