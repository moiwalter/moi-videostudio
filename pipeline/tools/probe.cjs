// probe.cjs <url> <outprefix> [ancho] [alto] — abre una página pública y anota los SVG del header.
// Chrome: QC_CHROME o CHROME_PATH. Puppeteer: PPTR o puppeteer-core resoluble.
const puppeteer = require(process.env.PPTR || "puppeteer-core");
const fs = require("fs");
const CH = process.env.QC_CHROME || process.env.CHROME_PATH;
if (!CH) { console.error("falta QC_CHROME"); process.exit(1); }
(async () => {
  const [url, out, w = "1440", h = "900"] = process.argv.slice(2);
  if (!url || !out) { console.error("uso: probe.cjs <url> <prefijo>"); process.exit(1); }
  const b = await puppeteer.launch({ executablePath: CH, args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
  try { await p.goto(url, { waitUntil: "networkidle2", timeout: 45000 }); } catch (e) { console.error("goto", e.message); }
  await new Promise(r => setTimeout(r, 2500));
  const info = await p.evaluate(() => {
    const svgs = [...document.querySelectorAll("header svg, nav svg, a[href='/'] svg, svg[aria-label]")].map(s => {
      const r = s.getBoundingClientRect();
      return { y: r.top, x: r.left, w: r.width, h: r.height, label: s.getAttribute("aria-label") || "", html: s.outerHTML };
    }).filter(s => s.w > 40 && s.y < 200);
    const imgs = [...document.querySelectorAll("img, source")].map(i => ({ src: i.currentSrc || i.src || i.srcset, alt: i.alt || "", w: i.naturalWidth || 0 }));
    return { svgs, imgs };
  });
  fs.writeFileSync(out + ".json", JSON.stringify(info, null, 1));
  await p.screenshot({ path: out + ".png" });
  console.log(url, "svgs", info.svgs.length);
  await b.close();
})();
