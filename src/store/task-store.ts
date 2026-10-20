import type pg from 'pg';
import type { Task } from '../models/task.js';

export interface TaskRepository {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  save(task: Task): Promise<Task>;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  };
}

export class TaskStore implements TaskRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(): Promise<Task[]> {
    const result = await this.pool.query<TaskRow>(
      'SELECT id, title, description, completed, created_at FROM tasks ORDER BY created_at, id',
    );
    return result.rows.map(toTask);
  }

  async get(id: string): Promise<Task | undefined> {
    if (!UUID_PATTERN.test(id)) {
      return undefined;
    }
    const result = await this.pool.query<TaskRow>(
      'SELECT id, title, description, completed, created_at FROM tasks WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? toTask(row) : undefined;
  }

  async save(task: Task): Promise<Task> {
    await this.pool.query(
      'INSERT INTO tasks (id, title, description, completed, created_at) VALUES ($1, $2, $3, $4, $5)',
      [task.id, task.title, task.description, task.completed, task.createdAt],
    );
    return task;
  }

  async checkReady(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1 FROM tasks LIMIT 0');
      return true;
    } catch {
      return false;
    }
  }
}
