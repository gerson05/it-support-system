import db from '../config/database.js';
import {
  getAllTickets,
  getTicketById,
  updateTicket,
  addMessage,
  addInternalNote,
} from './ticket-model.js';

export const ticketService = {
  getAll:      (filters) => getAllTickets(db, filters),
  getById:     (id)      => getTicketById(db, id),
  update:      (id, data) => updateTicket(db, id, data),
  addMessage:  (ticketId, type, name, content) => addMessage(db, ticketId, type, name, content),
  addNote:     (ticketId, agentId, agentName, content) => addInternalNote(db, ticketId, agentId, agentName, content),
};
