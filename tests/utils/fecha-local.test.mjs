import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_TZ, APP_UTC_OFFSET } from '../../src/config/timezone.js';
import { fechaLocal, fechaCompacta, fechaHoraLocal } from '../../src/utils/fecha-local.js';

test('timezone: process runs on Colombia time', () => {
  assert.equal(APP_TZ, 'America/Bogota');
  assert.equal(APP_UTC_OFFSET, '-05:00');
  assert.ok(process.env.TZ);
});

test('fecha-local: formats with local getters, zero-padded', () => {
  const d = new Date(2026, 0, 5, 7, 3, 9); // 5 ene 2026 07:03:09 local
  assert.equal(fechaLocal(d), '2026-01-05');
  assert.equal(fechaCompacta(d), '20260105');
  assert.equal(fechaHoraLocal(d), '2026-01-05 07:03:09');
});

test('fecha-local: 8 p.m. in Colombia is still the same day (UTC is already the next day)', () => {
  process.env.TZ = 'America/Bogota';
  const d = new Date('2026-10-08T01:30:00Z'); // 7 oct 20:30 en Colombia
  assert.equal(fechaLocal(d), '2026-10-07');
  assert.equal(fechaHoraLocal(d), '2026-10-07 20:30:00');
  assert.match(fechaHoraLocal(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});
