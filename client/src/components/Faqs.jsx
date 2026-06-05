import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

const AREA_OPTIONS = [
  { value: 'general',         label: 'General / IT'    },
  { value: 'cartera',         label: 'Cartera'         },
  { value: 'compra',          label: 'Compra'          },
  { value: 'gestion_humana',  label: 'Gestión Humana'  },
  { value: 'pqrs',            label: 'PQRS'            },
  { value: 'contabilidad',    label: 'Contabilidad'    },
  { value: 'farmacia',        label: 'Farmacia'        },
  { value: 'cuentas_medicas', label: 'Cuentas Médicas' },
];
const AREA_LABEL = Object.fromEntries(AREA_OPTIONS.map(a => [a.value, a.label]));

const EMPTY_MODAL = { open: false, faq: null };

export default function Faqs() {
  const [data, setData]           = useState({ system: [], custom: [] });
  const [filterArea, setFilterArea] = useState('');
  const [modal, setModal]         = useState(EMPTY_MODAL);
  const [form, setForm]           = useState({ area: 'general', title: '', keywords: '', solution: '' });
  const [saving, setSaving]       = useState(false);
  const [sysOpen, setSysOpen]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetchJson('/api/faqs');
      setData(res);
    } catch {
      showToast('No se pudo cargar la base de conocimiento.', 'error');
    }
  }

  function openModal(faq = null) {
    setForm({
      area:     faq?.area     || 'general',
      title:    faq?.title    || '',
      keywords: Array.isArray(faq?.keywords) ? faq.keywords.join(', ') : '',
      solution: faq?.solution || '',
    });
    setModal({ open: true, faq });
  }

  function closeModal() { setModal(EMPTY_MODAL); }

  async function save() {
    if (!form.title.trim() || !form.solution.trim()) {
      showToast('Título y solución son requeridos.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body   = JSON.stringify({ area: form.area, title: form.title.trim(), keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean), solution: form.solution.trim() });
      const id     = modal.faq?.id;
      await fetchJson(id ? `/api/faqs/${id}` : '/api/faqs', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body });
      showToast(id ? 'FAQ actualizada.' : 'FAQ creada.', 'success');
      closeModal();
      await load();
    } catch (e) {
      showToast(e.message || 'Error al guardar la FAQ.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFaq(id) {
    if (!confirm('¿Eliminar esta FAQ? Esta acción no se puede deshacer.')) return;
    try {
      await fetchJson(`/api/faqs/${id}`, { method: 'DELETE' });
      showToast('FAQ eliminada.', 'success');
      await load();
    } catch {
      showToast('Error al eliminar la FAQ.', 'error');
    }
  }

  const allItems   = [...data.system, ...data.custom];
  const totalHits  = allItems.reduce((a, f) => a + (f.hits || 0), 0);
  const resolved   = allItems.reduce((a, f) => a + (f.resolved || 0), 0);
  const rate       = totalHits > 0 ? Math.round((resolved / totalHits) * 100) : 0;

  const customFiltered = filterArea
    ? data.custom.filter(f => f.area === filterArea || f.area === 'general')
    : data.custom;

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:'-.4px', marginBottom:4 }}>Base de Conocimiento</h2>
          <p style={{ color:'var(--text-3)', fontSize:13 }}>Gestiona las respuestas automáticas personalizadas del bot</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>Nueva FAQ</button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:16 }}>
        {[
          { val: data.system.length,  label: 'FAQs del Sistema'     },
          { val: data.custom.length,  label: 'FAQs Personalizadas', color: '#a5b4fc' },
          { val: totalHits,           label: 'Consultas Totales'     },
          { val: `${rate}%`,          label: 'Tasa de Resolución',   color: rate >= 50 ? '#22c55e' : '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'16px 20px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FAQs personalizadas */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text-3)' }}>FAQs Personalizadas</div>
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            style={{ padding:'8px 12px', background:'#0f0f22', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#e8e8f0', fontSize:13 }}
          >
            <option value="">Todas las áreas</option>
            {AREA_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {customFiltered.length === 0 ? (
          <p style={{ color:'var(--text-muted)', fontSize:13, padding:'12px 0' }}>
            {filterArea ? 'No hay FAQs para esta área.' : 'Aún no hay FAQs personalizadas. Crea la primera con el botón de arriba.'}
          </p>
        ) : (
          <>
            <FaqTableHeader cols={['Título / Área','Consultas','Resueltos','']} widths={['1fr','110px','90px','80px']} />
            {customFiltered.map(f => <FaqRow key={f.id} faq={f} onEdit={() => openModal(f)} onDelete={() => deleteFaq(f.id)} editable />)}
          </>
        )}
      </div>

      {/* FAQs sistema */}
      <div className="card">
        <details open={sysOpen} onToggle={e => setSysOpen(e.target.open)}>
          <summary style={{ cursor:'pointer', fontSize:14, fontWeight:600, color:'var(--text-primary)', padding:'4px 0' }}>
            🔒 FAQs del Sistema ({data.system.length} entradas, solo lectura)
          </summary>
          {sysOpen && (
            <div style={{ marginTop:16 }}>
              {data.system.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:13 }}>No hay FAQs del sistema.</p>
              ) : (
                <>
                  <FaqTableHeader cols={['Título / Área','Consultas','Resueltos']} widths={['1fr','110px','90px']} />
                  {data.system.map(f => <FaqRow key={f.id} faq={f} editable={false} />)}
                </>
              )}
            </div>
          )}
        </details>
      </div>

      {/* Modal crear/editar */}
      {modal.open && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background:'#1e1e38', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:28, width:'min(640px,96vw)', margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontSize:16 }}>{modal.faq ? 'Editar FAQ' : 'Nueva FAQ Personalizada'}</h3>
              <button onClick={closeModal} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <ModalField label="Área">
              <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} style={INPUT_STYLE}>
                {AREA_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </ModalField>

            <ModalField label={<>Título / Pregunta <span style={{ color:'#ef4444' }}>*</span></>}>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Cómo restablecer la contraseña del portal de nómina" style={INPUT_STYLE} />
            </ModalField>

            <ModalField label="Palabras clave (separadas por coma)">
              <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="contraseña, clave, nomina, restablecer" style={INPUT_STYLE} />
            </ModalField>

            <ModalField label={<>Solución / Respuesta <span style={{ color:'#ef4444' }}>*</span></>}>
              <textarea value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))} placeholder="Escribe los pasos numerados que el empleado debe seguir..." style={{ ...INPUT_STYLE, minHeight:120, resize:'vertical', fontFamily:'inherit' }} />
            </ModalField>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar FAQ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_STYLE = { width:'100%', padding:'10px 14px', background:'#0f0f22', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#e8e8f0', fontSize:14, boxSizing:'border-box' };

function ModalField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
}

function FaqTableHeader({ cols, widths }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns: widths.join(' '), gap:8, padding:'8px 0', fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
      {cols.map(c => <div key={c}>{c}</div>)}
    </div>
  );
}

function FaqRow({ faq, onEdit, onDelete, editable }) {
  const rate      = faq.hits > 0 ? Math.round((faq.resolved / faq.hits) * 100) : null;
  const rateColor = rate === null ? 'var(--text-muted)' : rate >= 60 ? '#22c55e' : rate >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display:'grid', gridTemplateColumns: editable ? '1fr 110px 90px 80px' : '1fr 110px 90px', gap:8, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,.05)', alignItems:'start' }}>
      <div>
        <div style={{ fontWeight:600, fontSize:14 }}>{faq.title}</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
          {AREA_LABEL[faq.area] || faq.area}{' '}
          <span style={{ fontSize:10, background: editable ? 'rgba(102,126,234,.2)' : 'rgba(255,255,255,.07)', border: `1px solid ${editable ? 'rgba(102,126,234,.3)' : 'rgba(255,255,255,.1)'}`, borderRadius:4, padding:'2px 6px', color: editable ? '#a5b4fc' : 'var(--text-muted)' }}>
            {editable ? 'personalizada' : 'sistema'}
          </span>
        </div>
      </div>
      <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', paddingTop:4 }}>{faq.hits || 0} veces</div>
      <div style={{ fontSize:12, color: rateColor, paddingTop:4, textAlign:'center' }}>{rate !== null ? `${rate}%` : '—'}</div>
      {editable && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={onEdit}   style={{ padding:'6px 10px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, background:'rgba(102,126,234,.2)', color:'#667eea' }}>✏ Editar</button>
          <button onClick={onDelete} style={{ padding:'6px 10px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, background:'rgba(239,68,68,.15)', color:'#ef4444' }}>Borrar</button>
        </div>
      )}
    </div>
  );
}
