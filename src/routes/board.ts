import { Router } from 'express';

const router = Router();

router.get('/board', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(BOARD_HTML);
});

export default router;

const BOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Threadflow — Kanban Board</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }

    header {
      background: #1e293b;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #334155;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
    }

    .refresh-btn {
      margin-left: auto;
      background: #334155;
      border: none;
      color: #94a3b8;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .refresh-btn:hover { background: #475569; color: #e2e8f0; }

    .user-badge {
      font-size: 12px;
      color: #64748b;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 4px 10px;
    }

    #error-bar {
      display: none;
      background: rgba(239,68,68,0.15);
      border-bottom: 1px solid rgba(239,68,68,0.3);
      color: #fca5a5;
      padding: 8px 24px;
      font-size: 13px;
      text-align: center;
    }

    .board {
      display: flex;
      gap: 16px;
      padding: 20px 24px;
      overflow-x: auto;
      min-height: calc(100vh - 57px);
      align-items: flex-start;
    }

    .column {
      flex: 0 0 272px;
      background: #1e293b;
      border-radius: 10px;
      border-top: 3px solid var(--col-color);
      display: flex;
      flex-direction: column;
    }

    .column-header {
      padding: 12px 14px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--col-color);
      user-select: none;
    }

    .col-count {
      margin-left: auto;
      background: rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 1px 8px;
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .column-body {
      padding: 6px;
      flex: 1;
      min-height: 100px;
      border-radius: 0 0 10px 10px;
      transition: background 0.12s;
    }

    .column-body.drag-over {
      background: rgba(255,255,255,0.04);
      outline: 2px dashed var(--col-color);
      outline-offset: -4px;
      border-radius: 6px;
    }

    .empty-hint {
      text-align: center;
      color: #334155;
      font-size: 12px;
      padding: 20px 8px;
      pointer-events: none;
    }

    .card {
      background: #0f172a;
      border-radius: 7px;
      padding: 10px 12px;
      margin-bottom: 7px;
      cursor: grab;
      border-left: 3px solid var(--col-color);
      position: relative;
      transition: box-shadow 0.15s, transform 0.1s, opacity 0.15s;
    }

    .card:active { cursor: grabbing; }

    .card:hover {
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      transform: translateY(-1px);
    }

    .card.dragging {
      opacity: 0.35;
      transform: scale(0.98);
    }

    .card-title {
      font-size: 12.5px;
      font-weight: 500;
      color: #cbd5e1;
      line-height: 1.45;
      margin-bottom: 8px;
      padding-right: 20px;
    }

    .card-link {
      display: inline-block;
      color: #60a5fa;
      font-size: 10.5px;
      text-decoration: none;
      margin-top: 4px;
      opacity: 0.8;
    }

    .card-link:hover { opacity: 1; text-decoration: underline; }

    .card-meta {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #475569;
    }

    .card-del {
      position: absolute;
      top: 7px;
      right: 7px;
      background: none;
      border: none;
      color: #334155;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.12s, color 0.12s, background 0.12s;
    }

    .card:hover .card-del { opacity: 1; }
    .card-del:hover { color: #ef4444; background: rgba(239,68,68,0.12); }

    .user-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      min-height: calc(100vh - 57px);
    }

    .user-prompt p { color: #64748b; font-size: 14px; }

    .user-prompt input {
      background: #1e293b;
      border: 1px solid #334155;
      color: #e2e8f0;
      border-radius: 7px;
      padding: 9px 14px;
      font-size: 14px;
      width: 240px;
      outline: none;
    }

    .user-prompt input:focus { border-color: #3b82f6; }

    .user-prompt button {
      background: #3b82f6;
      border: none;
      color: #fff;
      border-radius: 7px;
      padding: 9px 22px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .user-prompt button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <header>
    <span>🗂️</span>
    <h1>Threadflow</h1>
    <span id="user-badge" class="user-badge" style="display:none"></span>
    <button class="refresh-btn" id="refresh-btn" style="display:none">↺ Refresh</button>
  </header>
  <div id="error-bar"></div>
  <div id="root"></div>

  <script>
    const STATUSES = ['Backlog', 'In Progress', 'Waiting', 'Done'];
    const CFG = {
      'Backlog':     { emoji: '📋', color: '#6B7280' },
      'In Progress': { emoji: '🔄', color: '#3B82F6' },
      'Waiting':     { emoji: '⏳', color: '#F59E0B' },
      'Done':        { emoji: '✅', color: '#10B981' },
    };

    const params = new URLSearchParams(location.search);
    let userId = params.get('user') || localStorage.getItem('tf_user') || '';
    let tasks = [];

    function esc(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fmtDate(iso) {
      return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }

    function trunc(s, n) {
      return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    function showError(msg) {
      const bar = document.getElementById('error-bar');
      bar.textContent = msg;
      bar.style.display = 'block';
      setTimeout(() => { bar.style.display = 'none'; }, 4000);
    }

    async function apiFetch(url, opts) {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      return res.json();
    }

    async function loadTasks() {
      tasks = await apiFetch('/api/tasks?userId=' + encodeURIComponent(userId));
    }

    async function patchStatus(taskId, newStatus) {
      await apiFetch('/api/tasks/' + taskId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus }),
      });
    }

    async function removeTask(taskId) {
      await apiFetch('/api/tasks/' + taskId + '?userId=' + encodeURIComponent(userId), {
        method: 'DELETE',
      });
    }

    function makeCard(task) {
      const cfg = CFG[task.status];
      const card = document.createElement('div');
      card.className = 'card';
      card.draggable = true;
      card.dataset.id = task.id;
      card.style.setProperty('--col-color', cfg.color);

      const link = task.slackPermalink
        ? '<a class="card-link" href="' + esc(task.slackPermalink) + '" target="_blank" draggable="false">↗ View in Slack</a>'
        : '';

      card.innerHTML =
        '<button class="card-del" title="Delete">✕</button>' +
        '<div class="card-title">' + esc(trunc(task.title, 120)) + '<br>' + link + '</div>' +
        '<div class="card-meta">' +
          '<span>👤 ' + esc(task.createdBy) + '</span>' +
          '<span>📅 ' + fmtDate(task.createdAt) + '</span>' +
        '</div>';

      card.querySelector('.card-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete "' + trunc(task.title, 60) + '"?')) return;
        try {
          await removeTask(task.id);
          tasks = tasks.filter(t => t.id !== task.id);
          renderBoard();
        } catch (err) {
          showError('Delete failed: ' + err.message);
        }
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        requestAnimationFrame(() => card.classList.add('dragging'));
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      return card;
    }

    function renderBoard() {
      const root = document.getElementById('root');
      root.innerHTML = '';

      const board = document.createElement('div');
      board.className = 'board';

      for (const status of STATUSES) {
        const cfg = CFG[status];
        const col = document.createElement('div');
        col.className = 'column';
        col.style.setProperty('--col-color', cfg.color);

        const colTasks = tasks.filter(t => t.status === status);

        const header = document.createElement('div');
        header.className = 'column-header';
        header.innerHTML =
          cfg.emoji + ' ' + esc(status) +
          '<span class="col-count">' + colTasks.length + '</span>';

        const body = document.createElement('div');
        body.className = 'column-body';
        body.dataset.status = status;
        body.style.setProperty('--col-color', cfg.color);

        if (colTasks.length === 0) {
          body.innerHTML = '<div class="empty-hint">Drop tasks here</div>';
        } else {
          colTasks.forEach(t => body.appendChild(makeCard(t)));
        }

        body.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          body.classList.add('drag-over');
        });

        body.addEventListener('dragleave', (e) => {
          if (!body.contains(e.relatedTarget)) body.classList.remove('drag-over');
        });

        body.addEventListener('drop', async (e) => {
          e.preventDefault();
          body.classList.remove('drag-over');
          const taskId = e.dataTransfer.getData('text/plain');
          const newStatus = body.dataset.status;
          const task = tasks.find(t => t.id === taskId);
          if (!task || task.status === newStatus) return;

          const oldStatus = task.status;
          task.status = newStatus;
          renderBoard();

          try {
            await patchStatus(taskId, newStatus);
          } catch (err) {
            task.status = oldStatus;
            renderBoard();
            showError('Move failed: ' + err.message);
          }
        });

        col.appendChild(header);
        col.appendChild(body);
        board.appendChild(col);
      }

      root.appendChild(board);
    }

    function renderUserPrompt() {
      const root = document.getElementById('root');
      root.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'user-prompt';
      div.innerHTML =
        '<p>Enter your Slack user ID to view your board</p>' +
        '<input id="uid" type="text" placeholder="e.g. U01ABC123" spellcheck="false" />' +
        '<button id="uid-go">View Board</button>';
      root.appendChild(div);

      const input = document.getElementById('uid');
      const go = () => {
        const val = input.value.trim();
        if (!val) return;
        userId = val;
        localStorage.setItem('tf_user', val);
        history.replaceState(null, '', '?user=' + encodeURIComponent(val));
        init();
      };

      document.getElementById('uid-go').addEventListener('click', go);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      input.focus();
    }

    async function init() {
      if (!userId) {
        renderUserPrompt();
        return;
      }

      document.getElementById('user-badge').textContent = '👤 ' + userId;
      document.getElementById('user-badge').style.display = '';
      document.getElementById('refresh-btn').style.display = '';

      try {
        await loadTasks();
        renderBoard();
      } catch (err) {
        showError('Failed to load tasks: ' + err.message);
      }
    }

    document.getElementById('refresh-btn').addEventListener('click', async () => {
      try {
        await loadTasks();
        renderBoard();
      } catch (err) {
        showError('Refresh failed: ' + err.message);
      }
    });

    init();
  </script>
</body>
</html>`;
