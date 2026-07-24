import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPriority, checkRateLimit, getBusinessStatus, nextBusinessDay } from '../../src/whatsapp/chatbot-utils.js';

// ── detectPriority ────────────────────────────────────────────────────────────

test('detectPriority: null/empty → media', () => {
  assert.equal(detectPriority(null), 'media');
  assert.equal(detectPriority(''), 'media');
  assert.equal(detectPriority(undefined), 'media');
});

test('detectPriority: generic problem → media', () => {
  assert.equal(detectPriority('El Excel no abre'), 'media');
  assert.equal(detectPriority('No imprime en color'), 'media');
});

test('detectPriority: critica — toda la sede sin internet', () => {
  assert.equal(detectPriority('Toda la sede sin internet'), 'critica');
});

test('detectPriority: critica — sistema caído', () => {
  assert.equal(detectPriority('El sistema cayó y no podemos trabajar'), 'critica');
});

test('detectPriority: critica — producción parada', () => {
  assert.equal(detectPriority('produccion parada por falla eléctrica'), 'critica');
});

test('detectPriority: critica — todos los equipos afectados', () => {
  assert.equal(detectPriority('todos los equipos del área no encienden'), 'critica');
});

test('detectPriority: critica — pérdida de datos', () => {
  assert.equal(detectPriority('perdida de datos en el servidor'), 'critica');
});

test('detectPriority: alta — urgente', () => {
  assert.equal(detectPriority('Es urgente, no puedo entrar al sistema'), 'alta');
});

test('detectPriority: alta — bloqueado completamente', () => {
  assert.equal(detectPriority('estoy bloqueado completamente no puedo hacer nada'), 'alta');
});

test('detectPriority: alta — desde ayer sin funcionar', () => {
  assert.equal(detectPriority('desde ayer no funciona el programa'), 'alta');
});

test('detectPriority: alta — borro archivos', () => {
  assert.equal(detectPriority('se borro todo el directorio'), 'alta');
});

test('detectPriority: alta — toda la mañana sin solución', () => {
  assert.equal(detectPriority('toda la mañana sin poder imprimir'), 'alta');
});

test('detectPriority: case insensitive', () => {
  assert.equal(detectPriority('URGENTE problema con el sistema'), 'alta');
  assert.equal(detectPriority('TODA LA SEDE SIN INTERNET'), 'critica');
});

// ── checkRateLimit ────────────────────────────────────────────────────────────

test('checkRateLimit: first call → allowed', () => {
  assert.equal(checkRateLimit('test-phone-unique-1'), true);
});

test('checkRateLimit: 20 calls → all allowed', () => {
  const phone = 'test-phone-unique-2';
  for (let i = 0; i < 20; i++) {
    assert.equal(checkRateLimit(phone), true, `call ${i + 1} should be allowed`);
  }
});

test('checkRateLimit: 21st call → blocked', () => {
  const phone = 'test-phone-unique-3';
  for (let i = 0; i < 20; i++) checkRateLimit(phone);
  assert.equal(checkRateLimit(phone), false);
});

test('checkRateLimit: different phones are independent', () => {
  const p1 = 'phone-a-unique';
  const p2 = 'phone-b-unique';
  for (let i = 0; i < 20; i++) checkRateLimit(p1);
  assert.equal(checkRateLimit(p1), false);
  assert.equal(checkRateLimit(p2), true);
});

// ── getBusinessStatus ─────────────────────────────────────────────────────────

test('getBusinessStatus: returns one of open|closing|closed', () => {
  const status = getBusinessStatus();
  assert.ok(['open', 'closing', 'closed'].includes(status), `unexpected: ${status}`);
});

// ── nextBusinessDay ───────────────────────────────────────────────────────────

test('nextBusinessDay: returns string with day name in Spanish', () => {
  const result = nextBusinessDay();
  const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
  const hasDay = DAYS.some(d => result.includes(d));
  assert.ok(hasDay, `expected a weekday name in: "${result}"`);
});

test('nextBusinessDay: never returns weekend day', () => {
  const result = nextBusinessDay();
  assert.ok(!result.includes('sábado'), 'should not be Saturday');
  assert.ok(!result.includes('domingo'), 'should not be Sunday');
});

test('nextBusinessDay: includes month name in Spanish', () => {
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const result = nextBusinessDay();
  const hasMonth = MONTHS.some(m => result.includes(m));
  assert.ok(hasMonth, `expected a month name in: "${result}"`);
});
