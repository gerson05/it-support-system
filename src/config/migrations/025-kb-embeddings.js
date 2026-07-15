export const migrations = [
  `ALTER TABLE kb_items ADD COLUMN embedding TEXT DEFAULT NULL`,
];
