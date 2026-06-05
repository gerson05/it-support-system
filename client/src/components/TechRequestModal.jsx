import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function TechRequestModal({ open, onClose, defaultType = 'requerimiento', onSaved, record = null }) {
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState('');
  const [cedula, setCedula] = useState('');
  const [cargo, setCargo] = useState('');
  const [sede, setSede] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('media');
  const [items, setItems] = useState([{ equipment_name: '', quantity: 1, serial: '' }]);
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentSerial, setEquipmentSerial] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sedesCache, setSedesCache] = useState(null);
  const [sedeDropdownVisible, setSedeDropdownVisible] = useState(false);
  const sedeInputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);
  const [selectedSedeIndex, setSelectedSedeIndex] = useState(0);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    if (record) {
      setType(record.type || defaultType);
      setName(record.requester_name || '');
      setCedula(record.cedula || '');
      setCargo(record.cargo || '');
      setSede(record.sede || '');
      setDesc(record.description || '');
      setPriority(record.priority || 'media');
      if (record.items && record.items.length) setItems(record.items.map(i=>({ equipment_name:i.equipment_name, quantity:i.quantity, serial:i.serial||'' })));
      else { setItems([{ equipment_name:'', quantity:1, serial:'' }]); }
    } else if (open) {
      // reset
      setType(defaultType);
      setName(''); setCedula(''); setCargo(''); setSede(''); setDesc(''); setPriority('media'); setItems([{ equipment_name:'', quantity:1, serial:'' }]);
      setEquipmentName(''); setEquipmentSerial(''); setQty(1);
    }
  }, [record, open, defaultType]);

  function addItem() { setItems(it => [...it, { equipment_name:'', quantity:1, serial:'' }]); }
  function updateItem(idx, key, value) { setItems(it => { const copy = [...it]; copy[idx] = { ...copy[idx], [key]: value }; return copy; }); }
  function removeItem(idx) { setItems(it => (it.length>1 ? it.filter((_,i)=>i!==idx) : it)); }
  function dupItem(idx) { setItems(it => { const copy = [...it]; copy.splice(idx+1,0,{ ...copy[idx], quantity:1, serial:'' }); return copy; }); }

  async function handleSave() {
    if (!name.trim() || !cedula.trim() || !cargo.trim() || !sede.trim() || !desc.trim()) { showToast('Completa los campos obligatorios', 'warning'); return; }
    const body = { type, requester_name: name.trim(), cedula: cedula.trim(), cargo: cargo.trim(), sede: sede.trim(), description: desc.trim(), priority };
    if (type === 'requerimiento') body.items = items.filter(i=> (i.equipment_name||'').trim()).map(i=>({ equipment_name: i.equipment_name.trim(), quantity: parseInt(i.quantity)||1, serial: (i.serial||'').trim() || null }));
    else body.equipment_name = equipmentName.trim() || null, body.equipment_serial = equipmentSerial.trim() || null, body.quantity = parseInt(qty) || 1;

    setSaving(true);
    try {
      if (record && record.id) {
        await fetchJson(`/api/tech-requests/${record.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        const res = await fetchJson('/api/tech-requests', { method: 'POST', body: JSON.stringify(body) });
        // could show created id/res.request_number
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error');
    } finally { setSaving(false); }
  }

  // Sede dropdown positioning
  useEffect(() => {
    function position() {
      if (!sedeInputRef.current || !dropdownRef.current) return;
      const r = sedeInputRef.current.getBoundingClientRect();
      const dd = dropdownRef.current;
      dd.style.top = `${r.bottom + 6 + window.scrollY}px`;
      dd.style.left = `${r.left + window.scrollX}px`;
      dd.style.width = `${r.width}px`;
    }
    if (sedeDropdownVisible) position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [sedeDropdownVisible]);

  // Global '/' shortcut to focus sede input when modal is open
  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return;
      e.preventDefault();
      try { sedeInputRef.current?.focus(); sedeInputRef.current?.select(); } catch (err) {}
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  async function ensureSedes() {
    if (sedesCache) return sedesCache;
    try {
      const data = await fetchJson('/api/sedes');
      setSedesCache(data.grouped || data || {});
      return data.grouped || data || {};
    } catch (e) {
      setSedesCache({});
      return {};
    }
  }

  function getVisibleSedeItems(query) {
    const q = (query || sede || '').toLowerCase().trim();
    const out = [];
    Object.entries(sedesCache || {}).forEach(([ciudad, puntos]) => {
      puntos.filter(p => p.activo !== 0 && (!q || ciudad.toLowerCase().includes(q) || p.nombre_punto.toLowerCase().includes(q))).forEach(p => {
        out.push({ ciudad, p });
      });
    });
    return out;
  }

  async function handleSedeKeyDown(e) {
    if (!sedesCache) await ensureSedes();
    const items = getVisibleSedeItems(sede);
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSedeDropdownVisible(true);
      setSelectedSedeIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSedeIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (sedeDropdownVisible) {
        e.preventDefault();
        const sel = items[selectedSedeIndex] || items[0];
        if (sel) { setSede(sel.p.nombre_punto); setSedeDropdownVisible(false); }
      }
    } else if (e.key === 'Escape') {
      setSedeDropdownVisible(false);
    }
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,background:'rgba(0,0,0,.6)',zIndex:1200}} onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div style={{width:'min(760px,98vw)',background:'var(--surface)',borderRadius:12,padding:20,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0}}>{record ? 'Editar Solicitud' : 'Nueva Solicitud'}</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer'}}>Cerrar</button>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="radio" name="tr-type" checked={type==='requerimiento'} onChange={()=>setType('requerimiento')} /> Requerimiento
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="radio" name="tr-type" checked={type==='incidencia'} onChange={()=>setType('incidencia')} /> Incidencia
          </label>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <input placeholder="Nombre completo *" value={name} onChange={e=>setName(e.target.value)} />
          <input placeholder="Cédula *" value={cedula} onChange={e=>setCedula(e.target.value)} />
          <input placeholder="Cargo *" value={cargo} onChange={e=>setCargo(e.target.value)} />
          <div style={{position:'relative'}}>
            <input ref={sedeInputRef} placeholder="Sede *" value={sede} onKeyDown={handleSedeKeyDown} onChange={async e=>{ setSede(e.target.value); await ensureSedes(); setSedeDropdownVisible(true); setSelectedSedeIndex(0); }} onFocus={async ()=>{ await ensureSedes(); setSedeDropdownVisible(true); setSelectedSedeIndex(0); }} onBlur={()=>{ setTimeout(()=>setSedeDropdownVisible(false),160); }} />
          </div>
        </div>

        {type === 'requerimiento' ? (
          <div style={{marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <strong>Equipos solicitados</strong>
              <button onClick={addItem} className="btn btn-secondary">Agregar equipo</button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr 36px 36px',gap:8,marginBottom:8}}>
                <input value={it.equipment_name} onChange={e=>updateItem(idx,'equipment_name',e.target.value)} placeholder="Nombre del equipo *" />
                <input type="number" value={it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} style={{textAlign:'center'}} />
                <input value={it.serial} onChange={e=>updateItem(idx,'serial',e.target.value)} placeholder="Serial (opc.)" />
                <button onClick={()=>dupItem(idx)}>Dup</button>
                <button onClick={()=>removeItem(idx)}>X</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <input placeholder="Nombre / tipo de equipo" value={equipmentName} onChange={e=>setEquipmentName(e.target.value)} />
            <input placeholder="Serial / Inventario" value={equipmentSerial} onChange={e=>setEquipmentSerial(e.target.value)} />
            <div style={{gridColumn:'1 / -1',display:'flex',gap:8,alignItems:'center'}}>
              <label style={{display:'flex',alignItems:'center',gap:8}}>Cantidad <input type="number" value={qty} onChange={e=>setQty(e.target.value)} style={{width:80}} /></label>
            </div>
          </div>
        )}

        {sedeDropdownVisible && sedesCache && (() => {
          const items = getVisibleSedeItems(sede);
          if (!items.length) return (
            <div ref={dropdownRef} style={{position:'fixed',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.35)',maxHeight:220,overflowY:'auto',zIndex:1201}}>
              <div style={{padding:12,color:'#94a3b8'}}>No hay sedes registradas</div>
            </div>
          );
          let lastCiudad = null;
          return (
            <div ref={dropdownRef} style={{position:'fixed',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.35)',maxHeight:260,overflowY:'auto',zIndex:1201}}>
              {items.map((it, idx) => {
                const showHeader = it.ciudad !== lastCiudad;
                lastCiudad = it.ciudad;
                return (
                  <React.Fragment key={`${it.ciudad}-${it.p.id}`}>
                    {showHeader && <div style={{padding:'6px 10px',fontSize:12,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase'}}>{it.ciudad}</div>}
                    <div onMouseEnter={()=>setSelectedSedeIndex(idx)} onMouseDown={(ev)=>{ ev.preventDefault(); setSede(it.p.nombre_punto); setSedeDropdownVisible(false); }} style={{padding:8,cursor:'pointer',background: idx === selectedSedeIndex ? 'var(--surface-2)' : 'transparent'}}>
                      {it.p.nombre_punto}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}

        <div style={{marginTop:12,display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
          <textarea placeholder="Descripción *" value={desc} onChange={e=>setDesc(e.target.value)} rows={3} />
          <select value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="baja">🟢 Baja</option>
            <option value="media">🟡 Media</option>
            <option value="alta">🟠 Alta</option>
            <option value="critica">🔴 Crítica</option>
          </select>
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : (record ? 'Guardar Cambios' : 'Crear Solicitud')}</button>
        </div>
      </div>
    </div>
  );
}
