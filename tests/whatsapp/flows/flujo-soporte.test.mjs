import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Mock all dependencies before importing the module ────────────────────────

const mockSetStep     = mock.fn();
const mockGetCtx      = mock.fn(() => ({}));
const mockCrearTicket = mock.fn(async () => ({ id: 42, ticket_number: 'TK-001' }));

await mock.module('../../../src/whatsapp/chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx, crearTicket: mockCrearTicket },
});
await mock.module('../../../src/whatsapp/chatbot-utils.js', {
  exports: { detectPriority: () => 'media' },
});
await mock.module('../../../src/whatsapp/chatbot-config.js', {
  exports: {
    AREA_MAP_FULL:   { '1': 'cartera', '2': 'compra' },
    AREA_MAP_SIMPLE: { '1': 'general' },
    AREA_NAMES:      { cartera: 'Cartera', compra: 'Compra', general: 'General' },
    AREA_EXAMPLES:   { cartera: '- Problemas con el software' },
  },
});

const mockGetAISolution          = mock.fn(async () => null);
const mockGetAISolutionFromImage = mock.fn(async () => null);
await mock.module('../../../src/whatsapp/gemini-service.js', {
  exports: { getAISolution: mockGetAISolution, getAISolutionFromImage: mockGetAISolutionFromImage },
});

const mockSearchFaqsAll = mock.fn(() => []);
await mock.module('../../../src/knowledge/faq-service.js', {
  exports: { searchFaqsAll: mockSearchFaqsAll },
});

const mockEmit = mock.fn();
await mock.module('../../../src/events/broadcaster.js', {
  exports: { appEvents: { emit: mockEmit } },
});

const { handleSoporte } = await import('../../../src/whatsapp/flows/flujo-soporte.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockDb(overrides = {}) {
  return {
    prepare: (sql) => ({
      get: async (...a) => overrides.get?.(sql, ...a)  ?? null,
      run: async (...a) => overrides.run?.(sql, ...a)  ?? { changes: 1, lastInsertRowid: 999 },
      all: async (...a) => overrides.all?.(sql, ...a)  ?? [],
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
  mockGetAISolution.mock.resetCalls();
  mockGetAISolutionFromImage.mock.resetCalls();
  mockSearchFaqsAll.mock.resetCalls();
  mockEmit.mock.resetCalls();
  mockGetAISolution.mock.mockImplementation(async () => null);
  mockGetAISolutionFromImage.mock.mockImplementation(async () => null);
  mockSearchFaqsAll.mock.mockImplementation(() => []);
  mockGetCtx.mock.mockImplementation(() => ({}));
  mockCrearTicket.mock.mockImplementation(async () => ({ id: 42, ticket_number: 'TK-001' }));
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
  await handleSoporte('menu_area_simple', makeCtx({ cleanText: '1' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_name');
});

// ── ask_ticket_name ──────────────────────────────────────────────────────────

test('handleSoporte: menu_area keeps sede/ciudad from previous steps in context', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ sede: 'MI FARMACIA - PEREIRA', ciudad: 'PEREIRA' }));
  await handleSoporte('menu_area', makeCtx({ cleanText: '1' }));
  const ctx = JSON.parse(mockSetStep.mock.calls[0].arguments[4]);
  assert.equal(ctx.sede, 'MI FARMACIA - PEREIRA');
  assert.equal(ctx.ciudad, 'PEREIRA');
  assert.equal(ctx.area, 'cartera');
});

test('handleSoporte: ask_ticket_name → stores name, asks cédula', async () => {
  resetAll();
  const result = await handleSoporte('ask_ticket_name', makeCtx({ text: 'Juan Pérez', cleanText: 'Juan Pérez' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_cedula');
  assert.equal(JSON.parse(mockSetStep.mock.calls[0].arguments[4]).requester_name, 'Juan Pérez');
  assert.ok(result.includes('cédula'));
});

test('handleSoporte: ask_ticket_cedula → stores cédula, asks cargo', async () => {
  resetAll();
  const result = await handleSoporte('ask_ticket_cedula', makeCtx({ text: '1007172156', cleanText: '1007172156' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_cargo');
  assert.equal(JSON.parse(mockSetStep.mock.calls[0].arguments[4]).cedula, '1007172156');
  assert.ok(result.includes('cargo'));
});

test('handleSoporte: ask_ticket_cargo → stores cargo, asks equipo', async () => {
  resetAll();
  const result = await handleSoporte('ask_ticket_cargo', makeCtx({ text: 'Gestor', cleanText: 'Gestor' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ticket_equipo');
  assert.equal(JSON.parse(mockSetStep.mock.calls[0].arguments[4]).cargo, 'Gestor');
  assert.ok(result.includes('equipo'));
});

test('handleSoporte: ask_ticket_equipo → parses serial, sets awaiting_description', async () => {
  resetAll();
  const result = await handleSoporte('ask_ticket_equipo', makeCtx({ text: 'PC HP EliteDesk - serial HP2024001' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'awaiting_description');
  const ctx = JSON.parse(mockSetStep.mock.calls[0].arguments[4]);
  assert.equal(ctx.equipment_name, 'PC HP EliteDesk');
  assert.equal(ctx.equipment_serial, 'HP2024001');
  assert.ok(result.includes('problema'));
});

test('handleSoporte: ask_ticket_equipo without serial → serial null', async () => {
  resetAll();
  await handleSoporte('ask_ticket_equipo', makeCtx({ text: 'Lenovo thinkbook' }));
  const ctx = JSON.parse(mockSetStep.mock.calls[0].arguments[4]);
  assert.equal(ctx.equipment_name, 'Lenovo thinkbook');
  assert.equal(ctx.equipment_serial, null);
});

test('awaiting_description: keeps requester data in context when AI answers', async () => {
  resetAll();
  mockGetAISolution.mock.mockImplementation(async () => 'Reinicia el equipo');
  mockGetCtx.mock.mockImplementation(() => ({ requester_name: 'Andrés', cedula: '123', sede: 'SEDE X' }));
  await handleSoporte('awaiting_description', makeCtx({ text: 'no prende', cleanText: 'no prende' }));
  const ctx = JSON.parse(mockSetStep.mock.calls[0].arguments[4]);
  assert.equal(ctx.requester_name, 'Andrés');
  assert.equal(ctx.cedula, '123');
  assert.equal(ctx.sede, 'SEDE X');
  assert.equal(ctx.description, 'no prende');
});

test('create_ticket: passes requester data to crearTicket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({
    area: 'cartera', description: 'Se apaga solo', requester_name: 'Andrés Parra', cedula: '1007172156',
    cargo: 'Gestor', sede: 'MI FARMACIA - PEREIRA', ciudad: 'PEREIRA', equipment_name: 'Lenovo thinkbook',
  }));
  await handleSoporte('create_ticket', makeCtx({ text: 'no', cleanText: 'no' }));
  const opts = mockCrearTicket.mock.calls[0].arguments[4];
  assert.equal(opts.requesterName, 'Andrés Parra');
  assert.equal(opts.cedula, '1007172156');
  assert.equal(opts.cargo, 'Gestor');
  assert.equal(opts.sede, 'MI FARMACIA - PEREIRA');
  assert.equal(opts.ciudad, 'PEREIRA');
  assert.equal(opts.equipmentName, 'Lenovo thinkbook');
  assert.equal(mockCrearTicket.mock.calls[0].arguments[3], 'Se apaga solo');
});

test('create_ticket: extra detail is appended to original description', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ area: 'cartera', description: 'Se apaga solo' }));
  await handleSoporte('create_ticket', makeCtx({ text: 'Pasa desde ayer', cleanText: 'Pasa desde ayer' }));
  const desc = mockCrearTicket.mock.calls[0].arguments[3];
  assert.ok(desc.includes('Se apaga solo'));
  assert.ok(desc.includes('Pasa desde ayer'));
});

// ── awaiting_description ─────────────────────────────────────────────────────

test('awaiting_description: no AI, no FAQ → route to create_ticket', async () => {
  resetAll();
  const result = await handleSoporte('awaiting_description', makeCtx({
    text: 'no funciona el computador', cleanText: 'no funciona el computador',
  }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'create_ticket');
  assert.ok(result.includes('ticket'));
});

test('awaiting_description: AI solution found → route to ask_resolved', async () => {
  resetAll();
  mockGetAISolution.mock.mockImplementation(async () => 'Reinicia el equipo y vuelve a intentarlo.');
  const result = await handleSoporte('awaiting_description', makeCtx({
    text: 'no funciona excel', cleanText: 'no funciona excel',
  }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_resolved');
  assert.ok(result.includes('Reinicia el equipo') || result.includes('resolvió'));
});

test('awaiting_description: FAQ match (score>=5) → route to ask_resolved', async () => {
  resetAll();
  mockSearchFaqsAll.mock.mockImplementation(() => [{ id: 7, title: 'Cómo reiniciar impresora', solution: 'Apaga y enciende.', score: 6 }]);
  const result = await handleSoporte('awaiting_description', makeCtx({
    text: 'impresora no imprime', cleanText: 'impresora no imprime',
  }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_resolved');
  assert.ok(result.includes('Apaga y enciende'));
});

test('awaiting_description: image → calls getAISolutionFromImage', async () => {
  resetAll();
  mockGetAISolutionFromImage.mock.mockImplementation(async () => 'Solución basada en imagen');
  const result = await handleSoporte('awaiting_description', makeCtx({
    text: '__IMAGE__',
    cleanText: '__IMAGE__',
    media: { imageBase64: 'abc123', mimetype: 'image/jpeg', caption: 'pantalla azul' },
  }));
  assert.equal(mockGetAISolutionFromImage.mock.calls.length, 1);
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_resolved');
});

// ── ask_resolved ─────────────────────────────────────────────────────────────

test('ask_resolved "1": no faq_shown_id → resolved, sets idle', async () => {
  resetAll();
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '1' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
  assert.ok(result.includes('resuelto') || result.includes('Genial'));
});

test('ask_resolved "1": with faq_shown_id → marks faq hit, sets idle', async () => {
  resetAll();
  const runCalls = [];
  const db = makeMockDb({ run: async (sql, ...args) => { runCalls.push({ sql, args }); return { changes: 1 }; } });
  mockGetCtx.mock.mockImplementation(() => ({ faq_shown_id: 7 }));
  await handleSoporte('ask_resolved', makeCtx({ cleanText: '1', db }));
  const faqUpdate = runCalls.find(c => c.sql.includes('faq_hits') && c.sql.includes('resolved=1'));
  assert.ok(faqUpdate, 'should mark faq_hit resolved');
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
});

test('ask_resolved "2": no existing ticket → creates ticket, returns number', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'El equipo no enciende' }));
  mockCrearTicket.mock.mockImplementation(async () => ({ id: 42, ticket_number: 'TK-999' }));
  const db = makeMockDb({
    get: async (sql) => {
      if (sql.includes('status IN')) return null; // no existing open ticket
      return null;
    },
  });
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '2', db }));
  assert.equal(mockCrearTicket.mock.calls.length, 1);
  assert.ok(result.includes('TK-999'));
});

test('ask_resolved "2": existing open ticket → confirm_dup_ticket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'Falla red' }));
  const db = makeMockDb({
    get: async (sql) => {
      if (sql.includes('status IN') && sql.includes('ORDER BY id DESC')) {
        return { ticket_number: 'TK-100' };
      }
      return null;
    },
  });
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '2', db }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'confirm_dup_ticket');
  assert.ok(result.includes('TK-100'));
});

test('ask_resolved "3" → different problem, sets awaiting_description', async () => {
  resetAll();
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: '3' }));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'awaiting_description');
  assert.ok(result.includes('detalle'));
});

test('ask_resolved invalid → reprompt', async () => {
  resetAll();
  const result = await handleSoporte('ask_resolved', makeCtx({ cleanText: 'hola' }));
  assert.ok(result.includes('1') && result.includes('2'));
});

// ── confirm_dup_ticket ────────────────────────────────────────────────────────

test('confirm_dup_ticket "1" → creates new ticket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'Problema diferente' }));
  mockCrearTicket.mock.mockImplementation(async () => ({ id: 42, ticket_number: 'TK-200' }));
  const db = makeMockDb();
  const result = await handleSoporte('confirm_dup_ticket', makeCtx({ cleanText: '1', db }));
  assert.equal(mockCrearTicket.mock.calls.length, 1);
  assert.ok(result.includes('TK-200'));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
});

test('confirm_dup_ticket "2" → appends message to existing ticket', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'Detalles del mismo problema' }));
  const runCalls = [];
  const db = makeMockDb({
    get: async (sql) => {
      if (sql.includes('SELECT * FROM tickets')) return { id: 5, ticket_number: 'TK-050' };
      return null;
    },
    run: async (sql, ...args) => { runCalls.push({ sql, args }); return { changes: 1 }; },
  });
  const result = await handleSoporte('confirm_dup_ticket', makeCtx({ cleanText: '2', db }));
  const inserted = runCalls.find(c => c.sql.includes('INSERT INTO messages'));
  assert.ok(inserted, 'should insert message into existing ticket');
  assert.ok(result.includes('TK-050') || result.includes('agregado'));
});

test('confirm_dup_ticket invalid → reprompt', async () => {
  resetAll();
  const result = await handleSoporte('confirm_dup_ticket', makeCtx({ cleanText: 'nope' }));
  assert.ok(result.includes('1') && result.includes('2'));
});

// ── create_ticket (direct) ────────────────────────────────────────────────────

test('create_ticket → creates ticket, returns number', async () => {
  resetAll();
  mockGetCtx.mock.mockImplementation(() => ({ description: 'Falla previa' }));
  const db = makeMockDb();
  const result = await handleSoporte('create_ticket', makeCtx({
    text: 'Detalles adicionales', cleanText: 'detalles adicionales', db,
  }));
  assert.equal(mockCrearTicket.mock.calls.length, 1);
  assert.ok(result.includes('TK-001'));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'idle');
});
