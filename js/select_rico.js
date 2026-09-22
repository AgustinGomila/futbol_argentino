// Reemplazo VISUAL de los <select> nativos por el desplegable rico del sitio (dropdown.js). En el celular el
// <select> nativo abre el selector del sistema operativo (lista a pantalla completa, letra grande, sin el tema
// del sitio); el desplegable rico se dibuja con la página y respeta el tema, como los de escudos/banderas.
//
// El <select> REAL sigue en el DOM (oculto) y es la fuente de verdad: las vistas lo siguen usando igual (leen y
// asignan .value, escuchan 'change', repueblan sus <option>/<optgroup>). Este módulo:
//   - arma el desplegable con sus opciones (cada <optgroup> = un grupo con encabezado) y lo re-arma si cambian;
//   - al elegir, asigna el valor al <select> y dispara 'change' (e 'input') como lo haría el usuario;
//   - refleja en el botón los .value asignados por código (p. ej. al restaurar el estado desde la URL);
//   - copia la visibilidad (style.display) del <select> y su aria-label.
// Se aplica SOLO, a todo <select> que aparezca en la vista (observador en main.js): las vistas no cambian.

import {crearSelectorRico} from './dropdown.js';

const VALOR = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

export function enriquecerSelect(sel) {
  if (sel.dataset.rico) return;
  sel.dataset.rico = '1';

  const dd = crearSelectorRico({
    placeholder: '',
    onElegir: (v) => {
      if (VALOR.get.call(sel) === v) return;
      VALOR.set.call(sel, v);
      reflejar();
      sel.dispatchEvent(new Event('input', {bubbles: true}));
      sel.dispatchEvent(new Event('change', {bubbles: true}));
    },
  });
  // Clases propias del <select> (ej. 'est-comp', 'evo-zona') al contenedor: conservan su ubicación en la barra.
  dd.el.classList.add('dd-compacto', ...[...sel.classList].filter(c => c !== 'filtro'));
  const btn = dd.el.querySelector('.dd-btn');
  if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));

  const opcion = (o) => ({id: o.value, etq: o.textContent});

  function poblar() {
    const grupos = [];
    let sueltos = null;   // <option> de primer nivel consecutivas = un grupo sin encabezado
    for (const n of sel.children) {
      if (n.tagName === 'OPTGROUP') {
        sueltos = null;
        grupos.push({titulo: n.label, items: [...n.querySelectorAll('option')].map(opcion)});
      } else if (n.tagName === 'OPTION') {
        if (!sueltos) grupos.push(sueltos = {items: []});
        sueltos.items.push(opcion(n));
      }
    }
    dd.poblar(grupos);
    // Ancho del botón = la opción más larga (como el <select> nativo), sin superar el ancho disponible.
    // El margen cubre padding, flecha y la diferencia entre la fuente del botón y la que mide `ch`.
    const largo = Math.max(4, ...[...sel.options].map(o => o.textContent.length));
    dd.el.style.width = `calc(${largo}ch + 3rem)`;
    reflejar();
  }

  function reflejar() {
    const o = sel.selectedOptions[0];
    dd.setSeleccion(o ? o.value : null, o ? o.textContent : '');
  }

  // .value asignado por código -> se refleja en el botón (la propiedad nativa no dispara eventos).
  Object.defineProperty(sel, 'value', {
    configurable: true,
    get() {
      return VALOR.get.call(this);
    },
    set(v) {
      VALOR.set.call(this, v);
      reflejar();
    },
  });
  // Opciones repobladas (Efemérides: días del mes; Resumen: competiciones del ámbito) y visibilidad del <select>.
  new MutationObserver((ms) => {
    if (ms.some(m => m.type === 'childList' || m.type === 'characterData')) poblar();
    dd.el.style.display = sel.style.display;
  }).observe(sel, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style']});

  sel.after(dd.el);
  dd.el.style.display = sel.style.display;
  poblar();
}

// Mejora los <select> presentes en `raiz` y los que se agreguen después (vistas que dibujan en etapas).
export function enriquecerSelects(raiz) {
  for (const s of raiz.querySelectorAll('select')) enriquecerSelect(s);
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'SELECT') enriquecerSelect(n);
        else for (const s of n.querySelectorAll('select')) enriquecerSelect(s);
      }
    }
  }).observe(raiz, {childList: true, subtree: true});
}
