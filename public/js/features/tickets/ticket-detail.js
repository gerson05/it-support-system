import { createLoadingSpinner } from '../../ui/components.js';
import { fetchTicket } from './ticket-data.js';
import { renderLayout, renderMessages, renderNotes } from './ticket-render.js';
import { bindAllEvents } from './ticket-events.js';

export async function renderTicketDetail(container, ticketId) {
  container.innerHTML = createLoadingSpinner();

  async function reload() {
    try {
      const ticket = await fetchTicket(ticketId);

      container.innerHTML = renderLayout(ticket);

      const messagesContainer = document.getElementById('timeline-messages-container');
      if (messagesContainer) {
        messagesContainer.innerHTML = renderMessages(ticket.messages, ticket.requester_name);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      const notesContainer = document.getElementById('notes-list-container');
      if (notesContainer) {
        notesContainer.innerHTML = renderNotes(ticket.notes);
        notesContainer.scrollTop = notesContainer.scrollHeight;
      }

      await bindAllEvents({ ticketId, ticket, reload });
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="card" style="padding: 40px; text-align: center; color: var(--text-muted);">
          <p style="font-size: 16px; margin-bottom: 15px;">Fallo al cargar el detalle del ticket ${ticketId}. Puede que no exista o haya un problema con el servidor.</p>
          <a href="#tickets" class="btn btn-secondary">Regresar a tickets</a>
        </div>
      `;
    }
  }

  await reload();
}
