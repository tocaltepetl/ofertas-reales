/**
 * Motor de evaluación: dada una compra (comercio, precio, día) y una cartera,
 * genera todas las formas válidas de pagar (instrumento × plazo × combinación de
 * promociones compatibles) y las ordena.
 *
 * Reglas de cálculo:
 * - Primero se aplican los beneficios de checkout (cupón, descuento) sobre el precio.
 * - Los beneficios posteriores (bonificación, cashback) se calculan sobre lo que pagas
 *   tras el checkout, y sus mínimos también, salvo que la promo diga base: bruto.
 * - Una combinación solo es válida si cada promoción aporta algo (o es un sorteo);
 *   la combinación más chica ya cubre el caso en que alguna no alcanza.
 */
import type { Catalogo } from "./catalogo.ts";
import { EN_CHECKOUT, type Promocion, type Certeza } from "./esquema.ts";

export const PLAZOS_ESTANDAR = [3, 6, 9, 12, 13, 15, 18, 24];
const MAX_PROMOS_COMBINABLES = 12; // 2^12 combinaciones por instrumento, de sobra

export interface Compra {
  evento: string;
  comercio: string;
  precio: number;
  dia: string; // AAAA-MM-DD
  /** máximo de MSI que este producto ofrece con cada instrumento (por id de producto) */
  msi: Record<string, number>;
}

export interface Cartera {
  instrumentos: string[];
  atributos: Record<string, string | number | boolean>;
}

export interface Parametros {
  /** rendimiento anual (%) del dinero que no pagas hoy; para valorar los MSI */
  rendimiento_anual: number;
}

export interface Aporte {
  promo: Promocion;
  monto: number;
  pct?: number;
  certeza: Certeza;
  nota?: string;
}

export interface Opcion {
  instrumento: string;
  promos: Promocion[];
  aportes: Aporte[];
  /** meses sin intereses contratados en el comercio (0 = contado) */
  meses: number;
  /** meses en que realmente difieres el pago (incluye diferir después en la app del banco) */
  meses_financiamiento: number;
  descuento_checkout: number;
  beneficio_posterior: number;
  ahorro: number;
  /** precio − ahorro */
  costo_real: number;
  /** lo que se paga en el comercio (precio − checkout) */
  monto_cobrado: number;
  valor_msi: number;
  total: number;
  certeza: Certeza;
  avisos: string[];
  requisitos: string[];
}

export interface NoAplica {
  promo: Promocion;
  instrumento: string;
  razon: string;
}

export interface Resultado {
  opciones: Opcion[];
  no_aplican: NoAplica[];
}

/** Valor presente de diferir `monto` en `meses` pagos iguales, con rendimiento anual `pct`. */
export function valorFinanciamiento(monto: number, meses: number, pctAnual: number): number {
  if (!meses || meses < 2 || pctAnual <= 0) return 0;
  const r = pctAnual / 100 / 12;
  const vp = (monto / meses) * (1 - Math.pow(1 + r, -meses)) / r;
  return monto - vp;
}

const iguales = (a: unknown, b: unknown) => String(a) === String(b);
const cumpleAtributos = (req: Record<string, unknown> | undefined, atr: Cartera["atributos"]) =>
  !req || Object.entries(req).every(([k, v]) => iguales(atr[k] ?? false, v));

function plazoPermitido(p: Promocion, meses: number): boolean {
  const pl = p.condiciones.plazos;
  if (!pl) return true;
  if (pl.permitidos && !pl.permitidos.includes(meses)) return false;
  if (pl.min !== undefined && meses < pl.min) return false;
  if (pl.max !== undefined && meses > pl.max) return false;
  return true;
}

function vigente(p: Promocion, dia: string, ev: { desde: string; hasta: string }): boolean {
  const v = p.vigencia ?? ev;
  return dia >= v.desde && dia <= v.hasta;
}

type Calculo = { ok: true; aporte: Aporte } | { ok: false; razon: string };

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

/** Calcula el beneficio de una promo dados el precio y lo que se paga tras el checkout. */
export function calcularBeneficio(p: Promocion, precio: number, neto: number, dia: string, atr: Cartera["atributos"]): Calculo {
  const b = p.beneficio;
  const enCheckout = EN_CHECKOUT.has(b.tipo);
  const base = (b.base ?? (enCheckout ? "bruto" : "neto")) === "bruto" ? precio : neto;

  const min = p.condiciones.minimo;
  if (min) {
    const m = ((min.base ?? (enCheckout ? "bruto" : "neto")) === "bruto" ? precio : neto) + Number(min.sumar_atributo ? atr[min.sumar_atributo] ?? 0 : 0);
    if (min.estricto ? m <= min.monto : m < min.monto)
      return { ok: false, razon: `Requiere compra ${min.estricto ? "mayor a" : "mínima de"} ${fmt(min.monto)}${min.sumar_atributo ? " (acumulado)" : ""}` };
  }

  if (b.tipo === "sorteo") {
    const n = b.por_cada ? Math.floor(precio / b.por_cada) : 1;
    if (n < 1) return { ok: false, razon: `Requiere al menos ${fmt(b.por_cada!)}` };
    return { ok: true, aporte: { promo: p, monto: 0, certeza: "condicionado", nota: `${n} participación(es) en el sorteo` } };
  }

  let pct = b.pct, monto = b.monto, tope = b.tope, certeza: Certeza = b.certeza;
  if (b.tramos) {
    const t = b.tramos.find((t) =>
      (!t.dias || t.dias.includes(dia)) &&
      (t.desde === undefined || base >= t.desde) &&
      (t.mayor_a === undefined || base > t.mayor_a) &&
      cumpleAtributos(t.atributos, atr));
    if (!t) return { ok: false, razon: "No alcanzas ningún tramo de la promoción" };
    pct = t.pct; monto = t.monto; certeza = t.certeza ?? certeza;
    if (t.tope !== undefined) tope = Math.min(t.tope, b.tope ?? Infinity);
  }
  if (pct !== undefined) for (const e of b.extras ?? []) if (cumpleAtributos(e.atributos, atr)) pct += e.pct;

  let valor = pct !== undefined ? (base * pct) / 100 : monto!;
  if (tope !== undefined) valor = Math.min(valor, tope);
  valor = Math.min(valor, base);
  if (valor <= 0) return { ok: false, razon: "El beneficio resulta en $0" };
  return { ok: true, aporte: { promo: p, monto: valor, pct, certeza } };
}

function subconjuntos<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  const n = Math.min(xs.length, MAX_PROMOS_COMBINABLES);
  for (let mask = 1; mask < 1 << n; mask++) out.push(xs.filter((_, i) => i < n && mask & (1 << i)));
  return out;
}

function compatibles(ps: Promocion[], maxCupones: number | undefined): boolean {
  if (ps.length > 1 && ps.some((p) => p.exclusiva)) return false;
  const ids = new Set(ps.map((p) => p.id));
  if (ps.some((p) => p.excluye.some((x) => ids.has(x)))) return false;
  if (maxCupones !== undefined) {
    const cupones = ps.filter((p) => p.beneficio.tipo === "cupon" && !p.acumulable_con_cupones).length;
    if (cupones > maxCupones) return false;
  }
  return true;
}

const ORDEN_CERTEZA: Certeza[] = ["garantizado", "hasta", "condicionado"];
const peorCerteza = (cs: Certeza[]) => ORDEN_CERTEZA[Math.max(0, ...cs.map((c) => ORDEN_CERTEZA.indexOf(c)))];

export function planesDePago(cat: Catalogo, instrumento: string, compra: Compra): number[] {
  const prod = cat.productos.get(instrumento);
  const max = prod?.msi ? compra.msi[instrumento] ?? 0 : 0;
  const planes = new Set([0]);
  if (max >= 2) {
    for (const m of PLAZOS_ESTANDAR) if (m <= max) planes.add(m);
    planes.add(max);
  }
  return [...planes].sort((a, b) => a - b);
}

export function evaluar(cat: Catalogo, compra: Compra, cartera: Cartera, params: Parametros): Resultado {
  const ev = cat.eventos.get(compra.evento);
  if (!ev) throw new Error(`Evento desconocido: ${compra.evento}`);
  const comercio = cat.comercios.get(compra.comercio);
  if (!comercio) throw new Error(`Comercio desconocido: ${compra.comercio}`);
  const P = compra.precio;
  const atr = cartera.atributos;
  const todas = (cat.promociones.get(ev.id) ?? []).filter((p) => p.comercio === comercio.id);

  const opciones: Opcion[] = [];
  const no_aplican: NoAplica[] = [];

  for (const inst of cartera.instrumentos) {
    if (!cat.productos.has(inst)) throw new Error(`Instrumento desconocido: ${inst}`);
    const delInstrumento = todas.filter((p) => p.instrumentos.includes(inst));
    const candidatas: Promocion[] = [];
    for (const p of delInstrumento) {
      if (!vigente(p, compra.dia, ev)) no_aplican.push({ promo: p, instrumento: inst, razon: "Fuera de vigencia ese día" });
      else if (!p.condiciones.requiere.every((a) => atr[a])) no_aplican.push({ promo: p, instrumento: inst, razon: "No cumples un requisito de la promoción (ver tu cartera)" });
      else candidatas.push(p);
    }
    const planes = planesDePago(cat, inst, compra);
    const usadas = new Set<string>();

    for (const combo of subconjuntos(candidatas)) {
      if (!compatibles(combo, comercio.reglas.max_cupones_por_compra)) continue;
      const checkout = combo.filter((p) => EN_CHECKOUT.has(p.beneficio.tipo));
      const posteriores = combo.filter((p) => !EN_CHECKOUT.has(p.beneficio.tipo));
      for (const meses of planes) {
        if (!combo.every((p) => plazoPermitido(p, meses))) continue;
        const fp = combo.map((p) => p.condiciones.financiamiento_posterior?.meses ?? 0);
        if (meses > 0 && fp.some((x) => x > 0)) continue; // diferir en la app solo aplica si pagas de contado
        const aportes: Aporte[] = [];
        let D = 0, valida = true;
        for (const p of checkout) {
          const r = calcularBeneficio(p, P, P, compra.dia, atr);
          if (!r.ok) { valida = false; break; }
          aportes.push(r.aporte); D += r.aporte.monto;
        }
        if (!valida) continue;
        D = Math.min(D, P);
        const neto = P - D;
        let B = 0;
        for (const p of posteriores) {
          const r = calcularBeneficio(p, P, neto, compra.dia, atr);
          if (!r.ok) { valida = false; break; }
          aportes.push(r.aporte); B += r.aporte.monto;
        }
        if (!valida) continue;
        combo.forEach((p) => usadas.add(p.id));
        const ahorro = D + B;
        const mesesFin = meses > 0 ? meses : Math.max(0, ...fp);
        const valor = valorFinanciamiento(neto, mesesFin, params.rendimiento_anual);
        opciones.push({
          instrumento: inst, promos: combo, aportes, meses, meses_financiamiento: mesesFin,
          descuento_checkout: D, beneficio_posterior: B, ahorro, costo_real: P - ahorro, monto_cobrado: neto,
          valor_msi: valor, total: ahorro + valor,
          certeza: peorCerteza(aportes.map((a) => a.certeza)),
          avisos: [...new Set(combo.flatMap((p) => p.avisos))],
          requisitos: combo.flatMap((p) => [
            ...(p.codigo ? [`Ingresa el cupón ${p.codigo}`] : []),
            ...(p.condiciones.registro_previo ? [`Regístrate antes: ${p.condiciones.registro_previo}`] : []),
            ...(p.condiciones.financiamiento_posterior ? [`Difiere la compra desde la app del banco (hasta ${p.condiciones.financiamiento_posterior.meses} meses)`] : []),
          ]),
        });
      }
    }

    // Por qué no aplica cada candidata que nunca entró en una opción
    for (const p of candidatas) {
      if (usadas.has(p.id)) continue;
      let razon = "Ningún plazo disponible con este producto cumple la promoción";
      for (const meses of planes) {
        if (!plazoPermitido(p, meses)) continue;
        const r = calcularBeneficio(p, P, P, compra.dia, atr);
        razon = r.ok ? "No se puede combinar en este caso" : r.razon;
        break;
      }
      no_aplican.push({ promo: p, instrumento: inst, razon });
    }
  }

  return { opciones, no_aplican };
}

export type Criterio = "ahorro" | "total";
export function ordenar(opciones: Opcion[], criterio: Criterio = "ahorro"): Opcion[] {
  return [...opciones].sort((a, b) => b[criterio] - a[criterio] || b.meses_financiamiento - a.meses_financiamiento);
}

/** La mejor opción por instrumento, ordenadas. */
export function mejoresPorInstrumento(opciones: Opcion[], criterio: Criterio = "ahorro"): Opcion[] {
  const mejor = new Map<string, Opcion>();
  for (const o of ordenar(opciones, criterio)) if (!mejor.has(o.instrumento)) mejor.set(o.instrumento, o);
  return [...mejor.values()];
}
