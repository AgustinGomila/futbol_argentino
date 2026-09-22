// Vista: mano a mano entre dos clubes. Historial de enfrentamientos partido a partido, sobre TODAS las
// competiciones: liga amateur/profesional + copas nacionales (partidos.json) + Copa Libertadores, Copa
// Sudamericana y Recopa (#26). El selector de clubes es un combobox con escudos (un <select> nativo no
// puede mostrar imágenes). Exportable a CSV (#15).

import {botonCSV, clubHref, el} from '../main.js';
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
const ERAS_INTL = new Set(['internacional', 'sudamericana', 'recopa', 'suruga']);
const esIntl = (p) => ERAS_INTL.has(p.era);
const anio = (f) => {
  const m = /(\d{4})/.exec(f || '');
  return m ? +m[1] : 0;
};
const eraGrupo = (p) => p.era === 'profesional' ? 'prof'
  : p.era === 'amateur' ? 'amateur'
    : (anio(p.f) >= 1931 ? 'prof' : 'amateur');   // copa nacional: por año de la edición
const naturaleza = (p) => p.era === 'copa' ? 'copa' : 'liga';

export async function render(container) {
  const [partidos, escudos, registro, torneoNombres, lib, sud, rec, surg] = await Promise.all([
    loadJSON('partidos'), loadJSON('escudos'), loadJSON('registro'),
    loadJSON('torneo_nombres'), loadJSON('libertadores'), loadJSON('sudamericana'), loadJSON('recopa'),
    loadJSON('suruga')]);
  if (!partidos) {
    container.append(el('h2', {}, 'Mano a mano'),
      el('p', {class: 'error'}, 'No se pudieron cargar los datos. Corré scripts/build_web.py.'));
    return;
  }
  const idDe = {};
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;
  const esc = (n) => (escudos && escudos[n]) ? el('img', {
    src: 'images/' + escudos[n], class: 'escudo', alt: ''
  }) : null;
  const celdaEq = (n) => {
    const cont = [esc(n), n].filter(Boolean);
    const cid = idDe[n];
    return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
  };

  // Partidos internacionales normalizados a la misma forma que los nacionales (l/v/gl/gv/r/era/t/f).
  const pseudo = (data, era, comp) => (data || []).map(m => ({
    l: m.l, v: m.v, gl: m.gl, gv: m.gv, r: resIntl(m), era, t: `${comp} ${m.e}`,
    f: m.f && /\d{4}-\d{2}-\d{2}/.test(String(m.f)) ? m.f : String(m.e),
  }));
  const todos = [
    ...partidos,
    ...pseudo(lib, 'internacional', 'Copa Libertadores'),
    ...pseudo(sud, 'sudamericana', 'Copa Sudamericana'),
    ...pseudo(rec, 'recopa', 'Recopa Sudamericana'),
    ...pseudo(surg, 'suruga', 'Suruga Bank Championship'),
  ];

  // Universo de clubes = todos los que aparecen en algún partido (nacional o internacional), ordenado.
  const universo = [...new Set(todos.flatMap(p => [p.l, p.v]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  // Combobox con escudos: input de búsqueda + lista desplegable (opción = escudo + nombre).
  function selectorClub(placeholder, onPick) {
    const input = el('input', {type: 'search', class: 'filtro combo-input', placeholder, autocomplete: 'off'});
    const lista = el('div', {class: 'combo-lista oculto'});
    let sel = '';
    const pintar = (q) => {
      const ql = q.trim().toLowerCase();
      const items = universo.filter(n => n.toLowerCase().includes(ql)).slice(0, 80);
      lista.replaceChildren(...items.map(n => {
        const opt = el('div', {class: 'combo-opt'}, ...[esc(n), el('span', {}, n)].filter(Boolean));
        opt.addEventListener('mousedown', (ev) => {   // mousedown: antes del blur del input
          ev.preventDefault();
          sel = n;
          input.value = n;
          lista.classList.add('oculto');
          onPick(n);
        });
        return opt;
      }));
      if (!items.length) lista.append(el('div', {class: 'combo-vacio'}, 'Sin resultados'));
    };
    input.addEventListener('focus', () => {
      pintar(input.value === sel ? '' : input.value);
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
  const cA = selectorClub('Club 1…', () => comparar());
  const cB = selectorClub('Club 2…', () => comparar());

  // Filtros por tipo de competencia (se aplican al historial Y al resumen). Todos activos por defecto.
  const f = {amateur: true, prof: true, liga: true, copa: true, internacional: true};
  const incluido = (p) => {
    if (esIntl(p)) return f.internacional;   // internacional: bloque propio (no se filtra por era)
    const e = eraGrupo(p), n = naturaleza(p);
    return ((e === 'prof' && f.prof) || (e === 'amateur' && f.amateur))
      && ((n === 'liga' && f.liga) || (n === 'copa' && f.copa));
  };
  const check = (key, etq) => {
    const cb = el('input', {type: 'checkbox', class: 'club-cb'});
    cb.checked = true;
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
    if (!A || !B || A === B) {
      salida.replaceChildren(el('p', {class: 'placeholder'}, 'Elegí dos clubes distintos.'));
      return;
    }
    const jugados = todos
      .filter(p => ((p.l === A && p.v === B) || (p.l === B && p.v === A)) && incluido(p))
      .sort((x, y) => fechaKey(x.f) - fechaKey(y.f));

    let gA = 0, gB = 0, e = 0, golA = 0, golB = 0, nAm = 0, nPro = 0, nCopa = 0, nIntl = 0;
    for (const p of jugados) {
      const winner = p.r === 'L' ? p.l : p.r === 'V' ? p.v : null;
      if (winner === A) gA++; else if (winner === B) gB++; else if (p.r === 'E') e++;
      if (p.gl != null && p.gv != null) {
        golA += p.l === A ? p.gl : p.gv;
        golB += p.l === B ? p.gl : p.gv;
      }
      if (p.era === 'internacional' || p.era === 'sudamericana' || p.era === 'recopa'
        || p.era === 'suruga') nIntl++;
      else if (p.era === 'copa') nCopa++;
      else if (p.era === 'profesional') nPro++;
      else nAm++;
    }

    const resumen = el('div', {class: 'resumen'},
      el('span', {}, `${jugados.length} partidos`),
      el('span', {}, `${A}: ${gA}`),
      el('span', {}, `Empates: ${e}`),
      el('span', {}, `${B}: ${gB}`),
      el('span', {}, `Goles ${A}–${B}: ${golA}–${golB}`),
      el('span', {class: 'sub'},
        `(${nAm} amateur · ${nPro} liga prof. · ${nCopa} copa · ${nIntl} internacional)`));

    const filas = jugados.map(p => el('tr', {},
      el('td', {class: 'txt'}, p.f || '—'),
      torneoCel(torneoNombres, p),
      celdaEq(p.l),
      el('td', {class: 'num'}, `${p.gl ?? ''}-${p.gv ?? ''}`),
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
      + 'profesional (1931–2025) + copas nacionales (1905–2025) + Copa Libertadores, Copa Sudamericana '
      + 'y Recopa Sudamericana. Filtrá por era y tipo de competencia con las casillas de abajo.'),
    el('div', {class: 'controles mano-controles'}, cA.wrap, el('span', {class: 'vs'}, 'vs'), cB.wrap, btnExport),
    filtros,
    salida);

  comparar();
}
