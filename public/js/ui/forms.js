// Form utilities
const Forms = {
  getValues(formEl) {
    const formData = new FormData(formEl);
    const data = {};
    formData.forEach((value, key) => {
      if (data[key]) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  },

  setValues(formEl, data) {
    Object.entries(data).forEach(([key, value]) => {
      const input = formEl.querySelector(`[name="${key}"]`);
      if (input) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = value;
        } else {
          input.value = value;
        }
      }
    });
  },

  reset(formEl) {
    formEl?.reset();
  },

  disable(formEl) {
    formEl?.querySelectorAll('button, input, select, textarea').forEach(el => {
      el.disabled = true;
    });
  },

  enable(formEl) {
    formEl?.querySelectorAll('button, input, select, textarea').forEach(el => {
      el.disabled = false;
    });
  },

  validate(formEl, rules = {}) {
    const values = this.getValues(formEl);
    const errors = {};

    Object.entries(rules).forEach(([field, validations]) => {
      const value = values[field];
      validations.forEach(rule => {
        if (typeof rule === 'function' && !rule(value)) {
          errors[field] = rule.message || `${field} es inválido`;
        }
      });
    });

    return { valid: Object.keys(errors).length === 0, errors };
  }
};
