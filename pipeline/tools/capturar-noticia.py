#!/usr/bin/env python3
import subprocess
"""capturar-noticia.py — convierte una nota de prensa en un asset de escena, con recibo.

    tools/capturar-noticia.py <url> --slug <video> [--marca <marca>]
    tools/capturar-noticia.py <url> --out /ruta/suelta        # sin video asociado
    tools/capturar-noticia.py <url> --slug <video> --desktop  # override del viewport

Sale un directorio en `<video>/local/assets/noticias/<medio>-<titular>/` con:
    captura.png   el recorte del titular — la EVIDENCIA, sin retocar
    logo.png      el logo del medio, sacado de su propio header, fondo transparente
    meta.json     el recibo: url, medio, titular verbatim, fechas, selector, contraste
    pagina.png    la vista completa, sólo de referencia (no va a la escena)

⛔ CAPTURA, NO RECONSTRUCCIÓN (Walter, 16-ago-2026). Una captura vale porque conserva la
   identidad visual del medio: Forbes tiene que verse como Forbes. Por eso este script NUNCA
   toca los colores, la tipografía ni el layout de lo capturado. Lo nuestro es el marco de
   afuera, que lo pone la escena. Un titular "recreado" en la tipografía de la marca deja de
   ser evidencia y pasa a ser un artefacto que parece un registro real.

⛔ EL MÓVIL ES EL DEFAULT, no el caso raro. Una nota en viewport móvil ya viene angosta, con
   el titular grande y apilado: entra en 1080×1920 casi sin recortar. La misma nota en desktop
   hay que destriparla, y el cuerpo queda ilegible al escalar.

⛔ LA ATRIBUCIÓN TIENE PLAN A Y PLAN B. Plan A: el masthead del medio entra en el recorte y la
   atribución sale gratis, en su propia tipografía. Cuando no entra —y pasa seguido, porque
   muchos headers son sticky y desaparecen al hacer scroll al titular— el script lo DECLARA en
   `masthead_en_captura: false` y deja `logo.png` listo para que la escena lo ponga arriba al
   centro. La escena decide; el script no compone. Así el logo sigue siendo animable y con el
   color como token, en vez de horneado en un PNG.

⛔ EL RECIBO NO ES OPCIONAL. Sin url + fecha de publicación + fecha de captura, en tres meses
   nadie puede verificar que la nota decía lo que el video dice que decía. Mismo criterio que
   el meta.json por escena: la verdad de máquina, no la estimada.
"""

import argparse, json, os, re, sys, unicodedata
from datetime import datetime, timezone
from pathlib import Path

# ── Playwright no vive en el python3 del PATH (homebrew); vive en el de python.org.
#    En vez de obligar a recordar la ruta, el script se re-lanza solo con el que lo tenga.
def _asegurar_playwright():
    try:
        import playwright  # noqa: F401
        return
    except ImportError:
        pass
    candidatos = [
        "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3",
        "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
    ]
    import subprocess
    for py in candidatos:
        if not os.path.exists(py) or os.path.samefile(py, sys.executable):
            continue
        ok = subprocess.run([py, "-c", "import playwright"], capture_output=True).returncode == 0
        if ok:
            os.execv(py, [py, os.path.abspath(__file__)] + sys.argv[1:])
    sys.exit("✗ No encontré un python con playwright.\n"
             "  Instalá:  python3 -m pip install playwright && python3 -m playwright install chromium")

_asegurar_playwright()
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

# ── Los muros de consentimiento son el modo de falla #1 de una captura headless: sin manejarlos
#    el PNG que sale es el cartel de cookies, no el titular. Se prueban por texto de botón y por
#    los proveedores más comunes, y lo que quede tapando pantalla se saca por z-index.
BOTONES_CONSENT = [
    "button:has-text('Aceptar todo')", "button:has-text('Aceptar')", "button:has-text('Acepto')",
    "button:has-text('Accept all')", "button:has-text('Accept All')", "button:has-text('Accept')",
    "button:has-text('I agree')", "button:has-text('Agree')", "button:has-text('Got it')",
    "button:has-text('Entendido')", "button:has-text('Continuar')", "button:has-text('Consent')",
    "#onetrust-accept-btn-handler", ".fc-cta-consent", "[aria-label*='consent' i] button",
    "button[mode='primary']",
]

# Orden de preferencia real: lo que el propio sitio declara como titular gana sobre el primer h1
# suelto, porque muchos sitios ponen un h1 invisible con el nombre del medio.
SEL_TITULAR = [
    "article h1", "main h1", "[itemprop='headline']", "h1[class*='headline' i]",
    "h1[class*='title' i]", "header h1", "h1",
]
SEL_FIRMA = [
    "[itemprop='author']", "[class*='byline' i]", "[class*='author' i]",
    "time", "[datetime]", "[class*='date' i]",
]
SEL_LOGO = [
    "header [class*='logo' i] img", "header img[class*='logo' i]", "header [class*='logo' i] svg",
    "header svg[class*='logo' i]", "header img[alt*='logo' i]", "header img[src*='logo' i]",
    "[class*='masthead' i] img", "[class*='masthead' i] svg",
    "a[aria-label*='home' i] img", "a[aria-label*='home' i] svg",
    "header a[href='/'] img", "header a[href='/'] svg",
    "[class*='logo' i] img", "img[class*='logo' i]",
]


def slugify(s, n=48):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return (s[:n].rstrip("-")) or "sin-titulo"


def dismiss_consent(pg):
    """Devuelve qué se hizo, para que quede en el recibo: una captura tomada tras cerrar un
    muro no es lo mismo que una tomada sin muro, y conviene poder distinguirlas después."""
    hechos = []
    for sel in BOTONES_CONSENT:
        try:
            loc = pg.locator(sel).first
            if loc.is_visible(timeout=350):
                loc.click(timeout=1200, force=True)
                hechos.append(sel)
                pg.wait_for_timeout(600)
                break
        except Exception:
            continue
    # Lo que sobrevive: overlays fijos que cubren media pantalla. Se ocultan, no se borran —
    # borrar nodos puede reflowear el artículo y mover el titular que estamos por recortar.
    tapados = pg.evaluate("""() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const r = el.getBoundingClientRect();
        const cubre = r.width * r.height > innerWidth * innerHeight * 0.35;
        const z = parseInt(cs.zIndex) || 0;
        // ⛔ NUNCA ocultar algo que CONTIENE el artículo. Fastly monta su titular dentro de un
        //    header sticky grande: la rutina anti-cookies lo tapaba y el script reportaba
        //    "no encontré el titular" sobre una página que lo tenía visible. Un limpiador que
        //    se come el contenido es peor que no limpiar.
        if (el.querySelector('h1, article, main')) continue;
        if (cubre && z >= 100 && r.top < innerHeight) {
          el.style.setProperty('visibility', 'hidden', 'important');
          out.push((el.tagName + '.' + (el.className || '')).slice(0, 60));
        }
      }
      return out;
    }""")
    return {"boton": hechos, "overlays_ocultos": tapados}


def mejor_visible(pg, selectores, mas_ancho=False, min_w=20, min_h=8,
                  max_w=None, max_h=None, ar=None):
    """Recorre TODAS las coincidencias de cada selector, no sólo la primera.

    ⛔ Nació de un bug real (16-ago-2026, TechCrunch): los sitios responsive sirven DOS logos —
    uno de desktop y uno de móvil— y ocultan el que no toca con `display:none`. Con `.first` el
    script agarraba el oculto, lo descartaba por invisible y seguía al selector siguiente, así
    que el selector CORRECTO nunca se probaba y la nota salía sin logo.

    `mas_ancho=True` elige la coincidencia más ancha en vez de la primera: entre el sello
    cuadrado y el wordmark completo, para atribuir arriba al centro sirve el wordmark.
    """
    mejor = None
    for sel in selectores:
        try:
            loc = pg.locator(sel)
            n = min(loc.count(), 8)
        except Exception:
            continue
        for i in range(n):
            try:
                el = loc.nth(i)
                if not el.is_visible(timeout=250):
                    continue
                box = el.bounding_box()
                if not box or box["width"] < min_w or box["height"] < min_h:
                    continue
                if max_w and box["width"] > max_w: continue
                if max_h and box["height"] > max_h: continue
                if ar and not (ar[0] <= box["width"] / max(1, box["height"]) <= ar[1]): continue
                cand = (sel, i, el, box)
                if not mas_ancho:
                    return cand
                if mejor is None or box["width"] > mejor[3]["width"]:
                    mejor = cand
            except Exception:
                continue
        if mejor and not mas_ancho:
            break
    return mejor if mejor else (None, None, None, None)


def _hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lum(rgb):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)


def _contraste(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _hsv(rgb):
    import colorsys
    r, g, b = rgb
    return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)


def dominante(path):
    """El color de campo de la captura: el fondo que el medio eligió, medido por área."""
    try:
        from PIL import Image
    except ImportError:
        return None
    import collections
    im = Image.open(path).convert("RGB")
    im.thumbnail((240, 240))
    c = collections.Counter((r // 8 * 8, g // 8 * 8, b // 8 * 8) for r, g, b in im.getdata())
    (r, g, b), n = c.most_common(1)[0]
    return {"rgb": [r, g, b], "hex": f"#{r:02X}{g:02X}{b:02X}",
            "cobertura": round(n / (im.width * im.height), 3)}


def sugerir_superficie(marca, campo, logo_luma):
    """Elige SOBRE QUÉ SUPERFICIE de la marca se apoya esta captura.

    ⛔ LA QUE CEDE ES LA MARCA, NO LA CAPTURA (Walter, 16-ago-2026). La captura y el logo del
    medio son datos inmutables: no se repintan, porque valen justamente por conservar la
    identidad del medio. Pero la marca tiene más de una superficie legítima (teal, negro,
    papel), así que cuando el campo del medio pelea con el campo de la marca, **se cambia la
    marca**. El verde de TechCrunch sobre el teal de Startupeable quedaba barroso; la respuesta
    no es tocar el verde, es apoyar esa captura sobre negro.

    El barro no es falta de contraste: es cercanía de TONO entre dos colores saturados. Por eso
    se puntúa por distancia de matiz además de por contraste — dos colores pueden tener 4:1 y
    verse igual de sucios juntos.
    """
    pal = marca.get("palette", {})
    roles = marca.get("roles", {})
    cands = []
    for rol in ("surface", "surface-alt", "surface-dark"):
        tok = roles.get(rol)
        if tok and tok in pal:
            cands.append((rol, tok, _hex_rgb(pal[tok])))
    if not cands or not campo:
        return None
    cr = campo["rgb"]
    ch, cs, _cv = _hsv(cr)
    # ⛔ EL LOGO PESA EN LA MISMA DECISIÓN, no se mira después de elegir. Puntuando sólo contra
    #    el campo de la captura, para TechCrunch (verde) ganaba `paper` por menos de un punto —
    #    y el lockup de TechCrunch es BLANCO, o sea 1:1 sobre papel. La superficie tiene que
    #    servirle a las DOS cosas inmutables a la vez: el campo del medio y el logo del medio.
    lg_rgb = None if logo_luma is None else ((255, 255, 255) if logo_luma > .5 else (0, 0, 0))
    out = []
    for rol, tok, rgb in cands:
        h, s, _v = _hsv(rgb)
        dh = abs(ch - h) * 360
        dh = min(dh, 360 - dh)
        contr = _contraste(cr, rgb)
        barro = cs > 0.25 and s > 0.25 and dh < 45          # dos saturados de tono vecino
        c_logo = _contraste(lg_rgb, rgb) if lg_rgb else None
        # Un campo neutro (blanco/gris) no pelea con nada: ahí manda la superficie de la marca.
        score = (0 if barro else 100) + min(contr, 8) * 5 + (dh / 12 if cs > 0.25 else 0)
        if c_logo is not None:
            score += (min(c_logo, 8) * 4) if c_logo >= 3 else -45
        out.append({"rol": rol, "token": tok, "hex": pal[tok],
                    "contraste": round(contr, 2), "dif_tono": round(dh), "barroso": barro,
                    "contraste_logo": None if c_logo is None else round(c_logo, 2),
                    "score": round(score, 1)})
    out.sort(key=lambda x: -x["score"])
    elegido = out[0]
    nota = None
    if elegido["contraste_logo"] is not None:
        c = elegido["contraste_logo"]
        nota = (f"el logo ({'claro' if logo_luma > .5 else 'oscuro'}) da {c}:1 sobre "
                f"{elegido['token']}" + ("" if c >= 3 else " — NECESITA placa detrás"))
    return {"elegida": elegido, "alternativas": out[1:], "logo_sobre_elegida": nota,
            "_regla": "la superficie de la marca se adapta a la captura Y a su logo; "
                      "la captura NO se repinta"}


def luma_png(path):
    """Luminancia media de los píxeles OPACOS del logo. Existe para que la escena no tenga que
    mirar el PNG: un logo oscuro sobre el campo teal no se lee y necesita placa clara detrás.
    Es la misma lección que el gris flotante de Moi — se juzga contra el fondo real."""
    try:
        from PIL import Image
    except ImportError:
        return None
    im = Image.open(path).convert("RGBA")
    tot = n = 0
    for r, g, b, a in im.getdata():
        if a < 40:
            continue
        tot += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        n += 1
    return round(tot / n, 3) if n else None


def extraer_logo(browser, url, destino):
    """PASADA 2, en DESKTOP — el logo del medio, sacado de su propio header.

    Va en una pasada aparte a propósito: el header móvil sirve un sello chico (TechCrunch:
    47×24 px) y para poner la atribución arriba al centro de un cuadro de 1080 hace falta el
    wordmark completo, que sólo existe en el header ancho.

    Se le apaga el fondo a él y a sus ancestros para que el PNG salga con alpha: el mismo
    archivo tiene que poder ir sobre el campo teal y sobre una card clara sin arrastrar un
    rectángulo blanco pegado.
    """
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900}, device_scale_factor=3, locale="es-ES",
        user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"))
    pg = ctx.new_page()
    try:
        pg.goto(url, wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(2000)
        dismiss_consent(pg)
        # ⛔ UN LOGO ES CHICO Y APAISADO. Sin este límite, "el más ancho gana" elige el CONTENEDOR
        #    que envuelve al logo —o media home— en vez de la marca: khoslaventures.com y 776.vc
        #    devolvían una franja de 1440 px con el hero adentro, y el meta.json daba números
        #    perfectos igual. Sólo se cazó componiendo el PNG sobre el fondo real.
        sel, idx, el, box = mejor_visible(pg, SEL_LOGO, mas_ancho=True, min_w=40, min_h=10,
                                          max_w=520, max_h=170, ar=(0.4, 14))
        if not el:
            return None
        # ⛔ SI EL LOGO ES VECTOR, SE AGRANDA ANTES DE RASTERIZAR — no después.
        #    TechCrunch sirve su lockup como SVG de 149×16 px CSS. Capturado al tamaño del sitio
        #    daban 447×48 px: puesto arriba al centro de un cuadro de 1080 hay que escalarlo 2,4×
        #    y sale blando. Estirando el elemento en el DOM antes del screenshot, el navegador
        #    rasteriza el vector a la resolución final y sale nítido. Para un logo raster no
        #    cambia nada (se upscalearía igual), por eso sólo se hace cuando hay vector.
        info = pg.evaluate("""([sel, i]) => {
          const e = document.querySelectorAll(sel)[i];
          const src = (e.currentSrc || e.src || '');
          // ⛔ El COLOR se lleva junto con el SVG. Los logos inline modernos usan
          //    fill="currentColor" y toman el color por CSS de la página: renderizados
          //    aislados salen NEGROS. El de CIO es rojo en su sitio y salía en negro con
          //    luma 0.0 — sobre el campo oscuro habría desaparecido sin un solo error.
          const cs = getComputedStyle(e);
          return {src: src.slice(0, 400),
                  color: cs.color, fill: cs.fill || null,
                  svgUrl: /\\.svg(\\?|$)/i.test(src) ? src : null,
                  inline: e.tagName.toLowerCase() === 'svg' ? e.outerHTML.slice(0, 200000) : null};
        }""", [sel, idx])

        # ⛔ SI YA ES VECTOR, SE BAJA EL VECTOR — no se rasteriza al tamaño del sitio ni se
        #    estira el <img> en el DOM. Estirarlo lo hacía DESBORDAR su header, la página se
        #    recomponía y el screenshot terminaba agarrando el hero de atrás: el meta.json
        #    daba 3600×851 px "perfectos" y el PNG era media home. Sólo se vio componiendo.
        #    Un .svg en disco además escala infinito dentro de la composición.
        svg = None
        if info.get("svgUrl"):
            try:
                r = pg.request.get(info["svgUrl"], timeout=20000)
                if r.ok and "svg" in (r.headers.get("content-type", "") + info["svgUrl"]):
                    svg = r.text()
            except Exception:
                svg = None
        elif info.get("inline"):
            svg = info["inline"]
        if svg and "<svg" in svg:
            (destino / "logo.svg").write_text(svg)

        # El PNG sale de renderizar el SVG SOLO, en una página en blanco: sin header, sin
        # hermanos, sin reflow. Es el único contexto donde el recorte no puede traer basura.
        if svg and "<svg" in svg:
            iso = ctx.new_page()
            iso.set_viewport_size({"width": 1400, "height": 600})
            col = info.get("color") or "#000"
            iso.set_content(f'<body style="margin:0;background:transparent">'
                            f'<div id="L" style="width:1200px;color:{col}">{svg}</div></body>')
            iso.wait_for_timeout(350)
            iso.evaluate("""() => { const s=document.querySelector('#L svg');
              if (s) { s.setAttribute('width','1200'); s.style.width='1200px'; s.style.height='auto'; } }""")
            iso.wait_for_timeout(250)
            b2 = iso.locator("#L").bounding_box()
            iso.locator("#L").screenshot(path=str(destino / "logo.png"), omit_background=True)
            if b2: box = b2
            iso.close()
        else:
            el.screenshot(path=str(destino / "logo.png"), omit_background=True)
        info["vector"] = bool(svg)
        luma = luma_png(destino / "logo.png")
        return {
            "selector": sel, "n": idx, "vector": info["vector"], "src": info["src"],
            "css": {"w": round(box["width"]), "h": round(box["height"])},
            "px": {"w": round(box["width"] * 3), "h": round(box["height"] * 3)},
            "luma": luma,
            "sobre_teal": None if luma is None else
                          ("va directo — es claro" if luma > 0.55 else
                           "NECESITA placa clara detrás — es oscuro y el teal se lo come"),
        }
    except Exception as e:
        return {"error": str(e)[:160]}
    finally:
        ctx.close()


def capturar(url, destino, movil=True, pad=18, marca=None):
    destino.mkdir(parents=True, exist_ok=True)
    # 390×844 @3 = iPhone moderno. El dsf 3 es lo que hace que el recorte aguante 1080 de ancho
    # sin verse blando: un titular capturado a 1× y escalado 3× es exactamente el screenshot
    # ilegible que esta herramienta existe para evitar.
    vp = {"width": 390, "height": 844} if movil else {"width": 1440, "height": 1100}
    ua = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
          "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1") if movil else \
         ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

    meta = {"url": url, "viewport": vp, "movil": movil,
            "capturado": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    with sync_playwright() as p:
        b = p.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
        ctx = b.new_context(viewport=vp, user_agent=ua, device_scale_factor=3,
                            is_mobile=movil, has_touch=movil, locale="es-ES")
        pg = ctx.new_page()
        resp = pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        meta["http"] = resp.status if resp else None
        if resp and resp.status >= 400:
            b.close()
            sys.exit(f"✗ {resp.status} en {url} — no se captura una nota que no carga.")
        pg.wait_for_timeout(2500)
        meta["consent"] = dismiss_consent(pg)

        # ⛔ DESPUÉS DEL CONSENT SE ESPERA LA CONDICIÓN, NO UN RELOJ. Fastly re-renderiza al
        #    aceptar cookies y su h1 pasa por `visibility:hidden` — mirándolo 600 ms después,
        #    el script reportaba "no encontré el titular" sobre una página que lo tenía. Un
        #    sleep fijo hace que el resultado dependa de la red del día.
        try:
            pg.wait_for_function("""() => {
              for (const e of document.querySelectorAll('h1')) {
                const cs = getComputedStyle(e);
                if (cs.visibility !== 'hidden' && cs.display !== 'none' &&
                    (e.innerText || '').trim().length > 8) return true;
              }
              return false;
            }""", timeout=8000)
        except Exception:
            meta["aviso_titular"] = "el h1 no volvió a estar visible en 8 s tras el consent"

        # Identidad del medio: lo que el sitio declara de sí mismo, no el dominio adivinado.
        meta.update(pg.evaluate("""() => {
          const m = n => (document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)||{}).content || null;
          return {
            medio: m('og:site_name') || location.hostname.replace(/^www\\./,''),
            dominio: location.hostname.replace(/^www\\./,''),
            titular_og: m('og:title'),
            publicado: m('article:published_time') || m('datePublished') ||
                       (document.querySelector('time[datetime]')||{}).dateTime || null,
            idioma: document.documentElement.lang || null,
            url_final: location.href
          };
        }"""))

        sel_h1, _n, loc_h1, _box = mejor_visible(pg, SEL_TITULAR)
        if not loc_h1:
            b.close()
            sys.exit("✗ No encontré el titular. Pasá el selector a mano o revisá la url.")
        meta["selector_titular"] = sel_h1
        meta["titular"] = loc_h1.inner_text().strip()

        # ── El recorte. Union de titular + su bloque de firma, y del masthead SI está arriba.
        #    Se scrollea el titular a cuadro primero: en móvil suele estar bajo el fold, y un
        #    clip con coordenadas de viewport sobre una página sin scrollear captura otra cosa.
        loc_h1.scroll_into_view_if_needed()
        pg.wait_for_timeout(700)

        # ⛔ La firma se arma con TODO lo que caiga pegado debajo del titular, no con el primer
        #    match. TechCrunch pone autor y fecha en nodos hermanos distintos: quedarse con el
        #    primero dejaba la fecha justo sobre el borde del recorte, cortada por la mitad.
        firma = pg.evaluate("""([selH1, sels]) => {
          const h = document.querySelector(selH1); if (!h) return null;
          const rh = h.getBoundingClientRect();
          let out = null; const textos = [];
          for (const s of sels) for (const e of document.querySelectorAll(s)) {
            const r = e.getBoundingClientRect();
            if (r.width < 10 || r.height < 6) continue;
            const gap = r.top - rh.bottom;
            if (gap < -2 || gap > 170) continue;            // sólo lo adyacente al titular
            out = out ? {x: Math.min(out.x, r.x), y: Math.min(out.y, r.y),
                         r: Math.max(out.r, r.right), b: Math.max(out.b, r.bottom)}
                      : {x: r.x, y: r.y, r: r.right, b: r.bottom};
            const t = (e.innerText || '').trim();
            if (t && t.length < 90) textos.push(t);
          }
          return out ? Object.assign(out, {textos: [...new Set(textos)].slice(0, 3)}) : null;
        }""", [sel_h1, SEL_FIRMA])
        if firma:
            meta["firma"] = " · ".join(firma["textos"])

        cajas = pg.evaluate("""(selH1) => {
          const r = document.querySelector(selH1).getBoundingClientRect();
          return {h1: {x: r.x, y: r.y, r: r.right, b: r.bottom}, vw: innerWidth, vh: innerHeight};
        }""", sel_h1)

        # Plan A de la atribución: ¿el masthead quedó a la vista, arriba del titular?
        mh = pg.evaluate("""(sels) => {
          for (const s of sels) for (const e of document.querySelectorAll(s)) {
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            if (r.width < 20 || r.height < 8) continue;
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            if (r.top >= 0) return {x: r.x, y: r.y, r: r.right, b: r.bottom};
          }
          return null;
        }""", SEL_LOGO)

        h1 = cajas["h1"]
        x0, y0, x1, y1 = h1["x"], h1["y"], h1["r"], h1["b"]
        if firma:
            x0, x1, y1 = min(x0, firma["x"]), max(x1, firma["r"]), max(y1, firma["b"])

        # ⛔ El masthead sólo cuenta si está PEGADO al titular (≤40 px). Con la tolerancia
        #    anterior de 220 px, Bloomberg Línea metía en el recorte su cinta de cotizaciones
        #    —EUR/USD y Bitcoin en vivo— dentro de una nota sobre una ronda de inversión: datos
        #    ajenos a la historia, que además fechan la captura de una forma que nadie pidió.
        #    Entre medias hay tickers, navs y slots de ads; cuando aparecen, gana el plan B.
        meta["gap_masthead"] = round(y0 - mh["b"], 1) if mh else None
        masthead = bool(mh and mh["b"] <= y0 + 8 and (y0 - mh["b"]) <= 40)
        if masthead:
            x0, y0, x1 = min(x0, mh["x"]), min(y0, mh["y"]), max(x1, mh["r"])
        meta["masthead_en_captura"] = masthead

        # ⛔ El aire de abajo no puede destapar media línea del texto que sigue. Se busca el
        #    primer bloque de texto por debajo del recorte y se frena antes: sin esto, el pad
        #    dejaba asomando la mitad de la bajada, que se lee como un recorte mal hecho.
        techo = pg.evaluate("""(y1) => {
          let mejor = null;
          for (const e of document.querySelectorAll('p, h2, h3, figure, img, div[class*="dek" i], [class*="subtitle" i], [class*="standfirst" i]')) {
            const r = e.getBoundingClientRect();
            if (r.top >= y1 + 2 && r.height > 8 && (e.innerText || e.tagName === 'IMG'))
              if (mejor === null || r.top < mejor) mejor = r.top;
          }
          return mejor;
        }""", y1)

        # El aire de abajo cede ante el bloque siguiente, pero NUNCA por debajo de 10 px: con
        # el clamp pegado al borde, el byline de la nota de Stori quedaba a ras y se leía como
        # un recorte mal hecho. Es preferible invadir unos píxeles del blanco que sigue —
        # invisible— antes que cortar la línea que sí se ve.
        cx, cy = max(0.0, x0 - pad), max(0.0, y0 - pad)
        bot = y1 + pad
        if techo is not None:
            bot = min(bot, max(y1 + 10, techo - 4))
        clip = {"x": cx, "y": cy,
                "width": min(cajas["vw"] - cx, (x1 - x0) + pad * 2),
                "height": min(cajas["vh"] - cy, bot - cy)}
        pg.screenshot(path=str(destino / "captura.png"), clip=clip)
        meta["recorte"] = {k: round(v) for k, v in clip.items()}
        meta["captura_px"] = {"w": round(clip["width"] * 3), "h": round(clip["height"] * 3)}
        pg.screenshot(path=str(destino / "pagina.png"), full_page=False)
        meta["logo"] = extraer_logo(b, url, destino)
        b.close()

    # El campo del medio se MIDE, y con él se elige sobre qué superficie de la marca se apoya.
    meta["campo"] = dominante(destino / "captura.png")
    if marca:
        meta["marca"] = marca.get("name")
        meta["superficie"] = sugerir_superficie(marca, meta["campo"],
                                                (meta.get("logo") or {}).get("luma"))

    (destino / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return meta


def main():
    ap = argparse.ArgumentParser(description="Captura el titular de una nota como asset de escena.")
    ap.add_argument("url")
    ap.add_argument("--slug", help="video destino; escribe en <slug>/local/assets/noticias/")
    ap.add_argument("--out", help="directorio suelto (si no hay video)")
    ap.add_argument("--marca", help="marca de brands/<marca>.json; si no, la del video")
    # Un logo de marca (un inversor, un sponsor) no es una nota: no tiene titular y el script
    # abortaría buscándolo. Mismo extractor, sin la parte de artículo.
    ap.add_argument("--solo-logo", action="store_true",
                    help="sólo extrae el logo del sitio (para inversores, sponsors, herramientas)")
    ap.add_argument("--desktop", action="store_true", help="viewport 1440 en vez de móvil")
    ap.add_argument("--pad", type=int, default=18, help="aire alrededor del recorte, en px CSS")
    a = ap.parse_args()

    if not a.slug and not a.out:
        sys.exit("✗ Falta --slug <video> o --out <dir>.")
    meta_prev = {"medio": "medio", "titular": "nota"}
    project = Path(subprocess.check_output(["node", str(ROOT / "pipeline/tools/project.mjs"), "resolve", a.slug], text=True).strip()) if a.slug else None
    base = Path(a.out) if a.out else project / "local" / "assets" / "noticias"
    if not a.out and not project.is_dir():
        sys.exit(f"✗ No existe el video '{a.slug}' en {ROOT}")

    # La marca hace falta para elegir la superficie: sin ella se captura igual, pero la escena
    # se queda sin la recomendación y hay que decidir a ojo — que es justo lo que se evita.
    marca = None
    ruta_marca = (ROOT / "biblioteca/marcas" / f"{a.marca}.json") if a.marca else \
                 (project / "brand.json" if a.slug else None)
    if ruta_marca and ruta_marca.exists():
        marca = json.loads(ruta_marca.read_text())
    elif a.marca:
        sys.exit(f"✗ No existe brands/{a.marca}.json")

    tmp = base / "_capturando"

    if a.solo_logo:
        from urllib.parse import urlparse
        tmp.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
            lg = extraer_logo(b, a.url, tmp)
            b.close()
        host = urlparse(a.url).hostname.replace("www.", "")
        meta = {"url": a.url, "dominio": host, "solo_logo": True, "logo": lg,
                "capturado": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        if marca and lg and "error" not in lg:
            meta["superficie"] = sugerir_superficie(
                marca, {"rgb": [255, 255, 255], "hex": "#FFFFFF", "cobertura": 1.0}, lg.get("luma"))
        (tmp / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        final = base / f"logo-{slugify(host, 28)}"
        if final.exists():
            import shutil; shutil.rmtree(final)
        tmp.rename(final)
        if not lg or "error" in lg:
            sys.exit(f"✗ no encontré el logo en {a.url}")
        print(f"\n  ✓ {final.name}   logo {lg['px']['w']}×{lg['px']['h']} px"
              f"{' (vector)' if lg.get('vector') else ''} · luma {lg.get('luma')}")
        if meta.get("superficie"):
            print(f"    {meta['superficie']['logo_sobre_elegida']}")
        return

    meta = capturar(a.url, tmp, movil=not a.desktop, pad=a.pad, marca=marca)
    final = base / f"{slugify(meta.get('medio') or meta_prev['medio'], 20)}-{slugify(meta['titular'])}"
    if final.exists():
        import shutil; shutil.rmtree(final)
    tmp.rename(final)

    print(f"\n  ✓ {final.relative_to(ROOT) if not a.out else final}")
    print(f"    medio     {meta.get('medio')}  ({meta.get('dominio')})")
    print(f"    titular   {meta['titular'][:76]}")
    print(f"    publicado {meta.get('publicado') or '— (el sitio no lo declara)'}")
    print(f"    captura   {meta['captura_px']['w']}×{meta['captura_px']['h']} px reales")
    print(f"    masthead  {'SÍ entró en el recorte' if meta['masthead_en_captura'] else 'NO — la escena pone logo.png arriba al centro'}")
    if meta["consent"]["boton"] or meta["consent"]["overlays_ocultos"]:
        print(f"    consent   se cerró un muro antes de capturar ({len(meta['consent']['overlays_ocultos'])} overlay/s)")
    lg = meta.get("logo")
    if lg and "error" not in lg:
        print(f"    logo      {lg['px']['w']}×{lg['px']['h']} px{' (vector)' if lg.get('vector') else ''}")
    elif not meta["masthead_en_captura"]:
        print("    ⚠️  sin logo.png Y sin masthead — la atribución hay que resolverla a mano")
    if meta.get("campo"):
        print(f"    campo     {meta['campo']['hex']} ({meta['campo']['cobertura']:.0%} de la captura)")
    sup = meta.get("superficie")
    if sup:
        e = sup["elegida"]
        alt = ", ".join(f"{o['token']}{'(barroso)' if o['barroso'] else ''}" for o in sup["alternativas"])
        print(f"    superficie → {e['token']} {e['hex']}  (contraste {e['contraste']}:1, "
              f"tono {e['dif_tono']}° de diferencia)")
        print(f"                 descartadas: {alt}")
        if sup["logo_sobre_elegida"]:
            print(f"                 {sup['logo_sobre_elegida']}")


if __name__ == "__main__":
    main()
