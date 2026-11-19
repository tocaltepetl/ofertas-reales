/** Interfaz web: usa el mismo motor que la CLI, con el catálogo compilado a JSON. */
import type { Catalogo } from "../src/catalogo.ts";
import type { Emisor, Comercio, Evento, Promocion, Producto, Atributo } from "../src/esquema.ts";
import { evaluar, ordenar, mejoresPorInstrumento, type Opcion, type Criterio, type Resultado } from "../src/motor.ts";
import { almacenNavegador, cargarPerfil, guardarPerfil, cargarEstadoEvento, guardarEstadoEvento, migrarV1, type Perfil, type EstadoEvento } from "./estado.ts";
import { hoyEn, agenda, eventoPorDefecto, diasDe, diaInicial, categoriasDe, textoFase, faseDe } from "./eventos.ts";

/** Único evento que existía cuando el estado se guardaba en la clave v1. */
const EVENTO_V1 = "buen-fin-2026";
const ZONA = "America/Mexico_City";

interface CatalogoJSON {
  generado: string;
  emisores: Emisor[];
  comercios: Comercio[];
  eventos: Evento[];
  promociones: Record<string, Promocion[]>;
}

const $ = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const el = (id: string) => document.getElementById(id)!;

function aCatalogo(j: CatalogoJSON): Catalogo {
  const productos = new Map<string, Producto & { emisor: string }>();
  const atributos = new Map<string, Atributo & { emisor: string }>();
  for (const e of j.emisores) {
    for (const p of e.productos) productos.set(p.id, { ...p, emisor: e.id });
    for (const a of e.atributos ?? []) atributos.set(a.id, { ...a, emisor: e.id });
  }
  return {
    raiz: "", emisores: j.emisores, productos, atributos,
    comercios: new Map(j.comercios.map((c) => [c.id, c])),
    eventos: new Map(j.eventos.map((e) => [e.id, e])),
    promociones: new Map(Object.entries(j.promociones)),
  };
}

function perfilPorDefecto(cat: Catalogo): Perfil {
  const tengo: Perfil["tengo"] = {}, msi: Perfil["msi"] = {}, atributos: Perfil["atributos"] = {};
  for (const [id, p] of cat.productos) { tengo[id] = true; if (p.msi) msi[id] = 12; }
  for (const [id, a] of cat.atributos) atributos[id] = a.defecto ?? (a.tipo === "booleano" ? false : a.tipo === "numero" ? 0 : a.opciones?.[a.opciones.length - 1]?.valor ?? "");
  return { precio: 12987, categoria: "", rendimiento: 10, criterio: "ahorro", soloGarantizado: false, tengo, msi, atributos };
}

const fechaCorta = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

async function main() {
  const j: CatalogoJSON = await (await fetch("catalogo.json")).json();
  const cat = aCatalogo(j);
  const alm = almacenNavegador();
  migrarV1(alm, EVENTO_V1);
  const P = cargarPerfil(alm, perfilPorDefecto(cat));
  const hoy = hoyEn(ZONA);

  if (!j.eventos.length) {
    el("subtitulo").textContent = "Todavía no hay eventos en el catálogo.";
    document.querySelector("main")!.innerHTML = "";
    return;
  }

  // Estado del evento abierto; se reemplaza al cambiar de evento
  let ev: Evento = j.eventos[0];
  let E: EstadoEvento = { dia: null, comercio: null, acumulados: {} };
  let comerciosConPromos: string[] = [];
  let categoriaEf = "";

  const guardar = () => { guardarPerfil(alm, P); guardarEstadoEvento(alm, ev.id, E); };

  // ---------- Navegación entre eventos ----------
  function pintarEventos() {
    const ag = agenda(j.eventos, hoy);
    const chip = (e: Evento) => `<a class="evento ${faseDe(e, hoy)} ${e.id === ev.id ? "on" : ""}" href="#${encodeURIComponent(e.id)}"${e.id === ev.id ? ' aria-current="page"' : ""}>
      <span>${esc(e.nombre)}</span><small>${esc(textoFase(e, hoy))}</small></a>`;
    const grupo = (titulo: string, evs: Evento[]) => (evs.length ? `<span class="grupo">${titulo}</span>${evs.map(chip).join("")}` : "");
    el("eventos").innerHTML = j.eventos.length < 2 ? "" : grupo("Ahora", ag.activos) + grupo("Próximos", ag.proximos) + grupo("Anteriores", ag.pasados);
  }

  function pintarAviso() {
    const aviso = el("aviso");
    const fase = faseDe(ev, hoy);
    aviso.hidden = fase === "activo";
    aviso.className = fase === "proximo" ? "info" : "";
    aviso.textContent = fase === "pasado"
      ? `${ev.nombre} terminó el ${fechaCorta(ev.hasta)}. Las promociones se muestran solo como consulta; ya no están vigentes.`
      : fase === "proximo"
        ? `${ev.nombre} empieza el ${fechaCorta(ev.desde)}. Las promociones pueden cambiar antes del evento.`
        : "";
  }

  function abrirEvento(id: string) {
    ev = j.eventos.find((e) => e.id === id) ?? eventoPorDefecto(j.eventos, hoy)!;
    E = cargarEstadoEvento(alm, ev.id);
    const promos = cat.promociones.get(ev.id) ?? [];
    comerciosConPromos = [...new Set(promos.map((p) => p.comercio))];
    el("subtitulo").textContent = `${ev.nombre} · ${fechaCorta(ev.desde)} al ${fechaCorta(ev.hasta)} · ${promos.length} promociones en ${comerciosConPromos.length} comercios · catálogo del ${fechaCorta(hoyEn(ZONA, new Date(j.generado)))}`;
    document.title = `${ev.nombre} · Buscador de promociones`;
    el("nombre-evento").textContent = ev.nombre;

    const dias = diasDe(ev);
    E.dia = diaInicial(ev, hoy, E.dia);
    dia.innerHTML = dias.map((d) => `<option value="${d}">${new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}${d === hoy ? " (hoy)" : ""}</option>`).join("");
    dia.value = E.dia;

    const cats = categoriasDe(promos);
    el("caja-categoria").hidden = !cats.length;
    categoria.innerHTML = `<option value="">General</option>` + cats.map((c) => `<option value="${esc(c.id)}">${esc(c.etiqueta)}</option>`).join("");
    // La categoría es preferencia del usuario: si este evento no la tiene, se evalúa como General sin olvidarla
    categoriaEf = cats.some((c) => c.id === P.categoria) ? P.categoria : "";
    categoria.value = categoriaEf;

    pintarEventos();
    pintarAviso();
    pintarAcumulados(promos);
    actualizar();
  }

  // ---------- Panel ----------
  const precio = el("precio") as HTMLInputElement, dia = el("dia") as HTMLSelectElement;
  const categoria = el("categoria") as HTMLSelectElement, rendimiento = el("rendimiento") as HTMLInputElement;
  precio.value = String(P.precio); rendimiento.value = String(P.rendimiento);
  precio.oninput = () => { P.precio = Number(precio.value) || 0; actualizar(); };
  dia.onchange = () => { E.dia = dia.value; actualizar(); };
  categoria.onchange = () => { P.categoria = categoriaEf = categoria.value; actualizar(); };
  rendimiento.oninput = () => { P.rendimiento = Number(rendimiento.value) || 0; actualizar(); };
  (el("garantizado") as HTMLInputElement).checked = P.soloGarantizado;
  (el("garantizado") as HTMLInputElement).onchange = (e) => { P.soloGarantizado = (e.target as HTMLInputElement).checked; actualizar(); };
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => {
    b.classList.toggle("on", b.dataset.c === P.criterio);
    b.onclick = () => { P.criterio = b.dataset.c as Criterio; document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b)); actualizar(); };
  });
  el("todo").onclick = () => { for (const k in P.tengo) P.tengo[k] = true; pintarCartera(); actualizar(); };
  el("nada").onclick = () => { for (const k in P.tengo) P.tengo[k] = false; pintarCartera(); actualizar(); };

  function atributoHtml(a: Atributo) {
    const v = P.atributos[a.id];
    if (a.tipo === "booleano") return `<label class="chk attr"><input type="checkbox" data-a="${a.id}" ${v ? "checked" : ""}>${esc(a.etiqueta)}</label>`;
    if (a.tipo === "opcion") return `<div class="attr">${esc(a.etiqueta)}: <select data-a="${a.id}">${(a.opciones ?? []).map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(v) ? "selected" : ""}>${esc(o.etiqueta)}</option>`).join("")}</select></div>`;
    return `<div class="attr">${esc(a.etiqueta)}: <input type="number" data-a="${a.id}" value="${esc(v)}" style="width:90px"></div>`;
  }
  function pintarCartera() {
    const box = el("cartera");
    box.innerHTML = cat.emisores.map((e) => `
      <div class="group"><div class="gtitle">${esc(e.nombre)}</div>
        ${e.productos.map((p) => `<label class="chk"><input type="checkbox" data-p="${p.id}" ${P.tengo[p.id] ? "checked" : ""}>
          <span style="flex:1">${esc(p.nombre)}</span>
          ${p.msi ? `<input class="msi" type="number" min="0" max="48" data-msi="${p.id}" value="${P.msi[p.id] ?? 0}" title="MSI máximos"><span class="how">MSI</span>` : ""}</label>`).join("")}
        ${(e.atributos ?? []).map(atributoHtml).join("")}
      </div>`).join("");
    box.querySelectorAll<HTMLInputElement>("[data-p]").forEach((i) => (i.onchange = () => { P.tengo[i.dataset.p!] = i.checked; actualizar(); }));
    box.querySelectorAll<HTMLInputElement>("[data-msi]").forEach((i) => (i.oninput = () => { P.msi[i.dataset.msi!] = Number(i.value) || 0; actualizar(); }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-a]").forEach((i) => (i.onchange = i.oninput = () => {
      const a = cat.atributos.get(i.dataset.a!)!;
      P.atributos[a.id] = a.tipo === "booleano" ? (i as HTMLInputElement).checked : a.tipo === "numero" ? Number(i.value) || 0
        : (a.opciones?.find((o) => String(o.valor) === i.value)?.valor ?? i.value);
      actualizar();
    }));
  }

  // ---------- Resultados ----------
  const nombreInst = (id: string) => cat.productos.get(id)?.nombre ?? id;
  const pillCerteza = (c: string) => `<span class="pill ${c === "garantizado" ? "ok" : "warn"}">${esc(c)}</span>`;
  const filtrar = (ops: Opcion[]) => (P.soloGarantizado ? ops.filter((o) => o.certeza === "garantizado") : ops);

  function evaluarComercio(c: string): Resultado {
    return evaluar(cat,
      { evento: ev.id, comercio: c, precio: P.precio, dia: E.dia!, msi: P.msi, categoria: categoriaEf || undefined },
      { instrumentos: Object.keys(P.tengo).filter((k) => P.tengo[k]), atributos: P.atributos, acumulados: E.acumulados },
      { rendimiento_anual: P.rendimiento });
  }

  function actualizar() {
    guardar();
    const filas = comerciosConPromos.map((c) => {
      const r = evaluarComercio(c);
      return { c, r, mejor: ordenar(filtrar(r.opciones), P.criterio)[0] as Opcion | undefined };
    }).sort((a, b) => (b.mejor?.[P.criterio] ?? -1) - (a.mejor?.[P.criterio] ?? -1));
    if (!E.comercio || !comerciosConPromos.includes(E.comercio)) E.comercio = filas[0]?.c ?? null;

    el("comparacion").innerHTML = !filas.length ? `<tbody><tr><td class="empty">Este evento todavía no tiene promociones capturadas.</td></tr></tbody>` :
      `<thead><tr><th>Comercio</th><th>Mejor forma de pagar</th><th class="num">Ahorro</th>${P.criterio === "total" ? '<th class="num">Valor MSI</th><th class="num">Total</th>' : ""}<th class="num">Costo real</th><th class="num">Meses</th><th>Certeza</th></tr></thead><tbody>` +
      filas.map(({ c, mejor: o }) => `<tr class="click ${c === E.comercio ? "sel" : ""}" data-c="${c}">
        <td class="ent">${esc(cat.comercios.get(c)?.nombre ?? c)}</td>
        ${o ? `<td><div>${esc(nombreInst(o.instrumento))}</div><div class="how">${esc(o.promos.map((p) => p.nombre).join(" + "))}</div></td>
        <td class="num save">${$(o.ahorro)}</td>
        ${P.criterio === "total" ? `<td class="num">${$(o.valor_msi)}</td><td class="num"><b>${$(o.total)}</b></td>` : ""}
        <td class="num">${$(o.costo_real)}</td><td class="num">${o.meses_financiamiento || "Contado"}</td><td>${pillCerteza(o.certeza)}</td>`
        : `<td colspan="${P.criterio === "total" ? 7 : 5}" class="how">Ninguna promoción aplica con tu cartera</td>`}
      </tr>`).join("") + "</tbody>";
    el("comparacion").querySelectorAll<HTMLTableRowElement>("tr[data-c]").forEach((tr) => (tr.onclick = () => { E.comercio = tr.dataset.c!; actualizar(); el("detalle").scrollIntoView({ behavior: "smooth", block: "start" }); }));

    const sel = filas.find((f) => f.c === E.comercio);
    el("detalle").hidden = !sel;
    el("detalle").innerHTML = sel ? detalle(sel.c, sel.r) : "";
  }

  function detalle(c: string, r: Resultado): string {
    const nombre = cat.comercios.get(c)?.nombre ?? c;
    const ops = mejoresPorInstrumento(filtrar(r.opciones), P.criterio);
    if (!ops.length) return `<h2>${esc(nombre)}</h2><p class="empty">Ninguna promoción aplica con tu cartera.</p>`;
    const g = ops[0];
    const receta = [
      `Paga con <b>${esc(nombreInst(g.instrumento))}</b> ${g.meses ? `a <b>${g.meses} MSI</b>` : "<b>de contado</b>"}`,
      ...g.requisitos.map(esc),
      ...g.aportes.map((a) => `${esc(a.promo.nombre)}: <b>${$(a.monto)}</b>${a.pct !== undefined ? ` (${a.pct}%)` : ""}${a.nota ? ` — ${esc(a.nota)}` : ""}`),
    ];
    const promosUsadas = new Map<string, Promocion>();
    for (const o of ops) for (const p of o.promos) promosUsadas.set(p.id, p);
    return `<h2>${esc(nombre)}</h2>
      <div class="winner"><div class="big">${$(P.criterio === "total" ? g.total : g.ahorro)}</div>
        <div><b>${esc(g.promos.map((p) => p.nombre).join(" + "))}</b> ${pillCerteza(g.certeza)}
        <ul class="receta">${receta.map((x) => `<li>${x}</li>`).join("")}</ul>
        <div class="how">Pagas ${$(g.monto_cobrado)} en el comercio; costo real ${$(g.costo_real)}${g.beneficio_posterior ? ` (${$(g.beneficio_posterior)} llegan después)` : ""}.</div>
        ${g.avisos.map((a) => `<span class="pill warn">${esc(a)}</span>`).join("")}</div></div>
      <h3>La mejor opción con cada tarjeta</h3>
      <div class="scroll"><table><thead><tr><th>#</th><th>Tarjeta y promociones</th><th class="num">Ahorro</th><th class="num">Valor MSI</th><th class="num">Costo real</th><th class="num">Meses</th><th>Certeza</th></tr></thead><tbody>
      ${ops.map((o, i) => `<tr><td class="how">${i + 1}</td><td><div class="ent">${esc(nombreInst(o.instrumento))}</div><div class="how">${esc(o.promos.map((p) => p.nombre).join(" + "))}</div>
        ${o.avisos.slice(0, 3).map((a) => `<span class="pill">${esc(a)}</span>`).join("")}</td>
        <td class="num save">${$(o.ahorro)}</td><td class="num">${$(o.valor_msi)}</td><td class="num">${$(o.costo_real)}</td>
        <td class="num">${o.meses_financiamiento || "Contado"}</td><td>${pillCerteza(o.certeza)}</td></tr>`).join("")}
      </tbody></table></div>
      ${r.no_aplican.length ? `<details><summary>No aplican a esta compra (${r.no_aplican.length})</summary><ul>${r.no_aplican.map((n) => `<li><b>${esc(n.promo.nombre)}</b> [${esc(nombreInst(n.instrumento))}]: ${esc(n.razon)}</li>`).join("")}</ul></details>` : ""}
      <details><summary>Fuentes de estas promociones</summary><ul>${[...promosUsadas.values()].map((p) => `<li>${esc(p.nombre)}: <a href="${esc(p.fuente.url)}" target="_blank" rel="noopener">${esc(new URL(p.fuente.url).hostname)}</a> · capturada ${esc(p.fuente.capturada)}${p.fuente.revisada ? "" : " · <i>sin revisar</i>"}${p.fuente.evidencia ? ` — “${esc(p.fuente.evidencia)}”` : ""}</li>`).join("")}</ul></details>`;
  }

  // Campañas (promos de un banco que se repiten en varios comercios): compras previas y beneficio ya recibido en este evento
  function pintarAcumulados(promos: Promocion[]) {
    const campanas = new Map<string, Promocion>();
    for (const p of promos) if (p.campana && !campanas.has(p.campana)) campanas.set(p.campana, p);
    el("caja-acumulados").hidden = !campanas.size;
    el("acumulados").innerHTML = [...campanas].map(([id, p]) => `<div class="acum">
        <div>${esc(cat.emisores.find((e) => e.id === p.patrocinador)?.nombre ?? p.patrocinador)} · ${esc(p.nombre.replace(/\s*\(.*\)$/, ""))}</div>
        <label>Ya compraste <input type="number" min="0" data-acum="${id}" data-k="compras" value="${E.acumulados[id]?.compras ?? 0}"></label>
        <label>Ya recibiste <input type="number" min="0" data-acum="${id}" data-k="beneficio" value="${E.acumulados[id]?.beneficio ?? 0}"></label>
      </div>`).join("");
    el("acumulados").querySelectorAll<HTMLInputElement>("[data-acum]").forEach((i) => (i.oninput = () => {
      const a = (E.acumulados[i.dataset.acum!] ??= {});
      a[i.dataset.k as "compras" | "beneficio"] = Number(i.value) || 0;
      actualizar();
    }));
  }

  const idDeHash = () => decodeURIComponent(location.hash.slice(1));
  window.addEventListener("hashchange", () => { if (idDeHash() !== ev.id) abrirEvento(idDeHash()); });

  pintarCartera();
  abrirEvento(idDeHash());
  // Normaliza la URL para que siempre se pueda compartir el evento abierto
  if (idDeHash() !== ev.id) history.replaceState(null, "", `#${encodeURIComponent(ev.id)}`);
}

main().catch((e) => { el("subtitulo").textContent = `Error al cargar: ${e}`; });
