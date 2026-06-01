import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/api/audit', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const logs = db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as n FROM audit_log`).get().n;
    res.json({ logs, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
