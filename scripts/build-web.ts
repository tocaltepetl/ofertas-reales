/**
 * Compila el catálogo a web/dist/catalogo.json y empaqueta web/app.ts → web/dist/app.js.
 * Con --demo incluye también los eventos ficticios de ejemplos/eventos (para probar varios eventos).
 */
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { cargarCatalogo, EVENTOS_DEMO, RAIZ_PROYECTO } from "../src/catalogo.ts";

const dist = join(RAIZ_PROYECTO, "web", "dist");
mkdirSync(dist, { recursive: true });

const demo = process.argv.includes("--demo");
const cat = cargarCatalogo(undefined, demo ? { eventosExtra: [EVENTOS_DEMO] } : {});
const json = {
  generado: new Date().toISOString(),
  emisores: cat.emisores,
  comercios: [...cat.comercios.values()],
  // Un evento sin promos todavía (p. ej. recién creado) no se publica: la web lo elegiría por defecto si empieza pronto.
  eventos: [...cat.eventos.values()].filter((ev) => (cat.promociones.get(ev.id) ?? []).length > 0),
  promociones: Object.fromEntries(cat.promociones),
};
writeFileSync(join(dist, "catalogo.json"), JSON.stringify(json));

await build({
  entryPoints: [join(RAIZ_PROYECTO, "web", "app.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: true,
  outfile: join(dist, "app.js"),
});
copyFileSync(join(RAIZ_PROYECTO, "web", "index.html"), join(dist, "index.html"));
copyFileSync(join(RAIZ_PROYECTO, "web", "estilos.css"), join(dist, "estilos.css"));
console.log(`web/dist listo: ${Object.values(json.promociones).flat().length} promociones${demo ? " (con eventos de demostración)" : ""}`);
