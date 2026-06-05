import { useEffect } from 'react';

export default function useSSE() {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/events');

    const forward = (name) => (e) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(new CustomEvent(`sse:${name}`, { detail: data }));
      } catch (err) {
        console.warn('SSE parse error for', name, err);
      }
    };

    es.addEventListener('connected', () => console.log('[SSE] connected'));
    es.addEventListener('ticket-created', forward('ticket-created'));
    es.addEventListener('ticket-updated', forward('ticket-updated'));
    es.addEventListener('tech-request-created', forward('tech-request-created'));
    es.addEventListener('tech-request-updated', forward('tech-request-updated'));
    es.addEventListener('whatsapp-status', forward('whatsapp-status'));
    es.addEventListener('ticket-message', forward('ticket-message'));

    es.onerror = (err) => { console.warn('[SSE] error', err); };

    return () => {
      es.close();
    };
  }, []);
}
