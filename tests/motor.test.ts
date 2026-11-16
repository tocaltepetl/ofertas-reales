import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cargarCatalogo, RAIZ_PROYECTO } from "../src/catalogo.ts";
import { evaluar, ordenar, valorFinanciamiento, planesDePago } from "../src/motor.ts";

const cat = cargarCatalogo();
const compra = (precio: number, dia = "2026-11-16", msi: Record<string, number> = {}) =>
  ({ evento: "buen-fin-2026", comercio: "mercadolibre", precio, dia, msi });
const P = { rendimiento_anual: 10 };

test("el catálogo carga y tiene las promos de Mercado Libre", () => {
  assert.ok((cat.promociones.get("buen-fin-2026") ?? []).filter((p) => p.comercio === "mercadolibre").length >= 34);
});

test("cada cupón aparece en el snapshot de su fuente", () => {
  for (const p of cat.promociones.get("buen-fin-2026") ?? []) {
    if (!p.codigo || !p.fuente.snapshot) continue;
    const texto = readFileSync(join(RAIZ_PROYECTO, p.fuente.snapshot), "utf8");
    assert.ok(texto.includes(p.codigo), `${p.id}: ${p.codigo} no está en ${p.fuente.snapshot}`);
  }
});

test("valor de los MSI", () => {
  assert.equal(valorFinanciamiento(12000, 0, 10), 0);
  assert.equal(valorFinanciamiento(12000, 12, 0), 0);
  const v = valorFinanciamiento(12000, 12, 10);
  assert.ok(v > 600 && v < 700, `12 MSI de $12,000 al 10% valen ~$650, no ${v}`);
});

test("planes de pago: contado + plazos estándar hasta el máximo del producto", () => {
  assert.deepEqual(planesDePago(cat, "santander.tdc", compra(1, undefined, { "santander.tdc": 12 })), [0, 3, 6, 9, 12]);
  assert.deepEqual(planesDePago(cat, "oxxo.efectivo", compra(1, undefined, { "oxxo.efectivo": 12 })), [0]);
  assert.deepEqual(planesDePago(cat, "bbva.tdc", compra(1)), [0]);
});

test("Santander: cupón + cashback a 6 MSI, calculando el cashback tras el cupón", () => {
  const { opciones } = evaluar(cat, compra(20000, "2026-11-16", { "santander.tdc": 12 }),
    { instrumentos: ["santander.tdc"], atributos: {} }, P);
  const o = opciones.find((o) => o.promos.map((p) => p.id).sort().join() === "ml-santander-cashback,ml-santbf")!;
  assert.equal(o.meses, 6);
  assert.equal(o.descuento_checkout, 1000);
  assert.equal(o.beneficio_posterior, 1900); // 10% de 19,000
  assert.equal(o.monto_cobrado, 19000);
});

test("el 17 con nómina, Santander sube a 35% y queda marcado como 'hasta'", () => {
  const { opciones } = evaluar(cat, compra(15000, "2026-11-17", { "santander.tdc": 12 }),
    { instrumentos: ["santander.tdc"], atributos: { santander_nomina: true } }, P);
  const solo = opciones.find((o) => o.promos.length === 1 && o.promos[0].id === "ml-santander-cashback" && o.meses === 12)!;
  assert.equal(solo.ahorro, 5250);
  assert.equal(solo.certeza, "hasta");
});

test("un solo cupón por compra en Mercado Libre y exclusiones declaradas", () => {
  const { opciones } = evaluar(cat, compra(20000, "2026-11-16", { "banamex.tdc": 24, "mercadopago.tdc": 6 }),
    { instrumentos: ["mercadopago.credito", "banamex.tdc"], atributos: { mercadopago_credito_primera_vez: true } }, P);
  for (const o of opciones) {
    assert.ok(o.promos.filter((p) => p.beneficio.tipo === "cupon").length <= 1, o.promos.map((p) => p.id).join("+"));
    const ids = o.promos.map((p) => p.id);
    assert.ok(!(ids.includes("ml-bnmxbf") && ids.includes("ml-banamex-bonificacion")));
  }
});

test("Openbank: cupón de contado y cashback al diferir 9 meses en la app", () => {
  const { opciones } = evaluar(cat, compra(4000, "2026-11-16", { "openbank.tdc": 6 }),
    { instrumentos: ["openbank.tdc"], atributos: {} }, P);
  const o = ordenar(opciones)[0];
  assert.deepEqual(o.promos.map((p) => p.id).sort(), ["ml-opbabf", "ml-openbank-cashback"]);
  assert.equal(o.meses, 0);
  assert.equal(o.meses_financiamiento, 9);
  assert.equal(o.ahorro, 400 + 500);
  assert.ok(o.requisitos.some((r) => r.includes("app")));
});

test("explica por qué no aplica una promo", () => {
  const { no_aplican } = evaluar(cat, compra(2000, "2026-11-16", { "bbva.tdc": 15 }),
    { instrumentos: ["bbva.tdc", "invex.tdc"], atributos: {} }, P);
  const razon = (id: string) => no_aplican.find((n) => n.promo.id === id)?.razon ?? "";
  assert.match(razon("ml-bbvabf"), /mínima de \$5,000/);
  assert.match(razon("ml-invex-bonificacion"), /requisito/);
});

test("HSBC suma otras compras al mínimo acumulado", () => {
  const sin = evaluar(cat, compra(12000, "2026-11-16", { "hsbc.tdc": 12 }), { instrumentos: ["hsbc.tdc"], atributos: {} }, P);
  const con = evaluar(cat, compra(12000, "2026-11-16", { "hsbc.tdc": 12 }), { instrumentos: ["hsbc.tdc"], atributos: { hsbc_otras_compras: 5000, hsbc_segmento: "premier" } }, P);
  assert.ok(!sin.opciones.some((o) => o.promos.some((p) => p.id === "ml-hsbc-devolucion")));
  const dev = con.opciones.find((o) => o.promos.length === 1 && o.promos[0].id === "ml-hsbc-devolucion" && o.meses === 12)!;
  assert.equal(dev.ahorro, 3000); // 25% de 12,000
});
