/**
 * Certificado laboral: arma los textos según el empleado (activo con salario,
 * retirado como carta informativa) y los inserta en la plantilla .docx de
 * Gestión Humana, reemplazando marcadores {{campo}} sin tocar el diseño.
 */
import AdmZip from 'adm-zip';
import { numeroALetras, formatoPesos, fechaLarga, hoyIso, separarMiles } from './formato.js';

/** Marcadores que entiende la plantilla. */
export const MARCADORES = {
  fecha_expedicion: 'Fecha de hoy en letras (2 de octubre de 2026)',
  tratamiento:      'el señor / la señora',
  nombre:           'Nombre completo',
  identificado:     'identificado / identificada',
  cedula:           'Número de cédula',
  verbo_contrato:   'celebra (activo) / celebró (retirado)',
  tipo_contrato:    'a término fijo / indefinido / por obra o labor…',
  periodo:          'desde el … (activo) / desde el … hasta el … (retirado)',
  parrafo_cargo:    'Cargo + salario y auxilio (activo) / "Desempeñó el cargo de …" (retirado)',
  cargo:            'Cargo',
  fecha_ingreso:    'Fecha de ingreso en letras',
  fecha_retiro:     'Fecha de retiro en letras',
  salario_letras:   'Salario en letras',
  salario:          'Salario en números ($1.850.905)',
};

const esRetirado = (emp) => emp.estado === 'I' || Boolean(emp.fecha_retiro);

/** Campos obligatorios que faltan para generar el certificado. */
export function camposFaltantes(emp) {
  const faltan = [];
  if (!emp.nombre) faltan.push('nombre');
  if (!emp.cargo) faltan.push('cargo');
  if (!emp.tipo_contrato) faltan.push('tipo_contrato');
  if (!emp.fecha_ingreso) faltan.push('fecha_ingreso');
  if (esRetirado(emp)) { if (!emp.fecha_retiro) faltan.push('fecha_retiro'); }
  else if (!emp.salario) faltan.push('salario');
  return faltan;
}

/** ¿Corresponde auxilio de transporte? (hasta 2 salarios mínimos; si no hay mínimo configurado, siempre). */
export function aplicaAuxilio(salario, config) {
  const aux = Number(config.auxilio_transporte) || 0;
  if (!aux) return false;
  const smmlv = Number(config.salario_minimo) || 0;
  return !smmlv || salario <= 2 * smmlv;
}

/** Valores para cada marcador. */
export function valoresCertificado(emp, config = {}, hoy = hoyIso()) {
  const retirado = esRetirado(emp);
  const g = emp.genero;
  const desde = fechaLarga(emp.fecha_ingreso);
  const hasta = fechaLarga(emp.fecha_retiro);
  const cargo = emp.cargo || '';

  let parrafoCargo;
  if (retirado) {
    parrafoCargo = `Desempeñó el cargo de ${cargo}.`;
  } else {
    parrafoCargo = `Actualmente desempeña el cargo de ${cargo}, con un salario mensual de ` +
      `${numeroALetras(emp.salario)} PESOS (${formatoPesos(emp.salario)})`;
    parrafoCargo += aplicaAuxilio(emp.salario, config)
      ? `; y de acuerdo con la Ley Laboral Colombiana cuenta con su respectivo Auxilio de Transporte legal vigente mensual de ${formatoPesos(config.auxilio_transporte)}.`
      : '.';
  }

  return {
    tipo:             retirado ? 'retirado' : 'activo',
    fecha_expedicion: fechaLarga(hoy),
    tratamiento:      g === 'F' ? 'la señora' : g === 'M' ? 'el señor' : 'el(la) señor(a)',
    nombre:           emp.nombre || '',
    identificado:     g === 'F' ? 'identificada' : g === 'M' ? 'identificado' : 'identificado(a)',
    cedula:           separarMiles(emp.cedula || ''),
    verbo_contrato:   retirado ? 'celebró' : 'celebra',
    tipo_contrato:    emp.tipo_contrato || '',
    periodo:          retirado ? `desde el ${desde} hasta el ${hasta}` : `desde el ${desde}`,
    parrafo_cargo:    parrafoCargo,
    cargo,
    fecha_ingreso:    desde,
    fecha_retiro:     hasta,
    salario_letras:   retirado || !emp.salario ? '' : `${numeroALetras(emp.salario)} PESOS`,
    salario:          retirado || !emp.salario ? '' : formatoPesos(emp.salario),
  };
}

const escXml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MARCADOR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;
/** Nodo de texto <w:t …>…</w:t> (\b deja fuera <w:tab/>, <w:tbl>…). */
const TEXTO_RE = /<w:t\b[^>]*>([^<]*)<\/w:t>/g;

/**
 * Reemplaza marcadores en un párrafo aunque Word los haya partido en varios
 * fragmentos de texto: el valor queda en el fragmento donde empieza el marcador
 * (así conserva su formato, p. ej. negrita) y los demás fragmentos pierden su parte.
 */
function reemplazarEnParrafo(pXml, valores, usados) {
  const nodos = [...pXml.matchAll(TEXTO_RE)];
  if (!nodos.length) return pXml;
  const textos = nodos.map(n => n[1]);
  const completo = textos.join('');
  const spans = [...completo.matchAll(MARCADOR_RE)].map(m => ({ s: m.index, e: m.index + m[0].length, clave: m[1] }));
  if (!spans.length) return pXml;

  const salida = textos.map(() => '');
  let global = 0, si = 0;
  textos.forEach((txt, k) => {
    for (let j = 0; j < txt.length; j++, global++) {
      const span = spans[si];
      if (span && global >= span.s && global < span.e) {
        if (global === span.s) {
          usados.add(span.clave);
          salida[k] += Object.hasOwn(valores, span.clave) ? escXml(valores[span.clave]) : completo.slice(span.s, span.e);
        }
        if (global === span.e - 1) si++;
        continue;
      }
      salida[k] += txt[j];
    }
  });

  let i = 0;
  return pXml.replace(TEXTO_RE, () =>
    `<w:t xml:space="preserve">${salida[i++]}</w:t>`);
}

function reemplazarEnXml(xml, valores, usados) {
  // Se recorre a mano: los párrafos vacíos auto-cerrados (<w:p .../>) no deben tomarse como inicio
  let out = '', i = 0;
  while (i < xml.length) {
    const ini = xml.indexOf('<w:p', i);
    if (ini < 0) break;
    const next = xml[ini + 4];
    const finTag = xml.indexOf('>', ini);
    if ((next !== ' ' && next !== '>') || finTag < 0 || xml[finTag - 1] === '/') {
      out += xml.slice(i, ini + 4); i = ini + 4; continue;
    }
    const cierre = xml.indexOf('</w:p>', finTag);
    if (cierre < 0) break;
    out += xml.slice(i, ini) + reemplazarEnParrafo(xml.slice(ini, cierre + 6), valores, usados);
    i = cierre + 6;
  }
  return out + xml.slice(i);
}

const PARTES = /^word\/(document|header\d*|footer\d*)\.xml$/;

/** Marcadores presentes en una plantilla (para validarla al subirla). */
export function marcadoresEnPlantilla(buffer) {
  const zip = new AdmZip(buffer);
  const usados = new Set();
  for (const e of zip.getEntries().filter(e => PARTES.test(e.entryName))) {
    reemplazarEnXml(zip.readAsText(e.entryName), {}, usados);
  }
  return [...usados];
}

/** Genera el .docx final. */
export function generarDocx(plantilla, valores) {
  const zip = new AdmZip(plantilla);
  const usados = new Set();
  for (const e of zip.getEntries().filter(e => PARTES.test(e.entryName))) {
    zip.updateFile(e.entryName, Buffer.from(reemplazarEnXml(zip.readAsText(e.entryName), valores, usados), 'utf-8'));
  }
  return zip.toBuffer();
}
