import React, { useEffect, useRef, useState } from 'react';

// Simple scanner modal using the native BarcodeDetector API when available.
// Props:
// - open: boolean
// - onClose(): close handler
// - onDetected(value): called with detected string when user applies
export default function Scanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [last, setLast] = useState(null);
  const [error, setError] = useState(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const has = typeof window.BarcodeDetector !== 'undefined';
        if (!mounted) return;
        setSupported(has);
        if (!has) return;

        const formats = await window.BarcodeDetector.getSupportedFormats?.() || ['ean_13','qr_code','code_128','code_39'];
        detectorRef.current = new window.BarcodeDetector({ formats });

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const scan = async () => {
          if (!detectorRef.current || !videoRef.current) return;
          try {
            const detections = await detectorRef.current.detect(videoRef.current);
            if (detections && detections.length) {
              setLast(detections[0].rawValue);
            }
          } catch (e) {
            // detection may throw on some platforms
            setError(e.message || String(e));
          }
          if (mounted) requestAnimationFrame(scan);
        };
        videoRef.current.play().catch(()=>{});
        requestAnimationFrame(scan);
      } catch (e) {
        setError(e.message || String(e));
      }
    })();

    return () => { mounted = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current = null; } detectorRef.current = null; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',zIndex:10000}}>
      <div style={{width:'min(520px,96vw)',background:'#fff',borderRadius:8,padding:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <strong>Escáner</strong>
          <button onClick={onClose}>✕</button>
        </div>

        {!supported && (
          <div style={{padding:12,background:'#f8fafc',borderRadius:6}}>Tu navegador no soporta la API `BarcodeDetector`. Usa las opciones manuales.</div>
        )}

        <div style={{marginTop:8}}>
          <div style={{background:'#000',borderRadius:8,overflow:'hidden'}}>
            <video ref={videoRef} style={{width:'100%',height:220,objectFit:'cover'}} playsInline muted />
          </div>
          <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:'monospace'}}>{last || '—'}</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => { if (onDetected && last) onDetected(last); }}>Aplicar</button>
              <button onClick={() => { setLast(null); }}>Limpiar</button>
            </div>
          </div>
          {error && <div style={{color:'crimson',marginTop:8}}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
