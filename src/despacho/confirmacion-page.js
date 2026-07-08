export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function confirmarPage(row, artRows, confirmed) {
  const fechaConf = confirmed && row.confirmed_at
    ? new Date(row.confirmed_at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
    : '';
  const signerName = row.signed_by ? escHtml(row.signed_by) : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmación de recepción — ${escHtml(row.numero)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px}
    .wrap{width:100%;max-width:480px;margin:auto}
    .logo{display:flex;align-items:center;gap:10px;margin-bottom:24px}
    .logo-icon{width:40px;height:40px;background:#6366f1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
    .logo-text h1{font-size:15px;font-weight:700;color:#e2e8f0}
    .logo-text p{font-size:11px;color:#64748b}
    .card{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5);margin-bottom:14px}
    .card-title{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}
    .desp-header{margin-bottom:18px}
    .desp-numero{font-size:22px;font-weight:800;color:#e2e8f0;letter-spacing:-.4px;font-family:monospace}
    .desp-dest{font-size:13px;color:#94a3b8;margin-top:4px}
    .arts{border:1px solid rgba(255,255,255,.07);border-radius:10px;overflow:hidden;margin-bottom:0}
    .arts-head{background:rgba(255,255,255,.04);padding:9px 13px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,.07)}
    .art-row{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:#cbd5e1}
    .art-row:last-child{border-bottom:none}
    .art-qty{color:#64748b;font-size:12px;font-family:monospace}
    label{display:block;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:7px}
    .text-input{width:100%;padding:11px 13px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#0f172a;color:#e2e8f0;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
    .text-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.18)}
    .text-input.error{border-color:#ef4444}
    .err{font-size:11px;color:#f87171;margin-top:5px;display:none}
    .sig-wrap{position:relative;border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;background:#0a1628;margin-bottom:4px;touch-action:none}
    .sig-wrap.error{border-color:#ef4444}
    #sig-canvas{display:block;width:100%;height:150px;cursor:crosshair}
    .sig-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:12px;color:#334155;user-select:none;gap:6px}
    .sig-actions{display:flex;justify-content:flex-end;margin-bottom:0}
    .btn-clear{padding:5px 12px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:transparent;color:#64748b;font-size:11px;cursor:pointer;transition:all .15s}
    .btn-clear:hover{border-color:#6366f1;color:#818cf8}
    .btn-confirm{width:100%;padding:14px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(99,102,241,.35)}
    .btn-confirm:hover{opacity:.92;transform:translateY(-1px)}
    .btn-confirm:disabled{background:#334155;color:#64748b;cursor:not-allowed;transform:none;box-shadow:none}
    .state-icon{font-size:52px;text-align:center;margin-bottom:14px}
    .state-title{font-size:20px;font-weight:800;text-align:center;margin-bottom:8px;letter-spacing:-.3px}
    .state-msg{font-size:13px;color:#94a3b8;text-align:center;line-height:1.6}
    .state-msg strong{color:#e2e8f0}
    .state-success .state-title{color:#4ade80}
    .state-already .state-title{color:#60a5fa}
    .step-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:99px;font-size:11px;font-weight:700;color:#818cf8;margin-bottom:14px}
    .step-num{width:20px;height:20px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff}
  </style>
</head>
<body>
<div class="wrap">

  <div class="logo">
    <div class="logo-icon">💊</div>
    <div class="logo-text">
      <h1>Mi Farmacia IT</h1>
      <p>Confirmación de entrega</p>
    </div>
  </div>

  <!-- Info del despacho -->
  <div class="card">
    <div class="desp-header">
      <div class="desp-numero">Despacho ${escHtml(row.numero)}</div>
      <div class="desp-dest">Destinatario: <strong>${escHtml(row.destinatario)}</strong>${row.sede ? ` &nbsp;·&nbsp; ${escHtml(row.sede)}` : ''}</div>
    </div>
    <div class="arts">
      <div class="arts-head">Artículos despachados</div>
      ${artRows || '<div class="art-row">Sin detalle de artículos</div>'}
    </div>
  </div>

  ${confirmed ? `
  <!-- Ya confirmado -->
  <div class="card state-already">
    <div class="state-icon">✅</div>
    <div class="state-title">Recepción confirmada</div>
    <p class="state-msg">
      ${signerName ? `Confirmado por <strong>${signerName}</strong><br>` : ''}
      ${fechaConf}
    </p>
  </div>
  ` : `
  <!-- Formulario -->
  <div id="state-form">
    <div class="card">
      <div class="step-badge"><span class="step-num">1</span> Tus datos</div>
      <label for="input-name">Tu nombre completo <span style="color:#ef4444">*</span></label>
      <input id="input-name" class="text-input" type="text" placeholder="Nombre y apellido" autocomplete="name">
      <div class="err" id="err-name">El nombre es requerido.</div>
    </div>

    <div class="card">
      <div class="step-badge"><span class="step-num">2</span> Tu firma</div>
      <label>Dibuja tu firma en el recuadro <span style="color:#ef4444">*</span></label>
      <div class="sig-wrap" id="sig-wrap">
        <canvas id="sig-canvas"></canvas>
        <div class="sig-placeholder" id="sig-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Firma aquí con el dedo o el cursor
        </div>
      </div>
      <div class="err" id="err-sig" style="margin-top:5px">La firma es requerida.</div>
      <div class="sig-actions" style="margin-top:8px">
        <button class="btn-clear" id="btn-clear">↺ Borrar firma</button>
      </div>
    </div>

    <div class="card">
      <div class="step-badge"><span class="step-num">3</span> Confirmar</div>
      <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;line-height:1.5;">Al hacer clic confirmas que recibiste todos los artículos listados en buen estado.</p>
      <button class="btn-confirm" id="btn-confirm">Confirmar recepción</button>
    </div>
  </div>

  <!-- Estado: éxito -->
  <div id="state-success" style="display:none">
    <div class="card state-success">
      <div class="state-icon">🎉</div>
      <div class="state-title">¡Recepción confirmada!</div>
      <p class="state-msg">Tu confirmación fue registrada correctamente.<br>Puedes cerrar esta ventana.</p>
    </div>
  </div>
  `}

</div>
<script>
(function() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const wrap   = document.getElementById('sig-wrap');
  const placeholder = document.getElementById('sig-placeholder');

  function resize() {
    const w = wrap.clientWidth;
    const h = 150;
    if (canvas.width === w && canvas.height === h) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width  = w;
    canvas.height = h;
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }
  resize();
  window.addEventListener('resize', resize);

  let hasDrawn = false, isDrawing = false, lastX = 0, lastY = 0;

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) * (canvas.width  / rect.width),
      y: (cy - rect.top)  * (canvas.height / rect.height),
    };
  }

  function startDraw(e) {
    isDrawing = true;
    const p = pos(e);
    lastX = p.x; lastY = p.y;
  }
  function draw(e) {
    if (!isDrawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
    if (!hasDrawn) {
      hasDrawn = true;
      placeholder.style.display = 'none';
    }
  }
  function endDraw() { isDrawing = false; }

  canvas.addEventListener('mousedown',  startDraw);
  canvas.addEventListener('mousemove',  draw);
  canvas.addEventListener('mouseup',    endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); draw(e); },      { passive: false });
  canvas.addEventListener('touchend',   endDraw);

  document.getElementById('btn-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    placeholder.style.display = 'flex';
    wrap.classList.remove('error');
    document.getElementById('err-sig').style.display = 'none';
  });

  document.getElementById('btn-confirm').addEventListener('click', async () => {
    const nameEl   = document.getElementById('input-name');
    const errName  = document.getElementById('err-name');
    const errSig   = document.getElementById('err-sig');
    const btn      = document.getElementById('btn-confirm');
    errName.style.display = 'none';
    errSig.style.display  = 'none';
    nameEl.classList.remove('error');
    wrap.classList.remove('error');

    let valid = true;
    const name = nameEl.value.trim();
    if (!name) {
      errName.style.display = 'block';
      nameEl.classList.add('error');
      valid = false;
    }
    if (!hasDrawn) {
      errSig.style.display = 'block';
      wrap.classList.add('error');
      valid = false;
    }
    if (!valid) return;

    btn.disabled = true;
    btn.textContent = 'Procesando…';
    try {
      const signatureData = canvas.toDataURL('image/png');
      const res  = await fetch(window.location.href, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ signed_by: name, signature_data: signatureData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al confirmar.');
      document.getElementById('state-form').style.display    = 'none';
      document.getElementById('state-success').style.display = 'block';
    } catch (e) {
      btn.disabled    = false;
      btn.textContent = 'Confirmar recepción';
      alert(e.message);
    }
  });
})();
</script>
</body>
</html>`;
}
