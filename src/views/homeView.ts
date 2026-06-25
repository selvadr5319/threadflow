import type { Task, TaskStatus } from '../types';

const STATUS_CONFIG: Record<TaskStatus, { emoji: string }> = {
  Backlog:       { emoji: '📋' },
  'In Progress': { emoji: '🔄' },
  Waiting:       { emoji: '⏳' },
  Done:          { emoji: '✅' },
};

const STATUS_ORDER: TaskStatus[] = ['Backlog', 'In Progress', 'Waiting', 'Done'];

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
//  Helpers
// ─────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ─────────────────────────────────────────────
//  UserProfile  (resolved at render time)
// ─────────────────────────────────────────────

export interface UserProfile {
  name: string;
  avatar: string;
}

// ─────────────────────────────────────────────
//  buildTaskCard  (overflow ⋮ → move / delete)
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskCard(task: Task, profile?: UserProfile): any[] {
  const otherStatuses = STATUS_ORDER.filter((s) => s !== task.status);

  const overflowOptions = [
    ...otherStatuses.map((s) => ({
      text: { type: 'plain_text', text: `${STATUS_CONFIG[s].emoji}  Move to ${s}`, emoji: true },
      value: `move||${s}||${task.id}`,
    })),
    {
      text: { type: 'plain_text', text: '🗑  Delete card', emoji: true },
      value: `delete||${task.id}`,
    },
  ];

  const { emoji } = STATUS_CONFIG[task.status];
  const authorId = task.messageAuthorId ?? task.createdBy;
  const displayName = profile?.name ?? `<@${authorId}>`;
  const dateStr = formatDate(task.createdAt);

  // Header row: avatar (if available) + "Name  ·  date  ·  status"
  const headerElements: object[] = [];
  if (profile?.avatar) {
    headerElements.push({ type: 'image', image_url: profile.avatar, alt_text: displayName });
  }
  headerElements.push({
    type: 'mrkdwn',
    text: `*${displayName}*  ·  ${dateStr}  ·  ${emoji} ${task.status}`,
  });

  // Title is a link to the original Slack message if a permalink exists
  const titleText = task.slackPermalink
    ? `<${task.slackPermalink}|${truncate(task.title, 120)}>`
    : truncate(task.title, 120);

  const blocks: object[] = [
    { type: 'context', elements: headerElements },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: titleText },
      accessory: {
        type: 'overflow',
        action_id: 'card_overflow',
        options: overflowOptions,
      },
    },
    { type: 'divider' },
  ];

  return blocks;
}

// ─────────────────────────────────────────────
//  buildHomeView
// ─────────────────────────────────────────────

/**
 * Compose the App Home Tab view.
 *
 * Layout: header → filter pills (All / Backlog / In Progress / Waiting / Done)
 * → a detailed, manageable card list narrowed to the active filter.
 *
 * The pills narrow the "Manage cards" list, and the active pill persists per user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHomeView(tasks: Task[], userId: string, activeFilter: HomeFilter = 'All', profiles: Map<string, UserProfile> = new Map()): any {
  const appHost = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`).replace(/\/$/, '');
  const boardUrl = `${appHost}/board?user=${encodeURIComponent(userId)}`;

  const countFor = (f: HomeFilter): number =>
    f === 'All' ? tasks.length : tasks.filter((t) => t.status === f).length;

  // Cards for the active filter, ordered by status so the flat list stays tidy.
  const statusRank = (s: TaskStatus): number => STATUS_ORDER.indexOf(s);
  const visibleTasks = (activeFilter === 'All' ? [...tasks] : tasks.filter((t) => t.status === activeFilter))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🗂️  My Threadflow', emoji: true },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${tasks.length}* task${tasks.length !== 1 ? 's' : ''} on your board.  Right-click any message › *More shortcuts* › *Add to Board* to create a card.`,
        },
      ],
    },
    // ── Filter pills ──
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
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🖥  Open full board', emoji: true },
          url: boardUrl,
          action_id: 'open_board',
        },
      ],
    },
    { type: 'divider' },
  ];

  // ── Cards (filtered) with ⋮ move/delete ──
  if (visibleTasks.length === 0) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_No cards yet._' }],
    });
  } else {
    for (const task of visibleTasks) {
      blocks.push(...buildTaskCard(task, profiles.get(task.messageAuthorId ?? task.createdBy)));
    }
  }

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: '💡  Tap  ⋮  on a card to move or delete  ·  open the board in your browser for drag-and-drop.' },
    ],
  });

  return { type: 'home', blocks };
}
