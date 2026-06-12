'use strict';

const si = require('systeminformation');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { spawn } = require('child_process');
const { join, dirname } = require('path');
const os = require('os');

// When packaged with pkg, process.pkg is defined. Use execPath dir for config.
const IS_PKG  = typeof process.pkg !== 'undefined';
const BASE_DIR = IS_PKG ? dirname(process.execPath) : __dirname;
const CONFIG_PATH = join(BASE_DIR, 'agent-config.json');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`agent-config.json not found at ${CONFIG_PATH}`);
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

async function getHardwareInfo() {
  const [cpu, mem, disks, nets, osInfo, graphics] = await Promise.all([
    si.cpu(), si.mem(), si.fsSize(), si.networkInterfaces(), si.osInfo(), si.graphics(),
  ]);

  const primaryDisk = disks.find(d => /^C:/i.test(d.fs) || d.mount === '/') || disks[0] || {};
  const netList     = Array.isArray(nets) ? nets : [];
  const primaryNet  = netList.find(n => !n.internal && n.ip4) || {};

  return {
    hostname:    os.hostname(),
    ip:          primaryNet.ip4 || '',
    mac_address: primaryNet.mac || `${os.hostname()}-fallback`,
    os_name:     osInfo.distro || osInfo.platform || '',
    os_version:  osInfo.release || '',
    cpu_model:   cpu.brand || cpu.manufacturer || '',
    cpu_cores:   cpu.physicalCores || cpu.cores || 0,
    cpu_ghz:     parseFloat(cpu.speed) || 0,
    ram_total:   Math.round(mem.total / 1073741824),
    disk_model:  primaryDisk.type || primaryDisk.fs || '',
    disk_total:  primaryDisk.size ? Math.round(primaryDisk.size / 1073741824) : 0,
    gpu:         graphics.controllers?.[0]?.model || '',
  };
}

async function getMetrics() {
  const [load, mem, disks] = await Promise.all([
    si.currentLoad(), si.mem(), si.fsSize(),
  ]);
  const primaryDisk = disks.find(d => /^C:/i.test(d.fs) || d.mount === '/') || disks[0] || {};
  return {
    cpu_percent: Math.round(load.currentLoad * 10) / 10,
    ram_used:    Math.round(mem.used / 1073741824 * 10) / 10,
    disk_used:   primaryDisk.used ? Math.round(primaryDisk.used / 1073741824) : 0,
    uptime:      Math.floor(os.uptime()),
  };
}

async function register(serverUrl, hw) {
  const res = await fetch(`${serverUrl}/api/monitoring/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hw),
  });
  if (!res.ok) throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function sendHeartbeat(serverUrl, agentId, apiKey) {
  const metrics = await getMetrics();
  const res = await fetch(`${serverUrl}/api/monitoring/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-id':   String(agentId),
      'x-api-key':    apiKey,
    },
    body: JSON.stringify(metrics),
  });
  if (!res.ok) throw new Error(`Heartbeat failed: ${res.status}`);
  return res.json();
}

async function executeCommand(serverUrl, agentId, apiKey, cmd) {
  const commandMap = {
    reboot:       ['shutdown', ['/r', '/t', '30']],
    shutdown:     ['shutdown', ['/s', '/t', '30']],
    kill_process: ['taskkill', ['/F', '/IM', cmd.parametro || '']],
    clear_temp:   ['powershell', ['-NoProfile', '-Command',
      'Remove-Item "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue;' +
      'Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue;' +
      'Write-Output "Temporales eliminados."']],
    processes:    ['tasklist', ['/FO', 'TABLE']],
    shell:        ['powershell', ['-NoProfile', '-Command', cmd.parametro || 'Write-Output "sin comando"']],
  };

  const [prog, args] = commandMap[cmd.tipo] || ['powershell', ['-NoProfile', '-Command', `Write-Output "tipo desconocido: ${cmd.tipo}"`]];

  async function postChunk(chunk, done, exit_code) {
    try {
      await fetch(`${serverUrl}/api/monitoring/command/${cmd.id}/output`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-id':   String(agentId),
          'x-api-key':    apiKey,
        },
        body: JSON.stringify({ chunk, done, exit_code }),
      });
    } catch (e) {
      console.error(`[Agent] chunk POST failed for cmd ${cmd.id}: ${e.message}`);
    }
  }

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(prog, args, { shell: false, windowsHide: true });
    } catch (e) {
      postChunk(`[Error al lanzar proceso: ${e.message}]\n`, true, 1).then(resolve);
      return;
    }

    proc.stdout.on('data', (data) => postChunk(data.toString(), false, undefined));
    proc.stderr.on('data', (data) => postChunk(data.toString(), false, undefined));

    let finished = false;

    proc.on('error', async (err) => {
      if (finished) return;
      finished = true;
      await postChunk(`[Error: ${err.message}]\n`, true, 1);
      resolve();
    });

    proc.on('close', async (code) => {
      if (finished) return;
      finished = true;
      await postChunk('', true, code ?? 0);
      resolve();
    });
  });
}

async function main() {
  let cfg = loadConfig();
  const serverUrl = cfg.server_url || 'http://localhost:3000';
  const interval  = cfg.interval_ms || 10000;

  if (!cfg.agent_id) {
    console.log('[Agent] Collecting hardware info...');
    const hw = await getHardwareInfo();
    console.log(`[Agent] Registering with ${serverUrl}...`);
    const result = await register(serverUrl, hw);
    cfg = { ...cfg, agent_id: result.id, api_key: result.api_key };
    saveConfig(cfg);
    console.log(`[Agent] Registered as agent #${cfg.agent_id}`);
  }

  const { agent_id: agentId, api_key: apiKey } = cfg;
  let retryDelay = interval;

  async function tick() {
    try {
      const data = await sendHeartbeat(serverUrl, agentId, apiKey);
      retryDelay = interval;
      for (const cmd of data.commands || []) {
        executeCommand(serverUrl, agentId, apiKey, cmd).catch(e =>
          console.error(`[Agent] Comando ${cmd.id} (${cmd.tipo}) falló: ${e.message}`)
        );
      }
    } catch (e) {
      console.error(`[Agent] ${e.message} — retry in ${retryDelay / 1000}s`);
      retryDelay = Math.min(retryDelay * 2, 120000);
    }
    setTimeout(tick, retryDelay);
  }

  tick();
  console.log(`[Agent] Running — heartbeat every ${interval / 1000}s to ${serverUrl}`);
}

main().catch(e => {
  console.error('[Agent] Fatal:', e.message);
  process.exit(1);
});
