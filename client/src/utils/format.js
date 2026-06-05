export function formatDate(iso) {
  if (!iso) return '';
  try { const d = new Date(iso); return d.toLocaleString(); } catch(e){return iso}
}
