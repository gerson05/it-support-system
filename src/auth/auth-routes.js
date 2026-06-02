import express from 'express';
import db from '../config/database.js';
import { verifyPassword, createSession, deleteSession } from './auth-service.js';
import { requireAuth } from './auth-middleware.js';

const router = express.Router();

const COOKIE = 'it_session';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };

router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const user = db.prepare(
    'SELECT id, password_hash, active, role_id FROM users WHERE username = ?'
  ).get(username);

  const valid = user && await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  if (!user.active) return res.status(403).json({ error: 'Cuenta desactivada. Contacta al equipo IT.' });

  const { token } = createSession(user.id);
  res.cookie(COOKIE, token, COOKIE_OPTS);

  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
  res.json({ ok: true, role: role.name });
});

router.post('/api/auth/logout', (req, res) => {
  const part = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='));
  if (part) deleteSession(decodeURIComponent(part.slice(COOKIE.length + 1)));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id:          req.user.id,
    username:    req.user.username,
    role:        req.user.role,
    permissions: req.permissions,
  });
});

export default router;
