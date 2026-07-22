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

  pattern(value, regex) {
    return regex.test(value);
  },

  number(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  integer(value) {
    return Number.isInteger(parseInt(value));
  },

};
