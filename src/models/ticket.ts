export const TICKET_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  search?: string;
  limit: number;
}

export interface TicketChanges {
  status?: TicketStatus;
  priority?: TicketPriority;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  recent: Ticket[];
}

export const TICKET_TITLE_MAX_LENGTH = 200;
export const TICKET_DESCRIPTION_MAX_LENGTH = 2000;
export const TICKET_SEARCH_MAX_LENGTH = 100;
export const TICKET_LIST_DEFAULT_LIMIT = 50;
export const TICKET_LIST_MAX_LIMIT = 200;
