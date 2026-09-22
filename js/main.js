// Bootstrap de la app. Router por hash minimalista: cada vista es un modulo
// en js/views/ que exporta render(container). Sumar competiciones/pantallas
// nuevas = agregar una entrada a routes y su modulo.

import {loadJSON} from './data.js';
import './tema.js'; // selector de tema claro/oscuro del encabezado

const app = document.getElementById('app');

const routes = {
  '/tabla-historica': () => import('./views/tabla-historica.js'),
  '/segunda': () => import('./views/segunda.js'),
  '/clubes': () => import('./views/clubes.js'),
  '/mano-a-mano': () => import('./views/mano-a-mano.js'),
  '/copas': () => import('./views/copas.js'),
  '/copas-historica': () => import('./views/copas-historica.js'),
  '/libertadores': () => import('./views/libertadores.js'),
  '/sudamericana': () => import('./views/sudamericana.js'),
  '/recopa': () => import('./views/recopa.js'),
  '/suruga': () => import('./views/suruga.js'),
  '/mercosur': () => import('./views/mercosur.js'),
  '/conmebol': () => import('./views/conmebol.js'),
  '/interamericana': () => import('./views/interamericana.js'),
  '/supercopa': () => import('./views/supercopa.js'),
  '/mastersupercopa': () => import('./views/mastersupercopa.js'),
  '/conmebolmasters': () => import('./views/conmebolmasters.js'),
  '/oro': () => import('./views/oro.js'),
  '/recopa-clubes': () => import('./views/recopaclubes.js'),
  '/intercontinental': () => import('./views/intercontinental.js'),
  '/aldao': () => import('./views/aldao.js'),
  '/escobar-gerona': () => import('./views/escobargerona.js'),
  '/cousenier': () => import('./views/cousenier.js'),
  '/cuptie': () => import('./views/cuptie.js'),
  '/campeones': () => import('./views/campeones.js'),
  '/efemerides': () => import('./views/efemerides.js'),
  '/resumen': () => import('./views/resumen.js'),
};

// Rutas con parametro: la vista recibe render(container, params). Ej: #/club/boca-juniors
const paramRoutes = [
  {pattern: /^\/club\/(.+)$/, load: () => import('./views/club.js'), param: 'id'},
];

const DEFAULT_ROUTE = '/tabla-historica';

/** Devuelve el href de hash para la pagina de un club (usar en enlaces de tablas). */
export function clubHref(id) {
  return `#/club/${encodeURIComponent(id)}`;
}

/**
 * Sincroniza el ESTADO de la vista actual en el query del hash (ej. #/mano-a-mano?a=Boca&b=River) SIN
 * recargar: history.replaceState no dispara 'hashchange', así que no re-renderiza. El objetivo es que al
 * navegar a otra página (que empuja una entrada de historial) y volver con "Atrás", el navegador restaure
 * ESTA URL con su estado, y la vista lo lea de sus `params`. Las claves con valor vacío/nulo se omiten
 * (mantiene la URL limpia cuando la vista está en su estado por defecto). Cada vista lo llama al cambiar su
 * selección; las mismas claves las lee en render(container, params).
 */
export function setEstadoRuta(params) {
  const raw = location.hash.replace(/^#/, '') || DEFAULT_ROUTE;
  const path = raw.split('?')[0];
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  // conserva history.state (la clave de scroll de la entrada, ver abajo)
  history.replaceState(history.state, '', '#' + path + (s ? '?' + s : ''));
}

// --- Scroll por entrada del historial ---
// Cada entrada lleva una clave (history.state.k) y la posición de scroll de cada clave se guarda en
// sessionStorage. Al volver/avanzar ("Atrás"/"Adelante", o recargar) a una entrada ya visitada se restaura su
// scroll; una navegación NUEVA (clic en un enlace) arranca arriba. Manejo manual: el navegador restauraría
// antes de que la vista termine de dibujarse (contenido aún corto -> posición recortada).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const SCROLL_STORE = 'scrollPorEntrada';
let scrolls = {};
try {
  scrolls = JSON.parse(sessionStorage.getItem(SCROLL_STORE)) || {};
} catch {
  // sin sessionStorage (modo privado/bloqueado): el scroll se recuerda solo en memoria
}
let ignorarScroll = true;   // durante el render/restauración: los saltos de altura no son scroll del usuario
let restauroId = 0;         // token: un render nuevo o una acción del usuario cancela la restauración en curso
let guardarT = null;
const claveEntrada = () => history.state && history.state.k;

window.addEventListener('scroll', () => {
  const k = claveEntrada();
  if (ignorarScroll || !k) return;
  scrolls[k] = Math.round(window.scrollY);
  clearTimeout(guardarT);
  guardarT = setTimeout(() => {
    try {
      sessionStorage.setItem(SCROLL_STORE, JSON.stringify(scrolls));
    } catch {
      // storage lleno/bloqueado: queda en memoria
    }
  }, 200);
}, {passive: true});

// Si el usuario scrollea mientras se restaura, gana el usuario.
for (const ev of ['wheel', 'touchstart', 'keydown']) {
  window.addEventListener(ev, () => {
    if (ignorarScroll) {
      restauroId++;
      ignorarScroll = false;
    }
  }, {passive: true});
}

// Lleva el scroll a `y`. Algunas vistas siguen creciendo tras el render (datos que cargan aparte, ej. la
// Tabla histórica de una copa): si todavía no hay altura suficiente, reintenta un rato hasta llegar.
function restaurarScroll(y) {
  const id = ++restauroId;
  let intentos = 0;
  const paso = () => {
    if (id !== restauroId) return;
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 1 && intentos++ < 40) {
      setTimeout(paso, 50);
      return;
    }
    ignorarScroll = false;
  };
  paso();
}

async function render() {
  const raw = location.hash.replace(/^#/, '') || DEFAULT_ROUTE;
  // Separo el path del query string (ej. #/copas?c=Copa%20Argentina&e=2023) para que
  // las vistas puedan preseleccionar un torneo desde un enlace.
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = qi >= 0 ? Object.fromEntries(new URLSearchParams(raw.slice(qi + 1))) : {};
  let load = routes[path], params = {...query};
  if (!load) {
    for (const r of paramRoutes) {
      const m = r.pattern.exec(path);
      if (m) {
        load = r.load;
        params = {...query, [r.param]: decodeURIComponent(m[1])};
        break;
      }
    }
  }
  if (!load) load = routes[DEFAULT_ROUTE];

  markActiveNav(path, query);
  app.setAttribute('aria-busy', 'true');
  ignorarScroll = true;
  restauroId++;   // cancela una restauración pendiente de la vista anterior
  try {
    const view = await load();
    app.replaceChildren();
    app.className = 'app-main';   // limpia clases que agregó la vista anterior (ej. 'lib-vista' de las copas)
    await view.render(app, params);
    // Entrada ya visitada (Atrás/Adelante/recarga) -> su scroll guardado. Navegación nueva -> clave nueva
    // y arriba de todo (en vez de quedar donde estaba la vista anterior).
    const k = claveEntrada();
    if (k && scrolls[k] != null) {
      restaurarScroll(scrolls[k]);
    } else {
      history.replaceState({...history.state, k: Date.now().toString(36) + Math.random().toString(36).slice(2, 6)}, '');
      restaurarScroll(0);
    }
  } catch (err) {
    console.error(err);
    app.replaceChildren(el('p', {class: 'error'}, 'No se pudo cargar la vista.'));
    ignorarScroll = false;
  } finally {
    app.removeAttribute('aria-busy');
  }
}

// Marca el enlace del nav de la vista actual. Los ítems de "Copas nacionales" comparten la ruta /copas y
// se distinguen por ?c=<copa>. El botón de un desplegable se resalta si alguno de sus ítems está activo.
function markActiveNav(path, query = {}) {
  for (const a of document.querySelectorAll('.app-nav a')) {
    const [hp, hq] = a.getAttribute('href').replace(/^#/, '').split('?');
    const c = hq ? new URLSearchParams(hq).get('c') : null;
    a.classList.toggle('active', hp === path && (c == null || c === query.c));
  }
  for (const dd of document.querySelectorAll('.nav-dropdown')) {
    dd.querySelector('.nav-dropdown-btn')?.classList.toggle('active', !!dd.querySelector('a.active'));
  }
}

/** Helper minimo para crear elementos (usado por las vistas). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.flat());
  return node;
}

// Competiciones/ediciones EN CURSO (se disputan ahora mismo). Homogeneíza el indicador: mismo chip
// "EN CURSO" en todas las vistas + " (en curso)" en los selectores. La liga (Clausura 2026) se marca
// aparte con el flag `en_curso` de torneos.json (data-driven); acá van las copas. Clave = opts.comp
// (Libertadores/Sudamericana) o el nombre de la competencia (copas.js).
export const EN_CURSO = {
  'Copa Libertadores': 2026,
  'Copa Sudamericana': 2026,
  'Copa Argentina': 2026,
};
export const esEnCurso = (comp, edicion) => EN_CURSO[comp] != null && EN_CURSO[comp] === +edicion;
// Chip visual uniforme. `sufijo` opcional (ej. fecha de corte) va al lado del badge.
export const chipEnCurso = (sufijo = '') => el('div', {class: 'en-curso'},
  el('span', {class: 'en-curso-badge'}, 'EN CURSO'),
  sufijo ? el('span', {class: 'en-curso-corte'}, sufijo) : '');

// Resumen estadístico de una edición de copa (formato ÚNICO para nacionales e internacionales):
// equipos distintos · partidos disputados · goles totales · promedio de gol. Ayuda a validar de un
// vistazo la consistencia de los datos del torneo. `ms` = lista de partidos de la edición.
export const copaStats = (ms) => {
  const equipos = new Set();
  let pj = 0, goles = 0;
  for (const m of ms) {
    if (m.l) equipos.add(m.l);
    if (m.v) equipos.add(m.v);
    if (m.gl != null && m.gv != null) {   // excluye no disputados / walkover sin marcador
      pj++;
      goles += (m.gl || 0) + (m.gv || 0);
    }
  }
  return el('div', {class: 'copa-stats'},
    el('span', {}, el('b', {}, String(equipos.size)), ' equipos'),
    el('span', {}, el('b', {}, String(pj)), ' partidos'),
    el('span', {}, el('b', {}, String(goles)), ' goles'),
    el('span', {}, el('b', {}, pj ? (goles / pj).toFixed(2) : '0'), ' goles por partido'));
};

// #15: exportación a CSV. Serializa una <table> renderizada leyendo el texto de cada celda (th/td). Los
// escudos (img sin alt) no aportan texto; los enlaces sí. Escapa comillas/comas/saltos.
export function tablaACSV(tabla) {
  const esc = (t) => {
    const s = (t || '').replace(/\s+/g, ' ').trim();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Tablas de PARTIDOS (cruces/llaves/copas): la fecha del día va como <span class="copa-fecha"> DENTRO de la
  // celda de resultado (td.res), pegada al marcador. En el CSV se extrae a su propia columna (si no, se leería
  // "0-123/01/2025") y se coloca al PRINCIPIO de la fila -> 'Fecha, Local, Resultado, Visitante'. Se aplica
  // solo si la tabla tiene fecha (las tablas de posiciones quedan igual); columna vacía si un partido no la
  // trae, para no desalinear. El 'otorgado' (span con title) NO se separa: queda con el marcador.
  const conFecha = !!tabla.querySelector('td.res .copa-fecha:not([title])');
  return [...tabla.querySelectorAll('tr')]
    .map((tr) => {
      const cells = [...tr.children].filter((c) => c.tagName === 'TH' || c.tagName === 'TD');
      if (!conFecha) return cells.map((c) => esc(c.textContent));
      let fecha = '';
      const resto = cells.map((c) => {
        if (!c.classList.contains('res')) return esc(c.textContent);
        const fch = c.querySelector('.copa-fecha:not([title])');
        if (fch) fecha = fch.textContent;
        const clon = c.cloneNode(true);
        clon.querySelectorAll('.copa-fecha:not([title])').forEach((s) => s.remove());
        return esc(clon.textContent);
      });
      return [esc(fecha), ...resto];   // la fecha va como PRIMERA columna
    })
    .map((cols) => cols.join(','))
    .filter((l) => l.replace(/,/g, '').length)   // descarta filas totalmente vacías
    .join('\r\n');
}

// Descarga un contenido como archivo CSV (con BOM para que Excel respete UTF-8).
export function descargarCSV(nombre, contenido) {
  const blob = new Blob(['﻿' + contenido], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = el('a', {href: url, download: nombre.endsWith('.csv') ? nombre : nombre + '.csv'});
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Botón "⭳ CSV" reutilizable. `getTabla` devuelve, al hacer clic, la <table> a exportar, o un array de
// [titulo, <table>] para volcar varias secciones en un mismo archivo. `nombre` = archivo (string o fn).
export function botonCSV(nombre, getTabla) {
  const b = el('button', {type: 'button', class: 'btn-csv', title: 'Exportar la tabla a CSV'}, '⭳ CSV');
  b.addEventListener('click', () => {
    const t = typeof getTabla === 'function' ? getTabla() : getTabla;
    if (!t) return;
    const partes = Array.isArray(t)
      ? t.filter(Boolean).map(([tit, tb]) => (tit ? `${tit}\r\n` : '') + tablaACSV(tb)).join('\r\n\r\n')
      : tablaACSV(t);
    if (partes) descargarCSV(typeof nombre === 'function' ? nombre() : nombre, partes);
  });
  return b;
}

// Botón "Ver 10 más" para tablas de ranking (récords de goleadas): `items` es la lista COMPLETA ya ordenada,
// de la que el <tbody> muestra las primeras `inicial` filas; cada clic agrega las `paso` siguientes (armadas
// con `fila`) y el botón se oculta al agotarse la lista. Devuelve null si no hay nada más para mostrar.
export function botonVerMas(tbody, items, fila, inicial, paso = 10) {
  let n = inicial;
  if (items.length <= n) return null;
  const b = el('button', {type: 'button', class: 'mini ver-mas'}, `Ver ${paso} más`);
  b.addEventListener('click', () => {
    tbody.append(...items.slice(n, n + paso).map(fila));
    n += paso;
    b.hidden = n >= items.length;
  });
  return b;
}

// Los submenús "Copas nacionales" / "Copas internacionales" son CSS puro (hover / focus-within). Al elegir un ítem, el foco
// queda en el link y :focus-within lo mantendría abierto -> lo cerramos: blur + clase 'cerrado' que
// oculta el menú hasta que el mouse salga del dropdown (mouseleave lo reactiva para el próximo hover).
for (const dd of document.querySelectorAll('.nav-dropdown')) {
  dd.querySelector('.nav-dropdown-menu')?.addEventListener('click', (ev) => {
    if (!ev.target.closest('a')) return;
    dd.classList.add('cerrado');
    document.activeElement?.blur();
  });
  dd.addEventListener('mouseleave', () => dd.classList.remove('cerrado'));
}

// Tooltip: al pasar el mouse por CUALQUIER enlace a la ficha de un club (a[href^="#/club/"]) se muestra
// su NOMBRE COMPLETO (registro.json -> nombre_completo, o el nombre común si no hay). Centralizado por
// delegación en document: cubre todas las vistas sin tocarlas. El registro se carga/cachea una vez y el
// title se pone perezosamente en el primer hover de cada enlace (no pisa un title que la vista ya haya dado).
let _registroTT = null;
loadJSON('registro').then((r) => {
  _registroTT = r || {};
});

function ponerTituloClub(a) {
  if (a.dataset.ttClub || a.title || !_registroTT) return;   // sin registro aún -> reintenta en el próximo hover
  const m = /#\/club\/([^?]+)/.exec(a.getAttribute('href') || '');
  if (!m) return;
  const c = _registroTT[decodeURIComponent(m[1])];
  const full = c && c.nombre_completo;
  if (full && full !== a.textContent.trim()) a.title = full;  // solo si aporta algo (≠ nombre visible)
  a.dataset.ttClub = '1';                                     // procesado (aunque no tuviera nombre completo)
}

document.addEventListener('mouseover', (ev) => {
  const a = ev.target.closest && ev.target.closest('a[href^="#/club/"]');
  if (a) ponerTituloClub(a);
});

window.addEventListener('hashchange', render);
render();
