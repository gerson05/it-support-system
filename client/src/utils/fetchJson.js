export default async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let json;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok) {
    const errMsg = json?.error || res.statusText || 'Request error';
    throw new Error(errMsg);
  }
  return json;
}
