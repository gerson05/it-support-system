import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroALetras, formatoPesos, fechaLarga, hoyIso,
  normCedula, normTexto, normGenero, normEstado, normSalario, normFecha, normTipoContrato,
} from '../../src/hr/formato.js';

test('numeroALetras: salaries and edge cases', () => {
  assert.equal(numeroALetras(1850905), 'UN MILLÓN OCHOCIENTOS CINCUENTA MIL NOVECIENTOS CINCO');
  assert.equal(numeroALetras(249095), 'DOSCIENTOS CUARENTA Y NUEVE MIL NOVENTA Y CINCO');
  assert.equal(numeroALetras(2100000), 'DOS MILLONES CIEN MIL');
  assert.equal(numeroALetras(21000), 'VEINTIÚN MIL');
  assert.equal(numeroALetras(31500000), 'TREINTA Y UN MILLONES QUINIENTOS MIL');
  assert.equal(numeroALetras(1001000), 'UN MILLÓN MIL');
  assert.equal(numeroALetras(100), 'CIEN');
  assert.equal(numeroALetras(101), 'CIENTO UNO');
  assert.equal(numeroALetras(16), 'DIECISÉIS');
  assert.equal(numeroALetras(0), 'CERO');
  assert.equal(numeroALetras('abc'), 'CERO');
});

test('formatoPesos / fechaLarga / hoyIso', () => {
  assert.equal(formatoPesos(1850905), '$1.850.905');
  assert.equal(formatoPesos(0), '$0');
  assert.equal(fechaLarga('2017-03-07'), '7 de marzo de 2017');
  assert.equal(fechaLarga('2024-12-31'), '31 de diciembre de 2024');
  assert.equal(fechaLarga('mal'), '');
  assert.equal(hoyIso(new Date(2026, 9, 2)), '2026-10-02');
  assert.match(hoyIso(), /^\d{4}-\d{2}-\d{2}$/);
});

test('normCedula / normTexto', () => {
  assert.equal(normCedula('1.107.095.763'), '1107095763');
  assert.equal(normCedula(1107095763), '1107095763');
  assert.equal(normCedula('1107095763.0'), '1107095763');
  assert.equal(normCedula('12'), null);
  assert.equal(normCedula(''), null);
  assert.equal(normTexto('  Ana   Maria '), 'Ana Maria');
  assert.equal(normTexto('  '), null);
});

test('normGenero / normEstado', () => {
  assert.equal(normGenero('m'), 'M');
  assert.equal(normGenero('Femenino'), 'F');
  assert.equal(normGenero('E'), null);
  assert.equal(normEstado('a'), 'A');
  assert.equal(normEstado('Retirado'), 'I');
  assert.equal(normEstado('x'), null);
});

test('normSalario: numbers and formatted text', () => {
  assert.equal(normSalario(1850905.4), 1850905);
  assert.equal(normSalario('$1.850.905'), 1850905);
  assert.equal(normSalario('1,850,905'), 1850905);
  assert.equal(normSalario('2400000'), 2400000);
  assert.equal(normSalario(0), null);
  assert.equal(normSalario(''), null);
  assert.equal(normSalario('n/a'), null);
});

test('normFecha: Date, Excel serial, day/month/year text, ISO', () => {
  assert.equal(normFecha(new Date(Date.UTC(2017, 2, 7))), '2017-03-07');
  assert.equal(normFecha(42801), '2017-03-07');
  assert.equal(normFecha('01/02/2019'), '2019-02-01', 'day/month, not US month/day');
  assert.equal(normFecha('7-3-2017'), '2017-03-07');
  assert.equal(normFecha('21/07/26 10:31'), '2026-07-21');
  assert.equal(normFecha('2017-3-7'), '2017-03-07');
  assert.equal(normFecha(''), null);
  assert.equal(normFecha(5), null);
  assert.equal(normFecha(new Date('invalid')), null);
});

test('normTipoContrato: codes and free text', () => {
  assert.equal(normTipoContrato('TERF'), 'a término fijo');
  assert.equal(normTipoContrato('Término Indefinido'), 'a término indefinido');
  assert.equal(normTipoContrato('OBRA O LABOR'), 'por obra o labor');
  assert.equal(normTipoContrato('APRE'), 'de aprendizaje');
  assert.equal(normTipoContrato('Prestación de servicios'), 'prestación de servicios');
  assert.equal(normTipoContrato(''), null);
});

test('separarMiles', async () => {
  const { separarMiles } = await import('../../src/hr/formato.js');
  assert.equal(separarMiles('1130658563'), '1.130.658.563');
  assert.equal(separarMiles('123'), '123');
  assert.equal(separarMiles(''), '');
  assert.equal(separarMiles(null), '');
});
