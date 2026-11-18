# Aprendizajes para capturar y modelar promociones

Notas que sirven para el siguiente evento (Hot Sale, Black Friday, Buen Fin 2027). Cada una vale para más de un evento; lo que solo importa en una edición va en el catálogo de esa edición. Se agregan al final de la sección que corresponda, con la fecha y el evento donde se aprendió.

## Calendario

- **Captura el último día del evento, temprano.** Al cierre, las páginas cambian o desaparecen. El 17 nov 2026, el artículo de condiciones de Walmart ya daba error y la página de Banorte no tenía nada del Buen Fin. (BF 2026)
- **Algunos bancos abren la inscripción días antes del evento.** BBVA abrió del 3 al 12 nov y Banorte desde el 6 nov, así que la captura útil empieza una semana antes. (BF 2026)
- **Las promos de un solo día (13 nov) tienen sus propias condiciones**, que desaparecen o pasan a "vencidas" al día siguiente. Captúralas ese mismo día, junto con el artículo de condiciones del comercio. (BF 2026)

## Dónde están las condiciones reales

- **Las condiciones de un banco suelen estar en el sitio del comercio, no en el del banco.** Las de Banorte para el BF 2026 eran un PDF en elpalaciodehierro.com, mientras que `banorte.com/tutarjetafavorita` era la página del programa de lealtad. Busca "<banco> Buen Fin <año> términos y condiciones pdf" y revisa los PDFs de Palacio, Liverpool, Coppel y PayPal. (BF 2026)
- **Cada comercio publica un PDF de condiciones por banco**, y ese PDF suele traer la mecánica completa de la campaña, válida en todos los comercios. El de BanCoppel en Coppel también explicaba cómo se combina con la bonificación general. (BF 2026)
- **El folleto de PayPal** (paypalobjects.com, "Promociones Bancarias") resume todos los bancos con fechas y enlaces a sus condiciones. Sirve de índice. (BF 2026)
- **Promodescuentos transcribe las condiciones completas**, a veces antes de que el banco las publique. Sirve como pista o para confirmar cifras, pero no como fuente final. (BF 2026)
- **Antes de decir que una promo "no tiene condiciones", busca el nombre de la campaña en todas las capturas.** Las condiciones completas de Amex estaban en la página de Amex de Mercado Libre y mencionaban a Liverpool y a Palacio. (BF 2026)
- **BBVA publica las condiciones de cada comercio en bbvadescuentos.mx** (enlazado desde la tarjeta del comercio en bbva.mx/buen-fin), no en bbva.mx. Ese sitio bloquea las descargas automáticas. (BF 2026)
- **Los PDFs de Palacio siguen el patrón** `…/Terminos-y-condiciones/Buen-Fin-<Banco>.pdf`. Los buscadores los indexan (`site:elpalaciodehierro.com Buen-Fin-`), y el script de captura sí los baja aunque WebFetch reciba 403. (BF 2026)
- **Los PDFs de Liverpool viven en contentstack** (`gcp-na-assets.contentstack.com/…/rest_<banco>LV_<ddmmyy>.pdf`) y responden 422 a scripts. La fecha del nombre dice cuándo se publicaron, y algunos salen a mitad del evento (rest_paypalLV_171126). (BF 2026)
- **Las páginas de banco en Mercado Libre** (`/ofertas/<banco>`) traen las condiciones más completas de los cupones (débito, plazos, número de cupones). Sirven como referencia para el cupón equivalente en Amazon, pero no lo prueban. (BF 2026)
- **Para una campaña que corre en varios comercios (BanCoppel, DiDi, Mifel), busca primero las condiciones generales del emisor.** Ahí están los tramos, el tope compartido y los comercios; después liga todas las promos a la misma `campana`. (BF 2026)
- **Los comercios separan las condiciones por canal** (en línea y en tienda, con URLs distintas y un `#ancla` por banco). Captura las dos, o las promos solo de tienda se quedan sin fuente. (BF 2026)
- **Las páginas de condiciones por banco de Amazon** (`b?node=`) traen el texto legal completo de cada cupón y muchas veces también las condiciones de la bonificación del banco: los dos niveles de INVEX, los tramos oficiales de BanCoppel, las reglas de Revolut. Captúralas primero; valen más que la página del propio banco. (BF 2026)
- **Las cláusulas de exclusión están en las condiciones de la bonificación del banco, no en las del cupón** ("no acumulable con otras promociones o descuentos ofrecidos por BBVA"). Lee las dos mitades de cada página de banco. (BF 2026)

## Captura técnica

- **Sitios que rechazan curl (403):** Santander, BanCoppel, Sanborns y la página de Coppel. Con `chromium --headless=new --dump-dom` sí cargan. (BF 2026)
- **Ni headless ni curl funcionan con** el CDN de PDFs de Coppel (`imagescontentstack.coppel.com`) ni con el PDF de INVEX; aunque se mande el Referer de coppel.com, el CDN responde 403. Sí funcionan en el Chrome real del usuario. (BF 2026)
- **Chrome bloquea las descargas automáticas después de la primera.** Con Claude in Chrome se baja un solo PDF por sitio y los demás quedan bloqueados en silencio. Lo más rápido es que el usuario abra los enlaces y guarde cada PDF en `~/Descargas`; después se mueven al repo con su `pdftotext` y su línea en `manifest.jsonl`. (BF 2026)
- **La extensión de Claude in Chrome necesita permiso por dominio** para leer una página (get_page_text). Sin ese permiso, falla con "Permission denied for reading page content". (BF 2026)
- **Cuando el contenido viene en un iframe de otro dominio**, `document.body.innerText` solo trae el menú. Revisa `document.querySelectorAll('iframe')` y abre el iframe directo; Banorte usa promocionbanorte.com.mx. (BF 2026)
- **En Coppel, los enlaces de condiciones están dentro de pestañas** (una por banco o promoción) que solo cambian el banner. Las URLs de los PDFs se sacan de la captura renderizada, no hay que hacer clic. (BF 2026)
- **Los slugs de bancos en Mercado Libre no son obvios:** `/ofertas/tarjeta-mercado-pago-visa`, `/ofertas/amex`, `/ofertas/nubank`. Un slug equivocado redirige a la portada sin dar error, así que hay que revisar `url_final` en el manifiesto. (BF 2026)
- **Amazon muestra los bancos solo como logos.** Las ventanas emergentes se asignan a un banco por su orden, y eso hay que marcarlo como deducido. (BF 2026)
- **Cada ventana emergente de banco en Amazon tiene un botón "Ver Términos y Condiciones"** con `ref_=BANKP_F_button_<Banco>` y su propio `b?node=`. Con eso se asigna cada ventana a su banco sin depender del orden, y esas páginas `b?node` son las condiciones por banco. WebFetch recibe 503, pero `captura.py` con `render: true` las baja bien. (BF 2026)
- **En cada recaptura, extrae todos los enlaces `.pdf` y compáralos con la captura anterior.** Así aparecen las condiciones nuevas y las promos nuevas (el cupón KUESKIBUENFIN apareció el 17 nov). Compara las tarjetas de promos, no solo los valores de lo que ya está en el catálogo. (BF 2026)
- **La página de Amex rompe WebFetch ("header overflow")**, pero curl con un User-Agent de navegador funciona. (BF 2026)
- **Las páginas de los bancos enlazan sus PDFs de condiciones** (`href` que termina en `.pdf`, muchas veces relativo, como `img/…`), y esos PDFs traen lo que el texto visible omite. Al capturar, busca esos enlaces en el render.html y baja también los PDFs. (BF 2026)
- **`pdftotext -layout` lee PDFs que WebFetch no puede decodificar.** Si una tabla es imagen, renderiza la página con `pdftoppm` y mírala. (BF 2026)
- **Guarda siempre el archivo original, no solo el texto.** Algunas capturas con Chrome solo guardaron el texto visible (get_page_text); como evidencia vale más el HTML o PDF tal como lo entregó el servidor, con URL, fecha y SHA-256 en el manifiesto. Con Chrome, guarda también `document.documentElement.outerHTML`. (BF 2026)
- **Respalda en Internet Archive el mismo día de la captura** (`scripts/archivar.py`). Es evidencia independiente del repo, pero archiva lo que la página dice en ese momento y falla seguido con los sitios que bloquean bots. Complementa las capturas propias, no las reemplaza. (BF 2026)

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
- **Cuando el comercio anuncia una campaña del banco**, suele mostrar el porcentaje del tramo más alto con el mínimo del primero y el tope general (Amazon: "20%" con BanCoppel). Si el mínimo coincide con el primer escalón del banco, asume tramos y la `campana` compartida. (BF 2026)
- **Un mismo banco puede tener varias campañas en paralelo con reglas distintas.** Banorte tiene una de tramos que excluye PayPal y otra de 15% a MSI que cuenta PayPal como comercio. Antes de aplicar las exclusiones de un PDF, confirma qué campaña cubre. (BF 2026)
- **Una frase como "inscríbete para participar por X%"** puede significar cupo limitado o sorteo, no un beneficio seguro. Márcalo con un aviso en vez de modelarlo como garantizado. (BF 2026)
- **Los cupos de registro de una misma campaña cambian según dónde se publiquen** (Amex: 40,000 en ML y 53,000 en su sitio). Van como texto en un aviso, no como número. (BF 2026)
- **Un banco corre campañas distintas en cada comercio.** Falabella tiene #BuenFin en Palacio ($4,000 acumulados, tope $5,000) y #MeLiFalabella en ML ($2,000 mínimo, tope $1,000). No reutilices un id de `campana` solo porque coinciden el banco y el porcentaje. (BF 2026)

## Verificación

- **Una promo pasa a `coincide` solo con una captura guardada en el repo** que respalde cada valor. Una búsqueda web sin captura la deja como `dudosa`, y `revisada: true` / `por: humano` solo los pone una persona. (BF 2026)
- **Hay contradicciones que ninguna captura resuelve,** como Amex: incluye a Mercado Libre pero excluye las compras "mediante Mercado Pago". Déjala como `dudosa` con un aviso visible y no gastes más tiempo en ella. (BF 2026)
- **Las páginas de banco cambian a diario y mezclan ediciones.** El encabezado de BBVA ("Aplican solo el 17 de noviembre") cambia cada día, y la página de BanCoppel mezcla texto de 2026 con condiciones de 2024. Fecha cada dato con la captura, no con la página. (BF 2026)
- **HSBC separa con una "O" el cupón y la devolución,** pero su texto legal no los excluye. Toma la "O" como diseño hasta que unas condiciones digan otra cosa. (BF 2026)
- **La lista de comercios en el HTML de la página del banco** (`data-negocio`, `alt` de los logos) dice si un agregador como PayPal participa. Exclusiones como "no aplica vía agregadores" suelen ser solo de una subpromo (Horas Banamex), no de la campaña base. (BF 2026)
- **Cuando un comercio resume una promo de banco, puede copiar texto de otra por error.** El "registro en App BBVA" de Walmart venía de "Paga en marzo", y su encabezado de BanCoppel nombra a American Express. Las condiciones del banco mandan. (BF 2026)
- **Un PDF con URL fija puede ser una versión vieja.** Kueskipay.pdf seguía con la tabla de abril. Revisa las fechas de la tabla de promos, no solo el título; sus reglas generales ("los códigos no se acumulan") sí sirven. (BF 2026)
- **La forma de pago que anuncia el comercio puede no ser la de las condiciones del banco.** Palacio dice "dinero electrónico" y las condiciones de Falabella dicen estado de cuenta. `forma` se toma de las condiciones. (BF 2026)
- **La página de condiciones de un comercio puede perder una sección de un día para otro** (la de Amex en Home Depot desapareció el 17 nov). En una campaña multicomercio, usa como `fuente` las condiciones del emisor y deja la captura del comercio como referencia en `nota`. (BF 2026)
- **El texto genérico de esas páginas se contradice.** "Exclusiva para compras a meses sin intereses" y "Aprovecha y combina hasta" aparecen aunque los pasos y las preguntas frecuentes digan otra cosa. Confía en los pasos y las preguntas frecuentes. (BF 2026)
- **Las ventanas emergentes de Amazon omiten niveles.** La de INVEX solo muestra el 10% a MSI, y las condiciones agregan un 5% de contado con su propio tope. Toma la ventana como resumen. (BF 2026)
- **"Bono de bienvenida" en una ventana del comercio significa solo clientes nuevos.** Busca la sección de elegibilidad antes de modelarla como promo general; puede hacer falta un producto o atributo nuevo en `instrumentos.yaml` (Revolut: `revolut.tdc` + `revolut_tdc_nueva`). (BF 2026)
- **Amazon cobra cuando envía.** Si las condiciones del banco usan la fecha de cargo (Amex), un envío tardío puede quedar fuera; otros (INVEX, Rappi, Banorte) aceptan por escrito los cargos divididos o tardíos. Vale un aviso por banco. (BF 2026)
