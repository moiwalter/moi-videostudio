// frames.cjs — per-frame geometry probe for qa.py (v3). Seeks window.__timelines.main every 1/15 s and reports, per instant:
//   the active caption box, his face box (#facebox inside #cam = the face on canvas), every visible graphic's box,
//   and the camera scale. qc-master knows one caption band and one face band; v2 moves both with the mode, so this checks the real ones.
const puppeteer = require(process.env.PPTR || "puppeteer-core");
(async () => {
  const [url, out] = process.argv.slice(2);
  const chrome = process.env.QC_CHROME || process.env.CHROME_PATH;
if (!chrome) throw new Error("Falta QC_CHROME (o CHROME_PATH): el binario de Chrome para el sondeo de cuadros");
const b = await puppeteer.launch({ executablePath: chrome, args: ["--no-sandbox"] });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  p.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 300)));
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });   for (let i = 0; i < 240 && !(await p.evaluate(() => !!(window.__timelines && window.__timelines.main))); i++) await new Promise((r) => setTimeout(r, 250));
  await p.evaluate(() => document.fonts.ready);
  const res = await p.evaluate(() => {
    const tl = window.__timelines.main, D = tl.duration(), R = [];
    const SEL = "#board .bsurf,.front .tile,.front .tcard,.front .vault,.front .lcard,.front .slot,.front .lablbl,.front .capsule,.front .stamp,.front .node,.front .token,.front .strataw,.front .win2,.behind .num,.behind .month,.behind .nul,.behind .wm,.behind .fc,.front .card,.front .chip,.front .pill,.front .row,.front .msg,.front .bubble,.front .ui,.front .shot,.front .jn,.front .badge,.front .reg";
    const op = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); o *= +cs.opacity; if (cs.visibility === "hidden" || cs.display === "none") return 0; } return o; };
    const box = (r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
    for (let t = 0; t < D - 1e-3; t += 1 / 15) {
      tl.seek(t, false);
      const cap = [...document.querySelectorAll(".cap")].find((c) => t >= +c.dataset.start && t < +c.dataset.start + +c.dataset.duration);
      const capBox = cap ? box(cap.querySelector(".t").getBoundingClientRect()) : null;
      const fb = document.getElementById("facebox"); const face = box(fb.getBoundingClientRect());
      const els = [...document.querySelectorAll(SEL)].filter((e) => op(e) > 0.05).map((e) => {
        const esc = e.closest(".escena"), cn = String(e.getAttribute("class") || ""), k = cn.match(/\b(t|l|n|ti|f)\d+\b/);
        return { id: (esc ? esc.id : "") + " ." + cn.split(" ")[0] + (k ? "." + k[0] : ""),
          front: !!e.closest(".front"), box: box(e.getBoundingClientRect()) }; });
      // v3.3 box-overlap probe: every pair of visible graphics (opacity > 0.5, neither inside the other) whose boxes intersect by
      // > 400 px² AND > 6 % of the smaller box. qa.py fails a pair that overlaps for > 0.27 s (designed layering is whitelisted there).
      const vis = [...document.querySelectorAll(SEL)].filter((e) => op(e) > 0.5).map((e) => {
        const esc = e.closest(".escena"), cn = String(e.getAttribute("class") || ""), k = cn.match(/\b(t|l|n|ti|f)\d+\b/);
        return { e, id: (esc ? esc.id : "") + " ." + cn.split(" ").join(".") , r: e.getBoundingClientRect() }; });
      const ov = [];
      for (let a = 0; a < vis.length; a++) for (let c = a + 1; c < vis.length; c++) {
        const A = vis[a], B = vis[c]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
        const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left), h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (w <= 0 || h <= 0) continue; const ar = w * h, sm = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
        if (ar > 400 && ar > 0.06 * sm) ov.push([A.id, B.id, Math.round(ar / sm * 100)]); }
      const cam = gsap.getProperty("#cam", "scale"), camF = gsap.getProperty("#camF", "scale");
      R.push({ t: +t.toFixed(3), cap: capBox, face, els, ov, cam, camF });
    }
    return R;
  });
  require("fs").writeFileSync(out, JSON.stringify(res)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
