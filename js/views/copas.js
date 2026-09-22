// Vista: una copa nacional de primera división (1905–2026). La copa se elige en el desplegable "Copas
// nacionales" del nav (#/copas?c=Copa%20Argentina). Igual que las copas internacionales, tres modos:
// Palmarés (títulos por club / cronológico), Tabla histórica (la de copas-historica.js filtrada a esta
// copa) y Por edición (torneo organizado por fases vía copas_fases) + exportación a CSV.
// Datos: data/copas.json (extraído de RSSSF), campeones_copa / copa_campeones.

import {botonCSV, chipEnCurso, clubHref, copaStats, el, esEnCurso, setEstadoRuta} from '../main.js';
import {loadJSON} from '../data.js';
import {renderCopaEdicion} from '../copas_fases.js';
import {crearSelectorRico} from '../dropdown.js';
import {clubIndex, fusionNombre} from '../clubes_ui.js';
import {render as renderHistorica} from './copas-historica.js';

const COPA_DEFAULT = 'Copa Argentina';

export async function render(container, params = {}) {
  const [copas, escudos, registro, campManual, campCopa, copasGrupos, iconos] = await Promise.all([
    loadJSON('copas'), loadJSON('escudos'), loadJSON('registro'),
    loadJSON('copa_campeones'), loadJSON('campeones_copa'), loadJSON('copas_grupos'), loadJSON('iconos')]);
  if (!copas || !copas.length) {
    container.append(el('h2', {}, 'Copas'),
      el('p', {class: 'error'},
        'No se pudieron cargar las copas. Corré scripts/copas_parse.py y scripts/build_web.py.'));
    return;
  }
  const {idDe, label} = clubIndex(registro);   // idDe: enlace por id · label: nombre común mostrado
  // Fusiones (origen -> destino): en el palmarés los títulos del club de origen se atribuyen al destino,
  // mismo criterio que la Tabla histórica (copas-historica.js).
  const fus = fusionNombre(registro);
  const canon = (n) => fus[n] || n;

  // Copa de Honor/Oro 1936 se cuentan como LIGA (aparecen en Tabla histórica), no acá: build_web ya las
  // excluye de copas.json (son la liga 1936), así que no llegan a esta vista.
  const porComp = new Map();
  for (const m of copas) {
    if (m.e == null) continue;
    if (!porComp.has(m.c)) porComp.set(m.c, new Set());
    porComp.get(m.c).add(m.e);
  }
  const c = porComp.has(params.c) ? params.c
    : porComp.has(COPA_DEFAULT) ? COPA_DEFAULT : [...porComp.keys()].sort()[0];
  const lista = copas.filter((m) => m.c === c && m.e != null);
  const ediciones = [...porComp.get(c)].sort((a, b) => b - a);
  const rango = ediciones.length > 1 ? `${ediciones.at(-1)}–${ediciones[0]}` : String(ediciones[0]);

  // Campeón de una edición (campeones_copa tiene precedencia sobre copa_campeones).
  const datosEd = (e) => {
    const camp = campCopa && campCopa[`${c}|${e}`];
    const man = campManual && campManual[`${c}|${e}`];
    return {
      campeon: (camp && camp.campeon) || (man && man.campeon) || '',
      sub: (camp && camp.sub) || (man && man.sub) || '',
      nota: (man && man.nota) || '',
    };
  };
  const esc = (n) => (escudos && escudos[n])
    ? el('img', {class: 'escudo', src: `images/${escudos[n]}`, alt: '', loading: 'lazy'}) : null;
  const celdaClub = (n) => {
    const cuerpo = el('span', {class: 'eq-cell'}, ...[esc(n), el('span', {class: 'eq-nombre'}, label(n))].filter(Boolean));
    const id = idDe[n];
    return id ? el('a', {href: clubHref(id)}, cuerpo) : cuerpo;
  };
  const etqEd = (e) => esEnCurso(c, e) ? `${e} (en curso)` : String(e);

  const cont = el('div', {});
  let edActual = ediciones[0];
  let modoActual = 'Tabla histórica';

  // enlace a una edición: cambia al modo "Por edición" y la selecciona
  const edLink = (e) => {
    const a = el('a', {href: '#', class: 'lib-ed-link'}, String(e));
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      edActual = e;
      activar('Por edición');
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
    return a;
  };

  // ---- Palmarés: 'Por club' (clubes por cantidad de títulos) y 'Cronológico' (edición -> campeón) ----
  let palModo = 'club';

  function verPalmares() {
    const nav = el('div', {class: 'sub-modos'});
    for (const [k, lbl] of [['club', 'Por club'], ['crono', 'Cronológico']]) {
      const b = el('button', {class: 'sub-modo-btn' + (palModo === k ? ' activo' : ''), type: 'button'}, lbl);
      b.addEventListener('click', () => {
        palModo = k;
        verPalmares();
      });
      nav.append(b);
    }
    const edsCamp = ediciones.filter((e) => datosEd(e).campeon);
    if (!edsCamp.length) {
      cont.replaceChildren(nav, el('p', {class: 'placeholder'}, 'Sin campeones registrados.'));
      return;
    }
    cont.replaceChildren(nav, ...(palModo === 'crono' ? palmaresCrono(edsCamp) : palmaresPorClub(edsCamp)));
  }

  function palmaresPorClub(edsCamp) {
    const rec = new Map();   // club canónico -> {tit, anios[], eds:Set}
    const get = (n) => {
      if (!rec.has(n)) rec.set(n, {tit: 0, anios: [], eds: new Set()});
      return rec.get(n);
    };
    for (const m of lista) {
      get(canon(m.l)).eds.add(m.e);
      get(canon(m.v)).eds.add(m.e);
    }
    for (const e of edsCamp) {
      const r = get(canon(datosEd(e).campeon));
      r.tit++;
      r.anios.push(e);
    }
    const clubes = [...rec.entries()].filter(([, r]) => r.tit > 0)
      .sort((a, b) => b[1].tit - a[1].tit || label(a[0]).localeCompare(label(b[0])));
    const tb = el('table', {class: 'tabla-lib'});
    tb.append(el('tr', {}, el('th', {class: 'pos'}, 'Pos'), el('th', {}, 'Club'), el('th', {}, 'Part.'),
      el('th', {}, 'Títulos'), el('th', {}, 'Años')));
    clubes.forEach(([n, r], i) => {
      const links = [];
      r.anios.slice().sort((a, b) => a - b).forEach((e, k) => {
        if (k) links.push(', ');
        links.push(edLink(e));
      });
      tb.append(el('tr', {},
        el('td', {class: 'pos'}, String(i + 1)),
        el('td', {}, celdaClub(n)),
        el('td', {}, String(r.eds.size)),
        el('td', {class: 'titulos'}, String(r.tit)),
        el('td', {class: 'lib-anios'}, ...links)));
    });
    return [el('p', {class: 'sub'}, `${clubes.length} ${clubes.length === 1 ? 'club campeón' : 'clubes campeones'} (${rango}).`),
      el('div', {class: 'tabla-wrap'}, tb)];
  }

  function palmaresCrono(edsCamp) {
    const tb = el('table', {class: 'tabla-lib'});
    tb.append(el('tr', {}, el('th', {}, 'Edición'), el('th', {}, 'Campeón'), el('th', {}, 'Subcampeón')));
    for (const e of edsCamp) {
      const {campeon, sub} = datosEd(e);
      tb.append(el('tr', {},
        el('td', {class: 'lib-anios'}, edLink(e)),
        el('td', {}, celdaClub(campeon)),
        el('td', {}, sub ? celdaClub(sub) : '')));
    }
    return [el('p', {class: 'sub'}, `${edsCamp.length} ediciones con campeón (${rango}).`),
      el('div', {class: 'tabla-wrap'}, tb)];
  }

  // ---- Tabla histórica: la de copas-historica.js restringida a esta copa ----
  async function verHistorica() {
    const destino = el('div', {});
    cont.replaceChildren(destino);
    await renderHistorica(destino, {}, {soloComp: c});
  }

  // ---- Por edición: selector rico de ediciones (con el campeón a la derecha) + torneo por fases ----
  const champCell = (e) => {
    const w = datosEd(e).campeon;
    if (!w) return el('span', {class: 'dd-champ vacio'}, esEnCurso(c, e) ? 'en curso' : '');
    return el('span', {class: 'dd-champ', title: 'Campeón: ' + label(w)},
      ...[esc(w), el('span', {class: 'dd-camp-n'}, label(w))].filter(Boolean));
  };
  const selectorEd = crearSelectorRico({
    placeholder: 'Edición',
    onElegir: (id) => verEdicion(+id),
  });
  selectorEd.poblar([{
    items: ediciones.map((e) => ({id: e, etq: etqEd(e), title: String(e), derecha: champCell(e)})),
  }]);
  // El selector va FUERA de `cont`: el .tabla-wrap de las tablas recortaría su panel desplegable.
  const edFiltros = el('div', {class: 'filtros'}, el('label', {}, 'Edición '), selectorEd.el);

  function verEdicion(e) {
    edActual = e;
    setEstadoRuta({c, e});   // guarda copa+edición en la URL: al volver con "Atrás" se restauran
    selectorEd.setSeleccion(e, etqEd(e));
    const ms = lista.filter((m) => m.e === e);
    if (!ms.length) {
      cont.replaceChildren(el('p', {class: 'placeholder'}, 'Sin partidos.'));
      return;
    }
    const {campeon, sub, nota} = datosEd(e);
    const kids = [];
    if (esEnCurso(c, e)) kids.push(chipEnCurso());   // copa en juego (aún sin campeón)
    kids.push(...renderCopaEdicion(ms, {
      escudos, idDe, label,
      campeon: campeon || undefined,
      sub: sub || undefined,
      nota: nota || undefined,
      // Resumen (equipos/partidos/goles/prom), mismo formato que las copas internacionales; se renderiza
      // debajo del campeón (copas_fases lo inserta tras el podio).
      resumen: copaStats(ms),
      grupos: copasGrupos && copasGrupos[`${c}|${e}`],
      icono: iconos && iconos[c],   // #11: ícono por competencia
    }));
    cont.replaceChildren(el('div', {class: 'tabla-wrap'}, ...kids));
  }

  // ---- barra de modos + CSV ----
  const barra = el('div', {class: 'lib-modos'});
  const botones = {};

  function activar(nombre) {
    modoActual = nombre;
    for (const [k, b] of Object.entries(botones)) b.classList.toggle('activo', k === nombre);
    edFiltros.style.display = nombre === 'Por edición' ? '' : 'none';
    if (nombre === 'Palmarés') {
      setEstadoRuta({c, modo: 'palmares'});
      verPalmares();
    } else if (nombre === 'Tabla histórica') {
      setEstadoRuta({c});
      verHistorica();
    } else {
      verEdicion(edActual);
    }
  }

  for (const m of ['Palmarés', 'Tabla histórica', 'Por edición']) {
    const b = el('button', {class: 'modo-btn', type: 'button'}, m);
    b.addEventListener('click', () => activar(m));
    botones[m] = b;
    barra.append(b);
  }

  // #15: exportar a CSV lo que se está mostrando (palmarés / tabla histórica / la edición elegida).
  const nombreCSV = () => {
    const base = c.replace(/\s+/g, '_');
    if (modoActual === 'Por edición') return `${base}_${edActual}`;
    return `${base}_${modoActual === 'Palmarés' ? 'palmares' : 'historica'}`;
  };
  barra.append(botonCSV(nombreCSV, () => {
    const tbs = [...cont.querySelectorAll('table')];
    if (!tbs.length) return null;
    return tbs.map((tb) => {
      let h = tb.previousElementSibling;
      while (h && !/^H[3-5]$/.test(h.tagName)) h = h.previousElementSibling;
      return [h ? h.textContent.trim() : '', tb];
    });
  }));

  container.classList.add('lib-vista');
  edFiltros.style.display = 'none';
  container.append(
    el('h2', {}, c),
    barra, edFiltros, cont);

  // Enlace directo a una edición (?e=YYYY, ej. desde Campeones o la ficha de un club) -> "Por edición".
  // También restaura el modo guardado al volver con "Atrás" (?modo=palmares).
  if (params.e != null && porComp.get(c).has(+params.e)) {
    edActual = +params.e;
    activar('Por edición');
  } else if (params.modo === 'palmares') {
    activar('Palmarés');
  } else {
    activar('Tabla histórica');
  }
}
