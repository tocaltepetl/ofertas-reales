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

### Plataforma Nacional de Transparencia
**Pendiente:** buscar en el
[buscador de la PNT](https://buscador.plataformadetransparencia.org.mx/)
solicitudes previas a Profeco sobre «Buen Fin» (monitoreo de precios, quejas
por comercio, datos de QQP). No se pudo hacer desde aquí porque el buscador
necesita un navegador. Si nadie las ha pedido, la siguiente solicitud sería
la base de precios del monitoreo del Buen Fin y las quejas por proveedor, con
su prueba en seco (sujeto obligado: Procuraduría Federal del Consumidor).

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
- Crear `tocaltepetl/buenfin` en GitHub y subir con la cuenta `tocaltepetl-dev`.
- Decidir el despliegue: `buenfin.tocaltepetl.org` (Worker con assets, como
  rutas-gdl, con `release.yml` y `desplegar.yml`) o seguir solo como artefacto.
- Si se agrega `og.png`, revisar el `.gitignore` (hoy no excluye `*.png`).
