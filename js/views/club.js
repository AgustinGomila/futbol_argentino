// Vista: pagina individual de club (ruta #/club/<id>). Muestra metadata del club y el
// head-to-head agregado por rival (J G E P GF GC Dif, ordenado por J desc), filtrable por
// dos ejes combinables: ERA (Profesional / Amateur) y NATURALEZA (Ligas / Copas).
// Los partidos vienen de partidos.json (era: 'amateur'|'profesional'|'copa'); para las copas
// la era se deriva del ano de la edicion (>=1931 -> profesional).

import {clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';
import {torneoCel} from '../torneos.js';

const MESES = {Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12};
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Fundación / disolución: acepta año solo ("1908") o fecha completa DD/MM/YYYY ("1/4/1908").
// Muestra "1908" en el primer caso y "1 de Abril de 1908" en el segundo.
const fmtFechaClub = (v) => {
  const s = (v || '').trim();
  if (!s) return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const mes = MESES_ES[+m[2] - 1];
    if (mes) return `${+m[1]} de ${mes} de ${+m[3]}`;
  }
  return s;
};
const anio = (f) => {
  const m = /(\d{4})/.exec(f || '');
  return m ? +m[1] : 0;
};

function fechaKey(f) {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(f || '');   // fecha consolidada ISO (amateur + prof)
  if (iso) return (+iso[1]) * 10000 + (+iso[2]) * 100 + (+iso[3]);
  const m = /(\d{1,2})\s+(\w{3})\s+(\d{4})/.exec(f || '');   // legado 'DD Mon YYYY'
  if (m) return (+m[3]) * 10000 + (MESES[m[2]] || 0) * 100 + (+m[1]);
  return anio(f) * 10000;                                     // copa / sin fecha: solo el año
}

const naturaleza = (p) => p.era === 'copa' ? 'copa' : 'liga';
const eraGrupo = (p) => p.era === 'profesional' ? 'prof'
  : p.era === 'amateur' ? 'amateur'
    : (anio(p.f) >= 1931 ? 'prof' : 'amateur');   // copa: por ano de la edicion

// #16: categoriza la ronda de un partido (copa/internacional) en una FASE del bracket. Las rondas de
// liga (jornadas) no tienen fase -> null (no las toca el filtro).
const FASE_ORDEN = ['preliminar', 'grupos', '64', '32', '16', 'octavos', 'cuartos', 'semis', 'final'];
const FASE_LBL = {
  preliminar: 'Preliminar', grupos: 'Grupos / rondas', 64: '64avos', 32: '32avos', 16: '16avos',
  octavos: 'Octavos', cuartos: 'Cuartos', semis: 'Semis', final: 'Final',
};
const _FASE_TEAMS = {128: '64', 64: '32', 32: '16', 16: 'octavos', 8: 'cuartos', 4: 'semis', 2: 'final'};

function faseDe(ronda) {
  const s = (ronda || '').toLowerCase();
  if (!s) return null;
  if (/prelim|qualif|rueda previa|repechaj|repechag/.test(s)) return 'preliminar';
  if (/group|grupo|zona|round robin|todos contra/.test(s)) return 'grupos';
  let m = s.match(/round of (\d+)/);            // 'Round of 64' = 64 equipos -> 32avos
  if (m) return _FASE_TEAMS[+m[1]] || null;
  m = s.match(/1\s*\/\s*(\d+)\s*(?:de\s+)?final/) || s.match(/(\d+)\s*avos/);  // '1/16 Final' | '16 avos'
  if (m) return _FASE_TEAMS[+m[1] * 2] || null;  // N pares -> 2N equipos
  if (/octavos|eighth/.test(s)) return 'octavos';
  if (/cuartos|quarter/.test(s)) return 'cuartos';
  if (/semi/.test(s)) return 'semis';
  if (/^final\b|gran final|\bfinal$/.test(s) && !/phase|round/.test(s)) return 'final';
  if (/^round\b|^\d+(?:st|nd|rd|th)\b/.test(s)) return 'grupos';   // 'Round N' de round-robin/liga-cup
  return null;
}

const PAIS_ES = {
  Arg: 'Argentina', Bol: 'Bolivia', Bra: 'Brasil', Chi: 'Chile', Col: 'Colombia', Ecu: 'Ecuador',
  Mex: 'México', Par: 'Paraguay', Per: 'Perú', Uru: 'Uruguay', Ven: 'Venezuela',
  USA: 'Estados Unidos', CRi: 'Costa Rica', Hon: 'Honduras',
  Gua: 'Guatemala', ESa: 'El Salvador', Tri: 'Trinidad y Tobago',
  // Europeos (Copa Intercontinental)
  Esp: 'España', Por: 'Portugal', Ita: 'Italia', Esc: 'Escocia', Ing: 'Inglaterra',
  Hol: 'Países Bajos', Ale: 'Alemania', Sue: 'Suecia', Gre: 'Grecia', Rum: 'Rumania', Yug: 'Yugoslavia',
  Jpn: 'Japón',
};

export async function render(container, params = {}) {
  const id = params.id;
  const [registro, partidos, escudos, torneoNombres, lib, sud, rec, fusiones,
    palmares, libCamp, sudCamp, recCamp,
    mer, con, sup, inter, merCamp, conCamp, supCamp, interCamp,
    msup, cmas, oroM, rclub, intercon,
    msupCamp, cmasCamp, oroCamp, rclubCamp, interconCamp,
    surg, surgCamp] = await Promise.all([
    loadJSON('registro'), loadJSON('partidos'), loadJSON('escudos'), loadJSON('torneo_nombres'),
    loadJSON('libertadores'), loadJSON('sudamericana'), loadJSON('recopa'), loadJSON('fusiones'),
    loadJSON('palmares'), loadJSON('libertadores_campeones'), loadJSON('sudamericana_campeones'),
    loadJSON('recopa_campeones'),
    loadJSON('mercosur'), loadJSON('conmebol'), loadJSON('supercopa'), loadJSON('interamericana'),
    loadJSON('mercosur_campeones'), loadJSON('conmebol_campeones'), loadJSON('supercopa_campeones'),
    loadJSON('interamericana_campeones'),
    // copas internacionales menores/históricas: partidos (H2H) + campeones (palmarés)
    loadJSON('mastersupercopa'), loadJSON('conmebolmasters'), loadJSON('oro'),
    loadJSON('recopaclubes'), loadJSON('intercontinental'),
    loadJSON('mastersupercopa_campeones'), loadJSON('conmebolmasters_campeones'), loadJSON('oro_campeones'),
    loadJSON('recopaclubes_campeones'), loadJSON('intercontinental_campeones'),
    loadJSON('suruga'), loadJSON('suruga_campeones')]);

  if (!registro || !partidos) {
    container.append(el('h2', {}, 'Club'),
      el('p', {class: 'error'}, 'No se pudieron cargar los datos. Corré scripts/build_web.py.'));
    return;
  }
  const club = registro[id];
  if (!club) {
    container.append(el('h2', {}, 'Club'),
      el('p', {class: 'error'}, `No existe el club "${id}".`),
      el('p', {}, el('a', {href: '#/tabla-historica'}, '← Volver')));
    return;
  }

  // Enlace "Volver" que regresa a la pagina anterior (history.back) en vez de a un destino
  // fijo; el href queda como respaldo si se abrio la ficha directamente (sin historial).
  const volverLink = () => el('a', {
    href: '#/tabla-historica',
    onclick: (ev) => {
      if (history.length > 1) {
        ev.preventDefault();
        history.back();
      }
    },
  }, '← Volver');

  const nombre = club.nombre;                        // nombre CANÓNICO (para matchear partidos)
  const nombreMostrar = club.nombre_completo || nombre;  // #13: nombre completo si existe
  const idDe = {};                                   // nombre -> id (para linkear rivales)
  for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;

  // #12: si este club es DESTINO de una fusión, su ficha incluye los partidos jugados con las
  // denominaciones-origen (conservando ese nombre en cada fila). misNombres = todas sus denominaciones.
  const misNombres = new Set([nombre]);
  if (fusiones) for (const [orig, dest] of Object.entries(fusiones)) if (dest === nombre) misNombres.add(orig);
  const esMio = (n) => misNombres.has(n);

  // #14: partidos de Copas internacionales de ESTE club, con forma de partido. Cada torneo tiene su
  // propio eje de filtro (era 'internacional' = Libertadores, 'sudamericana' = Copa Sudamericana,
  // 'recopa' = Recopa Sudamericana).
  const pseudoDe = (data, era, comp) => (data || [])
    .filter(m => esMio(m.l) || esMio(m.v)).map(m => ({
      f: m.f && /\d{4}-\d{2}-\d{2}/.test(String(m.f)) ? m.f : m.e, l: m.l, v: m.v, gl: m.gl, gv: m.gv,
      r: m.awd === 'l' ? 'L' : m.awd === 'v' ? 'V' : m.gl > m.gv ? 'L' : m.gl < m.gv ? 'V' : 'E',
      era, e: m.e, t: `${comp} ${m.e}`,   // #3: e para el deep-link a la edición
      fase: m.r,           // #16: ronda cruda (Group A / Final / Round of 16 …) para el filtro por fase
      pl: m.pl, pv: m.pv,  // #17: país de cada lado para el filtro por país del rival
    }));
  const libPseudo = pseudoDe(lib, 'internacional', 'Copa Libertadores');
  const sudPseudo = pseudoDe(sud, 'sudamericana', 'Copa Sudamericana');
  const recPseudo = pseudoDe(rec, 'recopa', 'Recopa Sudamericana');
  // #4: otras copas continentales (Mercosur/Conmebol/Supercopa/Interamericana) en el perfil.
  const merPseudo = pseudoDe(mer, 'mercosur', 'Copa Mercosur');
  const conPseudo = pseudoDe(con, 'conmebol', 'Copa Conmebol');
  const supPseudo = pseudoDe(sup, 'supercopa', 'Supercopa Sudamericana');
  const interPseudo = pseudoDe(inter, 'interamericana', 'Copa Interamericana');
  // copas internacionales menores/históricas (H2H propio, cada una con su eje de filtro).
  const msupPseudo = pseudoDe(msup, 'mastersupercopa', 'Copa Máster de Supercopa');
  const cmasPseudo = pseudoDe(cmas, 'conmebolmasters', 'Copa Conmebol Masters');
  const oroPseudo = pseudoDe(oroM, 'oro', 'Copa de Oro');
  const rclubPseudo = pseudoDe(rclub, 'recopaclubes', 'Recopa Sud. de Clubes');
  const interconPseudo = pseudoDe(intercon, 'intercontinental', 'Copa Intercontinental');
  const surgPseudo = pseudoDe(surg, 'suruga', 'Suruga Bank Championship');
  const intlPseudos = [libPseudo, sudPseudo, recPseudo, merPseudo, conPseudo, supPseudo, interPseudo,
    msupPseudo, cmasPseudo, oroPseudo, rclubPseudo, interconPseudo, surgPseudo];
  const ERAS_INTL = new Set(['internacional', 'sudamericana', 'recopa',
    'mercosur', 'conmebol', 'supercopa', 'interamericana',
    'mastersupercopa', 'conmebolmasters', 'oro', 'recopaclubes', 'intercontinental', 'suruga']);
  const esInternacional = (p) => ERAS_INTL.has(p.era);
  // #16: fase de un partido — copas por su ronda cruda (p.rc), internacionales por p.fase; liga = null.
  const faseP = (p) => faseDe(p.era === 'copa' ? p.rc : (esInternacional(p) ? p.fase : null));
  // #17: país del RIVAL — internacional: el código del otro lado; nacional (liga/copa): Argentina.
  const rivalPais = (p) => esInternacional(p) ? ((esMio(p.l) ? p.pv : p.pl) || '') : 'Arg';

  const misMs = [...partidos, ...intlPseudos.flat()].filter(p => esMio(p.l) || esMio(p.v));
  const fasesPresentes = FASE_ORDEN.filter(fa => misMs.some(p => faseP(p) === fa));
  const paisesPresentes = [...new Set(misMs.map(rivalPais).filter(Boolean))]
    .sort((a, b) => (PAIS_ES[a] || a).localeCompare(PAIS_ES[b] || b));

  const esc = (n) => (escudos && escudos[n])
    ? el('img', {src: 'images/' + escudos[n], class: 'escudo', alt: ''}) : null;

  // --- tarjeta de metadata ---
  const dato = (etq, val) => val
    ? el('div', {class: 'meta-item'}, el('span', {class: 'meta-k'}, etq),
      el('span', {class: 'meta-v'}, val)) : null;
  const datoLink = (etq, href, txt) => href
    ? el('div', {class: 'meta-item'}, el('span', {class: 'meta-k'}, etq),
      el('span', {class: 'meta-v'}, el('a', {href, target: '_blank', rel: 'noopener'}, txt))) : null;
  const escGrande = (escudos && escudos[nombre])
    ? el('img', {src: 'images/' + escudos[nombre], class: 'escudo-grande', alt: ''}) : null;
  const ubic = [club.ciudad, club.provincia].filter(Boolean).join(', ');
  const ficha = el('div', {class: 'club-ficha'},
    [escGrande, el('div', {class: 'club-cab'}, [
      el('h2', {class: 'club-nombre'}, nombreMostrar),
      (() => {  // apodo: lista (o string legacy) -> «A», «B»
        const aps = Array.isArray(club.apodo) ? club.apodo : (club.apodo ? [club.apodo] : []);
        return aps.length ? el('div', {class: 'club-apodo'}, aps.map(a => `«${a}»`).join(' ')) : null;
      })(),
      el('div', {class: 'meta-grid'}, [
        dato('Ubicación', ubic),
        dato('Fundación', fmtFechaClub(club.fundacion)),
        dato('Disolución', fmtFechaClub(club.disolucion)),
        dato('Estadio', club.estadio),
        dato('Capacidad', club.capacidad && `${(+club.capacidad).toLocaleString('es-AR')}`),
        datoLink('Sitio oficial', club.web, 'Web'),
        datoLink('Wikipedia', club.wikipedia, 'Wikipedia'),
      ].filter(Boolean)),
    ].filter(Boolean))].filter(Boolean));

  // --- filtros ---
  const f = {
    prof: true, amateur: true, liga: true, copa: true,
    internacional: true, sudamericana: true, recopa: true,
    mercosur: true, conmebol: true, supercopa: true, interamericana: true,
    mastersupercopa: true, conmebolmasters: true, oro: true, recopaclubes: true, intercontinental: true,
    suruga: true,
    fases: new Set(fasesPresentes),   // #16: fases activas (todas por defecto)
    pais: '',                          // #17: país del rival ('' = todos)
  };
  const check = (key, etq) => {
    const cb = el('input', {type: 'checkbox', class: 'club-cb'});
    cb.checked = true;
    cb.addEventListener('change', () => {
      f[key] = cb.checked;
      recalcular();
    });
    return el('label', {class: 'club-filtro'}, cb, etq);
  };
  // #16: checkbox de una fase (togglea el Set f.fases).
  const checkFase = (fa) => {
    const cb = el('input', {type: 'checkbox', class: 'club-cb'});
    cb.checked = true;
    cb.addEventListener('change', () => {
      if (cb.checked) f.fases.add(fa); else f.fases.delete(fa);
      recalcular();
    });
    return el('label', {class: 'club-filtro'}, cb, FASE_LBL[fa]);
  };
  // Ejes en RENGLONES separados: Era / Tipo / Internacional / Fase / País. Cada eje solo aparece si el
  // club tiene partidos que lo usan.
  const fila = (etq, ...kids) => kids.length
    ? el('div', {class: 'controles fila-filtro'}, el('span', {class: 'sub'}, etq), ...kids) : null;
  // #17: selector de país del rival (solo si el club jugó contra clubes de más de un país).
  const paisSel = el('select', {class: 'filtro'},
    el('option', {value: ''}, 'Todos'),
    ...paisesPresentes.map(cc => el('option', {value: cc}, PAIS_ES[cc] || cc)));
  paisSel.addEventListener('change', () => {
    f.pais = paisSel.value;
    recalcular();
  });
  const controles = el('div', {class: 'club-controles'}, [
    fila('Era:', check('prof', 'Profesional'), check('amateur', 'Amateur')),
    fila('Tipo:', check('liga', 'Ligas'), check('copa', 'Copas')),
    fila('Internacional:',
      ...(libPseudo.length ? [check('internacional', 'Copa Libertadores')] : []),
      ...(sudPseudo.length ? [check('sudamericana', 'Copa Sudamericana')] : []),
      ...(recPseudo.length ? [check('recopa', 'Recopa Sudamericana')] : []),
      ...(merPseudo.length ? [check('mercosur', 'Copa Mercosur')] : []),
      ...(conPseudo.length ? [check('conmebol', 'Copa Conmebol')] : []),
      ...(supPseudo.length ? [check('supercopa', 'Supercopa')] : []),
      ...(interPseudo.length ? [check('interamericana', 'Copa Interamericana')] : []),
      ...(msupPseudo.length ? [check('mastersupercopa', 'Copa Máster de Supercopa')] : []),
      ...(cmasPseudo.length ? [check('conmebolmasters', 'Copa Conmebol Masters')] : []),
      ...(oroPseudo.length ? [check('oro', 'Copa de Oro')] : []),
      ...(rclubPseudo.length ? [check('recopaclubes', 'Recopa Sud. de Clubes')] : []),
      ...(surgPseudo.length ? [check('suruga', 'Suruga Bank Championship')] : []),
      ...(interconPseudo.length ? [check('intercontinental', 'Copa Intercontinental')] : [])),
    fasesPresentes.length > 1 ? fila('Fase:', ...fasesPresentes.map(checkFase)) : null,
    paisesPresentes.length > 1 ? fila('País rival:', paisSel) : null,
  ].filter(Boolean));

  const salida = el('div', {class: 'club-salida'});

  function incluido(p) {
    const fase = faseP(p);                                    // #16: filtro por fase (solo si el partido la tiene)
    if (fase && !f.fases.has(fase)) return false;
    if (f.pais && rivalPais(p) !== f.pais) return false;      // #17: filtro por país del rival
    if (ERAS_INTL.has(p.era)) return f[p.era];   // #14/#4: cada copa internacional tiene su eje (f.<era>)
    const e = eraGrupo(p), n = naturaleza(p);
    return ((e === 'prof' && f.prof) || (e === 'amateur' && f.amateur))
      && ((n === 'liga' && f.liga) || (n === 'copa' && f.copa));
  }

  // Selector de modo: enfrentamientos (balance por rival) o máximas goleadas (top 10 a favor y
  // en contra). Los filtros de era/tipo aplican a ambos.
  const estado = {modo: 'rivales', rSort: {key: 'J', dir: -1}};  // orden del historial por rival (J desc por defecto)
  const modoSel = el('div', {class: 'club-modos'});
  for (const [k, etq] of [['rivales', 'Enfrentamientos'], ['goleadas', 'Máximas goleadas']]) {
    const b = el('button', {type: 'button', class: 'modo-btn' + (k === 'rivales' ? ' activo' : '')}, etq);
    b.addEventListener('click', () => {
      if (estado.modo === k) return;
      estado.modo = k;
      for (const c of modoSel.children) c.classList.toggle('activo', c === b);
      recalcular();
    });
    modoSel.append(b);
  }

  // helpers de render compartidos por ambos modos
  const celdaEqLink = (n) => {
    const cid = idDe[n];
    const cont = [esc(n), n].filter(Boolean);
    return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
  };
  const num = (v) => el('td', {class: 'num'}, String(v));
  // gf/gc/margen de un partido desde la perspectiva de ESTE club
  const persp = (p) => {
    const esLocal = esMio(p.l);
    const gf = esLocal ? p.gl : p.gv, gc = esLocal ? p.gv : p.gl;
    return {gf, gc, margen: (gf ?? 0) - (gc ?? 0)};
  };
  // Filas/cabecera de las tablas de máximas goleadas (sin columna "Ganador": es redundante con el
  // resultado + la columna Dif).
  const filaPartido = (p) => el('tr', {},
    el('td', {class: 'txt'}, p.f || '—'),
    torneoCel(torneoNombres, p),
    celdaEqLink(p.l),
    el('td', {class: 'num'}, `${p.gl ?? ''}-${p.gv ?? ''}`),
    celdaEqLink(p.v));
  const cabezaPartidos = () => el('tr', {},
    el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Torneo'),
    el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'),
    el('th', {class: 'txt'}, 'Visitante'));

  const partidosFiltrados = () =>
    [...partidos, ...intlPseudos.flat()]
      .filter(p => (esMio(p.l) || esMio(p.v)) && incluido(p));

  function recalcular() {
    if (estado.modo === 'goleadas') renderGoleadas(partidosFiltrados());
    else renderRivales(partidosFiltrados());
  }

  // === MODO 2: máximas goleadas (top 10 a favor y en contra, entre los filtros elegidos) ===
  function renderGoleadas(ms) {
    const conGoles = ms.filter(p => p.gl != null && p.gv != null).map(p => ({p, ...persp(p)}));
    const favor = conGoles.filter(x => x.margen > 0)
      .sort((a, b) => b.margen - a.margen || b.gf - a.gf).slice(0, 10);
    const contra = conGoles.filter(x => x.margen < 0)
      .sort((a, b) => a.margen - b.margen || b.gc - a.gc).slice(0, 10);

    const bloque = (titulo, items, clase) => {
      if (!items.length) {
        return el('div', {class: 'goleadas-bloque'}, el('h4', {}, titulo),
          el('p', {class: 'placeholder'}, 'Sin partidos para los filtros elegidos.'));
      }
      const filas = items.map(({p, margen}) => {
        const fila = filaPartido(p);
        fila.append(el('td', {class: `num ${clase}`}, margen > 0 ? `+${margen}` : String(margen)));
        return fila;
      });
      const cab = cabezaPartidos();
      cab.append(el('th', {class: 'num'}, 'Dif'));
      return el('div', {class: 'goleadas-bloque'}, el('h4', {}, titulo),
        el('table', {class: 'posiciones'}, el('thead', {}, cab), el('tbody', {}, ...filas)));
    };

    salida.replaceChildren(el('div', {class: 'goleadas-grid'},
      bloque('Máximas goleadas a favor', favor, 'bal-g'),
      bloque('Máximas goleadas en contra', contra, 'bal-p')));
  }

  // === MODO 1: enfrentamientos (balance agregado por rival) ===
  function renderRivales(ms) {
    const porRival = new Map();
    const tot = {J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0};
    for (const p of ms) {
      const esLocal = esMio(p.l);
      const rival = esLocal ? p.v : p.l;
      let a = porRival.get(rival);
      if (!a) {
        a = {J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0, ms: []};
        porRival.set(rival, a);
      }
      a.ms.push(p);
      a.J++;
      tot.J++;
      if (p.r === 'E') {
        a.E++;
        tot.E++;
      } else if (p.r === 'L' || p.r === 'V') {
        const gano = (p.r === 'L') === esLocal;
        if (gano) {
          a.G++;
          tot.G++;
        } else {
          a.P++;
          tot.P++;
        }
      }
      if (p.gl != null && p.gv != null) {
        const gf = esLocal ? p.gl : p.gv, gc = esLocal ? p.gv : p.gl;
        a.GF += gf;
        a.GC += gc;
        tot.GF += gf;
        tot.GC += gc;
      }
    }

    // Columnas del historial: [clave, etiqueta, clase, título]. La clave 'rival' ordena por nombre;
    // 'GP'/'DIF' son derivadas (G−P y GF−GC).
    const RCOLS = [
      ['rival', 'Rival', 'txt', null], ['J', 'J', 'num', null], ['G', 'G', 'num', null],
      ['E', 'E', 'num', null], ['P', 'P', 'num', null], ['GP', 'G-P', 'num', 'Ganados − Perdidos'],
      ['GF', 'GF', 'num', null], ['GC', 'GC', 'num', null], ['DIF', 'Dif', 'num', 'Diferencia de gol']];
    const valOrden = (key, rn, a) => key === 'rival' ? rn
      : key === 'GP' ? a.G - a.P : key === 'DIF' ? a.GF - a.GC : a[key];

    const {key: sKey, dir: sDir} = estado.rSort;
    const rivales = [...porRival.entries()].sort((x, y) => {
      const xv = valOrden(sKey, x[0], x[1]), yv = valOrden(sKey, y[0], y[1]);
      const c = typeof xv === 'number' ? xv - yv : String(xv).localeCompare(String(yv));
      // desempate estable: más partidos, luego alfabético (así el orden no "salta" entre empates)
      return c * sDir || y[1].J - x[1].J || x[0].localeCompare(y[0]);
    });

    const celdaEqLink = (n) => {
      const cid = idDe[n];
      const cont = [esc(n), n].filter(Boolean);
      return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
    };
    const num = (v) => el('td', {class: 'num'}, String(v));
    const dif = (a) => {
      const d = a.GF - a.GC;
      return el('td', {class: 'num'}, d > 0 ? `+${d}` : String(d));
    };
    // Diferencia de partidos ganados vs perdidos (G-P), con signo: lo que codifica el color de fila.
    const difGP = (a) => {
      const d = a.G - a.P;
      return el('td', {class: 'num dif-gp'}, d > 0 ? `+${d}` : String(d));
    };

    // sub-tabla de partidos uno a uno vs un rival (se arma perezosamente al expandir)
    function detallePartidos(ms) {
      const filas = [...ms].sort((x, y) => fechaKey(x.f) - fechaKey(y.f)).map(p => el('tr', {},
        el('td', {class: 'txt'}, p.f || '—'),
        torneoCel(torneoNombres, p),
        celdaEqLink(p.l),
        el('td', {class: 'num'}, `${p.gl ?? ''}-${p.gv ?? ''}`),
        celdaEqLink(p.v),
        el('td', {class: 'txt'}, p.r === 'E' ? 'Empate' : (p.r === 'L' ? p.l : p.r === 'V' ? p.v : '—'))));
      return el('table', {class: 'posiciones sub-partidos'},
        el('thead', {}, el('tr', {},
          el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Torneo'),
          el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'),
          el('th', {class: 'txt'}, 'Visitante'), el('th', {class: 'txt'}, 'Ganador'))),
        el('tbody', {}, ...filas));
    }

    const filas = [];
    for (const [rn, a] of rivales) {
      const cont = el('td', {class: 'detalle-cont', colspan: '9'});
      const detTr = el('tr', {class: 'detalle-row oculto'}, cont);
      const caret = el('span', {class: 'caret'}, '▸');
      const cid = idDe[rn];
      const nombreRival = cid ? el('a', {href: clubHref(cid)}, [esc(rn), rn].filter(Boolean))
        : el('span', {}, [esc(rn), rn].filter(Boolean));
      const celdaRival = el('td', {class: 'txt rival-cel'}, caret, nombreRival);
      celdaRival.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;             // el nombre navega; el resto expande
        const abierto = detTr.classList.toggle('oculto') === false;
        caret.textContent = abierto ? '▾' : '▸';
        if (abierto && !cont.firstChild) cont.append(detallePartidos(a.ms));
      });
      // Color suave segun el balance: verde si gano mas de lo que perdio, rojo si al
      // reves, amarillo si estan igualados.
      const bal = a.G > a.P ? 'bal-g' : a.P > a.G ? 'bal-p' : 'bal-e';
      filas.push(el('tr', {class: `rival-row ${bal}`},
        celdaRival, num(a.J), num(a.G), num(a.E), num(a.P), difGP(a), num(a.GF), num(a.GC), dif(a)));
      filas.push(detTr);
    }

    // Cabecera ordenable: al tocar una columna se re-renderiza con ese orden (toggle asc/desc; el
    // texto arranca ascendente, los números descendente). La flecha marca la columna activa.
    const cabeza = el('tr', {}, ...RCOLS.map(([k, etq, cls, title]) => el('th', {
      class: cls + (k === sKey ? ' sorted' : ''),
      ...(title ? {title} : {}),
      onclick: () => {
        estado.rSort = {key: k, dir: sKey === k ? -sDir : (cls === 'txt' ? 1 : -1)};
        renderRivales(ms);
      },
    }, etq + (k === sKey ? (sDir === 1 ? ' ▲' : ' ▼') : ''))));
    const totGP = tot.G - tot.P;
    const pie = el('tr', {class: 'total'},
      el('td', {class: 'txt'}, `Total (${rivales.length} rivales)`),
      num(tot.J), num(tot.G), num(tot.E), num(tot.P),
      el('td', {class: 'num dif-gp'}, totGP > 0 ? `+${totGP}` : String(totGP)), num(tot.GF), num(tot.GC),
      el('td', {class: 'num'}, (tot.GF - tot.GC) > 0 ? `+${tot.GF - tot.GC}` : String(tot.GF - tot.GC)));

    const tabla = rivales.length
      ? el('table', {class: 'posiciones stats'},
        el('thead', {}, cabeza), el('tbody', {}, ...filas), el('tfoot', {}, pie))
      : el('p', {class: 'placeholder'}, 'Sin partidos para los filtros elegidos.');
    salida.replaceChildren(tabla);
  }

  // #18: Palmarés del club — títulos internacionales (Libertadores/Sudamericana/Recopa, de los
  // champion json) + nacionales (Ligas/Copas de palmares.json). Chips enlazables al torneo.
  function bloquePalmares() {
    const kids = [];
    let total = 0;
    const intl = (camp, comp, ruta) => {
      if (!camp) return;
      const anios = Object.entries(camp).filter(([, cl]) => esMio(cl)).map(([e]) => e)
        .sort((a, b) => +a - +b);
      if (!anios.length) return;
      total += anios.length;
      kids.push(el('div', {class: 'titulos-bloque'},
        el('span', {class: 'titulos-lbl'}, `${comp} (${anios.length}): `),
        ...anios.map((a) => el('a', {class: 'titulo-chip', href: `${ruta}?e=${a}`}, a))));  // #3: a la edición
    };
    intl(libCamp, 'Copa Libertadores', '#/libertadores');
    intl(sudCamp, 'Copa Sudamericana', '#/sudamericana');
    intl(recCamp, 'Recopa Sudamericana', '#/recopa');
    intl(merCamp, 'Copa Mercosur', '#/mercosur');
    intl(conCamp, 'Copa Conmebol', '#/conmebol');
    intl(supCamp, 'Supercopa Sudamericana', '#/supercopa');
    intl(interCamp, 'Copa Interamericana', '#/interamericana');
    intl(msupCamp, 'Copa Máster de Supercopa', '#/mastersupercopa');
    intl(cmasCamp, 'Copa Conmebol Masters', '#/conmebolmasters');
    intl(oroCamp, 'Copa de Oro', '#/oro');
    intl(rclubCamp, 'Recopa Sud. de Clubes', '#/recopa-clubes');
    intl(surgCamp, 'Suruga Bank Championship', '#/suruga');
    intl(interconCamp, 'Copa Intercontinental', '#/intercontinental');
    const pal = palmares && palmares[nombre];
    if (pal && pal.ligas && pal.ligas.length) {
      total += pal.ligas.length;
      kids.push(el('div', {class: 'titulos-bloque'},
        el('span', {class: 'titulos-lbl'}, `Ligas (${pal.ligas.length}): `),
        ...pal.ligas.map(([nom, anio, gid]) => {
          const txt = `${nom}${anio ? ` (${anio})` : ''}`;
          return gid
            ? el('a', {class: 'titulo-chip', href: `#/tabla-historica?t=${encodeURIComponent(gid)}`}, txt)
            : el('span', {class: 'titulo-chip'}, txt);
        })));
    }
    if (pal && pal.copas && pal.copas.length) {
      total += pal.copas.length;
      kids.push(el('div', {class: 'titulos-bloque'},
        el('span', {class: 'titulos-lbl'}, `Copas (${pal.copas.length}): `),
        ...pal.copas.map(([c, e]) => el('a', {
          class: 'titulo-chip', href: `#/copas?c=${encodeURIComponent(c)}&e=${encodeURIComponent(e)}`,
        }, `${c}${e ? ` ${e}` : ''}`))));
    }
    if (!kids.length) return null;
    // Colapsable: el <h3> togglea la visibilidad del cuerpo (caret ▾ abierto / ▸ cerrado). COLAPSADO por defecto.
    const cuerpo = el('div', {class: 'palmares-cuerpo'}, ...kids);
    const cab = el('h3', {class: 'palmares-cab'},
      el('span', {class: 'caret'}, '▸'),
      'Palmarés ', el('span', {class: 'sub'}, `(${total} título${total === 1 ? '' : 's'})`));
    const wrap = el('div', {class: 'club-palmares colapsado'}, cab, cuerpo);
    cab.addEventListener('click', () => {
      const cerrado = wrap.classList.toggle('colapsado');
      cab.querySelector('.caret').textContent = cerrado ? '▸' : '▾';
    });
    return wrap;
  }

  const palmBloque = bloquePalmares();

  // Filtros (era/tipo/internacional/fase/país) dentro de una sección colapsable, COLAPSADA por defecto.
  const filtrosDetalle = el('details', {class: 'club-filtros'},
    el('summary', {}, 'Filtros'), controles);

  container.append(
    el('p', {}, volverLink()),
    ficha,
    ...(palmBloque ? [palmBloque] : []),
    el('h3', {}, 'Historial'),
    modoSel,
    el('p', {class: 'nota'}, 'Elegí entre el balance agregado por rival y las máximas goleadas '
      + '(top 10 a favor y en contra). Marcá/desmarcá era y tipo de torneo para recalcular.'),
    filtrosDetalle,
    salida);
  recalcular();
}
