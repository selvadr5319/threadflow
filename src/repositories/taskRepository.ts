import { randomUUID } from 'crypto';
import { db } from '../db/pool';
import type { Task, TaskStatus } from '../types';

interface SqliteTaskRow {
  id: string;
  title: string;
  description: string | null;
  slack_channel_id: string;
  slack_message_ts: string;
  slack_permalink: string;
  status: string;
  created_by: string;
  message_author_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: SqliteTaskRow): Task {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    slackChannelId:  row.slack_channel_id,
    slackMessageTs:  row.slack_message_ts,
    slackPermalink:  row.slack_permalink,
    status:          row.status as TaskStatus,
    createdBy:       row.created_by,
    messageAuthorId: row.message_author_id ?? null,
    createdAt:       new Date(row.created_at),
    updatedAt:       new Date(row.updated_at),
  };
}

export async function insertTask(params: {
  title: string;
  description: string | null;
  slackChannelId: string;
  slackMessageTs: string;
  slackPermalink: string;
  createdBy: string;
  messageAuthorId?: string;
}): Promise<Task> {
  const id = randomUUID();

  db.prepare(/* sql */ `
    INSERT INTO tasks
      (id, title, description, slack_channel_id, slack_message_ts, slack_permalink, created_by, message_author_id)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.title,
    params.description,
    params.slackChannelId,
    params.slackMessageTs,
    params.slackPermalink,
    params.createdBy,
    params.messageAuthorId ?? null,
  );

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as SqliteTaskRow;
  return rowToTask(row);
}

export async function findTasksByUser(userId: string): Promise<Task[]> {
  const rows = db.prepare(/* sql */ `
    SELECT * FROM tasks WHERE created_by = ? ORDER BY created_at DESC
  `).all(userId) as SqliteTaskRow[];

  return rows.map(rowToTask);
}

export async function updateStatus(
  taskId: string,
  userId: string,
  status: TaskStatus,
): Promise<Task | null> {
  const now = new Date().toISOString();

  const result = db.prepare(/* sql */ `
    UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND created_by = ?
  `).run(status, now, taskId, userId);

  if (result.changes === 0) return null;

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as SqliteTaskRow;
  return rowToTask(row);
}

export async function deleteTask(taskId: string, userId: string): Promise<boolean> {
  const result = db.prepare(/* sql */ `
    DELETE FROM tasks WHERE id = ? AND created_by = ?
  `).run(taskId, userId);

  return result.changes > 0;
}

export async function findTaskById(taskId: string): Promise<Task | null> {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as SqliteTaskRow | undefined;
  return row ? rowToTask(row) : null;
}
