export const migrations = [
  `ALTER TABLE tickets ADD COLUMN title TEXT DEFAULT ''`,
  `ALTER TABLE conversations ADD COLUMN warned_inactive INTEGER DEFAULT 0`,
  `ALTER TABLE messages ADD COLUMN attachment TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN chat_id TEXT DEFAULT NULL`,
];
