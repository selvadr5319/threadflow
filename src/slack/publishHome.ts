import { getTasksForUser } from '../services/taskService';
import { buildHomeView, type HomeFilter, type UserProfile } from '../views/homeView';

/**
 * Remembers each user's currently-selected filter so it persists across
 * re-publishes (status changes, deletes, new tasks). Resets to 'All' only
 * when the process restarts — a deliberate, lightweight in-memory choice.
 */
const userFilters = new Map<string, HomeFilter>();

/**
 * Fetch the user's tasks and publish the Kanban home view.
 *
 * Pass `filter` when the user clicks a filter pill; omit it elsewhere to
 * re-render with whatever filter they last selected.
 *
 * We use `any` for client to avoid the dual @slack/web-api version
 * conflict between @slack/bolt's bundled client and the top-level package.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function publishHomeView(client: any, userId: string, filter?: HomeFilter): Promise<void> {
  try {
    if (filter) userFilters.set(userId, filter);
    const activeFilter = userFilters.get(userId) ?? 'All';

    const tasks = await getTasksForUser(userId);

    // Fetch profiles for the original message authors (falling back to card creator for legacy tasks)
    const uniqueAuthors = [...new Set(tasks.map((t) => t.messageAuthorId ?? t.createdBy))];
    const profiles = new Map<string, UserProfile>();
    await Promise.all(uniqueAuthors.map(async (uid) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await client.users.info({ user: uid });
        profiles.set(uid, {
          name: res.user?.profile?.display_name_normalized || res.user?.real_name || uid,
          avatar: res.user?.profile?.image_72 ?? '',
        });
      } catch { /* skip — card falls back to mention text */ }
    }));

    const view  = buildHomeView(tasks, userId, activeFilter, profiles);

    await client.views.publish({ user_id: userId, view });
  } catch (err) {
    console.error(`[Home] Failed to publish home view for user ${userId}:`, err);
    throw err;
  }
}
