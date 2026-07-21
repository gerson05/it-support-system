import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DB       = path.join(__dirname, 'tickets_rebuilt.db');
const DUMP     = path.join(__dirname, 'dump.json');
const RECOVERED= path.join(__dirname, 'recovered_tables.json');
const SCHEMA   = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = OFF');
db.exec(readFileSync(SCHEMA, 'utf8'));

const mFiles = [
  '001-base','002-core','003-auth','004-inventario','005-tracking',
  '006-monitoring','007-knowledge','008-despacho-extras','009-requerimientos',
  '010-reuniones','011-bodegas','012-qr-activos','013-agent-inventario',
  '014-celulares-placa','015-employees-fix','016-employees-permissions',
  '017-despacho-delete-perm','018-acta-signers','019-confirmacion-signed',
  '020-puntos-unificados','021-puntos-dedup','022-puntos-merge-dup-bodegas',
  '023-celulares-serial','024-wp-messages','025-kb-embeddings','026-inventario-categoria',
];

for (const f of mFiles) {
  const mod = await import(pathToFileURL(path.join(root, 'src/config/migrations', f + '.js')).href);
  for (const sql of mod.migrations) {
    try { db.exec(sql); } catch {}
  }
}
console.log('Schema + 26 migrations applied.');

const dump = JSON.parse(readFileSync(DUMP, 'utf8'));
const rec  = JSON.parse(readFileSync(RECOVERED, 'utf8'));
for (const [t, rows] of Object.entries(rec)) {
  if (rows.length > 0) dump[t] = rows;
}

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
  'role_permissions','audit_log','ai_ticket_analysis','app_config','tipos_articulo',
];

for (const table of order) {
  const rows = dump[table];
  if (!rows?.length) continue;
  const cols = Object.keys(rows[0]);
  const ph   = cols.map(() => '?').join(',');
  try {
    const stmt = db.prepare(`INSERT OR IGNORE INTO "${table}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${ph})`);
    let ok = 0;
    for (const row of rows) {
      try { stmt.run(...cols.map(c => row[c])); ok++; } catch {}
    }
    console.log(`  ${table}: ${ok}/${rows.length}`);
  } catch(e) { console.log(`  SKIP ${table}: ${e.message}`); }
}

db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const check = db.prepare('PRAGMA integrity_check').get();
console.log('\nIntegrity:', check.integrity_check);
console.log('inventario_equipos:', db.prepare('SELECT COUNT(*) as c FROM inventario_equipos').get().c, 'rows');
console.log('users:',              db.prepare('SELECT COUNT(*) as c FROM users').get().c, 'rows');
console.log('employees:',          db.prepare('SELECT COUNT(*) as c FROM employees').get().c, 'rows');
