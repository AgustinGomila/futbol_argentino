// Gráfico del HISTORIAL entre dos clubes (Mano a mano y desglose por rival en la ficha de club): partidos
// GANADOS acumulados de cada uno, año a año, para ver quién lleva la ventaja y CUÁNDO se revierte (los cruces de
// las líneas). Eje X = años (todos, del primer al último enfrentamiento: cada año queda justo sobre su rótulo),
// eje Y = victorias acumuladas. Misma cosmética que los otros gráficos de líneas (js/evolucion.js: color del
// escudo, escudo al final de cada línea, cruz + tooltip), pero SIN puntos en las coordenadas.

import {clamp, colorEscudo, h, parecidos, s, trazo} from './evolucion.js';

/**
 * @param ms  partidos entre ambos (cualquier orden); cada uno con l/v, r ('L'|'V'|'E') y fecha/año
 * @param o   {esA(nombre) -> bool (el partido es del club A de ese lado), anio(p) -> año del partido,
 *             nombreA, nombreB (para mostrar), escudoA, escudoB (url | null)}
 * @returns <details> abierto (plegable) o null si no hay al menos dos años con partidos con resultado.
 */
export function crearGraficoHistorial(ms, {esA, anio, nombreA, nombreB, escudoA, escudoB}) {
  // Resultado de cada partido desde A: G / P / E (sin resultado oficial -> no cuenta).
  const porAnio = new Map();   // año -> {g, p, e}
  for (const m of ms) {
    const y = anio(m);
    if (!y || !['L', 'V', 'E'].includes(m.r)) continue;
    const ganaLocal = m.r === 'L', ganaVis = m.r === 'V';
    const aLocal = esA(m.l);
    const t = porAnio.get(y) || porAnio.set(y, {g: 0, p: 0, e: 0}).get(y);
    if (m.r === 'E') t.e++;
    else if ((ganaLocal && aLocal) || (ganaVis && !aLocal)) t.g++;
    else t.p++;
  }
  const anios = [...porAnio.keys()].sort((a, b) => a - b);
  if (anios.length < 2) return null;
  // Serie COMPLETA de años (los sin partidos repiten el acumulado: la línea sigue horizontal).
  const serie = [];
  let G = 0, P = 0, E = 0;
  for (let y = anios[0]; y <= anios[anios.length - 1]; y++) {
    const t = porAnio.get(y) || {g: 0, p: 0, e: 0};
    G += t.g;
    P += t.p;
    E += t.e;
    serie.push({y, G, P, E, ...t});
  }

  const graf = h('div', {class: 'evo-graf hist-graf'});
  const tip = h('div', {class: 'evo-tip', hidden: ''});
  const leyenda = h('div', {class: 'hist-leyenda'});
  graf.append(tip);
  let colA = null, colB = null, hoverI = null;

  // Estilo de cada línea: color del escudo; si los dos se parecen, B usa el 2º color de su escudo o, si también
  // choca, trazo punteado (mismo criterio que la evolución por fecha).
  function estilos() {
    const a = {col: trazo(colA), dash: null};
    let cb = colB;
    if (parecidos(colA, cb) && cb && cb.alt && !parecidos(colA, cb.alt)) cb = cb.alt;
    return [a, {col: trazo(cb), dash: parecidos(colA, cb) ? '7 4' : null}];
  }

  const llave = (est) => {
    const k = s('svg', {class: 'evo-key', width: 18, height: 8, 'aria-hidden': 'true'});
    k.append(s('line', {
      x1: 1,
      y1: 4,
      x2: 17,
      y2: 4,
      stroke: est.col,
      'stroke-width': 2.5,
      'stroke-dasharray': est.dash
    }));
    return k;
  };

  function dibujar() {
    const W = graf.clientWidth;
    graf.querySelector('svg.evo-svg')?.remove();
    if (!W) return;
    const [eA, eB] = estilos();
    const ult = serie[serie.length - 1];
    leyenda.replaceChildren(
      h('span', {}, llave(eA), escudoA ? h('img', {class: 'escudo', src: escudoA, alt: ''}) : null,
        `${nombreA}: `, h('b', {}, String(ult.G))),
      h('span', {}, llave(eB), escudoB ? h('img', {class: 'escudo', src: escudoB, alt: ''}) : null,
        `${nombreB}: `, h('b', {}, String(ult.P))),
      h('span', {class: 'sub'}, `Empates: ${ult.E}`));

    const ml = 36, mr = 26, mt = 12, mb = 28, alto = 200;
    const H = mt + mb + alto;
    const ymax = Math.max(1, ult.G, ult.P);
    const x0 = serie[0].y, x1 = serie[serie.length - 1].y;
    const x = (y) => ml + (y - x0) * (W - ml - mr) / Math.max(x1 - x0, 1);
    const y = (v) => mt + alto - v * alto / ymax;
    const svg = s('svg', {
      class: 'evo-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `Partidos ganados acumulados: ${nombreA} ${ult.G}, ${nombreB} ${ult.P}`
    });

    const ejes = s('g', {class: 'evo-ejes'});
    // Eje Y: 0 y marcas "redondas" (1, 2, 5, 10, 20, 25, 50…) hasta el máximo, con grilla recesiva.
    const pasoY = [1, 2, 5, 10, 20, 25, 50, 100].find(k => ymax / k <= 5) || 100;
    for (let v = 0; v <= ymax; v += pasoY) {
      ejes.append(s('line', {x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: v ? 'grid sutil' : 'grid'}));
      const t = s('text', {x: ml - 8, y: y(v), class: 'eje-y'});
      t.textContent = String(v);
      ejes.append(t);
    }
    // Eje X: años redondos según el ancho (todos si entran).
    const span = x1 - x0, pasoX = [1, 2, 5, 10, 20, 25, 50].find(k => span / k <= (W - ml - mr) / 44) || 50;
    for (let a = Math.ceil(x0 / pasoX) * pasoX; a <= x1; a += pasoX) {
      const t = s('text', {x: x(a), y: H - mb + 18, class: 'eje-x'});
      t.textContent = String(a);
      ejes.append(t, s('line', {x1: x(a), x2: x(a), y1: H - mb, y2: H - mb + 4, class: 'grid'}));
    }
    svg.append(ejes);

    // Líneas (sin puntos) + escudo al final de cada una.
    const linea = (k, est, esc) => {
      const g = s('g', {class: 'evo-serie'});
      g.append(s('polyline', {
        points: serie.map(d => `${x(d.y).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' '),
        fill: 'none', stroke: est.col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': est.dash,
      }));
      if (esc) g.append(s('image', {href: esc, x: x(x1) + 5, y: y(ult[k]) - 8, width: 16, height: 16}));
      svg.append(g);
    };
    linea('P', eB, escudoB);
    linea('G', eA, escudoA);
    // Si las líneas terminan muy juntas, el escudo de B baja un poco para no encimarse con el de A.
    const imgs = svg.querySelectorAll('g.evo-serie image');
    if (imgs.length === 2 && Math.abs(y(ult.G) - y(ult.P)) < 16) {
      imgs[0].setAttribute('y', String(+imgs[0].getAttribute('y') + (ult.P <= ult.G ? 9 : -9)));
      imgs[1].setAttribute('y', String(+imgs[1].getAttribute('y') + (ult.P <= ult.G ? -9 : 9)));
    }

    // Hover: cruz vertical en el año más cercano + tooltip con el acumulado y lo de ese año.
    const cruz = s('line', {class: 'evo-cruz', y1: mt - 4, y2: H - mb + 4, visibility: 'hidden'});
    const puntos = s('g', {class: 'evo-puntos'});
    const capa = s('rect', {
      x: ml - 6, y: 0, width: W - ml - mr + 12, height: H, class: 'evo-capa', tabindex: 0,
      'aria-label': 'Recorrer los años con las flechas izquierda y derecha'
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
      const d = serie[i], cx = x(d.y);
      cruz.setAttribute('x1', cx);
      cruz.setAttribute('x2', cx);
      cruz.setAttribute('visibility', 'visible');
      puntos.replaceChildren(
        s('circle', {cx, cy: y(d.P), r: 4, fill: eB.col, class: 'evo-punto'}),
        s('circle', {cx, cy: y(d.G), r: 4, fill: eA.col, class: 'evo-punto'}));
      const dif = d.G - d.P;
      const enAnio = d.g + d.p + d.e;
      tip.replaceChildren(
        h('div', {class: 'evo-tip-tit'}, `Hasta ${d.y}`),
        h('div', {class: 'evo-tip-fila hist'}, llave(eA), h('span', {class: 'evo-tip-eq'}, nombreA),
          h('b', {class: 'evo-tip-pts'}, String(d.G))),
        h('div', {class: 'evo-tip-fila hist'}, llave(eB), h('span', {class: 'evo-tip-eq'}, nombreB),
          h('b', {class: 'evo-tip-pts'}, String(d.P))),
        h('div', {class: 'evo-tip-res'}, `Empates: ${d.E} · `
          + (dif ? `ventaja ${dif > 0 ? nombreA : nombreB} +${Math.abs(dif)}` : 'historial igualado')),
        h('div', {class: 'evo-tip-res'}, enAnio
          ? `En ${d.y}: ${enAnio} partido${enAnio > 1 ? 's' : ''} (${nombreA} ${d.g}G ${d.e}E ${d.p}P)`
          : `En ${d.y}: sin partidos`));
      tip.hidden = false;
      const tw = tip.offsetWidth, izq = cx + 14 + tw > W ? cx - 14 - tw : cx + 14;
      tip.style.left = Math.max(0, izq) + 'px';
      tip.style.top = mt + 'px';
    };
    const iDesde = (e) => {
      const px = e.clientX - svg.getBoundingClientRect().left;
      return clamp(Math.round((px - ml) / ((W - ml - mr) / Math.max(x1 - x0, 1))), 0, serie.length - 1);
    };
    capa.addEventListener('pointermove', (e) => mostrar(iDesde(e)));
    capa.addEventListener('pointerleave', () => mostrar(null));
    capa.addEventListener('blur', () => mostrar(null));
    capa.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      mostrar(clamp(hoverI == null ? (d < 0 ? serie.length - 1 : 0) : hoverI + d, 0, serie.length - 1));
    });
    graf.prepend(svg);
  }

  const det = h('details', {class: 'plegable evolucion historial', open: ''},
    h('summary', {}, 'Evolución del historial ', h('span', {class: 'sub'}, '(partidos ganados acumulados)')),
    leyenda, graf);
  det.addEventListener('toggle', () => det.open && dibujar());
  let ancho = 0;
  const ro = new ResizeObserver(() => {
    if (!det.isConnected && ancho) return ro.disconnect();
    if (graf.clientWidth && graf.clientWidth !== ancho) {
      ancho = graf.clientWidth;
      dibujar();
    }
  });
  ro.observe(graf);
  Promise.all([colorEscudo(escudoA), colorEscudo(escudoB)]).then(([a, b]) => {
    colA = a;
    colB = b;
    if (det.isConnected) dibujar();
  });
  return det;
}
