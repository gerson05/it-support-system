import { showToast, copyToClipboard } from './components.js';

let _waPollInterval = null;

function updateWaUI(statusData) {
  const dot          = document.getElementById('wa-status-dot');
  const text         = document.getElementById('wa-status-text');
  const btn          = document.getElementById('btn-wa-connect');
  const qrContainer  = document.getElementById('wa-qr-container');
  const qrImg        = document.getElementById('wa-qr-image');
  if (!dot || !text) return;

  dot.className  = 'wa-status-dot ' + (statusData.status || 'disconnected');
  const labels   = {
    connected:    '✅ Conectado',
    awaiting_qr:  '📱 Escanea el QR',
    connecting:   '⏳ Conectando con WhatsApp...',
    disconnected: '❌ Desconectado',
    reconnecting: '🔄 Reconectando...',
  };
  text.textContent = labels[statusData.status] || statusData.status;

  if (statusData.connected) {
    qrContainer.style.display = 'none';
    btn.style.display = 'none';
    clearInterval(_waPollInterval);
    _waPollInterval = setInterval(pollWaStatus, 30000);
  } else if (statusData.status === 'awaiting_qr' && statusData.qrString) {
    btn.style.display = 'none';
    qrContainer.style.display = 'block';
    if (statusData.qrImage) {
      qrImg.src = statusData.qrImage;
      qrImg.style.display = 'block';
      qrImg.onerror = () => { qrImg.style.display = 'none'; };
    }
    const textEl = document.getElementById('wa-qr-text');
    if (textEl) textEl.value = statusData.qrString;
    clearInterval(_waPollInterval);
    _waPollInterval = setInterval(pollWaStatus, 5000);
  } else if (statusData.status === 'connecting') {
    qrContainer.style.display = 'none';
    btn.style.display = 'none';
    clearInterval(_waPollInterval);
    _waPollInterval = setInterval(pollWaStatus, 3000);
  } else {
    qrContainer.style.display = 'none';
    btn.style.display = 'block';
  }
}

async function pollWaStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    if (res.ok) updateWaUI(await res.json());
  } catch (e) {
    console.warn('Error consultando estado de WhatsApp:', e);
  }
}

export function startWhatsAppMonitor() {
  pollWaStatus();
  _waPollInterval = setInterval(pollWaStatus, 3000);

  document.getElementById('btn-wa-connect')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.textContent = 'Conectando...';
    btn.disabled = true;
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
      showToast('Iniciando conexión de WhatsApp. Escanea el QR.', 'info');
    } catch {
      showToast('Error al conectar WhatsApp.', 'error');
    }
    btn.textContent = 'Conectar WhatsApp';
    btn.disabled = false;
  });

  document.getElementById('btn-copy-qr')?.addEventListener('click', async () => {
    const textEl = document.getElementById('wa-qr-text');
    if (textEl?.value) {
      const ok = await copyToClipboard(textEl.value);
      showToast(ok ? 'QR copiado al portapapeles!' : 'No se pudo copiar el QR', ok ? 'success' : 'error');
    }
  });
}
