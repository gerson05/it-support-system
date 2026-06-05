import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import Scanner from './Scanner';

export default function RegistrarEquipo() {
  const token = window.location.pathname.split('/registrar/')[1]?.trim();
  const [status, setStatus] = useState('loading'); // loading, form, success, invalid
  const [tipo, setTipo] = useState('equipos');
  const [label, setLabel] = useState('Cargando…');
  const [uses, setUses] = useState('');
  const [formData, setFormData] = useState({});
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanTargetRef = useRef(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [detected, setDetected] = useState([]);
  const detectorRef = useRef(null);
  const [tesseractLoading, setTesseractLoading] = useState(false);
  const tesseractRef = useRef(null);

  useEffect(() => { init(); }, []);

  async function init() {
    if (!token) { setStatus('invalid'); return; }
    try {
      const data = await fetchJson(`/api/inventario/registro-status/${token}`);
      if (!data.valid) { setStatus('invalid'); return; }
      setTipo(data.tipo || 'equipos');
      setLabel(data.label || (data.tipo === 'equipos' ? '🖥 Equipos' : '📱 Celulares'));
      setUses(data.max_uses ? `${data.use_count}/${data.max_uses} usos` : `${data.use_count} registros`);
      setStatus('form');
    } catch (e) { setStatus('invalid'); }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setFormData(s => ({ ...s, [name]: value }));
  }

  function openScanFor(field) {
    scanTargetRef.current = field;
    setScannerOpen(true);
  }

  function openSmartScanner() {
    setDetected([]);
    setSmartOpen(true);
    startStream();
  }

  async function startStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Try to create BarcodeDetector if available
      try {
        if ('BarcodeDetector' in window) {
          const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
          detectorRef.current = new window.BarcodeDetector({ formats: supportedFormats });
        }
      } catch (e) {
        detectorRef.current = null;
      }

      requestAnimationFrame(detectLoop);
    } catch (err) {
      console.error('Camera start failed', err);
    }
  }

  function stopStream() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } catch (e) {}
  }

  async function detectLoop() {
    if (!smartOpen) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      requestAnimationFrame(detectLoop);
      return;
    }

    if (detectorRef.current) {
      try {
        const detections = await detectorRef.current.detect(video);
        if (detections && detections.length) {
          const values = detections.map(d => d.rawValue).filter(Boolean);
          if (values.length) setDetected(prev => Array.from(new Set([...values, ...prev])));
        }
      } catch (e) {
        // detector failed, ignore
      }
    } else {
      // Fallback: capture frame and run OCR if available
      if (!tesseractRef.current && !tesseractLoading) {
        // lazy load tesseract when needed
      }
    }

    requestAnimationFrame(detectLoop);
  }

  async function captureFrameAndOcr() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!tesseractRef.current) {
      setTesseractLoading(true);
      try {
        const Tesseract = await import('tesseract.js');
        tesseractRef.current = Tesseract;
      } catch (e) {
        console.error('Tesseract load failed', e);
      } finally { setTesseractLoading(false); }
    }
    if (tesseractRef.current) {
      try {
        const { data } = await tesseractRef.current.recognize(blob);
        const text = data?.text || '';
        const parsed = parseOcr(text);
        if (parsed) setDetected(prev => Array.from(new Set([parsed, ...prev])));
      } catch (e) {
        console.error('OCR failed', e);
      }
    }
  }

  function applyDetectedValue(val) {
    const field = scanTargetRef.current || 'placa';
    setFormData(s => ({ ...s, [field]: val }));
    setSmartOpen(false);
    stopStream();
  }

  function parseOcr(text) {
    if (!text) return null;
    // simple plate/serial/imei extraction heuristics
    const imeiMatch = text.replace(/\s+/g, '').match(/(\d{15})/);
    if (imeiMatch) return imeiMatch[1];
    const plateMatch = text.match(/[A-Z0-9\-]{4,20}/i);
    if (plateMatch) return plateMatch[0].trim();
    return null;
  }

  function onDetected(val) {
    const field = scanTargetRef.current;
    if (field) setFormData(s => ({ ...s, [field]: val }));
    setScannerOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await fetchJson(`/api/inventario/registrar/${token}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData) });
      setStatus('success');
    } catch (err) { setErr(err.message || 'Error al guardar.'); }
    finally { setSaving(false); }
  }

  if (status === 'loading') return (<div style={{padding:20}}>Verificando enlace…</div>);
  if (status === 'invalid') return (
    <div style={{padding:20,maxWidth:640,margin:'0 auto'}}>
      <h3>Enlace no válido</h3>
      <p>Este enlace no existe, expiró o alcanzó el límite de usos.</p>
    </div>
  );

  const brands = tipo === 'equipos'
    ? ['Lenovo','Dell','HP','Samsung','Toshiba','Acer','Asus','Apple','Otro']
    : ['Samsung','Xiaomi Redmi','Honor','ZTE','Infinix','Motorola','iPhone','Otro'];

  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#e2e8f0',padding:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{maxWidth:480,width:'100%'}}>
        <div style={{background:'#1e293b',padding:20,borderRadius:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{label}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{uses}</div>
            </div>
          </div>

          <div style={{marginTop:12,display:'flex',gap:8}}>
            <button style={{flex:1,padding:12,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',borderRadius:10,border:'none'}} onClick={() => openScanFor('placa')}>📷 Escanear etiqueta</button>
            <button style={{padding:12,background:'#334155',color:'#fff',borderRadius:10,border:'none'}} onClick={openSmartScanner}>🔎 Smart Scan</button>
          </div>

          <form onSubmit={handleSubmit} style={{marginTop:12}}>
            {tipo === 'equipos' ? (
              <>
                <label style={{fontSize:12}}>Placa *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="placa" value={formData.placa||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('placa')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Serial *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="serial" value={formData.serial||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('serial')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Marca *</label>
                <select name="marca" value={formData.marca||''} onChange={onChange} required>
                  <option value="">— Seleccionar —</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <label style={{fontSize:12,marginTop:8}}>Nombre equipo *</label>
                <input name="nombre_equipo" value={formData.nombre_equipo||''} onChange={onChange} required />
                <label style={{fontSize:12,marginTop:8}}>Área</label>
                <input name="area" value={formData.area||''} onChange={onChange} />
              </>
            ) : (
              <>
                <label style={{fontSize:12}}>IMEI *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="imei" value={formData.imei||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('imei')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Marca</label>
                <select name="equipo" value={formData.equipo||''} onChange={onChange}>
                  <option value="">—</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <label style={{fontSize:12,marginTop:8}}>Nombre completo *</label>
                <input name="nombre_completo" value={formData.nombre_completo||''} onChange={onChange} required />
              </>
            )}

            {err && <div style={{background:'rgba(239,68,68,.1)',color:'#fca5a5',padding:8,borderRadius:8,marginTop:8}}>{err}</div>}

            <div style={{marginTop:12}}>
              <button className="btn-submit" type="submit" disabled={saving} style={{width:'100%',padding:12,background:'#10b981',borderRadius:10,color:'#fff'}}>
                {saving ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>
          </form>

        </div>
      </div>
      <Scanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={onDetected} />

      {smartOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(2,6,23,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{width:'90%',maxWidth:900,background:'#0b1220',padding:12,borderRadius:8}}>
            <div style={{display:'flex',gap:8}}>
              <div style={{flex:1}}>
                <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',borderRadius:6,background:'#000'}} />
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={() => { captureFrameAndOcr(); }} style={{padding:8}}>📸 OCR</button>
                  <button onClick={() => { setSmartOpen(false); stopStream(); }} style={{padding:8}}>Cerrar</button>
                </div>
              </div>
              <div style={{width:260,overflow:'auto'}}>
                <div style={{color:'#94a3b8',fontSize:12}}>Detectados</div>
                <ul style={{listStyle:'none',padding:0,marginTop:8}}>
                  {detected.map(d => (
                    <li key={d} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:8,borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <div style={{wordBreak:'break-all'}}>{d}</div>
                      <div>
                        <button onClick={() => applyDetectedValue(d)} style={{marginLeft:8}}>Usar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
