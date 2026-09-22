// Vista: mano a mano entre dos clubes. Historial de enfrentamientos partido a partido, sobre TODAS las
// competiciones: liga amateur/profesional + copas nacionales (partidos.json) + Copa Libertadores, Copa
// Sudamericana y Recopa (#26). El selector de clubes es un combobox con escudos (un <select> nativo no
// puede mostrar imágenes). Exportable a CSV (#15).

import {botonCSV, clubHref, el, setEstadoRuta} from '../main.js';
import {clubIndex} from '../clubes_ui.js';
import {loadJSON} from '../data.js';
import {torneoCel} from '../torneos.js';

const MESES = {Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12};

function fechaKey(f) {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(f || '');   // fecha consolidada ISO (amateur + prof)
  if (iso) return (+iso[1]) * 10000 + (+iso[2]) * 100 + (+iso[3]);
  const m = /(\d{1,2})\s+(\w{3})\s+(\d{4})/.exec(f || '');   // legado 'DD Mon YYYY'
  if (m) return (+m[3]) * 10000 + (MESES[m[2]] || 0) * 100 + (+m[1]);
  const y = /(\d{4})/.exec(f || '');   // copa / sin fecha: solo el año
  return y ? (+y[1]) * 10000 : 0;
}

// resultado 'L'/'V'/'E' de un partido internacional, considerando 'awd' (resultado otorgado).
const resIntl = (m) => m.awd === 'l' ? 'L' : m.awd === 'v' ? 'V'
  : m.gl > m.gv ? 'L' : m.gl < m.gv ? 'V' : 'E';

// Ejes del filtro por tipo de competencia. Internacional (Libertadores/Sudamericana/Recopa/Suruga) se
// filtra como un bloque; el resto se separa en era (Amateurismo/Profesionalismo) × naturaleza (Ligas/
// Copas). La era de una copa nacional se deriva del año de la edición (>=1931 -> profesional), igual
// que en la ficha de club.
const ERAS_INTL = new Set(['internacional', 'sudamericana', 'recopa', 'suruga', 'mercosur', 'conmebol',
  'supercopa', 'interamericana', 'mastersupercopa', 'conmebolmasters', 'oro', 'recopaclubes',
  'intercontinental', 'aldao', 'escobargerona', 'cousenier', 'cuptie']);
const esIntl = (p) => ERAS_INTL.has(p.era);
const anio = (f) => {
  const m = /(\d{4})/.exec(f || '');
  return m ? +m[1] : 0;
};
const eraGrupo = (p) => p.era === 'profesional' ? 'prof'
  : p.era === 'amateur' ? 'amateur'
    : (anio(p.f) >= 1931 ? 'prof' : 'amateur');   // copa nacional: por año de la edición
const naturaleza = (p) => p.era === 'copa' ? 'copa' : 'liga';

// Ubica los partidos SIN fecha completa (copa con sólo edición, no disputados) según su torneo y ronda,
// en vez de amontonarlos al inicio del año. Igual que la ficha de club: año de referencia (fecha → torneo
// → edición) y Nº de ronda (jornada de liga `j`, o el 1er número de la ronda cruda `rc`/`ronda`). La clave
// de orden usa la fecha real si tiene día/mes; si no, cae a año*10000 + ronda*50 para intercalarlo.
const anioRef = (p) => anio(p.f) || anio(p.t) || (p.e != null ? anio(String(p.e)) : 0);
const rondaNum = (p) => p.j != null ? (+p.j || 0)
  : ((String(p.rc || p.ronda || '').match(/\d+/) || [0])[0] | 0);

function ordenKey(p) {
  const k = fechaKey(p.f);
  if (k % 10000 !== 0) return k;                        // fecha con día/mes -> orden real
  return anioRef(p) * 10000 + Math.min(rondaNum(p), 99) * 50;
}

export async function render(container, params = {}) {
  const [partidos, escudos, registro, torneoNombres, lib, sud, rec, surg,
    mer, con, sup, inter, msup, cmas, oroM, rclub, intercon, ald, esg, cou, cti] = await Promise.all([
    loadJSON('partidos'), loadJSON('escudos'), loadJSON('registro'),
    loadJSON('torneo_nombres'), loadJSON('libertadores'), loadJSON('sudamericana'), loadJSON('recopa'),
    loadJSON('suruga'),
    // #4: resto de copas continentales/rioplatenses, igual que la ficha de club (si no, faltan partidos).
    loadJSON('mercosur'), loadJSON('conmebol'), loadJSON('supercopa'), loadJSON('interamericana'),
    loadJSON('mastersupercopa'), loadJSON('conmebolmasters'), loadJSON('oro'), loadJSON('recopaclubes'),
    loadJSON('intercontinental'), loadJSON('aldao'), loadJSON('escobargerona'), loadJSON('cousenier'),
    loadJSON('cuptie')]);
  if (!partidos) {
    container.append(el('h2', {}, 'Mano a mano'),
      el('p', {class: 'error'}, 'No se pudieron cargar los datos. Corré scripts/build_web.py.'));
    return;
  }
  const {idDe, label} = clubIndex(registro);   // idDe: enlace por id · label: nombre común mostrado
  const esc = (n) => (escudos && escudos[n]) ? el('img', {
    src: 'images/' + escudos[n], class: 'escudo', alt: ''
  }) : null;
  const celdaEq = (n) => {
    const cont = [esc(n), label(n)].filter(Boolean);
    const cid = idDe[n];
    return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
  };

  // Partidos internacionales normalizados a la misma forma que los nacionales (l/v/gl/gv/r/era/t/f).
  // `e` (edición) y `rc` (ronda cruda) permiten intercalar por año+ronda los que no tengan fecha real.
  const pseudo = (data, era, comp) => (data || []).map(m => ({
    l: m.l, v: m.v, gl: m.gl, gv: m.gv, r: resIntl(m), era, e: m.e, rc: m.r, t: `${comp} ${m.e}`,
    f: m.f && /\d{4}-\d{2}-\d{2}/.test(String(m.f)) ? m.f : String(m.e),
  }));
  const todos = [
    ...partidos,
    ...pseudo(lib, 'internacional', 'Copa Libertadores'),
    ...pseudo(sud, 'sudamericana', 'Copa Sudamericana'),
    ...pseudo(rec, 'recopa', 'Recopa Sudamericana'),
    ...pseudo(surg, 'suruga', 'Suruga Bank Championship'),
    ...pseudo(mer, 'mercosur', 'Copa Mercosur'),
    ...pseudo(con, 'conmebol', 'Copa Conmebol'),
    ...pseudo(sup, 'supercopa', 'Supercopa Sudamericana'),
    ...pseudo(inter, 'interamericana', 'Copa Interamericana'),
    ...pseudo(msup, 'mastersupercopa', 'Copa Máster de Supercopa'),
    ...pseudo(cmas, 'conmebolmasters', 'Copa Conmebol Masters'),
    ...pseudo(oroM, 'oro', 'Copa de Oro'),
    ...pseudo(rclub, 'recopaclubes', 'Recopa Sud. de Clubes'),
    ...pseudo(intercon, 'intercontinental', 'Copa Intercontinental'),
    ...pseudo(ald, 'aldao', 'Copa Aldao'),
    ...pseudo(esg, 'escobargerona', 'Copa Escobar-Gerona'),
    ...pseudo(cou, 'cousenier', 'Copa de Honor Cousenier'),
    ...pseudo(cti, 'cuptie', 'Cup Tie Competition'),
  ];

  // Universo de clubes = todos los que aparecen en algún partido (nacional o internacional), ordenado.
  const universo = [...new Set(todos.flatMap(p => [p.l, p.v]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  // Combobox con escudos: input de búsqueda + lista desplegable (opción = escudo + nombre). `inicial`
  // preselecciona un club (para restaurar el estado al volver con "Atrás").
  function selectorClub(placeholder, onPick, inicial = '') {
    const input = el('input', {type: 'search', class: 'filtro combo-input', placeholder, autocomplete: 'off'});
    const lista = el('div', {class: 'combo-lista oculto'});
    let sel = inicial;                              // sel = nombre CANÓNICO (clave de join); se muestra label(sel)
    if (inicial) input.value = label(inicial);
    const pintar = (q) => {
      const ql = q.trim().toLowerCase();
      // busca por nombre común Y canónico (así un club curado se encuentra por cualquiera de los dos)
      const items = universo.filter(n => (n + ' ' + label(n)).toLowerCase().includes(ql)).slice(0, 80);
      lista.replaceChildren(...items.map(n => {
        const opt = el('div', {class: 'combo-opt'}, ...[esc(n), el('span', {}, label(n))].filter(Boolean));
        opt.addEventListener('mousedown', (ev) => {   // mousedown: antes del blur del input
          ev.preventDefault();
          sel = n;                                   // guarda el canónico (para comparar/URL)
          input.value = label(n);                    // muestra el nombre común
          lista.classList.add('oculto');
          onPick(n);
        });
        return opt;
      }));
      if (!items.length) lista.append(el('div', {class: 'combo-vacio'}, 'Sin resultados'));
    };
    input.addEventListener('focus', () => {
      pintar(input.value === label(sel) ? '' : input.value);
      lista.classList.remove('oculto');
    });
    input.addEventListener('input', () => {
      pintar(input.value);
      lista.classList.remove('oculto');
    });
    input.addEventListener('blur', () => setTimeout(() => lista.classList.add('oculto'), 150));
    return {wrap: el('div', {class: 'combo'}, input, lista), get: () => sel};
  }

  const salida = el('div', {class: 'mano-salida'});
  // Preselección de los dos clubes desde la URL (restaura el estado al volver con "Atrás").
  const enUni = (n) => !!n && universo.includes(n);
  const cA = selectorClub('Club 1…', () => comparar(), enUni(params.a) ? params.a : '');
  const cB = selectorClub('Club 2…', () => comparar(), enUni(params.b) ? params.b : '');

  // Filtros por tipo de competencia (se aplican al historial Y al resumen). Todos activos por defecto;
  // `params.off` (lista separada por comas) restaura los que estaban DESactivados.
  const off = new Set((params.off || '').split(',').filter(Boolean));
  const f = {
    amateur: !off.has('amateur'), prof: !off.has('prof'), liga: !off.has('liga'),
    copa: !off.has('copa'), internacional: !off.has('internacional')
  };
  const incluido = (p) => {
    if (esIntl(p)) return f.internacional;   // internacional: bloque propio (no se filtra por era)
    const e = eraGrupo(p), n = naturaleza(p);
    return ((e === 'prof' && f.prof) || (e === 'amateur' && f.amateur))
      && ((n === 'liga' && f.liga) || (n === 'copa' && f.copa));
  };
  const check = (key, etq) => {
    const cb = el('input', {type: 'checkbox', class: 'club-cb'});
    cb.checked = f[key];
    cb.addEventListener('change', () => {
      f[key] = cb.checked;
      comparar();
    });
    return el('label', {class: 'club-filtro'}, cb, etq);
  };
  const fila = (etq, ...kids) => el('div', {class: 'controles fila-filtro'},
    el('span', {class: 'sub'}, etq), ...kids);
  const filtros = el('div', {class: 'club-controles mano-filtros'},
    fila('Era:', check('amateur', 'Amateurismo'), check('prof', 'Profesionalismo')),
    fila('Tipo:', check('liga', 'Ligas'), check('copa', 'Copas'), check('internacional', 'Internacionales')));

  function comparar() {
    const A = cA.get(), B = cB.get();
    // Guarda el estado (clubes + filtros apagados) en la URL para restaurarlo al volver con "Atrás".
    setEstadoRuta({a: A, b: B, off: Object.keys(f).filter(k => !f[k]).join(',')});
    if (!A || !B || A === B) {
      salida.replaceChildren(el('p', {class: 'placeholder'}, 'Elegí dos clubes distintos.'));
      return;
    }
    const jugados = todos
      .filter(p => ((p.l === A && p.v === B) || (p.l === B && p.v === A)) && incluido(p))
      .sort((x, y) => ordenKey(x) - ordenKey(y));

    let gA = 0, gB = 0, e = 0, golA = 0, golB = 0, nAm = 0, nPro = 0, nCopa = 0, nIntl = 0;
    for (const p of jugados) {
      const winner = p.r === 'L' ? p.l : p.r === 'V' ? p.v : null;
      if (winner === A) gA++; else if (winner === B) gB++; else if (p.r === 'E') e++;
      if (p.gl != null && p.gv != null) {
        golA += p.l === A ? p.gl : p.gv;
        golB += p.l === B ? p.gl : p.gv;
      }
      if (esIntl(p)) nIntl++;
      else if (p.era === 'copa') nCopa++;
      else if (p.era === 'profesional') nPro++;
      else nAm++;
    }

    const resumen = el('div', {class: 'resumen'},
      el('span', {}, `${jugados.length} partidos`),
      el('span', {}, `${label(A)}: ${gA}`),
      el('span', {}, `Empates: ${e}`),
      el('span', {}, `${label(B)}: ${gB}`),
      el('span', {}, `Goles ${label(A)}–${label(B)}: ${golA}–${golB}`),
      el('span', {class: 'sub'},
        `(${nAm} amateur · ${nPro} liga prof. · ${nCopa} copa · ${nIntl} internacional)`));

    const filas = jugados.map(p => el('tr', {},
      el('td', {class: 'txt'}, p.f || '—'),
      torneoCel(torneoNombres, p),
      celdaEq(p.l),
      el('td', {class: 'num'}, `${p.gl ?? ''}-${p.gv ?? ''}`,
        // p.nd = nota disciplinaria (partido otorgado/abandonado inyectado display-only, item 19)
        p.nd ? el('span', {class: 'nota-disc', title: p.nd}, ' ⚖') : ''),
      celdaEq(p.v),
      el('td', {class: 'txt'}, p.r === 'E' ? 'Empate' : (p.r === 'L' ? p.l : p.r === 'V' ? p.v : '—'))));

    const tabla = jugados.length
      ? el('table', {class: 'posiciones sub-partidos'},
        el('thead', {}, el('tr', {},
          el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Torneo'),
          el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'),
          el('th', {class: 'txt'}, 'Visitante'), el('th', {class: 'txt'}, 'Ganador'))),
        el('tbody', {}, ...filas))
      : el('p', {class: 'placeholder'}, 'Sin enfrentamientos registrados.');

    salida.replaceChildren(resumen, tabla);
  }

  const btnExport = botonCSV(
    () => `mano_a_mano_${(cA.get() || 'A')}_${(cB.get() || 'B')}`.replace(/[^\w]+/g, '_'),
    () => salida.querySelector('table'));

  container.append(
    el('h2', {}, 'Mano a mano'),
    el('p', {class: 'nota'},
      'Historial partido a partido sobre TODAS las competiciones: liga amateur (1891–1934) + '
      + 'profesional (1931–2025) + copas nacionales (1905–2025) + copas internacionales '
      + '(Libertadores, Sudamericana, Recopa, Mercosur, Conmebol, Supercopa, Interamericana, '
      + 'Intercontinental y demás). Filtrá por era y tipo de competencia con las casillas de abajo.'),
    el('div', {class: 'controles mano-controles'}, cA.wrap, el('span', {class: 'vs'}, 'vs'), cB.wrap, btnExport),
    filtros,
    salida);

  comparar();
}
