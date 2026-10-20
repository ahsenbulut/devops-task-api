import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TaskService } from '../../src/services/task-service.js';
import { TaskStore } from '../../src/store/task-store.js';
import { createTestPool } from '../helpers/database.js';

describe('health endpoints', () => {
  let pool: pg.Pool;
  let store: TaskStore;

  beforeAll(async () => {
    pool = await createTestPool();
    store = new TaskStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const app = (isReady: () => Promise<boolean>) =>
    createApp({ taskService: new TaskService(store), isReady });

  it('GET /health/live returns 200', async () => {
    const res = await request(app(() => store.checkReady())).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 when the database and tasks table are reachable', async () => {
    const res = await request(app(() => store.checkReady())).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('GET /health/ready returns 503 when the database is unreachable', async () => {
    const unreachable = new pg.Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 500 });
    const unreachableStore = new TaskStore(unreachable);

    const res = await request(app(() => unreachableStore.checkReady())).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready' });
    await unreachable.end();
  });

  it('GET /health/ready returns 503 while shutting down', async () => {
    const res = await request(app(() => Promise.resolve(false))).get('/health/ready');

    expect(res.status).toBe(503);
  });
});
