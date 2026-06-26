// ── Variables globales de cálculo ──────────────────────
var liq_frascos = 0;
var ins_pens    = 0;
var got_frascos = 0;
var pol_viales  = 0;
var pes_frascos = 0;
var ver_frascos = 0;
var eqv_frascos = 0;

// ── Helpers ────────────────────────────────────────────
function el(id)      { return document.getElementById(id); }
function nv(id)      { var e = el(id); return e && e.value !== '' ? parseFloat(e.value) : 0; }
function showEl(id)  { var e = el(id); if (e) e.style.display = 'block'; }
function hideEl(id)  { var e = el(id); if (e) e.style.display = 'none'; }
function addCls(id, c) { var e = el(id); if (e) e.classList.add(c); }
function remCls(id, c) { var e = el(id); if (e) e.classList.remove(c); }
function htm(id, h)  { var e = el(id); if (e) e.innerHTML = h; }

function tab(n) {
  document.querySelectorAll('.tab-btn').forEach(function(b, i) {
    b.classList.toggle('active', i === n);
  });
  document.querySelectorAll('.mod-content').forEach(function(m, i) {
    m.classList.toggle('active', i === n);
  });
}

function toggleRef(cat) {
  var body = cat.nextElementSibling;
  var open = body.classList.contains('show');
  body.classList.toggle('show', !open);
  cat.classList.toggle('open', !open);
}

function card(lbl, val, star) {
  return '<div class="res-card' + (star ? ' star' : '') + '">'
    + '<div class="res-lbl">' + lbl + '</div>'
    + '<div class="res-val">' + val + '</div>'
    + '</div>';
}

// ── Semáforo ───────────────────────────────────────────
function semaforo(pedId, semId, calculado) {
  var semBox = el(semId);
  if (!semBox) return;
  var ped = nv(pedId);
  if (!ped || calculado <= 0) {
    semBox.classList.remove('show');
    semBox.innerHTML = '';
    return;
  }
  semBox.classList.add('show');
  var calcCeil = Math.ceil(calculado);
  var html = '';
  if (ped < calcCeil) {
    html = '<div class="sem-alerta err"><span class="sem-icon">🔴</span>'
      + '<span><b>INSUFICIENTE:</b> La formula pide ' + ped
      + ' unidad(es) pero el calculo indica que se necesitan <b>' + calcCeil
      + '</b>. Verifique con el Regente Quimico Farmaceutico antes de dispensar.</span></div>';
  } else if (ped > calcCeil) {
    html = '<div class="sem-alerta warn"><span class="sem-icon">🟡</span>'
      + '<span><b>EXCESO:</b> La formula pide ' + ped
      + ' unidad(es) pero el calculo indica <b>' + calcCeil
      + '</b>. <b>VERIFICAR CON EL REGENTE QUIMICO FARMACEUTICO</b> antes de dispensar. '
      + 'No dispensar mas de lo calculado sin autorizacion.</span></div>';
  } else {
    html = '<div class="sem-alerta ok"><span class="sem-icon">🟢</span>'
      + '<span><b>CORRECTO:</b> La cantidad pedida (' + ped
      + ') coincide con lo calculado (' + calcCeil
      + '). Puede proceder a dispensar.</span></div>';
  }
  semBox.innerHTML = html;
}

// ── Módulo 0: Líquidos ─────────────────────────────────
function liqModo() {
  var m = el('l-modo').value;
  el('lb-ml').style.display = m === 'ml' ? 'block' : 'none';
  el('lb-mg').style.display = m === 'mg' ? 'block' : 'none';
  liq_frascos = 0;
  remCls('l-res', 'show');
}

function calcLiq() {
  var m = el('l-modo') ? el('l-modo').value : 'ml';
  remCls('l-res', 'show');
  liq_frascos = 0;

  if (m === 'ml') {
    var ml   = nv('l-ml');
    var f    = nv('l-fml');
    var dias = nv('l-dml') || 30;
    var fr   = nv('l-fr');
    if (!ml || !f) return;
    var tomas = (24 / f) * dias;
    var mlT   = ml * tomas;
    liq_frascos = fr ? mlT / fr : 0;
    addCls('l-res', 'show');
    htm('l-cards',
      card('mL POR TOMA', ml.toFixed(1) + ' mL')
      + card('TOMAS TOTALES', tomas.toFixed(0))
      + card('mL TOTALES', mlT.toFixed(1) + ' mL')
      + (fr ? card('FRASCOS NECESARIOS', Math.ceil(liq_frascos), true) : '')
    );
    htm('l-nota',
      '<b>' + ml + ' mL</b> c/<b>' + f + 'h</b> x <b>' + dias + '</b> dias = <b>'
      + mlT.toFixed(1) + ' mL</b> totales.'
      + (fr ? ' Necesita <b>' + Math.ceil(liq_frascos) + '</b> frasco(s) de ' + fr + ' mL.' : ' Ingresa tamano del frasco.')
    );
  } else {
    var d    = nv('l-d');
    var f    = nv('l-f');
    var dias = nv('l-dias') || 30;
    var cm   = nv('l-cm');
    var cv   = nv('l-cv');
    var fr   = nv('l-fr2');
    if (!d || !f || !cm || !cv) return;
    var conc = cm / cv;
    var mlD  = d / conc;
    var tomas = (24 / f) * dias;
    var mlT  = mlD * tomas;
    liq_frascos = fr ? mlT / fr : 0;
    addCls('l-res', 'show');
    htm('l-cards',
      card('mL POR TOMA', mlD.toFixed(2) + ' mL')
      + card('TOMAS TOTALES', tomas.toFixed(0))
      + card('mL TOTALES', mlT.toFixed(1) + ' mL')
      + (fr ? card('FRASCOS NECESARIOS', Math.ceil(liq_frascos), true) : '')
    );
    htm('l-nota',
      'Administrar <b>' + mlD.toFixed(1) + ' mL</b> por toma, <b>'
      + (24 / f).toFixed(0) + '</b> veces/dia x <b>' + dias + '</b> dias.'
      + (fr ? ' Necesita <b>' + Math.ceil(liq_frascos) + '</b> frasco(s).' : ' Ingresa tamano del frasco.')
    );
  }
  el('l-ped').value = '';
  el('l-sem').classList.remove('show');
  el('l-sem').innerHTML = '';
}

// ── Módulo 1: Insulinas ────────────────────────────────
function insModo() {
  var m = el('i-modo').value;
  el('ib-fijo').style.display = m === 'fijo' ? 'block' : 'none';
  el('ib-prog').style.display = m === 'prog' ? 'block' : 'none';
  el('ib-bb').style.display   = m === 'bb'   ? 'block' : 'none';
  ins_pens = 0;
  remCls('i-res', 'show');
  if (m === 'prog') insGenPer();
}

function insGenPer() {
  var n  = parseInt(el('i-nper').value) || 4;
  var dp = parseInt(el('i-ptipo').value) || 7;
  var lb = dp === 7 ? 'Semana' : 'Mes';
  var wrap = el('i-per-wrap');
  if (!wrap) return;
  var s = '<div class="bloque-titulo"><span class="dot"></span>UI/DIA POR ' + lb.toUpperCase() + '</div>';
  for (var p = 1; p <= n; p++) {
    if (p % 2 === 1) s += '<div class="campos-row">';
    s += '<div class="campo"><div class="campo-lbl">' + lb + ' ' + p
      + '<span class="campo-unit">UI/dia</span></div>'
      + '<input id="i-p' + p + '" type="number" min="0" placeholder="ej:' + (10 + (p - 1) * 4) + '" oninput="calcIns()"></div>';
    if (p % 2 === 0 || p === n) s += '</div>';
  }
  wrap.innerHTML = s;
  var pr = el('i-prog-res');
  if (pr) pr.style.display = 'none';
  ins_pens = 0;
  remCls('i-res', 'show');
}

function calcIns() {
  var m   = el('i-modo') ? el('i-modo').value : 'fijo';
  var pen = parseFloat(el('i-pen') ? el('i-pen').value : 300) || 300;
  remCls('i-res', 'show');
  ins_pens = 0;
  var uiT = 0, nota = '';

  if (m === 'fijo') {
    var d    = nv('i-d');
    var ap   = nv('i-aplic');
    var dias = nv('i-dias') || 30;
    if (!d || !ap) return;
    var uiD = d * ap;
    uiT = uiD * dias;
    nota = '<b>' + d + ' UI</b> x <b>' + ap + '</b>/dia x <b>' + dias + '</b> dias = <b>' + uiT.toFixed(0) + ' UI</b>.';
    ins_pens = uiT / pen;
    addCls('i-res', 'show');
    htm('i-cards',
      card('UI POR DIA', uiD.toFixed(0) + ' UI')
      + card('UI TOTALES', uiT.toFixed(0) + ' UI')
      + card('PENS / CARTUCHOS', Math.ceil(ins_pens), true)
    );

  } else if (m === 'prog') {
    var n  = parseInt(el('i-nper') ? el('i-nper').value : 4) || 4;
    var dp = parseInt(el('i-ptipo') ? el('i-ptipo').value : 7) || 7;
    var lb = dp === 7 ? 'Sem' : 'Mes';
    var cards = '', resumen = '', ok = false;
    for (var p = 1; p <= n; p++) {
      var v = nv('i-p' + p);
      if (v > 0) ok = true;
      uiT += v * dp;
      cards   += card(lb + ' ' + p, v > 0 ? (v * dp).toFixed(0) + ' UI' : '-');
      resumen += lb + p + ':<b>' + v + 'UI/d</b>=>' + (v * dp).toFixed(0) + 'UI &nbsp;';
    }
    if (!ok) return;
    var pr = el('i-prog-res');
    if (pr) { pr.style.display = 'block'; pr.innerHTML = resumen + '<br><b>Total: ' + uiT.toFixed(0) + ' UI</b>'; }
    nota = 'Esquema ' + n + ' periodo(s) de ' + dp + ' dias: <b>' + uiT.toFixed(0) + ' UI</b> totales.';
    ins_pens = uiT / pen;
    addCls('i-res', 'show');
    htm('i-cards', cards + card('UI TOTALES', uiT.toFixed(0) + ' UI') + card('PENS / CARTUCHOS', Math.ceil(ins_pens), true));

  } else {
    var bas  = nv('i-basal');
    var bap  = nv('i-bap') || 1;
    var b1   = nv('i-b1');
    var b2   = nv('i-b2');
    var b3   = nv('i-b3');
    var dias = nv('i-dbb') || 30;
    if (!bas && !b1 && !b2 && !b3) return;
    var uiD = (bas * bap) + (b1 + b2 + b3);
    uiT = uiD * dias;
    nota = 'Basal:<b>' + (bas * bap) + 'UI/d</b>+Bolos:<b>' + (b1 + b2 + b3) + 'UI/d</b>=<b>' + uiD + 'UI/d</b> x <b>' + dias + '</b>d.';
    ins_pens = uiT / pen;
    addCls('i-res', 'show');
    htm('i-cards',
      card('BASAL/DIA', (bas * bap).toFixed(0) + ' UI')
      + card('BOLOS/DIA', (b1 + b2 + b3).toFixed(0) + ' UI')
      + card('UI/DIA', uiD.toFixed(0) + ' UI')
      + card('UI TOTALES', uiT.toFixed(0) + ' UI')
      + card('PENS / CARTUCHOS', Math.ceil(ins_pens), true)
    );
  }

  if (ins_pens > 0) {
    htm('i-nota', nota + ' Necesita <b>' + Math.ceil(ins_pens) + '</b> pen(s) de <b>' + pen + ' UI</b>.');
  }
  el('i-ped').value = '';
  el('i-sem').classList.remove('show');
  el('i-sem').innerHTML = '';
}

// ── Módulo 2: Goteros ──────────────────────────────────
function calcGot() {
  var gotas = nv('g-gotas');
  var f     = nv('g-f');
  var dias  = nv('g-dias') || 30;
  var ojos  = parseFloat(el('g-ojos') ? el('g-ojos').value : 1) || 1;
  var gml   = nv('g-gml') || 20;
  var fml   = nv('g-fml');

  if (!gotas || !f) { remCls('g-res', 'show'); got_frascos = 0; return; }

  var aplic   = (24 / f) * dias;
  var totalG  = gotas * ojos * aplic;
  var totalMl = totalG / gml;
  got_frascos = fml ? totalMl / fml : 0;

  addCls('g-res', 'show');
  htm('g-cards',
    card('GOTAS TOTALES', totalG.toFixed(0) + ' gts')
    + card('mL TOTALES', totalMl.toFixed(2) + ' mL')
    + card('APLICACIONES', aplic.toFixed(0))
    + (fml ? card('FRASCOS NECESARIOS', Math.ceil(got_frascos), true) : '')
  );
  htm('g-nota',
    '<b>' + gotas + '</b> gota(s) x <b>' + ojos + '</b> ojo(s)/oido(s) c/<b>' + f + 'h</b> x <b>' + dias
    + '</b> dias = <b>' + totalG.toFixed(0) + '</b> gotas = <b>' + totalMl.toFixed(2) + ' mL</b>.'
    + (fml ? ' Necesita <b>' + Math.ceil(got_frascos) + '</b> frasco(s) de ' + fml + ' mL.' : ' Ingresa volumen del frasco.')
  );
  el('g-ped').value = '';
  el('g-sem').classList.remove('show');
  el('g-sem').innerHTML = '';
}

// ── Módulo 3: Viales ───────────────────────────────────
function calcPol() {
  var cm   = nv('p-cm');
  var cv   = nv('p-cv');
  var d    = nv('p-d');
  var f    = nv('p-f');
  var dias = nv('p-dias');

  if (!cm || !cv || !d) { remCls('p-res', 'show'); pol_viales = 0; return; }

  var conc  = cm / cv;
  var mlD   = d / conc;
  var tomas = (f && dias) ? (24 / f) * dias : 0;
  pol_viales = (tomas && cv) ? Math.ceil((mlD * tomas) / cv) : 0;

  addCls('p-res', 'show');
  htm('p-cards',
    card('CONC. RECONSTIT.', conc.toFixed(2) + ' mg/mL')
    + card('mL A EXTRAER', mlD.toFixed(2) + ' mL')
    + (pol_viales ? card('VIALES NECESARIOS', pol_viales, true) : '')
  );
  htm('p-nota',
    'Concentracion reconstituida: <b>' + conc.toFixed(2) + ' mg/mL</b>. Extraer <b>' + mlD.toFixed(2) + ' mL</b> por dosis.'
    + (pol_viales ? ' Se necesitan <b>' + pol_viales + '</b> vial(es).' : ' Ingresa frecuencia y duracion para calcular viales.')
  );
  el('p-ped').value = '';
  el('p-sem').classList.remove('show');
  el('p-sem').innerHTML = '';
}

// ── Módulo 4: Dosis por peso ───────────────────────────
function calcPes() {
  var mgkg = nv('w-mgkg');
  var kg   = nv('w-kg');
  var f    = nv('w-f');
  var dias = nv('w-dias');
  var cm   = nv('w-cm');
  var cv   = nv('w-cv');
  var fr   = nv('w-fr');

  if (!mgkg || !kg) { remCls('w-res', 'show'); pes_frascos = 0; return; }

  var dosis = mgkg * kg;
  var mlD   = (cm && cv) ? dosis / (cm / cv) : 0;
  var tomas = (f && dias) ? (24 / f) * dias : 0;
  var mlT   = mlD * tomas;
  pes_frascos = (fr && mlT) ? mlT / fr : 0;

  addCls('w-res', 'show');
  htm('w-cards',
    card('DOSIS CALCULADA', dosis.toFixed(1) + ' mg')
    + (mlD ? card('mL POR TOMA', mlD.toFixed(2) + ' mL') : '')
    + (mlT ? card('mL TOTALES', mlT.toFixed(1) + ' mL') : '')
    + (pes_frascos ? card('FRASCOS NECESARIOS', Math.ceil(pes_frascos), true) : '')
  );
  htm('w-nota',
    '<b>' + mgkg + ' mg/kg</b> x <b>' + kg + ' kg</b> = <b>' + dosis.toFixed(1) + ' mg</b> por dosis.'
    + (mlD ? ' Administrar <b>' + mlD.toFixed(2) + ' mL</b> por toma.' : '')
    + (pes_frascos
        ? ' Se necesitan <b>' + Math.ceil(pes_frascos) + '</b> frasco(s) de ' + fr + ' mL.'
        : (!mlD ? ' Ingresa concentracion del producto para calcular mL.' : ' Ingresa tamano del frasco para calcular frascos.'))
  );
  el('w-ped').value = '';
  el('w-sem').classList.remove('show');
  el('w-sem').innerHTML = '';
}

// ── Módulo 5: Verificador ──────────────────────────────
function calcVerif() {
  var fm = nv('v-fm');
  var fv = nv('v-fv');
  var dm = nv('v-dm');
  var dv = nv('v-dv');

  if (!fm || !fv || !dm || !dv) {
    addCls('v-igual-res', 'show');
    htm('v-igual-nota', '');
    hideEl('v-dosif-bloque');
    remCls('v-dos-res', 'show');
    return;
  }

  var cF    = fm / fv;
  var cD    = dm / dv;
  var igual = Math.abs(cF - cD) < 0.001;
  addCls('v-igual-res', 'show');

  var nota = igual
    ? '<span style="color:#1B5E20;font-weight:800">✅ CONCENTRACIONES IGUALES.</span> Formula: <b>' + cF.toFixed(3) + ' mg/mL</b> = Disponible: <b>' + cD.toFixed(3) + ' mg/mL</b>. Puede dispensar el producto disponible sin ajuste de dosis.'
    : '<span style="color:#B71C1C;font-weight:800">⚠️ CONCENTRACIONES DISTINTAS.</span> Formula: <b>' + cF.toFixed(3) + ' mg/mL</b> vs Disponible: <b>' + cD.toFixed(3) + ' mg/mL</b>. Ajusta el volumen a administrar o consulta con el Regente.';

  htm('v-igual-nota', nota);
  showEl('v-dosif-bloque');
  calcVerifDos();
}

function calcVerifDos() {
  var dm   = nv('v-dm');
  var dv   = nv('v-dv');
  var d    = nv('v-d');
  var f    = nv('v-f');
  var dias = nv('v-dias');
  var fr   = nv('v-fr');

  if (!dm || !dv || !d) { remCls('v-dos-res', 'show'); ver_frascos = 0; return; }

  var conc  = dm / dv;
  var mlD   = d / conc;
  var tomas = (f && dias) ? (24 / f) * dias : 0;
  var mlT   = mlD * tomas;
  ver_frascos = (fr && mlT) ? mlT / fr : 0;

  addCls('v-dos-res', 'show');
  htm('v-cards',
    card('mL POR TOMA', mlD.toFixed(2) + ' mL')
    + (tomas ? card('TOMAS TOTALES', tomas.toFixed(0)) : '')
    + (mlT   ? card('mL TOTALES', mlT.toFixed(1) + ' mL') : '')
    + (ver_frascos ? card('FRASCOS NECESARIOS', Math.ceil(ver_frascos), true) : '')
  );
  htm('v-dos-nota',
    'Administrar <b>' + mlD.toFixed(2) + ' mL</b> por toma con el producto disponible.'
    + (ver_frascos ? ' Se necesitan <b>' + Math.ceil(ver_frascos) + '</b> frasco(s) de ' + fr + ' mL.' : '')
  );
  el('v-ped').value = '';
  el('v-sem').classList.remove('show');
  el('v-sem').innerHTML = '';
}

// ── Módulo 6: Equivalencias ────────────────────────────
function calcEqv() {
  var a1  = nv('e-a1');
  var v1  = nv('e-v1');
  var a2  = nv('e-a2');
  var v2  = nv('e-v2');
  var uEl = el('e-u');
  var u   = uEl ? uEl.value : 'mg';

  var u1 = el('e-u1'); var u2 = el('e-u2'); var du = el('e-du');
  if (u1) u1.textContent = u;
  if (u2) u2.textContent = u;
  if (du) du.textContent = u;

  if (!a1 || !v1 || !a2 || !v2) { hideEl('e-res'); eqv_frascos = 0; return; }

  var c1    = a1 / v1;
  var c2    = a2 / v2;
  var igual = Math.abs(c1 - c2) < 0.001;
  showEl('e-res');

  var ban = el('e-banner');
  ban.className = 'equiv-banner ' + (igual ? 'igual' : 'distinto');
  ban.textContent = igual
    ? '✅  EQUIVALENTES — MISMA CONCENTRACION'
    : '⚠️  NO EQUIVALENTES — CONCENTRACIONES DISTINTAS';

  htm('e-detalle',
    'P1: <b>' + a1 + ' ' + u + '/' + v1 + ' mL</b> = ' + c1.toFixed(3) + ' ' + u + '/mL &nbsp;|&nbsp; '
    + 'P2: <b>' + a2 + ' ' + u + '/' + v2 + ' mL</b> = ' + c2.toFixed(3) + ' ' + u + '/mL'
    + (igual
        ? '<br><span style="color:#1B5E20">Son intercambiables sin ajuste de dosis.</span>'
        : '<br><span style="color:#B71C1C">No son directamente intercambiables. Consulte con el Regente.</span>')
  );
  calcEqvDos();
}

function calcEqvDos() {
  var a2   = nv('e-a2');
  var v2   = nv('e-v2');
  var d    = nv('e-d');
  var f    = nv('e-f');
  var dias = nv('e-dias');
  var fr   = nv('e-fr');

  if (!a2 || !v2 || !d) { remCls('e-dos-res', 'show'); eqv_frascos = 0; return; }

  var c2    = a2 / v2;
  var mlD   = d / c2;
  var tomas = (f && dias) ? (24 / f) * dias : 0;
  var mlT   = mlD * tomas;
  eqv_frascos = (fr && mlT) ? mlT / fr : 0;

  addCls('e-dos-res', 'show');
  htm('e-cards',
    card('mL POR TOMA (P2)', mlD.toFixed(2) + ' mL')
    + (mlT ? card('mL TOTALES', mlT.toFixed(1) + ' mL') : '')
    + (eqv_frascos ? card('FRASCOS NECESARIOS', Math.ceil(eqv_frascos), true) : '')
  );
  htm('e-dos-nota',
    'Con Presentacion 2: administrar <b>' + mlD.toFixed(2) + ' mL</b> por toma.'
    + (eqv_frascos ? ' Se necesitan <b>' + Math.ceil(eqv_frascos) + '</b> frasco(s) de ' + fr + ' mL.' : '')
  );
  el('e-ped').value = '';
  el('e-sem').classList.remove('show');
  el('e-sem').innerHTML = '';
}

// ── Módulo 8: Regla de 3 y Conversiones ───────────────
function calcConv() {
  var v = nv('cv-v');
  var t = el('cv-t') ? el('cv-t').value : 'g_mg';
  var F = {
    g_mg:   { m: 1000,    u: 'mg',    f: 'x1000'   },
    mg_g:   { m: 0.001,   u: 'g',     f: '÷1000'   },
    mg_mcg: { m: 1000,    u: 'mcg',   f: 'x1000'   },
    mcg_mg: { m: 0.001,   u: 'mg',    f: '÷1000'   },
    mgml_p: { m: 0.1,     u: '%',     f: '÷10'     },
    p_mgml: { m: 10,      u: 'mg/mL', f: 'x10'     },
    lb_kg:  { m: 0.4536,  u: 'kg',    f: 'x0.4536' },
    kg_lb:  { m: 2.2046,  u: 'lb',    f: 'x2.2046' },
    oz_ml:  { m: 29.574,  u: 'mL',    f: 'x29.574' },
    cst_ml: { m: 5,       u: 'mL',    f: 'x5'      },
    csp_ml: { m: 15,      u: 'mL',    f: 'x15'     }
  };
  var rd = el('cv-res');
  if (!v || !F[t]) { if (rd) rd.style.display = 'none'; return; }
  var r  = v * F[t].m;
  var rs = parseFloat(r.toFixed(8)).toString();
  if (rd) rd.style.display = 'block';
  var rv = el('cv-val'); if (rv) rv.textContent = rs + ' ' + F[t].u;
  var rf = el('cv-form'); if (rf) rf.textContent = v + ' ' + F[t].f + ' = ' + rs + ' ' + F[t].u;
}

function calcR3() {
  var a   = nv('r3-a');
  var b   = nv('r3-b');
  var c   = nv('r3-c');
  var dEl = el('r3-d');
  var n   = el('r3-n');
  if (!a || !b || !c) { if (dEl) dEl.value = ''; if (n) n.style.display = 'none'; return; }
  var d = (b * c) / a;
  if (dEl) dEl.value = parseFloat(d.toFixed(6));
  if (n) {
    n.style.display = 'block';
    n.innerHTML = '(' + b + ' x ' + c + ') ÷ ' + a + ' = <b>' + parseFloat(d.toFixed(6)) + '</b>';
  }
}

function calcDC() {
  var d  = nv('dc-d');
  var cm = nv('dc-cm');
  var cv = nv('dc-cv');
  var r  = el('dc-res');
  if (!d || !cm || !cv) { if (r) r.style.display = 'none'; return; }
  var ml = d / (cm / cv);
  if (r) r.style.display = 'block';
  var v = el('dc-val'); if (v) v.textContent = ml.toFixed(2) + ' mL';
  var n = el('dc-n');
  if (n) n.innerHTML = 'Conc: <b>' + cm + '/' + cv + ' mL</b>=<b>' + (cm / cv).toFixed(2) + ' mg/mL</b>. Para <b>' + d + ' mg</b> extraer <b>' + ml.toFixed(2) + ' mL</b>.';
}
