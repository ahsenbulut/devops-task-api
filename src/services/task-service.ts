import { randomUUID } from 'node:crypto';
import { ValidationError } from '../errors.js';
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type CreateTaskInput,
  type Task,
} from '../models/task.js';
import type { TaskStore } from '../store/task-store.js';

const ALLOWED_FIELDS = new Set(['title', 'description', 'completed']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCreateTaskInput(payload: unknown): CreateTaskInput {
  if (!isPlainObject(payload)) {
    throw new ValidationError(['request body must be a JSON object']);
  }

  const errors: string[] = [];

  const unknownFields = Object.keys(payload).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknownFields.length > 0) {
    errors.push(`unknown field(s): ${unknownFields.join(', ')}`);
  }

  const { title, description, completed } = payload;

  let normalizedTitle = '';
  if (typeof title !== 'string') {
    errors.push('title is required and must be a string');
  } else {
    normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      errors.push('title must not be empty');
    } else if (normalizedTitle.length > TITLE_MAX_LENGTH) {
      errors.push(`title must be at most ${TITLE_MAX_LENGTH} characters`);
    }
  }

  let normalizedDescription: string | null = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push('description must be a string');
    } else if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
      errors.push(`description must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
    } else {
      normalizedDescription = description.trim() || null;
    }
  }

  if (completed !== undefined && typeof completed !== 'boolean') {
    errors.push('completed must be a boolean');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  return {
    title: normalizedTitle,
    description: normalizedDescription,
    completed: completed === true,
  };
}

export class TaskService {
  constructor(private readonly store: TaskStore) {}

  listTasks(): Task[] {
    return this.store.list();
  }

  getTask(id: string): Task | undefined {
    return this.store.get(id);
  }

  createTask(payload: unknown): Task {
    const input = validateCreateTaskInput(payload);
    return this.store.save({
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    });
  }
}
