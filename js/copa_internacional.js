// Módulo compartido: vista de una copa internacional (Libertadores / Sudamericana). Tres modos:
// Palmarés (títulos por club), Tabla histórica (récords all-time ordenables) y Por edición (partidos
// por ronda + tabla de grupo + campeón). Datos parseados de RSSSF sacups/. Los clubes argentinos
// convergen a sus canónicos (con escudo y link a su ficha); todos muestran el país en gris.
// Lo usan js/views/libertadores.js y js/views/sudamericana.js pasando `opts`.
// El control "Edición" usa el desplegable rico compartido (dropdown.js): cada año muestra a la
// derecha el escudo + nombre del campeón de esa edición.

import {botonCSV, chipEnCurso, clubHref, el, esEnCurso} from './main.js';
import {loadJSON} from './data.js';
import {crearSelectorRico} from './dropdown.js';

const PAIS_ES = {
  Arg: 'Argentina',
  Bol: 'Bolivia',
  Bra: 'Brasil',
  Chi: 'Chile',
  Col: 'Colombia',
  Ecu: 'Ecuador',
  Mex: 'México',
  Par: 'Paraguay',
  Per: 'Perú',
  Uru: 'Uruguay',
  Ven: 'Venezuela',
  USA: 'Estados Unidos',
  CRi: 'Costa Rica',
  Hon: 'Honduras',
  Gua: 'Guatemala',
  ESa: 'El Salvador',
  Tri: 'Trinidad y Tobago',
  // Europeos (Copa Intercontinental)
  Esp: 'España',
  Por: 'Portugal',
  Ita: 'Italia',
  Esc: 'Escocia',
  Ing: 'Inglaterra',
  Hol: 'Países Bajos',
  Ale: 'Alemania',
  Sue: 'Suecia',
  Gre: 'Grecia',
  Rum: 'Rumania',
  Yug: 'Yugoslavia',
  // Asia (Suruga Bank Championship)
  Jpn: 'Japón',
};

// fecha ISO del partido -> 'DD/MM/YYYY'; '' si m.f es solo el año o no viene (Sudamericana aún sin fecha).
const fmtFecha = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

function ordenRonda(r) {
  const s = (r || '').toLowerCase();
  let m;
  if ((m = s.match(/qualifying round (\d+)/))) return 100 + +m[1];
  if (s.includes('preliminary')) return 90;
  if (s.includes('first round')) return 110;
  if (s.includes('second round')) return 300;
  if (s === 'round robin') return 130;
  if ((m = s.match(/group (\d+)/))) return 200 + +m[1];  // 1ª fase de grupos (1966-99): Group 1/2/3 -> 201+
  if ((m = s.match(/group ([a-z])/))) return 250 + (m[1].charCodeAt(0) - 96);  // 2ª fase (Group A/B/C) DESPUÉS
  // desempates DENTRO de las fases de grupos (1962-87): 2º puesto cierra la 1ª fase; 1º puesto (finalista)
  // cierra la 2ª. Van antes del genérico 'playoff' (que es el desempate de la Final, tras el partido final).
  if (s.includes('second place')) return 240;  // tras los grupos de 1ª fase (201+), antes de los de 2ª (251+)
  if (s.includes('first place')) return 270;    // tras los grupos de 2ª fase, antes de la eliminatoria
  if (s.includes('playoff round') || s.includes('play-off round')) return 770;  // Sudamericana: previa a octavos
  if ((m = s.match(/round of (\d+)/))) return 800 - +m[1];
  if ((m = s.match(/(\d+)\/(\d+)\s*finals?/))) return 800 - +m[2];  // '1/8 Finals' = octavos (792), 1/4, 1/2
  if (s.includes('eighth')) return 785;
  if (s.includes('quarter')) return 900;
  if (s.includes('semi')) return 950;
  if (s.includes('third place')) return 970;
  if (s.includes('playoff') || s.includes('play-off')) return 1010;  // desempate de la final -> tras la Final
  if (s.includes('final')) return 1000;
  return 500;
}

const RONDA_ES = [
  [/qualifying round (\d+)/, (m) => `Fase previa ${m[1]}`], [/preliminary/, () => 'Fase preliminar'],
  [/first round/, () => 'Primera fase'], [/second round/, () => 'Segunda fase'],
  [/round robin/, () => 'Todos contra todos'], [/group ([a-z0-9]+)/, (m) => `Grupo ${m[1].toUpperCase()}`],
  [/play-?off round/, () => 'Eliminatoria de octavos'],  // Sudamericana: repechaje previo a octavos
  [/round of (\d+)/, (m) => `${m[1]}avos de final`],
  [/1\/8\s*finals?/, () => 'Octavos de final'], [/1\/4\s*finals?/, () => 'Cuartos de final'],
  [/1\/2\s*finals?/, () => 'Semifinal'], [/eighth/, () => 'Octavos de final'],
  [/quarter/, () => 'Cuartos de final'], [/semi/, () => 'Semifinal'],
  [/third place/, () => 'Tercer puesto'],
  [/second place/, () => 'Desempate 2º puesto'], [/first place/, () => 'Desempate 1º puesto'],
  [/playoff tournament/, () => 'Grupo Desempate'],
  [/play-?off/, () => 'Desempate'], [/final/, () => 'Final'],
];

function rondaEs(r) {
  const s = (r || '').toLowerCase();
  for (const [re, f] of RONDA_ES) {
    const m = s.match(re);
    if (m) return f(m);
  }
  return r || '';
}

// muestran mini-tabla: grupos, el 'Playoff Tournament' 1969 (desempate) y el 'Round robin' 1948 (liga única)
const esGrupo = (r) => /group|playoff tournament|round robin/i.test(r || '');
// dos partidos son legs de la MISMA serie (mismo par de equipos, en cualquier orden)
const mismoPar = (a, b) => (a.l === b.l && a.v === b.v) || (a.l === b.v && a.v === b.l);

// signo del resultado: +1 gana el local, -1 gana la visita, 0 empate. Considera 'awd' (resultado
// OTORGADO a un equipo pese al marcador de cancha: walkover, jugador inelegible, etc.).
const signo = (m) => m.awd === 'l' ? 1 : m.awd === 'v' ? -1 : m.gl > m.gv ? 1 : m.gl < m.gv ? -1 : 0;

// Ordena las secciones (rondas) de una edición. Los desempates de grupo ('First/Second Place Playoff',
// eras 1962-1987 con doble fase de grupos) se ubican JUSTO DESPUÉS del grupo cuyos dos participantes
// deciden —ambos equipos jugaron ese grupo—, en vez de caer todos juntos al final del bloque de grupos.
// El resto ordena por ordenRonda. NO son desempates de grupo: 'Third Place Playoff' (partido por 3er
// puesto), 'Playoff' (desempate de la Final) ni 'Playoff Round' (repechaje de Sudamericana).
function seccionesOrdenadas(ms) {
  const porRonda = new Map();
  for (const m of ms) {
    if (!porRonda.has(m.r)) porRonda.set(m.r, []);
    porRonda.get(m.r).push(m);
  }
  const grupos = new Map();  // label de grupo -> Set(equipos)
  for (const [r, arr] of porRonda) {
    if (!/group/i.test(r)) continue;
    const s = new Set();
    for (const m of arr) {
      s.add(m.l);
      s.add(m.v);
    }
    grupos.set(r, s);
  }
  // desempates de grupo: 'First/Second Place Playoff' (1962-87) y el 'Playoff Tournament' de 1969
  // (los 4 de Group 2 empataron a 6 pts -> mini-torneo de desempate, 2 partidos por equipo).
  const esPlace = (r) => /(first|second) place|playoff tournament/i.test(r);
  const grupoDe = (m) => {
    for (const [g, s] of grupos) if (s.has(m.l) && s.has(m.v)) return g;
    return null;
  };
  const secs = [];
  const attach = new Map();  // label de grupo -> [{r, m}]
  for (const [r, arr] of porRonda) {
    if (esPlace(r)) {
      const mapped = arr.map((m) => [m, grupoDe(m)]);
      if (mapped.every(([, g]) => g)) {   // todos los partidos deciden un grupo -> reubicar tras él
        for (const [m, g] of mapped) {
          if (!attach.has(g)) attach.set(g, []);
          attach.get(g).push({r, m});
        }
        continue;
      }
    }
    secs.push({r, ms: arr, orden: ordenRonda(r)});
  }
  secs.sort((a, b) => a.orden - b.orden);
  const out = [];
  for (const sec of secs) {
    out.push({r: sec.r, ms: sec.ms});
    const ins = attach.get(sec.r);
    if (!ins) continue;
    const byR = new Map();  // conserva el label (título) y agrupa por ronda si hay varios
    for (const {r, m} of ins) {
      if (!byR.has(r)) byR.set(r, []);
      byR.get(r).push(m);
    }
    for (const [r, list] of byR) out.push({r, ms: list});
  }
  return out;
}

export async function renderCopa(container, params = {}, opts = {}) {
  const [lib, camp, escudos, registro, iconos] = await Promise.all([
    loadJSON(opts.dataKey), loadJSON(opts.campKey),
    loadJSON('escudos'), loadJSON('registro'), loadJSON('iconos')]);
  if (!lib || !lib.length) {
    container.append(el('h2', {}, opts.titulo),
      el('p', {class: 'error'},
        `No se pudo cargar. Corré scripts/${opts.script} y scripts/build_web.py.`));
    return;
  }
  const idDe = {};
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;

  // País por club: el código más frecuente entre sus partidos (pl/pv). Los argentinos suelen venir 'Arg'.
  const paisCount = new Map();
  for (const m of lib) {
    for (const [n, p] of [[m.l, m.pl], [m.v, m.pv]]) {
      if (!p) continue;
      if (!paisCount.has(n)) paisCount.set(n, {});
      const c = paisCount.get(n);
      c[p] = (c[p] || 0) + 1;
    }
  }
  const paisDe = {};
  for (const [n, c] of paisCount) paisDe[n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
  const paisEsDe = (n) => PAIS_ES[paisDe[n]] || '';
  // código de país de un club (Arg si no tiene código pero enlaza a ficha argentina) — para el filtro.
  const paisCod = (n) => paisDe[n] || (idDe[n] ? 'Arg' : '');

  const esc = (n) => (escudos && escudos[n])
    ? el('img', {class: 'escudo', src: `images/${escudos[n]}`, alt: '', loading: 'lazy'}) : null;

  // Nombre del club: base + país entre paréntesis en gris. Si el nombre ya termina en '(País)' (extranjeros),
  // se le quita para no duplicarlo. Se conservan los sufijos de ciudad (p.ej. 'Talleres (Córdoba)').
  function celdaEq(nombre, reves = false) {
    // País: el más frecuente en sus partidos; si no tiene código pero enlaza a una ficha argentina
    // (idDe -> registro argentino), es un club argentino sin país taggeado en la fuente -> Argentina.
    let pais = paisEsDe(nombre);
    if (!pais && idDe[nombre]) pais = 'Argentina';
    let base = nombre;
    if (pais && base.endsWith(` (${pais})`)) base = base.slice(0, -(pais.length + 3));
    const nom = el('span', {class: 'eq-nombre'}, base,
      pais ? el('span', {class: 'lib-pais'}, ` (${pais})`) : '');
    const e = esc(nombre);
    const partes = (reves ? [nom, e] : [e, nom]).filter(Boolean);
    const cuerpo = el('span', {class: 'eq-cell'}, ...partes);
    const id = idDe[nombre];
    return id ? el('a', {href: clubHref(id)}, cuerpo) : cuerpo;
  }

  // --- récords all-time por club (para Palmarés y Tabla histórica) ---
  // Las ediciones marcadas 'no_of' (no oficiales, ej. Campeonato Sudamericano de Campeones 1948) se
  // MUESTRAN como edición aparte pero NO suman al palmarés ni al histórico.
  const noOfEds = new Set(lib.filter((m) => m.no_of).map((m) => m.e));
  const rec = new Map();  // club -> {J,G,E,P,GF,GC,tit,anios[],eds:Set}
  const get = (n) => {
    if (!rec.has(n)) rec.set(n, {J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0, tit: 0, anios: [], eds: new Set()});
    return rec.get(n);
  };
  for (const m of lib) {
    if (m.no_of) continue;   // no oficial: fuera del histórico
    const a = get(m.l), b = get(m.v);
    a.J++;
    b.J++;
    a.eds.add(m.e);
    b.eds.add(m.e);
    a.GF += m.gl;
    a.GC += m.gv;
    b.GF += m.gv;
    b.GC += m.gl;
    const s = signo(m);
    if (s > 0) {
      a.G++;
      b.P++;
    } else if (s < 0) {
      a.P++;
      b.G++;
    } else {
      a.E++;
      b.E++;
    }
  }
  if (camp) for (const [ed, cl] of Object.entries(camp)) {
    if (noOfEds.has(ed)) continue;   // título no oficial: no cuenta en el palmarés
    const r = get(cl);
    r.tit++;
    r.anios.push(ed);
  }

  const balClase = (r) => (r.G > r.P ? 'bal-g' : r.P > r.G ? 'bal-p' : 'bal-e');
  const efect = (r) => (r.J ? ((r.G * 3 + r.E) / (r.J * 3) * 100) : 0);
  const gp = (r) => (r.G - r.P > 0 ? '+' : '') + (r.G - r.P);

  const cont = el('div', {class: 'tabla-wrap'});
  const modos = ['Palmarés', 'Tabla histórica', 'Por edición'];

  // enlace a una edición: cambia al modo "Por edición" y la selecciona
  function irAEdicion(ed) {
    edActual = ed;
    activar('Por edición');
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  // ---- Palmarés: campeones por club (títulos + años enlazables). Desempate: alfabético. ----
  function verPalmares() {
    cont.replaceChildren();
    const clubes = [...rec.entries()].filter(([, r]) => r.tit > 0)
      .sort((a, b) => b[1].tit - a[1].tit || a[0].localeCompare(b[0]));
    const tb = el('table', {class: 'tabla-lib'});
    tb.append(el('tr', {}, el('th', {class: 'pos'}, 'Pos'), el('th', {}, 'Club'), el('th', {}, 'Part.'),
      el('th', {}, 'Títulos'), el('th', {}, 'Años')));
    clubes.forEach(([n, r], i) => {
      const anios = r.anios.slice().sort();
      const links = [];
      anios.forEach((ed, k) => {
        if (k) links.push(', ');
        const a = el('a', {href: '#', class: 'lib-ed-link'}, ed);
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          irAEdicion(ed);
        });
        links.push(a);
      });
      tb.append(el('tr', {},
        el('td', {class: 'pos'}, String(i + 1)),
        el('td', {}, celdaEq(n)),
        el('td', {}, String(r.eds.size)),
        el('td', {class: 'titulos'}, String(r.tit)),
        el('td', {class: 'lib-anios'}, ...links)));
    });
    cont.append(el('p', {class: 'sub'}, `${clubes.length} clubes campeones (${opts.rango}).`), tb);
  }

  // ---- Tabla histórica: récords all-time, ORDENABLE tocando cada columna ----
  // [clave, etiqueta, numérica] — el orden acá define el orden de columnas (tras '#').
  const HCOLS = [['n', 'Club', false], ['part', 'Part.', true], ['J', 'PJ', true], ['G', 'PG', true],
    ['E', 'PE', true], ['P', 'PP', true], ['GP', 'G-P', true], ['GF', 'GF', true], ['GC', 'GC', true],
    ['DIF', 'Dif', true], ['Pts', 'Pts', true], ['ef', 'Efect.', true], ['tit', 'Tít.', true]];
  let hSort = {key: 'Pts', dir: -1};
  let hPais = '';   // #1: filtro por país en la tabla histórica ('' = todos)

  function verHistorica() {
    cont.replaceChildren();
    const base = [...rec.entries()].map(([n, r]) => ({
      n, ...r, part: r.eds.size, DIF: r.GF - r.GC, GP: r.G - r.P, Pts: r.G * 3 + r.E, ef: efect(r),
    }));
    // #1: selector de país (los presentes entre los clubes, por nombre en español).
    const paises = [...new Set(base.map((f) => paisCod(f.n)).filter(Boolean))]
      .sort((a, b) => (PAIS_ES[a] || a).localeCompare(PAIS_ES[b] || b));
    const selPais = el('select', {class: 'filtro'},
      el('option', {value: ''}, 'Todos los países'),
      ...paises.map((cc) => el('option', {value: cc}, PAIS_ES[cc] || cc)));
    selPais.value = hPais;
    const sub = el('p', {class: 'sub'});
    cont.append(el('div', {class: 'filtros'}, el('label', {}, 'País ', selPais)), sub);
    const tb = el('table', {class: 'tabla-lib col-unif'});   // col-unif: ancho de Equipo unificado con las demás históricas
    cont.append(tb);
    selPais.addEventListener('change', () => {
      hPais = selPais.value;
      pinta();
    });

    function pinta() {
      const vis = hPais ? base.filter((f) => paisCod(f.n) === hPais) : base;
      sub.textContent = `${vis.length} clubes · Pts = 3×PG + PE · Efect. = Pts / (3×PJ) (histórico, referencial).`;
      const filas = vis.slice().sort((a, b) => {
        const x = a[hSort.key], y = b[hSort.key];
        const c = hSort.key === 'n' ? String(x).localeCompare(String(y)) : (x - y) || (b.Pts - a.Pts);
        return c * hSort.dir;
      });
      const th0 = el('th', {class: 'pos'}, 'Pos');
      const ths = HCOLS.map(([k, l, num]) => {
        const flecha = k === hSort.key ? (hSort.dir < 0 ? ' ▼' : ' ▲') : '';
        const th = el('th', {class: 'sortable' + (k === hSort.key ? ' sorted' : '')}, l + flecha);
        th.addEventListener('click', () => {
          hSort = {key: k, dir: hSort.key === k ? -hSort.dir : (num ? -1 : 1)};
          pinta();
        });
        return th;
      });
      const cuerpo = filas.map((f, i) => el('tr', {class: balClase(f)},
        el('td', {class: 'pos'}, String(i + 1)), el('td', {}, celdaEq(f.n)),
        el('td', {}, String(f.part)),
        el('td', {}, String(f.J)), el('td', {}, String(f.G)), el('td', {}, String(f.E)),
        el('td', {}, String(f.P)), el('td', {class: 'dif-gp'}, gp(f)),
        el('td', {}, String(f.GF)), el('td', {}, String(f.GC)),
        el('td', {}, (f.DIF > 0 ? '+' : '') + f.DIF), el('td', {class: 'titulos'}, String(f.Pts)),
        el('td', {}, f.ef.toFixed(1) + '%'), el('td', {}, f.tit || '')));
      // Fila TOTAL: suma PJ/PG/PE/PP/GF/GC; G-P y Dif se RECALCULAN. #/Part./Pts/Efect./Tít. no se suman.
      let totalTr = null;
      if (filas.length >= 2) {
        const SUM = ['J', 'G', 'E', 'P', 'GF', 'GC'];
        const tot = {};
        for (const k of SUM) tot[k] = filas.reduce((s, f) => s + (f[k] || 0), 0);
        const sg = (n) => (n > 0 ? '+' : '') + n;
        totalTr = el('tr', {class: 'total'},
          el('td', {class: 'pos'}, ''), el('td', {}, 'Total'), el('td', {}, ''),
          el('td', {}, String(tot.J)), el('td', {}, String(tot.G)), el('td', {}, String(tot.E)),
          el('td', {}, String(tot.P)), el('td', {class: 'dif-gp'}, sg(tot.G - tot.P)),
          el('td', {}, String(tot.GF)), el('td', {}, String(tot.GC)),
          el('td', {}, sg(tot.GF - tot.GC)), el('td', {}, ''), el('td', {}, ''), el('td', {}, ''));
      }
      tb.replaceChildren(el('tr', {}, th0, ...ths), ...cuerpo, ...(totalTr ? [totalTr] : []));
    }

    pinta();
  }

  // tabla final de un grupo, calculada de sus partidos. Puntaje POR ÉPOCA: 2 pts por victoria hasta
  // 1994; 3 pts desde la edición 1995 (Libertadores). Sudamericana (2002+) siempre 3. La tabla
  // histórica all-time usa 3 uniforme aparte (referencial).
  function tablaGrupo(ms) {
    const ptsG = ms.length && +ms[0].e >= 1995 ? 3 : 2;
    const t = new Map();
    const g = (n) => {
      if (!t.has(n)) t.set(n, {n, J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0});
      return t.get(n);
    };
    for (const m of ms) {
      const a = g(m.l), b = g(m.v);
      a.J++;
      b.J++;
      a.GF += m.gl;
      a.GC += m.gv;
      b.GF += m.gv;
      b.GC += m.gl;
      const s = signo(m);
      if (s > 0) {
        a.G++;
        b.P++;
      } else if (s < 0) {
        a.P++;
        b.G++;
      } else {
        a.E++;
        b.E++;
      }
    }
    const filas = [...t.values()].map((r) => ({...r, Pts: r.G * ptsG + r.E, DIF: r.GF - r.GC}))
      .sort((a, b) => b.Pts - a.Pts || b.DIF - a.DIF || b.GF - a.GF);
    const tb = el('table', {class: 'tabla-lib tabla-grupo'});
    tb.append(el('tr', {}, ...['Pos', 'Club', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'Dif',
      ['Pts', `${ptsG} pts por victoria`]].map((h) => Array.isArray(h)
      ? el('th', {title: h[1]}, h[0]) : el('th', h === 'Pos' ? {class: 'pos'} : {}, h))));
    filas.forEach((f, i) => {
      tb.append(el('tr', {},
        el('td', {class: 'pos'}, String(i + 1)), el('td', {}, celdaEq(f.n)),
        el('td', {}, String(f.J)), el('td', {}, String(f.G)), el('td', {}, String(f.E)),
        el('td', {}, String(f.P)), el('td', {}, String(f.GF)), el('td', {}, String(f.GC)),
        el('td', {}, (f.DIF > 0 ? '+' : '') + f.DIF), el('td', {class: 'titulos'}, String(f.Pts))));
    });
    return tb;
  }

  // ---- Por edición: tabla de grupo (si aplica) + partidos por ronda + campeón ----
  const ediciones = [...new Set(lib.map((m) => m.e))].sort((a, b) => +b - +a);
  let edActual = ediciones[0];   // edición vigente (reemplaza al viejo selEd.value)

  // Celda derecha del desplegable de ediciones: escudo + nombre del campeón de esa edición
  // (o "en curso" si la edición está en juego y aún no hay campeón).
  const champCellEd = (ed) => {
    const c = camp && camp[ed];
    if (!c) return el('span', {class: 'dd-champ vacio'}, esEnCurso(opts.comp, ed) ? 'en curso' : '');
    return el('span', {class: 'dd-champ', title: 'Campeón: ' + c},
      ...[esc(c), el('span', {class: 'dd-camp-n'}, c)].filter(Boolean));
  };

  // Desplegable rico PERSISTENTE (mismo componente que la Tabla histórica). Al elegir un año se
  // re-renderiza SOLO el bloque de resultados (edResultados); el control no se recrea.
  // Nota: a diferencia del <select> nativo, este control no soporta navegación con ↑/↓ (solo click).
  const selectorEd = crearSelectorRico({
    placeholder: 'Edición',
    onElegir: (id) => {
      edActual = id;
      selectorEd.setSeleccion(id, esEnCurso(opts.comp, id) ? `${id} (en curso)` : id);
      renderEdicion(id);   // solo los resultados: el control queda montado
    },
  });
  selectorEd.poblar([{
    items: ediciones.map((e) => ({
      id: e,
      etq: esEnCurso(opts.comp, e) ? `${e} (en curso)` : e,
      title: e,
      derecha: champCellEd(e),
    })),
  }]);
  selectorEd.setSeleccion(edActual,
    esEnCurso(opts.comp, edActual) ? `${edActual} (en curso)` : edActual);

  // Chip "EN CURSO" PERSISTENTE, a la derecha del selector de Edición (se muestra solo si la edición
  // seleccionada está en juego). Se togglea en renderEdicion.
  const chipEd = chipEnCurso();
  chipEd.style.display = 'none';
  const edFiltros = el('div', {class: 'filtros'}, el('label', {}, 'Edición '), selectorEd.el, chipEd);
  const edResultados = el('div', {class: 'ed-resultados'});

  function renderEdicion(ed) {   // SOLO el contenido; no toca el selector (no pierde estado)
    edResultados.replaceChildren();
    const ms = lib.filter((m) => m.e === ed);
    const nomHist = opts.nombreHistorico ? opts.nombreHistorico(ed) : '';
    if (nomHist) edResultados.append(el('p', {class: 'copa-nombre-historico'}, `Disputada como «${nomHist}»`));
    // #14: resumen del torneo — campeón + partidos disputados + goles totales (y promedio g/p).
    const pj = ms.length;
    const goles = ms.reduce((s, m) => s + (m.gl || 0) + (m.gv || 0), 0);
    const resumen = el('div', {class: 'copa-resumen'});
    if (camp && camp[ed]) {
      const ico = iconos && iconos[opts.comp];
      const lbl = ico
        ? el('span', {}, el('img', {class: 'copa-icono', src: 'images/copas/' + ico, alt: ''}), ' Campeón: ')
        : el('span', {}, '🏆 Campeón: ');
      resumen.append(el('div', {class: 'podio'}, lbl, celdaEq(camp[ed])));
    }
    resumen.append(el('div', {class: 'copa-stats'},
      el('span', {}, el('b', {}, String(pj)), ' partidos'),
      el('span', {}, el('b', {}, String(goles)), ' goles'),
      el('span', {}, el('b', {}, pj ? (goles / pj).toFixed(2) : '0'), ' goles por partido')));
    chipEd.style.display = esEnCurso(opts.comp, ed) ? '' : 'none';  // chip junto al selector de Edición
    edResultados.append(resumen);
    const filaM = (m) => {
      const pen = m.pen ? el('span', {class: 'lib-anios'}, ` (pen ${m.pen})`) : '';
      // resultado OTORGADO (walkover / jugador inelegible): marcador de cancha + ⚖ con aclaración en tooltip.
      // Si NO hay adjudicación pero SÍ una nota (partido abandonado con resultado firme, etc.): marca ' *'.
      const marca = m.awd
        ? el('span', {class: 'lib-awd', title: m.nota || 'Resultado otorgado'}, ' ⚖')
        : m.nota ? el('span', {class: 'lib-awd', title: m.nota}, ' *') : '';
      const fch = fmtFecha(m.f);
      const fecEl = fch ? el('span', {class: 'copa-fecha'}, fch) : '';
      return el('tr', {},
        el('td', {class: 'eq-local'}, celdaEq(m.l, true)),
        el('td', {class: 'res'}, `${m.gl}-${m.gv}`, pen, marca, fecEl),
        el('td', {class: 'eq-visita'}, celdaEq(m.v)));
    };
    for (const {r, ms: ms2} of seccionesOrdenadas(ms)) {
      edResultados.append(el('h3', {class: 'fase-titulo'}, rondaEs(r)));
      if (esGrupo(r)) edResultados.append(tablaGrupo(ms2));   // tabla final antes del desglose
      const tb = el('table', {class: 'tabla-copa'});
      if (esGrupo(r)) {
        tb.append(el('tbody', {}, ...ms2.map(filaM)));   // grupos: sin separadores por serie
      } else {
        for (let i = 0; i < ms2.length;) {   // eliminación: cada serie (sus legs) en un <tbody>
          const tie = [ms2[i]];
          if (i + 1 < ms2.length && mismoPar(ms2[i], ms2[i + 1])) tie.push(ms2[++i]);
          i++;
          tb.append(el('tbody', {}, ...tie.map(filaM)));
        }
      }
      edResultados.append(tb);
    }
  }

  // Monta el modo (selector persistente + contenedor de resultados) y muestra la edición pedida. Se
  // llama al ENTRAR al modo o desde un enlace de edición; el cambio de año por el propio selector usa
  // renderEdicion (no re-monta -> el control y su panel no se recrean).
  function verEdicion(ed) {
    edActual = ed;
    selectorEd.setSeleccion(ed, esEnCurso(opts.comp, ed) ? `${ed} (en curso)` : ed);
    cont.replaceChildren(edFiltros, edResultados);
    renderEdicion(ed);
  }

  const barra = el('div', {class: 'lib-modos'});
  const botones = {};
  let modoActual = 'Tabla histórica';

  function activar(nombre) {
    modoActual = nombre;
    for (const [k, b] of Object.entries(botones)) b.classList.toggle('activo', k === nombre);
    if (nombre === 'Palmarés') verPalmares();
    else if (nombre === 'Tabla histórica') verHistorica();
    else verEdicion(edActual || ediciones[0]);
  }

  for (const m of modos) {
    const b = el('button', {class: 'modo-btn', type: 'button'}, m);
    b.addEventListener('click', () => activar(m));
    botones[m] = b;
    barra.append(b);
  }

  // #15: exportar a CSV lo que se está mostrando (palmarés / tabla histórica / la edición elegida).
  const nombreCSV = () => {
    const base = (opts.comp || 'copa').replace(/\s+/g, '_');
    if (modoActual === 'Por edición') return `${base}_${edActual || ''}`;
    return `${base}_${modoActual === 'Palmarés' ? 'palmares' : 'historica'}`;
  };
  barra.append(botonCSV(nombreCSV, () => {
    const tbs = [...cont.querySelectorAll('table')];
    if (!tbs.length) return null;
    return tbs.map((tb) => {
      let h = tb.previousElementSibling;
      while (h && !/^H[3-5]$/.test(h.tagName)) h = h.previousElementSibling;
      return [h ? h.textContent.trim() : '', tb];
    });
  }));

  container.classList.add('lib-vista');
  container.append(
    el('h2', {}, opts.titulo),
    el('p', {class: 'sub'}, 'Fuente: RSSSF. Los clubes argentinos enlazan a su ficha; el país va en gris.'),
    barra, cont);
  // #3: enlace directo a una edición (?e=YYYY, ej. desde el historial de un club) -> abre "Por edición".
  const edParam = params.e != null ? String(params.e) : null;
  if (edParam && ediciones.includes(edParam)) {
    edActual = edParam;
    activar('Por edición');
  } else {
    activar('Tabla histórica');
  }
}
