/**
 * Normalización de datos de personal (vienen de Excel con formatos variados) y
 * textos para el certificado: fechas largas, pesos y valores en letras.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS',
  'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorMil(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), r = n % 100;
  let txt = CENTENAS[c];
  if (r) {
    const dec = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` Y ${UNIDADES[r % 10]}` : '');
    txt = (txt ? `${txt} ` : '') + dec;
  }
  return txt;
}

/** "UN" delante de sustantivo (VEINTIÚN MIL, UN MILLÓN). */
const apocope = (t) => t.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');

/** 1850905 → "UN MILLÓN OCHOCIENTOS CINCUENTA MIL NOVECIENTOS CINCO" */
export function numeroALetras(valor) {
  let n = Math.floor(Math.abs(Number(valor) || 0));
  if (n === 0) return 'CERO';
  const partes = [];
  const millones = Math.floor(n / 1e6); n %= 1e6;
  const miles = Math.floor(n / 1000); const resto = n % 1000;
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocope(numeroALetras(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocope(menorMil(miles))} MIL`);
  if (resto) partes.push(menorMil(resto));
  return partes.join(' ');
}

/** "1850905" → "1.850.905" (separador de miles sin expresiones regulares) */
export function separarMiles(digitos) {
  const s = String(digitos ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return out;
}

/** 1850905 → "$1.850.905" */
export function formatoPesos(valor) {
  return '$' + separarMiles(Math.round(Number(valor) || 0).toString());
}

/** "2017-03-07" → "7 de marzo de 2017" */
export function fechaLarga(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

export function hoyIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// ── Normalizadores de celdas de Excel ──────────────────────────────────────

export function normCedula(v) {
  const s = String(v ?? '').replace(/\.0+$/, '').replace(/\D/g, '');
  return s.length >= 5 && s.length <= 15 ? s : null;
}

export function normTexto(v) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s || null;
}

export function normGenero(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (['M', 'MASCULINO', 'H', 'HOMBRE'].includes(s)) return 'M';
  if (['F', 'FEMENINO', 'MUJER'].includes(s)) return 'F';
  return null;
}

export function normEstado(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (['A', 'ACTIVO', 'ACTIVA', 'S', 'SI', 'SÍ', '1', 'VIGENTE'].includes(s)) return 'A';
  if (['I', 'INACTIVO', 'INACTIVA', 'R', 'RETIRADO', 'RETIRADA', 'N', 'NO', '0', 'TERMINADO', 'LIQUIDADO'].includes(s)) return 'I';
  return null;
}

export function normSalario(v) {
  if (typeof v === 'number') return v > 0 ? Math.round(v) : null;
  const s = String(v ?? '').replace(/[$\s]/g, '');
  if (!s) return null;
  // "1.850.905" / "1,850,905" / "1850905,50"
  const limpio = s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Math.round(Number(limpio));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fecha a ISO (YYYY-MM-DD). Acepta Date, serial de Excel, "dd/mm/yyyy",
 * "dd/mm/yy hh:mm", "yyyy-mm-dd".
 */
export function normFecha(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS entrega fechas a medianoche UTC; se usa la parte UTC para no correr un día
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Código o texto del tipo de contrato → redacción para la carta. */
const TIPOS_CONTRATO = [
  [/^(TERF|TF|FIJO|TERMINO FIJO|A TERMINO FIJO)$/, 'a término fijo'],
  [/^(INDF|INDE|IND|TI|INDEFINIDO|TERMINO INDEFINIDO|A TERMINO INDEFINIDO)$/, 'a término indefinido'],
  [/^(OBRA|OBLA|OL|OBRA LABOR|OBRA O LABOR|POR OBRA O LABOR)$/, 'por obra o labor'],
  [/^(APRE|APR|SENA|APRENDIZAJE)$/, 'de aprendizaje'],
];

export function normTipoContrato(v) {
  const raw = normTexto(v);
  if (!raw) return null;
  const key = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, texto] of TIPOS_CONTRATO) if (re.test(key)) return texto;
  return raw.toLowerCase();
}
