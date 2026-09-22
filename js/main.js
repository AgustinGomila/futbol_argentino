// Bootstrap de la app. Router por hash minimalista: cada vista es un modulo
// en js/views/ que exporta render(container). Sumar competiciones/pantallas
// nuevas = agregar una entrada a routes y su modulo.

const app = document.getElementById('app');

const routes = {
  '/tabla-historica': () => import('./views/tabla-historica.js'),
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
  '/campeones': () => import('./views/campeones.js'),
  '/efemerides': () => import('./views/efemerides.js'),
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

  markActiveNav(path);
  app.setAttribute('aria-busy', 'true');
  try {
    const view = await load();
    app.replaceChildren();
    await view.render(app, params);
    // Al navegar a otra vista (ej. clic en un club) el scroll vuelve al tope, en vez de quedar
    // donde estaba en la vista anterior.
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.replaceChildren(el('p', {class: 'error'}, 'No se pudo cargar la vista.'));
  } finally {
    app.removeAttribute('aria-busy');
  }
}

function markActiveNav(path) {
  for (const a of document.querySelectorAll('.app-nav a')) {
    a.classList.toggle('active', a.getAttribute('href') === `#${path}`);
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

// #15: exportación a CSV. Serializa una <table> renderizada leyendo el texto de cada celda (th/td). Los
// escudos (img sin alt) no aportan texto; los enlaces sí. Escapa comillas/comas/saltos.
export function tablaACSV(tabla) {
  const esc = (t) => {
    const s = (t || '').replace(/\s+/g, ' ').trim();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Tablas de PARTIDOS (fechas/cruces/copas): la fecha del día va como <span class="copa-fecha"> DENTRO de la
  // celda de resultado (td.res), pegada al marcador. En el CSV se separa a su propia columna para no leer
  // "5-126/04/1903". Se aplica solo si la tabla tiene fecha (las tablas de posiciones quedan igual), y a TODAS
  // las filas res (columna vacía si un partido no tiene fecha) para que las columnas no se desalineen. El
  // 'otorgado' (span con title) NO se separa: queda con el marcador.
  const conFecha = !!tabla.querySelector('td.res .copa-fecha:not([title])');
  const celda = (c) => {
    if (conFecha && c.classList.contains('res')) {
      const fch = c.querySelector('.copa-fecha:not([title])');
      const resto = c.cloneNode(true);
      resto.querySelectorAll('.copa-fecha:not([title])').forEach((s) => s.remove());
      return [esc(resto.textContent), esc(fch ? fch.textContent : '')];
    }
    return [esc(c.textContent)];
  };
  return [...tabla.querySelectorAll('tr')]
    .map((tr) => [...tr.children].filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
      .flatMap(celda).join(','))
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

// El submenú "Copas internacionales" es CSS puro (hover / focus-within). Al elegir un ítem, el foco
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

window.addEventListener('hashchange', render);
render();
