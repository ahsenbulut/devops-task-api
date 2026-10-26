import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TaskService } from '../../src/services/task-service.js';
import { TicketService } from '../../src/services/ticket-service.js';
import { TicketStore } from '../../src/store/ticket-store.js';
import { createTestPool, resetTickets } from '../helpers/database.js';
import { MemoryTaskRepository } from '../helpers/memory-repository.js';

describe('tickets API (PostgreSQL)', () => {
  let pool: pg.Pool;
  let store: TicketStore;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    pool = await createTestPool();
    store = new TicketStore(pool);
    app = createApp({
      taskService: new TaskService(new MemoryTaskRepository()),
      ticketService: new TicketService(store),
      isReady: () => Promise.resolve(true),
    });
  });

  beforeEach(async () => {
    await resetTickets(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const titles = (res: request.Response) =>
    (res.body.data as { title: string }[]).map((t) => t.title);

  const create = async (body: Record<string, unknown>) => {
    const res = await request(app).post('/api/tickets').send(body);
    expect(res.status).toBe(201);
    return res.body.data as { id: string; updatedAt: string };
  };

  it('creates a ticket and stores it in PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ title: 'Printer offline', description: 'Floor 2', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/tickets/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      title: 'Printer offline',
      description: 'Floor 2',
      status: 'open',
      priority: 'high',
    });
    const row = await pool.query('SELECT status, priority FROM tickets WHERE id = $1', [
      res.body.data.id,
    ]);
    expect(row.rows).toEqual([{ status: 'open', priority: 'high' }]);
  });

  it('returns 400 with details for an invalid ticket', async () => {
    const res = await request(app).post('/api/tickets').send({ title: '', priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      'title must not be empty',
      'priority must be one of: low, medium, high',
    ]);
  });

  it('lists newest first and filters by status, priority and search text', async () => {
    const vpn = await create({
      title: 'VPN disconnects',
      description: 'Remote office',
      priority: 'high',
    });
    await create({ title: 'New laptop request', priority: 'low' });
    await create({
      title: 'Mailbox full',
      description: 'vpn unrelated? no, quota',
      priority: 'medium',
    });
    await request(app).patch(`/api/tickets/${vpn.id}`).send({ status: 'in_progress' });

    const all = await request(app).get('/api/tickets');
    expect(all.body.count).toBe(3);
    expect(all.body.data[0].title).toBe('Mailbox full');

    const inProgress = await request(app).get('/api/tickets?status=in_progress');
    expect(titles(inProgress)).toEqual(['VPN disconnects']);

    const low = await request(app).get('/api/tickets?priority=low');
    expect(titles(low)).toEqual(['New laptop request']);

    const search = await request(app).get('/api/tickets?q=VPN');
    expect(search.body.count).toBe(2);

    const limited = await request(app).get('/api/tickets?limit=1');
    expect(limited.body.count).toBe(1);
  });

  it('treats search wildcards as plain text', async () => {
    await create({ title: '100% CPU on build agent' });
    await create({ title: 'Password reset' });

    const res = await request(app).get('/api/tickets?q=%25');

    expect(titles(res)).toEqual(['100% CPU on build agent']);
  });

  it('returns 400 for invalid filters', async () => {
    const res = await request(app).get('/api/tickets?status=closed&limit=0');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveLength(2);
  });

  it('returns ticket details and 404 for unknown or malformed ids', async () => {
    const ticket = await create({ title: 'SSO login loop' });

    expect((await request(app).get(`/api/tickets/${ticket.id}`)).body.data.title).toBe(
      'SSO login loop',
    );
    expect(
      (await request(app).get('/api/tickets/00000000-0000-0000-0000-000000000000')).status,
    ).toBe(404);
    expect((await request(app).get('/api/tickets/not-a-uuid')).status).toBe(404);
  });

  it('updates status and priority and bumps updatedAt', async () => {
    const ticket = await create({ title: 'Slow dashboard' });

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .send({ status: 'resolved', priority: 'low' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'resolved', priority: 'low' });
    expect(new Date(res.body.data.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
      new Date(ticket.updatedAt).getTime(),
    );
  });

  it('returns 400 for invalid changes and 404 for missing tickets', async () => {
    const ticket = await create({ title: 'x' });

    expect(
      (await request(app).patch(`/api/tickets/${ticket.id}`).send({ status: 'closed' })).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch('/api/tickets/00000000-0000-0000-0000-000000000000')
          .send({ status: 'open' })
      ).status,
    ).toBe(404);
    expect((await request(app).patch('/api/tickets/nope').send({ status: 'open' })).status).toBe(
      404,
    );
  });

  it('returns dashboard stats with zero-filled buckets and recent activity', async () => {
    const first = await create({ title: 'A', priority: 'high' });
    await create({ title: 'B', priority: 'high' });
    await create({ title: 'C' });
    await request(app).patch(`/api/tickets/${first.id}`).send({ status: 'resolved' });

    const res = await request(app).get('/api/tickets/stats');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total: 3,
      byStatus: { open: 2, in_progress: 0, resolved: 1 },
      byPriority: { low: 0, medium: 1, high: 2 },
    });
    expect(res.body.data.recent[0].title).toBe('A');
  });

  it('reports readiness only when the tickets table exists', async () => {
    expect(await store.checkReady()).toBe(true);
  });
});
