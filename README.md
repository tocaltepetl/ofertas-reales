# Buscador de promociones

Encuentra la mejor forma de pagar en el Buen Fin, Hot Sale y otros eventos de compras en México: con qué tarjeta, si conviene pagar a MSI o de contado, y qué cupones y bonificaciones aplican, según **las tarjetas que tú tienes**.

Es un proyecto abierto y lo mantiene la comunidad. Las promociones cambian a diario, así que cada persona que confirma un dato ayuda a todos. Mira [qué falta confirmar](docs/pendientes.md) y [cómo ayudar](CONTRIBUTING.md).

## Cómo funciona

- **Catálogo** (`catalogo/`): cada promoción es un bloque YAML con su beneficio, condiciones, avisos y la fuente oficial de donde salió. Un evento es una carpeta de datos, sin código propio, así que el próximo evento se agrega sin programar.
- **Motor** (`src/motor.ts`): dada una compra (comercio, precio, día) y tu cartera (tarjetas y atributos), combina las promos compatibles y ordena las opciones por ahorro o por valor total, contando lo que vale financiarte a MSI.
- **Fuentes** (`fuentes/`, `snapshots/`): capturas de las páginas y PDFs de condiciones, para que cada cifra se pueda verificar.
- **Web** (`web/`): versión en el navegador. Tu cartera se queda en tu dispositivo.

## Uso

```sh
npm install
npm run validar                                          # revisa el catálogo
npm run evaluar -- --comercio liverpool --precio 15000   # con tu cartera en ejemplos/cartera.yaml
node src/cli.ts comparar --precio 15000                  # compara todos los comercios
npm run web                                              # http://127.0.0.1:8766
```

## Qué tan confiable es

Cada promo dice cómo se verificó (`fuente.verificacion`):

- **coincide / corregida:** un agente automático la cotejó contra una captura de la fuente oficial.
- **dudosa:** falta un dato o las fuentes se contradicen; el motor la muestra con avisos.
- **revisada: true:** una persona la confirmó.

Aun así, **las condiciones del banco y del comercio son las que valen.** Revísalas antes de comprar. Este proyecto no está afiliado a ningún banco ni comercio, y no es asesoría financiera.

## Documentación

- [CONTRIBUTING.md](CONTRIBUTING.md): cómo confirmar promos, capturar fuentes y mandar cambios.
- [docs/pendientes.md](docs/pendientes.md): promociones que necesitan confirmación.
- [docs/aprendizajes.md](docs/aprendizajes.md): dónde están las condiciones reales, trampas de cada sitio y recetas de modelado.
