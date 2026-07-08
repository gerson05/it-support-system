export const migrations = [
  `ALTER TABLE acta_uploads ADD COLUMN signed_by TEXT`,
  `ALTER TABLE acta_uploads ADD COLUMN signed_role TEXT`,
];