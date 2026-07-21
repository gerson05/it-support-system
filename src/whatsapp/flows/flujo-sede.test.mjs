import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockSetStep = mock.fn();
const mockGetCtx  = mock.fn(() => ({}));

await mock.module('../chatbot-session.js', {
  exports: { setStep: mockSetStep, getCtx: mockGetCtx },
});

const mockMatchCiudad    = mock.fn(() => []);
const mockGetPuntosCiudad = mock.fn(() => []);
const mockDisplaySede    = mock.fn(s => (s || '').replace('MI FARMACIA - ', ''));

await mock.module('../sedes.js', {
  exports: {
    matchCiudad:     mockMatchCiudad,
    getPuntosCiudad: mockGetPuntosCiudad,
    displaySede:     mockDisplaySede,
  },
});

await mock.module('../chatbot-config.js', {
  exports: {
    AREA_MAP_FULL:   { '1': 'cartera', '2': 'compra', '3': 'gestion_humana',
                       '4': 'pqrs',    '5': 'contabilidad', '6': 'farmacia', '7': 'cuentas_medicas' },
    AREA_MAP_SIMPLE: { '1': 'general', '2': 'farmacia' },
  },
});

const { isSedeCompleta, routeAfterSede, handleSede } = await import('./flujo-sede.js');

function makeDb() {
  return { prepare: () => ({ run: () => {}, get: () => null, all: () => [] }) };
}

function makeArgs(step, text, cleanText, ctxOverride = {}) {
  mockGetCtx.mock.mockImplementation(() => ({ ...ctxOverride }));
  return { step, text, cleanText, session: {}, phone: '573001234567', db: makeDb() };
}

function reset() {
  mockSetStep.mock.resetCalls();
  mockGetCtx.mock.resetCalls();
  mockMatchCiudad.mock.resetCalls();
  mockGetPuntosCiudad.mock.resetCalls();
  mockGetCtx.mock.mockImplementation(() => ({}));
}

// ── isSedeCompleta ────────────────────────────────────────────────────────────

test('isSedeCompleta: true for string containing SEDE PRINCIPAL', () => {
  assert.equal(isSedeCompleta('MEDIVALLE - SEDE PRINCIPAL'), true);
});

test('isSedeCompleta: false for branch sede', () => {
  assert.equal(isSedeCompleta('MI FARMACIA - MANIZALES'), false);
});

test('isSedeCompleta: false for empty string', () => {
  assert.equal(isSedeCompleta(''), false);
});

test('isSedeCompleta: false for null', () => {
  assert.equal(isSedeCompleta(null), false);
});

test('isSedeCompleta: case-insensitive (lowercase sede principal)', () => {
  assert.equal(isSedeCompleta('sede principal cali'), true);
});

// ── routeAfterSede ────────────────────────────────────────────────────────────

test('routeAfterSede: flowType 1 + sede principal → menu_area with full menu', () => {
  const r = routeAfterSede('1', 'SEDE PRINCIPAL', 'MEDIVALLE - SEDE PRINCIPAL');
  assert.equal(r.step, 'menu_area');
  assert.ok(r.msg.includes('Cartera'));
  assert.ok(r.msg.includes('Farmacia'));
});

test('routeAfterSede: flowType 1 + branch sede → menu_area_simple', () => {
  const r = routeAfterSede('1', 'MANIZALES', 'MI FARMACIA - MANIZALES');
  assert.equal(r.step, 'menu_area_simple');
  assert.ok(r.msg.includes('Administrativo'));
});

test('routeAfterSede: flowType 2 → req_name regardless of sede', () => {
  const r = routeAfterSede('2', 'CALI SUR', 'MI FARMACIA - CALI SUR');
  assert.equal(r.step, 'req_name');
  assert.ok(r.msg.includes('nombre completo'));
});

test('routeAfterSede: flowType 3 → inc_name', () => {
  const r = routeAfterSede('3', 'PASTO', 'MI FARMACIA - PASTO');
  assert.equal(r.step, 'inc_name');
  assert.ok(r.msg.includes('nombre completo'));
});

test('routeAfterSede: unknown flowType → inc_name', () => {
  const r = routeAfterSede('99', 'CALI', 'MI FARMACIA - CALI SUR');
  assert.equal(r.step, 'inc_name');
});

test('routeAfterSede: msg always contains sede label', () => {
  const r = routeAfterSede('2', 'PEREIRA', 'MI FARMACIA - PEREIRA');
  assert.ok(r.msg.includes('PEREIRA'));
});

// ── handleSede ────────────────────────────────────────────────────────────────

test('handleSede: unknown step returns null', () => {
  assert.equal(handleSede('idle', makeArgs('idle', '', '')), null);
  reset();
});

test('handleSede: select_type valid option 1 sets step to ask_ciudad', () => {
  const args = makeArgs('select_type', '1', '1');
  handleSede('select_type', args);
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ciudad');
  reset();
});

test('handleSede: select_type valid option 2 sets step to ask_ciudad', () => {
  const args = makeArgs('select_type', '2', '2');
  handleSede('select_type', args);
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'ask_ciudad');
  reset();
});

test('handleSede: select_type invalid option returns error message', () => {
  const result = handleSede('select_type', makeArgs('select_type', '9', '9'));
  assert.ok(result.includes('válida') || result.includes('1'));
  reset();
});

test('handleSede: ask_ciudad no match returns not-found message', () => {
  mockGetCtx.mock.mockImplementation(() => ({ flowType: '1' }));
  mockMatchCiudad.mock.mockImplementation(() => []);
  const result = handleSede('ask_ciudad', makeArgs('ask_ciudad', 'ciudadnomatch', 'ciudadnomatch'));
  assert.ok(result.includes('No encontré'));
  reset();
});

test('handleSede: ask_ciudad multiple matches shows selection list', () => {
  mockGetCtx.mock.mockImplementation(() => ({ flowType: '1' }));
  mockMatchCiudad.mock.mockImplementation(() => ['CALI', 'CALIMA']);
  const result = handleSede('ask_ciudad', makeArgs('ask_ciudad', 'cal', 'cal'));
  assert.ok(result.includes('varias ciudades'));
  reset();
});

test('handleSede: ask_ciudad single city single punto routes directly', () => {
  mockMatchCiudad.mock.mockImplementation(() => ['MANIZALES']);
  mockGetPuntosCiudad.mock.mockImplementation(() => ['MI FARMACIA - MANIZALES']);
  // pass ctx via makeArgs so it isn't overridden
  handleSede('ask_ciudad', makeArgs('ask_ciudad', 'manizales', 'manizales', { flowType: '2' }));
  assert.equal(mockSetStep.mock.calls.length, 1);
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'req_name');
  reset();
});

test('handleSede: ask_ciudad single city multiple puntos shows punto list', () => {
  mockGetCtx.mock.mockImplementation(() => ({ flowType: '1' }));
  mockMatchCiudad.mock.mockImplementation(() => ['CALI']);
  mockGetPuntosCiudad.mock.mockImplementation(() => ['MEDIVALLE - SEDE PRINCIPAL', 'MI FARMACIA - CALI SUR']);
  const result = handleSede('ask_ciudad', makeArgs('ask_ciudad', 'cali', 'cali'));
  assert.ok(result.includes('punto de atención'));
  reset();
});

test('handleSede: ask_ciudad_confirm invalid index returns error', () => {
  mockGetCtx.mock.mockImplementation(() => ({ ciudad_candidates: ['CALI', 'CALIMA'] }));
  const result = handleSede('ask_ciudad_confirm', makeArgs('ask_ciudad_confirm', '9', '9'));
  assert.ok(result.includes('válida') || result.includes('número'));
  reset();
});

test('handleSede: ask_punto invalid index returns error', () => {
  mockGetCtx.mock.mockImplementation(() => ({ flowType: '1', punto_options: ['OPT1', 'OPT2'] }));
  const result = handleSede('ask_punto', makeArgs('ask_punto', '9', '9'));
  assert.ok(result.includes('válida') || result.includes('número'));
  reset();
});

test('handleSede: ask_punto valid index sets step', () => {
  const ctx = { flowType: '2', punto_options: ['MI FARMACIA - CALI SUR', 'MI FARMACIA - CALI NORTE'] };
  handleSede('ask_punto', makeArgs('ask_punto', '1', '1', ctx));
  assert.equal(mockSetStep.mock.calls[0].arguments[2], 'req_name');
  reset();
});
