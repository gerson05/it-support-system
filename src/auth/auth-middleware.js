import { getSession } from './auth-service.js';

function extractToken(cookieHeader) {
  if (!cookieHeader) return null;
  const part = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('it_session='));
  return part ? decodeURIComponent(part.slice('it_session='.length)) : null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req.headers.cookie);
  const user = getSession(token);
  if (!user) return res.status(401).json({ error: 'No autenticado.' });
  req.user = user;
  req.permissions = user.permissions;
  next();
}

export function requirePermission(name) {
  return (req, res, next) => {
    if (!req.permissions?.includes(name)) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }
    next();
  };
}
