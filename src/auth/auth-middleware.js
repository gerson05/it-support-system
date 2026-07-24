import { getSession } from './auth-service.js';

async function extractToken(cookieHeader) {
  if (!cookieHeader) return null;
  const part = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('it_session='));
  return part ? decodeURIComponent(part.slice('it_session='.length)) : null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req.headers.cookie);
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'No autenticado.' });
    req.user = user;
    req.permissions = user.permissions;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(name) {
  return (req, res, next) => {
    const perms = req.permissions ?? [];
    if (perms.includes('full') || perms.includes(name)) return next();
    return res.status(403).json({ error: 'Acceso denegado.' });
  };
}
