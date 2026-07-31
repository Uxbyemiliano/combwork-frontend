/* ============================================================================
   COMBWORK — app.js
   Lógica del recorrido del operador: calculadora → gate → benchmark → reporte.
   El estado del recorrido persiste en el navegador para que el panel interno
   pueda leer los leads generados. Al conectar el API Gateway, este módulo
   sustituye Store por las llamadas al backend sin cambiar el resto.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- Almacenamiento -------------------------------------------- */
  var mem = {};
  var Store = {
    get: function (k, fb) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] !== undefined ? mem[k] : fb); }
      catch (e) { return mem[k] !== undefined ? mem[k] : fb; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
  };
  var K_SESSION = 'combwork.session';
  var K_LEADS = 'combwork.leads';

  var session = Store.get(K_SESSION, { calc: null, lead: null, answers: {}, result: null });

  /* ---------- Utilidades ------------------------------------------------- */
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function money(n, compact) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (compact && Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
    if (compact && Math.abs(n) >= 1000) return '$' + Math.round(n / 1000) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function uid() { return 'lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- Navegación entre etapas ------------------------------------ */
  var LABELS = {
    1: 'Calculadora de eficiencia', 2: 'Tu resultado', 3: 'Datos de contacto',
    4: 'Benchmark de madurez', 5: 'Tu posición', 6: 'Reporte institucional'
  };
  var current = 1;
  function goStage(n) {
    current = n;
    $$('.stage-screen').forEach(function (s) {
      s.classList.toggle('active', Number(s.dataset.stage) === n);
    });
    $$('#flowProgress i').forEach(function (i, k) { i.classList.toggle('on', k < n); });
    var lbl = $('#stepLabel'); if (lbl) lbl.textContent = LABELS[n] || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    session.stage = n; Store.set(K_SESSION, session);
    paintBack();
  }

  /* Regreso: siempre hay salida. Dentro del benchmark retrocede pregunta
     por pregunta; entre etapas, una etapa. En la primera pantalla se oculta. */
  function paintBack() {
    var b = $('#flowBack'); if (!b) return;
    var hide = (current <= 1) || (current === 6);
    b.hidden = hide;
    b.setAttribute('aria-label', current === 4 && qi > 0 ? 'Volver a la pregunta anterior' : 'Volver al paso anterior');
  }
  var backBtn = $('#flowBack');
  if (backBtn) backBtn.addEventListener('click', function () {
    if (current === 4 && qi > 0) { qi--; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (current === 5) { goStage(4); qi = QUESTIONS.length - 1; renderQuestion(); return; }
    goStage(Math.max(1, current - 1));
  });
  $$('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () { goStage(Number(b.dataset.goto)); });
  });

  /* ========================================================================
     1 · CALCULADORA
     ====================================================================== */
  var RANGES = {
    itload:    { min: 0.05, max: 500,  label: 'La carga de TI va de 0.05 a 500 MW.' },
    pue:       { min: 1.0,  max: 5.0,  label: 'Un PUE menor a 1.00 es imposible y arriba de 5.00 no existe en operación real.' },
    price:     { min: 0.01, max: 1.0,  label: 'El precio por kWh va de 0.01 a 1.00 USD.' },
    growth:    { min: 0,    max: 100,  label: 'El crecimiento anual va de 0 a 100%.' },
    pueTarget: { min: 1.0,  max: 5.0,  label: 'El PUE objetivo va de 1.00 a 5.00 y debe ser menor a tu PUE actual.' }
  };
  var ACHIEVABLE = { aire: 1.45, agua: 1.30, free: 1.22, liquid: 1.15 };
  var TIER_PENALTY = { '1': 0, '2': 0.01, '3': 0.03, '4': 0.06 };
  var INDUSTRY_PUE = 1.58;
  var HOURS = 8760;
  var CAPEX_PER_MW = 320000; // USD por MW de TI · parámetro de calibración

  var fields = ['itload', 'pue', 'price', 'growth', 'pueTarget'];

  function readNum(id) {
    var el = $('#' + id); if (!el) return null;
    var raw = String(el.value).trim();
    if (raw === '') return null;
    var v = parseFloat(raw.replace(',', '.'));
    return isNaN(v) ? NaN : v;
  }

  function validateField(id) {
    var el = $('#' + id), errEl = $('#err-' + id), r = RANGES[id];
    if (!el || !r) return true;
    var v = readNum(id);
    var msg = '';
    if (v !== null) {
      if (isNaN(v)) msg = 'Escribe un número.';
      else if (v < r.min || v > r.max) msg = r.label;
      else if (id === 'pueTarget') {
        var actual = readNum('pue');
        if (actual && v >= actual) msg = 'El objetivo tiene que ser menor a tu PUE actual (' + actual.toFixed(2) + ').';
      }
    }
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (errEl) { errEl.textContent = msg; errEl.classList.toggle('show', !!msg); }
    return !msg;
  }

  function compute() {
    var it = readNum('itload'), pue = readNum('pue'), price = readNum('price');
    var growth = readNum('growth'); var target = readNum('pueTarget');
    var cooling = $('#cooling') ? $('#cooling').value : 'agua';
    var tier = $('#tier') ? $('#tier').value : '3';

    var valid = fields.every(validateField);
    var complete = it > 0 && pue > 0 && price > 0 && valid;
    if (!complete) return null;

    var achievable = Math.min(pue - 0.02, (ACHIEVABLE[cooling] || 1.35) + (TIER_PENALTY[tier] || 0));
    var targetPue = target && target < pue ? target : Math.max(1.05, achievable);

    var kwh = it * 1000 * pue * HOURS;
    var cost = kwh * price;
    var overhead = it * 1000 * (pue - 1) * HOURS * price;
    var targetCost = it * 1000 * targetPue * HOURS * price;
    var save = Math.max(0, cost - targetCost);
    var capex = it * CAPEX_PER_MW;
    var payback = save > 0 ? capex / save * 12 : null;
    var g = (growth || 0) / 100;
    var save3y = save * (1 + (1 + g) + Math.pow(1 + g, 2));
    var effPct = Math.round(100 / (1 + Math.exp(6 * (pue - INDUSTRY_PUE))));
    effPct = Math.max(2, Math.min(98, effPct));

    return {
      itload: it, pue: pue, price: price, tier: tier, cooling: cooling,
      growth: growth || 0, targetPue: targetPue,
      kwh: kwh, cost: cost, overhead: overhead, save: save, save3y: save3y,
      payback: payback, effPct: effPct, industryPue: INDUSTRY_PUE
    };
  }

  function paintCalc() {
    var c = compute();
    var hero = $('#resultHero'), btn = $('#toResult');
    if (!c) {
      if (hero) hero.classList.remove('filled');
      ['rCost', 'rWaste', 'rPue', 'rSave', 'rPayback'].forEach(function (id, i) {
        var el = $('#' + id); if (el) el.textContent = i === 0 ? '$---' : '—';
      });
      if (btn) btn.disabled = true;
      return;
    }
    session.calc = c; Store.set(K_SESSION, session);
    if (hero) hero.classList.add('filled');
    $('#rCost').textContent = money(c.cost, true);
    $('#rWaste').textContent = money(c.overhead, true) + ' / año';
    $('#rPue').textContent = c.pue.toFixed(2) + ' vs. 1.58';
    $('#rSave').textContent = money(c.save, true) + ' / año';
    $('#rPayback').textContent = c.payback ? Math.round(c.payback) + ' meses' : '—';
    if (btn) btn.disabled = false;
  }

  ['itload', 'pue', 'price', 'growth', 'pueTarget'].forEach(function (id) {
    var el = $('#' + id); if (el) { el.addEventListener('input', paintCalc); el.addEventListener('blur', paintCalc); }
  });
  ['tier', 'cooling'].forEach(function (id) {
    var el = $('#' + id); if (el) el.addEventListener('change', paintCalc);
  });

  /* ========================================================================
     2 · RESULTADO + GATE
     ====================================================================== */
  function paintResult() {
    var c = session.calc; if (!c) return;
    var W = global.Combwork;

    // Número héroe: la capacidad que no produce
    var heroEl = $('#heroWaste');
    if (heroEl) {
      if (W) W.countUp(heroEl, c.overhead, { format: function (v) { return money(v, true); } });
      else heroEl.textContent = money(c.overhead, true);
    }
    var pctOver = Math.round((1 - 1 / c.pue) * 100);
    $('#heroWasteD').textContent = 'Es el ' + pctOver + '% de tu factura eléctrica. Con un PUE de ' +
      c.pue.toFixed(2) + ', esa porción se va en enfriar, respaldar y distribuir en vez de producir cómputo.';

    // Flujo de energía
    var useful = c.cost - c.overhead;
    if (W && $('#sankeySlot')) {
      W.sankey($('#sankeySlot'), {
        total: c.cost, useful: useful, overhead: c.overhead,
        totalLabel: money(c.cost, true), usefulLabel: money(useful, true), overheadLabel: money(c.overhead, true),
        breakdown: [
          { name: 'Enfriamiento',        value: c.overhead * 0.64, label: money(c.overhead * 0.64, true) },
          { name: 'UPS y distribución',  value: c.overhead * 0.27, label: money(c.overhead * 0.27, true) },
          { name: 'Iluminación y otros', value: c.overhead * 0.09, label: money(c.overhead * 0.09, true) }
        ]
      });
    }
    $('#sankeyCaption').innerHTML = 'Por cada dólar que pagas de electricidad, <b>' + pctOver +
      ' centavos</b> no llegan a producir cómputo.';

    // KPIs
    $('#s2Cost').textContent = money(c.cost, true);
    $('#s2CostD').textContent = Math.round(c.kwh / 1e6) + ' GWh al año';
    $('#s2Save').textContent = money(c.save, true);
    $('#s2SaveD').textContent = 'llevando el PUE a ' + c.targetPue.toFixed(2);
    $('#s2Pay').textContent = c.payback ? Math.round(c.payback) + ' meses' : '—';

    $('#gateHeadline').textContent = c.effPct >= 50
      ? 'Operas mejor que el ' + c.effPct + '% de la industria en eficiencia'
      : 'El ' + (100 - c.effPct) + '% de la industria opera con mejor PUE que tú';
  }

  var toResult = $('#toResult');
  if (toResult) toResult.addEventListener('click', function () { paintResult(); goStage(2); });
  var openGate = $('#openGate');
  if (openGate) openGate.addEventListener('click', function () { goStage(3); });
  var skipGate = $('#skipGate');
  if (skipGate) skipGate.addEventListener('click', function () {
    toast('Listo, no guardamos nada. Tu estimación queda en esta pantalla.');
    window.location.href = 'index.html';
  });

  /* ========================================================================
     3 · GATE — captura del lead
     ====================================================================== */
  function validText(id, msg, test) {
    var el = $('#' + id), errEl = $('#err-' + id);
    var ok = test(String(el.value).trim());
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (errEl) { errEl.textContent = ok ? '' : msg; errEl.classList.toggle('show', !ok); }
    return ok;
  }
  var submitLead = $('#submitLead');
  if (submitLead) submitLead.addEventListener('click', function () {
    var ok1 = validText('leadName', 'Escribe tu nombre.', function (v) { return v.length >= 2; });
    var ok2 = validText('leadCompany', 'Escribe el nombre de tu operación.', function (v) { return v.length >= 2; });
    var ok3 = validText('leadEmail', 'Necesitamos un correo con formato válido, por ejemplo tu@empresa.com.',
      function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); });
    if (!(ok1 && ok2 && ok3)) return;

    session.lead = {
      id: session.lead && session.lead.id ? session.lead.id : uid(),
      name: $('#leadName').value.trim(),
      company: $('#leadCompany').value.trim(),
      email: $('#leadEmail').value.trim(),
      role: $('#leadRole').value,
      optin: $('#leadOptin').checked,
      createdAt: new Date().toISOString(),
      source: 'orgánico'
    };
    Store.set(K_SESSION, session);
    upsertLead({ status: 'Benchmark iniciado' });
    startBenchmark();
    goStage(4);
  });

  /* Guarda / actualiza el lead en el "CRM" local ------------------------- */
  function upsertLead(extra) {
    if (!session.lead) return;
    var leads = Store.get(K_LEADS, []);
    var rec = null;
    for (var i = 0; i < leads.length; i++) { if (leads[i].id === session.lead.id) { rec = leads[i]; break; } }
    if (!rec) { rec = { id: session.lead.id }; leads.unshift(rec); }
    rec.name = session.lead.name; rec.company = session.lead.company;
    rec.email = session.lead.email; rec.role = session.lead.role;
    rec.optin = session.lead.optin; rec.source = session.lead.source || 'orgánico';
    rec.createdAt = rec.createdAt || session.lead.createdAt;
    rec.updatedAt = new Date().toISOString();
    rec.calc = session.calc || rec.calc || null;
    rec.result = session.result || rec.result || null;
    if (extra) for (var k in extra) rec[k] = extra[k];
    Store.set(K_LEADS, leads);
  }

  /* ========================================================================
     4 · BENCHMARK — 7 preguntas, una por dimensión
     ====================================================================== */
  var QUESTIONS = [
    { dim: 'Eficiencia energética', key: 'eficiencia', low: 'Nunca', high: 'En tiempo real',
      q: '¿Con qué frecuencia mides el PUE de tu facility?',
      help: 'Piensa en la medición que efectivamente se registra, no en la que está en el manual.',
      opts: ['Nunca lo hemos medido', 'Una vez al año', 'Cada trimestre', 'Cada mes', 'Medición continua en tiempo real'] },

    { dim: 'Enfriamiento', key: 'cooling', low: 'Sin monitoreo', high: 'Por rack',
      q: '¿Cómo monitoreas la eficiencia del sistema de enfriamiento?',
      help: 'Lo que importa es a qué nivel de detalle ves el comportamiento térmico.',
      opts: ['No se monitorea', 'Revisión visual ocasional', 'Reportes trimestrales', 'Sensores por sala', 'Sensores por rack en tiempo real'] },

    { dim: 'Redundancia', key: 'redundancia', low: 'Sin documentar', high: 'Con simulacros',
      q: '¿Qué tan documentado y probado está tu esquema de redundancia?',
      help: 'Documentar y probar son cosas distintas. Cuenta la que sí ocurre.',
      opts: ['No está documentado', 'Documentado pero nunca probado', 'Pruebas una vez al año', 'Pruebas semestrales con bitácora', 'Pruebas periódicas y simulacros de falla'] },

    { dim: 'Capacidad', key: 'capacidad', low: 'Reactivo', high: 'Con escenarios',
      q: '¿Cómo planeas el crecimiento de capacidad?',
      help: 'Se trata del horizonte con el que decides comprar potencia y espacio.',
      opts: ['Reaccionamos cuando ya falta', 'Presupuesto anual', 'Modelo a 12 meses', 'Modelo a 24–36 meses', 'Modelo dinámico con escenarios'] },

    { dim: 'Madurez operativa', key: 'operacion', low: 'Separados', high: 'Un solo equipo',
      q: '¿Cómo se coordinan las decisiones entre facility y TI?',
      help: 'La capacidad que no produce casi siempre nace en esta junta que no existe.',
      opts: ['Son equipos separados sin coordinación', 'Se hablan cuando hay un problema', 'Junta mensual de seguimiento', 'Comité con KPIs compartidos', 'Un solo equipo con datos y metas comunes'] },

    { dim: 'AI / GPU readiness', key: 'ai', low: 'Sin preparar', high: 'Nativo',
      q: '¿Qué tan preparado está tu facility para cargas de alta densidad, arriba de 30 kW por rack?',
      help: 'Incluye potencia por rack, distribución eléctrica y capacidad de disipación.',
      opts: ['Nada preparado', 'En evaluación', 'Piloto en una sala', 'Zonas dedicadas ya operando', 'Diseño nativo para alta densidad'] },

    { dim: 'Sostenibilidad', key: 'sostenibilidad', low: 'No se reporta', high: 'Metas públicas',
      q: '¿Reportas huella de carbono o consumo de agua (WUE)?',
      help: 'Cuenta solo lo que se reporta de forma sistemática.',
      opts: ['No se reporta', 'Solo cuando un cliente lo pide', 'Reporte anual interno', 'Reporte anual auditado', 'Métrica continua con metas públicas'] }
  ];
  var INDUSTRY = { eficiencia: 3.2, cooling: 3.4, redundancia: 3.6, capacidad: 3.0, operacion: 2.9, ai: 2.4, sostenibilidad: 2.7 };

  var qi = 0;

  function startBenchmark() { qi = 0; session.answers = session.answers || {}; renderQuestion(); }

  function renderQuestion() {
    var q = QUESTIONS[qi];
    $('#qCount').textContent = 'Pregunta ' + (qi + 1) + ' de ' + QUESTIONS.length;
    $('#qDim').textContent = q.dim;
    $('#qProgress').style.width = Math.round((qi) / QUESTIONS.length * 100) + '%';
    $('#qTitle').textContent = q.q;
    $('#qHelp').textContent = q.help;
    $('#qLow').textContent = q.low;
    $('#qHigh').textContent = q.high;

    var box = $('#qOptions'); box.innerHTML = '';
    var current = session.answers[q.key];
    q.opts.forEach(function (label, k) {
      var val = k + 1;
      var el = document.createElement('label');
      el.className = 'likert-opt' + (current === val ? ' sel' : '');
      el.setAttribute('role', 'radio');
      el.setAttribute('aria-checked', current === val ? 'true' : 'false');
      el.tabIndex = 0;
      el.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="txt">' + label + '</span>';
      function choose() {
        session.answers[q.key] = val; Store.set(K_SESSION, session);
        $$('.likert-opt', box).forEach(function (o) { o.classList.remove('sel'); o.setAttribute('aria-checked', 'false'); });
        el.classList.add('sel'); el.setAttribute('aria-checked', 'true');
        $('#nextQ').disabled = false;
      }
      el.addEventListener('click', choose);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      box.appendChild(el);
    });

    $('#nextQ').disabled = current === undefined;
    $('#nextQ').textContent = qi === QUESTIONS.length - 1 ? 'Ver mi resultado' : 'Siguiente';
    paintBack();
  }

  var nextQ = $('#nextQ');
  if (nextQ) nextQ.addEventListener('click', function () {
    if (qi < QUESTIONS.length - 1) { qi++; renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { finishBenchmark(); }
  });

  /* ========================================================================
     5 · SCORING Y RESULTADO
     ====================================================================== */
  function levelOf(s) {
    if (s < 1.8) return 'Inicial';
    if (s < 2.6) return 'En desarrollo';
    if (s < 3.4) return 'Intermedio';
    if (s < 4.2) return 'Avanzado';
    return 'Líder';
  }
  function finishBenchmark() {
    var dims = QUESTIONS.map(function (q) {
      return { key: q.key, dim: q.dim, score: session.answers[q.key] || 1, industry: INDUSTRY[q.key] };
    });
    var avg = dims.reduce(function (a, d) { return a + d.score; }, 0) / dims.length;
    var pct = Math.round(100 / (1 + Math.exp(-1.7 * (avg - 3.05))));
    pct = Math.max(3, Math.min(97, pct));
    var gaps = dims.slice().sort(function (a, b) { return (a.score - a.industry) - (b.score - b.industry); }).slice(0, 3);

    session.result = {
      dims: dims, score: avg, level: levelOf(avg), percentile: pct, gaps: gaps,
      generatedAt: new Date().toISOString()
    };
    Store.set(K_SESSION, session);
    upsertLead({
      status: 'Benchmark completo',
      segment: avg >= 3.6 ? 'Alto' : (avg >= 2.7 ? 'Medio' : 'Bajo'),
      mainGap: gaps[0].dim,
      score: Number(avg.toFixed(2)),
      percentile: pct,
      pdf: 'pendiente'
    });
    paintBenchmarkResult();
    goStage(5);
  }

  var SHORT = { 'Eficiencia energética':'Eficiencia', 'Enfriamiento':'Enfriamiento', 'Redundancia':'Redundancia',
    'Capacidad':'Capacidad', 'Madurez operativa':'Operación', 'AI / GPU readiness':'AI ready', 'Sostenibilidad':'Sostenib.' };
  function radarSVG(dims, size) {
    var n = dims.length, cx = size / 2, cy = size / 2, R = size / 2 - 34;
    function pt(i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    function poly(vals, factor) {
      return vals.map(function (v, i) { var p = pt(i, R * (v / 5) * (factor || 1)); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    }
    var rings = [1, .75, .5, .25].map(function (f) {
      return '<polygon points="' + poly(dims.map(function () { return 5; }), f) + '" fill="none" stroke="#4F7C5C" stroke-opacity="' + (f === 1 ? .5 : .22) + '" stroke-width="1"/>';
    }).join('');
    var spokes = dims.map(function (d, i) {
      var p = pt(i, R); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#4F7C5C" stroke-opacity=".22"/>';
    }).join('');
    var labels = dims.map(function (d, i) {
      var p = pt(i, R + 20);
      var anchor = Math.abs(p[0] - cx) < 6 ? 'middle' : (p[0] > cx ? 'start' : 'end');
      var name = SHORT[d.dim] || d.dim;
      return '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '" text-anchor="' + anchor +
        '" font-family="IBM Plex Sans" font-size="9" fill="#8FA08F">' + name + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" style="max-width:300px" role="img" aria-label="Radar de tu score por dimensión contra el promedio de industria">' +
      rings + spokes +
      '<polygon points="' + poly(dims.map(function (d) { return d.industry; })) + '" fill="none" stroke="#4F7C5C" stroke-width="1.4" stroke-dasharray="4 3"/>' +
      '<polygon points="' + poly(dims.map(function (d) { return d.score; })) + '" fill="#D6B667" fill-opacity=".34" stroke="#D6B667" stroke-width="2"/>' +
      labels + '</svg>';
  }

  function barColor(d) {
    if (d.score < d.industry - 0.6) return 'var(--crit)';
    if (d.score < d.industry) return 'var(--gold-500)';
    return 'var(--forest-500)';
  }

  function paintBenchmarkResult() {
    var r = session.result; if (!r) return;
    var W = global.Combwork;

    $('#bLevel').textContent = r.level;
    $('#bPercentile').textContent = 'percentil ' + r.percentile;
    $('#bReading').textContent = 'Tu operación quedó en nivel ' + r.level.toLowerCase() + ', con un score de ' +
      r.score.toFixed(1) + ' sobre 5. Estás por encima del ' + r.percentile +
      '% de los operadores de tamaño y región similares. Tu brecha más grande está en ' + r.gaps[0].dim.toLowerCase() + '.';

    // Panal de score
    if (W && $('#honeySlot')) {
      W.honeycomb($('#honeySlot'), r.dims, { onSelect: openDim });
    }

    // KPIs
    $('#s5Score').textContent = r.score.toFixed(1) + ' / 5';
    $('#s5Level').textContent = 'Nivel ' + r.level;
    $('#s5Pct').textContent = r.percentile;
    $('#s5Gap').textContent = r.gaps[0].dim;
    $('#s5GapD').textContent = r.gaps[0].score.toFixed(1) + ' contra ' + r.gaps[0].industry.toFixed(1) + ' de industria';

    // Tarjetas de brecha
    $('#gapCards').innerHTML = r.gaps.map(function (d, i) {
      return '<div class="card"><span class="chip chip--crit">Brecha ' + (i + 1) + '</span>' +
        '<h4 class="t-h4 mt3">' + d.dim + '</h4>' +
        '<p class="sub mb0">Tu score: ' + d.score.toFixed(1) + ' · promedio de industria: ' + d.industry.toFixed(1) +
        '. Es la dimensión donde más distancia hay contra tus pares.</p></div>';
    }).join('');
  }

  /* Hoja de detalle al tocar una celda del panal -------------------------- */
  function openDim(d) {
    if (!d) return;
    var W = global.Combwork;
    var col = W ? W.severity(d.score, d.industry) : 'var(--forest-500)';
    var delta = d.score - d.industry;
    var veredicto = delta >= 0
      ? 'Estás por encima del promedio de industria en esta dimensión.'
      : (delta < -0.6 ? 'Es una de tus brechas más amplias. Aquí es donde más rápido se recupera score.'
                      : 'Estás ligeramente por debajo del promedio de industria.');
    $('#dimSheet').innerHTML =
      '<div class="row-between mb4"><span class="eyebrow mb0">Dimensión</span>' +
      '<button class="btn btn--ghost btn--sm" data-close-dim>Cerrar</button></div>' +
      '<h2 class="t-h3 mb4">' + d.dim + '</h2>' +
      '<div class="statrow mb4" style="grid-template-columns:1fr 1fr">' +
        '<div class="cell"><span class="k">Tu score</span><div class="v" style="color:' + col + '">' + d.score.toFixed(1) + '</div><div class="d">de 5</div></div>' +
        '<div class="cell"><span class="k">Industria</span><div class="v">' + d.industry.toFixed(1) + '</div><div class="d">promedio del sector</div></div>' +
      '</div>' +
      '<div class="note"><p style="margin:0">' + veredicto + '</p></div>';
    $('#dimDetail').classList.add('open');
  }
  document.addEventListener('click', function (e) {
    if (e.target.matches && e.target.matches('[data-close-dim]')) $('#dimDetail').classList.remove('open');
  });

  var toDeliverable = $('#toDeliverable');
  if (toDeliverable) toDeliverable.addEventListener('click', function () { goStage(6); });

  /* ========================================================================
     6 · ENTREGABLE
     ====================================================================== */
  var openPdf = $('#openPdf');
  if (openPdf) openPdf.addEventListener('click', function () {
    Store.set('combwork.reporte', { calc: session.calc, lead: session.lead, result: session.result });
    upsertLead({ pdf: 'descargado', status: 'Reporte descargado' });
    window.open('reporte.html?print=1', '_blank');
  });
  var emailCopy = $('#emailCopy');
  if (emailCopy) emailCopy.addEventListener('click', function () {
    toast('Enviado a ' + (session.lead ? session.lead.email : 'tu correo') + '. Revisa tu bandeja en los próximos minutos.');
    upsertLead({ emailed: true });
  });
  var resetFlow = $('#resetFlow');
  if (resetFlow) resetFlow.addEventListener('click', function () {
    session = { calc: null, lead: null, answers: {}, result: null };
    Store.set(K_SESSION, session);
    window.location.reload();
  });

  /* ---------- Arranque --------------------------------------------------- */
  (function init() {
    // Si hay datos previos en la sesión, se repueblan los campos.
    if (session.calc) {
      ['itload', 'pue', 'price', 'growth', 'pueTarget'].forEach(function (id) {
        var el = $('#' + id), v = session.calc[id === 'pueTarget' ? 'targetPue' : id];
        if (el && v !== undefined && v !== null && id !== 'pueTarget') el.value = v;
      });
      if ($('#tier')) $('#tier').value = session.calc.tier || '3';
      if ($('#cooling')) $('#cooling').value = session.calc.cooling || 'agua';
    }
    if (session.lead) {
      if ($('#leadName')) $('#leadName').value = session.lead.name || '';
      if ($('#leadCompany')) $('#leadCompany').value = session.lead.company || '';
      if ($('#leadEmail')) $('#leadEmail').value = session.lead.email || '';
      if ($('#leadRole') && session.lead.role) $('#leadRole').value = session.lead.role;
    }
    paintCalc();
    if (session.result) { paintBenchmarkResult(); }
    goStage(1);
  })(window);
})(window);
