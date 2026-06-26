// Reusable modal component
const Modal = {
  create(id, title, content = '', footer = '') {
    const modal = DOM.create('div', { className: 'modal-overlay', id }, `
      <div class="modal-box">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="Modal.close('${id}')">✕</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `);
    return modal;
  },

  open(id) {
    const modal = DOM.id(id);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },

  close(id) {
    const modal = DOM.id(id);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  show(modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  hide(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};
