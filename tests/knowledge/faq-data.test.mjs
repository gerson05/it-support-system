import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFaqsByArea, searchFaqs } from '../../src/knowledge/faq-data.js';

// ── getFaqsByArea ─────────────────────────────────────────────────────────────

test('getFaqsByArea: general returns only general faqs', () => {
  const result = getFaqsByArea('general');
  assert.ok(result.length > 0);
  assert.ok(result.every(f => f.area === 'general'));
});

test('getFaqsByArea: specific area returns area faqs followed by general', () => {
  const result = getFaqsByArea('cartera');
  const byArea = result.filter(f => f.area === 'cartera');
  const byGen  = result.filter(f => f.area === 'general');
  assert.ok(byArea.length > 0);
  assert.ok(byGen.length > 0);
  assert.equal(result[0].area, 'cartera');
});

test('getFaqsByArea: unknown area returns general faqs only', () => {
  const result = getFaqsByArea('area_inexistente_xyz');
  assert.ok(result.length > 0);
  assert.ok(result.every(f => f.area === 'general'));
});

test('getFaqsByArea: farmacia returns farmacia + general', () => {
  const result = getFaqsByArea('farmacia');
  const farm = result.filter(f => f.area === 'farmacia');
  assert.ok(farm.length > 0);
  assert.equal(result[0].area, 'farmacia');
});

// ── searchFaqs ────────────────────────────────────────────────────────────────

test('searchFaqs: null query returns all area faqs (no scoring)', () => {
  const result = searchFaqs('general', null);
  assert.ok(result.length > 0);
});

test('searchFaqs: keyword match returns results with score > 0', () => {
  const result = searchFaqs('general', 'contraseña');
  assert.ok(result.length > 0);
  assert.ok(result.every(f => f.score > 0));
});

test('searchFaqs: results ordered by score descending', () => {
  const result = searchFaqs('general', 'impresora');
  assert.ok(result.length > 0);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].score >= result[i].score);
  }
});

test('searchFaqs: title match (score +15) produces high score', () => {
  const result = searchFaqs('general', 'contraseña');
  const top = result[0];
  assert.ok(top.score >= 15, `Expected score >= 15, got ${top.score}`);
});

test('searchFaqs: no match returns empty array', () => {
  const result = searchFaqs('general', 'xyzqwerty123nomatch');
  assert.deepEqual(result, []);
});

test('searchFaqs: partial word match (> 3 chars) contributes to score', () => {
  // 'imprim' included in keyword 'imprimir' → kwClean.includes(word) = true
  const result = searchFaqs('general', 'imprim ayuda');
  assert.ok(result.length > 0);
});

test('searchFaqs: area-specific keyword matched against correct area', () => {
  const result = searchFaqs('cartera', 'cobros');
  assert.ok(result.length > 0);
  const carteraHit = result.find(f => f.area === 'cartera');
  assert.ok(carteraHit);
});

test('searchFaqs: all returned faqs have score property', () => {
  const result = searchFaqs('general', 'vpn');
  assert.ok(result.length > 0);
  assert.ok(result.every(f => typeof f.score === 'number'));
});

test('searchFaqs: accent-insensitive match', () => {
  const result = searchFaqs('general', 'impresion');
  const normalized = searchFaqs('general', 'impresión');
  assert.ok(result.length === normalized.length);
});
