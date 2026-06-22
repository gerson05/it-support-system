# Inventario Scanner — HTTPS + Image Upload Design

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** Two independent improvements to the inventory scanner module

---

## Problem

1. **Camera broken on mobile**: The app is served over HTTP on the local network (`http://192.168.x.x:3000`). Mobile browsers block `getUserMedia` on non-HTTPS origins. Users get a browser-native error suggesting to switch to Edge, and after that the camera permission remains blocked.

2. **No image upload for OCR**: PC users have screenshots and screen captures of device specs (from Device Manager, vendor sheets, labels) but cannot feed them to the OCR pipeline. They must re-type data manually.

---

## Solution Overview

### Part 1 — HTTPS (dual-mode: Docker + Windows direct)

The app runs in two modes. Both must serve HTTPS so the camera API works on mobile.

#### Mode A — Docker (Caddy reverse proxy)

Add Caddy as a lightweight reverse proxy container in `docker-compose.yml`. Caddy auto-generates a self-signed TLS certificate for the local network.

```
Mobile/PC browser → https://192.168.x.x (port 443)
                  → Caddy container (TLS termination)
                  → app container (port 3000, internal)
```

- `Caddyfile` (new) — `tls internal`, reverse proxy to `app:3000`
- `docker-compose.yml` (modify) — add `caddy` service, expose 80/443
- No changes to Node.js code in Docker mode

#### Mode B — Windows direct (Node.js built-in HTTPS)

Add `selfsigned` npm package. On startup, `server.js` generates a self-signed cert in memory and starts an HTTPS server on port 3443 (in addition to or replacing HTTP port 3000). Controlled by env var `ENABLE_HTTPS=true`.

```
Mobile/PC browser → https://192.168.x.x:3443
                  → Node.js https server (selfsigned cert)
```

- `package.json` — add `selfsigned` dependency
- `server.js` — add HTTPS server block gated on `ENABLE_HTTPS=true`
- `.env.example` — document `ENABLE_HTTPS` variable

**First-time UX (both modes):** Browser shows "Your connection is not private" (self-signed). User clicks "Advanced → Proceed". After that, camera works on all devices that accepted the cert.

---

### Part 2 — "📎 Captura" tab in scanner modal (PC)

Add a third tab to `openSmartScanner()` in `public/js/inventario-scanner.js`.

#### Input methods (three ways to load an image)

| Method | Trigger | Notes |
|--------|---------|-------|
| Ctrl+V paste | `paste` event on document while modal open | Reads `ClipboardEvent.clipboardData` for `image/*` items |
| Drag & drop | `dragover` + `drop` on drop zone | Reads `DataTransfer.files[0]` |
| File picker | `<input type="file" accept="image/*">` | Click on drop zone triggers input |

#### Processing pipeline

```
image source (paste / drop / file)
  → FileReader.readAsDataURL → <img> preview
  → draw to offscreen <canvas>
  → BarcodeDetector.detect(canvas)  [if available]
  → Tesseract OCR (existing loadTesseract + parseOcrText)
  → detectedFields Map (shared with barcode/OCR tabs)
  → updateDetectedPanel()
  → "Aplicar campos" button
```

#### UI layout

```
┌─────────────────────────────────────────┐
│  📷 Códigos │ 🔤 Leer etiqueta │ 📎 Captura │
├─────────────────────────────────────────┤
│                                         │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   │  Pega una captura (Ctrl+V)     │   │
│   │  o arrastra una imagen aquí    │   │
│   │                                │   │
│   │  [preview de imagen subida]    │   │
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                         │
│   [Progreso OCR: Reconociendo… 72%]    │
│                                         │
├─────────────────────────────────────────┤
│  Detectado:                             │
│  serial   CNX9F00123                    │
│  marca    Dell                          │
└─────────────────────────────────────────┘
```

#### State management

- Drop zone switches to image preview mode once an image is loaded
- "Cambiar imagen" link resets to drop zone
- OCR starts automatically after image loads (no extra button click needed)
- `detectedFields` Map is shared — results merge with any barcode tab results
- Switching away from this tab does not clear detected fields

---

## Files Modified

| File | Change |
|------|--------|
| `Caddyfile` | New — Caddy config for Docker HTTPS |
| `docker-compose.yml` | Add `caddy` service + volumes |
| `server.js` | Add HTTPS server block gated on `ENABLE_HTTPS=true` |
| `package.json` | Add `selfsigned` dependency |
| `.env.example` | Document `ENABLE_HTTPS` variable |
| `public/js/inventario-scanner.js` | Add 3rd tab + paste/drop/file logic |

---

## Out of Scope

- Let's Encrypt / public domain HTTPS (covered when Cloudflare Tunnel is added later)
- Mobile image upload (camera fix via HTTPS is sufficient for mobile)
- New OCR fields beyond existing `parseOcrText` patterns
- Backend changes

---

## Success Criteria

1. Docker mode: accessing `https://192.168.x.x` on mobile after accepting cert → camera scanner works
2. Windows direct mode: `ENABLE_HTTPS=true` → server starts on port 3443, `https://192.168.x.x:3443` → camera scanner works
2. Pasting a screenshot with Ctrl+V in the scanner modal → image appears in preview, OCR runs, detected fields populate
3. Dragging an image file to the drop zone → same result as paste
4. Clicking "Seleccionar archivo" → file picker opens, same result
5. Detected fields from image tab merge with barcode tab results when "Aplicar campos" is clicked
