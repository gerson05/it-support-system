export const migrations = [
  `ALTER TABLE inventario_celulares ADD COLUMN placa TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_cel_placa ON inventario_celulares(placa) WHERE placa IS NOT NULL`,
];
