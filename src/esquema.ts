/**
 * Esquema del catálogo: eventos, comercios, instrumentos de pago y promociones.
 *
 * Una promoción describe UN beneficio (un cupón, una bonificación, un cashback…).
 * El motor combina las promociones compatibles de un mismo instrumento; por eso
 * aquí no hay "combos" declarados: solo reglas de compatibilidad (excluye,
 * exclusiva, máximo de cupones del comercio).
 */
import { z } from "zod";

export const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");
const Id = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "id en minúsculas, sin espacios");
const ValorAtributo = z.union([z.string(), z.number(), z.boolean()]);

/** garantizado: se recibe si cumples; hasta: el banco dice "hasta X%"; condicionado: sujeto a cupo, presupuesto o interpretación. */
export const Certeza = z.enum(["garantizado", "hasta", "condicionado"]);

// ---------- Instrumentos ----------
export const Atributo = z.object({
  id: Id,
  etiqueta: z.string(),
  tipo: z.enum(["booleano", "opcion", "numero"]),
  opciones: z.array(z.object({ valor: ValorAtributo, etiqueta: z.string() })).optional(),
  defecto: ValorAtributo.optional(),
  ayuda: z.string().optional(),
});

export const Producto = z.object({
  id: Id, // emisor.producto, p. ej. santander.tdc
  nombre: z.string(),
  tipo: z.enum(["credito", "debito", "monedero", "efectivo", "credito-tienda", "bnpl"]),
  /** si el comercio puede ofrecer MSI con este producto */
  msi: z.boolean().default(false),
  nota: z.string().optional(),
});

export const Emisor = z.object({
  id: Id,
  nombre: z.string(),
  productos: z.array(Producto).min(1),
  atributos: z.array(Atributo).default([]),
});

export const Instrumentos = z.object({ emisores: z.array(Emisor) });

// ---------- Comercios y eventos ----------
export const Comercio = z.object({
  id: Id,
  nombre: z.string(),
  rfc: z.string().optional(),
  sitio: z.string().url().optional(),
  reglas: z
    .object({
      /** cupones que se pueden usar en una misma compra (las promos con acumulable_con_cupones no cuentan) */
      max_cupones_por_compra: z.number().int().positive().optional(),
    })
    .default({}),
});
export const Comercios = z.object({ comercios: z.array(Comercio) });

export const Evento = z.object({
  id: Id,
  nombre: z.string(),
  desde: Fecha,
  hasta: Fecha,
  zona_horaria: z.string().default("America/Mexico_City"),
  sitio: z.string().url().optional(),
});

// ---------- Promociones ----------
const CondicionTramo = z.object({
  /** días en que aplica el tramo */
  dias: z.array(Fecha).optional(),
  /** el monto base debe ser >= desde */
  desde: z.number().nonnegative().optional(),
  /** el monto base debe ser > mayor_a */
  mayor_a: z.number().nonnegative().optional(),
  /** atributos de la cartera que deben valer exactamente esto */
  atributos: z.record(z.string(), ValorAtributo).optional(),
});

export const Tramo = CondicionTramo.extend({
  pct: z.number().min(0).max(100).optional(),
  monto: z.number().nonnegative().optional(),
  tope: z.number().nonnegative().optional(),
  certeza: Certeza.optional(),
}).refine((t) => (t.pct === undefined) !== (t.monto === undefined), "cada tramo lleva pct o monto, no ambos");

export const TipoBeneficio = z.enum([
  "cupon", // código en el checkout
  "descuento", // automático en el checkout
  "bonificacion", // llega después (estado de cuenta, monedero)
  "cashback",
  "sorteo", // no suma ahorro; se muestra
]);
export const EN_CHECKOUT = new Set(["cupon", "descuento"]);

export const Beneficio = z
  .object({
    tipo: TipoBeneficio,
    pct: z.number().min(0).max(100).optional(),
    monto: z.number().nonnegative().optional(),
    /** el primer tramo cuyas condiciones se cumplen define pct/monto/tope */
    tramos: z.array(Tramo).optional(),
    /** puntos porcentuales extra si la cartera tiene ciertos atributos */
    extras: z.array(z.object({ atributos: z.record(z.string(), ValorAtributo), pct: z.number() })).optional(),
    tope: z.number().nonnegative().optional(),
    /** bruto: sobre el precio; neto: sobre lo que pagas tras cupones/descuentos. Por defecto bruto en checkout y neto después. */
    base: z.enum(["bruto", "neto"]).optional(),
    /** sorteos: una participación por cada N pesos */
    por_cada: z.number().positive().optional(),
    certeza: Certeza.default("garantizado"),
  })
  .refine(
    (b) => b.tipo === "sorteo" || [b.pct, b.monto, b.tramos].filter((x) => x !== undefined).length === 1,
    "el beneficio lleva exactamente uno de: pct, monto, tramos",
  );

export const Plazos = z.object({
  /** meses aceptados; 0 = una exhibición / contado */
  permitidos: z.array(z.number().int().nonnegative()).optional(),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
});

export const Promocion = z.object({
  id: Id,
  nombre: z.string(),
  codigo: z.string().optional(),
  comercio: Id,
  patrocinador: Id, // quién paga: banco o comercio
  /** basta con pagar con uno de estos productos */
  instrumentos: z.array(Id).min(1),
  vigencia: z.object({ desde: Fecha, hasta: Fecha }).optional(), // por defecto, la del evento
  beneficio: Beneficio,
  condiciones: z
    .object({
      minimo: z
        .object({
          monto: z.number().nonnegative(),
          /** true: debe ser mayor (>) al monto, no igual */
          estricto: z.boolean().default(false),
          base: z.enum(["bruto", "neto"]).optional(),
          /** suma un atributo numérico de la cartera (compras previas acumuladas) */
          sumar_atributo: z.string().optional(),
        })
        .optional(),
      plazos: Plazos.optional(),
      /** atributos de la cartera que deben ser verdaderos */
      requiere: z.array(z.string()).default([]),
      /** pagas de contado en el comercio y difieres después desde la app del banco */
      financiamiento_posterior: z.object({ meses: z.number().int().positive() }).optional(),
      registro_previo: z.string().optional(),
    })
    .default({}),
  excluye: z.array(Id).default([]),
  /** no se combina con ninguna otra promoción */
  exclusiva: z.boolean().default(false),
  /** no cuenta para el máximo de cupones del comercio */
  acumulable_con_cupones: z.boolean().default(false),
  avisos: z.array(z.string()).default([]),
  fuente: z.object({
    url: z.string().url(),
    snapshot: z.string().optional(),
    capturada: Fecha,
    revisada: z.boolean().default(false),
    evidencia: z.string().optional(),
    nota: z.string().optional(),
  }),
});

export const ArchivoPromos = z.object({ promociones: z.array(Promocion) });

export type Atributo = z.infer<typeof Atributo>;
export type Producto = z.infer<typeof Producto>;
export type Emisor = z.infer<typeof Emisor>;
export type Comercio = z.infer<typeof Comercio>;
export type Evento = z.infer<typeof Evento>;
export type Tramo = z.infer<typeof Tramo>;
export type Beneficio = z.infer<typeof Beneficio>;
export type Promocion = z.infer<typeof Promocion>;
export type Certeza = z.infer<typeof Certeza>;
