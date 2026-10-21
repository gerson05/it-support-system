/**
 * Acta de devolución y paz y salvo (.docx) con la plantilla corporativa de Medivalle
 * (la misma del acta de entrega: logo, marca de agua y firma del jefe de soporte).
 */

import {
  pTxt, run, campoXml, espXml, seccionXml, tablaFila, FIRMA_JEFE_XML, aplicarPlantilla,
} from '../tech-requests/acta-generator.js';
import { fechaLocal } from '../utils/fecha-local.js';

const COLS = [500, 1300, 2200, 1300, 1300, 1900, 1100]; // N°, Tipo, Equipo, Marca, Placa, Serial/IMEI, Estado
const TOTAL = COLS.reduce((a, b) => a + b, 0);

const fechaLarga = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

function tabla(elementos) {
  const cab = tablaFila(['N°', 'Tipo', 'Equipo', 'Marca', 'Placa', 'Serial / IMEI', 'Estado']
    .map((text, i) => ({ text, w: COLS[i] })), true);
  const filas = elementos.map((e, i) => {
    const equipo = [e.descripcion, e.modelo && e.modelo !== e.descripcion ? e.modelo : '', e.detalle].filter(Boolean).join(' · ');
    const fila = tablaFila([`${i + 1}`, e.tipo, equipo, e.marca || '—', e.placa || '—', e.serial || '—',
      e.devuelto ? 'Devuelto' : 'Pendiente'].map((text, j) => ({ text, w: COLS[j] })));
    const obs = e.observacion
      ? `<w:tr><w:tc><w:tcPr><w:tcW w:w="${TOTAL}" w:type="dxa"/><w:gridSpan w:val="${COLS.length}"/></w:tcPr>${
        pTxt(run(`Observación: ${e.observacion}`, false, '555555'))}</w:tc></w:tr>`
      : '';
    return fila + obs;
  }).join('');
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${TOTAL}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="BBBBBB"/><w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/>
        <w:left w:val="single" w:sz="4" w:color="BBBBBB"/><w:right w:val="single" w:sz="4" w:color="BBBBBB"/>
        <w:insideH w:val="single" w:sz="4" w:color="DDDDDD"/><w:insideV w:val="single" w:sz="4" w:color="DDDDDD"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${COLS.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
    ${cab}${filas}
  </w:tbl>`;
}

/** Texto de certificación según lo devuelto. */
export function textoCertificacion({ nombre, cedula }, elementos) {
  const quien = `${nombre}${cedula ? `, identificado(a) con documento N° ${cedula},` : ''}`;
  const pendientes = elementos.filter(e => !e.devuelto).length;
  if (!elementos.length) {
    return { pazYSalvo: true, texto: `El área de Sistemas certifica que ${quien} no tiene equipos ni elementos tecnológicos asignados a su nombre, por lo cual se encuentra a PAZ Y SALVO con el área de Sistemas.` };
  }
  if (!pendientes) {
    return { pazYSalvo: true, texto: `El área de Sistemas certifica que ${quien} hizo entrega de la totalidad de los equipos y elementos tecnológicos que tenía asignados, relacionados en la tabla anterior, por lo cual se encuentra a PAZ Y SALVO con el área de Sistemas.` };
  }
  return { pazYSalvo: false, texto: `${quien} tiene pendiente la devolución de ${pendientes} elemento(s) marcados como "Pendiente" en la tabla anterior, por lo cual NO se encuentra a paz y salvo con el área de Sistemas hasta su entrega.` };
}

/**
 * @param {object} persona   { nombre, cedula, cargo?, area?, fecha_retiro? (YYYY-MM-DD) }
 * @param {Array}  elementos de paz-salvo-model (con devuelto/observacion)
 * @param {string} observaciones generales
 * @returns {Buffer} .docx
 */
export function generarActaPazSalvo(persona, elementos, observaciones = '') {
  const hoy = fechaLocal();
  const fechaRetiro = /^\d{4}-\d{2}-\d{2}$/.test(persona.fecha_retiro || '') ? persona.fecha_retiro : hoy;
  const area = persona.area || [...new Set(elementos.map(e => e.area || e.sede).filter(Boolean))].join(', ');
  const { texto } = textoCertificacion(persona, elementos);

  const body = `
    ${pTxt(run(`Santiago de Cali,  ${fechaLarga(hoy)}`, true), '<w:jc w:val="center"/>')}
    <w:p><w:pPr><w:pStyle w:val="Ttulo"/></w:pPr></w:p>
    <w:p><w:pPr><w:pStyle w:val="Ttulo"/><w:jc w:val="center"/></w:pPr>${run('ACTA DE DEVOLUCIÓN Y PAZ Y SALVO', true)}</w:p>
    ${espXml()}
    ${seccionXml('Datos del colaborador')}
    ${campoXml('Nombres y apellidos:', persona.nombre)}
    ${campoXml('Documento:', persona.cedula || '—')}
    ${persona.cargo ? campoXml('Cargo:', persona.cargo) : ''}
    ${area ? campoXml('Área / Sede:', area) : ''}
    ${campoXml('Fecha de retiro:', fechaCorta(fechaRetiro))}
    ${espXml()}
    ${seccionXml('Equipos y elementos asignados por Sistemas')}
    ${espXml()}
    ${elementos.length ? tabla(elementos) : pTxt(run('No registra equipos ni elementos asignados en el inventario de Sistemas.', false, '555555'))}
    ${espXml()}
    ${observaciones ? campoXml('Observaciones:', observaciones) : ''}
    ${seccionXml('Certificación')}
    ${pTxt(run(texto), '<w:jc w:val="both"/>')}
    ${espXml()}
    ${pTxt(run('Firman en conformidad.'))}
    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:spacing w:before="400"/></w:pPr>${FIRMA_JEFE_XML}</w:p>
    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('____________________')}<w:r><w:tab/></w:r>${run('_____________________')}</w:p>
    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('Jefe de Soporte', false, '555555')}<w:r><w:tab/></w:r>${run(persona.nombre, true)}</w:p>
    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('Área de Sistemas', false, '888888')}<w:r><w:tab/></w:r>${run('Colaborador que entrega', false, '555555')}</w:p>
    <w:sectPr/>`;

  return aplicarPlantilla(body);
}

