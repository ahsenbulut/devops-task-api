import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors.js';
import { TaskService } from '../../src/services/task-service.js';
import { TaskStore } from '../../src/store/task-store.js';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(new TaskStore());
  });

  describe('createTask', () => {
    it('creates a task with a valid title and defaults', () => {
      const task = service.createTask({ title: '  Write CI pipeline  ' });

      expect(task).toMatchObject({
        title: 'Write CI pipeline',
        description: null,
        completed: false,
      });
      expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
      expect(service.getTask(task.id)).toEqual(task);
    });

    it('keeps optional description and completed fields', () => {
      const task = service.createTask({
        title: 'Configure Argo CD',
        description: ' sync from GitOps repo ',
        completed: true,
      });

      expect(task.description).toBe('sync from GitOps repo');
      expect(task.completed).toBe(true);
    });

    it('normalizes a blank description to null', () => {
      expect(service.createTask({ title: 'x', description: '   ' }).description).toBeNull();
    });

    it.each([
      ['missing title', {}],
      ['empty title', { title: '' }],
      ['whitespace-only title', { title: '   ' }],
      ['non-string title', { title: 42 }],
      ['null title', { title: null }],
      ['too long title', { title: 'a'.repeat(201) }],
    ])('rejects %s', (_label, payload) => {
      expect(() => service.createTask(payload)).toThrow(ValidationError);
      expect(service.listTasks()).toHaveLength(0);
    });

    it.each([
      ['null body', null],
      ['array body', [{ title: 'x' }]],
      ['string body', 'title'],
    ])('rejects a non-object payload (%s)', (_label, payload) => {
      expect(() => service.createTask(payload)).toThrow(ValidationError);
    });

    it('rejects invalid optional fields and unknown fields with all messages', () => {
      try {
        service.createTask({
          title: 'ok',
          description: 5,
          completed: 'yes',
          priority: 'high',
        });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).details).toEqual([
          'unknown field(s): priority',
          'description must be a string',
          'completed must be a boolean',
        ]);
      }
    });

    it('rejects a description that is too long', () => {
      expect(() => service.createTask({ title: 'x', description: 'd'.repeat(1001) })).toThrow(
        ValidationError,
      );
    });
  });

  describe('getTask', () => {
    it('returns undefined for a non-existent task', () => {
      expect(service.getTask('does-not-exist')).toBeUndefined();
    });
  });

  describe('listTasks', () => {
    it('returns created tasks in insertion order', () => {
      const first = service.createTask({ title: 'first' });
      const second = service.createTask({ title: 'second' });

      expect(service.listTasks()).toEqual([first, second]);
    });
  });
});
