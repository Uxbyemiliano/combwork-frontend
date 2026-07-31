/* ============================================================================
   COMBWORK — panel.js
   Panel interno del equipo. Lee los leads generados por el flujo público
   y los presenta junto a la base histórica de la cuenta.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mem = {};
  var Store = {
    get: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] !== undefined ? mem[k] : fb); } catch (e) { return mem[k] !== undefined ? mem[k] : fb; } },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
  };
  var K_LEADS = 'combwork.leads', K_CAMP = 'combwork.campaigns', K_CFG = 'combwork.config';

  /* ---------- Guardia de sesión ------------------------------------------ */
  (function auth() {
    var raw = null;
    try { raw = localStorage.getItem('combwork.auth') || sessionStorage.getItem('combwork.auth'); } catch (e) {}
    if (!raw) { window.location.replace('login.html'); return; }
    try { $('#whoami').textContent = JSON.parse(raw).user; } catch (e) {}
  })();
  $('#logout').addEventListener('click', function () {
    try { localStorage.removeItem('combwork.auth'); sessionStorage.removeItem('combwork.auth'); } catch (e) {}
    window.location.href = 'login.html';
  });

  /* ---------- Utilidades -------------------------------------------------- */
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3000); }
  function money(n) { if (n == null || isNaN(n)) return '—'; return Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : '$' + Math.round(n / 1000) + 'K'; }
  function fecha(iso) { try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); } catch (e) { return '—'; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var DIMS = [
    { key: 'eficiencia', name: 'Eficiencia energética', ind: 3.2 },
    { key: 'cooling', name: 'Enfriamiento', ind: 3.4 },
    { key: 'redundancia', name: 'Redundancia', ind: 3.6 },
    { key: 'capacidad', name: 'Capacidad', ind: 3.0 },
    { key: 'operacion', name: 'Madurez operativa', ind: 2.9 },
    { key: 'ai', name: 'AI / GPU readiness', ind: 2.4 },
    { key: 'sostenibilidad', name: 'Sostenibilidad', ind: 2.7 }
  ];

  /* ---------- Datos de muestra -------------------------------------------- */
  function sampleLeads() {
    var d = function (n) { return new Date(Date.now() - n * 86400000).toISOString(); };
    return [
      { id: 's1', company: 'Nortek Data Centers', name: 'Marta Fuentes', email: 'marta@nortek.com', role: 'Directora de Infraestructura',
        segment: 'Alto', score: 4.1, percentile: 88, mainGap: 'AI / GPU readiness', pdf: 'descargado', source: 'orgánico', createdAt: d(2),
        calc: { itload: 12, pue: 1.42, price: 0.10, cost: 14927040, save: 1261440, payback: 37 },
        dims: { eficiencia: 5, cooling: 4, redundancia: 5, capacidad: 4, operacion: 4, ai: 2, sostenibilidad: 4 } },
      { id: 's2', company: 'Andes Cloud', name: 'Julián Reyes', email: 'julian@andescloud.com', role: 'Facility Manager',
        segment: 'Medio', score: 3.0, percentile: 58, mainGap: 'Enfriamiento', pdf: 'descargado', source: 'campaña', createdAt: d(3),
        calc: { itload: 4.2, pue: 1.72, price: 0.14, cost: 8859514, save: 2163370, payback: 8 },
        dims: { eficiencia: 3, cooling: 2, redundancia: 4, capacidad: 3, operacion: 3, ai: 3, sostenibilidad: 3 } },
      { id: 's3', company: 'Vertix Infra', name: 'Carla Ibáñez', email: 'carla@vertix.io', role: 'VP de Operaciones',
        segment: 'Bajo', score: 2.1, percentile: 24, mainGap: 'Redundancia', pdf: 'pendiente', source: 'campaña', createdAt: d(4),
        calc: { itload: 2.6, pue: 2.05, price: 0.16, cost: 7470528, save: 2733120, payback: 4 },
        dims: { eficiencia: 2, cooling: 2, redundancia: 1, capacidad: 2, operacion: 3, ai: 2, sostenibilidad: 3 } },
      { id: 's4', company: 'Coreo Systems', name: 'Diego Salas', email: 'diego@coreo.mx', role: 'Ingeniería / Energía',
        segment: 'Medio', score: 3.3, percentile: 64, mainGap: 'Capacidad', pdf: 'descargado', source: 'orgánico', createdAt: d(6),
        calc: { itload: 7.4, pue: 1.61, price: 0.12, cost: 12523997, save: 2411453, payback: 12 },
        dims: { eficiencia: 4, cooling: 3, redundancia: 4, capacidad: 2, operacion: 3, ai: 3, sostenibilidad: 4 } },
      { id: 's5', company: 'Delta Rack', name: 'Ana Mora', email: 'ana@deltarack.com', role: 'Directora de Infraestructura',
        segment: 'Alto', score: 3.9, percentile: 82, mainGap: 'Sostenibilidad', pdf: 'pendiente', source: 'evento', createdAt: d(8),
        calc: { itload: 18, pue: 1.38, price: 0.09, cost: 19583856, save: 1135296, payback: 61 },
        dims: { eficiencia: 5, cooling: 4, redundancia: 4, capacidad: 4, operacion: 4, ai: 4, sostenibilidad: 2 } },
      { id: 's6', company: 'Península Hosting', name: 'Raúl Ortega', email: 'raul@peninsula.host', role: 'Facility Manager',
        segment: 'Bajo', score: 2.4, percentile: 31, mainGap: 'Madurez operativa', pdf: 'pendiente', source: 'campaña', createdAt: d(10),
        calc: { itload: 1.8, pue: 1.94, price: 0.15, cost: 4588488, save: 1513728, payback: 5 },
        dims: { eficiencia: 3, cooling: 2, redundancia: 3, capacidad: 2, operacion: 1, ai: 2, sostenibilidad: 4 } }
    ];
  }
  function sampleCampaigns() {
    return [
      { id: 'c1', name: 'Onboarding Q3 — data centers LATAM', tpl: 'estandar', createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        sent: 218, opened: 134, started: 82, completed: 34, active: true },
      { id: 'c2', name: 'Seguimiento — segmento bajo', tpl: 'followup', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        sent: 40, opened: 22, started: 14, completed: 8, active: true },
      { id: 'c3', name: 'Referidos — evento sector energía', tpl: 'evento', createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
        sent: 13, opened: 9, started: 7, completed: 6, active: false }
    ];
  }
  function seedIfEmpty() {
    var leads = Store.get(K_LEADS, []);
    var hasSample = leads.some(function (l) { return String(l.id).indexOf('s') === 0 && l.id.length <= 3; });
    if (!hasSample) { Store.set(K_LEADS, leads.concat(sampleLeads())); }
    if (!Store.get(K_CAMP, null)) Store.set(K_CAMP, sampleCampaigns());
  }
  seedIfEmpty();

  function allLeads() {
    return Store.get(K_LEADS, []).map(function (l) {
      var o = Object.assign({}, l);
      if (!o.company && o.name) o.company = o.name;
      o.segment = o.segment || (o.score >= 3.6 ? 'Alto' : o.score >= 2.7 ? 'Medio' : o.score ? 'Bajo' : '—');
      o.pdf = o.pdf || 'pendiente';
      o.source = o.source || 'orgánico';
      if (!o.dims && o.result && o.result.dims) {
        o.dims = {}; o.result.dims.forEach(function (d) { o.dims[d.key] = d.score; });
        o.score = o.result.score; o.percentile = o.result.percentile; o.mainGap = o.result.gaps[0].dim;
      }
      return o;
    });
  }

  /* ---------- Navegación entre vistas ------------------------------------ */
  function showView(v) {
    $$('.panel-view').forEach(function (s) { s.classList.toggle('active', s.dataset.view === v); });
    $$('.nav-item[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }
  $$('.nav-item[data-view]').forEach(function (b) { b.addEventListener('click', function () { showView(b.dataset.view); }); });
  $$('[data-view-link]').forEach(function (b) { b.addEventListener('click', function () { showView(b.dataset.viewLink); }); });

  /* ---------- RESUMEN ----------------------------------------------------- */
  function renderResumen() {
    var leads = allLeads(), camps = Store.get(K_CAMP, []);
    var withScore = leads.filter(function (l) { return l.score; });
    var avg = withScore.length ? withScore.reduce(function (a, l) { return a + l.score; }, 0) / withScore.length : null;
    var week = leads.filter(function (l) { return Date.now() - new Date(l.createdAt || 0).getTime() < 7 * 86400000; }).length;

    $('#kLeads').textContent = leads.length;
    $('#kLeadsD').textContent = '+' + week + ' esta semana';
    $('#kScore').textContent = avg ? avg.toFixed(1) + ' / 5' : '—';
    $('#kScoreD').textContent = avg ? 'Madurez ' + (avg < 2.6 ? 'en desarrollo' : avg < 3.4 ? 'intermedia' : 'avanzada') : 'Sin datos';
    $('#kComp').textContent = leads.length ? Math.round(withScore.length / leads.length * 100) + '%' : '—';
    var act = camps.filter(function (c) { return c.active; });
    $('#kCamp').textContent = act.length;
    $('#kCampD').textContent = act.reduce(function (a, c) { return a + c.sent; }, 0) + ' invitaciones enviadas';

    $('#recentLeads').innerHTML = leads.slice(0, 5).map(function (l) {
      return '<tr data-lead="' + esc(l.id) + '">' +
        '<td data-l="Empresa">' + esc(l.company) + '</td>' +
        '<td data-l="Segmento"><span class="chip ' + segClass(l.segment) + '">' + esc(l.segment) + '</span></td>' +
        '<td data-l="Brecha">' + esc(l.mainGap || '—') + '</td>' +
        '<td data-l="Reporte"><span class="sub">' + esc(l.pdf) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="4" class="sub">Sin leads todavía.</td></tr>';

    // Agregado por dimensión
    var rows = DIMS.map(function (d) {
      var vals = leads.map(function (l) { return l.dims ? l.dims[d.key] : null; }).filter(function (v) { return v; });
      var m = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
      var color = m < d.ind - 0.6 ? 'var(--crit)' : m < d.ind ? 'var(--gold-500)' : 'var(--forest-500)';
      return '<div class="dim-row"><span class="name">' + d.name + '</span>' +
        '<span class="bar"><i style="width:' + (m / 5 * 100) + '%;background:' + color + '"></i></span>' +
        '<span class="val">' + (m ? m.toFixed(1) : '—') + '</span></div>';
    }).join('');
    $('#dimAgg').innerHTML = rows;

    $('#campSummary').innerHTML = camps.map(function (c) {
      var pct = c.sent ? Math.round(c.completed / c.sent * 100) : 0;
      return '<div class="row-between" style="padding:11px 0;border-bottom:1px solid var(--line-soft);gap:14px;flex-wrap:wrap">' +
        '<div><div style="font-weight:600;font-size:13.5px;color:var(--forest-900)">' + esc(c.name) + '</div>' +
        '<div class="sub">' + c.sent + ' enviadas · ' + c.opened + ' abiertas · ' + c.completed + ' completadas</div></div>' +
        '<div class="row" style="gap:10px"><span class="track" style="width:80px"><i style="width:' + pct + '%"></i></span>' +
        '<span class="sub mono">' + pct + '%</span></div></div>';
    }).join('');
  }
  function segClass(s) { return s === 'Alto' ? 'chip--ok' : s === 'Medio' ? 'chip--gold' : s === 'Bajo' ? 'chip--crit' : ''; }

  /* ---------- LEADS -------------------------------------------------------- */
  function renderLeads() {
    var q = ($('#leadSearch').value || '').toLowerCase();
    var f = $('#leadFilter').value;
    var leads = allLeads().filter(function (l) {
      var hit = !q || (l.company + ' ' + l.email + ' ' + (l.name || '')).toLowerCase().indexOf(q) >= 0;
      return hit && (!f || l.segment === f);
    });
    $('#leadCount').textContent = leads.length + ' de ' + allLeads().length + ' leads';
    $('#leadsEmpty').classList.toggle('hide', leads.length > 0);
    $('#leadsTable').innerHTML = leads.map(function (l) {
      return '<tr data-lead="' + esc(l.id) + '" style="cursor:pointer">' +
        '<td data-l="Empresa">' + esc(l.company) + '</td>' +
        '<td data-l="Contacto"><div>' + esc(l.name || '—') + '</div><span class="sub">' + esc(l.email || '') + '</span></td>' +
        '<td data-l="Segmento"><span class="chip ' + segClass(l.segment) + '">' + esc(l.segment) + '</span></td>' +
        '<td data-l="Score">' + (l.score ? l.score.toFixed(1) + ' / 5' : '—') + '</td>' +
        '<td data-l="Brecha">' + esc(l.mainGap || '—') + '</td>' +
        '<td data-l="Reporte"><span class="sub">' + esc(l.pdf) + '</span></td>' +
        '<td data-l="Origen"><span class="sub">' + esc(l.source) + '</span></td></tr>';
    }).join('');
  }
  $('#leadSearch').addEventListener('input', renderLeads);
  $('#leadFilter').addEventListener('change', renderLeads);

  document.addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-lead]') : null;
    if (tr) openLead(tr.dataset.lead);
    if (e.target.matches('[data-close]')) $('#leadDetail').classList.remove('open');
  });

  function openLead(id) {
    var l = allLeads().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!l) return;
    var dims = l.dims ? DIMS.map(function (d) {
      var v = l.dims[d.key] || 0;
      var color = v < d.ind - 0.6 ? 'var(--crit)' : v < d.ind ? 'var(--gold-500)' : 'var(--forest-500)';
      return '<div class="dim-row"><span class="name">' + d.name + '</span><span class="bar"><i style="width:' + (v / 5 * 100) + '%;background:' + color + '"></i></span><span class="val">' + v.toFixed(1) + '</span></div>';
    }).join('') : '<p class="sub">Este lead no terminó el benchmark.</p>';

    $('#leadDetailBody').innerHTML =
      '<h2 class="t-h3 mb2">' + esc(l.company) + '</h2>' +
      '<p class="sub mb4">' + esc(l.name || '') + ' · ' + esc(l.role || '') + '<br>' + esc(l.email || '') + '</p>' +
      '<div class="row mb5" style="gap:8px;flex-wrap:wrap">' +
        '<span class="chip ' + segClass(l.segment) + '">Segmento ' + esc(l.segment) + '</span>' +
        (l.percentile ? '<span class="chip chip--gold">percentil ' + l.percentile + '</span>' : '') +
        '<span class="chip">Reporte ' + esc(l.pdf) + '</span></div>' +
      (l.calc ? '<div class="card card--flat mb5"><span class="lbl">KPIs de la calculadora</span>' +
        '<div class="result-line"><span class="k">Carga de TI</span><span class="v">' + (l.calc.itload || '—') + ' MW</span></div>' +
        '<div class="result-line"><span class="k">PUE</span><span class="v">' + (l.calc.pue ? Number(l.calc.pue).toFixed(2) : '—') + '</span></div>' +
        '<div class="result-line"><span class="k">Costo anual</span><span class="v">' + money(l.calc.cost) + '</span></div>' +
        '<div class="result-line"><span class="k">Ahorro alcanzable</span><span class="v">' + money(l.calc.save) + '</span></div></div>' : '') +
      '<span class="lbl mb3">Score por dimensión</span>' + dims +
      '<div class="flex-end mt5"><button class="btn btn--ghost btn--sm" data-close>Cerrar</button>' +
      '<a class="btn btn--sm" href="mailto:' + esc(l.email) + '">Escribirle</a></div>';
    $('#leadDetail').classList.add('open');
  }

  $('#exportCsv').addEventListener('click', function () {
    var rows = [['empresa', 'nombre', 'email', 'rol', 'segmento', 'score', 'percentil', 'brecha', 'reporte', 'origen', 'fecha']];
    allLeads().forEach(function (l) {
      rows.push([l.company, l.name, l.email, l.role, l.segment, l.score || '', l.percentile || '', l.mainGap || '', l.pdf, l.source, l.createdAt || '']);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'combwork-leads.csv'; a.click();
    toast('CSV exportado con ' + (rows.length - 1) + ' leads.');
  });

  /* ---------- CAMPAÑAS ----------------------------------------------------- */
  var parsedRows = [];

  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var head = lines[0].toLowerCase();
    var start = /nombre|name|email|correo/.test(head) ? 1 : 0;
    return lines.slice(start).map(function (line) {
      var c = line.split(/[,;\t]/).map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
      var email = c.filter(function (x) { return x.indexOf('@') >= 0; })[0] || c[2] || '';
      return { name: c[0] || '', company: c[1] || '', email: email, ok: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) };
    }).slice(0, 5000);
  }

  function renderPreview() {
    var bad = parsedRows.filter(function (r) { return !r.ok; }).length;
    $('#rowCount').textContent = parsedRows.length + ' filas';
    $('#previewWrap').classList.toggle('hide', !parsedRows.length);
    $('#csvSummary').classList.toggle('hide', !parsedRows.length);
    $('#csvSummary').innerHTML = parsedRows.length
      ? parsedRows.length + ' filas cargadas · <strong style="color:' + (bad ? 'var(--crit)' : 'var(--forest-700)') + '">' + bad + ' con correo inválido</strong>. Puedes continuar: las filas con error no se envían.'
      : '';
    $('#csvPreview').innerHTML = parsedRows.slice(0, 8).map(function (r) {
      return '<tr><td data-l="Nombre">' + esc(r.name) + '</td><td data-l="Empresa">' + esc(r.company) + '</td>' +
        '<td data-l="Correo">' + esc(r.email) + '</td>' +
        '<td data-l="Validación"><span class="chip ' + (r.ok ? 'chip--ok' : 'chip--crit') + '">' + (r.ok ? 'válido' : 'sin formato') + '</span></td></tr>';
    }).join('');
    $('#sendCamp').disabled = !(parsedRows.length && $('#campName').value.trim());
  }

  var drop = $('#drop'), input = $('#csvInput');
  drop.addEventListener('click', function () { input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', function () { if (input.files[0]) readFile(input.files[0]); });
  function readFile(f) {
    var r = new FileReader();
    r.onload = function () { parsedRows = parseCSV(String(r.result)); renderPreview(); toast(parsedRows.length + ' contactos leídos de ' + f.name); };
    r.readAsText(f);
  }
  $('#loadSample').addEventListener('click', function () {
    parsedRows = parseCSV(
      'nombre,empresa,email\n' +
      'Marta Fuentes,Nortek Data Centers,marta@nortek.com\n' +
      'Julián Reyes,Andes Cloud,julian.reyes\n' +
      'Carla Ibáñez,Vertix Infra,carla@vertix.io\n' +
      'Diego Salas,Coreo Systems,diego@coreo.mx\n' +
      'Ana Mora,Delta Rack,ana@deltarack.com\n' +
      'Raúl Ortega,Península Hosting,raul@peninsula.host\n' +
      'Sofía Lem,Kabra Colo,sofia@kabracolo.com'
    );
    renderPreview();
  });
  $('#campName').addEventListener('input', renderPreview);
  $$('.tpl').forEach(function (t) {
    t.addEventListener('click', function () { $$('.tpl').forEach(function (o) { o.classList.remove('sel'); }); t.classList.add('sel'); });
  });

  $('#sendCamp').addEventListener('click', function () {
    var valid = parsedRows.filter(function (r) { return r.ok; }).length;
    var camps = Store.get(K_CAMP, []);
    camps.unshift({
      id: 'c' + Date.now(), name: $('#campName').value.trim(),
      tpl: ($('.tpl.sel') || {}).dataset ? $('.tpl.sel').dataset.tpl : 'estandar',
      createdAt: new Date().toISOString(), sent: valid,
      opened: Math.round(valid * 0.58), started: Math.round(valid * 0.34), completed: Math.round(valid * 0.15), active: true
    });
    Store.set(K_CAMP, camps);
    parsedRows = []; $('#campName').value = ''; renderPreview();
    toast('Campaña creada. ' + valid + ' invitaciones en cola de envío.');
    render();
  });

  function renderCampanas() {
    var camps = Store.get(K_CAMP, []);
    $('#campList').innerHTML = camps.map(function (c) {
      function row(label, val, base) {
        var pct = base ? Math.round(val / base * 100) : 0;
        return '<div class="funnel-row"><span class="fl">' + label + '</span>' +
          '<span class="fb"><i style="width:' + pct + '%">' + val + '</i></span><span class="fv">' + pct + '%</span></div>';
      }
      var pend = c.opened - c.completed;
      return '<div style="padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--line-soft)">' +
        '<div class="row-between mb3"><div><div style="font-weight:600;color:var(--forest-900)">' + esc(c.name) + '</div>' +
        '<span class="sub">' + fecha(c.createdAt) + ' · plantilla ' + esc(c.tpl) + '</span></div>' +
        '<span class="chip ' + (c.active ? 'chip--ok' : '') + '">' + (c.active ? 'activa' : 'cerrada') + '</span></div>' +
        row('Enviadas', c.sent, c.sent) + row('Abiertas', c.opened, c.sent) +
        row('Iniciaron', c.started, c.sent) + row('Completaron', c.completed, c.sent) +
        (pend > 0 ? '<div class="row-between mt3" style="flex-wrap:wrap;gap:10px"><span class="sub">' + pend +
          ' abrieron y no completaron el benchmark</span><button class="btn btn--gold btn--sm" data-follow="' + c.id + '">Enviar seguimiento</button></div>' : '') +
        '</div>';
    }).join('') || '<p class="sub">Todavía no hay campañas.</p>';

    $$('[data-follow]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        toast('Seguimiento encolado. En producción sale por el proveedor de correo.');
      });
    });
  }

  /* ---------- BENCHMARKS --------------------------------------------------- */
  function renderBenchmarks() {
    var leads = allLeads().filter(function (l) { return l.score; });
    var levels = [['Inicial', 0, 1.8], ['En desarrollo', 1.8, 2.6], ['Intermedio', 2.6, 3.4], ['Avanzado', 3.4, 4.2], ['Líder', 4.2, 5.01]];
    var total = leads.length || 1;
    $('#levelDist').innerHTML = levels.map(function (lv) {
      var n = leads.filter(function (l) { return l.score >= lv[1] && l.score < lv[2]; }).length;
      return '<div class="dim-row"><span class="name">' + lv[0] + '</span>' +
        '<span class="bar"><i style="width:' + (n / total * 100) + '%;background:var(--forest-500)"></i></span>' +
        '<span class="val">' + n + '</span></div>';
    }).join('');

    var rank = DIMS.map(function (d) {
      var vals = leads.map(function (l) { return l.dims ? l.dims[d.key] : null; }).filter(Boolean);
      var m = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
      return { name: d.name, gap: m - d.ind, m: m };
    }).sort(function (a, b) { return a.gap - b.gap; });
    $('#gapRank').innerHTML = rank.map(function (r) {
      var neg = r.gap < 0;
      return '<div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--line-soft)">' +
        '<span style="font-size:13.4px">' + r.name + '</span>' +
        '<span class="mono sub" style="color:' + (neg ? 'var(--crit)' : 'var(--forest-500)') + '">' +
        (neg ? '' : '+') + r.gap.toFixed(1) + ' vs. industria</span></div>';
    }).join('');

    $('#benchTable').innerHTML = leads.map(function (l) {
      return '<tr data-lead="' + esc(l.id) + '" style="cursor:pointer"><td data-l="Empresa">' + esc(l.company) + '</td>' +
        '<td data-l="Nivel">' + (l.score >= 4.2 ? 'Líder' : l.score >= 3.4 ? 'Avanzado' : l.score >= 2.6 ? 'Intermedio' : l.score >= 1.8 ? 'En desarrollo' : 'Inicial') + '</td>' +
        '<td data-l="Percentil">' + (l.percentile || '—') + '</td>' +
        '<td data-l="Score">' + l.score.toFixed(1) + '</td>' +
        '<td data-l="Brecha">' + esc(l.mainGap || '—') + '</td>' +
        '<td data-l="Fecha">' + fecha(l.createdAt) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="sub">Sin respuestas todavía.</td></tr>';
  }

  /* ---------- AJUSTES ------------------------------------------------------ */
  var cfg = Store.get(K_CFG, { name: 'Nombre del fundador', mail: 'founder@combwork.io', phone: '+52 55 0000 0000', link: 'cal.com/combwork' });
  ['Name', 'Mail', 'Phone', 'Link'].forEach(function (f) { $('#cfg' + f).value = cfg[f.toLowerCase()] || ''; });
  $('#saveCfg').addEventListener('click', function () {
    cfg = { name: $('#cfgName').value, mail: $('#cfgMail').value, phone: $('#cfgPhone').value, link: $('#cfgLink').value };
    Store.set(K_CFG, cfg); toast('Guardado. Se aplica en la página de contacto del reporte.');
  });
  $('#reseed').addEventListener('click', function () {
    var real = Store.get(K_LEADS, []).filter(function (l) { return String(l.id).indexOf('lead_') === 0; });
    Store.set(K_LEADS, real.concat(sampleLeads())); Store.set(K_CAMP, sampleCampaigns());
    toast('Leads de muestra recargados.'); render();
  });
  $('#wipe').addEventListener('click', function () {
    Store.del(K_LEADS); Store.del(K_CAMP); Store.del('combwork.session'); Store.del('combwork.reporte');
    toast('Datos borrados.'); seedIfEmpty(); render();
  });

  /* ---------- Render global ------------------------------------------------ */
  function render() { renderResumen(); renderLeads(); renderCampanas(); renderBenchmarks(); }
  render();
})();
