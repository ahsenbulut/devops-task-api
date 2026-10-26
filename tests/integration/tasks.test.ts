import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TaskService } from '../../src/services/task-service.js';
import { TicketService } from '../../src/services/ticket-service.js';
import { TaskStore } from '../../src/store/task-store.js';
import { createTestPool, resetTasks } from '../helpers/database.js';
import { MemoryTicketRepository } from '../helpers/memory-ticket-repository.js';

describe('tasks API (PostgreSQL)', () => {
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    pool = await createTestPool();
    app = createApp({
      taskService: new TaskService(new TaskStore(pool)),
      ticketService: new TicketService(new MemoryTicketRepository()),
      isReady: () => Promise.resolve(true),
    });
  });

  beforeEach(async () => {
    await resetTasks(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/tasks', () => {
    it('returns 200 with an empty list initially', async () => {
      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ data: [], count: 0 });
    });

    it('returns created tasks', async () => {
      await request(app).post('/api/tasks').send({ title: 'one' });
      await request(app).post('/api/tasks').send({ title: 'two' });

      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('POST /api/tasks', () => {
    it('returns 201 and persists the task in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Set up GitHub Actions', description: 'CI pipeline' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Set up GitHub Actions',
        description: 'CI pipeline',
        completed: false,
      });
      expect(res.headers.location).toBe(`/api/tasks/${res.body.data.id}`);

      const row = await pool.query(
        'SELECT title, description, completed FROM tasks WHERE id = $1',
        [res.body.data.id],
      );
      expect(row.rows).toEqual([
        { title: 'Set up GitHub Actions', description: 'CI pipeline', completed: false },
      ]);
    });

    it('returns 400 with validation details for an invalid payload', async () => {
      const res = await request(app).post('/api/tasks').send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: { message: 'Validation failed', details: ['title must not be empty'] },
      });
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title":');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBeTypeOf('string');
    });

    it('returns 400 when no JSON body is sent', async () => {
      const res = await request(app).post('/api/tasks');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns 200 and the task for an existing id', async () => {
      const created = await request(app).post('/api/tasks').send({ title: 'find me' });

      const res = await request(app).get(`/api/tasks/${created.body.data.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(created.body.data);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).get('/api/tasks/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/);
    });

    it('returns 404 (not 500) for an id that is not a UUID', async () => {
      const res = await request(app).get('/api/tasks/does-not-exist');

      expect(res.status).toBe(404);
    });
  });

  describe('error handling', () => {
    it('returns 404 JSON for unknown routes', async () => {
      const res = await request(app).get('/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Route GET /does-not-exist not found' } });
    });

    it('returns 500 without leaking internals for unexpected errors', async () => {
      class FailingService extends TaskService {
        override listTasks(): never {
          throw new Error('boom: secret detail');
        }
      }
      const failingApp = createApp({
        taskService: new FailingService(new TaskStore(pool)),
        ticketService: new TicketService(new MemoryTicketRepository()),
        isReady: () => Promise.resolve(true),
      });

      const res = await request(failingApp).get('/api/tasks');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { message: 'Internal server error' } });
    });
  });
});
