/* ============================================================================
   COMBWORK — widgets.js
   Dos visualizaciones propias, en SVG puro para que sirvan igual en pantalla
   y en el PDF impreso:

     Combwork.honeycomb(el, dims, opts)  · panal de score, 7 celdas que se llenan
     Combwork.sankey(el, data, opts)     · flujo de energía, anchos proporcionales
     Combwork.countUp(el, valor, opts)   · números que suben al entrar en pantalla

   Sin dependencias. Respeta prefers-reduced-motion.
   ========================================================================== */
(function (global) {
  'use strict';

  var REDUCE = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var C = {
    deep:    '#0E2A1C',
    green:   '#18844F',
    green300:'#7BD9A6',
    amber:   '#E8A317',
    amber400:'#F5BC3E',
    amber100:'#FCE4A8',
    crit:    '#C0392B',
    line:    '#CFDDD0',
    ink:     '#15211A',
    inkSoft: '#46564C',
    inkFaint:'#61715F',
    gold700: '#8A5A0B',
    white:   '#FFFFFF'
  };

  /* Color por severidad: la misma regla en todo el producto -------------- */
  function severity(score, industry) {
    if (score < industry - 0.6) return C.crit;
    if (score < industry) return C.amber;
    return C.green;
  }

  /* Nombres cortos para que quepan dentro de la celda -------------------- */
  var SHORT = {
    'Eficiencia energética': 'Eficiencia',
    'Enfriamiento': 'Enfriamiento',
    'Redundancia': 'Redundancia',
    'Capacidad': 'Capacidad',
    'Madurez operativa': 'Operación',
    'AI / GPU readiness': 'AI ready',
    'Sostenibilidad': 'Sostenib.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PANAL DE SCORE
     Siete celdas hexagonales en racimo 2-3-2. Cada una se llena de abajo
     hacia arriba según el score, con la línea punteada del promedio de
     industria cruzándola. El color sale de la regla de severidad.
     ══════════════════════════════════════════════════════════════════════ */
  function honeycomb(el, dims, opts) {
    if (!el || !dims || !dims.length) return;
    opts = opts || {};
    var animate = opts.animate !== false && !REDUCE;
    var interactive = opts.interactive !== false;

    var S = 58;                        // radio del hexágono
    var W = Math.sqrt(3) * S;          // ancho (punta arriba)
    var H = 2 * S;                     // alto
    var VS = 0.75 * H;                 // separación vertical entre filas

    // Racimo 2-3-2: fila de 2, fila de 3, fila de 2
    var layout = [
      { x: -W / 2, y: -VS }, { x: W / 2, y: -VS },
      { x: -W, y: 0 }, { x: 0, y: 0 }, { x: W, y: 0 },
      { x: -W / 2, y: VS }, { x: W / 2, y: VS }
    ];

    var PAD = 14;
    var vbW = 3 * W + PAD * 2;
    var vbH = 2 * VS + H + PAD * 2;
    var cx = vbW / 2, cy = vbH / 2;

    // Hexágono punta-arriba
    function hexPathTop(x, y) {
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        pts.push((x + S * Math.cos(a)).toFixed(2) + ',' + (y + S * Math.sin(a)).toFixed(2));
      }
      return 'M' + pts.join('L') + 'Z';
    }

    var uid = 'hc' + Math.random().toString(36).slice(2, 7);
    var cells = '';

    dims.slice(0, 7).forEach(function (d, i) {
      var pos = layout[i]; if (!pos) return;
      var x = cx + pos.x, y = cy + pos.y;
      var col = severity(d.score, d.industry);
      var pct = Math.max(0, Math.min(1, d.score / 5));
      var indPct = Math.max(0, Math.min(1, d.industry / 5));

      var top = y - S, bottom = y + S;
      var fillH = (bottom - top) * pct;
      var fillY = bottom - fillH;
      var indY = bottom - (bottom - top) * indPct;
      var clipId = uid + '-c' + i;

      // ¿el número queda sobre relleno o sobre blanco?
      var numY = y + 4;
      var sobreRelleno = numY > fillY + 6;
      // El ámbar es claro: sobre él el número va en tinta, no en blanco (2.17:1 reprueba AA)
      var claro = (col === C.amber);
      var numColor = sobreRelleno ? (claro ? C.deep : C.white) : C.ink;
      var labColor = (y + 20) > fillY + 4
        ? (claro ? 'rgba(14,42,28,.78)' : 'rgba(255,255,255,.88)')
        : C.inkFaint;

      cells +=
        '<g class="hc-cell" data-i="' + i + '"' + (interactive ? ' tabindex="0" role="button"' : '') +
          ' aria-label="' + esc(d.dim) + ': ' + d.score.toFixed(1) + ' de 5, promedio de industria ' + d.industry.toFixed(1) + '">' +
          '<defs><clipPath id="' + clipId + '"><path d="' + hexPathTop(x, y) + '"/></clipPath></defs>' +
          '<path d="' + hexPathTop(x, y) + '" fill="' + C.white + '" stroke="' + C.line + '" stroke-width="1.5"/>' +
          '<rect class="hc-fill" x="' + (x - S) + '" y="' + (animate ? bottom : fillY) + '" ' +
                'width="' + (S * 2) + '" height="' + (animate ? 0 : fillH) + '" fill="' + col + '" ' +
                'clip-path="url(#' + clipId + ')" ' +
                'data-y="' + fillY.toFixed(2) + '" data-h="' + fillH.toFixed(2) + '"/>' +
          '<line x1="' + (x - S * 0.72) + '" y1="' + indY.toFixed(2) + '" x2="' + (x + S * 0.72) + '" y2="' + indY.toFixed(2) + '" ' +
                'stroke="' + C.deep + '" stroke-width="1.6" stroke-dasharray="4 3" opacity=".62"/>' +
          '<path d="' + hexPathTop(x, y) + '" fill="none" stroke="' + C.line + '" stroke-width="1.5"/>' +
          '<text x="' + x + '" y="' + numY + '" text-anchor="middle" font-family="IBM Plex Mono, monospace" ' +
                'font-size="21" font-weight="600" fill="' + numColor + '">' + d.score.toFixed(1) + '</text>' +
          '<text x="' + x + '" y="' + (y + 22) + '" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" ' +
                'font-size="9.5" fill="' + labColor + '">' + esc(SHORT[d.dim] || d.dim) + '</text>' +
        '</g>';
    });

    el.innerHTML =
      '<svg class="hc-svg" viewBox="0 0 ' + vbW.toFixed(0) + ' ' + vbH.toFixed(0) + '" ' +
        'role="img" aria-label="Panal de score por dimensión">' + cells + '</svg>' +
      '<div class="hc-legend">' +
        '<span><i style="background:' + C.green + '"></i>Igual o arriba del promedio</span>' +
        '<span><i style="background:' + C.amber + '"></i>Debajo del promedio</span>' +
        '<span><i style="background:' + C.crit + '"></i>Brecha amplia</span>' +
        '<span><i class="dash"></i>Promedio de industria</span>' +
      '</div>';

    // Llenado animado al entrar en pantalla
    if (animate) {
      var run = function () {
        Array.prototype.forEach.call(el.querySelectorAll('.hc-fill'), function (r, k) {
          setTimeout(function () {
            r.style.transition = 'y .85s cubic-bezier(.2,.7,.3,1), height .85s cubic-bezier(.2,.7,.3,1)';
            r.setAttribute('y', r.dataset.y);
            r.setAttribute('height', r.dataset.h);
          }, k * 90);
        });
      };
      onVisible(el, run);
    }

    // Detalle al tocar una celda
    if (interactive && typeof opts.onSelect === 'function') {
      Array.prototype.forEach.call(el.querySelectorAll('.hc-cell'), function (g) {
        var pick = function () { opts.onSelect(dims[Number(g.dataset.i)]); };
        g.addEventListener('click', pick);
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     FLUJO DE ENERGÍA
     Sankey de dos niveles con anchos estrictamente proporcionales al gasto.
     Arriba la carga útil, abajo lo que no produce, y ese ramal se abre en
     enfriamiento, distribución y otros.
     ══════════════════════════════════════════════════════════════════════ */
  function sankey(el, data, opts) {
    if (!el || !data) return;
    opts = opts || {};
    var animate = opts.animate !== false && !REDUCE;

    var total = data.total;
    var useful = data.useful;
    var over = data.overhead;
    var subs = data.breakdown || [];

    var VB_W = 760, VB_H = 300;
    var X0 = 8, X1 = 200, X2 = 400, X3 = 560;   // columnas del diagrama
    var TRACK = 210;                             // altura que representa el 100%
    var TOP = 34;

    var usefulH = TRACK * (useful / total);
    var overH = TRACK * (over / total);

    var srcY = TOP, srcH = TRACK;
    var usefulY = TOP;                    // el ramal útil sube
    var overY = TOP + usefulH + 14;       // el ramal de desperdicio baja, con aire

    function band(x1, y1, h1, x2, y2, h2, fill, op, cls, delay) {
      var mx = (x1 + x2) / 2;
      var d = 'M' + x1 + ',' + y1 +
              ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 +
              ' L' + x2 + ',' + (y2 + h2) +
              ' C' + mx + ',' + (y2 + h2) + ' ' + mx + ',' + (y1 + h1) + ' ' + x1 + ',' + (y1 + h1) + 'Z';
      return '<path class="' + cls + '" d="' + d + '" fill="' + fill + '" opacity="' + (animate ? 0 : op) + '" ' +
             'data-op="' + op + '" style="' + (animate ? 'transition:opacity .7s ease ' + delay + 's' : '') + '"/>';
    }

    var g = '';
    // barra de origen
    g += '<rect x="' + X0 + '" y="' + srcY + '" width="14" height="' + srcH + '" rx="4" fill="' + C.deep + '"/>';

    // cintas de primer nivel
    g += band(X0 + 14, srcY, usefulH, X1, usefulY, usefulH, C.green, .82, 'sk-band', 0);
    g += band(X0 + 14, srcY + usefulH, overH, X1, overY, overH, C.amber, .82, 'sk-band', .15);

    // nodos de primer nivel
    g += '<rect x="' + X1 + '" y="' + usefulY + '" width="12" height="' + usefulH + '" rx="3" fill="' + C.green + '"/>';
    g += '<rect x="' + X1 + '" y="' + overY + '" width="12" height="' + overH + '" rx="3" fill="' + C.amber + '"/>';

    // segundo nivel: el ramal de desperdicio se abre
    var accIn = overY, accOut = overY, subG = '', subLabels = '';
    subs.forEach(function (sb, i) {
      var h = overH * (sb.value / over);
      var yOut = accOut + (i * 10);
      subG += band(X1 + 12, accIn, h, X2, yOut, h, C.amber, .34 + i * .1, 'sk-band', .3 + i * .12);
      subG += '<rect x="' + X2 + '" y="' + yOut + '" width="10" height="' + Math.max(h, 3) + '" rx="2.5" fill="' + C.amber + '" opacity=".75"/>';
      subLabels +=
        '<text x="' + (X2 + 22) + '" y="' + (yOut + Math.max(h, 10) / 2 - 2) + '" font-family="IBM Plex Sans, sans-serif" ' +
          'font-size="11" fill="' + C.inkSoft + '">' + esc(sb.name) + '</text>' +
        '<text x="' + (X2 + 22) + '" y="' + (yOut + Math.max(h, 10) / 2 + 12) + '" font-family="IBM Plex Mono, monospace" ' +
          'font-size="11.5" font-weight="600" fill="' + C.ink + '">' + esc(sb.label) + '</text>';
      accIn += h; accOut = yOut + h;
    });
    g += subG;

    // etiquetas de primer nivel
    var lab =
      '<text x="' + X0 + '" y="' + (srcY - 16) + '" font-family="IBM Plex Mono, monospace" font-size="10" ' +
        'letter-spacing="1" fill="' + C.gold700 + '">' + '</text>' +
      '<text x="' + (X1 + 22) + '" y="' + (usefulY + usefulH / 2 - 4) + '" font-family="IBM Plex Sans, sans-serif" ' +
        'font-size="12.5" fill="' + C.inkSoft + '">Carga útil de TI</text>' +
      '<text x="' + (X1 + 22) + '" y="' + (usefulY + usefulH / 2 + 16) + '" font-family="IBM Plex Mono, monospace" ' +
        'font-size="16" font-weight="600" fill="' + C.green + '">' + esc(data.usefulLabel) + '</text>' +
      '<text x="' + (X1 + 22) + '" y="' + (overY - 10) + '" font-family="IBM Plex Sans, sans-serif" ' +
        'font-size="12.5" fill="' + C.inkSoft + '">Capacidad que no produce</text>' +
      '<text x="' + (X1 + 22) + '" y="' + (overY + 12) + '" font-family="IBM Plex Mono, monospace" ' +
        'font-size="16" font-weight="600" fill="' + C.gold700 + '">' + esc(data.overheadLabel) + '</text>';

    // etiqueta del total, sobre la barra de origen
    lab +=
      '<text x="' + X0 + '" y="' + (srcY - 16) + '" font-family="IBM Plex Mono, monospace" font-size="9.5" ' +
        'letter-spacing=".8" fill="' + C.inkFaint + '">TOTAL ANUAL</text>' +
      '<text x="' + X0 + '" y="' + (srcY + srcH + 22) + '" font-family="IBM Plex Mono, monospace" font-size="13" ' +
        'font-weight="600" fill="' + C.ink + '">' + esc(data.totalLabel) + '</text>';

    el.innerHTML =
      '<svg class="sk-svg" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" role="img" ' +
        'aria-label="Flujo de energía: de ' + esc(data.totalLabel) + ' anuales, ' + esc(data.usefulLabel) +
        ' llegan a producir cómputo y ' + esc(data.overheadLabel) + ' se van en el facility">' +
        g + lab + subLabels +
      '</svg>';

    if (animate) {
      onVisible(el, function () {
        Array.prototype.forEach.call(el.querySelectorAll('.sk-band'), function (pth) {
          requestAnimationFrame(function () { pth.style.opacity = pth.dataset.op; });
        });
      });
    }
  }


  /* ══════════════════════════════════════════════════════════════════════
     BRECHA DE PUE
     La escala real de PUE con las tres referencias marcadas. Es el gráfico
     del hero: una sola idea, se dibuja una vez y se queda quieto.
     ══════════════════════════════════════════════════════════════════════ */
  function pueGap(el, opts) {
    if (!el) return;
    opts = opts || {};
    var animate = opts.animate !== false && !REDUCE;
    var MIN = 1.0, MAX = 2.2;
    var W = 560, H = 268, X = 34, RW = W - X - 34, BY = 158, BH = 30;

    function px(v) { return X + RW * ((Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN)); }

    var best = opts.best || 1.25, ind = opts.industry || 1.58, you = opts.you || null;

    var zonas =
      '<rect x="' + X + '" y="' + BY + '" width="' + (px(1.35) - X) + '" height="' + BH + '" fill="' + C.green + '" opacity=".9" rx="3"/>' +
      '<rect x="' + px(1.35) + '" y="' + BY + '" width="' + (px(1.7) - px(1.35)) + '" height="' + BH + '" fill="' + C.amber + '" opacity=".9"/>' +
      '<rect x="' + px(1.7) + '" y="' + BY + '" width="' + (X + RW - px(1.7)) + '" height="' + BH + '" fill="' + C.crit + '" opacity=".85" rx="3"/>';

    // banda recuperable, entre mejores prácticas y el promedio
    var recup =
      '<rect class="pg-band" x="' + px(best) + '" y="' + (BY - 13) + '" width="' + (animate ? 0 : px(ind) - px(best)) +
        '" height="' + (BH + 26) + '" fill="none" stroke="' + C.deep + '" stroke-width="1.6" stroke-dasharray="5 4" rx="5" ' +
        'data-w="' + (px(ind) - px(best)) + '"/>' +
      '<text x="' + (px(ind) + 12) + '" y="' + (BY + BH / 2 + 4) + '" ' +
        'font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing=".6" fill="' + C.deep + '">RECUPERABLE</text>';

    function marca(v, txt, sub, arriba) {
      var x = px(v);
      var y1 = arriba ? BY - 34 : BY + BH + 40;
      var ty = arriba ? y1 - 8 : y1 + 14;
      return '<line x1="' + x + '" y1="' + (arriba ? y1 + 4 : BY + BH + 4) + '" x2="' + x + '" y2="' + (arriba ? BY - 2 : y1 - 4) + '" ' +
             'stroke="' + C.deep + '" stroke-width="1.6"/>' +
             '<circle cx="' + x + '" cy="' + (arriba ? BY - 2 : BY + BH + 2) + '" r="3.5" fill="' + C.deep + '"/>' +
             '<text x="' + x + '" y="' + ty + '" text-anchor="middle" font-family="IBM Plex Mono, monospace" ' +
               'font-size="13" font-weight="600" fill="' + C.ink + '">' + txt + '</text>' +
             '<text x="' + x + '" y="' + (ty + 15) + '" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" ' +
               'font-size="10.5" fill="' + C.inkSoft + '">' + esc(sub) + '</text>';
    }

    var ejes =
      '<text x="' + X + '" y="' + (BY + BH + 20) + '" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="' + C.inkFaint + '">PUE 1.0</text>' +
      '<text x="' + (X + RW) + '" y="' + (BY + BH + 20) + '" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="' + C.inkFaint + '">2.2</text>';

    var cabecera =
      '<text x="' + X + '" y="24" font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="1.2" fill="' + C.gold700 + '">LA BRECHA QUE MEDIMOS</text>' +
      '<text x="' + X + '" y="70" font-family="Source Serif 4, Georgia, serif" font-size="44" font-weight="700" fill="' + C.ink + '">37%</text>' +
      '<text x="' + (X + 104) + '" y="58" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="' + C.inkSoft + '">de la energía no llega</text>' +
      '<text x="' + (X + 104) + '" y="75" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="' + C.inkSoft + '">al equipo de TI</text>';

    el.innerHTML =
      '<svg class="pg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
        'aria-label="Escala de PUE: mejores prácticas en 1.25, promedio de industria en 1.58. En el promedio, 37% de la energía no llega al equipo de TI.">' +
        cabecera + zonas + recup +
        marca(best, best.toFixed(2), 'mejores prácticas', true) +
        marca(ind, ind.toFixed(2), 'promedio de industria', false) +
        (you ? marca(you, you.toFixed(2), 'tu operación', true) : '') +
        ejes +
      '</svg>';

    if (animate) {
      onVisible(el, function () {
        var band = el.querySelector('.pg-band');
        if (band) {
          band.style.transition = 'width .9s cubic-bezier(.2,.7,.3,1) .25s';
          requestAnimationFrame(function () { band.setAttribute('width', band.dataset.w); });
        }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     NÚMEROS QUE SUBEN
     ══════════════════════════════════════════════════════════════════════ */
  function countUp(el, value, opts) {
    if (!el) return;
    opts = opts || {};
    var fmt = opts.format || function (v) { return Math.round(v).toLocaleString('en-US'); };
    if (REDUCE) { el.textContent = fmt(value); return; }
    onVisible(el, function () {
      var dur = opts.duration || 900, t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(value * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = fmt(value);
      }
      requestAnimationFrame(step);
    });
  }

  /* Dispara una vez cuando el elemento entra en pantalla ------------------ */
  function onVisible(el, fn) {
    if (!('IntersectionObserver' in global)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.disconnect(); fn(); }
      });
    }, { threshold: 0.25 });
    io.observe(el);
  }

  global.Combwork = {
    honeycomb: honeycomb,
    sankey: sankey,
    pueGap: pueGap,
    countUp: countUp,
    severity: severity,
    colors: C
  };
})(window);
