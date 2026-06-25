import type { Task, TaskStatus, StatusGroup } from '../types';

const STATUS_CONFIG: Record<TaskStatus, { emoji: string }> = {
  Backlog:       { emoji: '📋' },
  'In Progress': { emoji: '🔄' },
  Waiting:       { emoji: '⏳' },
  Done:          { emoji: '✅' },
};

const STATUS_ORDER: TaskStatus[] = ['Backlog', 'In Progress', 'Waiting', 'Done'];

const MAX_IN_GRID = 8;

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

function buildColumnField(status: TaskStatus, tasks: Task[]): { type: string; text: string } {
  const { emoji } = STATUS_CONFIG[status];
  const header = `*${emoji}  ${status.toUpperCase()}*  \`${tasks.length}\``;

  if (tasks.length === 0) {
    return { type: 'mrkdwn', text: `${header}\n_No cards yet_` };
  }

  const visible = tasks.slice(0, MAX_IN_GRID);
  const lines = visible.map((t) => `• ${truncate(t.title, 35)}`);
  if (tasks.length > MAX_IN_GRID) {
    lines.push(`_+${tasks.length - MAX_IN_GRID} more…_`);
  }

  return { type: 'mrkdwn', text: `${header}\n${lines.join('\n')}` };
}

// ─────────────────────────────────────────────
//  buildTaskCard  (overflow ⋮ → move / delete)
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskCard(task: Task): any[] {
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

  const permalink = task.slackPermalink ? `<${task.slackPermalink}|↗ Slack>` : '';
  const meta = [permalink, `👤 <@${task.createdBy}>`, `🗓 ${formatDate(task.createdAt)}`]
    .filter(Boolean)
    .join('  ·  ');

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${truncate(task.title, 80)}*\n${meta}`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'card_overflow',
        options: overflowOptions,
      },
    },
    { type: 'divider' },
  ];
}

// ─────────────────────────────────────────────
//  buildHomeView
// ─────────────────────────────────────────────

/**
 * Compose the App Home Tab view.
 *
 * Layout: header → filter pills (All / Backlog / In Progress / Waiting / Done)
 * → an at-a-glance 2×2 column overview of the whole board → a detailed,
 * manageable card list narrowed to the active filter.
 *
 * The overview grid always summarises every column; the pills only narrow the
 * detailed "Manage cards" list below, and the active pill persists per user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildHomeView(tasks: Task[], userId: string, activeFilter: HomeFilter = 'All'): any {
  const appHost = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`).replace(/\/$/, '');
  const boardUrl = `${appHost}/board?user=${encodeURIComponent(userId)}`;

  const groups: StatusGroup[] = STATUS_ORDER.map((status) => ({
    status,
    emoji: STATUS_CONFIG[status].emoji,
    tasks: tasks.filter((t) => t.status === status),
  }));

  const countFor = (f: HomeFilter): number =>
    f === 'All' ? tasks.length : tasks.filter((t) => t.status === f).length;

  const visibleGroups = activeFilter === 'All'
    ? groups
    : groups.filter((g) => g.status === activeFilter);

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

    // ── 2×2 Kanban grid (side-by-side columns, always the full board) ──
    {
      type: 'section',
      fields: [
        buildColumnField('Backlog',     groups[0].tasks),
        buildColumnField('In Progress', groups[1].tasks),
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        buildColumnField('Waiting', groups[2].tasks),
        buildColumnField('Done',    groups[3].tasks),
      ],
    },
    { type: 'divider' },

    // ── Detailed cards (filtered) with ⋮ move/delete ──
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: activeFilter === 'All'
          ? '*Manage cards* — tap  ⋮  to move or delete'
          : `*Manage cards* — showing *${activeFilter}*  ·  tap  ⋮  to move or delete`,
      }],
    },
  ];

  for (const group of visibleGroups) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${group.emoji}  *${group.status}*  \`${group.tasks.length}\``,
      },
    });

    if (group.tasks.length === 0) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '_No cards here yet._' }],
      });
    } else {
      for (const task of group.tasks) {
        blocks.push(...buildTaskCard(task));
      }
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: '💡  For full drag-and-drop, open the board in your browser.' },
    ],
  });

  return { type: 'home', blocks };
}
