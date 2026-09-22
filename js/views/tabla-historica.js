// Vista: tabla histórica. Elegí un torneo (filtrable por era/texto) y muestra TODO el torneo
// de un vistazo: fase de grupos, fase eliminatoria (cruces), tabla acumulada colapsable y —
// aparte— liguillas/promoción. Los campeonatos de rueda única muestran una sola tabla ordenable.

import {botonCSV, chipEnCurso, clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';
import {renderCopaEdicion} from '../copas_fases.js';
import {crearSelectorRico} from '../dropdown.js';

const COLS = [
  ['pos', 'Pos'], ['equipo', 'Equipo'], ['J', 'J'], ['G', 'G'], ['E', 'E'],
  ['P', 'P'], ['GP', 'G-P'], ['GF', 'GF'], ['GC', 'GC'], ['DIF', 'DIF'], ['Pts', 'Pts'],
  ['ef', 'Efect.'],  // Efectividad = (3·G + E) / (3·J), como en Libertadores (reemplaza el viejo Promedio)
];

export async function render(container, params = {}) {
  const [torneos, posiciones, escudos, registro, campeones, definiciones, iconos, series, liguillas,
    partidos, fusiones, campeonesCopa] = await Promise.all([
    loadJSON('torneos'), loadJSON('posiciones'), loadJSON('escudos'), loadJSON('registro'),
    loadJSON('campeones_liga'), loadJSON('definiciones'), loadJSON('iconos'), loadJSON('series'),
    loadJSON('liguillas'), loadJSON('partidos'), loadJSON('fusiones'), loadJSON('campeones_copa'),
  ]);
  // #11: etiqueta "Campeón" con ícono de copa personalizado (por id de torneo o competencia) o 🏆.
  const campLbl = (clave) => (iconos && iconos[clave])
    ? el('span', {class: 'lbl'}, el('img', {class: 'copa-icono', src: 'images/copas/' + iconos[clave], alt: ''}),
      ' Campeón: ')
    : el('span', {class: 'lbl'}, '🏆 Campeón: ');
  const idDe = {};   // nombre -> id de club (para enlazar a su pagina)
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;
  const esc = (n) => (escudos && escudos[n]) ? el('img', {
    src: 'images/' + escudos[n],
    class: 'escudo',
    alt: ''
  }) : null;
  const equipoLink = (n, reves, cell) => {
    // reves=true -> nombre + escudo (para el LOCAL del cruce: el escudo queda junto al marcador).
    // cell=true envuelve en .eq-cell (mismo layout que Libertadores) para las llaves de eliminación.
    const cont = (reves ? [n, esc(n)] : [esc(n), n]).filter(Boolean);
    const inner = cell ? [el('span', {class: 'eq-cell'}, ...cont)] : cont;
    const cid = idDe[n];
    return cid ? el('a', {href: clubHref(cid)}, ...inner) : el('span', {}, ...inner);
  };
  let copasData = null, campCopa = null, copasGrupos = null;  // cache lazy (1ª copa elegida)
  let rondasData = null, rondasProm = null;  // cache lazy de rondas.json (~3MB, solo al ver una liga)
  const asegurarRondas = () => rondasProm ??= loadJSON('rondas').then(d => (rondasData = d || {}));

  const fmtFecha = (f) => {  // ISO 'YYYY-MM-DD' -> 'DD/MM/YYYY' ('' si es solo el año / vacío)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };

  if (!torneos || !posiciones) {
    container.append(el('h2', {}, 'Tabla histórica'),
      el('p', {class: 'error'}, 'No se pudieron cargar los datos. Corré scripts/build_web.py.'));
    return;
  }

  // Índices por id y por grupo (cada torneo trae grupo/seccion/fase/orden desde build_web).
  const porId = {};
  const porGrupo = {};
  for (const t of torneos) {
    porId[t.id] = t;
    (porGrupo[t.grupo || t.id] ??= []).push(t);
  }
  // Representantes = un torneo por grupo (el dueño, cuyo id == grupo). Es lo que va al desplegable.
  // Para las LIGAS mostramos SOLO las que están en la lista de campeones (las ligas reales); las
  // demás tablas de liga (fases, desempates, liguillas, mitades de temporada, etc.) NO son entradas
  // sueltas: quedan dentro de su torneo. Copas y totales no se filtran.
  const champSet = new Set(Object.keys(campeones || {}));
  // Ligas: solo las que tienen campeón (las reales) O las EN CURSO (Clausura 2026: aún sin campeón,
  // pero accesible como torneo en juego). Las demás fases/desempates quedan dentro de su torneo.
  const reps = Object.keys(porGrupo).map(g => porId[g]).filter(Boolean)
    .filter(t => t.naturaleza !== 'liga' || champSet.has(t.id) || t.en_curso);
  const nombreLimpio = (t) => (t.nombre || t.id)
    .replace(/\s*\(total\)\s*$/, '')
    .replace(/\b(Championship|Tournament)\b/g, '')  // artefactos en inglés del ODS
    .replace(/\s{2,}/g, ' ').trim();
  // Etiqueta de una fila del desplegable: 'año · nombre' (sin año en los totales) + '(en curso)'.
  const etqDe = (t) => (t.naturaleza === 'sumario' ? nombreLimpio(t) : `${t.anio ?? '—'} · ${nombreLimpio(t)}`)
    + (t.en_curso ? ' (en curso)' : '');

  const natSel = el('select', {class: 'filtro'},
    el('option', {value: ''}, 'Toda naturaleza'),
    el('option', {value: 'liga'}, 'Ligas y temporadas'),
    el('option', {value: 'copa'}, 'Copas'),
    el('option', {value: 'sumario'}, 'Totales históricos'));
  const eraSel = el('select', {class: 'filtro'},
    el('option', {value: ''}, 'Toda era'),
    el('option', {value: 'amateur'}, 'Amateur (1891–1934)'),
    el('option', {value: 'profesional'}, 'Profesional (1931–)'));
  const buscador = el('input', {type: 'search', placeholder: 'Buscar torneo…', class: 'filtro'});
  // Liguilla Pre-Libertadores y Promoción son liga (equipos de primera) pero se muestran en
  // secciones APARTE; este check las oculta/muestra.
  const optChk = el('input', {type: 'checkbox', id: 'incluir-opt', checked: 'checked'});
  const optLbl = el('label', {class: 'filtro chk', for: 'incluir-opt'},
    optChk, ' mostrar clasificatorios y promoción');

  // Barra de filtros (se puebla al final). Se declara acá para pasarla como `limite` al selector
  // rico: así el panel no se cierra al clickear un filtro y sí al clickear afuera (mismo criterio
  // que en el resto de la app). El desplegable es el componente reutilizable de dropdown.js.
  const controles = el('div', {class: 'controles'});
  // Desplegable de torneos PERSONALIZADO (dropdown.js): botón con la selección actual + panel
  // plegable agrupado (Ligas/Copas/Totales); cada fila lleva a la DERECHA el escudo y el nombre
  // del campeón de ese certamen. onElegir delega en mostrarGrupo (declarada más abajo, hoisted).
  const selectorRico = crearSelectorRico({
    placeholder: 'Elegí un torneo',
    onElegir: (id) => mostrarGrupo(id),
    limite: controles,
  });

  // Campeón del certamen: liga -> por id de torneo (campeones_liga); copa -> por 'comp|edicion' (campeones_copa).
  const campeonDe = (t) => t.naturaleza === 'liga' ? (campeones && campeones[t.id])
    : t.naturaleza === 'copa' ? (campeonesCopa && campeonesCopa[`${t.comp}|${t.edicion}`]) : null;
  const champCell = (t) => {
    const c = campeonDe(t);
    if (!c || !c.campeon) return el('span', {class: 'dd-champ vacio'}, t.en_curso ? 'en curso' : '');
    return el('span', {class: 'dd-champ', title: 'Campeón: ' + c.campeon},
      ...[esc(c.campeon), el('span', {class: 'dd-camp-n'}, c.campeon)].filter(Boolean));
  };
  const tabla = el('div', {class: 'tabla-wrap'});

  const estado = {sortKey: 'Pts', sortDir: -1, actual: null, periodo: null};  // orden por defecto: Puntos (desc)

  // #20: rango de años disponible en los partidos de LIGA (era amateur/profesional; las copas no cuentan
  // en la tabla histórica). Se usa para los presets "últimos N años" y para acotar el rango.
  const ANIO_MAX = (partidos || []).reduce((mx, p) =>
    (p.era !== 'copa' ? Math.max(mx, +String(p.f).slice(0, 4) || 0) : mx), 0) || new Date().getFullYear();
  const ANIO_MIN = 1891;

  // Agrega los partidos de LIGA (no copas) por club en el rango [desde, hasta] -> filas {equipo,J,G,E,P,GF,GC}.
  // Aplica fusiones (denominaciones que confluyen en un club actual). Números 'calc' de los partidos reales.
  function aggPeriodo(desde, hasta) {
    const acc = new Map();
    const dest = (n) => (fusiones && fusiones[n]) || n;
    const get = (n) => {
      if (!acc.has(n)) acc.set(n, {equipo: n, J: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0});
      return acc.get(n);
    };
    for (const p of partidos || []) {
      if (p.era === 'copa' || p.gl == null || p.gv == null) continue;
      const y = +String(p.f).slice(0, 4);
      if (!y || y < desde || y > hasta) continue;
      const a = get(dest(p.l)), b = get(dest(p.v));
      a.J++;
      b.J++;
      a.GF += p.gl;
      a.GC += p.gv;
      b.GF += p.gv;
      b.GC += p.gl;
      if (p.gl > p.gv) {
        a.G++;
        b.P++;
      } else if (p.gl < p.gv) {
        a.P++;
        b.G++;
      } else {
        a.E++;
        b.E++;
      }
    }
    return [...acc.values()];
  }

  function repsFiltrados() {
    const q = buscador.value.trim().toLowerCase();
    const nat = natSel.value, era = eraSel.value;
    return reps
      .filter(t => !nat || t.naturaleza === nat)
      .filter(t => !era || t.era === era)
      .filter(t => !q || nombreLimpio(t).toLowerCase().includes(q))
      // Año (de cierre) desc; dentro del año, por FECHA REAL del 1er partido desc (f0 de build_web): así la
      // Clausura -jugada después- queda antes que la Apertura sin depender del nombre, y capta el cambio de
      // calendario entre épocas. Luego más equipos y nombre.
      .sort((a, b) => (b.anio || 0) - (a.anio || 0)
        || String(b.f0 || '').localeCompare(String(a.f0 || ''))
        || (b.n_equipos || 0) - (a.n_equipos || 0) || nombreLimpio(a).localeCompare(nombreLimpio(b)));
  }

  const GRUPOS = [
    ['liga', 'Ligas y temporadas'],
    ['copa', 'Copas'],
    ['sumario', 'Totales históricos'],
  ];

  // Orden NATURAL de los totales: primero el total histórico (all-time), luego el bloque amateur
  // (decenios cronológicos + su total) y después el profesional (decenios + su total).
  const TOTAL_ALLTIME = 'TOTAL_1891_2025';
  // PUNTOS: las ligas y los totales de DECENIOS usan el Pts otorgado por el ODS (2-1-0 hasta antes
  // del Apertura 1995, 3-1-0 después, y el especial 1988-89: 3 G / 2 empate ganado en penales / 1
  // empate perdido / 0 P — no derivable de G/E). SOLO los totales históricos GENERALES se recalculan
  // in situ a 3-1-0 para una comparación uniforme entre épocas.
  const TOTALES_GENERALES = new Set([
    'TOTAL_1891_2025', 'TOTAL_AMAT_1891_1934', 'TOTAL_PROF_1931_2025']);

  function ordenTotal(t) {
    if (t.id === TOTAL_ALLTIME) return [0, 0];                 // Total 1891-2026 -> arriba
    if (t.id === 'TOTAL_AMAT_1891_1934') return [1, 9999];     // total amateur al final del bloque amateur
    if (t.id === 'TOTAL_PROF_1931_2025') return [2, 9999];     // total profesional al final del bloque prof
    const m = t.id.match(/^TOTAL_(\d{4})_\d{4}$/);
    if (m) {
      const ini = +m[1];
      const amateur = ini <= 1930 || t.id === 'TOTAL_1931_1934';  // 1931-1934 = cola AAmF (amateur)
      return [amateur ? 1 : 2, ini];
    }
    return [3, t.anio || 0];
  }

  function refrescarSelect() {
    const items = repsFiltrados();
    const grupos = [];
    for (const [nat, label] of GRUPOS) {
      let g = items.filter(t => t.naturaleza === nat);
      if (!g.length) continue;
      // Totales: orden natural (total histórico arriba). Ligas/copas ya vienen cronológicas de repsFiltrados.
      if (nat === 'sumario') {
        g = g.slice().sort((a, b) => {
          const ka = ordenTotal(a), kb = ordenTotal(b);
          return ka[0] - kb[0] || ka[1] - kb[1];
        });
      }
      grupos.push({
        titulo: label,
        items: g.map(t => ({
          id: t.id,
          etq: etqDe(t),
          title: etqDe(t),
          // Los totales no tienen campeón -> celda vacía; ligas/copas -> escudo + nombre.
          derecha: nat === 'sumario' ? null : champCell(t),
        })),
      });
    }
    selectorRico.poblar(grupos);   // poblar() ya re-marca activo el id vigente internamente

    // Mantener la selección vigente si sigue en la lista filtrada.
    if (estado.actual && items.some(t => t.id === estado.actual)) return;

    // Si no, abrir en el total histórico (all-time) o —si está filtrado— en la primera liga/copa disponible.
    const inicial = items.find(t => t.id === TOTAL_ALLTIME)
      || items.find(t => t.naturaleza !== 'sumario') || items[0];
    if (inicial) mostrarGrupo(inicial.id);
    else {
      estado.actual = null;
      selectorRico.setSeleccion(null, 'Sin resultados');
      tabla.replaceChildren(el('p', {class: 'placeholder'}, 'Sin resultados.'));
    }
  }

  function mostrarGrupo(gid) {
    estado.actual = gid;
    estado.periodo = null;   // elegir un torneo sale del modo "período" (#20)
    const rep = porId[gid];
    selectorRico.setSeleccion(gid, rep ? etqDe(rep) : gid);  // botón + fila activa
    estado.sortKey = 'Pts';   // orden por defecto: Puntos (desc)
    estado.sortDir = -1;
    dibujar();
  }

  // Posición oficial = Puntos, luego Diferencia de gol, luego Goles a favor (desc).
  const N = (v) => (v == null ? -1e9 : v);

  function conPosicion(origen, general) {
    const filas = origen.map(f => ({
      ...f, DIF: f.DIF ?? ((f.GF ?? 0) - (f.GC ?? 0)),
      GP: (f.G != null && f.P != null) ? f.G - f.P : null,
      // Pts: guardado (puntaje otorgado por época) salvo en los totales GENERALES -> 3-1-0 in situ.
      Pts: (general && f.G != null && f.E != null) ? f.G * 3 + f.E : f.Pts,
      // Efectividad: referencial 3-1-0 (era-agnóstica), independiente del sistema de puntos.
      ef: (f.J) ? ((f.G ?? 0) * 3 + (f.E ?? 0)) / (f.J * 3) * 100 : null,
    }));
    [...filas]
      .sort((a, b) => N(b.Pts) - N(a.Pts) || N(b.DIF) - N(a.DIF) || N(b.GF) - N(a.GF))
      .forEach((f, i) => {
        f.pos = f.rank = i + 1;  // rank = posición oficial (base para ordenar por "Pos")
      });
    return filas;
  }

  // Devuelve el <table> de posiciones de un torneo. Solo la tabla principal es ordenable por
  // columna (usa estado.sortKey/Dir y re-dibuja); las demás van en orden oficial.
  function tablaEl(id, sortable) {
    return tablaDesde(posiciones[id] || [], TOTALES_GENERALES.has(id), sortable);
  }

  // Render de una tabla de posiciones desde un array de filas (id o cálculo en vivo del período).
  function tablaDesde(origen, general, sortable) {
    const filas = conPosicion(origen, general);
    const cols = COLS;  // Efectividad ya está en COLS (reemplazó a Promedio)
    if (sortable) {
      const {sortKey, sortDir} = estado;
      filas.sort((a, b) => {
        const x = sortKey === 'pos' ? a.rank : a[sortKey];
        const y = sortKey === 'pos' ? b.rank : b[sortKey];
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir;
      });
      // "Pos" NUNCA es fija: renumera 1..N según el ordenamiento mostrado.
      filas.forEach((f, i) => (f.pos = i + 1));
    }
    const colClase = (k) => k === 'equipo' ? 'txt'
      : k === 'pos' ? 'num pos' : k === 'Pts' ? 'num pts' : 'num';
    const thead = el('tr', {}, ...cols.map(([k, label]) => el('th', {
      class: (sortable && k === estado.sortKey ? 'sorted ' : '') + colClase(k),
      ...(sortable ? {
        onclick: () => {
          estado.sortDir = estado.sortKey === k ? -estado.sortDir : (k === 'equipo' ? 1 : -1);
          estado.sortKey = k;
          dibujar();
        }
      } : {}),
    }, label + (sortable && k === estado.sortKey ? (estado.sortDir === 1 ? ' ▲' : ' ▼') : ''))));

    const cuerpo = filas.map(f => {
      // Coloreo por balance (verde gana / rojo pierde / amarillo igualado), como los historiales de club.
      const bal = (f.G != null && f.P != null)
        ? (f.G > f.P ? 'bal-g' : f.P > f.G ? 'bal-p' : 'bal-e') : '';
      return el('tr', {class: bal}, ...cols.map(([k]) => {
        if (k === 'equipo') {
          const val = f.equipo == null ? '' : String(f.equipo);
          const cid = idDe[val];
          const cont = [esc(val), val].filter(Boolean);
          return el('td', {class: 'txt'}, cid ? el('a', {href: clubHref(cid)}, cont) : cont);
        }
        if (k === 'GP') {
          return f.GP == null ? el('td', {class: 'num'}, '')
            : el('td', {class: 'num dif-gp'}, (f.GP > 0 ? '+' : '') + f.GP);
        }
        if (k === 'ef') return el('td', {class: 'num'}, f.ef == null ? '' : f.ef.toFixed(1) + '%');
        return el('td', {class: colClase(k)}, f[k] == null ? '' : String(f[k]));
      }));
    });
    // Fila TOTAL (tfoot): suma las columnas acumulables (J/G/E/P/GF/GC); G-P y DIF se RECALCULAN de las
    // sumas. Pos/Pts/Efect. NO se suman (posición y puntaje/ratio no tienen total). Solo si hay ≥2 filas.
    let tfoot = null;
    if (filas.length >= 2) {
      const SUM = ['J', 'G', 'E', 'P', 'GF', 'GC'];
      const tot = {};
      for (const k of SUM) {
        const vals = filas.map(f => f[k]).filter(v => v != null);
        tot[k] = vals.length ? vals.reduce((s, v) => s + Number(v), 0) : null;
      }
      tot.GP = (tot.G != null && tot.P != null) ? tot.G - tot.P : null;
      tot.DIF = (tot.GF != null && tot.GC != null) ? tot.GF - tot.GC : null;
      const signo = (n) => (n > 0 ? '+' : '') + n;
      const totalTr = el('tr', {class: 'total'}, ...cols.map(([k]) => {
        if (k === 'equipo') return el('td', {class: 'txt'}, 'Total');
        if (k === 'GP') return el('td', {class: 'num dif-gp'}, tot.GP == null ? '' : signo(tot.GP));
        if (k === 'DIF') return el('td', {class: 'num'}, tot.DIF == null ? '' : signo(tot.DIF));
        if (SUM.includes(k)) return el('td', {class: 'num'}, tot[k] == null ? '' : String(tot[k]));
        return el('td', {class: colClase(k)}, '');   // pos / Pts / Efect. -> sin total (pos conserva ancho)
      }));
      tfoot = el('tfoot', {}, totalTr);
    }
    // 'col-unif' (ancho unificado de la columna Equipo) solo en la tabla principal/período (sortable),
    // NO en las de grupo/acumulada -> esas alinean por su cuenta (.grupos-grid, layout fijo).
    return el('table', {class: 'posiciones stats' + (sortable ? ' col-unif' : '')},
      el('thead', {}, thead), el('tbody', {}, ...cuerpo), ...(tfoot ? [tfoot] : []));
  }

  // Filas de cruce de una ronda eliminatoria: cada torneo es una mini-tabla de 2 equipos con el
  // agregado. Ganador = más G, luego más GF; en la Final se resalta con 🏆 (usa el campeón si hace
  // falta desempatar por penales, donde G/GF empatan).
  // Llaves de eliminación con el MISMO estilo que Libertadores (tabla-copa): local nombre+escudo a la
  // derecha, agregado al centro, visitante escudo+nombre; el ganador va en negrita (.gana).
  function crucesEl(ids, esFinal, campeon) {
    const tb = el('table', {class: 'tabla-copa'});
    for (const id of ids) {
      // Serie multi-partido con legs verificados (build_web): en eliminación NO se agrega, se
      // muestra CADA partido (mismo criterio que las copas). Si no hay legs, cae al agregado.
      const legs = series && series[id];
      if (legs && legs.length) {
        tb.append(el('tbody', {}, ...legs.map(m => {
          const g = N(m.gl) - N(m.gv), fch = fmtFecha(m.f);
          return el('tr', {},
            el('td', {class: 'eq-local' + (g > 0 ? ' gana' : '')}, equipoLink(m.l, true, true)),
            el('td', {class: 'res'}, `${m.gl}-${m.gv}`, fch ? el('span', {class: 'copa-fecha'}, fch) : ''),
            el('td', {class: 'eq-visita' + (g < 0 ? ' gana' : '')}, equipoLink(m.v, false, true)));
        })));
        continue;
      }
      const r = posiciones[id] || [];
      if (r.length < 2) continue;
      const [a, b] = r;
      let aGana = (N(a.G) - N(b.G)) || (N(a.GF) - N(b.GF)) || (N(b.GC) - N(a.GC));
      // definición del cruce (llave empatada): tanda de penales o el que avanzó (build_web).
      const def = definiciones && definiciones[id];
      let pen = '';
      if (def) {
        aGana = (a.equipo === def.ganador) ? 1 : (b.equipo === def.ganador ? -1 : aGana);
        pen = def.pen;
      } else if (esFinal && campeon) {
        aGana = (a.equipo === campeon) ? 1 : (b.equipo === campeon ? -1 : aGana);
      }
      const penEl = pen ? el('span', {class: 'lib-anios'}, ` (pen ${pen})`) : '';
      tb.append(el('tbody', {}, el('tr', {},   // cada serie en su <tbody> (divisor marcado entre cruces)
        el('td', {class: 'eq-local' + (aGana > 0 ? ' gana' : '')}, equipoLink(a.equipo, true, true)),
        el('td', {class: 'res'}, `${a.GF ?? ''}-${a.GC ?? ''}`, penEl),
        el('td', {class: 'eq-visita' + (aGana < 0 ? ' gana' : '')}, equipoLink(b.equipo, false, true)))));
    }
    return tb;
  }

  // Fila de un partido dentro de una fecha: local · marcador · visitante (ganador en negrita), fecha
  // del día a la derecha del marcador. Mismo estilo que las llaves (tabla-copa).
  function filaPartidoRonda(m) {
    const aGana = m.r === 'L' ? 1 : m.r === 'V' ? -1 : 0;
    const fch = fmtFecha(m.f);
    // m.ot = partido inyectado display-only (otorgados_rondas.csv): marca + tooltip. Si la nota no habla de
    // adjudicación/abandono (ej. "jugado 2 veces"), muestra "ver nota" en vez de "otorgado".
    const otNota = typeof m.ot === 'string' ? m.ot : '';
    const otAdj = !otNota || /otorg|abandon|adjud|awd/i.test(otNota);
    const ot = m.ot ? el('span', {class: 'copa-fecha', title: otNota}, otAdj ? 'otorgado' : 'ver nota') : '';
    return el('tr', {},
      el('td', {class: 'eq-local' + (aGana > 0 ? ' gana' : '')}, equipoLink(m.l, true, true)),
      el('td', {class: 'res'}, `${m.gl ?? ''}-${m.gv ?? ''}`,
        fch ? el('span', {class: 'copa-fecha'}, fch) : '', ot),
      el('td', {class: 'eq-visita' + (aGana < 0 ? ' gana' : '')}, equipoLink(m.v, false, true)));
  }

  // Liguilla (Pre-Libertadores/Pre-Sudamericana) como LLAVE: cruces agrupados por fase (Semifinales →
  // Final ida/vuelta), mismo estilo que las copas. Cada partido: local · marcador · visitante, ganador
  // en negrita, fecha del día a la derecha del marcador.
  function liguillaEl(matches) {
    const out = [];
    let curFase = null, tb = null;
    for (const m of matches) {
      if (m.fase !== curFase) {
        curFase = m.fase;
        out.push(el('h5', {class: 'liguilla-fase'}, m.fase));
        tb = el('table', {class: 'tabla-copa'});
        out.push(tb);
      }
      const aGana = m.res === 'L' ? 1 : m.res === 'V' ? -1 : 0;
      const fch = fmtFecha(m.f);
      tb.append(el('tbody', {}, el('tr', {},
        el('td', {class: 'eq-local' + (aGana > 0 ? ' gana' : '')}, equipoLink(m.l, true, true)),
        el('td', {class: 'res'}, `${m.gl ?? ''}-${m.gv ?? ''}`, fch ? el('span', {class: 'copa-fecha'}, fch) : ''),
        el('td', {class: 'eq-visita' + (aGana < 0 ? ' gana' : '')}, equipoLink(m.v, false, true)))));
    }
    return out;
  }

  // Sección "Fechas": una lista de <details> (colapsados) por jornada (prof) o por día (amateur);
  // cada uno expande los partidos de esa fecha. Vacía si el torneo no tiene rondas asociadas.
  function seccionRondas(gid) {
    const rs = rondasData && rondasData[gid];
    if (!rs || !rs.length) return [];
    const out = [el('h3', {class: 'fase-titulo'}, 'Fechas')];
    for (const r of rs) {
      const tb = el('table', {class: 'tabla-copa'},
        el('tbody', {}, ...r.partidos.map(filaPartidoRonda)));
      out.push(el('details', {class: 'plegable ronda'},
        el('summary', {}, r.etq, el('span', {class: 'sub'}, ` · ${r.n} partido${r.n !== 1 ? 's' : ''}`)),
        tb));
    }
    return out;
  }

  function bloqueTabla(fase, id) {
    return el('div', {class: 'fase-bloque'},
      ...[fase ? el('h4', {}, fase) : null, tablaEl(id, false)].filter(Boolean));
  }

  // Copa elegida: se muestra con fases desglosadas (mismo módulo que la vista Copas), cargando
  // copas.json/campeones_copa la primera vez.
  function dibujarCopa(rep) {
    const pintar = () => {
      if (estado.actual !== rep.id) return;
      const ms = (copasData || []).filter(m => m.c === rep.comp && m.e === rep.edicion);
      const cc = campCopa && campCopa[`${rep.comp}|${rep.edicion}`];
      tabla.replaceChildren(...renderCopaEdicion(ms, {
        escudos, idDe, campeon: cc && cc.campeon, sub: cc && cc.sub,
        grupos: copasGrupos && copasGrupos[`${rep.comp}|${rep.edicion}`],
        icono: iconos && iconos[rep.comp],   // #11: ícono por competencia
      }));
    };
    if (copasData) return pintar();
    tabla.replaceChildren(el('p', {class: 'placeholder'}, 'Cargando…'));
    Promise.all([loadJSON('copas'), loadJSON('campeones_copa'), loadJSON('copas_grupos')])
      .then(([c, cc, cg]) => {
        copasData = c || [];
        campCopa = cc || {};
        copasGrupos = cg || {};
        pintar();
      });
  }

  // #20: tabla histórica calculada en vivo para un rango de años (presets últimos 25/50/75 o rango libre).
  function dibujarPeriodo() {
    const {desde, hasta} = estado.periodo;
    const filas = aggPeriodo(desde, hasta);
    tabla.replaceChildren(
      el('p', {class: 'periodo-nota'},
        `Total histórico ${desde}–${hasta} (${filas.length} clubes) · calculado de los partidos de liga · `
        + 'Pts = 3×PG + PE (referencial). Los números pueden diferir levemente de los totales oficiales del ODS.'),
      tablaDesde(filas, true, true));
  }

  function dibujar() {
    if (estado.periodo) return dibujarPeriodo();
    const gid = estado.actual;
    const rep = porId[gid];
    if (rep && rep.naturaleza === 'copa') return dibujarCopa(rep);
    const miembros = (porGrupo[gid] || []).slice()
      .sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id.localeCompare(b.id));
    const sec = {};
    for (const m of miembros) (sec[m.seccion] ??= []).push(m);
    const kids = [];

    // Torneo EN CURSO (ej. Clausura 2026): sin campeón todavía; badge + fecha de corte (última jugada).
    if (rep && rep.en_curso) {
      kids.push(chipEnCurso(rep.corte ? `actualizado a la Fecha ${rep.corte}` : ''));
    }

    // Podio (🏆 Campeón/Subcampeón) — la clave coincide con el id del torneo-grupo (item 43).
    const camp = campeones && campeones[gid];
    if (camp && camp.campeon) {
      const podio = [el('span', {class: 'campeon'}, campLbl(gid), equipoLink(camp.campeon))];
      if (camp.sub) podio.push(el('span', {class: 'subcampeon'},
        el('span', {class: 'lbl'}, 'Subcampeón: '), equipoLink(camp.sub)));
      kids.push(el('div', {class: 'podio'}, ...podio));
    }

    // 1) Tabla principal (rueda única / la tabla del campeonato), ordenable.
    for (const t of sec.principal || []) kids.push(tablaEl(t.id, true));

    // 2) Fase de grupos / zonas.
    if (sec.grupos?.length) {
      kids.push(el('h3', {class: 'fase-titulo'}, 'Fase de grupos'));
      // por 'orden' primero (Nacional 1985: Step_1 grupos A-H = orden 10, arriba; llaves Step_2.. debajo),
      // luego alfabético por etiqueta de fase (Zona A antes que Zona B; el desempate cae tras su grupo).
      const gs = sec.grupos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.fase.localeCompare(b.fase));
      kids.push(el('div', {class: 'grupos-grid'},
        ...gs.map(t => el('div', {class: 'grupo-bloque'},
          el('h4', {}, t.fase),
          // grupos de 2 equipos (llaves de eliminación, ej. Nacional 1985 Steps 2-8) -> CRUCE con partidos
          // desagregados (series.json) en vez de mini-tabla; los grupos reales (≥3, zonas A-H) van como tabla.
          (posiciones[t.id] || []).length === 2 ? crucesEl([t.id], false, null) : tablaEl(t.id, false)))));
    }

    // 3) Tabla acumulada (suma de las fases regulares), colapsable. Va ANTES de las Fechas para que
    // todas las TABLAS queden arriba y las Fechas debajo (pedido del usuario, torneos por zonas).
    for (const t of sec.acumulada || []) {
      kids.push(el('details', {class: 'plegable'}, el('summary', {}, 'Tabla acumulada'),
        tablaEl(t.id, false)));
    }

    // 4) Fechas (jornadas prof / días amateur) expandibles, DEBAJO de las tablas. rondas.json se carga
    // lazy (solo ligas): si aún no está, se pinta el resto y se re-dibuja al llegar (si seguimos acá).
    if (rep && rep.naturaleza === 'liga') {
      kids.push(...seccionRondas(gid));
      if (rondasData == null) asegurarRondas().then(() => estado.actual === gid && dibujar());
    }

    // 5) Fase eliminatoria: por ronda (en orden), encabezado + filas de cruce.
    if (sec.eliminatoria?.length) {
      kids.push(el('h3', {class: 'fase-titulo'}, 'Fase eliminatoria'));
      const rondas = [];
      for (const t of sec.eliminatoria) {
        const last = rondas[rondas.length - 1];
        if (last && last.fase === t.fase) last.ids.push(t.id);
        else rondas.push({fase: t.fase, ids: [t.id]});
      }
      for (const r of rondas) {
        const esFinal = r.fase === 'Final';
        kids.push(el('h4', {}, r.fase));
        kids.push(crucesEl(r.ids, esFinal, camp && camp.campeon));
      }
    }

    // 6) Otras fases (formatos atípicos), colapsable.
    if (sec.otras?.length) {
      kids.push(el('details', {class: 'plegable'}, el('summary', {}, 'Otras fases'),
        ...sec.otras.map(t => bloqueTabla(t.fase, t.id))));
    }

    // 6/7) Liguillas/clasificatorios y promoción/descenso, aparte (según el check). Las llaves de 2
    // equipos ida/vuelta se muestran DESGLOSADAS (crucesEl: cada partido si hay legs verificados, o el
    // agregado como fallback); las mini-liguillas de >2 equipos van como tabla completa.
    if (optChk.checked) {
      // Liguilla Pre-Libertadores/Pre-Sudamericana: si hay sus partidos como LLAVE (liguillas.json),
      // se muestra desglosada por fase (Semifinales → Final) en vez de mini-tabla. Si no, cae a
      // cruce (2 equipos) o tabla (>2).
      const bloqueCruceOTabla = (t) => (liguillas && liguillas[t.id])
        ? el('div', {class: 'fase-bloque'}, el('h4', {}, t.fase), ...liguillaEl(liguillas[t.id]))
        : ((posiciones[t.id] || []).length === 2)
          ? el('div', {class: 'fase-bloque'}, el('h4', {}, t.fase), crucesEl([t.id], false, null))
          : bloqueTabla(t.fase, t.id);
      if (sec.clasificatorio?.length) {
        kids.push(el('h3', {class: 'fase-titulo aparte'}, 'Liguillas y clasificatorios'));
        // Agrupa por LIGUILLA (una temporada puede tener 2: Clasificación + Pre-Libertadores) y ordena la
        // secuencia dentro de cada una: Octavos → Cuartos → Semifinal → Final (la Final SIEMPRE al fondo de
        // su liguilla). Antes se ordenaba por id → las 2 liguillas se intercalaban por número de fase.
        const ordLig = (t) => {
          const f = t.fase || '';
          const lig = f.replace(/^((?:ronda\s+\d+|octavos?|cuartos?|quarterfinal|semifinal|final|winners|losers)\s*\d*\s*)+/i, '').trim();
          const pr = /\bfinal\b/i.test(f) ? 3 : /semifinal/i.test(f) ? 2 : /cuartos|quarterfinal/i.test(f) ? 1 : 0;
          const num = parseInt((f.match(/\d+/) || ['99'])[0], 10);
          return [lig, pr, num];
        };
        for (const t of sec.clasificatorio.slice().sort((a, b) => {
          const ka = ordLig(a), kb = ordLig(b);
          return ka[0].localeCompare(kb[0]) || ka[1] - kb[1] || ka[2] - kb[2] || a.id.localeCompare(b.id);
        })) kids.push(bloqueCruceOTabla(t));
      }
      if (sec.promocion?.length) {
        kids.push(el('h3', {class: 'fase-titulo aparte'}, 'Promoción y descenso'));
        for (const t of sec.promocion) kids.push(bloqueCruceOTabla(t));
      }
    }

    tabla.replaceChildren(...kids);
  }

  buscador.addEventListener('input', refrescarSelect);
  natSel.addEventListener('change', refrescarSelect);
  eraSel.addEventListener('change', refrescarSelect);
  optChk.addEventListener('change', () => estado.actual && dibujar());

  // #20: panel de "período" — total histórico calculado en vivo para un rango de años (presets últimos
  // 25/50/75 o rango libre). Elegir un torneo en el selector de arriba sale de este modo.
  const periodoDesde = el('input', {
    type: 'number', class: 'filtro periodo-in',
    min: String(ANIO_MIN), max: String(ANIO_MAX), value: String(ANIO_MIN)
  });
  const periodoHasta = el('input', {
    type: 'number', class: 'filtro periodo-in',
    min: String(ANIO_MIN), max: String(ANIO_MAX), value: String(ANIO_MAX)
  });

  function aplicarPeriodo(desde, hasta) {
    const d = Math.max(ANIO_MIN, Math.min(desde, hasta));
    const h = Math.min(ANIO_MAX, Math.max(desde, hasta));
    estado.periodo = {desde: d, hasta: h};
    estado.actual = null;
    periodoDesde.value = String(d);
    periodoHasta.value = String(h);
    estado.sortKey = 'Pts';   // orden por defecto: Puntos (desc)
    estado.sortDir = -1;
    selectorRico.setSeleccion(null, 'Elegí un torneo');   // el modo "período" no tiene torneo seleccionado
    dibujar();
  }

  const btnPreset = (label, anios) => {
    const b = el('button', {type: 'button', class: 'modo-btn'}, label);
    b.addEventListener('click', () => aplicarPeriodo(anios ? ANIO_MAX - anios + 1 : ANIO_MIN, ANIO_MAX));
    return b;
  };
  const btnRango = el('button', {type: 'button', class: 'modo-btn'}, 'Aplicar rango');
  btnRango.addEventListener('click',
    () => aplicarPeriodo(+periodoDesde.value || ANIO_MIN, +periodoHasta.value || ANIO_MAX));
  const btnLimpiar = el('button', {type: 'button', class: 'modo-btn'}, 'Ver tablas oficiales');
  btnLimpiar.addEventListener('click', () => {
    estado.periodo = null;
    if (estado.actual) mostrarGrupo(estado.actual);
    else refrescarSelect();
  });
  const periodoPanel = el('details', {class: 'periodo-panel'},
    el('summary', {}, 'Filtrar por período (total histórico calculado)'),
    el('div', {class: 'periodo-controles'},
      btnPreset('Últimos 25 años', 25), btnPreset('Últimos 50 años', 50),
      btnPreset('Últimos 75 años', 75), btnPreset('Toda la historia', null),
      el('label', {class: 'periodo-rango'}, 'Desde ', periodoDesde, ' Hasta ', periodoHasta, btnRango),
      btnLimpiar));

  // #15: exportar a CSV la(s) tabla(s) mostradas (torneo elegido o total del período), con su título.
  const nombreCSV = () => {
    if (estado.periodo) return `historico_${estado.periodo.desde}_${estado.periodo.hasta}`;
    const rep = porId[estado.actual];
    return 'tabla_' + String(rep ? nombreLimpio(rep) : (estado.actual || 'historico'))
      .replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  };
  const btnExport = botonCSV(nombreCSV, () => {
    const tbs = [...tabla.querySelectorAll('table')];
    if (!tbs.length) return null;
    return tbs.map((tb) => {
      // Tablas de "Fechas": el rótulo (Fecha N / Desempate) está en el <summary> del <details>, no en un h3-h5.
      const det = tb.closest('details.ronda');
      if (det) {
        const sum = det.querySelector('summary');
        return [sum ? sum.textContent.trim() : '', tb];
      }
      let h = tb.previousElementSibling;
      while (h && !/^H[3-5]$/.test(h.tagName)) h = h.previousElementSibling;
      return [h ? h.textContent.trim() : '', tb];
    });
  });

  // Poblar la barra de filtros: los <select>/<input>/<label> + el selector rico + exportar.
  controles.append(natSel, eraSel, buscador, optLbl, selectorRico.el, btnExport);
  // Los listeners de "click afuera" y "Escape" los maneja crearSelectorRico(limite = controles);
  // por eso ya no se registran acá (evita duplicados y mantiene el filtrado en vivo).

  container.append(
    el('h2', {}, 'Tabla histórica'),
    controles,
    periodoPanel,
    tabla);

  // Preselección desde un enlace (ej. tocar un torneo en la ficha de un club). Si el id es una
  // fase, se abre su torneo-grupo.
  const torneoT = params.t && porId[params.t];
  if (torneoT) {
    if (torneoT.era) eraSel.value = torneoT.era;
    refrescarSelect();
    // aunque el torneo-grupo no esté en el desplegable filtrado, lo mostramos (link directo).
    if (porGrupo[torneoT.grupo || torneoT.id]) mostrarGrupo(torneoT.grupo || torneoT.id);
  } else {
    if (params.era) eraSel.value = params.era;
    if (params.q) buscador.value = params.q;
    refrescarSelect();
    // Un enlace desde un partido de LIGA usa q=año+era (torneo_nombres no mapea 'Profesional YYYY').
    // Ese año puede colisionar con una COPA del mismo año (ej. 1958: 'Primera División' y 'Copa Suecia',
    // ambas era profesional) y el auto-select alfabético caería en la copa. Al venir de liga (era ≠ copa)
    // preferimos la tabla de LIGA de ese año.
    if (params.q && params.era && params.era !== 'copa') {
      const liga = repsFiltrados().find(t => t.naturaleza === 'liga');
      if (liga) mostrarGrupo(liga.id);
    }
  }
}
