import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TaskService } from '../../src/services/task-service.js';
import { TicketService } from '../../src/services/ticket-service.js';
import { MemoryTaskRepository } from '../helpers/memory-repository.js';
import { MemoryTicketRepository } from '../helpers/memory-ticket-repository.js';

describe('GET /metrics', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({
      taskService: new TaskService(new MemoryTaskRepository()),
      ticketService: new TicketService(new MemoryTicketRepository()),
      isReady: () => Promise.resolve(true),
    });
  });

  it('exposes Prometheus text format with Node.js process metrics', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('nodejs_heap_size_used_bytes');
  });

  it('counts requests by method, route template and status code', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'metrics' });
    await request(app).get(`/api/tasks/${created.body.data.id}`);
    await request(app).get('/api/tasks/00000000-0000-0000-0000-000000000000');
    await request(app).post('/api/tasks').send({ title: '' });

    const res = await request(app).get('/metrics');

    expect(res.text).toContain(
      'http_requests_total{method="POST",route="/api/tasks/",status_code="201"} 1',
    );
    expect(res.text).toContain(
      'http_requests_total{method="POST",route="/api/tasks/",status_code="400"} 1',
    );
    expect(res.text).toContain(
      'http_requests_total{method="GET",route="/api/tasks/:id",status_code="200"} 1',
    );
    expect(res.text).toContain(
      'http_requests_total{method="GET",route="/api/tasks/:id",status_code="404"} 1',
    );
    expect(res.text).not.toContain(created.body.data.id);
    expect(res.text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="\/api\/tasks\/:id",status_code="200"\} 1/,
    );
  });

  it('groups unknown URLs under a single "unmatched" route', async () => {
    await request(app).get('/random/a');
    await request(app).get('/random/b');

    const res = await request(app).get('/metrics');

    expect(res.text).toContain(
      'http_requests_total{method="GET",route="unmatched",status_code="404"} 2',
    );
    expect(res.text).not.toContain('/random/');
  });

  it('does not count health checks or metric scrapes', async () => {
    await request(app).get('/health/live');
    await request(app).get('/health/ready');
    await request(app).get('/metrics');

    const res = await request(app).get('/metrics');

    expect(res.text).not.toMatch(/http_requests_total\{[^}]*route="\/(health|metrics)/);
  });
});
