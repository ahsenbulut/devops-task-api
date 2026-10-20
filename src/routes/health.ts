import { Router } from 'express';

/**
 * - /health/live:  the process is up and the event loop responds. No dependency checks,
 *                  so a failing downstream never causes needless restarts.
 * - /health/ready: the instance can accept traffic: not shutting down and the database
 *                  (including the tasks table) is reachable.
 */
export function healthRouter(isReady: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', async (_req, res) => {
    if (await isReady()) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  return router;
}
