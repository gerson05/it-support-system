import { useEffect } from 'react';

export default function useModalScrollLock() {
  useEffect(() => {
    let _lockedScrollY = 0;
    let _lockCount = 0;

    function lock() {
      if (_lockCount++ > 0) return;
      _lockedScrollY = window.scrollY;
      document.body.style.top = `-${_lockedScrollY}px`;
      document.body.classList.add('modal-open');
    }
    function unlock() {
      if (--_lockCount > 0) return;
      _lockCount = 0;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, _lockedScrollY);
    }

    function isVisible(el) {
      if (!el) return false;
      const s = el.style.display;
      if (s === 'none') return false;
      if (s === 'flex' || s === 'block') return true;
      if (el.classList.contains('open')) return true;
      return !s && el.offsetHeight > 0;
    }

    const SELECTORS = [
      '.modal-overlay',
      '#tr-modal-overlay',
      '#faqs-modal-overlay',
      '#user-modal',
      '#acta-modal-overlay',
      '#smart-scanner-overlay',
      '#scanner-overlay',
    ].join(',');

    let _wasOpen = false;
    function syncLock() {
      const isOpen = !![...document.querySelectorAll(SELECTORS)].some(isVisible);
      if (isOpen && !_wasOpen) { lock(); }
      else if (!isOpen && _wasOpen) { unlock(); }
      _wasOpen = isOpen;
    }

    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

    // initial sync
    syncLock();

    return () => {
      observer.disconnect();
      // ensure unlocked
      try { document.body.classList.remove('modal-open'); document.body.style.top = ''; } catch(e){}
    };
  }, []);
}
