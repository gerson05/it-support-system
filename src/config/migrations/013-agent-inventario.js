export const migrations = [
  `ALTER TABLE agentes ADD COLUMN serial TEXT`,
  `ALTER TABLE agentes ADD COLUMN inventario_equipo_id INTEGER REFERENCES inventario_equipos(id)`,
  `CREATE INDEX IF NOT EXISTS idx_agentes_serial ON agentes(serial)`,
  `CREATE INDEX IF NOT EXISTS idx_agentes_inv_equipo ON agentes(inventario_equipo_id)`,
];
