/**
 * sede-codes.js — mapa de sedes a códigos de 3 letras para AF-{CÓDIGO}{NNN}
 * Ciudades con múltiples puntos tienen códigos distintos por sub-sede.
 * Las claves son el texto normalizado (mayúsculas, sin tildes) que llega al servidor.
 */

export const SEDE_CODES = {
  // ── Administrativo ───────────────────────────────────────────────────────
  'BODEGA':                                 'BOD',
  'BODEGA YUMBO':                           'BOD',
  'BOGOTA':                                 'BOG',
  'KARSON':                                 'KRS',
  'OFICINA':                                'OFI',
  'SEDE PRINCIPAL':                         'SDP',
  'MEDIVALLE LA VICTORIA':                  'LVC',
  'SELIA':                                  'SEL',

  // ── Caldas ───────────────────────────────────────────────────────────────
  'AGUADAS':                                'AGU',
  'ANSERMA':                                'ANS',
  'ARANZAZU':                               'ARZ',
  'CHINCHINA':                              'CHN',
  'CHINCINA':                               'CHN',
  'LA DORADA':                              'LDR',
  'MANIZALES':                              'MNZ',
  'MARQUETALIA':                            'MRQ',
  'PENSILVANIA':                            'PNS',
  'RIOSUCIO':                               'RSC',
  'RIO SUCIO':                              'RSC',
  'SALAMINA':                               'SLM',
  'SAMANA':                                 'SAM',
  'SUPIA':                                  'SUP',

  // ── Cauca ────────────────────────────────────────────────────────────────
  'ARGELIA':                                'ARG',
  'CORINTO':                                'COR',
  'GUAPI':                                  'GPI',
  'JAMBALO':                                'JMB',
  'MIRANDA':                                'MIR',
  'MORALES':                                'MRL',
  'PIENDAMO':                               'PND',
  'POPAYAN':                                'PPY',
  'SANTANDER DE QUILICHAO':                 'SNQ',
  'SILVIA':                                 'SLV',
  'TORIBIO':                                'TRB',
  'TOTORO':                                 'TTR',

  // ── Nariño / Putumayo ────────────────────────────────────────────────────
  'LA UNION NARINO':                        'LUN',
  'MOCOA':                                  'MCO',
  'PASTO':                                  'PST',
  'TUMACO':                                 'TMC',

  // ── Quindío ──────────────────────────────────────────────────────────────
  'QUIMBAYA':                               'QMB',

  // ── Risaralda ────────────────────────────────────────────────────────────
  'APIA':                                   'API',
  'DOSQUEBRADAS':                           'DQB',
  'GUATICA':                                'GTC',
  'LA VIRGINIA':                            'LVG',
  'PEREIRA':                                'PRR',
  'SANTA ROSA':                             'STR',

  // ── Valle del Cauca — sede única ─────────────────────────────────────────
  'ALCALA':                                 'ALC',
  'ANDALUCIA':                              'AND',
  'ANSERMANUEVO':                           'ANV',
  'BUGALAGRANDE':                           'BGL',
  'CAICEDONIA':                             'CCD',
  'CALIMA':                                 'CLM',
  'DAGUA':                                  'DGU',
  'EL AGUILA':                              'EAG',
  'EL DOVIO':                               'EDV',
  'FLORIDA':                                'FLR',
  'GUACARI':                                'GCR',
  'LA CUMBRE':                              'LCB',
  'LA UNION VALLE':                         'LUV',
  'LA VICTORIA':                            'LVC',
  'OBANDO':                                 'OBD',
  'PRADERA':                                'PRD',
  'RESTREPO':                               'RST',
  'RIOFRIO':                                'RFR',
  'SAN PEDRO':                              'SPD',
  'SEVILLA':                                'SVL',
  'TORO':                                   'TRO',
  'TRUJILLO':                               'TRJ',
  'ULLOA':                                  'ULL',
  'VERSALLES':                              'VRS',
  'VIJES':                                  'VJS',
  'YOTOCO':                                 'YTC',
  'ZARZAL':                                 'ZRZ',

  // ── Cali — múltiples puntos ───────────────────────────────────────────────
  // Nombres cortos (uso en agent-config y dropdown)
  'CALI SUR':                               'CSR',
  'CALI NORTE':                             'CNR',
  'CALI AIC':                               'CAI',
  'PASOANCHO':                              'PAS',
  'SEDE HOSPITALARIA 24H':                  'SHF',
  'LA FAVORITA':                            'CFV',
  'CALI':                                   'CAL',  // genérico
  // Nombres completos del catálogo (auto-detección)
  'DROGUERIA LA FAVORITA - CALI':           'CFV',
  'SEDE HOSPITALARIA 24H FOMAG':            'SHF',

  // ── Buenaventura — múltiples puntos ──────────────────────────────────────
  'BUENAVENTURA':                           'BNV',
  'BUENAVENTURA 2':                         'BN2',
  'LA VERDAD 2':                            'BVD',
  'LA VERDAD 2 HORARIO EXTENDIDO':          'BVD',

  // ── Buga — múltiples puntos ───────────────────────────────────────────────
  'BUGA':                                   'BGA',
  'SAN JOSE BUGA':                          'BGJ',
  'BUGA SAN JOSE':                          'BGJ',
  'DROGUERIA SAN JOSE - BUGA':              'BGJ',

  // ── Candelaria — múltiples puntos ────────────────────────────────────────
  'VILLAGORGONA':                           'VLG',
  'EL MANANTIAL':                           'ELM',
  'CANDELARIA':                             'CDL',
  'DROGAS REBARATAS LA 11 - VILLAGORGONA':  'VLG',
  'EL MANANTIAL - CANDELARIA':              'ELM',

  // ── Cartago — múltiples puntos ───────────────────────────────────────────
  'CARTAGO FOMAG':                          'CTF',
  'ZARAGOZA':                               'ZRG',
  'CIPRES':                                 'CIP',
  'CARTAGO':                                'CTG',  // genérico

  // ── El Cerrito — múltiples puntos ────────────────────────────────────────
  'EL CERRITO VALLEJO':                     'ECV',
  'EL CERRITO EXITO 1':                     'CE1',
  'EL CERRITO EXITO 2':                     'CE2',
  'EL CERRITO EXITO 3':                     'CE3',
  'EL CERRITO':                             'ECE',  // genérico
  'DROGUERIA VALLEJO - EL CERRITO':         'ECV',
  'DROGAS EXITO 1 - EL CERRITO':            'CE1',
  'DROGAS EXITO 2 - EL CERRITO':            'CE2',
  'DROGAS EXITO 3 - EL CERRITO':            'CE3',

  // ── Ginebra — múltiples puntos ───────────────────────────────────────────
  'GINEBRA EXITO 4':                        'GN4',
  'GINEBRA EXITO 5':                        'GN5',
  'GINEBRA':                                'GNB',  // genérico
  'DROGAS EXITO 4 - GINEBRA':               'GN4',
  'DROGAS EXITO 5 - GINEBRA':               'GN5',

  // ── Jamundí — múltiples puntos ───────────────────────────────────────────
  'JAMUNDI':                                'JMD',
  'ALPHAHEALTH JAMUNDI':                    'JMA',
  'ALPHAHEALTH DROGUERIAS - JAMUNDI':       'JMA',

  // ── Palmira — múltiples puntos ───────────────────────────────────────────
  'PALMIRA':                                'PLM',
  'PALMIRA A SU SALUD':                     'PLS',
  'DROGUERIA A SU SALUD - PALMIRA':         'PLS',

  // ── Roldanillo — múltiples puntos ────────────────────────────────────────
  'ROLDANILLO FOMAG':                       'RLF',
  'ROLDANILLO JM':                          'RJM',
  'ROLDANILLO':                             'RLD',
  'DROGUERIA J&M URGENCIAS - ROLDANILLO':   'RJM',

  // ── Tuluá — múltiples puntos ─────────────────────────────────────────────
  'TULUA':                                  'TLU',
  'TULUA SAMARITANA':                       'TLS',
  'TULUA FARMAPRECIOS':                     'TLF',
  'SAMARITANA - TULUA':                     'TLS',
  'DROGUERIA FARMAPRECIOS - TULUA':         'TLF',

  // ── Yumbo — múltiples puntos ─────────────────────────────────────────────
  'YUMBO':                                  'YMB',
  'YUMBO RAPI DROGAS':                      'YRD',
  'DROGUERIA RAPI DROGAS - YUMBO':          'YRD',
};

// Solo strips seguros que no eliminan información de sub-sede
const STRIP_PREFIXES = [
  /^MI FARMACIA\s*-\s*/,
  /^MEDIVALLE\s*-\s*/,
];

export function normSede(s) {
  return (s || '').toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function getSedeCode(sede) {
  if (!sede) return 'GEN';
  const full = normSede(sede);

  // 1. Coincidencia exacta con nombre completo
  if (SEDE_CODES[full]) return SEDE_CODES[full];

  // 2. Strip "MI FARMACIA - " / "MEDIVALLE - " → buscar parte restante
  let stripped = full;
  for (const re of STRIP_PREFIXES) stripped = stripped.replace(re, '').trim();
  if (stripped !== full && SEDE_CODES[stripped]) return SEDE_CODES[stripped];

  // 3. Clave contenida en el nombre (más específica primero)
  const sorted = Object.entries(SEDE_CODES).sort((a, b) => b[0].length - a[0].length);
  for (const [key, code] of sorted) {
    if (stripped.includes(key)) return code;
  }

  // 4. Fallback: primeras 3 letras del nombre limpio
  const letters = stripped.replace(/[^A-Z]/g, '').slice(0, 3);
  return letters || 'GEN';
}

export function nextConsecutivo(db, code) {
  const re = new RegExp(`^AF-${code}(\\d+)$`);
  let max = 0;
  for (const table of ['inventario_equipos', 'inventario_celulares', 'inventario_ups']) {
    try {
      const rows = db.prepare(`SELECT placa FROM ${table} WHERE placa LIKE ?`).all(`AF-${code}%`);
      for (const row of rows) {
        if (!row.placa) continue;
        const m = row.placa.match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    } catch {} // tabla puede no tener columna placa aún
  }
  return String(max + 1).padStart(3, '0');
}
