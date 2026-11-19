import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evento } from "../src/esquema.ts";
import { cuadriculaMes, mesesCalendario, carriles, vistaAlEntrar, eventosDelDia, vistaInicial, indicesDeColor, icsDeEvento, VISTA_CALENDARIO } from "../web/calendario.ts";

const ev = (id: string, desde: string, hasta: string, nombre = id): Evento =>
  ({ id, nombre, desde, hasta, zona_horaria: "America/Mexico_City" });

const buenFin = ev("buen-fin-2026", "2026-11-13", "2026-11-17");
const blackFriday = ev("black-friday-2026", "2026-11-27", "2026-12-06");
const hotSale = ev("hot-sale-2027", "2027-05-24", "2027-06-01");

test("cuadriculaMes: noviembre 2026 empieza en domingo y va de lunes a domingo", () => {
  const m = cuadriculaMes("2026-11");
  assert.equal(m.anio, 2026);
  assert.equal(m.mes, 11);
  assert.deepEqual(m.semanas[0], [null, null, null, null, null, null, "2026-11-01"]);
  assert.equal(m.semanas.at(-1)![0], "2026-11-30");
  for (const s of m.semanas) assert.equal(s.length, 7);
  assert.equal(m.semanas.flat().filter(Boolean).length, 30);
});

test("cuadriculaMes: febrero de año bisiesto", () => {
  assert.equal(cuadriculaMes("2028-02").semanas.flat().filter(Boolean).length, 29);
  assert.equal(cuadriculaMes("2027-02").semanas.flat().filter(Boolean).length, 28);
});

test("mesesCalendario: el mes de hoy y los meses con eventos futuros", () => {
  assert.deepEqual(mesesCalendario([buenFin, blackFriday], "2026-11-18").map((m) => m.id), ["2026-11", "2026-12"]);
  assert.deepEqual(mesesCalendario([buenFin], "2026-11-18").map((m) => m.id), ["2026-11"]);
});

test("mesesCalendario: omite los meses vacíos y corta en 12", () => {
  assert.deepEqual(mesesCalendario([blackFriday, hotSale], "2026-11-18").map((m) => m.id), ["2026-11", "2026-12", "2027-05", "2027-06"]);
  const muchos = Array.from({ length: 15 }, (_, i) => ev(`e${i}`, `${2027 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-10`, `${2027 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-12`));
  assert.equal(mesesCalendario(muchos, "2026-11-18").length, 12);
});

test("carriles: los encimados van en carriles distintos y se reutilizan al liberarse", () => {
  const navidad = ev("navidad", "2026-11-16", "2026-11-30");
  const c = carriles([blackFriday, navidad, buenFin, hotSale]);
  assert.equal(c.get("buen-fin-2026"), 0);
  assert.equal(c.get("navidad"), 1);
  assert.equal(c.get("black-friday-2026"), 0);
  assert.equal(c.get("hot-sale-2027"), 0);
});

test("eventosDelDia: inclusivo y ordenado por inicio", () => {
  const encimado = ev("encimado", "2026-11-15", "2026-11-30");
  assert.deepEqual(eventosDelDia([encimado, buenFin], "2026-11-16").map((e) => e.id), ["buen-fin-2026", "encimado"]);
  assert.deepEqual(eventosDelDia([buenFin], "2026-11-17").map((e) => e.id), ["buen-fin-2026"]);
  assert.deepEqual(eventosDelDia([buenFin], "2026-11-18"), []);
});

test("vistaInicial: activo con promos; próximo cercano con promos; si no, calendario", () => {
  const todos = () => true;
  assert.equal(vistaInicial([buenFin, blackFriday], todos, "2026-11-15"), "buen-fin-2026");
  assert.equal(vistaInicial([buenFin, blackFriday], todos, "2026-11-18"), "black-friday-2026");
  assert.equal(vistaInicial([buenFin, hotSale], todos, "2026-11-18"), VISTA_CALENDARIO);
});

test("vistaInicial: un evento sin promos nunca abre por defecto", () => {
  const conPromos = (id: string) => id === "buen-fin-2026";
  assert.equal(vistaInicial([buenFin, blackFriday], conPromos, "2026-11-18"), VISTA_CALENDARIO);
  assert.equal(vistaInicial([buenFin, blackFriday], conPromos, "2026-11-28"), VISTA_CALENDARIO);
  assert.equal(vistaInicial([buenFin, blackFriday], conPromos, "2026-11-14"), "buen-fin-2026");
});

test("indicesDeColor: por fecha de inicio y cíclicos", () => {
  const m = indicesDeColor([hotSale, blackFriday, buenFin], 2);
  assert.equal(m.get("buen-fin-2026"), 0);
  assert.equal(m.get("black-friday-2026"), 1);
  assert.equal(m.get("hot-sale-2027"), 0);
});

test("icsDeEvento: días completos con DTEND exclusivo y texto escapado", () => {
  const ics = icsDeEvento(ev("bf", "2026-11-27", "2026-11-30", "Black Friday, Cyber Monday"), "https://x.mx/#bf", new Date("2026-11-18T17:05:09.123Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nDTSTART;VALUE=DATE:20261127\r\n/);
  assert.match(ics, /\r\nDTEND;VALUE=DATE:20261201\r\n/);
  assert.match(ics, /\r\nDTSTAMP:20261118T170509Z\r\n/);
  assert.match(ics, /\r\nSUMMARY:Black Friday\\, Cyber Monday\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("icsDeEvento: fin de año cruza a enero", () => {
  assert.match(icsDeEvento(ev("x", "2026-12-26", "2026-12-31"), "u", new Date()), /DTEND;VALUE=DATE:20270101/);
});

test("vistaAlEntrar: recuerda el calendario y los eventos vigentes o próximos", () => {
  const todos = () => true;
  assert.equal(vistaAlEntrar([buenFin, blackFriday], todos, "2026-11-15", VISTA_CALENDARIO), VISTA_CALENDARIO);
  assert.equal(vistaAlEntrar([buenFin, blackFriday], todos, "2026-11-15", "black-friday-2026"), "black-friday-2026");
  assert.equal(vistaAlEntrar([buenFin, blackFriday], todos, "2026-11-16", "buen-fin-2026"), "buen-fin-2026");
});

test("vistaAlEntrar: un evento pasado, inexistente o nada guardado usa la vista inicial", () => {
  const todos = () => true;
  assert.equal(vistaAlEntrar([buenFin, blackFriday], todos, "2026-11-28", "buen-fin-2026"), "black-friday-2026");
  assert.equal(vistaAlEntrar([buenFin, blackFriday], todos, "2026-11-28", "ya-no-existe"), "black-friday-2026");
  assert.equal(vistaAlEntrar([buenFin, hotSale], todos, "2026-11-18", null), VISTA_CALENDARIO);
});
