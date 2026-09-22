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

  const abrir = (v) => {
    panel.hidden = !v;
    btn.classList.toggle('abierto', v);
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (!v) limpiarResaltado();
  };
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
      if (panel.hidden) abrir(true);
      if (!its.length) return;
      let idx = resaltadoIdx;
      if (idx < 0) {   // arrancar desde el activo si existe; si no, extremo según dirección
        const act = its.findIndex((it) => it.getAttribute('data-id') === activoId);
        idx = act >= 0 ? act : (e.key === 'ArrowDown' ? -1 : its.length);
      }
      setResaltado(idx + (e.key === 'ArrowDown' ? 1 : -1));
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
          onElegir(it.id);
        });
        frag.push(row);
      }
    }
    panel.replaceChildren(...frag);
    limpiarResaltado();   // el DOM cambió: el índice anterior puede quedar fuera de rango
    marcarActivo();
  }

  function setSeleccion(id, etq) {
    activoId = id == null ? null : String(id);
    if (etq != null) label.textContent = etq;
    marcarActivo();
  }

  return {el: cont, poblar, setSeleccion, cerrar: () => abrir(false)};
}
