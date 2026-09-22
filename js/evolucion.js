// Evolución de posiciones por jornada de una liga (Tabla histórica / Segunda división). Dos partes:
//   - calcularEvolucion: PURA (sin DOM). Reconstruye la tabla después de cada 'Fecha N' a partir de rondas.json
//     y devuelve la posición de cada club en cada paso.
//   - crearGraficoEvolucion: gráfico de líneas SVG (posición 1 arriba), con selector de clubes, colores del
//     escudo de cada club y tooltip por jornada.
// No importa main.js a propósito: así el cálculo se puede probar con node sobre los JSON.

// 'Fecha 7' / 'Zona A · Fecha 7' -> {pref: '' | 'Zona A', j: 7}. Los bloques sin número (Final, Desempate,
// Semifinal...) son fases de eliminación: no son jornadas de la tabla y quedan fuera.
const RE_FECHA = /^(?:(.+?) · )?Fecha (\d+)$/;

// Elige qué bloques de rondas (por prefijo: '', 'Zona A', 'Intergrupos', 'Zona Campeonato'...) arman ESTA tabla:
// el subconjunto cuya suma de partidos jugados reproduce EXACTAMENTE la J oficial de cada club. Ej. Metropolitano
// 1976: la Serie Campeonato se arma solo con 'Zona Campeonato' (las zonas previas también tienen a esos clubes).
// Entre varios subconjuntos válidos gana el más chico. Sin solución exacta -> null (no se muestra: honesto).
function elegirBloques(porPref, filas) {
  const prefs = [...porPref.keys()];
  if (prefs.length > 12) return null;   // nunca pasa en la práctica; evita 2^n descontrolado
  const jDe = (pref) => {
    const c = new Map();
    for (const e of porPref.get(pref)) for (const m of e.partidos) {
      c.set(m.l, (c.get(m.l) || 0) + 1);
      c.set(m.v, (c.get(m.v) || 0) + 1);
    }
    return c;
  };
  const jp = prefs.map(jDe);
  let mejor = null;
  for (let mask = 1; mask < (1 << prefs.length); mask++) {
    const n = mask.toString(2).replace(/0/g, '').length;
    if (mejor && n >= mejor.n) continue;
    const ok = filas.every(f => {
      let j = 0;
      for (let i = 0; i < prefs.length; i++) if (mask & (1 << i)) j += jp[i].get(f.equipo) || 0;
      return j === (f.J ?? 0);
    });
    if (ok) mejor = {n, prefs: prefs.filter((_, i) => mask & (1 << i))};
  }
  return mejor && mejor.prefs;
}

/**
 * @param rondas  rondas.json[grupo]: [{etq, partidos: [{l, v, gl, gv, r, f}]}]
 * @param filas   filas OFICIALES de la tabla (posiciones.json[id]): equipo, J, G, E, P, GF, GC, Pts
 * @param opts    {pg: puntos por victoria; por defecto se deduce de la tabla (2 antes del Apertura 1995, 3 después)}
 * @returns null si las jornadas no reproducen la tabla; si no {pasos: [{etq, corto}], equipos: [{equipo,
 *   final, pos: [], pts: [], res: []}]} con `final` = posición oficial (Pts, DIF, GF), pos[i]/pts[i] tras el
 *   paso i y res[i] = partido del club en ese paso ({r: 'G'|'E'|'P', gf, gc, rival, local}) o null.
 */
export function calcularEvolucion(rondas, filas, {pg = null} = {}) {
  if (!rondas || !rondas.length || !filas || filas.length < 3) return null;
  const S = new Set(filas.map(f => f.equipo));
  // Bloques candidatos: jornadas numeradas con al menos un club de esta tabla.
  const porPref = new Map();
  rondas.forEach((e, idx) => {
    const m = RE_FECHA.exec(e.etq || '');
    if (!m || !e.partidos.some(p => S.has(p.l) || S.has(p.v))) return;
    const pref = m[1] || '';
    if (!porPref.has(pref)) porPref.set(pref, []);
    porPref.get(pref).push({...e, idx, j: +m[2], pref});
  });
  if (!porPref.size) return null;
  let elegidos = elegirBloques(porPref, filas);
  let pasos;
  if (elegidos) {
    pasos = elegidos.flatMap(p => porPref.get(p));
  } else {
    // Sin bloques que cuadren (Nacionales: la 'Zona' de rondas no coincide con el 'Grupo' de la tabla): solo
    // los partidos ENTRE clubes de esta tabla, si así se reproduce la J oficial de cada uno.
    pasos = [...porPref.values()].flat()
      .map(e => ({...e, partidos: e.partidos.filter(p => S.has(p.l) && S.has(p.v))}))
      .filter(e => e.partidos.length);
    const J = new Map();
    for (const e of pasos) for (const p of e.partidos) for (const q of [p.l, p.v]) J.set(q, (J.get(q) || 0) + 1);
    if (!filas.every(f => J.get(f.equipo) === (f.J ?? 0))) return null;
    elegidos = [...new Set(pasos.map(e => e.pref))];
  }
  // Varios bloques (zona + intergrupos, fases): se intercalan por FECHA real (primer día de cada jornada); con
  // un solo bloque se respeta el orden de la fuente (una jornada postergada no se mueve).
  if (elegidos.length > 1) {
    const dia = (e) => e.partidos.map(p => p.f).filter(Boolean).sort()[0] || '';
    pasos = pasos.slice().sort((a, b) => dia(a).localeCompare(dia(b)) || a.idx - b.idx);
  } else {
    pasos.sort((a, b) => a.idx - b.idx);
  }

  // Puntos por victoria: los de la tabla oficial (2 o 3, el que mejor explica Pts con G/E). 1988/89 (3 por
  // victoria + 1 extra al ganador de la tanda en cada empate): la mayoría de los clubes con empates suma de más.
  const resto = (p) => filas.reduce((s, f) => s + Math.abs((f.Pts ?? 0) - (p * (f.G ?? 0) + (f.E ?? 0))), 0);
  if (!pg) pg = resto(2) < resto(3) ? 2 : 3;
  const conE = filas.filter(f => f.E);
  const penales = pg === 3 && conE.filter(f => (f.Pts ?? 0) > 3 * (f.G ?? 0) + f.E).length > conE.length / 2;

  // Posición FINAL oficial (mismo criterio que la tabla: Pts, DIF, GF).
  const dif = (f) => (f.GF ?? 0) - (f.GC ?? 0);
  const oficial = filas.slice().sort((a, b) => (b.Pts ?? 0) - (a.Pts ?? 0) || dif(b) - dif(a) || (b.GF ?? 0) - (a.GF ?? 0));
  const finalDe = new Map(oficial.map((f, i) => [f.equipo, i + 1]));

  // Acumulado por club a lo largo de los pasos (solo los clubes de la tabla; un rival de otra zona no rankea).
  // Resultado OFICIAL (r) para G/E/P (walkovers, partidos dados por perdidos) y marcador para los goles.
  const acc = new Map(filas.map(f => [f.equipo, {G: 0, E: 0, P: 0, GF: 0, GC: 0}]));
  const snaps = [];   // por paso: {tot: Map equipo -> acumulado, res: Map equipo -> partido del paso}
  for (const e of pasos) {
    const res = new Map();
    for (const m of e.partidos) {
      const gl = m.gl ?? 0, gv = m.gv ?? 0;
      const r = m.r || (gl > gv ? 'L' : gl < gv ? 'V' : 'E');
      for (const [eq, rival, gf, gc, gano, perdio, local] of [
        [m.l, m.v, gl, gv, r === 'L', r === 'V', true], [m.v, m.l, gv, gl, r === 'V', r === 'L', false]]) {
        const a = acc.get(eq);
        if (!a) continue;
        a.GF += gf;
        a.GC += gc;
        if (gano) a.G++; else if (perdio) a.P++; else a.E++;
        // marcador desde el club (sus goles primero); null si el partido no tiene goles (walkover)
        res.set(eq, {
          r: gano ? 'G' : perdio ? 'P' : 'E', gf: (local ? m.gl : m.gv) ?? null,
          gc: (local ? m.gv : m.gl) ?? null, rival, local
        });
      }
    }
    snaps.push({tot: new Map([...acc].map(([k, v]) => [k, {...v}])), res});
  }
  // Ajuste para que el último paso dé los Pts oficiales: los descuentos de puntos (sanciones) se aplican desde
  // la primera fecha; en 1988/89 la diferencia son los empates ganados por penales (sin dato por partido) y se
  // reparte proporcional a los empates acumulados.
  const ult = snaps[snaps.length - 1].tot;
  const ajuste = new Map(filas.map(f => {
    const a = ult.get(f.equipo);
    return [f.equipo, (f.Pts ?? 0) - (a.G * pg + a.E)];
  }));
  const ptsDe = (eq, a) => {
    const adj = ajuste.get(eq) || 0, eFinal = ult.get(eq).E;
    return a.G * pg + a.E + (penales && adj > 0 && eFinal ? adj * a.E / eFinal : adj);
  };

  const equipos = filas.map(f => ({equipo: f.equipo, final: finalDe.get(f.equipo), pos: [], pts: [], res: []}));
  const porEq = new Map(equipos.map(x => [x.equipo, x]));
  snaps.forEach((s, i) => {
    const orden = [...S].map(eq => {
      const a = s.tot.get(eq);
      return {eq, pts: ptsDe(eq, a), dif: a.GF - a.GC, gf: a.GF};
    });
    // La última fecha es la tabla oficial tal cual (mismo orden que la tabla de arriba); las demás, Pts/DIF/GF
    // con la posición final como desempate estable.
    if (i === snaps.length - 1) orden.sort((a, b) => finalDe.get(a.eq) - finalDe.get(b.eq));
    else orden.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || finalDe.get(a.eq) - finalDe.get(b.eq));
    orden.forEach((o, k) => {
      const x = porEq.get(o.eq);
      x.pos.push(k + 1);
      x.pts.push(Math.round(o.pts * 10) / 10);
      x.res.push(s.res.get(o.eq) || null);
    });
  });
  equipos.sort((a, b) => a.final - b.final);
  const variosPref = elegidos.length > 1;
  return {
    // eje X: el número de jornada; con varios bloques intercalados, el orden 1..N (el rótulo real va al tooltip).
    pasos: pasos.map((e, i) => ({etq: e.etq, corto: String(variosPref ? i + 1 : e.j)})),
    equipos,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Gráfico (DOM). Colores: el del ESCUDO de cada club (tono dominante saturado, leído en un canvas). Si dos clubes
// elegidos caen en tonos parecidos (River e Independiente, rojos), el segundo va con trazo punteado; el escudo
// al final de cada línea y la leyenda identifican al club sin depender solo del color.

const SVGNS = 'http://www.w3.org/2000/svg';
const DASHES = ['', '7 4', '2 3', '10 3 2 3'];
const TOP_DEF = 5;

export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  if (tag === 'img') {   // carga diferida por defecto, como el() de main.js
    n.loading = 'lazy';
    n.decoding = 'async';
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  n.append(...kids.flat().filter(x => x != null));
  return n;
}

export function s(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}

// Tono dominante de un escudo -> {h, s, l} (0-360, 0-1, 0-1) o {neutro: true} si es blanco/negro/gris, con `alt`
// = segundo tono del escudo (≥60° del primero y con presencia), para cuando el primero choca con otro club elegido.
// Cacheado por imagen (las imágenes son del mismo origen: el canvas se puede leer).
const colorCache = new Map();

export function colorEscudo(src) {
  if (!src) return Promise.resolve({neutro: true});
  if (!colorCache.has(src)) colorCache.set(src, new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const T = 40, cv = document.createElement('canvas');
        cv.width = cv.height = T;
        const cx = cv.getContext('2d', {willReadFrequently: true});
        cx.drawImage(img, 0, 0, T, T);
        const px = cx.getImageData(0, 0, T, T).data;
        const bins = Array.from({length: 18}, () => ({n: 0, s: 0, l: 0, x: 0, y: 0}));
        let opacos = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 200) continue;
          opacos++;
          const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
          const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
          if (sat < .35 || l < .15 || l > .85) continue;   // blanco, negro, gris
          let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          hue = (hue * 60 + 360) % 360;
          const bn = bins[Math.floor(hue / 20) % 18];
          bn.n++;
          bn.s += sat;
          bn.l += l;
          bn.x += Math.cos(hue * Math.PI / 180);
          bn.y += Math.sin(hue * Math.PI / 180);
        }
        const tono = (bn) => ({
          h: (Math.atan2(bn.y, bn.x) * 180 / Math.PI + 360) % 360,
          s: bn.s / bn.n,
          l: bn.l / bn.n
        });
        const orden = bins.filter(bn => bn.n).sort((a, b) => b.n - a.n);
        const top = orden[0];
        if (!opacos || !top || top.n < opacos * .06) return res({neutro: true});
        const c = tono(top);
        const seg = orden.find(bn => bn.n >= top.n * .2 && bn.n >= opacos * .04 && distH(tono(bn).h, c.h) >= 60);
        res(seg ? {...c, alt: tono(seg)} : c);
      } catch {
        res({neutro: true});
      }
    };
    img.onerror = () => res({neutro: true});
    img.src = src;
  }));
  return colorCache.get(src);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function distH(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// Trazo legible sobre fondo claro y oscuro: saturación y luminosidad acotadas. Neutro -> color de texto del tema.
// `oscuro` (0-1) baja la luminosidad: variante algo más oscura del mismo tono (ej. los puntos sobre la línea).
export const trazo = (c, oscuro = 0) => (!c || c.neutro) ? (oscuro ? 'var(--texto)' : 'var(--texto-2)')
  : `hsl(${c.h.toFixed(0)} ${(clamp(c.s, .5, .85) * 100).toFixed(0)}% ${((clamp(c.l, .4, .58) - oscuro) * 100).toFixed(0)}%)`;
export const esNeutro = (c) => !c || c.neutro;
export const parecidos = (a, b) => (esNeutro(a) || esNeutro(b)) ? esNeutro(a) === esNeutro(b) : distH(a.h, b.h) < 28;

/**
 * Sección plegable (abierta) con el gráfico de posiciones por fecha.
 * @param contextos [{titulo, ev}] — una tabla (rueda única) o varias (zonas); ev = calcularEvolucion(...)
 * @param ui {escudoSrc(equipo) -> url|null, label(equipo) -> nombre mostrado}
 */
export function crearGraficoEvolucion(contextos, {escudoSrc, label}) {
  const colores = new Map();   // equipo -> {h,s,l}|{neutro}
  const sel = contextos.map(c => new Set(c.ev.equipos.slice(0, TOP_DEF).map(e => e.equipo)));
  let ci = 0, resaltado = null, hoverI = null;

  const zonaSel = contextos.length > 1
    ? h('select', {class: 'filtro evo-zona', 'aria-label': 'Zona'},
      ...contextos.map((c, i) => h('option', {value: String(i)}, c.titulo)))
    : null;
  const chips = h('div', {class: 'evo-chips'});
  const btn = (txt, fn) => h('button', {type: 'button', class: 'btn-periodo evo-btn', onclick: fn}, txt);
  const graf = h('div', {class: 'evo-graf'});
  const tip = h('div', {class: 'evo-tip', hidden: ''});
  const nota = h('p', {class: 'evo-nota'});
  graf.append(tip);

  const ev = () => contextos[ci].ev;
  const elegidos = () => ev().equipos.filter(e => sel[ci].has(e.equipo));
  // Estilo de cada elegido (en orden de posición final): su color principal; si choca con el de un elegido
  // anterior, el segundo color de su escudo; si también choca, el primer punteado libre entre los parecidos.
  const estilos = () => {
    const out = new Map(), vistos = [];
    for (const e of elegidos()) {
      const base = colores.get(e.equipo);
      const choca = (c) => vistos.some(v => parecidos(v.c, c));
      const c = (choca(base) && base && base.alt && !choca(base.alt)) ? base.alt : base;
      const usados = new Set(vistos.filter(v => parecidos(v.c, c)).map(v => v.d));
      let d = 0;
      while (usados.has(d) && d < DASHES.length - 1) d++;
      out.set(e.equipo, {col: trazo(c), dash: DASHES[d] || null});
      vistos.push({c, d});
    }
    return out;
  };
  const llave = (est, w) => {
    const k = s('svg', {class: 'evo-key', width: w, height: 8, 'aria-hidden': 'true'});
    k.append(s('line', {
      x1: 1, y1: 4, x2: w - 1, y2: 4, stroke: est.col, 'stroke-width': 2.5,
      'stroke-dasharray': est.dash
    }));
    return k;
  };

  function pintarChips() {
    const est = estilos();
    chips.replaceChildren(...ev().equipos.map(e => {
      const on = sel[ci].has(e.equipo), src = escudoSrc(e.equipo);
      return h('button', {
        type: 'button', class: 'evo-chip' + (on ? ' on' : ''), 'aria-pressed': String(on),
        title: `${e.final}º · ${label(e.equipo)}`,
        onclick: () => {
          sel[ci].has(e.equipo) ? sel[ci].delete(e.equipo) : sel[ci].add(e.equipo);
          redibujar();
        },
        onpointerenter: () => on && resaltar(e.equipo),
        onpointerleave: () => resaltar(null),
        onfocus: () => on && resaltar(e.equipo),
        onblur: () => resaltar(null),
      }, on ? llave(est.get(e.equipo), 18) : null, src ? h('img', {
        class: 'escudo',
        src,
        alt: ''
      }) : null, label(e.equipo));
    }));
  }

  function resaltar(eq) {
    resaltado = eq;
    for (const g of graf.querySelectorAll('g.evo-serie')) g.classList.toggle('tenue', !!eq && g.dataset.eq !== eq);
  }

  function dibujarSVG() {
    const W = graf.clientWidth;
    graf.querySelector('svg.evo-svg')?.remove();
    if (!W) return;   // plegado: se dibuja al abrir (toggle)
    const {pasos, equipos} = ev();
    const N = equipos.length, T = pasos.length;
    const ml = 34, mr = 26, mt = 10, mb = 30, fila = N > 24 ? 16 : 20;
    const H = mt + mb + Math.max(N - 1, 1) * fila;
    const x = (i) => ml + (T > 1 ? i * (W - ml - mr) / (T - 1) : (W - ml - mr) / 2);
    const y = (p) => mt + (p - 1) * fila;
    const svg = s('svg', {
      class: 'evo-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `Posición por fecha de ${elegidos().map(e => label(e.equipo)).join(', ') || 'ningún club'}`
    });

    // Ejes: posiciones (1 arriba) y fechas, con grilla recesiva.
    const ejes = s('g', {class: 'evo-ejes'});
    for (let p = 1; p <= N; p++) {
      const marca = p === 1 || p === N || p % 5 === 0;
      ejes.append(s('line', {x1: ml, x2: W - mr, y1: y(p), y2: y(p), class: marca ? 'grid' : 'grid sutil'}));
      if (marca || N <= 20) {
        const t = s('text', {x: ml - 8, y: y(p), class: 'eje-y'});
        t.textContent = p + 'º';
        ejes.append(t);
      }
    }
    const cada = Math.max(1, Math.ceil(T / Math.max(1, Math.floor((W - ml - mr) / 26))));
    pasos.forEach((p, i) => {
      if (i % cada && i !== T - 1) return;
      if (i === T - 1 && i % cada && (T - 1) % cada < cada / 2) return;   // la última no pisa a la anterior
      const t = s('text', {x: x(i), y: H - mb + 18, class: 'eje-x'});
      t.textContent = p.corto;
      ejes.append(t);
    });
    svg.append(ejes);

    // Series: los elegidos, del peor al mejor (el líder queda dibujado arriba). Escudo al final de cada línea.
    const est = estilos();
    for (const e of elegidos().slice().reverse()) {
      const {col, dash} = est.get(e.equipo);
      const g = s('g', {class: 'evo-serie', 'data-eq': e.equipo});
      g.append(s('polyline', {
        points: e.pos.map((p, i) => `${x(i).toFixed(1)},${y(p)}`).join(' '),
        fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': dash,
      }));
      const src = escudoSrc(e.equipo), xf = x(T - 1), yf = y(e.pos[T - 1]);
      if (src) g.append(s('image', {href: src, x: xf + 5, y: yf - 8, width: 16, height: 16}));
      else g.append(s('circle', {cx: xf, cy: yf, r: 4, fill: col, class: 'evo-punto'}));
      svg.append(g);
    }

    // Capa de hover: la cruz vertical busca la fecha más cercana; el tooltip lista a todos los elegidos.
    const cruz = s('line', {class: 'evo-cruz', y1: mt - 4, y2: H - mb + 4, visibility: 'hidden'});
    const puntos = s('g', {class: 'evo-puntos'});
    const capa = s('rect', {
      x: ml - 10, y: 0, width: W - ml - mr + 20, height: H, class: 'evo-capa', tabindex: 0,
      'aria-label': 'Recorrer las fechas con las flechas izquierda y derecha'
    });
    svg.append(cruz, puntos, capa);

    const mostrar = (i) => {
      hoverI = i;
      if (i == null) {
        cruz.setAttribute('visibility', 'hidden');
        puntos.replaceChildren();
        tip.hidden = true;
        return;
      }
      cruz.setAttribute('x1', x(i));
      cruz.setAttribute('x2', x(i));
      cruz.setAttribute('visibility', 'visible');
      const filas = elegidos().slice().sort((a, b) => a.pos[i] - b.pos[i]);
      puntos.replaceChildren(...filas.map(e => s('circle', {
        cx: x(i), cy: y(e.pos[i]), r: 4, fill: est.get(e.equipo).col, class: 'evo-punto'
      })));
      tip.replaceChildren(
        h('div', {class: 'evo-tip-tit'}, pasos[i].etq),
        ...(filas.length ? filas : []).map(e => {
          const r = e.res[i];
          const partido = r
            ? `${r.r === 'G' ? 'Ganó' : r.r === 'P' ? 'Perdió' : 'Empató'} ${r.gf ?? '?'}-${r.gc ?? '?'} `
            + `${r.local ? 'vs' : 'en'} ${label(r.rival)}`
            : 'Sin partido';
          return h('div', {class: 'evo-tip-fila'},
            h('b', {class: 'evo-tip-pos'}, e.pos[i] + 'º'), llave(est.get(e.equipo), 14),
            h('span', {class: 'evo-tip-eq'}, label(e.equipo)),
            // 1988/89: los puntos por penales se reparten entre los empates -> aproximado (≈)
            h('b', {class: 'evo-tip-pts'}, `${Number.isInteger(e.pts[i]) ? e.pts[i] : '≈' + Math.round(e.pts[i])} pts`),
            h('span', {class: 'evo-tip-res'}, partido));
        }));
      tip.hidden = !filas.length;
      // El tooltip va del lado de la cruz que tenga lugar.
      const tw = tip.offsetWidth, izq = x(i) + 14 + tw > W ? x(i) - 14 - tw : x(i) + 14;
      tip.style.left = Math.max(0, izq) + 'px';
      tip.style.top = mt + 'px';
    };
    const iDesde = (e0) => {
      const px = e0.clientX - svg.getBoundingClientRect().left;
      return T > 1 ? clamp(Math.round((px - ml) / ((W - ml - mr) / (T - 1))), 0, T - 1) : 0;
    };
    capa.addEventListener('pointermove', (e0) => mostrar(iDesde(e0)));
    capa.addEventListener('pointerleave', () => mostrar(null));
    capa.addEventListener('blur', () => mostrar(null));
    capa.addEventListener('keydown', (e0) => {
      if (e0.key !== 'ArrowLeft' && e0.key !== 'ArrowRight') return;
      e0.preventDefault();
      const paso = e0.key === 'ArrowLeft' ? -1 : 1;
      mostrar(clamp(hoverI == null ? (paso < 0 ? T - 1 : 0) : hoverI + paso, 0, T - 1));
    });
    graf.prepend(svg);
    if (resaltado) resaltar(resaltado);
  }

  function redibujar() {
    pintarChips();
    dibujarSVG();
    const {pasos, equipos} = ev();
    nota.textContent = `Posición tras cada una de las ${pasos.length} fechas (${equipos.length} clubes), calculada `
      + 'con los partidos por puntos, diferencia de gol y goles a favor. La última fecha coincide con la tabla '
      + 'oficial; los descuentos de puntos se aplican desde el comienzo.';
  }

  function cargarColores() {
    const faltan = ev().equipos.filter(e => !colores.has(e.equipo));
    if (!faltan.length) return;
    Promise.all(faltan.map(e => colorEscudo(escudoSrc(e.equipo)).then(c => colores.set(e.equipo, c))))
      .then(() => det.isConnected && redibujar());
  }

  if (zonaSel) zonaSel.addEventListener('change', () => {
    ci = +zonaSel.value;
    hoverI = null;
    tip.hidden = true;
    redibujar();
    cargarColores();
  });

  const acciones = h('div', {class: 'evo-acciones'},
    zonaSel,
    btn(`${TOP_DEF} primeros`, () => {
      sel[ci] = new Set(ev().equipos.slice(0, TOP_DEF).map(e => e.equipo));
      redibujar();
    }),
    btn('Todos', () => {
      sel[ci] = new Set(ev().equipos.map(e => e.equipo));
      redibujar();
    }),
    btn('Ninguno', () => {
      sel[ci].clear();
      redibujar();
    }));
  const det = h('details', {class: 'plegable evolucion', open: ''},
    h('summary', {}, 'Evolución de posiciones'),
    acciones, chips, graf, nota);
  det.addEventListener('toggle', () => det.open && dibujarSVG());
  // Ancho responsivo: se redibuja si cambia el ancho del contenedor (y se suelta al salir de la vista).
  let ancho = 0;
  const ro = new ResizeObserver(() => {
    if (!det.isConnected && ancho) return ro.disconnect();
    if (graf.clientWidth && graf.clientWidth !== ancho) {
      ancho = graf.clientWidth;
      dibujarSVG();
    }
  });
  ro.observe(graf);
  redibujar();
  cargarColores();
  return det;
}
