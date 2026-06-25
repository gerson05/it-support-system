'use strict';

const si = require('systeminformation');
const { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } = require('fs');
const { spawn } = require('child_process');
const { join, dirname } = require('path');
const os = require('os');

// When packaged with pkg, process.pkg is defined. Use execPath dir for config.
const IS_PKG  = typeof process.pkg !== 'undefined';
const BASE_DIR = IS_PKG ? dirname(process.execPath) : __dirname;
const CONFIG_PATH = join(BASE_DIR, 'agent-config.json');
const INSTALL_DIR = 'C:\\agente-it';
const LOG_PATH    = INSTALL_DIR + '\\agent.log';

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    mkdirSync(INSTALL_DIR, { recursive: true });
    appendFileSync(LOG_PATH, line, 'utf8');
  } catch (_) {}
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`agent-config.json not found at ${CONFIG_PATH}`);
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8').replace(/^﻿/, ''));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

async function getHardwareInfo() {
  const [cpu, mem, disks, nets, osInfo, graphics, sysInfo] = await Promise.all([
    si.cpu(), si.mem(), si.fsSize(), si.networkInterfaces(), si.osInfo(), si.graphics(),
    si.system().catch(() => ({})),   // fallback vacío si BIOS no expone datos
  ]);

  const primaryDisk = disks.find(d => /^C:/i.test(d.fs) || d.mount === '/') || disks[0] || {};
  const netList     = Array.isArray(nets) ? nets : [];
  const primaryNet  = netList.find(n => !n.internal && n.ip4) || {};

  return {
    hostname:     os.hostname(),
    ip:           primaryNet.ip4 || '',
    mac_address:  primaryNet.mac || `${os.hostname()}-fallback`,
    os_name:      osInfo.distro || osInfo.platform || '',
    os_version:   osInfo.release || '',
    cpu_model:    cpu.brand || cpu.manufacturer || '',
    cpu_cores:    cpu.physicalCores || cpu.cores || 0,
    cpu_ghz:      parseFloat(cpu.speed) || 0,
    ram_total:    Math.round(mem.total / 1073741824),
    disk_model:   primaryDisk.type || primaryDisk.fs || '',
    disk_total:   primaryDisk.size ? Math.round(primaryDisk.size / 1073741824) : 0,
    gpu:          graphics.controllers?.[0]?.model || '',
    serial:       sysInfo.serial || '',
    manufacturer: sysInfo.manufacturer || '',
    model:        sysInfo.model || '',
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
  const ps = (script) => ['powershell', ['-NoProfile', '-NonInteractive', '-Command', script]];
  const commandMap = {
    // ── Control básico ────────────────────────────────────────────────────
    reboot:       ['shutdown', ['/r', '/t', '30']],
    shutdown:     ['shutdown', ['/s', '/t', '30']],
    kill_process: ['taskkill', ['/F', '/IM', cmd.parametro || '']],
    processes:    ps('Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name,Id,CPU,@{N="RAM_MB";E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String'),
    shell:        ps(cmd.parametro || 'Write-Output "sin comando"'),

    // ── Temporales y limpieza ─────────────────────────────────────────────
    clear_temp:   ps('Remove-Item "$env:TEMP\\*" -Recurse -Force -EA SilentlyContinue; Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -EA SilentlyContinue; Write-Output "Temporales eliminados."'),

    // ── Impresoras ────────────────────────────────────────────────────────
    restart_spooler:     ps('net stop spooler; net stop PrintFilterPipelineSvc; Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -EA SilentlyContinue; net start PrintFilterPipelineSvc; net start spooler; Write-Output "Cola de impresion reiniciada."'),
    list_printers:       ps('Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | Format-Table -AutoSize | Out-String'),
    set_default_printer: ps(`(New-Object -ComObject WScript.Network).SetDefaultPrinter('${cmd.parametro || ""}'); Write-Output "Impresora predeterminada configurada."`),

    // ── Red ───────────────────────────────────────────────────────────────
    flush_dns:       ps('ipconfig /flushdns; Write-Output "Cache DNS limpiada."'),
    renew_ip:        ps('ipconfig /release; Start-Sleep 2; ipconfig /renew; ipconfig | Out-String'),
    net_info:        ps('ipconfig /all | Out-String'),
    net_diag:        ps('$gw=(Get-NetRoute -DestinationPrefix "0.0.0.0/0" -EA SilentlyContinue).NextHop | Select-Object -First 1; Write-Output "Gateway: $gw"; ping $gw -n 3; ping 8.8.8.8 -n 3; Resolve-DnsName google.com -EA SilentlyContinue | Select-Object -First 1 | Out-String'),
    restart_adapter: ps('$a=Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1; Disable-NetAdapter -Name $a.Name -Confirm:$false; Start-Sleep 3; Enable-NetAdapter -Name $a.Name -Confirm:$false; Write-Output "Adaptador $($a.Name) reiniciado."'),
    fix_smb:         ps('Set-SmbClientConfiguration -RequireSecuritySignature $false -Force; Write-Output "Firma SMB desactivada."'),

    // ── Diagnóstico ───────────────────────────────────────────────────────
    full_diag:        ps('$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $os=Get-CimInstance Win32_OperatingSystem; $cpu=Get-CimInstance Win32_Processor|Select-Object -First 1; $disk=Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|Where-Object{$_.DeviceID -eq "C:"}; $ip=(Get-NetIPAddress -AddressFamily IPv4|Where-Object{$_.IPAddress -notmatch "^127\\."}|Select-Object -First 1).IPAddress; Write-Output "=== DIAGNOSTICO ==="; Write-Output "Equipo: $env:COMPUTERNAME | Usuario: $u | IP: $ip"; Write-Output "OS: $($os.Caption) $($os.Version)"; Write-Output "RAM: Total $([math]::Round($os.TotalVisibleMemorySize/1MB,1))GB / Libre $([math]::Round($os.FreePhysicalMemory/1MB,1))GB"; Write-Output "CPU: $($cpu.Name)"; Write-Output "Disco C: $([math]::Round($disk.Size/1GB,1))GB total / $([math]::Round($disk.FreeSpace/1GB,1))GB libre"; Write-Output "Uptime: $((Get-Date)-$os.LastBootUpTime)"'),
    list_software:    ps('Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" | Where-Object{$_.DisplayName} | Select-Object DisplayName,DisplayVersion | Sort-Object DisplayName | Format-Table -AutoSize | Out-String -Width 200'),
    list_services:    ps('Get-Service | Where-Object{$_.Status -eq "Stopped" -and $_.StartType -eq "Automatic"} | Select-Object Name,DisplayName,Status | Format-Table -AutoSize | Out-String'),
    get_events:       ps('Get-EventLog -LogName System -EntryType Error,Warning -Newest 15 -EA SilentlyContinue | Select-Object TimeGenerated,Source,Message | Format-Table -Wrap | Out-String -Width 250'),
    startup_items:    ps('Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | Format-Table -AutoSize | Out-String'),
    antivirus_status: ps('Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct -EA SilentlyContinue | Select-Object displayName,productState | Format-Table | Out-String'),

    // ── Windows ───────────────────────────────────────────────────────────
    run_sfc:        ps('sfc /scannow'),
    run_dism:       ps('DISM /Online /Cleanup-Image /RestoreHealth'),
    enable_admin:   ps('net user Administrador M3d1v4ll3 /active:yes; if($LASTEXITCODE -ne 0){net user Administrator M3d1v4ll3 /active:yes}; Write-Output "Cuenta Administrador activada."'),
    windows_update: ps('$wu=New-Object -ComObject Microsoft.Update.Session; $s=$wu.CreateUpdateSearcher(); $r=$s.Search("IsInstalled=0"); Write-Output "Actualizaciones pendientes: $($r.Updates.Count)"; $r.Updates|Select-Object -First 10 Title|Format-Table|Out-String'),
  };

  const [prog, args] = commandMap[cmd.tipo] || ps(`Write-Output "tipo desconocido: ${cmd.tipo}"`);

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

function selfInstallTask() {
  if (!IS_PKG) return Promise.resolve();

  const localExe = INSTALL_DIR + '\\agente-it.exe';
  const localCfg = INSTALL_DIR + '\\agent-config.json';
  const srcExe   = process.execPath;
  const srcCfg   = join(BASE_DIR, 'agent-config.json');

  // Escape single-quotes for PowerShell strings
  const esc = s => s.replace(/'/g, "''");

  const ps = [
    `$n='Agente IT'`,
    `New-Item -ItemType Directory -Force '${esc(INSTALL_DIR)}' | Out-Null`,
    // Copy exe only if source != destination (avoids locked-file self-copy)
    `if('${esc(srcExe)}' -ne '${esc(localExe)}' -and -not(Test-Path '${esc(localExe)}')){Copy-Item '${esc(srcExe)}' '${esc(localExe)}'}`,
    // Copy config only if source != destination
    `if('${esc(srcCfg)}' -ne '${esc(localCfg)}' -and -not(Test-Path '${esc(localCfg)}')){Copy-Item '${esc(srcCfg)}' '${esc(localCfg)}'}`,
    // Firewall rules (best-effort, ignore errors individually)
    `try{if(-not(Get-NetFirewallRule -DisplayName 'Agente IT' -EA SilentlyContinue)){New-NetFirewallRule -DisplayName 'Agente IT' -Direction Outbound -Program '${esc(localExe)}' -Action Allow -Profile Any | Out-Null}}catch{}`,
    `try{if(-not(Get-NetFirewallRule -DisplayName 'Agente IT (In)' -EA SilentlyContinue)){New-NetFirewallRule -DisplayName 'Agente IT (In)' -Direction Inbound -Program '${esc(localExe)}' -Action Allow -Profile Any | Out-Null}}catch{}`,
    // Scheduled task
    `if(Get-ScheduledTask -TaskName $n -EA SilentlyContinue){Write-Output 'TASK_EXISTS'; exit 0}`,
    `$a=New-ScheduledTaskAction -Execute '${esc(localExe)}' -WorkingDirectory '${esc(INSTALL_DIR)}'`,
    `$t=New-ScheduledTaskTrigger -AtStartup`,
    `$s=New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)`,
    `$p=New-ScheduledTaskPrincipal -UserId SYSTEM -RunLevel Highest`,
    `Register-ScheduledTask -TaskName $n -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null`,
    `Write-Output 'TASK_CREATED'`,
  ].join('; ');

  return new Promise((resolve) => {
    const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      shell: false,
      windowsHide: true,
    });

    let out = '';
    let err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });

    proc.on('error', e => {
      logLine(`[Agent] No se pudo lanzar PowerShell para instalacion: ${e.message}`);
      resolve();
    });

    proc.on('close', code => {
      if (code === 0) {
        if (out.includes('TASK_EXISTS')) {
          logLine('[Agent] Tarea programada ya existia — sin cambios.');
        } else {
          logLine('[Agent] Instalado en C:\\agente-it — iniciara automaticamente con Windows.');
        }
      } else {
        logLine(`[Agent] Error al instalar tarea (exit ${code}). Ejecutar como Administrador.`);
        if (err.trim()) logLine(`[Agent] PS stderr: ${err.trim()}`);
        if (out.trim()) logLine(`[Agent] PS stdout: ${out.trim()}`);
      }
      resolve();
    });
  });
}

async function main() {
  await selfInstallTask();

  let cfg = loadConfig();
  const serverUrl = cfg.server_url || 'http://localhost:3000';
  const interval  = cfg.interval_ms || 10000;

  // Registrar si: no tiene agent_id, o no tiene serial guardado (vincula inventario para agentes existentes)
  if (!cfg.agent_id || !cfg.serial) {
    logLine('[Agent] Recopilando informacion de hardware...');
    const hw = await getHardwareInfo();
    hw.sede = cfg.sede || '';   // sede configurada por el admin antes del despliegue
    let delay = 5000;
    while (true) {
      try {
        logLine(`[Agent] Registrando con ${serverUrl}...`);
        const result = await register(serverUrl, hw);
        cfg = { ...cfg, agent_id: result.id, api_key: result.api_key, serial: hw.serial || '' };
        saveConfig(cfg);
        logLine(`[Agent] Registrado como agente #${cfg.agent_id}`);
        break;
      } catch (e) {
        logLine(`[Agent] Registro fallido: ${e.message} — reintentando en ${delay / 1000}s`);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 60000);
      }
    }
  }

  const { agent_id: agentId, api_key: apiKey } = cfg;
  let retryDelay = interval;

  async function tick() {
    try {
      const data = await sendHeartbeat(serverUrl, agentId, apiKey);
      retryDelay = interval;
      for (const cmd of data.commands || []) {
        executeCommand(serverUrl, agentId, apiKey, cmd).catch(e =>
          logLine(`[Agent] Comando ${cmd.id} (${cmd.tipo}) falló: ${e.message}`)
        );
      }
    } catch (e) {
      logLine(`[Agent] ${e.message} — retry in ${retryDelay / 1000}s`);
      retryDelay = Math.min(retryDelay * 2, 120000);
    }
    setTimeout(tick, retryDelay);
  }

  tick();
  logLine(`[Agent] Running — heartbeat every ${interval / 1000}s to ${serverUrl}`);
}

main().catch(e => {
  logLine(`[Agent] Fatal: ${e.message}`);
  process.exit(1);
});
