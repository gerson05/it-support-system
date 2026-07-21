/**
 * Rebuilds tickets.db from scratch using schema + all migrations,
 * then imports data recovered from the corrupted DB.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB       = '/app/database/tickets.db';
const BACKUP   = '/app/database/tickets.db.bak';
const DUMP     = '/app/database/dump.json';
const RECOVERED= '/app/database/recovered_tables.json';
const SCHEMA   = '/app/database/schema.sql';

// Backup old DB
if (existsSync(DB)) renameSync(DB, BACKUP);

// Create fresh DB
const db = new DatabaseSync(DB);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = OFF'); // disable FK during import

// Apply schema
db.exec(readFileSync(SCHEMA, 'utf8'));

// Apply all migrations in order
const migDir = '/app/src/config/migrations';
const mFiles = [
  '001-base.js','002-core.js','003-auth.js','004-inventario.js','005-tracking.js',
  '006-monitoring.js','007-knowledge.js','008-despacho-extras.js','009-requerimientos.js',
  '010-reuniones.js','011-bodegas.js','012-qr-activos.js','013-agent-inventario.js',
  '014-celulares-placa.js','015-employees-fix.js','016-employees-permissions.js',
  '017-despacho-delete-perm.js','018-acta-signers.js','019-confirmacion-signed.js',
  '020-puntos-unificados.js','021-puntos-dedup.js','022-puntos-merge-dup-bodegas.js',
  '023-celulares-serial.js','024-wp-messages.js','025-kb-embeddings.js',
  '026-inventario-categoria.js',
];

for (const f of mFiles) {
  const mod = await import(`${migDir}/${f}`);
  for (const sql of mod.migrations) {
    try { db.exec(sql); } catch {}
  }
}
console.log('Schema + migrations applied.');

// Import data
const dump = JSON.parse(readFileSync(DUMP, 'utf8'));
const rec  = JSON.parse(readFileSync(RECOVERED, 'utf8'));

// Merge recovered tables into dump
for (const [t, rows] of Object.entries(rec)) {
  if (rows.length > 0) dump[t] = rows;
}

// Import order (respect FK dependencies)
const order = [
  'roles','permissions','users','sessions',
  'sedes','bodegas','agentes','agents',
  'conversations','tickets','internal_notes',
  'custom_faqs','kb_items','faq_hits',
  'puntos','registro_tokens',
  'inventario_equipos','inventario_celulares','inventario_ups',
  'employees','employee_areas','employee_cargos','employee_logs',
  'despachos','despacho_borradores',
  'tech_requests','tech_request_items','tech_request_history',
  'paquete_tracking','paquete_entrega_items','paquete_eventos','paquete_acta_final',
  'acta_uploads','confirmaciones_entrega',
  'requerimientos','reuniones','salas',
  'messages','metricas_agentes','comandos_agente',
  'role_permissions','audit_log','ai_ticket_analysis','app_config',
  'tipos_articulo',
];

for (const table of order) {
  const rows = dump[table];
  if (!rows?.length) continue;
  const cols = Object.keys(rows[0]);
  const ph   = cols.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT OR IGNORE INTO "${table}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${ph})`);
  let ok = 0;
  for (const row of rows) {
    try { stmt.run(...cols.map(c => row[c])); ok++; } catch {}
  }
  console.log(`  ${table}: ${ok}/${rows.length}`);
}

db.exec('PRAGMA foreign_keys = ON');
const check = db.prepare('PRAGMA integrity_check').get();
console.log('\nIntegrity:', check.integrity_check);
console.log('inventario_equipos:', db.prepare('SELECT COUNT(*) as c FROM inventario_equipos').get().c);
console.log('users:', db.prepare('SELECT COUNT(*) as c FROM users').get().c);
