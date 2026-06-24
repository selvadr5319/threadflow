import { pool } from '../db/pool';
import type { Task, TaskRow, TaskStatus } from '../types';

// ─────────────────────────────────────────────
//  Row ↔ Domain mapper
// ─────────────────────────────────────────────

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    slackChannelId: row.slack_channel_id,
    slackMessageTs: row.slack_message_ts,
    slackPermalink: row.slack_permalink,
    status: row.status as TaskStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────
//  Repository
// ─────────────────────────────────────────────

/**
 * Insert a new task and return the created record.
 */
export async function insertTask(params: {
  title: string;
  description: string | null;
  slackChannelId: string;
  slackMessageTs: string;
  slackPermalink: string;
  createdBy: string;
}): Promise<Task> {
  const { rows } = await pool.query<TaskRow>(
    /* sql */ `
    INSERT INTO tasks
      (title, description, slack_channel_id, slack_message_ts, slack_permalink, created_by)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      params.title,
      params.description,
      params.slackChannelId,
      params.slackMessageTs,
      params.slackPermalink,
      params.createdBy,
    ],
  );

  return rowToTask(rows[0]);
}

/**
 * Fetch all tasks belonging to a specific Slack user, newest first.
 */
export async function findTasksByUser(userId: string): Promise<Task[]> {
  const { rows } = await pool.query<TaskRow>(
    /* sql */ `
    SELECT * FROM tasks
    WHERE created_by = $1
    ORDER BY created_at DESC
    `,
    [userId],
  );

  return rows.map(rowToTask);
}

/**
 * Update the status column for a task, scoped to the owning user
 * to prevent cross-user mutations.
 */
export async function updateStatus(
  taskId: string,
  userId: string,
  status: TaskStatus,
): Promise<Task | null> {
  const { rows } = await pool.query<TaskRow>(
    /* sql */ `
    UPDATE tasks
    SET    status = $1
    WHERE  id = $2 AND created_by = $3
    RETURNING *
    `,
    [status, taskId, userId],
  );

  return rows.length ? rowToTask(rows[0]) : null;
}

/**
 * Hard-delete a task, scoped to the owning user.
 */
export async function deleteTask(taskId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    /* sql */ `
    DELETE FROM tasks
    WHERE id = $1 AND created_by = $2
    `,
    [taskId, userId],
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Fetch a single task by id (used for validation before actions).
 */
export async function findTaskById(taskId: string): Promise<Task | null> {
  const { rows } = await pool.query<TaskRow>(
    /* sql */ `SELECT * FROM tasks WHERE id = $1`,
    [taskId],
  );

  return rows.length ? rowToTask(rows[0]) : null;
}
