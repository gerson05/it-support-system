import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildMantisPayload, isMantisConfigured, createUser } from '../../src/mantis/mantis-client.js';

const original = process.env.MANTIS_API_URL;
afterEach(() => {
  if (original === undefined) delete process.env.MANTIS_API_URL;
  else process.env.MANTIS_API_URL = original;
});

test('buildMantisPayload: the fields Mantis needs to create a user', () => {
  const emp = {
    usuario: 'GGOSORIO', cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', perfil_codigo: 10,
    contraseña: '4821', bodega_codigo: 581, comprobante: 'PAS', area: 'ignored',
  };
  assert.deepEqual(buildMantisPayload(emp), {
    usuario: 'GGOSORIO', identificacion: '1001', nombre: 'Gladys Garcia Osorio',
    codigo_perfil: 10, clave: '4821', bodega: 581, comprobante: 'PAS',
  });
});

test('createUser: not configured → MANTIS_NOT_CONFIGURED', async () => {
  delete process.env.MANTIS_API_URL;
  assert.equal(isMantisConfigured(), false);
  await assert.rejects(() => createUser({}), { code: 'MANTIS_NOT_CONFIGURED' });
});

test('createUser: configured but not implemented yet', async () => {
  process.env.MANTIS_API_URL = 'https://mantis.example/api';
  assert.equal(isMantisConfigured(), true);
  await assert.rejects(() => createUser({ usuario: 'X' }), { code: 'MANTIS_NOT_IMPLEMENTED' });
});
