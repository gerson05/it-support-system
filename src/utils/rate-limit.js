import rateLimit from 'express-rate-limit';

// Per-IP limits. Limits are read from env so they can be tuned without a deploy.
const num = (v, def) => Number(v) > 0 ? Number(v) : def;

const base = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
};

// General cap for every /api request (dashboards poll, so keep it generous)
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: num(process.env.RATE_LIMIT_API_PER_MIN, 600),
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
});

// Page loads: public pages (/firmar, /registrar, /rastrear) and the SPA fallback
export const publicPageLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: num(process.env.RATE_LIMIT_PUBLIC_PER_MIN, 120),
  message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
});

// Login: max 10 attempts per IP per 15 min
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});
