// Selector de país REUTILIZABLE (Tabla histórica de copas internacionales y "País rival" de la ficha de club):
// el desplegable rico de dropdown.js (mismo que el de provincias) con el nombre del país a la izquierda y su
// bandera (images/flags/) a la derecha. Banderas: flag-icons (MIT) + Yugoslavia dibujada a mano (ver
// images/flags/LEEME.txt).

import {el} from './main.js';
import {crearSelectorRico} from './dropdown.js';

// Código de país de RSSSF (pl/pv de los partidos) -> archivo de images/flags/ (ISO 3166-1 alfa-2 de flag-icons;
// Escocia e Inglaterra con sus subdivisiones gb-sct / gb-eng).
const ARCHIVO = {
  Arg: 'ar', Bol: 'bo', Bra: 'br', Chi: 'cl', Col: 'co', Ecu: 'ec', Mex: 'mx', Par: 'py', Per: 'pe', Uru: 'uy',
  Ven: 've', USA: 'us', CRi: 'cr', Hon: 'hn', Gua: 'gt', ESa: 'sv', Tri: 'tt',
  Esp: 'es', Por: 'pt', Ita: 'it', Esc: 'gb-sct', Ing: 'gb-eng', Hol: 'nl', Ale: 'de', Sue: 'se', Gre: 'gr',
  Rum: 'ro', Yug: 'yu', Jpn: 'jp',
};

// Código de país de RSSSF -> nombre en castellano (copas internacionales, ficha de club, Efemérides).
export const PAIS_ES = {
  Arg: 'Argentina', Bol: 'Bolivia', Bra: 'Brasil', Chi: 'Chile', Col: 'Colombia', Ecu: 'Ecuador',
  Mex: 'México', Par: 'Paraguay', Per: 'Perú', Uru: 'Uruguay', Ven: 'Venezuela',
  USA: 'Estados Unidos', CRi: 'Costa Rica', Hon: 'Honduras',
  Gua: 'Guatemala', ESa: 'El Salvador', Tri: 'Trinidad y Tobago',
  // Europeos (Copa Intercontinental)
  Esp: 'España', Por: 'Portugal', Ita: 'Italia', Esc: 'Escocia', Ing: 'Inglaterra',
  Hol: 'Países Bajos', Ale: 'Alemania', Sue: 'Suecia', Gre: 'Grecia', Rum: 'Rumania', Yug: 'Yugoslavia',
  // Asia (Suruga Bank Championship)
  Jpn: 'Japón',
};

export function banderaPais(cod) {
  const f = ARCHIVO[cod];
  return f ? `images/flags/${f}.svg` : '';
}

// paises = códigos (ya ordenados); nombre(cod) -> nombre en castellano; todos = rótulo de la opción vacía.
// onElegir(cod) recibe '' para "todos". Devuelve {el, set(cod)}.
export function crearSelectorPais({paises, nombre, todos = 'Todos los países', onElegir, limite = null}) {
  const sel = crearSelectorRico({
    placeholder: todos, limite,
    onElegir: (id) => {
      set(id);
      onElegir(id);
    },
  });
  sel.el.classList.add('pais-dd');
  const img = (c) => {
    const src = banderaPais(c);
    // lazy: el panel arranca oculto, así las banderas se bajan recién al abrirlo
    return src ? el('span', {class: 'dd-champ'}, el('img', {src, class: 'bandera', alt: '', loading: 'lazy'})) : null;
  };
  sel.poblar([{
    items: [{id: '', etq: todos}, ...paises.map((c) => ({id: c, etq: nombre(c), derecha: img(c)}))],
  }]);

  function set(cod) {
    if (cod && !paises.includes(cod)) return false;
    sel.setSeleccion(cod || '', cod ? nombre(cod) : todos);
    return true;
  }

  set('');
  return {el: sel.el, set};
}
