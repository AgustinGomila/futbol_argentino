// Render COMPARTIDO de una edición de copa organizada por fases (usado por la vista Copas y por
// Tabla histórica). Usa la fase EXPLÍCITA de cada partido (m.sec/ord/fase, calculada en build_web):
// podio → grupos (tablas) → eliminatoria (cruces compactos por ronda) → 3er puesto → tabla total
// colapsable. Las copas de rueda única (sin fases) muestran solo la tabla de posiciones.

import {clubHref, el} from './main.js';

const COLS = [['pos', 'Pos'], ['eq', 'Equipo'], ['J', 'J'], ['G', 'G'], ['E', 'E'],
  ['P', 'P'], ['GF', 'GF'], ['GC', 'GC'], ['DIF', 'DIF'], ['Pts', 'Pts']];

// fecha ISO del partido -> 'DD/MM/YYYY'; '' si m.f es solo el año (copa sin fecha extraída).
const fmtFecha = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const ganador = (m) => {
  if (m.res === 'L') return m.l;
  if (m.res === 'V') return m.v;
  if (m.res === 'E' && m.pen) {
    const [pl, pv] = m.pen.split('-').map(Number);
    if (pl > pv) return m.l;
    if (pv > pl) return m.v;
  }
  return null;
};

const aggFull = (ms) => {
  const t = new Map();
  const g = (n) => t.get(n) || t.set(n, {eq: n, J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0, Pts: 0}).get(n);
  for (const m of ms) {
    const w = ganador(m);
    // walkover (wp:lp): sin marcador (gl/gv null) pero CON ganador -> cuenta J + G/P + puntos (sin goles).
    // Sin marcador y sin ganador = partido no disputado -> no cuenta.
    const walkover = m.gl == null || m.gv == null;
    if (walkover && !w) continue;
    const a = g(m.l), b = g(m.v);
    a.J++;
    b.J++;
    if (!walkover) {
      a.GF += m.gl;
      a.GC += m.gv;
      b.GF += m.gv;
      b.GC += m.gl;
    }
    if (w === m.l) {
      a.G++;
      b.P++;
      a.Pts += 3;
    } else if (w === m.v) {
      b.G++;
      a.P++;
      b.Pts += 3;
    } else {
      a.E++;
      b.E++;
      a.Pts++;
      b.Pts++;
    }
  }
  return [...t.values()].map(x => ({...x, DIF: x.GF - x.GC}))
    .sort((p, q) => q.Pts - p.Pts || q.DIF - p.DIF || q.GF - p.GF);
};

// Campeón/subcampeón por si no viene de campeones_copa (fallback): última final decisiva.
const finalistas = (ms) => {
  const fin = ms.filter(m => m.fase === 'Final');
  if (fin.length) {
    const ult = fin[fin.length - 1];
    const w = ganador(ult);
    if (w) return {campeon: w, sub: w === ult.l ? ult.v : ult.l};
  }
  const base = aggFull(ms);
  if (base.length >= 2) return {campeon: base[0].eq, sub: base[1].eq};
  if (base.length === 1) return {campeon: base[0].eq, sub: null};
  return null;
};

// Devuelve un ARRAY de elementos con la edición desglosada. ctx = {escudos, idDe, label, campeon, sub, nota}.
// label(canónico) -> nombre común a mostrar (por defecto identidad); el enlace sigue por idDe (id único).
export function renderCopaEdicion(ms, ctx) {
  const {escudos = {}, idDe = {}, label = (n) => n} = ctx || {};
  const esc = (n) => escudos[n] ? el('img', {src: 'images/' + escudos[n], class: 'escudo', alt: ''}) : null;
  const equipoLink = (n, reves, cell) => {
    // reves=true -> nombre + escudo (para el LOCAL del cruce: el escudo queda junto al marcador).
    // cell=true envuelve en .eq-cell (mismo layout que Libertadores) para las llaves de eliminación.
    const cont = (reves ? [label(n), esc(n)] : [esc(n), label(n)]).filter(Boolean);
    const inner = cell ? [el('span', {class: 'eq-cell'}, ...cont)] : cont;
    return idDe[n] ? el('a', {href: clubHref(idDe[n])}, ...inner) : el('span', {}, ...inner);
  };
  const tablaEl = (rows, soloEquipos) => {
    let filas = aggFull(rows);
    if (soloEquipos) filas = filas.filter(f => soloEquipos.has(f.eq));
    filas.forEach((f, i) => f.pos = i + 1);
    const colClase = (k) => k === 'eq' ? 'txt'
      : k === 'pos' ? 'num pos' : k === 'Pts' ? 'num pts' : 'num';
    const thead = el('tr', {}, ...COLS.map(([k, l]) => el('th', {class: colClase(k)}, l)));
    const cuerpo = filas.map(f => el('tr', {}, ...COLS.map(([k]) => {
      if (k === 'eq') return el('td', {class: 'txt'}, equipoLink(f.eq));
      return el('td', {class: colClase(k)}, String(f[k] ?? ''));
    })));
    return el('table', {class: 'posiciones'}, el('thead', {}, thead), el('tbody', {}, ...cuerpo));
  };
  // Llaves de eliminación con el MISMO estilo que Libertadores (tabla-copa): local nombre+escudo a la
  // derecha, marcador al centro, visitante escudo+nombre; el ganador va en negrita (.gana).
  const mismoPar = (a, b) => (a.l === b.l && a.v === b.v) || (a.l === b.v && a.v === b.l);
  const crucesEl = (rows, esFinal, campeon) => {
    const tb = el('table', {class: 'tabla-copa'});
    const fila = (m) => {
      const w = ganador(m);
      let aGana = (w === m.l) ? 1 : (w === m.v ? -1 : 0);
      if (esFinal && campeon) aGana = (m.l === campeon) ? 1 : (m.v === campeon ? -1 : aGana);
      const pen = m.pen ? el('span', {class: 'lib-anios'}, ` (pen ${m.pen})`) : '';
      const fch = fmtFecha(m.f);
      const fecEl = fch ? el('span', {class: 'copa-fecha'}, fch) : '';
      // walkover / adjudicación con nota curada (m.nd) -> marca ⚖ con la razón en el tooltip.
      const nd = m.nd ? el('span', {class: 'lib-awd', title: m.nd}, ' ⚖') : '';
      const sco = (m.gl == null || m.gv == null) ? '—' : `${m.gl}-${m.gv}`;   // walkover: sin marcador
      return el('tr', {},
        el('td', {class: 'eq-local' + (aGana > 0 ? ' gana' : '')}, equipoLink(m.l, true, true)),
        el('td', {class: 'res'}, sco, pen, nd, fecEl),
        el('td', {class: 'eq-visita' + (aGana < 0 ? ' gana' : '')}, equipoLink(m.v, false, true)));
    };
    // agrupa los legs de una MISMA serie (mismo par, en cualquier orden) en un <tbody>, aunque NO estén
    // consecutivos: las series de ida/vuelta de una fase (ej. preliminar Copa Argentina 2016) traen todas
    // las idas y luego las vueltas. Un partido único queda solo en su tbody.
    const usados = new Set();
    for (let i = 0; i < rows.length; i++) {
      if (usados.has(i)) continue;
      const tie = [rows[i]];
      usados.add(i);
      for (let j = i + 1; j < rows.length; j++) {
        if (!usados.has(j) && mismoPar(rows[i], rows[j])) {
          tie.push(rows[j]);
          usados.add(j);
        }
      }
      tb.append(el('tbody', {}, ...tie.map(fila)));
    }
    return tb;
  };

  // Campeón: el explícito (ctx.campeon). Si NO hay campeón pero SÍ una nota (copa abandonada/suspendida),
  // se muestra SOLO la razón, sin el recuadro Campeón/Subcampeón (no se inventa un campeón). Solo cuando
  // no hay campeón NI nota se cae al fallback (finalistas de los partidos).
  // #11: ícono de copa personalizado (ctx.icono = archivo en images/copas/) que reemplaza el 🏆.
  const campLbl = () => (ctx && ctx.icono)
    ? el('span', {class: 'lbl'}, el('img', {class: 'copa-icono', src: 'images/copas/' + ctx.icono, alt: ''}),
      ' Campeón: ')
    : el('span', {class: 'lbl'}, '🏆 Campeón: ');
  const f = (ctx && ctx.campeon) ? {campeon: ctx.campeon, sub: ctx.sub}
    : (ctx && ctx.nota) ? null : finalistas(ms);
  const kids = [];
  if (f && f.campeon) {
    const podio = [el('span', {class: 'campeon'}, campLbl(), equipoLink(f.campeon))];
    if (f.sub) podio.push(el('span', {class: 'subcampeon'}, el('span', {class: 'lbl'}, 'Subcampeón: '), equipoLink(f.sub)));
    if (ctx && ctx.nota) podio.push(el('span', {class: 'podio-nota'}, ctx.nota));
    kids.push(el('div', {class: 'podio'}, ...podio));
  } else if (ctx && ctx.nota) {
    kids.push(el('div', {class: 'podio podio-sin'}, el('span', {class: 'podio-nota'}, ctx.nota)));
  }
  // Resumen del torneo (equipos/partidos/goles/promedio), MISMO formato que las copas internacionales:
  // va justo debajo del campeón. Lo arma la vista (copas.js) y lo pasa por ctx.resumen.
  if (ctx && ctx.resumen) kids.push(ctx.resumen);

  const grupos = ms.filter(m => m.sec === 'grupos');
  const elim = ms.filter(m => m.sec === 'elim' || m.sec === 'tercero');
  const regular = ms.filter(m => m.sec === 'regular');
  const campeon = f && f.campeon;
  // membresía de fases/grupos: {fases:[{nombre,grupos}]} (o formato viejo plano {A,B} -> 1 fase).
  let fases = null;
  if (ctx && ctx.grupos) {
    fases = Array.isArray(ctx.grupos.fases) ? ctx.grupos.fases
      : (Object.keys(ctx.grupos).length ? [{nombre: 'Fase de grupos', grupos: ctx.grupos}] : null);
  }
  const multiFase = fases && fases.length > 1;
  const hayGrupos = grupos.length || (fases && regular.length);

  if (fases && regular.length) {
    // una tabla por grupo. multi-fase (ej. Copa de la Liga 2020, sin interzonal): partidos con AMBOS
    // equipos del grupo (aísla la fase). Una sola fase (2021-24, con interzonal): partidos con AL
    // MENOS UN equipo del grupo, filtrando las filas al grupo -> refleja el standing oficial.
    for (const fase of fases) {
      // grupos AISLADOS (multi-fase 2020, o copas clásicas por-zona con interzonal:false): el
      // partido se cuenta solo si AMBOS equipos son del grupo. Con ronda interzonal (Copa de la
      // Liga 2021-2024, interzonal:true): AL MENOS UNO -> reproduce el standing oficial.
      const ambos = multiFase || fase.interzonal === false;
      // copa CLÁSICA por-zona (round-robin, sin interzonal ni multi-fase): además de la tabla, se
      // muestran los PARTIDOS de cada grupo debajo de su tabla, apilados (Grupo A + partidos, luego B…).
      const clasico = fase.interzonal === false && !multiFase;
      kids.push(el('h3', {class: 'fase-titulo'}, fase.nombre));
      kids.push(el('div', {class: 'grupos-grid'}, ...Object.keys(fase.grupos).sort().map(z => {
        const set = new Set(fase.grupos[z]);
        const mz = regular.filter(m => ambos ? (set.has(m.l) && set.has(m.v))
          : (set.has(m.l) || set.has(m.v)));
        // 'Zona X' para zonas direccionales (Norte/Sur/Este/Oeste, ej. Estímulo 1920, Jockey 1931);
        // 'Grupo X' para las de letra (A/B/C, ej. Estímulo 1926, Suecia). El resto, la lógica previa.
        const lbl = (/norte|sur|este|oeste|centro/i.test(z) ? 'Zona '
          : fase.interzonal === false ? 'Grupo '
            : multiFase ? (/^\d/.test(z) ? 'Zona ' : 'Grupo ') : 'Zona ') + z;
        const bloque = [el('h4', {}, lbl), tablaEl(mz, set)];
        if (clasico) {  // partidos del grupo, ordenados por fecha, debajo de la tabla
          const ord = mz.slice().sort((a, b) => String(a.f).localeCompare(String(b.f)));
          if (ord.length) bloque.push(crucesEl(ord, false, null));
        }
        return el('div', {class: 'grupo-bloque'}, ...bloque);
      })));
    }
    // Desempates/playoffs de grupo (sec='grupos', ej. 'Playoff Grupo B' de Copa Suecia 1958): al tomar
    // esta rama no pasan por el bloque de abajo, así que se muestran acá, tras los grupos y antes de la final.
    const porFasePlayoff = new Map();
    for (const m of grupos.slice().sort((a, b) => (a.ord || 0) - (b.ord || 0))) {
      (porFasePlayoff.get(m.fase) || porFasePlayoff.set(m.fase, []).get(m.fase)).push(m);
    }
    for (const [fs, mz] of porFasePlayoff) {
      kids.push(el('h3', {class: 'fase-titulo'}, fs || 'Desempate'));
      kids.push(crucesEl(mz, false, null));
    }
  } else if (grupos.length) {
    const porZona = new Map();
    for (const m of grupos) (porZona.get(m.fase) || porZona.set(m.fase, []).get(m.fase)).push(m);
    kids.push(el('h3', {class: 'fase-titulo'}, 'Fase de grupos'));
    kids.push(el('div', {class: 'grupos-grid'}, ...[...porZona].map(([z, mz]) => {
      // tabla del grupo + sus partidos debajo (ordenados por fecha), igual que las copas clásicas por-zona.
      const ord = mz.slice().sort((a, b) => String(a.f).localeCompare(String(b.f)));
      return el('div', {class: 'grupo-bloque'}, el('h4', {}, z), tablaEl(mz), crucesEl(ord, false, null));
    })));
  } else if (regular.length && elim.length) {
    kids.push(el('h3', {class: 'fase-titulo'}, 'Fase regular'));
    kids.push(tablaEl(regular));
  }
  if (elim.length) {
    kids.push(el('h3', {class: 'fase-titulo'}, 'Fase eliminatoria'));
    const rondas = [];
    for (const m of elim.slice().sort((a, b) => (a.ord || 0) - (b.ord || 0))) {
      const last = rondas[rondas.length - 1];
      if (last && last.fase === m.fase) last.ms.push(m);
      else rondas.push({fase: m.fase, ms: [m]});
    }
    for (const r of rondas) {
      kids.push(el('h4', {}, r.fase));
      kids.push(crucesEl(r.ms, /^Final/.test(r.fase), campeon));
    }
  }
  if (!elim.length && !hayGrupos) {
    kids.push(el('h3', {class: 'fase-titulo'}, 'Posiciones'));
    kids.push(tablaEl(regular.length ? regular : ms));
  } else {
    kids.push(el('details', {class: 'plegable'}, el('summary', {}, 'Tabla total'), tablaEl(ms)));
  }
  return kids;
}
