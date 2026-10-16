import { Router } from 'express';

/**
 * - /health/live:  the process is up and the event loop responds. No dependency checks,
 *                  so a failing downstream never causes needless restarts.
 * - /health/ready: the instance can accept traffic. Returns 503 while shutting down so
 *                  the load balancer / Service stops routing new requests to it.
 */
export function healthRouter(isReady: () => boolean): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', (_req, res) => {
    if (isReady()) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  return router;
}
