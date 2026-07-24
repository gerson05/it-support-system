import DataService from '../../core/api.js';

export async function fetchTicket(ticketId) {
  const ticket = await DataService.getTicketById(ticketId);
  if (!ticket) throw new Error('Ticket no encontrado');
  return ticket;
}

export async function fetchAgents() {
  return DataService.getAgents().catch(() => []);
}
