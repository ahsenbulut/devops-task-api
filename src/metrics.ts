import type { RequestHandler } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const UNTRACKED_PATHS = ['/metrics', '/health'];

// Route template label (e.g. /api/tasks/:id), never the raw URL, to keep label cardinality bounded.
// req.baseUrl is already reset when an error bubbles up to the app-level handler, so the mount path is
// derived from originalUrl minus as many segments as the matched route template has.
function routeLabel(req: Parameters<RequestHandler>[0]): string {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  if (routePath === undefined) {
    return 'unmatched';
  }
  const requestSegments = (req.originalUrl.split('?')[0] ?? '').split('/').filter(Boolean);
  const routeSegments = routePath.split('/').filter(Boolean).length;
  const mountPath = requestSegments.slice(0, requestSegments.length - routeSegments).join('/');
  return `${mountPath ? `/${mountPath}` : ''}${routePath}`;
}

export interface Metrics {
  middleware: RequestHandler;
  handler: RequestHandler;
}

export function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const labelNames = ['method', 'route', 'status_code'] as const;
  const requests = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames,
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  const middleware: RequestHandler = (req, res, next) => {
    if (UNTRACKED_PATHS.some((path) => req.path === path || req.path.startsWith(`${path}/`))) {
      next();
      return;
    }
    const stopTimer = duration.startTimer();
    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: routeLabel(req),
        status_code: String(res.statusCode),
      };
      requests.inc(labels);
      stopTimer(labels);
    });
    next();
  };

  const handler: RequestHandler = async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  };

  return { middleware, handler };
}
