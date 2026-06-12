import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import Scanner from './Scanner';

export default function InventarioApp() {
  const [activeTab, setActiveTab] = useState('equipos');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ equipos: 0, celulares: 0, ups: 0 });
  const [loading, setLoading] = useState(false);
  const [modalRow, setModalRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState(null);
  const [placaVal, setPlacaVal] = useState('');

  useEffect(() => { loadTable(); loadCounts(); }, [activeTab, page, search, area]);

  async function loadTable() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (area) params.set('area', area);
      const res = await fetchJson(`/api/inventario/${activeTab}?${params.toString()}`);
      const data = res;
      const list = activeTab === 'equipos' ? data.equipos : activeTab === 'celulares' ? data.celulares : data.ups;
      setRows(list || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      setRows([]);
      setTotalPages(1);
    } finally { setLoading(false); }
  }

  async function loadCounts() {
    try {
      const r1 = await fetchJson(`/api/inventario/equipos?page=1&limit=1`);
      const r2 = await fetchJson(`/api/inventario/celulares?page=1&limit=1`);
      const r3 = await fetchJson(`/api/inventario/ups?page=1&limit=1`);
      setCounts({ equipos: r1.total||0, celulares: r2.total||0, ups: r3.total||0 });
    } catch (e) {}
  }

  function openForm(row=null) { setModalRow(row); setModalOpen(true); setPlacaVal(row?.placa||row?.imei||row?.serial||''); }
  function closeForm() { setModalRow(null); setModalOpen(false); setPlacaVal(''); }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await fetchJson(`/api/inventario/${activeTab}/${id}`, { method: 'DELETE' });
      loadTable(); loadCounts();
      alert('Registro eliminado.');
    } catch (e) { alert(e.message || 'Error al eliminar.'); }
  }

  async function submitForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    try {
      const url = modalRow ? `/api/inventario/${activeTab}/${modalRow.id}` : `/api/inventario/${activeTab}`;
      const method = modalRow ? 'PUT' : 'POST';
      await fetchJson(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
      closeForm(); loadTable(); loadCounts();
      alert(modalRow ? 'Registro actualizado.' : 'Registro creado.');
    } catch (err) { alert(err.message || 'Error al guardar.'); }
  }

  function openScanner(targetName) { setScanTarget(targetName); setScannerOpen(true); }
  function onScanned(val) {
    if (!scanTarget) return;
    if (scanTarget === 'placa') setPlacaVal(val);
    setScannerOpen(false);
  }

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Inventario TI</h2>
          <p style={{color:'#94a3b8'}}>Gestión de equipos, celulares y dispositivos.</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>openForm(null)} className="btn btn-primary">＋ Registrar equipo</button>
        </div>
      </div>

      <div style={{display:'flex',gap:0,marginTop:12,borderBottom:'2px solid var(--border)'}}>
        <button onClick={()=>{ setActiveTab('equipos'); setPage(1); }} className={activeTab === 'equipos' ? 'tab-btn tab-active' : 'tab-btn'}>{`Equipos (${counts.equipos})`}</button>
        <button onClick={()=>{ setActiveTab('celulares'); setPage(1); }} className={activeTab === 'celulares' ? 'tab-btn tab-active' : 'tab-btn'}>{`Celulares (${counts.celulares})`}</button>
        <button onClick={()=>{ setActiveTab('ups'); setPage(1); }} className={activeTab === 'ups' ? 'tab-btn tab-active' : 'tab-btn'}>{`UPS (${counts.ups})`}</button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center'}}>
        <input className="form-control" placeholder="Buscar" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
        <input className="form-control" style={{width:160}} placeholder="Área" value={area} onChange={e=>{ setArea(e.target.value); setPage(1); }} />
        <button onClick={()=>{ setSearch(''); setArea(''); setPage(1); }} className="btn btn-ghost btn-small">Limpiar</button>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          rows.length === 0 ? <div style={{padding:40,color:'#94a3b8'}}>Sin registros.</div> : (
            <div className="card" style={{marginTop:12,padding:0,overflow:'hidden'}}><div className="table-container">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr><th>Id</th><th>Clave</th><th>Nombre</th><th>Área</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{padding:8}}>{r.id}</td>
                    <td style={{padding:8,fontFamily:'monospace'}}>{r.placa||r.imei||r.serial}</td>
                    <td style={{padding:8}}>{r.nombre_equipo||r.nombre_completo||r.marca}</td>
                    <td style={{padding:8}}>{r.area}</td>
                    <td style={{padding:8}}>
                      <button onClick={()=>openForm(r)} className="btn btn-secondary btn-small">Editar</button>
                      <button onClick={()=>handleDelete(r.id)} className="btn btn-danger btn-small" style={{marginLeft:4}}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div></div>
          )
        )}
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
        <button onClick={()=>setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn btn-secondary btn-small">‹</button>
        <div>Pag {page} / {totalPages}</div>
        <button onClick={()=>setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="btn btn-secondary btn-small">›</button>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{modalRow ? 'Editar registro' : 'Nuevo registro'}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form id="inv-form" onSubmit={submitForm}>
              <div className="modal-form-grid">
                <div>
                  <label>Placa / IMEI / Serial</label>
                  <div style={{display:'flex',gap:8}}>
                    <input className="form-control" name="placa" value={placaVal} onChange={e=>setPlacaVal(e.target.value)} />
                    <button type="button" className="btn btn-secondary btn-small" onClick={()=>openScanner('placa')}>📷</button>
                  </div>
                </div>
                <div>
                  <label>Nombre</label>
                  <input className="form-control" name="nombre_equipo" defaultValue={modalRow?.nombre_equipo||modalRow?.nombre_completo||''} />
                </div>
                <div>
                  <label>Marca</label>
                  <input className="form-control" name="marca" defaultValue={modalRow?.marca||''} />
                </div>
                <div>
                  <label>Área</label>
                  <input className="form-control" name="area" defaultValue={modalRow?.area||''} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Scanner open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={onScanned} />
    </div>
  );
}
