import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

/**
 * GET /health
 * Lightweight liveness check used by Docker / load balancers.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /status
 * Readiness check — verifies DB connectivity.
 */
router.get('/status', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
