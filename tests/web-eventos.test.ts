import { test } from "node:test";
import assert from "node:assert/strict";
import { cargarCatalogo } from "../src/catalogo.ts";
import type { Evento } from "../src/esquema.ts";
import {
  hoyEn, faseDe, agenda, eventoPorDefecto, diasDe, diasEntre, diaInicial,
  categoriasDe, etiquetaCategoria, textoFase,
} from "../web/eventos.ts";

const ev = (id: string, desde: string, hasta: string): Evento =>
  ({ id, nombre: id, desde, hasta, zona_horaria: "America/Mexico_City" });

const buenFin = ev("buen-fin-2026", "2026-11-13", "2026-11-17");
const hotSale = ev("hot-sale-2026", "2026-05-25", "2026-06-02");
const navidad = ev("navidad-2026", "2026-12-01", "2026-12-24");
const cyber = ev("cyber-2026", "2026-11-16", "2026-11-20");
const enero = ev("cuesta-2027", "2027-01-10", "2027-01-15");

test("hoyEn: 23:30 en la Ciudad de México sigue siendo el mismo día (en UTC ya es el siguiente)", () => {
  // 17 nov 2026 23:30 CDMX (UTC-6) = 18 nov 05:30 UTC
  const ahora = new Date("2026-11-18T05:30:00Z");
  assert.equal(ahora.toISOString().slice(0, 10), "2026-11-18");
  assert.equal(hoyEn("America/Mexico_City", ahora), "2026-11-17");
  assert.equal(hoyEn("UTC", ahora), "2026-11-18");
  assert.match(hoyEn("America/Mexico_City"), /^\d{4}-\d{2}-\d{2}$/);
});

test("faseDe: inclusiva en el primer y el último día", () => {
  assert.equal(faseDe(buenFin, "2026-11-12"), "proximo");
  assert.equal(faseDe(buenFin, "2026-11-13"), "activo");
  assert.equal(faseDe(buenFin, "2026-11-15"), "activo");
  assert.equal(faseDe(buenFin, "2026-11-17"), "activo");
  assert.equal(faseDe(buenFin, "2026-11-18"), "pasado");
});

test("agenda: eventos encimados y orden de cada grupo", () => {
  const a = agenda([navidad, cyber, hotSale, enero, buenFin, ev("viejo", "2025-11-14", "2025-11-17")], "2026-11-17");
  assert.deepEqual(a.activos.map((e) => e.id), ["buen-fin-2026", "cyber-2026"]);
  assert.deepEqual(a.proximos.map((e) => e.id), ["navidad-2026", "cuesta-2027"]);
  assert.deepEqual(a.pasados.map((e) => e.id), ["hot-sale-2026", "viejo"]);
});

test("eventoPorDefecto: con varios activos, el que termina antes", () => {
  assert.equal(eventoPorDefecto([cyber, buenFin, navidad], "2026-11-16")?.id, "buen-fin-2026");
});

test("eventoPorDefecto: el próximo si empieza en 14 días o menos", () => {
  // 17 nov → 1 dic = 14 días
  assert.equal(eventoPorDefecto([hotSale, navidad, enero], "2026-11-17")?.id, "navidad-2026");
  assert.equal(eventoPorDefecto([hotSale, navidad, enero], "2026-11-30")?.id, "navidad-2026");
});

test("eventoPorDefecto: el pasado más reciente si el próximo está lejos", () => {
  // 16 nov → 1 dic = 15 días
  assert.equal(eventoPorDefecto([hotSale, navidad, enero], "2026-11-16")?.id, "hot-sale-2026");
  assert.equal(eventoPorDefecto([hotSale, buenFin, enero], "2026-11-20")?.id, "buen-fin-2026");
});

test("eventoPorDefecto: el próximo aunque esté lejos si no hay pasados; undefined sin eventos", () => {
  assert.equal(eventoPorDefecto([enero, navidad], "2026-06-01")?.id, "navidad-2026");
  assert.equal(eventoPorDefecto([], "2026-06-01"), undefined);
});

test("diasDe y diasEntre: rangos que cruzan cambios de horario y de año", () => {
  assert.deepEqual(diasDe(buenFin), ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
  // fin del horario de verano en EE. UU. (1 nov 2026) e inicio (8 mar 2026)
  const otono = diasDe(ev("x", "2026-10-30", "2026-11-03"));
  assert.deepEqual(otono, ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(diasDe(ev("x", "2026-03-07", "2026-03-09")).length, 3);
  assert.deepEqual(diasDe(ev("x", "2026-12-31", "2027-01-01")), ["2026-12-31", "2027-01-01"]);
  assert.deepEqual(diasDe(ev("x", "2026-11-13", "2026-11-13")), ["2026-11-13"]);
  assert.equal(diasEntre("2026-11-13", "2026-11-17"), 4);
  assert.equal(diasEntre("2026-11-17", "2026-11-13"), -4);
  assert.equal(diasEntre("2026-03-01", "2026-04-01"), 31);
  assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);
});

test("diaInicial: hoy, primer día, último día y el guardado si cae en el rango", () => {
  assert.equal(diaInicial(buenFin, "2026-11-15"), "2026-11-15");
  assert.equal(diaInicial(buenFin, "2026-11-01"), "2026-11-13");
  assert.equal(diaInicial(buenFin, "2026-11-30"), "2026-11-17");
  assert.equal(diaInicial(buenFin, "2026-11-15", "2026-11-13"), "2026-11-13");
  assert.equal(diaInicial(buenFin, "2026-11-30", "2026-11-14"), "2026-11-14");
  assert.equal(diaInicial(buenFin, "2026-11-15", "2026-11-18"), "2026-11-15");
  assert.equal(diaInicial(buenFin, "2026-11-15", null), "2026-11-15");
  assert.equal(diaInicial(buenFin, "2026-11-15", ""), "2026-11-15");
});

test("categoriasDe: el catálogo real incluye hogar y línea blanca, sin duplicados y en orden", () => {
  const cat = cargarCatalogo();
  const promos = [...cat.promociones.values()].flat();
  const cats = categoriasDe(promos);
  const ids = cats.map((c) => c.id);
  for (const id of ["ropa", "calzado", "accesorios", "hogar", "linea-blanca"]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(cats.find((c) => c.id === "linea-blanca"), { id: "linea-blanca", etiqueta: "Línea blanca" });
  const etiquetas = cats.map((c) => c.etiqueta);
  assert.deepEqual(etiquetas, [...etiquetas].sort((a, b) => a.localeCompare(b, "es-MX")));
  assert.deepEqual(categoriasDe([]), []);
});

test("etiquetaCategoria: tabla conocida y respaldo genérico", () => {
  assert.equal(etiquetaCategoria("linea-blanca"), "Línea blanca");
  assert.equal(etiquetaCategoria("hogar"), "Hogar");
  assert.equal(etiquetaCategoria("ropa-interior"), "Ropa interior");
  assert.equal(etiquetaCategoria("x"), "X");
});

test("textoFase: activo, próximo y pasado", () => {
  assert.equal(textoFase(buenFin, "2026-11-17"), "Termina hoy");
  assert.equal(textoFase(buenFin, "2026-11-15"), "Quedan 3 días");
  assert.equal(textoFase(buenFin, "2026-11-13"), "Quedan 5 días");
  assert.equal(textoFase(buenFin, "2026-11-12"), "Empieza mañana");
  assert.equal(textoFase(buenFin, "2026-11-01"), "Empieza en 12 días");
  assert.equal(textoFase(buenFin, "2026-11-18"), "Terminó el 17 nov 2026");
});
