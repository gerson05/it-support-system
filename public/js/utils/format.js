// Formatting utilities - date, currency, text
// SQLite returns dates as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" (no TZ).
// Parsing those directly as UTC shifts the date in GMT-5. We force local-time
// by appending T00:00:00 for date-only strings and replacing the space separator.
function _parseLocal(s) {
  if (!s) return new Date(NaN);
  const iso = s.length === 10 ? s + 'T00:00:00' : s.replace(' ', 'T');
  return new Date(iso);
}

const Format = {
  date(isoString) {
    if (!isoString) return '';
    return _parseLocal(isoString).toLocaleDateString('es-CO');
  },

  datetime(isoString) {
    if (!isoString) return '';
    return _parseLocal(isoString).toLocaleString('es-CO');
  },

  time(isoString) {
    if (!isoString) return '';
    return _parseLocal(isoString).toLocaleTimeString('es-CO');
  },

  currency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  slug(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  truncate(str, length = 50) {
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
};
