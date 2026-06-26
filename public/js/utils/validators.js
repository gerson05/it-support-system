// Input validation utilities
const Validators = {
  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  phone(value) {
    return /^\d{10}$/.test(value.replace(/\D/g, ''));
  },

  required(value) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
  },

  minLength(value, min) {
    return value && value.length >= min;
  },

  maxLength(value, max) {
    return !value || value.length <= max;
  },

  pattern(value, regex) {
    return regex.test(value);
  },

  number(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  integer(value) {
    return Number.isInteger(parseInt(value));
  },

  url(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
};
