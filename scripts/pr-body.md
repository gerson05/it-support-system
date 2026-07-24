## Summary

- **MariaDB support**: Full dual-mode DB adapter — uses MariaDB when `DB_HOST` is set, SQLite otherwise. Includes async wrapper, SQL fixup layer (INSERT OR IGNORE, datetime, etc.), transaction support via AsyncLocalStorage, utf8mb4 charset.
- **Security hardening**: Removed WhatsApp credentials/runtime data from git, XSS escaping across 9 frontend modules, rate limiting on public endpoints, adm-zip CVE fix.
- **CI/CD improvements**: Parallelized jobs, coverage thresholds, Trivy security audit, Dependabot, Node 24, fixed job ID syntax.
- **Bug fixes**: Acta download path (Windows/Docker mismatch), despacho field mapping, duplicate CI steps.
- **Frontend**: Added `type="module"` to all HTML script tags loading ES module files.

## Test plan

- [ ] `git pull` on Linux server, set `DB_HOST/DB_USER/DB_PASS/DB_NAME` in `.env`
- [ ] `npm install` (installs mysql2 3.x)
- [ ] Start server — verify `[DB] Conectado a MariaDB` in logs
- [ ] Login at `/login.html` — no browser console errors
- [ ] Test tickets, despachos, inventario, employees CRUD
- [ ] Verify SQLite still works locally (no `DB_HOST` set)
