import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

function StatCard({ value, label, icon, color, bg, subtitle='' }) {
  return (
    <div className="card" style={{padding:20,cursor:'default',borderColor:`${color}22`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div style={{width:38,height:38,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:color}} dangerouslySetInnerHTML={{__html:icon}} />
      </div>
      <div style={{fontSize:28,fontWeight:700,letterSpacing:-1,color:'var(--text)',lineHeight:1}}>{value}</div>
      <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,color:'var(--text-3)',marginTop:6}}>{label}</div>
      {subtitle ? <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>{subtitle}</div> : null}
    </div>
  );
}

function SLACard({ count, label, sublabel, ok, color, iconHtml }) {
  const isOk = ok || count === 0;
  const c = isOk ? '#10b981' : color;
  const bg = isOk ? 'rgba(16,185,129,.1)' : `${color}18`;
  return (
    <div className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${c}`}}>
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:42,height:42,flexShrink:0,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:c}} dangerouslySetInnerHTML={{__html: isOk ? iconHtml : iconHtml}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:26,fontWeight:700,color:c,lineHeight:1,marginBottom:4}}>{count}</div>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text-2)'}}>{label}</div>
          <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{sublabel}</div>
        </div>
        <div style={{width:6,height:36,borderRadius:3,background:c,opacity:.4,flexShrink:0}} />
      </div>
    </div>
  );
}

const IC = {
  inbox: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  ticket: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>`,
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [byArea, setByArea] = useState([]);
  const [byPriority, setByPriority] = useState([]);
  const [trend, setTrend] = useState([]);
  const [sla, setSla] = useState({ breached:0, warning:0 });
  const [recent, setRecent] = useState([]);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    let mounted = true;
    let interval = null;

    async function load() {
      try {
        setLoading(true);
        const [metrics, trendResp] = await Promise.all([
          fetchJson('/api/metrics'),
          fetch('/api/metrics/trend').then(r=>r.json()).catch(()=>({ trend: [], sla:{ breached:0, warning:0 }})),
        ]);

        if (!mounted) return;
        setSummary(metrics.summary || {});
        setByArea(metrics.by_area || []);
        setByPriority(metrics.by_priority || []);
        setRecent(metrics.recent_tickets || []);
        setTrend(trendResp.trend || []);
        setSla(trendResp.sla || { breached:0, warning:0 });
      } catch (err) {
        console.error('dashboard load', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    interval = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(interval); if (chartInstance.current) { try{ chartInstance.current.destroy(); }catch(e){} } };
  }, []);

  useEffect(() => {
    // dynamic import Chart.js only if trend data exists
    let cancelled = false;
    async function makeChart() {
      if (!trend || trend.length === 0) return;
      try {
        const Chart = (await import('chart.js/auto')).default;
        if (cancelled) return;
        const ctx = chartRef.current?.getContext('2d');
        if (!ctx) return;
        if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: { labels: trend.map(d=>d.day), datasets:[{ data: trend.map(d=>d.count), fill:true, borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,.15)', tension:0.4 }] },
          options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
        });
      } catch (e) {
        console.debug('Chart import failed', e);
      }
    }
    makeChart();
    return ()=>{ cancelled=true; };
  }, [trend]);

  const PRIO = [
    { key:'critica', label:'Crítica', color:'#ef4444', bg:'rgba(239,68,68,.1)' },
    { key:'alta',    label:'Alta',    color:'#f97316', bg:'rgba(249,115,22,.1)' },
    { key:'media',   label:'Media',   color:'#f59e0b', bg:'rgba(245,158,11,.1)' },
    { key:'baja',    label:'Baja',    color:'#10b981', bg:'rgba(16,185,129,.1)' },
  ];

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,letterSpacing:-0.4,marginBottom:4}}>Dashboard de Soporte IT</h2>
          <p style={{color:'var(--text-3)',fontSize:13}}>Métricas en tiempo real · actualiza cada 30 segundos</p>
        </div>
        <div id="last-updated" style={{fontSize:11,color:'var(--text-3)'}}>{/* updated via effect */}</div>
      </div>

      {loading ? <div>Loading…</div> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
            <StatCard value={summary?.open_tickets ?? 0} label="Abiertos" icon={IC.inbox} color="#6366f1" bg={'rgba(99,102,241,.15)'} />
            <StatCard value={summary?.in_progress_tickets ?? 0} label="En Progreso" icon={IC.inbox} color="#f97316" bg={'rgba(249,115,22,.15)'} />
            <StatCard value={summary?.resolved_today ?? 0} label="Resueltos Hoy" icon={IC.inbox} color="#10b981" bg={'rgba(16,185,129,.15)'} />
            <StatCard value={`${summary?.autoservice_rate ?? 0}%`} label="Tasa Autoservicio" icon={IC.inbox} color="#8b5cf6" bg={'rgba(139,92,246,.15)'} subtitle="Resueltos por el bot" />
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:16}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:7,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,color:'var(--text-3)',marginBottom:18}}>Tickets por Área</div>
              <div>
                {byArea.length === 0 ? <div style={{color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'20px 0'}}>Sin datos de área.</div> : (
                  byArea.map(item => {
                    const max = Math.max(...byArea.map(a=>a.count),1);
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.area} style={{marginBottom:13}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                          <span style={{fontSize:12,color:'var(--text-2)',fontWeight:500}}>{item.area_label}</span>
                          <span style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{item.count}</span>
                        </div>
                        <div style={{height:5,background:'var(--surface-3)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:99,transition:'width .4s ease'}} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div style={{display:'flex',alignItems:'center',gap:7,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,color:'var(--text-3)',marginBottom:18}}>Distribución por Prioridad</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {PRIO.map(p => (
                  <div key={p.key} style={{background:p.bg,border:`1px solid ${p.color}22`,borderRadius:10,padding:14}}>
                    <div style={{fontSize:24,fontWeight:700,color:p.color,lineHeight:1,marginBottom:5}}>{(byPriority.find(x=>x.priority?.toLowerCase()===p.key)?.count) || 0}</div>
                    <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,color:p.color,opacity:.8}}>{p.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:7,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,color:'var(--text-3)',marginBottom:18}}>Tickets creados — últimos 7 días</div>
            <div style={{position:'relative',height:190}}>
              <canvas ref={chartRef} id="trend-chart" />
            </div>
          </div>

          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:7,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:.6,color:'var(--text-3)'}} dangerouslySetInnerHTML={{__html:IC.ticket}} />
              <button className="btn btn-secondary btn-small" onClick={()=> window.location.hash='#tickets'}>Ver todos →</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>ID</th><th>Área</th><th>Asunto / Solicitante</th><th>Prioridad</th><th>Estado</th><th>Asignado</th><th>Actualizado</th></tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan={7} style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)'}}>Sin tickets recientes.</td></tr>
                  ) : (
                    recent.map(t => (
                      <tr key={t.id} style={{cursor:'pointer'}} onClick={()=> window.location.hash = `#ticket/${t.id}`}>
                        <td style={{padding:8,fontFamily:'monospace'}}>{t.ticket_number}</td>
                        <td style={{padding:8}}>{t.area}</td>
                        <td style={{padding:8}}>{t.title || (t.description||'').slice(0,80)}</td>
                        <td style={{padding:8}}>{t.priority}</td>
                        <td style={{padding:8}}>{t.status}</td>
                        <td style={{padding:8}}>{t.agent_name||'Sin asignar'}</td>
                        <td style={{padding:8}}>{formatDate(t.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
