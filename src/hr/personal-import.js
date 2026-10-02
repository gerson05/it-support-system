/**
 * Interpreta Excel de personal con columnas variables (nómina, contratos, listado
 * de Nits con género, usuarios de Mantis…). Reconoce encabezados por alias, permite
 * corregir la correspondencia y agrupa varias filas de la misma cédula.
 */
import { createHash } from 'node:crypto';
import { norm } from '../mantis/catalog-parser.js';
import {
  normCedula, normTexto, normGenero, normEstado, normSalario, normFecha, normTipoContrato,
} from './formato.js';

/** Campos que el sistema entiende, con sus encabezados habituales. */
export const CAMPOS = {
  cedula:        { label: 'Cédula',            alias: ['CEDULA', 'NIT', 'NIT IDENTIFICACION', 'IDENTIFICACION', 'DOCUMENTO', 'NUMERO DOCUMENTO', 'NRO DOCUMENTO', 'NO DOCUMENTO', 'CC', 'CEDULA DE CIUDADANIA'] },
  nombre:        { label: 'Nombre',            alias: ['NOMBRE', 'NOMBRE COMPLETO', 'NOMBRES Y APELLIDOS', 'EMPLEADO', 'NOMBRE EMPLEADO', 'TRABAJADOR'] },
  genero:        { label: 'Sexo',              alias: ['GENERO', 'SEXO'] },
  cargo:         { label: 'Cargo',             alias: ['CARGO', 'NOMBRE CARGO', 'PUESTO', 'CARGO ACTUAL'] },
  tipo_contrato: { label: 'Tipo de contrato',  alias: ['TIPO DE CONTRATO', 'TIPO CONTRATO', 'MODALIDAD', 'CLASE DE CONTRATO'] },
  contrato:      { label: 'N.º de contrato',   alias: ['CONTRATO', 'NUMERO CONTRATO', 'NRO CONTRATO', 'NO CONTRATO'] },
  fecha_ingreso: { label: 'Fecha de ingreso',  alias: ['INICIO DE CONTRATO', 'FECHA INGRESO', 'FECHA DE INGRESO', 'INGRESO', 'FECHA INICIO', 'FECHA DE INICIO', 'INICIO CONTRATO'] },
  fecha_retiro:  { label: 'Fecha de retiro',   alias: ['RETIRO', 'FECHA RETIRO', 'FECHA DE RETIRO', 'FECHA TERMINACION', 'FECHA DE TERMINACION'] },
  estado:        { label: 'Estado',            alias: ['ESTADO', 'ESTADO DE CONTRATO', 'ESTADO CONTRATO', 'ESTADO EMPLEADO', 'ACTIVO'] },
  salario:       { label: 'Salario',           alias: ['SUELDO', 'SALARIO', 'BASICO', 'SALARIO BASICO', 'SUELDO BASICO', 'ASIGNACION BASICA'] },
};

/** Campos que indican que la fila es de un empleado (no solo un tercero con género). */
const CAMPOS_LABORALES = ['cargo', 'tipo_contrato', 'contrato', 'fecha_ingreso', 'fecha_retiro', 'estado', 'salario'];

const NORMALIZADORES = {
  cedula: normCedula, nombre: normTexto, genero: normGenero, cargo: normTexto,
  tipo_contrato: normTipoContrato, contrato: normTexto, fecha_ingreso: normFecha,
  fecha_retiro: normFecha, estado: normEstado, salario: normSalario,
};

/** Campo sugerido para un encabezado (o null). */
export function campoPara(header) {
  const h = norm(header);
  if (!h) return null;
  for (const [campo, def] of Object.entries(CAMPOS)) if (def.alias.includes(h)) return campo;
  return null;
}

/** Fila de encabezados: la primera (de las 15 iniciales) con al menos 2 columnas reconocidas, una de ellas la cédula. */
export function detectarEncabezado(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const campos = rows[i].map(campoPara);
    if (campos.includes('cedula') && campos.filter(Boolean).length >= 2) return i;
  }
  return -1;
}

/** { índiceColumna: campo } con la primera columna de cada campo. */
export function sugerirMapeo(headers) {
  const mapeo = {};
  const usados = new Set();
  headers.forEach((h, i) => {
    const campo = campoPara(h);
    if (campo && !usados.has(campo)) { mapeo[i] = campo; usados.add(campo); }
  });
  return mapeo;
}

/** Identifica un formato de archivo por sus encabezados, para recordar su mapeo. */
export function firmaEncabezados(headers) {
  return createHash('sha1').update(headers.map(norm).join('|')).digest('hex');
}

export function validarMapeo(mapeo) {
  const campos = Object.values(mapeo).filter(Boolean);
  if (!campos.includes('cedula')) return 'Falta indicar cuál columna es la cédula.';
  const repetidos = campos.filter((c, i) => campos.indexOf(c) !== i);
  if (repetidos.length) return `El campo "${CAMPOS[repetidos[0]]?.label || repetidos[0]}" está asignado a más de una columna.`;
  const invalidos = campos.filter(c => !CAMPOS[c]);
  if (invalidos.length) return `Campo desconocido: ${invalidos[0]}.`;
  return null;
}

/** Cuando una cédula aparece varias veces: gana el contrato activo, si no el más reciente. */
function mejorRegistro(a, b) {
  if ((a.estado === 'A') !== (b.estado === 'A')) return a.estado === 'A' ? a : b;
  return (b.fecha_ingreso || '') > (a.fecha_ingreso || '') ? b : a;
}

/**
 * Convierte filas en registros por cédula.
 * @returns {{ registros: Map<string, object>, filas: number, sinCedula: number }}
 */
export function construirRegistros(rows, headerIndex, mapeo) {
  const registros = new Map();
  let filas = 0, sinCedula = 0;
  const columnas = Object.entries(mapeo).filter(([, campo]) => campo);

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some(c => String(c ?? '').trim())) continue;
    filas++;
    const rec = {};
    for (const [col, campo] of columnas) {
      const val = NORMALIZADORES[campo](row[Number(col)]);
      if (val !== null && val !== undefined) rec[campo] = val;
    }
    if (!rec.cedula) { sinCedula++; continue; }
    if (!rec.estado && rec.fecha_retiro) rec.estado = 'I';
    rec.es_empleado = CAMPOS_LABORALES.some(c => rec[c] !== undefined) ? 1 : 0;

    const prev = registros.get(rec.cedula);
    registros.set(rec.cedula, prev ? { ...mejorRegistro(prev, rec), genero: rec.genero ?? prev.genero } : rec);
  }
  return { registros, filas, sinCedula };
}
