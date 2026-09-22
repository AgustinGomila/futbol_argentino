// Provincias de los clubes (desde registro.json) + selector de provincia REUTILIZABLE (Tabla histórica de
// Ligas y de Copas). El selector es el desplegable rico de dropdown.js (mismo que Ediciones/Torneos): nombre de
// la provincia a la izquierda y su escudo (images/provinces/) a la derecha.

import {el} from './main.js';
import {crearSelectorRico} from './dropdown.js';

// Normaliza la provincia: unifica las variantes de CABA en un único valor.
// IMPORTANTE: "Buenos Aires" (provincia) y "Ciudad de Buenos Aires" (CABA) son
// entidades DISTINTAS — nunca deben mapearse una a la otra.
export function normalizarProvincia(p) {
  if (!p) return '';
  const s = String(p).trim();
  if (!s) return '';
  const low = s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // sin acentos
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');

  // Variantes de CABA (Ciudad Autónoma de Buenos Aires)
  if (
    low === 'caba' ||
    low === 'capital federal' ||
    low === 'capital' ||
    low === 'ciudad autonoma de buenos aires' ||
    low === 'ciudad de buenos aires' ||
    low === 'ciudad buenos aires' ||
    low === 'buenos aires ciudad' ||
    low === 'buenos aires cfa' ||
    low === 'buenos aires capital federal' ||
    low === 'austral' || low === 'caballito'   // barrios → CABA si algún dato trae barrio
  ) return 'Ciudad de Buenos Aires';

  // Provincia de Buenos Aires (NUNCA debe capturar a CABA)
  if (
    low === 'buenos aires' ||
    low === 'provincia de buenos aires' ||
    low === 'bs as' ||
    low === 'bsas' ||
    low === 'pba'
  ) return 'Buenos Aires';

  return s;   // resto de las provincias, tal cual
}

// Escudo de una provincia normalizada -> 'images/provinces/<archivo>.png' ('' si no es provincia argentina).
// Archivo = nombre sin acentos, en minúsculas y con '_' (entre_rios, santiago_del_estero, uruguay); Buenos Aires y
// CABA tienen nombre propio. La carpeta se llama igual en images/ y en images-mini/ (publicar.sh sirve la mini).
const ARCHIVO_ESP = {'Buenos Aires': 'buenos-aires-province', 'Ciudad de Buenos Aires': 'buenos-aires-city'};
const PROVINCIAS_AR = new Set(['Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa',
  'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']);

// Solo las 24 jurisdicciones argentinas van al selector: 'Uruguay' (un club de amistosos de 1892 en el registro)
// tiene escudo pero no es una provincia.
export const esProvinciaArgentina = (prov) => prov in ARCHIVO_ESP || PROVINCIAS_AR.has(prov);

export function escudoProvincia(prov) {
  const f = ARCHIVO_ESP[prov]
    || (prov ? prov.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_') : '');
  return f ? `images/provinces/${f}.png` : '';
}

// Mapa nombre canónico del club -> provincia normalizada (desde registro.json). `canon` aplica fusiones
// (origen -> destino) para que una denominación histórica herede la provincia del club actual.
export function provinciasDeClubes(registro, canon = (n) => n) {
  const provDe = new Map();
  if (registro && typeof registro === 'object') {
    for (const info of Object.values(registro)) {
      if (!info || typeof info !== 'object') continue;
      const nombre = info.nombre || info.nombre_completo;
      if (!nombre) continue;
      const prov = normalizarProvincia(info.provincia);
      if (prov) provDe.set(canon(nombre), prov);
    }
  }
  return provDe;
}

// Selector de provincia: [Todas las provincias] + una fila por provincia con su escudo a la derecha.
// onElegir(prov) recibe '' para "todas". Devuelve {el, set(prov)}; set() devuelve false si la provincia no
// está en la lista (ej. ?prov= inválido en la URL).
export function crearSelectorProvincia({provincias, onElegir, limite = null}) {
  const TODAS = 'Todas las provincias';
  provincias = provincias.filter(esProvinciaArgentina);
  const sel = crearSelectorRico({
    placeholder: TODAS, limite,
    onElegir: (id) => {
      set(id);
      onElegir(id);
    },
  });
  sel.el.classList.add('prov-dd');
  const img = (p) => {
    const src = escudoProvincia(p);
    return src ? el('span', {class: 'dd-champ'}, el('img', {src, class: 'escudo', alt: ''})) : null;
  };
  sel.poblar([{
    items: [{id: '', etq: TODAS}, ...provincias.map((p) => ({id: p, etq: p, derecha: img(p)}))],
  }]);

  function set(prov) {
    if (prov && !provincias.includes(prov)) return false;
    sel.setSeleccion(prov || '', prov || TODAS);
    return true;
  }

  set('');
  return {el: sel.el, set};
}
