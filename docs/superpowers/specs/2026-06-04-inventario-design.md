# Inventario IT — Design Spec
Date: 2026-06-04

## Scope
Module for registering and consulting IT equipment inventory. Two device types initially: Equipos (desktops/laptops) and Celulares. UPS added in a future iteration.

## Architecture

### DB (migrations in database.js)
```sql
inventario_equipos:
  id, placa, marca, nombre_equipo, serial, procesador,
  ram, tipo_ram, cap_disco, tipo_disco, serial_cargador,
  area, responsable, fecha_compra, created_at, updated_at

inventario_celulares:
  id, fecha_registro, area, ciudad, nombre_completo,
  cedula, linea, operador, equipo, almacenamiento,
  ram, modelo, imei, imei2, estado, accesorio,
  fecha_entrega, entregado_por, created_at, updated_at
```

### Backend — src/inventario/inventario-routes.js
- GET    /api/inventario/equipos       — list, search, filter area, pagination
- POST   /api/inventario/equipos       — create
- PUT    /api/inventario/equipos/:id   — update
- DELETE /api/inventario/equipos/:id   — delete
- Same 4 routes for /celulares
- Permissions: inventario:read / create / edit / delete

### Frontend — public/js/inventario.js
- Sidebar nav item (icon: package/boxes)
- Two tabs: Equipos | Celulares
- List view: search, filter por área, paginated table
- Form modal: new + edit
  - Scan buttons on Placa and Serial/IMEI fields
  - BarcodeDetector API → camera stream modal → auto-close on detect
  - Fallback: manual input if BarcodeDetector not supported
  - Smart dropdowns: Marca, Procesador, RAM sizes, Estado
  - Title case on text inputs (Nombre, Area, Responsable)

### Permissions
New granular permissions added to DB migrations:
inventario:read (31), inventario:create (32), inventario:edit (33), inventario:delete (34)
IT role (1) gets all four. Other roles get read-only by default.

### Barcode Scanning Flow
1. User taps 📷 icon next to Placa or Serial/IMEI
2. Check BarcodeDetector support → show unsupported message if missing
3. Open camera stream overlay (rear camera)
4. BarcodeDetector polls frames at ~10fps
5. On detection → stop stream, close overlay, populate field, focus next field
6. User can dismiss overlay manually → falls back to manual input

### Sheets Sync (Phase 2 — not in this iteration)
- Apps Script endpoint to append rows
- Triggered on POST /api/inventario/* 
- Non-blocking, fire-and-forget with error logging

## Out of Scope (this iteration)
- UPS device type
- Import from existing Google Sheet
- Sheets sync
- Bulk import / CSV upload
