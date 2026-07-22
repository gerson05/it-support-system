import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── Controllable stubs ──────────────────────────────────────────────────────
// req.user.id is set to 99 by requireAuth below — tests that check "self" use id=99
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (sql) => ({
        get:  (...a) => _get(sql, ...a),
        all:  (...a) => _all(sql, ...a),
        run:  (...a) => _run(sql, ...a),
      }),
      exec: () => {},
    },
  },
});

await mock.module('../../src/auth/auth-service.js', {
  exports: {
    hashPassword:       async (plain) => `hashed:${plain}`,
    deleteUserSessions: () => {},
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth: (req, _res, next) => {
      req.user        = { id: 99, username: 'admin', role: 'it' };
      req.permissions = ['full'];
      next();
    },
    requirePermission: () => (_req, _res, next) => next(),
  },
});

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

const router = (await import('../../src/auth/user-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

// ── Helper ──────────────────────────────────────────────────────────────────
async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── GET /api/roles ───────────────────────────────────────────────────────────

test('GET /api/roles – 200 returns array of roles', async () => {
  _all = () => [{ id: 1, name: 'it', description: 'IT Admin', user_count: 2 }];
  const { status, body } = await req('GET', '/api/roles');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body[0].name, 'it');
});

test('GET /api/roles – empty array when no roles', async () => {
  _all = () => [];
  const { status, body } = await req('GET', '/api/roles');
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

// ── GET /api/permissions ─────────────────────────────────────────────────────

test('GET /api/permissions – 200 returns grouped permission modules', async () => {
  _all = () => [
    { id: 1, name: 'metrics:read' },
    { id: 2, name: 'tickets:read' },
    { id: 3, name: 'tickets:create' },
    { id: 4, name: 'tickets:edit' },
    { id: 5, name: 'tickets:delete' },
  ];
  const { status, body } = await req('GET', '/api/permissions');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  const metricsModule = body.find(m => m.module === 'metrics');
  assert.ok(metricsModule, 'metrics module present');
  assert.equal(metricsModule.label, 'Métricas');
  assert.ok(Array.isArray(metricsModule.permissions));
});

test('GET /api/permissions – filters out unknown permission names', async () => {
  _all = () => [{ id: 1, name: 'metrics:read' }];
  const { body } = await req('GET', '/api/permissions');
  const ticketsModule = body.find(m => m.module === 'tickets');
  // tickets has 4 actions but none are in DB → empty permissions
  assert.ok(Array.isArray(ticketsModule.permissions));
  assert.equal(ticketsModule.permissions.length, 0);
});

// ── GET /api/roles/:id/permissions ───────────────────────────────────────────

test('GET /api/roles/1/permissions – 200 returns permission_ids array', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 1 };
    return null;
  };
  _all = () => [{ permission_id: 1 }, { permission_id: 3 }];
  const { status, body } = await req('GET', '/api/roles/1/permissions');
  assert.equal(status, 200);
  assert.deepEqual(body.permission_ids, [1, 3]);
});

test('GET /api/roles/999/permissions – 404 when role not found', async () => {
  _get = () => null;
  const { status, body } = await req('GET', '/api/roles/999/permissions');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

// ── GET /api/users ───────────────────────────────────────────────────────────

test('GET /api/users – 200 returns users list', async () => {
  _all = () => [
    { id: 1, username: 'alice', active: 1, role_id: 1, role_name: 'it' },
    { id: 2, username: 'bob',   active: 1, role_id: 2, role_name: 'agent' },
  ];
  const { status, body } = await req('GET', '/api/users');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 2);
  assert.equal(body[0].username, 'alice');
});

// ── POST /api/users ──────────────────────────────────────────────────────────

test('POST /api/users – 400 when username missing', async () => {
  const { status, body } = await req('POST', '/api/users', { password: 'secret1', role_id: 2 });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/i);
});

test('POST /api/users – 400 when password missing', async () => {
  const { status, body } = await req('POST', '/api/users', { username: 'newuser', role_id: 2 });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/i);
});

test('POST /api/users – 400 when role_id missing', async () => {
  const { status, body } = await req('POST', '/api/users', { username: 'newuser', password: 'secret1' });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/i);
});

test('POST /api/users – 400 when password shorter than 6 chars', async () => {
  const { status, body } = await req('POST', '/api/users', { username: 'u', password: 'abc', role_id: 2 });
  assert.equal(status, 400);
  assert.match(body.error, /6 caracteres/i);
});

test('POST /api/users – 400 when role_id does not exist', async () => {
  _get = () => null; // role not found
  const { status, body } = await req('POST', '/api/users', { username: 'u2', password: 'secret1', role_id: 999 });
  assert.equal(status, 400);
  assert.match(body.error, /Rol no válido/i);
});

test('POST /api/users – 201 on successful creation', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 2 };
    return null;
  };
  _run = () => ({ changes: 1, lastInsertRowid: 7 });
  const { status, body } = await req('POST', '/api/users', { username: 'newuser', password: 'secret1', role_id: 2 });
  assert.equal(status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.id, 7);
});

test('POST /api/users – 409 on duplicate username', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 2 };
    return null;
  };
  _run = () => { throw new Error('UNIQUE constraint failed: users.username'); };
  const { status, body } = await req('POST', '/api/users', { username: 'dup', password: 'secret1', role_id: 2 });
  assert.equal(status, 409);
  assert.match(body.error, /ya existe/i);
});

// ── PUT /api/users/:id ───────────────────────────────────────────────────────

test('PUT /api/users/1 – 404 when user not found', async () => {
  _get = () => null;
  const { status, body } = await req('PUT', '/api/users/1', { active: 1 });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('PUT /api/users/99 – 400 when trying to change own role (self-protect)', async () => {
  // req.user.id = 99 (from middleware), targetId = 99
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 99, role_id: 1 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/users/99', { role_id: 2 });
  assert.equal(status, 400);
  assert.match(body.error, /propio rol/i);
});

test('PUT /api/users/99 – 400 when trying to deactivate own account', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 99, role_id: 1 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/users/99', { active: 0 });
  assert.equal(status, 400);
  assert.match(body.error, /propio rol|propia cuenta/i);
});

test('PUT /api/users/1 – 400 when deactivating the sole active IT user', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id = ?/.test(sql)) return { id: 1, role_id: 1 };
    if (/SELECT id FROM roles WHERE name = 'it'/.test(sql))    return { id: 1 };
    if (/COUNT\(\*\) AS n FROM users WHERE role_id/.test(sql)) return { n: 1 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/users/1', { active: 0 });
  assert.equal(status, 400);
  assert.match(body.error, /único usuario IT/i);
});

test('PUT /api/users/1 – 400 when new password shorter than 6 chars', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 1, role_id: 2 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/users/1', { password: 'abc' });
  assert.equal(status, 400);
  assert.match(body.error, /6 caracteres/i);
});

test('PUT /api/users/1 – 400 when updating to invalid role_id', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id = ?/.test(sql)) return { id: 1, role_id: 2 };
    if (/SELECT id FROM roles WHERE id = ?/.test(sql))          return null; // role not found
    return null;
  };
  const { status, body } = await req('PUT', '/api/users/1', { role_id: 999 });
  assert.equal(status, 400);
  assert.match(body.error, /Rol no válido/i);
});

test('PUT /api/users/1 – 200 on valid active-flag update', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql))     return { id: 1, role_id: 2 };
    if (/SELECT id FROM roles WHERE name = 'it'/.test(sql))     return { id: 1 };
    if (/COUNT\(\*\) AS n FROM users WHERE role_id/.test(sql))  return { n: 3 }; // 3 IT users
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('PUT', '/api/users/1', { active: 0 });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('PUT /api/users/1 – 200 on valid role update', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 1, role_id: 1 };
    if (/SELECT id FROM roles WHERE id = ?/.test(sql))      return { id: 3 };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('PUT', '/api/users/1', { role_id: 3 });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────

test('DELETE /api/users/99 – 400 when trying to delete own account', async () => {
  // middleware sets req.user.id = 99
  const { status, body } = await req('DELETE', '/api/users/99');
  assert.equal(status, 400);
  assert.match(body.error, /propia cuenta/i);
});

test('DELETE /api/users/1 – 404 when user not found', async () => {
  _get = () => null;
  const { status, body } = await req('DELETE', '/api/users/1');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('DELETE /api/users/1 – 400 when deleting sole active IT user', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 1, role_id: 1 };
    if (/SELECT id FROM roles WHERE name = 'it'/.test(sql)) return { id: 1 };
    if (/COUNT\(\*\) AS n/.test(sql))                       return { n: 1 };
    return null;
  };
  const { status, body } = await req('DELETE', '/api/users/1');
  assert.equal(status, 400);
  assert.match(body.error, /único usuario IT/i);
});

test('DELETE /api/users/1 – 200 on valid delete', async () => {
  _get = (sql) => {
    if (/SELECT id, role_id FROM users WHERE id/.test(sql)) return { id: 1, role_id: 2 };
    if (/SELECT id FROM roles WHERE name = 'it'/.test(sql)) return { id: 1 };
    if (/COUNT\(\*\) AS n/.test(sql))                       return { n: 3 };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('DELETE', '/api/users/1');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

// ── PUT /api/roles/:id ────────────────────────────────────────────────────────

test('PUT /api/roles/1 – 403 cannot modify IT role', async () => {
  const { status, body } = await req('PUT', '/api/roles/1', { name: 'hacked' });
  assert.equal(status, 403);
  assert.match(body.error, /no se puede modificar/i);
});

test('PUT /api/roles/abc – 400 on invalid id', async () => {
  const { status, body } = await req('PUT', '/api/roles/abc', { name: 'test' });
  assert.equal(status, 400);
  assert.match(body.error, /inválido/i);
});

test('PUT /api/roles/2 – 400 when nothing to update', async () => {
  const { status, body } = await req('PUT', '/api/roles/2', {});
  assert.equal(status, 400);
  assert.match(body.error, /Nada que actualizar/i);
});

test('PUT /api/roles/2 – 404 when role not found', async () => {
  _get = () => null;
  const { status, body } = await req('PUT', '/api/roles/2', { name: 'Editor' });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('PUT /api/roles/2 – 409 on duplicate name', async () => {
  _get = (sql) => {
    if (/SELECT id, name, description FROM roles/.test(sql)) return { id: 2, name: 'agent', description: '' };
    return null;
  };
  _run = () => { throw new Error('UNIQUE constraint failed: roles.name'); };
  const { status, body } = await req('PUT', '/api/roles/2', { name: 'it' });
  assert.equal(status, 409);
  assert.match(body.error, /ya existe/i);
});

test('PUT /api/roles/2 – 200 on valid update', async () => {
  _get = (sql) => {
    if (/SELECT id, name, description FROM roles/.test(sql)) return { id: 2, name: 'agent', description: 'desc' };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('PUT', '/api/roles/2', { name: 'Agent Updated', description: 'new desc' });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('PUT /api/roles/2 – 400 when name is whitespace-only', async () => {
  _get = (sql) => {
    if (/SELECT id, name, description FROM roles/.test(sql)) return { id: 2, name: 'agent', description: '' };
    return null;
  };
  const { status, body } = await req('PUT', '/api/roles/2', { name: '   ' });
  assert.equal(status, 400);
  assert.match(body.error, /vacío/i);
});

// ── PUT /api/roles/:id/permissions ───────────────────────────────────────────

test('PUT /api/roles/1/permissions – 403 cannot modify IT role permissions', async () => {
  const { status, body } = await req('PUT', '/api/roles/1/permissions', { permission_ids: [1] });
  assert.equal(status, 403);
});

test('PUT /api/roles/2/permissions – 400 when permission_ids not array', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 2 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/roles/2/permissions', { permission_ids: 'bad' });
  assert.equal(status, 400);
  assert.match(body.error, /array/i);
});

test('PUT /api/roles/2/permissions – 404 when role not found', async () => {
  _get = () => null;
  const { status, body } = await req('PUT', '/api/roles/2/permissions', { permission_ids: [] });
  assert.equal(status, 404);
});

test('PUT /api/roles/2/permissions – 400 when a permission id does not exist', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql))      return { id: 2 };
    if (/SELECT id FROM permissions WHERE id/.test(sql)) return null; // perm not found
    return null;
  };
  const { status, body } = await req('PUT', '/api/roles/2/permissions', { permission_ids: [999] });
  assert.equal(status, 400);
  assert.match(body.error, /no existe/i);
});

test('PUT /api/roles/2/permissions – 200 on valid update', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql))      return { id: 2 };
    if (/SELECT id FROM permissions WHERE id/.test(sql)) return { id: 1 };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('PUT', '/api/roles/2/permissions', { permission_ids: [1] });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('PUT /api/roles/2/permissions – 200 with empty permission_ids (clears all)', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 2 };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('PUT', '/api/roles/2/permissions', { permission_ids: [] });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

// ── POST /api/roles ───────────────────────────────────────────────────────────

test('POST /api/roles – 400 when name is missing', async () => {
  const { status, body } = await req('POST', '/api/roles', { description: 'desc' });
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('POST /api/roles – 400 when permission_ids not array', async () => {
  const { status, body } = await req('POST', '/api/roles', { name: 'New', permission_ids: 'bad' });
  assert.equal(status, 400);
  assert.match(body.error, /array/i);
});

test('POST /api/roles – 400 when a permission id does not exist', async () => {
  _get = () => null;
  const { status, body } = await req('POST', '/api/roles', { name: 'New', permission_ids: [999] });
  assert.equal(status, 400);
  assert.match(body.error, /no existe/i);
});

test('POST /api/roles – 201 on valid creation', async () => {
  _get = () => null;
  _run = () => ({ changes: 1, lastInsertRowid: 5 });
  const { status, body } = await req('POST', '/api/roles', { name: 'Editor', description: 'Can edit' });
  assert.equal(status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.id, 5);
});

test('POST /api/roles – 409 on duplicate name', async () => {
  _get = () => null;
  _run = () => { throw new Error('UNIQUE constraint failed: roles.name'); };
  const { status, body } = await req('POST', '/api/roles', { name: 'it' });
  assert.equal(status, 409);
  assert.match(body.error, /ya existe/i);
});

// ── DELETE /api/roles/:id ─────────────────────────────────────────────────────

test('DELETE /api/roles/1 – 403 cannot delete IT role', async () => {
  const { status, body } = await req('DELETE', '/api/roles/1');
  assert.equal(status, 403);
  assert.match(body.error, /no se puede eliminar/i);
});

test('DELETE /api/roles/abc – 400 on invalid id', async () => {
  const { status, body } = await req('DELETE', '/api/roles/abc');
  assert.equal(status, 400);
  assert.match(body.error, /inválido/i);
});

test('DELETE /api/roles/2 – 404 when role not found', async () => {
  _get = () => null;
  const { status, body } = await req('DELETE', '/api/roles/2');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('DELETE /api/roles/2 – 400 when role has assigned users', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql))   return { id: 2 };
    if (/COUNT\(\*\) AS n FROM users/.test(sql))     return { n: 3 };
    return null;
  };
  const { status, body } = await req('DELETE', '/api/roles/2');
  assert.equal(status, 400);
  assert.match(body.error, /usuario/i);
});

test('DELETE /api/roles/2 – 200 on valid delete', async () => {
  _get = (sql) => {
    if (/SELECT id FROM roles WHERE id/.test(sql)) return { id: 2 };
    if (/COUNT\(\*\) AS n FROM users/.test(sql))   return { n: 0 };
    return null;
  };
  _run = () => ({ changes: 1 });
  const { status, body } = await req('DELETE', '/api/roles/2');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});
