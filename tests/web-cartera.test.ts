import { test } from "node:test";
import assert from "node:assert/strict";
import type { Emisor } from "../src/esquema.ts";
import { ordenarEmisores } from "../web/cartera.ts";

const em = (id: string, nombre: string, productos: string[]): Emisor =>
  ({ id, nombre, productos: productos.map((p) => ({ id: p, nombre: p, tipo: "credito" })) }) as Emisor;

const emisores = [
  em("mercadopago", "Mercado Pago", ["mercadopago.tdc"]),
  em("banamex", "Banamex", ["banamex.tdc"]),
  em("amex", "American Express", ["amex.tdc"]),
  em("bbva", "BBVA", ["bbva.tdc", "bbva.debito"]),
  em("openbank", "Openbank", ["openbank.debito"]),
];
const ids = (l: Emisor[]) => l.map((e) => e.id);

test("sin cartera elegida: alfabético, sin importar lo marcado", () => {
  const todo = { "mercadopago.tdc": true, "banamex.tdc": true, "amex.tdc": true, "bbva.tdc": true, "bbva.debito": true, "openbank.debito": true };
  assert.deepEqual(ids(ordenarEmisores(emisores, todo, false)), ["amex", "banamex", "bbva", "mercadopago", "openbank"]);
});

test("con cartera elegida: primero los emisores con alguna tarjeta marcada, cada grupo alfabético", () => {
  const tengo = { "openbank.debito": true, "bbva.debito": true, "bbva.tdc": false, "amex.tdc": false };
  assert.deepEqual(ids(ordenarEmisores(emisores, tengo, true)), ["bbva", "openbank", "amex", "banamex", "mercadopago"]);
});

test("no modifica la lista original y no distingue mayúsculas ni acentos", () => {
  const copia = [...emisores];
  ordenarEmisores(emisores, {}, true);
  assert.deepEqual(emisores, copia);
  const l = [em("b", "Ñu", []), em("a", "nu", []), em("c", "Éxito", []), em("d", "eco", [])];
  assert.deepEqual(ids(ordenarEmisores(l, {}, true)), ["d", "c", "a", "b"]);
});
