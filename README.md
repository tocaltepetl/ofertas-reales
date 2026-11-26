# Buscador de promociones

Encuentra la mejor forma de pagar en el Buen Fin, Hot Sale y otros eventos de compras en México: con qué tarjeta, si conviene pagar a MSI o de contado, y qué cupones y bonificaciones aplican, según **las tarjetas que tú tienes**.

Antes de pagar, también te ayuda a revisar con la Procuraduría Federal del Consumidor (Profeco) si el precio es real, y te dice qué hacer si no respetan la promoción.

Es un proyecto abierto de [tocaltepetl](https://github.com/tocaltepetl) y lo mantiene la comunidad. Las promociones cambian a diario, así que cada persona que confirma un dato ayuda a todos. Mira [qué falta confirmar](docs/pendientes.md) y [cómo ayudar](CONTRIBUTING.md).

## Cómo funciona

- **Catálogo** (`catalogo/`): cada promoción es un bloque YAML con su beneficio, condiciones, avisos y la fuente oficial de donde salió. Un evento es una carpeta de datos, sin código propio, así que el próximo evento se agrega sin programar.
- **Motor** (`src/motor.ts`): dada una compra (comercio, precio, día) y tu cartera (tarjetas y atributos), combina las promos compatibles y ordena las opciones por ahorro o por valor total, contando lo que vale financiarte a MSI.
- **Fuentes** (`fuentes/`, `snapshots/`): capturas de las páginas y PDFs de condiciones, para que cada cifra se pueda verificar.
- **Profeco** (`catalogo/profeco.yaml` y el bloque `profeco` de cada `evento.yaml`): el comparador de precios del evento (Quién es Quién en los Precios), los canales de queja y, cuando Profeco publica su balance, las ofertas reales y simuladas que encontró.
- **Web** (`web/`): versión en el navegador.

## Privacidad

- Tu cartera y tus preferencias se quedan en tu navegador; no se envían a ningún servidor.
- Contamos visitas con Cloudflare Web Analytics, sin cookies ni datos personales. Ver la [política de privacidad común](https://github.com/tocaltepetl/.github/blob/main/docs/privacidad.md).

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

Aun así, **las condiciones del banco y del comercio son las que valen.** Revísalas antes de comprar. Este proyecto no está afiliado a ningún banco ni comercio, ni a Profeco, y no es asesoría financiera.

## Contribuir

Issues y PRs bienvenidos. Lee el [CONTRIBUTING común](https://github.com/tocaltepetl/.github/blob/main/CONTRIBUTING.md), el [código de conducta](https://github.com/tocaltepetl/.github/blob/main/CODE_OF_CONDUCT.md) y las reglas propias del catálogo en [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentación

- [CONTRIBUTING.md](CONTRIBUTING.md): cómo confirmar promos, capturar fuentes y mandar cambios.
- [docs/decisiones.md](docs/decisiones.md): por qué está en tocaltepetl, qué publica Profeco y qué falta.
- [docs/pendientes.md](docs/pendientes.md): promociones que necesitan confirmación.
- [docs/aprendizajes.md](docs/aprendizajes.md): dónde están las condiciones reales, trampas de cada sitio y recetas de modelado.

## Licencia

El código es [MIT](LICENSE). El catálogo y la documentación son [CC BY-SA 4.0](LICENSE-DATOS.md). Las capturas de `snapshots/` son de sus titulares y se conservan solo como evidencia.
