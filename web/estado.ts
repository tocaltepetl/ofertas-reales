/**
 * Estado persistente de la web, separado en dos partes:
 * - el perfil del usuario (sus tarjetas, MSI, atributos y preferencias), que se comparte entre eventos;
 * - el estado de cada evento (día, comercio y acumulados), con una clave por evento.
 *
 * Todo acceso al almacenamiento va envuelto en try/catch: en modo privado, con el almacenamiento
 * bloqueado o con datos corruptos se usan los valores por defecto y la app sigue funcionando.
 */

export type ValorAtributo = string | number | boolean;

/** Del usuario; se comparte entre eventos. */
export interface Perfil {
  tengo: Record<string, boolean>;
  msi: Record<string, number>;
  atributos: Record<string, ValorAtributo>;
  rendimiento: number;
  criterio: "ahorro" | "total";
  soloGarantizado: boolean;
  precio: number;
  categoria: string;
}

/** Propio de un evento. */
export interface EstadoEvento {
  dia: string | null; // null = que la app elija
  comercio: string | null;
  acumulados: Record<string, { compras?: number; beneficio?: number }>;
}

export interface Almacen {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const CLAVE_PERFIL = "buscador-promos-v2:perfil";
export const claveEvento = (id: string) => `buscador-promos-v2:evento:${id}`;
export const CLAVE_V1 = "buscador-promos-v1";

// ---------------------------------------------------------------------------
// Helpers internos

type Obj = Record<string, unknown>;

const esObjeto = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const esValorAtributo = (v: unknown): v is ValorAtributo =>
  typeof v === "string" || typeof v === "boolean" || esNumero(v);

function leer(alm: Almacen | null, clave: string): unknown {
  if (!alm) return undefined;
  try {
    const t = alm.getItem(clave);
    return t == null ? undefined : JSON.parse(t);
  } catch {
    return undefined;
  }
}

/** Devuelve true si se pudo escribir. */
function escribir(alm: Almacen | null, clave: string, valor: unknown): boolean {
  if (!alm) return false;
  try {
    alm.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

function existe(alm: Almacen, clave: string): boolean {
  try {
    return alm.getItem(clave) != null;
  } catch {
    return false;
  }
}

/** Mezcla un registro guardado sobre el de defectos, descartando entrada por entrada lo que no tenga el tipo esperado. */
function mezclarRegistro<T>(defecto: Record<string, T>, guardado: unknown, valido: (v: unknown, def: T | undefined) => v is T): Record<string, T> {
  const out: Record<string, T> = { ...defecto };
  if (!esObjeto(guardado)) return out;
  for (const [k, v] of Object.entries(guardado)) {
    const def = Object.hasOwn(defecto, k) ? defecto[k] : undefined;
    if (valido(v, def)) out[k] = v;
  }
  return out;
}

function limpiarAcumulados(v: unknown): EstadoEvento["acumulados"] {
  const out: EstadoEvento["acumulados"] = {};
  if (!esObjeto(v)) return out;
  for (const [k, a] of Object.entries(v)) {
    if (!esObjeto(a)) continue;
    const limpio: { compras?: number; beneficio?: number } = {};
    if (esNumero(a.compras)) limpio.compras = a.compras;
    if (esNumero(a.beneficio)) limpio.beneficio = a.beneficio;
    out[k] = limpio;
  }
  return out;
}

const CAMPOS_PERFIL = ["tengo", "msi", "atributos", "rendimiento", "criterio", "soloGarantizado", "precio", "categoria"] as const;
const CAMPOS_EVENTO = ["dia", "comercio", "acumulados"] as const;

function elegir(o: Obj, campos: readonly string[]): Obj {
  const out: Obj = {};
  for (const c of campos) if (Object.hasOwn(o, c)) out[c] = o[c];
  return out;
}

// ---------------------------------------------------------------------------
// API

/** Lee el perfil mezclando lo guardado sobre los valores por defecto (los productos nuevos del catálogo toman su defecto; los guardados se respetan). Nunca lanza. */
export function cargarPerfil(alm: Almacen | null, defecto: Perfil): Perfil {
  const g = leer(alm, CLAVE_PERFIL);
  const s: Obj = esObjeto(g) ? g : {};
  return {
    tengo: mezclarRegistro(defecto.tengo, s.tengo, (v): v is boolean => typeof v === "boolean"),
    msi: mezclarRegistro(defecto.msi, s.msi, (v): v is number => esNumero(v) && v >= 0),
    // Si el atributo existe en los defectos, el valor guardado debe ser del mismo tipo (p. ej. un
    // atributo que pasó de booleano a opciones no hereda un `true` viejo).
    atributos: mezclarRegistro(defecto.atributos, s.atributos,
      (v, def): v is ValorAtributo => esValorAtributo(v) && (def === undefined || typeof v === typeof def)),
    rendimiento: esNumero(s.rendimiento) ? s.rendimiento : defecto.rendimiento,
    criterio: s.criterio === "ahorro" || s.criterio === "total" ? s.criterio : defecto.criterio,
    soloGarantizado: typeof s.soloGarantizado === "boolean" ? s.soloGarantizado : defecto.soloGarantizado,
    precio: esNumero(s.precio) ? s.precio : defecto.precio,
    categoria: typeof s.categoria === "string" ? s.categoria : defecto.categoria,
  };
}

export function guardarPerfil(alm: Almacen | null, p: Perfil): void {
  escribir(alm, CLAVE_PERFIL, elegir(p as unknown as Obj, CAMPOS_PERFIL));
}

export function cargarEstadoEvento(alm: Almacen | null, eventoId: string): EstadoEvento {
  const g = leer(alm, claveEvento(eventoId));
  const s: Obj = esObjeto(g) ? g : {};
  return {
    dia: typeof s.dia === "string" && s.dia !== "" ? s.dia : null,
    comercio: typeof s.comercio === "string" && s.comercio !== "" ? s.comercio : null,
    acumulados: limpiarAcumulados(s.acumulados),
  };
}

export function guardarEstadoEvento(alm: Almacen | null, eventoId: string, e: EstadoEvento): void {
  escribir(alm, claveEvento(eventoId), elegir(e as unknown as Obj, CAMPOS_EVENTO));
}

/** Si existe la clave v1 y no existe la v2 del perfil, reparte su contenido: perfil a CLAVE_PERFIL; dia, comercio y acumulados a claveEvento(eventoV1). Borra la v1 al terminar. Idempotente. Nunca lanza. */
export function migrarV1(alm: Almacen | null, eventoV1: string): void {
  if (!alm) return;
  try {
    if (!existe(alm, CLAVE_V1) || existe(alm, CLAVE_PERFIL)) return;
    const v1 = leer(alm, CLAVE_V1);
    if (esObjeto(v1)) {
      // Se copian los campos tal cual: cargarPerfil/cargarEstadoEvento los validan al leer, y aquí
      // aún no hay catálogo con el que completar defectos.
      // Primero el evento y al final el perfil, que es la marca de "migración hecha". No se pisa un
      // estado de evento v2 que ya exista.
      const clave = claveEvento(eventoV1);
      if (!existe(alm, clave) && !escribir(alm, clave, elegir(v1, CAMPOS_EVENTO))) return;
      if (!escribir(alm, CLAVE_PERFIL, elegir(v1, CAMPOS_PERFIL))) return;
    }
    // Si la v1 está corrupta no hay nada que rescatar: solo se borra. Si alguna escritura falló
    // (p. ej. cuota llena) se sale antes y la v1 se conserva para reintentar en la próxima carga.
    alm.removeItem(CLAVE_V1);
  } catch {
    /* sin almacenamiento */
  }
}

/** localStorage si está disponible, null si no (o si acceder lanza). */
export function almacenNavegador(): Almacen | null {
  try {
    const ls = (globalThis as { localStorage?: Almacen }).localStorage;
    if (!ls || typeof ls.getItem !== "function") return null;
    ls.getItem(CLAVE_PERFIL); // en algunos navegadores con el almacenamiento bloqueado esto lanza
    return ls;
  } catch {
    return null;
  }
}
