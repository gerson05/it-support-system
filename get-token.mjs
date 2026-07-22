import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/tickets.db');
const sessions = db.prepare(
  "SELECT token, user_id, expires_at FROM sessions WHERE datetime(expires_at) > datetime('now') ORDER BY expires_at DESC LIMIT 5"
).all();
console.log(JSON.stringify(sessions, null, 2));
db.close();
