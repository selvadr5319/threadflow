import type { Task, TaskStatus } from '../types';

// ─────────────────────────────────────────────
//  Status configuration
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { emoji: string; color: string }> = {
  Backlog:       { emoji: '📋', color: '#6B7280' },
  'In Progress': { emoji: '🔄', color: '#3B82F6' },
  Waiting:       { emoji: '⏳', color: '#F59E0B' },
  Done:          { emoji: '✅', color: '#10B981' },
};

// ─────────────────────────────────────────────
//  Filters
// ─────────────────────────────────────────────

/** The board can be filtered to a single status, or show everything. */
export type HomeFilter = 'All' | TaskStatus;

/** Order of the filter pills shown at the top of the home view. */
export const FILTER_ORDER: HomeFilter[] = ['All', 'Backlog', 'In Progress', 'Waiting', 'Done'];

/** Slack action_id for a filter pill, e.g. 'In Progress' → 'filter_In_Progress'. */
export function filterActionId(filter: HomeFilter): string {
  return `filter_${filter.replace(/ /g, '_')}`;
}

/** Human label for a filter pill (status emoji + name; 🗂 for All). */
function filterLabel(filter: HomeFilter): string {
  return filter === 'All' ? '🗂 All' : `${STATUS_CONFIG[filter].emoji} ${filter}`;
}

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

/** Build a status-transition button element for a task. */
function buildActionButton(task: Task, action: ActionButton): Record<string, unknown> {
  return {
    type: 'button',
    text: { type: 'plain_text', text: action.text, emoji: true },
    ...(action.style ? { style: action.style } : {}),
    action_id: `task_status_${action.targetStatus.replace(/ /g, '_')}`,
    value: task.id,
  };
}

/**
 * Render a single Kanban task as a compact Block Kit "card":
 *   • bold title with the primary action floated to the right (accessory)
 *   • a 2-column meta grid (status · date / assignee · link)
 *   • the remaining actions + delete in one button row
 *
 * The card carries its own status badge, so cards from any column read
 * correctly in a flat, filtered list — no per-status section header needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskCard(task: Task): any[] {
  const config  = STATUS_CONFIG[task.status];
  const actions = COLUMN_ACTIONS[task.status];

  // Surface the primary (or first) transition as the card's right-aligned
  // accessory; the rest drop into the button row below.
  const primary   = actions.find((a) => a.style === 'primary') ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  const blocks: unknown[] = [
    // ── Card body: title + 2-column meta + primary action ──
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${truncate(task.title, 80)}*`,
      },
      fields: [
        { type: 'mrkdwn', text: `${config.emoji} *${task.status}*` },
        { type: 'mrkdwn', text: `📅 ${formatDate(task.createdAt)}` },
        { type: 'mrkdwn', text: `👤 <@${task.createdBy}>` },
        {
          type: 'mrkdwn',
          text: task.slackPermalink
            ? `<${task.slackPermalink}|🔗 Original message>`
            : '🔗 _No linked message_',
        },
      ],
      ...(primary ? { accessory: buildActionButton(task, primary) } : {}),
    },
    // ── Secondary actions + delete ─────────────────────
    {
      type: 'actions',
      elements: [
        ...secondary.map((action) => buildActionButton(task, action)),
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
 *
 * Instead of stacking a section per status, the view shows a filter bar
 * (All / Backlog / In Progress / Waiting / Done) and renders the tasks for
 * the active filter as a flat list of compact cards.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHomeView(tasks: Task[], userId: string, activeFilter: HomeFilter = 'All'): any {
  const boardUrl = `http://localhost:${process.env.PORT ?? '3000'}/board?user=${encodeURIComponent(userId)}`;

  const countFor = (f: HomeFilter): number =>
    f === 'All' ? tasks.length : tasks.filter((t) => t.status === f).length;

  const visible = activeFilter === 'All'
    ? tasks
    : tasks.filter((t) => t.status === activeFilter);

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
          text: `*${tasks.length}* task${tasks.length !== 1 ? 's' : ''} on your board  •  use the *"Add to Board"* message shortcut to create more.`,
        },
      ],
    },
    // ── Filter pills ────────────────────────────
    {
      type: 'actions',
      elements: FILTER_ORDER.map((f) => ({
        type: 'button',
        text: { type: 'plain_text', text: `${filterLabel(f)} · ${countFor(f)}`, emoji: true },
        ...(f === activeFilter ? { style: 'primary' } : {}),
        action_id: filterActionId(f),
        value: f,
      })),
    },
    // ── Open web board ──────────────────────────
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🖥  Open Kanban Board', emoji: true },
          url: boardUrl,
          action_id: 'open_board',
        },
      ],
    },
    { type: 'divider' },
  ];

  // ── Filtered task cards ─────────────────────
  if (visible.length === 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: activeFilter === 'All'
            ? '_No tasks yet. Use the *"Add to Board"* message shortcut to create one._'
            : `_No tasks in *${activeFilter}*._`,
        },
      ],
    });
  } else {
    for (const task of visible) {
      blocks.push(...buildTaskCard(task));
    }
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
