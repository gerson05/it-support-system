export const migrations = [
  `ALTER TABLE inventario_equipos   ADD COLUMN qr_token TEXT`,
  `ALTER TABLE inventario_celulares ADD COLUMN qr_token TEXT`,
  `ALTER TABLE inventario_ups       ADD COLUMN qr_token TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_eq_qr  ON inventario_equipos(qr_token)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_cel_qr ON inventario_celulares(qr_token)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ups_qr ON inventario_ups(qr_token)`,
];
