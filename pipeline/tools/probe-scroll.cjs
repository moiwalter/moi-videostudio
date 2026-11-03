// probe-scroll.cjs <url> <outprefix> — igual que probe.cjs, scrolleando la página antes de anotar.
const puppeteer = require(process.env.PPTR || "puppeteer-core");
const fs = require("fs");
const CH = process.env.QC_CHROME || process.env.CHROME_PATH;
if (!CH) { console.error("falta QC_CHROME"); process.exit(1); }
(async () => {
  const [url, out, w = "1440", h = "900"] = process.argv.slice(2);
  if (!url || !out) { console.error("uso: probe-scroll.cjs <url> <prefijo>"); process.exit(1); }
  const b = await puppeteer.launch({ executablePath: CH, args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
  try { await p.goto(url, { waitUntil: "networkidle2", timeout: 45000 }); } catch (e) { console.error("goto", e.message); }
  for (let y = 0; y < 14000; y += 700) { await p.evaluate(v => scrollTo(0, v), y); await new Promise(r => setTimeout(r, 350)); }
  await new Promise(r => setTimeout(r, 1500));
  const info = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll("img, source")].map(i => ({ src: i.currentSrc || i.src || i.srcset, alt: i.alt || "", y: i.getBoundingClientRect().top + scrollY }));
    return { imgs };
  });
  fs.writeFileSync(out + ".json", JSON.stringify(info, null, 1));
  await p.screenshot({ path: out + ".png" });
  console.log(url, "imgs", info.imgs.length);
  await b.close();
})();
