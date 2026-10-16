import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';
import { tasksRouter } from './routes/tasks.js';
import { TaskService } from './services/task-service.js';
import { TaskStore } from './store/task-store.js';

export interface AppOptions {
  taskService?: TaskService;
  isReady?: () => boolean;
}

/**
 * Builds the Express application without binding a port, so tests can drive it
 * directly with Supertest and each test can get a fresh, isolated store.
 */
export function createApp(options: AppOptions = {}): Express {
  const taskService = options.taskService ?? new TaskService(new TaskStore());
  const isReady = options.isReady ?? (() => true);

  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter(isReady));
  app.use('/api/tasks', tasksRouter(taskService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
