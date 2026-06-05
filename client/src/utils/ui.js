export function showToast(message, type = 'info') {
  const containerId = 'react-toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.bottom = '12px';
    container.style.zIndex = '99999';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.marginTop = '8px';
  toast.style.padding = '10px 12px';
  toast.style.background = type === 'error' ? '#7f1d1d' : type === 'success' ? '#064e3b' : '#0f172a';
  toast.style.color = '#fff';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 6px 20px rgba(2,6,23,.6)';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(12px)'; setTimeout(()=>toast.remove(),200); }, 3000);
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true;
  } catch (e) { return false; }
}
