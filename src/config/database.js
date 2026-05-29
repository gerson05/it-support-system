import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../database/tickets.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

// Asegurar que exista el directorio de la base de datos
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Inicializar tablas usando el esquema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migraciones incrementales (columnas nuevas en tablas existentes)
const migrations = [
  `ALTER TABLE tickets ADD COLUMN title TEXT DEFAULT ''`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* columna ya existe */ }
}

export default db;
