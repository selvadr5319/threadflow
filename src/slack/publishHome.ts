import { getTasksForUser } from '../services/taskService';
import { buildHomeView } from '../views/homeView';

/**
 * Fetch the user's tasks and publish the Kanban home view.
 * We use `any` for client to avoid the dual @slack/web-api version
 * conflict between @slack/bolt's bundled client and the top-level package.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function publishHomeView(client: any, userId: string): Promise<void> {
  try {
    const tasks = await getTasksForUser(userId);
    const view  = buildHomeView(tasks);

    await client.views.publish({ user_id: userId, view });
  } catch (err) {
    console.error(`[Home] Failed to publish home view for user ${userId}:`, err);
    throw err;
  }
}
