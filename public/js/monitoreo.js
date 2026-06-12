import { state } from './app.js';
import { showToast } from './components.js';

let _sse  = null;
let _agents = {};

export function renderMonitoreo(container) {
  if (_sse) { _sse.close(); _sse = null; }

  container.innerHTML = `
    <div style="margin-bottom:20px;">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);">Monitoreo de Equipos</h1>
    </div>
    <div id="mon-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input id="mon-search" class="form-control" placeholder="Buscar equipo, sede, IP…" style="flex:1;">
      <select id="mon-filter" class="form-control" style="width:140px;">
        <option value="">Todos</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </select>
    </div>
    <div id="mon-table-wrap"></div>
  `;

  loadAgents();
  connectSSE();
  container.querySelector('#mon-search').addEventListener('input', renderTable);
  container.querySelector('#mon-filter').addEventListener('change', renderTable);
}

async function loadAgents() {
  try {
    const data = await fetch('/api/monitoring/agents').then(r => r.json());
    _agents = {};
    data.forEach(a => { _agents[a.id] = a; });
    renderKPIs();
    renderTable();
  } catch {
    showToast('Error cargando agentes', 'error');
  }
}

function renderKPIs() {
  const agents = Object.values(_agents);
  const online = agents.filter(a => a.estado === 'online');

  const avgCpu = online.length
    ? Math.round(online.reduce((s, a) => s + (a.cpu_percent || 0), 0) / online.length)
    : 0;
  const onlineRam = online.filter(a => a.ram_total > 0);
  const avgRam = onlineRam.length
    ? Math.round(onlineRam.reduce((s, a) => s + (a.ram_used || 0) / a.ram_total * 100, 0) / onlineRam.length)
    : 0;
  const onlineDisk = online.filter(a => a.disk_total > 0);
  const avgDisk = onlineDisk.length
    ? Math.round(onlineDisk.reduce((s, a) => s + (a.disk_used || 0) / a.disk_total * 100, 0) / onlineDisk.length)
    : 0;

  const el = document.getElementById('mon-kpis');
  if (!el) return;
  el.innerHTML = [
    { label: 'Online',      value: online.length,                  color: '#22c55e' },
    { label: 'Offline',     value: agents.length - online.length,  color: '#ef4444' },
    { label: 'CPU prom.',   value: `${avgCpu}%`,                   color: '#3b82f6' },
    { label: 'RAM prom.',   value: `${avgRam}%`,                   color: '#8b5cf6' },
    { label: 'Disco prom.', value: `${avgDisk}%`,                  color: '#f59e0b' },
  ].map(k => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:${k.color};">${k.value}</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${k.label}</div>
    </div>
  `).join('');
}

function renderTable() {
  const search = (document.getElementById('mon-search')?.value || '').toLowerCase();
  const filter = document.getElementById('mon-filter')?.value || '';
  const wrap   = document.getElementById('mon-table-wrap');
  if (!wrap) return;

  const agents = Object.values(_agents)
    .filter(a => {
      if (filter && a.estado !== filter) return false;
      if (search && !`${a.hostname||''} ${a.ip||''} ${a.sede||''} ${a.apodo||''}`.toLowerCase().includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === 'online' ? -1 : 1;
      return (a.hostname || '').localeCompare(b.hostname || '');
    });

  if (!agents.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-3);">No hay equipos${filter || search ? ' que coincidan' : ' registrados'}.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:28px 2fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:10px 14px;background:var(--surface-2);font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);">
        <span></span><span>Equipo</span><span>Sede</span>
        <span style="text-align:center;">Estado</span>
        <span style="text-align:center;">CPU</span>
        <span style="text-align:center;">RAM</span>
        <span style="text-align:center;">Disco</span>
        <span style="text-align:center;">Visto</span>
      </div>
      ${agents.map(buildRow).join('')}
    </div>
  `;

  wrap.querySelectorAll('.mon-row').forEach(row => {
    row.querySelector('.mon-row-main').addEventListener('click', () => toggleAccordion(row.dataset.id));
  });
}

function colorFor(pct, base) {
  return pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : base;
}

function miniBar(pct, base) {
  const c = colorFor(pct, base);
  return `<div style="background:var(--border);border-radius:2px;height:3px;margin-top:3px;"><div style="background:${c};width:${Math.min(pct,100)}%;height:100%;border-radius:2px;transition:width .4s;"></div></div>`;
}

function buildRow(a) {
  const online  = a.estado === 'online';
  const cpuPct  = Math.round(a.cpu_percent || 0);
  const ramPct  = a.ram_total  > 0 ? Math.round((a.ram_used  || 0) / a.ram_total  * 100) : 0;
  const diskPct = a.disk_total > 0 ? Math.round((a.disk_used || 0) / a.disk_total * 100) : 0;

  return `
  <div class="mon-row" data-id="${a.id}" style="border-top:1px solid var(--border);">
    <div class="mon-row-main" style="display:grid;grid-template-columns:28px 2fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:11px 14px;align-items:center;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
      <span class="mon-chev" style="color:var(--text-3);font-size:10px;user-select:none;">▶</span>
      <div>
        <div style="font-weight:600;font-family:monospace;font-size:13px;color:var(--text);">${a.hostname||'—'}</div>
        <div style="font-size:11px;color:var(--text-3);">${a.ip||'—'}${a.apodo?` · ${a.apodo}`:''}</div>
      </div>
      <span style="font-size:13px;color:var(--text-2);">${a.sede||'—'}</span>
      <div style="text-align:center;">
        <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:500;background:${online?'#22c55e22':'#ef444422'};color:${online?'#22c55e':'#ef4444'};">● ${online?'Online':'Offline'}</span>
      </div>
      ${online ? `
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(cpuPct,'#3b82f6')};">${cpuPct}%</div>${miniBar(cpuPct,'#3b82f6')}</div>
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(ramPct,'#8b5cf6')};">${a.ram_used||0}GB</div>${miniBar(ramPct,'#8b5cf6')}</div>
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(diskPct,'#22c55e')};">${diskPct}%</div>${miniBar(diskPct,'#22c55e')}</div>
      ` : `
        <span style="text-align:center;color:var(--text-3);">—</span>
        <span style="text-align:center;color:var(--text-3);">—</span>
        <span style="text-align:center;color:var(--text-3);">—</span>
      `}
      <span style="text-align:center;font-size:11px;color:var(--text-3);">${a.last_seen ? timeAgo(a.last_seen) : '—'}</span>
    </div>
    <div class="mon-acc" style="display:none;padding:12px 14px 14px;border-top:1px solid var(--border);background:var(--surface-2);">
      ${buildAccordion(a)}
    </div>
  </div>`;
}

function buildAccordion(a) {
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
    ${[
      ['Procesador',        a.cpu_model||'—',          `${a.cpu_cores||'?'} núcleos · ${a.cpu_ghz||'?'} GHz`],
      ['Memoria RAM',       `${a.ram_total||'?'} GB`,   ''],
      ['Almacenamiento',    `${a.disk_total||'?'} GB`,  a.disk_model||''],
      ['Sistema Operativo', a.os_name||'—',             a.os_version||''],
      ['Red / IP',          a.ip||'—',                  a.mac_address||''],
      ['Uptime',            a.uptime ? uptimeStr(a.uptime) : '—', ''],
    ].map(([label, val, sub]) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">${label}</div>
        <div style="font-weight:600;font-size:13px;color:var(--text);">${val}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text-3);">${sub}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function toggleAccordion(id) {
  const row  = document.querySelector(`.mon-row[data-id="${id}"]`);
  if (!row) return;
  const acc  = row.querySelector('.mon-acc');
  const chev = row.querySelector('.mon-chev');
  const open = acc.style.display === 'none';
  acc.style.display = open ? 'block' : 'none';
  chev.textContent  = open ? '▼' : '▶';
}

function connectSSE() {
  _sse = new EventSource('/api/monitoring/stream');
  _sse.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'metrics' && _agents[data.agent_id]) {
      Object.assign(_agents[data.agent_id], {
        cpu_percent: data.cpu_percent,
        ram_used:    data.ram_used,
        disk_used:   data.disk_used,
        uptime:      data.uptime,
        estado:      'online',
        last_seen:   new Date().toISOString(),
        ram_total:   data.ram_total  ?? _agents[data.agent_id].ram_total,
        disk_total:  data.disk_total ?? _agents[data.agent_id].disk_total,
      });
      renderKPIs();
      updateRow(data.agent_id);
    } else if (['offline_sweep','agent_registered','agent_updated'].includes(data.type)) {
      loadAgents();
    }
  };
  _sse.onerror = () => { _sse.close(); _sse = null; setTimeout(connectSSE, 5000); };
}

function updateRow(id) {
  const existing = document.querySelector(`.mon-row[data-id="${id}"]`);
  if (!existing) return;
  const wasOpen = existing.querySelector('.mon-acc').style.display !== 'none';
  const tmp = document.createElement('div');
  tmp.innerHTML = buildRow(_agents[id]);
  const newRow = tmp.firstElementChild;
  if (wasOpen) {
    newRow.querySelector('.mon-acc').style.display = 'block';
    newRow.querySelector('.mon-chev').textContent  = '▼';
  }
  newRow.querySelector('.mon-row-main').addEventListener('click', () => toggleAccordion(id));
  existing.replaceWith(newRow);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z').getTime();
  const s = Math.floor(Math.abs(diff) / 1000);
  if (s < 60)   return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}

function uptimeStr(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}
