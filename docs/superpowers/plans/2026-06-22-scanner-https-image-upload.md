# Scanner HTTPS + Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile camera scanner by enabling HTTPS in both Docker and Windows-direct modes, and add a Captura tab to the scanner modal for OCR extraction from pasted/dragged screenshots on PC.

**Architecture:** Docker mode uses Caddy as a TLS-terminating reverse proxy in docker-compose. Windows-direct mode adds a Node.js `https` server gated on `ENABLE_HTTPS=true` using the `selfsigned` package. The scanner Captura tab wires paste/drop/file events to the existing Tesseract OCR + BarcodeDetector pipeline already in `inventario-scanner.js`.

**Tech Stack:** Caddy 2 Alpine (Docker), Node.js `node:https` + `selfsigned` npm (Windows), Tesseract.js CDN (already loaded), BarcodeDetector API (already used).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `Caddyfile` | Create | Caddy config: TLS internal, reverse proxy to app |
| `docker-compose.yml` | Modify | Add `caddy` service + `caddy_data`/`caddy_config` volumes |
| `package.json` | Modify | Add `selfsigned` dependency |
| `server.js` | Modify | Add HTTPS server block at bottom, gated on `ENABLE_HTTPS=true` |
| `.env.example` | Modify | Document `ENABLE_HTTPS` and `HTTPS_PORT` variables |
| `public/js/inventario-scanner.js` | Modify | Add 3rd tab "Captura" with paste/drop/file + OCR pipeline |

---

## Task 1: Caddyfile — Docker TLS config

**Files:**
- Create: `Caddyfile`

- [ ] **Step 1: Create Caddyfile**

```
{
  local_certs
}

:443 {
  tls internal
  reverse_proxy it-support:3000
}

:80 {
  redir https://{host}{uri} permanent
}
```

> `local_certs` tells Caddy to act as its own CA (self-signed). `it-support` is the service name in docker-compose. Port 80 redirects permanently to 443.

- [ ] **Step 2: Commit**

```bash
git add Caddyfile
git commit -m "feat(https): add Caddyfile for Docker TLS via Caddy internal CA"
```

---

## Task 2: docker-compose.yml — Add Caddy service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add caddy service and volumes to docker-compose.yml**

In the `services:` section, add after the `it-support` service block:

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: it-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - it-support
```

In the `volumes:` section at the bottom, add:

```yaml
  caddy_data:
    driver: local
  caddy_config:
    driver: local
```

- [ ] **Step 2: Verify docker-compose config is valid**

```bash
docker compose config --quiet
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(https): add Caddy reverse proxy service to docker-compose"
```

---

## Task 3: package.json — Add selfsigned dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install selfsigned**

```bash
npm install selfsigned
```

Expected output: `added 1 package` (selfsigned + node-forge).

- [ ] **Step 2: Verify install**

```bash
node -e "import { createRequire } from 'node:module'; const r = createRequire(import.meta.url); const s = r('selfsigned'); const p = s.generate(null, {days:1}); console.log('ok', typeof p.cert);"
```

Expected: `ok string`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(https): add selfsigned dep for Windows-direct HTTPS"
```

---

## Task 4: server.js — HTTPS server block

**Files:**
- Modify: `server.js` (lines 1-6 for imports, line 267+ for server start)

- [ ] **Step 1: Add imports at top of server.js**

After the existing imports (around line 6, after `import { spawn } from 'child_process';`), add:

```js
import https from 'node:https';
import { createRequire } from 'node:module';
```

- [ ] **Step 2: Add HTTPS server block at the bottom of server.js**

After the existing `app.listen(PORT, async () => { ... });` block (after its closing `});`), add:

```js
// HTTPS server for Windows-direct mode (mobile camera requires secure context)
// Enable with ENABLE_HTTPS=true in .env — listens on HTTPS_PORT (default 3443)
if (process.env.ENABLE_HTTPS === 'true') {
  const require = createRequire(import.meta.url);
  const selfsigned = require('selfsigned');
  const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 365, algorithm: 'sha256' }
  );
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  httpsServer.listen(HTTPS_PORT, () => {
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { localIp = net.address; break; }
      }
      if (localIp !== '127.0.0.1') break;
    }
    console.log(`[HTTPS] Servidor seguro en https://localhost:${HTTPS_PORT}`);
    console.log(`[HTTPS] Red local:       https://${localIp}:${HTTPS_PORT}`);
    console.log(`[HTTPS] Acepta el cert en el celular para habilitar la camara`);
  });
}
```

- [ ] **Step 3: Test locally**

```bash
ENABLE_HTTPS=true node server.js
```

Expected: server logs both HTTP port 3000 and HTTPS port 3443. Opening `https://localhost:3443` in browser shows "not private" warning → click Advanced → Proceed → app loads.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(https): add HTTPS server for Windows-direct mode via selfsigned cert"
```

---

## Task 5: .env.example — Document new env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add HTTPS section to .env.example**

After the `PORT=3000` line at the top, add:

```
# ── HTTPS para cámara en móviles (modo Windows directo) ──────────────────────
# Activa el servidor HTTPS con cert auto-firmado (acepta aviso en navegador)
# En Docker usa Caddy (ver docker-compose.yml) — esta opción no aplica en Docker
ENABLE_HTTPS=false
HTTPS_PORT=3443
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document ENABLE_HTTPS and HTTPS_PORT env vars"
```

---

## Task 6: inventario-scanner.js — Add Captura tab

**Files:**
- Modify: `public/js/inventario-scanner.js`

This task modifies `openSmartScanner()`. The function currently has two tabs (Códigos, Leer etiqueta). We add a third tab (Captura) with paste/drop/file support that feeds into the existing `detectedFields` Map and `updateDetectedPanel()`.

- [ ] **Step 1: Add `pasteHandler` variable and update `close` to clean it up**

Find the line near top of `openSmartScanner` (around line 131):
```js
  const detectedFields = new Map();
  const detectedValues = new Set();
  const hasBarcodeDetector = 'BarcodeDetector' in window;
```

Replace with:
```js
  const detectedFields = new Map();
  const detectedValues = new Set();
  const hasBarcodeDetector = 'BarcodeDetector' in window;
  let pasteHandler = null;
```

Then find the `close` function (around line 181):
```js
  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };
```

Replace with:
```js
  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (pasteHandler) document.removeEventListener('paste', pasteHandler);
    overlay.remove();
  };
```

- [ ] **Step 2: Add the Captura tab button to the HTML**

Find in the overlay innerHTML template (around line 144):
```js
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:12px;">
        <button id="ss-tab-codes" class="tab-btn ${hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;${!hasBarcodeDetector ? 'opacity:.4;cursor:not-allowed;' : ''}" ${!hasBarcodeDetector ? 'disabled' : ''}>
          📷 Códigos
        </button>
        <button id="ss-tab-ocr" class="tab-btn ${!hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;">
          🔤 Leer etiqueta
        </button>
      </div>
```

Replace with:
```js
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:12px;">
        <button id="ss-tab-codes" class="tab-btn ${hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;${!hasBarcodeDetector ? 'opacity:.4;cursor:not-allowed;' : ''}" ${!hasBarcodeDetector ? 'disabled' : ''}>
          📷 Códigos
        </button>
        <button id="ss-tab-ocr" class="tab-btn ${!hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;">
          🔤 Etiqueta
        </button>
        <button id="ss-tab-capture" class="tab-btn" style="flex:1;">
          📎 Captura
        </button>
      </div>
```

- [ ] **Step 3: Add the Captura pane HTML**

Find in the overlay innerHTML template (the closing `</div>` that ends ss-pane-ocr, around line 169, just before the ss-detected div):
```js
      <div id="ss-detected"
```

Insert the Captura pane **before** that line:
```js
      <div id="ss-pane-capture" style="display:none;">
        <div id="ss-drop-zone" style="border:2px dashed var(--border-2);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .2s;margin-bottom:10px;min-height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
          <div style="font-size:28px;">📎</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-2);">Pega una captura (Ctrl+V)</div>
          <div style="font-size:12px;color:var(--text-3);">o arrastra / haz clic para seleccionar</div>
          <input id="ss-file-input" type="file" accept="image/*" style="display:none;">
        </div>
        <div id="ss-img-preview" style="display:none;position:relative;margin-bottom:10px;">
          <img id="ss-preview-img" style="width:100%;border-radius:8px;max-height:180px;object-fit:contain;background:#000;">
          <button id="ss-change-img" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;font-size:11px;padding:3px 7px;cursor:pointer;">Cambiar</button>
        </div>
        <div id="ss-capture-progress" style="display:none;font-size:12px;color:var(--text-2);text-align:center;margin-bottom:8px;"></div>
      </div>
      <div id="ss-detected"
```

- [ ] **Step 4: Add `processImageFile` helper function inside `openSmartScanner`**

Find the `function startBarcodeScan()` definition (around line 238). Insert the following **before** it:

```js
  async function processImageFile(file) {
    const progress = document.getElementById('ss-capture-progress');
    const dropZoneEl = document.getElementById('ss-drop-zone');
    const previewWrap = document.getElementById('ss-img-preview');
    const previewImg = document.getElementById('ss-preview-img');

    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = e => res(e.target.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    previewImg.src = dataUrl;
    dropZoneEl.style.display = 'none';
    previewWrap.style.display = '';
    progress.style.display = '';
    progress.textContent = 'Analizando imagen…';

    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = dataUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    if (hasBarcodeDetector) {
      try {
        const detector = new BarcodeDetector({
          formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
        });
        const codes = await detector.detect(canvas);
        for (const code of codes) {
          const val = code.rawValue;
          if (detectedValues.has(val)) continue;
          const field = routeBarcode(val, activeTab, new Set(detectedFields.keys()));
          if (field) { detectedValues.add(val); detectedFields.set(field, val); }
        }
      } catch {}
    }

    try {
      progress.textContent = 'Cargando motor OCR…';
      const Tesseract = await loadTesseract();
      const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            progress.textContent = `Reconociendo… ${Math.round((m.progress || 0) * 100)}%`;
          }
        },
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      const parsed = parseOcrText(text);
      for (const [field, val] of parsed) {
        if (!detectedFields.has(field)) detectedFields.set(field, val);
      }
      if (!detectedFields.size) {
        progress.textContent = 'No se detectaron datos. Intenta con mejor calidad.';
      } else {
        progress.style.display = 'none';
        updateDetectedPanel();
      }
    } catch (err) {
      progress.textContent = `Error OCR: ${err.message}`;
    }
  }
```

- [ ] **Step 5: Wire up tab click + paste/drop/file events**

Find the line (around line 262):
```js
  if (hasBarcodeDetector) startBarcodeScan();
```

After that line, add all the Captura tab event wiring:

```js
  // ── Captura tab wiring ─────────────────────────────────
  document.getElementById('ss-tab-capture').addEventListener('click', () => {
    document.getElementById('ss-tab-capture').classList.add('tab-active');
    document.getElementById('ss-tab-ocr').classList.remove('tab-active');
    document.getElementById('ss-tab-codes')?.classList.remove('tab-active');
    document.getElementById('ss-pane-capture').style.display = '';
    document.getElementById('ss-pane-ocr').style.display   = 'none';
    document.getElementById('ss-pane-codes').style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });

  const fileInput = document.getElementById('ss-file-input');
  const dropZoneEl = document.getElementById('ss-drop-zone');

  dropZoneEl.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) processImageFile(e.target.files[0]);
  });

  dropZoneEl.addEventListener('dragover', e => {
    e.preventDefault();
    dropZoneEl.style.borderColor = 'var(--primary)';
  });
  dropZoneEl.addEventListener('dragleave', () => {
    dropZoneEl.style.borderColor = '';
  });
  dropZoneEl.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneEl.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) processImageFile(file);
  });

  pasteHandler = e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        document.getElementById('ss-tab-capture').click();
        processImageFile(file);
      }
    }
  };
  document.addEventListener('paste', pasteHandler);

  document.getElementById('ss-change-img').addEventListener('click', () => {
    document.getElementById('ss-drop-zone').style.display = '';
    document.getElementById('ss-img-preview').style.display = 'none';
    document.getElementById('ss-capture-progress').style.display = 'none';
    fileInput.value = '';
  });
```

- [ ] **Step 6: Manual smoke test**

1. Open the app in Chrome on PC
2. Go to Inventario → open scanner modal (smart scanner)
3. Verify 3 tabs appear: 📷 Códigos, 🔤 Etiqueta, 📎 Captura
4. Click "📎 Captura" tab → drop zone appears
5. Take a screenshot with Snipping Tool (Win+Shift+S) → Ctrl+V in the modal → tab auto-switches, image preview appears, OCR progress shows, detected fields populate
6. Try dragging an image file to the drop zone → same result
7. Click "Cambiar" → drop zone resets
8. Click "Aplicar campos" → form fields fill in

- [ ] **Step 7: Commit**

```bash
git add public/js/inventario-scanner.js
git commit -m "feat(scanner): add Captura tab with paste/drop/file OCR extraction"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Docker HTTPS → Task 1 + Task 2
  - Windows HTTPS → Task 3 + Task 4 + Task 5
  - Paste Ctrl+V → Task 6 Step 5 (`pasteHandler`)
  - Drag & drop → Task 6 Step 5 (`drop` event)
  - File picker → Task 6 Step 5 (`fileInput change`)
  - Image preview → Task 6 Step 3 (`ss-img-preview`)
  - OCR pipeline → Task 6 Step 4 (`processImageFile`)
  - BarcodeDetector on image → Task 6 Step 4
  - Shared detectedFields Map → Task 6 Step 1 (same variable, same `updateDetectedPanel`)
  - "Cambiar imagen" → Task 6 Step 5 (`ss-change-img` listener)
  - pasteHandler cleanup on close → Task 6 Step 1 (updated `close` function)

- [x] **No placeholders** — all steps have complete code
- [x] **Type consistency** — `pasteHandler` declared as `let` before `close`, assigned in Step 5, cleaned up in updated `close`
- [x] **ESM compatibility** — `selfsigned` loaded via `createRequire`, `import https` and `import { createRequire }` added to server.js top
