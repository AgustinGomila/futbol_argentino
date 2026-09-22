// Trayectoria de un club (ficha #/club/<id>): posición FINAL en cada certamen de liga, año a año, en Primera, Segunda y
// Tercera división sobre el MISMO eje vertical (los años en una categoría inferior a la más alta que jugó el club =
// franjas verticales sombreadas, más oscuras cuanto más baja la categoría). Dos partes:
//   - trayectoriaClub: PURA (sin DOM). Un punto por certamen (las ligas con campeón o en curso de cada categoría).
//   - crearGraficoTrayectoria: gráfico SVG (mismo estilo que la evolución por fecha de js/evolucion.js).
// Posición final = puesto en la tabla GENERAL del torneo (la principal o, si se jugó por zonas, la acumulada),
// con el criterio oficial Pts, DIF, GF. Campeón/subcampeón se marcan aparte (en torneos con eliminatorias el
// campeón puede no ser 1º de la tabla).

import {clamp, colorEscudo, h, s, trazo} from './evolucion.js';

const N = (v) => (v == null ? -1e9 : v);
const difDe = (f) => f.DIF ?? ((f.GF ?? 0) - (f.GC ?? 0));

/**
 * @param nombres Set de denominaciones del club (canónica + las fusionadas en él)
 * @param cats [{cat: 'primera'|'segunda'|'tercera'|'cuarta', ruta, torneos, posiciones, campeones}]
 * @returns [{cat, gid, nombre, anio, x, pos, n, acumulada, fase, camp: 'campeon'|'sub'|null, enCurso, href, corte}]
 *   ordenados por x (el año del certamen; ver paso 2). corte = la línea NO se une con el punto anterior (el club no
 *   jugó algún certamen de su categoría entre ambos; ver abajo). Un año sin liga (2020) NO corta.
 */
export function trayectoriaClub(nombres, cats) {
  const out = [];
  const xsCat = {};   // categoría -> x de TODOS sus certámenes con tabla (para detectar los que el club no jugó)
  const diaDe = (t) => {   // fecha del 1er partido en días (para ordenar/agrupar dentro de un año); null sin fecha
    const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.f0 || '');
    return f ? Date.UTC(+f[1], +f[2] - 1, +f[3]) / 864e5 : null;
  };
  for (const {cat, ruta, torneos, posiciones, campeones} of cats) {
    if (!torneos || !posiciones) continue;
    const puesto = (id) => {   // filas en orden oficial (Pts, DIF, GF) + índice del club (-1 si no está)
      const filas = posiciones[id].slice()
        .sort((a, b) => N(b.Pts) - N(a.Pts) || difDe(b) - difDe(a) || N(b.GF) - N(a.GF));
      return {filas, i: filas.findIndex(f => nombres.has(f.equipo))};
    };
    const porGrupo = {};
    for (const t of torneos) (porGrupo[t.grupo || t.id] ??= []).push(t);
    // 1) Certámenes de la categoría: las ligas reales (con campeón o en curso, mismo criterio que el desplegable)
    // con tabla GENERAL (la principal o la acumulada) o, sin ninguna (1990/91: Apertura y Clausura como fases antes
    // de la final; 1929: Grupo Par/Impar), las tablas de la fase regular (un punto por tabla, rotulado con su fase).
    const certs = [];
    for (const rep of torneos) {
      if ((rep.grupo || rep.id) !== rep.id || rep.naturaleza !== 'liga') continue;
      if (!(campeones && campeones[rep.id]) && !rep.en_curso) continue;
      const ms = (porGrupo[rep.id] || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const conFilas = (m) => (posiciones[m.id] || []).length >= 3;
      const general = ['principal', 'acumulada'].map(sec => ms.find(m => m.seccion === sec && conFilas(m)))
        .find(Boolean);
      const tablas = general ? [general] : ms.filter(m => m.seccion === 'grupos' && conFilas(m));
      if (tablas.length) certs.push({rep, general, tablas});
    }
    // 2) Eje X en AÑOS: el (primer) certamen de cada año va JUSTO sobre su año (rep.anio, el de cierre), es decir
    // encima del rótulo y la marca del eje. Si el año tiene certámenes sucesivos (Apertura/Clausura, Metropolitano/
    // Nacional), los siguientes se reparten a continuación en orden de inicio (2 -> año y año + ½; sin fecha de
    // inicio, al final). Las ligas PARALELAS (arrancan dentro de los 45 días: AAF/AAmF, LAF/AAF) comparten posición.
    const xRep = new Map();
    const porAnio = {};
    for (const c of certs) (porAnio[c.rep.anio || 0] ??= []).push(c);
    for (const [anio, cs] of Object.entries(porAnio)) {
      cs.sort((a, b) => (diaDe(a.rep) ?? Infinity) - (diaDe(b.rep) ?? Infinity));
      const grupos = [];
      for (const c of cs) {
        const d = diaDe(c.rep), g = grupos[grupos.length - 1];
        if (g && d != null && g.d != null && d - g.d <= 45) g.cs.push(c);
        else grupos.push({d, cs: [c]});
      }
      grupos.forEach((g, k) => g.cs.forEach(c => xRep.set(c.rep.id, +anio + k / grupos.length)));
    }
    xsCat[cat] = certs.map(c => xRep.get(c.rep.id));
    // 3) Puntos del club.
    for (const {rep, general, tablas} of certs) {
      const camp = campeones && campeones[rep.id];
      const enC = (n) => n && nombres.has(n);
      const m = tablas.length;
      const mio = tablas.map((t, k) => ({t, k, ...puesto(t.id)})).filter(o => o.i >= 0);
      mio.forEach(({t, k, filas, i}, j) => {
        const ultima = j === mio.length - 1;   // campeón/subcampeón del torneo: en el último punto del club
        out.push({
          cat, gid: rep.id, nombre: (rep.nombre || rep.id) + (general ? '' : ` · ${t.fase}`), anio: rep.anio,
          // fases sin tabla general (Apertura -> Clausura): la 1ª sobre el año, las demás a continuación
          x: xRep.get(rep.id) + k / m, pos: i + 1, n: filas.length,
          acumulada: t.seccion === 'acumulada', fase: general ? null : t.fase, enCurso: !!rep.en_curso,
          camp: !ultima || !camp ? null
            : (enC(camp.campeon) || enC(camp.cocampeon)) ? 'campeon' : enC(camp.sub) ? 'sub' : null,
          href: `${ruta}?t=${encodeURIComponent(rep.id)}`,
        });
      });
    }
  }
  out.sort((a, b) => a.x - b.x);
  // El club en DOS ligas paralelas el mismo año (Almagro 1920: AAF y AAmF): el 2º punto, apenas corrido.
  out.forEach((p, k) => {
    if (k && p.x - out[k - 1].x < .1) p.x = out[k - 1].x + .2;
  });
  // Corte: más de ~1,5 años entre dos puntos seguidos del club Y algún certamen de la categoría de alguno de los
  // dos jugado en el medio (el club estuvo en otra división o desafiliado). Solo el tiempo no alcanza: 2020 no
  // tuvo liga (Boca 2019/20 -> 2021 va unido). Solo los certámenes tampoco: las ligas paralelas (AAF/AAmF
  // 1919-26, LAF/AAF 1931-34) y el torneo de la otra categoría en un ascenso/descenso caen en el medio.
  out.forEach((p, k) => {
    const a = out[k - 1];
    p.corte = !a || (p.x - a.x > 1.6
      && [...new Set([a.cat, p.cat])].some(c => (xsCat[c] || []).some(x => x > a.x + .02 && x < p.x - .02)));
  });
  return out;
}

const CAT_LBL = {primera: 'Primera División', segunda: 'Segunda división', tercera: 'Tercera división',
  cuarta: 'Cuarta división'};
const NIVEL = {primera: 1, segunda: 2, tercera: 3, cuarta: 4};
const CAT_CORTO = {primera: 'Primera', segunda: 'Segunda', tercera: 'Tercera', cuarta: 'Cuarta'};
const CLAVE_MODO = 'trayectoria-modo';   // localStorage: 'abs' (puesto) | 'rel' (posición relativa)
// Proporción de los DEMÁS participantes que terminaron por debajo: 1º = 1, último = 0 (certamen de 1 equipo: 1).
const sobre = (p) => p.n > 1 ? (p.n - p.pos) / (p.n - 1) : 1;

/**
 * Sección plegable (abierta) con la trayectoria del club.
 * @param pts  trayectoriaClub(...)
 * @param ui   {escudoSrc: url del escudo del club | null}
 */
export function crearGraficoTrayectoria(pts, {escudoSrc}) {
  const graf = h('div', {class: 'evo-graf tray-graf'});
  const tip = h('div', {class: 'evo-tip', hidden: ''});
  graf.append(tip);
  let color = null, hoverI = null;
  let modo = 'abs';
  try {
    if (localStorage.getItem(CLAVE_MODO) === 'rel') modo = 'rel';
  } catch { /* sin storage: puesto absoluto */
  }

  const cuenta = (c) => pts.filter(p => p.cat === c).length;
  const tit = pts.filter(p => p.camp === 'campeon').length;
  const resumen = [...Object.keys(NIVEL).map(c => cuenta(c) && `${cuenta(c)} en ${CAT_CORTO[c]}`),
    tit && `${tit} título${tit > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
  // Categorías sombreadas: las inferiores a la más alta que jugó el club (un club solo de Segunda no lleva franjas;
  // uno de Segunda y Tercera, solo en los años en Tercera).
  const nivelTope = Math.min(...pts.map(p => NIVEL[p.cat]));
  const sombreadas = Object.keys(NIVEL).filter(c => NIVEL[c] > nivelTope && cuenta(c));

  function dibujar() {
    const W = graf.clientWidth;
    graf.querySelector('svg.evo-svg')?.remove();
    if (!W) return;
    // Eje vertical ÚNICO (1..máximo de equipos de cualquier certamen): los puestos de todas las categorías se
    // leen en la misma escala; los años en una categoría inferior se distinguen con una FRANJA VERTICAL sombreada.
    // Modo RELATIVA: proporción de participantes que quedaron por debajo (1º = 100 % arriba, último = 0 % abajo),
    // independiente de cuántos equipos jugaron cada certamen.
    const rel = modo === 'rel';
    const max = Math.max(...pts.map(p => p.n));
    const ml = 40, mr = 16, mt = 10, mb = 28;
    const altoPlot = rel ? 220 : clamp(max * 8, 140, 300);
    const H = mt + mb + altoPlot;
    const u = altoPlot / Math.max(max - 1, 1);
    const yP = (pos) => mt + (pos - 1) * u;
    const yR = (sup) => mt + (1 - sup) * altoPlot;
    const y = (p) => rel ? yR(sobre(p)) : yP(p.pos);
    const x0 = Math.floor(pts[0].x) - .5, x1 = Math.ceil(pts[pts.length - 1].x) + .5;
    const x = (v) => ml + (v - x0) * (W - ml - mr) / Math.max(x1 - x0, 1);

    const svg = s('svg', {
      class: 'evo-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': 'Posición final en cada certamen de liga'
    });
    const ejes = s('g', {class: 'evo-ejes'});
    // Franjas de cada categoría sombreada: cada tramo consecutivo de certámenes en ella, del punto medio con el
    // certamen anterior al punto medio con el siguiente (o ±medio año si no hay vecino cercano).
    // (unido = vecino sin corte de línea entre ambos)
    const borde = (a, b, lado, unido) => (b && unido) ? (a.x + b.x) / 2 : a.x + lado * .5;
    for (let i = 0; i < pts.length; i++) {
      const c = pts[i].cat;
      if (!sombreadas.includes(c)) continue;
      let k = i;
      while (k + 1 < pts.length && pts[k + 1].cat === c && !pts[k + 1].corte) k++;
      const xa = x(clamp(borde(pts[i], pts[i - 1], -1, !pts[i].corte), x0, x1));
      const xb = x(clamp(borde(pts[k], pts[k + 1], 1, pts[k + 1] && !pts[k + 1].corte), x0, x1));
      ejes.append(s('rect', {
        x: xa, y: mt - 6, width: Math.max(xb - xa, 2), height: altoPlot + 12,
        class: 'tray-franja tray-franja-' + c
      }));
      i = k;
    }
    if (rel) {
      for (const [v, etq] of [[1, '1º'], [.75, '75 %'], [.5, '50 %'], [.25, '25 %'], [0, 'últ.']]) {
        ejes.append(s('line', {x1: ml, x2: W - mr, y1: yR(v), y2: yR(v), class: 'grid sutil'}));
        const t = s('text', {x: ml - 8, y: yR(v), class: 'eje-y'});
        t.textContent = etq;
        ejes.append(t);
      }
    } else {
      const marcas = [...new Set([1, ...Array.from({length: Math.floor(max / 5)}, (_, k) => (k + 1) * 5), max])];
      for (const p of marcas) {
        if (p !== 1 && p !== max && max - p < 3) continue;   // el máximo no pisa a la marca anterior
        ejes.append(s('line', {x1: ml, x2: W - mr, y1: yP(p), y2: yP(p), class: 'grid sutil'}));
        const t = s('text', {x: ml - 8, y: yP(p), class: 'eje-y'});
        t.textContent = p + 'º';
        ejes.append(t);
      }
    }
    // Años: una marca cada 5/10/20/25 años según el ancho.
    const span = x1 - x0, paso = [1, 2, 5, 10, 20, 25, 50].find(k => span / k <= (W - ml - mr) / 48) || 50;
    for (let a = Math.ceil(x0 / paso) * paso; a <= x1; a += paso) {
      const t = s('text', {x: x(a), y: H - mb + 18, class: 'eje-x'});
      t.textContent = String(a);
      ejes.append(t, s('line', {x1: x(a), x2: x(a), y1: H - mb, y2: H - mb + 4, class: 'grid'}));
    }
    svg.append(ejes);

    // Línea del club: se corta donde no jugó algún certamen de su categoría (p.corte, ver trayectoriaClub).
    const col = trazo(color);
    const tramos = [];
    for (const [i, p] of pts.entries()) {
      if (!i || p.corte) tramos.push([]);
      tramos[tramos.length - 1].push(p);
    }
    for (const tr of tramos) {
      svg.append(s('polyline', {
        points: tr.map(p => `${x(p.x).toFixed(1)},${y(p).toFixed(1)}`).join(' '),
        fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    }
    // Punto de cada certamen: SIN borde y un tono más oscuro que la línea (con muchos años, un aro cortaría la
    // línea). Campeón/subcampeón: punto más grande, dorado/plateado, con aro para separarlo de la línea.
    const colPunto = trazo(color, .1);
    for (const p of pts) {
      svg.append(s('circle', {
        cx: x(p.x), cy: y(p), r: p.camp ? 5 : 2.5,
        class: p.camp ? 'evo-punto tray-' + p.camp : 'tray-punto', fill: p.camp ? null : colPunto
      }));
    }

    // Hover: el certamen más cercano al puntero (en x); clic abre el torneo.
    const cruz = s('line', {class: 'evo-cruz', y1: mt - 4, y2: H - mb + 4, visibility: 'hidden'});
    const marca = s('circle', {r: 6, class: 'tray-marca', visibility: 'hidden'});
    const capa = s('rect', {
      x: ml - 6, y: 0, width: W - ml - mr + 12, height: H, class: 'evo-capa tray-capa',
      tabindex: 0, 'aria-label': 'Recorrer los certámenes con las flechas; Enter abre el torneo'
    });
    svg.append(cruz, marca, capa);
    const mostrar = (i) => {
      hoverI = i;
      const vis = i == null ? 'hidden' : 'visible';
      cruz.setAttribute('visibility', vis);
      marca.setAttribute('visibility', vis);
      if (i == null) return void (tip.hidden = true);
      const p = pts[i];
      cruz.setAttribute('x1', x(p.x));
      cruz.setAttribute('x2', x(p.x));
      marca.setAttribute('cx', x(p.x));
      marca.setAttribute('cy', y(p));
      tip.replaceChildren(...[
        h('div', {class: 'evo-tip-tit'}, p.nombre + (p.enCurso ? ' (en curso)' : '')),
        h('div', {class: 'tray-tip-pos'}, h('b', {}, `${p.pos}º`), ` de ${p.n}`,
          h('span', {class: 'evo-tip-res'}, ` · ${CAT_LBL[p.cat]}${p.acumulada ? ' (tabla acumulada)' : ''}`)),
        h('div', {class: 'evo-tip-res'}, p.pos === 1 ? 'Primero entre los participantes'
          : p.pos === p.n ? 'Último entre los participantes'
            : `Por encima del ${Math.round(sobre(p) * 100)} % de los participantes`),
        p.camp ? h('div', {class: 'tray-tip-camp tray-' + p.camp}, p.camp === 'campeon' ? '🏆 Campeón' : 'Subcampeón')
          : null].filter(Boolean));
      tip.hidden = false;
      const tw = tip.offsetWidth, izq = x(p.x) + 14 + tw > W ? x(p.x) - 14 - tw : x(p.x) + 14;
      tip.style.left = Math.max(0, izq) + 'px';
      tip.style.top = mt + 'px';
    };
    const cercano = (px) => {
      let mejor = 0;
      pts.forEach((p, i) => {
        if (Math.abs(x(p.x) - px) < Math.abs(x(pts[mejor].x) - px)) mejor = i;
      });
      return mejor;
    };
    const pxDe = (e) => e.clientX - svg.getBoundingClientRect().left;
    capa.addEventListener('pointermove', (e) => mostrar(cercano(pxDe(e))));
    capa.addEventListener('pointerleave', () => mostrar(null));
    capa.addEventListener('blur', () => mostrar(null));
    capa.addEventListener('click', (e) => {
      location.hash = pts[cercano(pxDe(e))].href;
    });
    capa.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && hoverI != null) return void (location.hash = pts[hoverI].href);
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      mostrar(clamp(hoverI == null ? (d < 0 ? pts.length - 1 : 0) : hoverI + d, 0, pts.length - 1));
    });
    graf.prepend(svg);
  }

  const NOTA = {
    abs: 'Puesto en la tabla general del torneo (la acumulada si se jugó por zonas), por Pts, diferencia de gol '
      + 'y goles a favor. Clic en un punto para ver el torneo.',
    rel: 'Posición relativa: proporción de los demás participantes que terminaron por debajo (1º = 100 %, '
      + 'último = 0 %), sin importar cuántos equipos jugó cada certamen; en los años en Segunda o Tercera, respecto '
      + 'de esa categoría. Clic en un punto para ver el torneo.',
  };
  const nota = h('span', {class: 'evo-nota'}, NOTA[modo]);
  const leyenda = h('div', {class: 'tray-leyenda'},
    ...sombreadas.map(c => h('span', {}, h('i', {class: 'tray-sw tray-sw-' + c}), `Años en ${CAT_LBL[c]}`)),
    h('span', {}, h('i', {class: 'tray-dot tray-campeon'}), 'Campeón'),
    h('span', {}, h('i', {class: 'tray-dot tray-sub'}), 'Subcampeón'),
    nota);
  // Selector Puesto / Relativa (mismo estilo que los modos del historial de la ficha); recuerda la elección.
  const modos = h('div', {class: 'club-modos tray-modos', role: 'group', 'aria-label': 'Escala del gráfico'});
  for (const [k, etq, tit] of [['abs', 'Puesto', 'Puesto final en la tabla'],
    ['rel', 'Relativa', 'Posición relativa al total de participantes de cada certamen']]) {
    const b = h('button', {
      type: 'button', class: 'modo-btn' + (k === modo ? ' activo' : ''), title: tit,
      'aria-pressed': String(k === modo)
    }, etq);
    b.addEventListener('click', () => {
      if (modo === k) return;
      modo = k;
      try {
        localStorage.setItem(CLAVE_MODO, k);
      } catch { /* sin storage: dura hasta recargar */
      }
      for (const x of modos.children) {
        x.classList.toggle('activo', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
      nota.textContent = NOTA[modo];
      tip.hidden = true;
      dibujar();
    });
    modos.append(b);
  }
  const det = h('details', {class: 'plegable evolucion trayectoria', open: ''},
    h('summary', {}, 'Posiciones por temporada ', h('span', {class: 'sub'}, `(${resumen})`)),
    modos, graf, leyenda);
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
  colorEscudo(escudoSrc).then(c => {
    color = c;
    if (det.isConnected) dibujar();
  });
  return det;
}
