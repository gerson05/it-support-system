const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ESC[c]);
}
