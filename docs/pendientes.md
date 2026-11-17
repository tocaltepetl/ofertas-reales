# Pendientes de El Buen Fin 2026

> Archivo generado con `npm run pendientes`. No lo edites a mano.

162 promociones: **13 dudosas** (falta un dato o las fuentes se contradicen) y 149 que verificó un agente pero ninguna persona.

¿Viste alguna en la página del comercio o del banco, o ya te llegó la bonificación? Abre un issue con la plantilla **Confirmar una promoción** o manda un PR. Los pasos están en [CONTRIBUTING.md](../CONTRIBUTING.md).

## Dudosas

### Amazon México

- **Cupón HSBCBF26** (`amz-hsbcbf26`, [catalogo/eventos/buen-fin-2026/promos/amazon.yaml](../catalogo/eventos/buen-fin-2026/promos/amazon.yaml))
  - Qué falta: T&C de Amazon para HSBC (snapshots/buen-fin-2026/comercio-amazon-tyc-hsbc/20261117-165539.txt) confirma 10%, mínimo $3,500, tope $750 en toda la vigencia, 'en una sola exhibición (pago de contado) o a Meses sin Intereses' y vigencia 13-17 nov (la frase de encabezado 'exclusiva para compras a meses sin intereses' es plantilla y la contradicen los pasos y las preguntas frecuentes). La combinación con la devolución sigue sin resolverse: el T&C del cupón dice 'no puede combinarse con otras promociones, incluyendo Tarjetas de Regalo Electrónicas y/u ofertas basadas en códigos promocionales'; la página de Amazon pone 'Aprovecha y combina hasta' sobre Cupón y Bonificación (plantilla, sale también en la de Rappi, que solo tiene una promo); el T&C de la devolución no excluye compras con cupón y banco-hsbc pone 'O' entre ambos. Se mantiene el excluye por prudencia; lo resolvería una respuesta de HSBC o una compra de prueba.
  - Fuente actual: https://www.amazon.com.mx/b?node=223936486011
- **Devolución HSBC** (`amz-hsbc-devolucion`, [catalogo/eventos/buen-fin-2026/promos/amazon.yaml](../catalogo/eventos/buen-fin-2026/promos/amazon.yaml))
  - Qué falta: T&C de Amazon para HSBC (snapshots/buen-fin-2026/comercio-amazon-tyc-hsbc/20261117-165539.txt): hasta 30% (25% Premier, 20% One, 10% resto, +5% por transferencia de saldos de $50,000+), compras acumuladas 'a partir de 6 Meses', mínimo $15,000, tope $7,000 por cliente, registro en hsbc.com.mx/buenfin a más tardar el 17 nov; coincide con banco-hsbc/20261117-162130.txt. Solo queda la duda del excluye con amz-hsbcbf26 (ver notas del cupón): ningún T&C excluye compras con cupón, pero el del cupón dice que no se combina con otras promociones.
  - Fuente actual: https://www.amazon.com.mx/b?node=223936486011

### Liverpool

- **15% de bonificación Banorte pagando con PayPal a MSI** (`lp-paypal-banorte`, [catalogo/eventos/buen-fin-2026/promos/liverpool.yaml](../catalogo/eventos/buen-fin-2026/promos/liverpool.yaml))
  - Qué falta: PayPal (pista-paypal-bancos/20261117-162130.txt, sin cambios) da el 15% a MSI y remite a banorte.com/tutarjetafavorita; mínimo $6,500 por ticket, tope $5,000 y tarjetas excluidas siguen solo en Promodescuentos (pista-pd-banorte/20261117-162130.txt, que lista PayPal, Shein y TEMU como comercios). El T&C oficial nuevo (banco-banorte-tyc-palacio/20261117-164431.txt) es la otra campaña de Banorte (tramos desde $12,000, lp-banorte-contado/msi) y dice 'No aplican compras realizadas a través de PayPal ni Mercado Pago': confirma que vía PayPal solo cabe esta del 15%, pero no la describe. La búsqueda web no encontró el T&C de Banorte del 15%. Lo resolvería ese T&C en banorte.com/tutarjetafavorita, o rest_paypalLV_171126.pdf de Liverpool
  - Fuente actual: https://www.paypalobjects.com/marketing/web/mx/buen-fin-2026/Promociones-Bancarias-BF26.pdf
- **10% cashback Liverpool Visa pagando con PayPal desde $12,500 acumulados** (`lp-paypal-liverpool`, [catalogo/eventos/buen-fin-2026/promos/liverpool.yaml](../catalogo/eventos/buen-fin-2026/promos/liverpool.yaml))
  - Qué falta: 10% y $12,500 acumulados coinciden entre PayPal (pista-paypal-bancos/20261117-162130.txt, sin cambios) y la tarjeta de Liverpool (comercio-liverpool/20261117-162130.txt: 'Obtén 10% de cashback Acumulando compras de $12,500 o más con tus Tarjetas Liverpool'). Siguen sin fuente el tope, los plazos, la forma de entrega y si la Liverpool Visa vía PayPal suma a la misma campaña. Además PayPal dice 'inscríbete para participar por 10% de cashback*', con asterisco y sin desarrollar, y eso puede implicar cupo o sorteo. La página de Liverpool enlaza dos T&C que no están capturados: rest_cashbackLV_131126.pdf y rest_paypalLV_171126.pdf (publicado el 17 nov). Lo resolverían esos PDF
  - Fuente actual: https://www.paypalobjects.com/marketing/web/mx/buen-fin-2026/Promociones-Bancarias-BF26.pdf

### Mercado Libre

- **Cupón CREDITO40 (primera vez)** (`ml-credito40`, [catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml](../catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml))
  - Qué falta: Sigue sin snapshot: tampoco aparece en la recaptura ml-mercado-pago/20261117-162130.txt (solo TCMPBF y CREDITOBF). En web, Xataka (11/11 de Mercado Libre, Fechas Dobles) da 'CREDITO40: 40% de descuento en tu primera compra con Mercado Crédito. Descuento topado a 500 pesos' y un comunicado de ML en Excélsior menciona '40% de descuento en la primera compra' con Mercado Crédito, sin código ni tope. Pct y tope tienen respaldo de terceros; mínimo $300, vigencia 10-17 nov y cupo de 2,000 cupones no aparecen en ninguna fuente. Lo resolvería el T&C del cupón en la app o en mercadolibre.com.mx (sección de cupones o página de Mercado Crédito).
  - Fuente actual: https://www.mercadolibre.com.mx/ofertas
- **20% pagando con saldo en cuenta** (`ml-saldo-mp-20`, [catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml](../catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml))
  - Qué falta: Sigue sin snapshot: ni la recaptura ml-mercado-pago/20261117-162130.txt ni ningún otro snapshot mencionan un 20% con saldo Mercado Pago (pista-expansion-bancos solo cita el cupón BFINMP de 10%, otra promo). La búsqueda web tampoco encontró ninguna fuente, ni de terceros, con 20%, tope $300, mínimo $100 o el fondo de $2,000,000. Puede ser una promo de otro evento que arrastró la calculadora v0. Lo resolvería el T&C en mercadolibre.com.mx/ofertas o en la app de Mercado Pago; si no aparece, conviene retirarla.
  - Fuente actual: https://www.mercadolibre.com.mx/ofertas
- **Bonificación Amex $1,500** (`ml-amex-1500`, [catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml](../catalogo/eventos/buen-fin-2026/promos/mercadolibre.yaml))
  - Qué falta: Monto, mínimo acumulado y MSI coinciden con el T&C de ml-amex/20261117-162130.txt (igual al del 16 nov). La página propia de Amex (banco-amex-buenfin-cashback/20261117-165718.txt) trae el mismo T&C: también lista a Mercado Libre 'solo en línea' y a la vez excluye 'compras mediante Mercado Pago' y 'otras promociones'; solo cambia el cupo (53,000 registros vs 40,000 en ML). La contradicción está dentro del propio T&C de Amex, así que no se resuelve con más capturas. Las condiciones de campaña quedan iguales en lp-amex-1500 y ph-amex-1500 (coincide). No se marca exclusiva: la calculadora v0 combina AMEXBF + $1,500 (prueba de paridad). Lo resolvería una aclaración escrita de Amex sobre si las compras en ML pagadas con Amex vía Mercado Pago Standard califican.
  - Fuente actual: https://www.mercadolibre.com.mx/ofertas/amex

### El Palacio de Hierro

- **Cupón KUESKINUEVO30 (usuarios nuevos)** (`ph-kueski-nuevo30`, [catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml](../catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml))
  - Qué falta: 30% desde $200 y vigencia 1-30 nov se repiten en comercio-palacio/20261117-162130.txt. Kueskipay.pdf (comercio-palacio-tyc-kueski/20261117-165718.txt) es el T&C general 2026, pero su tablero es de abril: KUESKINUEVO30 en Palacio en línea del 1 al 30 de abril, desde $100, tope $400. No trae filas de noviembre, así que no respalda el tope ni el mínimo actuales. Sí respalda, en las reglas generales, que los cupones 'No son acumulables con otros códigos de descuento de Kueski' (excluye mutuo con KUESKIBF y KUESKIBUENFIN) y la definición de cliente nuevo. Lo resolvería una versión del PDF con el tablero de noviembre
  - Fuente actual: https://www.elpalaciodehierro.com/promociones-bancarias.html
- **Cupón KUESKIBF** (`ph-kueski-bf`, [catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml](../catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml))
  - Qué falta: 10% desde $5,000, 13 al 17 nov, se repite en comercio-palacio/20261117-162130.txt. Kueskipay.pdf (comercio-palacio-tyc-kueski/20261117-165718.txt) confirma en sus reglas generales que los códigos de Kueski 'No son acumulables con otros códigos de descuento de Kueski' (excluye ahora también ph-kueski-buenfin), pero su tablero es de abril y no incluye KUESKIBF, así que el tope sigue sin conocerse. Lo resolvería una versión del PDF con el tablero de noviembre
  - Fuente actual: https://www.elpalaciodehierro.com/promociones-bancarias.html
- **Cupón KUESKIBUENFIN (usuarios nuevos)** (`ph-kueski-buenfin`, [catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml](../catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml))
  - Qué falta: Nueva: aparece en la recaptura del 17 nov (no estaba en comercio-palacio/20261116-151140.txt). 35%, usuarios nuevos, desde $200 y 13-17 nov salen de esa tarjeta. Kueskipay.pdf (comercio-palacio-tyc-kueski/20261117-165718.txt) no la incluye (tablero de abril), pero sus reglas generales respaldan el excluye mutuo ('No son acumulables con otros códigos de descuento de Kueski') y la definición de cliente nuevo. Tope desconocido
  - Fuente actual: https://www.elpalaciodehierro.com/promociones-bancarias.html
- **15% de bonificación Banorte pagando con PayPal a MSI** (`ph-paypal-banorte`, [catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml](../catalogo/eventos/buen-fin-2026/promos/palacio-de-hierro.yaml))
  - Qué falta: Porcentaje, tope y mínimo siguen solo en Promodescuentos (pista-pd-banorte/20261117-162130.txt, que lista PayPal, Shein y TEMU como comercios). PayPal confirma el 15% a MSI (pista-paypal-bancos/20261117-162130.txt). El T&C oficial nuevo de Banorte en Palacio (banco-banorte-tyc-palacio/20261117-164431.txt) es la campaña de tramos (ph-banorte-contado/msi) y excluye 'compras realizadas a través de PayPal ni Mercado Pago'; no habla del 15% ni dice si una compra en Palacio pagada con PayPal cuenta como compra en PayPal. Que aplique en Palacio sigue dependiendo de un comentario del hilo. Lo resolvería el T&C de Banorte del 15% en banorte.com/tutarjetafavorita
  - Fuente actual: https://www.promodescuentos.com/ofertas/buen-fin-2026-con-banorte-15-de-bonificacion-en-compras-a-meses-sin-intereses-en-comercios-participantes-1204725

### Walmart México

- **Bonificación BBVA a 13, 15, 20 o 24 MSI (10%; 15% el 13 nov)** (`wm-bbva-10`, [catalogo/eventos/buen-fin-2026/promos/walmart.yaml](../catalogo/eventos/buen-fin-2026/promos/walmart.yaml))
  - Qué falta: 14-17 nov coincide con comercio-walmart-tyc (10% a 13/15/20/24 MSI) y banco-bbva 20261117 (mínimo $5,000, tope $2,500 por día y cliente, automática). banco-bbva-tyc-bonificacion10 (vigencia 14-17 nov) lo confirma: walmart.com.mx, $5,000, 13/15/20/24 MSI, $2,500 por día y cliente, automática. El 13 nov (15%) solo aparece en 'Promociones Vencidas' de comercio-walmart-tyc: banco-bbva-tyc-walmart-13nov cubre solo el 25% a 12/18 MSI y banco-bbva-tyc-bonificacion10 empieza el 14 nov, así que mínimo y tope de ese día siguen sin fuente.
  - Fuente actual: https://www.walmart.com.mx/ayuda/articulo/el-fin-irresistible-and-buen-fin-promociones-bancarias/172a059b988640b19ad75c639542df56
- **15% de bonificación Banorte pagando con PayPal a MSI** (`wm-paypal-banorte`, [catalogo/eventos/buen-fin-2026/promos/walmart.yaml](../catalogo/eventos/buen-fin-2026/promos/walmart.yaml))
  - Qué falta: 15%, MSI, 13-17 nov y tope $5,000 coinciden con comercio-walmart-tyc y pista-paypal-bancos 20261117. El mínimo de $6,500 por ticket y las tarjetas excluidas solo vienen de Promodescuentos (pista-pd-banorte 20261117, sin cambios). banco-banorte-tyc-palacio es otra campaña (hasta $12,000 / $8,500 + MSI desde $12,000 acumulados) y excluye PayPal, así que no aplica aquí. Falta el T&C de Banorte de la campaña '15% a MSI en comercios participantes' (banorte.com/tutarjetafavorita no respondió).
  - Fuente actual: https://www.walmart.com.mx/ayuda/articulo/el-fin-irresistible-and-buen-fin-promociones-bancarias/172a059b988640b19ad75c639542df56

## Sin revisión humana

Verificadas por un agente contra una captura, pero ninguna persona las ha cotejado. Confirmar cualquiera también ayuda.

- Amazon México: 34
- Coppel: 9
- The Home Depot México: 24
- Liverpool: 18
- Mercado Libre: 34
- El Palacio de Hierro: 14
- Walmart México: 16
