export const migrations = [
  `ALTER TABLE inventario_equipos ADD COLUMN categoria TEXT DEFAULT 'computadores'`,
  `CREATE INDEX IF NOT EXISTS idx_eq_categoria ON inventario_equipos(categoria)`,
];
