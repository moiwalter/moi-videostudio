#!/usr/bin/env node
/* build.mjs v3.2 — walter-raw "Sitting on a goldmine" · vertical 1080x1920 · HyperFrames master.
   v3.2: the QMD outro (house end card: industry-explainer ch7 c7-end.html / takeovers.css "6 · END CARD (green)", logo lockup
   qmd-horizontal-white.svg): after "goldmine" ends, a green flood from his face (TK.flood, the same move as the goldmine takeover)
   dissolves him into the end card; logo + quotemydata.com hold to the end. Picture = speech (DUR) + outro (TOTAL).
   v3.1: grain under the speaker (z 17 < #fgwrap 18), 1296x2304 pre-scaled cut-out, no will-change/3D on the camera, music.wav track.
   v3 = Walter's "remove the AI slop" round (Nov 1, 2026): no "[our claim]" line · the $1M is a hero (display type, odometer reels,
   sheen, punch-in, hero SFX, paper flood) · RVM cut-out with decontaminated edges + soft contact shadow · the speaker is MUCH
   bigger (scale 1.00–1.17 of the source, body to the bottom edge) on a LANDSCAPE plate that dissolves into the ground ·
   richer objects (layered material, real logos, micro-motion, anchored to one board + grid) · a living ground (paper + QMD-green
   mesh, topographic lines, dot grid, light sweep, film grain; all drifting) · zoom change at every join, TK takeovers at the beats.
   Planes, back to front:
     #world (paper mesh) · #worldm (mint, TK.flood on "regulated") · #worldg (green, TK.flood into "goldmine") · #plate (his street, landscape)
     · #win > #camF > video#aroll (S01 only; dissolved by a paper flood from behind his head on "million")
     · BEHIND clips (S01, S11: the number sits behind his head) · #fgwrap (static soft shadow) > #fgclip > #cam > video#alpha
     · #grain (v3.1: z 17, under the speaker) · #board (the anchored stage for every explainer) · FRONT clips · captions · #outro (v3.2, z 60) · audio (mix.wav = voice + sfx + music, tools/master_mix.py)
   Modes: FULL (0–3.03: his street, then paper) · STAGE (3.03–21.60) · GREEN (21.60–end). Times = master seconds (master/keep.json). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/* El generador vive en el episodio (edicion/src/build.mjs). La raíz del repo se encuentra
   subiendo hasta pipeline/styles/qmd-vertical. QMD_MASTER apunta al master del episodio. */
function repoRoot(start) {
  let d = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(d, "pipeline/styles/qmd-vertical/style.json"))) return d;
    const p = dirname(d);
    if (p === d) break;
    d = p;
  }
  throw new Error("No encuentro la raíz del repo (pipeline/styles/qmd-vertical/style.json)");
}
const REPO = repoRoot(HERE);
const ROOT = process.env.QMD_EPISODE || join(HERE, "..");
const OUT = process.env.QMD_MASTER || join(ROOT, "master");
const VS = join(REPO, "pipeline");
const W = 1080, H = 1920;
const keep = JSON.parse(readFileSync(join(OUT, "keep.json"), "utf8"));
const HEAD = JSON.parse(readFileSync(join(OUT, "head.json"), "utf8"));   // tools/head_anchor.py (on the v3 matte)
const DUR = +keep.duration.toFixed(3);
const J = keep.keep.slice(1).map((k) => +k.cut[0].toFixed(4));          // the 10 master joins
/* v3.2 OUTRO timing, copied from the house end card (c7-end: M.in flood 0.6 s, F.pop logo 0.4 s, F.drift 1.04, M.push 1.1 over 1.2 s;
   4.3 s scene) — starts 0.34 s after the last word ends (his line is never touched), the flood covers the frame before the footage ends */
const WORDS = JSON.parse(readFileSync(join(OUT, "words.json"), "utf8"));
const LAST_WORD_END = WORDS[WORDS.length - 1].end;
const OUTRO = { t0: 23.35, flood: 0.6, logo: 23.85, url: 24.25, push: 24.84, len: 3.95 };
const TOTAL = +(OUTRO.t0 + OUTRO.len).toFixed(3);
if (OUTRO.t0 < LAST_WORD_END + 0.3 || OUTRO.t0 + OUTRO.flood > DUR) throw new Error("outro timing: after the last word, covered before the footage ends");

/* ── CONFIG: Walter's swappable defaults ─────────────────────────────────── */
const CONFIG = {
  claim: { value: 1000000 },                                                            // the only number on screen (no label line, v3)
  labsLabel: "AI frontier labs · examples",
  labs: [
    { name: "OpenAI", src: "assets/logos/openai-black-wordmark.svg", h: 84 },
    { name: "Anthropic", src: "assets/logos/anthropic-slate.svg", h: 28 },
    { name: "Google DeepMind", src: "assets/logos/deepmind-light.svg", h: 36 },
    { name: "Meta", src: "assets/logos/meta-logo.png", h: 56 },
  ],
  tools: [
    { name: "Zendesk", src: "assets/logos/zendesk-site.svg", h: 50 },
    { name: "Intercom", src: "assets/logos/intercom-site.svg", h: 34 },
    { name: "Slack", src: "assets/logos/slack-mark.svg", h: 40, text: "Slack" },
    { name: "Jira", src: "assets/logos/jira-site.svg", h: 40 },
    { name: "Gmail", src: "assets/logos/gmail.svg", h: 36, text: "Gmail" },
  ],
  ui: {
    inbox: "assets/img/intercom-inbox.jpg", inboxW: 2436, inboxH: 1624,
    chat: "assets/img/intercom-chat.png", chatW: 945, chatH: 980,
    credit: "UI · Intercom product page",
  },
  strata: ["this week", "this quarter", "last year", "years back", "the archive"],
  kickers: { S02: "your data", S03: "the buyer", S04: "who it applies to", S06: "the workflow", S07: "the depth", S08: "the evidence" },
  music: false,
};

/* ── brand tokens + site fonts ───────────────────────────────────────────── */
let tokens = execFileSync("node", [join(VS, "tools/brand.mjs"), "tokens", "qmd"], { encoding: "utf8" });
tokens = tokens.replace(/@font-face\{[^}]*\}\s*/g, "");
const FONTS = `/* fonts = exactly what quotemydata.com serves (fetched 1-nov-2026), byte-for-byte in assets/fonts */
@font-face{font-family:'Instrument Sans';font-style:normal;font-weight:400 700;font-stretch:75% 100%;font-display:block;src:url('assets/fonts/instrument-sans-regular.8d6e8737dc5490be.woff2') format('woff2')}
@font-face{font-family:'Instrument Sans';font-style:italic;font-weight:400 700;font-stretch:75% 100%;font-display:block;src:url('assets/fonts/instrument-sans-italic.a234b58d35170746.woff2') format('woff2')}
@font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:block;src:url('assets/fonts/GeistMono-Variable.woff2') format('woff2')}
`;
const tkCss = readFileSync(join(VS, "componentes/takeovers/takeovers.css"), "utf8");
const tkJs = readFileSync(join(VS, "componentes/takeovers/transitions.js"), "utf8");

/* ── layout ─────────────────────────────────────────────────────────────── */
const BOARD = { x: 44, y: 70, w: 992, h: 700 };                 // the one anchored stage (kicker row 92–132, zone below)
const Z = { x: 72, y: 140, w: 936, h: 604 };                    // the graphic zone inside the board (canvas px)
const MODE = { STAGE: { cap: 778, yt: 912 }, FULL: { cap: 1384 } };
const PLATE = { x: 64, y: 960, w: 952, h: 640, r: 60 };          // landscape plate: his head breaks its top edge, his body crosses the bottom
const FY = 0.40;
const f3 = (n) => (+n).toFixed(3);
const js = [];
const SFX = [];
const sfx = (t, k, db, o = {}) => SFX.push({ t: +(+t).toFixed(3), k, db, ...o });

/* camera. FULL: origin = his face (fx·W, 0.40·H). STAGE: origin 0 0, scale = relative zoom (base 1.00 = the source at full size),
   head top pinned at yt, x clamped so the source frame always covers the canvas width (no source edge ever shows). */
function camFull(s, fx) { return { scale: s, x: 0, y: 0, o: `${(fx * W).toFixed(0)}px ${(FY * H).toFixed(0)}px` }; }
function camStage(i, z) {
  const h = HEAD[i], s = +z.toFixed(4);
  const x = Math.max(W - W * s, Math.min(0, 540 - h.cx * s));
  return { scale: s, x: +x.toFixed(1), y: +(MODE.STAGE.yt - h.top * s).toFixed(1), o: "0px 0px" };
}
const FX = { 0: HEAD[0].cx / W };
const camStr = (c) => `scale:${c.scale},x:${c.x},y:${c.y}`;
const CAMPLAN = [];
const setF = (t, s, i, extra = "") => { CAMPLAN.push({ t: +t.toFixed(3), m: "FULL", z: s, set: true }); const c = camFull(s, FX[i]); js.push(`tl.set(["#cam","#camF"],{transformOrigin:"${c.o}",${camStr(c)}${extra}},${f3(t)});`); };
const toF = (t, s, i, d, ease = "sine.inOut") => { CAMPLAN.push({ t: +t.toFixed(3), m: "FULL", z: s }); const c = camFull(s, FX[i]); js.push(`tl.to(["#cam","#camF"],{${camStr(c)},duration:${d},ease:"${ease}"},${f3(t)});`); };
const setS = (t, i, z, m = "STAGE", extra = "") => { CAMPLAN.push({ t: +t.toFixed(3), m, z, set: true }); const c = camStage(i, z); js.push(`tl.set("#cam",{transformOrigin:"${c.o}",${camStr(c)}${extra}},${f3(t)});`); };
const toS = (t, i, z, d, ease = "sine.inOut", m = "STAGE") => { CAMPLAN.push({ t: +t.toFixed(3), m, z }); const c = camStage(i, z); js.push(`tl.to("#cam",{${camStr(c)},duration:${d},ease:"${ease}"},${f3(t)});`); };
const faceSet = (t, i) => { const h = HEAD[i]; js.push(`tl.set("#facebox",{left:${Math.round(h.cx - 120)},top:${Math.round(h.top)},width:240,height:${Math.round(h.top_max - h.top + 330)}},${f3(t)});`); };
HEAD.forEach((h, i) => faceSet(h.a, i));

/* ── camera, join by join (a different scale on each side of every join; ceiling 1.19) ── */
// S01 FULL: 1.04 drift → punch 1.14 on "million" (1.08) → 1.16 → zoom-jump 1.19 + blur into the pause
js.push(`tl.set("#win",{opacity:1},0);tl.set("#plate",{opacity:0},0);`);
setF(0, 1.04, 0); toF(0, 1.06, 0, 0.95); toF(0.98, 1.14, 0, 0.26, "power3.out"); toF(1.3, 1.16, 0, 1.5);
js.push(`tl.to(["#cam","#camF"],{scale:1.19,filter:"blur(10px)",duration:0.13,ease:"power2.in"},${f3(J[0] - 0.13)});`);
sfx(J[0] - 0.02, "whoosh_suave", -18, { why: "FULL → stage (zoom-jump)" });
// → STAGE: the plate rises behind him, his head breaks its top edge
js.push(`tl.set("#plate",{opacity:1},${f3(J[0])});`);
setS(J[0], 1, 1.0, "STAGE", `,filter:"blur(8px)"`);
js.push(`tl.to("#cam",{filter:"blur(0px)",duration:0.24,ease:"power3.out"},${f3(J[0])});`);
js.push(`tl.fromTo("#plate",{y:260,opacity:0},{y:0,opacity:1,duration:0.42,ease:"power3.out",immediateRender:false},${f3(J[0])});`);
js.push(`tl.fromTo("#fgclip",{y:120},{y:0,duration:0.36,ease:"power3.out",immediateRender:false},${f3(J[0])});`);
toS(J[0] + 0.05, 1, 1.04, 1.45);
setS(J[1], 2, 1.065); toS(J[1] + 0.03, 2, 1.1, 1.25);   // v3.3: smaller jump (1.04 → 1.065, was 1.08) toS(5.88, 2, 1.14, 0.26, "power3.out");
setS(J[2], 3, 1.02); toS(J[2] + 0.05, 3, 1.06, 3.1);
setS(J[3], 4, 1.1); toS(9.8, 4, 1.16, 0.24, "power3.out"); toS(10.1, 4, 1.15, 0.5);
setS(J[4], 5, 1.06); toS(J[4] + 0.05, 5, 1.02, 1.7);
setS(J[5], 6, 1.0); toS(J[5] + 0.05, 6, 1.05, 1.2); toS(13.64, 6, 1.1, 0.26, "power3.out");
setS(J[6], 7, 1.04); toS(J[6] + 0.05, 7, 1.07, 1.2); toS(15.8, 7, 1.11, 0.26, "power3.out");
setS(J[7], 8, 1.15); toS(J[7] + 0.05, 8, 1.1, 1.75);
setS(J[8], 9, 1.0); toS(J[8] + 0.05, 9, 1.06, 2.6);
setS(J[9], 10, 1.11, "GREEN"); toS(J[9] + 0.05, 10, 1.12, 1.05, "sine.inOut", "GREEN"); toS(22.74, 10, 1.16, 0.26, "power3.out", "GREEN"); toS(23.05, 10, 1.17, 1.0, "sine.inOut", "GREEN");
// TK.cutT (blur + brightness peak) on joins without a layout move, so the jump reads as an edit
// v3.3: give #fgclip an explicit neutral filter first. Without it GSAP tweened the FIRST cutT (J[1] = 4.60) from "none", which it
// reads as brightness(0): Walter went to a black silhouette for two frames (4.53, 4.57) — the "rough screen change" at 4-5 s.
js.push(`tl.set("#fgclip",{filter:"blur(0px) brightness(1)"},0);`);
[J[1], J[3], J[5], J[7], J[8]].forEach((t) => js.push(`TK.cutT(tl,"#fgclip",${f3(t)},${t === J[1] ? 0.5 : 0.7});`));

/* ── the living ground ──────────────────────────────────────────────────── */
js.push(`tl.fromTo("#world .b1",{x:-40,y:-30},{x:90,y:60,duration:${DUR},ease:"sine.inOut"},0);`);
js.push(`tl.fromTo("#world .b2",{x:60,y:0},{x:-80,y:-70,duration:${DUR},ease:"sine.inOut"},0);`);
js.push(`tl.fromTo("#world .b3",{x:0,y:40},{x:70,y:-50,duration:${DUR},ease:"sine.inOut"},0);`);
js.push(`tl.fromTo("#world .b4",{x:-30,y:0},{x:50,y:-40,duration:${DUR},ease:"sine.inOut"},0);`);
js.push(`tl.fromTo(".topo",{y:0,x:0},{y:-140,x:-50,duration:${DUR},ease:"none"},0);`);
js.push(`tl.fromTo(".gdots",{y:0},{y:-60,duration:${DUR},ease:"none"},0);`);
js.push(`tl.fromTo("#worldg .b1",{x:0,y:0,scale:1},{x:-80,y:50,scale:1.12,duration:${f3(DUR - J[9])},ease:"sine.inOut"},${f3(J[9])});`);
js.push(`tl.fromTo("#worldg .b2",{x:0,y:0},{x:70,y:-60,duration:${f3(DUR - J[9])},ease:"sine.inOut"},${f3(J[9])});`);
[1.6, 7.2, 12.8, 18.4].forEach((t) => js.push(`tl.fromTo("#world .beam",{xPercent:-130},{xPercent:130,duration:4.2,ease:"sine.inOut"},${f3(t)});`));
js.push(`tl.fromTo("#grain",{backgroundPosition:"0px 0px"},{backgroundPosition:"${384 * 7}px ${384 * 5}px",duration:${DUR},ease:"steps(${Math.round(DUR * 15)})"},0);`);
js.push(`tl.fromTo("#platebg",{scale:1.08},{scale:1.18,duration:${DUR},ease:"none"},0);`);
js.push(`tl.fromTo("#plate .rimglint",{xPercent:-100},{xPercent:520,duration:2.6,ease:"sine.inOut",repeat:${Math.floor((DUR - J[0]) / 3.4)},repeatDelay:0.8},${f3(J[0] + 0.5)});`);

/* ── icons (stroke SVG, currentColor) ─────────────────────────────────────── */
const ic = (d, cls = "ic") => `<svg viewBox="0 0 24 24" class="${cls}">${d}</svg>`;
const I = {
  lockBody: `<rect x="4.5" y="11" width="15" height="10" rx="2.4"/><path d="M12 15v2.5"/>`,
  shackle: `<path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>`,
  check: `<path d="M4 12.5l5 5L20 6.5"/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  retail: `<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>`,
  gaming: `<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><path d="M15.5 11.5h.01M18 13.5h.01" stroke-width="3"/>`,
  food: `<path d="M7 3v7.5a2 2 0 0 0 2 2V21M5 3v6M9 3v6"/><path d="M17.5 3c-2.2 2-2.2 7 0 8.5V21"/>`,
  travel: `<rect x="4" y="7.5" width="16" height="12.5" rx="2"/><path d="M9 7.5V4.5h6v3M9 11v5M15 11v5"/>`,
  media: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.2l5 2.8-5 2.8z"/>`,
  fashion: `<path d="M8.5 3.5 3.5 6.5l2 4 2.5-1V20.5h8V9.5l2.5 1 2-4-5-3a3.5 3.5 0 0 1-7 0z"/>`,
  banking: `<path d="M3 9.5 12 4.5l9 5z"/><path d="M5.5 10.5v7.5M10 10.5v7.5M14 10.5v7.5M18.5 10.5v7.5M3 20.5h18"/>`,
  health: `<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>`,
  insurance: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  legal: `<path d="M12 4v16M8 20.5h8M5 7h14"/><path d="M5 7l-3 6.5a3 3 0 0 0 6 0zM19 7l-3 6.5a3 3 0 0 0 6 0z"/>`,
  telecom: `<path d="M12 12.5V21"/><circle cx="12" cy="10.5" r="1.8"/><path d="M8.2 6.8a5.3 5.3 0 0 0 0 7.4M15.8 6.8a5.3 5.3 0 0 1 0 7.4M5.4 4a9.3 9.3 0 0 0 0 13M18.6 4a9.3 9.3 0 0 1 0 13"/>`,
  pharma: `<path d="M10.2 20.3a4.6 4.6 0 0 1-6.5-6.5l10.1-10.1a4.6 4.6 0 0 1 6.5 6.5z"/><path d="M8.8 8.8l6.4 6.4"/>`,
  ticket: `<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M13 7v10" stroke-dasharray="2 2"/>`,
  triage: `<path d="M4 6h16M7 12h10M10 18h4"/>`,
  escalate: `<path d="M12 20V5M6 11l6-6 6 6"/>`,
  shield: `<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>`,
  db: `<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-13M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8"/>`,
};

/* ── scene clips ──────────────────────────────────────────────────────────── */
let track = 3;
const clip = (id, a, b, inner, { cls = "front", attrs = "" } = {}) =>
  `<div id="${id}" class="ov clip escena ${cls}" data-start="${f3(a)}" data-duration="${f3(b - a)}" data-track-index="${track++}"${attrs}>${inner}</div>`;
const ov = [];
const OK = ` data-qc-cara-ok data-qc-banda-ok`;
const zone = (inner) => `<div class="zone" style="left:${Z.x}px;top:${Z.y}px;width:${Z.w}px;height:${Z.h}px">${inner}</div>`;
// micro-motion: every zone breathes (scale 1 → 1.02) so nothing on the board is ever still
const breathe = (id, a, b, s = 1.02, s0 = 1) => js.push(`tl.fromTo("#${id} .zone",{scale:${s0}},{scale:${s},duration:${f3(b - a)},ease:"sine.inOut",transformOrigin:"50% 50%"},${f3(a)});`);

/* ── the board: one anchored stage for every explainer (kicker, corner marks, dot grid, live pip) ── */
const kick = Object.entries(CONFIG.kickers);
const KT = { S02: J[0], S03: J[1], S04: J[2], S06: J[4], S07: J[5], S08: J[6] };
const boardHtml = `<div id="board" class="clip front" data-start="${f3(J[0])}" data-duration="${f3(J[9] - J[0])}" data-track-index="${track++}">
  <div class="bsurf"><i class="bdots"></i><i class="bglint"></i></div>
  <i class="reg r1"></i><i class="reg r2"></i><i class="reg r3"></i><i class="reg r4"></i>
  <div class="kick"><i class="kdot"></i><span class="kw">${kick.map(([k, v]) => `<b class="k-${k}">${v}</b>`).join("")}</span></div>
  <div class="kcredit">${CONFIG.ui.credit}</div>
  <i class="pip"></i></div>`;
js.push(`tl.set("#board",{opacity:0},0);`);
js.push(`TK.tkIn(tl,"#board",${f3(J[0] + 0.02)});`);
js.push(`tl.fromTo("#board .bglint",{xPercent:-120},{xPercent:620,duration:1.4,ease:"sine.inOut",repeat:4,repeatDelay:2.4},${f3(J[0] + 0.6)});`);
js.push(`tl.fromTo("#board .pip",{scale:0.7,opacity:0.5},{scale:1.25,opacity:1,duration:0.6,ease:"sine.inOut",yoyo:true,repeat:${Math.floor((J[9] - J[0]) / 0.6)}},${f3(J[0])});`);
kick.forEach(([k], q) => {
  const a = KT[k], b = q + 1 < kick.length ? KT[kick[q + 1][0]] : J[9];
  js.push(`tl.fromTo("#board .k-${k}",{opacity:0,y:18,filter:"blur(6px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.26,ease:"power3.out"},${f3(a + 0.04)});`);
  js.push(`tl.to("#board .k-${k}",{opacity:0,y:-14,duration:0.12,ease:"power2.in"},${f3(b - 0.12)});`);
});
js.push(`tl.fromTo("#board .kcredit",{opacity:0},{opacity:1,duration:0.2,ease:"none"},${f3(J[6] + 0.05)});`);
js.push(`TK.tkOut(tl,"#board",${f3(J[9] - 0.24)});`);

// S01 (FULL → paper, BEHIND him) — the hero number. Odometer reels spin in behind his head over the street; on "million" (1.08)
// a paper flood dissolves the street from behind his head, the reels land left→right with a punch-in and the hero boom; a sheen
// crosses the settled number; "in one month" fills a lime track.
const NUM = "$1,000,000";
let reelIdx = 0;
const reels = [...NUM].map((ch) => {
  if (!/\d/.test(ch)) return `<span class="sym">${ch}</span>`;
  const d = +ch, seq = [...Array(10).keys(), ...Array.from({ length: d + 1 }, (_, k) => k)];
  return `<span class="reel"><span class="strip st${reelIdx++}">${seq.map((k) => `<i>${k}</i>`).join("")}</span></span>`;
}).join("");
ov.push(clip("S01", 0, J[0], `<div class="hero h1">
  <i class="glow"></i>
  <div class="month"><span class="mpill">${ic(I.calendar)}<b>in one month</b></span><span class="mtrack"><i class="mfill"></i><i class="mhead"></i></span></div>
  <div class="numwrap"><div class="num ghost">${NUM}</div><div class="num reels">${reels}</div><div class="num shine">${NUM}</div></div>
  <i class="nul"></i></div>`, { cls: "behind", attrs: OK }));
js.push(`tl.fromTo("#S01 .numwrap",{opacity:0,scale:1.18,filter:"blur(16px)"},{opacity:1,scale:1,filter:"blur(0px)",duration:0.5,ease:"power3.out"},0.5);`);
[...NUM].filter((c) => /\d/.test(c)).forEach((c, k) => {
  const n = 10 + +c + 1, land = 1.08 + k * 0.045;
  js.push(`tl.fromTo("#S01 .st${k}",{yPercent:0},{yPercent:${(-(n - 1) / n * 100).toFixed(4)},duration:${f3(land - 0.5)},ease:"power3.inOut"},0.5);`);
  js.push(`tl.fromTo("#S01 .st${k}",{filter:"blur(5px)"},{filter:"blur(0px)",duration:0.2,ease:"power2.out",immediateRender:false},${f3(land - 0.12)});`);
});
js.push(`tl.fromTo("#S01 .ghost",{opacity:0,x:0,y:0},{opacity:1,x:10,y:12,duration:0.3,ease:"power3.out"},1.36);`);
js.push(`tl.set("#S01 .reels",{opacity:0},1.5);tl.set("#S01 .shine",{opacity:1},1.5);`);
js.push(`tl.fromTo("#S01 .shine",{backgroundPosition:"100% 0%"},{backgroundPosition:"0% 0%",duration:0.9,ease:"sine.inOut"},1.5);`);
js.push(`tl.fromTo("#S01 .glow",{opacity:0,scale:0.6},{opacity:1,scale:1,duration:0.4,ease:"power3.out"},1.06);tl.to("#S01 .glow",{scale:1.12,opacity:0.75,duration:1.5,ease:"sine.inOut"},1.46);`);
js.push(`tl.fromTo("#S01 .nul",{scaleX:0},{scaleX:1,duration:0.36,ease:"power3.out"},1.2);`);
js.push(`tl.fromTo("#S01 .month",{opacity:0,y:20,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.28,ease:"power3.out"},1.9);`);
js.push(`tl.fromTo("#S01 .mfill",{scaleX:0},{scaleX:1,duration:0.7,ease:"power1.inOut"},2.14);tl.fromTo("#S01 .mhead",{x:0},{x:416,duration:0.7,ease:"power1.inOut"},2.14);`);
js.push(`tl.fromTo("#S01 .hero",{y:0},{y:-24,duration:${f3(J[0])},ease:"sine.inOut"},0);`);
js.push(`tl.fromTo("#win",{"--fr":"0px"},{"--fr":"1900px",duration:0.42,ease:"power2.in"},0.9);`);
js.push(`tl.set("#win",{opacity:0},1.33);`);
sfx(0.5, "whoosh_brillo", -26, { why: "reels start spinning behind him" });
[0.62, 0.74, 0.86, 0.96, 1.08, 1.13, 1.17, 1.22, 1.26, 1.31].forEach((t) => sfx(t, "click_soft", -32, { why: "reel tick" }));
sfx(1.08, "riser", -16, { why: "riser peaks on million", hero: true });
sfx(1.08, "boom_medio", -9, { align: "inicio", largo: 1.6, why: "HERO hit on million (flood + reels land)", hero: true });
sfx(1.0, "whoosh_suave", -18, { why: "paper flood" });
sfx(1.52, "shimmer", -22, { why: "sheen crosses the number", hero: true });
sfx(1.92, "pop_soft", -26, { why: "one-month pill" });
[2.2, 2.45, 2.7].forEach((t) => sfx(t, "click_soft", -32, { why: "month track fills" }));

// S02 (STAGE) — "You get your private data,": a vault with real depth; the dial ring fills, the shackle lifts on "private" (3.72),
// and the five places this data already lives slide out as layered cards on the grid.
const toolCard = (t, k) => `<div class="tcard t${k}"><span class="tlogo"><img src="${t.src}" alt="${t.name}" style="height:${t.h}px">${t.text ? `<span>${t.text}</span>` : ""}</span><span class="ttag">${ic(I.lockBody + I.shackle)}private</span><i class="tdot"></i></div>`;
const tools = CONFIG.tools.map(toolCard).join("");
const CT = (k) => 8 + k * 116;
ov.push(clip("S02", J[0], J[1], zone(`
  <div class="vault"><div class="vback"></div><div class="vbody"><i class="vbevel"></i>
    <svg viewBox="0 0 200 200" class="dial"><circle class="dring" cx="100" cy="100" r="78"/><circle class="dprog" cx="100" cy="100" r="78"/>
      ${Array.from({ length: 24 }, (_, k) => { const a = k / 24 * Math.PI * 2, r0 = 62, r1 = k % 6 ? 68 : 72; return `<line x1="${(100 + r0 * Math.sin(a)).toFixed(1)}" y1="${(100 - r0 * Math.cos(a)).toFixed(1)}" x2="${(100 + r1 * Math.sin(a)).toFixed(1)}" y2="${(100 - r1 * Math.cos(a)).toFixed(1)}"/>`; }).join("")}</svg>
    <svg viewBox="0 0 24 24" class="lock"><g class="shk">${I.shackle}</g>${I.lockBody}</svg>
    <div class="vplate"><i></i><i></i><i></i></div></div><i class="vhandle"></i></div>
  <div class="stack">${tools}</div>`), { attrs: OK }));
js.push(`tl.fromTo("#S02 .vault",{opacity:0,y:60,scale:0.94},{opacity:1,y:0,scale:1,duration:0.36,ease:"power3.out"},${f3(J[0] + 0.06)});`);
js.push(`tl.fromTo("#S02 .dprog",{strokeDashoffset:490},{strokeDashoffset:0,duration:0.6,ease:"power2.inOut"},${f3(J[0] + 0.1)});`);
js.push(`tl.fromTo("#S02 .vplate i",{scaleX:0},{scaleX:1,duration:0.3,ease:"power3.out",stagger:0.08},${f3(J[0] + 0.3)});`);
js.push(`tl.to("#S02 .shk",{y:-3.4,duration:0.12,ease:"power3.out"},3.72);`);
js.push(`tl.to("#S02 .lock",{color:"var(--lime)",duration:0.1,ease:"none"},3.72);`);
js.push(`tl.to("#S02 .vhandle",{x:-14,duration:0.2,ease:"power3.out"},3.72);`);
CONFIG.tools.forEach((t, k) => { const at = 3.86 + k * 0.09;
  js.push(`tl.fromTo("#S02 .t${k}",{opacity:0,x:-260,filter:"blur(8px)"},{opacity:1,x:0,filter:"blur(0px)",duration:0.3,ease:"power3.out"},${f3(at)});`);
  js.push(`tl.fromTo("#S02 .t${k} .tdot",{scale:0},{scale:1,duration:0.18,ease:"power3.out"},${f3(at + 0.22)});`);
  sfx(at + 0.06, "pop_soft", -30, { why: `card ${t.name}` }); });
breathe("S02", J[0], J[1]);
sfx(3.72, "click", -24, { why: "shackle lifts on private" });
sfx(3.8, "whoosh_corto", -26, { why: "cards slide out of the vault" });
// v3.3 (Walter: rough screen change at 4-5 s): the vault leaves IN the pause after "data" (4.44–4.72) instead of vanishing on the
// join (4.60): it slides back into the board with a blur while the cards stay put, so S03 opens on what is already there.
js.push(`tl.to("#S02 .vault",{x:-70,scale:0.94,opacity:0,filter:"blur(8px)",duration:0.24,ease:"power2.in"},4.44);`);
sfx(4.44, "whoosh_suave", -28, { why: "vault slides away in the pause (S02 → S03)" });

// S03 (STAGE) — "and you sell to an AI frontier lab.": the cards fold into one dataset capsule, it runs a drawn lime route up
// into the 2x2 of lab cards; on "lab" (5.92) the grid locks (lime rim + checks) and the neutral label lands.
const labs = CONFIG.labs.map((l, k) => `<div class="lcard l${k}"><img src="${l.src}" alt="${l.name}" style="height:${l.h}px"><i class="lchk">${ic(I.check)}</i></div>`).join("");
ov.push(clip("S03", J[1], J[2], zone(`
  <div class="stack">${tools}</div>
  <svg class="route" viewBox="0 0 ${Z.w} ${Z.h}"><path class="rbase" d="M468 528 C 468 450, 468 410, 468 350"/><path class="rlive" d="M468 528 C 468 450, 468 410, 468 350"/></svg>
  <div class="capsule"><i class="cstripes"></i>${ic(I.db)}<b>your data</b></div>
  <div class="labs slots">${CONFIG.labs.map(() => `<i class="slot"></i>`).join("")}</div><div class="labs">${labs}<i class="lring"></i></div>
  <div class="lablbl">${CONFIG.labsLabel}</div>`), { attrs: OK }));
js.push(`tl.to("#S03 .tcard",{x:-180,y:(i)=>[452,336,220,104,-12][i],scale:0.5,opacity:0,duration:0.24,ease:"power2.in",stagger:0.025},${f3(J[1] + 0.02)});`);
js.push(`tl.fromTo("#S03 .slot",{opacity:0,scale:0.92},{opacity:1,scale:1,duration:0.26,ease:"power3.out",stagger:0.05},${f3(J[1] + 0.1)});`);
js.push(`tl.fromTo("#S03 .capsule",{opacity:0,scale:0.6},{opacity:1,scale:1,duration:0.26,ease:"power3.out"},4.74);`);
js.push(`tl.fromTo("#S03 .cstripes",{backgroundPosition:"0px 0px"},{backgroundPosition:"120px 0px",duration:1.2,ease:"none"},4.74);`);
js.push(`tl.fromTo("#S03 .rbase",{strokeDashoffset:200},{strokeDashoffset:0,duration:0.32,ease:"power2.inOut"},4.86);`);
js.push(`tl.fromTo("#S03 .rlive",{strokeDashoffset:200},{strokeDashoffset:-200,duration:0.6,ease:"power1.inOut"},5.1);`);
js.push(`tl.to("#S03 .capsule",{y:-170,scale:0.62,duration:0.32,ease:"power2.in"},5.12);tl.to("#S03 .capsule",{opacity:0,duration:0.1,ease:"power2.in"},5.38);`);
CONFIG.labs.forEach((l, k) => { const at = 5.3 + k * 0.1;
  js.push(`tl.fromTo("#S03 .l${k}",{opacity:0,y:-36,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.3,ease:"power3.out"},${f3(at)});`);
  js.push(`tl.fromTo("#S03 .l${k} .lchk",{scale:0,opacity:0},{scale:1,opacity:1,duration:0.18,ease:"power3.out"},${f3(5.96 + k * 0.05)});`);
  sfx(at + 0.05, "pop_soft", -30, { why: `lab card ${l.name}` }); });
js.push(`tl.fromTo("#S03 .lring",{opacity:0,scale:1.04},{opacity:1,scale:1,duration:0.24,ease:"power3.out"},5.92);`);
js.push(`tl.fromTo("#S03 .lablbl",{opacity:0,y:12},{opacity:1,y:0,duration:0.22,ease:"power3.out"},5.98);`);
js.push(`tl.to("#S03 .zone",{y:-50,opacity:0,filter:"blur(8px)",duration:0.16,ease:"power2.in"},${f3(J[2] - 0.16)});`);
breathe("S03", J[1], J[2], 1.04, 1.02);   // v3.3: continue S02's breathe (it ends at 1.02) so the shared tool cards don't jump 2 % at the join
sfx(5.12, "whoosh_corto", -22, { why: "capsule runs the route" });
sfx(5.92, "boom_seco", -18, { align: "inicio", largo: 0.5, why: "the grid locks on lab" });

// S04+S05 (STAGE) — 12 industries on a 4x3 grid; on "only" the six unregulated slide out, the regulated six regroup bigger with a
// shield badge; on "regulated" (9.82) the HIGHLY REGULATED stamp slams in (TK.tkIn), a paper flash, and the ground behind him floods mint.
const IND = [["retail", 0], ["banking", 1], ["gaming", 0], ["health", 1], ["food", 0], ["insurance", 1],
             ["legal", 1], ["travel", 0], ["telecom", 1], ["media", 0], ["pharma", 1], ["fashion", 0]];
const LBL = { health: "healthcare" };
const TW = 222, TH = 188, TG = 16, TY0 = Math.round((Z.h - (3 * TH + 2 * TG)) / 2);
const RS = 1.35, RW = Math.round(TW * RS), RH = Math.round(TH * RS), RG = Math.round((Z.w - 3 * RW) / 2), RY0 = Math.round((Z.h - (2 * RH + 22)) / 2);
let ri = 0;
const tiles = IND.map(([n, reg], k) => {
  const c = k % 4, r = Math.floor(k / 4), x = c * (TW + TG), y = TY0 + r * (TH + TG);
  const fin = reg ? (() => { const q = ri++; return { x: (q % 3) * (RW + RG), y: RY0 + Math.floor(q / 3) * (RH + 22) }; })() : null;
  return { n, reg, k, c, x, y, fin };
});
ov.push(clip("S04", J[2], J[4], zone(`<div class="clipz">
  ${tiles.map((t) => `<div class="tile ti${t.k}${t.reg ? " reg" : ""}" style="left:${t.x}px;top:${t.y}px;width:${TW}px;height:${TH}px"><i class="bar"></i><span class="tic">${ic(I[t.n])}</span><span class="tl">${LBL[t.n] || t.n}</span>${t.reg ? `<i class="badge">${ic(I.shield)}</i>` : ""}</div>`).join("")}
  <div class="stampw"><div class="stamp"><i class="sline"></i>highly regulated<i class="sline"></i></div></div>
  <div class="flash"></div></div>`), { attrs: OK }));
js.push(`tl.fromTo("#S04 .tile",{opacity:0,y:50,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.26,ease:"power3.out",stagger:0.02},${f3(J[2] + 0.02)});`);
tiles.filter((t) => !t.reg).forEach((t, q) => {
  const at = 6.68 + q * 0.1, dx = t.c < 2 ? -1100 : 1100;
  js.push(`tl.to("#S04 .ti${t.k}",{x:${dx},filter:"blur(8px)",duration:0.3,ease:"power2.in"},${f3(at)});`);
  js.push(`tl.set("#S04 .ti${t.k}",{opacity:0},${f3(at + 0.3)});`);
  sfx(at + 0.12, "click_soft", -34, { why: "tile out" });
});
tiles.filter((t) => t.reg).forEach((t) => js.push(`tl.to("#S04 .ti${t.k}",{x:${t.fin.x - t.x},y:${t.fin.y - t.y},scale:${RS},transformOrigin:"0px 0px",duration:0.44,ease:"power3.inOut"},7.4);`));
sfx(7.55, "whoosh_suave", -22, { why: "the regulated six regroup" });
js.push(`tl.fromTo("#S04 .reg .bar",{scaleX:0},{scaleX:1,duration:0.3,ease:"power3.out",stagger:0.2},8.0);`);
js.push(`tl.fromTo("#S04 .reg .badge",{scale:0,opacity:0},{scale:1,opacity:1,duration:0.2,ease:"power3.out",stagger:0.2},8.05);`);
js.push(`tl.fromTo("#S04 .reg .tic",{backgroundPosition:"0% 0%"},{backgroundPosition:"100% 100%",duration:2,ease:"sine.inOut",stagger:0.1},8.0);`);
js.push(`TK.tkIn(tl,"#S04 .stamp",9.62);`);
js.push(`tl.fromTo("#S04 .stamp .sline",{scaleX:0},{scaleX:1,duration:0.3,ease:"power3.out"},9.84);`);
js.push(`tl.to("#S04 .reg",{opacity:0.4,filter:"blur(2px)",duration:0.2,ease:"power2.out"},9.7);`);
js.push(`tl.set("#S04 .flash",{opacity:0.85},9.82);tl.set("#S04 .flash",{opacity:0},9.887);`);
js.push(`TK.flood(tl,"#worldm",9.78,0.5,${(HEAD[4].cx / W * 100).toFixed(0)},52);`);
js.push(`tl.to("#worldm",{opacity:0,duration:0.4,ease:"power1.inOut"},${f3(J[4] - 0.3)});`);
breathe("S04", J[2], J[4], 1.025);
sfx(9.82, "boom_medio", -12, { align: "inicio", largo: 1.0, why: "stamp slam on regulated", hero: true });

// S06 (STAGE) — "or companies that have specific workflows": a ticket token runs a drawn workflow on the grid,
// ticket in → triage → escalate → resolve; each node lights as the token reaches it, the last goes lime on "workflows" (11.92).
const NW = 430, NH = 150, NY0 = 70, NY1 = 380;
const NODES = [["ticket in", "ticket", 0, NY0], ["triage", "triage", Z.w - NW, NY0], ["escalate", "escalate", Z.w - NW, NY1], ["resolve", "check", 0, NY1]];
const ctr = (n) => [n[2] + NW - 18, n[3] + 18];
const NT = [10.78, 11.16, 11.54, 11.92];
const WP = [`M${NW} ${NY0 + NH / 2} H ${Z.w - NW}`, `M${Z.w - NW / 2} ${NY0 + NH} V ${NY1}`, `M${Z.w - NW} ${NY1 + NH / 2} H ${NW}`];
ov.push(clip("S06", J[4], J[5], zone(`
  <svg class="wire" viewBox="0 0 ${Z.w} ${Z.h}">${WP.map((d) => `<path class="wb" d="${d}"/>`).join("")}${WP.map((d, k) => `<path class="w w${k + 1}" d="${d}"/>`).join("")}</svg>
  ${NODES.map(([l, icn, x, y], k) => `<div class="node n${k}" style="left:${x}px;top:${y}px"><span class="nic">${ic(I[icn])}</span><span class="nl">${l}</span><i class="nring"></i></div>`).join("")}
  <div class="token">${ic(I.ticket)}</div>`), { attrs: OK }));
NT.forEach((t, k) => {
  js.push(`tl.fromTo("#S06 .n${k}",{opacity:0,y:24,filter:"blur(6px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.22,ease:"power3.out"},${f3(t - 0.08)});`);
  js.push(`tl.fromTo("#S06 .n${k} .nring",{opacity:0},{opacity:1,duration:0.12,ease:"none"},${f3(t)});`);
  if (k) js.push(`tl.to("#S06 .n${k - 1} .nring",{opacity:0,duration:0.2,ease:"none"},${f3(t)});`);
  if (k < 3) js.push(`tl.fromTo("#S06 .w${k + 1}",{strokeDashoffset:400},{strokeDashoffset:0,duration:0.3,ease:"power2.inOut"},${f3(t + 0.04)});`);
  sfx(t, "click_soft", -30, { why: `node ${NODES[k][0]}` });
});
{ const P = NODES.map(ctr); js.push(`tl.set("#S06 .token",{x:${P[0][0] - 34},y:${P[0][1] - 34},opacity:0},${f3(J[4])});tl.to("#S06 .token",{opacity:1,duration:0.12},10.8);`);
  for (let k = 1; k < 4; k++) js.push(`tl.to("#S06 .token",{x:${P[k][0] - 34},y:${P[k][1] - 34},duration:0.3,ease:"power2.inOut"},${f3(NT[k] - 0.3)});`); }
js.push(`tl.to("#S06 .n3",{backgroundColor:"var(--lime)",duration:0.16,ease:"none"},11.92);tl.to("#S06 .token",{opacity:0,scale:0.4,duration:0.16},11.95);`);
breathe("S06", J[4], J[5]);
sfx(11.92, "chime", -26, { why: "resolve lights lime on workflows" });

// S07 (STAGE) — DEPTH = STRATA: a window into the ground; the camera dives through textured layers, speeds up on "depth" (13.04),
// lands on the lime vein on "data" (13.68): the vein flares, sparks, a light sweep.
const STRATA_H = 250, VEIN_H = 360, COL_H = CONFIG.strata.length * STRATA_H + VEIN_H, DIVE = COL_H - Z.h;
ov.push(clip("S07", J[5], J[6], zone(`<div class="strataw"><div class="col">
  ${CONFIG.strata.map((s, k) => `<div class="stratum s${k}"><i class="stex"></i><span>${s}</span></div>`).join("")}
  <div class="rock"><i class="stex"></i><svg viewBox="0 0 936 160" class="vein"><path class="vg" d="M0 84 C 160 40, 300 126, 468 78 S 790 40, 936 92"/><path class="vc" d="M0 84 C 160 40, 300 126, 468 78 S 790 40, 936 92"/></svg>
    ${Array.from({ length: 9 }, (_, k) => `<i class="spark sp${k}" style="left:${60 + k * 102}px;top:${150 + ((k * 37) % 70)}px"></i>`).join("")}<i class="sweep"></i></div></div></div>`), { attrs: OK }));
js.push(`tl.fromTo("#S07 .col",{y:0},{y:-220,duration:${f3(13.04 - J[5] - 0.03)},ease:"sine.in"},${f3(J[5] + 0.03)});`);
js.push(`tl.to("#S07 .col",{y:${-DIVE},duration:0.62,ease:"power2.in"},13.04);`);
js.push(`tl.to("#S07 .col",{filter:"blur(6px)",duration:0.3,ease:"power2.in",yoyo:true,repeat:1},13.06);`);
js.push(`tl.fromTo("#S07 .vc",{strokeWidth:18},{strokeWidth:34,duration:0.22,ease:"power3.out"},13.68);`);
js.push(`tl.fromTo("#S07 .vg",{opacity:0.25,strokeWidth:40},{opacity:0.7,strokeWidth:90,duration:0.3,ease:"power3.out"},13.68);`);
js.push(`tl.fromTo("#S07 .spark",{scale:0,opacity:0},{scale:1,opacity:1,duration:0.2,ease:"power3.out",stagger:0.03},13.7);tl.to("#S07 .spark",{opacity:0.3,y:-20,duration:0.6,ease:"sine.out",stagger:0.03},13.92);`);
js.push(`tl.fromTo("#S07 .sweep",{xPercent:-120},{xPercent:620,duration:0.7,ease:"sine.inOut"},13.72);`);
js.push(`tl.fromTo("#S07 .rock .stex",{x:0},{x:-60,duration:0.8,ease:"sine.out"},13.68);`);
js.push(`tl.to("#S07 .zone",{y:-70,opacity:0,filter:"blur(8px)",duration:0.13,ease:"power2.in"},${f3(J[6] - 0.13)});`);
breathe("S07", J[5], J[6]);
sfx(13.06, "whoosh_suave", -20, { why: "the dive" });
sfx(13.68, "boom_seco", -16, { align: "inicio", largo: 0.6, why: "lands on the vein (data)" });
sfx(13.72, "shimmer", -28, { why: "vein sparks" });

// S08–S10 (STAGE) — ONE real window (Intercom product-page screenshots, as captured, credited in the board header):
//   S08 the inbox; on "tickets" (15.28) it zooms into the queue with motion blur; on "customer" (15.82) a hard cut inside the window to
//   the real conversation, messages arriving one by one. S09 a lime highlighter reads it while the lab row docks. S10 pull back:
//   the thread as a journey, nodes tick down a lime line, the last check on "customers" (21.0).
const WZ = { x: 64, y: 140, w: 952, h: 610 };
const U = CONFIG.ui, cov = WZ.h / U.inboxH, covX = (WZ.w - U.inboxW * cov) / 2;
const listCx = 728;
const BANDS = [[20, 192], [195, 530], [535, 668], [672, 806], [810, 975]];
const ARR = [15.84, 16.16, 16.48, 16.8, 17.12];
const HLS = [[238, 565, 828, 600, 17.34, 0.32], [92, 703, 273, 738, 17.7, 0.2], [187, 840, 793, 876, 17.95, 0.35], [187, 875, 641, 910, 18.32, 0.3]];
const CS = 0.6, CX = 330, CY = 12;
// v3.3 (box-overlap gate): the "resolved" check used to sit 31 px under the "details" node (labels and dots collided). Now the rail
// ends ON the last node and at 20.98 that node turns into the lime check in place ("details" → "resolved").
const JN = [[105, 19.2, "first message"], [600, null, "reply"], [895, null, "details"]];
const jy = (cy) => CY + cy * CS, J0y = jy(105), JF = jy(895), JFILL = 1.4;
JN.forEach((n) => { n[3] = jy(n[0]); n[1] = n[1] || +(19.2 + (n[3] - J0y) / (JF - J0y) * JFILL).toFixed(3); });
const chatImg = `<img src="${U.chat}" alt="Intercom conversation (product page screenshot)" style="width:${U.chatW}px;height:${U.chatH}px">`;
ov.push(clip("S08", J[6], J[9], `
  <div class="win2"><div class="wbody">
    <div class="scrA"><img src="${U.inbox}" alt="Intercom inbox (product page screenshot)" style="width:${U.inboxW}px;height:${U.inboxH}px"></div>
    <div class="scrB">${BANDS.map(([a, b], k) => `<div class="band b${k}" style="top:${a}px;height:${b - a}px"><div style="position:absolute;left:0;top:${-a}px">${chatImg}</div></div>`).join("")}
      ${HLS.map(([x0, y0, x1, y1], k) => `<i class="hlb h${k}" style="left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px"></i>`).join("")}</div>
    <div class="dock"><span class="dlbl">${CONFIG.labsLabel}</span><div class="dlogos">${CONFIG.labs.map((l) => `<img src="${l.src}" alt="${l.name}" style="height:${Math.round(l.h * 0.66)}px">`).join("")}</div></div>
    <div class="journey"><i class="rail0"></i><i class="fill"></i>
      ${JN.map(([, , l, y], k) => `<span class="jn j${k}" style="top:${y}px"></span><span class="jl jl${k}" style="top:${y}px">${l}</span>`).join("")}
      <span class="jn jf" style="top:${JF}px">${ic(I.check)}</span><span class="jl jlf" style="top:${JF}px">resolved</span></div>
  </div><i class="wrim"></i><i class="glint g1"></i><i class="glint g2"></i></div>`, { attrs: OK }));
js.push(`tl.fromTo("#S08 .win2",{y:120,opacity:0,scale:0.96},{y:0,opacity:1,scale:1,duration:0.34,ease:"power3.out"},${f3(J[6])});`);
js.push(`tl.set("#S08 .scrA",{transformOrigin:"0px 0px",scale:${cov.toFixed(4)},x:${covX.toFixed(1)},y:0},${f3(J[6])});`);
js.push(`tl.to("#S08 .scrA",{scale:${(cov * 1.05).toFixed(4)},x:${(covX - U.inboxW * cov * 0.025).toFixed(1)},y:${(-U.inboxH * cov * 0.025).toFixed(1)},duration:0.76,ease:"sine.inOut"},${f3(J[6] + 0.02)});`);
js.push(`tl.to("#S08 .scrA",{scale:1,x:${(WZ.w / 2 - listCx).toFixed(1)},y:0,duration:0.3,ease:"power3.inOut"},15.28);`);
js.push(`tl.to("#S08 .scrA",{filter:"blur(6px)",duration:0.15,ease:"power2.in",yoyo:true,repeat:1},15.28);`);
js.push(`tl.to("#S08 .scrA",{y:-40,duration:0.24,ease:"sine.inOut"},15.58);`);
js.push(`tl.set("#S08 .scrA",{opacity:0},15.82);tl.set("#S08 .scrB",{opacity:1,transformOrigin:"0px 0px",x:${(WZ.w - U.chatW) / 2},y:0,scale:1},15.82);`);
ARR.forEach((t, k) => { js.push(`tl.fromTo("#S08 .b${k}",{opacity:0,y:26},{opacity:1,y:0,duration:0.24,ease:"power3.out"},${f3(t)});`);
  sfx(t + 0.05, "pop_soft", -32, { why: `message ${k + 1} arrives` }); });
js.push(`tl.to("#S08 .scrB",{y:${-(U.chatH - WZ.h + 16)},duration:0.68,ease:"power2.inOut"},16.62);`);
HLS.forEach(([, , , , t, d], k) => { js.push(`tl.fromTo("#S08 .h${k}",{scaleX:0},{scaleX:1,duration:${d},ease:"power1.inOut"},${f3(t)});`); });
sfx(17.34, "click", -30, { why: "highlighter starts" });
js.push(`tl.set("#S08 .dock",{yPercent:-110},${f3(J[6])});`);
js.push(`tl.fromTo("#S08 .dock",{yPercent:-110},{yPercent:0,duration:0.3,ease:"power3.out"},17.56);`);
js.push(`tl.to("#S08 .dock",{yPercent:-110,duration:0.22,ease:"power2.in"},18.86);`);
js.push(`tl.to("#S08 .scrB",{x:${CX},y:${CY},scale:${CS},duration:0.55,ease:"power2.inOut"},18.9);`);
js.push(`tl.fromTo("#S08 .rail0",{opacity:0},{opacity:1,duration:0.2,ease:"none"},19.0);`);
js.push(`tl.fromTo("#S08 .fill",{scaleY:0},{scaleY:1,duration:${JFILL},ease:"none"},19.2);`);
JN.forEach(([, t], k) => { js.push(`tl.fromTo("#S08 .j${k}, #S08 .jl${k}",{opacity:0,scale:0.5},{opacity:1,scale:1,duration:0.2,ease:"power3.out"},${f3(t)});`);
  sfx(t, "click_soft", -30, { why: `journey node ${k + 1}` }); });
js.push(`tl.to("#S08 .j2, #S08 .jl2",{opacity:0,duration:0.14,ease:"power2.in"},20.98);`);
js.push(`tl.fromTo("#S08 .jf, #S08 .jlf",{opacity:0,scale:0.5},{opacity:1,scale:1,duration:0.22,ease:"power3.out"},20.98);`);
js.push(`tl.set(["#S08 .g1","#S08 .g2"],{opacity:0,xPercent:-100},${f3(J[6])});`);
[[J[6] + 0.2, "g1"], [17.1, "g2"], [19.05, "g1"], [20.2, "g2"]].forEach(([t, g]) =>
  js.push(`tl.fromTo("#S08 .${g}",{xPercent:-100,opacity:1},{xPercent:${Math.round(WZ.w / 2)},duration:0.85,ease:"sine.inOut"},${f3(t)});`));
js.push(`tl.fromTo("#S08 .wbody",{scale:1},{scale:1.015,duration:${f3(J[9] - J[6])},ease:"sine.inOut",transformOrigin:"50% 50%"},${f3(J[6])});`);
js.push(`tl.to("#S08 .win2",{opacity:0,scale:0.96,filter:"blur(10px)",duration:0.2,ease:"power2.in"},${f3(J[9] - 0.22)});`);
sfx(15.3, "whoosh_corto", -22, { why: "zoom into the queue on tickets" });
sfx(15.82, "whoosh_corto", -24, { why: "hard cut inside the window" });
sfx(17.62, "shimmer", -28, { why: "the highlighter reads" });
sfx(17.56, "pop_soft", -30, { why: "lab row docks" });
sfx(21.0, "chime", -22, { why: "resolved check on customers" });

// S11 (GREEN, BEHIND him) — the ground floods green from behind his head (TK.flood) in the pause; the tool logos + regulated icons
// line up on the grid, then on "goldmine" (22.78) they collapse into the number: the $1,000,000 slams back huge behind his head,
// a lime ripple rings out through the topographic lines, the sheen crosses it; QMD wordmark holds to the end.
const FALL = CONFIG.tools.map((t, k) => `<div class="fc f${k}"><img src="${t.src}" alt="${t.name}" style="height:${Math.round(t.h * 0.8)}px">${t.text ? `<span>${t.text}</span>` : ""}</div>`)
  .concat(["banking", "health", "insurance"].map((n, q) => `<div class="fc ft f${5 + q}">${ic(I[n])}</div>`));
// v3.3 (Walter's screenshot: the icon tiles fell into the empty row-2 slot and hung between the cards): a centred 3 · 2 · 3 grid,
// 24 px gutters everywhere — row 1 three tool cards, row 2 two tool cards, row 3 the three regulated icons as equal 96 px tiles.
const GUT = 24, CW = 320, CH = 96, IW = 96, rowX = (n, w) => Array.from({ length: n }, (_, q) => Math.round((W - (n * w + (n - 1) * GUT)) / 2 + q * (w + GUT)));
const GY = [300, 300 + CH + GUT, 300 + 2 * (CH + GUT)];
const FX0 = [...rowX(3, CW).map((x) => [x, GY[0]]), ...rowX(2, CW).map((x) => [x, GY[1]]), ...rowX(3, IW).map((x) => [x, GY[2]])];
ov.push(clip("S11", J[9], DUR, `<div class="hero h11">
  <img class="wm" src="assets/logos/qmd-wordmark-white.svg" alt="QuoteMyData">
  <i class="glow g11"></i><i class="ripple"></i>
  <div class="numwrap"><div class="num ghost">${NUM}</div><div class="num shine s11">${NUM}</div></div>
  <div class="falls">${FALL.map((f, k) => f.replace('class="fc', `style="left:${FX0[k][0]}px;top:${FX0[k][1]}px" class="fc`)).join("")}</div></div>`, { cls: "behind", attrs: OK }));
js.push(`TK.flood(tl,"#worldg",${f3(J[9] - 0.24)},0.5,${(HEAD[10].cx / W * 100).toFixed(0)},50);`);
FALL.forEach((f, k) => { const at = 21.74 + k * 0.06, wv = k >= 5 ? 96 : 320;
  js.push(`tl.fromTo("#S11 .f${k}",{opacity:0,y:60,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.26,ease:"power3.out"},${f3(at)});`);
  js.push(`tl.to("#S11 .f${k}",{x:${Math.round(540 - wv / 2 - FX0[k][0])},y:${470 - FX0[k][1]},scale:0.2,opacity:0,duration:0.26,ease:"power3.in"},${f3(22.52 + k * 0.012)});`);
  sfx(at + 0.04, "pop_soft", -32, { why: "logo lines up" }); });
js.push(`tl.fromTo("#S11 .numwrap",{opacity:0,scale:1.3,filter:"blur(18px)"},{opacity:1,scale:1,filter:"blur(0px)",duration:0.3,ease:"power3.out"},22.78);`);
js.push(`tl.fromTo("#S11 .ghost",{opacity:0,x:0,y:0},{opacity:1,x:10,y:12,duration:0.3,ease:"power3.out"},22.92);`);
js.push(`tl.fromTo("#S11 .s11",{backgroundPosition:"100% 0%"},{backgroundPosition:"0% 0%",duration:0.9,ease:"sine.inOut"},23.0);`);
js.push(`tl.fromTo("#S11 .g11",{opacity:0,scale:0.6},{opacity:1,scale:1,duration:0.4,ease:"power3.out"},22.78);`);
js.push(`tl.fromTo("#S11 .ripple",{scale:0.2,opacity:0.9},{scale:3.2,opacity:0,duration:1.1,ease:"power2.out"},22.8);`);
js.push(`tl.fromTo("#worldg .topo",{opacity:0.12},{opacity:0.32,duration:0.12,ease:"none",yoyo:true,repeat:1},22.78);`);
js.push(`tl.fromTo("#S11 .wm",{opacity:0,y:24},{opacity:1,y:0,duration:0.3,ease:"power3.out"},23.1);`);
js.push(`tl.fromTo("#S11 .hero",{y:0},{y:-20,duration:${f3(DUR - J[9])},ease:"sine.inOut"},${f3(J[9])});`);
js.push(`tl.to("#plate .ptg",{opacity:1,duration:0.4,ease:"power1.inOut"},${f3(J[9] - 0.2)});`);
sfx(21.36, "whoosh_suave", -18, { why: "green flood" });
sfx(22.78, "riser", -18, { why: "riser peaks on goldmine", hero: true });
sfx(22.6, "whoosh_corto", -22, { why: "logos collapse into the number" });
sfx(22.78, "boom_medio", -9, { align: "inicio", largo: 1.8, why: "HERO boom on goldmine", hero: true });
sfx(23.02, "shimmer", -22, { why: "sheen + wordmark", hero: true });

// v3.2 OUTRO — the house end card. Flood from his face (same TK.flood as the goldmine takeover), he and the number dissolve under it
// (M.out "flood": blur 8 px + fade), the lockup pops (F.pop), slow drift (F.drift 1.04) and one push to the logo (M.push 1.1).
{ const hx = (HEAD[10].cx / W * 100).toFixed(0), hy = ((HEAD[10].top + 150) / H * 100).toFixed(0);
  js.push(`TK.flood(tl,"#outro",${f3(OUTRO.t0)},${OUTRO.flood},${hx},${hy});`);
  js.push(`tl.to(["#fgwrap","#S11"],{opacity:0,filter:"blur(8px)",duration:0.34,ease:"power2.in"},${f3(OUTRO.t0 + 0.1)});`);
  js.push(`tl.fromTo("#outro .ologo",{opacity:0,yPercent:18},{opacity:1,yPercent:0,duration:0.4,ease:"power3.out"},${f3(OUTRO.logo)});`);
  js.push(`tl.fromTo("#outro .ourl",{opacity:0,yPercent:18},{opacity:1,yPercent:0,duration:0.4,ease:"power3.out"},${f3(OUTRO.url)});`);
  js.push(`tl.fromTo("#outro .ostack",{scale:1},{scale:1.04,duration:${f3(TOTAL - OUTRO.t0)},ease:"none"},${f3(OUTRO.t0)});`);
  js.push(`tl.fromTo("#outro .ocam",{scale:1},{scale:1.1,transformOrigin:"540px 760px",duration:1.2,ease:"power2.inOut"},${f3(OUTRO.push)});`);
  js.push(`tl.fromTo("#outro .otopo",{y:0,x:0},{y:-90,x:-30,duration:${f3(TOTAL - OUTRO.t0)},ease:"none"},${f3(OUTRO.t0)});`);
  js.push(`tl.fromTo("#outro .odots",{y:0},{y:-40,duration:${f3(TOTAL - OUTRO.t0)},ease:"none"},${f3(OUTRO.t0)});`);
  js.push(`tl.fromTo("#outro .b1",{x:0,y:0,scale:1},{x:-60,y:40,scale:1.08,duration:${f3(TOTAL - OUTRO.t0)},ease:"sine.inOut"},${f3(OUTRO.t0)});`);
  js.push(`tl.fromTo("#outro .b2",{x:0,y:0},{x:50,y:-50,duration:${f3(TOTAL - OUTRO.t0)},ease:"sine.inOut"},${f3(OUTRO.t0)});`); }
sfx(OUTRO.t0, "whoosh_suave", -24, { why: "outro flood (the house end card has no logo hit, so none here)" });

// scene windows also drive opacity (HyperFrames hides clips itself; qc-master measures without its runtime)
for (const el of ov) { const id = el.match(/id="(\w+)"/)[1], a = +el.match(/data-start="([\d.]+)"/)[1], d = +el.match(/data-duration="([\d.]+)"/)[1];
  js.push(`tl.set("#${id}",{opacity:1},${f3(a)});`); if (a + d < DUR - 1e-3) js.push(`tl.set("#${id}",{opacity:0},${f3(a + d)});`); }

/* ── captions: QMD caption kit (Instrument Sans 500, -0.012em, .026H, maxChars 26, maxWidth .84) + WORD-SYNC ── */
const brand = JSON.parse(readFileSync(join(REPO, "biblioteca/marcas/qmd.json"), "utf8"));
const C = brand.captions, safe = C.safe["9x16"];
const words = JSON.parse(readFileSync(join(OUT, "words.json"), "utf8")).map((w) => ({ ...w }));
const PUNCT = { "data": "data,", "regulated": "regulated," };
words.forEach((w) => { if (PUNCT[w.text]) w.text = PUNCT[w.text]; });
const HOT = new Set(["million", "private", "frontier", "regulated", "workflows", "depth", "tickets", "conversations", "labs", "end-to-end", "goldmine"]);
const modeAt = (t) => t < J[0] ? "FULL" : t < J[9] ? "STAGE" : "GREEN";
const LINES = ["This is how you make", "a million dollars", "in one month.", "You get your private data,", "and you sell to",
  "an AI frontier lab.", "This only applies for", "industries that are", "highly regulated,", "or companies that have",
  "specific workflows", "and have some depth", "in their specific data.", "So, support tickets,", "customer conversations,",
  "because AI labs needs", "to understand this", "end-to-end interaction", "with your customers.", "So you're sitting", "in a goldmine."];
const phrases = []; let wi = 0;
for (const L of LINES) {
  const n = L.split(" ").length, p = words.slice(wi, wi + n);
  if (p.map((w) => w.text).join(" ") !== L) throw Error(`caption line mismatch: "${L}" vs "${p.map((w) => w.text).join(" ")}"`);
  if (L.length > safe.maxChars) throw Error(`caption line over ${safe.maxChars} chars: ${L}`);
  const g0 = modeAt(p[0].start + 0.02); if (p.some((w) => modeAt(w.start + 0.02) !== g0)) throw Error(`caption line crosses a mode change: ${L}`);
  phrases.push(p); wi += n;
}
if (wi !== words.length) throw Error("caption lines do not cover every word");
const size = Math.round(H * safe.size), lineH = Math.round(size * 1.5), maxW = Math.round(W * safe.maxWidth);
const MSTART = [0, J[0], J[9]];
const modeStart = (t) => MSTART.filter((j) => j <= t + 1e-6).pop();
const st = (p) => Math.max(p[0].start - 0.06, modeStart(p[0].start + 0.02));
const CAPTOP = { FULL: MODE.FULL.cap, STAGE: MODE.STAGE.cap, GREEN: MODE.STAGE.cap };
const caps = phrases.map((p, i) => {
  const s = st(p), nxt = phrases[i + 1] ? st(phrases[i + 1]) : null;
  let e = p[p.length - 1].end + 0.25; if (nxt != null && nxt - e < 0.5) e = nxt;
  const g = modeAt(p[0].start + 0.02);
  const modeEnd = [J[0], J[9], DUR].find((j) => j > p[0].start);
  e = Math.min(e, modeEnd, DUR);
  const html = p.map((w) => `<span class="w${HOT.has(w.text.toLowerCase().replace(/[^a-z-]/g, "")) ? " hot" : ""}">${w.text.replace(/&/g, "&amp;")}</span>`).join(" ");
  p.forEach((w, k) => js.push(`tl.fromTo("#cap${i} .w:nth-child(${k + 1})",{opacity:0,y:${Math.round(size * 0.14)},filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.14,ease:"power2.out"},${f3(w.start - 0.05)});`));
  p.forEach((w, k) => { if (HOT.has(w.text.toLowerCase().replace(/[^a-z-]/g, ""))) js.push(`TK.hl(tl,"#cap${i} .w:nth-child(${k + 1})",${f3(w.start)},0.18);`); });
  return `<div id="cap${i}" class="cap clip cap-${g.toLowerCase()}" style="top:${CAPTOP[g]}px" data-start="${f3(s)}" data-duration="${f3(e - s)}" data-track-index="40"><span class="t">${html}</span></div>`;
});

/* ── page ───────────────────────────────────────────────────────────────── */
const blob = (cls, x, y, d, col, a) => `<i class="blob ${cls}" style="left:${x}px;top:${y}px;width:${d}px;height:${d}px;background:radial-gradient(closest-side,rgba(var(--${col}-rgb),${a}),rgba(var(--${col}-rgb),0))"></i>`;
const css = `
${FONTS}
${tokens}
${tkCss}
html,body{margin:0;background:var(--paper)}
#frame{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:var(--font-sans);
  --sh:0 2px 3px rgba(var(--ink-rgb),.55),0 4px 22px rgba(var(--ink-rgb),.55);
  --e1:0 1px 1px rgba(var(--ink-rgb),.05),0 2px 6px -2px rgba(var(--ink-rgb),.08),0 14px 28px -14px rgba(var(--green-deep-rgb),.22);
  --e2:0 1px 2px rgba(var(--ink-rgb),.06),0 8px 18px -8px rgba(var(--ink-rgb),.12),0 34px 64px -30px rgba(var(--green-deep-rgb),.34);
  --hi:inset 0 1px 0 rgba(255,255,255,.9)}
/* the ground */
.world{position:absolute;inset:0;overflow:hidden}
#world{background:linear-gradient(180deg,var(--paper) 0%,var(--paper-2) 100%)}
#worldm{background:linear-gradient(180deg,var(--mint) 0%,var(--paper) 100%);z-index:1}
#worldg{background:radial-gradient(120% 80% at 50% 30%,var(--green) 0%,var(--green-deep) 55%,var(--green-darkest) 100%);z-index:2}
#worldm,#worldg{clip-path:circle(0% at 50% 50%)}
.blob{position:absolute;border-radius:50%}
.topo{position:absolute;left:-160px;top:-120px;width:1400px;height:2500px;-webkit-mask:url(assets/tex/topo.png) 0 0/1400px 2500px no-repeat;mask:url(assets/tex/topo.png) 0 0/1400px 2500px no-repeat}
#world .topo{background:var(--green);opacity:.085}
#worldm .topo{background:var(--green);opacity:.10}
#worldg .topo{background:var(--lime);opacity:.12}
.gdots{position:absolute;left:0;top:0;width:${W}px;height:${H + 120}px;background:var(--green);opacity:.16;
  -webkit-mask:url(assets/tex/dots.png) 0 0/36px 36px repeat,radial-gradient(70% 45% at 50% 22%,black,transparent);-webkit-mask-composite:source-in;
  mask:url(assets/tex/dots.png) 0 0/36px 36px repeat,radial-gradient(70% 45% at 50% 22%,black,transparent);mask-composite:intersect}
#worldg .gdots{background:var(--lime);opacity:.12}
.beam{position:absolute;left:0;top:-200px;width:${W}px;height:${H + 400}px;background:linear-gradient(105deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.55) 50%,rgba(255,255,255,0) 62%)}
/* his street plate: landscape, rounded, rim + glint, dissolving into the ground at the bottom */
#plate{position:absolute;left:${PLATE.x}px;top:${PLATE.y}px;width:${PLATE.w}px;height:${PLATE.h}px;border-radius:${PLATE.r}px;overflow:hidden;z-index:4;opacity:0;
  -webkit-mask-image:linear-gradient(180deg,black 0%,black 58%,transparent 100%);mask-image:linear-gradient(180deg,black 0%,black 58%,transparent 100%)}
#platebg{position:absolute;left:0;top:-160px;width:100%;height:${PLATE.h + 320}px;object-fit:cover;filter:blur(6px) saturate(.55) brightness(1.7) contrast(.75)}
#plate .ptint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(var(--mint-rgb),.62) 0%,rgba(var(--paper-rgb),.55) 100%)}
#plate .ptg{position:absolute;inset:0;opacity:0;background:linear-gradient(180deg,rgba(var(--green-rgb),.72) 0%,rgba(var(--green-deep-rgb),.6) 100%)}
#plate .pdots{position:absolute;inset:0;background:var(--green);opacity:.10;-webkit-mask:url(assets/tex/dots.png) 0 0/36px 36px repeat;mask:url(assets/tex/dots.png) 0 0/36px 36px repeat}
#plate .prim{position:absolute;inset:0;border-radius:${PLATE.r}px;box-shadow:inset 0 0 0 2px rgba(var(--lime-rgb),.55)}
#plate .rimglint{position:absolute;left:0;top:0;width:180px;height:3px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.95),rgba(255,255,255,0))}
#win{position:absolute;inset:0;overflow:hidden;z-index:6;--fr:0px;
  -webkit-mask-image:radial-gradient(circle at ${(HEAD[0].cx / W * 100).toFixed(1)}% 30%,transparent var(--fr),black calc(var(--fr) + 60px));
  mask-image:radial-gradient(circle at ${(HEAD[0].cx / W * 100).toFixed(1)}% 30%,transparent var(--fr),black calc(var(--fr) + 60px))}
#camF,#cam{position:absolute;left:0;top:0;width:${W}px;height:${H}px}   /* v3.1: no will-change → Chrome rasters the cut-out at its final scale (the 1296x2304 source is only ever downscaled) */
#aroll,#alpha{position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover}
#fgwrap{position:absolute;inset:0;z-index:18;filter:drop-shadow(0 18px 26px rgba(var(--green-darkest-rgb),.28)) drop-shadow(0 2px 3px rgba(var(--ink-rgb),.18))}
#fgclip{position:absolute;inset:0;overflow:hidden}
#facebox{position:absolute;visibility:hidden;pointer-events:none}
/* v3.2 outro = the house end card (takeovers.css .tk-end: column, centred, logo 7cqmin = 76 px; mode-green ground like #worldg) */
#outro{position:absolute;inset:0;z-index:60;overflow:hidden;clip-path:circle(0% at 50% 50%);
  background:radial-gradient(120% 80% at 50% 30%,var(--green) 0%,var(--green-deep) 55%,var(--green-darkest) 100%)}
#outro .otopo{position:absolute;left:-160px;top:-120px;width:1400px;height:2500px;background:var(--lime);opacity:.12;
  -webkit-mask:url(assets/tex/topo.png) 0 0/1400px 2500px no-repeat;mask:url(assets/tex/topo.png) 0 0/1400px 2500px no-repeat}
#outro .odots{position:absolute;left:0;top:0;width:${W}px;height:${H + 120}px;background:var(--lime);opacity:.12;
  -webkit-mask:url(assets/tex/dots.png) 0 0/36px 36px repeat,radial-gradient(70% 45% at 50% 40%,black,transparent);-webkit-mask-composite:source-in;
  mask:url(assets/tex/dots.png) 0 0/36px 36px repeat,radial-gradient(70% 45% at 50% 40%,black,transparent);mask-composite:intersect}
#outro .ocam{position:absolute;inset:0}
#outro .ostack{position:absolute;left:0;right:0;top:${Math.round(H * 0.11)}px;bottom:${Math.round(H * 0.34)}px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:${Math.round(W * 0.03)}px;text-align:center}
#outro .ologo{height:${Math.round(W * 0.07)}px;opacity:0}
#outro .ourl{font-family:var(--font-mono);font-size:${Math.round(W * 0.028)}px;letter-spacing:.01em;color:var(--on-green);opacity:0}
#grain{position:absolute;inset:0;z-index:17;   /* v3.1: under #fgwrap (18): grain on the ground, plate and behind-clips only, never on Walter */
  pointer-events:none;background:url(assets/tex/grain.png) 0 0/384px 384px repeat;mix-blend-mode:soft-light;opacity:.42}
.ov{position:absolute;inset:0;pointer-events:none}
.ov.behind{z-index:15}.ov.front{z-index:22}
.escena{opacity:0}
.zone{position:absolute}
.ic{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
/* the board */
#board{position:absolute;left:${BOARD.x}px;top:${BOARD.y}px;width:${BOARD.w}px;height:${BOARD.h}px;z-index:21}
#board .bsurf{position:absolute;inset:0;border-radius:40px;overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,.86) 0%,rgba(var(--paper-rgb),.72) 100%);
  box-shadow:var(--e2),var(--hi),inset 0 0 0 1.5px rgba(var(--green-rgb),.10)}
#board .bdots{position:absolute;inset:0;background:var(--green);opacity:.11;-webkit-mask:url(assets/tex/dots.png) 0 0/36px 36px repeat;mask:url(assets/tex/dots.png) 0 0/36px 36px repeat}
#board .bglint{position:absolute;left:0;top:0;width:160px;height:2px;background:linear-gradient(90deg,rgba(var(--lime-rgb),0),var(--lime),rgba(var(--lime-rgb),0))}
#board .reg{position:absolute;width:26px;height:26px;border:0 solid var(--green);opacity:.45}
#board .r1{left:-12px;top:-12px;border-left-width:2px;border-top-width:2px}#board .r2{right:-12px;top:-12px;border-right-width:2px;border-top-width:2px}
#board .r3{left:-12px;bottom:-12px;border-left-width:2px;border-bottom-width:2px}#board .r4{right:-12px;bottom:-12px;border-right-width:2px;border-bottom-width:2px}
#board .kick{position:absolute;left:30px;top:22px;height:40px;display:flex;align-items:center;gap:14px}
#board .kdot{width:12px;height:12px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px rgba(var(--lime-rgb),.25)}
#board .kw{position:relative;height:40px;width:520px}
#board .kw b{position:absolute;left:0;top:0;line-height:40px;font-family:var(--font-mono);font-size:28px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--green);opacity:0;white-space:nowrap}
#board .kcredit{position:absolute;right:66px;top:22px;line-height:40px;font-family:var(--font-mono);font-size:28px;font-weight:500;color:var(--gray);opacity:0}
#board .pip{position:absolute;right:30px;top:34px;width:16px;height:16px;border-radius:50%;background:var(--green)}
/* hero number (S01, S11) */
.hero{position:absolute;inset:0}
.numwrap{position:absolute;left:0;right:0;top:500px;height:200px;display:flex;justify-content:center}
.num{position:absolute;top:0;white-space:nowrap;font-family:var(--font-display);font-weight:700;font-size:186px;line-height:200px;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;color:var(--green-deep)}
.num.reels{display:flex}
.reel{display:inline-block;height:200px;overflow:hidden;position:relative}
.strip{display:flex;flex-direction:column}
.strip i{font-style:normal;height:200px;line-height:200px;display:block;text-align:center}
.sym{display:inline-block;color:var(--green)}
.num.ghost{color:rgba(var(--lime-rgb),.08);-webkit-text-stroke:3px var(--lime);opacity:0} /* v3.2: faint 8% lime fill inside the outline (was fully transparent; hyperframes check reads a 0-alpha fill as invisible text and ignores the stroke) */
.h11 .num.ghost{-webkit-text-stroke:3px rgba(var(--lime-rgb),.7)}
.num.shine{opacity:0;background:linear-gradient(100deg,var(--green-deep) 0%,var(--green-deep) 40%,var(--lime) 50%,var(--green-deep) 60%,var(--green-deep) 100%);
  background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
.h11 .num.shine{opacity:1;background-image:linear-gradient(100deg,var(--paper) 0%,var(--paper) 40%,var(--lime) 50%,var(--paper) 60%,var(--paper) 100%)}
.glow{position:absolute;left:50%;top:600px;width:1100px;height:620px;margin:-310px 0 0 -550px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(var(--lime-rgb),.55),rgba(var(--lime-rgb),0));opacity:0}
.nul{position:absolute;left:150px;right:150px;top:716px;height:14px;border-radius:7px;background:linear-gradient(90deg,var(--lime),var(--green));transform-origin:0 50%;transform:scaleX(0)}
.month{position:absolute;left:0;right:0;top:380px;display:flex;justify-content:center;align-items:center;gap:22px;opacity:0}
.mpill{display:flex;align-items:center;gap:12px;height:72px;padding:0 28px;border-radius:36px;background:var(--green-deep);color:var(--paper);box-shadow:var(--e1)}
.mpill .ic{font-size:36px;color:var(--lime)}
.mpill b{font-weight:600;font-size:38px;letter-spacing:-.01em}
.mtrack{position:relative;width:420px;height:20px;border-radius:10px;background:rgba(var(--green-rgb),.14);box-shadow:inset 0 1px 2px rgba(var(--ink-rgb),.12)}
.mfill{position:absolute;inset:0;border-radius:10px;background:linear-gradient(90deg,var(--lime),var(--green));transform-origin:0 50%;transform:scaleX(0)}
.mhead{position:absolute;left:-14px;top:-8px;width:36px;height:36px;border-radius:50%;background:white;box-shadow:var(--e1),inset 0 0 0 6px var(--lime)}
/* S02 vault + tool cards */
.vault{position:absolute;left:10px;top:66px;width:370px;height:470px}
.vback{position:absolute;inset:0;border-radius:44px;background:linear-gradient(160deg,var(--green) 0%,var(--green-darkest) 100%);box-shadow:var(--e2)}
.vbody{position:absolute;inset:20px;border-radius:30px;background:radial-gradient(90% 70% at 30% 20%,var(--green) 0%,var(--green-deep) 70%);overflow:hidden;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.10),inset 0 -10px 24px rgba(var(--green-darkest-rgb),.6)}
.vbevel{position:absolute;inset:0;background:var(--paper);opacity:.07;-webkit-mask:url(assets/tex/dots.png) 0 0/24px 24px repeat;mask:url(assets/tex/dots.png) 0 0/24px 24px repeat}
.dial{position:absolute;left:65px;top:70px;width:200px;height:200px}
.dial circle{fill:none;stroke-width:8}
.dring{stroke:rgba(var(--paper-rgb),.14)}
.dprog{stroke:var(--lime);stroke-linecap:round;stroke-dasharray:490;stroke-dashoffset:490}
.dial line{stroke:rgba(var(--paper-rgb),.4);stroke-width:2;stroke-linecap:round}
.vault .lock{position:absolute;left:119px;top:123px;width:92px;height:92px;fill:none;color:var(--paper);stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.vplate{position:absolute;left:50px;right:50px;top:318px;display:flex;flex-direction:column;gap:14px}
.vplate i{display:block;height:12px;border-radius:6px;background:rgba(var(--paper-rgb),.16);transform-origin:0 50%}
.vplate i:first-child{background:rgba(var(--lime-rgb),.6);width:70%}.vplate i:last-child{width:46%}
.vhandle{position:absolute;right:-10px;top:50%;width:20px;height:120px;margin-top:-60px;border-radius:10px;background:linear-gradient(180deg,var(--lime),var(--green));box-shadow:0 4px 10px rgba(var(--green-darkest-rgb),.4)}
.stack{position:absolute;inset:0}
.tcard{position:absolute;left:420px;width:516px;height:100px;box-sizing:border-box;display:flex;align-items:center;gap:18px;padding:0 24px 0 28px;
  background:linear-gradient(180deg,white,var(--paper));border-radius:24px;box-shadow:var(--e1),var(--hi),inset 0 0 0 1.5px rgba(var(--ink-rgb),.06)}
${CONFIG.tools.map((t, k) => `.tcard.t${k}{top:${CT(k)}px}`).join("")}
.tlogo{display:flex;align-items:center;gap:12px;flex:1}
.tlogo span{font-weight:600;font-size:36px;letter-spacing:-.02em;color:var(--ink)}
.ttag{display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:22px;background:var(--mint);color:var(--green);font-family:var(--font-mono);font-size:28px;font-weight:500}
.ttag .ic{font-size:22px}
.tdot{position:absolute;right:-6px;top:-6px;width:18px;height:18px;border-radius:50%;background:var(--lime);box-shadow:0 0 0 4px white}
/* S03 capsule → route → labs */
.capsule{position:absolute;left:298px;top:480px;width:340px;height:96px;border-radius:48px;display:flex;align-items:center;justify-content:center;gap:14px;overflow:hidden;
  background:linear-gradient(180deg,var(--lime),rgba(var(--lime-rgb),.82));color:var(--green-darkest);box-shadow:var(--e2),var(--hi)}
.capsule .ic{font-size:44px;position:relative}
.capsule b{font-weight:700;font-size:38px;letter-spacing:-.01em;position:relative}
.cstripes{position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,0) 0 22px,rgba(255,255,255,.28) 22px 30px)}
.route{position:absolute;left:0;top:0;width:${Z.w}px;height:${Z.h}px;overflow:visible}
.route path{fill:none;stroke-linecap:round}
.rbase{stroke:rgba(var(--green-rgb),.22);stroke-width:8;stroke-dasharray:200;stroke-dashoffset:200}
.rlive{stroke:var(--lime);stroke-width:8;stroke-dasharray:60 340;stroke-dashoffset:200}
.labs{position:absolute;left:0;top:10px;width:${Z.w}px;display:grid;grid-template-columns:458px 458px;gap:20px 20px}
.lcard{position:relative;height:158px;display:flex;align-items:center;justify-content:center;border-radius:26px;
  background:linear-gradient(180deg,white,var(--paper));box-shadow:var(--e1),var(--hi),inset 0 0 0 1.5px rgba(var(--ink-rgb),.06)}
.slot{display:block;height:158px;border-radius:26px;border:3px dashed rgba(var(--green-rgb),.22);box-sizing:border-box;background:rgba(255,255,255,.35)}
.lchk{position:absolute;right:16px;top:16px;width:38px;height:38px;border-radius:50%;background:var(--lime);color:var(--green-darkest);font-size:24px;display:flex;align-items:center;justify-content:center}
.lchk .ic{stroke-width:3}
.lring{position:absolute;left:-10px;top:-10px;right:-10px;bottom:-10px;border-radius:34px;box-shadow:0 0 0 3px var(--lime);opacity:0;pointer-events:none}
.lablbl{position:absolute;left:0;right:0;top:372px;text-align:center;font-family:var(--font-mono);font-size:28px;font-weight:500;color:var(--green);letter-spacing:.02em}
/* S04 tiles + stamp */
.tile{position:absolute;box-sizing:border-box;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--ink);
  background:linear-gradient(180deg,white,var(--paper));box-shadow:var(--e1),var(--hi),inset 0 0 0 1.5px rgba(var(--ink-rgb),.06)}
.tic{width:88px;height:88px;border-radius:26px;display:flex;align-items:center;justify-content:center;font-size:50px;color:var(--green);
  background:linear-gradient(135deg,var(--mint) 0%,white 50%,var(--mint) 100%);background-size:200% 200%;box-shadow:inset 0 0 0 1.5px rgba(var(--green-rgb),.12)}
.tile .tl{font-weight:600;font-size:30px;letter-spacing:-.01em}
.tile .bar{position:absolute;left:0;right:0;top:0;height:9px;background:linear-gradient(90deg,var(--lime),var(--green));transform-origin:0 50%;transform:scaleX(0)}
.badge{position:absolute;right:12px;top:18px;width:34px;height:34px;border-radius:50%;background:var(--green);color:var(--lime);font-size:20px;display:flex;align-items:center;justify-content:center;opacity:0}
.stampw{position:absolute;left:0;right:0;top:${Math.round(Z.h / 2 - 70)}px;display:flex;justify-content:center}
.stamp{display:flex;align-items:center;gap:22px;font-family:var(--font-display);font-weight:700;font-stretch:80%;font-size:92px;letter-spacing:-.01em;text-transform:uppercase;color:var(--paper);
  background:linear-gradient(180deg,var(--green) 0%,var(--green-deep) 100%);border-radius:28px;padding:16px 40px;opacity:0;box-shadow:var(--e2),inset 0 0 0 3px rgba(var(--lime-rgb),.5)}
.sline{width:44px;height:10px;border-radius:5px;background:var(--lime);transform-origin:50% 50%}
.clipz{position:absolute;inset:0;overflow:hidden;border-radius:24px}
.flash{position:absolute;left:-60px;top:-60px;right:-60px;bottom:-60px;background:var(--paper);opacity:0}
/* S06 workflow */
.wire{position:absolute;left:0;top:0;width:${Z.w}px;height:${Z.h}px;overflow:visible}
.wire path{fill:none;stroke-width:8;stroke-linecap:round}
.wb{stroke:rgba(var(--green-rgb),.14)}
.w{stroke:var(--lime);stroke-dasharray:400;stroke-dashoffset:400}
.node{position:absolute;width:${NW}px;height:${NH}px;box-sizing:border-box;border-radius:28px;display:flex;align-items:center;gap:22px;padding:0 28px;color:var(--ink);
  background:linear-gradient(180deg,white,var(--paper));box-shadow:var(--e1),var(--hi),inset 0 0 0 1.5px rgba(var(--ink-rgb),.06)}
.nic{width:84px;height:84px;border-radius:24px;flex:none;display:flex;align-items:center;justify-content:center;font-size:46px;color:var(--green);background:var(--mint)}
.nl{font-weight:600;font-size:40px;letter-spacing:-.015em}
.nring{position:absolute;left:-8px;top:-8px;right:-8px;bottom:-8px;border-radius:34px;box-shadow:0 0 0 3px var(--lime);opacity:0}
.token{position:absolute;left:0;top:0;width:68px;height:68px;border-radius:50%;background:var(--green-deep);color:var(--lime);font-size:36px;display:flex;align-items:center;justify-content:center;box-shadow:var(--e2);z-index:2}
/* S07 strata */
.strataw{position:absolute;inset:0;overflow:hidden;border-radius:30px;box-shadow:var(--e1),inset 0 0 0 1.5px rgba(var(--ink-rgb),.06)}
.col{position:absolute;left:0;top:0;width:${Z.w}px}
.stratum{position:relative;height:${STRATA_H}px;box-sizing:border-box;padding:28px 36px;overflow:hidden}
.stex{position:absolute;left:-20px;top:-20px;right:-80px;bottom:-20px;background:currentColor;opacity:.10;-webkit-mask:url(assets/tex/topo.png) 0 0/700px 1250px;mask:url(assets/tex/topo.png) 0 0/700px 1250px}
.stratum span{position:relative;font-weight:600;font-size:40px;letter-spacing:-.015em}
.stratum.s0{background:linear-gradient(180deg,var(--paper),var(--paper-2));color:var(--ink)}.stratum.s1{background:linear-gradient(180deg,var(--paper-2),var(--paper-3));color:var(--ink)}
.stratum.s2{background:linear-gradient(180deg,var(--paper-3),var(--sand));color:var(--ink)}.stratum.s3{background:linear-gradient(180deg,var(--green),var(--green-deep));color:var(--paper)}
.stratum.s4{background:linear-gradient(180deg,var(--green-deep),var(--green-darkest));color:var(--paper)}
.rock{position:relative;height:${VEIN_H}px;background:var(--green-darkest);overflow:hidden;color:var(--lime)}
.vein{position:absolute;left:0;top:110px;width:${Z.w}px;height:160px;overflow:visible}
.vein path{fill:none;stroke-linecap:round}
.vc{stroke:var(--lime);stroke-width:18}
.vg{stroke:var(--lime);stroke-width:40;opacity:.25;filter:blur(10px)}
.spark{position:absolute;width:12px;height:12px;border-radius:50%;background:var(--paper);opacity:0}
.sweep{position:absolute;top:110px;left:0;width:150px;height:160px;background:linear-gradient(90deg,rgba(var(--paper-rgb),0),rgba(var(--paper-rgb),.5),rgba(var(--paper-rgb),0))}
/* S08–S10 window */
.win2{position:absolute;left:${WZ.x}px;top:${WZ.y}px;width:${WZ.w}px;height:${WZ.h}px;border-radius:26px;overflow:hidden;background:white;box-shadow:var(--e2)}
.wrim{position:absolute;inset:0;border-radius:26px;box-shadow:inset 0 0 0 3px var(--lime);pointer-events:none}
.wbody{position:absolute;inset:0;overflow:hidden}
.scrA,.scrB{position:absolute;left:0;top:0}
.scrA img,.band img{display:block}
.scrB{opacity:0;width:${U.chatW}px;height:${U.chatH}px}
.band{position:absolute;left:0;width:${U.chatW}px;overflow:hidden;opacity:0}
.hlb{position:absolute;background:var(--lime);mix-blend-mode:multiply;transform-origin:0 50%;transform:scaleX(0);border-radius:6px}
.dock{position:absolute;left:0;right:0;top:0;height:132px;background:white;box-sizing:border-box;padding:16px 36px 0;box-shadow:0 1px 0 var(--hairline),0 10px 20px -12px rgba(var(--ink-rgb),.2)}
.dock .dlogos{display:flex;align-items:center;justify-content:space-between;height:70px}
.dlbl{font-family:var(--font-mono);font-size:28px;font-weight:500;color:var(--green)}
.journey{position:absolute;inset:0}
.journey .rail0{position:absolute;left:64px;top:${J0y}px;width:6px;height:${JF - J0y}px;border-radius:3px;background:var(--hairline);opacity:0}
.journey .fill{position:absolute;left:64px;top:${J0y}px;width:6px;height:${JF - J0y}px;border-radius:3px;background:var(--lime);transform-origin:50% 0;transform:scaleY(0)}
.jn{position:absolute;left:51px;width:32px;height:32px;margin-top:-16px;border-radius:50%;background:var(--green);opacity:0;box-shadow:0 0 0 5px white}
.jn.jf{left:39px;width:56px;height:56px;margin-top:-28px;background:var(--lime);display:flex;align-items:center;justify-content:center;color:var(--green-darkest);font-size:38px}
.jn.jf .ic{stroke-width:3}
.jl{position:absolute;left:100px;margin-top:-17px;line-height:34px;font-weight:600;font-size:30px;color:var(--ink);opacity:0;white-space:nowrap}
.jl.jlf{color:var(--green)}
.glint{position:absolute;left:0;width:200px;height:4px;background:linear-gradient(90deg,rgba(var(--paper-rgb),0),var(--paper),rgba(var(--paper-rgb),0));opacity:0}
.glint.g1{top:0}.glint.g2{bottom:0}
/* S11 */
.h11 .numwrap{top:430px}
.g11{top:530px;background:radial-gradient(closest-side,rgba(var(--lime-rgb),.38),rgba(var(--lime-rgb),0))}
.ripple{position:absolute;left:50%;top:530px;width:600px;height:600px;margin:-300px 0 0 -300px;border-radius:50%;box-shadow:0 0 0 6px var(--lime),inset 0 0 0 2px rgba(var(--lime-rgb),.4);opacity:0}
.wm{position:absolute;left:50%;top:150px;height:66px;transform:translateX(-50%);opacity:0}
.falls{position:absolute;inset:0}
.fc{position:absolute;width:320px;height:96px;box-sizing:border-box;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:10px;
  background:linear-gradient(180deg,white,var(--paper));box-shadow:0 18px 36px -18px rgba(var(--green-darkest-rgb),.7),var(--hi)}
.fc span{font-weight:600;font-size:32px;color:var(--ink)}
.fc.ft{width:96px;color:var(--green);font-size:56px}
/* captions */
.cap{position:absolute;left:${Math.round((W - maxW) / 2)}px;width:${maxW}px;height:${lineH}px;z-index:50;
  display:flex;align-items:center;justify-content:center;text-align:center;white-space:nowrap}
.cap .t{font-family:${C.family};font-weight:${C.weight};font-size:${size}px;line-height:${lineH}px;letter-spacing:${C.tracking}}
.cap .w{display:inline-block;position:relative;z-index:0;isolation:isolate}
.cap .w.hot{margin:0 .14em}
.cap .w.hot::before{content:"";position:absolute;inset:.1em -.12em .04em;background:var(--lime);border-radius:.12em;z-index:-1;
  transform-origin:0 50%;transform:scaleX(var(--hl-p,0))}
.cap-full .t{color:var(--paper);text-shadow:var(--sh)}
.cap-full .w.hot{color:var(--green-darkest);text-shadow:none}
.cap-stage .t{color:var(--ink)}
.cap-green .t{color:var(--paper)}
.cap-green .w.hot{color:var(--green-darkest)}
`;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<!-- walter-raw · "Sitting on a goldmine" · vertical master v3 · generated by ../src/build.mjs — edit the generator, not this file -->
<style>${css}</style>
</head>
<body>
<div id="frame" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}" data-qc-cara="${MODE.STAGE.yt},${MODE.STAGE.yt + 380}" data-qc-banda="${MODE.STAGE.cap},${MODE.STAGE.cap + lineH}">
  <div id="world" class="world mode-light">${blob("b1", -380, -260, 1400, "lime", 0.42)}${blob("b2", 420, 520, 1200, "mint", 0.95)}${blob("b3", -460, 1180, 1300, "sand", 0.45)}${blob("b4", 380, 1260, 1100, "lime", 0.30)}<i class="topo"></i><i class="gdots"></i><i class="beam"></i></div>
  <div id="worldm" class="world mode-light">${blob("b1", 200, 300, 1300, "lime", 0.35)}<i class="topo"></i></div>
  <div id="worldg" class="world mode-green">${blob("b1", -300, 80, 1500, "lime", 0.20)}${blob("b2", 300, 1100, 1300, "green", 0.9)}<i class="topo"></i><i class="gdots"></i></div>
  <div id="plate"><video id="platebg" class="clip" src="assets/media/plate-bg.mp4" data-start="0" data-duration="${DUR}" data-track-index="2" muted playsinline></video><i class="ptint"></i><i class="ptg"></i><i class="pdots"></i><i class="prim"></i><i class="rimglint"></i></div>
  <div id="win"><div id="camF">
    <video id="aroll" class="clip" src="assets/media/cut.mp4" data-start="0" data-duration="${DUR}" data-track-index="0" muted playsinline></video>
  </div></div>
  ${ov.filter((o) => o.includes(" behind\"")).join("\n  ")}
  <div id="fgwrap"><div id="fgclip"><div id="cam">
    <video id="alpha" class="clip" src="assets/media/walter-alpha.webm" data-start="0" data-duration="${DUR}" data-track-index="1" muted playsinline></video>
    <i id="facebox"></i>
  </div></div></div>
  <!-- v3.2: one delivery track = voice.wav + sfx.wav + music.wav at unity, true-peak limited by tools/master_mix.py (stems stay in assets/media) -->
  <audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${TOTAL}" data-track-index="30" data-volume="1"></audio>
  ${boardHtml}
  ${ov.filter((o) => !o.includes(" behind\"")).join("\n  ")}
  ${caps.join("\n  ")}
  <div id="grain"></div>
  <div id="outro" class="mode-green">${blob("b1", -260, 120, 1500, "lime", 0.20)}${blob("b2", 260, 1000, 1300, "green", 0.9)}<i class="otopo"></i><i class="odots"></i>
    <div class="ocam"><div class="ostack"><img class="ologo" src="assets/logos/qmd-horizontal-white.svg" alt="QuoteMyData"><div class="ourl">quotemydata.com</div></div></div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>${tkJs}</script>
<script>
(function(){
  gsap.config({force3D:false});   // v3.1: 2D transforms, no forced GPU layer (that layer was upscaled bilinear)
  var tl = gsap.timeline({paused:true});
  window.__timelines = window.__timelines || {};
  ${js.join("\n  ")}
  tl.set({}, {}, ${TOTAL});
  window.__timelines["main"] = tl;
})();
</script>
</body></html>
`;
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "captions.json"), JSON.stringify(phrases.map((p) => ({ start: p[0].start, text: p.map((w) => w.text).join(" "), mode: modeAt(p[0].start + 0.02) })), null, 1));
writeFileSync(join(OUT, "sfx-events.json"), JSON.stringify({ DUR: TOTAL, events: SFX.sort((a, b) => a.t - b.t) }, null, 1));
writeFileSync(join(OUT, "layout.json"), JSON.stringify({ MODE, BOARD, Z, PLATE, J, DUR: TOTAL, SPEECH: DUR, OUTRO: { ...OUTRO, end: TOTAL, lastWordEnd: LAST_WORD_END }, modes: [[0, J[0], "FULL"], [J[0], J[9], "STAGE"], [J[9], TOTAL, "GREEN"]], window: WZ, camplan: CAMPLAN }, null, 1));
console.log(`master/index.html · ${TOTAL}s (speech ${DUR} + outro) · ${ov.length} scene clips · ${caps.length} caption lines · ${SFX.length} sfx events · joins ${J.join(" ")}`);
