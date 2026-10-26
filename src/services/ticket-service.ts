import { randomUUID } from 'node:crypto';
import { ValidationError } from '../errors.js';
import {
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_LIST_DEFAULT_LIMIT,
  TICKET_LIST_MAX_LIMIT,
  TICKET_PRIORITIES,
  TICKET_SEARCH_MAX_LENGTH,
  TICKET_STATUSES,
  TICKET_TITLE_MAX_LENGTH,
  type Ticket,
  type TicketChanges,
  type TicketFilter,
  type TicketPriority,
  type TicketStats,
  type TicketStatus,
} from '../models/ticket.js';
import type { TicketRepository } from '../store/ticket-store.js';

const RECENT_ACTIVITY_LIMIT = 5;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is TicketPriority {
  return typeof value === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

function rejectUnknownFields(
  payload: Record<string, unknown>,
  allowed: readonly string[],
  errors: string[],
) {
  const unknown = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    errors.push(`unknown field(s): ${unknown.join(', ')}`);
  }
}

export function validateNewTicket(payload: unknown) {
  if (!isPlainObject(payload)) {
    throw new ValidationError(['request body must be a JSON object']);
  }
  const errors: string[] = [];
  rejectUnknownFields(payload, ['title', 'description', 'priority'], errors);
  const { title, description, priority } = payload;

  let normalizedTitle = '';
  if (typeof title !== 'string') {
    errors.push('title is required and must be a string');
  } else {
    normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      errors.push('title must not be empty');
    } else if (normalizedTitle.length > TICKET_TITLE_MAX_LENGTH) {
      errors.push(`title must be at most ${TICKET_TITLE_MAX_LENGTH} characters`);
    }
  }

  let normalizedDescription: string | null = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push('description must be a string');
    } else if (description.trim().length > TICKET_DESCRIPTION_MAX_LENGTH) {
      errors.push(`description must be at most ${TICKET_DESCRIPTION_MAX_LENGTH} characters`);
    } else {
      normalizedDescription = description.trim() || null;
    }
  }

  if (priority !== undefined && !isPriority(priority)) {
    errors.push(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return {
    title: normalizedTitle,
    description: normalizedDescription,
    priority: isPriority(priority) ? priority : 'medium',
  };
}

export function validateTicketChanges(payload: unknown): TicketChanges {
  if (!isPlainObject(payload)) {
    throw new ValidationError(['request body must be a JSON object']);
  }
  const errors: string[] = [];
  rejectUnknownFields(payload, ['status', 'priority'], errors);
  const { status, priority } = payload;
  if (status === undefined && priority === undefined) {
    errors.push('at least one of status or priority is required');
  }
  if (status !== undefined && !isStatus(status)) {
    errors.push(`status must be one of: ${TICKET_STATUSES.join(', ')}`);
  }
  if (priority !== undefined && !isPriority(priority)) {
    errors.push(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`);
  }
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return {
    ...(isStatus(status) ? { status } : {}),
    ...(isPriority(priority) ? { priority } : {}),
  };
}

export function parseTicketFilter(query: Record<string, unknown>): TicketFilter {
  const errors: string[] = [];
  const single = (key: string): string | undefined => {
    const value = query[key];
    if (value === undefined || value === '') {
      return undefined;
    }
    if (typeof value !== 'string') {
      errors.push(`${key} must be given once`);
      return undefined;
    }
    return value;
  };

  const status = single('status');
  const priority = single('priority');
  const search = single('q')?.trim();
  const limitRaw = single('limit');

  if (status !== undefined && !isStatus(status)) {
    errors.push(`status must be one of: ${TICKET_STATUSES.join(', ')}`);
  }
  if (priority !== undefined && !isPriority(priority)) {
    errors.push(`priority must be one of: ${TICKET_PRIORITIES.join(', ')}`);
  }
  if (search !== undefined && search.length > TICKET_SEARCH_MAX_LENGTH) {
    errors.push(`q must be at most ${TICKET_SEARCH_MAX_LENGTH} characters`);
  }
  let limit = TICKET_LIST_DEFAULT_LIMIT;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > TICKET_LIST_MAX_LIMIT) {
      errors.push(`limit must be an integer between 1 and ${TICKET_LIST_MAX_LIMIT}`);
    }
  }
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return {
    ...(isStatus(status) ? { status } : {}),
    ...(isPriority(priority) ? { priority } : {}),
    ...(search ? { search } : {}),
    limit,
  };
}

export class TicketService {
  constructor(private readonly store: TicketRepository) {}

  listTickets(query: Record<string, unknown>): Promise<Ticket[]> {
    return this.store.list(parseTicketFilter(query));
  }

  getTicket(id: string): Promise<Ticket | undefined> {
    return this.store.get(id);
  }

  createTicket(payload: unknown): Promise<Ticket> {
    const input = validateNewTicket(payload);
    const now = new Date().toISOString();
    return this.store.create({
      id: randomUUID(),
      ...input,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  updateTicket(id: string, payload: unknown): Promise<Ticket | undefined> {
    return this.store.update(id, validateTicketChanges(payload));
  }

  getStats(): Promise<TicketStats> {
    return this.store.stats(RECENT_ACTIVITY_LIMIT);
  }
}
