import { createLoadingSpinner } from './components.js';

const ACTION_ICONS = {
  'Ticket creado':     '🎟️',
  'Ticket actualizado':'✏️',
  'Mensaje enviado':   '💬',
  'Imagen enviada':    '🖼️',
};

export async function renderAudit(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Auditoría</h2>
        <p style="color:var(--text-3);font-size:13px;">Historial completo de acciones realizadas en el sistema.</p>
      </div>
    </div>
    <div class="card" style="padding:10px;">
      <div id="audit-container">${createLoadingSpinner()}</div>
    </div>
  `;

  async function loadAudit(offset = 0) {
    const auditContainer = document.getElementById('audit-container');
    if (!auditContainer) return;
    try {
      const res = await fetch(`/api/audit?limit=50&offset=${offset}`);
      const { logs, total } = await res.json();
      if (!logs.length) {
        auditContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);">No hay eventos registrados aún.</div>';
        return;
      }
      auditContainer.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Fecha</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Actor</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Acción</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Ticket</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => {
              const icon = ACTION_ICONS[log.action] || '📋';
              let detail = '';
              try {
                const d = JSON.parse(log.details || 'null');
                if (d) detail = Object.entries(d).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
              } catch {}
              return `
                <tr style="border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                  <td style="padding:10px 14px;font-size:12px;color:var(--text-3);white-space:nowrap;">${log.created_at}</td>
                  <td style="padding:10px 14px;font-size:13px;font-weight:500;">${log.actor}</td>
                  <td style="padding:10px 14px;font-size:13px;">${icon} ${log.action}</td>
                  <td style="padding:10px 14px;font-size:12px;">${log.entity_number ? `<a href="#ticket/${log.entity_id}" style="color:var(--primary);text-decoration:none;">${log.entity_number}</a>` : '—'}</td>
                  <td style="padding:10px 14px;font-size:12px;color:var(--text-3);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${detail || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="padding:14px;text-align:right;font-size:12px;color:var(--text-3);">${total} eventos totales</div>
      `;
    } catch (err) {
      console.error('[Audit]', err);
      auditContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);">Error al cargar el log de auditoría.</div>';
    }
  }

  loadAudit();
}
