import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinatarioDe, telefonoDe } from '../../src/inventario/campos-unificados.js';

test('destinatarioDe: one field for responsable / nombre completo', () => {
  assert.equal(destinatarioDe({ nombre_completo: ' Ana Gómez ' }), 'Ana Gómez');
  assert.equal(destinatarioDe({ nombre_completo: 'Ana', responsable: 'Otro' }), 'Ana');
  assert.equal(destinatarioDe({ responsable: 'Juan' }), 'Juan'); // datos/importaciones antiguas
  assert.equal(destinatarioDe({ nombre_completo: '  ', responsable: '' }), null);
  assert.equal(destinatarioDe(), null);
});

test('telefonoDe: one field for línea / número de teléfono', () => {
  assert.equal(telefonoDe({ numero_telefono: '3001234567' }), '3001234567');
  assert.equal(telefonoDe({ numero_telefono: '3001234567', linea: '3110000000' }), '3001234567');
  assert.equal(telefonoDe({ linea: 3110000000 }), '3110000000');
  assert.equal(telefonoDe({ numero_telefono: null, linea: undefined }), null);
  assert.equal(telefonoDe(), null);
});
