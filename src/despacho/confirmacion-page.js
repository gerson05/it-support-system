export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function confirmarPage(row, artRows, confirmed) {
  const fechaConf = confirmed && row.confirmed_at
    ? new Date(row.confirmed_at).toLocaleString('es-CO')
    : '';
  return `<!DOCTYPE html><html lang="es"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmación de recepción</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f0f4f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:32px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.10)}
    .logo{font-size:13px;font-weight:700;color:#64748b;letter-spacing:.5px;text-transform:uppercase;margin-bottom:20px}
    h1{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .sub{font-size:13px;color:#64748b;margin-bottom:20px}
    .arts{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px}
    .arts-head{background:#f8fafc;padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0}
    .art-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b}
    .art-row:last-child{border-bottom:none}
    .art-qty{color:#64748b;font-size:12px}
    .btn{display:block;width:100%;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;text-align:center}
    .btn:hover{background:#16a34a}
    .ok{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center}
    .ok-icon{font-size:40px;margin-bottom:8px}
    .ok-title{font-size:16px;font-weight:700;color:#15803d;margin-bottom:4px}
    .ok-sub{font-size:13px;color:#16a34a}
  </style>
</head><body>
  <div class="card">
    <div class="logo">Sistema IT — Despacho ${escHtml(row.numero)}</div>
    <h1>Recepción de artículos</h1>
    <div class="sub">Destinatario: <strong>${escHtml(row.destinatario)}</strong>${row.sede ? ` · ${escHtml(row.sede)}` : ''}</div>
    <div class="arts">
      <div class="arts-head">Artículos despachados</div>
      ${artRows || '<div class="art-row">Sin detalle de artículos</div>'}
    </div>
    ${confirmed
      ? `<div class="ok">
           <div class="ok-icon">✅</div>
           <div class="ok-title">Recepción confirmada</div>
           <div class="ok-sub">${fechaConf}</div>
         </div>`
      : `<form method="POST" action="/confirmar/${escHtml(row.token)}">
           <button type="submit" class="btn">Confirmo que recibí todos los artículos</button>
         </form>`
    }
  </div>
</body></html>`;
}
