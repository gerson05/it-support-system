export const migrations = [
  `ALTER TABLE confirmaciones_entrega ADD COLUMN signed_by TEXT`,
  `ALTER TABLE confirmaciones_entrega ADD COLUMN signature_data TEXT`,
];
