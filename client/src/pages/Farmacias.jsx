import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';

export default function Farmacias() {
  const [list, setList] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    try { const data = await fetchJson('/api/farmacias'); setList(data || []); } catch (e) {}
  }
  return (
    <div style={{padding:20}}>
      <h2>Farmacias</h2>
      <ul>{list.map(f => <li key={f.id}>{f.name || f.nombre || f.id}</li>)}</ul>
    </div>
  );
}
