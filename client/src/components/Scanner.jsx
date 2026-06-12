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
    <div className="modal-overlay">
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <h3>Escáner</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!supported && (
          <div style={{padding:12,background:'var(--surface-2)',borderRadius:'var(--radius-sm)',color:'var(--text-2)',fontSize:13}}>
            Tu navegador no soporta <code>BarcodeDetector</code>. Usa Chrome o Edge.
          </div>
        )}

        <div style={{marginTop:8}}>
          <div style={{background:'#000',borderRadius:'var(--radius)',overflow:'hidden'}}>
            <video ref={videoRef} style={{width:'100%',height:220,objectFit:'cover'}} playsInline muted />
          </div>
          <div style={{display:'flex',gap:8,marginTop:10,alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontFamily:'monospace',fontSize:13,color:'var(--text)'}}>{last || '—'}</div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary btn-small" onClick={() => setLast(null)}>Limpiar</button>
              <button className="btn btn-primary btn-small" onClick={() => { if (onDetected && last) onDetected(last); }}>Aplicar</button>
            </div>
          </div>
          {error && <div className="modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
