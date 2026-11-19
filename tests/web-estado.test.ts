import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Almacen, type Perfil, CLAVE_PERFIL, CLAVE_V1, claveEvento,
  cargarPerfil, guardarPerfil, cargarEstadoEvento, guardarEstadoEvento, migrarV1, almacenNavegador,
  cargarUltimaVista, guardarUltimaVista, borrarDatos, CLAVE_VISTA,
} from "../web/estado.ts";

/** Almacen en memoria; expone el Map para inspeccionarlo. */
function memoria(inicial: Record<string, string> = {}): Almacen & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => { datos.set(k, v); },
    removeItem: (k) => { datos.delete(k); },
    get length() { return datos.size; },
    key: (i) => [...datos.keys()][i] ?? null,
  };
}

/** Almacen que lanza en todo (como un localStorage bloqueado). */
const quebrado: Almacen = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

const defecto = (): Perfil => ({
  tengo: { "bbva-oro": true, "nu": true },
  msi: { "bbva-oro": 12 },
  atributos: { "meli-plus": false, "nivel": "oro" },
  rendimiento: 10,
  criterio: "ahorro",
  soloGarantizado: false,
  precio: 12987,
  categoria: "",
  carteraElegida: false,
});

const VACIO = { dia: null, comercio: null, acumulados: {} };

test("perfil: sin datos devuelve los defectos", () => {
  assert.deepEqual(cargarPerfil(memoria(), defecto()), defecto());
});

test("perfil: mezcla lo guardado sobre los defectos y los productos nuevos toman su defecto", () => {
  const alm = memoria({
    [CLAVE_PERFIL]: JSON.stringify({
      tengo: { "bbva-oro": false, "viejo": true }, // "nu" es nuevo en el catálogo
      msi: { "bbva-oro": 6 },
      atributos: { "meli-plus": true },
      precio: 5000, criterio: "total",
    }),
  });
  const p = cargarPerfil(alm, defecto());
  assert.deepEqual(p.tengo, { "bbva-oro": false, "nu": true, "viejo": true });
  assert.deepEqual(p.msi, { "bbva-oro": 6 });
  assert.deepEqual(p.atributos, { "meli-plus": true, "nivel": "oro" });
  assert.equal(p.precio, 5000);
  assert.equal(p.criterio, "total");
  assert.equal(p.rendimiento, 10);
});

test("perfil: un campo con tipo incorrecto no tumba a los demás", () => {
  const alm = memoria({
    [CLAVE_PERFIL]: JSON.stringify({
      tengo: { "bbva-oro": "sí", "nu": false },
      msi: "doce",
      atributos: { "meli-plus": "true", "nivel": 3 },
      rendimiento: "10", criterio: "barato", soloGarantizado: 1, precio: null, categoria: 7,
    }),
  });
  const p = cargarPerfil(alm, defecto());
  assert.deepEqual(p, { ...defecto(), tengo: { "bbva-oro": true, "nu": false } });
});

test("perfil: JSON corrupto o que no es objeto usa los defectos", () => {
  for (const crudo of ["{no es json", "null", "[1,2]", "42", '"texto"']) {
    assert.deepEqual(cargarPerfil(memoria({ [CLAVE_PERFIL]: crudo }), defecto()), defecto(), crudo);
  }
});

test("perfil: guardar y volver a cargar conserva los valores", () => {
  const alm = memoria();
  const p: Perfil = { ...defecto(), tengo: { "bbva-oro": false, "nu": true }, precio: 999, categoria: "celulares" };
  guardarPerfil(alm, p);
  assert.deepEqual(cargarPerfil(alm, defecto()), p);
});

test("perfil: el resultado no comparte objetos con los defectos", () => {
  const d = defecto();
  const p = cargarPerfil(memoria(), d);
  p.tengo["nu"] = false;
  assert.equal(d.tengo["nu"], true);
});

test("almacén null: carga defectos y las escrituras no lanzan", () => {
  assert.deepEqual(cargarPerfil(null, defecto()), defecto());
  assert.deepEqual(cargarEstadoEvento(null, "buen-fin-2026"), VACIO);
  guardarPerfil(null, defecto());
  guardarEstadoEvento(null, "buen-fin-2026", VACIO);
  migrarV1(null, "buen-fin-2026");
});

test("almacén que lanza: carga defectos y nada lanza", () => {
  assert.deepEqual(cargarPerfil(quebrado, defecto()), defecto());
  assert.deepEqual(cargarEstadoEvento(quebrado, "buen-fin-2026"), VACIO);
  guardarPerfil(quebrado, defecto());
  guardarEstadoEvento(quebrado, "buen-fin-2026", VACIO);
  migrarV1(quebrado, "buen-fin-2026");
});

test("evento: sin datos o corrupto devuelve el estado vacío", () => {
  assert.deepEqual(cargarEstadoEvento(memoria(), "x"), VACIO);
  assert.deepEqual(cargarEstadoEvento(memoria({ [claveEvento("x")]: "{roto" }), "x"), VACIO);
});

test("evento: limpia campos con tipo incorrecto", () => {
  const alm = memoria({
    [claveEvento("x")]: JSON.stringify({
      dia: 20261116, comercio: "coppel",
      acumulados: { a: { compras: 2, beneficio: "100" }, b: "nada", c: { beneficio: 50 } },
    }),
  });
  assert.deepEqual(cargarEstadoEvento(alm, "x"), {
    dia: null, comercio: "coppel", acumulados: { a: { compras: 2 }, c: { beneficio: 50 } },
  });
});

test("evento: dos eventos quedan aislados", () => {
  const alm = memoria();
  guardarEstadoEvento(alm, "buen-fin-2026", { dia: "2026-11-14", comercio: "mercadolibre", acumulados: { p1: { compras: 1 } } });
  guardarEstadoEvento(alm, "hot-sale-2027", { dia: "2027-05-30", comercio: null, acumulados: {} });
  assert.deepEqual(cargarEstadoEvento(alm, "buen-fin-2026"),
    { dia: "2026-11-14", comercio: "mercadolibre", acumulados: { p1: { compras: 1 } } });
  assert.deepEqual(cargarEstadoEvento(alm, "hot-sale-2027"), { dia: "2027-05-30", comercio: null, acumulados: {} });
  assert.deepEqual(cargarEstadoEvento(alm, "otro"), VACIO);
});

// Formato exacto de la interfaz `Estado` de web/app.ts.
const V1 = {
  precio: 8000, dia: "2026-11-15", categoria: "pantallas", rendimiento: 11, criterio: "total",
  soloGarantizado: true, comercio: "liverpool",
  tengo: { "bbva-oro": false }, msi: { "bbva-oro": 18 }, atributos: { "meli-plus": true },
  acumulados: { "promo-1": { compras: 1, beneficio: 300 } },
};

test("migración v1: reparte perfil y evento, y borra la v1", () => {
  const alm = memoria({ [CLAVE_V1]: JSON.stringify(V1) });
  migrarV1(alm, "buen-fin-2026");
  assert.equal(alm.getItem(CLAVE_V1), null);
  assert.deepEqual(cargarPerfil(alm, defecto()), {
    tengo: { "bbva-oro": false, "nu": true }, msi: { "bbva-oro": 18 },
    atributos: { "meli-plus": true, "nivel": "oro" },
    rendimiento: 11, criterio: "total", soloGarantizado: true, precio: 8000, categoria: "pantallas", carteraElegida: false,
  });
  assert.deepEqual(cargarEstadoEvento(alm, "buen-fin-2026"),
    { dia: "2026-11-15", comercio: "liverpool", acumulados: { "promo-1": { compras: 1, beneficio: 300 } } });
  // Cada clave guarda solo lo suyo.
  assert.deepEqual(Object.keys(JSON.parse(alm.getItem(CLAVE_PERFIL)!)).sort(),
    ["atributos", "categoria", "criterio", "msi", "precio", "rendimiento", "soloGarantizado", "tengo"]);
  assert.deepEqual(Object.keys(JSON.parse(alm.getItem(claveEvento("buen-fin-2026"))!)).sort(),
    ["acumulados", "comercio", "dia"]);
});

test("migración v1: es idempotente", () => {
  const alm = memoria({ [CLAVE_V1]: JSON.stringify(V1) });
  migrarV1(alm, "buen-fin-2026");
  const tras1 = new Map(alm.datos);
  migrarV1(alm, "buen-fin-2026");
  assert.deepEqual(alm.datos, tras1);
});

test("migración v1: no pisa un perfil v2 existente", () => {
  const v2 = JSON.stringify({ precio: 1 });
  const alm = memoria({ [CLAVE_V1]: JSON.stringify(V1), [CLAVE_PERFIL]: v2 });
  migrarV1(alm, "buen-fin-2026");
  assert.equal(alm.getItem(CLAVE_PERFIL), v2);
  assert.equal(alm.getItem(claveEvento("buen-fin-2026")), null);
});

test("migración v1: no pisa un estado de evento v2 existente", () => {
  const ev = JSON.stringify({ dia: "2026-11-17", comercio: null, acumulados: {} });
  const alm = memoria({ [CLAVE_V1]: JSON.stringify(V1), [claveEvento("buen-fin-2026")]: ev });
  migrarV1(alm, "buen-fin-2026");
  assert.equal(alm.getItem(claveEvento("buen-fin-2026")), ev);
  assert.equal(cargarPerfil(alm, defecto()).precio, 8000);
  assert.equal(alm.getItem(CLAVE_V1), null);
});

test("migración v1: sin v1 no hace nada; v1 corrupta se descarta", () => {
  const vacio = memoria();
  migrarV1(vacio, "buen-fin-2026");
  assert.equal(vacio.datos.size, 0);

  const roto = memoria({ [CLAVE_V1]: "{roto" });
  migrarV1(roto, "buen-fin-2026");
  assert.equal(roto.datos.size, 0);
});

test("migración v1: si escribir falla conserva la v1 para reintentar", () => {
  const alm = memoria({ [CLAVE_V1]: JSON.stringify(V1) });
  const lleno: Almacen = { ...alm, setItem: () => { throw new Error("QuotaExceededError"); } };
  migrarV1(lleno, "buen-fin-2026");
  assert.notEqual(alm.getItem(CLAVE_V1), null);
  migrarV1(alm, "buen-fin-2026");
  assert.equal(alm.getItem(CLAVE_V1), null);
  assert.equal(cargarPerfil(alm, defecto()).precio, 8000);
});

test("almacenNavegador: null si no hay localStorage o si acceder lanza", (t) => {
  const g = globalThis as { localStorage?: unknown };
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => {
    if (desc) Object.defineProperty(globalThis, "localStorage", desc);
    else delete g.localStorage;
  });

  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: undefined });
  assert.equal(almacenNavegador(), null);

  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  assert.equal(almacenNavegador(), null);

  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: quebrado });
  assert.equal(almacenNavegador(), null);

  const m = memoria();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: m });
  assert.equal(almacenNavegador(), m);
});

test("última vista: se guarda y se lee; vacía o corrupta es null", () => {
  const alm = memoria();
  assert.equal(cargarUltimaVista(alm), null);
  guardarUltimaVista(alm, "buen-fin-2026");
  assert.equal(cargarUltimaVista(alm), "buen-fin-2026");
  assert.equal(cargarUltimaVista(memoria({ [CLAVE_VISTA]: "{roto" })), null);
  assert.equal(cargarUltimaVista(memoria({ [CLAVE_VISTA]: "7" })), null);
  assert.equal(cargarUltimaVista(quebrado), null);
  assert.equal(cargarUltimaVista(null), null);
});

test("borrarDatos: quita todas las claves propias y respeta las ajenas", () => {
  const alm = memoria({
    [CLAVE_PERFIL]: "{}", [claveEvento("buen-fin-2026")]: "{}", [claveEvento("black-friday-2026")]: "{}",
    [CLAVE_VISTA]: '"calendario"', [CLAVE_V1]: "{}", "otra-app": "x",
  });
  assert.equal(borrarDatos(alm), true);
  assert.deepEqual([...alm.datos.keys()], ["otra-app"]);
});

test("borrarDatos: nunca lanza", () => {
  assert.equal(borrarDatos(null), true);
  assert.equal(borrarDatos(quebrado), false);
});
