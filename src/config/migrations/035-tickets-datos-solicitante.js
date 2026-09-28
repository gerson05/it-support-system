// Datos del solicitante capturados por el chatbot, visibles en el detalle del ticket
export const migrations = [
  `ALTER TABLE tickets ADD COLUMN cedula TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN cargo TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN sede TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN ciudad TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN equipment_name TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN equipment_serial TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN tech_request_id INTEGER DEFAULT NULL`,
];
