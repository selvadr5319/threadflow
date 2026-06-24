import type { Task, TaskStatus, StatusGroup } from '../types';

// ─────────────────────────────────────────────
//  Status configuration
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { emoji: string; color: string }> = {
  Backlog:       { emoji: '📋', color: '#6B7280' },
  'In Progress': { emoji: '🔄', color: '#3B82F6' },
  Waiting:       { emoji: '⏳', color: '#F59E0B' },
  Done:          { emoji: '✅', color: '#10B981' },
};

const STATUS_ORDER: TaskStatus[] = ['Backlog', 'In Progress', 'Waiting', 'Done'];

// ─────────────────────────────────────────────
//  Next-status button definitions per column
// ─────────────────────────────────────────────

interface ActionButton {
  text: string;
  targetStatus: TaskStatus;
  style?: 'primary' | 'danger';
}

const COLUMN_ACTIONS: Record<TaskStatus, ActionButton[]> = {
  Backlog: [
    { text: '▶ Start', targetStatus: 'In Progress', style: 'primary' },
  ],
  'In Progress': [
    { text: '⏸ Wait',   targetStatus: 'Waiting' },
    { text: '✔ Done',   targetStatus: 'Done',   style: 'primary' },
  ],
  Waiting: [
    { text: '▶ Resume', targetStatus: 'In Progress', style: 'primary' },
    { text: '✔ Done',   targetStatus: 'Done' },
  ],
  Done: [
    { text: '↩ Reopen', targetStatus: 'Backlog' },
  ],
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/** Format a Date to a human-readable short string. */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Truncate text for card preview. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ─────────────────────────────────────────────
//  buildTaskCard
// ─────────────────────────────────────────────

/**
 * Render a single Kanban task card as a Block Kit section + actions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskCard(task: Task): any[] {
  const config = STATUS_CONFIG[task.status];
  const actions = COLUMN_ACTIONS[task.status];

  const blocks: unknown[] = [
    // ── Card header ─────────────────────────────
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${truncate(task.title, 80)}*\n<${task.slackPermalink}|View original message>  •  ${config.emoji} ${task.status}`,
      },
    },
    // ── Meta row ────────────────────────────────
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `👤 <@${task.createdBy}>  •  📅 ${formatDate(task.createdAt)}`,
        },
      ],
    },
    // ── Action buttons ───────────────────────────
    {
      type: 'actions',
      elements: [
        ...actions.map((action) => ({
          type: 'button',
          text: { type: 'plain_text', text: action.text, emoji: true },
          ...(action.style ? { style: action.style } : {}),
          action_id: `task_status_${action.targetStatus.replace(/ /g, '_')}`,
          value: task.id,
        })),
        // Delete button
        {
          type: 'button',
          text: { type: 'plain_text', text: '🗑 Delete', emoji: true },
          style: 'danger',
          action_id: 'task_delete',
          value: task.id,
          confirm: {
            title: { type: 'plain_text', text: 'Delete task?' },
            text: {
              type: 'mrkdwn',
              text: `Are you sure you want to delete *"${truncate(task.title, 50)}"*? This cannot be undone.`,
            },
            confirm: { type: 'plain_text', text: 'Yes, delete' },
            deny:    { type: 'plain_text', text: 'Cancel' },
            style: 'danger',
          },
        },
      ],
    },
    // ── Divider ─────────────────────────────────
    { type: 'divider' },
  ];

  return blocks;
}

// ─────────────────────────────────────────────
//  buildHomeView
// ─────────────────────────────────────────────

/**
 * Compose the full App Home Tab view from a list of tasks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHomeView(tasks: Task[], userId: string): any {
  const boardUrl = `http://localhost:${process.env.PORT ?? '3000'}/board?user=${encodeURIComponent(userId)}`;
  // Group tasks by status
  const groups: StatusGroup[] = STATUS_ORDER.map((status) => ({
    status,
    emoji: STATUS_CONFIG[status].emoji,
    tasks: tasks.filter((t) => t.status === status),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    // ── Hero header ─────────────────────────────
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🗂️  My Threadflow',
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `You have *${tasks.length}* task${tasks.length !== 1 ? 's' : ''} across all columns.  Use the *"Add to Board"* message shortcut to create tasks from any Slack message.`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🖥  Open Kanban Board', emoji: true },
          style: 'primary',
          url: boardUrl,
          action_id: 'open_board',
        },
      ],
    },
    { type: 'divider' },
  ];

  // ── Columns ─────────────────────────────────
  for (const group of groups) {
    const count = group.tasks.length;

    // Column header
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${group.emoji}  *${group.status}*  _(${count} task${count !== 1 ? 's' : ''})_`,
      },
    });

    if (count === 0) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '_No tasks here yet._' },
        ],
      });
    } else {
      for (const task of group.tasks) {
        blocks.push(...buildTaskCard(task));
      }
    }

    blocks.push({ type: 'divider' });
  }

  // ── Footer ───────────────────────────────────
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '💡  Right-click any Slack message › *More message shortcuts* › *Add to Board* to create a task.',
      },
    ],
  });

  return {
    type: 'home',
    blocks,
  };
}
