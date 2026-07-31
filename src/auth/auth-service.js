import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/database.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

// In-memory cache: avoids 3 synchronous DB queries per request on mobile.
// Entries expire after 30 s; logout invalidates immediately.
const _sessionCache = new Map(); // token → { user, userId, ttl }
const SESSION_CACHE_TTL = 30_000;

export async function getSession(token) {
  if (!token) return null;

  const now = Date.now();
  const cached = _sessionCache.get(token);
  if (cached && cached.ttl > now) return cached.user;

  const session = await db.prepare(
    `SELECT s.user_id, s.expires_at, u.username, u.active, u.role_id,
            r.name AS role_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  ).get(token);

  if (!session || !session.active) {
    _sessionCache.delete(token);
    return null;
  }

  const permissions = (await db.prepare(
    `SELECT p.name FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`
  ).all(session.role_id)).map(p => p.name);

  // Sliding window — extender sesión 8h más en cada uso
  const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);

  const user = {
    id:          session.user_id,
    username:    session.username,
    role:        session.role_name,
    permissions,
  };
  _sessionCache.set(token, { user, userId: session.user_id, ttl: now + SESSION_CACHE_TTL });
  return user;
}

export async function deleteSession(token) {
  _sessionCache.delete(token);
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export async function deleteUserSessions(userId) {
  for (const [token, entry] of _sessionCache) {
    if (entry.userId === userId) _sessionCache.delete(token);
  }
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export async function initAdminUser() {
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n;
  if (count > 0) return;

  const pass = process.env.INIT_ADMIN_PASS || crypto.randomBytes(6).toString('hex'); // 12 chars
  const hash = await hashPassword(pass);
  await db.prepare(
    'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
  ).run('admin', hash, 1);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  [Auth] Usuario admin creado                 ║');
  console.log(`║  Usuario:    admin                           ║`);
  console.log(`║  Contraseña: ${pass}                   ║`);
  console.log('║  Cámbiala desde el panel → Usuarios          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}
