export const migrations = [
  `ALTER TABLE agentes ADD COLUMN current_user TEXT NOT NULL DEFAULT ''`,
];
