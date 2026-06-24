import { Router } from 'express';
import { db } from '../db/pool';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/status', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
