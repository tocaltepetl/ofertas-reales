/**
 * Tarjeta de Profeco en la vista de un evento: comparar el precio antes de pagar, qué hacer si no
 * respetan la promoción y, cuando Profeco publica su balance, las ofertas reales y simuladas que
 * encontró. Funciones puras (sin DOM) para poder probarlas.
 */
import type { Evento, Profeco, CasoProfeco } from "../src/esquema.ts";

type Fase = "proximo" | "activo" | "pasado";

/** Cambio del precio durante el evento, en % (negativo = bajó). */
export const cambioPct = (c: CasoProfeco) => ((c.durante - c.antes) / c.antes) * 100;

/** Una oferta es simulada si el precio durante el evento fue mayor que antes. */
export const esSimulada = (c: CasoProfeco) => c.durante > c.antes;

/** El comparador a enlazar: el micrositio del evento mientras dura (o antes), y si no, Quién es Quién. */
export function comparadorDe(ev: Evento, canales: Profeco | undefined, fase: Fase): string | undefined {
  if (ev.profeco?.comparador && fase !== "pasado") return ev.profeco.comparador;
  return canales?.comparador ?? ev.profeco?.comparador;
}

const pesos = (n: number) => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fechaLarga = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const enlace = (url: string, texto: string, esc: (s: unknown) => string) =>
  `<a href="${esc(url)}" target="_blank" rel="noopener">${texto}</a>`;

/** HTML de la tarjeta; vacío si no hay nada que mostrar. */
export function htmlProfeco(ev: Evento, canales: Profeco | undefined, fase: Fase, esc: (s: unknown) => string): string {
  const comparador = comparadorDe(ev, canales, fase);
  const balance = ev.profeco?.balance;
  if (!comparador && !canales && !balance) return "";

  const antes: string[] = [];
  if (comparador) antes.push(`Busca el producto en ${enlace(comparador, "el comparador de Profeco", esc)} (Quién es Quién en los Precios). Muestra el precio mínimo, máximo y promedio por ciudad, y cómo cambió en las semanas previas.`);
  antes.push("Anota o captura el precio unos días antes. Si «rebajan» un precio que antes subieron, no es oferta.");
  antes.push("Guarda la captura de la promoción, el ticket y el estado de cuenta: son tu prueba si algo no se cumple.");

  const despues: string[] = [];
  if (canales) {
    despues.push(`Llama al Teléfono del Consumidor: <b>${esc(canales.telefono.nacional)}</b> (sin costo) o <b>${esc(canales.telefono.cdmx)}</b> en la Ciudad de México; ${esc(canales.telefono.horario)}.`);
    despues.push(`Si el comercio participa en ${enlace(canales.concilianet, "Concilianet", esc)}, puedes poner tu queja en línea; si no, en una ${enlace(canales.oficinas, "oficina de Profeco", esc)}.`);
  }
  despues.push("Una bonificación del banco que no llegó se reclama primero con el banco; si no responde, con la Condusef.");

  let hallazgos = "";
  if (balance) {
    const filas = balance.casos.map((c) => {
      const pct = cambioPct(c);
      const sim = esSimulada(c);
      return `<tr><td data-l="Tienda" class="ent">${esc(c.tienda)}</td><td data-l="Producto">${esc(c.producto)}</td>
        <td class="num" data-l="Antes">${pesos(c.antes)}</td><td class="num" data-l="Durante">${pesos(c.durante)}</td>
        <td class="num ${sim ? "sube" : "save"}" data-l="Cambio">${pct > 0 ? "+" : ""}${pct.toFixed(1)}%</td>
        <td data-l="Oferta"><span class="pill ${sim ? "warn" : "ok"}">${sim ? "Simulada" : "Real"}</span></td></tr>`;
    }).join("");
    hallazgos = `<h3 class="mt">Lo que encontró Profeco en ${esc(ev.nombre)}</h3>
      <p class="note">${esc(balance.resumen)} Estos son los casos que cita en su ${enlace(balance.url, "comunicado", esc)} del ${esc(fechaLarga(balance.fecha))}.</p>
      ${filas ? `<div class="scroll"><table class="apilable"><thead><tr><th>Tienda</th><th>Producto</th><th class="num">Antes</th><th class="num">Durante</th><th class="num">Cambio</th><th>Oferta</th></tr></thead><tbody>${filas}</tbody></table></div>` : ""}`;
  }

  return `<h2>Antes y después de pagar</h2>
    <p class="sub">La mejor tarjeta no sirve si el precio está inflado. Esto lo publica la Procuraduría Federal del Consumidor (Profeco); este buscador no está afiliado a ella.</p>
    <div class="profeco-cols">
      <div><h3>${fase === "pasado" ? "Para el próximo evento" : "Antes de pagar"}</h3><ul>${antes.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <div><h3>Si no respetan la promoción o el precio</h3><ul>${despues.map((x) => `<li>${x}</li>`).join("")}</ul></div>
    </div>
    ${hallazgos}`;
}
