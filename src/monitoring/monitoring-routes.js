import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { getSedeCode, nextConsecutivo } from '../inventario/sede-codes.js';
import { wrap } from '../utils/async-handler.js';

const router = Router();
const canRead    = [requireAuth, requirePermission('monitoring:read')];
const canCommand = [requireAuth, requirePermission('monitoring:command')];
const sseClients = new Set();

export function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of [...sseClients]) {
    if (res.writableEnded) { sseClients.delete(res); continue; }
    res.write(msg);
  }
}

export function startOfflineChecker() {
  setInterval(() => {
    const r = db.prepare(`
      UPDATE agentes SET estado = 'offline'
      WHERE estado = 'online' AND datetime(last_seen) < datetime('now', '-90 minutes')
    `).run();
    if (r.changes > 0) broadcast({ type: 'offline_sweep' });
    db.prepare(`DELETE FROM metricas_agentes WHERE timestamp < datetime('now', '-24 hours')`).run();
    db.prepare(`
      UPDATE comandos_agente
      SET estado = 'error',
          output = output || '\n[Error: tiempo de espera agotado]',
          updated_at = datetime('now')
      WHERE estado = 'ejecutando'
        AND datetime(updated_at) < datetime('now', '-5 minutes')
    `).run();
  }, 20000);
}

// ── Validación de serial ─────────────────────────────────────────────────────
const INVALID_SERIAL_EXACT    = /^(none|n\/a|na|0+|unknown|default|chassis\s+serial|system\s+serial)$/i;
const INVALID_SERIAL_CONTAINS = /to\s+be\s+filled|default\s+string|system\s+serial\s+number/i;

function isValidSerial(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 4) return false;
  if (INVALID_SERIAL_EXACT.test(t) || INVALID_SERIAL_CONTAINS.test(t)) return false;
  return (t.match(/[a-zA-Z0-9]/g) || []).length >= 3;
}

// ── Vinculación agente ↔ inventario ─────────────────────────────────────────
function linkInventory(agentId, hw) {
  try {
    const row = db.prepare('SELECT inventario_equipo_id FROM agentes WHERE id=?').get(agentId);
    if (row?.inventario_equipo_id) return;

    const serial = hw.serial?.trim() || '';
    if (!isValidSerial(serial)) return;

    let equipo = db.prepare('SELECT id FROM inventario_equipos WHERE serial=?').get(serial);

    if (!equipo) {
      const qr_token = crypto.randomUUID();
      const code     = getSedeCode(hw.sede);
      const num      = nextConsecutivo(db, code);
      const placa    = `AF-${code}${num}`;
      const marca    = hw.manufacturer?.trim() || 'Sin marca';
      const nombre   = hw.model?.trim() || hw.hostname;
      const ram      = hw.ram_total  ? String(hw.ram_total)  : null;
      const disco    = hw.disk_total ? String(hw.disk_total) : null;

      try {
        const r = db.prepare(`
          INSERT INTO inventario_equipos
            (placa, marca, nombre_equipo, serial, procesador, ram, cap_disco, tipo_disco, qr_token)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(placa, marca, nombre, serial, hw.cpu_model || null, ram, disco, hw.disk_model || null, qr_token);
        equipo = { id: r.lastInsertRowid };
        console.log(`[Inventario] Auto-registrado: ${hw.hostname} → ${placa} serial=${serial}`);
      } catch {
        equipo = db.prepare('SELECT id FROM inventario_equipos WHERE serial=?').get(serial);
        if (!equipo) return;
      }
    }

    db.prepare('UPDATE agentes SET serial=?, inventario_equipo_id=? WHERE id=?')
      .run(serial, equipo.id, agentId);
  } catch (e) {
    console.error(`[Inventario] linkInventory error agente ${agentId}:`, e.message);
  }
}

function agentAuth(req, res, next) {
  const agentId = parseInt(req.headers['x-agent-id'], 10);
  const apiKey  = req.headers['x-api-key'];
  if (!agentId || !apiKey) return res.status(401).json({ error: 'Missing credentials.' });
  const agent = db.prepare('SELECT id FROM agentes WHERE id = ? AND api_key = ?').get(agentId, apiKey);
  if (!agent) return res.status(403).json({ error: 'Invalid credentials.' });
  req.agentId = agent.id;
  next();
}

/* POST /api/monitoring/register */
router.post('/api/monitoring/register', (req, res) => {
  const { hostname, ip, mac_address, os_name, os_version,
          cpu_model, cpu_cores, cpu_ghz, ram_total,
          disk_model, disk_total, gpu,
          serial, manufacturer, model, sede } = req.body;
  if (!hostname || !mac_address) return res.status(400).json({ error: 'hostname and mac_address required.' });

  const hw      = { hostname, ip, mac_address, os_name, os_version,
                    cpu_model, cpu_cores, cpu_ghz, ram_total,
                    disk_model, disk_total, gpu, serial, manufacturer, model, sede };
  const sedeVal = sede?.trim() || null;

  const existing = db.prepare('SELECT id, api_key FROM agentes WHERE mac_address = ?').get(mac_address);
  if (existing) {
    db.prepare(`
      UPDATE agentes
      SET hostname=?,ip=?,os_name=?,os_version=?,cpu_model=?,cpu_cores=?,cpu_ghz=?,
          ram_total=?,disk_model=?,disk_total=?,gpu=?,
          sede=COALESCE(?,sede),
          estado='online',last_seen=datetime('now')
      WHERE id=?
    `).run(hostname, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
           ram_total, disk_model, disk_total, gpu, sedeVal, existing.id);
    linkInventory(existing.id, hw);
    broadcast({ type: 'agent_updated', agent_id: existing.id });
    return res.json({ id: existing.id, api_key: existing.api_key });
  }

  const api_key = crypto.randomBytes(32).toString('hex');
  const result  = db.prepare(`
    INSERT INTO agentes
      (hostname,mac_address,ip,os_name,os_version,cpu_model,cpu_cores,cpu_ghz,
       ram_total,disk_model,disk_total,gpu,sede,api_key,estado,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'online',datetime('now'))
  `).run(hostname, mac_address, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
         ram_total, disk_model, disk_total, gpu, sedeVal, api_key);

  const newId = result.lastInsertRowid;
  linkInventory(newId, hw);
  broadcast({ type: 'agent_registered', agent_id: newId });
  res.json({ id: newId, api_key });
});

/* POST /api/monitoring/heartbeat */
router.post('/api/monitoring/heartbeat', agentAuth, wrap(async (req, res) => {
  const { cpu_percent, ram_used, disk_used, uptime } = req.body;
  let pending = [];

  db.prepare('BEGIN').run();
  try {
    db.prepare(`UPDATE agentes SET estado='online', last_seen=datetime('now') WHERE id=?`)
      .run(req.agentId);

    db.prepare(`
      INSERT INTO metricas_agentes (agente_id, cpu_percent, ram_used, disk_used, uptime)
      VALUES (?,?,?,?,?)
    `).run(req.agentId, cpu_percent, ram_used, disk_used, uptime);

    const agent = db.prepare('SELECT ram_total, disk_total FROM agentes WHERE id=?').get(req.agentId);

    const cmds = db.prepare(`
      SELECT id, tipo, parametro FROM comandos_agente
      WHERE agente_id = ? AND estado = 'pendiente'
      ORDER BY id ASC LIMIT 5
    `).all(req.agentId);

    if (cmds.length) {
      const ids = cmds.map(c => c.id);
      db.prepare(
        `UPDATE comandos_agente SET estado = 'ejecutando', updated_at = datetime('now')
         WHERE id IN (${ids.map(() => '?').join(',')})`
      ).run(...ids);
    }

    db.prepare('COMMIT').run();
    pending = cmds;

    broadcast({
      type: 'metrics', agent_id: req.agentId,
      cpu_percent, ram_used, disk_used, uptime,
      ram_total: agent?.ram_total, disk_total: agent?.disk_total,
    });

    res.json({ ok: true, commands: pending });
  } catch (te) {
    try { db.prepare('ROLLBACK').run(); } catch {}
    throw te;
  }
}));

/* GET /api/monitoring/agents */
router.get('/api/monitoring/agents', ...canRead, (req, res) => {
  const agents = db.prepare(`
    SELECT a.*,
           m.cpu_percent, m.ram_used, m.disk_used, m.uptime,
           m.timestamp AS metric_ts
    FROM agentes a
    LEFT JOIN metricas_agentes m ON m.id = (
      SELECT id FROM metricas_agentes WHERE agente_id = a.id ORDER BY id DESC LIMIT 1
    )
    ORDER BY a.estado DESC, a.hostname ASC
  `).all();
  res.json(agents);
});

/* GET /api/monitoring/agents/:id */
router.get('/api/monitoring/agents/:id', ...canRead, (req, res) => {
  const agent = db.prepare('SELECT * FROM agentes WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found.' });
  const metrics = db.prepare(`
    SELECT * FROM metricas_agentes
    WHERE agente_id = ? AND timestamp > datetime('now', '-24 hours')
    ORDER BY id DESC LIMIT 144
  `).all(req.params.id);
  res.json({ ...agent, metrics });
});

/* GET /api/monitoring/stream — SSE */
router.get('/api/monitoring/stream', ...canRead, (req, res) => {
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: {"type":"connected"}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

/* POST /api/monitoring/agents/:id/command */
router.post('/api/monitoring/agents/:id/command', ...canCommand, (req, res) => {
  const { tipo, parametro } = req.body;
  const validTypes = [
    'reboot', 'shutdown', 'kill_process', 'processes', 'shell',
    'clear_temp',
    'restart_spooler', 'list_printers', 'set_default_printer',
    'flush_dns', 'renew_ip', 'net_info', 'net_diag', 'restart_adapter', 'fix_smb',
    'full_diag', 'list_software', 'list_services', 'get_events', 'startup_items', 'antivirus_status',
    'run_sfc', 'run_dism', 'enable_admin', 'windows_update',
  ];
  if (!validTypes.includes(tipo)) return res.status(400).json({ error: 'Tipo de comando inválido.' });
  if ((tipo === 'kill_process' || tipo === 'shell' || tipo === 'set_default_printer') && !parametro?.trim())
    return res.status(400).json({ error: 'parametro requerido para este tipo.' });

  const agent = db.prepare('SELECT id FROM agentes WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agente no encontrado.' });

  const creado_por = req.user?.username || req.user?.name || 'admin';
  const result = db.prepare(`
    INSERT INTO comandos_agente (agente_id, tipo, parametro, creado_por)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, tipo, parametro || null, creado_por);

  broadcast({ type: 'command_queued', agent_id: parseInt(req.params.id), cmd_id: result.lastInsertRowid });
  res.json({ cmd_id: result.lastInsertRowid });
});

/* POST /api/monitoring/command/:id/output */
router.post('/api/monitoring/command/:id/output', agentAuth, (req, res) => {
  const { chunk, done, exit_code } = req.body;
  const cmd = db.prepare('SELECT agente_id FROM comandos_agente WHERE id = ?').get(req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Comando no encontrado.' });
  if (cmd.agente_id !== req.agentId) return res.status(403).json({ error: 'Acceso denegado.' });

  if (chunk) {
    db.prepare(`UPDATE comandos_agente SET output = output || ?, updated_at = datetime('now') WHERE id = ?`)
      .run(chunk, req.params.id);
    broadcast({ type: 'command_output', cmd_id: parseInt(req.params.id), agent_id: req.agentId, chunk });
  }

  if (done) {
    const estado = (exit_code === 0) ? 'completado' : 'error';
    db.prepare(`UPDATE comandos_agente SET estado = ?, exit_code = ?, updated_at = datetime('now') WHERE id = ? AND estado = 'ejecutando'`)
      .run(estado, exit_code ?? 1, req.params.id);
    broadcast({ type: 'command_done', cmd_id: parseInt(req.params.id), agent_id: req.agentId, exit_code: exit_code ?? 1 });
  }

  res.json({ ok: true });
});

/* GET /api/monitoring/agents/:id/commands */
router.get('/api/monitoring/agents/:id/commands', ...canCommand, (req, res) => {
  const commands = db.prepare(`
    SELECT * FROM comandos_agente
    WHERE agente_id = ?
    ORDER BY id DESC LIMIT 50
  `).all(req.params.id);
  res.json(commands);
});

export default router;
