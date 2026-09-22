// Resolución del nombre y el enlace de un torneo a partir del id que guarda cada partido
// en p.t. Para la era amateur ese id es el de la hoja FIXTURE (ej. '1921_1'), críptico; el
// mapa data/torneo_nombres.json (id -> {nombre, tabla}) le da un nombre legible y el id de
// la tabla de posiciones para linkear al torneo exacto. Profesional/copa ya traen un p.t
// legible ('Profesional 1931' / nombre de la copa).

import {el} from './main.js';

const anio = (s) => {
  const m = /(\d{4})/.exec(s || '');
  return m ? +m[1] : 0;
};

/** Nombre a mostrar para el torneo de un partido. */
export function torneoNombre(map, p) {
  const info = map && map[p.t];
  return (info && info.nombre) || p.t || '—';
}

/** Href al torneo: copas -> vista Copas (comp+edición); ligas -> tabla exacta si está
 *  mapeada, si no la tabla-histórica filtrada por año/era. Devuelve null si no hay destino. */
export function torneoHref(map, p) {
  const y = anio(p.f) || anio(p.t);
  // Copas internacionales: cada era tiene su ruta; se enlaza a la EDICIÓN puntual (?e=) si viene p.e.
  const RUTA_INTL = {
    internacional: 'libertadores', sudamericana: 'sudamericana', recopa: 'recopa',
    mercosur: 'mercosur', conmebol: 'conmebol', supercopa: 'supercopa', interamericana: 'interamericana',
    mastersupercopa: 'mastersupercopa', conmebolmasters: 'conmebolmasters', oro: 'oro',
    recopaclubes: 'recopa-clubes', intercontinental: 'intercontinental', suruga: 'suruga',
  };
  if (RUTA_INTL[p.era]) {
    return `#/${RUTA_INTL[p.era]}` + (p.e != null ? `?e=${encodeURIComponent(p.e)}` : '');
  }
  if (p.era === 'copa') {
    // la edición explícita (p.e) manda: p.f ahora es la FECHA del partido, cuyo año-calendario
    // puede diferir de la edición en copas cross-año (ej. Campeonato de Campeones 1959, final ene-1960).
    const ce = p.e != null ? p.e : y;
    return '#/copas?c=' + encodeURIComponent(p.t) + (ce ? `&e=${ce}` : '');
  }
  const info = map && map[p.t];
  if (info && info.tabla) return '#/tabla-historica?t=' + encodeURIComponent(info.tabla);
  if (y) return `#/tabla-historica?q=${y}&era=${p.era}`;
  return null;
}

/** Celda <td> con el nombre del torneo enlazado (si hay destino) + la jornada ("Fecha N") si el
 *  partido la trae (p.j, liga profesional). En el fútbol argentino "la fecha" = la jornada/round. */
export function torneoCel(map, p) {
  const href = torneoHref(map, p);
  const txt = torneoNombre(map, p);
  const kids = [href ? el('a', {href}, txt) : txt];
  if (p.j != null) kids.push(el('span', {class: 'jornada'}, ` · Fecha ${p.j}`));
  return el('td', {class: 'txt'}, ...kids);
}
