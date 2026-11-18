#!/usr/bin/env python3
"""Pide a Internet Archive (Wayback Machine) una captura de cada fuente, como evidencia independiente.

Uso: python3 scripts/archivar.py snapshots/buen-fin-2026 [--dia 20261117] [--pausa 15] [--solo id1,id2]

Lee las URLs con http 200 de <carpeta>/manifest.jsonl. Para cada una, si Wayback ya tiene una captura de ese día
la reutiliza; si no, la pide a Save Page Now. Escribe una línea por URL en <carpeta>/archivo-ia.jsonl
(id, url, archivo_ia o error, fecha). Las URLs que ya tienen una línea con archivo_ia se saltan, así que
se puede volver a correr para reintentar las que fallaron.
"""
import argparse, datetime as dt, json, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

UA = "buscador-promos-archivar/0.1 (+evidencia de promociones; proyecto abierto)"


def pedir(url: str, timeout: int = 120):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.geturl(), dict(r.headers), r.read()


def captura_existente(url: str, dia: str) -> str | None:
    q = "https://archive.org/wayback/available?" + urllib.parse.urlencode({"url": url, "timestamp": dia})
    try:
        _, _, _, cuerpo = pedir(q, timeout=60)
        snap = json.loads(cuerpo).get("archived_snapshots", {}).get("closest")
        if snap and snap.get("available") and snap["timestamp"].startswith(dia):
            return snap["url"]
    except Exception:
        pass
    return None


class _SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def guardar(url: str) -> str:
    """Pide la captura y lee el enlace de la primera redirección, sin seguirla: si Wayback aún procesa la captura
    nueva, seguir la redirección lleva a la captura más cercana, que puede ser de otro año."""
    abridor = urllib.request.build_opener(_SinRedireccion)
    req = urllib.request.Request("https://web.archive.org/save/" + url, headers={"User-Agent": UA})
    try:
        with abridor.open(req, timeout=180) as r:
            estado, cab = r.status, dict(r.headers)
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 303, 307):
            raise
        estado, cab = e.code, dict(e.headers)
    loc = cab.get("Location") or cab.get("location") or cab.get("Content-Location") or cab.get("content-location")
    if loc and "/web/" in loc:
        return loc if loc.startswith("http") else "https://web.archive.org" + loc
    raise RuntimeError(f"respuesta sin captura (http {estado})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--dia", default=dt.date.today().strftime("%Y%m%d"))
    ap.add_argument("--pausa", type=float, default=15)
    ap.add_argument("--solo")
    a = ap.parse_args()
    carpeta = Path(a.carpeta)
    salida = carpeta / "archivo-ia.jsonl"
    hechas = set()
    if salida.exists():
        for l in salida.read_text().splitlines():
            r = json.loads(l)
            if r.get("archivo_ia"):
                hechas.add(r["url"])
    urls: dict[str, str] = {}
    for l in (carpeta / "manifest.jsonl").read_text().splitlines():
        r = json.loads(l)
        if r.get("http") != 200 or r["url"] in urls:
            continue
        # un slug equivocado que redirige a la portada no es la fuente: no se archiva
        pedida, final = urllib.parse.urlparse(r["url"]), urllib.parse.urlparse(r.get("url_final") or r["url"])
        if final.path in ("", "/") and pedida.path not in ("", "/"):
            continue
        urls[r["url"]] = r["id"]
    solo = set(a.solo.split(",")) if a.solo else None
    pendientes = [(i, u) for u, i in urls.items() if u not in hechas and (not solo or i in solo)]
    print(f"{len(urls)} URLs, {len(hechas)} ya archivadas, {len(pendientes)} por archivar")
    for n, (i, u) in enumerate(pendientes, 1):
        reg = {"id": i, "url": u}
        try:
            prev = captura_existente(u, a.dia)
            if prev:
                reg.update(archivo_ia=prev, metodo="existente")
            else:
                for intento in range(3):
                    try:
                        reg.update(archivo_ia=guardar(u), metodo="save-page-now")
                        break
                    except urllib.error.HTTPError as e:
                        if e.code == 429 and intento < 2:
                            time.sleep(60 * (intento + 1))
                            continue
                        raise
                time.sleep(a.pausa)
            if reg.get("archivo_ia"):
                # Wayback sigue redirecciones: aceptar otra página del sitio, pero no la portada
                archivada = urllib.parse.urlparse(reg["archivo_ia"].split("/", 5)[-1]).path
                if archivada in ("", "/") and urllib.parse.urlparse(u).path not in ("", "/"):
                    reg["error"] = f"Wayback devolvió la portada: {reg.pop('archivo_ia')}"
                else:
                    # Save Page Now puede devolver una captura reciente de otro día en vez de hacer una nueva
                    ts = reg["archivo_ia"].split("/web/", 1)[1][:8]
                    reg["dia_captura"] = ts
                    if ts != a.dia:
                        reg["aviso"] = f"captura del {ts}, no del {a.dia}"
        except Exception as e:
            reg["error"] = f"{type(e).__name__}: {e}"[:300]
        reg["fecha"] = dt.datetime.now().astimezone().isoformat(timespec="seconds")
        with salida.open("a") as f:
            f.write(json.dumps(reg, ensure_ascii=False) + "\n")
        print(f"[{n}/{len(pendientes)}] {i:32} {reg.get('archivo_ia') or reg.get('error')}", flush=True)


if __name__ == "__main__":
    main()
