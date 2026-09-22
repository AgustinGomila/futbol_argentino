# Estadísticas del Fútbol Argentino

Web de consulta histórica de estadísticas del fútbol argentino: **Primera División** (1891–2026),
**Segunda División** (1927–2026) y las principales copas nacionales e internacionales.

**Todo se calcula partido a partido**: las tablas de posiciones, los campeones y los históricos se
**derivan de los partidos individuales**, no se copian. Cuando un partido tuvo un resultado oficial
asimétrico (se dio por perdido a ambos equipos, o a uno empatado y al otro perdido), la tabla lo
indica con una nota debajo del total.

## Qué se puede consultar

- **Tabla histórica** — posiciones y campeones por torneo y por temporada, con fases
  (grupos, eliminatorias, liguillas) y fechas/jornadas expandibles.
- **Segunda División** — el segundo nivel, de la Primera División B amateur de la AAF (1927) a la
  Primera Nacional, con el mismo detalle que la Tabla histórica: fases, zonas, reducidos,
  promociones, campeones y total histórico.
- **Clubes** — todos los clubes relevados (escudo, nombre completo, localidad y provincia), en
  orden alfabético o por fecha de fundación y filtrables por provincia; cada uno lleva a su ficha.
- **Mano a mano** — historial de enfrentamientos entre dos clubes.
- **Copas nacionales** — Copa Argentina (1969–70 y desde 2011) y demás copas nacionales, cada una
  con su palmarés (por club o cronológico), su tabla histórica y el detalle de cada edición; más
  una tabla histórica conjunta de todas las copas, eligiendo cuáles suman al total.
- **Copas internacionales** — Copa Libertadores, Copa Sudamericana, Recopa Sudamericana,
  Supercopa Sudamericana, Copa Máster de Supercopa, Copa Conmebol, Copa Conmebol Masters,
  Copa Mercosur, Copa de Oro, Copa Interamericana, Recopa Sudamericana de Clubes,
  Suruga Bank Championship y Copa Intercontinental; más las rioplatenses históricas
  (Copa Aldao, Copa Escobar-Gerona, Copa de Honor Cousenier y Cup Tie Competition).
- **Campeones** — palmarés por club (ligas + copas), con desglose por título.
- **Efemérides** — qué pasó un día del año (clubes fundados, títulos ganados).
- **Resumen** — panorama estadístico de todo lo relevado (partidos, goles, equipos, récords),
  filtrable por años, ámbito (Primera, Segunda, copas nacionales e internacionales) y competición.
- **Ficha de club** — datos del club y su historial completo: por rival, por fecha, por
  competición y máximas goleadas a favor y en contra (ampliables de a 10). Filtrable por era,
  tipo de competición (Primera División, Segunda División, promociones, copas nacionales e
  internacionales), fase y país del rival. Incluye las promociones y torneos promocionales con
  otras categorías, que para algunos clubes son sus únicos partidos relevados.

## Ejecutar localmente

Es un sitio **estático** (módulos ES, sin build ni framework). Alcanza con servir la carpeta:

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Datos

Fuente base: [RSSSF](https://www.rsssf.org/) (Rec.Sport.Soccer Statistics Foundation) y
registros de la AFA. Los datos se sirven precomputados como JSON en `data/`.

## Licencia

Los datos derivan de fuentes públicas (RSSSF). Se distribuye para consulta y uso
personal; al reutilizar los datos, dar el crédito correspondiente a las fuentes originales.
