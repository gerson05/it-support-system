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

  function openForm(row=null) { setModalRow(row); setModalOpen(true); }
  function closeForm() { setModalRow(null); setModalOpen(false); }

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
  function onScanned(val) { if (!scanTarget) return; const el = document.querySelector(`#inv-form [name=\"${scanTarget}\"]`); if (el) el.value = val; setScannerOpen(false); }

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Inventario TI</h2>
          <p style={{color:'#94a3b8'}}>Gestión de equipos, celulares y dispositivos.</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>openForm(null)}>＋ Registrar equipo</button>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={()=>{ setActiveTab('equipos'); setPage(1); }}>{`Equipos (${counts.equipos})`}</button>
        <button onClick={()=>{ setActiveTab('celulares'); setPage(1); }}>{`Celulares (${counts.celulares})`}</button>
        <button onClick={()=>{ setActiveTab('ups'); setPage(1); }}>{`UPS (${counts.ups})`}</button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center'}}>
        <input placeholder="Buscar" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
        <input placeholder="Área" value={area} onChange={e=>{ setArea(e.target.value); setPage(1); }} />
        <button onClick={()=>{ setSearch(''); setArea(''); setPage(1); }}>Limpiar</button>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          rows.length === 0 ? <div style={{padding:40,color:'#94a3b8'}}>Sin registros.</div> : (
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
                      <button onClick={()=>openForm(r)}>Editar</button>
                      <button onClick={()=>handleDelete(r.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
        <button onClick={()=>setPage(p => Math.max(1,p-1))} disabled={page===1}>‹</button>
        <div>Pag {page} / {totalPages}</div>
        <button onClick={()=>setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
      </div>

      {modalOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#0b1220',padding:16,borderRadius:8,width:'90%',maxWidth:680}}>
            <h3 style={{marginTop:0}}>{modalRow ? 'Editar' : 'Nuevo registro'}</h3>
            <form id="inv-form" onSubmit={submitForm}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>
                  <label>Placa / IMEI / Serial</label>
                  <div style={{display:'flex',gap:8}}>
                    <input name="placa" defaultValue={modalRow?.placa||modalRow?.imei||modalRow?.serial||''} />
                    <button type="button" onClick={()=>openScanner('placa')}>📷</button>
                  </div>
                </div>
                <div>
                  <label>Nombre</label>
                  <input name="nombre_equipo" defaultValue={modalRow?.nombre_equipo||modalRow?.nombre_completo||''} />
                </div>
                <div>
                  <label>Marca</label>
                  <input name="marca" defaultValue={modalRow?.marca||''} />
                </div>
                <div>
                  <label>Área</label>
                  <input name="area" defaultValue={modalRow?.area||''} />
                </div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
                <button type="button" onClick={closeForm}>Cancelar</button>
                <button type="submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Scanner open={scannerOpen} onClose={()=>setScannerOpen(false)} onDetected={onScanned} />
    </div>
  );
}
