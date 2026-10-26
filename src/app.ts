import express, { type Express } from 'express';
import { createMetrics } from './metrics.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';
import { tasksRouter } from './routes/tasks.js';
import { ticketsRouter } from './routes/tickets.js';
import type { TaskService } from './services/task-service.js';
import type { TicketService } from './services/ticket-service.js';

export interface AppOptions {
  taskService: TaskService;
  ticketService: TicketService;
  isReady: () => Promise<boolean>;
}

/**
 * Builds the Express application without binding a port, so tests can drive it
 * directly with Supertest against their own store.
 */
export function createApp({ taskService, ticketService, isReady }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  const metrics = createMetrics();

  app.use(requestLogger);
  app.use(metrics.middleware);
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter(isReady));
  app.use('/api/tasks', tasksRouter(taskService));
  app.use('/api/tickets', ticketsRouter(ticketService));
  app.get('/metrics', metrics.handler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
