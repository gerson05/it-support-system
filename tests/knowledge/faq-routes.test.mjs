/**
 * Integration tests for src/knowledge/faq-routes.js
 * Uses node:test + mock.module + real HTTP server (no DB, no auth).
 */
import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

/* ── controllable stubs ─────────────────────────────────────────────────── */
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

function reset() {
  _get = () => null;
  _all = () => [];
  _run = () => ({ changes: 1, lastInsertRowid: 1 });
}

/* ── mocks ───────────────────────────────────────────────────────────────── */
await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (sql) => ({
        get:  (...a) => _get(sql, ...a),
        all:  (...a) => _all(sql, ...a),
        run:  (...a) => _run(sql, ...a),
      }),
    },
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

// faq-data.js re-exports a static array — the router imports it directly,
// but since it's a pure ESM module (no DB), we let it import naturally.
// We only need to stub the db calls for custom_faqs and faq_hits.

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => fn,
  },
});

/* ── build test server ───────────────────────────────────────────────────── */
const router = (await import('../../src/knowledge/faq-routes.js')).default;

const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((r) => server.close(r)));

/* ── helpers ─────────────────────────────────────────────────────────────── */
async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const get  = (p)    => req('GET',    p);
const post = (p, b) => req('POST',   p, b);
const put  = (p, b) => req('PUT',    p, b);
const del  = (p)    => req('DELETE', p);

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/faqs
   ══════════════════════════════════════════════════════════════════════════ */
test('GET /api/faqs — returns system (static) + custom (db) faqs', async () => {
  reset();
  // custom_faqs rows
  _all = (sql) => {
    if (sql.includes('custom_faqs')) return [];
    if (sql.includes('faq_hits'))   return [];
    return [];
  };

  const { status, body } = await get('/api/faqs');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.system));
  assert.ok(Array.isArray(body.custom));
  // static faqs from faq-data.js are always present
  assert.ok(body.system.length > 0);
});

test('GET /api/faqs?area=general — filters static faqs to general + custom for area', async () => {
  reset();
  _all = () => [];

  const { status, body } = await get('/api/faqs?area=general');
  assert.equal(status, 200);
  // All returned system faqs should have area === 'general'
  for (const faq of body.system) {
    assert.equal(faq.area, 'general');
  }
});

test('GET /api/faqs — enriches faqs with hit counts from db', async () => {
  reset();
  let allCallCount = 0;
  _all = (sql) => {
    allCallCount++;
    if (sql.includes('faq_hits')) {
      return [{ faq_id: 'gen-001', total: 5, resolved: 3 }];
    }
    return [];
  };

  const { status, body } = await get('/api/faqs');
  assert.equal(status, 200);
  const gen001 = body.system.find((f) => f.id === 'gen-001');
  assert.ok(gen001);
  assert.equal(gen001.hits, 5);
  assert.equal(gen001.resolved, 3);
});

test('GET /api/faqs — custom faqs include parsed keywords', async () => {
  reset();
  _all = (sql) => {
    if (sql.includes('custom_faqs')) {
      return [{
        id: 100, area: 'general', title: 'Custom FAQ', keywords: '["red","wifi"]',
        category: 'red', solution: 'Reinicia el router.', active: 1,
      }];
    }
    return [];
  };

  const { status, body } = await get('/api/faqs');
  assert.equal(status, 200);
  assert.equal(body.custom.length, 1);
  assert.deepEqual(body.custom[0].keywords, ['red', 'wifi']);
  assert.equal(body.custom[0].source, 'custom');
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/faqs
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/faqs — creates a custom FAQ', async () => {
  reset();
  const newFaq = { id: 50, area: 'general', title: 'Mi FAQ', keywords: '[]', category: 'red', solution: 'Reinicia.' };
  _run = () => ({ changes: 1, lastInsertRowid: 50 });
  _get = () => ({ ...newFaq });

  const { status, body } = await post('/api/faqs', {
    title: 'Mi FAQ',
    solution: 'Reinicia.',
    keywords: ['red'],
  });
  assert.equal(status, 201);
  assert.equal(body.id, 50);
  assert.deepEqual(body.keywords, []);
});

test('POST /api/faqs — 400 when title missing', async () => {
  const { status, body } = await post('/api/faqs', { solution: 'Reinicia.' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/faqs — 400 when solution missing', async () => {
  const { status, body } = await post('/api/faqs', { title: 'Algo' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/faqs — 400 when both title and solution are empty strings', async () => {
  const { status, body } = await post('/api/faqs', { title: '  ', solution: '  ' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   PUT /api/faqs/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('PUT /api/faqs/:id — updates an existing custom FAQ', async () => {
  reset();
  const existing = { id: 1, area: 'general', title: 'Old', keywords: '[]', category: 'red', solution: 'Old sol.', active: 1 };
  const updated  = { ...existing, title: 'New title', keywords: '["vpn"]' };
  let getCall = 0;
  _get = () => getCall++ === 0 ? { ...existing } : { ...updated };
  _run = () => ({ changes: 1 });

  const { status, body } = await put('/api/faqs/1', { title: 'New title' });
  assert.equal(status, 200);
  assert.equal(body.id, 1);
});

test('PUT /api/faqs/:id — 404 when FAQ not found', async () => {
  reset();
  _get = () => null;

  const { status, body } = await put('/api/faqs/999', { title: 'X' });
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('PUT /api/faqs/:id — can toggle active field', async () => {
  reset();
  const base = { id: 2, area: 'general', title: 'T', keywords: '[]', category: 'red', solution: 'S', active: 1 };
  let getCall = 0;
  _get = () => getCall++ === 0 ? { ...base } : { ...base, active: 0 };
  _run = () => ({ changes: 1 });

  const { status, body } = await put('/api/faqs/2', { active: false });
  assert.equal(status, 200);
  assert.equal(body.active, 0);
});

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/faqs/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('DELETE /api/faqs/:id — deletes an existing FAQ', async () => {
  reset();
  _run = () => ({ changes: 1 });

  const { status, body } = await del('/api/faqs/5');
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('DELETE /api/faqs/:id — 404 when FAQ not found', async () => {
  reset();
  _run = () => ({ changes: 0 });

  const { status, body } = await del('/api/faqs/999');
  assert.equal(status, 404);
  assert.ok(body.error);
});
