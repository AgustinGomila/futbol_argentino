// Vista: Resumen estadístico (#/resumen). Panorama de TODO lo relevado en el sitio: Primera División (amateur y
// profesional), Segunda División, copas nacionales y copas internacionales. Indicadores (partidos, goles, equipos distintos
// argentinos/extranjeros, competiciones, años, reparto local/empate/visitante), gráfico por año, desglose
// por competición y récords (mayores goleadas, partidos con más goles). Filtrable por rango de años, ámbito
// y competición; el filtro vive en el query del hash (#/resumen?d=1931&h=1966&a=liga&c=...).
//
// Criterios:
//  - Año de un partido = el de su FECHA (calendario), no el de la edición/temporada; si la fecha falta, el
//    año del torneo (p.t) o la edición (p.e).
//  - Partido "jugado" = con marcador. Los no disputados (sin gl/gv) se cuentan aparte y no suman goles.
//  - Equipo = nombre canónico tal como compitió (una denominación vieja o un club luego fusionado cuenta
//    como equipo propio). Argentino = está en registro.json; extranjero = el resto (las copas
//    internacionales los traen con el país entre paréntesis).
// Todo se computa en el cliente desde los JSON publicados (partidos.json ya incluye las copas nacionales; la
// Segunda viene de segunda_partidos.json).

import {botonCSV, botonVerMas, clubHref, el, setEstadoRuta} from '../main.js';
import {loadJSON} from '../data.js';
import {clubIndex} from '../clubes_ui.js';
import {COPAS_INTL} from '../competiciones.js';
import {torneoHref, torneoNombre} from '../torneos.js';

const AMBITOS = [['', 'Todos los ámbitos'], ['liga', 'Primera División'], ['seg', 'Segunda División'],
  ['nac', 'Copas nacionales'], ['intl', 'Copas internacionales']];
const AMB_LABEL = {liga: 'Primera División', seg: 'Segunda División', nac: 'Copa nacional', intl: 'Copa internacional'};
const METRICAS = [['pj', 'Partidos'], ['goles', 'Goles'], ['prom', 'Goles por partido']];

const nf = new Intl.NumberFormat('es-AR');
const n = (x) => nf.format(x);
const dec = (x) => x.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0).toLocaleString('es-AR');

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const fmtFecha = (f) => {
  const m = ISO.exec(String(f || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f || '');
};
const anioDe = (...vals) => {
  for (const v of vals) {
    const m = /(\d{4})/.exec(v == null ? '' : String(v));
    if (m) return +m[1];
  }
  return 0;
};

export async function render(container, params = {}) {
  const [partidos, registro, escudos, tnombres, segunda, ...intlJsons] = await Promise.all([
    loadJSON('partidos'), loadJSON('registro'), loadJSON('escudos'), loadJSON('torneo_nombres'),
    loadJSON('segunda_partidos'),
    ...COPAS_INTL.map(([b]) => loadJSON(b)),
  ]);
  if (!partidos) {
    container.append(el('h2', {}, 'Resumen estadístico'),
      el('p', {class: 'error'}, 'No se pudieron cargar los partidos. Corré scripts/build_web.py.'));
    return;
  }

  // --- catálogo de competiciones y registros normalizados (una sola pasada) ---
  const comps = new Map();   // key -> {key, label, amb, ruta}
  const addComp = (key, label, amb, ruta) => {
    if (!comps.has(key)) comps.set(key, {key, label, amb, ruta});
    return key;
  };
  const recs = [];
  for (const p of partidos) {
    let comp, ed;
    if (p.era === 'copa') {
      comp = addComp('nac:' + p.t, p.t, 'nac', '#/copas?c=' + encodeURIComponent(p.t));
      ed = p.t + '|' + p.e;
    } else {
      const amateur = p.era === 'amateur';
      comp = addComp(amateur ? 'liga:amateur' : 'liga:profesional',
        amateur ? 'Primera División · era amateur' : 'Primera División · era profesional', 'liga',
        '#/tabla-historica');
      ed = p.t;
    }
    recs.push({
      y: anioDe(p.f, p.t, p.e), comp, ed, l: p.l, v: p.v, gl: p.gl, gv: p.gv, f: p.f || '',
      edLabel: torneoNombre(tnombres, p), edHref: torneoHref(tnombres, p),
    });
  }
  // Segunda División (Primera B Nacional / Primera Nacional): una competición, edición = temporada (p.g).
  if (segunda && segunda.length) {
    const comp = addComp('seg:segunda', 'Segunda División', 'seg', '#/segunda');
    for (const p of segunda) {
      if (p.pr) continue;   // promociones con otras categorías (pr=1): solo para la ficha del club
      recs.push({
        y: anioDe(p.f, p.t), comp, ed: 'seg|' + p.g, l: p.l, v: p.v, gl: p.gl, gv: p.gv, f: p.f || '',
        edLabel: p.t, edHref: '#/segunda?t=' + encodeURIComponent(p.g),
      });
    }
  }
  COPAS_INTL.forEach(([base, label, ruta], i) => {
    const comp = addComp('intl:' + base, label, 'intl', ruta);
    for (const m of (intlJsons[i] || [])) {
      recs.push({
        y: anioDe(m.f, m.e), comp, ed: base + '|' + m.e, l: m.l, v: m.v, gl: m.gl, gv: m.gv, f: m.f || '',
        edLabel: `${label} ${m.e}`, edHref: `${ruta}?e=${encodeURIComponent(m.e)}`,
      });
    }
  });

  const anios = recs.map((r) => r.y).filter(Boolean);
  const minY = Math.min(...anios), maxY = Math.max(...anios);
  const listaComps = [...comps.values()].sort((a, b) =>
    a.amb === b.amb ? a.label.localeCompare(b.label, 'es') : 0);

  const {idDe, label} = clubIndex(registro);
  const esArg = (nombre) => idDe[nombre] != null;
  const clubCel = (nombre) => {
    const img = escudos && escudos[nombre]
      ? el('img', {src: 'images/' + escudos[nombre], class: 'escudo', alt: ''}) : null;
    const kids = [img, label(nombre)].filter(Boolean);
    const cid = idDe[nombre];
    return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, kids) : el('span', {}, ...kids));
  };

  // --- estado (enlazable) ---
  const yParam = (v, def) => (+v >= minY && +v <= maxY ? +v : def);
  const estado = {
    desde: yParam(params.d, minY), hasta: yParam(params.h, maxY),
    amb: AMBITOS.some(([k]) => k && k === params.a) ? params.a : '',
    comp: comps.has(params.c) ? params.c : '',
    metrica: METRICAS.some(([k]) => k === params.m) ? params.m : 'pj',
    sortKey: 'pj', sortDir: -1,
  };
  if (estado.comp) estado.amb = comps.get(estado.comp).amb;
  if (estado.desde > estado.hasta) [estado.desde, estado.hasta] = [estado.hasta, estado.desde];

  // --- controles ---
  const opcAnios = () => Array.from({length: maxY - minY + 1}, (_, i) =>
    el('option', {value: String(minY + i)}, String(minY + i)));
  const selDesde = el('select', {class: 'filtro', 'aria-label': 'Desde el año'}, ...opcAnios());
  const selHasta = el('select', {class: 'filtro', 'aria-label': 'Hasta el año'}, ...opcAnios());
  const selAmb = el('select', {class: 'filtro', 'aria-label': 'Ámbito'},
    ...AMBITOS.map(([k, t]) => el('option', {value: k}, t)));
  const selComp = el('select', {class: 'filtro est-comp', 'aria-label': 'Competición'});
  const btnReset = el('button', {type: 'button', class: 'btn-csv'}, 'Restablecer');

  function poblarComps() {
    const grupos = AMBITOS.filter(([k]) => k && (!estado.amb || estado.amb === k)).map(([k, t]) =>
      el('optgroup', {label: t}, ...listaComps.filter((c) => c.amb === k)
        .map((c) => el('option', {value: c.key}, c.label))));
    selComp.replaceChildren(el('option', {value: ''}, 'Todas las competiciones'), ...grupos);
    selComp.value = estado.comp;
  }

  function sincronizarControles() {
    selDesde.value = String(estado.desde);
    selHasta.value = String(estado.hasta);
    selAmb.value = estado.amb;
    poblarComps();
  }

  const cambiar = () => {
    if (estado.desde > estado.hasta) [estado.desde, estado.hasta] = [estado.hasta, estado.desde];
    sincronizarControles();
    setEstadoRuta({
      d: estado.desde !== minY ? estado.desde : '', h: estado.hasta !== maxY ? estado.hasta : '',
      a: estado.amb, c: estado.comp, m: estado.metrica !== 'pj' ? estado.metrica : '',
    });
    dibujar();
  };
  selDesde.addEventListener('change', () => {
    estado.desde = +selDesde.value;
    cambiar();
  });
  selHasta.addEventListener('change', () => {
    estado.hasta = +selHasta.value;
    cambiar();
  });
  selAmb.addEventListener('change', () => {
    estado.amb = selAmb.value;
    if (estado.comp && comps.get(estado.comp).amb !== estado.amb && estado.amb) estado.comp = '';
    cambiar();
  });
  selComp.addEventListener('change', () => {
    estado.comp = selComp.value;
    if (estado.comp) estado.amb = comps.get(estado.comp).amb;
    cambiar();
  });
  btnReset.addEventListener('click', () => {
    Object.assign(estado, {desde: minY, hasta: maxY, amb: '', comp: ''});
    cambiar();
  });

  // --- agregación del subconjunto filtrado ---
  function agregar() {
    const sel = recs.filter((r) => r.y >= estado.desde && r.y <= estado.hasta
      && (!estado.amb || comps.get(r.comp).amb === estado.amb)
      && (!estado.comp || r.comp === estado.comp));
    const tot = {pj: 0, sinRes: 0, goles: 0, L: 0, E: 0, V: 0};
    const equipos = new Set(), eds = new Set(), compsSel = new Set(), aniosSel = new Set();
    const porAnio = new Map(), porComp = new Map();
    const jugados = [];
    for (const r of sel) {
      equipos.add(r.l);
      equipos.add(r.v);
      eds.add(r.ed);
      compsSel.add(r.comp);
      aniosSel.add(r.y);
      let c = porComp.get(r.comp);
      if (!c) porComp.set(r.comp, c = {pj: 0, goles: 0, eds: new Set(), eq: new Set(), y0: r.y, y1: r.y});
      c.eds.add(r.ed);
      c.eq.add(r.l);
      c.eq.add(r.v);
      c.y0 = Math.min(c.y0, r.y);
      c.y1 = Math.max(c.y1, r.y);
      if (r.gl == null || r.gv == null) {
        tot.sinRes++;
        continue;
      }
      const g = r.gl + r.gv;
      tot.pj++;
      tot.goles += g;
      tot[r.gl > r.gv ? 'L' : r.gl < r.gv ? 'V' : 'E']++;
      c.pj++;
      c.goles += g;
      const a = porAnio.get(r.y) || {pj: 0, goles: 0};
      a.pj++;
      a.goles += g;
      porAnio.set(r.y, a);
      jugados.push(r);
    }
    let arg = 0;
    for (const e of equipos) if (esArg(e)) arg++;
    return {sel, tot, equipos, arg, eds, compsSel, aniosSel, porAnio, porComp, jugados};
  }

  // --- piezas de la salida ---
  const kpi = (etq, valor, sub) => el('div', {class: 'est-kpi'},
    el('div', {class: 'est-kpi-label'}, etq),
    el('div', {class: 'est-kpi-valor'}, valor),
    sub ? el('div', {class: 'est-kpi-sub'}, sub) : '');

  function kpis(A) {
    const {tot} = A;
    const anios = [...A.aniosSel].sort((a, b) => a - b);
    return el('div', {class: 'est-kpis'},
      kpi('Partidos relevados', n(tot.pj),
        tot.sinRes ? `+ ${n(tot.sinRes)} sin resultado (no disputados)` : 'todos con resultado'),
      kpi('Goles', n(tot.goles), `${tot.pj ? dec(tot.goles / tot.pj) : '0'} por partido`),
      kpi('Equipos distintos', n(A.equipos.size),
        `${n(A.arg)} argentinos · ${n(A.equipos.size - A.arg)} extranjeros`),
      kpi('Competiciones', n(A.compsSel.size), `${n(A.eds.size)} ediciones o temporadas`),
      kpi('Años con partidos', n(anios.length),
        anios.length ? `${anios[0]}–${anios[anios.length - 1]}` : ''),
      kpi('Ganó el local', `${pct(tot.L, tot.pj)} %`,
        `Empate ${pct(tot.E, tot.pj)} % · Visitante ${pct(tot.V, tot.pj)} %`));
  }

  // Gráfico de columnas por año (una serie). Tooltip por año; clic en un año = filtrar a ese año.
  const graf = el('div', {class: 'est-graf'});
  const tooltip = el('div', {class: 'est-tip', hidden: true});
  let datosGraf = null;
  const SVG = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs = {}, ...kids) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.append(...kids);
    return node;
  };
  const valorMetrica = (a) => !a ? 0
    : estado.metrica === 'pj' ? a.pj : estado.metrica === 'goles' ? a.goles : (a.pj ? a.goles / a.pj : 0);
  const fmtMetrica = (v) => (estado.metrica === 'prom' ? dec(v) : n(v));
  const pasoLindo = (max, objetivo = 4) => {
    const bruto = max / objetivo || 1;
    const mag = 10 ** Math.floor(Math.log10(bruto));
    const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto);
    return estado.metrica === 'prom' ? paso : Math.max(1, Math.round(paso));
  };

  function dibujarGrafico() {
    if (!datosGraf) return;
    const {y0, y1, porAnio} = datosGraf;
    const cs = getComputedStyle(graf);   // ancho ÚTIL (sin el padding del recuadro)
    const W = Math.max(280, (graf.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 900);
    const H = 220;
    const M = {t: 10, r: 6, b: 24, l: 46};
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const nAnios = y1 - y0 + 1;
    const vals = Array.from({length: nAnios}, (_, i) => valorMetrica(porAnio.get(y0 + i)));
    const paso = pasoLindo(Math.max(...vals, 0));
    const top = Math.max(paso, Math.ceil(Math.max(...vals, 0) / paso) * paso);
    const slot = pw / nAnios;
    const bw = Math.max(1, Math.min(24, slot - 2));
    const yPx = (v) => M.t + ph - (v / top) * ph;
    const base = M.t + ph;

    // width 100% + viewBox: el SVG nunca impone su ancho al layout (escala si el contenedor cambia).
    const svg = sv('svg', {
      width: '100%', viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `${METRICAS.find(([k]) => k === estado.metrica)[1]} por año, ${y0}–${y1}`
    });
    for (let v = 0; v <= top + 1e-9; v += paso) {   // grilla + eje Y
      const y = yPx(v);
      svg.append(sv('line', {x1: M.l, x2: W - M.r, y1: y, y2: y, class: 'est-grid'}),
        sv('text', {x: M.l - 6, y: y + 4, class: 'est-eje', 'text-anchor': 'end'}, fmtMetrica(v)));
    }
    const cabe = Math.max(1, Math.floor(pw / 44));   // etiquetas del eje X: paso "redondo" que entre
    const pasoX = [1, 2, 5, 10, 20, 25, 50].find((k) => nAnios / k <= cabe) || 50;
    const barras = [];
    vals.forEach((v, i) => {
      const anio = y0 + i;
      const x = M.l + i * slot + (slot - bw) / 2;
      if (anio % pasoX === 0 || nAnios === 1) {
        svg.append(sv('text', {x: x + bw / 2, y: H - 6, class: 'est-eje', 'text-anchor': 'middle'},
          String(anio)));
      }
      if (v <= 0) {
        barras.push(null);
        return;
      }
      const y = yPx(v), r = Math.min(4, bw / 2, base - y);   // extremo redondeado, base recta
      const d = `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${base}Z`;
      const bar = sv('path', {d, class: 'est-barra'});
      barras.push(bar);
      svg.append(bar);
    });
    svg.append(sv('line', {x1: M.l, x2: W - M.r, y1: base, y2: base, class: 'est-base'}));

    // capa de hover: todo el alto del slot es zona de acierto (más grande que la barra)
    const capa = sv('rect', {x: M.l, y: M.t, width: pw, height: ph, class: 'est-capa'});
    let activo = -1;
    const idxDe = (ev) => {
      const rc = svg.getBoundingClientRect();
      const esc = rc.width / W || 1;   // px reales por unidad del viewBox
      return Math.floor(((ev.clientX - rc.left) / esc - M.l) / slot);
    };
    capa.addEventListener('mousemove', (ev) => {
      const i = Math.max(0, Math.min(nAnios - 1, idxDe(ev)));
      if (i !== activo) {
        if (barras[activo]) barras[activo].classList.remove('activa');
        if (barras[i]) barras[i].classList.add('activa');
        activo = i;
      }
      const a = porAnio.get(y0 + i);
      tooltip.replaceChildren(el('b', {}, String(y0 + i)),
        el('span', {}, `${n(a ? a.pj : 0)} partidos`),
        el('span', {}, `${n(a ? a.goles : 0)} goles`),
        el('span', {}, `${a && a.pj ? dec(a.goles / a.pj) : '—'} goles por partido`),
        nAnios > 1 && a ? el('span', {class: 'est-tip-ayuda'}, 'Clic para ver sólo este año') : '');
      tooltip.hidden = false;
      // coordenadas del viewBox -> px dentro de .est-graf (contenedor posicionado, con padding)
      const rg = graf.getBoundingClientRect(), rs = svg.getBoundingClientRect();
      const esc = rs.width / W || 1;
      const cx = rs.left - rg.left + (M.l + i * slot + slot / 2) * esc;
      tooltip.style.left = `${Math.min(Math.max(cx, 80), rg.width - 80)}px`;
      tooltip.style.top = `${Math.max(0, rs.top - rg.top + yPx(valorMetrica(a)) * esc - 8)}px`;
    });
    capa.addEventListener('mouseleave', () => {
      if (barras[activo]) barras[activo].classList.remove('activa');
      activo = -1;
      tooltip.hidden = true;
    });
    capa.addEventListener('click', (ev) => {
      const i = idxDe(ev);
      if (nAnios > 1 && i >= 0 && i < nAnios && porAnio.get(y0 + i)) {
        estado.desde = estado.hasta = y0 + i;
        tooltip.hidden = true;
        cambiar();
      }
    });
    svg.append(capa);
    graf.replaceChildren(svg, tooltip);
  }

  let pendiente = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      if (graf.isConnected) dibujarGrafico();
    });
  }).observe(graf);

  const segMetrica = el('div', {class: 'est-seg', role: 'group', 'aria-label': 'Métrica del gráfico'},
    ...METRICAS.map(([k, t]) => {
      const b = el('button', {type: 'button', 'data-k': k}, t);
      b.addEventListener('click', () => {
        estado.metrica = k;
        cambiar();
      });
      return b;
    }));

  function tablaAnios(A) {
    const filas = [...A.porAnio.entries()].sort((a, b) => a[0] - b[0]);
    return el('table', {class: 'posiciones stats est-tabla-anios'},
      el('thead', {}, el('tr', {}, el('th', {class: 'num'}, 'Año'), el('th', {class: 'num'}, 'Partidos'),
        el('th', {class: 'num'}, 'Goles'), el('th', {class: 'num'}, 'Prom.'))),
      el('tbody', {}, ...filas.map(([y, a]) => el('tr', {},
        el('td', {class: 'num'}, String(y)), el('td', {class: 'num'}, n(a.pj)),
        el('td', {class: 'num'}, n(a.goles)), el('td', {class: 'num'}, dec(a.goles / a.pj))))));
  }

  // Desglose por competición: ordenable por columna; fila de totales al pie.
  const COLS = [['comp', 'Competición', 'txt'], ['amb', 'Ámbito', 'txt'], ['periodo', 'Período', 'txt'],
    ['eds', 'Ediciones', 'num'], ['pj', 'Partidos', 'num'], ['goles', 'Goles', 'num'],
    ['prom', 'Prom.', 'num'], ['eq', 'Equipos', 'num']];

  function tablaComps(A) {
    const filas = [...A.porComp.entries()].map(([k, c]) => {
      const meta = comps.get(k);
      return {
        key: k, comp: meta.label, ruta: meta.ruta, amb: AMB_LABEL[meta.amb],
        periodo: c.y0 === c.y1 ? String(c.y0) : `${c.y0}–${c.y1}`, y0: c.y0,
        eds: c.eds.size, pj: c.pj, goles: c.goles, prom: c.pj ? c.goles / c.pj : 0, eq: c.eq.size,
      };
    });
    const {sortKey: sk, sortDir: sd} = estado;
    filas.sort((a, b) => {
      const x = sk === 'periodo' ? a.y0 : a[sk], y = sk === 'periodo' ? b.y0 : b[sk];
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * sd
        || b.pj - a.pj;
    });
    const anios = [...A.aniosSel];
    const cel = (f, k, cls) => {
      if (k === 'comp') return el('td', {class: cls}, el('a', {href: f.ruta}, f.comp));
      const v = f[k];
      return el('td', {class: cls}, k === 'prom' ? dec(v) : typeof v === 'number' ? n(v) : v);
    };
    return el('table', {class: 'posiciones stats est-tabla-comps'},
      el('thead', {}, el('tr', {}, ...COLS.map(([k, t, cls]) => el('th', {
        class: (k === sk ? 'sorted ' : '') + cls,
        'aria-sort': k === sk ? (sd === 1 ? 'ascending' : 'descending') : 'none',
        onclick: () => {
          estado.sortDir = estado.sortKey === k ? -estado.sortDir : (cls === 'txt' ? 1 : -1);
          estado.sortKey = k;
          dibujar();
        },
      }, t + (k === sk ? (sd === 1 ? ' ▲' : ' ▼') : ''))))),
      el('tbody', {}, ...filas.map((f) => el('tr', {}, ...COLS.map(([k, , cls]) => cel(f, k, cls))))),
      el('tfoot', {}, el('tr', {class: 'total'},
        el('td', {class: 'txt'}, 'Total'), el('td', {class: 'txt'}, ''),
        el('td', {class: 'txt'}, anios.length ? `${Math.min(...anios)}–${Math.max(...anios)}` : ''),
        el('td', {class: 'num'}, n(A.eds.size)), el('td', {class: 'num'}, n(A.tot.pj)),
        el('td', {class: 'num'}, n(A.tot.goles)),
        el('td', {class: 'num'}, A.tot.pj ? dec(A.tot.goles / A.tot.pj) : '—'),
        el('td', {class: 'num'}, n(A.equipos.size)))));
  }

  // Récords: top 5 por criterio (ampliable de a 10 con "Ver 10 más"), desempate por fecha (el más antiguo primero).
  const filaRecord = (r) => el('tr', {},
    el('td', {class: 'txt'}, fmtFecha(r.f) || String(r.y)),
    el('td', {class: 'txt'}, r.edHref ? el('a', {href: r.edHref}, r.edLabel) : r.edLabel),
    clubCel(r.l), el('td', {class: 'num'}, `${r.gl}-${r.gv}`), clubCel(r.v));

  // `lista` = ranking completo; devuelve la tabla (top 5) y su botón "Ver 10 más" (null si no hay más).
  function tablaRecords(lista) {
    const tbody = el('tbody', {}, ...lista.slice(0, 5).map(filaRecord));
    const tabla = el('table', {class: 'posiciones sub-partidos est-records'},
      el('thead', {}, el('tr', {}, el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Competición'),
        el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'), el('th', {class: 'txt'}, 'Visitante'))),
      tbody);
    return {tabla, mas: botonVerMas(tbody, lista, filaRecord, 5)};
  }

  const ranking = (arr, clave) => arr.slice().sort((a, b) => clave(b) - clave(a) || String(a.f).localeCompare(String(b.f)));

  const salida = el('div', {class: 'est-salida'});
  let tablasCSV = [];

  function dibujar() {
    const A = agregar();
    for (const b of segMetrica.children) b.classList.toggle('activo', b.getAttribute('data-k') === estado.metrica);
    if (!A.sel.length) {
      datosGraf = null;
      tablasCSV = [];
      salida.replaceChildren(el('p', {class: 'nota'}, 'No hay partidos relevados para este filtro.'));
      return;
    }
    const anios = [...A.porAnio.keys()];
    datosGraf = anios.length ? {y0: Math.min(...anios), y1: Math.max(...anios), porAnio: A.porAnio} : null;
    const metricaTxt = METRICAS.find(([k]) => k === estado.metrica)[1];
    const tComps = tablaComps(A), tAnios = tablaAnios(A);
    const goleadas = ranking(A.jugados, (r) => Math.abs(r.gl - r.gv) * 100 + r.gl + r.gv);
    const masGoles = ranking(A.jugados, (r) => (r.gl + r.gv) * 100 + Math.abs(r.gl - r.gv));
    const rGoleadas = tablaRecords(goleadas), rMasGoles = tablaRecords(masGoles);
    // el CSV lee las tablas del DOM -> incluye las filas que se hayan expandido con "Ver 10 más".
    tablasCSV = [['Por competición', tComps], ['Mayores goleadas', rGoleadas.tabla],
      ['Partidos con más goles', rMasGoles.tabla], ['Por año', tAnios]];

    salida.replaceChildren(
      kpis(A),
      el('section', {class: 'est-bloque'},
        el('div', {class: 'est-bloque-cab'}, el('h3', {}, `${metricaTxt} por año`), segMetrica),
        datosGraf ? graf : el('p', {class: 'nota'}, 'Sin partidos con resultado.'),
        el('details', {class: 'est-datos'}, el('summary', {}, 'Ver datos por año'),
          el('div', {class: 'tabla-wrap'}, tAnios))),
      el('section', {class: 'est-bloque'},
        el('h3', {}, 'Por competición'),
        el('div', {class: 'tabla-wrap'}, tComps)),
      el('section', {class: 'est-bloque'}, el('h3', {}, 'Mayores goleadas'),
        el('div', {class: 'tabla-wrap'}, rGoleadas.tabla), rGoleadas.mas || ''),
      el('section', {class: 'est-bloque'}, el('h3', {}, 'Partidos con más goles'),
        el('div', {class: 'tabla-wrap'}, rMasGoles.tabla), rMasGoles.mas || ''));
    dibujarGrafico();
  }

  container.append(
    el('h2', {}, 'Resumen estadístico'),
    el('p', {class: 'nota'},
      'Todo lo relevado en el sitio: Primera División, Segunda División, copas nacionales y copas internacionales. '
      + 'El año de un partido es '
      + 'el de su fecha; los equipos se cuentan por el nombre con el que compitieron, y son argentinos los '
      + 'del registro de clubes. Los partidos no disputados no suman goles ni promedios.'),
    el('div', {class: 'controles'},
      el('label', {class: 'est-rango'}, 'Desde ', selDesde), el('label', {class: 'est-rango'}, 'hasta ', selHasta),
      selAmb, selComp, btnReset,
      botonCSV(() => `resumen_${estado.desde}-${estado.hasta}`, () => tablasCSV)),
    salida);
  sincronizarControles();
  dibujar();
}
