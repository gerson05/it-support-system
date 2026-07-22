import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockSetStep = mock.fn();
const mockGetCtx  = mock.fn(() => ({}));

await mock.module('../../../src/whatsapp/chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx },
});

await mock.module('../../../src/whatsapp/chatbot-utils.js', {
  exports: { detectPriority: () => 'media' },
});

const mockCreateTechRequest = mock.fn(() => ({ id: 1, request_number: 'REQ-20260721-001' }));
await mock.module('../../../src/tech-requests/tech-request-model.js', {
  exports: { createTechRequest: mockCreateTechRequest },
});

const mockEmit = mock.fn();
await mock.module('../../../src/events/broadcaster.js', {
  exports: { appEvents: { emit: mockEmit } },
});

const { handleIncidencia } = await import('../../../src/whatsapp/flows/flujo-incidencia.js');

function makeDb() {
  return { prepare: () => ({ run: () => {}, get: () => null, all: () => [] }) };
}

function reset() {
  mockSetStep.mock.resetCalls();
  mockGetCtx.mock.resetCalls();
  mockCreateTechRequest.mock.resetCalls();
  mockEmit.mock.resetCalls();
  mockGetCtx.mock.mockImplementation(() => ({}));
  mockCreateTechRequest.mock.mockImplementation(() => ({ id: 1, request_number: 'REQ-001' }));
}

function call(step, text, ctx = {}) {
  mockGetCtx.mock.mockImplementation(() => ({ ...ctx }));
  return handleIncidencia(step, { text, session: {}, phone: '573001234567', db: makeDb() });
}

// ── step routing ──────────────────────────────────────────────────────────────

test('handleIncidencia: unknown step returns null', async () => {
  assert.equal(await handleIncidencia('idle', { text: '', session: {}, phone: '573', db: makeDb() }), null);
});

// ── inc_name ──────────────────────────────────────────────────────────────────

test('handleIncidencia: inc_name echoes name in response', async () => {
  reset();
  const result = await call('inc_name', 'Juan Pérez');
  assert.ok(result.includes('Juan Pérez'));
});

test('handleIncidencia: inc_name advances to inc_cedula', async () => {
  reset();
  await call('inc_name', 'Juan');
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'inc_cedula');
  reset();
});

// ── inc_cedula ────────────────────────────────────────────────────────────────

test('handleIncidencia: inc_cedula echoes cedula in response', async () => {
  reset();
  const result = await call('inc_cedula', '123456789', { name: 'Juan' });
  assert.ok(result.includes('123456789'));
});

test('handleIncidencia: inc_cedula advances to inc_cargo', async () => {
  reset();
  await call('inc_cedula', '123456789', { name: 'Juan' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'inc_cargo');
  reset();
});

// ── inc_cargo ─────────────────────────────────────────────────────────────────

test('handleIncidencia: inc_cargo echoes cargo in response', async () => {
  reset();
  const result = await call('inc_cargo', 'Analista', { name: 'Juan', cedula: '123' });
  assert.ok(result.includes('Analista'));
});

test('handleIncidencia: inc_cargo advances to inc_equipo', async () => {
  reset();
  await call('inc_cargo', 'Analista', { name: 'Juan', cedula: '123' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'inc_equipo');
  reset();
});

// ── inc_equipo ────────────────────────────────────────────────────────────────

test('handleIncidencia: inc_equipo with serial extracts both parts', async () => {
  reset();
  const result = await call('inc_equipo', 'PC HP EliteDesk - serial HP2024001', { name: 'J', cedula: '1', cargo: 'IT' });
  assert.ok(result.includes('HP2024001'));
  assert.ok(result.includes('PC HP EliteDesk'));
  reset();
});

test('handleIncidencia: inc_equipo without serial still shows equipo', async () => {
  reset();
  const result = await call('inc_equipo', 'Laptop Dell', { name: 'J', cedula: '1', cargo: 'IT' });
  assert.ok(result.includes('Laptop Dell'));
  reset();
});

test('handleIncidencia: inc_equipo advances to inc_desc', async () => {
  reset();
  await call('inc_equipo', 'PC HP', { name: 'J', cedula: '1', cargo: 'IT' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'inc_desc');
  reset();
});

// ── inc_desc ──────────────────────────────────────────────────────────────────

test('handleIncidencia: inc_desc calls createTechRequest', async () => {
  reset();
  await call('inc_desc', 'La pantalla se apagó', {
    name: 'Juan', cedula: '123', cargo: 'IT', sede: 'MANIZALES',
    equipment_name: 'PC HP', equipment_serial: null,
  });
  assert.equal(mockCreateTechRequest.mock.calls.length, 1);
  reset();
});

test('handleIncidencia: inc_desc emits tech-request:created event', async () => {
  reset();
  await call('inc_desc', 'Fallo del equipo', {
    name: 'Juan', cedula: '123', cargo: 'IT', sede: 'CALI',
    equipment_name: 'Servidor', equipment_serial: null,
  });
  assert.equal(mockEmit.mock.calls.length, 1);
  assert.equal(mockEmit.mock.calls[0].arguments[0], 'tech-request:created');
  reset();
});

test('handleIncidencia: inc_desc response includes request number', async () => {
  reset();
  mockCreateTechRequest.mock.mockImplementation(() => ({ id: 42, request_number: 'REQ-20260721-007' }));
  const result = await call('inc_desc', 'Fallo', {
    name: 'Ana', cedula: '999', cargo: 'Admin', sede: 'PASTO',
    equipment_name: 'Monitor', equipment_serial: null,
  });
  assert.ok(result.includes('REQ-20260721-007'));
  reset();
});

test('handleIncidencia: inc_desc resets step to idle', async () => {
  reset();
  await call('inc_desc', 'Fallo', {
    name: 'A', cedula: '1', cargo: 'B', sede: 'C',
    equipment_name: 'X', equipment_serial: null,
  });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
  reset();
});

test('handleIncidencia: inc_desc passes type=incidencia to createTechRequest', async () => {
  reset();
  await call('inc_desc', 'Fallo', { name: 'A', cedula: '1', cargo: 'B', sede: 'C', equipment_name: 'X', equipment_serial: null });
  assert.equal(mockCreateTechRequest.mock.calls[0].arguments[1].type, 'incidencia');
  reset();
});

test('handleIncidencia: inc_desc includes sede in createTechRequest args', async () => {
  reset();
  await call('inc_desc', 'Fallo', { name: 'A', cedula: '1', cargo: 'B', sede: 'DOSQUEBRADAS', equipment_name: 'PC', equipment_serial: null });
  assert.equal(mockCreateTechRequest.mock.calls[0].arguments[1].sede, 'DOSQUEBRADAS');
  reset();
});
