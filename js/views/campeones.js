// Vista: Campeones. Palmarés que sumariza los títulos por club (Ligas + Copas), a partir de
// data/palmares.json (generado por build_web desde campeones_liga + campeones_copa). Cada fila se
// expande para ver los títulos, enlazados a su torneo.

import {botonCSV, clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';

// Copas internacionales: [json de campeones, etiqueta, ruta de la vista]. Cada json = {edición: campeón}.
const COPAS_INTL = [
  ['libertadores_campeones', 'Copa Libertadores', '#/libertadores'],
  ['sudamericana_campeones', 'Copa Sudamericana', '#/sudamericana'],
  ['recopa_campeones', 'Recopa Sudamericana', '#/recopa'],
  ['supercopa_campeones', 'Supercopa Sudamericana', '#/supercopa'],
  ['mastersupercopa_campeones', 'Copa Máster de Supercopa', '#/mastersupercopa'],
  ['conmebol_campeones', 'Copa Conmebol', '#/conmebol'],
  ['conmebolmasters_campeones', 'Copa Conmebol Masters', '#/conmebolmasters'],
  ['mercosur_campeones', 'Copa Mercosur', '#/mercosur'],
  ['oro_campeones', 'Copa de Oro', '#/oro'],
  ['interamericana_campeones', 'Copa Interamericana', '#/interamericana'],
  ['recopaclubes_campeones', 'Recopa Sud. de Clubes', '#/recopa-clubes'],
  ['suruga_campeones', 'Suruga Bank Championship', '#/suruga'],
  ['intercontinental_campeones', 'Copa Intercontinental', '#/intercontinental'],
];

export async function render(container, params = {}) {
  const [palmares, escudos, registro, ...intlCamps] = await Promise.all([
    loadJSON('palmares'), loadJSON('escudos'), loadJSON('registro'),
    ...COPAS_INTL.map(([k]) => loadJSON(k))]);
  if (!palmares) {
    container.append(el('h2', {}, 'Campeones'),
      el('p', {class: 'error'}, 'No se pudo cargar el palmarés. Corré scripts/build_web.py.'));
    return;
  }
  const idDe = {};
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;

  // Títulos internacionales por club: {club -> [[comp, edición, ruta], ...]}. El campeón de cada
  // json puede ser un nombre extranjero (no está en palmares); igual se agrega — la vista lista
  // sólo clubes con palmarés nacional, así que en la práctica quedan los argentinos.
  const intlPorClub = {};
  COPAS_INTL.forEach(([, comp, ruta], i) => {
    const camp = intlCamps[i] || {};
    for (const [e, club] of Object.entries(camp)) {
      (intlPorClub[club] = intlPorClub[club] || []).push([comp, e, ruta]);
    }
  });
  for (const arr of Object.values(intlPorClub)) arr.sort((a, b) => +a[1] - +b[1] || a[0].localeCompare(b[0]));
  const esc = (n) => (escudos && escudos[n]) ? el('img', {
    src: 'images/' + escudos[n], class: 'escudo', alt: ''
  }) : null;
  const clubCell = (n) => {
    const cont = [esc(n), n].filter(Boolean);
    const cid = idDe[n];
    return cid ? el('a', {href: clubHref(cid)}, cont) : el('span', {}, ...cont);
  };

  const filas = Object.entries(palmares)
    .map(([club, d]) => ({club, ...d}));

  // El filtro es por ERA (no por liga/copa: esas ya son dos columnas). 'todos' = toda la historia.
  const modoSel = el('select', {class: 'filtro'},
    el('option', {value: 'todos'}, 'Todos los títulos'),
    el('option', {value: 'profesional'}, 'Profesionalismo'),
    el('option', {value: 'amateur'}, 'Amateurismo'));
  const buscador = el('input', {type: 'search', placeholder: 'Buscar club…', class: 'filtro'});
  const cont = el('div', {class: 'tabla-wrap'});
  // orden por defecto: primero por LIGAS, después por COPAS (desempate: total y nombre).
  const estado = {sortKey: 'liga', sortDir: -1, abierto: new Set()};

  const COLS = [['pos', 'Pos'], ['club', 'Club'], ['liga', 'Ligas'], ['copa', 'Copas'],
    ['intl', 'Internacional'], ['total', 'Total']];

  // Recalcula un club para la era elegida: filtra sus títulos (ligas[3]/copas[2] = era) y recuenta.
  // Las copas internacionales son todas de la era PROFESIONAL (1948+) -> 0 en el filtro 'amateur'.
  function porEra(f) {
    const era = modoSel.value;
    const ligas = era === 'todos' ? f.ligas : f.ligas.filter(t => t[3] === era);
    const copas = era === 'todos' ? f.copas : f.copas.filter(t => t[2] === era);
    const intls = era === 'amateur' ? [] : (intlPorClub[f.club] || []);
    return {
      club: f.club, ligas, copas, intls,
      liga: ligas.length, copa: copas.length, intl: intls.length,
      total: ligas.length + copas.length + intls.length
    };
  }

  function detalle(f) {
    const kids = [];
    if (f.ligas.length) {
      kids.push(el('div', {class: 'titulos-bloque'},
        el('span', {class: 'titulos-lbl'}, `Ligas (${f.liga}): `),
        ...f.ligas.map(([nombre, anio, gid]) => {
          const txt = `${nombre}${anio ? ` (${anio})` : ''}`;
          return gid ? el('a', {class: 'titulo-chip', href: `#/tabla-historica?t=${encodeURIComponent(gid)}`}, txt)
            : el('span', {class: 'titulo-chip'}, txt);
        })));
    }
    if (f.copas.length) {
      kids.push(el('div', {class: 'titulos-bloque'},
        el('span', {class: 'titulos-lbl'}, `Copas (${f.copa}): `),
        ...f.copas.map(([c, e]) => el('a', {
          class: 'titulo-chip',
          href: `#/copas?c=${encodeURIComponent(c)}&e=${encodeURIComponent(e)}`,
        }, `${c}${e ? ` ${e}` : ''}`))));
    }
    if (f.intls && f.intls.length) {
      // agrupa por competición: 'Copa Libertadores (N): año año…' con chips a la edición.
      const porComp = new Map();
      for (const [c, e, ruta] of f.intls) (porComp.get(c) || porComp.set(c, {ruta, anios: []}).get(c)).anios.push(e);
      for (const [c, {ruta, anios}] of porComp) {
        kids.push(el('div', {class: 'titulos-bloque'},
          el('span', {class: 'titulos-lbl'}, `${c} (${anios.length}): `),
          ...anios.map((e) => el('a', {class: 'titulo-chip', href: `${ruta}?e=${e}`}, e))));
      }
    }
    return el('div', {class: 'titulos-detalle'}, ...kids);
  }

  function dibujar() {
    const q = buscador.value.trim().toLowerCase();
    let items = filas.map(porEra).filter(f => f.total > 0)
      .filter(f => !q || f.club.toLowerCase().includes(q));
    const {sortKey, sortDir} = estado;
    items = items.slice().sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      const c = (typeof x === 'number') ? x - y : String(x).localeCompare(String(y));
      // desempate: ligas, luego copas, luego total y nombre (el orden pedido por defecto).
      return c * sortDir || b.liga - a.liga || b.copa - a.copa || b.intl - a.intl
        || b.total - a.total || a.club.localeCompare(b.club);
    });
    items.forEach((f, i) => f.pos = i + 1);

    const thead = el('tr', {}, ...COLS.map(([k, label]) => el('th', {
      class: (k === sortKey ? 'sorted ' : '') + (k === 'club' ? 'txt' : k === 'pos' ? 'num pos' : 'num'),
      onclick: () => {
        estado.sortDir = estado.sortKey === k ? -estado.sortDir : (k === 'club' ? 1 : -1);
        estado.sortKey = k;
        dibujar();
      },
    }, label + (k === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : ''))));

    const cuerpo = [];
    for (const f of items) {
      const abierto = estado.abierto.has(f.club);
      cuerpo.push(el('tr', {
          class: 'club-row',
          onclick: () => {
            if (estado.abierto.has(f.club)) estado.abierto.delete(f.club);
            else estado.abierto.add(f.club);
            dibujar();
          },
        },
        el('td', {class: 'num pos'}, String(f.pos)),
        el('td', {class: 'txt club-cel'},
          el('span', {class: 'caret'}, abierto ? '▾' : '▸'), clubCell(f.club)),
        el('td', {class: 'num'}, String(f.liga)),
        el('td', {class: 'num'}, String(f.copa)),
        el('td', {class: 'num'}, String(f.intl)),
        el('td', {class: 'num'}, el('strong', {}, String(f.total)))));
      if (abierto) {
        cuerpo.push(el('tr', {class: 'detalle-row'},
          el('td', {}), el('td', {colspan: '5'}, detalle(f))));
      }
    }

    cont.replaceChildren(el('table', {class: 'posiciones palmares'},
      el('thead', {}, thead), el('tbody', {}, ...cuerpo)));
  }

  buscador.addEventListener('input', dibujar);
  modoSel.addEventListener('change', dibujar);

  container.append(
    el('h2', {}, 'Campeones'),
    el('p', {class: 'nota'},
      'Palmarés de títulos por club: Ligas (campeonatos de primera, incluidos Metropolitano/'
      + 'Nacional y Apertura/Clausura como títulos separados), Copas nacionales e Internacional '
      + '(Libertadores, Sudamericana, Recopa, Supercopa, Conmebol, Mercosur, Intercontinental y demás '
      + 'copas continentales). Tocá un club para ver sus títulos.'),
    el('div', {class: 'controles'}, modoSel, buscador,
      botonCSV('campeones_palmares', () => cont.querySelector('table'))),
    cont);
  dibujar();
}
