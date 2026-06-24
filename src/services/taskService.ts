import * as repo from '../repositories/taskRepository';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskStatusInput } from '../types';

// ─────────────────────────────────────────────
//  Service methods (called from Slack handlers)
// ─────────────────────────────────────────────

/**
 * Create a new task from a Slack message shortcut.
 * Truncates title to 255 chars to avoid bloated cards.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const title = (input.title || 'Untitled task').slice(0, 255);
  const description = input.description?.slice(0, 2000) ?? null;

  return repo.insertTask({
    title,
    description,
    slackChannelId: input.slackChannelId,
    slackMessageTs: input.slackMessageTs,
    slackPermalink: input.slackPermalink,
    createdBy: input.createdBy,
  });
}

/**
 * Return all tasks for the requesting user, grouped for the board.
 */
export async function getTasksForUser(userId: string): Promise<Task[]> {
  if (!userId) throw new Error('userId is required');
  return repo.findTasksByUser(userId);
}

/**
 * Move a task to a new status column.
 * Only the task owner can do this.
 */
export async function updateTaskStatus(input: UpdateTaskStatusInput): Promise<Task | null> {
  const validStatuses: TaskStatus[] = ['Backlog', 'In Progress', 'Waiting', 'Done'];
  if (!validStatuses.includes(input.status)) {
    throw new Error(`Invalid status: ${input.status}`);
  }

  return repo.updateStatus(input.taskId, input.userId, input.status);
}

/**
 * Remove a task permanently.
 */
export async function deleteTask(taskId: string, userId: string): Promise<boolean> {
  return repo.deleteTask(taskId, userId);
}
