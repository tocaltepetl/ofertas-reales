# Aprendizajes para capturar y modelar promociones

Notas que sirven para el siguiente evento (Hot Sale, Black Friday, Buen Fin 2027). Cada una vale para más de un evento; lo que solo importa en una edición va en el catálogo de esa edición. Se agregan al final de la sección que corresponda, con la fecha y el evento donde se aprendió.

## Calendario

- **Captura el último día del evento, temprano.** Al cierre, las páginas cambian o desaparecen. El 17 nov 2026, el artículo de condiciones de Walmart ya daba error y la página de Banorte no tenía nada del Buen Fin. (BF 2026)
- **Algunos bancos abren la inscripción días antes del evento.** BBVA abrió del 3 al 12 nov y Banorte desde el 6 nov, así que la captura útil empieza una semana antes. (BF 2026)

## Dónde están las condiciones reales

- **Las condiciones de un banco suelen estar en el sitio del comercio, no en el del banco.** Las de Banorte para el BF 2026 eran un PDF en elpalaciodehierro.com, mientras que `banorte.com/tutarjetafavorita` era la página del programa de lealtad. Busca "<banco> Buen Fin <año> términos y condiciones pdf" y revisa los PDFs de Palacio, Liverpool, Coppel y PayPal. (BF 2026)
- **Cada comercio publica un PDF de condiciones por banco**, y ese PDF suele traer la mecánica completa de la campaña, válida en todos los comercios. El de BanCoppel en Coppel también explicaba cómo se combina con la bonificación general. (BF 2026)
- **El folleto de PayPal** (paypalobjects.com, "Promociones Bancarias") resume todos los bancos con fechas y enlaces a sus condiciones. Sirve de índice. (BF 2026)
- **Promodescuentos transcribe las condiciones completas**, a veces antes de que el banco las publique. Sirve como pista o para confirmar cifras, pero no como fuente final. (BF 2026)

## Captura técnica

- **Sitios que rechazan curl (403):** Santander, BanCoppel, Sanborns y la página de Coppel. Con `chromium --headless=new --dump-dom` sí cargan. (BF 2026)
- **Ni headless ni curl funcionan con** el CDN de PDFs de Coppel (`imagescontentstack.coppel.com`) ni con el PDF de INVEX; aunque se mande el Referer de coppel.com, el CDN responde 403. Sí funcionan en el Chrome real del usuario. (BF 2026)
- **Chrome bloquea las descargas automáticas después de la primera.** Con Claude in Chrome se baja un solo PDF por sitio y los demás quedan bloqueados en silencio. Lo más rápido es que el usuario abra los enlaces y guarde cada PDF en `~/Descargas`; después se mueven al repo con su `pdftotext` y su línea en `manifest.jsonl`. (BF 2026)
- **La extensión de Claude in Chrome necesita permiso por dominio** para leer una página (get_page_text). Sin ese permiso, falla con "Permission denied for reading page content". (BF 2026)
- **Cuando el contenido viene en un iframe de otro dominio**, `document.body.innerText` solo trae el menú. Revisa `document.querySelectorAll('iframe')` y abre el iframe directo; Banorte usa promocionbanorte.com.mx. (BF 2026)
- **En Coppel, los enlaces de condiciones están dentro de pestañas** (una por banco o promoción) que solo cambian el banner. Las URLs de los PDFs se sacan de la captura renderizada, no hay que hacer clic. (BF 2026)
- **Los slugs de bancos en Mercado Libre no son obvios:** `/ofertas/tarjeta-mercado-pago-visa`, `/ofertas/amex`, `/ofertas/nubank`. Un slug equivocado redirige a la portada sin dar error, así que hay que revisar `url_final` en el manifiesto. (BF 2026)
- **Amazon muestra los bancos solo como logos.** Las ventanas emergentes se asignan a un banco por su orden, y eso hay que marcarlo como deducido. (BF 2026)

## Modelado en el catálogo

- **Las bonificaciones escalonadas por compras acumuladas** son la norma (Banorte, Scotiabank, BanCoppel, HSBC). Se modelan con `tramos` + `escala_acumulada: true` + una `campana` compartida entre comercios, para que el tope por cliente se descuente una sola vez. (BF 2026)
- **Cuando la tabla distingue "activando en web" de "activando en la app"** (Banorte), se modela el monto de web y el de la app va en un aviso. Así el motor no promete de más. (BF 2026)
- **Las opciones excluyentes de un mismo banco** (contado, MSI, puntos o "paga después") se modelan como promos separadas con `excluye` mutuo, porque el cliente elige una y no puede cambiarla. (BF 2026)
- **"Pagas de contado y el banco difiere después"** se modela con `tipo: diferido` + `financiamiento_posterior: {meses}` + `plazos: {permitidos: [0]}`. BanCoppel lo hace automáticamente sin registro; Openbank y Klar desde su app. (BF 2026)
- **Un extra del banco en un comercio específico** (BanCoppel +5% en Coppel) se suma a los `pct` de los tramos en las promos de ese comercio, con la misma `campana` que en los demás. Si las condiciones no dicen si el tope incluye el extra, se asume que sí y se avisa. (BF 2026)
- **Algunos rangos tienen máximo, como "3 MSI de $3,500 a $5,499"**, pero el esquema solo tiene `minimo`. Por ahora va en un aviso, junto con la promo del rango siguiente y un `excluye` mutuo. (BF 2026)
- **No todas las promos de un comercio son del evento.** El 10% de Coppel Max dura del 1 jul al 30 nov; se modela con `vigencia` propia. (BF 2026)
- **Al reescribir YAML con un script,** usa `parseDocument` de `yaml` con `toString({lineWidth: 0, flowCollectionPadding: false})` para conservar el estilo y los comentarios. Las listas en línea se rompen con comas dentro del texto ("50,000 cupones"), así que esos textos van entre comillas. (BF 2026)
- **Respeta el formato del JSON de fuentes** (indentación de 1 espacio) para que el diff solo muestre lo nuevo. (BF 2026)

## Verificación

- **Una promo pasa a `coincide` solo con una captura guardada en el repo** que respalde cada valor. Una búsqueda web sin captura la deja como `dudosa`, y `revisada: true` / `por: humano` solo los pone una persona. (BF 2026)
