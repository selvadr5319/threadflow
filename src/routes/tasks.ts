import { Router } from 'express';
import { getTasksForUser, updateTaskStatus, deleteTask } from '../services/taskService';
import { TASK_STATUSES } from '../types';
import type { TaskStatus } from '../types';

const router = Router();

router.get('/api/tasks', async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId query param required' });
    return;
  }
  try {
    const tasks = await getTasksForUser(userId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.patch('/api/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { userId, status } = req.body as { userId?: string; status?: string };
  if (!userId || !status) {
    res.status(400).json({ error: 'userId and status required in body' });
    return;
  }
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${TASK_STATUSES.join(', ')}` });
    return;
  }
  try {
    const task = await updateTaskStatus({ taskId: id, userId, status: status as TaskStatus });
    if (!task) {
      res.status(404).json({ error: 'Task not found or not owned by user' });
      return;
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

router.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId query param required' });
    return;
  }
  try {
    const deleted = await deleteTask(id, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Task not found or not owned by user' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
