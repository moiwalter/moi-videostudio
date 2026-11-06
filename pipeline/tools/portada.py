#!/usr/bin/env python3
"""portada.py — el pipeline de portadas (Cvander primero). Un paso por comando; el estado vive en
<proyecto>/portadas/PORTADA.json. Reglas y porqués: pipeline/docs/PORTADAS.md.

  tools/portada.sh <proyecto> init     --tag "CLOUDFLARE CONNECT 2026" --lineas "LA SEMANA QUE|*SE ROMPIÓ|INTERNET" --logos cloudflare,php,nodejs
  tools/portada.sh <proyecto> cuadros  --clip <video> [--desde 0 --hasta 0 --paso .5]    → hoja numerada para elegir la foto
  tools/portada.sh <proyecto> foto     --clip <video> --t 8.0                            → recorte real de Chris
  tools/portada.sh <proyecto> fondos   --opciones lila:color,morado:grieta,crema:bloque  → Codex, en paralelo, SIN persona
  tools/portada.sh <proyecto> editar   C "cambia sólo el fondo a lila…" [--como C2]       → edición fiel de un fondo
  tools/portada.sh <proyecto> componer [--escala 1.0]                                    → Chris encima + hoja A/B/C + gates
  tools/portada.sh <proyecto> elegir   C2                                                → portada-final + entregas + archivo
  tools/portada.sh <proyecto> estado

En --lineas, `|` separa líneas y `*` marca la línea de acento (la más grande)."""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LOGOS = ROOT / 'biblioteca' / 'logos'
SPECS = ROOT / 'pipeline' / 'portadas'
HF = ['npx', '--prefix', str(Path.home() / '.hyperframes'), 'hyperframes']


def proyecto(needle):
    p = Path(needle)
    if p.is_absolute() and p.is_dir():
        return p.parent if p.name == 'edicion' else p
    todos = [d for d in (ROOT / 'proyectos').glob('*/*') if d.is_dir()]
    m = [d for d in todos if f'{d.parent.name}/{d.name}' == needle] or [d for d in todos if d.name == needle] \
        or [d for d in todos if needle in f'{d.parent.name}/{d.name}']
    if len(m) != 1:
        sys.exit(f'✗ proyecto {"ambiguo" if m else "inexistente"}: {needle} {[str(x.relative_to(ROOT)) for x in m]}')
    return m[0]


class Portada:
    def __init__(self, pr):
        self.pr, self.dir = pr, pr / 'portadas'
        self.f = self.dir / 'PORTADA.json'
        self.s = json.loads(self.f.read_text()) if self.f.exists() else {}

    def spec(self):
        return json.loads((SPECS / f'{self.s.get("marca", "cvander")}.json').read_text())

    def save(self):
        self.dir.mkdir(parents=True, exist_ok=True)
        self.f.write_text(json.dumps(self.s, ensure_ascii=False, indent=1))

    def need(self, k, paso):
        if not self.s.get(k):
            sys.exit(f'✗ falta «{k}»: corre `{paso}` primero')
        return self.s[k]


def jpg_chico(src, dst, ancho=700):
    im = Image.open(src).convert('RGB'); im.thumbnail((ancho, ancho * 2)); im.save(dst, quality=85)


def fuente(tam):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        if Path(f).exists():
            return ImageFont.truetype(f, tam)
    return ImageFont.load_default()


# ── pasos ──────────────────────────────────────────────────────────────────────────────────────
def init(P, a):
    sp = json.loads((SPECS / f'{a.marca}.json').read_text())
    texto = a.tag + ' ' + a.lineas
    for pat in sp['texto']['prohibido']:
        if re.search(pat, texto):
            sys.exit(f'✗ el texto tiene «{pat}» — {sp["texto"]["_por"]}')
    logos = [x.strip() for x in a.logos.split(',') if x.strip()]
    faltan = [x for x in logos if not (LOGOS / f'{x}.jpg').exists()]
    if faltan:
        sys.exit(f'✗ faltan logos oficiales en biblioteca/logos/: {faltan}. Bajarlos de la fuente oficial y anotarlos en FUENTES.json — nunca generarlos.')
    P.s.update(marca=a.marca, tag=a.tag, lineas=a.lineas.split('|'), logos=logos, opciones=P.s.get('opciones', {}))
    P.save(); print(f'✓ {P.f.relative_to(ROOT)} · tag «{a.tag}» · {len(logos)} logos')


def cuadros(P, a):
    out = P.dir / 'cuadros'; out.mkdir(parents=True, exist_ok=True)
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.clip]))
    t, ts = a.desde, []
    while t <= (a.hasta or dur) - .05:
        ts.append(round(t, 2)); t += a.paso
    celdas = []
    for t in ts:
        f = out / f'f_{t}.jpg'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', a.clip, '-frames:v', '1', '-q:v', '2', str(f)], check=True)
        im = Image.open(f); im.thumbnail((240, 430)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 78, 30], fill=(0, 0, 0)); d.text((6, 4), f'{t}', fill=(255, 230, 0), font=fuente(22)); celdas.append(im)
    cols = 8; w, h = celdas[0].size
    hoja = Image.new('RGB', (w * cols, h * ((len(celdas) + cols - 1) // cols)), 'black')
    for i, c in enumerate(celdas):
        hoja.paste(c, ((i % cols) * w, (i // cols) * h))
    hoja.save(out / 'hoja.jpg', quality=85)
    print(f'✓ {len(ts)} cuadros → {(out / "hoja.jpg").relative_to(ROOT)}\n  Elegir: sonrisa o cejas arriba, cara algo lejos del lente (L041). Luego `foto --t <seg>`.')


def foto(P, a):
    src = P.dir / f'fuente-chris-{a.t}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(a.t), '-i', a.clip, '-frames:v', '1', '-q:v', '1', str(src)], check=True)
    crudo = P.dir / 'chris-recorte-crudo.png'
    subprocess.run(HF + ['remove-background', str(src), '-o', str(crudo)], check=True, capture_output=True)
    ch = Image.open(crudo).convert('RGBA')
    # el recorte arrastra el color del fondo en el pelo → se encoge 1 px el alfa y se desatura el borde
    al = ch.split()[3].filter(ImageFilter.MinFilter(3))
    borde = ImageChops.subtract(al, al.filter(ImageFilter.MinFilter(9))).point(lambda v: min(255, v * 2))
    ch = Image.composite(ch.convert('L').convert('RGBA'), ch, borde); ch.putalpha(al)
    ch.save(P.dir / 'chris-recorte.png')
    P.s['foto'] = {'clip': str(Path(a.clip).resolve()), 't': a.t, 'recorte': 'chris-recorte.png'}; P.save()
    print(f'✓ recorte → {(P.dir / "chris-recorte.png").relative_to(ROOT)}')


def refs(P, sp):
    d = P.dir / 'refs'; d.mkdir(exist_ok=True)
    for f in d.glob('*.jpg'):
        f.unlink()
    rs = []
    for f in sorted((SPECS / sp['referencias_fijas']).glob('*.jpg')):
        shutil.copy(f, d / f.name); rs.append(d / f.name)
    marca = P.pr.parent
    recientes = sorted((x for x in marca.glob('*/entregas/*-portada.png') if P.pr not in x.parents), key=lambda x: x.stat().st_mtime)[-sp['referencias_recientes']:]
    for i, f in enumerate(recientes):
        jpg_chico(f, d / f'estilo-reciente-{i + 1}.jpg'); rs.append(d / f'estilo-reciente-{i + 1}.jpg')
    for l in P.s['logos']:
        shutil.copy(LOGOS / f'{l}.jpg', d / f'logo-{l}.jpg'); rs.append(d / f'logo-{l}.jpg')
    return rs


def codex(prompt, imgs, out, log):
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '--add-dir', str(Path.home() / '.codex/generated_images'),
           '--add-dir', str(out.parent), '-i', ','.join(map(str, imgs)), '--',
           prompt + f'\nUse your built-in image generation tool, then save the result resized to exactly 1080x1920 as {out}']
    return subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=open(log, 'w'), stderr=subprocess.STDOUT)   # sin stdin se cuelga (L050)


def normalizar(f):
    im = Image.open(f)
    if im.size != (1080, 1920):
        im.convert('RGB').resize((1080, 1920), Image.LANCZOS).save(f)


def fondos(P, a):
    P.need('tag', 'init'); sp = P.spec(); rs = refs(P, sp)
    lineas = ' / '.join(f'"{l.lstrip("*")}" ({"the biggest, accent" if l.startswith("*") else "medium"})' for l in P.s['lineas'])
    nombres = {'cloudflare': 'Cloudflare', 'php': 'PHP', 'nodejs': 'Node.js', 'mercadolibre': 'Mercado Libre', 'hackerrank': 'HackerRank', 'clawd': 'Claude', 'chatgpt': 'ChatGPT'}
    v = P.dir / 'v'; v.mkdir(exist_ok=True); procs = {}
    letras = iter('ABCDEFGH')
    for op in a.opciones.split(','):
        paleta, trat = (op.split(':') + ['color'])[:2]
        L = next(x for x in letras if x not in P.s['opciones'] or a.rehacer)
        prompt = sp['prompt'].format(tag=P.s['tag'], n=len(P.s['lineas']), lineas=lineas, paleta=sp['paletas'][paleta],
                                     tratamiento=sp['tratamientos'][trat],
                                     logos=', '.join(nombres.get(l, l.title()) for l in P.s['logos']),
                                     logos_ref=', '.join(f'logo-{l}.jpg' for l in P.s['logos']))
        (v / f'fondo-{L}.prompt.txt').write_text(prompt)
        procs[L] = codex(prompt, rs, v / f'fondo-{L}.png', v / f'log-{L}.txt')
        P.s['opciones'][L] = {'paleta': paleta, 'tratamiento': trat, 'fondo': f'v/fondo-{L}.png', 'estado': 'borrador'}
    P.save(); print(f'… Codex generando {list(procs)} en paralelo (unos minutos)')
    for L, p in procs.items():
        p.wait(); f = v / f'fondo-{L}.png'
        print(f'  {"✓" if f.exists() else "✗"} {L} · {P.s["opciones"][L]["paleta"]}:{P.s["opciones"][L]["tratamiento"]}' + ('' if f.exists() else f' — ver v/log-{L}.txt'))
        if f.exists():
            normalizar(f)
    print('Siguiente: `componer`')


def editar(P, a):
    o = P.need('opciones', 'fondos'); base = P.dir / o[a.de]['fondo']
    L = a.como or a.de + '2'; out = P.dir / 'v' / f'fondo-{L}.png'
    prompt = (f'Edit the FIRST image. Faithful edit, NOT a redesign: keep every element, text, logo chip, font, size and position exactly as is, '
              f'and change ONLY this: {a.instruccion}. No person. No new text.')
    p = codex(prompt, [base] + [P.dir / 'refs' / f'logo-{l}.jpg' for l in P.s['logos']], out, P.dir / 'v' / f'log-{L}.txt'); p.wait()
    if not out.exists():
        sys.exit(f'✗ Codex no guardó {out.name} — ver v/log-{L}.txt')
    normalizar(out)
    o[L] = {**o[a.de], 'fondo': f'v/fondo-{L}.png', 'de': a.de, 'edicion': a.instruccion, 'estado': 'borrador'}; P.save()
    print(f'✓ {L} (edición de {a.de}) · siguiente: `componer`')


def fin_contenido(fondo, sp):
    """Última fila (y) con texto/chips: la cabeza de Chris arranca debajo. Se mide en la franja CENTRAL
    (x 300–780), donde van titular y chips; el patrón vive en los costados y no cuenta."""
    g = Image.open(fondo).convert('L'); px = g.load(); ult = 0
    for y in range(400, 1200):
        fila = [px[x, y] for x in range(300, 780, 3)]
        if max(fila) - min(fila) > 120:
            ult = y
    return ult


def componer(P, a):
    sp = P.spec(); P.need('foto', 'foto'); ch0 = Image.open(P.dir / P.s['foto']['recorte']).convert('RGBA')
    esc = a.escala or sp['chris']['escala']
    ch = ch0 if esc == 1 else ch0.resize((round(ch0.width * esc), round(ch0.height * esc)), Image.LANCZOS)
    bb = ch.split()[3].getbbox(); hechas = []
    for L, o in sorted(P.s['opciones'].items()):
        f = P.dir / o['fondo']
        if not f.exists():
            continue
        tope = fin_contenido(f, sp) + sp['chris']['margen_bajo_chips']
        lienzo = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); lienzo.paste(ch, ((1080 - ch.width) // 2, tope - bb[1]), ch)
        out = P.dir / 'v' / f'portada-{L}.png'
        Image.alpha_composite(Image.open(f).convert('RGBA'), lienzo).convert('RGB').save(out)
        avisos = [f'la cabeza arranca en y={tope}: el titular baja demasiado, la cara sale de la zona segura'] if tope > 1100 else []
        o.update(portada=f'v/portada-{L}.png', tope_cabeza=tope, escala=esc, avisos=avisos); hechas.append((L, out))
        print(f'  {L} · cabeza desde y={tope}' + ''.join(f'\n    ⚠ {x}' for x in avisos))
    celdas = []
    for L, f in hechas:
        im = Image.open(f); im.thumbnail((540, 960)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 150, 46], fill=(0, 0, 0)); d.text((12, 8), L, fill=(255, 255, 255), font=fuente(30)); celdas.append(im)
    hoja = Image.new('RGB', (540 * len(celdas), 960), 'black')
    for i, c in enumerate(celdas):
        hoja.paste(c, (i * 540, 0))
    hoja.save(P.dir / 'opciones.jpg', quality=88); P.save()
    print(f'✓ hoja → {(P.dir / "opciones.jpg").relative_to(ROOT)}\n  Mirarla de verdad: cara, chips legibles, nada tapado. Walter elige → `elegir <letra>`')


def elegir(P, a):
    o = P.need('opciones', 'fondos')[a.letra]; src = P.dir / o['portada']
    shutil.copy(src, P.dir / 'portada-final.png')
    ent = P.pr / 'entregas'; ent.mkdir(exist_ok=True); shutil.copy(src, ent / f'{P.pr.name}-portada.png')
    arch = P.dir / 'archivo'; arch.mkdir(exist_ok=True)
    for L, x in P.s['opciones'].items():
        x['estado'] = 'aprobada' if L == a.letra else 'descartada'
        if L != a.letra and x.get('portada') and (P.dir / x['portada']).exists():
            shutil.copy(P.dir / x['portada'], arch / f'portada-{L}.png')
    if (P.dir / 'opciones.jpg').exists():
        shutil.copy(P.dir / 'opciones.jpg', arch / 'opciones.jpg')
    P.s['elegida'] = a.letra; P.save()
    print(f'✓ {a.letra} → portadas/portada-final.png + entregas/{P.pr.name}-portada.png · el resto en portadas/archivo/')


def estado(P, a):
    print(json.dumps(P.s, ensure_ascii=False, indent=1) if P.s else '— sin PORTADA.json: empezar con `init`')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('proyecto'); sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('init'); s.add_argument('--tag', required=True); s.add_argument('--lineas', required=True); s.add_argument('--logos', default=''); s.add_argument('--marca', default='cvander')
    s = sub.add_parser('cuadros'); s.add_argument('--clip', required=True); s.add_argument('--desde', type=float, default=0); s.add_argument('--hasta', type=float, default=0); s.add_argument('--paso', type=float, default=.5)
    s = sub.add_parser('foto'); s.add_argument('--clip', required=True); s.add_argument('--t', type=float, required=True)
    s = sub.add_parser('fondos'); s.add_argument('--opciones', default='lila:color,morado:grieta,crema:bloque'); s.add_argument('--rehacer', action='store_true')
    s = sub.add_parser('editar'); s.add_argument('de'); s.add_argument('instruccion'); s.add_argument('--como')
    s = sub.add_parser('componer'); s.add_argument('--escala', type=float)
    s = sub.add_parser('elegir'); s.add_argument('letra')
    sub.add_parser('estado')
    a = ap.parse_args(); P = Portada(proyecto(a.proyecto))
    globals()[a.cmd](P, a)
