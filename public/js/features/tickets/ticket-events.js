import { state } from '../../core/app.js';
import { showToast } from '../../ui/components.js';
import DataService from '../../core/api.js';
import { createEmpleadoSearch } from '../../core/empleado-search.js';
import { openEmpleadoPerfil } from '../../core/cedula-lookup.js';
import { openFaqFromTicket } from '../herramientas/faqs.js';
import { initAiTab } from './ticket-ai-panel.js';
import { fetchAgents } from './ticket-data.js';

export function bindWaBanner() {
  function updateWaBanner(connected) {
    const banner = document.getElementById('wa-status-banner');
    if (banner) banner.style.display = connected ? 'none' : 'block';
  }
  fetch('/api/whatsapp/status').then(r => r.json()).then(s => updateWaBanner(s.connected)).catch(() => {});
  const _waPoll = setInterval(() => {
    fetch('/api/whatsapp/status').then(r => r.json()).then(s => updateWaBanner(s.connected)).catch(() => {});
  }, 8000);
  window.addEventListener('hashchange', () => clearInterval(_waPoll), { once: true });
}

export function bindReplyForm(ticketId, reload) {
  const replyForm = document.getElementById('reply-form');
  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('reply-input');
    const content = input.value;
    try {
      const result = await DataService.addMessage(ticketId, 'agent', state.currentUser?.username || 'IT', content);
      input.value = '';
      if (result?.whatsapp?.simulation) {
        showToast('Mensaje guardado, pero WhatsApp no está conectado — no se envió al empleado.', 'warning');
      } else if (result?.whatsapp?.success === false) {
        showToast('Mensaje guardado, pero falló el envío a WhatsApp: ' + (result.whatsapp.error || 'error desconocido'), 'warning');
      } else {
        showToast('Respuesta enviada al WhatsApp del empleado.', 'success');
      }
      await reload();
    } catch (err) {
      console.error(err);
      showToast('Fallo al enviar la respuesta al usuario.', 'error');
    }
  });
}

export function bindNoteForm(ticketId, reload) {
  const noteForm = document.getElementById('note-form');
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('note-input');
    const content = input.value;
    try {
      await DataService.addInternalNote(ticketId, state.currentUser?.id, state.currentUser?.username || 'IT', content);
      input.value = '';
      showToast('Nota interna registrada.', 'success');
      await reload();
    } catch (err) {
      console.error(err);
      showToast('Fallo al agregar nota.', 'error');
    }
  });
}

export function bindSaveActions(ticketId, reload) {
  const btnSave = document.getElementById('btn-save-actions');
  btnSave.addEventListener('click', async () => {
    const status = document.getElementById('change-status').value;
    const priority = document.getElementById('change-priority').value;
    try {
      await DataService.updateTicket(ticketId, { status, priority });
      showToast('Cambios del ticket guardados exitosamente.', 'success');
      await reload();
    } catch (err) {
      console.error(err);
      showToast('Fallo al aplicar cambios al ticket.', 'error');
    }
  });
}

export async function bindTechnicianAssign(ticketId, ticket, reload) {
  const techNameInput   = document.getElementById('assign-tecnico-name');
  const techCedulaInput = document.getElementById('assign-tecnico-cedula');
  const btnAssign       = document.getElementById('btn-assign-tecnico');

  if (!techNameInput) return;

  if (ticket.assigned_to) {
    const agents = await fetchAgents();
    const cur = agents.find(a => a.id === ticket.assigned_to);
    if (cur) techNameInput.value = cur.name;
  }

  createEmpleadoSearch(techNameInput, techCedulaInput, {
    onSelect: () => { if (btnAssign) btnAssign.disabled = false; }
  });

  btnAssign?.addEventListener('click', async () => {
    const nombre = techNameInput.value.trim();
    const cedula = techCedulaInput?.value.trim();
    if (!nombre || !cedula) return;
    btnAssign.disabled = true;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, cedula, agentName: state.currentUser?.username || 'Agente' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`Ticket asignado a ${nombre}`, 'success');
      await reload();
    } catch (err) {
      showToast(err.message || 'Error al asignar técnico', 'error');
      btnAssign.disabled = false;
    }
  });
}

export function bindRequesterEdit(ticketId, ticket, reload) {
  const btnEditReq   = document.getElementById('btn-edit-requester');
  const editForm     = document.getElementById('requester-edit-form');
  const reqNameInput = document.getElementById('requester-name-input');
  const reqCedInput  = document.getElementById('requester-cedula-input');

  btnEditReq?.addEventListener('click', () => {
    editForm.style.display = 'flex';
    reqNameInput.value = ticket.requester_name || '';
    reqCedInput.value  = '';
    btnEditReq.style.display = 'none';
    createEmpleadoSearch(reqNameInput, reqCedInput);
    reqNameInput.focus();
  });

  document.getElementById('btn-cancel-requester')?.addEventListener('click', () => {
    editForm.style.display = 'none';
    btnEditReq.style.display = '';
  });

  document.getElementById('btn-ver-perfil')?.addEventListener('click', async () => {
    const res = await fetch(`/api/erp/empleados?q=${encodeURIComponent(ticket.requester_name || '')}`).then(r => r.json()).catch(() => []);
    const cedula = res[0]?.cedula;
    if (cedula) openEmpleadoPerfil(cedula);
  });

  document.getElementById('btn-save-requester')?.addEventListener('click', async () => {
    const newName = reqNameInput.value.trim();
    if (!newName) { showToast('El nombre es requerido', 'error'); return; }
    try {
      const res = await fetch(`/api/tickets/${ticketId}/requester`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_name: newName,
          cedula: reqCedInput.value.trim() || undefined,
          agentName: state.currentUser?.username || 'Agente',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Solicitante actualizado', 'success');
      await reload();
    } catch (err) {
      showToast(err.message || 'Error al actualizar', 'error');
    }
  });
}

export function bindImageUpload(ticketId, reload) {
  const imageInput = document.getElementById('image-input');
  const previewContainer = document.getElementById('image-preview-container');
  let selectedImageBase64 = null;
  let selectedMimetype = 'image/jpeg';

  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    selectedMimetype = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      selectedImageBase64 = dataUrl.split(',')[1];
      document.getElementById('image-preview').src = dataUrl;
      previewContainer.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-cancel-image')?.addEventListener('click', () => {
    selectedImageBase64 = null;
    previewContainer.style.display = 'none';
    if (imageInput) imageInput.value = '';
  });

  document.getElementById('btn-send-image')?.addEventListener('click', async () => {
    if (!selectedImageBase64) return;
    const caption = document.getElementById('image-caption')?.value.trim() || '';
    const btn = document.getElementById('btn-send-image');
    btn.textContent = 'Enviando…';
    btn.disabled = true;
    try {
      const res = await fetch(`/api/tickets/${ticketId}/send-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: selectedImageBase64,
          mimetype: selectedMimetype,
          caption,
          agentName: state.currentUser?.username || 'IT',
        }),
      });
      if (!res.ok) {
        let errMsg = 'Error al enviar la imagen.';
        try { errMsg = (await res.json()).error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      showToast('Imagen enviada al WhatsApp del empleado.', 'success');
      selectedImageBase64 = null;
      previewContainer.style.display = 'none';
      if (imageInput) imageInput.value = '';
      await reload();
    } catch (err) {
      showToast(err.message || 'Error al enviar la imagen.', 'error');
      btn.textContent = 'Enviar imagen';
      btn.disabled = false;
    }
  });
}

export function bindFaqButton(ticket) {
  document.getElementById('btn-add-to-faq')?.addEventListener('click', () => {
    const agentMessages = (ticket.messages || [])
      .filter(m => m.sender_type === 'agent')
      .map(m => m.content)
      .join('\n\n');
    openFaqFromTicket(ticket.description || '', agentMessages);
    showToast('Abriendo editor de FAQ con los datos del ticket...', 'info');
  });
}

export function bindTabs(ticket) {
  let _aiTabInitialized = false;
  window.switchTab = function(tab) {
    const conv    = document.getElementById('tab-panel-conv');
    const ai      = document.getElementById('tab-panel-ai');
    const btnConv = document.getElementById('tab-btn-conv');
    const btnAi   = document.getElementById('tab-btn-ai');
    if (!conv || !ai) return;

    if (tab === 'conv') {
      conv.style.display = '';
      ai.style.display   = 'none';
      btnConv.style.color = 'var(--primary,#60a5fa)';
      btnConv.style.borderBottomColor = 'var(--primary,#3b82f6)';
      btnAi.style.color = 'var(--text-muted,#94a3b8)';
      btnAi.style.borderBottomColor = 'transparent';
    } else {
      conv.style.display = 'none';
      ai.style.display   = '';
      btnAi.style.color = 'var(--primary,#60a5fa)';
      btnAi.style.borderBottomColor = 'var(--primary,#3b82f6)';
      btnConv.style.color = 'var(--text-muted,#94a3b8)';
      btnConv.style.borderBottomColor = 'transparent';
      if (!_aiTabInitialized) {
        _aiTabInitialized = true;
        initAiTab(ticket);
      }
    }
  };
}

export async function bindAllEvents({ ticketId, ticket, reload }) {
  bindWaBanner();
  bindReplyForm(ticketId, reload);
  bindNoteForm(ticketId, reload);
  bindSaveActions(ticketId, reload);
  await bindTechnicianAssign(ticketId, ticket, reload);
  bindRequesterEdit(ticketId, ticket, reload);
  bindImageUpload(ticketId, reload);
  bindFaqButton(ticket);
  bindTabs(ticket);
}
