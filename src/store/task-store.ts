import type { Task } from '../models/task.js';

/**
 * Process-local, in-memory storage. Data is lost on restart and is NOT shared
 * between replicas (see README: "In-memory storage limitations").
 */
export class TaskStore {
  private readonly tasks = new Map<string, Task>();

  list(): Task[] {
    return [...this.tasks.values()];
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  save(task: Task): Task {
    this.tasks.set(task.id, task);
    return task;
  }
}
