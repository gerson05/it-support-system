import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function SedesAdmin() {
  const [grouped, setGrouped]       = useState({});
  const [search, setSearch]         = useState('');
  const [filterLetter, setFilter]   = useState('');
  const [showInactive, setShowInact]= useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [newCiudad, setNewCiudad]   = useState('');
  const [newPunto, setNewPunto]     = useState('');
  const [adding, setAdding]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetchJson('/api/sedes');
      setGrouped(res.grouped || {});
    } catch { showToast('Error al cargar sedes', 'error'); }
  }

  function openModal() { setNewCiudad(''); setNewPunto(''); setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  async function addSede(e) {
    e.preventDefault();
    if (!newCiudad.trim() || !newPunto.trim()) return;
    setAdding(true);
    try {
      await fetchJson('/api/sedes', { method: 'POST', body: JSON.stringify({ ciudad: newCiudad.trim().toUpperCase(), nombre_punto: newPunto.trim() }) });
      showToast('Punto agregado', 'success');
      closeModal();
      await load();
    } catch (e) { showToast(e.message || 'Error', 'error'); }
    finally { setAdding(false); }
  }

  async function toggleActivo(id, activo) {
    try {
      await fetchJson(`/api/sedes/${id}`, { method: 'PUT', body: JSON.stringify({ activo: activo ? 0 : 1 }) });
      await load();
    } catch { showToast('Error al actualizar', 'error'); }
  }

  async function deleteSede(id) {
    if (!confirm('¿Desactivar este punto? El bot dejará de mostrarlo.')) return;
    try {
      await fetchJson(`/api/sedes/${id}`, { method: 'DELETE' });
      showToast('Punto eliminado', 'success');
      await load();
    } catch { showToast('Error al eliminar', 'error'); }
  }

  const letters = [...new Set(Object.keys(grouped).map(c => c[0]))].sort();
  const q = search.toLowerCase().trim();

  const ciudades = Object.keys(grouped).sort().filter(ciudad => {
    if (filterLetter && ciudad[0] !== filterLetter) return false;
    if (!q) return true;
    if (ciudad.toLowerCase().includes(q)) return true;
    return grouped[ciudad].some(p => p.nombre_punto.toLowerCase().includes(q));
  });

  let totalPuntos = 0;
  ciudades.forEach(c => {
    const pts = grouped[c].filter(p => showInactive ? true : p.activo);
    totalPuntos += pts.length;
  });

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Red de Puntos</h2>
          <p>Administra ciudades y puntos de atención disponibles en el bot de WhatsApp.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>＋ Nuevo punto</button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar ciudad o punto…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={filterLetter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="">Todas las letras</option>
            {letters.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInact(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Mostrar inactivos
          </label>
          <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {totalPuntos} punto{totalPuntos !== 1 ? 's' : ''} · {ciudades.length} ciudades
          </span>
        </div>
      </div>


      {ciudades.length === 0 ? (
        <div className="empty-state"><p>No se encontraron resultados.</p></div>
      ) : (
        ciudades.map(ciudad => {
          let puntos = grouped[ciudad];
          if (!showInactive) puntos = puntos.filter(p => p.activo);
          if (q && !ciudad.toLowerCase().includes(q)) {
            puntos = puntos.filter(p => p.nombre_punto.toLowerCase().includes(q));
          }
          if (!puntos.length) return null;
          return (
            <div key={ciudad} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: 'rgba(99,102,241,.08)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{ciudad}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{puntos.length} punto{puntos.length !== 1 ? 's' : ''}</span>
              </div>
              {puntos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)', opacity: p.activo ? 1 : 0.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: p.activo ? 'var(--success)' : '#6b7280' }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nombre_punto}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-small" onClick={() => toggleActivo(p.id, p.activo)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="btn btn-danger btn-small" onClick={() => deleteSede(p.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box modal-box-sm">
            <div className="modal-header">
              <h3>Nuevo punto de atención</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={addSede}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Ciudad</label>
                  <input
                    className="form-control"
                    placeholder="Ej: CALI, BOGOTÁ…"
                    value={newCiudad}
                    onChange={e => setNewCiudad(e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Nombre del punto</label>
                  <input
                    className="form-control"
                    placeholder="Ej: MI FARMACIA - CENTRO"
                    value={newPunto}
                    onChange={e => setNewPunto(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Guardando…' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
