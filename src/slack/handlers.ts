import type { App } from '@slack/bolt';
import { publishHomeView } from './publishHome';
import { createTask, updateTaskStatus, deleteTask } from '../services/taskService';
import type { TaskStatus } from '../types';

/**
 * Register all Slack event and action handlers on the Bolt App instance.
 */
export function registerHandlers(app: App): void {

  // ─────────────────────────────────────────────
  //  Global debug middleware — logs EVERY payload
  //  Remove in production
  // ─────────────────────────────────────────────

  app.use(async ({ payload, next, logger }) => {
    logger.debug('[Middleware] Incoming payload type:', (payload as any)?.type ?? 'unknown');
    await next();
  });

  // ─────────────────────────────────────────────
  //  App Home Tab opened
  // ─────────────────────────────────────────────

  app.event('app_home_opened', async ({ event, client, logger }) => {
    if (event.tab !== 'home') return;
    logger.info(`[Home] Rendering board for user ${event.user}`);
    await publishHomeView(client, event.user);
  });

  // ─────────────────────────────────────────────
  //  Message Shortcut — "Add to Board"
  //  callback_id must match exactly: add_to_board
  // ─────────────────────────────────────────────

  app.shortcut('add_to_board', async ({ shortcut, ack, client, logger }) => {
    // ACK immediately — must happen within 3 seconds
    await ack();

    logger.info('[Shortcut] add_to_board received', {
      type: shortcut.type,
      user: shortcut.user.id,
    });

    // Message shortcuts have type 'message_action'
    if (shortcut.type !== 'message_action') {
      logger.warn('[Shortcut] Unexpected shortcut type:', shortcut.type);
      return;
    }

    const userId = shortcut.user.id;

    // channel can be missing if used in a DM or global context
    const channelId = (shortcut as any).channel?.id ?? (shortcut as any).channel ?? '';
    const messageTs = shortcut.message_ts;
    const messageText = (shortcut.message as any)?.text ?? '';

    logger.info(`[Shortcut] Processing — user:${userId} channel:${channelId} ts:${messageTs}`);

    try {
      // Get permalink (best-effort — fall back to empty string)
      let permalink = '';
      if (channelId && messageTs) {
        try {
          const permaResp = await client.chat.getPermalink({
            channel: channelId,
            message_ts: messageTs,
          });
          permalink = (permaResp.permalink as string) ?? '';
        } catch (permaErr) {
          logger.warn('[Shortcut] Could not get permalink:', permaErr);
        }
      }

      const task = await createTask({
        title: messageText.trim() || 'Untitled task',
        slackChannelId: channelId,
        slackMessageTs: messageTs,
        slackPermalink: permalink,
        createdBy: userId,
      });

      logger.info(`[Task] Created task ${task.id} for user ${userId}`);

      // Send ephemeral confirmation (only possible if we have a channelId)
      if (channelId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `✅ Task added to your Kanban board! Open the *App Home* tab to see it.`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *Task added to Backlog!*\n"${task.title.slice(0, 80)}"`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Open the *App Home* tab to manage your board.',
                },
              ],
            },
          ],
        });
      }

      // Refresh home view
      await publishHomeView(client, userId);

    } catch (err) {
      logger.error('[Shortcut] Failed to create task:', err);

      // Try to notify the user something went wrong
      if (channelId) {
        try {
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            text: '❌ Failed to add the task. Check the app logs for details.',
          });
        } catch (_) { /* best effort */ }
      }
    }
  });

  // ─────────────────────────────────────────────
  //  Catch-all for unhandled shortcuts (debug)
  // ─────────────────────────────────────────────

  app.shortcut(/.*/, async ({ shortcut, ack, logger }) => {
    logger.warn('[Shortcut] UNHANDLED shortcut received:', (shortcut as any).callback_id);
    await ack();
  });

  // ─────────────────────────────────────────────
  //  Task status transitions
  // ─────────────────────────────────────────────

  const statusActions: Array<{ actionId: string; targetStatus: TaskStatus }> = [
    { actionId: 'task_status_Backlog',     targetStatus: 'Backlog'     },
    { actionId: 'task_status_In_Progress', targetStatus: 'In Progress' },
    { actionId: 'task_status_Waiting',     targetStatus: 'Waiting'     },
    { actionId: 'task_status_Done',        targetStatus: 'Done'        },
  ];

  for (const { actionId, targetStatus } of statusActions) {
    app.action(actionId, async ({ ack, action, body, client, logger }) => {
      await ack();

      const userId = body.user.id;
      const taskId = 'value' in action ? action.value ?? '' : '';

      logger.info(`[Action] ${actionId} — task:${taskId} user:${userId}`);

      try {
        const updated = await updateTaskStatus({ taskId, userId, status: targetStatus });
        if (!updated) {
          logger.warn(`[Action] Task ${taskId} not found or not owned by ${userId}`);
        }
        await publishHomeView(client, userId);
      } catch (err) {
        logger.error('[Action] Status update failed:', err);
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Delete task
  // ─────────────────────────────────────────────

  app.action('task_delete', async ({ ack, action, body, client, logger }) => {
    await ack();

    const userId = body.user.id;
    const taskId = 'value' in action ? action.value ?? '' : '';

    logger.info(`[Action] task_delete — task:${taskId} user:${userId}`);

    try {
      const deleted = await deleteTask(taskId, userId);
      if (!deleted) {
        logger.warn(`[Action] Task ${taskId} not found or not owned by ${userId}`);
      }
      await publishHomeView(client, userId);
    } catch (err) {
      logger.error('[Action] Delete failed:', err);
    }
  });

  // ─────────────────────────────────────────────
  //  Catch-all for unhandled actions (debug)
  // ─────────────────────────────────────────────

  app.action(/.*/, async ({ ack, action, logger }) => {
    logger.warn('[Action] UNHANDLED action received:', (action as any).action_id);
    await ack();
  });
}
