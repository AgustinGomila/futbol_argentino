// Vista: Efemérides (#/efemerides). Para un día del año (por defecto HOY) muestra:
//  - clubes fundados ese día (registro.json, fecha de fundación completa DD/MM/YYYY),
//  - títulos internacionales ganados ese día (fecha del partido decisivo de la Final + campeón),
//  - títulos de copas nacionales ganados ese día (copas.json fase Final + campeones_copa.json).
// Todo se computa en el cliente desde los JSON ya publicados; sólo entran eventos con fecha completa.
// Los campeonatos de LIGA no aparecen: son de temporada (no tienen un día único).

import {clubHref, el} from '../main.js';
import {loadJSON} from '../data.js';
import {chip, chipClub, clubIndex} from '../clubes_ui.js';
import {COPAS_INTL as INTL} from '../competiciones.js';
import {banderaPais, PAIS_ES} from '../paises.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export async function render(container, params = {}) {
  const [registro, escudos, copas, campCopa, ...rest] = await Promise.all([
    loadJSON('registro'), loadJSON('escudos'), loadJSON('copas'), loadJSON('campeones_copa'),
    ...INTL.map(([b]) => loadJSON(b)),
    ...INTL.map(([b]) => loadJSON(b + '_campeones')),
  ]);
  const matchJsons = rest.slice(0, INTL.length);
  const campJsons = rest.slice(INTL.length);

  if (!registro) {
    container.append(el('h2', {}, 'Efemérides'),
      el('p', {class: 'error'}, 'No se pudo cargar el registro. Corré scripts/build_web.py.'));
    return;
  }

  // nombre -> id (para enlazar clubes; los campeones argentinos calzan tal cual, incl. 'Estudiantes
  // (La Plata)'; los extranjeros traen país y no calzan -> quedan en texto plano).
  const nombreToId = {};
  const eventos = [];   // {mes, dia, anio, tipo, ...}

  // --- fundaciones (y disoluciones) de clubes ---
  for (const [id, c] of Object.entries(registro)) {
    nombreToId[c.nombre] = id;
    const mf = DMY.exec(c.fundacion || '');
    if (mf) eventos.push({mes: +mf[2], dia: +mf[1], anio: +mf[3], tipo: 'fund', clubId: id, nombre: c.nombre});
    const md = DMY.exec(c.disolucion || '');
    if (md) eventos.push({mes: +md[2], dia: +md[1], anio: +md[3], tipo: 'dis', clubId: id, nombre: c.nombre});
  }

  // País de cada club en las copas internacionales: el código más frecuente entre sus partidos (pl/pv), mismo
  // criterio que las vistas de copas. Un club del registro sin código es argentino.
  const paisCuenta = new Map();
  for (const ms of matchJsons) {
    for (const m of ms || []) {
      for (const [n, p] of [[m.l, m.pl], [m.v, m.pv]]) {
        if (!p) continue;
        if (!paisCuenta.has(n)) paisCuenta.set(n, {});
        const c = paisCuenta.get(n);
        c[p] = (c[p] || 0) + 1;
      }
    }
  }
  const paisDe = (n) => {
    const c = paisCuenta.get(n);
    return c ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : (nombreToId[n] ? 'Arg' : '');
  };

  // --- títulos internacionales: fecha del partido decisivo de la Final (máx fecha por edición) ---
  INTL.forEach(([, label, ruta], i) => {
    const ms = matchJsons[i] || [];
    const camp = campJsons[i] || {};
    const fechaEd = {};   // edición -> fecha ISO más tardía entre las finales
    for (const m of ms) {
      if (String(m.r || '').trim().toLowerCase() !== 'final') continue;
      const f = String(m.f || '');
      if (!ISO.test(f)) continue;
      const e = String(m.e);
      if (!fechaEd[e] || f > fechaEd[e]) fechaEd[e] = f;
    }
    for (const [e, f] of Object.entries(fechaEd)) {
      const campeon = camp[e];
      if (!campeon) continue;
      const g = ISO.exec(f);
      eventos.push({mes: +g[2], dia: +g[3], anio: +g[1], tipo: 'intl', label, ruta, campeon, edicion: e});
    }
  });

  // --- títulos de copas nacionales: fase Final con fecha completa + campeón de campeones_copa ---
  const fechaCopa = {};   // 'Copa|edición' -> fecha ISO más tardía
  for (const m of (copas || [])) {
    if (String(m.fase || '').trim().toLowerCase() !== 'final') continue;
    const f = String(m.f || '');
    if (!ISO.test(f)) continue;
    const key = `${m.c}|${m.e}`;
    if (!fechaCopa[key] || f > fechaCopa[key]) fechaCopa[key] = f;
  }
  for (const [key, f] of Object.entries(fechaCopa)) {
    const rec = (campCopa || {})[key];
    if (!rec || !rec.campeon) continue;
    const [comp, edicion] = key.split('|');
    const g = ISO.exec(f);
    eventos.push({
      mes: +g[2],
      dia: +g[3],
      anio: +g[1],
      tipo: 'copa',
      comp,
      edicion,
      campeon: rec.campeon,
      ruta: '#/copas'
    });
  }

  // --- estado: día seleccionado (por defecto HOY) ---
  const hoy = new Date();
  const estado = {mes: hoy.getMonth() + 1, dia: hoy.getDate()};
  const qm = +params.m, qd = +params.d;   // enlazable: #/efemerides?m=10&d=25
  if (qm >= 1 && qm <= 12 && qd >= 1 && qd <= 31) {
    estado.mes = qm;
    estado.dia = qd;
  }
  const anioActual = hoy.getFullYear();

  const {label} = clubIndex(registro);   // nombre común a mostrar (el vínculo sigue por nombreToId -> id)
  const esc = (n) => (escudos && escudos[n])
    ? el('img', {src: 'images/' + escudos[n], class: 'escudo', alt: ''}) : null;
  // Club con ficha (registro) -> chip como en la sección Clubes (escudo grande, sin subrayado); el resto
  // (extranjeros / sin registro) -> escudo + nombre, sin enlace.
  const clubCell = (n) => {
    const cid = nombreToId[n];
    return cid ? chipClub(cid, registro[cid]) : el('span', {}, ...[esc(n), label(n)].filter(Boolean));
  };
  // Títulos internacionales: chip con el PAÍS (bandera + nombre) debajo del club, en vez de la localidad. Los
  // clubes con ficha enlazan; los extranjeros son un chip estático. El nombre pierde el '(País)' final si lo trae.
  const chipIntl = (n) => {
    const cid = nombreToId[n];
    const cod = paisDe(n);
    const pais = PAIS_ES[cod] || '';
    let nombre = cid ? (registro[cid].nombre_completo || label(n)) : label(n);
    if (pais && nombre.endsWith(` (${pais})`)) nombre = nombre.slice(0, -(pais.length + 3));
    const band = banderaPais(cod);
    return chip({
      href: cid ? clubHref(cid) : null,
      escudo: cid ? registro[cid].escudo : (escudos && escudos[n]),
      nombre,
      sub: pais ? el('span', {class: 'club-chip-pais'},
        band ? el('img', {class: 'bandera', src: band, alt: ''}) : '', pais) : '',
    });
  };
  // Campeón: string o {c, co, nota} (título compartido, ej. Copa Escobar-Gerona 1945) -> uno o dos chips.
  const campeonesIntl = (v) => {
    const ns = typeof v === 'string' ? [v] : [v.c, v.co].filter(Boolean);
    return ns.length > 1 ? el('span', {class: 'efem-chips'}, ...ns.map(chipIntl)) : chipIntl(ns[0]);
  };
  const hace = (anio) => {
    const n = anioActual - anio;
    return n === 1 ? 'hace 1 año' : `hace ${n} años`;
  };

  // --- controles de fecha ---
  const selMes = el('select', {class: 'filtro'},
    ...MESES.map((m, i) => el('option', {value: String(i + 1)}, m[0].toUpperCase() + m.slice(1))));
  const selDia = el('select', {class: 'filtro'});
  const diasEnMes = (mes) => new Date(2024, mes, 0).getDate();   // 2024 bisiesto: permite 29/2
  const poblarDias = () => {
    const max = diasEnMes(estado.mes);
    if (estado.dia > max) estado.dia = max;
    selDia.replaceChildren(...Array.from({length: max}, (_, i) =>
      el('option', {value: String(i + 1)}, String(i + 1))));
    selDia.value = String(estado.dia);
  };
  selMes.value = String(estado.mes);
  poblarDias();

  const salida = el('div', {class: 'efem-salida'});

  const bloque = (titulo, items, fmt) => items.length
    ? el('section', {class: 'efem-bloque'},
      el('h3', {class: 'efem-titulo'}, `${titulo} (${items.length})`),
      el('ul', {class: 'efem-lista'}, ...items.map(fmt)))
    : null;

  function dibujar() {
    const delDia = eventos.filter(e => e.mes === estado.mes && e.dia === estado.dia);
    const funds = delDia.filter(e => e.tipo === 'fund').sort((a, b) => a.anio - b.anio);
    const dis = delDia.filter(e => e.tipo === 'dis').sort((a, b) => a.anio - b.anio);
    const intl = delDia.filter(e => e.tipo === 'intl').sort((a, b) => b.anio - a.anio);
    const copa = delDia.filter(e => e.tipo === 'copa').sort((a, b) => b.anio - a.anio);

    const encabezado = el('p', {class: 'efem-fecha'},
      `${estado.dia} de ${MESES[estado.mes - 1]}`);

    const bloques = [
      bloque('🎂 Clubes fundados', funds, (e) => el('li', {class: 'efem-item'},
        clubCell(e.nombre),
        el('span', {class: 'efem-detalle'}, `${hace(e.anio)} · ${e.anio}`))),
      bloque('🏆 Títulos internacionales', intl, (e) => el('li', {class: 'efem-item'},
        campeonesIntl(e.campeon),
        el('span', {class: 'efem-detalle'},
          el('a', {href: `${e.ruta}?e=${e.edicion}`}, `${e.label} ${e.edicion}`),
          ` · ${hace(e.anio)}`))),
      bloque('🏆 Copas nacionales', copa, (e) => el('li', {class: 'efem-item'},
        clubCell(e.campeon),
        el('span', {class: 'efem-detalle'},
          el('a', {href: `${e.ruta}?c=${encodeURIComponent(e.comp)}&e=${encodeURIComponent(e.edicion)}`},
            `${e.comp} ${e.edicion}`),
          ` · ${hace(e.anio)}`))),
      bloque('⚰️ Clubes desaparecidos', dis, (e) => el('li', {class: 'efem-item'},
        clubCell(e.nombre),
        el('span', {class: 'efem-detalle'}, `${hace(e.anio)} · ${e.anio}`))),
    ].filter(Boolean);

    salida.replaceChildren(encabezado,
      bloques.length ? el('div', {}, ...bloques)
        : el('p', {class: 'nota'}, 'No hay efemérides registradas para este día.'));
  }

  selMes.addEventListener('change', () => {
    estado.mes = +selMes.value;
    poblarDias();
    dibujar();
  });
  selDia.addEventListener('change', () => {
    estado.dia = +selDia.value;
    dibujar();
  });
  const btnHoy = el('button', {type: 'button', class: 'btn-csv'}, 'Hoy');
  btnHoy.addEventListener('click', () => {
    estado.mes = hoy.getMonth() + 1;
    estado.dia = hoy.getDate();
    selMes.value = String(estado.mes);
    poblarDias();
    dibujar();
  });

  container.append(
    el('h2', {}, 'Efemérides'),
    el('p', {class: 'nota'},
      'Qué pasó un día como hoy: clubes fundados y títulos (internacionales y copas nacionales) '
      + 'ganados en esta fecha. Sólo se listan eventos con fecha exacta conocida; los campeonatos de '
      + 'liga no aparecen porque se definen a lo largo de una temporada, no en un día.'),
    el('div', {class: 'controles'}, selMes, selDia, btnHoy),
    salida);
  dibujar();
}
