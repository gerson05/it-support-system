import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = Router();
const canRead = [requireAuth, requirePermission('monitoring:read')];
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
      WHERE estado = 'online' AND datetime(last_seen) < datetime('now', '-30 seconds')
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
          disk_model, disk_total, gpu } = req.body;
  if (!hostname || !mac_address) return res.status(400).json({ error: 'hostname and mac_address required.' });

  const existing = db.prepare('SELECT id, api_key FROM agentes WHERE mac_address = ?').get(mac_address);
  if (existing) {
    db.prepare(`
      UPDATE agentes
      SET hostname=?,ip=?,os_name=?,os_version=?,cpu_model=?,cpu_cores=?,cpu_ghz=?,
          ram_total=?,disk_model=?,disk_total=?,gpu=?,estado='online',last_seen=datetime('now')
      WHERE id=?
    `).run(hostname, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
           ram_total, disk_model, disk_total, gpu, existing.id);
    broadcast({ type: 'agent_updated', agent_id: existing.id });
    return res.json({ id: existing.id, api_key: existing.api_key });
  }

  const api_key = crypto.randomBytes(32).toString('hex');
  const result = db.prepare(`
    INSERT INTO agentes
      (hostname,mac_address,ip,os_name,os_version,cpu_model,cpu_cores,cpu_ghz,
       ram_total,disk_model,disk_total,gpu,api_key,estado,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'online',datetime('now'))
  `).run(hostname, mac_address, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
         ram_total, disk_model, disk_total, gpu, api_key);

  broadcast({ type: 'agent_registered', agent_id: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid, api_key });
});

/* POST /api/monitoring/heartbeat */
router.post('/api/monitoring/heartbeat', agentAuth, (req, res) => {
  const { cpu_percent, ram_used, disk_used, uptime } = req.body;

  db.prepare(`UPDATE agentes SET estado='online', last_seen=datetime('now') WHERE id=?`)
    .run(req.agentId);

  db.prepare(`
    INSERT INTO metricas_agentes (agente_id, cpu_percent, ram_used, disk_used, uptime)
    VALUES (?,?,?,?,?)
  `).run(req.agentId, cpu_percent, ram_used, disk_used, uptime);

  const agent = db.prepare('SELECT ram_total, disk_total FROM agentes WHERE id=?').get(req.agentId);
  broadcast({
    type: 'metrics', agent_id: req.agentId,
    cpu_percent, ram_used, disk_used, uptime,
    ram_total: agent?.ram_total, disk_total: agent?.disk_total,
  });

  const pending = db.prepare(`
    SELECT id, tipo, parametro FROM comandos_agente
    WHERE agente_id = ? AND estado = 'pendiente'
    ORDER BY id ASC LIMIT 5
  `).all(req.agentId);

  if (pending.length) {
    const ids = pending.map(c => c.id);
    db.prepare(
      `UPDATE comandos_agente SET estado = 'ejecutando', updated_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')})`
    ).run(...ids);
  }

  res.json({ ok: true, commands: pending });
});

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

/* POST /api/monitoring/agents/:id/command — queue a command for an agent */
router.post('/api/monitoring/agents/:id/command', ...canCommand, (req, res) => {
  const { tipo, parametro } = req.body;
  const validTypes = ['reboot', 'shutdown', 'kill_process', 'clear_temp', 'processes', 'shell'];
  if (!validTypes.includes(tipo)) return res.status(400).json({ error: 'Tipo de comando inválido.' });
  if ((tipo === 'kill_process' || tipo === 'shell') && !parametro?.trim())
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

/* POST /api/monitoring/command/:id/output — agent streams output chunks */
router.post('/api/monitoring/command/:id/output', agentAuth, (req, res) => {
  const { chunk, done, exit_code } = req.body;
  const cmd = db.prepare('SELECT agente_id FROM comandos_agente WHERE id = ?').get(req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Comando no encontrado.' });
  if (cmd.agente_id !== req.agentId) return res.status(403).json({ error: 'Forbidden.' });

  if (chunk) {
    db.prepare(`UPDATE comandos_agente SET output = output || ?, updated_at = datetime('now') WHERE id = ?`)
      .run(chunk, req.params.id);
    broadcast({ type: 'command_output', cmd_id: parseInt(req.params.id), agent_id: req.agentId, chunk });
  }

  if (done) {
    const estado = (exit_code === 0) ? 'completado' : 'error';
    db.prepare(`UPDATE comandos_agente SET estado = ?, exit_code = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(estado, exit_code ?? 1, req.params.id);
    broadcast({ type: 'command_done', cmd_id: parseInt(req.params.id), agent_id: req.agentId, exit_code: exit_code ?? 1 });
  }

  res.json({ ok: true });
});

/* GET /api/monitoring/agents/:id/commands — last 50 commands for an agent */
router.get('/api/monitoring/agents/:id/commands', ...canCommand, (req, res) => {
  const commands = db.prepare(`
    SELECT * FROM comandos_agente
    WHERE agente_id = ?
    ORDER BY id DESC LIMIT 50
  `).all(req.params.id);
  res.json(commands);
});

export default router;
