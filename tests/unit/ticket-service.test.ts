import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors.js';
import {
  TicketService,
  parseTicketFilter,
  validateNewTicket,
  validateTicketChanges,
} from '../../src/services/ticket-service.js';
import { MemoryTicketRepository } from '../helpers/memory-ticket-repository.js';

function validationDetails(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    return (err as ValidationError).details ?? [];
  }
  throw new Error('expected a ValidationError');
}

describe('validateNewTicket', () => {
  it('normalizes input and defaults priority to medium', () => {
    expect(validateNewTicket({ title: '  VPN down  ', description: '  ' })).toEqual({
      title: 'VPN down',
      description: null,
      priority: 'medium',
    });
  });

  it('collects every validation error', () => {
    expect(
      validationDetails(() => validateNewTicket({ title: '', priority: 'urgent', owner: 'x' })),
    ).toEqual([
      'unknown field(s): owner',
      'title must not be empty',
      'priority must be one of: low, medium, high',
    ]);
  });

  it.each([
    ['non-object body', null],
    ['too long title', { title: 'a'.repeat(201) }],
    ['non-string description', { title: 'x', description: 1 }],
    ['too long description', { title: 'x', description: 'd'.repeat(2001) }],
  ])('rejects %s', (_label, payload) => {
    expect(() => validateNewTicket(payload)).toThrow(ValidationError);
  });
});

describe('validateTicketChanges', () => {
  it('accepts status and/or priority', () => {
    expect(validateTicketChanges({ status: 'resolved' })).toEqual({ status: 'resolved' });
    expect(validateTicketChanges({ priority: 'high', status: 'in_progress' })).toEqual({
      priority: 'high',
      status: 'in_progress',
    });
  });

  it.each([
    ['empty change', {}],
    ['invalid status', { status: 'closed' }],
    ['invalid priority', { priority: 'urgent' }],
    ['unknown field', { status: 'open', title: 'x' }],
    ['non-object body', 'open'],
  ])('rejects %s', (_label, payload) => {
    expect(() => validateTicketChanges(payload)).toThrow(ValidationError);
  });
});

describe('parseTicketFilter', () => {
  it('returns defaults for an empty query', () => {
    expect(parseTicketFilter({})).toEqual({ limit: 50 });
  });

  it('parses status, priority, search and limit', () => {
    expect(
      parseTicketFilter({ status: 'open', priority: 'low', q: '  printer ', limit: '10' }),
    ).toEqual({
      status: 'open',
      priority: 'low',
      search: 'printer',
      limit: 10,
    });
  });

  it('ignores empty values', () => {
    expect(parseTicketFilter({ status: '', q: '   ' })).toEqual({ limit: 50 });
  });

  it.each([
    ['invalid status', { status: 'done' }],
    ['invalid priority', { priority: 'p1' }],
    ['repeated parameter', { status: ['open', 'resolved'] }],
    ['too long search', { q: 'x'.repeat(101) }],
    ['non-numeric limit', { limit: 'ten' }],
    ['limit above maximum', { limit: '500' }],
  ])('rejects %s', (_label, query) => {
    expect(() => parseTicketFilter(query)).toThrow(ValidationError);
  });
});

describe('TicketService', () => {
  it('creates open tickets with matching timestamps', async () => {
    const service = new TicketService(new MemoryTicketRepository());

    const ticket = await service.createTicket({ title: 'Disk full', priority: 'high' });

    expect(ticket).toMatchObject({ title: 'Disk full', priority: 'high', status: 'open' });
    expect(ticket.createdAt).toBe(ticket.updatedAt);
    expect(await service.getTicket(ticket.id)).toEqual(ticket);
  });

  it('returns undefined when updating a missing ticket', async () => {
    const service = new TicketService(new MemoryTicketRepository());

    expect(await service.updateTicket('missing', { status: 'resolved' })).toBeUndefined();
  });
});
