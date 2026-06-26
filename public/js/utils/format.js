// Formatting utilities - date, currency, text
const Format = {
  date(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-CO');
  },

  datetime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('es-CO');
  },

  time(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('es-CO');
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
