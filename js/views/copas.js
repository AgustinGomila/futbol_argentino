// Vista: Copas nacionales de primera división (1905–2025). Elegí una copa y una edición; se muestra
// el torneo organizado por fases (grupos → eliminatoria en cruces → 3er puesto) con la tabla total
// colapsable, vía el módulo compartido copas_fases. Datos: data/copas.json (extraído de RSSSF).

import {botonCSV, chipEnCurso, el, esEnCurso} from '../main.js';
import {loadJSON} from '../data.js';
import {renderCopaEdicion} from '../copas_fases.js';

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
  const idDe = {};
  if (registro) for (const [cid, c] of Object.entries(registro)) idDe[c.nombre] = cid;

  // Copa de Honor/Oro 1936 se cuentan como LIGA (aparecen en Tabla histórica), no acá.
  const esLiga = (c, e) => (c === 'Copa de Honor MCBA' || c === 'Copa de Oro') && e === 1936;
  const porComp = new Map();
  for (const m of copas) {
    if (m.e != null && esLiga(m.c, m.e)) continue;
    if (!porComp.has(m.c)) porComp.set(m.c, new Set());
    if (m.e != null) porComp.get(m.c).add(m.e);
  }
  for (const [c, eds] of [...porComp]) if (!eds.size) porComp.delete(c);
  const comps = [...porComp.keys()].sort();

  const compSel = el('select', {class: 'filtro'}, ...comps.map(c => el('option', {value: c}, c)));
  const ediSel = el('select', {class: 'filtro'});
  const salida = el('div', {class: 'tabla-wrap'});

  function llenarEdiciones() {
    const eds = [...porComp.get(compSel.value)].sort((a, b) => b - a);
    ediSel.replaceChildren(...eds.map(e => el('option', {value: e},
      esEnCurso(compSel.value, e) ? `${e} (en curso)` : String(e))));
    mostrar();
  }

  function mostrar() {
    const c = compSel.value, e = +ediSel.value;
    const ms = copas.filter(m => m.c === c && m.e === e);
    if (!ms.length) {
      salida.replaceChildren(el('p', {class: 'placeholder'}, 'Sin partidos.'));
      return;
    }
    const man = campManual && campManual[`${c}|${e}`];
    const camp = campCopa && campCopa[`${c}|${e}`];
    const kids = [el('div', {class: 'resumen'}, el('span', {}, `${ms.length} partidos`),
      el('span', {class: 'sub'}, `${c} · ${e || '—'}`))];
    if (esEnCurso(c, e)) kids.push(chipEnCurso());   // copa en juego (aún sin campeón)
    kids.push(...renderCopaEdicion(ms, {
      escudos, idDe,
      campeon: (camp && camp.campeon) || (man && man.campeon),
      sub: (camp && camp.sub) || (man && man.sub),
      nota: man && man.nota,
      grupos: copasGrupos && copasGrupos[`${c}|${e}`],
      icono: iconos && iconos[c],   // #11: ícono por competencia
    }));
    salida.replaceChildren(...kids);
  }

  compSel.addEventListener('change', llenarEdiciones);
  ediSel.addEventListener('change', mostrar);

  // #15: exportar a CSV la edición de copa mostrada (todas sus tablas: grupos, cruces, etc.).
  const btnExport = botonCSV(
    () => `${(compSel.value || 'copa').replace(/\s+/g, '_')}_${ediSel.value || ''}`,
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
    el('div', {class: 'controles'}, compSel, ediSel, btnExport),
    salida);

  if (params.c && porComp.has(params.c)) compSel.value = params.c;
  llenarEdiciones();
  if (params.e != null && [...ediSel.options].some(o => o.value === String(params.e))) {
    ediSel.value = String(params.e);
    mostrar();
  }
}
