# Estadísticas del Fútbol Argentino

Web de consulta histórica de estadísticas del fútbol argentino: **Primera División** (1891–2026),
**Segunda División** (1927–2026), **Tercera División** (1986/87–2026), **Cuarta División** (Primera C, 1986–2026)
y las principales copas nacionales e internacionales.

**Todo se calcula partido a partido**: las tablas de posiciones, los campeones y los históricos se
**derivan de los partidos individuales**, no se copian. Cuando un partido tuvo un resultado oficial
asimétrico (se dio por perdido a ambos equipos, o a uno empatado y al otro perdido), la tabla lo
indica con una nota debajo del total.

## Qué se puede consultar

- **Tabla histórica** — posiciones y campeones por torneo y por temporada, con fases
  (grupos, eliminatorias, liguillas) y fechas/jornadas expandibles. Todas las tablas de un torneo
  se ordenan por columna (por defecto, el orden oficial: puntos, diferencia de gol y goles a favor),
  y la tabla acumulada va al final, plegada.
  Sobre las fechas, un gráfico de **evolución de posiciones**: el puesto de cada club tras cada
  jornada (por zona en los torneos zonales), con los 5 primeros por defecto, la opción de sumar
  cualquier otro club y el detalle de cada fecha al pasar el mouse.
- **Segunda División** — el segundo nivel, de la Primera División B amateur de la AAF (1927) a la
  Primera Nacional, con el mismo detalle que la Tabla histórica: fases, zonas, reducidos,
  promociones, campeones, total histórico y evolución de posiciones por fecha.
- **Tercera División** — el tercer nivel: la Primera B Metropolitana (desde 1986/87) y el Torneo Federal A
  (desde 1995/96; Torneo Argentino A hasta 2013/14), cada uno con su propia vista en el menú Divisiones de Ascenso: sus
  fases,
  Reducido / Reválida, tercer ascenso, campeones y total histórico.
- **Cuarta División** — la Primera C (desde 1986), también en el menú Divisiones de Ascenso: torneos de liga, zonas,
  Apertura / Clausura, finales por el campeonato, Reducido y Octogonal por el segundo ascenso, promociones,
  campeones, total histórico y evolución de posiciones por fecha; incluye la temporada 2026 en curso.
- **Clubes** — todos los clubes relevados (escudo, nombre completo, localidad y provincia), en
  orden alfabético o por fecha de fundación y filtrables por provincia; cada uno lleva a su ficha.
- **Mano a mano** — historial de enfrentamientos entre dos clubes, con un gráfico de los partidos
  ganados acumulados por cada uno, año a año, para ver cuándo se revierte el historial.
- **Copas nacionales** — Copa Argentina (1969–70 y desde 2011) y demás copas nacionales, cada una
  con su palmarés (por club o cronológico), su tabla histórica y el detalle de cada edición; más
  una tabla histórica conjunta de todas las copas, eligiendo cuáles suman al total.
- **Copas internacionales** — Copa Libertadores, Copa Sudamericana, Recopa Sudamericana,
  Supercopa Sudamericana, Copa Máster de Supercopa, Copa Conmebol, Copa Conmebol Masters,
  Copa Mercosur, Copa de Oro, Copa Interamericana, Recopa Sudamericana de Clubes,
  Suruga Bank Championship, Copa Intercontinental, Mundial de Clubes de la FIFA (2000–2025) y
  Copa Intercontinental de la FIFA (2024–2025); más las rioplatenses históricas
  (Copa Aldao, Copa Escobar-Gerona, Copa de Honor Cousenier y Cup Tie Competition).
- **Campeones** — palmarés por club (ligas + copas), con desglose por título.
- **Efemérides** — qué pasó un día del año (clubes fundados, títulos ganados).
- **Resumen** — panorama estadístico de todo lo relevado (partidos, goles, equipos, récords),
  filtrable por años, ámbito (Primera, Segunda, Tercera, Cuarta, copas nacionales e internacionales) y competición.
- **Ficha de club** — datos del club, un gráfico de **posiciones por temporada** (puesto final en
  cada liga disputada, de Primera a Cuarta en la misma escala, con los años en las
  categorías inferiores sombreados y los títulos marcados) y su historial completo: por rival, por fecha, por
  competición y máximas goleadas a favor y en contra (ampliables de a 10). Filtrable por era,
  tipo de competición (Primera, Segunda, Tercera y Cuarta División, promociones, copas nacionales e
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
registros de la AFA. Las temporadas del ascenso que RSSSF no cubre (o cubre solo con tablas) se completan
partido a partido con [Wikipedia en español](https://es.wikipedia.org/) y el blog
[historiayfutbol](http://josecarluccio.blogspot.com/). Los datos se sirven precomputados como JSON en `data/`.

## Licencia

Los datos derivan de fuentes públicas (RSSSF, Wikipedia, historiayfutbol). Se distribuye para consulta y uso
personal; al reutilizar los datos, dar el crédito correspondiente a las fuentes originales.
