import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── Controllable stubs ──────────────────────────────────────────────────────
let _get = () => ({ count: 0, avg_hours: null });
let _all = () => [];

await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (sql) => ({
        get:  (...a) => _get(sql, ...a),
        all:  (...a) => _all(sql, ...a),
        run:  () => ({ changes: 1, lastInsertRowid: 1 }),
      }),
      exec: () => {},
    },
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: () => (_req, _res, next) => next(),
  },
});

// async-handler wrap is a real thin helper — mock it as a pass-through
await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

const router = (await import('../../src/metrics/metrics-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

// ── Helper ──────────────────────────────────────────────────────────────────
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── GET /api/metrics ────────────────────────────────────────────────────────

test('GET /api/metrics – 200 with expected shape', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = () => [];

  const { status, body } = await get('/api/metrics');
  assert.equal(status, 200);
  assert.ok(body.summary, 'response has summary');
  assert.ok(Array.isArray(body.by_area), 'by_area is array');
  assert.ok(Array.isArray(body.by_priority), 'by_priority is array');
  assert.ok(Array.isArray(body.by_status), 'by_status is array');
  assert.ok(Array.isArray(body.recent_tickets), 'recent_tickets is array');
});

test('GET /api/metrics – summary contains required keys', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 5 };
  };
  _all = () => [];

  const { body } = await get('/api/metrics');
  const s = body.summary;
  assert.ok('open_tickets'        in s, 'open_tickets present');
  assert.ok('in_progress_tickets' in s, 'in_progress_tickets present');
  assert.ok('resolved_today'      in s, 'resolved_today present');
  assert.ok('created_this_week'   in s, 'created_this_week present');
  assert.ok('autoservice_rate'    in s, 'autoservice_rate present');
  assert.ok('faq_total'           in s, 'faq_total present');
  assert.ok('faq_resolved'        in s, 'faq_resolved present');
  assert.ok('avg_resolution_hours' in s, 'avg_resolution_hours present');
});

test('GET /api/metrics – summary counts reflect db values', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql))           return { avg_hours: 4.0 };
    if (/status = 'abierto'/.test(sql))  return { count: 7 };
    if (/status = 'en_progreso'/.test(sql)) return { count: 3 };
    if (/status = 'resuelto'.*date/.test(sql)) return { count: 2 };
    if (/-7 days/.test(sql))             return { count: 12 };
    if (/faq_hits.*resolved = 1/.test(sql)) return { count: 5 };
    if (/faq_hits/.test(sql))            return { count: 10 };
    return { count: 0 };
  };
  _all = () => [];

  const { status, body } = await get('/api/metrics');
  assert.equal(status, 200);
  assert.equal(body.summary.open_tickets, 7);
  assert.equal(body.summary.in_progress_tickets, 3);
  assert.equal(body.summary.avg_resolution_hours, 4.0);
});

test('GET /api/metrics – autoservice_rate is 0 when faq_hits is 0', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = () => [];

  const { body } = await get('/api/metrics');
  assert.equal(body.summary.autoservice_rate, 0);
});

test('GET /api/metrics – autoservice_rate calculated correctly', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql))              return { avg_hours: null };
    if (/faq_hits.*resolved = 1/.test(sql)) return { count: 8 };
    if (/faq_hits/.test(sql))              return { count: 10 };
    return { count: 0 };
  };
  _all = () => [];

  const { body } = await get('/api/metrics');
  assert.equal(body.summary.autoservice_rate, 80);
});

test('GET /api/metrics – by_area includes area_label', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = (sql) => {
    if (/GROUP BY area/.test(sql)) return [{ area: 'farmacia', count: 3 }];
    return [];
  };

  const { body } = await get('/api/metrics');
  assert.equal(body.by_area.length, 1);
  assert.equal(body.by_area[0].area, 'farmacia');
  assert.equal(body.by_area[0].area_label, 'Farmacia');
  assert.equal(body.by_area[0].count, 3);
});

test('GET /api/metrics – unknown area gets raw area as label', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = (sql) => {
    if (/GROUP BY area/.test(sql)) return [{ area: 'desconocida', count: 1 }];
    return [];
  };

  const { body } = await get('/api/metrics');
  assert.equal(body.by_area[0].area_label, 'desconocida');
});

test('GET /api/metrics – recent_tickets have area_label added', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = (sql) => {
    if (/ORDER BY t.created_at DESC/.test(sql)) {
      return [{ id: 5, area: 'cartera', status: 'abierto', agent_name: 'Juan' }];
    }
    return [];
  };

  const { body } = await get('/api/metrics');
  assert.equal(body.recent_tickets.length, 1);
  assert.equal(body.recent_tickets[0].area_label, 'Cartera');
});

// ── GET /api/metrics/trend ──────────────────────────────────────────────────

test('GET /api/metrics/trend – 200 with trend array of 7 days', async () => {
  _get = (sql) => {
    if (/avg_hours/.test(sql)) return { avg_hours: null };
    return { count: 0 };
  };
  _all = (sql) => {
    if (/date\(created_at.*-6 days/.test(sql)) return [];
    if (/status IN.*abierto.*en_progreso/.test(sql)) return [];
    return [];
  };

  const { status, body } = await get('/api/metrics/trend');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.trend), 'trend is array');
  assert.equal(body.trend.length, 7);
});

test('GET /api/metrics/trend – sla object has required keys', async () => {
  _all = () => [];
  const { body } = await get('/api/metrics/trend');
  assert.ok('breached' in body.sla, 'sla.breached present');
  assert.ok('warning'  in body.sla, 'sla.warning present');
  assert.ok('open'     in body.sla, 'sla.open present');
});

test('GET /api/metrics/trend – sla counts breached tickets', async () => {
  const pastTime = new Date(Date.now() - 100 * 3600_000).toISOString(); // 100 h ago, exceeds all SLAs
  _all = (sql) => {
    if (/status IN.*abierto.*en_progreso/.test(sql)) {
      return [{ priority: 'baja', created_at: pastTime }]; // baja SLA=168h, 100h < 168h → not breached
    }
    return [];
  };

  const { body } = await get('/api/metrics/trend');
  assert.equal(typeof body.sla.breached, 'number');
  assert.equal(typeof body.sla.open, 'number');
  assert.equal(body.sla.open, 1);
});

// ── GET /api/analytics/dashboard ───────────────────────────────────────────

test('GET /api/analytics/dashboard – 200 with expected keys', async () => {
  _get = () => ({ count: 0 });
  _all = () => [];

  const { status, body } = await get('/api/analytics/dashboard');
  assert.equal(status, 200);
  assert.ok('tickets_por_area'        in body);
  assert.ok('top_solicitantes'        in body);
  assert.ok('despachos'               in body);
  assert.ok('tech_requests_por_sede'  in body);
});

test('GET /api/analytics/dashboard – accepts cedula query param', async () => {
  _get = () => ({ count: 0 });
  let cedulaUsed;
  _all = (sql, ...args) => {
    if (/cedula = ?/.test(sql)) cedulaUsed = args[0];
    return [];
  };

  const { status } = await get('/api/analytics/dashboard?cedula=12345678');
  assert.equal(status, 200);
  assert.equal(cedulaUsed, '12345678');
});
