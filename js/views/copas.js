// Vista: Copas nacionales de primera división (1905–2025). Elegí una copa y una edición; se muestra
// el torneo organizado por fases (grupos → eliminatoria en cruces → 3er puesto) con la tabla total
// colapsable, vía el módulo compartido copas_fases. Datos: data/copas.json (extraído de RSSSF).

import {botonCSV, chipEnCurso, copaStats, el, esEnCurso, setEstadoRuta} from '../main.js';
import {loadJSON} from '../data.js';
import {renderCopaEdicion} from '../copas_fases.js';
import {crearSelectorRico} from '../dropdown.js';
import {clubIndex} from '../clubes_ui.js';

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

  // Copa de Honor/Oro 1936 se cuentan como LIGA (aparecen en Tabla histórica), no acá: build_web ya las
  // excluye de copas.json (son la liga 1936), así que no llegan a esta vista.
  const porComp = new Map();
  for (const m of copas) {
    if (!porComp.has(m.c)) porComp.set(m.c, new Set());
    if (m.e != null) porComp.get(m.c).add(m.e);
  }
  for (const [c, eds] of [...porComp]) if (!eds.size) porComp.delete(c);
  const comps = [...porComp.keys()].sort();

  const compSel = el('select', {class: 'filtro'}, ...comps.map(c => el('option', {value: c}, c)));
  const salida = el('div', {class: 'tabla-wrap'});

  // Campeón de una edición (campeones_copa tiene precedencia sobre copa_campeones, igual que en mostrar()).
  const campeonDe = (c, e) => {
    const camp = campCopa && campCopa[`${c}|${e}`];
    const man = campManual && campManual[`${c}|${e}`];
    return (camp && camp.campeon) || (man && man.campeon) || '';
  };
  const esc = (n) => (escudos && escudos[n])
    ? el('img', {class: 'escudo', src: `images/${escudos[n]}`, alt: '', loading: 'lazy'}) : null;
  // Celda derecha del desplegable de ediciones: escudo + nombre del campeón (o "en curso" si está en juego).
  const champCell = (c, e) => {
    const w = campeonDe(c, e);
    if (!w) return el('span', {class: 'dd-champ vacio'}, esEnCurso(c, e) ? 'en curso' : '');
    return el('span', {class: 'dd-champ', title: 'Campeón: ' + label(w)},
      ...[esc(w), el('span', {class: 'dd-camp-n'}, label(w))].filter(Boolean));
  };

  // Selector de Edición: desplegable RICO (dropdown.js), mismo que la Tabla histórica y las copas
  // internacionales; muestra el campeón con su escudo a la derecha de cada año.
  let edActual = null;
  const selectorEd = crearSelectorRico({
    placeholder: 'Edición',
    onElegir: (id) => {
      edActual = +id;
      selectorEd.setSeleccion(id, esEnCurso(compSel.value, edActual) ? `${edActual} (en curso)` : String(edActual));
      mostrar();
    },
  });

  function llenarEdiciones() {
    const c = compSel.value;
    const eds = [...porComp.get(c)].sort((a, b) => b - a);
    selectorEd.poblar([{
      items: eds.map(e => ({
        id: e, etq: esEnCurso(c, e) ? `${e} (en curso)` : String(e), title: String(e), derecha: champCell(c, e),
      }))
    }]);
    edActual = eds[0];
    selectorEd.setSeleccion(edActual, esEnCurso(c, edActual) ? `${edActual} (en curso)` : String(edActual));
    mostrar();
  }

  function mostrar() {
    const c = compSel.value, e = edActual;
    setEstadoRuta({c, e});   // guarda copa+edición en la URL: al volver con "Atrás" se restauran
    const ms = copas.filter(m => m.c === c && m.e === e);
    if (!ms.length) {
      salida.replaceChildren(el('p', {class: 'placeholder'}, 'Sin partidos.'));
      return;
    }
    const man = campManual && campManual[`${c}|${e}`];
    const camp = campCopa && campCopa[`${c}|${e}`];
    const kids = [];
    if (esEnCurso(c, e)) kids.push(chipEnCurso());   // copa en juego (aún sin campeón)
    kids.push(...renderCopaEdicion(ms, {
      escudos, idDe, label,
      campeon: (camp && camp.campeon) || (man && man.campeon),
      sub: (camp && camp.sub) || (man && man.sub),
      nota: man && man.nota,
      // Resumen (equipos/partidos/goles/prom), mismo formato que las copas internacionales; se renderiza
      // debajo del campeón (copas_fases lo inserta tras el podio).
      resumen: copaStats(ms),
      grupos: copasGrupos && copasGrupos[`${c}|${e}`],
      icono: iconos && iconos[c],   // #11: ícono por competencia
    }));
    salida.replaceChildren(...kids);
  }

  compSel.addEventListener('change', llenarEdiciones);

  // #15: exportar a CSV la edición de copa mostrada (todas sus tablas: grupos, cruces, etc.).
  const btnExport = botonCSV(
    () => `${(compSel.value || 'copa').replace(/\s+/g, '_')}_${edActual || ''}`,
    () => {
      const tbs = [...salida.querySelectorAll('table')];
      if (!tbs.length) return null;
      return tbs.map((tb) => {
        let h = tb.previousElementSibling;
        while (h && !/^H[3-5]$/.test(h.tagName)) h = h.previousElementSibling;
        return [h ? h.textContent.trim() : '', tb];
      });
    });

  container.append(
    el('h2', {}, 'Copas nacionales'),
    el('p', {class: 'nota'},
      'Copas de primera división (1905–2025), extraídas de RSSSF. Los nombres de clubes de '
      + 'ascenso/interior están en convergencia (data/clubes_copas.csv).'),
    el('div', {class: 'controles'}, compSel, el('label', {}, 'Edición '), selectorEd.el, btnExport),
    salida);

  if (params.c && porComp.has(params.c)) compSel.value = params.c;
  llenarEdiciones();
  if (params.e != null && porComp.get(compSel.value).has(+params.e)) {
    edActual = +params.e;
    selectorEd.setSeleccion(edActual, esEnCurso(compSel.value, edActual) ? `${edActual} (en curso)` : String(edActual));
    mostrar();
  }
}
