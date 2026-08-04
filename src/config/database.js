import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { migrations as m001 } from './migrations/001-base.js';
import { migrations as m002 } from './migrations/002-core.js';
import { migrations as m003 } from './migrations/003-auth.js';
import { migrations as m004 } from './migrations/004-inventario.js';
import { migrations as m005 } from './migrations/005-tracking.js';
import { migrations as m006 } from './migrations/006-monitoring.js';
import { migrations as m007 } from './migrations/007-knowledge.js';
import { migrations as m008 } from './migrations/008-despacho-extras.js';
import { migrations as m009 } from './migrations/009-requerimientos.js';
import { migrations as m010 } from './migrations/010-reuniones.js';
import { migrations as m011 } from './migrations/011-bodegas.js';
import { migrations as m012 } from './migrations/012-qr-activos.js';
import { migrations as m013 } from './migrations/013-agent-inventario.js';
import { migrations as m014 } from './migrations/014-celulares-placa.js';
import { migrations as m015 } from './migrations/015-employees-fix.js';
import { migrations as m016 } from './migrations/016-employees-permissions.js';
import { migrations as m017 } from './migrations/017-despacho-delete-perm.js';
import { migrations as m018 } from './migrations/018-acta-signers.js';
import { migrations as m019 } from './migrations/019-confirmacion-signed.js';
import { migrations as m020 } from './migrations/020-puntos-unificados.js';
import { migrations as m021 } from './migrations/021-puntos-dedup.js';
import { migrations as m022 } from './migrations/022-puntos-merge-dup-bodegas.js';
import { migrations as m023 } from './migrations/023-celulares-serial.js';
import { migrations as m024 } from './migrations/024-wp-messages.js';
import { migrations as m025 } from './migrations/025-kb-embeddings.js';
import { migrations as m026 } from './migrations/026-inventario-categoria.js';
import { migrations as m027 } from './migrations/027-celulares-numero-telefono.js';
import { migrations as m028 } from './migrations/028-inventario-sede.js';
import { migrations as m029 } from './migrations/029-agent-current-user.js';
import { migrations as m030 } from './migrations/030-tipos-articulo-seed.js';
import { migrations as m031 } from './migrations/031-tipos-articulo-dedup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Converts SQLite-specific SQL to MariaDB-compatible SQL
const TIME_UNIT_MAP = { second: 'SECOND', minute: 'MINUTE', hour: 'HOUR', day: 'DAY', month: 'MONTH', year: 'YEAR' };
function toMariaInterval(base, n, unit) {
  const num = parseInt(n, 10);
  const u = TIME_UNIT_MAP[unit.toLowerCase().replace(/s$/, '')] || 'DAY';
  if (num < 0) return `DATE_SUB(${base}, INTERVAL ${Math.abs(num)} ${u})`;
  if (num > 0) return `DATE_ADD(${base}, INTERVAL ${num} ${u})`;
  return base;
}

function fixSql(sql) {
  return sql
    // DML compatibility
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO')
    .replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO')
    .replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/gi, '')
    .replace(/ON\s+CONFLICT\s+DO\s+NOTHING/gi, '')
    // datetime('now', 'localtime', '-N unit') — localtime BEFORE offset
    .replace(/datetime\s*\(\s*'now'\s*,\s*'localtime'\s*,\s*'(-?\d+)\s+(seconds?|minutes?|hours?|days?|months?|years?)'\s*\)/gi,
      (_, n, u) => toMariaInterval('NOW()', n, u))
    // datetime('now', '-N unit') or datetime('now', '-N unit', 'localtime') — offset first
    .replace(/datetime\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(seconds?|minutes?|hours?|days?|months?|years?)'\s*(?:,\s*'localtime'\s*)?\)/gi,
      (_, n, u) => toMariaInterval('NOW()', n, u))
    // plain datetime('now', 'localtime') or datetime('now')
    .replace(/datetime\s*\(\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi, 'NOW()')
    // specific session expiry comparisons (must come before generic datetime(col))
    .replace(/datetime\s*\(\s*s\.expires_at\s*\)\s*>/gi, 's.expires_at >')
    .replace(/datetime\s*\(\s*expires_at\s*\)\s*<=/gi, 'expires_at <=')
    // datetime(column) → just the column; MariaDB compares ISO datetime strings natively
    .replace(/datetime\s*\(\s*([\w.]+)\s*\)/gi, '$1')
    // strftime('%Y-%m-%d %H:%M:%S', 'now') → NOW()
    .replace(/strftime\s*\(\s*'%Y-%m-%d %H:%M:%S'\s*,\s*'now'\s*\)/gi, 'NOW()')
    // date('now', 'localtime', '-N unit') — localtime BEFORE offset
    .replace(/\bdate\s*\(\s*'now'\s*,\s*'localtime'\s*,\s*'(-?\d+)\s+(seconds?|minutes?|hours?|days?|months?|years?)'\s*\)/gi,
      (_, n, u) => toMariaInterval('CURDATE()', n, u))
    // date('now', '-N unit') or date('now', '-N unit', 'localtime')
    .replace(/\bdate\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(seconds?|minutes?|hours?|days?|months?|years?)'\s*(?:,\s*'localtime'\s*)?\)/gi,
      (_, n, u) => toMariaInterval('CURDATE()', n, u))
    // plain date('now', 'localtime') or date('now')
    .replace(/\bdate\s*\(\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi, 'CURDATE()')
    // date(column, 'localtime') → DATE(column)
    .replace(/\bdate\s*\(\s*([\w.]+)\s*,\s*'localtime'\s*\)/gi, 'DATE($1)')
    // strftime('%s', col) → UNIX_TIMESTAMP(col)
    .replace(/strftime\s*\(\s*'%s'\s*,\s*([\w.]+)\s*\)/gi, 'UNIX_TIMESTAMP($1)')
    .replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');
}

const useMariaDB = !!(process.env.DB_HOST);

let db;

if (useMariaDB) {
  const mysql = (await import('mysql2/promise')).default;
  const { AsyncLocalStorage } = await import('async_hooks');
  const txStorage = new AsyncLocalStorage();

  const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASS     || '',
    database:           process.env.DB_NAME     || 'it_tickets',
    charset:            'utf8mb4',
    timezone:           'local',
    waitForConnections: true,
    connectionLimit:    10,
    multipleStatements: true,
    decimalNumbers:     true,
  });

  const execOne = async (sql, params = []) => {
    const conn = txStorage.getStore();
    return conn ? conn.execute(sql, params) : pool.execute(sql, params);
  };

  db = {
    prepare(sql) {
      const fixed = fixSql(sql)
        .replace(/\bSELECT\s+last_insert_rowid\s*\(\s*\)\s+as\s+\w+/gi, 'SELECT LAST_INSERT_ID() as id');
      return {
        async all(...args) {
          const params = args.flat();
          const [rows] = await execOne(fixed, params.length ? params : []);
          return rows;
        },
        async get(...args) {
          const params = args.flat();
          const [rows] = await execOne(fixed, params.length ? params : []);
          return rows[0] ?? null;
        },
        async run(...args) {
          const params = args.flat();
          const [result] = await execOne(fixed, params.length ? params : []);
          return { lastInsertRowid: result.insertId, changes: result.affectedRows };
        },
      };
    },
    async exec(sql) {
      const stmts = sql.split(';').map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('PRAGMA'));
      for (const stmt of stmts) {
        const clean = fixSql(stmt);
        if (/^BEGIN(\s+TRANSACTION)?$/i.test(clean)) {
          const conn = await pool.getConnection();
          await conn.beginTransaction();
          txStorage.enterWith(conn);
        } else if (/^COMMIT$/i.test(clean)) {
          const conn = txStorage.getStore();
          if (conn) { await conn.commit(); conn.release(); txStorage.enterWith(null); }
        } else if (/^ROLLBACK$/i.test(clean)) {
          const conn = txStorage.getStore();
          if (conn) { await conn.rollback(); conn.release(); txStorage.enterWith(null); }
        } else {
          const conn = txStorage.getStore();
          try {
            conn ? await conn.query(clean) : await pool.query(clean);
          } catch { /* ignore migration/schema errors */ }
        }
      }
    },
    pool,
  };

  // Run migrations (safe — uses IF NOT EXISTS / try-catch)
  const allMigrations = [
    ...m001, ...m002, ...m003, ...m004, ...m005,
    ...m006, ...m007, ...m008, ...m009, ...m010, ...m011, ...m012, ...m013, ...m014, ...m015, ...m016, ...m017,
    ...m018, ...m019, ...m020, ...m021, ...m022, ...m023, ...m024, ...m025, ...m026, ...m027, ...m028, ...m029, ...m030, ...m031,
  ];
  for (const sql of allMigrations) {
    try { await db.exec(sql); } catch { /* column/table already exists */ }
  }

  // Generate missing QR tokens
  try {
    const { randomUUID } = await import('crypto');
    for (const tabla of ['inventario_equipos', 'inventario_celulares', 'inventario_ups']) {
      const sin = await db.prepare(`SELECT id FROM ${tabla} WHERE qr_token IS NULL`).all();
      for (const row of sin) await db.prepare(`UPDATE ${tabla} SET qr_token=? WHERE id=?`).run(randomUUID(), row.id);
      if (sin.length) console.log(`[DB] ${sin.length} tokens QR generados en ${tabla}.`);
    }
  } catch {}

  // Clean expired sessions
  try { await pool.execute('DELETE FROM sessions WHERE expires_at <= NOW()'); } catch {}

  // Initialize sedes if empty
  try {
    const [sedesRows] = await pool.execute('SELECT COUNT(*) as n FROM sedes');
    if (sedesRows[0].n === 0) {
      const { CIUDADES } = await import('../whatsapp/sedes.js');
      for (const [ciudad, puntos] of Object.entries(CIUDADES)) {
        for (const punto of puntos) {
          await pool.execute('INSERT IGNORE INTO sedes (ciudad, nombre_punto) VALUES (?, ?)', [ciudad, punto]);
        }
      }
      const [cnt] = await pool.execute('SELECT COUNT(*) as n FROM sedes');
      console.log(`[DB] Red de puntos inicializada: ${cnt[0].n} puntos.`);
    }
  } catch (e) {
    console.warn('[DB] No se pudo verificar/inicializar sedes:', e.message);
  }

  console.log(`[DB] Conectado a MariaDB ${process.env.DB_HOST}/${process.env.DB_NAME || 'it_tickets'}`);

} else {
  // ── SQLite (modo local / desarrollo) ─────────────────────────────────────
  const { DatabaseSync } = await import('node:sqlite');

  const dbPath     = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(__dirname, '../../database/tickets.db');
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA synchronous = NORMAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));

  const allMigrations = [
    ...m001, ...m002, ...m003, ...m004, ...m005,
    ...m006, ...m007, ...m008, ...m009, ...m010, ...m011, ...m012, ...m013, ...m014, ...m015, ...m016, ...m017,
    ...m018, ...m019, ...m020, ...m021, ...m022, ...m023, ...m024, ...m025, ...m026, ...m027, ...m028, ...m029, ...m030, ...m031,
  ];
  for (const sql of allMigrations) {
    try { sqlite.exec(sql); } catch { /* column/table already exists */ }
  }

  // Wrap SQLite sync API as async (same interface as MariaDB wrapper)
  db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        async all(...args)  { return stmt.all(...args); },
        async get(...args)  { return stmt.get(...args); },
        async run(...args)  { return stmt.run(...args); },
      };
    },
    async exec(sql) { sqlite.exec(sql); },
  };

  // Generate missing QR tokens
  try {
    const { randomUUID } = await import('crypto');
    for (const tabla of ['inventario_equipos', 'inventario_celulares', 'inventario_ups']) {
      const sin = sqlite.prepare(`SELECT id FROM ${tabla} WHERE qr_token IS NULL`).all();
      const upd = sqlite.prepare(`UPDATE ${tabla} SET qr_token=? WHERE id=?`);
      for (const row of sin) upd.run(randomUUID(), row.id);
      if (sin.length) console.log(`[DB] ${sin.length} tokens QR generados en ${tabla}.`);
    }
  } catch {}

  // Clean expired sessions
  try { sqlite.exec("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')"); } catch {}

  // Initialize bodegas from Excel if empty
  const bodegasPath = path.resolve(__dirname, '../../Bodegas_Propios.xlsx');
  const bodegasCount = sqlite.prepare('SELECT COUNT(*) as n FROM bodegas').get().n;
  if (bodegasCount === 0 && fs.existsSync(bodegasPath)) {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(bodegasPath);
      const ws = wb.getWorksheet(1);
      const ins = sqlite.prepare('INSERT INTO bodegas (nombre, ciudad, activo) VALUES (?, ?, 1)');
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const nombre = String(row.getCell(2).value || '').trim();
        const estado = String(row.getCell(4).value || '').trim();
        if (!nombre || estado !== 'A') return;
        const ciudad = nombre
          .replace(/^\d+\s+MI\s+FARMA?CIA\s+/i, '')
          .replace(/\s*\(?\s*FOMAG\s*\)?\s*$/i, '')
          .trim()
          .toUpperCase();
        ins.run(nombre, ciudad);
      });
      console.log(`[DB] Bodegas inicializadas desde Excel: ${sqlite.prepare('SELECT COUNT(*) as n FROM bodegas').get().n} bodegas.`);
    } catch (e) {
      console.error('[DB] Error inicializando bodegas:', e.message);
    }
  }

  // Initialize sedes if empty
  const sedesCount = sqlite.prepare('SELECT COUNT(*) as n FROM sedes').get().n;
  if (sedesCount === 0) {
    const { CIUDADES } = await import('../whatsapp/sedes.js');
    const ins = sqlite.prepare('INSERT INTO sedes (ciudad, nombre_punto) VALUES (?, ?)');
    for (const [ciudad, puntos] of Object.entries(CIUDADES)) {
      for (const punto of puntos) ins.run(ciudad, punto);
    }
    console.log(`[DB] Red de puntos inicializada: ${sqlite.prepare('SELECT COUNT(*) as n FROM sedes').get().n} puntos.`);
  }
}

export default db;
