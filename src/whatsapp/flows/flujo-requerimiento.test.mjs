import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockSetStep = mock.fn();
const mockGetCtx  = mock.fn(() => ({}));

await mock.module('../chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx, crearTicket: mock.fn() },
});

await mock.module('../chatbot-utils.js', {
  exports: { detectPriority: () => 'media' },
});

const mockCreateTechRequest = mock.fn(() => ({ id: 1, request_number: 'REQ-001' }));
await mock.module('../../tech-requests/tech-request-model.js', {
  exports: { createTechRequest: mockCreateTechRequest },
});

const mockEmit = mock.fn();
await mock.module('../../events/broadcaster.js', {
  exports: { appEvents: { emit: mockEmit } },
});

const { handleRequerimiento } = await import('./flujo-requerimiento.js');

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
  return handleRequerimiento(step, { text, session: {}, phone: '573001234567', db: makeDb() });
}

// ── step routing ──────────────────────────────────────────────────────────────

test('handleRequerimiento: unknown step returns null', async () => {
  assert.equal(await handleRequerimiento('idle', { text: '', session: {}, phone: '573', db: makeDb() }), null);
});

// ── req_name ──────────────────────────────────────────────────────────────────

test('handleRequerimiento: req_name echoes name in response', async () => {
  reset();
  const result = await call('req_name', 'Maria Lopez');
  assert.ok(result.includes('Maria Lopez'));
});

test('handleRequerimiento: req_name advances to req_cedula', async () => {
  reset();
  await call('req_name', 'Maria');
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'req_cedula');
  reset();
});

// ── req_cedula ────────────────────────────────────────────────────────────────

test('handleRequerimiento: req_cedula echoes cedula', async () => {
  reset();
  const result = await call('req_cedula', '987654321', { name: 'Maria' });
  assert.ok(result.includes('987654321'));
});

test('handleRequerimiento: req_cedula advances to req_cargo', async () => {
  reset();
  await call('req_cedula', '987', { name: 'Maria' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'req_cargo');
  reset();
});

// ── req_cargo ─────────────────────────────────────────────────────────────────

test('handleRequerimiento: req_cargo echoes cargo', async () => {
  reset();
  const result = await call('req_cargo', 'Gerente', { name: 'Maria', cedula: '987' });
  assert.ok(result.includes('Gerente'));
});

test('handleRequerimiento: req_cargo advances to req_desc', async () => {
  reset();
  await call('req_cargo', 'Gerente', { name: 'Maria', cedula: '987' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'req_desc');
  reset();
});

// ── req_desc ──────────────────────────────────────────────────────────────────

test('handleRequerimiento: req_desc calls createTechRequest', async () => {
  reset();
  await call('req_desc', '2 mouses inalámbricos', { name: 'M', cedula: '1', cargo: 'G', sede: 'CALI' });
  assert.equal(mockCreateTechRequest.mock.calls.length, 1);
  reset();
});

test('handleRequerimiento: req_desc emits tech-request:created event', async () => {
  reset();
  await call('req_desc', '1 monitor', { name: 'M', cedula: '1', cargo: 'G', sede: 'CALI' });
  assert.equal(mockEmit.mock.calls.length, 1);
  assert.equal(mockEmit.mock.calls[0].arguments[0], 'tech-request:created');
  reset();
});

test('handleRequerimiento: req_desc response includes request number', async () => {
  reset();
  mockCreateTechRequest.mock.mockImplementation(() => ({ id: 5, request_number: 'REQ-20260721-005' }));
  const result = await call('req_desc', '1 teclado', { name: 'M', cedula: '1', cargo: 'G', sede: 'C' });
  assert.ok(result.includes('REQ-20260721-005'));
  reset();
});

test('handleRequerimiento: req_desc resets step to idle', async () => {
  reset();
  await call('req_desc', 'materiales', { name: 'A', cedula: '1', cargo: 'B', sede: 'C' });
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
  reset();
});

test('handleRequerimiento: req_desc extracts numeric quantity from prefix', async () => {
  reset();
  await call('req_desc', '3 monitores 24 pulgadas', { name: 'A', cedula: '1', cargo: 'B', sede: 'C' });
  assert.equal(mockCreateTechRequest.mock.calls[0].arguments[1].quantity, 3);
  reset();
});

test('handleRequerimiento: req_desc defaults quantity to 1 without numeric prefix', async () => {
  reset();
  await call('req_desc', 'mouse inalámbrico', { name: 'A', cedula: '1', cargo: 'B', sede: 'C' });
  assert.equal(mockCreateTechRequest.mock.calls[0].arguments[1].quantity, 1);
  reset();
});

test('handleRequerimiento: req_desc passes type=requerimiento to createTechRequest', async () => {
  reset();
  await call('req_desc', 'materiales', { name: 'A', cedula: '1', cargo: 'B', sede: 'C' });
  assert.equal(mockCreateTechRequest.mock.calls[0].arguments[1].type, 'requerimiento');
  reset();
});
