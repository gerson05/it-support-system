/**
 * Siguiente número de ticket del día (TK-YYYYMMDD-NNN).
 * Tiene en cuenta los tickets eliminados (registrados en auditoría) para no
 * reutilizar sus números.
 */
export async function nextTicketNumber(db) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like    = `TK-${dateStr}-%`;
  const seq     = (n) => parseInt(String(n || '').split('-')[2]) || 0;

  const last    = await db.prepare('SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const deleted = await db.prepare(
    `SELECT entity_number FROM audit_log WHERE action = 'Ticket eliminado' AND entity_number LIKE ?`
  ).all(like);

  const maxNum = Math.max(seq(last?.ticket_number), ...(deleted || []).map(d => seq(d.entity_number)));
  return `TK-${dateStr}-${String(maxNum + 1).padStart(3, '0')}`;
}
