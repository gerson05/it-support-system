export const AREA_MAPPINGS = {
  'abastecimiento':   { label: 'Abastecimiento',     emoji: '' },
  'bodega':           { label: 'Bodega',              emoji: '' },
  'calidad':          { label: 'Calidad',             emoji: '' },
  'cartera':          { label: 'Cartera',             emoji: '' },
  'compra':           { label: 'Compras',             emoji: '' },
  'contabilidad':     { label: 'Contabilidad',        emoji: '' },
  'cuentas_medicas':  { label: 'Cuentas Médicas',     emoji: '' },
  'despachos':        { label: 'Despachos',           emoji: '' },
  'farmacia':         { label: 'Farmacia',            emoji: '' },
  'general':          { label: 'General / IT',        emoji: '' },
  'gerencia':         { label: 'Gerencia',            emoji: '' },
  'gestion_humana':   { label: 'Gestión Humana',      emoji: '' },
  'pqrs':             { label: 'PQRS',                emoji: '' },
  'recepcion_tecnica':{ label: 'Recepción Técnica',   emoji: '' },
  'ventas':           { label: 'Ventas',              emoji: '' },
};

export const PRIORITY_LABELS = {
  'baja':    'Baja',
  'media':   'Media',
  'alta':    'Alta',
  'critica': 'Crítica',
};

export const STATUS_LABELS = {
  'abierto':       'Abierto',
  'en_progreso':   'En progreso',
  'en_espera':     'En espera',
  'resuelto':      'Resuelto',
  'cerrado':       'Cerrado',
  'siguiente_dia': 'Siguiente día',
};

export function getAreaEmoji(_area) { return ''; }

export function getAreaName(area) {
  return AREA_MAPPINGS[area]?.label || area;
}

export function getPriorityBadge(priority) {
  const p     = priority?.toLowerCase() || 'media';
  const label = PRIORITY_LABELS[p] || p;
  return `<span class="badge badge-${p}">${label}</span>`;
}

export function getStatusBadge(status) {
  const s     = status?.toLowerCase() || 'abierto';
  const label = STATUS_LABELS[s] || s;
  return `<span class="badge badge-${s}">${label}</span>`;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d   = String(date.getDate()).padStart(2, '0');
  const m   = String(date.getMonth() + 1).padStart(2, '0');
  const y   = date.getFullYear();
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${h}:${min}`;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Hace un momento';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds / 31536000 > 1) return `Hace ${Math.floor(seconds / 31536000)} años`;
  if (seconds / 2592000  > 1) return `Hace ${Math.floor(seconds / 2592000)} meses`;
  if (seconds / 86400    > 1) return `Hace ${Math.floor(seconds / 86400)} días`;
  if (seconds / 3600     > 1) return `Hace ${Math.floor(seconds / 3600)} horas`;
  if (seconds / 60       > 1) return `Hace ${Math.floor(seconds / 60)} minutos`;
  return 'Hace un momento';
}
