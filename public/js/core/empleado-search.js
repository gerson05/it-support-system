// public/js/core/empleado-search.js

/**
 * Attaches employee autocomplete to a name input and an optional cedula input.
 * Calls GET /api/erp/empleados?q= after 250ms debounce (min 2 chars).
 * Uses mousedown on dropdown items to prevent blur race condition.
 *
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null} cedulaInput  - filled read-only on selection
 * @param {{ onSelect?: (emp: object) => void }} options
 */
export function createEmpleadoSearch(nameInput, cedulaInput, options = {}) {
  if (!nameInput) return;
  if (nameInput.dataset.empSearchInit === '1') return;
  nameInput.dataset.empSearchInit = '1';

  let _timer = null;
  let _drop  = null;

  function _closeDrop() { _drop?.remove(); _drop = null; }

  function _openDrop(rows) {
    _closeDrop();
    if (!rows.length) {
      _drop = document.createElement('div');
      _drop.style.cssText = _dropStyle();
      _drop.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-3);">Sin resultados</div>';
      _wrap(_drop);
      return;
    }

    _drop = document.createElement('div');
    _drop.style.cssText = _dropStyle();

    rows.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);';
      const nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'font-weight:600;color:var(--text);';
      nameDiv.textContent = r.nombre;
      const metaDiv = document.createElement('div');
      metaDiv.style.cssText = 'color:var(--text-3);';
      metaDiv.textContent = [r.cedula, r.cargo, r.area].filter(Boolean).join(' · ');
      item.appendChild(nameDiv);
      item.appendChild(metaDiv);
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        nameInput.value = r.nombre;
        if (cedulaInput) { cedulaInput.value = r.cedula; cedulaInput.readOnly = true; }
        _closeDrop();
        options.onSelect?.(r);
      });
      _drop.appendChild(item);
    });

    _wrap(_drop);
  }

  function _dropStyle() {
    return 'position:absolute;z-index:2000;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);max-height:200px;overflow-y:auto;min-width:100%;top:100%;left:0;';
  }

  function _wrap(drop) {
    let wrap = nameInput.parentElement;
    if (wrap.dataset.empSearch !== '1') {
      const newWrap = document.createElement('div');
      newWrap.style.cssText = 'position:relative;';
      newWrap.dataset.empSearch = '1';
      nameInput.parentNode.insertBefore(newWrap, nameInput);
      newWrap.appendChild(nameInput);
      wrap = newWrap;
    }
    wrap.appendChild(drop);
  }

  nameInput.addEventListener('input', () => {
    clearTimeout(_timer);
    const q = nameInput.value.trim();
    if (q.length < 2) { _closeDrop(); return; }
    _timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/erp/empleados?q=${encodeURIComponent(q)}`);
        const rows = await res.json();
        _openDrop(rows);
      } catch { _closeDrop(); }
    }, 250);
  });

  nameInput.addEventListener('blur', () => setTimeout(_closeDrop, 150));

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeDrop();
  });
}
