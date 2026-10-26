import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logger } from '../../src/logger.js';
import { TaskService } from '../../src/services/task-service.js';
import { TicketService } from '../../src/services/ticket-service.js';
import { MemoryTaskRepository } from '../helpers/memory-repository.js';
import { MemoryTicketRepository } from '../helpers/memory-ticket-repository.js';

const app = () =>
  createApp({
    taskService: new TaskService(new MemoryTaskRepository()),
    ticketService: new TicketService(new MemoryTicketRepository()),
    isReady: () => Promise.resolve(true),
  });

describe('request logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs route template, status and request id without query string or body', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    const res = await request(app())
      .post('/api/tickets?q=secret-search')
      .set('X-Request-Id', 'client-req-12345')
      .send({ title: 'top secret title' });

    expect(res.headers['x-request-id']).toBe('client-req-12345');
    expect(info).toHaveBeenCalledWith('request completed', {
      requestId: 'client-req-12345',
      method: 'POST',
      route: '/api/tickets/',
      path: '/api/tickets',
      status: 201,
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/secret/);
  });

  it('generates a request id when the incoming one is missing or invalid', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    const res = await request(app())
      .get('/api/tickets/stats')
      .set('X-Request-Id', 'bad id with spaces');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
