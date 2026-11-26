/**
 * Lógica de la vista de calendario: qué meses mostrar, la cuadrícula de cada mes,
 * qué eventos caen en cada día, la vista inicial de la web y el archivo .ics.
 * Funciones puras, sin DOM, para probarlas con node --test.
 *
 * Fechas en YYYY-MM-DD; la aritmética va en UTC a mediodía, como en eventos.ts.
 */
import type { Evento } from "../src/esquema.ts";
import { agenda, diasEntre } from "./eventos.ts";

/** Un próximo evento abre la web directamente si empieza dentro de estos días. */
const DIAS_ANTICIPACION = 14;
/** Máximo de meses en la cuadrícula. */
const MAX_MESES = 12;

export const VISTA_CALENDARIO = "calendario";

export interface Mes {
  /** YYYY-MM */
  id: string;
  anio: number;
  /** 1 a 12 */
  mes: number;
  /** Semanas de lunes a domingo; null = día de otro mes. */
  semanas: (string | null)[][];
}

const pad = (n: number) => String(n).padStart(2, "0");
const mesDe = (fecha: string) => fecha.slice(0, 7);

function siguienteMes(id: string): string {
  const [a, m] = id.split("-").map(Number);
  return m === 12 ? `${a! + 1}-01` : `${a}-${pad(m! + 1)}`;
}

/** Días del mes (28 a 31). */
function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Cuadrícula del mes con semanas de lunes a domingo. */
export function cuadriculaMes(id: string): Mes {
  const [anio, mes] = id.split("-").map(Number) as [number, number];
  const primero = new Date(Date.UTC(anio, mes - 1, 1, 12)).getUTCDay(); // 0 = domingo
  const huecos = (primero + 6) % 7; // lunes = 0
  const celdas: (string | null)[] = Array(huecos).fill(null);
  for (let d = 1; d <= diasDelMes(anio, mes); d++) celdas.push(`${id}-${pad(d)}`);
  while (celdas.length % 7) celdas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return { id, anio, mes, semanas };
}

/**
 * Meses a mostrar: el mes de hoy y los meses que toca algún evento activo o próximo,
 * en orden y como mucho 12. Los meses sin eventos se omiten (no aportan nada) y los
 * eventos pasados no agregan meses; van en la lista de "Anteriores".
 */
export function mesesCalendario(eventos: Evento[], hoy: string): Mes[] {
  const ids = new Set([mesDe(hoy)]);
  for (const e of eventos.filter((x) => x.hasta >= hoy)) {
    for (let id = mesDe(e.desde > hoy ? e.desde : hoy); id <= mesDe(e.hasta); id = siguienteMes(id)) ids.add(id);
  }
  return [...ids].sort().slice(0, MAX_MESES).map(cuadriculaMes);
}

/**
 * Carril (fila) de cada evento para dibujar sus barras: dos eventos que se enciman
 * van en carriles distintos y cada evento conserva su carril todos sus días.
 */
export function carriles(eventos: Evento[]): Map<string, number> {
  const fin: string[] = []; // último día ocupado de cada carril
  const r = new Map<string, number>();
  for (const e of [...eventos].sort((a, b) => a.desde.localeCompare(b.desde) || a.id.localeCompare(b.id))) {
    let c = fin.findIndex((f) => f < e.desde);
    if (c === -1) c = fin.length;
    fin[c] = e.hasta;
    r.set(e.id, c);
  }
  return r;
}

/** Eventos que incluyen ese día, ordenados por inicio. */
export function eventosDelDia(eventos: Evento[], dia: string): Evento[] {
  return eventos
    .filter((e) => dia >= e.desde && dia <= e.hasta)
    .sort((a, b) => a.desde.localeCompare(b.desde) || a.id.localeCompare(b.id));
}

/**
 * Qué abre la web sin un # en la URL: el evento activo con promos (si hay varios, el
 * que termina antes); si no, el próximo con promos que empieza en 14 días o menos;
 * si no, el calendario. Un evento sin promos nunca abre por defecto.
 */
export function vistaInicial(eventos: Evento[], conPromos: (id: string) => boolean, hoy: string): string {
  const { activos, proximos } = agenda(eventos.filter((e) => conPromos(e.id)), hoy);
  const activo = [...activos].sort((a, b) => a.hasta.localeCompare(b.hasta))[0];
  if (activo) return activo.id;
  const cercano = proximos[0];
  if (cercano && diasEntre(hoy, cercano.desde) <= DIAS_ANTICIPACION) return cercano.id;
  return VISTA_CALENDARIO;
}

/**
 * Qué abre la web al entrar sin # en la URL, recordando la última vista: gana la
 * guardada si es el calendario o un evento que existe y no ha terminado; un evento
 * ya pasado (o que dejó de existir) no se reabre solo y se usa vistaInicial.
 */
export function vistaAlEntrar(eventos: Evento[], conPromos: (id: string) => boolean, hoy: string, guardada: string | null): string {
  if (guardada === VISTA_CALENDARIO) return guardada;
  const ev = eventos.find((e) => e.id === guardada);
  if (ev && ev.hasta >= hoy) return ev.id;
  return vistaInicial(eventos, conPromos, hoy);
}

/** Índice estable (0 a n-1) para colorear cada evento: por fecha de inicio. */
export function indicesDeColor(eventos: Evento[], n: number): Map<string, number> {
  const orden = [...eventos].sort((a, b) => a.desde.localeCompare(b.desde) || a.id.localeCompare(b.id));
  return new Map(orden.map((e, i) => [e.id, i % n]));
}

const escIcs = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
const fechaIcs = (fecha: string) => fecha.replaceAll("-", "");

function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + 1, 12)).toISOString().slice(0, 10);
}

/**
 * Archivo iCalendar con el evento como días completos (DTEND es exclusivo, por eso
 * va un día después de `hasta`). `ahora` es la marca DTSTAMP en UTC.
 */
export function icsDeEvento(ev: Evento, url: string, ahora: Date): string {
  const stamp = ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tocaltepetl//Ofertas reales//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@buscador-promociones`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${fechaIcs(ev.desde)}`,
    `DTEND;VALUE=DATE:${fechaIcs(diaSiguiente(ev.hasta))}`,
    `SUMMARY:${escIcs(ev.nombre)}`,
    `DESCRIPTION:${escIcs(`Compara con qué tarjeta te conviene pagar: ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
