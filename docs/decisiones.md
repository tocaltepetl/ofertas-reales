# Decisiones

Registro de decisiones del proyecto. Lo que aprendemos sobre cómo capturar y
modelar promociones va en [`aprendizajes.md`](aprendizajes.md).

## 2026-11-26: entra a tocaltepetl, con la parte de Profeco

### Por qué en tocaltepetl
El buscador es una herramienta abierta y pequeña para la vida diaria, sin
backend y con la cartera solo en el navegador, igual que los demás proyectos.
Pero los otros vigilan datos y servicios del gobierno, y este trata de bancos y
comercios. Para que no fuera solo un catálogo de promociones, se suma lo que
publica la Procuraduría Federal del Consumidor (Profeco): si el precio es real
y qué hacer si no respetan la promoción.

### Qué publica Profeco (búsqueda del 2026-11-26)
- **Comparador del evento:** micrositio de Quién es Quién en los Precios (QQP),
  `https://elbuenfin.profeco.gob.mx/`, activo del 13 al 17 nov. Según la prensa
  (El CEO, 9 nov; El Universal/Diario de Yucatán, 16 oct) muestra el precio
  mínimo, máximo y promedio por ciudad y su historial de semanas previas. La
  página carga con JavaScript; no encontramos descarga de datos ni API.
- **QQP permanente:** `https://qqp.profeco.gob.mx/`. Sin sección de descarga
  visible.
- **Datos abiertos:** datos.gob.mx respondió 403 a la consulta automática; no
  pudimos confirmar si el conjunto de QQP está publicado ni su formato.
  **Pendiente:** revisarlo desde un navegador.
- **Balance del evento:** comunicado del 23 nov 2026, «Profeco detectó ofertas
  reales y simuladas durante la edición 16 de El Buen Fin»
  (`https://www.gob.mx/profeco/prensa/profeco-detecto-ofertas-reales-y-simuladas-durante-la-edicion-16-de-el-buen-fin`):
  55 mil productos en 400 puntos de venta, de septiembre al cierre, con seis
  casos citados (tres bajaron de precio y tres subieron). Son los casos que
  carga `catalogo/eventos/buen-fin-2026/evento.yaml`.
- **Quejas:** la prensa reporta 243 inconformidades con 98.8% conciliadas y un
  desglose por tienda (Walmart 45, Sam's 21, Liverpool 14), pero **no
  encontramos el comunicado oficial** con esas cifras, así que no se muestran.
- **Canales:** Teléfono del Consumidor 800 468 8722 y 55 5568 8722, Concilianet
  y el directorio de oficinas, tomados de `concilianet.profeco.gob.mx`
  (`catalogo/profeco.yaml`).

### Plataforma Nacional de Transparencia (búsqueda del 2026-11-26)
En el [buscador de la PNT](https://buscador.plataformadetransparencia.org.mx/),
sección Solicitudes, «"Buen Fin"» da 84 solicitudes (índice actualizado al
21 nov 2026); 27 son a Profeco. Las revisamos todas: casi todas coinciden por
otras palabras (denuncias penales, quejas contra personal, Telcel, Inditex).
Solo dos tratan del Buen Fin:
- **1031500063315** (17 nov 2015): multas por información engañosa en el Buen
  Fin, precios que subieron sin justificación cambiaria y personal que atiende
  quejas. Respondida con entrega de información el 13 dic 2015.
- **340024500038425** (1 dic 2025): pide la presentación de una capacitación
  a proveedores («El Buen Fin está Hecho en México»). No sirve aquí.

**Nadie ha pedido** la base del monitoreo de precios del Buen Fin (QQP) ni las
quejas por proveedor durante el evento. Siguiente paso: redactar esa solicitud
con su prueba en seco
([guía común](https://github.com/tocaltepetl/.github/blob/main/docs/solicitudes/README.md)).
Sujeto obligado probable: Procuraduría Federal del Consumidor (QQP y quejas
son suyos); falta confirmar el nombre exacto en el catálogo de la PNT. Buscar
«"Quién es Quién en los Precios"» no sirvió: el buscador lo trata como palabras
sueltas (9.9 millones de resultados).

### Nombre: ofertas-reales
Empezó como `buenfin`. Se cambió porque el catálogo ya cubre otros eventos
(Black Friday, Hot Sale), porque «El Buen Fin» es el nombre de un programa
ajeno y podía sugerir afiliación, y porque no decía lo que aporta. «Ofertas
reales» es el término de Profeco («ofertas reales y simuladas») y abarca las
dos partes: si la oferta es real y con qué conviene pagarla. Las claves de
`localStorage` (`buscador-promos-*`) y el UID del `.ics` se conservan para no
perder lo guardado ni duplicar eventos en calendarios.

### Cómo se modeló
- `catalogo/profeco.yaml`: canales que valen para cualquier evento, con su
  fuente y la fecha en que se revisaron.
- `evento.yaml` → `profeco`: el comparador del evento y, cuando sale, el
  balance con sus casos (`antes` y `durante`). Una oferta es **simulada** si
  el precio durante el evento fue mayor que antes. `comercio` liga el caso con
  `comercios.yaml` cuando la tienda está en el catálogo.
- La web muestra una tarjeta «Antes y después de pagar» en cada evento, un
  enlace junto al precio para compararlo en Profeco y un acceso arriba. Mientras
  el evento no termina enlaza al micrositio; después, a QQP.
- Se dice en la página que el buscador no está afiliado a Profeco.

### Conteo de visitas
Beacon de Cloudflare Web Analytics (sin cookies ni datos personales) en
`web/index.html`, con su aviso en el pie de página y en el README. La versión
para artefacto de claude.ai no lo lleva (`scripts/build-web.ts`): esas visitas
no son del sitio y el visor bloquea scripts externos.

### Pendiente para publicar
- Decidir el despliegue: `ofertas-reales.tocaltepetl.org` (Worker con assets, como
  rutas-gdl, con `release.yml` y `desplegar.yml`) o seguir solo como artefacto.
- Si se agrega `og.png`, revisar el `.gitignore` (hoy no excluye `*.png`).
