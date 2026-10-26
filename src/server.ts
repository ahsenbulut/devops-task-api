import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { logger } from './logger.js';
import { TaskService } from './services/task-service.js';
import { TicketService } from './services/ticket-service.js';
import { TaskStore } from './store/task-store.js';
import { TicketStore } from './store/ticket-store.js';

const config = loadConfig();

let shuttingDown = false;
const pool = createPool();
const taskStore = new TaskStore(pool);
const ticketStore = new TicketStore(pool);
const app = createApp({
  taskService: new TaskService(taskStore),
  ticketService: new TicketService(ticketStore),
  isReady: async () =>
    !shuttingDown && (await taskStore.checkReady()) && (await ticketStore.checkReady()),
});

const server = app.listen(config.port, () => {
  logger.info('server started', { port: config.port, nodeEnv: process.env.NODE_ENV ?? 'unset' });
});

server.on('error', (err) => {
  logger.error('server failed to start', { error: err.message });
  process.exit(1);
});

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('shutdown signal received, draining connections', { signal });

  // Hard deadline in case open connections never finish (should stay below
  // the Kubernetes terminationGracePeriodSeconds, default 30s).
  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out, forcing exit', {
      timeoutMs: config.shutdownTimeoutMs,
    });
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();

  // Stop accepting new connections and wait for in-flight requests to complete.
  server.close((err) => {
    if (err) {
      logger.error('error during shutdown', { error: err.message });
      process.exit(1);
    }
    pool.end().then(
      () => {
        logger.info('server and database pool closed, exiting');
        process.exit(0);
      },
      (poolErr: unknown) => {
        logger.error('error closing database pool', { error: String(poolErr) });
        process.exit(1);
      },
    );
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
