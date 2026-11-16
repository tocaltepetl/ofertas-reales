#!/usr/bin/env python3
"""Captura fuentes de un evento: guarda el original, una versión en texto y un manifiesto.

Uso: python3 scripts/captura.py fuentes/buen-fin-2026.json [--solo id1,id2] [--sin-directorio]

Salida en snapshots/<evento>/<id>/<AAAAMMDD-HHMMSS>.{html,pdf} (+ .txt, + .render.html)
y una línea por captura en snapshots/<evento>/manifest.jsonl.
"""
import argparse, datetime as dt, hashlib, html, json, re, shutil, subprocess, sys, time
import urllib.parse, urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36"
RAIZ = Path(__file__).resolve().parent.parent
PAUSA = 1.5  # segundos entre peticiones
_ultimo_por_host: dict[str, float] = {}


def esperar_turno(url: str) -> None:
    host = urllib.parse.urlparse(url).netloc
    falta = PAUSA - (time.time() - _ultimo_por_host.get(host, 0))
    if falta > 0:
        time.sleep(falta)
    _ultimo_por_host[host] = time.time()


def descargar(url: str) -> tuple[int, str, bytes, str]:
    esperar_turno(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read(), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read() or b"", url


def html_a_texto(b: bytes) -> str:
    s = b.decode("utf-8", errors="replace")
    s = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|section)>", "\n", s)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    lineas = (re.sub(r"[ \t\xa0]+", " ", l).strip() for l in s.splitlines())
    return "\n".join(l for l in lineas if l)


def renderizar(url: str) -> bytes | None:
    exe = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not exe:
        return None
    esperar_turno(url)
    try:
        r = subprocess.run([exe, "--headless=new", "--disable-gpu", f"--user-agent={UA}",
                            "--virtual-time-budget=15000", "--dump-dom", url],
                           capture_output=True, timeout=90)
        return r.stdout or None
    except subprocess.TimeoutExpired:
        return None


def capturar_fuente(f: dict, carpeta: Path, sello: str) -> dict:
    estado, ctype, cuerpo, final = descargar(f["url"])
    es_pdf = "pdf" in ctype.lower() or cuerpo[:5] == b"%PDF-"
    destino = carpeta / f["id"]
    destino.mkdir(parents=True, exist_ok=True)
    base = destino / sello
    original = base.with_suffix(".pdf" if es_pdf else ".html")
    original.write_bytes(cuerpo)
    if es_pdf:
        txt = subprocess.run(["pdftotext", "-layout", str(original), "-"], capture_output=True).stdout.decode("utf-8", "replace")
    else:
        txt = html_a_texto(cuerpo)
    reg = {"id": f["id"], "url": f["url"], "url_final": final, "http": estado, "tipo_contenido": ctype,
           "bytes": len(cuerpo), "sha256": hashlib.sha256(cuerpo).hexdigest(), "archivo": str(original.relative_to(RAIZ)),
           "chars_texto": len(txt)}
    if f.get("render") and not es_pdf:
        dom = renderizar(f["url"])
        if dom:
            p = base.with_suffix(".render.html"); p.write_bytes(dom)
            t2 = html_a_texto(dom)
            reg["render"] = {"archivo": str(p.relative_to(RAIZ)), "bytes": len(dom), "chars_texto": len(t2)}
            if len(t2) > len(txt):
                txt = t2  # el render trae más contenido
    base.with_suffix(".txt").write_text(txt, encoding="utf-8")
    return reg


def capturar_directorio(cfg: dict, carpeta: Path, sello: str) -> dict:
    resultados = {}
    for q in cfg["consultas"]:
        url = cfg["api"].format(q=urllib.parse.quote(q), p=1)
        estado, _, cuerpo, _ = descargar(url)
        try:
            datos = json.loads(cuerpo).get("data") or {}
            elementos = datos.get("elementos", []) if isinstance(datos, dict) else []
        except json.JSONDecodeError:
            elementos = []
        for e in elementos:
            e.pop("logo", None)  # base64 pesado, no hace falta
        resultados[q] = {"http": estado, "total": len(elementos), "elementos": elementos}
    p = carpeta / "_directorio" / f"{sello}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(resultados, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": "_directorio", "archivo": str(p.relative_to(RAIZ)),
            "consultas": len(resultados), "con_resultados": sum(1 for v in resultados.values() if v["total"])}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("fuentes")
    ap.add_argument("--solo", help="ids separados por coma")
    ap.add_argument("--sin-directorio", action="store_true")
    a = ap.parse_args()
    cfg = json.loads(Path(a.fuentes).read_text(encoding="utf-8"))
    carpeta = RAIZ / "snapshots" / cfg["evento"]
    carpeta.mkdir(parents=True, exist_ok=True)
    sello = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    capturado = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    solo = set(a.solo.split(",")) if a.solo else None
    manifiesto = carpeta / "manifest.jsonl"
    with manifiesto.open("a", encoding="utf-8") as m:
        for f in cfg["fuentes"]:
            if solo and f["id"] not in solo:
                continue
            try:
                reg = capturar_fuente(f, carpeta, sello)
            except Exception as e:  # una fuente caída no detiene las demás
                reg = {"id": f["id"], "url": f["url"], "error": repr(e)}
            reg["capturado"] = capturado
            m.write(json.dumps(reg, ensure_ascii=False) + "\n"); m.flush()
            r = reg.get("render", {}).get("chars_texto")
            print(f"{reg['id']:28} http={reg.get('http', 'ERR')} bytes={reg.get('bytes', 0):>8} texto={reg.get('chars_texto', 0):>6}"
                  + (f" render={r}" if r is not None else "") + (f"  {reg['error']}" if "error" in reg else ""), flush=True)
        if not a.sin_directorio and not solo and "directorio" in cfg:
            reg = capturar_directorio(cfg["directorio"], carpeta, sello)
            reg["capturado"] = capturado
            m.write(json.dumps(reg, ensure_ascii=False) + "\n")
            print(f"_directorio: {reg['con_resultados']}/{reg['consultas']} consultas con resultados")


if __name__ == "__main__":
    sys.exit(main())
