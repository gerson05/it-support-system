# Inventario — Menú lateral colapsable

**Fecha:** 2026-07-03  
**Módulo:** `public/js/features/inventario/inventario.js`  
**Estado:** Aprobado

---

## Resumen

Reemplazar las 9 pestañas horizontales del módulo de Inventario por un menú lateral (sidebar) colapsable que lista las categorías de equipo. Al seleccionar una categoría se carga su tabla de equipos en el panel derecho.

---

## Comportamiento

### Desktop

- Sidebar fijo a la izquierda, ancho **180px** en estado expandido.
- Cada ítem muestra: ícono SVG (`icons.js`) + label + contador de registros.
- Categoría activa resaltada con fondo `rgba(99,102,241,.15)` y texto `#818cf8`.
- Botón de colapso en la parte superior del sidebar (ícono chevron).
- **Estado colapsado:** ancho **48px**, solo íconos visibles, labels y contadores ocultos. La tabla gana el ancho liberado.
- El estado colapsado/expandido persiste durante la sesión (variable local en el módulo).

### Móvil (< 768px)

- Sidebar oculto por defecto.
- Botón hamburguesa en el topbar abre un **drawer overlay** desde la izquierda.
- Fondo semitransparente (`rgba(0,0,0,.5)`) cubre el contenido al abrir.
- Clic fuera del drawer lo cierra.
- Drawer muestra la lista completa de categorías con el mismo estilo que desktop.

### Búsqueda y filtros

- Barra de búsqueda + filtro de área permanece **arriba de la tabla**, dentro del panel de contenido — sin cambios respecto al diseño actual.

---

## Categorías (9 ítems, orden actual)

| id | Label | ícono (`icons.js`) | apiTab | categoria |
|---|---|---|---|---|
| computadores | Computadores | `iconCpu` | equipos | computadores |
| impresoras | Impresoras | `iconPrinter` | equipos | impresoras |
| escaner | Escáneres | `iconScan` | equipos | escaner |
| televisores | Televisores | `iconTv` | equipos | televisores |
| monitores | Monitores | `iconMonitor` | equipos | monitores |
| tablets | Tablets | `iconTablet` | equipos | tablets |
| perifericos | Periféricos | `iconMouse` | equipos | perifericos |
| celulares | Celulares | `iconSmartphone` | celulares | — |
| ups | UPS | `iconZap` | ups | — |

---

## Estructura HTML resultante

```
<div class="inv-layout">                     ← nuevo contenedor flex
  <div class="inv-sidebar [collapsed]">      ← sidebar (180px / 48px)
    <button class="inv-sidebar-toggle">…</button>
    <nav class="inv-sidebar-nav">
      <button class="inv-cat-btn [active]" data-tabid="…">
        {icon} <span class="inv-cat-label">…</span>
        <span class="inv-cat-count">…</span>
      </button>
    </nav>
  </div>

  <div class="inv-content">                  ← panel derecho, flex:1
    <div class="inv-filter-bar">…</div>      ← sin cambios
    <div id="inv-table-wrap">…</div>         ← sin cambios
    <div id="inv-pagination">…</div>         ← sin cambios
  </div>
</div>

<!-- Móvil: overlay drawer -->
<div class="inv-drawer-overlay [open]">
  <div class="inv-drawer">…</div>
</div>
```

---

## Cambios de código

### `inventario.js`

- Reemplazar el bloque de tabs `<div style="display:flex;gap:0;border-bottom:…">` por la estructura `inv-layout` con sidebar y panel.
- Agregar variable `_sidebarCollapsed = false`.
- Agregar variable `_drawerOpen = false` para móvil.
- Función `_toggleSidebar()`: toggle clase `collapsed` en `.inv-sidebar`, actualizar ícono del botón.
- Función `_toggleDrawer(open)`: toggle clase `open` en `.inv-drawer-overlay`, bloquear/liberar scroll del body en móvil.
- Event listeners del toggle y del overlay (clic fuera del drawer).
- Reemplazar event listeners de `.tab-btn` por `.inv-cat-btn`.

### CSS (inline o en `<style>` existente del módulo)

Clases nuevas: `.inv-layout`, `.inv-sidebar`, `.inv-sidebar.collapsed`, `.inv-sidebar-toggle`, `.inv-sidebar-nav`, `.inv-cat-btn`, `.inv-cat-btn.active`, `.inv-cat-label`, `.inv-cat-count`, `.inv-content`, `.inv-drawer-overlay`, `.inv-drawer-overlay.open`, `.inv-drawer`.

Media query `@media (max-width: 768px)`: ocultar sidebar, mostrar hamburguesa en topbar.

### Sin cambios

- `inventario-forms.js` — sin tocar.
- `inventario-scanner.js` — sin tocar.
- `inventario-import.js` — sin tocar.
- Rutas backend — sin tocar.
- Lógica de carga de tabla, paginación, búsqueda — sin tocar.

---

## Criterios de éxito

- Seleccionar categoría en sidebar carga la tabla correcta.
- Sidebar colapsa/expande con animación CSS (`transition: width .2s`).
- En móvil, drawer abre/cierra correctamente y clic fuera lo cierra.
- Contadores de registros se actualizan al cargar cada categoría.
- Búsqueda y filtro de área funcionan igual que antes.
- No hay regresiones en formularios, importación ni escáner.
