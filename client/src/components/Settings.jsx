import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchJson('/api/settings');
      setSettings(res || {});
    } catch (err) { showToast('Error cargando settings', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{padding:20}}>
      <h2>Settings</h2>
      {loading ? <div>Cargando…</div> : (
        <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(settings, null, 2)}</pre>
      )}
    </div>
  );
}

