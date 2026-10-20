import pg from 'pg';
import { logger } from './logger.js';

export function createPool(): pg.Pool {
  const pool = new pg.Pool({ max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 });
  // Idle clients emit errors when PostgreSQL restarts; without a listener the process would crash.
  pool.on('error', (err) => {
    logger.warn('idle database client error', { error: err.message });
  });
  return pool;
}
