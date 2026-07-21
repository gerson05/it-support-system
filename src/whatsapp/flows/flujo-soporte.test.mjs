import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Mock all dependencies before importing the module ────────────────────────

const mockSetStep    = mock.fn();
const mockGetCtx     = mock.fn(() => ({}));
const mockCrearTicket = mock.fn(async () => 42);

await mock.module('../chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx, crearTicket: mockCrearTicket },
});

await mock.module('../chatbot-utils.js', {
  exports: { detectPriority: () => 'media' },
});

await mock.module('../chatbot-config.js', {
  exports: {
    AREA_MAP_FULL:   { '1': 'cartera', '2': 'compra' },
    AREA_MAP_SIMPLE: { '1': 'general' },
    AREA_NAMES:      { cartera: 'Cartera', compra: 'Compra', general: 'General' },
    AREA_EXAMPLES:   { cartera: '- Problemas con el software\n- Reportes' },
  },
});

await mock.module('../gemini-service.js', {
  exports: {
    getAISolution:          mock.fn(async () => null),
    getAISolutionFromImage: mock.fn(async () => null),
  },
});

await mock.module('../../knowledge/faq-service.js', {
  exports: { searchFaqsAll: mock.fn(() => []) },
});

await mock.module('../../events/broadcaster.js', {
  exports: { appEvents: { emit: mock.fn() } },
});

const { handleSoporte } = await import('./flujo-soporte.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockDb(opts = {}) {
  return {
    prepare: (sql) => ({
      get:  (...args) => opts.get?.(sql, ...args)  ?? null,
      run:  (...args) => opts.run?.(sql, ...args)  ?? { changes: 1, lastInsertRowid: 999 },
      all:  (...args) => opts.all?.(sql, ...args)  ?? [],
    }),
  };
}

function makeCtx(overrides = {}) {
  return {
    text: '', cleanText: '', session: {}, phone: '573001234567',
    db: makeMockDb(), chatId: null, media: null,
    ...overrides,
  };
}

function resetAll() {
  mockSetStep.mock.resetCalls();
  mockGetCtx.mock.resetCalls();
  mockCrearTicket.mock.resetCalls();
}

// ── Step routing ─────────────────────────────────────────────────────────────

test('handleSoporte: unknown step → null', async () => {
  assert.equal(await handleSoporte('idle', makeCtx()), null);
});

test('handleSoporte: step not in SOPORTE_STEPS → null', async () => {
  assert.equal(await handleSoporte('menu_principal', makeCtx()), null);
});

// ── menu_area ────────────────────────────────────────────────────────────────

test('handleSoporte: menu_area invalid input → error message', async () => {
  const result = await handleSoporte('menu_area', makeCtx({ cleanText: 'xyz' }));
  assert.ok(result.includes('Opción no válida'));
});

test('handleSoporte: menu_area valid "1" → setStep ask_ticket_name', async () => {
  resetAll();
  const result = await handleSoporte('menu_area', makeCtx({ cleanText: '1' }));
  assert.equal(mockSetStep.mock.calls.length, 1);
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_name');
  assert.ok(result.includes('nombre completo'));
});

// ── menu_area_simple ─────────────────────────────────────────────────────────

test('handleSoporte: menu_area_simple invalid → error message', async () => {
  const result = await handleSoporte('menu_area_simple', makeCtx({ cleanText: '9' }));
  assert.ok(result.includes('Opción no válida'));
});

test('handleSoporte: menu_area_simple valid "1" → setStep ask_ticket_name', async () => {
  resetAll();
  const result = await handleSoporte('menu_area_simple', makeCtx({ cleanText: '1' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_name');
  assert.ok(result.includes('nombre completo'));
});

// ── ask_ticket_name ──────────────────────────────────────────────────────────

test('handleSoporte: ask_ticket_name → stores name, sets awaiting_description', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({}));
  const result = await handleSoporte('ask_ticket_name', makeCtx({ text: 'Juan Pérez', cleanText: 'Juan Pérez' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'awaiting_description');
  assert.ok(result.includes('problema'));
});

// ── awaiting_description (no AI) ─────────────────────────────────────────────

test('handleSoporte: awaiting_description no AI → route to create_ticket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({}));
  const result = await handleSoporte('awaiting_description', makeCtx({
    text: 'no funciona el computador',
    cleanText: 'no funciona el computador',
  }));
  assert.ok(typeof result === 'string');
  assert.ok(result.includes('ticket'));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'create_ticket');
});

// ── ask_resolved ─────────────────────────────────────────────────────────────

test('handleSoporte: ask_resolved "1" → resolved, sets idle', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({}));
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '1' }));
  assert.ok(result.includes('resuelto') || result.includes('Genial'));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
});

test('handleSoporte: ask_resolved "2" no existing ticket → creates ticket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'El equipo no enciende' }));
  const db = makeMockDb({
    get: (sql) => {
      if (sql.includes('ticket_number FROM tickets WHERE id')) return { ticket_number: 'TK-999' };
      return null;
    },
  });
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '2', db }));
  assert.equal(mockCrearTicket.mock.calls.length, 1);
  assert.ok(result.includes('TK-999'));
});

test('handleSoporte: ask_resolved "3" → different problem, sets awaiting_description', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({}));
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '3' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'awaiting_description');
  assert.ok(result.includes('detalle'));
});

test('handleSoporte: ask_resolved invalid → reprompt with options', async () => {
  mockGetCtx.mock.mockImplementation(() => ({}));
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: 'hola' }));
  assert.ok(result.includes('1') && result.includes('2'));
});

// ── create_ticket ─────────────────────────────────────────────────────────────

test('handleSoporte: create_ticket → creates ticket, returns number', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'Falla previa' }));
  const db = makeMockDb({
    get: (sql) => {
      if (sql.includes('ticket_number FROM tickets WHERE id')) return { ticket_number: 'TK-001' };
      return null;
    },
  });
  const result = await handleSoporte('create_ticket', makeCtx({
    text: 'Detalles adicionales',
    cleanText: 'detalles adicionales',
    db,
  }));
  assert.equal(mockCrearTicket.mock.calls.length, 1);
  assert.ok(result.includes('TK-001'));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
});
