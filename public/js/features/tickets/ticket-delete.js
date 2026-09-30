import { showToast } from '../../ui/components.js';
import { escapeHtml } from '../../utils/sanitize.js';

/**
 * Diálogo de eliminación con doble confirmación: el usuario debe escribir el
 * número exacto del ticket para habilitar el botón. El servidor vuelve a validar.
 */
export function openDeleteTicketModal(ticket) {
  const number = ticket.ticket_number;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'z-index:10003;';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:440px;" role="dialog" aria-modal="true" aria-labelledby="del-ticket-title">
      <div class="modal-header">
        <h3 id="del-ticket-title" style="color:#f87171;">Eliminar ticket</h3>
        <button class="modal-close" id="del-ticket-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5;">
        <p style="margin:0;">
          Vas a eliminar <strong>${escapeHtml(number)}</strong> de
          <strong>${escapeHtml(ticket.requester_name || 'Sin nombre')}</strong>.
        </p>
        <p style="margin:0;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#fca5a5;">
          Se borrarán definitivamente la conversación, las notas internas y el análisis IA.
          <strong>Esta acción no se puede deshacer.</strong> Quedará registrada en Auditoría.
        </p>
        <label for="del-ticket-input" style="margin:0;">
          Para confirmar, escribe <code style="user-select:all;">${escapeHtml(number)}</code>
        </label>
        <input id="del-ticket-input" type="text" autocomplete="off" spellcheck="false"
          placeholder="${escapeHtml(number)}"
          style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text);font-family:monospace;">
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="del-ticket-cancel">Cancelar</button>
        <button class="btn btn-danger" id="del-ticket-confirm" disabled>Eliminar definitivamente</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#del-ticket-input');
  const confirm = overlay.querySelector('#del-ticket-confirm');
  const close   = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey   = (e) => { if (e.key === 'Escape') close(); };
  const matches = () => input.value.trim().toUpperCase() === number;

  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#del-ticket-close').addEventListener('click', close);
  overlay.querySelector('#del-ticket-cancel').addEventListener('click', close);
  input.addEventListener('input', () => { confirm.disabled = !matches(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && matches()) confirm.click(); });
  // Sin pegar: escribir el número a mano obliga a leer qué ticket se borra
  input.addEventListener('paste', (e) => e.preventDefault());

  confirm.addEventListener('click', async () => {
    if (!matches()) return;
    confirm.disabled = true;
    confirm.textContent = 'Eliminando…';
    // Evita que el aviso en tiempo real (SSE) duplique el mensaje para quien borra
    window.__deletingTicketId = ticket.id;
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: input.value.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      close();
      showToast(`Ticket ${number} eliminado.`, 'success');
      window.location.hash = '#tickets';
    } catch (err) {
      window.__deletingTicketId = null;
      showToast(`No se pudo eliminar: ${err.message}`, 'error');
      confirm.disabled = !matches();
      confirm.textContent = 'Eliminar definitivamente';
    }
  });

  input.focus();
}
