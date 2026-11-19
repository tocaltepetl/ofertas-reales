/**
 * Orden de la cartera en la web. Función pura, sin DOM, para probarla con node --test.
 * El YAML conserva el orden de captura; aquí se ordena para quien busca su tarjeta.
 */
import type { Emisor } from "../src/esquema.ts";

const porNombre = (a: Emisor, b: Emisor) => a.nombre.localeCompare(b.nombre, "es-MX", { sensitivity: "base" }) || a.id.localeCompare(b.id);

/**
 * Emisores en orden alfabético; si el usuario ya eligió su cartera, primero los
 * emisores donde tiene alguna tarjeta marcada (también alfabéticos). Mientras no
 * la haya elegido todo está marcado por defecto, así que solo cuenta el alfabeto.
 */
export function ordenarEmisores(emisores: Emisor[], tengo: Record<string, boolean>, carteraElegida: boolean): Emisor[] {
  const tieneAlguna = (e: Emisor) => carteraElegida && e.productos.some((p) => tengo[p.id]);
  return [...emisores].sort((a, b) => Number(tieneAlguna(b)) - Number(tieneAlguna(a)) || porNombre(a, b));
}
