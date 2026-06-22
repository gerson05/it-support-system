/**
 * inventario-scanner.js
 *
 * Handles:
 *  - openScanner(targetInputId) — Barcode scanner for a single form input
 *  - openSmartScanner(activeTab) — Smart multi-barcode & OCR scanner
 *  - routeBarcode, applyDetectedToForm, loadTesseract, parseOcrText
 */

import { showToast } from './components.js';
import { iconClose, iconCamera } from './icons.js';

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function openScanner(targetInputId) {
  if (!('BarcodeDetector' in window)) {
    showToast('Tu navegador no soporta BarcodeDetector. Ingresa el dato manualmente.', 'warning');
    return;
  }

  let stream, rafId;

  const overlay = document.createElement('div');
  overlay.id    = 'scanner-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(380px,94vw);text-align:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:600;font-size:15px;">Escanear código</span>
        <button id="btn-close-scan" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:var(--text-2);">${iconClose(18)}</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video id="scan-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;"></video>
        <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
      </div>
      <p style="margin-top:12px;font-size:13px;color:var(--text-muted);">Apunta la cámara al código de barras del equipo</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };

  document.getElementById('btn-close-scan').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  try {
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    const video = document.getElementById('scan-video');
    video.srcObject = stream;

    const scan = async () => {
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const val = codes[0].rawValue;
            const inp = document.getElementById(targetInputId);
            if (inp) { inp.value = val; inp.dispatchEvent(new Event('input')); }
            close();
            showToast(`Escaneado: ${val}`, 'success');
            return;
          }
        } catch {}
      }
      rafId = requestAnimationFrame(scan);
    };

    video.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(scan); });
  } catch (err) {
    close();
    if (err.name === 'NotAllowedError') {
      showToast('Permiso de cámara denegado. Actívalo en ajustes del navegador.', 'error');
    } else {
      showToast('No se pudo acceder a la cámara.', 'error');
    }
  }
}

export function routeBarcode(value, tipo, detectedKeys) {
  const isImei = /^\d{15}$/.test(value);
  if (tipo === 'celulares') {
    if (isImei) {
      if (!detectedKeys.has('imei'))  return 'imei';
      if (!detectedKeys.has('imei2')) return 'imei2';
      return null;
    }
    if (/^[A-Z0-9\-]{5,20}$/i.test(value)) return 'serial';
    return null;
  }
  if (/^[A-Z0-9\-]{5,20}$/i.test(value)) {
    if (!detectedKeys.has('placa'))  return 'placa';
    if (!detectedKeys.has('serial')) return 'serial';
    return null;
  }
  return null;
}

export function applyDetectedToForm(detectedMap) {
  for (const [field, value] of detectedMap) {
    const inp = document.querySelector(`#inv-form [name="${field}"]`);
    if (inp && !inp.value.trim()) {
      inp.value = value;
      inp.dispatchEvent(new Event('input'));
    }
  }
}

export async function openSmartScanner(activeTab) {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Cámara no disponible en este navegador.', 'warning');
    return;
  }

  let stream, rafId;
  const detectedFields = new Map();
  const detectedValues = new Set();
  const hasBarcodeDetector = 'BarcodeDetector' in window;
  let pasteHandler = null;

  const overlay = document.createElement('div');
  overlay.id = 'smart-scanner-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(420px,96vw);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:700;font-size:15px;display:flex;align-items:center;gap:7px;">${iconCamera(15)} Escanear equipo</span>
        <button id="ss-close" style="background:transparent;border:none;cursor:pointer;color:var(--text-2);">${iconClose(20)}</button>
      </div>
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
      <div id="ss-pane-codes" style="display:${hasBarcodeDetector ? 'block' : 'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
        </div>
        <p style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:10px;">Apunta a la etiqueta — detecta todos los códigos</p>
      </div>
      <div id="ss-pane-ocr" style="display:${!hasBarcodeDetector ? 'block' : 'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video-ocr" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;inset:8px;border:2px dashed rgba(99,102,241,.6);border-radius:8px;pointer-events:none;"></div>
        </div>
        <canvas id="ss-canvas" style="display:none;"></canvas>
        <div id="ss-ocr-progress" style="display:none;font-size:12px;color:var(--text-2);text-align:center;margin-bottom:8px;"></div>
        <button id="ss-capture" style="width:100%;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">
          📸 Capturar y leer etiqueta
        </button>
      </div>
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
      <div id="ss-detected" style="background:var(--surface-2);border-radius:8px;padding:10px;min-height:48px;margin-bottom:12px;font-size:13px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Detectado</div>
        <div id="ss-detected-list" style="color:var(--text-3);font-size:12px;">Esperando…</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="ss-cancel" style="flex:1;padding:10px;background:var(--surface);border:1px solid var(--border-2);border-radius:8px;font-size:13px;cursor:pointer;color:var(--text-2);">Cancelar</button>
        <button id="ss-apply" style="flex:2;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;" disabled>Aplicar campos</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (pasteHandler) document.removeEventListener('paste', pasteHandler);
    overlay.remove();
  };
  document.getElementById('ss-close').addEventListener('click', close);
  document.getElementById('ss-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('ss-apply').addEventListener('click', () => {
    applyDetectedToForm(detectedFields);
    showToast(`${detectedFields.size} campo(s) aplicado(s).`, 'success');
    close();
  });

  function updateDetectedPanel() {
    const list    = document.getElementById('ss-detected-list');
    const applyBtn = document.getElementById('ss-apply');
    if (!detectedFields.size) { list.textContent = 'Esperando…'; applyBtn.disabled = true; return; }
    list.innerHTML = [...detectedFields.entries()].map(([field, val]) =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="color:var(--text-2);">${field}</span>
        <span style="font-family:monospace;color:var(--text);">${esc(val)}</span>
      </div>`
    ).join('');
    applyBtn.disabled = false;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const v1 = document.getElementById('ss-video');
    const v2 = document.getElementById('ss-video-ocr');
    if (v1) v1.srcObject = stream;
    if (v2) v2.srcObject = stream;
  } catch (err) {
    close();
    showToast(err.name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : 'No se pudo acceder a la cámara.', 'error');
    return;
  }

  document.getElementById('ss-tab-codes')?.addEventListener('click', () => {
    document.getElementById('ss-tab-codes').classList.add('tab-active');
    document.getElementById('ss-tab-ocr').classList.remove('tab-active');
    document.getElementById('ss-tab-capture').classList.remove('tab-active');
    document.getElementById('ss-pane-codes').style.display   = '';
    document.getElementById('ss-pane-ocr').style.display     = 'none';
    document.getElementById('ss-pane-capture').style.display = 'none';
    startBarcodeScan();
  });
  document.getElementById('ss-tab-ocr').addEventListener('click', () => {
    document.getElementById('ss-tab-ocr').classList.add('tab-active');
    document.getElementById('ss-tab-codes')?.classList.remove('tab-active');
    document.getElementById('ss-tab-capture').classList.remove('tab-active');
    document.getElementById('ss-pane-ocr').style.display     = '';
    document.getElementById('ss-pane-codes').style.display   = 'none';
    document.getElementById('ss-pane-capture').style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });

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

  function startBarcodeScan() {
    if (!hasBarcodeDetector) return;
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });
    const video = document.getElementById('ss-video');
    const loop  = async () => {
      if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const val = code.rawValue;
            if (detectedValues.has(val)) continue;
            const field = routeBarcode(val, activeTab, new Set(detectedFields.keys()));
            if (field) { detectedValues.add(val); detectedFields.set(field, val); updateDetectedPanel(); }
          }
        } catch {}
      }
      rafId = requestAnimationFrame(loop);
    };
    if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) { rafId = requestAnimationFrame(loop); }
    else video?.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(loop); }, { once: true });
  }

  if (hasBarcodeDetector) startBarcodeScan();

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

  document.getElementById('ss-capture')?.addEventListener('click', async () => {
    const video    = document.getElementById('ss-video-ocr');
    const canvas   = document.getElementById('ss-canvas');
    const progress = document.getElementById('ss-ocr-progress');
    const btn      = document.getElementById('ss-capture');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    btn.disabled    = true;
    btn.textContent = 'Procesando…';
    progress.style.display = '';
    progress.textContent   = 'Cargando motor OCR…';
    try {
      const Tesseract = await loadTesseract();
      progress.textContent = 'Reconociendo texto…';
      const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: m => { if (m.status === 'recognizing text') progress.textContent = `Reconociendo… ${Math.round((m.progress||0)*100)}%`; },
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      const parsed = parseOcrText(text);
      if (!parsed.size) {
        progress.textContent = 'No se detectaron datos. Intenta con mejor iluminación.';
      } else {
        progress.style.display = 'none';
        for (const [field, val] of parsed) { if (!detectedFields.has(field)) detectedFields.set(field, val); }
        updateDetectedPanel();
      }
    } catch (err) {
      progress.textContent = `Error OCR: ${err.message}`;
    } finally {
      btn.disabled    = false;
      btn.textContent = '📸 Capturar y leer etiqueta';
    }
  });
}

export async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s  = document.createElement('script');
    s.src    = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar Tesseract.js. Verifica tu conexión.'));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

export function parseOcrText(text) {
  const result = new Map();
  if (!text) return result;

  const imeiMatch = text.match(/IMEI[\s:]+(\d{15})/i);
  if (imeiMatch) result.set('imei', imeiMatch[1]);

  const snMatch = text.match(/S\/?N[\s:]+([A-Z0-9\-]{5,20})/i);
  if (snMatch) result.set('serial', snMatch[1].toUpperCase());

  if (!result.has('imei')) {
    const bareImei = text.match(/\b(\d{15})\b/);
    if (bareImei) result.set('imei', bareImei[1]);
  }

  const ramCtx = text.match(/RAM[^\n]{0,30}?(\d+)\s*GB/i) || text.match(/(\d+)\s*GB[^\n]{0,30}?RAM/i);
  if (ramCtx) result.set('ram', ramCtx[1] + 'GB');

  const storCtx = text.match(/(?:ROM|Storage|Almacenamiento|Internal)[^\n]{0,30}?(\d+)\s*GB/i)
               || text.match(/(\d+)\s*GB[^\n]{0,30}?(?:ROM|Storage|Almacenamiento|Internal)/i);
  if (storCtx) result.set('almacenamiento', storCtx[1] + 'GB');

  const BRANDS = ['Samsung','Xiaomi','Redmi','Honor','ZTE','Infinix','Motorola','Apple','iPhone',
                  'Dell','HP','Lenovo','Asus','Acer','Toshiba'];
  for (const brand of BRANDS) {
    const m = text.match(new RegExp(`\\b${brand}\\b`, 'i'));
    if (m) {
      const field = ['Dell','HP','Lenovo','Asus','Acer','Toshiba'].includes(brand) ? 'marca' : 'equipo';
      result.set(field, brand);
      const lineMatch = text.match(new RegExp(`${brand}[\\s]+([A-Z0-9][A-Z0-9 \\-]{2,30})`, 'i'));
      if (lineMatch) result.set('modelo', lineMatch[1].trim());
      break;
    }
  }

  return result;
}
