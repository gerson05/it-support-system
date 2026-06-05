import { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import { copyToClipboard } from '../utils/ui';

export default function useWhatsAppMonitor(pollInterval = 3000) {
  const [statusData, setStatusData] = useState({ status: 'disconnected', connected: false });
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const res = await fetchJson('/api/whatsapp/status');
        if (!mounted) return;
        setStatusData(res);
      } catch (e) { /* ignore */ }
    }

    poll();
    timerRef.current = setInterval(poll, pollInterval);
    return () => { mounted = false; clearInterval(timerRef.current); };
  }, [pollInterval]);

  async function connect() {
    try {
      await fetchJson('/api/whatsapp/connect', { method: 'POST' });
      return true;
    } catch (e) { return false; }
  }

  async function copyQr(text) {
    try { await copyToClipboard(text); return true; } catch (e) { return false; }
  }

  return { ...statusData, connect, copyQr };
}
