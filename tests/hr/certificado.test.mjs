import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { docxFixture, textoDocx } from '../helpers/docx-fixture.mjs';
import {
  camposFaltantes, aplicaAuxilio, valoresCertificado, generarDocx, marcadoresEnPlantilla, MARCADORES,
} from '../../src/hr/certificado.js';

const CONFIG = { auxilio_transporte: '249095', salario_minimo: '' };
const ACTIVO = {
  cedula: '1130658563', nombre: 'ANA DEMO', genero: 'F', cargo: 'TELEFONISTA',
  tipo_contrato: 'a término fijo', fecha_ingreso: '2017-03-07', estado: 'A', salario: 1850905,
};
const RETIRADO = { ...ACTIVO, genero: 'M', nombre: 'LUIS DEMO', estado: 'I', fecha_retiro: '2025-06-30' };

test('camposFaltantes: activo needs salary, retirado needs retiro date', () => {
  assert.deepEqual(camposFaltantes(ACTIVO), []);
  assert.deepEqual(camposFaltantes({ ...ACTIVO, salario: null }), ['salario']);
  assert.deepEqual(camposFaltantes({ cedula: '1', estado: 'A' }), ['nombre', 'cargo', 'tipo_contrato', 'fecha_ingreso', 'salario']);
  assert.deepEqual(camposFaltantes({ ...RETIRADO, salario: null }), []);
  assert.deepEqual(camposFaltantes({ ...ACTIVO, estado: 'I', fecha_retiro: null }), ['fecha_retiro']);
});

test('aplicaAuxilio: up to 2 minimum wages; always when no minimum configured; never if 0', () => {
  assert.equal(aplicaAuxilio(5000000, CONFIG), true);
  assert.equal(aplicaAuxilio(3000000, { auxilio_transporte: '249095', salario_minimo: '1750905' }), true);
  assert.equal(aplicaAuxilio(3600000, { auxilio_transporte: '249095', salario_minimo: '1750905' }), false);
  assert.equal(aplicaAuxilio(1000000, { auxilio_transporte: '0', salario_minimo: '' }), false);
});

test('valoresCertificado: active employee, full text with salary and allowance', () => {
  const v = valoresCertificado(ACTIVO, CONFIG, '2026-10-02');
  assert.equal(v.tipo, 'activo');
  assert.equal(v.fecha_expedicion, '2 de octubre de 2026');
  assert.equal(v.tratamiento, 'la señora');
  assert.equal(v.identificado, 'identificada');
  assert.equal(v.cedula, '1.130.658.563');
  assert.equal(v.verbo_contrato, 'celebra');
  assert.equal(v.periodo, 'desde el 7 de marzo de 2017');
  assert.match(v.parrafo_cargo, /^Actualmente desempeña el cargo de TELEFONISTA, con un salario mensual de UN MILLÓN OCHOCIENTOS CINCUENTA MIL NOVECIENTOS CINCO PESOS \(\$1\.850\.905\); y de acuerdo .* \$249\.095\.$/);
  assert.equal(v.salario, '$1.850.905');
  assert.equal(v.salario_letras, 'UN MILLÓN OCHOCIENTOS CINCUENTA MIL NOVECIENTOS CINCO PESOS');
});

test('valoresCertificado: active above 2 minimum wages has no allowance', () => {
  const v = valoresCertificado({ ...ACTIVO, salario: 5000000 }, { auxilio_transporte: '249095', salario_minimo: '1750905' }, '2026-10-02');
  assert.match(v.parrafo_cargo, /\(\$5\.000\.000\)\.$/);
  assert.doesNotMatch(v.parrafo_cargo, /Auxilio/);
});

test('valoresCertificado: retired employee, past tense and no amounts', () => {
  const v = valoresCertificado(RETIRADO, CONFIG, '2026-10-02');
  assert.equal(v.tipo, 'retirado');
  assert.equal(v.tratamiento, 'el señor');
  assert.equal(v.identificado, 'identificado');
  assert.equal(v.verbo_contrato, 'celebró');
  assert.equal(v.periodo, 'desde el 7 de marzo de 2017 hasta el 30 de junio de 2025');
  assert.equal(v.parrafo_cargo, 'Desempeñó el cargo de TELEFONISTA.');
  assert.equal(v.salario, '');
  assert.equal(v.salario_letras, '');
});

test('valoresCertificado: unknown gender uses neutral wording; defaults to today', () => {
  const v = valoresCertificado({ ...ACTIVO, genero: null, cargo: null, tipo_contrato: null, nombre: null, cedula: null });
  assert.equal(v.tratamiento, 'el(la) señor(a)');
  assert.equal(v.identificado, 'identificado(a)');
  assert.equal(v.nombre, '');
  assert.equal(v.tipo_contrato, '');
  assert.ok(v.fecha_expedicion);
});

test('generarDocx: fills split markers keeping run formatting, header too, unknown markers untouched', () => {
  const out = generarDocx(docxFixture(), { ...valoresCertificado(ACTIVO, CONFIG, '2026-10-02'), nombre: 'ANA & CÍA <DEMO>' });
  const parrafos = textoDocx(out).filter(Boolean);
  assert.equal(parrafos[0], 'Santiago de Cali, 2 de octubre de 2026.');
  assert.equal(parrafos[1],
    'hace constar que la señora ANA &amp; CÍA &lt;DEMO&gt;, identificada con cédula 1.130.658.563, celebra un contrato a término fijo desde el 7 de marzo de 2017.');
  assert.match(parrafos[2], /^Actualmente desempeña/);
  assert.equal(parrafos[3], 'Desconocido: {{otro_campo}} & listo');
  assert.deepEqual(textoDocx(out, 'word/header1.xml'), ['Ref: 1.130.658.563']);

  const xml = new AdmZip(out).readAsText('word/document.xml');
  assert.match(xml, /<w:b\/><w:sz w:val="24"\/><\/w:rPr><w:t xml:space="preserve">ANA &amp; CÍA &lt;DEMO&gt;<\/w:t>/, 'name stays in the bold run');
  assert.match(xml, /<w:p w14:paraId="1"\/>/, 'empty self-closing paragraph untouched');
  assert.match(xml, /<w:bookmarkStart w:id="0" w:name="_x"\/>/, 'bookmarks kept');
  assert.ok(new AdmZip(out).getEntry('word/media/image1.png'), 'images kept');
});

test('generarDocx: paragraphs without markers are not rewritten', () => {
  const fixture = docxFixture({ cuerpo: '<w:p><w:r><w:t>Sin campos</w:t></w:r></w:p>' });
  const out = generarDocx(fixture, {});
  assert.match(new AdmZip(out).readAsText('word/document.xml'), /<w:t>Sin campos<\/w:t>/);
});

test('marcadoresEnPlantilla: lists markers across document and header', () => {
  assert.deepEqual(marcadoresEnPlantilla(docxFixture()).sort(), [
    'cedula', 'fecha_expedicion', 'identificado', 'nombre', 'otro_campo', 'parrafo_cargo',
    'periodo', 'tipo_contrato', 'tratamiento', 'verbo_contrato',
  ]);
  assert.ok(MARCADORES.parrafo_cargo);
});

test('generarDocx: tolerates odd XML (tags that start with <w:p, unclosed paragraph)', () => {
  const cuerpo = '<w:pPr/><w:pict/><w:p><w:r><w:t>{{cedula}}</w:t></w:r></w:p><w:p><w:r><w:t>{{nombre}}';
  const out = generarDocx(docxFixture({ cuerpo, encabezado: 'x' }), { cedula: '1.234', nombre: 'NO' });
  const xml = new AdmZip(out).readAsText('word/document.xml');
  assert.match(xml, /<w:pPr\/><w:pict\/>/);
  assert.match(xml, /<w:t xml:space="preserve">1\.234<\/w:t>/);
  assert.match(xml, /\{\{nombre\}\}/, 'unclosed paragraph left as is');
  // <w:tab/> no se confunde con un nodo de texto
  const conTab = generarDocx(docxFixture({ cuerpo: '<w:p><w:r><w:tab/><w:t>{{cedula}}</w:t></w:r></w:p>', encabezado: 'x' }), { cedula: '9' });
  assert.match(new AdmZip(conTab).readAsText('word/document.xml'), /<w:tab\/><w:t xml:space="preserve">9<\/w:t>/);
});
