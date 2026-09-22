// Vista: listado de TODOS los clubes del registro (data/registro.json) como chips (escudo, nombre completo,
// localidad y provincia) que llevan a la ficha de cada club. Orden seleccionable (alfabético por nombre común
// o por fecha de fundación) y filtro por provincia (selector compartido de provincias.js). El estado
// (orden + provincia) se guarda en la URL: #/clubes?orden=fundacion&prov=Santa%20Fe.

import {el, setEstadoRuta} from '../main.js';
import {loadJSON} from '../data.js';
import {crearSelectorProvincia, normalizarProvincia} from '../provincias.js';
import {chipClub} from '../clubes_ui.js';

// Fundación 'd/m/yyyy' o 'yyyy' -> clave ordenable 'yyyy-mm-dd' ('' si no se conoce: va al final).
function claveFundacion(f) {
  const s = String(f || '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})$/.exec(s);
  return m ? `${m[1]}-00-00` : '';
}

export async function render(container, params = {}) {
  const registro = await loadJSON('registro');
  if (!registro) {
    container.append(el('h2', {}, 'Clubes'),
      el('p', {class: 'error'}, 'No se pudo cargar el registro de clubes. Corré scripts/build_web.py.'));
    return;
  }

  const clubes = Object.entries(registro).map(([id, c]) => ({
    id,
    nombre: c.nombre_comun || c.nombre,                 // nombre común: criterio del orden alfabético
    prov: normalizarProvincia(c.provincia),
    fundacion: c.fundacion || '',
    fKey: claveFundacion(c.fundacion),
  }));
  // Divisor de cada chip: inicial del nombre (sin acentos; dígitos -> '#') o año de fundación ('Sin fecha').
  const divisorDe = (c) => {
    if (estado.orden === 'fundacion') return c.fKey ? c.fKey.slice(0, 4) : 'Sin fecha';
    const ini = c.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    return /[A-Z]/.test(ini) ? ini : '#';
  };
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base', numeric: true});

  const estado = {
    orden: params.orden === 'fundacion' ? 'fundacion' : 'alfabetico',
    prov: '',
  };

  const resumen = el('span', {class: 'clubes-cuenta'});
  const grilla = el('div', {class: 'clubes-grid'});

  const chip = (c) => chipClub(c.id, registro[c.id], estado.orden !== 'fundacion' ? ''
    : c.fundacion ? `Fundado: ${c.fundacion}` : 'Fundación sin datos');

  function dibujar() {
    setEstadoRuta({orden: estado.orden === 'fundacion' ? 'fundacion' : '', prov: estado.prov});
    for (const b of ordenSel.children) b.classList.toggle('activo', b.dataset.k === estado.orden);
    const lista = clubes.filter((c) => !estado.prov || c.prov === estado.prov);
    lista.sort(estado.orden === 'fundacion'
      ? (a, b) => (!a.fKey) - (!b.fKey) || a.fKey.localeCompare(b.fKey) || porNombre(a, b)
      : porNombre);
    resumen.textContent = `${lista.length} ${lista.length === 1 ? 'club' : 'clubes'}`;
    if (!lista.length) {
      grilla.replaceChildren(el('p', {class: 'placeholder'}, 'No hay clubes para esta provincia.'));
      return;
    }
    // Divisores (# A B C… / 1867 1887 1889…): ocupan toda la fila de la grilla, antes del 1er club de cada grupo.
    const kids = [];
    let previo = null;
    for (const c of lista) {
      const d = divisorDe(c);
      if (d !== previo) kids.push(el('h3', {class: 'clubes-divisor'}, d));
      previo = d;
      kids.push(chip(c));
    }
    grilla.replaceChildren(...kids);
  }

  // Orden: mismas "píldoras" que el sub-toggle del Palmarés.
  const ordenSel = el('div', {class: 'sub-modos'});
  for (const [k, etq] of [['alfabetico', 'Alfabético'], ['fundacion', 'Fecha de fundación']]) {
    const b = el('button', {type: 'button', class: 'sub-modo-btn', 'data-k': k}, etq);
    b.addEventListener('click', () => {
      if (estado.orden === k) return;
      estado.orden = k;
      dibujar();
    });
    ordenSel.append(b);
  }

  const controles = el('div', {class: 'controles clubes-controles'});
  const provincias = [...new Set(clubes.map((c) => c.prov).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const selProv = crearSelectorProvincia({
    provincias, limite: controles,
    onElegir: (p) => {
      estado.prov = p;
      dibujar();
    },
  });
  controles.append(el('label', {}, 'Orden '), ordenSel, selProv.el, resumen);

  container.append(el('h2', {}, 'Clubes'), controles, grilla);

  if (params.prov && selProv.set(String(params.prov).trim())) estado.prov = String(params.prov).trim();
  dibujar();
}
