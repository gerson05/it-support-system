import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';

export default function RegistrosIT() {
  const [items, setItems] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() { try { const d = await fetchJson('/api/registros'); setItems(d || []); } catch (e) {} }
  return (
    <div style={{padding:20}}>
      <h2>Registros IT</h2>
      <ul>{items.map(it => <li key={it.id}>{it.title || it.ref || it.id}</li>)}</ul>
    </div>
  );
}
