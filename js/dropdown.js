// Desplegable "rico" REUTILIZABLE (Tabla histórica + Ediciones de copas internacionales): botón con la
// selección actual + panel plegable. Cada fila lleva a la IZQUIERDA una etiqueta y a la DERECHA una celda
// libre (ej. escudo + campeón). No usa <select> nativo, que no admite imágenes ni alineación por opción.
// Agrupa opcionalmente por encabezados. Estilos en css/style.css (.torneo-dd/.dd-panel/.dd-item/.dd-champ).
//
// Teclado (con el foco en el botón o dentro del control):
//   ↑/↓    abre el panel y mueve el resaltado (parte del ítem activo si lo hay, si no del primero/último)
//   Home/End  va al primer/último ítem
//   Enter/Space  elige el ítem resaltado
//   Escape  cierra el panel
// El foco queda SIEMPRE en el <button>; el "cursor" de teclado es la clase .resaltado sobre la fila.
import {el} from './main.js';

// Cierre del panel abierto en este momento (a lo sumo uno): abrir otro desplegable cierra el anterior, aunque
// el clic caiga dentro del `limite` de aquel.
let cerrarAbierto = null;

// opts: { onElegir(id), placeholder, limite? }
//  - onElegir: callback al elegir una fila (recibe el id crudo del item).
//  - limite: elemento cuyo "afuera" cierra el panel (por defecto el propio control). En la Tabla histórica se
//    pasa la barra de filtros, para poder filtrar en vivo con el panel abierto sin que se cierre.
export function crearSelectorRico({onElegir, placeholder = 'Elegí…', limite = null} = {}) {
  const label = el('span', {class: 'dd-label'}, placeholder);
  const btn = el('button', {
    type: 'button', class: 'filtro torneo-sel dd-btn',
    'aria-haspopup': 'listbox', 'aria-expanded': 'false',
  }, label, el('span', {class: 'dd-caret'}, '▾'));
  const panel = el('div', {class: 'dd-panel', hidden: true, role: 'listbox'});
  const cont = el('div', {class: 'torneo-dd'}, btn, panel);
  let activoId = null;
  let resaltadoIdx = -1;   // índice del ítem con el "cursor" de teclado (-1 = ninguno)

  const items = () => [...panel.querySelectorAll('.dd-item')];

  function limpiarResaltado() {
    resaltadoIdx = -1;
    for (const it of items()) it.classList.remove('resaltado');
  }

  function setResaltado(idx) {
    const its = items();
    if (!its.length) return;
    resaltadoIdx = Math.max(0, Math.min(idx, its.length - 1));
    its.forEach((it, i) => it.classList.toggle('resaltado', i === resaltadoIdx));
    its[resaltadoIdx].scrollIntoView({block: 'nearest'});
  }

  // El panel se ubica con position: FIXED respecto de la ventana (no absolute dentro del control): así ningún
  // contenedor con overflow lo recorta (ej. el selector de país dentro de .tabla-wrap, que scrollea en X, con
  // una tabla filtrada de pocas filas). Se abre hacia ABAJO del botón, o hacia ARRIBA si abajo no entra y arriba
  // hay más lugar; el alto se limita al espacio disponible (máx. 60% de la ventana). Mientras está abierto sigue
  // al botón en cualquier scroll (captura: también el de los contenedores) y al cambiar el tamaño de la ventana.
  const MARGEN = 8;

  function ubicar() {
    if (panel.hidden) return;
    if (!cont.isConnected) return seguir(false);   // la vista cambió con el panel abierto: soltar los listeners
    const r = btn.getBoundingClientRect();
    const abajo = innerHeight - r.bottom - MARGEN, arriba = r.top - MARGEN;
    const tope = Math.round(innerHeight * .6);
    panel.style.maxHeight = '';
    const alto = Math.min(panel.scrollHeight, tope);
    const haciaArriba = abajo < alto && arriba > abajo;
    const disp = Math.max(120, Math.min(tope, (haciaArriba ? arriba : abajo) - 4));
    // Compacto (reemplazo de <select>): el panel puede ser más ancho que el botón, hasta su opción más larga.
    const compacto = cont.classList.contains('dd-compacto');
    Object.assign(panel.style, {
      position: 'fixed', left: `${r.left}px`, right: 'auto', maxHeight: `${disp}px`,
      width: compacto ? 'max-content' : `${r.width}px`,
      minWidth: compacto ? `${r.width}px` : '',
      maxWidth: compacto ? `${innerWidth - 2 * MARGEN}px` : '',
      top: haciaArriba ? `${Math.max(MARGEN, r.top - 4 - Math.min(alto, disp))}px` : `${r.bottom + 4}px`,
    });
    // Si el panel ensanchado no entra a la derecha del botón, se corre hacia la izquierda.
    if (compacto) {
      const sobra = r.left + panel.offsetWidth - (document.documentElement.clientWidth - MARGEN);
      if (sobra > 0) panel.style.left = `${Math.max(MARGEN, r.left - sobra)}px`;
    }
  }

  const seguir = (v) => {
    const f = v ? addEventListener : removeEventListener;
    f('scroll', ubicar, true);
    f('resize', ubicar);
  };

  const abrir = (v) => {
    if (v === !panel.hidden) return;
    if (v && cerrarAbierto) cerrarAbierto();
    cerrarAbierto = v ? cerrar : (cerrarAbierto === cerrar ? null : cerrarAbierto);
    panel.hidden = !v;
    btn.classList.toggle('abierto', v);
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    seguir(v);
    if (v) ubicar();
    else limpiarResaltado();
  };
  const cerrar = () => abrir(false);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    abrir(panel.hidden);
  });
  const dentro = (t) => cont.contains(t) || (limite && limite.contains(t));
  document.addEventListener('click', (e) => {
    if (!dentro(e.target)) abrir(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') abrir(false);
  });

  function marcarActivo() {
    for (const it of panel.querySelectorAll('.dd-item'))
      it.classList.toggle('activo', it.getAttribute('data-id') === activoId);
  }

  // --- navegación por teclado ---
  // Se engancha al wrapper (no al <button>): cualquier keydown que burbujee desde el botón o desde
  // un ítem enfocado (si algún día lo hacemos focusable) pasa por acá. El foco del teclado sigue
  // estando en el <button> en el caso normal, así que solo hay UNA ruta de teclado activa.
  cont.addEventListener('keydown', (e) => {
    const its = items();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!its.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      if (panel.hidden) {
        // panel CERRADO con foco en el botón: cambia la competencia DIRECTAMENTE al ítem anterior/siguiente
        // (como un <select> nativo), sin abrir el panel. (item 65)
        const act = its.findIndex((it) => it.getAttribute('data-id') === activoId);
        const idx = act < 0 ? (dir > 0 ? 0 : its.length - 1)
          : Math.max(0, Math.min(act + dir, its.length - 1));
        if (idx !== act) its[idx].click();   // selecciona (onElegir + setSeleccion) y devuelve el foco al botón
        return;
      }
      let idx = resaltadoIdx;
      if (idx < 0) {   // arrancar desde el activo si existe; si no, extremo según dirección
        const act = its.findIndex((it) => it.getAttribute('data-id') === activoId);
        idx = act >= 0 ? act : (dir > 0 ? -1 : its.length);
      }
      setResaltado(idx + dir);
    } else if (e.key === 'Home') {
      if (!panel.hidden && its.length) {
        e.preventDefault();
        setResaltado(0);
      }
    } else if (e.key === 'End') {
      if (!panel.hidden && its.length) {
        e.preventDefault();
        setResaltado(its.length - 1);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Solo interceptamos Enter/Space si hay algo resaltado; si no, dejamos que el <button>
      // haga su toggle natural (abrir/cerrar el panel).
      if (!panel.hidden && resaltadoIdx >= 0 && its[resaltadoIdx]) {
        e.preventDefault();
        its[resaltadoIdx].click();
      }
    } else if (e.key === 'Escape') {
      if (!panel.hidden) {
        e.preventDefault();   // el document listener ya cierra, pero acá evitamos side-effects raros
        abrir(false);
      }
    }
  });

  // grupos = [{titulo?, items:[{id, etq, derecha?, title?}]}]  (cada item = una opción/fila).
  function poblar(grupos) {
    const frag = [];
    for (const g of grupos) {
      if (!g.items || !g.items.length) continue;
      if (g.titulo) frag.push(el('div', {class: 'dd-group'}, g.titulo));
      for (const it of g.items) {
        const row = el('div', {
            class: 'dd-item', 'data-id': String(it.id), title: it.title || it.etq,
            role: 'option',
          },
          el('span', {class: 'dd-nom'}, it.etq),
          it.derecha || el('span', {class: 'dd-champ vacio'}, ''));
        row.addEventListener('click', () => {
          abrir(false);
          btn.focus();   // no perder el foco: permite seguir cambiando con ↑/↓ tras elegir (item 65)
          onElegir(it.id);
        });
        frag.push(row);
      }
    }
    panel.replaceChildren(...frag);
    limpiarResaltado();   // el DOM cambió: el índice anterior puede quedar fuera de rango
    marcarActivo();
    ubicar();             // filtrado en vivo con el panel abierto: el alto cambió
  }

  function setSeleccion(id, etq) {
    activoId = id == null ? null : String(id);
    if (etq != null) label.textContent = etq;
    marcarActivo();
  }

  return {el: cont, poblar, setSeleccion, cerrar};
}
