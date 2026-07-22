import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── Controllable stubs ──────────────────────────────────────────────────────
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

// Service-level stubs (replaced per test where needed)
let _tsGetAll    = () => ({ tickets: [], total: 0, page: 1, limit: 10, total_pages: 0 });
let _tsGetById   = (id) => id === 1 ? { id: 1, area: 'farmacia', ticket_number: 'TK-001', phone: '573001234567', chat_id: null, messages: [], notes: [] } : null;
let _tsUpdate    = () => true;
let _tsAddMessage = () => true;
let _tsAddNote   = () => true;

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

await mock.module('../../src/tickets/ticket-service.js', {
  exports: {
    ticketService: {
      getAll:      (filters) => _tsGetAll(filters),
      getById:     (id)      => _tsGetById(id),
      update:      (...a)    => _tsUpdate(...a),
      addMessage:  (...a)    => _tsAddMessage(...a),
      addNote:     (...a)    => _tsAddNote(...a),
    },
  },
});

await mock.module('../../src/whatsapp/messenger.js', {
  exports: {
    sendWhatsAppMessage: async () => ({ simulation: true }),
    sendWhatsAppImage:   async () => ({ simulation: true }),
  },
});

await mock.module('../../src/events/broadcaster.js', {
  exports: {
    appEvents:       { emit: () => {} },
    addSseClient:    () => {},
    removeSseClient: () => {},
  },
});

await mock.module('../../src/audit/audit-logger.js', {
  exports: { logAudit: () => {} },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (req, _res, next) => {
      req.user        = { id: 1, username: 'agent', role: 'admin' };
      req.permissions = ['tickets:read', 'tickets:edit'];
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

const router = (await import('../../src/tickets/ticket-routes.js')).default;
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

// ── GET /api/tickets ────────────────────────────────────────────────────────

test('GET /api/tickets – 200 returns paginated list', async () => {
  _tsGetAll = () => ({ tickets: [], total: 0, page: 1, limit: 10, total_pages: 0 });
  const { status, body } = await req('GET', '/api/tickets');
  assert.equal(status, 200);
  assert.ok('tickets'     in body, 'has tickets');
  assert.ok('total'       in body, 'has total');
  assert.ok('page'        in body, 'has page');
  assert.ok('total_pages' in body, 'has total_pages');
});

test('GET /api/tickets – returns tickets from service', async () => {
  _tsGetAll = () => ({
    tickets: [{ id: 1, area: 'farmacia' }, { id: 2, area: 'cartera' }],
    total: 2, page: 1, limit: 10, total_pages: 1,
  });
  const { status, body } = await req('GET', '/api/tickets');
  assert.equal(status, 200);
  assert.equal(body.tickets.length, 2);
  assert.equal(body.total, 2);
});

test('GET /api/tickets – passes query filters to service', async () => {
  let capturedFilters;
  _tsGetAll = (f) => { capturedFilters = f; return { tickets: [], total: 0, page: 1, limit: 10, total_pages: 0 }; };
  await req('GET', '/api/tickets?status=abierto&priority=alta&page=2&limit=5');
  assert.equal(capturedFilters.status, 'abierto');
  assert.equal(capturedFilters.priority, 'alta');
  assert.equal(capturedFilters.page, 2);
  assert.equal(capturedFilters.limit, 5);
});

// ── GET /api/tickets/:id ────────────────────────────────────────────────────

test('GET /api/tickets/1 – 200 returns ticket', async () => {
  _tsGetById = (id) => id === 1
    ? { id: 1, area: 'farmacia', ticket_number: 'TK-001', phone: '57300', chat_id: null, messages: [], notes: [] }
    : null;
  const { status, body } = await req('GET', '/api/tickets/1');
  assert.equal(status, 200);
  assert.equal(body.id, 1);
  assert.equal(body.area, 'farmacia');
});

test('GET /api/tickets/999 – 404 when ticket not found', async () => {
  _tsGetById = () => null;
  const { status, body } = await req('GET', '/api/tickets/999');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('GET /api/tickets/:id – returns messages and notes arrays', async () => {
  _tsGetById = (id) => id === 1
    ? { id: 1, area: 'cartera', ticket_number: 'TK-002', messages: [{ id: 10, content: 'hola' }], notes: [] }
    : null;
  const { body } = await req('GET', '/api/tickets/1');
  assert.ok(Array.isArray(body.messages), 'messages is array');
  assert.equal(body.messages[0].content, 'hola');
});

// ── PUT /api/tickets/:id ────────────────────────────────────────────────────

test('PUT /api/tickets/1 – 200 on successful update', async () => {
  _tsUpdate = () => true;
  // db.prepare().get for ticket after update + agent lookup
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql)) return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    if (/SELECT name FROM agents WHERE id/.test(sql)) return null;
    return null;
  };
  const { status, body } = await req('PUT', '/api/tickets/1', { status: 'en_progreso' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('PUT /api/tickets/999 – 404 when ticketService.update returns false', async () => {
  _tsUpdate = () => false;
  const { status, body } = await req('PUT', '/api/tickets/999', { status: 'cerrado' });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('PUT /api/tickets/1 – includes success message', async () => {
  _tsUpdate = () => true;
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql)) return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    return null;
  };
  const { body } = await req('PUT', '/api/tickets/1', { priority: 'alta' });
  assert.ok(body.message);
});

test('PUT /api/tickets/1 – assigned_to included in update body', async () => {
  _tsUpdate = () => true;
  let capturedArgs;
  _tsUpdate = (...a) => { capturedArgs = a; return true; };
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql)) return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    if (/SELECT name FROM agents WHERE id/.test(sql)) return { name: 'Maria' };
    return null;
  };
  await req('PUT', '/api/tickets/1', { assigned_to: 5 });
  assert.equal(capturedArgs[0], 1);
  assert.equal(capturedArgs[1].assigned_to, 5);
});

// ── POST /api/tickets/:id/messages ─────────────────────────────────────────

test('POST /api/tickets/1/messages – 200 on valid message', async () => {
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql))
      return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    return null;
  };
  _tsAddMessage = () => true;
  const { status, body } = await req('POST', '/api/tickets/1/messages', {
    agentName: 'Juan',
    content:   'Revisando el problema.',
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('POST /api/tickets/1/messages – 400 when content is missing', async () => {
  const { status, body } = await req('POST', '/api/tickets/1/messages', { agentName: 'Juan' });
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('POST /api/tickets/1/messages – 400 when content is blank whitespace', async () => {
  const { status, body } = await req('POST', '/api/tickets/1/messages', {
    agentName: 'Juan',
    content:   '   ',
  });
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('POST /api/tickets/1/messages – 404 when ticket not found', async () => {
  _get = () => null;
  const { status, body } = await req('POST', '/api/tickets/1/messages', {
    agentName: 'Juan',
    content:   'hola',
  });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('POST /api/tickets/1/messages – 500 when addMessage fails', async () => {
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql))
      return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    return null;
  };
  _tsAddMessage = () => false;
  const { status, body } = await req('POST', '/api/tickets/1/messages', {
    agentName: 'Juan',
    content:   'algo',
  });
  assert.equal(status, 500);
  assert.match(body.error, /Error/i);
});

test('POST /api/tickets/1/messages – response includes whatsapp field', async () => {
  _get = (sql) => {
    if (/SELECT \* FROM tickets WHERE id/.test(sql))
      return { id: 1, ticket_number: 'TK-001', phone: '573001234567', chat_id: null };
    return null;
  };
  _tsAddMessage = () => true;
  const { body } = await req('POST', '/api/tickets/1/messages', {
    agentName: 'Maria',
    content:   'Revisando.',
  });
  assert.ok('whatsapp' in body, 'whatsapp key present');
});

// ── POST /api/tickets/:id/notes ─────────────────────────────────────────────

test('POST /api/tickets/1/notes – 200 on valid note', async () => {
  _tsAddNote = () => true;
  const { status, body } = await req('POST', '/api/tickets/1/notes', {
    agentId:   1,
    agentName: 'Juan',
    content:   'Nota interna del técnico.',
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('POST /api/tickets/1/notes – 400 when content is missing', async () => {
  const { status, body } = await req('POST', '/api/tickets/1/notes', { agentName: 'Juan' });
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('POST /api/tickets/1/notes – 400 when content is blank whitespace', async () => {
  const { status, body } = await req('POST', '/api/tickets/1/notes', {
    agentName: 'Juan',
    content:   '   ',
  });
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('POST /api/tickets/1/notes – 500 when addNote fails', async () => {
  _tsAddNote = () => false;
  const { status, body } = await req('POST', '/api/tickets/1/notes', {
    agentId:   1,
    agentName: 'Juan',
    content:   'nota aqui',
  });
  assert.equal(status, 500);
  assert.match(body.error, /Error/i);
});

test('POST /api/tickets/1/notes – success message included', async () => {
  _tsAddNote = () => true;
  const { body } = await req('POST', '/api/tickets/1/notes', {
    agentId:   2,
    agentName: 'Maria',
    content:   'Revisado.',
  });
  assert.ok(body.message);
});

// ── GET /api/agents ──────────────────────────────────────────────────────────

test('GET /api/agents – 200 returns agents list', async () => {
  _all = () => [{ id: 1, name: 'Juan', active: 1 }, { id: 2, name: 'Maria', active: 1 }];
  const { status, body } = await req('GET', '/api/agents');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body), 'response is array');
  assert.equal(body.length, 2);
});

// ── POST /api/tickets/:id/send-image ─────────────────────────────────────────

test('POST /api/tickets/1/send-image – 400 when base64 missing', async () => {
  _tsGetById = (id) => id === 1
    ? { id: 1, area: 'farmacia', ticket_number: 'TK-001', phone: '57300', chat_id: null }
    : null;
  const { status, body } = await req('POST', '/api/tickets/1/send-image', { caption: 'foto' });
  assert.equal(status, 400);
  assert.match(body.error, /base64/i);
});

test('POST /api/tickets/1/send-image – 404 when ticket not found', async () => {
  _tsGetById = () => null;
  const { status, body } = await req('POST', '/api/tickets/999/send-image', { base64: 'abc' });
  assert.equal(status, 404);
});

test('POST /api/tickets/1/send-image – 200 on valid image', async () => {
  _tsGetById = (id) => id === 1
    ? { id: 1, area: 'farmacia', ticket_number: 'TK-001', phone: '57300', chat_id: null }
    : null;
  _get = () => null;
  const { status, body } = await req('POST', '/api/tickets/1/send-image', {
    base64:   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
    mimetype: 'image/jpeg',
    caption:  'foto del problema',
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

// ── PUT /api/tickets/:id/requester ───────────────────────────────────────────

test('PUT /api/tickets/1/requester – 400 when requester_name missing', async () => {
  const { status, body } = await req('PUT', '/api/tickets/1/requester', { cedula: '123' });
  assert.equal(status, 400);
  assert.match(body.error, /solicitante/i);
});

test('PUT /api/tickets/1/requester – 404 when ticket not found', async () => {
  _get = () => null;
  const { status } = await req('PUT', '/api/tickets/999/requester', { requester_name: 'Pedro' });
  assert.equal(status, 404);
});

test('PUT /api/tickets/1/requester – 200 on valid update', async () => {
  _get = (sql) => {
    if (/SELECT id, ticket_number FROM tickets/.test(sql)) return { id: 1, ticket_number: 'TK-001' };
    return null;
  };
  const { status, body } = await req('PUT', '/api/tickets/1/requester', { requester_name: 'Ana López' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

// ── PUT /api/tickets/:id/assign ──────────────────────────────────────────────

test('PUT /api/tickets/1/assign – 400 when nombre missing', async () => {
  const { status, body } = await req('PUT', '/api/tickets/1/assign', { cedula: '12345' });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/i);
});

test('PUT /api/tickets/1/assign – 400 when cedula missing', async () => {
  const { status, body } = await req('PUT', '/api/tickets/1/assign', { nombre: 'Juan' });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/i);
});

test('PUT /api/tickets/1/assign – 404 when ticket not found', async () => {
  _get = () => null;
  const { status } = await req('PUT', '/api/tickets/999/assign', { nombre: 'Juan', cedula: '123' });
  assert.equal(status, 404);
});

test('PUT /api/tickets/1/assign – 200 and creates new agent if not found', async () => {
  _get = (sql) => {
    if (/SELECT id, ticket_number FROM tickets/.test(sql)) return { id: 1, ticket_number: 'TK-001' };
    if (/SELECT id FROM agents WHERE name/.test(sql))     return null; // agent doesn't exist yet
    return null;
  };
  _run = () => ({ changes: 1, lastInsertRowid: 42 });
  const { status, body } = await req('PUT', '/api/tickets/1/assign', { nombre: 'Carlos', cedula: '9999' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.agent_name, 'Carlos');
});

test('PUT /api/tickets/1/assign – 200 reuses existing agent', async () => {
  _get = (sql) => {
    if (/SELECT id, ticket_number FROM tickets/.test(sql)) return { id: 1, ticket_number: 'TK-001' };
    if (/SELECT id FROM agents WHERE name/.test(sql))     return { id: 7 };
    return null;
  };
  const { status, body } = await req('PUT', '/api/tickets/1/assign', { nombre: 'Carlos', cedula: '9999' });
  assert.equal(status, 200);
  assert.equal(body.agent_id, 7);
});

// ── PUT /api/agents/:id ──────────────────────────────────────────────────────

test('PUT /api/agents/1 – 200 on valid name update', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 1 });
  const { status, body } = await req('PUT', '/api/agents/1', { name: 'Carlos Nuevo' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('PUT /api/agents/1 – 400 when name is missing', async () => {
  const { status, body } = await req('PUT', '/api/agents/1', {});
  assert.equal(status, 400);
  assert.match(body.error, /requerido/i);
});

test('PUT /api/agents/999 – 404 when agent not found (0 changes)', async () => {
  _run = () => ({ changes: 0, lastInsertRowid: 0 });
  const { status, body } = await req('PUT', '/api/agents/999', { name: 'Nadie' });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});
