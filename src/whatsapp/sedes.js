/**
 * Lista oficial de sedes y motor de coincidencia fuzzy.
 * Los usuarios escriben libremente; el bot normaliza y encuentra la sede correcta.
 *
 * CIUDADES: agrupa los puntos de atención por ciudad.
 * El bot primero pregunta la ciudad y luego muestra los puntos disponibles.
 */

export const CIUDADES = {
  // ── CALDAS ────────────────────────────────────────────────────
  'AGUADAS':                ['MI FARMACIA - AGUADAS'],
  'ANSERMA':                ['MI FARMACIA - ANSERMA'],
  'ARANZAZU':               ['MI FARMACIA - ARANZAZU'],
  'CHINCHINA':              ['MI FARMACIA - CHINCINA'],
  'LA DORADA':              ['MI FARMACIA - LA DORADA'],
  'MANIZALES':              ['MI FARMACIA - MANIZALES'],
  'MARQUETALIA':            ['MI FARMACIA - MARQUETALIA'],
  'PENSILVANIA':            ['HOSPITAL SAN JUAN DE DIOS - PENSILVANIA'],
  'RIOSUCIO':               ['MI FARMACIA - RIO SUCIO'],
  'SALAMINA':               ['MI FARMACIA - SALAMINA'],
  'SAMANA':                 ['MI FARMACIA - OPTICA LOS GALEROS - SAMANA'],
  'SUPIA':                  ['MI FARMACIA - SUPIA'],

  // ── CAUCA ─────────────────────────────────────────────────────
  'ARGELIA':                ['MI FARMACIA - DROGAS UNION - ARGELIA'],
  'CORINTO':                ['MI FARMACIA - CORINTO'],
  'GUAPI':                  ['MI FARMACIA - INVERSIONES GUAPI'],
  'JAMBALO':                ['MI FARMACIA - JAMBALO'],
  'MIRANDA':                ['MI FARMACIA - MIRANDA'],
  'MORALES':                ['MI FARMACIA - MORALES'],
  'PIENDAMO':               ['MI FARMACIA - PIENDAMO'],
  'POPAYAN':                ['MI FARMACIA - POPAYAN'],
  'SANTANDER DE QUILICHAO': ['MI FARMACIA - SANTANDER DE QUILICHAO'],
  'SILVIA':                 ['MI FARMACIA - SILVIA'],
  'TORIBIO':                ['MI FARMACIA - TORIBIO'],
  'TOTORO':                 ['MI FARMACIA - TOTORO'],

  // ── NARIÑO / PUTUMAYO ─────────────────────────────────────────
  'LA UNION NARIÑO':        ['MI FARMACIA - LA UNION'],
  'MOCOA':                  ['MI FARMACIA - MOCOA'],
  'PASTO':                  ['MI FARMACIA - PASTO'],
  'TUMACO':                 ['MI FARMACIA - TUMACO'],

  // ── QUINDÍO ───────────────────────────────────────────────────
  'QUIMBAYA':               ['MI FARMACIA - QUIMBAYA'],

  // ── RISARALDA ─────────────────────────────────────────────────
  'APIA':                   ['MI FARMACIA - APIA'],
  'DOSQUEBRADAS':           ['MI FARMACIA - DOSQUEBRADAS'],
  'GUATICA':                ['MI FARMACIA - GUATICA'],
  'LA VIRGINIA':            ['MI FARMACIA - LA VIRGINIA'],
  'PEREIRA':                ['MI FARMACIA - PEREIRA'],
  'SANTA ROSA':             ['MI FARMACIA - SANTA ROSA'],

  // ── VALLE DEL CAUCA ───────────────────────────────────────────
  'ALCALA':                 ['MEDIVALLE - DROGUERIA MODERNA LA 4D - ALCALA'],
  'ANDALUCIA':              ['MI FARMACIA - DROGUERIA ANDALUZA - ANDALUCIA'],
  'ANSERMANUEVO':           ['MI FARMACIA - ANSERMANUEVO'],
  'BUENAVENTURA':           [
    'MI FARMACIA - BUENAVENTURA',
    'MI FARMACIA - BUENAVENTURA 2',
    'MI FARMACIA - LA VERDAD 2 (HORARIO EXTENDIDO)',
  ],
  'BUGA':                   [
    'MI FARMACIA - BUGA',
    'DROGUERIA SAN JOSE - BUGA',
  ],
  'BUGALAGRANDE':           ['MI FARMACIA - DROGUERIA SINALTRAFARMA - BUGALAGRANDE'],
  'CAICEDONIA':             ['MI FARMACIA - CAICEDONIA'],
  'CALI':                   [
    'MEDIVALLE - SEDE PRINCIPAL',
    'MI FARMACIA - CALI SUR',
    'MI FARMACIA - CALI NORTE',
    'MI FARMACIA - CALI AIC',
    'MI FARMACIA - PASOANCHO',
    'MI FARMACIA - DROGUERIA LA FAVORITA - CALI',
    'MI FARMACIA - SEDE HOSPITALARIA 24H FOMAG',
  ],
  'CALIMA':                 ['MI FARMACIA - DROGUERIA MARIA RITA - CALIMA'],
  'CANDELARIA':             [
    'MI FARMACIA - DROGAS REBARATAS LA 11 - VILLAGORGONA',
    'MI FARMACIA - EL MANANTIAL - CANDELARIA',
  ],
  'CARTAGO':                [
    'MI FARMACIA - CARTAGO FOMAG',
    'MI FARMACIA - ZARAGOZA',
    'MI FARMACIA - CIPRES',
  ],
  'DAGUA':                  ['MI FARMACIA - DROGUERIA ISABELA ROBAYO - DAGUA'],
  'EL AGUILA':              ['MI FARMACIA - FARMIAGUILA'],
  'EL CAIRO':               ['MI FARMACIA - DROGUERIA DEL COMERCIO - EL CAIRO'],
  'EL CERRITO':             [
    'MI FARMACIA - DROGUERIA VALLEJO - EL CERRITO',
    'MI FARMACIA - DROGAS EXITO 1 - EL CERRITO',
    'MI FARMACIA - DROGAS EXITO 2 - EL CERRITO',
    'MI FARMACIA - DROGAS EXITO 3 - EL CERRITO',
  ],
  'EL DOVIO':               ['MI FARMACIA - FARMADOVIO - EL DOVIO'],
  'FLORIDA':                ['MI FARMACIA - FLORIDA'],
  'GINEBRA':                [
    'MI FARMACIA - DROGAS EXITO 4 - GINEBRA',
    'MI FARMACIA - DROGAS EXITO 5 - GINEBRA',
  ],
  'GUACARI':                ['MI FARMACIA - GUACARI'],
  'JAMUNDI':                [
    'MI FARMACIA - JAMUNDI',
    'ALPHAHEALTH DROGUERIAS - JAMUNDI',
  ],
  'LA CUMBRE':              ['MI FARMACIA - OFFIMEDICAS LA CUMBRE'],
  'LA UNION VALLE':         ['MI FARMACIA - SURTIDROGAS ER - LA UNION'],
  'LA VICTORIA':            ['MEDIVALLE LA VICTORIA'],
  'OBANDO':                 ['MI FARMACIA - DROGUERIA LORENA OBANDO'],
  'PALMIRA':                [
    'MI FARMACIA - PALMIRA',
    'DROGUERIA A SU SALUD - PALMIRA',
  ],
  'PRADERA':                ['MI FARMACIA - DROGAS REBARATAS - PRADERA'],
  'RESTREPO':               ['MI FARMACIA - DROGUERIA LINA SOTO - RESTREPO'],
  'RIOFRIO':                ['MI FARMACIA - DROGUERIA DEL PARQUE - RIOFRIO'],
  'ROLDANILLO':             [
    'MI FARMACIA - ROLDANILLO FOMAG',
    'MI FARMACIA - DROGUERIA J&M URGENCIAS - ROLDANILLO',
  ],
  'SAN PEDRO':              ['MI FARMACIA - DROGUERIA LAS DELICIAS - SAN PEDRO'],
  'SEVILLA':                ['MI FARMACIA - DROGUERIA A TU SALUD MEDFARMA - SEVILLA'],
  'TORO':                   ['MI FARMACIA - DROGUERIA GRATITUD - TORO'],
  'TRUJILLO':               ['MI FARMACIA - DROGUERIA LA ECONOMICA - TRUJILLO'],
  'TULUA':                  [
    'MI FARMACIA - TULUA',
    'MI FARMACIA - SAMARITANA - TULUA',
    'DROGUERIA FARMAPRECIOS - TULUA',
  ],
  'ULLOA':                  ['MI FARMACIA - DRODESCUENTO ULLOA'],
  'VERSALLES':              ['MI FARMACIA - HOSPITAL HENRY VALENCIA OROZCO - VERSALLES'],
  'VIJES':                  ['MI FARMACIA - OFFIMEDICAS VIJES'],
  'YOTOCO':                 ['MI FARMACIA - DROGUERIA YOTOCO'],
  'YUMBO':                  [
    'MI FARMACIA - YUMBO',
    'DROGUERIA RAPI DROGAS - YUMBO',
    'MEDIVALLE - BODEGA YUMBO',
  ],
  'ZARZAL':                 ['MI FARMACIA - DROGUERIA SAN LUIS - ZARZAL'],
  'SELIA':                  ['SELIA'],
};

/** Normaliza a minúsculas sin tildes */
function normC(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Busca ciudades que coincidan con el texto del usuario.
 * Devuelve array de nombres de ciudad (keys de CIUDADES).
 */
/**
 * Busca ciudades desde la DB. Si no hay DB disponible, usa CIUDADES estático.
 * @param {string} input - texto del usuario
 * @param {object|null} db - instancia DatabaseSync (opcional)
 */
export function matchCiudad(input, db = null) {
  const q = normC(input);
  if (!q || q.length < 2) return [];

  // Obtener lista de ciudades (de DB si está disponible, o del mapa estático)
  let ciudadList;
  if (db) {
    try {
      ciudadList = db.prepare(`SELECT DISTINCT ciudad FROM sedes WHERE activo=1 ORDER BY ciudad`).all().map(r => r.ciudad);
    } catch { ciudadList = Object.keys(CIUDADES); }
  } else {
    ciudadList = Object.keys(CIUDADES);
  }

  const exact = [], contains = [], partial = [];
  for (const ciudad of ciudadList) {
    const key = normC(ciudad);
    if (key === q)                             { exact.push(ciudad);    continue; }
    if (key.includes(q) || q.includes(key))   { contains.push(ciudad); continue; }
    const qWords = q.split(/\s+/).filter(w => w.length >= 3);
    const kWords = key.split(/\s+/);
    if (qWords.length > 0) {
      const matched = qWords.filter(qw => kWords.some(kw => kw.startsWith(qw) || qw.startsWith(kw))).length;
      if (matched === qWords.length) partial.push(ciudad);
    }
  }

  const seen = new Set();
  return [...exact, ...contains, ...partial].filter(c => {
    if (seen.has(c)) return false;
    seen.add(c); return true;
  }).slice(0, 6);
}

/**
 * Devuelve los puntos activos de una ciudad desde la DB.
 * Fallback al mapa estático si no hay DB.
 */
export function getPuntosCiudad(ciudad, db = null) {
  if (db) {
    try {
      const rows = db.prepare(`SELECT nombre_punto FROM sedes WHERE ciudad=? AND activo=1 ORDER BY id`).all(ciudad);
      if (rows.length) return rows.map(r => r.nombre_punto);
    } catch {}
  }
  return CIUDADES[ciudad] || [];
}

export const SEDES = [
  'MI FARMACIA - AGUADAS',
  'MI FARMACIA - ANSERMA',
  'MI FARMACIA - ARANZAZU',
  'MI FARMACIA - CHINCINA',
  'MI FARMACIA - LA DORADA',
  'MI FARMACIA - MANIZALES',
  'MI FARMACIA - MARQUETALIA',
  'MI FARMACIA - RIO SUCIO',
  'MI FARMACIA - SALAMINA',
  'MI FARMACIA - SUPIA',
  'MI FARMACIA - CORINTO',
  'MI FARMACIA - JAMBALO',
  'MI FARMACIA - MIRANDA',
  'MI FARMACIA - MORALES',
  'MI FARMACIA - PIENDAMO',
  'MI FARMACIA - POPAYAN',
  'MI FARMACIA - SANTANDER DE QUILICHAO',
  'MI FARMACIA - SILVIA',
  'MI FARMACIA - TORIBIO',
  'MI FARMACIA - TOTORO',
  'MI FARMACIA - LA UNION',
  'MI FARMACIA - PASTO',
  'MI FARMACIA - TUMACO',
  'MI FARMACIA - MOCOA',
  'MI FARMACIA - QUIMBAYA',
  'MI FARMACIA - APIA',
  'MI FARMACIA - DOSQUEBRADAS',
  'MI FARMACIA - GUATICA',
  'MI FARMACIA - LA VIRGINIA',
  'MI FARMACIA - SANTA ROSA',
  'MI FARMACIA - ANSERMANUEVO',
  'MI FARMACIA - BUENAVENTURA',
  'MI FARMACIA - BUENAVENTURA 2',
  'MI FARMACIA - BUGA',
  'MI FARMACIA - CAICEDONIA',
  'MI FARMACIA - CALI SUR',
  'MI FARMACIA - CALI NORTE',
  'MI FARMACIA - CALI AIC',
  'MI FARMACIA - PASOANCHO',
  'MI FARMACIA - CARTAGO FOMAG',
  'MI FARMACIA - SEDE HOSPITALARIA SERVICIO 24 HORAS FOMAG',
  'MI FARMACIA - FLORIDA',
  'MI FARMACIA - GUACARI',
  'MI FARMACIA - JAMUNDI',
  'MEDIVALLE LA VICTORIA',
  'MI FARMACIA - PALMIRA',
  'MI FARMACIA - ROLDANILLO FOMAG',
  'MI FARMACIA - TULUA',
  'MI FARMACIA - YUMBO',
  'MI FARMACIA - ZARAGOZA',
  'MI FARMACIA - CIPRES',
  'MI FARMACIA - PEREIRA',
  'ZARZAL',
  'SELIA',
  'SEVILLA',
];

/* ─────────────────────────────────────────────────────────────
   Helpers internos
───────────────────────────────────────────────────────────── */

/** Nombre corto para mostrar en el chat (sin el prefijo "MI FARMACIA - ") */
export function displaySede(sede) {
  if (!sede) return '';
  if (sede.toUpperCase().startsWith('MI FARMACIA - ')) {
    return sede.slice('MI FARMACIA - '.length);
  }
  return sede;
}

/** Normaliza a minúsculas sin tildes ni espacios múltiples */
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar diacríticos (tildes, diéresis)
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   matchSede — motor principal
   Devuelve un array de sedes coincidentes (máx. 5), ordenadas
   de mayor a menor confianza.
───────────────────────────────────────────────────────────── */
export function matchSede(input) {
  const query = norm(input);
  if (!query || query.length < 2) return [];

  const exact    = [];
  const contains = [];
  const partial  = [];

  for (const sede of SEDES) {
    // Clave corta (sin "MI FARMACIA - ") y clave completa, ambas normalizadas
    const shortKey = norm(displaySede(sede));
    const fullKey  = norm(sede);

    // 1. Coincidencia exacta
    if (shortKey === query || fullKey === query) {
      exact.push(sede);
      continue;
    }

    // 2. La clave contiene la búsqueda (o viceversa)
    if (shortKey.includes(query) || fullKey.includes(query)) {
      contains.push(sede);
      continue;
    }

    // 3. Coincidencia por palabras:
    //    todas las palabras del usuario aparecen en la clave corta
    const qWords = query.split(/\s+/).filter(w => w.length >= 2);
    const kWords = shortKey.split(/\s+/);

    if (qWords.length > 0) {
      const matchedCount = qWords.filter(qw =>
        kWords.some(kw => kw === qw || kw.startsWith(qw) || qw.startsWith(kw))
      ).length;

      // Aceptar si todas las palabras del usuario coinciden,
      // o si hay ≥2 palabras y sólo falta una (typo de una palabra extra)
      const isGoodMatch =
        matchedCount === qWords.length ||
        (qWords.length >= 2 && matchedCount >= qWords.length - 1);

      if (isGoodMatch) {
        partial.push({ sede, score: matchedCount / Math.max(qWords.length, kWords.length) });
      }
    }
  }

  // Ordenar parciales por score descendente
  partial.sort((a, b) => b.score - a.score);

  // Combinar: exactas → por contenido → parciales
  const combined = [
    ...exact,
    ...contains,
    ...partial.map(p => p.sede),
  ];

  // Eliminar duplicados y limitar a 5
  const seen = new Set();
  return combined.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  }).slice(0, 5);
}
