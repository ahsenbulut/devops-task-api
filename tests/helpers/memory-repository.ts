import type { Task } from '../../src/models/task.js';
import type { TaskRepository } from '../../src/store/task-store.js';

export class MemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  list(): Promise<Task[]> {
    return Promise.resolve([...this.tasks.values()]);
  }

  get(id: string): Promise<Task | undefined> {
    return Promise.resolve(this.tasks.get(id));
  }

  save(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }
}
