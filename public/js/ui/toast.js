// Toast notification component
const Toast = (() => {
  const CONTAINER_ID = 'toast-container';

  const getContainer = () => {
    let container = DOM.id(CONTAINER_ID);
    if (!container) {
      container = DOM.create('div', { id: CONTAINER_ID, className: 'toast-container' });
      document.body.appendChild(container);
    }
    return container;
  };

  const show = (message, type = 'info', duration = 3000) => {
    const container = getContainer();
    const toast = DOM.create('div', { className: `toast toast-${type}` }, message);

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }

    return toast;
  };

  return {
    success(message, duration) {
      return show(message, 'success', duration);
    },

    error(message, duration) {
      return show(message, 'error', duration);
    },

    warning(message, duration) {
      return show(message, 'warning', duration);
    },

    info(message, duration) {
      return show(message, 'info', duration);
    }
  };
})();
