export const migrations = [
  `ALTER TABLE inventario_equipos ADD COLUMN nombre_completo TEXT`,
  `ALTER TABLE inventario_equipos ADD COLUMN cedula TEXT`,
  `ALTER TABLE inventario_ups ADD COLUMN nombre_completo TEXT`,
  `ALTER TABLE inventario_ups ADD COLUMN cedula TEXT`,
];
