export const migrations = [
  `ALTER TABLE agentes ADD COLUMN logged_user TEXT NOT NULL DEFAULT ''`,
];
