# Future Features Plan

Planned enhancements to bring ThreadFlow in line with the original plugin
concept (priority + comments + filtering). These build on the existing
**handler → service → repository → DB** architecture — no rewrite needed.

> Status: **Proposed** — not yet scheduled.
> Each feature is independent and can ship on its own.

---

## Context

ThreadFlow today is a **status-based Kanban board**: a Slack message becomes a
private task that moves through `Backlog → In Progress → Waiting → Done`, all
inside the App Home tab. It already supports add-from-message, list, mark done,
remove, and deep-linking back to the original message.

The three features below were part of the original design but are **not yet
implemented**:

1. **Priority** — rank tasks High / Medium / Low
2. **Comments / notes** — private per-task notes (never posted to the thread)
3. **Filter & sort** — narrow and reorder the task list in the Home view

---

## Feature 1 — Task Priority

Let users tag each task with a priority and sort/filter by it.

**Data**
- Add `priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low'))` to the `tasks` table.
- Update both [schema.sql](../../schema.sql) and [src/db/migrate.ts](../../src/db/migrate.ts) (keep the two in sync — see the note in the Risks section).
- Add an index `idx_tasks_priority` if we sort by priority frequently.

**Types** — [src/types/index.ts](../../src/types/index.ts)
- Add `type TaskPriority = 'High' | 'Medium' | 'Low'` and a `priority` field on `Task` / `TaskRow` / `CreateTaskInput`.

**Repository** — [src/repositories/taskRepository.ts](../../src/repositories/taskRepository.ts)
- Include `priority` in `insertTask` and `rowToTask`.
- Add `updatePriority(taskId, userId, priority)` (scoped to `created_by`, same pattern as `updateStatus`).

**Service** — [src/services/taskService.ts](../../src/services/taskService.ts)
- Add `setTaskPriority(...)` with a priority whitelist (mirror `updateTaskStatus`).

**View** — [src/views/homeView.ts](../../src/views/homeView.ts)
- Add a priority `static_select` (or overflow menu) on each task card.
- Show a priority badge (e.g. 🔴 High / 🟡 Medium / 🟢 Low) in the card header.

**Handler** — [src/slack/handlers.ts](../../src/slack/handlers.ts)
- Register a `task_set_priority` action → `setTaskPriority` → republish home.

---

## Feature 2 — Comments / Private Notes

Per-task notes visible only in the App Home tab — **never** posted back to the
Slack thread (preserves the "doesn't reflect in thread" requirement).

**Data** — new table
```sql
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  TEXT        NOT NULL,            -- Slack user ID
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments (task_id, created_at);
```
- `ON DELETE CASCADE` so deleting a task cleans up its notes.

**Repository** — new `commentRepository.ts`
- `addComment(taskId, authorId, body)`, `findCommentsByTask(taskId)`, `deleteComment(id, authorId)`.

**Service** — `commentService.ts` (or extend `taskService.ts`)
- Validate ownership of the parent task before allowing a comment.

**View** — [src/views/homeView.ts](../../src/views/homeView.ts)
- Render existing notes under each card as a `context` block.
- Add an "💬 Add note" button that opens a **modal** (`views.open`) with a multiline input.

**Handler** — [src/slack/handlers.ts](../../src/slack/handlers.ts)
- `task_add_comment` action → open modal.
- `view_submission` for the modal → `addComment` → republish home.

---

## Feature 3 — Filter & Sort

Let users narrow the Home view (by status/priority) and reorder it — matching
the prototype's filter chips and sort button.

**Approach** — Slack App Home has no persistent client-side state, so filter
selection must persist server-side per user.

**Data** — small per-user preferences table (or a JSON column):
```sql
CREATE TABLE IF NOT EXISTS user_view_prefs (
  user_id   TEXT PRIMARY KEY,
  filter    TEXT,          -- e.g. 'High' | 'Done' | null (all)
  sort_by   TEXT NOT NULL DEFAULT 'created_desc'  -- 'priority' | 'created_desc'
);
```

**View** — [src/views/homeView.ts](../../src/views/homeView.ts)
- Add filter buttons/overflow (All / High / Medium / Low / Done) and a sort toggle at the top.
- Apply the active filter + sort when grouping/ordering tasks.

**Handler** — [src/slack/handlers.ts](../../src/slack/handlers.ts)
- `view_set_filter` / `view_set_sort` actions → persist pref → republish home.

**Simpler v1 alternative:** skip persistence and just expose a sort toggle that
reorders within the existing status grouping (priority then date). Filtering can
follow once priority lands.

---

## Suggested Order

1. **Priority** — unlocks both sorting and filtering by priority.
2. **Filter & sort** — depends on priority for the most useful filters.
3. **Comments** — fully independent; can be done any time.

---

## Cross-Cutting Notes

- **Schema drift:** [schema.sql](../../schema.sql) currently has a `CHECK` on `status` that the live migration in [src/db/migrate.ts](../../src/db/migrate.ts) omits. Whenever we touch the schema, update **both** files and consider closing this gap.
- **Debug logging:** the global payload logger and `logLevel: 'debug'` in [src/slack/handlers.ts](../../src/slack/handlers.ts) / [src/app.ts](../../src/app.ts) are marked "remove in production" — tidy these before any release.
- **Manifest scopes:** comment modals need no new scopes; confirm `commands`/interactivity already cover the new actions in [slack-app-manifest.yml](../../slack-app-manifest.yml).
- **Extension checklist:** follow the existing "Add a new status column" steps in the [README](../../README.md) when adding enum values, so all four touchpoints (types, view, handler, schema+migration) stay consistent.
