import dotenv from 'dotenv';
dotenv.config();

import { App, ExpressReceiver } from '@slack/bolt';
import express from 'express';
import { testConnection } from './db/pool';
import { runMigrations } from './db/migrate';
import { registerHandlers } from './slack/handlers';
import healthRouter from './routes/health';
import tasksRouter from './routes/tasks';
import boardRouter from './routes/board';

// ─────────────────────────────────────────────
//  Validate required environment variables
// ─────────────────────────────────────────────

const REQUIRED_ENV = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_APP_TOKEN',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
//  Express receiver (shares server with Bolt)
// ─────────────────────────────────────────────

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  // Let Bolt own the Slack event endpoint; we attach extras below
  endpoints: '/slack/events',
});

// Mount our own routes on the same Express app
receiver.app.use(express.json());
receiver.app.use(healthRouter);
receiver.app.use(tasksRouter);
receiver.app.use(boardRouter);

// ─────────────────────────────────────────────
//  Bolt App
// ─────────────────────────────────────────────

const app = new App({
  token:      process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  // Socket Mode uses the App Token (no public URL required for local dev)
  socketMode: true,
  appToken:   process.env.SLACK_APP_TOKEN!,
  // Use our custom receiver so we can attach extra Express routes
  // (Socket Mode doesn't use the receiver for events, but we still expose HTTP)
  logLevel: process.env.LOG_LEVEL as any ?? 'debug',
});

registerHandlers(app);

// ─────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Verify DB connectivity
  await testConnection();

  // 2. Run schema migrations
  await runMigrations();

  // 3. Start the Bolt app (Socket Mode — no port required for Slack traffic)
  await app.start();
  console.log('[App] ⚡ Slack Kanban bot running in Socket Mode ✓');

  // 4. Optionally also start an HTTP server for health checks
  const port = parseInt(process.env.PORT ?? '3000', 10);
  receiver.app.listen(port, () => {
    console.log(`[App] 🌐 HTTP server listening on port ${port}`);
    console.log(`[App]     Health → http://localhost:${port}/health`);
    console.log(`[App]     Status → http://localhost:${port}/status`);
  });
}

bootstrap().catch((err) => {
  console.error('[App] Fatal startup error:', err);
  process.exit(1);
});
