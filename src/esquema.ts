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

// ---------- Profeco ----------
/**
 * Un caso del monitoreo de precios de Profeco: lo que costaba un producto en una tienda antes del
 * evento y lo que costó durante. Si `durante` es mayor que `antes`, la "oferta" era simulada.
 */
export const CasoProfeco = z.object({
  /** la tienda como la nombra Profeco, con su sucursal */
  tienda: z.string(),
  /** id del comercio en comercios.yaml, si está en el catálogo */
  comercio: Id.optional(),
  producto: z.string(),
  antes: z.number().positive(),
  durante: z.number().positive(),
});

/** Lo que Profeco publicó sobre un evento: su comparador de precios y su balance al terminar. */
export const ProfecoEvento = z.object({
  /** micrositio de Quién es Quién en los Precios para el evento */
  comparador: z.string().url().optional(),
  balance: z
    .object({
      titulo: z.string(),
      url: z.string().url(),
      fecha: Fecha,
      /** qué monitoreó Profeco (productos, tiendas, periodo), en una o dos frases */
      resumen: z.string(),
      casos: z.array(CasoProfeco).default([]),
    })
    .optional(),
});

/** Canales de Profeco que valen para cualquier evento (catalogo/profeco.yaml). */
export const Profeco = z.object({
  telefono: z.object({ nacional: z.string(), cdmx: z.string(), horario: z.string() }),
  /** conciliación en línea, solo con los proveedores que participan */
  concilianet: z.string().url(),
  /** directorio de oficinas de defensa del consumidor */
  oficinas: z.string().url(),
  /** Quién es Quién en los Precios */
  comparador: z.string().url(),
  /** de dónde salieron los datos y cuándo se revisaron */
  fuente: z.object({ url: z.string().url(), revisada: Fecha }),
});

export const Evento = z.object({
  id: Id,
  nombre: z.string(),
  desde: Fecha,
  hasta: Fecha,
  zona_horaria: z.string().default("America/Mexico_City"),
  sitio: z.string().url().optional(),
  profeco: ProfecoEvento.optional(),
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
  /** plazos (meses) en que aplica el tramo; 0 = contado */
  meses: z.array(z.number().int().nonnegative()).optional(),
  /** el plazo debe ser >= meses_min */
  meses_min: z.number().int().nonnegative().optional(),
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
  "diferido", // "compra hoy, paga después": no suma ahorro; se muestra (su valor financiero aún no se calcula)
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
    /** a qué se aplica el tope: por compra, por día o por cliente en toda la campaña (se descuenta lo ya recibido) */
    tope_por: z.enum(["compra", "dia", "cliente"]).default("cliente"),
    /** los tramos (desde / mayor_a) se eligen por lo acumulado en la campaña, no solo por esta compra */
    escala_acumulada: z.boolean().default(false),
    /** el monto exacto no se publicó (p. ej. "hasta $12,000"); se muestra pero no suma ahorro */
    valor_desconocido: z.boolean().default(false),
    /** bruto: sobre el precio; neto: sobre lo que pagas tras cupones/descuentos. Por defecto bruto en checkout y neto después. */
    base: z.enum(["bruto", "neto"]).optional(),
    /** sorteos: una participación por cada N pesos */
    por_cada: z.number().positive().optional(),
    certeza: Certeza.default("garantizado"),
    /** cómo llega: estado de cuenta, monedero electrónico de la tienda, puntos… (informativo) */
    forma: z.enum(["checkout", "estado_de_cuenta", "monedero", "puntos", "saldo_app"]).optional(),
    /** diferido: texto del esquema de pago, p. ej. "Primer pago en marzo 2027, a 3 MSI" */
    descripcion: z.string().optional(),
  })
  .refine(
    (b) => b.tipo === "sorteo" || b.tipo === "diferido" || b.valor_desconocido || [b.pct, b.monto, b.tramos].filter((x) => x !== undefined).length === 1,
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
  /** misma campaña del banco en varios comercios: comparte mínimos acumulados y topes por cliente */
  campana: Id.optional(),
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
          /** el mínimo se cuenta sobre lo acumulado en la campaña (esta compra + compras previas registradas en la cartera) */
          acumulable: z.boolean().default(false),
        })
        .optional(),
      plazos: Plazos.optional(),
      /** atributos de la cartera que deben ser verdaderos */
      requiere: z.array(z.string()).default([]),
      /** pagas de contado en el comercio y difieres después desde la app del banco */
      financiamiento_posterior: z.object({ meses: z.number().int().positive() }).optional(),
      registro_previo: z.string().optional(),
      /** se paga con el instrumento de la promo (p. ej. PayPal) fondeado con una de estas tarjetas, que debes tener */
      fondeo: z.array(Id).optional(),
      /** solo en estas categorías de producto (ids libres, p. ej. ropa, linea-blanca). Si la compra no dice su categoría, no se aplica. */
      categorias: z.array(Id).optional(),
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
    /** true solo cuando una persona la cotejó contra la fuente */
    revisada: z.boolean().default(false),
    /** última verificación contra el snapshot (agente o humano) */
    verificacion: z
      .object({
        por: z.enum(["agente", "humano"]),
        fecha: Fecha,
        resultado: z.enum(["coincide", "corregida", "dudosa"]),
        notas: z.string().optional(),
        /** quién verificó (usuario de GitHub, p. ej. "@usuaria"), para dar crédito a la comunidad */
        quien: z.string().optional(),
        /** captura, foto del ticket o estado de cuenta, o enlace que respalda una verificación humana */
        evidencia_url: z.string().optional(),
      })
      .optional(),
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
export type Profeco = z.infer<typeof Profeco>;
export type CasoProfeco = z.infer<typeof CasoProfeco>;
