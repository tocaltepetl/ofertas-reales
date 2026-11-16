#!/usr/bin/env python3
"""Genera snapshots/index.html para revisar las capturas en el navegador.

Uso: python3 scripts/indice.py && python3 -m http.server -d snapshots 8000
"""
import html, json
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SNAP = RAIZ / "snapshots"
GRUPOS = {"ml": "Mercado Libre por banco", "banco": "Bancos", "comercio": "Comercios", "pista": "Pistas (no son fuente oficial)", "_directorio": "Directorio oficial"}


def rel(p: str) -> str:
    return str((RAIZ / p).relative_to(SNAP))


def main() -> None:
    filas = defaultdict(list)
    for ev in sorted(d for d in SNAP.iterdir() if d.is_dir()):
        man = ev / "manifest.jsonl"
        if not man.exists():
            continue
        ultimo = {}
        for linea in man.read_text(encoding="utf-8").splitlines():
            r = json.loads(linea)
            ultimo.setdefault(r["id"], []).append(r)
        for id_, regs in ultimo.items():
            filas[(ev.name, id_.split("-")[0] if not id_.startswith("_") else id_)].append((id_, regs))

    partes = []
    for (evento, grupo), items in sorted(filas.items(), key=lambda x: (x[0][0], list(GRUPOS).index(x[0][1]) if x[0][1] in GRUPOS else 99)):
        partes.append(f"<h2>{html.escape(GRUPOS.get(grupo, grupo))} <small>{html.escape(evento)}</small></h2><table>"
                      "<tr><th>Fuente</th><th>Estado</th><th>Texto</th><th>Archivos</th><th>Capturado</th></tr>")
        for id_, regs in sorted(items):
            for r in regs[-3:]:  # últimas capturas
                ok = r.get("http") == 200 and r.get("chars_texto", 0) > 500 or "consultas" in r
                redirige = r.get("url_final") and r["url_final"].rstrip("/") != r.get("url", "").rstrip("/")
                estado = ("revisar (redirige)" if redirige else "ok") if ok else ("error" if "error" in r else f"revisar ({r.get('http')})")
                links = []
                if r.get("archivo"):
                    a = rel(r["archivo"])
                    stem = a.rsplit(".", 1)[0]
                    links.append(f'<a href="{a}">original</a>')
                    if (SNAP / f"{stem}.txt").exists() and not a.endswith(".txt"):
                        links.append(f'<a href="{stem}.txt">texto</a>')
                    if r.get("render"):
                        links.append(f'<a href="{rel(r["render"]["archivo"])}">render</a>')
                    for extra in sorted((SNAP / a).parent.glob(Path(stem).name + ".*.txt")):
                        links.append(f'<a href="{extra.relative_to(SNAP)}">{extra.name.split(".")[1]}</a>')
                url = r.get("url", "")
                nombre = f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{html.escape(id_)}</a>' if url else html.escape(id_)
                partes.append(f'<tr class="{estado.split()[0]}"><td>{nombre}<div class="m">{html.escape(r.get("metodo", "script"))}</div></td>'
                              f'<td>{html.escape(estado)}{(" — " + html.escape(r["error"])) if "error" in r else ""}</td>'
                              f'<td class="n">{r.get("chars_texto", r.get("con_resultados", 0)):,}</td>'
                              f'<td>{" · ".join(links)}</td><td class="m">{html.escape(r.get("capturado", ""))}</td></tr>')
        partes.append("</table>")

    (SNAP / "index.html").write_text(f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Capturas de promociones</title>
<style>
:root{{--bg:#f6f5f1;--card:#fff;--ink:#1d1d1f;--muted:#6b6b70;--line:#e4e2dc;--ok:#1f7a4d;--warn:#9a5b00;--bad:#a33;--accent:#2d5bd7}}
@media (prefers-color-scheme:dark){{:root{{--bg:#141416;--card:#1e1e21;--ink:#ececee;--muted:#9a9aa1;--line:#33333a;--ok:#5cc995;--warn:#e2a64a;--bad:#ff8080;--accent:#7ea0ff}}}}
body{{margin:0;padding:24px 16px;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink)}}
main{{max-width:1100px;margin:0 auto}} h1{{margin:0 0 4px}} h2{{margin:28px 0 8px;font-size:17px}} small{{color:var(--muted);font-weight:400}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}}
th,td{{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}} th{{font-size:11px;text-transform:uppercase;color:var(--muted)}}
td.n{{text-align:right;font-variant-numeric:tabular-nums}} .m{{color:var(--muted);font-size:12px}} a{{color:var(--accent)}}
tr.ok td:nth-child(2){{color:var(--ok)}} tr.revisar td:nth-child(2){{color:var(--warn)}} tr.error td:nth-child(2){{color:var(--bad)}}
@media (max-width:700px){{td:nth-child(5),th:nth-child(5){{display:none}}}}
</style></head><body><main><h1>Capturas de promociones</h1>
<p class="m">Generado desde manifest.jsonl. "Texto" = caracteres extraídos; menos de 500 suele indicar bloqueo o página vacía.</p>
{''.join(partes)}</main></body></html>""", encoding="utf-8")
    print(SNAP / "index.html")


if __name__ == "__main__":
    main()
