import { Router } from 'express';
import { NotFoundError } from '../errors.js';
import type { TicketService } from '../services/ticket-service.js';

export function ticketsRouter(ticketService: TicketService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const tickets = await ticketService.listTickets(req.query);
    res.status(200).json({ data: tickets, count: tickets.length });
  });

  router.get('/stats', async (_req, res) => {
    res.status(200).json({ data: await ticketService.getStats() });
  });

  router.get('/:id', async (req, res) => {
    const ticket = await ticketService.getTicket(req.params.id);
    if (!ticket) {
      throw new NotFoundError(`Ticket with id '${req.params.id}' not found`);
    }
    res.status(200).json({ data: ticket });
  });

  router.post('/', async (req, res) => {
    const ticket = await ticketService.createTicket(req.body);
    res.status(201).location(`${req.baseUrl}/${ticket.id}`).json({ data: ticket });
  });

  router.patch('/:id', async (req, res) => {
    const ticket = await ticketService.updateTicket(req.params.id, req.body);
    if (!ticket) {
      throw new NotFoundError(`Ticket with id '${req.params.id}' not found`);
    }
    res.status(200).json({ data: ticket });
  });

  return router;
}
