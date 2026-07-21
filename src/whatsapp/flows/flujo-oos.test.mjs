import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockSetStep = mock.fn();
const mockGetCtx  = mock.fn(() => ({}));

await mock.module('../chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx },
});

await mock.module('../chatbot-utils.js', {
  exports: { nextBusinessDay: () => '2026-07-22' },
});

const mockEmit = mock.fn();
await mock.module('../../events/broadcaster.js', {
  exports: { appEvents: { emit: mockEmit } },
});

const mockGenerateTicketTitle = mock.fn(async () => 'Consulta técnica general');
await mock.module('../gemini-service.js', {
  exports: { generateTicketTitle: mockGenerateTicketTitle },
});

const { handleOOS } = await import('./flujo-oos.js');

const TODAY_STR = new Date().toISOString().slice(0, 10).replace(/-/g, '');

function makeDb(lastTicketNumber = null) {
  return {
    prepare: (sql) => ({
      get: () => {
        if (sql.includes('last_insert_rowid')) return { id: 42 };
        if (sql.includes('ticket_number'))     return lastTicketNumber ? { ticket_number: lastTicketNumber } : null;
        return null;
      },
      run: () => ({ lastInsertRowid: 42 }),
      all: () => [],
    }),
  };
}

function reset() {
  mockSetStep.mock.resetCalls();
  mockGetCtx.mock.resetCalls();
  mockEmit.mock.resetCalls();
  mockGenerateTicketTitle.mock.resetCalls();
  mockGetCtx.mock.mockImplementation(() => ({}));
  mockGenerateTicketTitle.mock.mockImplementation(async () => 'Título generado');
}

function call(step, text, ctx = {}, db = makeDb()) {
  mockGetCtx.mock.mockImplementation(() => ({ ...ctx }));
  return handleOOS(step, { text, session: {}, phone: '573001234567', db });
}

// ── step routing ──────────────────────────────────────────────────────────────

test('handleOOS: unknown step returns null', async () => {
  assert.equal(await handleOOS('idle', { text: '', session: {}, phone: '573', db: makeDb() }), null);
});

// ── oos_name ──────────────────────────────────────────────────────────────────

test('handleOOS: oos_name echoes name in response', async () => {
  reset();
  const result = await call('oos_name', 'Pedro Ramirez');
  assert.ok(result.includes('Pedro Ramirez'));
});

test('handleOOS: oos_name includes next business day', async () => {
  reset();
  const result = await call('oos_name', 'Pedro');
  assert.ok(result.includes('2026-07-22'));
});

test('handleOOS: oos_name advances to oos_desc', async () => {
  reset();
  await call('oos_name', 'Pedro');
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'oos_desc');
  reset();
});

// ── oos_desc ──────────────────────────────────────────────────────────────────

test('handleOOS: oos_desc generates ticket number with today date', async () => {
  reset();
  const result = await call('oos_desc', 'Necesito ayuda con mi PC', { name: 'Pedro' });
  assert.ok(result.includes(`TK-${TODAY_STR}-001`));
  reset();
});

test('handleOOS: oos_desc increments ticket number from last existing', async () => {
  reset();
  const db = makeDb(`TK-${TODAY_STR}-003`);
  const result = await call('oos_desc', 'Problema', { name: 'Ana' }, db);
  assert.ok(result.includes(`TK-${TODAY_STR}-004`));
  reset();
});

test('handleOOS: oos_desc emits ticket:created event', async () => {
  reset();
  await call('oos_desc', 'Fallo en PC', { name: 'Pedro' });
  assert.equal(mockEmit.mock.calls.length, 1);
  assert.equal(mockEmit.mock.calls[0].arguments[0], 'ticket:created');
  reset();
});

test('handleOOS: oos_desc includes requester name in response', async () => {
  reset();
  const result = await call('oos_desc', 'Mi pantalla no enciende', { name: 'Ana García' });
  assert.ok(result.includes('Ana García'));
  reset();
});

test('handleOOS: oos_desc resets step to idle', async () => {
  reset();
  await call('oos_desc', 'Consulta', { name: 'Test' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
  reset();
});

test('handleOOS: oos_desc calls generateTicketTitle with area=general', async () => {
  reset();
  await call('oos_desc', 'Mi problema', { name: 'Test' });
  assert.equal(mockGenerateTicketTitle.mock.calls[0].arguments[0], 'general');
  reset();
});

test('handleOOS: oos_desc includes next business day in confirmation', async () => {
  reset();
  const result = await call('oos_desc', 'Consulta', { name: 'Test' });
  assert.ok(result.includes('2026-07-22'));
  reset();
});
