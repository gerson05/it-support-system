import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/database.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function getSession(token) {
  if (!token) return null;

  return db.transaction(() => {
    const session = db.prepare(
      `SELECT s.user_id, s.expires_at, u.username, u.active, u.role_id,
              r.name AS role_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
    ).get(token);

    if (!session || !session.active) return null;

    const permissions = db.prepare(
      `SELECT p.name FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`
    ).all(session.role_id).map(p => p.name);

    // Sliding window — extender sesión 8h más en cada uso
    const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);

    return {
      id:          session.user_id,
      username:    session.username,
      role:        session.role_name,
      permissions,
    };
  })();
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export async function initAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const pass = crypto.randomBytes(6).toString('hex'); // 12 chars
  const hash = await hashPassword(pass);
  db.prepare(
    'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
  ).run('admin', hash, 1);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  [Auth] Usuario admin creado                 ║');
  console.log(`║  Usuario:    admin                           ║`);
  console.log(`║  Contraseña: ${pass}                   ║`);
  console.log('║  Cámbiala desde el panel → Usuarios          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}
