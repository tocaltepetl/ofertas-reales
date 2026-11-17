/**
 * Paridad con la calculadora v0: para una malla de escenarios (precio × día × MSI × perfil),
 * cada opción que la calculadora considera válida debe existir en el motor con el mismo
 * instrumento, el mismo ahorro y los mismos meses, y la mejor opción del motor nunca puede
 * ser peor que la mejor de la calculadora.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cargarCatalogo } from "../src/catalogo.ts";
import { evaluar, ordenar, type Opcion } from "../src/motor.ts";
// @ts-ignore: módulo JS del legado, sin tipos
import { calcular } from "./legado/calculadora-ml.js";

const cat = cargarCatalogo();

/** clave "own" de la calculadora → producto del catálogo */
const OWN: Record<string, string> = {
  mp_tdc: "mercadopago.tdc", mc: "mercadopago.credito", wallet: "mercadopago.saldo",
  banamex: "banamex.tdc", santander: "santander.tdc", bbva: "bbva.tdc", hsbc: "hsbc.tdc",
  banorte_tdc: "banorte.tdc", banorte_tdd: "banorte.tdd", amex: "amex.tarjeta", oxxo: "oxxo.efectivo",
  scotia_tdc: "scotiabank.tdc", scotia_tdd: "scotiabank.tdd", afirme: "afirme.tdc", invex: "invex.tdc",
  openbank: "openbank.tdc", mifel: "mifel.tdc", falabella: "falabella.tdc",
  bancoppel_tdc: "bancoppel.tdc", bancoppel_tdd: "bancoppel.tdd", nu: "nu.tdc", didi: "didi.tarjeta", klar: "klar.tdc",
};
/** clave de MSI de la calculadora → producto */
const MSI: Record<string, string> = {
  mp: "mercadopago.tdc", banamex: "banamex.tdc", santander: "santander.tdc", bbva: "bbva.tdc", hsbc: "hsbc.tdc",
  banorte: "banorte.tdc", amex: "amex.tarjeta", scotia: "scotiabank.tdc", afirme: "afirme.tdc", invex: "invex.tdc",
  openbank: "openbank.tdc", mifel: "mifel.tdc", falabella: "falabella.tdc", bancoppel: "bancoppel.tdc",
  nu: "nu.tdc", didi: "didi.tarjeta", klar: "klar.tdc",
};
const SEGMENTO: Record<number, string> = { 25: "premier", 20: "one", 10: "otro" };

type X = { mcFirst: boolean; walletNew: boolean; bnxProd: number; santNom: boolean; hsbcSeg: number; hsbcTr: boolean; hsbcExtra: number; scotiaInv: boolean; invexMeta: boolean };
const atributos = (x: X) => ({
  mercadopago_credito_primera_vez: x.mcFirst, mercadopago_usuario_nuevo: x.walletNew,
  banamex_productos_extra: x.bnxProd, santander_nomina: x.santNom,
  hsbc_segmento: SEGMENTO[x.hsbcSeg], hsbc_transferencia: x.hsbcTr,
  scotiabank_invitacion: x.scotiaInv, invex_meta: x.invexMeta,
});

// Malla de escenarios. Los MSI usan plazos estándar (la calculadora acepta cualquier número;
// el motor solo plazos que existen, p. ej. no 7 ni 10 meses).
const PRECIOS = [99, 300, 1500, 2100, 2600, 3200, 3600, 4500, 5200, 7000, 9500, 10500, 11200, 12987, 16000, 26000, 45000, 60000];
const DIAS = [13, 14, 16, 17];
const PERFILES_MSI: Record<string, number>[] = [
  { mp: 24, banamex: 12, santander: 12, bbva: 15, hsbc: 15, banorte: 12, amex: 12, scotia: 12, afirme: 12, invex: 0, openbank: 0, mifel: 3, falabella: 3, bancoppel: 12, nu: 3, didi: 0, klar: 0 }, // la del refrigerador
  Object.fromEntries(Object.keys(MSI).map((k) => [k, 0])),
  { mp: 18, banamex: 24, santander: 18, bbva: 18, hsbc: 12, banorte: 6, amex: 6, scotia: 18, afirme: 9, invex: 12, openbank: 6, mifel: 12, falabella: 6, bancoppel: 6, nu: 6, didi: 12, klar: 12 },
  { mp: 6, banamex: 9, santander: 6, bbva: 24, hsbc: 6, banorte: 3, amex: 3, scotia: 3, afirme: 6, invex: 9, openbank: 3, mifel: 24, falabella: 12, bancoppel: 3, nu: 12, didi: 6, klar: 6 },
];
const PERFILES_X: X[] = [
  { mcFirst: false, walletNew: false, bnxProd: 1, santNom: false, hsbcSeg: 10, hsbcTr: false, hsbcExtra: 0, scotiaInv: false, invexMeta: false },
  { mcFirst: true, walletNew: true, bnxProd: 3, santNom: true, hsbcSeg: 25, hsbcTr: true, hsbcExtra: 8000, scotiaInv: true, invexMeta: true },
  { mcFirst: false, walletNew: true, bnxProd: 0, santNom: true, hsbcSeg: 20, hsbcTr: false, hsbcExtra: 2000, scotiaInv: true, invexMeta: false },
];
const RENDIMIENTO = 10;
const own = Object.fromEntries(Object.keys(OWN).map((k) => [k, true]));
const TOL_AHORRO = 0.01;
const TOL_MSI = 1; // la calculadora redondea el cupón al calcular el valor de los MSI

test("el motor reproduce cada opción de la calculadora v0", () => {
  let escenarios = 0, comparadas = 0;
  const fallas: string[] = [];
  for (const P of PRECIOS) for (const day of DIAS) for (const msiL of PERFILES_MSI) for (const x of PERFILES_X) {
    escenarios++;
    // Diferencia conocida: la calculadora muestra el Pase Morado de Nu aun con 0 pases (P < $3,000);
    // el motor no lo ofrece porque no da ninguna participación.
    const legado = (calcular(P, { msi: msiL, x, day }, own, RENDIMIENTO).ok as Array<{ o: { own: string; label: string }; s: number; m: number; fin: number }>)
      .filter((l) => !(l.o.own === "nu" && P < 3000));
    const { opciones } = evaluar(cat,
      { evento: "buen-fin-2026", comercio: "mercadolibre", precio: P, dia: `2026-11-${day}`, msi: Object.fromEntries(Object.entries(msiL).map(([k, v]) => [MSI[k], v])) },
      { instrumentos: Object.values(OWN), atributos: atributos(x), acumulados: { "hsbc-bf26-devolucion": { compras: x.hsbcExtra } } },
      { rendimiento_anual: RENDIMIENTO });
    const donde = `P=${P} día=${day} msi=${JSON.stringify(msiL)} x=${JSON.stringify(x)}`;
    for (const l of legado) {
      comparadas++;
      const inst = OWN[l.o.own];
      const par = opciones.find((o: Opcion) => o.instrumento === inst && Math.abs(o.ahorro - l.s) < TOL_AHORRO && o.meses_financiamiento === l.m && Math.abs(o.valor_msi - l.fin) < TOL_MSI);
      if (!par) {
        const delInst = opciones.filter((o) => o.instrumento === inst).map((o) => `${o.promos.map((p) => p.id).join("+")} m=${o.meses_financiamiento} ahorro=${o.ahorro.toFixed(2)} msi=${o.valor_msi.toFixed(2)}`);
        fallas.push(`${l.o.label} (${inst}) ahorro=${l.s.toFixed(2)} m=${l.m} msi=${l.fin.toFixed(2)} | motor: ${delInst.join("; ") || "nada"} | ${donde}`);
      }
    }
    for (const criterio of ["ahorro", "total"] as const) {
      const keyL = criterio === "ahorro" ? "s" : "total";
      const mejorL = Math.max(0, ...legado.map((l: any) => l[keyL]));
      const mejorM = ordenar(opciones, criterio)[0]?.[criterio] ?? 0;
      if (mejorM + TOL_MSI < mejorL) fallas.push(`mejor por ${criterio}: motor ${mejorM.toFixed(2)} < calculadora ${mejorL.toFixed(2)} | ${donde}`);
    }
  }
  assert.ok(escenarios > 800 && comparadas > 5000, `pocos casos: ${escenarios} escenarios, ${comparadas} opciones`);
  assert.deepEqual(fallas.slice(0, 15), [], `${fallas.length} diferencias de ${comparadas} opciones comparadas`);
});
