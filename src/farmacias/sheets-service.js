const CSV_URL    = process.env.GOOGLE_SHEETS_CSV_URL;
const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

if (!CSV_URL) throw new Error('[FarmaciasService] GOOGLE_SHEETS_CSV_URL env var is required');

function parseCSV(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const row = [];
    while (i < text.length && text[i] !== '\n') {
      if (text[i] === '"') {
        let field = '';
        i++;
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { field += text[i++]; }
        }
        row.push(field);
        if (text[i] === ',') i++;
      } else {
        let field = '';
        while (i < text.length && text[i] !== ',' && text[i] !== '\n') field += text[i++];
        row.push(field);
        if (text[i] === ',') i++;
      }
    }
    if (text[i] === '\n') i++;
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) rows.push(row);
  }
  return rows;
}

export async function readSheet() {
  const res = await fetch(CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`CSV fetch error: ${res.status}`);
  const rows = parseCSV(await res.text());

  const result = [];
  let currentDept = null;

  rows.forEach((row, idx) => {
    const sheetRow = idx + 1;
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();
    if (!colA || !colB) return;

    if (/elegiste los municipios/i.test(colB)) {
      const match = colB.match(/municipios\s+del?\s+\*?([^*\n]+)\*?/i);
      const nombre = match ? match[1].trim() : `Departamento ${result.length + 1}`;
      currentDept = { nombre, municipios: [] };
      result.push(currentDept);
      return;
    }

    if (/farmacia:/i.test(colB) && currentDept) {
      const keywords = colA.split(',').map(k => k.trim()).filter(Boolean);
      const numKw = keywords.find(k => /^\d+$/.test(k));
      const nombre = keywords.find(k => !/^\d+$/.test(k)) || `Municipio ${numKw ?? sheetRow}`;
      currentDept.municipios.push({ sheetRow, nombre, keywords, farmacias: parseBlock(colB) });
    }
  });

  return result;
}

export function parseBlock(cellText) {
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

export async function writeRow(sheetRow, cellText) {
  if (!SCRIPT_URL) throw new Error('[FarmaciasService] GOOGLE_APPS_SCRIPT_URL no configurado — edición deshabilitada');
  const payload = { sheetRow, cellText };

  // Apps Script devuelve 302 → seguir redirect con GET para obtener la respuesta de doPost
  const first = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });

  let res;
  if (first.status === 301 || first.status === 302) {
    const location = first.headers.get('location');
    if (!location) throw new Error('Apps Script redirect sin Location header');
    res = await fetch(location, { method: 'GET' });
  } else {
    res = first;
  }

  if (!res.ok) throw new Error(`Apps Script HTTP error: ${res.status}`);

  // Leer cuerpo — Apps Script puede retornar 200 con mensaje de error
  const body = await res.text();
  console.log(`[Farmacias] Apps Script response (row ${sheetRow}):`, body?.slice(0, 200));
  if (body && body.toLowerCase().startsWith('error')) {
    throw new Error(`Apps Script respondió: ${body}`);
  }
}

export async function saveFarmacias(sheetRow, municipioNombre, farmacias) {
  await writeRow(sheetRow, reconstructColB(municipioNombre, farmacias));
}
