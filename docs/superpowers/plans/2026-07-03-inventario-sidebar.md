# Inventario — Menú lateral colapsable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las 9 pestañas horizontales del inventario por un sidebar colapsable con drawer en móvil.

**Architecture:** Solo cambios frontend. `styles.css` recibe las clases CSS nuevas. `inventario.js` reemplaza el HTML de tabs por la estructura sidebar + panel, agrega 2 variables de estado y 2 funciones de toggle. `loadCounts()` no cambia — sigue usando `id="count-{tabid}"` que ahora viven en el sidebar.

**Tech Stack:** Vanilla JS ES6 modules, CSS custom properties (`var(--*)`), SVG icons de `public/js/utils/icons.js`.

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---|---|---|
| `public/css/styles.css` | Modificar | Agregar ~80 líneas de CSS al final: clases sidebar + media query móvil |
| `public/js/features/inventario/inventario.js` | Modificar | HTML template, 2 vars estado, 2 funciones toggle, event listeners |

Sin cambios: `inventario-forms.js`, `inventario-scanner.js`, `inventario-import.js`, backend.

---

## Task 1: CSS — clases del sidebar

**Files:**
- Modify: `public/css/styles.css` (agregar al final del archivo)

- [ ] **Step 1: Agregar CSS del layout y sidebar**

Abrir `public/css/styles.css` y agregar al final:

```css
/* ==========================================================================
   INVENTARIO SIDEBAR LAYOUT
   ========================================================================== */

.inv-layout {
  display: flex;
  gap: 0;
  min-height: 0;
  flex: 1;
}

/* ── Sidebar ── */
.inv-sidebar {
  width: 180px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width .2s ease;
}

.inv-sidebar.collapsed {
  width: 48px;
}

.inv-sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 10px;
  border-bottom: 1px solid var(--border);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.inv-sidebar.collapsed .inv-sidebar-toggle {
  justify-content: center;
}

.inv-sidebar-toggle-icon {
  width: 26px;
  height: 26px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  transition: transform .2s;
}

.inv-sidebar.collapsed .inv-sidebar-toggle-icon {
  transform: rotate(180deg);
}

.inv-sidebar-nav {
  padding: 8px 6px;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.inv-cat-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  color: var(--text-3);
  white-space: nowrap;
  width: 100%;
  text-align: left;
  transition: background .15s, color .15s;
}

.inv-cat-btn:hover {
  background: var(--surface-2);
  color: var(--text-2);
}

.inv-cat-btn.active {
  background: rgba(99, 102, 241, .15);
  color: #818cf8;
  font-weight: 600;
}

.inv-cat-icon {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inv-cat-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inv-cat-count {
  background: var(--surface-3);
  color: var(--text-3);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  flex-shrink: 0;
}

.inv-cat-btn.active .inv-cat-count {
  background: rgba(99, 102, 241, .3);
  color: #818cf8;
}

.inv-sidebar.collapsed .inv-cat-label,
.inv-sidebar.collapsed .inv-cat-count {
  display: none;
}

.inv-sidebar.collapsed .inv-cat-btn {
  justify-content: center;
  padding: 8px 0;
}

/* ── Content panel ── */
.inv-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ── Mobile drawer ── */
.inv-drawer-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .5);
  z-index: 800;
}

.inv-drawer-overlay.open {
  display: flex;
}

.inv-drawer {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.inv-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.inv-drawer-close {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}

.inv-drawer-nav {
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Hamburger (solo móvil) ── */
.inv-hamburger {
  display: none;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: var(--surface);
  border: 1px solid var(--border-2);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .inv-sidebar {
    display: none;
  }

  .inv-hamburger {
    display: flex;
  }
}
```

- [ ] **Step 2: Verificar que no hay conflicto con clases existentes**

Buscar en `styles.css` si ya existen: `.inv-layout`, `.inv-sidebar`, `.inv-cat-btn`. Si no aparecen, continuar.

- [ ] **Step 3: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add inv-sidebar layout CSS classes"
```

---

## Task 2: HTML — reemplazar tabs por sidebar en `renderInventario()`

**Files:**
- Modify: `public/js/features/inventario/inventario.js` líneas 29–87

El bloque actual tiene:
1. Variables de estado (líneas 29–33)
2. Header con título + botones (líneas 43–63)
3. Tabs horizontales (líneas 65–70)
4. Filter bar (líneas 72–82)
5. `inv-table-wrap` + `inv-pagination` + `inv-modal-wrap` (líneas 84–87)

El nuevo HTML fusiona tabs → sidebar, y mueve filter bar dentro de `inv-content`.

- [ ] **Step 1: Agregar variables de estado del sidebar junto a las variables existentes**

Localizar en `inventario.js` el bloque de variables (líneas 29–33):
```js
let _activeTabId     = 'computadores';
let _page            = 1;
const _limit         = 20;
let _search          = '';
let _filterArea      = '';
```

Reemplazar con:
```js
let _activeTabId      = 'computadores';
let _page             = 1;
const _limit          = 20;
let _search           = '';
let _filterArea       = '';
let _sidebarCollapsed = false;
let _drawerOpen       = false;
```

- [ ] **Step 2: Reemplazar el template HTML completo de `renderInventario()`**

Localizar en `inventario.js` la línea `container.innerHTML = \`` (línea 43) hasta el backtick de cierre (línea 87). Reemplazar todo ese bloque con:

```js
  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Inventario TI</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestión de equipos, celulares y dispositivos.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button id="btn-inv-hamburger" class="inv-hamburger">
          ${iconMenu(16)} Categorías
        </button>
        <button id="btn-inv-enlace"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ${iconQrCode(14)} Generar enlace
        </button>
        <button id="btn-inv-import"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ${iconUpload(14)} Importar Excel
        </button>
        <button id="btn-inv-new"
          style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
          ${iconPlus(14)} Registrar equipo
        </button>
      </div>
    </div>

    <div class="inv-layout">
      <div class="inv-sidebar${_sidebarCollapsed ? ' collapsed' : ''}" id="inv-sidebar">
        <button class="inv-sidebar-toggle" id="inv-sidebar-toggle" title="Colapsar menú">
          <span class="inv-sidebar-toggle-icon">${iconChevronLeft(14)}</span>
        </button>
        <nav class="inv-sidebar-nav">
          ${TABS.map(t => `
            <button class="inv-cat-btn${t.id === _activeTabId ? ' active' : ''}" data-tabid="${t.id}">
              <span class="inv-cat-icon">${t.icon(15)}</span>
              <span class="inv-cat-label">${t.label}</span>
              <span class="inv-cat-count" id="count-${t.id}">…</span>
            </button>`).join('')}
        </nav>
      </div>

      <div class="inv-content">
        <div class="inv-filter-bar">
          <div class="inv-search-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="inv-search" placeholder="Buscar placa, serial, nombre, área…" value="">
          </div>
          <div class="inv-filter-sep"></div>
          <input type="text" id="inv-area" class="inv-area-input" placeholder="Área">
          <button id="btn-inv-clear" class="inv-clear-btn" title="Limpiar filtros">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="inv-table-wrap" style="margin-top:0;"></div>
        <div id="inv-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px;"></div>
        <div id="inv-modal-wrap"></div>
      </div>
    </div>

    <!-- Mobile drawer -->
    <div class="inv-drawer-overlay" id="inv-drawer-overlay">
      <div class="inv-drawer">
        <div class="inv-drawer-header">
          <span>Categorías</span>
          <button class="inv-drawer-close" id="inv-drawer-close">${iconClose(16)}</button>
        </div>
        <nav class="inv-drawer-nav">
          ${TABS.map(t => `
            <button class="inv-cat-btn${t.id === _activeTabId ? ' active' : ''}" data-tabid="${t.id}" data-drawer="true">
              <span class="inv-cat-icon">${t.icon(15)}</span>
              <span class="inv-cat-label">${t.label}</span>
              <span class="inv-cat-count" id="drawer-count-${t.id}">…</span>
            </button>`).join('')}
        </nav>
      </div>
    </div>
  `;
```

- [ ] **Step 2: Agregar import de `iconMenu` y `iconClose` en la línea de imports de icons**

La línea actual (línea 11–12) es:
```js
import { iconPlus, iconUpload, iconMonitor, iconSmartphone, iconCheck, iconZap, iconQrCode,
         iconCpu, iconTv, iconTablet, iconScan, iconMouse, iconPrinter } from '../../utils/icons.js';
```

Reemplazar por:
```js
import { iconPlus, iconUpload, iconMonitor, iconSmartphone, iconCheck, iconZap, iconQrCode,
         iconCpu, iconTv, iconTablet, iconScan, iconMouse, iconPrinter,
         iconChevronLeft, iconClose, iconMenu } from '../../utils/icons.js';
```

- [ ] **Step 3: Verificar que `iconMenu` existe en `icons.js`**

Buscar en `public/js/utils/icons.js` la función `iconMenu`. Si no existe, agregarla al final del archivo:

```js
/** Hamburger menu (☰) */
export function iconMenu(size = 16) {
  return `${SVG_OPEN(size)}<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>${SVG_CLOSE}`;
}
```

- [ ] **Step 4: Commit**

```bash
git add public/js/features/inventario/inventario.js public/js/utils/icons.js
git commit -m "feat: replace horizontal tabs with sidebar nav in inventario"
```

---

## Task 3: Lógica de sidebar toggle (colapsar/expandir)

**Files:**
- Modify: `public/js/features/inventario/inventario.js`

- [ ] **Step 1: Agregar función `_toggleSidebar()`**

Justo después de la función `activeTab()` (línea ~35), agregar:

```js
function _toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sidebar = document.getElementById('inv-sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed', _sidebarCollapsed);
}
```

- [ ] **Step 3: Agregar event listener del botón toggle en `renderInventario()`**

Dentro de `renderInventario()`, después del bloque de event listeners existentes (después de `loadTable(); loadCounts();`), agregar:

```js
  document.getElementById('inv-sidebar-toggle').addEventListener('click', _toggleSidebar);
```

- [ ] **Step 4: Commit**

```bash
git add public/js/features/inventario/inventario.js
git commit -m "feat: add collapsible sidebar toggle to inventario"
```

---

## Task 4: Lógica del drawer móvil

**Files:**
- Modify: `public/js/features/inventario/inventario.js`

- [ ] **Step 1: Agregar función `_toggleDrawer(open)`**

Después de `_toggleSidebar()`:

```js
function _toggleDrawer(open) {
  _drawerOpen = open;
  const overlay = document.getElementById('inv-drawer-overlay');
  if (!overlay) return;
  overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
```

- [ ] **Step 3: Agregar event listeners del drawer en `renderInventario()`**

```js
  document.getElementById('btn-inv-hamburger').addEventListener('click', () => _toggleDrawer(true));
  document.getElementById('inv-drawer-close').addEventListener('click', () => _toggleDrawer(false));
  document.getElementById('inv-drawer-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) _toggleDrawer(false);
  });
```

- [ ] **Step 4: Commit**

```bash
git add public/js/features/inventario/inventario.js
git commit -m "feat: add mobile drawer for inventario category nav"
```

---

## Task 5: Event listeners de categorías (sidebar + drawer)

**Files:**
- Modify: `public/js/features/inventario/inventario.js`

El código actual (líneas 89–97) tiene:
```js
document.querySelectorAll('.tab-btn[data-tabid]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    _activeTabId = btn.dataset.tabid;
    _page = 1;
    loadTable();
  });
});
```

- [ ] **Step 1: Reemplazar ese bloque con el nuevo listener para `.inv-cat-btn`**

```js
  document.querySelectorAll('.inv-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTabId = btn.dataset.tabid;
      _page = 1;
      // Marcar activo en sidebar y drawer
      document.querySelectorAll('.inv-cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`.inv-cat-btn[data-tabid="${_activeTabId}"]`).forEach(b => b.classList.add('active'));
      if (btn.dataset.drawer) _toggleDrawer(false);
      loadTable();
    });
  });
```

- [ ] **Step 2: Actualizar `loadCounts()` para sincronizar también los contadores del drawer**

La función actual (línea ~351):
```js
async function loadCounts() {
  for (const t of TABS) {
    try {
      const params = `page=1&limit=1${t.categoria ? `&categoria=${t.categoria}` : ''}`;
      const r = await fetch(`/api/inventario/${t.apiTab}?${params}`);
      const d = await r.json();
      const el = document.getElementById(`count-${t.id}`);
      if (el) el.textContent = d.total ?? '';
    } catch {}
  }
}
```

Reemplazar con:
```js
async function loadCounts() {
  for (const t of TABS) {
    try {
      const params = `page=1&limit=1${t.categoria ? `&categoria=${t.categoria}` : ''}`;
      const r = await fetch(`/api/inventario/${t.apiTab}?${params}`);
      const d = await r.json();
      const total = d.total ?? '';
      const sidebar = document.getElementById(`count-${t.id}`);
      const drawer  = document.getElementById(`drawer-count-${t.id}`);
      if (sidebar) sidebar.textContent = total;
      if (drawer)  drawer.textContent  = total;
    } catch {}
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/js/features/inventario/inventario.js
git commit -m "feat: wire category click handlers for sidebar and drawer"
```

---

## Task 6: Verificación manual

- [ ] **Step 1: Iniciar la aplicación**

```bash
npm start
```

Navegar a la sección Inventario.

- [ ] **Step 2: Verificar desktop — sidebar expandido**

- 9 categorías visibles con ícono + label + contador
- Clic en cada categoría carga la tabla correcta
- Categoría activa resaltada en morado
- Búsqueda y filtro de área funcionan

- [ ] **Step 3: Verificar desktop — colapsar sidebar**

- Clic en botón toggle: sidebar se estrecha a 48px, solo íconos
- Tabla gana el ancho liberado
- Clic de nuevo: sidebar vuelve a 180px con labels

- [ ] **Step 4: Verificar móvil (DevTools < 768px)**

- Sidebar no visible
- Botón "Categorías" (hamburguesa) aparece en el topbar
- Clic abre drawer desde la izquierda con fondo semitransparente
- Seleccionar categoría cierra el drawer y carga la tabla
- Clic fuera del drawer lo cierra

- [ ] **Step 5: Verificar sin regresiones**

- Botón "Registrar equipo" abre formulario correcto según categoría activa
- "Importar Excel" funciona
- "Generar enlace" funciona
- Editar, duplicar, eliminar equipos desde la tabla funcionan

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: inventario sidebar nav complete"
```
