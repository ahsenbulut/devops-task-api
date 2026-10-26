import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Ticket,
  type TicketChanges,
  type TicketFilter,
  type TicketPriority,
  type TicketStats,
  type TicketStatus,
} from '../../src/models/ticket.js';
import type { TicketRepository } from '../../src/store/ticket-store.js';

export class MemoryTicketRepository implements TicketRepository {
  readonly tickets = new Map<string, Ticket>();

  list(filter: TicketFilter): Promise<Ticket[]> {
    const search = filter.search?.toLowerCase();
    return Promise.resolve(
      [...this.tickets.values()]
        .filter((t) => !filter.status || t.status === filter.status)
        .filter((t) => !filter.priority || t.priority === filter.priority)
        .filter(
          (t) =>
            !search ||
            t.title.toLowerCase().includes(search) ||
            (t.description ?? '').toLowerCase().includes(search),
        )
        .slice(0, filter.limit),
    );
  }

  get(id: string): Promise<Ticket | undefined> {
    return Promise.resolve(this.tickets.get(id));
  }

  create(ticket: Ticket): Promise<Ticket> {
    this.tickets.set(ticket.id, ticket);
    return Promise.resolve(ticket);
  }

  update(id: string, changes: TicketChanges): Promise<Ticket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) {
      return Promise.resolve(undefined);
    }
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    this.tickets.set(id, updated);
    return Promise.resolve(updated);
  }

  stats(recentLimit: number): Promise<TicketStats> {
    const all = [...this.tickets.values()];
    const count = <K extends string>(keys: readonly K[], pick: (t: Ticket) => K) =>
      Object.fromEntries(keys.map((k) => [k, all.filter((t) => pick(t) === k).length])) as Record<
        K,
        number
      >;
    return Promise.resolve({
      total: all.length,
      byStatus: count<TicketStatus>(TICKET_STATUSES, (t) => t.status),
      byPriority: count<TicketPriority>(TICKET_PRIORITIES, (t) => t.priority),
      recent: all.slice(0, recentLimit),
    });
  }
}
