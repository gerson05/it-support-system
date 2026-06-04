import { showToast } from './components.js';

const toTitleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

let _activeTab  = 'equipos';
let _page       = 1;
const _limit    = 20;
let _search     = '';
let _filterArea = '';

export function renderInventario(container) {
  container.innerHTML = '<div style="padding:32px;"><h2>Inventario — cargando…</h2></div>';
}
