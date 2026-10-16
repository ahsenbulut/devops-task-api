import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors.js';
import { logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
};

function isClientError(err: unknown): err is { status: number; message: string } {
  if (typeof err !== 'object' || err === null || !('status' in err)) {
    return false;
  }
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Errors raised by body-parser (malformed JSON, payload too large, ...) carry a 4xx status.
  if (isClientError(err)) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }

  logger.error('unhandled error', {
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
  });
  res.status(500).json({ error: { message: 'Internal server error' } });
};
