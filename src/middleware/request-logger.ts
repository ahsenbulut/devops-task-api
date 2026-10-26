import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../logger.js';
import { routeLabel } from '../metrics.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  const incoming = req.get('x-request-id');
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('request completed', {
      requestId,
      method: req.method,
      route: routeLabel(req),
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });
  next();
};
