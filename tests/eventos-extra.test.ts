import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cargarCatalogo, ErrorCatalogo, EVENTOS_DEMO, RAIZ_PROYECTO } from "../src/catalogo.ts";

test("sin opciones solo se carga el catálogo principal", () => {
  const cat = cargarCatalogo();
  assert.ok(![...cat.eventos.keys()].some((id) => id.startsWith("demo-")));
});

test("los eventos de ejemplo cargan y validan junto al catálogo", () => {
  const cat = cargarCatalogo(undefined, { eventosExtra: [EVENTOS_DEMO] });
  assert.equal(cat.eventos.size, 3);
  for (const id of ["buen-fin-2026", "demo-hot-sale-2027", "demo-venta-navidena-2026"]) assert.ok(cat.eventos.has(id), id);
  for (const id of ["demo-hot-sale-2027", "demo-venta-navidena-2026"]) {
    assert.match(cat.eventos.get(id)!.nombre, /DEMO/);
    assert.ok((cat.promociones.get(id) ?? []).length >= 4, `${id}: al menos 4 promos`);
  }
});

test("un id de evento duplicado es error", () => {
  const tmp = mkdtempSync(join(tmpdir(), "buenfin-eventos-"));
  try {
    cpSync(join(RAIZ_PROYECTO, "catalogo", "eventos", "buen-fin-2026"), join(tmp, "buen-fin-2026"), { recursive: true });
    assert.throws(
      () => cargarCatalogo(undefined, { eventosExtra: [tmp] }),
      (e: unknown) => e instanceof ErrorCatalogo && e.errores.some((m) => m.includes("evento duplicado buen-fin-2026")),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
