import {el} from './main.js';
import {imgSrc} from './imagenes.js';

// Catálogo de copas INTERNACIONALES compartido por las vistas que las recorren todas juntas (Efemérides,
// Resumen). Cada entrada: [nombre base del JSON de partidos, etiqueta, ruta de la vista]. El JSON de
// campeones es `${base}_campeones` ({edición: campeón}).
export const COPAS_INTL = [
  ['libertadores', 'Copa Libertadores', '#/libertadores'],
  ['sudamericana', 'Copa Sudamericana', '#/sudamericana'],
  ['recopa', 'Recopa Sudamericana', '#/recopa'],
  ['supercopa', 'Supercopa Sudamericana', '#/supercopa'],
  ['mastersupercopa', 'Copa Máster de Supercopa', '#/mastersupercopa'],
  ['conmebol', 'Copa Conmebol', '#/conmebol'],
  ['conmebolmasters', 'Copa Conmebol Masters', '#/conmebolmasters'],
  ['mercosur', 'Copa Mercosur', '#/mercosur'],
  ['oro', 'Copa de Oro', '#/oro'],
  ['interamericana', 'Copa Interamericana', '#/interamericana'],
  ['recopaclubes', 'Recopa Sudamericana de Clubes', '#/recopa-clubes'],
  ['suruga', 'Suruga Bank Championship', '#/suruga'],
  ['intercontinental', 'Copa Intercontinental', '#/intercontinental'],
  ['mundialclubes', 'Mundial de Clubes', '#/mundial-clubes'],
  ['intercontinentalfifa', 'Copa Intercontinental de la FIFA', '#/intercontinental-fifa'],
  ['aldao', 'Copa Aldao', '#/aldao'],
  ['escobargerona', 'Copa Escobar-Gerona', '#/escobar-gerona'],
  ['cousenier', 'Copa de Honor Cousenier', '#/cousenier'],
  ['cuptie', 'Cup Tie Competition', '#/cuptie'],
];

// Nombre de una edición de copa internacional para los listados de partidos (historial del club, mano a mano).
export function nombreEdicionIntl(comp, e) {
  return `${comp} ${e}`;
}

// Imagen del trofeo de una copa (data/iconos.json <- data/fuentes/copas_meta.csv; archivos en images/cups/):
// primero la de la EDICIÓN ('Copa Argentina|1969'), si no la de la competencia. '' si no hay.
export function iconoCopa(iconos, comp, ed) {
  const f = iconos && ((ed != null && iconos[`${comp}|${ed}`]) || iconos[comp]);
  return f ? imgSrc(`cups/${f}`) : '';
}

// Miniatura del trofeo (chips de títulos, Efemérides). '' si la copa no tiene imagen.
export function miniCopa(iconos, comp, ed) {
  const src = iconoCopa(iconos, comp, ed);
  return src ? el('img', {class: 'copa-mini', src, alt: '', loading: 'lazy', title: comp}) : '';
}

// Miniatura de un título de LIGA (chips): solo el 'Campeón de Liga' designado (líder de la tabla anual, desde
// 2025) tiene trofeo propio (fila 'Campeón de Liga' de torneos_meta.csv). '' para el resto.
export const CAMPEON_LIGA = 'Campeón de Liga';

export function miniLiga(iconos, nom, anio) {
  return nom.startsWith(CAMPEON_LIGA) ? miniCopa(iconos, CAMPEON_LIGA, anio) : '';
}
