/** Interfaz web: usa el mismo motor que la CLI, con el catálogo compilado a JSON. */
import type { Catalogo } from "../src/catalogo.ts";
import type { Emisor, Comercio, Evento, Promocion, Producto, Atributo, Profeco } from "../src/esquema.ts";
import { evaluar, ordenar, mejoresPorInstrumento, type Opcion, type Criterio, type Resultado } from "../src/motor.ts";
import { almacenNavegador, cargarPerfil, guardarPerfil, cargarEstadoEvento, guardarEstadoEvento, migrarV1, cargarUltimaVista, guardarUltimaVista, borrarDatos, type Perfil, type EstadoEvento } from "./estado.ts";
import { ordenarEmisores } from "./cartera.ts";
import { hoyEn, agenda, diasDe, diaInicial, categoriasDe, textoFase, faseDe } from "./eventos.ts";
import { htmlProfeco, comparadorDe } from "./profeco.ts";
import { mesesCalendario, carriles, eventosDelDia, vistaAlEntrar, indicesDeColor, icsDeEvento, VISTA_CALENDARIO } from "./calendario.ts";

/** true en el build para artefacto de claude.ai, donde el visor bloquea las descargas (lo define esbuild). */
declare const ARTEFACTO: boolean;

/** Único evento que existía cuando el estado se guardaba en la clave v1. */
const EVENTO_V1 = "buen-fin-2026";
const ZONA = "America/Mexico_City";
/** Colores de evento definidos en estilos.css (--ev0 … --ev4). */
const COLORES_EVENTO = 5;

interface CatalogoJSON {
  generado: string;
  emisores: Emisor[];
  comercios: Comercio[];
  eventos: Evento[];
  promociones: Record<string, Promocion[]>;
  profeco?: Profeco;
}

const $ = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const el = (id: string) => document.getElementById(id)!;
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  return { precio: 12987, categoria: "", rendimiento: 10, criterio: "ahorro", soloGarantizado: false, carteraElegida: false, tengo, msi, atributos };
}

const fecha = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", o);
const fechaCorta = (d: string) => fecha(d, { day: "numeric", month: "short" });
const rango = (e: Evento) => `${fechaCorta(e.desde)} al ${fechaCorta(e.hasta)}`;
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NOMBRES_DIA = ["L", "M", "M", "J", "V", "S", "D"];

async function main() {
  const j: CatalogoJSON = await (await fetch("catalogo.json")).json();
  const cat = aCatalogo(j);
  const alm = almacenNavegador();
  migrarV1(alm, EVENTO_V1);
  const P = cargarPerfil(alm, perfilPorDefecto(cat));
  const hoy = hoyEn(ZONA);
  const promosDe = (id: string) => cat.promociones.get(id) ?? [];
  const tienePromos = (id: string) => promosDe(id).length > 0;
  const colorDe = indicesDeColor(j.eventos, COLORES_EVENTO);
  const carrilDe = carriles(j.eventos);
  const enlace = (e: Evento) => `#${encodeURIComponent(e.id)}`;

  if (!j.eventos.length) {
    el("vista-evento").hidden = false;
    el("subtitulo").textContent = "Todavía no hay eventos en el catálogo.";
    el("calculadora").remove();
    return;
  }

  // Estado del evento abierto; se reemplaza al cambiar de evento
  let ev: Evento = j.eventos[0];
  let vista = VISTA_CALENDARIO;
  let E: EstadoEvento = { dia: null, comercio: null, acumulados: {} };
  let comerciosConPromos: string[] = [];
  let categoriaEf = "";

  // Tras "Borrar lo guardado" no se vuelve a escribir nada mientras la página recarga
  let borrado = false;
  const guardar = () => { if (borrado) return; guardarPerfil(alm, P); guardarEstadoEvento(alm, ev.id, E); };

  // ---------- Navegación ----------
  function pintarNav() {
    const ag = agenda(j.eventos, hoy);
    const chip = (e: Evento) => `<a class="evento ${faseDe(e, hoy)} ${vista === e.id ? "on" : ""}" style="--c:var(--ev${colorDe.get(e.id)})" href="${enlace(e)}"${vista === e.id ? ' aria-current="page"' : ""}>
      <span>${esc(e.nombre)}</span><small>${esc(textoFase(e, hoy))}</small></a>`;
    // En la barra: lo vigente y lo próximo; los anteriores viven en el calendario (salvo el que está abierto)
    const visibles = [...ag.activos, ...ag.proximos, ...ag.pasados.filter((e) => e.id === vista)];
    el("eventos").innerHTML = `<a class="evento cal ${vista === VISTA_CALENDARIO ? "on" : ""}" href="#${VISTA_CALENDARIO}"${vista === VISTA_CALENDARIO ? ' aria-current="page"' : ""}><span>Calendario</span><small>${j.eventos.length} eventos</small></a>` +
      visibles.map(chip).join("");
  }

  function descargarIcs(e: Evento) {
    const url = location.origin + location.pathname + enlace(e);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([icsDeEvento(e, url, new Date())], { type: "text/calendar" }));
    a.download = `${e.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const botonIcs = (e: Evento) => (ARTEFACTO ? "" : `<button class="sec" data-ics="${esc(e.id)}">Agregar a mi calendario</button>`);
  function conectarIcs(raiz: HTMLElement) {
    raiz.querySelectorAll<HTMLButtonElement>("[data-ics]").forEach((b) => (b.onclick = () => descargarIcs(j.eventos.find((e) => e.id === b.dataset.ics)!)));
  }

  function resumenPromos(e: Evento) {
    const promos = promosDe(e.id);
    if (!promos.length) return "Promociones aún no publicadas";
    return `${promos.length} promociones en ${new Set(promos.map((p) => p.comercio)).size} comercios`;
  }

  // ---------- Calendario ----------
  function pintarCalendario() {
    const ag = agenda(j.eventos, hoy);

    // Destacado: lo que está pasando o lo que sigue
    const destacado = ag.activos[0] ?? ag.proximos[0];
    el("cal-destacado").innerHTML = !destacado ? "" : `
      <div class="destacado" style="--c:var(--ev${colorDe.get(destacado.id)})">
        <div class="cuenta"><b>${esc(textoFase(destacado, hoy))}</b></div>
        <div class="dest-txt">
          <span class="how">${faseDe(destacado, hoy) === "activo" ? "Ahora" : "Sigue"}</span>
          <h2>${esc(destacado.nombre)}</h2>
          <div class="how">${esc(rango(destacado))} · ${esc(resumenPromos(destacado))}</div>
        </div>
        <div class="dest-acc">
          ${tienePromos(destacado.id) ? `<a class="btn prim" href="${enlace(destacado)}">Comparar promociones</a>` : ""}
          ${faseDe(destacado, hoy) === "proximo" ? botonIcs(destacado) : ""}
        </div>
      </div>`;

    // Cuadrícula por mes
    el("cal-meses").innerHTML = mesesCalendario(j.eventos, hoy).map((m) => `
      <div class="mes">
        <h3>${esc(mayuscula(fecha(`${m.id}-15`, { month: "long", year: "numeric" })))}</h3>
        <div class="dias">${NOMBRES_DIA.map((d) => `<span class="dn">${d}</span>`).join("")}
        ${m.semanas.flat().map((d) => {
          if (!d) return `<span></span>`;
          const evs = eventosDelDia(j.eventos, d);
          const n = Number(d.slice(8));
          const titulo = evs.map((e) => e.nombre).join(" · ");
          // Cada evento en su carril, con huecos vacíos para que no brinque de fila entre días
          const filas: string[] = [];
          for (const e of evs) {
            const c = carrilDe.get(e.id)!;
            if (c > 2) continue;
            while (filas.length < c) filas.push(`<i class="vacio"></i>`);
            filas[c] = `<i style="--c:var(--ev${colorDe.get(e.id)})" class="${d === e.desde ? "ini" : ""} ${d === e.hasta ? "fin" : ""}"></i>`;
          }
          const barras = filas.map((f) => f ?? `<i class="vacio"></i>`).join("");
          const cls = `dia ${d === hoy ? "hoy" : ""} ${d < hoy ? "ya" : ""} ${evs.length ? "con" : ""}`;
          return evs.length
            ? `<a class="${cls}" href="${enlace(evs[0])}" title="${esc(titulo)}"><span>${n}</span><span class="barras">${barras}</span></a>`
            : `<span class="${cls}"><span>${n}</span></span>`;
        }).join("")}</div>
      </div>`).join("");

    // Lista por fase
    const tarjeta = (e: Evento) => `
      <div class="ev-card ${faseDe(e, hoy)}" style="--c:var(--ev${colorDe.get(e.id)})">
        <div class="ev-top"><b>${esc(e.nombre)}</b><span class="pill ${faseDe(e, hoy) === "activo" ? "ok" : ""}">${esc(textoFase(e, hoy))}</span></div>
        <div class="how">${esc(rango(e))}${e.desde.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${e.desde.slice(0, 4)}` : ""} · ${esc(resumenPromos(e))}</div>
        <div class="ev-acc">
          ${tienePromos(e.id) ? `<a class="btn ${faseDe(e, hoy) === "pasado" ? "" : "prim"}" href="${enlace(e)}">${faseDe(e, hoy) === "pasado" ? "Consultar promociones" : "Comparar promociones"}</a>` : ""}
          ${faseDe(e, hoy) === "proximo" ? botonIcs(e) : ""}
        </div>
      </div>`;
    const grupo = (titulo: string, evs: Evento[]) => (evs.length ? `<div class="card ev-grupo"><h2>${titulo}</h2>${evs.map(tarjeta).join("")}</div>` : "");
    el("cal-lista").innerHTML = grupo("Ahora", ag.activos) + grupo("Próximos", ag.proximos) + grupo("Anteriores", ag.pasados);

    conectarIcs(el("vista-calendario"));
  }

  // ---------- Evento ----------
  function pintarAviso() {
    const aviso = el("aviso");
    const fase = faseDe(ev, hoy);
    aviso.hidden = fase === "activo" || !tienePromos(ev.id);
    aviso.className = fase === "proximo" ? "info" : "";
    aviso.textContent = fase === "pasado"
      ? `${ev.nombre} terminó el ${fechaCorta(ev.hasta)}. Las promociones se muestran solo como consulta; ya no están vigentes.`
      : fase === "proximo"
        ? `${ev.nombre} empieza el ${fechaCorta(ev.desde)}. Las promociones pueden cambiar antes del evento.`
        : "";
  }

  function pintarProfeco() {
    const fase = faseDe(ev, hoy);
    const html = htmlProfeco(ev, j.profeco, fase, esc);
    el("profeco").hidden = !html;
    el("profeco").innerHTML = html;
    el("ir-profeco-caja").hidden = !html;
    el("ir-profeco").textContent = ev.profeco?.balance ? "Ve las ofertas reales y simuladas que encontró Profeco ↓" : "Antes de pagar: compara el precio con Profeco ↓";
    const comparador = comparadorDe(ev, j.profeco, fase);
    el("nota-precio").hidden = !comparador;
    if (comparador) el("nota-precio").innerHTML = `¿El precio es real? <a href="${esc(comparador)}" target="_blank" rel="noopener">Compáralo en Profeco</a> antes de pagar.`;
  }

  function pintarVacio() {
    const fase = faseDe(ev, hoy);
    const conPromos = j.eventos.filter((e) => tienePromos(e.id));
    el("evento-vacio").innerHTML = `
      <h2>${fase === "pasado" ? "No capturamos promociones de este evento" : "Las promociones todavía no se publican"}</h2>
      <p>${fase === "proximo"
        ? `${esc(ev.nombre)} ${esc(textoFase(ev, hoy).toLowerCase())} (${esc(rango(ev))}). Los bancos y las tiendas suelen publicar sus condiciones unos días antes; en cuanto salgan, las capturamos y aparecen aquí.`
        : fase === "activo"
          ? `${esc(ev.nombre)} ya empezó, pero aún no capturamos sus promociones. Vuelve en unas horas.`
          : `${esc(ev.nombre)} terminó el ${esc(fechaCorta(ev.hasta))}.`}</p>
      <div class="ev-acc">${fase === "proximo" ? botonIcs(ev) : ""}<a class="btn" href="#${VISTA_CALENDARIO}">Ver el calendario</a></div>
      ${conPromos.length ? `<p class="note mt">Mientras tanto puedes consultar: ${conPromos.map((e) => `<a href="${enlace(e)}">${esc(e.nombre)}</a>`).join(", ")}.</p>` : ""}`;
    conectarIcs(el("evento-vacio"));
  }

  function abrirEvento(id: string) {
    ev = j.eventos.find((e) => e.id === id)!;
    E = cargarEstadoEvento(alm, ev.id);
    const promos = promosDe(ev.id);
    comerciosConPromos = [...new Set(promos.map((p) => p.comercio))];
    el("titulo-evento").textContent = ev.nombre;
    el("subtitulo").textContent = `${rango(ev)} · ${resumenPromos(ev)}${promos.length ? ` · catálogo del ${fechaCorta(hoyEn(ZONA, new Date(j.generado)))}` : ""}`;
    document.title = `${ev.nombre} · Buscador de promociones`;
    el("nombre-evento").textContent = ev.nombre;
    pintarAviso();
    pintarProfeco();

    el("evento-vacio").hidden = promos.length > 0;
    el("calculadora").hidden = !promos.length;
    if (!promos.length) { pintarVacio(); return; }

    const dias = diasDe(ev);
    E.dia = diaInicial(ev, hoy, E.dia);
    dia.innerHTML = dias.map((d) => `<option value="${d}">${fecha(d, { weekday: "short", day: "numeric", month: "short" })}${d === hoy ? " (hoy)" : ""}</option>`).join("");
    dia.value = E.dia;

    const cats = categoriasDe(promos);
    el("caja-categoria").hidden = !cats.length;
    categoria.innerHTML = `<option value="">General</option>` + cats.map((c) => `<option value="${esc(c.id)}">${esc(c.etiqueta)}</option>`).join("");
    // La categoría es preferencia del usuario: si este evento no la tiene, se evalúa como General sin olvidarla
    categoriaEf = cats.some((c) => c.id === P.categoria) ? P.categoria : "";
    categoria.value = categoriaEf;

    pintarAcumulados(promos);
    actualizar();
  }

  function irA(id: string) {
    const existe = id === VISTA_CALENDARIO || j.eventos.some((e) => e.id === id);
    vista = existe ? id : vistaAlEntrar(j.eventos, tienePromos, hoy, cargarUltimaVista(alm));
    if (!borrado) guardarUltimaVista(alm, vista);
    el("vista-calendario").hidden = vista !== VISTA_CALENDARIO;
    el("vista-evento").hidden = vista === VISTA_CALENDARIO;
    if (vista === VISTA_CALENDARIO) {
      document.title = "Calendario · Buscador de promociones";
      pintarCalendario();
    } else {
      abrirEvento(vista);
    }
    pintarNav();
    // Normaliza la URL para que siempre se pueda compartir lo que está abierto
    if (idDeHash() !== vista) history.replaceState(null, "", `#${encodeURIComponent(vista)}`);
  }

  // ---------- Panel ----------
  const precio = el("precio") as HTMLInputElement, dia = el("dia") as HTMLSelectElement;
  const categoria = el("categoria") as HTMLSelectElement, rendimiento = el("rendimiento") as HTMLInputElement;
  const buscar = el("buscar-tarjeta") as HTMLInputElement;
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
  const marcarTodas = (v: boolean) => { for (const k in P.tengo) P.tengo[k] = v; P.carteraElegida = true; pintarCartera(); actualizar(); };
  // Con botón y no con #profeco: el hash de la URL elige el evento
  el("ir-profeco").onclick = () => el("profeco").scrollIntoView({ behavior: "smooth", block: "start" });
  el("todo").onclick = () => marcarTodas(true);
  el("nada").onclick = () => marcarTodas(false);
  buscar.oninput = () => filtrarCartera();

  function atributoHtml(a: Atributo) {
    const v = P.atributos[a.id];
    if (a.tipo === "booleano") return `<label class="chk attr"><input type="checkbox" data-a="${a.id}" ${v ? "checked" : ""}>${esc(a.etiqueta)}</label>`;
    if (a.tipo === "opcion") return `<div class="attr">${esc(a.etiqueta)}: <select data-a="${a.id}">${(a.opciones ?? []).map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(v) ? "selected" : ""}>${esc(o.etiqueta)}</option>`).join("")}</select></div>`;
    return `<div class="attr">${esc(a.etiqueta)}: <input type="number" data-a="${a.id}" value="${esc(v)}" style="width:90px"></div>`;
  }

  const cuentaEmisor = (e: Emisor) => e.productos.filter((p) => P.tengo[p.id]).length;
  function pintarCuentas() {
    const total = Object.keys(P.tengo).length, mias = Object.values(P.tengo).filter(Boolean).length;
    el("cuenta-cartera").textContent = `${mias} de ${total} seleccionadas`;
    for (const e of cat.emisores) {
      const n = el("cartera").querySelector(`[data-cuenta="${e.id}"]`);
      if (n) { const c = cuentaEmisor(e); n.textContent = c ? `${c} de ${e.productos.length}` : ""; }
    }
  }

  function pintarCartera() {
    const box = el("cartera");
    // Se ordena solo al pintar (al cargar o con Marcar/Quitar todo), nunca al marcar una casilla, para que nada brinque bajo el cursor
    box.innerHTML = ordenarEmisores(cat.emisores, P.tengo, P.carteraElegida).map((e) => `
      <details class="group" data-emisor="${e.id}" data-buscar="${esc(sinAcentos([e.nombre, ...e.productos.map((p) => p.nombre)].join(" ")))}">
        <summary class="gtitle"><span>${esc(e.nombre)}</span><span class="how" data-cuenta="${e.id}"></span></summary>
        ${e.productos.map((p) => `<label class="chk" data-buscar="${esc(sinAcentos(e.nombre + " " + p.nombre))}"><input type="checkbox" data-p="${p.id}" ${P.tengo[p.id] ? "checked" : ""}>
          <span style="flex:1">${esc(p.nombre)}</span>
          ${p.msi ? `<input class="msi" type="number" min="0" max="48" data-msi="${p.id}" value="${P.msi[p.id] ?? 0}" title="MSI máximos" aria-label="MSI máximos con ${esc(p.nombre)}"><span class="how">MSI</span>` : ""}</label>`).join("")}
        ${(e.atributos ?? []).map(atributoHtml).join("")}
      </details>`).join("");
    box.querySelectorAll<HTMLInputElement>("[data-p]").forEach((i) => (i.onchange = () => { P.tengo[i.dataset.p!] = i.checked; P.carteraElegida = true; pintarCuentas(); actualizar(); }));
    box.querySelectorAll<HTMLInputElement>("[data-msi]").forEach((i) => (i.oninput = () => { P.msi[i.dataset.msi!] = Number(i.value) || 0; actualizar(); }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-a]").forEach((i) => (i.onchange = i.oninput = () => {
      const a = cat.atributos.get(i.dataset.a!)!;
      P.atributos[a.id] = a.tipo === "booleano" ? (i as HTMLInputElement).checked : a.tipo === "numero" ? Number(i.value) || 0
        : (a.opciones?.find((o) => String(o.valor) === i.value)?.valor ?? i.value);
      actualizar();
    }));
    pintarCuentas();
    filtrarCartera();
  }

  /** Con texto: abre los emisores que coinciden y oculta lo demás. Sin texto: todo visible y plegado. */
  function filtrarCartera() {
    const q = sinAcentos(buscar.value.trim());
    el("cartera").querySelectorAll<HTMLDetailsElement>("details.group").forEach((d) => {
      const coincide = !q || d.dataset.buscar!.includes(q);
      d.hidden = !coincide;
      d.open = !!q && coincide;
      d.querySelectorAll<HTMLElement>("label.chk[data-buscar]").forEach((l) => {
        l.hidden = !!q && !l.dataset.buscar!.includes(q) && !sinAcentos(d.querySelector("summary")!.textContent ?? "").includes(q);
      });
    });
  }

  function pintarAvisoCartera() {
    const caja = el("aviso-cartera");
    const ninguna = !Object.values(P.tengo).some(Boolean);
    caja.hidden = P.carteraElegida && !ninguna;
    caja.innerHTML = ninguna
      ? `<b>No tienes tarjetas seleccionadas.</b> Elige las tuyas en «Tu cartera» para ver qué te conviene. <button class="sec" data-ir-cartera>Elegir mis tarjetas</button>`
      : `<b>Estás comparando con todas las tarjetas del catálogo.</b> Elige las que tienes para ver tu mejor opción real. <button class="sec" data-ir-cartera>Elegir mis tarjetas</button>`;
    caja.querySelector<HTMLButtonElement>("[data-ir-cartera]")!.onclick = () => {
      el("panel-cartera").scrollIntoView({ behavior: "smooth", block: "start" });
      buscar.focus({ preventScroll: true });
    };
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
    if (vista === VISTA_CALENDARIO || !comerciosConPromos.length) return;
    pintarAvisoCartera();
    const filas = comerciosConPromos.map((c) => {
      const r = evaluarComercio(c);
      return { c, r, mejor: ordenar(filtrar(r.opciones), P.criterio)[0] as Opcion | undefined };
    }).sort((a, b) => (b.mejor?.[P.criterio] ?? -1) - (a.mejor?.[P.criterio] ?? -1));
    if (!E.comercio || !comerciosConPromos.includes(E.comercio)) E.comercio = filas[0]?.c ?? null;

    const total = P.criterio === "total";
    el("comparacion").innerHTML =
      `<thead><tr><th>Comercio</th><th>Mejor forma de pagar</th><th class="num">Ahorro</th>${total ? '<th class="num">Valor MSI</th><th class="num">Total</th>' : ""}<th class="num">Costo real</th><th class="num">Meses</th><th>Certeza</th></tr></thead><tbody>` +
      filas.map(({ c, mejor: o }) => `<tr class="click ${c === E.comercio ? "sel" : ""}" data-c="${c}" tabindex="0">
        <td class="ent" data-l="Comercio">${esc(cat.comercios.get(c)?.nombre ?? c)}</td>
        ${o ? `<td data-l="Paga con"><div>${esc(nombreInst(o.instrumento))}</div><div class="how">${esc(o.promos.map((p) => p.nombre).join(" + "))}</div></td>
        <td class="num save" data-l="Ahorro">${$(o.ahorro)}</td>
        ${total ? `<td class="num" data-l="Valor MSI">${$(o.valor_msi)}</td><td class="num" data-l="Total"><b>${$(o.total)}</b></td>` : ""}
        <td class="num" data-l="Costo real">${$(o.costo_real)}</td><td class="num" data-l="Meses">${o.meses_financiamiento || "Contado"}</td><td data-l="Certeza">${pillCerteza(o.certeza)}</td>`
        : `<td colspan="${total ? 7 : 5}" class="how" data-l="">Ninguna promoción aplica con tu cartera</td>`}
      </tr>`).join("") + "</tbody>";
    el("comparacion").querySelectorAll<HTMLTableRowElement>("tr[data-c]").forEach((tr) => {
      const abrir = () => { E.comercio = tr.dataset.c!; actualizar(); el("detalle").scrollIntoView({ behavior: "smooth", block: "start" }); };
      tr.onclick = abrir;
      tr.onkeydown = (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); abrir(); } };
    });

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
      <div class="scroll"><table class="apilable"><thead><tr><th>#</th><th>Tarjeta y promociones</th><th class="num">Ahorro</th><th class="num">Valor MSI</th><th class="num">Costo real</th><th class="num">Meses</th><th>Certeza</th></tr></thead><tbody>
      ${ops.map((o, i) => `<tr><td class="how" data-l="#">${i + 1}</td><td data-l="Tarjeta"><div class="ent">${esc(nombreInst(o.instrumento))}</div><div class="how">${esc(o.promos.map((p) => p.nombre).join(" + "))}</div>
        ${o.avisos.slice(0, 3).map((a) => `<span class="pill">${esc(a)}</span>`).join("")}</td>
        <td class="num save" data-l="Ahorro">${$(o.ahorro)}</td><td class="num" data-l="Valor MSI">${$(o.valor_msi)}</td><td class="num" data-l="Costo real">${$(o.costo_real)}</td>
        <td class="num" data-l="Meses">${o.meses_financiamiento || "Contado"}</td><td data-l="Certeza">${pillCerteza(o.certeza)}</td></tr>`).join("")}
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

  // ---------- Borrar lo guardado (con confirmación en la página, sin diálogos del navegador) ----------
  function pintarBorrar() {
    const caja = el("borrar-caja");
    caja.innerHTML = `<button class="enlace" id="borrar">Borrar lo guardado</button>`;
    el("borrar").onclick = () => {
      caja.innerHTML = `¿Borrar tus tarjetas, preferencias y compras de este navegador? <button class="enlace peligro" id="borrar-si">Sí, borrar</button> <button class="enlace" id="borrar-no">Cancelar</button>`;
      el("borrar-no").onclick = pintarBorrar;
      el("borrar-si").onclick = () => {
        if (!borrarDatos(alm)) { caja.textContent = "No se pudo borrar: tu navegador bloqueó el acceso al almacenamiento."; return; }
        reiniciar();
        caja.textContent = "Listo: se borró lo guardado en este navegador.";
      };
      el("borrar-si").focus();
    };
  }
  pintarBorrar();

  /** Tras borrar: vuelve a los valores por defecto sin recargar (dentro de un artefacto recargar puede navegar mal). */
  function reiniciar() {
    // Sin escribir nada hasta que el usuario vuelva a cambiar algo
    borrado = true;
    Object.assign(P, perfilPorDefecto(cat));
    precio.value = String(P.precio); rendimiento.value = String(P.rendimiento); buscar.value = "";
    (el("garantizado") as HTMLInputElement).checked = P.soloGarantizado;
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset.c === P.criterio));
    pintarCartera();
    irA(vistaAlEntrar(j.eventos, tienePromos, hoy, null));
    // El primer cambio del usuario vuelve a habilitar el guardado
    const reanudar = () => { borrado = false; document.removeEventListener("input", reanudar, true); document.removeEventListener("change", reanudar, true); document.removeEventListener("click", reanudarClic, true); };
    const reanudarClic = (e: Event) => { if ((e.target as HTMLElement).closest("button, a")) reanudar(); };
    setTimeout(() => {
      document.addEventListener("input", reanudar, true);
      document.addEventListener("change", reanudar, true);
      document.addEventListener("click", reanudarClic, true);
    });
  }

  const idDeHash = () => decodeURIComponent(location.hash.slice(1));
  window.addEventListener("hashchange", () => { if (idDeHash() !== vista) { irA(idDeHash()); window.scrollTo(0, 0); } });

  pintarCartera();
  irA(idDeHash());
}

main().catch((e) => { el("vista-evento").hidden = false; el("subtitulo").textContent = `Error al cargar: ${e}`; });
