// ─────────────────────────────────────────────
//  Domain Types
// ─────────────────────────────────────────────

export type TaskStatus = 'Backlog' | 'In Progress' | 'Waiting' | 'Done';

export const TASK_STATUSES: TaskStatus[] = ['Backlog', 'In Progress', 'Waiting', 'Done'];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  slackChannelId: string;
  slackMessageTs: string;
  slackPermalink: string;
  status: TaskStatus;
  createdBy: string;
  messageAuthorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
//  Database Row (snake_case from PostgreSQL)
// ─────────────────────────────────────────────

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  slack_channel_id: string;
  slack_message_ts: string;
  slack_permalink: string;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
//  Service / Repository DTOs
// ─────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string;
  slackChannelId: string;
  slackMessageTs: string;
  slackPermalink: string;
  createdBy: string;
  messageAuthorId?: string;
}

export interface UpdateTaskStatusInput {
  taskId: string;
  userId: string;
  status: TaskStatus;
}

// ─────────────────────────────────────────────
//  Slack Block-Kit helpers
// ─────────────────────────────────────────────

export interface StatusGroup {
  status: TaskStatus;
  emoji: string;
  tasks: Task[];
}
