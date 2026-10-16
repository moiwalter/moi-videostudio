#!/usr/bin/env node
/**
 * brand.mjs — el paso de BRAND del pipeline de talking-head.
 *
 * POR QUÉ EXISTE
 *   El sistema nació vestido de Moi y la marca quedó SOLDADA: cero variables CSS y ~15 hex
 *   literales por escena, más los `rgba(237,232,218,.97)` que ni aparecen como hex. Para
 *   hacerle un video a otra marca (el de Christian salió bien PRECISAMENTE porque se hizo
 *   sobre su brand) había que buscar-y-reemplazar en 20 archivos y los rgba se escapaban.
 *   Acá la marca es un dato, no una constante hardcodeada.
 *
 * COMANDOS
 *   brand.mjs list                    marcas disponibles
 *   brand.mjs show <marca>            la ficha completa
 *   brand.mjs tokens <marca>          el bloque :root{} para inyectar en una escena
 *   brand.mjs new <marca>             INTAKE: qué hay que preguntar y crea el esqueleto
 *   brand.mjs check <slug> [marca]    GATE: ¿hay colores fuera de la paleta en las escenas?
 *   brand.mjs brief <marca>           el bloque de marca que se le pasa a un agente
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {styleBrief} from "./style.mjs";
import {resolveProject,config,ROOT} from './project.mjs';
import {inputGraph} from "./input-graph.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const BRANDS = join(ROOT, "biblioteca/marcas");
const RESERVED = new Set(["tools", "templates", "design_system", "assets", "renders", "_archive", "brands"]);

const [cmd, arg1, arg2] = process.argv.slice(2);

// ─────────────────────────────────────────────────────────── helpers
const listBrands = () =>
  existsSync(BRANDS) ? readdirSync(BRANDS).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json")) : [];

function loadBrand(name) {
  if (!name) { console.error(`✗ falta la marca. Disponibles: ${listBrands().join(" · ") || "(ninguna)"}`); process.exit(1); }
  const p = join(BRANDS, `${name}.json`);
  if (!existsSync(p)) {
    console.error(`✗ no existe brands/${name}.json`);
    console.error(`  Disponibles: ${listBrands().join(" · ") || "(ninguna)"}`);
    console.error(`  Para crearla: node tools/brand.mjs new ${name}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

const hexToRgb = (h) => {
  const m = h.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? m.slice(1).map((x) => parseInt(x, 16)) : null;
};
const norm = (h) => h.replace("#", "").toLowerCase();

/* Los DOS carriles. El gate nació mirando sólo `scenes/` —el carril KIT— y en el
   carril MASTER `scenes/` está vacío por diseño: todo vive en `master/index.html`.
   Resultado: un video entero del carril master pasaba sin que un solo color se
   revisara, y el gate decía "no tiene escenas" como si fuera un error del video.
   (17-ago-2026, 2026-08-uplabs-andres — el primer master de una marca de cliente.) */
function findScenes(slug) {
  const out = [];
  const registered=config(join(resolveProject(slug)));
  if(registered&&registered.lane!=='KIT'){
    const graph=inputGraph(join(resolveProject(slug)),{roots:[registered.engine.entry,...(registered.sharedInputs||[])]});
    return graph.inputs.filter(f=>/\.(html|css|tsx?|jsx?)$/.test(f)).map(f=>join(resolveProject(slug),f));
  }
  const master = join(resolveProject(slug), "master", "index.html");
  if (existsSync(master)) out.push(master);
  const dir = join(resolveProject(slug), "scenes");
  if (existsSync(dir)) {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n, "index.html");
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}
function resolveSlug(needle){return resolveProject(needle);}

// ─────────────────────────────────────────────────────────── tokens
/** Los @font-face ANTES de las variables. Sin esto los tokens dan el NOMBRE de la fuente pero
 *  nadie la carga, y la escena cae en el fallback (Georgia) en silencio: el render sale, se ve
 *  distinto, y nadie lo nota hasta verlo al lado de otro clip. */
/** El hint de `format()` SALE DE LA EXTENSIÓN, no se asume truetype. Un .woff/.woff2 declarado
 *  como format('truetype') Chromium lo DESCARTA sin pedirlo — misma falla silenciosa de arriba,
 *  pero con el archivo correcto en disco. (16-ago-2026: las HK Grotesk de startupeable llegan
 *  en .woff desde su WordPress.) */
const FONT_FORMAT = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };

function fontFaces(b) {
  if (!b.fontFiles) return "";
  const dir = b.fontDir || "design_system/fonts";
  const out = [];
  for (const [family, weights] of Object.entries(b.fontFiles))
    for (const [w, file] of Object.entries(weights)) {
      const ext = file.split(".").pop().toLowerCase();
      const fmt = FONT_FORMAT[ext];
      if (!fmt) { console.error(`  ⚠️  ${family} ${w}: extensión '${ext}' desconocida (${file}) — se omite`); continue; }
      out.push(`@font-face{font-family:'${family}';font-weight:${w};font-style:normal;`
             + `font-display:block;src:url('${dir}/${file}') format('${fmt}')}`);
    }
  return out.join("\n") + "\n";
}

function tokensBlock(b) {
  const lines = [`  /* ${b.label} — generado por tools/brand.mjs, NO editar a mano */`];
  for (const [k, hex] of Object.entries(b.palette)) {
    const rgb = hexToRgb(hex);
    lines.push(`  --${k}: ${hex};`);
    if (rgb) lines.push(`  --${k}-rgb: ${rgb.join(",")};`);   // para las formas rgba(var(--x-rgb),.75)
  }
  for (const [role, token] of Object.entries(b.roles || {})) {
    /* ⛔ Un rol que se llama IGUAL que su token emitia `--rule: var(--rule);` — una
       auto-referencia ciclica. Por spec CSS eso deja el custom property en
       *guaranteed-invalid*, asi que TODO `background: var(--rule)` se descarta y pinta
       TRANSPARENTE: sin error de consola, sin fallar ningun gate, sin rastro. Hizo
       invisibles elementos de 3 escenas de nacho-brain-rot antes de que alguien lo viera.
       La paleta ya declara ese nombre, asi que el alias sobra: se omite. (22-ago-2026) */
    if (role === token) continue;
    lines.push(`  --${role}: var(--${token});`);
  }
  for (const [sp, cols] of Object.entries(b.sponsors || {}))
    for (const [k, v] of Object.entries(cols))
      if (/^#/.test(v)) lines.push(`  --${sp}-${k}: ${v};`);
  /* El fallback del display sale de la marca, no es `serif` fijo. Con `serif` hardcodeado, una
     marca cuyo display es una grotesca (Geist, HK Grotesk) degradaba a Times si la cara no
     cargaba — o sea que el modo de falla contradecía la prohibición de serif de display.
     Y una marca SIN mono no emite `--font-mono`: `"mono": null` se interpolaba a la cadena
     literal `'null'`, que es tipografía válida, silenciosa y fea (el mismo modo de falla del
     var() indefinido). Si no hay mono, el token no existe y su uso se rompe a la vista. */
  if (b.fonts) {
    const fb = b.fonts.fallback || "sans-serif";
    lines.push(`  --font-display: '${b.fonts.display}', ${fb};`);
    lines.push(`  --font-sans: '${b.fonts.sans}', ${fb};`);
    if (b.fonts.mono) lines.push(`  --font-mono: '${b.fonts.mono}', monospace;`);
    else lines.push(`  /* sin --font-mono: ${b.label} no declara una mono. */`);
  }
  if (b.surfaces?.card) lines.push(`  --card: ${b.surfaces.card};`);
  if (b.surfaces?.rim) lines.push(`  --rim: ${b.surfaces.rim};`);

  /* Clases de utilidad con el nombre LITERAL de la familia.
     Por qué existen además de los tokens: el lint de HyperFrames hace análisis estático y no ve
     a través de `font-family: var(--font-display)` — avisa "font used without @font-face" en cada
     escena. Medido: la fuente SÍ carga por la variable (152k píxeles de diferencia contra el
     fallback), o sea que el warning es falso positivo. Pero un warning falso en cada escena
     entrena a ignorar el lint, así que las escenas usan `class="display"` y el nombre literal
     queda visible para el linter. Cambiar de marca cambia la clase: la portabilidad se mantiene.
     `.display` ya era la convención de BRAND.md. */
  const util = b.fonts ? [
    `.display{font-family:'${b.fonts.display}',${b.fonts.fallback || "sans-serif"};font-weight:${b.fonts.displayWeight || 700}}`,
    `.sans{font-family:'${b.fonts.sans}',${b.fonts.fallback || "sans-serif"}${b.fonts.sansWeight ? ';font-weight:' + b.fonts.sansWeight : ''}}`,
    b.fonts.mono ? `.mono{font-family:'${b.fonts.mono}',monospace}` : null,
  ].filter(Boolean).join("\n") : "";

  return `${fontFaces(b)}:root{\n${lines.join("\n")}\n}\n${util}`;
}

// ─────────────────────────────────────────────────────────── check (el gate)
function check(slugNeedle, brandName) {
  const slug = resolveSlug(slugNeedle);
  const projBrand = join(resolveProject(slug), "brand.json");
  const b = brandName ? loadBrand(brandName)
          : existsSync(projBrand) ? JSON.parse(readFileSync(projBrand, "utf8"))
          : loadBrand("moi");

  const allowed = new Set();
  const add = (hex) => { const n = norm(hex); allowed.add(n); };
  Object.values(b.palette || {}).forEach(add);
  Object.values(b.sponsors || {}).forEach((c) => Object.values(c).forEach((v) => /^#/.test(v) && add(v)));
  // mímesis: fidelidad a una UI real (terminal, Excel, un banco). Permitida PERO nombrada —
  // así un hex suelto sin dueño sigue siendo una falla y no se cuela "porque es de una app".
  Object.values(b.mimesis || {}).forEach((c) => Object.values(c).forEach((v) => /^#/.test(v) && add(v)));
  if (b.preview?.bg) add(b.preview.bg);
  // neutros: blanco, negro y cualquier gris puro son de estructura, no de marca
  const isNeutral = (r, g, bl) => (r === g && g === bl);

  const scenes = findScenes(slug);
  if (!scenes.length) { console.error(`✗ ${slug} no tiene escenas con index.html`); process.exit(1); }

  console.log(`\n  BRAND CHECK · ${slug}   marca: ${b.label || b.name}`);
  let bad = 0, tokenized = 0, literal = 0;

  for (const p of scenes) {
    const src = readFileSync(p, "utf8");
    const name = basename(dirname(p));
    tokenized += (src.match(/var\(--/g) || []).length;
    const offenders = new Map();

    for (const m of src.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
      literal++;
      const rgb = hexToRgb(m[1]);
      if (rgb && isNeutral(...rgb)) continue;
      if (allowed.has(norm(m[1]))) continue;
      const line = src.slice(0, m.index).split("\n").length;
      offenders.set(`#${m[1]}`, (offenders.get(`#${m[1]}`) || []).concat(line));
    }
    for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const rgb = [+m[1], +m[2], +m[3]];
      literal++;
      if (isNeutral(...rgb)) continue;
      const hex = rgb.map((x) => x.toString(16).padStart(2, "0")).join("");
      if (allowed.has(hex)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      offenders.set(`rgb(${rgb.join(",")})`, (offenders.get(`rgb(${rgb.join(",")})`) || []).concat(line));
    }

    if (offenders.size) {
      bad += offenders.size;
      console.log(`  ✗ ${name}`);
      for (const [col, lines] of offenders)
        console.log(`      ${col.padEnd(20)} L${lines.slice(0, 5).join(",L")}${lines.length > 5 ? `… (${lines.length}x)` : ""}`);
    }
  }

  console.log(`\n  ${scenes.length} escenas · ${literal} colores literales · ${tokenized} usos de var(--token)`);
  if (tokenized === 0)
    console.log(`  ! ninguna escena usa tokens: la marca está soldada. \`brand.mjs tokens ${b.name}\` da el bloque a inyectar.`);
  if (bad) {
    console.log(`\n  ${bad} color(es) FUERA de la paleta de ${b.name}.`);
    console.log(`  Un color que no está en la marca es un color inventado — o entra a brands/${b.name}.json, o sale de la escena.\n`);
    process.exit(1);
  }
  console.log(`  ✓ todos los colores salen de la paleta\n`);
}

// ─────────────────────────────────────────────────────────── intake
const INTAKE = `# INTAKE DE MARCA — qué preguntar antes de animar nada

El video de Christian funcionó porque se hizo sobre SU marca, no sobre la de Moi. Estas son las
preguntas mínimas. Si alguna no se puede contestar, NO se inventa: se pide el asset o se pregunta.

1. **Colores** — ¿cuál es el acento (el color de "esto importa")? ¿la superficie clara? ¿la oscura?
   ¿el positivo y el negativo? Pedir hex, o el CSS de su web, o su manual de marca.
   *De dónde sacarlos sin inventar:* el CSS de su sitio (\`--var\` o los hex más repetidos), su deck,
   su logo. NUNCA "a ojo" de una captura comprimida.
2. **Tipografía** — ¿display (títulos) y sans (UI)? ¿tienen las licencias/archivos?
   Si no hay, decirlo y proponer un sustituto — no asumir que la que se ve es la que tienen.
3. **Logo** — SVG o PNG con transparencia. Sin eso no hay chip de logo ni lockup.
4. **Energía** — ¿efusiva (overshoot, stamps, punch) o sobria (enterprise, sin overshoot)?
   Es la diferencia entre que se sienta suyo o se sienta de otro.
5. **Prohibiciones** — qué NO se hace nunca con su marca (Moi: sin scrim, sin wipes champán,
   sin escenas de solo texto).
6. **Sponsors** — ¿hay una marca invitada? Sus colores van aparte, no se mezclan con la paleta.

Cuando estén las respuestas: \`node tools/brand.mjs new <nombre>\` y llenar el JSON.
Después \`brand.mjs check <slug> <nombre>\` gatea que ninguna escena se salga.
`;

function newBrand(name) {
  if (!name) { console.error("uso: node tools/brand.mjs new <nombre>"); process.exit(1); }
  mkdirSync(BRANDS, { recursive: true });
  const p = join(BRANDS, `${name}.json`);
  if (existsSync(p)) { console.error(`✗ brands/${name}.json ya existe — no lo piso`); process.exit(1); }
  const skeleton = {
    name,
    label: `<nombre visible de la marca>`,
    source: "<de dónde salieron estos valores: CSS del sitio, manual de marca, deck. NO 'a ojo'.>",
    canvas: { w: 1080, h: 1920, fps: 30 },
    palette: { accent: "#______", surface: "#______", "surface-dark": "#______", ink: "#______", negative: "#______", positive: "#______" },
    roles: { accent: "accent", surface: "surface", "surface-dark": "surface-dark", text: "ink", negative: "negative", positive: "positive" },
    fonts: { display: "<display>", displayWeight: 700, sans: "<sans>", mono: "<mono>" },
    surfaces: { card: "rgba(___,___,___,.97)", rim: "inset 0 0 0 3px rgba(255,255,255,.16)", shadowMax: 8 },
    energy: "<efusiva | sobria>",
    watermark: { text: "<marca>", position: "abajo-izquierda", font: "mono" },
    sponsors: {},
    prohibido: ["<qué no se hace nunca con esta marca>"],
  };
  writeFileSync(p, JSON.stringify(skeleton, null, 2) + "\n");
  const ip = join(BRANDS, "INTAKE.md");
  if (!existsSync(ip)) writeFileSync(ip, INTAKE);
  console.log(`\n  ✓ brands/${name}.json creado (esqueleto)`);
  console.log(`  ▶ Las preguntas del intake: brands/INTAKE.md`);
  console.log(`  ⚠️  Los "______" son obligatorios. Un hex inventado se ve inventado —`);
  console.log(`     saca los colores del CSS de su sitio o de su manual, nunca a ojo de una captura.\n`);
}

function brief(b, style = null) {
  const pal = Object.entries(b.palette).map(([k, v]) => `${k} ${v}`).join(" · ");
  return [
    `MARCA: ${b.label || b.name}`,
    `Paleta (NO usar ningún color fuera de esta lista): ${pal}`,
    b.roles ? `Roles: ${Object.entries(b.roles).map(([r, t]) => `${r}→${t}`).join(" · ")}` : "",
    b.fonts ? `Tipografía: display ${b.fonts.display} ${b.fonts.displayWeight || ""} · sans ${b.fonts.sans}`
              + (b.fonts.mono ? ` · mono ${b.fonts.mono}` : " · SIN mono (no usar var(--font-mono))")
              + (b.fonts.kicker ? `\nKicker: ${b.fonts.kicker}` : "") : "",
    `Energía: ${b.energy}${b.energyNotes ? ` — ${b.energyNotes}` : ""}`,
    /* shadowMax 0 es una decisión de marca (lenguaje plano), no un default sin llenar: decir
       "sombra ≤0px" mandaba a poner una sombra de cero. Y el rim se describe con el valor real
       de la marca — el de Startupeable es OSCURO sobre card blanca, al revés que el de Moi. */
    b.surfaces?.card ? `Cards: ${b.surfaces.card}`
      + (b.surfaces.cardRadius ? `, radio ${b.surfaces.cardRadius}` : "")
      + (b.surfaces.shadowMax ? `, sombra oscura radio ≤${b.surfaces.shadowMax}px` : ", SIN sombra (lenguaje plano)")
      + (b.surfaces.rim ? `, rim ${b.surfaces.rim}` : "") : "",
    /* El logo va en el brief porque decide CÓMO se dibuja, no sólo qué asset se linkea: un
       wordmark tipográfico se ESCRIBE con la fuente (nítido a cualquier escala, animable letra
       por letra, color por token) y pegarlo como bitmap lo arruina en silencio. */
    b.logo ? `Logo: ${b.logo.tipo || "ver brands/" + b.name + ".json"}`
             + (b.logo.wordmark ? `\n  wordmark → ${b.logo.wordmark}` : "")
             + (b.logo.isotipo ? `\n  isotipo → ${b.logo.isotipo}` : "") : "",
    // `watermark.text: null` es una respuesta legítima del intake ("esta marca no tiene").
    // Sin este guard el brief le dictaba al agente: Marca de agua: "null" undefined.
    b.watermark?.text ? `Marca de agua: "${b.watermark.text}" ${b.watermark.position}` : "",
    Object.keys(b.sponsors || {}).length ? `Sponsors (colores aparte, no mezclar): ${Object.entries(b.sponsors).map(([s, c]) => `${s} ${Object.values(c).filter((v) => /^#/.test(v)).join("/")}`).join(" · ")}` : "",
    style ? styleBrief(style) : b.videoWorkflow ? [
      `FLUJO DE VIDEO: ${b.videoWorkflow.id}`,
      `Guía vigente: ${b.videoWorkflow.guide}`,
      `Referencia de marca: ${b.videoWorkflow.reference}`,
      ...(b.videoWorkflow.principles || []).map((rule) => `  · ${rule}`),
      `Encuadre de referencia (adaptar al plano): ${JSON.stringify(b.videoWorkflow.layoutReference)}`,
      `Alcance: ${b.videoWorkflow.episodeExceptions}`,
      `Revisión compartida: ${b.videoWorkflow.reviewGuide}`,
    ].join("\n") : "",
    `PROHIBIDO: ${(b.prohibido || []).join(" · ")}`,
    `Usá var(--token) del bloque :root, nunca un hex literal. El gate brand.mjs check lo verifica.`,
  ].filter(Boolean).join("\n");
}

// ─────────────────────────────────────────────────────────── router
switch (cmd) {
  case "list": {
    const l = listBrands();
    console.log(l.length ? `\n  ${l.length} marca(s): ${l.join(" · ")}\n` : "\n  (ninguna) → node tools/brand.mjs new <nombre>\n");
    break;
  }
  case "show":   console.log(JSON.stringify(loadBrand(arg1), null, 2)); break;
  case "tokens": console.log(tokensBlock(loadBrand(arg1))); break;
  case "brief":  console.log(brief(loadBrand(arg1),arg2)); break;
  case "new":    newBrand(arg1); break;
  case "check":  check(arg1, arg2); break;
  default:
    console.log(`
  brand.mjs — el paso de marca del talking-head

    list                   marcas disponibles
    show   <marca>         la ficha completa
    tokens <marca>         el bloque :root{} para inyectar en una escena
    brief  <marca>         el bloque de marca que se le pasa a un agente
    new    <marca>         intake: crea el esqueleto + brands/INTAKE.md
    check  <slug> [marca]  GATE: colores fuera de la paleta

  Disponibles: ${listBrands().join(" · ") || "(ninguna)"}
`);
}
