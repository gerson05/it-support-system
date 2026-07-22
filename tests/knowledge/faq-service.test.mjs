import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFaqsAll, getAllFaqsForArea } from '../../src/knowledge/faq-service.js';

function makeDb(customRows = []) {
  return { prepare: () => ({ all: () => customRows }) };
}

function makeFailingDb() {
  return { prepare: () => ({ all: () => { throw new Error('DB unavailable'); } }) };
}

const CUSTOM_FAQ = {
  id: 99, area: 'general', title: 'Problema especial con contraseña',
  keywords: JSON.stringify(['especial', 'contraseña']),
  solution: 'Solución custom', active: 1,
};

// ── searchFaqsAll ─────────────────────────────────────────────────────────────

test('searchFaqsAll: no query returns static faqs', () => {
  const result = searchFaqsAll(makeDb(), 'general', null);
  assert.ok(result.length > 0);
});

test('searchFaqsAll: db error still returns static results', () => {
  const result = searchFaqsAll(makeFailingDb(), 'general', 'impresora');
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
});

test('searchFaqsAll: custom faq appears in merged results', () => {
  const result = searchFaqsAll(makeDb([CUSTOM_FAQ]), 'general', 'especial contraseña');
  assert.ok(result.find(f => f.id === 99));
});

test('searchFaqsAll: results sorted by score descending', () => {
  const result = searchFaqsAll(makeDb([]), 'general', 'contraseña');
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].score >= result[i].score);
  }
});

test('searchFaqsAll: title match scores custom faq highly', () => {
  const result = searchFaqsAll(makeDb([CUSTOM_FAQ]), 'general', 'problema especial con contraseña');
  const custom = result.find(f => f.id === 99);
  assert.ok(custom);
  assert.ok(custom.score >= 15);
});

test('searchFaqsAll: custom faq keywords parsed from JSON string', () => {
  const result = searchFaqsAll(makeDb([CUSTOM_FAQ]), 'general', null);
  const custom = result.find(f => f.id === 99);
  assert.ok(custom);
  assert.ok(Array.isArray(custom.keywords));
});

test('searchFaqsAll: no query custom faqs have score=0', () => {
  const result = searchFaqsAll(makeDb([CUSTOM_FAQ]), 'general', null);
  const custom = result.find(f => f.id === 99);
  assert.ok(custom);
  assert.equal(custom.score, 0);
});

test('searchFaqsAll: keyword-only custom faq match scores positive', () => {
  const faq = { id: 88, area: 'general', title: 'Otro título', keywords: JSON.stringify(['teclado']), solution: 'S', active: 1 };
  const result = searchFaqsAll(makeDb([faq]), 'general', 'teclado no funciona');
  const found = result.find(f => f.id === 88);
  assert.ok(found);
  assert.ok(found.score > 0);
});

// ── getAllFaqsForArea ─────────────────────────────────────────────────────────

test('getAllFaqsForArea: returns both custom and system keys', () => {
  const result = getAllFaqsForArea(makeDb([CUSTOM_FAQ]), 'general');
  assert.ok(Array.isArray(result.custom));
  assert.ok(Array.isArray(result.system));
});

test('getAllFaqsForArea: custom faqs have source=custom', () => {
  const result = getAllFaqsForArea(makeDb([CUSTOM_FAQ]), 'general');
  assert.ok(result.custom.every(f => f.source === 'custom'));
});

test('getAllFaqsForArea: system faqs have source=system', () => {
  const result = getAllFaqsForArea(makeDb([]), 'general');
  assert.ok(result.system.every(f => f.source === 'system'));
});

test('getAllFaqsForArea: db error returns empty custom array', () => {
  const result = getAllFaqsForArea(makeFailingDb(), 'general');
  assert.deepEqual(result.custom, []);
  assert.ok(result.system.length > 0);
});

test('getAllFaqsForArea: keywords parsed from JSON string', () => {
  const faq = { id: 1, area: 'cartera', title: 'T', keywords: '["uno","dos"]', solution: 'S', active: 1 };
  const result = getAllFaqsForArea(makeDb([faq]), 'cartera');
  assert.deepEqual(result.custom[0].keywords, ['uno', 'dos']);
});

// ── word-level keyword matching (line 49) ─────────────────────────────────────

test('searchFaqsAll: word-level keyword scoring when keyword contains a query word', () => {
  // keyword 'impresora laser' — cleanQuery 'laser falla'
  // cleanQuery.includes('impresora laser') = false
  // 'impresora laser'.includes('laser falla') = false  → hits line 49
  // queryWord 'laser': 'impresora laser'.includes('laser') = true → score += 2
  const faq = {
    id: 77, area: 'general', title: 'Irrelevante xyz',
    keywords: JSON.stringify(['impresora laser']),
    solution: 'S', active: 1,
  };
  const result = searchFaqsAll(makeDb([faq]), 'general', 'laser falla');
  const found = result.find(f => f.id === 77);
  assert.ok(found, 'faq should appear in results');
  assert.ok(found.score >= 2, `score should be >= 2, got ${found?.score}`);
});
