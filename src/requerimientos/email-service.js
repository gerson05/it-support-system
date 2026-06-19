import nodemailer from 'nodemailer';

const TIPO_ABREV = {
  Locativo: 'LOC', Sistemas: 'SIS', Bodega: 'BOD',
  Calidad: 'CAL', Mantenimiento: 'MAN', Otro: 'OTR',
};
const PRIOR_EMOJI = { URGENTE: '🔴', ALTA: '🟠', NORMAL: '🟢' };
const DEST = 'gestion.medivallesf@gmail.com';

export async function sendReqEmail(data) {
  const { ticket_num, area, nombre, correo, punto, tipo,
          descripcion, fecha_requerida, observaciones, prioridad } = data;

  const user = process.env.REQ_GMAIL_USER;
  const pass = process.env.REQ_GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('REQ_GMAIL_USER / REQ_GMAIL_APP_PASSWORD no configurados');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const fechaHora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const abrev    = TIPO_ABREV[tipo]     || 'OTR';
  const emoji    = PRIOR_EMOJI[prioridad] || '🟢';
  const correoStr = correo ? ` — ${correo}` : '';

  const text = `📋 Nuevo Requerimiento — MEDIVALLE SF SAS

Ticket      ${ticket_num}
Área        ${area}
Solicitante ${nombre}${correoStr}
Tipo        ${abrev}
Punto       ${punto}
Prioridad   ${emoji} ${prioridad}
Fecha req.  ${fecha_requerida || '—'}

Descripción:
${descripcion}

Obs.: ${observaciones || '—'}

─────────────────────────────
Sistema de Requerimientos MEDIVALLE SF SAS · ${fechaHora}`;

  const html = `<pre style="font-family:monospace;font-size:13px;line-height:1.8;color:#111;background:#f8f9fa;padding:20px;border-radius:8px;border:1px solid #dee2e6;max-width:600px">${text}</pre>`;

  await transporter.sendMail({
    from: `"Requerimientos Medivalle" <${user}>`,
    to: DEST,
    subject: `📋 ${ticket_num} — ${tipo} | ${punto} | ${emoji} ${prioridad}`,
    text,
    html,
  });
}
