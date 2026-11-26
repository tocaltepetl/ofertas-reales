import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evento, Profeco } from "../src/esquema.ts";
import { cargarCatalogo } from "../src/catalogo.ts";
import { cambioPct, esSimulada, comparadorDe, htmlProfeco } from "../web/profeco.ts";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const canales: Profeco = {
  telefono: { nacional: "800 468 8722", cdmx: "55 5568 8722", horario: "todos los días" },
  concilianet: "https://concilianet.profeco.gob.mx/",
  oficinas: "https://www.gob.mx/profeco/acciones-y-programas/oficinas-de-defensa-del-consumidor-en-el-pais",
  comparador: "https://qqp.profeco.gob.mx/",
  fuente: { url: "https://concilianet.profeco.gob.mx/", revisada: "2026-11-26" },
};
const base: Evento = { id: "bf", nombre: "El Buen Fin", desde: "2026-11-13", hasta: "2026-11-17", zona_horaria: "America/Mexico_City" };
const conProfeco: Evento = {
  ...base,
  profeco: {
    comparador: "https://elbuenfin.profeco.gob.mx/",
    balance: {
      titulo: "Balance", url: "https://www.gob.mx/profeco/prensa/x", fecha: "2026-11-23", resumen: "Monitoreo.",
      casos: [
        { tienda: "Tienda A", producto: "Pantalla", antes: 8999, durante: 5599 },
        { tienda: "Tienda <B>", producto: "Lavadora", antes: 9199, durante: 14699 },
      ],
    },
  },
};

test("cambioPct y esSimulada: una oferta que sube de precio es simulada", () => {
  const baja = conProfeco.profeco!.balance!.casos[0], sube = conProfeco.profeco!.balance!.casos[1];
  assert.equal(cambioPct(baja).toFixed(1), "-37.8");
  assert.equal(cambioPct(sube).toFixed(1), "59.8");
  assert.equal(esSimulada(baja), false);
  assert.equal(esSimulada(sube), true);
});

test("comparadorDe: el micrositio del evento mientras dura, Quién es Quién cuando ya pasó", () => {
  assert.equal(comparadorDe(conProfeco, canales, "proximo"), "https://elbuenfin.profeco.gob.mx/");
  assert.equal(comparadorDe(conProfeco, canales, "activo"), "https://elbuenfin.profeco.gob.mx/");
  assert.equal(comparadorDe(conProfeco, canales, "pasado"), "https://qqp.profeco.gob.mx/");
  assert.equal(comparadorDe(base, canales, "activo"), "https://qqp.profeco.gob.mx/");
  assert.equal(comparadorDe(base, undefined, "activo"), undefined);
});

test("htmlProfeco: vacío sin datos de Profeco", () => {
  assert.equal(htmlProfeco(base, undefined, "activo", esc), "");
});

test("htmlProfeco: canales, hallazgos marcados y texto escapado", () => {
  const h = htmlProfeco(conProfeco, canales, "pasado", esc);
  assert.match(h, /800 468 8722/);
  assert.match(h, /concilianet\.profeco\.gob\.mx/);
  assert.match(h, /Para el próximo evento/);
  assert.match(h, /Simulada/);
  assert.match(h, /Real/);
  assert.match(h, /\+59\.8%/);
  assert.match(h, /Tienda &lt;B&gt;/);
  assert.doesNotMatch(h, /<B>/);
});

test("catálogo: el Buen Fin 2026 trae el balance de Profeco y los canales cargan", () => {
  const cat = cargarCatalogo();
  assert.ok(cat.profeco?.telefono.nacional);
  const bf = cat.eventos.get("buen-fin-2026")!;
  assert.ok(bf.profeco?.balance?.casos.length);
  assert.ok(bf.profeco!.balance!.casos.some(esSimulada));
});
