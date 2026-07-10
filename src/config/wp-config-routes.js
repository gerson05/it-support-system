import express from 'express';
import db from './database.js';
import { DEFAULTS, WP_MSG_LABELS } from '../whatsapp/chatbot-messages.js';

const router = express.Router();

/* GET /api/admin/wp-messages
   Devuelve todos los mensajes con su valor actual (DB o default) */
router.get('/api/admin/wp-messages', (req, res) => {
  const result = {};
  for (const key of Object.keys(DEFAULTS)) {
    let value = DEFAULTS[key];
    try {
      const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(`wp_msg_${key}`);
      if (row?.value) value = row.value;
    } catch {}
    result[key] = {
      key,
      label:    WP_MSG_LABELS[key]?.label  ?? key,
      vars:     WP_MSG_LABELS[key]?.vars   ?? [],
      default:  DEFAULTS[key],
      value,
      isCustom: value !== DEFAULTS[key],
    };
  }
  res.json(result);
});

/* PUT /api/admin/wp-messages/:key
   Guarda o actualiza el override de un mensaje */
router.put('/api/admin/wp-messages/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!DEFAULTS.hasOwnProperty(key)) return res.status(404).json({ error: 'Mensaje no existe' });
  if (typeof value !== 'string' || !value.trim()) return res.status(400).json({ error: 'Valor inválido' });

  db.prepare(`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(`wp_msg_${key}`, value.trim());

  res.json({ ok: true, key, value: value.trim() });
});

/* DELETE /api/admin/wp-messages/:key
   Restaura el mensaje a su valor por defecto */
router.delete('/api/admin/wp-messages/:key', (req, res) => {
  const { key } = req.params;
  if (!DEFAULTS.hasOwnProperty(key)) return res.status(404).json({ error: 'Mensaje no existe' });
  db.prepare('DELETE FROM app_config WHERE key = ?').run(`wp_msg_${key}`);
  res.json({ ok: true, key, value: DEFAULTS[key] });
});

export default router;
