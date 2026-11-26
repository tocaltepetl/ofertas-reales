/**
 * Compila el catálogo a web/dist/catalogo.json, empaqueta web/app.ts → web/dist/app.js y copia web/publico/.
 * Con --demo incluye también los eventos ficticios de ejemplos/eventos (para probar varios eventos).
 * Con --artefacto escribe en web/dist-artefacto/ la versión para publicar como artefacto de claude.ai:
 * página sin <html>/<head>/<body> (el visor pone el esqueleto), CSS en línea, sin source map y sin
 * el botón .ics (el visor bloquea las descargas) ni el beacon de Cloudflare.
 */
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { cargarCatalogo, EVENTOS_DEMO, RAIZ_PROYECTO } from "../src/catalogo.ts";

const demo = process.argv.includes("--demo");
const artefacto = process.argv.includes("--artefacto");
const dist = join(RAIZ_PROYECTO, "web", artefacto ? "dist-artefacto" : "dist");
mkdirSync(dist, { recursive: true });
const cat = cargarCatalogo(undefined, demo ? { eventosExtra: [EVENTOS_DEMO] } : {});
const json = {
  generado: new Date().toISOString(),
  emisores: cat.emisores,
  comercios: [...cat.comercios.values()],
  eventos: [...cat.eventos.values()],
  promociones: Object.fromEntries(cat.promociones),
  profeco: cat.profeco,
};
writeFileSync(join(dist, "catalogo.json"), JSON.stringify(json));

await build({
  entryPoints: [join(RAIZ_PROYECTO, "web", "app.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: !artefacto,
  define: { ARTEFACTO: String(artefacto) },
  outfile: join(dist, "app.js"),
});
if (artefacto) {
  const html = readFileSync(join(RAIZ_PROYECTO, "web", "index.html"), "utf8");
  const titulo = html.match(/<title>[^<]*<\/title>/)![0];
  // Sin el beacon de Cloudflare: en claude.ai las visitas no son del sitio y el visor bloquea scripts externos
  const cuerpo = html.slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
    .replace(/\s*<!-- Cloudflare Web Analytics[\s\S]*?<\/script>/, "").trim();
  const css = readFileSync(join(RAIZ_PROYECTO, "web", "estilos.css"), "utf8");
  writeFileSync(join(dist, "index.html"), `${titulo}\n<style>\n${css}</style>\n${cuerpo}\n`);
} else {
  copyFileSync(join(RAIZ_PROYECTO, "web", "index.html"), join(dist, "index.html"));
  copyFileSync(join(RAIZ_PROYECTO, "web", "estilos.css"), join(dist, "estilos.css"));
  // favicon, og.png y demás archivos que se sirven tal cual
  cpSync(join(RAIZ_PROYECTO, "web", "publico"), dist, { recursive: true });
}
console.log(`${artefacto ? "web/dist-artefacto" : "web/dist"} listo: ${Object.values(json.promociones).flat().length} promociones${demo ? " (con eventos de demostración)" : ""}`);
