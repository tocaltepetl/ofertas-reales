/** Carga y valida el catálogo YAML (catalogo/), incluidas las referencias cruzadas. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  Instrumentos, Comercios, Evento, ArchivoPromos,
  type Emisor, type Producto, type Comercio, type Evento as TEvento, type Promocion, type Atributo,
} from "./esquema.ts";

export interface Catalogo {
  raiz: string;
  emisores: Emisor[];
  productos: Map<string, Producto & { emisor: string }>;
  atributos: Map<string, Atributo & { emisor: string }>;
  comercios: Map<string, Comercio>;
  eventos: Map<string, TEvento>;
  /** promociones por evento */
  promociones: Map<string, Promocion[]>;
}

export class ErrorCatalogo extends Error {
  readonly errores: string[];
  constructor(errores: string[]) {
    super(`Catálogo inválido:\n- ${errores.join("\n- ")}`);
    this.errores = errores;
  }
}

function leer<T>(archivo: string, esquema: z.ZodType<T, z.ZodTypeDef, unknown>, errores: string[]): T | undefined {
  const r = esquema.safeParse(parse(readFileSync(archivo, "utf8")));
  if (r.success) return r.data;
  for (const i of r.error.issues) errores.push(`${archivo}: ${i.path.join(".") || "(raíz)"}: ${i.message}`);
  return undefined;
}

export const RAIZ_PROYECTO = resolve(import.meta.dirname, "..");

export function cargarCatalogo(raiz = join(RAIZ_PROYECTO, "catalogo")): Catalogo {
  const errores: string[] = [];
  const inst = leer(join(raiz, "instrumentos.yaml"), Instrumentos, errores);
  const com = leer(join(raiz, "comercios.yaml"), Comercios, errores);

  const productos = new Map<string, Producto & { emisor: string }>();
  const atributos = new Map<string, Atributo & { emisor: string }>();
  for (const e of inst?.emisores ?? []) {
    for (const p of e.productos) {
      if (!p.id.startsWith(`${e.id}.`)) errores.push(`producto ${p.id}: debe empezar con "${e.id}."`);
      if (productos.has(p.id)) errores.push(`producto duplicado: ${p.id}`);
      productos.set(p.id, { ...p, emisor: e.id });
    }
    for (const a of e.atributos) {
      if (atributos.has(a.id)) errores.push(`atributo duplicado: ${a.id}`);
      atributos.set(a.id, { ...a, emisor: e.id });
    }
  }
  const comercios = new Map((com?.comercios ?? []).map((c) => [c.id, c]));

  const eventos = new Map<string, TEvento>();
  const promociones = new Map<string, Promocion[]>();
  const dirEventos = join(raiz, "eventos");
  for (const nombre of existsSync(dirEventos) ? readdirSync(dirEventos) : []) {
    const dir = join(dirEventos, nombre);
    if (!statSync(dir).isDirectory()) continue;
    const ev = leer(join(dir, "evento.yaml"), Evento, errores);
    if (!ev) continue;
    if (ev.id !== nombre) errores.push(`${dir}: el id del evento (${ev.id}) debe coincidir con la carpeta`);
    eventos.set(ev.id, ev);
    const lista: Promocion[] = [];
    const dirPromos = join(dir, "promos");
    for (const f of existsSync(dirPromos) ? readdirSync(dirPromos).filter((x) => x.endsWith(".yaml")).sort() : []) {
      lista.push(...(leer(join(dirPromos, f), ArchivoPromos, errores)?.promociones ?? []));
    }
    promociones.set(ev.id, lista);
  }

  // Referencias cruzadas
  const nombresEmisores = new Set((inst?.emisores ?? []).map((e) => e.id));
  for (const [evId, lista] of promociones) {
    const ev = eventos.get(evId)!;
    const ids = new Set<string>();
    for (const p of lista) {
      const donde = `${evId}/${p.id}`;
      if (ids.has(p.id)) errores.push(`${donde}: id duplicado`);
      ids.add(p.id);
      if (!comercios.has(p.comercio)) errores.push(`${donde}: comercio desconocido ${p.comercio}`);
      if (!nombresEmisores.has(p.patrocinador) && !comercios.has(p.patrocinador))
        errores.push(`${donde}: patrocinador desconocido ${p.patrocinador}`);
      for (const i of p.instrumentos) if (!productos.has(i)) errores.push(`${donde}: instrumento desconocido ${i}`);
      for (const a of p.condiciones.requiere) if (!atributos.has(a)) errores.push(`${donde}: atributo desconocido ${a}`);
      const sa = p.condiciones.minimo?.sumar_atributo;
      if (sa && !atributos.has(sa)) errores.push(`${donde}: atributo desconocido ${sa}`);
      const atribsTramos = [...(p.beneficio.tramos ?? []), ...(p.beneficio.extras ?? [])].flatMap((t) => Object.keys(t.atributos ?? {}));
      for (const a of atribsTramos) if (!atributos.has(a)) errores.push(`${donde}: atributo desconocido ${a}`);
      const v = p.vigencia ?? { desde: ev.desde, hasta: ev.hasta };
      if (v.desde > v.hasta) errores.push(`${donde}: vigencia invertida`);
      for (const d of (p.beneficio.tramos ?? []).flatMap((t) => t.dias ?? []))
        if (d < v.desde || d > v.hasta) errores.push(`${donde}: día ${d} fuera de la vigencia`);
      if (p.fuente.snapshot && !existsSync(join(raiz, "..", p.fuente.snapshot)))
        errores.push(`${donde}: no existe el snapshot ${p.fuente.snapshot}`);
    }
    for (const p of lista) for (const x of p.excluye) if (!ids.has(x)) errores.push(`${evId}/${p.id}: excluye a ${x}, que no existe`);
  }

  if (errores.length) throw new ErrorCatalogo(errores);
  return { raiz, emisores: inst!.emisores, productos, atributos, comercios, eventos, promociones };
}
