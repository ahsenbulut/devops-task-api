import type pg from 'pg';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Ticket,
  type TicketChanges,
  type TicketFilter,
  type TicketPriority,
  type TicketStats,
  type TicketStatus,
} from '../models/ticket.js';

export interface TicketRepository {
  list(filter: TicketFilter): Promise<Ticket[]>;
  get(id: string): Promise<Ticket | undefined>;
  create(ticket: Ticket): Promise<Ticket>;
  update(id: string, changes: TicketChanges): Promise<Ticket | undefined>;
  stats(recentLimit: number): Promise<TicketStats>;
}

interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, title, description, status, priority, created_at, updated_at';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class TicketStore implements TicketRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(filter: TicketFilter): Promise<Ticket[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    if (filter.priority) {
      values.push(filter.priority);
      conditions.push(`priority = $${values.length}`);
    }
    if (filter.search) {
      values.push(filter.search.toLowerCase());
      conditions.push(
        `(strpos(lower(title), $${values.length}) > 0 OR strpos(lower(coalesce(description, '')), $${values.length}) > 0)`,
      );
    }
    values.push(filter.limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query<TicketRow>(
      `SELECT ${COLUMNS} FROM tickets ${where} ORDER BY created_at DESC, id LIMIT $${values.length}`,
      values,
    );
    return result.rows.map(toTicket);
  }

  async get(id: string): Promise<Ticket | undefined> {
    if (!UUID_PATTERN.test(id)) {
      return undefined;
    }
    const result = await this.pool.query<TicketRow>(
      `SELECT ${COLUMNS} FROM tickets WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toTicket(row) : undefined;
  }

  async create(ticket: Ticket): Promise<Ticket> {
    await this.pool.query(`INSERT INTO tickets (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
      ticket.id,
      ticket.title,
      ticket.description,
      ticket.status,
      ticket.priority,
      ticket.createdAt,
      ticket.updatedAt,
    ]);
    return ticket;
  }

  async update(id: string, changes: TicketChanges): Promise<Ticket | undefined> {
    if (!UUID_PATTERN.test(id)) {
      return undefined;
    }
    const result = await this.pool.query<TicketRow>(
      `UPDATE tickets
          SET status = COALESCE($2, status), priority = COALESCE($3, priority), updated_at = now()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, changes.status ?? null, changes.priority ?? null],
    );
    const row = result.rows[0];
    return row ? toTicket(row) : undefined;
  }

  async stats(recentLimit: number): Promise<TicketStats> {
    const [counts, recent] = await Promise.all([
      this.pool.query<{ status: TicketStatus; priority: TicketPriority; count: string }>(
        'SELECT status, priority, count(*) AS count FROM tickets GROUP BY status, priority',
      ),
      this.pool.query<TicketRow>(
        `SELECT ${COLUMNS} FROM tickets ORDER BY updated_at DESC, id LIMIT $1`,
        [recentLimit],
      ),
    ]);
    const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<
      TicketStatus,
      number
    >;
    const byPriority = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<
      TicketPriority,
      number
    >;
    let total = 0;
    for (const row of counts.rows) {
      const count = Number(row.count);
      byStatus[row.status] += count;
      byPriority[row.priority] += count;
      total += count;
    }
    return { total, byStatus, byPriority, recent: recent.rows.map(toTicket) };
  }

  async checkReady(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1 FROM tickets LIMIT 0');
      return true;
    } catch {
      return false;
    }
  }
}
