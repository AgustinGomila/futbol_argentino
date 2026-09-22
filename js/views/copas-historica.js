// Vista: tabla histórica de COPAS argentinas. Agrega TODOS los partidos de copa por club
// (J/G/E/P/GF/GC/Pts/Efect + títulos) y permite ELEGIR qué competiciones se suman al total.
// El cálculo es 100% en el cliente (desde data/copas.json) para que la selección sea dinámica.
// Análoga a la Tabla histórica de Ligas, pero con selector de copas. Efectividad referencial 3-1-0
// (los cruces definidos por penales cuentan como empate, igual que en las tablas por edición).

import {clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';

const COLS = [
  ['pos', 'Pos'], ['equipo', 'Equipo'], ['J', 'J'], ['G', 'G'], ['E', 'E'],
  ['P', 'P'], ['GP', 'G-P'], ['GF', 'GF'], ['GC', 'GC'], ['DIF', 'DIF'], ['Pts', 'Pts'], ['ef', 'Efect.'],
  ['tit', 'Tít.'],  // última, sin ícono de copa (mismo criterio que Libertadores y demás copas int'l)
];

// Copa de Honor/Oro 1936 se cuentan como LIGA en el resto del sitio -> se excluyen acá (como en Copas).
const esLiga1936 = (c, e) => (c === 'Copa de Honor MCBA' || c === 'Copa de Oro') && e === 1936;
const N = (v) => (v == null ? -1e9 : v);

export async function render(container, params = {}) {
  const [copas, escudos, registro, campCopa, fusiones] = await Promise.all([
    loadJSON('copas'), loadJSON('escudos'), loadJSON('registro'), loadJSON('campeones_copa'),
    loadJSON('fusiones')]);
  if (!copas || !copas.length) {
    container.append(el('h2', {}, 'Copas — tabla histórica'),
      el('p', {class: 'error'},
        'No se pudieron cargar las copas. Corré scripts/copas_parse.py y scripts/build_web.py.'));
    return;
  }
  // Fusiones (origen -> destino): los partidos/títulos del club de origen se atribuyen al destino
  // (mismo criterio que la ficha de club y la tabla histórica de ligas).
  const fus = fusiones || {};
  const canon = (n) => fus[n] || n;
  const idDe = {};
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;
  const esc = (n) => (escudos && escudos[n])
    ? el('img', {src: 'images/' + escudos[n], class: 'escudo', alt: ''}) : null;

  const matches = copas.filter(m => m.e != null && !esLiga1936(m.c, m.e));

  // competiciones disponibles + rango de años (para el selector)
  const compMeta = new Map();
  for (const m of matches) {
    const x = compMeta.get(m.c) || {min: 9999, max: 0};
    x.min = Math.min(x.min, m.e);
    x.max = Math.max(x.max, m.e);
    compMeta.set(m.c, x);
  }
  const comps = [...compMeta.keys()].sort((a, b) => a.localeCompare(b));
  const sel = new Set(comps);  // por defecto: todas seleccionadas

  // títulos por (competición, club) desde campeones_copa (clave 'comp|edicion')
  const titulos = [];
  if (campCopa) for (const [key, v] of Object.entries(campCopa)) {
    if (!v || !v.campeon) continue;
    const i = key.lastIndexOf('|');
    const comp = key.slice(0, i), e = +key.slice(i + 1);
    if (!esLiga1936(comp, e)) titulos.push([comp, v.campeon]);
  }

  const estado = {sortKey: 'Pts', sortDir: -1};   // orden por defecto: Puntos (desc)

  function agregar() {
    const agg = new Map();
    const g = (n) => {
      let d = agg.get(n);
      if (!d) agg.set(n, d = {equipo: n, J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0, tit: 0});
      return d;
    };
    for (const m of matches) {
      if (!sel.has(m.c)) continue;
      for (const [team, gf, ga, local] of [[canon(m.l), m.gl, m.gv, true], [canon(m.v), m.gv, m.gl, false]]) {
        const d = g(team);
        d.J++;
        if (gf != null) d.GF += gf;
        if (ga != null) d.GC += ga;
        if (m.res === 'E') d.E++;
        else if (m.res === 'L') local ? d.G++ : d.P++;
        else if (m.res === 'V') local ? d.P++ : d.G++;
      }
    }
    for (const [comp, campeon] of titulos) if (sel.has(comp)) g(canon(campeon)).tit++;
    return [...agg.values()].map(d => ({
      ...d, DIF: d.GF - d.GC, GP: d.G - d.P, Pts: d.G * 3 + d.E,
      ef: d.J ? (d.G * 3 + d.E) / (d.J * 3) * 100 : null,
    }));
  }

  const tabla = el('div', {class: 'tabla-wrap'});

  function dibujar() {
    const filas = agregar();
    if (!filas.length) {
      tabla.replaceChildren(el('p', {class: 'placeholder'}, 'Elegí al menos una copa.'));
      return;
    }
    // ranking oficial (Pts, DIF, GF) = base para ordenar por la columna "Pos"
    [...filas].sort((a, b) => N(b.Pts) - N(a.Pts) || N(b.DIF) - N(a.DIF) || N(b.GF) - N(a.GF))
      .forEach((f, i) => f.rank = i + 1);
    const {sortKey, sortDir} = estado;
    filas.sort((a, b) => {
      const x = sortKey === 'pos' ? a.rank : a[sortKey];
      const y = sortKey === 'pos' ? b.rank : b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir;
    });
    // "Pos" NUNCA es fija: renumera 1..N según el ordenamiento mostrado.
    filas.forEach((f, i) => f.pos = i + 1);
    const colClase = (k) => k === 'equipo' ? 'txt'
      : k === 'pos' ? 'num pos' : k === 'Pts' ? 'num pts' : 'num';
    const thead = el('tr', {}, ...COLS.map(([k, label]) => el('th', {
      class: (k === estado.sortKey ? 'sorted ' : '') + colClase(k),
      onclick: () => {
        estado.sortDir = estado.sortKey === k ? -estado.sortDir : (k === 'equipo' ? 1 : -1);
        estado.sortKey = k;
        dibujar();
      },
    }, label + (k === estado.sortKey ? (estado.sortDir === 1 ? ' ▲' : ' ▼') : ''))));

    const cuerpo = filas.map(f => {
      const bal = f.G > f.P ? 'bal-g' : f.P > f.G ? 'bal-p' : 'bal-e';
      return el('tr', {class: bal}, ...COLS.map(([k]) => {
        if (k === 'equipo') {
          const cid = idDe[f.equipo];
          const cont = [esc(f.equipo), f.equipo].filter(Boolean);
          return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
        }
        if (k === 'tit') return el('td', {class: 'num'}, f.tit || '');
        if (k === 'GP') {
          return f.GP == null ? el('td', {class: 'num'}, '')
            : el('td', {class: 'num dif-gp'}, (f.GP > 0 ? '+' : '') + f.GP);
        }
        if (k === 'DIF') return el('td', {class: 'num'}, (f.DIF > 0 ? '+' : '') + f.DIF);
        if (k === 'ef') return el('td', {class: 'num'}, f.ef == null ? '' : f.ef.toFixed(1) + '%');
        return el('td', {class: colClase(k)}, f[k] == null ? '' : String(f[k]));
      }));
    });
    // Fila TOTAL (tfoot): suma J/G/E/P/GF/GC; G-P y DIF se RECALCULAN de las sumas. Pos/Tít./Pts/Efect.
    // NO se suman (posición, títulos y ratios no tienen total). Solo si hay ≥2 filas.
    let tfoot = null;
    if (filas.length >= 2) {
      const SUM = ['J', 'G', 'E', 'P', 'GF', 'GC'];
      const tot = {};
      for (const k of SUM) tot[k] = filas.reduce((s, f) => s + (f[k] || 0), 0);
      tot.GP = tot.G - tot.P;
      tot.DIF = tot.GF - tot.GC;
      const signo = (n) => (n > 0 ? '+' : '') + n;
      const totalTr = el('tr', {class: 'total'}, ...COLS.map(([k]) => {
        if (k === 'equipo') return el('td', {class: 'txt'}, 'Total');
        if (k === 'GP') return el('td', {class: 'num dif-gp'}, signo(tot.GP));
        if (k === 'DIF') return el('td', {class: 'num'}, signo(tot.DIF));
        if (SUM.includes(k)) return el('td', {class: 'num'}, String(tot[k]));
        return el('td', {class: colClase(k)}, '');   // pos / tít. / Pts / Efect. -> sin total
      }));
      tfoot = el('tfoot', {}, totalTr);
    }
    tabla.replaceChildren(
      el('div', {class: 'resumen'},
        el('span', {}, `${filas.length} clubes`),
        el('span', {class: 'sub'}, `${sel.size}/${comps.length} copas`)),
      // .stats: mismo layout que la tabla histórica general (columna Equipo en una sola línea, numéricas
      // de ancho fijo) -> el ancho del nombre converge y no envuelve en dos filas.
      el('table', {class: 'posiciones stats col-unif'}, el('thead', {}, thead), el('tbody', {}, ...cuerpo),
        ...(tfoot ? [tfoot] : [])));
  }

  // --- selector de copas (checkboxes) ---
  const checks = new Map();
  const chkFor = (c) => {
    const meta = compMeta.get(c);
    const box = el('input', {
      type: 'checkbox', checked: 'checked',
      onchange: () => {
        box.checked ? sel.add(c) : sel.delete(c);
        dibujar();
      },
    });
    checks.set(c, box);
    const rango = meta.min === meta.max ? String(meta.min) : `${meta.min}–${meta.max}`;
    return el('label', {class: 'filtro chk'}, box, ` ${c} `, el('span', {class: 'sub'}, `(${rango})`));
  };
  const setAll = (v) => {
    sel.clear();
    for (const c of comps) {
      if (v) sel.add(c);
      checks.get(c).checked = v;
    }
    dibujar();
  };
  const panel = el('details', {class: 'copas-selector'},   // colapsado por defecto
    el('summary', {}, 'Copas incluidas en el total'),
    el('div', {class: 'sel-acciones'},
      el('button', {class: 'mini', onclick: () => setAll(true)}, 'Todas'),
      el('button', {class: 'mini', onclick: () => setAll(false)}, 'Ninguna')),
    el('div', {class: 'sel-grid'}, ...comps.map(chkFor)));

  container.append(
    el('h2', {}, 'Copas argentinas — tabla histórica'),
    el('p', {class: 'nota'},
      'Suma de todos los partidos de copa por club; elegí qué competiciones entran al total. '
      + 'Efectividad referencial 3-1-0 (los cruces definidos por penales cuentan como empate).'),
    panel, tabla);

  // preselección por URL: ?comp=Copa Argentina  o  ?comp=A,B,C  (si viene, arranca solo con esas)
  if (params.comp) {
    const want = new Set(String(params.comp).split(',').map(s => s.trim()));
    sel.clear();
    for (const c of comps) {
      const on = want.has(c);
      if (on) sel.add(c);
      checks.get(c).checked = on;
    }
  }
  dibujar();
}
