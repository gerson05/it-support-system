import express from 'express';
import db from '../config/database.js';
import { hashPassword, deleteUserSessions } from './auth-service.js';
import { requireAuth, requirePermission } from './auth-middleware.js';

const router = express.Router();
const itOnly = [requireAuth, requirePermission('full')];

const PERMISSION_MODULES = [
  { module: 'metrics',       label: 'Métricas',             actions: ['read'] },
  { module: 'tickets',       label: 'Tickets',              actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'tech-requests', label: 'Requerimientos',       actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'faqs',          label: 'Base de conocimiento', actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'sedes',         label: 'Red de Puntos',        actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'despacho',      label: 'Despacho',             actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'audit',         label: 'Auditoría',            actions: ['read'] },
  { module: 'farmacias',     label: 'Farmacias FOMAG',      actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'inventario',   label: 'Inventario',           actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'employees',   label: 'Creación de Usuarios', actions: ['read', 'create', 'edit', 'delete'] },
];

router.get('/api/roles', requireAuth, (_req, res) => {
  const roles = db.prepare(
    `SELECT r.id, r.name, r.description,
            COUNT(CASE WHEN u.active = 1 THEN 1 END) AS user_count
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id
     ORDER BY r.id`
  ).all();
  res.json(roles);
});

router.get('/api/permissions', requireAuth, (_req, res) => {
  const allPerms = db.prepare('SELECT id, name FROM permissions').all();
  const result = PERMISSION_MODULES.map(mod => ({
    module: mod.module,
    label:  mod.label,
    permissions: mod.actions
      .map(action => {
        const perm = allPerms.find(p => p.name === `${mod.module}:${action}`);
        return perm ? { id: perm.id, name: perm.name, action } : null;
      })
      .filter(Boolean),
  }));
  res.json(result);
});

router.get('/api/roles/:id/permissions', requireAuth, (req, res) => {
  const roleId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }
  const ids = db.prepare(
    'SELECT permission_id FROM role_permissions WHERE role_id = ?'
  ).all(roleId).map(r => r.permission_id);
  res.json({ permission_ids: ids });
});

router.get('/api/users', ...itOnly, (_req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.username, u.active, u.created_at, u.updated_at,
            r.id AS role_id, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  ).all();
  res.json(users);
});

router.post('/api/users', ...itOnly, async (req, res, next) => {
  const { username, password, role_id } = req.body;
  if (!username || !password || !role_id) {
    return res.status(400).json({ error: 'username, password y role_id son requeridos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }
  try {
    const hash = await hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
    ).run(username, hash, role_id);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    }
    next(err);
  }
});

router.put('/api/users/:id', ...itOnly, async (req, res, next) => {
  const targetId = Number(req.params.id);
  const { password, role_id, active } = req.body;

  try {
    const target = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(targetId);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (targetId === req.user.id && (role_id !== undefined || active === 0)) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol ni desactivar tu cuenta.' });
    }

    if (active === 0) {
      const itRole = db.prepare("SELECT id FROM roles WHERE name = 'it'").get();
      if (itRole && target.role_id === itRole.id) {
        const itCount = db.prepare(
          'SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND active = 1'
        ).get(itRole.id).n;
        if (itCount <= 1) {
          return res.status(400).json({ error: 'No puedes desactivar al único usuario IT activo.' });
        }
      }
    }

    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      const hash = await hashPassword(password);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(hash, targetId);
    }
    if (role_id !== undefined) {
      if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id)) {
        return res.status(400).json({ error: 'Rol no válido.' });
      }
      db.prepare("UPDATE users SET role_id = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(role_id, targetId);
    }
    if (active !== undefined) {
      db.prepare("UPDATE users SET active = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(active ? 1 : 0, targetId);
      if (!active) deleteUserSessions(targetId);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/api/users/:id', ...itOnly, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
  }
  const target = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const itRole = db.prepare("SELECT id FROM roles WHERE name = 'it'").get();
  if (itRole && target.role_id === itRole.id) {
    const itCount = db.prepare(
      'SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND active = 1'
    ).get(itRole.id).n;
    if (itCount <= 1) {
      return res.status(400).json({ error: 'No puedes desactivar al único usuario IT activo.' });
    }
  }

  db.prepare("UPDATE users SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(targetId);
  deleteUserSessions(targetId);
  res.json({ ok: true });
});

router.put('/api/roles/:id', ...itOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID de rol inválido.' });
  if (id === 1) return res.status(403).json({ error: 'El rol IT no se puede modificar.' });

  const { name, description } = req.body;
  if (name === undefined && description === undefined) {
    return res.status(400).json({ error: 'Nada que actualizar.' });
  }

  try {
    const role = db.prepare('SELECT id, name, description FROM roles WHERE id = ?').get(id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado.' });

    const newName = name !== undefined ? String(name).trim() : role.name;
    const newDesc = description !== undefined ? String(description ?? '') : role.description;

    if (name !== undefined && !newName) {
      return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }

    db.prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?').run(newName, newDesc, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
    next(err);
  }
});

router.put('/api/roles/:id/permissions', ...itOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID de rol inválido.' });
  if (id === 1) return res.status(403).json({ error: 'El rol IT no se puede modificar.' });

  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }

  const { permission_ids } = req.body;
  if (!Array.isArray(permission_ids)) {
    return res.status(400).json({ error: 'permission_ids debe ser un array.' });
  }

  for (const pid of permission_ids) {
    if (!db.prepare('SELECT id FROM permissions WHERE id = ?').get(pid)) {
      return res.status(400).json({ error: `Permiso con id ${pid} no existe.` });
    }
  }

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permission_ids) ins.run(id, pid);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    next(err);
  }
});

router.post('/api/roles', ...itOnly, (req, res, next) => {
  const { name, description = '', permission_ids = [] } = req.body;
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
  if (!Array.isArray(permission_ids)) return res.status(400).json({ error: 'permission_ids debe ser un array.' });

  for (const pid of permission_ids) {
    if (!db.prepare('SELECT id FROM permissions WHERE id = ?').get(pid)) {
      return res.status(400).json({ error: `Permiso con id ${pid} no existe.` });
    }
  }

  try {
    db.exec('BEGIN');
    const result = db.prepare(
      'INSERT INTO roles (name, description) VALUES (?, ?)'
    ).run(String(name).trim(), description);
    const roleId = result.lastInsertRowid;

    if (permission_ids.length > 0) {
      const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const pid of permission_ids) ins.run(roleId, pid);
    }
    db.exec('COMMIT');
    res.status(201).json({ ok: true, id: roleId });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
    next(err);
  }
});

router.delete('/api/roles/:id', ...itOnly, (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID de rol inválido.' });
  if (id === 1) return res.status(403).json({ error: 'El rol IT no se puede eliminar.' });

  try {
    if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Rol no encontrado.' });
    }

    const n = db.prepare(
      'SELECT COUNT(*) AS n FROM users WHERE role_id = ?'
    ).get(id).n;
    if (n > 0) {
      return res.status(400).json({
        error: `Este rol tiene ${n} usuario${n > 1 ? 's' : ''} asignado${n > 1 ? 's' : ''}. Reasígnalos antes de eliminar.`,
      });
    }

    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    db.prepare('DELETE FROM roles WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
