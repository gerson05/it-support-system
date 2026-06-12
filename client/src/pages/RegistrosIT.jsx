import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

const TIPO_LABEL = { requerimiento: 'Requerimiento', incidencia: 'Incidencia', despacho: 'Despacho' };
const TIPO_BADGE = { requerimiento: 'badge-en_progreso', incidencia: 'badge-alta', despacho: 'badge-en_espera' };

export default function RegistrosIT() {
  const [registros, setRegistros] = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [tipo, setTipo]           = useState('');
  const [desde, setDesde]         = useState('');
  const [hasta, setHasta]         = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (search) params.set('search', search);
      if (tipo)   params.set('tipo', tipo);
      if (desde)  params.set('desde', desde);
      if (hasta)  params.set('hasta', hasta);
      const res = await fetchJson(`/api/registros-it?${params.toString()}`);
      setRegistros(res.registros || []);
      setTotal(res.total || 0);
    } catch { setRegistros([]); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Registros IT</h2>
          <p>Historial unificado de requerimientos, incidencias y despachos.</p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={load}>Actualizar</button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-control" style={{ flex: 1, minWidth: 200 }} placeholder="Buscar nombre, número, sede…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ width: 'auto' }} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="requerimiento">Requerimientos</option>
            <option value="incidencia">Incidencias</option>
            <option value="despacho">Despachos</option>
          </select>
          <input className="form-control" style={{ width: 140 }} type="date" value={desde} onChange={e => setDesde(e.target.value)} title="Desde" />
          <input className="form-control" style={{ width: 140 }} type="date" value={hasta} onChange={e => setHasta(e.target.value)} title="Hasta" />
          <button className="btn btn-primary btn-small" onClick={load}>Filtrar</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : registros.length === 0 ? (
          <div className="empty-state"><p>No se encontraron registros.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Nombre / Destinatario</th>
                  <th>Sede</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={`${r.tipo}-${r.id}`}
                    style={{ cursor: r.tipo !== 'despacho' ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (r.tipo === 'requerimiento' || r.tipo === 'incidencia') window.location.hash = `#tech-request/${r.id}`;
                    }}
                  >
                    <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{r.numero || '—'}</td>
                    <td><span className={`badge ${TIPO_BADGE[r.tipo] || ''}`}>{TIPO_LABEL[r.tipo] || r.tipo}</span></td>
                    <td>{r.nombre}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{r.sede || '—'}</td>
                    <td>{r.estado ? <span className={`badge badge-${r.estado}`}>{r.estado}</span> : '—'}</td>
                    <td>{r.prioridad ? <span className={`badge badge-${r.prioridad}`}>{r.prioridad}</span> : '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>
              {total} registros totales
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
