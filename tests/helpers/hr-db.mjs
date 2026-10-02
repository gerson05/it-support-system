/** Base en memoria con las tablas de Gestión Humana (migración 037) y lo mínimo de roles/permisos. */
import { createMemoryDb } from './sqlite-memory-db.mjs';
import { migrations as m037 } from '../../src/config/migrations/037-gestion-humana-certificados.js';

export function createHrDb() {
  return createMemoryDb([
    'CREATE TABLE permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)',
    'CREATE TABLE roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
    'CREATE TABLE role_permissions (role_id INTEGER, permission_id INTEGER, UNIQUE(role_id, permission_id))',
    "INSERT INTO roles (name) VALUES ('gestion_humana')",
    ...m037,
  ]);
}
