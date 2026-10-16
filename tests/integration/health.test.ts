import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('health endpoints', () => {
  it('GET /health/live returns 200', async () => {
    const res = await request(createApp()).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 when ready', async () => {
    const res = await request(createApp()).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('GET /health/ready returns 503 when the instance is not ready (e.g. shutting down)', async () => {
    const res = await request(createApp({ isReady: () => false })).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready' });
  });
});
