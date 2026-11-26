#!/usr/bin/env python3
"""Pide a Internet Archive (Wayback Machine) una captura de cada fuente, como evidencia independiente.

Uso: python3 scripts/archivar.py snapshots/buen-fin-2026 [--dia 20261117] [--pausa 15] [--solo id1,id2] [--pantalla]

Lee las URLs con http 200 de <carpeta>/manifest.jsonl. Para cada una, si Wayback ya tiene una captura de ese día
la reutiliza; si no, la pide a Save Page Now.

Con llaves de archive.org (variables IA_ACCESS e IA_SECRET, o el archivo ~/.config/tocaltepetl/ia.env, o el que
diga IA_ENV) usa la API autenticada (SPN2): pide la captura, recibe un job_id y consulta su estado hasta saber la
fecha exacta de la captura. Sin llaves, usa Save Page Now anónimo y lee la redirección (menos confiable). Escribe una línea por URL en <carpeta>/archivo-ia.jsonl
(id, url, archivo_ia o error, fecha). Las URLs que ya tienen una línea con archivo_ia se saltan, así que
se puede volver a correr para reintentar las que fallaron.
"""
import argparse, datetime as dt, json, os, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

UA = "ofertas-reales-archivar/0.2 (+evidencia de promociones; proyecto abierto)"


def llaves() -> tuple[str, str] | None:
    """Llaves S3 de archive.org: primero las variables de entorno, luego el archivo .env (fuera del repo)."""
    acc, sec = os.environ.get("IA_ACCESS"), os.environ.get("IA_SECRET")
    if not (acc and sec):
        archivo = Path(os.environ.get("IA_ENV", "~/.config/tocaltepetl/ia.env")).expanduser()
        if archivo.exists():
            vals = dict(l.split("=", 1) for l in archivo.read_text().splitlines() if "=" in l)
            acc, sec = acc or vals.get("IA_ACCESS", "").strip(), sec or vals.get("IA_SECRET", "").strip()
    return (acc, sec) if acc and sec else None


class SinTerminar(RuntimeError):
    """El trabajo de SPN2 sigue en cola; se guarda el job_id para consultarlo en la siguiente corrida."""
    def __init__(self, job: str, espera: int):
        super().__init__(f"SPN2 sin terminar después de {espera} s")
        self.job = job


def guardar_spn2(url: str, cred: tuple[str, str], pantalla: bool = False, espera: int = 900, job: str | None = None) -> str:
    """Save Page Now autenticado: pide la captura (o retoma `job`) y consulta el estado del trabajo hasta que
    termine. Devuelve el enlace a la captura con su fecha exacta; si falla, lanza el error que da Wayback."""
    cab = {"User-Agent": UA, "Accept": "application/json", "Authorization": f"LOW {cred[0]}:{cred[1]}"}
    if not job:
        datos = {"url": url, "skip_first_archive": "1"}
        if pantalla:
            datos["capture_screenshot"] = "1"
        req = urllib.request.Request("https://web.archive.org/save", data=urllib.parse.urlencode(datos).encode(), headers=cab)
        with urllib.request.urlopen(req, timeout=120) as r:
            resp = json.loads(r.read())
        job = resp.get("job_id")
        if not job:
            raise RuntimeError(f"SPN2 no dio job_id: {resp.get('message') or resp}")
    limite = time.time() + espera
    while time.time() < limite:
        time.sleep(6)
        req = urllib.request.Request(f"https://web.archive.org/save/status/{job}", headers=cab)
        with urllib.request.urlopen(req, timeout=60) as r:
            st = json.loads(r.read())
        if st.get("status") == "success":
            return f"https://web.archive.org/web/{st['timestamp']}/{st.get('original_url') or url}"
        if st.get("status") == "error":
            raise RuntimeError(f"SPN2 {st.get('status_ext', 'error')}: {st.get('message', '')}")
    raise SinTerminar(job, espera)


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
    ap.add_argument("--pantalla", action="store_true", help="con llaves: guarda también una captura de pantalla")
    ap.add_argument("--espera", type=int, default=900, help="con llaves: segundos máximos de espera por captura")
    a = ap.parse_args()
    cred = llaves()
    carpeta = Path(a.carpeta)
    salida = carpeta / "archivo-ia.jsonl"
    hechas = set()
    en_cola: dict[str, str] = {}  # url → job_id de SPN2 que quedó sin terminar
    if salida.exists():
        for l in salida.read_text().splitlines():
            r = json.loads(l)
            if r.get("archivo_ia"):
                hechas.add(r["url"])
            elif r.get("job_spn2"):
                en_cola[r["url"]] = r["job_spn2"]
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
    print(f"{len(urls)} URLs, {len(hechas)} ya archivadas, {len(pendientes)} por archivar"
          f" ({'API autenticada' if cred else 'Save Page Now anónimo'})")
    for n, (i, u) in enumerate(pendientes, 1):
        reg = {"id": i, "url": u}
        try:
            prev = None if (cred and u in en_cola) else captura_existente(u, a.dia)
            if prev:
                reg.update(archivo_ia=prev, metodo="existente")
            else:
                for intento in range(3):
                    try:
                        if cred:
                            reg.update(archivo_ia=guardar_spn2(u, cred, a.pantalla, a.espera, en_cola.get(u)), metodo="spn2")
                        else:
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
                    # el sello de Wayback está en UTC; se compara con el día local (--dia)
                    sello = reg["archivo_ia"].split("/web/", 1)[1][:14]
                    ts = (dt.datetime.strptime(sello, "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
                          .astimezone().strftime("%Y%m%d")) if len(sello) == 14 and sello.isdigit() else sello[:8]
                    reg["dia_captura"] = ts
                    if ts != a.dia:
                        reg["aviso"] = f"captura del {ts}, no del {a.dia}"
        except SinTerminar as e:
            reg.update(error=str(e), job_spn2=e.job)
        except Exception as e:
            reg["error"] = f"{type(e).__name__}: {e}"[:300]
        reg["fecha"] = dt.datetime.now().astimezone().isoformat(timespec="seconds")
        with salida.open("a") as f:
            f.write(json.dumps(reg, ensure_ascii=False) + "\n")
        print(f"[{n}/{len(pendientes)}] {i:32} {reg.get('archivo_ia') or reg.get('error')}", flush=True)


if __name__ == "__main__":
    main()
