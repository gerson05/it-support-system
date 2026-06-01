# Borrador de Despacho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar el borrador del formulario de creación de despachos en la base de datos por agente, con restauración al reabrir el modal y limpieza automática al crear exitosamente.

**Architecture:** Nueva tabla `despacho_borradores` (un registro por agente, UPSERT). Tres endpoints REST (GET/PUT/DELETE `/api/despachos/borrador`). El modal de creación consulta el borrador al abrirse, muestra un banner de restauración si existe, y agrega un botón "Guardar borrador" al footer. Al crear el despacho exitosamente, el borrador se elimina en background.

**Tech Stack:** Node.js ESM, `node:sqlite` (DatabaseSync), Express Router, vanilla JS

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---------|--------|-----------|
| `src/config/database.js` | Modificar | Agregar migración de `despacho_borradores` al array `migrations` |
| `src/despacho/despacho-routes.js` | Modificar | Agregar 3 endpoints ANTES de la ruta `/:id` |
| `public/js/despacho.js` | Modificar | `openCreateModal`: banner, botón guardar, restaurar, descartar, limpiar al submit |

---

## Task 1: Migración — tabla despacho_borradores

**Files:**
- Modify: `src/config/database.js` (líneas 26-57, array `migrations`)

- [ ] **Step 1: Agregar la migración al array**

Abrir `src/config/database.js`. Dentro del array `migrations`, agregar este bloque después de la entrada de `despachos` (al final del array, antes del cierre `]`):

```js
  `CREATE TABLE IF NOT EXISTS despacho_borradores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agente        TEXT NOT NULL UNIQUE,
    destinatario  TEXT DEFAULT '',
    sede          TEXT DEFAULT '',
    area          TEXT DEFAULT '',
    articulos     TEXT DEFAULT '[]',
    observaciones TEXT DEFAULT '',
    requiere_acta INTEGER DEFAULT 0,
    ticket_id     INTEGER DEFAULT NULL,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
  )`,
```

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
node --check server.js
```

Esperado: sin output (sin errores de sintaxis).

```bash
node server.js &
sleep 2
curl -s http://localhost:3000/api/despachos | head -c 100
kill %1
```

Esperado: respuesta JSON válida (la API de despachos sigue funcionando).

- [ ] **Step 3: Commit**

```bash
git add src/config/database.js
git commit -m "feat: migración tabla despacho_borradores"
```

---

## Task 2: API — GET, PUT, DELETE /api/despachos/borrador

**Files:**
- Modify: `src/despacho/despacho-routes.js`

**IMPORTANTE:** Estas rutas deben ir ANTES de `router.get('/api/despachos/:id', ...)` para que Express no interprete "borrador" como un ID numérico.

- [ ] **Step 1: Agregar los 3 endpoints**

Abrir `src/despacho/despacho-routes.js`. Después de la ruta `GET /api/despachos` (que termina en `res.json({ despachos: rows, total });`) y ANTES de `router.get('/api/despachos/:id', ...)`, insertar:

```js
// GET /api/despachos/borrador?agente=X
router.get('/api/despachos/borrador', (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    const row = db.prepare('SELECT * FROM despacho_borradores WHERE agente = ?').get(agente);
    if (!row) return res.json({ borrador: null });
    res.json({
      borrador: {
        ...row,
        articulos: JSON.parse(row.articulos || '[]'),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/despachos/borrador — crea o sobreescribe el borrador del agente
router.put('/api/despachos/borrador', (req, res) => {
  try {
    const { agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id } = req.body;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    db.prepare(`
      INSERT INTO despacho_borradores (agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(agente) DO UPDATE SET
        destinatario  = excluded.destinatario,
        sede          = excluded.sede,
        area          = excluded.area,
        articulos     = excluded.articulos,
        observaciones = excluded.observaciones,
        requiere_acta = excluded.requiere_acta,
        ticket_id     = excluded.ticket_id,
        updated_at    = excluded.updated_at
    `).run(
      agente,
      destinatario  || '',
      sede          || '',
      area          || '',
      JSON.stringify(articulos || []),
      observaciones || '',
      requiere_acta ? 1 : 0,
      ticket_id     || null,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/despachos/borrador?agente=X
router.delete('/api/despachos/borrador', (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    db.prepare('DELETE FROM despacho_borradores WHERE agente = ?').run(agente);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Probar los tres endpoints**

Iniciar el servidor y ejecutar las pruebas:

```bash
node server.js &
sleep 2
```

**PUT — guardar borrador:**
```bash
curl -s -X PUT http://localhost:3000/api/despachos/borrador \
  -H "Content-Type: application/json" \
  -d '{"agente":"Juan IT","destinatario":"Carlos Pérez","sede":"Sede Norte","area":"farmacia","articulos":[{"nombre":"Mouse","cantidad":2,"descripcion":"inalámbrico"}],"observaciones":"Urgente","requiere_acta":0,"ticket_id":null}'
```
Esperado: `{"ok":true}`

**GET — obtener borrador:**
```bash
curl -s "http://localhost:3000/api/despachos/borrador?agente=Juan%20IT"
```
Esperado: JSON con `borrador.destinatario = "Carlos Pérez"` y `borrador.articulos` como array.

**DELETE — eliminar:**
```bash
curl -s -X DELETE "http://localhost:3000/api/despachos/borrador?agente=Juan%20IT"
```
Esperado: `{"ok":true}`

**GET tras DELETE:**
```bash
curl -s "http://localhost:3000/api/despachos/borrador?agente=Juan%20IT"
```
Esperado: `{"borrador":null}`

```bash
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add src/despacho/despacho-routes.js
git commit -m "feat: API GET PUT DELETE /api/despachos/borrador"
```

---

## Task 3: Frontend — banner, botón guardar borrador, restaurar, limpiar

**Files:**
- Modify: `public/js/despacho.js`

Este task modifica `openCreateModal`. Lee el archivo completo antes de editar para ubicar exactamente las líneas a cambiar.

### Paso 1: Agregar helper `_timeAgo` al módulo (fuera de `openCreateModal`)

- [ ] **Step 1: Agregar helper al inicio del archivo (después de los imports)**

Abrir `public/js/despacho.js`. Después de la línea `import { showToast, createLoadingSpinner, createEmptyState } from './components.js';` agregar:

```js
function _timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const old = h >= 8;
  const label = h > 0 ? `hace ${h}h ${m}m` : `hace ${m}m`;
  return { label, old };
}
```

### Paso 2: Agregar banner HTML en el template del modal

- [ ] **Step 2: Insertar el banner al inicio del `<form>`**

En `openCreateModal`, el `overlay.innerHTML` contiene `<form id="form-despacho" autocomplete="off">`. Justo después de esa línea de apertura del form, antes del primer `<!-- Destinatario / Sede -->`, insertar el banner (inicialmente oculto):

```html
        <!-- Banner borrador -->
        <div id="borrador-banner" style="display:none;margin-bottom:16px;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <span id="borrador-banner-text" style="font-size:13px;color:var(--text-2);"></span>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button type="button" id="btn-restaurar-borrador" style="padding:5px 12px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-light);color:var(--primary);font-size:12px;font-weight:500;cursor:pointer;">Restaurar</button>
            <button type="button" id="btn-descartar-borrador" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-3);font-size:12px;cursor:pointer;">Descartar</button>
          </div>
        </div>
```

### Paso 3: Agregar botón "Guardar borrador" al footer

- [ ] **Step 3: Modificar el footer del form**

En el mismo template, el footer del form actualmente es:
```html
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-create" class="btn btn-secondary">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-despacho">Crear Despacho</button>
        </div>
```

Reemplazarlo con:
```html
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-create" class="btn btn-secondary">Cancelar</button>
          <button type="button" id="btn-guardar-borrador" class="btn btn-secondary">💾 Guardar borrador</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-despacho">Crear Despacho</button>
        </div>
```

### Paso 4: Agregar helpers de restauración y serialización

- [ ] **Step 4: Agregar funciones auxiliares dentro de `openCreateModal`, después de la declaración `let rowCount = 1;`**

```js
  // ── Borrador helpers ─────────────────────────────────────────────
  function serializarFormulario() {
    const rows = overlay.querySelectorAll('.articulo-row');
    const articulos = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      const cantidad = parseInt(row.querySelector('[data-field="cantidad"]').value) || 1;
      const descripcion = row.querySelector('[data-field="descripcion"]').value.trim();
      if (nombre) articulos.push({ nombre, cantidad, descripcion });
    }
    const fd = new FormData(overlay.querySelector('#form-despacho'));
    return {
      agente:        state.currentAgent.name,
      destinatario:  fd.get('destinatario')  || '',
      sede:          fd.get('sede')           || '',
      area:          fd.get('area')           || '',
      articulos,
      observaciones: fd.get('observaciones') || '',
      requiere_acta: overlay.querySelector('#check-requiere-acta').checked ? 1 : 0,
      ticket_id:     fd.get('ticket_id') ? parseInt(fd.get('ticket_id')) : null,
    };
  }

  function restaurarArticulos(articulos) {
    const list = overlay.querySelector('#articulos-list');
    list.innerHTML = '';
    rowCount = 0;
    const items = articulos.length ? articulos : [{ nombre: '', cantidad: 1, descripcion: '' }];
    items.forEach((art, idx) => {
      const div = document.createElement('div');
      div.innerHTML = buildArticuloRow(rowCount++, idx === 0);
      const row = div.firstElementChild;
      list.appendChild(row);
      row.querySelector('[data-field="nombre"]').value     = art.nombre     || '';
      row.querySelector('[data-field="cantidad"]').value   = art.cantidad   || 1;
      row.querySelector('[data-field="descripcion"]').value = art.descripcion || '';
      if (idx > 0) {
        row.querySelector('.btn-remove-row').addEventListener('click', function () {
          this.closest('.articulo-row').remove();
        });
      }
    });
  }
```

### Paso 5: Lógica principal del borrador (consulta al abrir, restaurar, descartar, guardar)

- [ ] **Step 5: Agregar el bloque de lógica del borrador al final de `openCreateModal`, después del bloque de ticket search y ANTES del `// Form submit`**

```js
  // ── Lógica del borrador ──────────────────────────────────────────
  const banner    = overlay.querySelector('#borrador-banner');
  const bannerTxt = overlay.querySelector('#borrador-banner-text');

  async function guardarBorrador() {
    try {
      await fetch('/api/despachos/borrador', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(serializarFormulario()),
      });
      showToast('Borrador guardado ✓', 'success');
    } catch {
      showToast('No se pudo guardar el borrador', 'error');
    }
  }

  async function eliminarBorrador() {
    const agente = encodeURIComponent(state.currentAgent.name);
    await fetch(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }).catch(() => {});
  }

  overlay.querySelector('#btn-guardar-borrador').onclick = guardarBorrador;

  overlay.querySelector('#btn-descartar-borrador').onclick = async () => {
    await eliminarBorrador();
    banner.style.display = 'none';
  };

  // Consultar borrador al abrir
  try {
    const agente = encodeURIComponent(state.currentAgent.name);
    const data   = await fetch(`/api/despachos/borrador?agente=${agente}`).then(r => r.json());
    if (data.borrador) {
      const { label, old } = _timeAgo(data.borrador.updated_at);
      bannerTxt.textContent = `📝 Tienes un borrador guardado (${label})`;
      banner.style.display  = 'flex';
      if (old) {
        banner.style.background = 'rgba(245,158,11,0.08)';
        banner.style.borderColor = '#f59e0b';
        bannerTxt.style.color    = '#f59e0b';
      }

      overlay.querySelector('#btn-restaurar-borrador').onclick = () => {
        const b = data.borrador;
        // Campos simples
        overlay.querySelector('[name="destinatario"]').value  = b.destinatario  || '';
        overlay.querySelector('[name="sede"]').value          = b.sede          || '';
        overlay.querySelector('[name="observaciones"]').value = b.observaciones || '';
        // Área (si existe el select)
        const areaSelect = overlay.querySelector('[name="area"]');
        if (areaSelect) areaSelect.value = b.area || '';
        // Checkbox acta
        const chk = overlay.querySelector('#check-requiere-acta');
        chk.checked = !!b.requiere_acta;
        overlay.querySelector('#acta-info').style.display = chk.checked ? 'block' : 'none';
        // Artículos
        restaurarArticulos(b.articulos || []);
        // Ticket
        if (b.ticket_id) {
          overlay.querySelector('#ticket-id-hidden').value = b.ticket_id;
          overlay.querySelector('#ticket-search-input').style.display = 'none';
          overlay.querySelector('#ticket-selected-info').style.display = 'flex';
          overlay.querySelector('#ticket-selected-label').textContent = `#${b.ticket_id} (restaurado del borrador)`;
        }
        banner.style.display = 'none';
        showToast('Borrador restaurado', 'success');
      };
    }
  } catch { /* fallo silencioso — no bloquear apertura del modal */ }
```

### Paso 6: Eliminar el borrador al crear exitosamente

- [ ] **Step 6: Modificar el `try` del submit handler**

En el submit handler de `#form-despacho`, el bloque `try` actualmente es:
```js
    try {
      const result = await createDespacho(payload);
      showToast(`Despacho ${result.numero} creado correctamente`, 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch (err) {
```

Reemplazar con:
```js
    try {
      const result = await createDespacho(payload);
      eliminarBorrador(); // background, sin await — no bloquea el cierre
      showToast(`Despacho ${result.numero} creado correctamente`, 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch (err) {
```

- [ ] **Step 7: Verificar manualmente en el navegador**

Con el servidor corriendo (`node server.js`), abrir el panel en `http://localhost:3000`:

1. Ir a la sección **Despacho** → clic en **Nuevo Despacho**
2. Llenar algunos campos (destinatario, artículo)
3. Clic en **💾 Guardar borrador** → debe aparecer toast *"Borrador guardado ✓"*
4. Cerrar el modal
5. Abrir **Nuevo Despacho** nuevamente → debe aparecer el banner azul con el tiempo transcurrido
6. Clic en **Restaurar** → los campos deben llenarse con los datos guardados
7. Clic en **Crear Despacho** → el despacho se crea y el borrador desaparece
8. Abrir **Nuevo Despacho** otra vez → no debe aparecer banner

- [ ] **Step 8: Commit**

```bash
git add public/js/despacho.js
git commit -m "feat: borrador de despacho — guardar, restaurar, descartar, limpiar al crear"
```

---

## Checklist de verificación final

- [ ] La tabla `despacho_borradores` existe en la BD después de iniciar el servidor
- [ ] `PUT /api/despachos/borrador` hace upsert (segunda llamada sobreescribe la primera)
- [ ] `DELETE /api/despachos/borrador` devuelve `{"ok":true}` aunque no haya borrador (idempotente)
- [ ] El banner aparece al abrir el modal si hay borrador guardado
- [ ] El banner es naranja/amarillo si el borrador tiene más de 8 horas
- [ ] "Restaurar" rellena todos los campos: destinatario, sede, área, artículos, observaciones, requiere_acta, ticket_id
- [ ] "Descartar" elimina el borrador de la BD y oculta el banner
- [ ] "💾 Guardar borrador" puede llamarse múltiples veces (sobreescribe silenciosamente)
- [ ] Al crear el despacho exitosamente, el borrador se elimina en background
- [ ] Si la API del borrador falla al abrir el modal, el formulario se abre normalmente (fallo silencioso)
