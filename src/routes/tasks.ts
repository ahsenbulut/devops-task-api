import { Router } from 'express';
import { NotFoundError } from '../errors.js';
import type { TaskService } from '../services/task-service.js';

export function tasksRouter(taskService: TaskService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const tasks = taskService.listTasks();
    res.status(200).json({ data: tasks, count: tasks.length });
  });

  router.get('/:id', (req, res) => {
    const task = taskService.getTask(req.params.id);
    if (!task) {
      throw new NotFoundError(`Task with id '${req.params.id}' not found`);
    }
    res.status(200).json({ data: task });
  });

  router.post('/', (req, res) => {
    const task = taskService.createTask(req.body);
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ data: task });
  });

  return router;
}
