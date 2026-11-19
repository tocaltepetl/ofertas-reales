/**
 * Lógica de calendario de la web: qué evento mostrar, en qué fase está, qué días
 * ofrece el selector y qué categorías hay. Funciones puras, sin DOM, para poder
 * probarlas con node --test.
 *
 * Todas las fechas son cadenas YYYY-MM-DD. La aritmética se hace en UTC a mediodía
 * para que el horario de verano nunca mueva un día.
 */
import type { Evento, Promocion } from "../src/esquema.ts";

const MS_DIA = 86_400_000;
/** Un próximo evento se muestra por defecto si empieza dentro de estos días. */
const DIAS_ANTICIPACION = 14;

/** YYYY-MM-DD → milisegundos UTC al mediodía de ese día. */
function aMs(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Date.UTC(a!, m! - 1, d!, 12);
}

function deMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Fecha YYYY-MM-DD en la zona horaria dada (usa Intl.DateTimeFormat, no toISOString). */
export function hoyEn(zona: string, ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

export type FaseEvento = "activo" | "proximo" | "pasado";

/** Inclusivo en desde y hasta. Las fechas YYYY-MM-DD se comparan como texto. */
export function faseDe(ev: Evento, hoy: string): FaseEvento {
  if (hoy < ev.desde) return "proximo";
  if (hoy > ev.hasta) return "pasado";
  return "activo";
}

export interface Agenda {
  activos: Evento[];
  proximos: Evento[];
  pasados: Evento[];
}

const porInicio = (a: Evento, b: Evento) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta);

/** activos y próximos por fecha de inicio ascendente; pasados del más reciente al más antiguo. */
export function agenda(eventos: Evento[], hoy: string): Agenda {
  const r: Agenda = { activos: [], proximos: [], pasados: [] };
  for (const ev of eventos) {
    const f = faseDe(ev, hoy);
    (f === "activo" ? r.activos : f === "proximo" ? r.proximos : r.pasados).push(ev);
  }
  r.activos.sort(porInicio);
  r.proximos.sort(porInicio);
  // "más reciente" = el que terminó después
  r.pasados.sort((a, b) => b.hasta.localeCompare(a.hasta) || b.desde.localeCompare(a.desde));
  return r;
}

/**
 * El evento a mostrar por defecto: el activo (si hay varios, el que termina antes),
 * si no el próximo más cercano si empieza en <= 14 días, si no el pasado más
 * reciente, si no el próximo. undefined si no hay eventos.
 */
export function eventoPorDefecto(eventos: Evento[], hoy: string): Evento | undefined {
  const { activos, proximos, pasados } = agenda(eventos, hoy);
  if (activos.length) {
    return [...activos].sort((a, b) => a.hasta.localeCompare(b.hasta) || a.desde.localeCompare(b.desde))[0];
  }
  const cercano = proximos[0];
  if (cercano && diasEntre(hoy, cercano.desde) <= DIAS_ANTICIPACION) return cercano;
  return pasados[0] ?? cercano;
}

/** Todos los días del rango, YYYY-MM-DD, sin errores por horario de verano. */
export function diasDe(ev: Evento): string[] {
  const dias: string[] = [];
  for (let ms = aMs(ev.desde), fin = aMs(ev.hasta); ms <= fin; ms += MS_DIA) dias.push(deMs(ms));
  return dias;
}

/** hasta - desde en días. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aMs(hasta) - aMs(desde)) / MS_DIA);
}

/**
 * Día inicial del selector: hoy si cae en el evento; si el evento es futuro, su
 * primer día; si es pasado, su último día. Si `guardado` está dentro del rango, gana.
 */
export function diaInicial(ev: Evento, hoy: string, guardado?: string | null): string {
  if (guardado && /^\d{4}-\d{2}-\d{2}$/.test(guardado) && guardado >= ev.desde && guardado <= ev.hasta) return guardado;
  const f = faseDe(ev, hoy);
  return f === "activo" ? hoy : f === "proximo" ? ev.desde : ev.hasta;
}

const ETIQUETAS: Record<string, string> = {
  ropa: "Ropa",
  calzado: "Calzado",
  accesorios: "Accesorios",
  hogar: "Hogar",
  "linea-blanca": "Línea blanca",
  electronica: "Electrónica",
  computo: "Cómputo",
  celulares: "Celulares",
  electrodomesticos: "Electrodomésticos",
  muebles: "Muebles",
  juguetes: "Juguetes",
  belleza: "Belleza",
  deportes: "Deportes",
  bebes: "Bebés",
  mascotas: "Mascotas",
  videojuegos: "Videojuegos",
  libros: "Libros",
  viajes: "Viajes",
  autos: "Autos",
  ferreteria: "Ferretería",
  jugueteria: "Juguetería",
  supermercado: "Supermercado",
  farmacia: "Farmacia",
};

/** "linea-blanca" → "Línea blanca"; tabla de etiquetas conocidas y respaldo genérico (guiones a espacios, mayúscula inicial). */
export function etiquetaCategoria(id: string): string {
  const conocida = ETIQUETAS[id];
  if (conocida) return conocida;
  const texto = id.replace(/[-_]+/g, " ").trim();
  return texto.charAt(0).toLocaleUpperCase("es-MX") + texto.slice(1);
}

/** Categorías que aparecen en las condiciones de las promos, ordenadas por etiqueta, sin duplicados. */
export function categoriasDe(promos: Promocion[]): { id: string; etiqueta: string }[] {
  const ids = new Set<string>();
  for (const p of promos) for (const c of p.condiciones?.categorias ?? []) ids.add(c);
  return [...ids]
    .map((id) => ({ id, etiqueta: etiquetaCategoria(id) }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es-MX") || a.id.localeCompare(b.id));
}

/** "17 nov 2026", formateada en UTC para que la zona del navegador no la corra un día. */
function fechaCorta(fecha: string): string {
  return new Date(aMs(fecha)).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Texto corto de estado: "Termina hoy", "Quedan 3 días", "Empieza en 12 días",
 * "Empieza mañana", "Terminó el 17 nov 2026". Los días que quedan cuentan hoy.
 */
export function textoFase(ev: Evento, hoy: string): string {
  switch (faseDe(ev, hoy)) {
    case "activo": {
      const quedan = diasEntre(hoy, ev.hasta) + 1;
      return quedan === 1 ? "Termina hoy" : `Quedan ${quedan} días`;
    }
    case "proximo": {
      const faltan = diasEntre(hoy, ev.desde);
      return faltan === 1 ? "Empieza mañana" : `Empieza en ${faltan} días`;
    }
    case "pasado":
      return `Terminó el ${fechaCorta(ev.hasta)}`;
  }
}
