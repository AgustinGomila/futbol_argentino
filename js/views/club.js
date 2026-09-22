// Vista: pagina individual de club (ruta #/club/<id>). Muestra metadata del club y el
// head-to-head agregado por rival (J G E P GF GC Dif, ordenado por J desc), filtrable por
// dos ejes combinables: ERA (Profesional / Amateur) y TIPO (Primera División / Segunda División / Copas).
// Los partidos vienen de partidos.json (era: 'amateur'|'profesional'|'copa') y de segunda_partidos.json
// (marcados cat='segunda'; los de promoción con otras categorías traen pr=1 y van al tipo 'Promoción'); para las
// copas la era se deriva del ano de la edicion (>=1931 -> profesional).

import {botonVerMas, clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';
import {torneoCel} from '../torneos.js';
import {clubIndex, fusionNombre} from '../clubes_ui.js';
import {crearSelectorPais, PAIS_ES} from '../paises.js';

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

// Año de referencia de un partido: el de la fecha si la tiene, si no el del torneo (p.t) o la edición
// (p.e). Ubica en la década/año a los partidos SIN fecha (ej. no disputados / otorgados).
const anioRef = (p) => anio(p.f) || anio(p.t) || (p.e != null ? anio(String(p.e)) : 0);
// Nº de ronda/jornada, para desempatar el orden de los partidos SIN fecha e intercalarlos cerca de su
// ronda: jornada de liga (p.j) o el 1er número de la ronda cruda de copa (p.rc / p.ronda).
const rondaNum = (p) => p.j != null ? (+p.j || 0)
  : ((String(p.rc || p.ronda || '').match(/\d+/) || [0])[0] | 0);
// Clave de orden cronológico. Si el partido tiene día/mes reales, usa la fecha; si NO (no disputado /
// solo-año), cae al año del Torneo + la Ronda, para intercalarlo según a qué torneo y ronda pertenece
// en vez de amontonarlo aparte. (#5)
function ordenKey(p) {
  const k = fechaKey(p.f);
  if (k % 10000 !== 0) return k;                        // fecha con día/mes -> orden real
  return anioRef(p) * 10000 + Math.min(rondaNum(p), 99) * 50;
}

const naturaleza = (p) => p.pr ? 'promocion' : p.cat === 'segunda' ? 'segunda' : p.era === 'copa' ? 'copa' : 'primera';
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

export async function render(container, params = {}) {
  const id = params.id;
  const [registro, partidos, escudos, torneoNombres, lib, sud, rec,
    palmares, libCamp, sudCamp, recCamp,
    mer, con, sup, inter, merCamp, conCamp, supCamp, interCamp,
    msup, cmas, oroM, rclub, intercon,
    msupCamp, cmasCamp, oroCamp, rclubCamp, interconCamp,
    surg, surgCamp, ald, aldCamp, esg, esgCamp, cou, couCamp, cti, ctiCamp, segunda] = await Promise.all([
    loadJSON('registro'), loadJSON('partidos'), loadJSON('escudos'), loadJSON('torneo_nombres'),
    loadJSON('libertadores'), loadJSON('sudamericana'), loadJSON('recopa'),
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
    loadJSON('suruga'), loadJSON('suruga_campeones'),
    loadJSON('aldao'), loadJSON('aldao_campeones'),
    loadJSON('escobargerona'), loadJSON('escobargerona_campeones'),
    loadJSON('cousenier'), loadJSON('cousenier_campeones'),
    loadJSON('cuptie'), loadJSON('cuptie_campeones'), loadJSON('segunda_partidos')]);

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
  // Título de la ficha: nombre completo si existe; si no, el nombre común editable; si no, el canónico.
  const nombreMostrar = club.nombre_completo || club.nombre_comun || nombre;  // #13
  const {idDe, label} = clubIndex(registro);         // idDe: enlace por id · label: nombre común mostrado

  // #12: si este club es DESTINO de una fusión, su ficha incluye los partidos jugados con las
  // denominaciones-origen (conservando ese nombre en cada fila). misNombres = todas sus denominaciones.
  const fusiones = fusionNombre(registro);   // origen canónico -> destino canónico (derivado de registro.fusion)
  const misNombres = new Set([nombre]);
  for (const [orig, dest] of Object.entries(fusiones)) if (dest === nombre) misNombres.add(orig);
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
  const rclubPseudo = pseudoDe(rclub, 'recopaclubes', 'Recopa Sudamericana de Clubes');
  const interconPseudo = pseudoDe(intercon, 'intercontinental', 'Copa Intercontinental');
  const surgPseudo = pseudoDe(surg, 'suruga', 'Suruga Bank Championship');
  const aldPseudo = pseudoDe(ald, 'aldao', 'Copa Aldao');
  const esgPseudo = pseudoDe(esg, 'escobargerona', 'Copa Escobar-Gerona');
  const couPseudo = pseudoDe(cou, 'cousenier', 'Copa de Honor Cousenier');
  const ctiPseudo = pseudoDe(cti, 'cuptie', 'Cup Tie Competition');
  const intlPseudos = [libPseudo, sudPseudo, recPseudo, merPseudo, conPseudo, supPseudo, interPseudo,
    msupPseudo, cmasPseudo, oroPseudo, rclubPseudo, interconPseudo, surgPseudo, aldPseudo, esgPseudo,
    couPseudo, ctiPseudo];
  const ERAS_INTL = new Set(['internacional', 'sudamericana', 'recopa',
    'mercosur', 'conmebol', 'supercopa', 'interamericana',
    'mastersupercopa', 'conmebolmasters', 'oro', 'recopaclubes', 'intercontinental', 'suruga', 'aldao',
    'escobargerona', 'cousenier', 'cuptie']);
  const esInternacional = (p) => ERAS_INTL.has(p.era);
  // #16: fase de un partido — copas por su ronda cruda (p.rc), internacionales por p.fase; liga = null.
  const faseP = (p) => faseDe(p.era === 'copa' ? p.rc : (esInternacional(p) ? p.fase : null));
  // #17: país del RIVAL — internacional: el código del otro lado; nacional (liga/copa): Argentina.
  const rivalPais = (p) => esInternacional(p) ? ((esMio(p.l) ? p.pv : p.pl) || '') : 'Arg';
  // #69: tipo de competición de un partido (vista "por competición"): ligas juntas ('Primera División');
  // copas nacionales por su nombre (p.t); internacionales por su copa.
  const COMP_INTL = {
    internacional: 'Copa Libertadores', sudamericana: 'Copa Sudamericana',
    recopa: 'Recopa Sudamericana', mercosur: 'Copa Mercosur', conmebol: 'Copa Conmebol',
    supercopa: 'Supercopa Sudamericana', interamericana: 'Copa Interamericana',
    mastersupercopa: 'Copa Máster de Supercopa', conmebolmasters: 'Copa Conmebol Masters',
    oro: 'Copa de Oro', recopaclubes: 'Recopa Sudamericana de Clubes', intercontinental: 'Copa Intercontinental',
    suruga: 'Suruga Bank Championship', aldao: 'Copa Aldao', escobargerona: 'Copa Escobar-Gerona',
    cousenier: 'Copa de Honor Cousenier', cuptie: 'Cup Tie Competition'
  };
  const compTipo = (p) => p.pr ? 'Promoción' : p.cat === 'segunda' ? 'Segunda División'
    : (p.era === 'amateur' || p.era === 'profesional') ? 'Primera División'
      : p.era === 'copa' ? (p.t || 'Copa nacional')
        : (COMP_INTL[p.era] || 'Internacional');

  // Segunda división: sus partidos se suman al historial del club (eje Tipo propio). Incluye las promociones /
  // torneos promocionales con otras categorías (pr=1, eje Tipo 'Promoción'): a veces son los ÚNICOS partidos
  // del club en el sitio (ej. Arsenal de Lavallol, Torneo Promocional 1967).
  const segPartidos = (segunda || []).filter(p => esMio(p.l) || esMio(p.v)).map(p => ({...p, cat: 'segunda'}));
  const todosLosPartidos = [...partidos, ...segPartidos, ...intlPseudos.flat()];
  const misMs = todosLosPartidos.filter(p => esMio(p.l) || esMio(p.v));
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
  // Fusiones (registro.fusion = id del DESTINO): a la derecha de la ficha, escudos a la mitad del tamaño con
  // enlace a la ficha. Arriba el club con el que se fusionó; debajo (separado por una línea) del que proviene.
  const escFusion = (cid) => {
    const c = registro[cid];
    if (!c) return null;
    const src = escudos && escudos[c.nombre];
    return el('a', {class: 'fusion-club', href: clubHref(cid), title: label(c.nombre)},
      src ? el('img', {src: 'images/' + src, class: 'escudo-fusion', alt: label(c.nombre)}) : label(c.nombre));
  };
  const bloqueFusion = (titulo, ids) => {
    const escs = ids.map(escFusion).filter(Boolean);
    return escs.length ? el('div', {class: 'fusion-bloque'},
      el('span', {class: 'fusion-lbl'}, titulo), el('div', {class: 'fusion-escudos'}, escs)) : null;
  };
  const origenes = Object.keys(registro).filter((k) => registro[k] && registro[k].fusion === id);
  const fusionCol = [
    club.fusion ? bloqueFusion('Se fusionó con', [club.fusion]) : null,
    origenes.length ? bloqueFusion('Proviene de', origenes) : null,
  ].filter(Boolean);
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
    ].filter(Boolean)),
      fusionCol.length ? el('div', {class: 'club-fusiones'}, fusionCol) : null].filter(Boolean));

  // --- filtros ---
  const f = {
    prof: true, amateur: true, primera: true, segunda: true, promocion: true, copa: true,
    internacional: true, sudamericana: true, recopa: true,
    mercosur: true, conmebol: true, supercopa: true, interamericana: true,
    mastersupercopa: true, conmebolmasters: true, oro: true, recopaclubes: true, intercontinental: true,
    suruga: true, aldao: true, escobargerona: true, cousenier: true, cuptie: true,
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
  const paisSel = crearSelectorPais({
    paises: paisesPresentes, nombre: (cc) => PAIS_ES[cc] || cc, todos: 'Todos',
    onElegir: (cc) => {
      f.pais = cc;
      recalcular();
    },
  }).el;
  const controles = el('div', {class: 'club-controles'}, [
    fila('Era:', check('prof', 'Profesional'), check('amateur', 'Amateur')),
    fila('Tipo:', check('primera', 'Primera División'), check('segunda', 'Segunda División'),
      ...(misMs.some((p) => p.pr) ? [check('promocion', 'Promoción')] : []), check('copa', 'Copas')),
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
      ...(rclubPseudo.length ? [check('recopaclubes', 'Recopa Sudamericana de Clubes')] : []),
      ...(surgPseudo.length ? [check('suruga', 'Suruga Bank Championship')] : []),
      ...(interconPseudo.length ? [check('intercontinental', 'Copa Intercontinental')] : []),
      ...(aldPseudo.length ? [check('aldao', 'Copa Aldao')] : []),
      ...(esgPseudo.length ? [check('escobargerona', 'Copa Escobar-Gerona')] : []),
      ...(couPseudo.length ? [check('cousenier', 'Copa de Honor Cousenier')] : []),
      ...(ctiPseudo.length ? [check('cuptie', 'Cup Tie Competition')] : [])),
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
      && f[n];   // n = "primera" | "segunda" | "promocion" | "copa"
  }

  // Selector de modo: enfrentamientos (balance por rival) o máximas goleadas (top 10 a favor y
  // en contra). Los filtros de era/tipo aplican a ambos.
  const estado = {modo: 'rivales', rSort: {key: 'J', dir: -1}};  // orden del historial por rival (J desc por defecto)
  const modoSel = el('div', {class: 'club-modos'});
  // #69: el historial se puede ver por rival (balance agregado), por fecha (colapsable por década) o por
  // competición (colapsable, cronológica). 'Máximas goleadas' es una vista aparte.
  for (const [k, etq] of [['rivales', 'Por rival'], ['fecha', 'Por fecha'],
    ['competicion', 'Por competición'], ['goleadas', 'Máximas goleadas']]) {
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
    const cont = [esc(n), label(n)].filter(Boolean);
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
  // marcador + marca de nota disciplinaria (p.nd: partido otorgado/abandonado inyectado display-only, item 19)
  const resCell = (p) => el('td', {class: 'num'}, `${p.gl ?? ''}-${p.gv ?? ''}`,
    p.nd ? el('span', {class: 'nota-disc', title: p.nd}, ' ⚖') : '');
  const filaPartido = (p) => el('tr', {},
    el('td', {class: 'txt'}, p.f || '—'),
    torneoCel(torneoNombres, p),
    celdaEqLink(p.l),
    resCell(p),
    celdaEqLink(p.v));
  const cabezaPartidos = () => el('tr', {},
    el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Torneo'),
    el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'),
    el('th', {class: 'txt'}, 'Visitante'));

  const partidosFiltrados = () => misMs.filter(incluido);

  function recalcular() {
    if (estado.modo === 'goleadas') renderGoleadas(partidosFiltrados());
    else if (estado.modo === 'fecha') renderPorFecha(partidosFiltrados());
    else if (estado.modo === 'competicion') renderPorCompeticion(partidosFiltrados());
    else renderRivales(partidosFiltrados());
  }

  // Color de cada partido desde la perspectiva del club (mismos tonos que el balance por rival):
  // verde ganó, rojo perdió, amarillo empató; sin resultado ('—') queda sin color.
  const balPartido = (p) => p.r === 'E' ? 'bal-e'
    : (p.r === 'L' || p.r === 'V') ? ((p.r === 'L') === esMio(p.l) ? 'bal-g' : 'bal-p') : '';

  // tabla de partidos uno-a-uno (cronológica, con columna Ganador). Compartida por las vistas por fecha
  // y por competición. Reusa celdaEqLink/resCell/torneoCel del scope.
  function tablaDetalle(ms) {
    const filas = [...ms].sort((x, y) => ordenKey(x) - ordenKey(y)).map(p => el('tr', {class: balPartido(p)},
      el('td', {class: 'txt'}, p.f || '—'),
      torneoCel(torneoNombres, p),
      celdaEqLink(p.l),
      resCell(p),
      celdaEqLink(p.v),
      el('td', {class: 'txt'}, p.r === 'E' ? 'Empate' : (p.r === 'L' ? p.l : p.r === 'V' ? p.v : '—'))));
    return el('table', {class: 'posiciones sub-partidos'},
      el('thead', {}, el('tr', {},
        el('th', {class: 'txt'}, 'Fecha'), el('th', {class: 'txt'}, 'Torneo'),
        el('th', {class: 'txt'}, 'Local'), el('th', {class: 'num'}, 'Res.'),
        el('th', {class: 'txt'}, 'Visitante'), el('th', {class: 'txt'}, 'Ganador'))),
      el('tbody', {}, ...filas));
  }

  // bloque colapsable con carga perezosa de la tabla al abrir (evita renderizar miles de filas de una).
  function bloquePlegable(etq, ms) {
    const n = ms.length;
    const det = el('details', {class: 'plegable'},
      el('summary', {}, el('b', {}, etq), el('span', {class: 'sub'}, ` · ${n} partido${n !== 1 ? 's' : ''}`)));
    det.addEventListener('toggle', () => {
      if (det.open && det.children.length === 1) det.append(tablaDetalle(ms));
    });
    return det;
  }

  const vacio = () => el('p', {class: 'placeholder'}, 'Sin partidos para los filtros elegidos.');

  // === MODO 3: por FECHA (agrupado y colapsable por década, más reciente primero) ===
  function renderPorFecha(ms) {
    const porDec = new Map();   // década (num; 0 = año desconocido) -> [partidos]
    for (const p of ms) {
      const y = anioRef(p), dec = y ? Math.floor(y / 10) * 10 : 0;  // #5: los sin fecha usan el año del torneo
      (porDec.get(dec) || porDec.set(dec, []).get(dec)).push(p);
    }
    const decs = [...porDec.keys()].sort((a, b) => b - a);
    if (!decs.length) return salida.replaceChildren(vacio());
    salida.replaceChildren(...decs.map((d) => bloquePlegable(d ? `${d}–${d + 9}` : 'Sin fecha', porDec.get(d))));
  }

  // === MODO 4: por COMPETICIÓN (colapsable; competiciones ordenadas por su primer partido) ===
  function renderPorCompeticion(ms) {
    const porComp = new Map();   // etiqueta de competición -> [partidos]
    for (const p of ms) {
      const c = compTipo(p);
      (porComp.get(c) || porComp.set(c, []).get(c)).push(p);
    }
    const minY = (arr) => Math.min(...arr.map((p) => anioRef(p) || 9999));
    const comps = [...porComp.entries()].sort((a, b) => minY(a[1]) - minY(b[1]) || a[0].localeCompare(b[0]));
    if (!comps.length) return salida.replaceChildren(vacio());
    salida.replaceChildren(...comps.map(([c, arr]) => bloquePlegable(c, arr)));
  }

  // === MODO 2: máximas goleadas (top 10 a favor y en contra, entre los filtros elegidos; "Ver 10 más") ===
  function renderGoleadas(ms) {
    const conGoles = ms.filter(p => p.gl != null && p.gv != null).map(p => ({p, ...persp(p)}));
    const favor = conGoles.filter(x => x.margen > 0)
      .sort((a, b) => b.margen - a.margen || b.gf - a.gf);
    const contra = conGoles.filter(x => x.margen < 0)
      .sort((a, b) => a.margen - b.margen || b.gc - a.gc);

    const bloque = (titulo, items, clase) => {
      if (!items.length) {
        return el('div', {class: 'goleadas-bloque'}, el('h4', {}, titulo),
          el('p', {class: 'placeholder'}, 'Sin partidos para los filtros elegidos.'));
      }
      const filaGoleada = ({p, margen}) => {
        const fila = filaPartido(p);
        fila.append(el('td', {class: `num ${clase}`}, margen > 0 ? `+${margen}` : String(margen)));
        return fila;
      };
      const cab = cabezaPartidos();
      cab.append(el('th', {class: 'num'}, 'Dif'));
      const tbody = el('tbody', {}, ...items.slice(0, 10).map(filaGoleada));
      return el('div', {class: 'goleadas-bloque'}, el('h4', {}, titulo),
        el('table', {class: 'posiciones'}, el('thead', {}, cab), tbody),
        botonVerMas(tbody, items, filaGoleada, 10) || '');
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
      const cont = [esc(n), label(n)].filter(Boolean);
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
      const filas = [...ms].sort((x, y) => ordenKey(x) - ordenKey(y)).map(p => el('tr', {class: balPartido(p)},
        el('td', {class: 'txt'}, p.f || '—'),
        torneoCel(torneoNombres, p),
        celdaEqLink(p.l),
        resCell(p),
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
      const nombreRival = cid ? el('a', {href: clubHref(cid)}, [esc(rn), label(rn)].filter(Boolean))
        : el('span', {}, [esc(rn), label(rn)].filter(Boolean));
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
      // campeón = string o {c, co, nota, nac}: co-campeones suman ambos; nac = título NACIONAL (Cup Tie
      // 1900-06), que ya figura en palmares.copas -> no se cuenta como internacional.
      const anios = Object.entries(camp)
        .filter(([, cl]) => typeof cl === 'string' ? esMio(cl) : (!cl.nac && (esMio(cl.c) || esMio(cl.co))))
        .map(([e]) => e)
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
    intl(rclubCamp, 'Recopa Sudamericana de Clubes', '#/recopa-clubes');
    intl(surgCamp, 'Suruga Bank Championship', '#/suruga');
    intl(interconCamp, 'Copa Intercontinental', '#/intercontinental');
    intl(aldCamp, 'Copa Aldao', '#/aldao');
    intl(esgCamp, 'Copa Escobar-Gerona', '#/escobar-gerona');
    intl(couCamp, 'Copa de Honor Cousenier', '#/cousenier');
    intl(ctiCamp, 'Cup Tie Competition', '#/cuptie');
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
        ...pal.copas.map(([c, e, , ruta]) => el('a', {
          class: 'titulo-chip',
          href: ruta ? `${ruta}?e=${e}` : `#/copas?c=${encodeURIComponent(c)}&e=${encodeURIComponent(e)}`,
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
      + '(top 10 a favor y en contra, ampliable de a 10). Marcá/desmarcá era y tipo de torneo para recalcular.'),
    filtrosDetalle,
    salida);
  recalcular();
}
