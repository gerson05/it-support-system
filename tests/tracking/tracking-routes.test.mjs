import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── controllable DB stub ────────────────────────────────────────────────────
let _dbGet = () => null;
let _dbAll = () => [];
let _dbRun = () => ({ changes: 1, lastInsertRowid: 1 });

// ── controllable tracking-model stubs ───────────────────────────────────────
let _createTracking          = () => 'tok-new';
let _getTrackingByToken      = () => null;
let _getAllTrackings          = () => ({ rows: [], total: 0 });
let _addEvento               = () => ({ eventoId: 1, nuevoEstado: 'en_transito' });
let _addEntregaItems         = () => {};
let _saveActaFinal           = () => {};
let _marcarDevuelto          = () => true;
let _countRecentEventos      = () => 0;
let _getDistinctCargos       = () => [];
let _getTrackingRow          = () => null;
let _getActaFinalByToken     = () => null;
let _getSedesActivas         = () => [];
let _getTrackingByDespachoId = () => null;

function reset() {
  _dbGet = () => null;
  _dbAll = () => [];
  _dbRun = () => ({ changes: 1, lastInsertRowid: 1 });
  _createTracking          = () => 'tok-new';
  _getTrackingByToken      = () => null;
  _getAllTrackings          = () => ({ rows: [], total: 0 });
  _addEvento               = () => ({ eventoId: 1, nuevoEstado: 'en_transito' });
  _addEntregaItems         = () => {};
  _saveActaFinal           = () => {};
  _marcarDevuelto          = () => true;
  _countRecentEventos      = () => 0;
  _getDistinctCargos       = () => [];
  _getTrackingRow          = () => null;
  _getActaFinalByToken     = () => null;
  _getSedesActivas         = () => [];
  _getTrackingByDespachoId = () => null;
}

// ── mocks ────────────────────────────────────────────────────────────────────
await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (_sql) => ({
        get: (...a) => _dbGet(...a),
        all: (...a) => _dbAll(...a),
        run: (...a) => _dbRun(...a),
      }),
      exec: () => {},
    },
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

await mock.module('../../src/tracking/tracking-model.js', {
  exports: {
    createTracking:          (...a) => _createTracking(...a),
    getTrackingByToken:      (...a) => _getTrackingByToken(...a),
    getAllTrackings:          (...a) => _getAllTrackings(...a),
    addEvento:               (...a) => _addEvento(...a),
    addEntregaItems:         (...a) => _addEntregaItems(...a),
    saveActaFinal:           (...a) => _saveActaFinal(...a),
    marcarDevuelto:          (...a) => _marcarDevuelto(...a),
    countRecentEventos:      (...a) => _countRecentEventos(...a),
    getDistinctCargos:       (...a) => _getDistinctCargos(...a),
    getTrackingRow:          (...a) => _getTrackingRow(...a),
    getActaFinalByToken:     (...a) => _getActaFinalByToken(...a),
    getSedesActivas:         (...a) => _getSedesActivas(...a),
    getTrackingByDespachoId: (...a) => _getTrackingByDespachoId(...a),
  },
});

await mock.module('../../src/tracking/tracking-notifier.js', {
  exports: { notifyTrackingEvento: async () => {} },
});

await mock.module('../../src/tracking/acta-receptor.js', {
  exports: {
    generateActaReceptor: async () => ({
      filepath: path.join(os.tmpdir(), 'acta-mock.docx'),
      filename: 'acta-mock.docx',
    }),
  },
});

await mock.module('../../src/tracking/rotulo-generator.js', {
  exports: { generateRotuloHtml: async () => '<html><body>Test rotulo</body></html>' },
});

await mock.module('qrcode', {
  exports: { default: { toBuffer: async () => Buffer.from('fake-png') } },
});

await mock.module('../../src/utils/url.js', {
  exports: { getBaseUrl: () => 'http://127.0.0.1' },
});

await mock.module('../../src/utils/async-handler.js', {
  exports: { wrap: (fn) => fn },
});

// ── test server ───────────────────────────────────────────────────────────────
const router = (await import('../../src/tracking/tracking-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((r) => server.close(r)));

// ── helpers ───────────────────────────────────────────────────────────────────
async function req(method, p, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${p}`, opts);
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json, headers: res.headers };
}

async function postForm(p, fields, fileBlob, fileName) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (fileBlob) form.append('foto', fileBlob, fileName ?? 'test.jpg');
  const res = await fetch(`${BASE}${p}`, { method: 'POST', body: form });
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const get = (p)    => req('GET',  p);
const put = (p, b) => req('PUT',  p, b);

// ── FOTOS_DIR mirrors what tracking-routes.js computes ───────────────────────
const __dirnameTest = path.dirname(fileURLToPath(import.meta.url));
const FOTOS_DIR = path.resolve(__dirnameTest, '../../src/../uploads/tracking-fotos');

// ── stub factory ──────────────────────────────────────────────────────────────
function makeTracking(overrides = {}) {
  return {
    id: 1, token: 'tok-abc', estado: 'creado', despacho_id: 10,
    numero: 'DES-20240101-001', destinatario: 'Juan Pérez',
    sede_destino: 'CALI', fecha: '2024-01-01',
    articulos: '[]', articulos_parsed: [],
    eventos: [], acta_final: null,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════
   PUBLIC: GET /api/tracking/public/sedes
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/public/sedes — returns sedes and cargos', async () => {
  reset();
  _getSedesActivas   = () => [{ id: 1, nombre: 'CALI' }];
  _getDistinctCargos = () => ['Gerente', 'Técnico'];
  const { status, body } = await get('/api/tracking/public/sedes');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.sedes));
  assert.ok(Array.isArray(body.cargos));
  assert.equal(body.sedes.length, 1);
  assert.equal(body.cargos.length, 2);
});

/* ══════════════════════════════════════════════════════════════
   PUBLIC: GET /api/tracking/public/:token
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/public/:token — 404 when token not found', async () => {
  reset();
  const { status, body } = await get('/api/tracking/public/nonexistent');
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('GET /api/tracking/public/:token — returns full tracking info', async () => {
  reset();
  _getTrackingByToken = () => makeTracking({
    acta_final: { filepath: '/some/acta.docx' },
    articulos_parsed: [{ nombre: 'Laptop', cantidad: 1 }],
    eventos: [{
      id: 1, tipo: 'recepcion', recibido_por: 'Ana', entregado_por: 'Luis',
      ubicacion: 'Bodega', observaciones: 'OK', estado_paquete: 'en_transito',
      created_at: '2024-01-01T00:00:00', foto_path: '/uploads/photo.jpg',
    }],
  });
  const { status, body } = await get('/api/tracking/public/tok-abc');
  assert.equal(status, 200);
  assert.equal(body.token, 'tok-abc');
  assert.equal(body.eventos.length, 1);
  assert.equal(body.eventos[0].tiene_foto, true);
  assert.equal(body.tiene_acta, true);
  assert.equal(body.articulos.length, 1);
});

test('GET /api/tracking/public/:token — tiene_foto false when foto_path null', async () => {
  reset();
  _getTrackingByToken = () => makeTracking({
    eventos: [{
      id: 2, tipo: 'recepcion', recibido_por: 'Ana', entregado_por: 'Luis',
      ubicacion: 'Bodega', observaciones: null, estado_paquete: 'en_transito',
      created_at: '2024-01-01T00:00:00', foto_path: null,
    }],
  });
  const { status, body } = await get('/api/tracking/public/tok-abc');
  assert.equal(status, 200);
  assert.equal(body.eventos[0].tiene_foto, false);
  assert.equal(body.tiene_acta, false);
});

test('GET /api/tracking/public/:token — tiene_foto false when foto_path is "system"', async () => {
  reset();
  _getTrackingByToken = () => makeTracking({
    eventos: [{
      id: 3, tipo: 'creacion', recibido_por: 'Sistema', entregado_por: 'Sistema',
      ubicacion: 'Bodega', observaciones: null, estado_paquete: 'creado',
      created_at: '2024-01-01T00:00:00', foto_path: 'system',
    }],
  });
  const { status, body } = await get('/api/tracking/public/tok-abc');
  assert.equal(status, 200);
  assert.equal(body.eventos[0].tiene_foto, false);
});

/* ══════════════════════════════════════════════════════════════
   validateTracking middleware
   ══════════════════════════════════════════════════════════════ */

test('validateTracking — 404 when tracking not found', async () => {
  reset();
  const { status, body } = await req('POST', '/api/tracking/public/bad-tok/evento', {});
  assert.equal(status, 404);
  assert.match(body.error, /no encontrado/i);
});

test('validateTracking — 409 when estado is entregado', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'entregado' });
  const { status, body } = await req('POST', '/api/tracking/public/tok-abc/evento', {});
  assert.equal(status, 409);
  assert.match(body.error, /entregado|devuelto/i);
});

test('validateTracking — 409 when estado is devuelto', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'devuelto' });
  const { status, body } = await req('POST', '/api/tracking/public/tok-abc/evento', {});
  assert.equal(status, 409);
  assert.match(body.error, /entregado|devuelto/i);
});

test('validateTracking — 429 when too many recent eventos', async () => {
  reset();
  _getTrackingRow     = () => makeTracking({ estado: 'en_transito' });
  _countRecentEventos = () => 5;
  const { status, body } = await req('POST', '/api/tracking/public/tok-abc/evento', {});
  assert.equal(status, 429);
  assert.match(body.error, /Demasiados/i);
});

/* ══════════════════════════════════════════════════════════════
   POST /public/:token/evento (multipart)
   ══════════════════════════════════════════════════════════════ */

test('POST /public/:token/evento — 400 when no photo uploaded', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    null,
  );
  assert.equal(status, 400);
  assert.match(body.error, /fotograf/i);
});

test('POST /public/:token/evento — 400 when recibido_por missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /nombre/i);
});

test('POST /public/:token/evento — 400 when entregado_por missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', ubicacion: 'Bodega' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /entrega/i);
});

test('POST /public/:token/evento — 400 when ubicacion missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /ubicaci/i);
});

test('POST /public/:token/evento — 200 on valid multipart', async () => {
  reset();
  _getTrackingRow     = () => makeTracking({ estado: 'en_transito' });
  _getTrackingByToken = () => makeTracking({ estado: 'en_transito', eventos: [{ id: 1 }] });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'photo.jpg',
  );
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.estado, 'en_transito');
});

test('POST /public/:token/evento — 200 with sede_id included', async () => {
  reset();
  _getTrackingRow     = () => makeTracking({ estado: 'en_transito' });
  _getTrackingByToken = () => makeTracking({ estado: 'en_transito', eventos: [{ id: 1 }] });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega', sede_id: '3', observaciones: 'Test' },
    file, 'photo.jpg',
  );
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('POST /public/:token/evento — 400 for invalid file type (fileFilter)', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['data'], { type: 'application/pdf' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'doc.pdf',
  );
  assert.equal(status, 400);
  assert.match(body.error, /Solo se aceptan/i);
});

test('POST /public/:token/evento — accepts image/png', async () => {
  reset();
  _getTrackingRow     = () => makeTracking({ estado: 'en_transito' });
  _getTrackingByToken = () => makeTracking({ estado: 'en_transito', eventos: [{ id: 1 }] });
  const file = new Blob(['png'], { type: 'image/png' });
  const { status } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'photo.png',
  );
  assert.equal(status, 200);
});

test('POST /public/:token/evento — accepts image/webp', async () => {
  reset();
  _getTrackingRow     = () => makeTracking({ estado: 'en_transito' });
  _getTrackingByToken = () => makeTracking({ estado: 'en_transito', eventos: [{ id: 1 }] });
  const file = new Blob(['webp'], { type: 'image/webp' });
  const { status } = await postForm(
    '/api/tracking/public/tok-abc/evento',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'photo.webp',
  );
  assert.equal(status, 200);
});

/* ══════════════════════════════════════════════════════════════
   POST /public/:token/entrega-final (multipart)
   ══════════════════════════════════════════════════════════════ */

test('POST /public/:token/entrega-final — 404 when token not found', async () => {
  reset();
  const { status, body } = await req('POST', '/api/tracking/public/bad-tok/entrega-final', {});
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('POST /public/:token/entrega-final — 400 when no photo', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega' },
    null,
  );
  assert.equal(status, 400);
  assert.match(body.error, /fotograf/i);
});

test('POST /public/:token/entrega-final — 400 when recibido_por missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { entregado_por: 'Luis', ubicacion: 'Bodega' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /nombre/i);
});

test('POST /public/:token/entrega-final — 400 when entregado_por missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', ubicacion: 'Bodega' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /entrega/i);
});

test('POST /public/:token/entrega-final — 400 when ubicacion missing', async () => {
  reset();
  _getTrackingRow = () => makeTracking({ estado: 'en_transito' });
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', entregado_por: 'Luis' },
    file, 'photo.jpg',
  );
  assert.equal(status, 400);
  assert.match(body.error, /ubicaci/i);
});

test('POST /public/:token/entrega-final — 200 on valid multipart (empty items)', async () => {
  reset();
  const tracking = makeTracking({
    estado: 'en_transito',
    articulos_parsed: [{ nombre: 'Laptop', cantidad: 1 }],
    eventos: [{ id: 1, tipo: 'entrega_final' }],
  });
  _getTrackingRow     = () => tracking;
  _getTrackingByToken = () => tracking;
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega', items: '[]' },
    file, 'photo.jpg',
  );
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.estado, 'entregado');
  assert.equal(body.acta_disponible, true);
});

test('POST /public/:token/entrega-final — 200 with explicit items list', async () => {
  reset();
  let capturedItems;
  const tracking = makeTracking({
    estado: 'en_transito', eventos: [{ id: 1 }], articulos_parsed: [],
  });
  _getTrackingRow     = () => tracking;
  _getTrackingByToken = () => tracking;
  _addEntregaItems    = (_db, _evId, items) => { capturedItems = items; };
  const itemsJson = JSON.stringify([{ item_index: 0, equipment_name: 'Laptop', cantidad: 1, recibido_conforme: 1 }]);
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega', items: itemsJson },
    file, 'photo.jpg',
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray(capturedItems));
  assert.equal(capturedItems.length, 1);
});

test('POST /public/:token/entrega-final — handles invalid items JSON gracefully', async () => {
  reset();
  const tracking = makeTracking({
    estado: 'en_transito', eventos: [{ id: 1 }],
    articulos_parsed: [{ nombre: 'Laptop', cantidad: 1 }],
  });
  _getTrackingRow     = () => tracking;
  _getTrackingByToken = () => tracking;
  const file = new Blob(['img'], { type: 'image/jpeg' });
  const { status, body } = await postForm(
    '/api/tracking/public/tok-abc/entrega-final',
    { recibido_por: 'Ana', entregado_por: 'Luis', ubicacion: 'Bodega', items: 'not-json{' },
    file, 'photo.jpg',
  );
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

/* ══════════════════════════════════════════════════════════════
   GET /public/:token/acta-final
   ══════════════════════════════════════════════════════════════ */

test('GET /public/:token/acta-final — 404 when no acta row', async () => {
  reset();
  const { status, body } = await get('/api/tracking/public/tok-abc/acta-final');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /public/:token/acta-final — 404 when acta file missing from disk', async () => {
  reset();
  _getActaFinalByToken = () => ({ filepath: '/nonexistent/path/acta.docx', filename: 'acta.docx' });
  const { status, body } = await get('/api/tracking/public/tok-abc/acta-final');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /public/:token/acta-final — 200 and sends file when exists', async () => {
  reset();
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-test-'));
  const tmpFile = path.join(tmpDir, 'acta.docx');
  fs.writeFileSync(tmpFile, 'fake docx');
  _getActaFinalByToken = () => ({ filepath: tmpFile, filename: 'acta-test.docx' });

  const res = await fetch(`${BASE}/api/tracking/public/tok-abc/acta-final`);
  assert.equal(res.status, 200);
  const ct = res.headers.get('content-type') ?? '';
  assert.ok(ct.includes('wordprocessingml') || ct.includes('octet-stream') || ct.includes('application/'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking — returns list', async () => {
  reset();
  _getAllTrackings = () => ({ rows: [makeTracking()], total: 1 });
  const { status, body } = await get('/api/tracking');
  assert.equal(status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.rows.length, 1);
});

test('GET /api/tracking — passes query params to getAllTrackings', async () => {
  reset();
  let capturedOpts;
  _getAllTrackings = (_db, opts) => { capturedOpts = opts; return { rows: [], total: 0 }; };
  await get('/api/tracking?estado=entregado&search=juan&limit=10&offset=5');
  assert.equal(capturedOpts.estado, 'entregado');
  assert.equal(capturedOpts.search, 'juan');
  assert.equal(capturedOpts.limit, 10);
  assert.equal(capturedOpts.offset, 5);
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking/fotos/:filename
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/fotos/:filename — 404 when file not found', async () => {
  const { status, body } = await get('/api/tracking/fotos/nonexistent.jpg');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/tracking/fotos/:filename — 200 when file exists', async () => {
  if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });
  const testFile = path.join(FOTOS_DIR, 'test-foto.jpg');
  fs.writeFileSync(testFile, 'fake image data');

  const res = await fetch(`${BASE}/api/tracking/fotos/test-foto.jpg`);
  assert.equal(res.status, 200);

  fs.rmSync(testFile, { force: true });
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking/:token/rotulo
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/:token/rotulo — 404 when not found', async () => {
  reset();
  const { status, body } = await get('/api/tracking/bad-tok/rotulo');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/tracking/:token/rotulo — returns HTML when found', async () => {
  reset();
  _dbGet = () => ({
    token: 'tok-abc', numero: 'DES-001',
    destinatario: 'Juan', sede_destino: 'CALI', fecha: '2024-01-01',
  });
  const res = await fetch(`${BASE}/api/tracking/tok-abc/rotulo`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('text/html'));
  const text = await res.text();
  assert.ok(text.includes('Test rotulo'));
});

test('GET /api/tracking/:token/rotulo — passes modo=todos sedes to generator', async () => {
  reset();
  _dbGet           = () => ({ token: 'tok-abc', numero: 'DES-001', destinatario: 'Juan', sede_destino: 'CALI', fecha: '2024-01-01' });
  _getSedesActivas = () => [{ id: 1, nombre: 'CALI' }];
  const res = await fetch(`${BASE}/api/tracking/tok-abc/rotulo?modo=todos`);
  assert.equal(res.status, 200);
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking/:token/qr
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/:token/qr — 404 when not found', async () => {
  reset();
  const { status, body } = await get('/api/tracking/bad-tok/qr');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/tracking/:token/qr — 200 returns PNG when found', async () => {
  reset();
  _getTrackingRow = () => makeTracking();
  const res = await fetch(`${BASE}/api/tracking/tok-abc/qr`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('image/png'));
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: PUT /api/tracking/:token/estado
   ══════════════════════════════════════════════════════════════ */

test('PUT /api/tracking/:token/estado — 400 for non-devuelto estado', async () => {
  reset();
  const { status, body } = await put('/api/tracking/tok-abc/estado', { estado: 'entregado' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('PUT /api/tracking/:token/estado — 200 marks as devuelto', async () => {
  reset();
  const { status, body } = await put('/api/tracking/tok-abc/estado', { estado: 'devuelto' });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('PUT /api/tracking/:token/estado — 404 when marcarDevuelto returns false', async () => {
  reset();
  _marcarDevuelto = () => false;
  const { status, body } = await put('/api/tracking/tok-abc/estado', { estado: 'devuelto' });
  assert.equal(status, 404);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking/by-despacho/:despachoId
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/by-despacho/:id — returns null token when not found', async () => {
  reset();
  const { status, body } = await get('/api/tracking/by-despacho/99');
  assert.equal(status, 200);
  assert.equal(body.token, null);
});

test('GET /api/tracking/by-despacho/:id — returns token and qr_url when found', async () => {
  reset();
  _getTrackingByDespachoId = () => ({ token: 'tok-abc' });
  const { status, body } = await get('/api/tracking/by-despacho/10');
  assert.equal(status, 200);
  assert.equal(body.token, 'tok-abc');
  assert.ok(body.qr_url?.includes('tok-abc'));
});

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATED: GET /api/tracking/:token
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tracking/:token — 404 when not found', async () => {
  reset();
  const { status, body } = await get('/api/tracking/nonexistent');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/tracking/:token — 200 returns tracking with qr_url', async () => {
  reset();
  _getTrackingByToken = () => makeTracking();
  const { status, body } = await get('/api/tracking/tok-abc');
  assert.equal(status, 200);
  assert.equal(body.token, 'tok-abc');
  assert.ok(body.qr_url?.includes('tok-abc'));
});
