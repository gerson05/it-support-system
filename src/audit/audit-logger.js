import db from '../config/database.js';

export function logAudit(actor, action, entityType = null, entityId = null, entityNumber = null, details = null) {
  try {
    db.prepare(`INSERT INTO audit_log (actor, action, entity_type, entity_id, entity_number, details) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(actor, action, entityType, entityId, entityNumber, details ? JSON.stringify(details) : null);
  } catch (e) {
    console.warn('[Audit] Error logging:', e.message);
  }
}
