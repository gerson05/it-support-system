import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
if (!SPREADSHEET_ID) throw new Error('[FarmaciasService] GOOGLE_SHEETS_ID env var is required');
const TARGET_GID     = 1516003101;

let _sheetsClientPromise = null;
let _sheetNamePromise    = null;

async function _auth() {
  if (!_sheetsClientPromise) {
    _sheetsClientPromise = (async () => {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../../credentials/google-service-account.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return _sheetsClientPromise;
}

async function _getSheetName() {
  if (!_sheetNamePromise) {
    _sheetNamePromise = (async () => {
      const sheets = await _auth();
      const meta   = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: 'sheets.properties',
      });
      const found = meta.data.sheets.find(s => s.properties.sheetId === TARGET_GID);
      if (!found) throw new Error(`[FarmaciasService] Sheet with GID ${TARGET_GID} not found in spreadsheet`);
      return found.properties.title;
    })();
  }
  return _sheetNamePromise;
}

/**
 * Lee el Sheet completo y devuelve un array de departamentos con sus municipios y farmacias.
 * Estructura: [{ nombre, municipios: [{ sheetRow, nombre, keywords, farmacias: [...] }] }]
 */
export async function readSheet() {
  const sheets    = await _auth();
  const sheetName = await _getSheetName();

  const res  = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:B`,
  });

  const rows        = res.data.values || [];
  const result      = [];
  let   currentDept = null;

  rows.forEach((row, idx) => {
    const sheetRow = idx + 1;
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();

    if (!colA || !colB) return;

    // ── Fila de departamento: col B contiene "Elegiste los municipios"
    if (/elegiste los municipios/i.test(colB)) {
      const match = colB.match(/municipios\s+del?\s+\*?([^*\n]+)\*?/i);
      const nombre = match ? match[1].trim() : `Departamento ${result.length + 1}`;
      currentDept = { nombre, municipios: [] };
      result.push(currentDept);
      return;
    }

    // ── Fila de municipio: col B contiene "Farmacia:"
    if (/farmacia:/i.test(colB) && currentDept) {
      const keywords = colA.split(',').map(k => k.trim()).filter(Boolean);
      // El primer keyword numérico es el número del municipio
      const numKw    = keywords.find(k => /^\d+$/.test(k));
      const nombre   = keywords.find(k => !/^\d+$/.test(k)) || `Municipio ${numKw ?? sheetRow}`;

      currentDept.municipios.push({
        sheetRow,
        nombre,
        keywords,
        farmacias: parseBlock(colB),
      });
    }
  });

  return result;
}

/**
 * Parsea el texto de una celda col B y extrae las farmacias individuales.
 * Devuelve: [{ index, nombre, direccion, correo, horario, telefono, mapsUrl }]
 */
export function parseBlock(cellText) {
  // Dividir por el separador de farmacias
  const blocks = cellText
    .split(/={3,}/)
    .map(b => b.trim())
    .filter(b => /farmacia:/i.test(b));

  return blocks.map((block, index) => {
    const get = (pattern) => {
      const m = block.match(pattern);
      return m ? m[1].replace(/\*/g, '').trim() : '';
    };

    const urlMatch = block.match(/https?:\/\/[^\s\n*,)]+/);

    return {
      index,
      nombre:    get(/Farmacia:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      direccion: get(/Dir:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      correo:    get(/Correo:\s*(.+?)(?:\s*$|\n)/im),
      horario:   get(/Hr\.?\s*Atenci[oó]n:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      telefono:  get(/Telef[oó]nico:\s*\*?:?\s*(.+?)(?:\*?\s*$|\n)/im),
      mapsUrl:   urlMatch ? urlMatch[0].trim() : '',
    };
  });
}

const SEP = '======================';

/**
 * Reconstruye el texto de la celda col B a partir del array de farmacias.
 * Produce el mismo formato WhatsApp que el bot externo espera.
 */
export function reconstructColB(municipioNombre, farmacias) {
  if (!farmacias.length) return '';

  const blocks = farmacias.map(f => [
    `*FARMACIA*`,
    SEP,
    `📗Municipio: *${municipioNombre}*`,
    `📋Farmacia: *${f.nombre}*`,
    `📍Dir: *${f.direccion}*`,
    `📧Correo: ${f.correo || ''}`,
    `⏰Hr. Atención: *${f.horario || ''}*`,
    `📱Telefonico: ${f.telefono || ''}`,
    `📍 *Ubicación*`,
    f.mapsUrl || '',
    SEP,
  ].join('\n'));

  return blocks.join('\n\n') + '\n\nEscribe🔢 *00* para volver al menu principal';
}

/**
 * Escribe el texto reconstruido en la celda B{sheetRow} del Sheet.
 */
export async function writeRow(sheetRow, cellText) {
  const sheets    = await _auth();
  const sheetName = await _getSheetName();

  await sheets.spreadsheets.values.update({
    spreadsheetId:    SPREADSHEET_ID,
    range:            `${sheetName}!B${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody:      { values: [[cellText]] },
  });
}

/**
 * Helper de alto nivel: reconstruye el texto y lo escribe al Sheet.
 */
export async function saveFarmacias(sheetRow, municipioNombre, farmacias) {
  const text = reconstructColB(municipioNombre, farmacias);
  await writeRow(sheetRow, text);
}
