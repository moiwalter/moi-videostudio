#!/Library/Frameworks/Python.framework/Versions/3.13/bin/python3
"""capturar-tweet.py — un post de X como asset de escena: el EMBED OFICIAL, con recibo y la frase ubicada.

    tools/capturar-tweet.py <url|id> --frase "their skills are now useless" --out <dir> [--tema light|dark] [--escala 3]

Sale en <out>/tweet-<id>/:
    tweet.png     el embed oficial tal cual lo pinta X (evidencia, sin retocar)
    meta.json     recibo: url, autor, texto verbatim, fecha, likes/reposts, fecha de captura,
                  y las cajas EXACTAS de la frase (px de tweet.png) para el resaltador,
                  más las cajas del avatar, del nombre/handle y de la fecha (las «pruebas»).

⛔ CAPTURA, NO RECONSTRUCCIÓN (como capturar-noticia.py): nunca se retipea un tweet en HTML propio.
   Lo nuestro es sólo el marco y el resaltador, que la escena pone ENCIMA usando las cajas.
⛔ La frase se busca en el texto real; si no aparece verbatim, el script falla. Así no se resalta algo que el autor no escribió.
"""
import argparse, json, re, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright


def datos(tid):
    url = f"https://cdn.syndication.twimg.com/tweet-result?id={tid}&token=a"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})) as r:
        return json.load(r)


JS_CAJAS = r"""
(frase) => {
  const article = document.querySelector('article') || document.body;
  const caja = el => { if(!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  // texto del tweet: el nodo con lang (X lo marca así)
  const cuerpo = article.querySelector('[lang]') || article;
  const walker = document.createTreeWalker(cuerpo, NodeFilter.SHOW_TEXT);
  const nodos = []; let full = '';
  while (walker.nextNode()) { nodos.push([walker.currentNode, full.length]); full += walker.currentNode.textContent; }
  const i = full.toLowerCase().indexOf(frase.toLowerCase());
  if (i < 0) return {error: 'frase no encontrada', texto: full};
  const at = pos => { for (let k = nodos.length - 1; k >= 0; k--) if (nodos[k][1] <= pos) return [nodos[k][0], pos - nodos[k][1]]; };
  const range = document.createRange();
  const [n0, o0] = at(i), [n1, o1] = at(i + frase.length - 1);
  range.setStart(n0, o0); range.setEnd(n1, o1 + 1);
  // una caja por renglón (une los rects del mismo renglón)
  const lineas = [];
  for (const r of range.getClientRects()) {
    if (r.width < 1) continue;
    const l = lineas.find(l => Math.abs(l[1] - r.y) < r.height / 2);
    if (l) { const x2 = Math.max(l[0] + l[2], r.x + r.width); l[0] = Math.min(l[0], r.x); l[2] = x2 - l[0]; }
    else lineas.push([r.x, r.y, r.width, r.height]);
  }
  const palabras = [];  // cajas por palabra, para que el resaltador avance al ritmo de la voz
  const re = /\S+/g; let m; const sub = full.slice(i, i + frase.length);
  while ((m = re.exec(sub))) {
    const a = at(i + m.index), b = at(i + m.index + m[0].length - 1);
    const rr = document.createRange(); rr.setStart(a[0], a[1]); rr.setEnd(b[0], b[1] + 1);
    const r = rr.getBoundingClientRect(); palabras.push({t: m[0], box: [r.x, r.y, r.width, r.height]});
  }
  const avatar = article.querySelector('img[src*="profile_images"]');
  const time = article.querySelector('time');
  const handle = [...article.querySelectorAll('a,span')].find(e => /^@\w+$/.test(e.textContent.trim()));
  const likes = [...article.querySelectorAll('span')].find(e => /^[\d.,]+[KM]?$/.test(e.textContent.trim()) && !e.querySelector('span'));
  return {box: caja(article), lineas, palabras, avatar: caja(avatar), fecha: caja(time), handle: caja(handle), likes: caja(likes)};
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tweet"); ap.add_argument("--frase", required=True)
    ap.add_argument("--out", required=True); ap.add_argument("--tema", default="light")
    ap.add_argument("--escala", type=float, default=3)
    a = ap.parse_args()
    tid = re.search(r"(\d{10,})", a.tweet).group(1)
    d = datos(tid)
    if a.frase.lower() not in d["text"].lower():
        sys.exit(f"⛔ la frase no está verbatim en el tweet:\n{d['text']}")
    out = Path(a.out) / f"tweet-{tid}"; out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 550, "height": 1400}, device_scale_factor=a.escala)
        pg.goto(f"https://platform.twitter.com/embed/Tweet.html?id={tid}&theme={a.tema}&dnt=true&hideThread=true", wait_until="networkidle")
        pg.wait_for_selector("article", timeout=20000); pg.wait_for_timeout(1500)
        c = pg.evaluate(JS_CAJAS, a.frase)
        if "error" in c:
            sys.exit(f"⛔ {c['error']} en el embed renderizado:\n{c.get('texto')}")
        x, y, w, h = c["box"]
        pg.screenshot(path=str(out / "tweet.png"), clip={"x": x, "y": y, "width": w, "height": h})
        b.close()
    rel = lambda bx: None if not bx else [round((bx[0] - x) * a.escala, 1), round((bx[1] - y) * a.escala, 1), round(bx[2] * a.escala, 1), round(bx[3] * a.escala, 1)]
    u = d["user"]
    meta = {
        "url": f"https://x.com/{u['screen_name']}/status/{tid}", "id": tid,
        "autor": u["name"], "handle": "@" + u["screen_name"], "verificado_azul": u.get("is_blue_verified"),
        "texto": d["text"], "fecha_publicacion": d["created_at"],
        "likes": d.get("favorite_count"), "respuestas": d.get("conversation_count"),
        "media": [m.get("type") for m in d.get("mediaDetails", [])] or None,
        "capturado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fuente_captura": "platform.twitter.com/embed (oficial)", "tema": a.tema, "escala": a.escala,
        "png": [round(w * a.escala), round(h * a.escala)],
        "frase": a.frase, "lineas": [rel(l) for l in c["lineas"]],
        "palabras": [{"t": p["t"], "box": rel(p["box"])} for p in c["palabras"]],
        "pruebas": {"avatar": rel(c["avatar"]), "handle": rel(c["handle"]), "fecha": rel(c["fecha"]), "likes": rel(c.get("likes"))},
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f"✅ {out}/tweet.png  {meta['png']}  · {meta['handle']} · {meta['likes']} likes · frase en {len(meta['lineas'])} renglón(es)")


if __name__ == "__main__":
    main()
