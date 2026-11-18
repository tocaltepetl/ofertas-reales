# Cómo contribuir

Este catálogo lo mantiene la comunidad. Las promociones cambian a diario y los bancos se contradicen, así que cada persona que confirma un dato con su propia compra o con una captura lo hace más confiable para todos.

No necesitas programar para ayudar. Lo más valioso es **confirmar promos**.

## Qué hace falta ahora

[`docs/pendientes.md`](docs/pendientes.md) lista las promociones dudosas, con lo que falta en cada una, y cuántas no ha revisado ninguna persona. Se regenera con `npm run pendientes`.

## 1. Confirmar o corregir una promoción (sin programar)

Abre un issue con la plantilla **Confirmar una promoción** y llena:

- **El id de la promo** (por ejemplo `amz-hsbcbf26`). Está en `docs/pendientes.md` o en el archivo YAML del comercio.
- **Qué viste:** el porcentaje, el mínimo, el tope, si se combina con otra, o cuánto te llegó de bonificación y cuándo.
- **La evidencia:** el enlace a las condiciones oficiales (mejor si es el PDF del banco o del comercio), una captura de pantalla, o una foto del ticket o del estado de cuenta.

**Cuida tus datos.** Antes de subir una captura de tu estado de cuenta o ticket, tapa el número de tarjeta, tu nombre, tu dirección y cualquier folio. Solo necesitamos ver el concepto, la fecha y el monto.

Las mejores evidencias, en orden:

1. Las condiciones oficiales del banco o del comercio (PDF o página), con su fecha.
2. Lo que pasó en una compra real: el cupón se aplicó o no, el banco difirió o no, la bonificación llegó o no.
3. Lo que dice la página o la app del comercio.
4. Foros y agregadores (Promodescuentos, notas de prensa): sirven como pista, pero no bastan para confirmar.

## 2. Mandar un cambio (pull request)

### Preparar el entorno

Requisitos: Node 22.18 o más reciente y Python 3 (solo para capturar fuentes).

```sh
npm install
npm run validar   # revisa el catálogo contra el esquema
npm test          # pruebas del motor
npm run web       # versión web local en http://127.0.0.1:8766
```

### Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `catalogo/eventos/<evento>/promos/<comercio>.yaml` | Las promociones; un archivo por comercio |
| `catalogo/instrumentos.yaml` | Tarjetas, monederos y atributos de la cartera (p. ej. "recibí la invitación") |
| `catalogo/comercios.yaml` | Comercios y sus reglas |
| `src/esquema.ts` | El esquema: qué campos existen y qué significan |
| `fuentes/<evento>.json` | Las URLs que captura `scripts/captura.py` |
| `snapshots/<evento>/` | Las capturas guardadas (HTML, texto, PDFs), `manifest.jsonl` y `archivo-ia.jsonl` (respaldos en Internet Archive) |
| `docs/aprendizajes.md` | Lo que hemos aprendido sobre dónde y cómo buscar promos |

### Confirmar una promo en el YAML

Cuando hayas cotejado una promo contra su fuente, actualiza su bloque `fuente`:

```yaml
    fuente:
      url: "https://…"              # la fuente oficial que cotejaste
      snapshot: snapshots/…/….txt   # si la capturaste (ver abajo)
      capturada: 2026-11-17
      revisada: true                # solo si una persona la cotejó
      verificacion:
        por: humano
        fecha: 2026-11-18
        resultado: coincide         # coincide | corregida | dudosa
        quien: "@tu-usuario"
        evidencia_url: "https://…"  # captura, PDF o issue con la evidencia
        notas: "Qué cotejaste y contra qué."
```

- **`coincide`:** todos los valores modelados (porcentaje, mínimo, tope, plazos, fechas, tarjetas) están en la fuente.
- **`corregida`:** cambiaste valores; di en `notas` qué cambió y por qué.
- **`dudosa`:** sigue faltando algo o las fuentes se contradicen; di en `notas` qué falta y qué fuente lo resolvería.

Si hay algo que la persona debe saber y el motor no calcula (cupos, bolsas limitadas, exclusiones), va en `avisos`.

### Capturar una fuente nueva

1. Agrega la URL a `fuentes/<evento>.json`, con un `id` descriptivo y `"render": true` si la página necesita JavaScript.
2. Corre `python3 scripts/captura.py fuentes/<evento>.json --solo <id> --sin-directorio`.
3. Si el sitio bloquea scripts (pasa con varios bancos y PDFs), bájalo desde tu navegador, guárdalo en `snapshots/<evento>/<id>/`, extrae el texto con `pdftotext -layout` y agrega su línea a `manifest.jsonl` con `"metodo": "chrome-manual"`.

### Respaldar en Internet Archive

Después de capturar, corre `python3 scripts/archivar.py snapshots/<evento>`. Pide a la Wayback Machine una captura de cada URL del manifiesto y anota el enlace en `snapshots/<evento>/archivo-ia.jsonl`. Es un testigo independiente, con fecha, de lo que decía la fuente. Se puede volver a correr: solo reintenta las URLs que fallaron.

### Agregar una promoción o un evento

Copia una promo parecida del mismo comercio y ajústala; los comentarios de `src/esquema.ts` explican cada campo. Las recetas de los casos difíciles (tramos acumulados, campañas en varios comercios, "paga después", opciones excluyentes) están en la sección *Modelado* de [`docs/aprendizajes.md`](docs/aprendizajes.md).

Un evento nuevo es una carpeta `catalogo/eventos/<id>/` con su `evento.yaml` y sus `promos/`; el motor no tiene código específico de ningún evento.

### Antes de abrir el PR

```sh
npm run validar && npm test && npm run pendientes
```

Si aprendiste algo que sirva para el siguiente evento (dónde estaban las condiciones, una trampa del sitio), agrégalo a `docs/aprendizajes.md`.

## Reglas del catálogo

- **Toda cifra necesita una fuente.** Sin fuente oficial, la promo queda `dudosa`, aunque la hayamos visto en un foro.
- **`revisada: true` y `por: humano` solo los pone una persona** que cotejó la fuente. Los agentes automáticos usan `por: agente`.
- **Ante la duda, modela de menos.** Es mejor que el buscador prometa $500 y lleguen $700 que al revés. Lo incierto va en `avisos` o con `certeza: condicionado`.
- **Sin datos personales** en el repo: ni números de tarjeta, ni nombres, ni folios.
- Este proyecto no está afiliado a ningún banco ni comercio, y no da asesoría financiera.
