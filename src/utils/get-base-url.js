import os from 'os';

export function getBaseUrl(req) {
  if (process.env.PUBLIC_TUNNEL_URL) return process.env.PUBLIC_TUNNEL_URL;
  const host = req.headers.host || '';
  const isLocal = /^(localhost|127\.|::1)/i.test(host);
  if (isLocal) {
    const port = host.split(':')[1] || '3000';
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) return `${req.protocol}://${a.address}:${port}`;
      }
    }
  }
  return `${req.protocol}://${host}`;
}
