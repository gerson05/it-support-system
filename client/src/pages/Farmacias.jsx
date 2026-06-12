import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';

const Ico = ({ path, path2, size = 13 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0, verticalAlign: 'middle' }}>
    <path d={path} />{path2 && <path d={path2} />}
  </svg>
);

export default function Farmacias() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState({});   // { "Dpto/Muni": true }
  const [error, setError]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetchJson('/api/farmacias');
      setData(Array.isArray(res) ? res : []);
    } catch (e) {
      setError('No se pudo cargar el directorio. Verifica la conexión con Google Sheets.');
    } finally { setLoading(false); }
  }

  function toggle(key) { setOpen(o => ({ ...o, [key]: !o[key] })); }

  const q = search.toLowerCase().trim();

  const filtered = data.map(dept => {
    const munis = (dept.municipios || []).map(m => {
      const farms = (m.farmacias || []).filter(f => {
        if (!q) return true;
        return [f.nombre, f.direccion, f.telefono, m.nombre, dept.nombre]
          .some(v => (v || '').toLowerCase().includes(q));
      });
      return { ...m, farmacias: farms };
    }).filter(m => m.farmacias.length > 0 || (!q && (m.farmacias || []).length > 0));
    return { ...dept, municipios: munis };
  }).filter(d => {
    if (!q) return true;
    return (d.nombre || '').toLowerCase().includes(q) || d.municipios.length > 0;
  });

  if (loading) return (
    <div style={{ padding: 20 }}>
      <div className="loading-spinner"><div className="spinner" /></div>
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Directorio de Farmacias</h2>
          <p>Red FOMAG — puntos de atención farmacéutica por departamento.</p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={load}>Actualizar</button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '3px solid var(--danger)', padding: '12px 16px', marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <input
          className="form-control"
          placeholder="Buscar por departamento, municipio, farmacia, dirección o teléfono…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><p>Sin resultados para "{search}".</p></div>
      ) : (
        filtered.map(dept => (
          <div key={dept.nombre} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(99,102,241,.08)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => toggle(dept.nombre)}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>{dept.nombre}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {(dept.municipios || []).length} municipio{dept.municipios?.length !== 1 ? 's' : ''} · {(dept.municipios || []).reduce((s, m) => s + (m.farmacias||[]).length, 0)} farmacias
                {' '}
                <span style={{ marginLeft: 8, color: 'var(--primary)' }}>{open[dept.nombre] ? '▲' : '▼'}</span>
              </span>
            </div>

            {open[dept.nombre] && (dept.municipios || []).map(muni => (
              <div key={muni.sheetRow || muni.nombre} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 10px 32px', background: 'var(--surface-2)', cursor: 'pointer' }}
                  onClick={() => toggle(`${dept.nombre}/${muni.nombre}`)}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{muni.nombre}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {(muni.farmacias || []).length} punto{muni.farmacias?.length !== 1 ? 's' : ''}
                    {' '}
                    <span style={{ color: 'var(--primary)' }}>{open[`${dept.nombre}/${muni.nombre}`] ? '▲' : '▼'}</span>
                  </span>
                </div>

                {open[`${dept.nombre}/${muni.nombre}`] && (muni.farmacias || []).map((f, i) => (
                  <div key={i} style={{ padding: '12px 20px 12px 48px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', gridColumn: '1 / -1', marginBottom: 4 }}>{f.nombre || '—'}</div>
                    {f.direccion && <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}><Ico path="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" path2="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /> {f.direccion}</div>}
                    {f.telefono  && <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}><Ico path="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.74a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /> {f.telefono}</div>}
                    {f.horario   && <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}><Ico path="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" path2="M12 6v6l4 2" /> {f.horario}</div>}
                    {f.correo    && <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}><Ico path="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" path2="M22 6l-10 7L2 6" /> {f.correo}</div>}
                    {f.mapsUrl   && <div style={{ gridColumn: '1 / -1', marginTop: 4 }}><a href={f.mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--primary)' }}>Ver en mapa →</a></div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
