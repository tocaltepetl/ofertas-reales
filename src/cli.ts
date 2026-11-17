/**
 * Uso:
 *   node src/cli.ts validar
 *   node src/cli.ts evaluar --comercio mercadolibre --precio 12987 [--dia 2026-11-16] [--cartera ejemplos/cartera.yaml]
 *                           [--evento buen-fin-2026] [--criterio ahorro|total] [--todas] [--rendimiento 10] [--categoria ropa]
 *   node src/cli.ts comparar --precio 12987 [--comercios amazon,walmart] [--dia …] [--cartera …] [--criterio …] [--categoria …]
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { z } from "zod";
import { cargarCatalogo, ErrorCatalogo, type Catalogo } from "./catalogo.ts";
import { evaluar, ordenar, mejoresPorInstrumento, type Opcion, type Criterio } from "./motor.ts";

const ArchivoCartera = z.object({
  instrumentos: z.array(z.string()),
  atributos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  msi: z.record(z.string(), z.number()).default({}),
  /** MSI distintos en un comercio (se mezclan sobre msi) */
  msi_por_comercio: z.record(z.string(), z.record(z.string(), z.number())).default({}),
  /** por campaña: lo que ya compraste y el beneficio que ya recibiste en el evento */
  acumulados: z.record(z.string(), z.object({ compras: z.number().optional(), beneficio: z.number().optional() })).default({}),
  rendimiento_anual: z.number().default(10),
});

const $ = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
const lpad = (s: string, n: number) => s.padStart(n);

function nombreInstrumento(cat: Catalogo, id: string) {
  return cat.productos.get(id)?.nombre ?? id;
}

function imprimir(cat: Catalogo, ops: Opcion[], criterio: Criterio) {
  console.log(
    `${lpad("#", 3)}  ${pad("Instrumento", 34)} ${pad("Promociones", 44)} ${lpad("Ahorro", 8)} ${lpad("Valor MSI", 9)} ${lpad("Total", 8)} ${lpad("Pagas", 9)} ${lpad("Meses", 5)}  Certeza`,
  );
  ops.forEach((o, i) => {
    console.log(
      `${lpad(String(i + 1), 3)}  ${pad(nombreInstrumento(cat, o.instrumento), 34)} ${pad(o.promos.map((p) => p.nombre).join(" + "), 44)} ` +
        `${lpad($(o.ahorro), 8)} ${lpad($(o.valor_msi), 9)} ${lpad($(o.total), 8)} ${lpad($(o.costo_real), 9)} ${lpad(o.meses_financiamiento ? String(o.meses_financiamiento) : "cont.", 5)}  ${o.certeza}`,
    );
  });
  const g = ops[0];
  if (!g) return;
  console.log(`\nMejor por ${criterio}: ${nombreInstrumento(cat, g.instrumento)} — ${g.promos.map((p) => p.nombre).join(" + ")}`);
  for (const a of g.aportes) console.log(`  · ${a.promo.nombre}: ${$(a.monto)}${a.pct !== undefined ? ` (${a.pct}%)` : ""}${a.nota ? ` — ${a.nota}` : ""}`);
  console.log(`  Pagas ${$(g.monto_cobrado)} en el comercio${g.meses ? ` a ${g.meses} MSI` : " de contado"}; costo real ${$(g.costo_real)}.`);
  for (const r of g.requisitos) console.log(`  ✓ ${r}`);
  for (const a of g.avisos) console.log(`  ! ${a}`);
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      comercio: { type: "string" }, precio: { type: "string" }, dia: { type: "string" },
      evento: { type: "string", default: "buen-fin-2026" }, cartera: { type: "string", default: "ejemplos/cartera.yaml" },
      criterio: { type: "string", default: "ahorro" }, todas: { type: "boolean", default: false },
      rendimiento: { type: "string" }, categoria: { type: "string" }, comercios: { type: "string" },
    },
  });
  let cat: Catalogo;
  try {
    cat = cargarCatalogo();
  } catch (e) {
    if (e instanceof ErrorCatalogo) { console.error(e.message); process.exit(1); }
    throw e;
  }

  if (positionals[0] === "validar") {
    const n = [...cat.promociones.values()].reduce((s, l) => s + l.length, 0);
    const todas = [...cat.promociones.values()].flat();
    const sinRevisar = todas.filter((p) => !p.fuente.revisada).length;
    const porResultado = new Map<string, number>();
    for (const p of todas) { const k = p.fuente.verificacion ? `${p.fuente.verificacion.resultado} (${p.fuente.verificacion.por})` : "sin verificar"; porResultado.set(k, (porResultado.get(k) ?? 0) + 1); }
    console.log(`Catálogo válido: ${cat.productos.size} instrumentos, ${cat.comercios.size} comercios, ${cat.eventos.size} evento(s), ${n} promociones (${sinRevisar} sin revisión humana).`);
    console.log(`Verificación: ${[...porResultado].map(([k, v]) => `${v} ${k}`).join(", ")}`);
    return;
  }
  if (positionals[0] === "comparar" && values.precio) {
    const cartera = ArchivoCartera.parse(parse(readFileSync(values.cartera!, "utf8")));
    const ev = cat.eventos.get(values.evento!)!;
    const hoy = new Date().toISOString().slice(0, 10);
    const dia = values.dia ?? (hoy >= ev.desde && hoy <= ev.hasta ? hoy : ev.desde);
    const criterio = values.criterio === "total" ? "total" : "ahorro";
    const precio = Number(values.precio);
    const ids = values.comercios ? values.comercios.split(",") : [...new Set((cat.promociones.get(ev.id) ?? []).map((p) => p.comercio))];
    console.log(`Comparación · ${$(precio)} · ${dia} · ${ev.nombre}${values.categoria ? ` · categoría ${values.categoria}` : ""} · por ${criterio}\n`);
    console.log(`${pad("Comercio", 22)} ${pad("Mejor forma de pagar", 70)} ${lpad("Ahorro", 8)} ${lpad("Total", 8)} ${lpad("Pagas", 9)} ${lpad("Meses", 5)}  Certeza`);
    const filas = ids.map((c) => {
      const r = evaluar(cat,
        { evento: ev.id, comercio: c, precio, dia, msi: { ...cartera.msi, ...(cartera.msi_por_comercio[c] ?? {}) }, categoria: values.categoria },
        { instrumentos: cartera.instrumentos, atributos: cartera.atributos, acumulados: cartera.acumulados },
        { rendimiento_anual: values.rendimiento ? Number(values.rendimiento) : cartera.rendimiento_anual });
      return { c, o: ordenar(r.opciones, criterio)[0], garant: ordenar(r.opciones.filter((o) => o.certeza === "garantizado"), criterio)[0] };
    }).sort((a, b) => (b.o?.[criterio] ?? 0) - (a.o?.[criterio] ?? 0));
    for (const { c, o, garant } of filas) {
      const nombre = cat.comercios.get(c)?.nombre ?? c;
      if (!o) { console.log(`${pad(nombre, 22)} (ninguna promo aplica)`); continue; }
      const linea = (x: Opcion) => `${pad(`${nombreInstrumento(cat, x.instrumento)}: ${x.promos.map((p) => p.nombre).join(" + ")}`, 70)} ${lpad($(x.ahorro), 8)} ${lpad($(x.total), 8)} ${lpad($(x.costo_real), 9)} ${lpad(x.meses_financiamiento ? String(x.meses_financiamiento) : "cont.", 5)}  ${x.certeza}`;
      console.log(`${pad(nombre, 22)} ${linea(o)}`);
      if (garant && garant !== o) console.log(`${pad("  └ solo garantizado", 22)} ${linea(garant)}`);
    }
    console.log("\nOjo: los MSI de cada tarjeta varían por producto y comercio (usa msi_por_comercio en la cartera).");
    return;
  }
  if (positionals[0] !== "evaluar" || !values.comercio || !values.precio) {
    console.error("Uso: node src/cli.ts validar | evaluar --comercio <id> --precio <n> [--dia AAAA-MM-DD] [--cartera archivo.yaml] [--criterio ahorro|total] [--todas]");
    process.exit(2);
  }
  const cartera = ArchivoCartera.parse(parse(readFileSync(values.cartera!, "utf8")));
  const ev = cat.eventos.get(values.evento!)!;
  const hoy = new Date().toISOString().slice(0, 10);
  const dia = values.dia ?? (hoy >= ev.desde && hoy <= ev.hasta ? hoy : ev.desde);
  const criterio = values.criterio === "total" ? "total" : "ahorro";
  const r = evaluar(cat,
    { evento: ev.id, comercio: values.comercio, precio: Number(values.precio), dia, msi: { ...cartera.msi, ...(cartera.msi_por_comercio[values.comercio] ?? {}) }, categoria: values.categoria },
    { instrumentos: cartera.instrumentos, atributos: cartera.atributos, acumulados: cartera.acumulados },
    { rendimiento_anual: values.rendimiento ? Number(values.rendimiento) : cartera.rendimiento_anual });
  console.log(`${cat.comercios.get(values.comercio)?.nombre} · ${$(Number(values.precio))} · ${dia} · ${ev.nombre}\n`);
  const ops = values.todas ? ordenar(r.opciones, criterio) : mejoresPorInstrumento(r.opciones, criterio);
  if (!ops.length) console.log("Ninguna promoción aplica con tu cartera.");
  else imprimir(cat, ops, criterio);
  if (r.no_aplican.length) {
    console.log(`\nNo aplican (${r.no_aplican.length}):`);
    for (const n of r.no_aplican) console.log(`  - ${n.promo.nombre} [${nombreInstrumento(cat, n.instrumento)}]: ${n.razon}`);
  }
}

main();
