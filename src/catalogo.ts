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

export interface OpcionesCarga {
  /**
   * Directorios adicionales con la misma forma que catalogo/eventos/ (una subcarpeta por evento con
   * evento.yaml y promos/*.yaml), p. ej. ejemplos/eventos para probar la web con varios eventos.
   * Sus promociones se validan contra los comercios e instrumentos del catálogo principal.
   */
  eventosExtra?: string[];
}

/** Directorio con los eventos ficticios de demostración (ver `--demo` en scripts/build-web.ts). */
export const EVENTOS_DEMO = join(RAIZ_PROYECTO, "ejemplos", "eventos");

export function cargarCatalogo(raiz = join(RAIZ_PROYECTO, "catalogo"), opciones: OpcionesCarga = {}): Catalogo {
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
  for (const dirEventos of [join(raiz, "eventos"), ...(opciones.eventosExtra ?? [])]) {
    for (const nombre of existsSync(dirEventos) ? readdirSync(dirEventos) : []) {
      const dir = join(dirEventos, nombre);
      if (!statSync(dir).isDirectory()) continue;
      const ev = leer(join(dir, "evento.yaml"), Evento, errores);
      if (!ev) continue;
      if (ev.id !== nombre) errores.push(`${dir}: el id del evento (${ev.id}) debe coincidir con la carpeta`);
      if (eventos.has(ev.id)) { errores.push(`${dir}: evento duplicado ${ev.id}`); continue; }
      eventos.set(ev.id, ev);
      const lista: Promocion[] = [];
      const dirPromos = join(dir, "promos");
      for (const f of existsSync(dirPromos) ? readdirSync(dirPromos).filter((x) => x.endsWith(".yaml")).sort() : []) {
        lista.push(...(leer(join(dirPromos, f), ArchivoPromos, errores)?.promociones ?? []));
      }
      promociones.set(ev.id, lista);
    }
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
      for (const f of p.condiciones.fondeo ?? []) if (!productos.has(f)) errores.push(`${donde}: instrumento de fondeo desconocido ${f}`);
      if (p.beneficio.escala_acumulada && !p.campana) errores.push(`${donde}: una escala acumulada necesita "campana"`);
      if (p.condiciones.minimo?.acumulable && !p.campana) errores.push(`${donde}: un mínimo acumulable necesita "campana"`);
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
