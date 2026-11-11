#!/usr/bin/env node
/* =========================================================================
   make-epub-cover.mjs: draws the e-book's cover (tools/assets/epub-cover.jpg).

   The cover is the app's emblem (site/assets/icons/icon.svg: a golden leaf in
   a beam of light) with the title, set in the app's own fonts, rendered by
   the test browser. The result is committed, so building the downloads never
   needs a browser. Run this only when you want to change the cover:

     cd tools && node make-epub-cover.mjs

   To adapt it: edit COVER below (colours, words), run it, and look at the
   JPEG before committing. Keep the title large and the contrast high: covers
   are often seen as small thumbnails.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, "..", "site");
const out = path.join(here, "assets", "epub-cover.jpg");
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(site, "assets", "fonts", f)).toString("base64");
// The emblem without its rounded tile, so the leaf and light sit straight on the cover
const emblem = fs.readFileSync(path.join(site, "assets", "icons", "icon.svg"), "utf8")
  .replace(/<rect[^>]*\/>/, "")
  .replace(/<path d="M318 0[^>]*\/>/, "");

const COVER = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Atkinson Next"; src: url(${font("atkinson-hyperlegible-next.woff2")}) format("woff2"); font-weight: 200 800; }
@font-face { font-family: "Literata Voice"; src: url(${font("literata-italic.woff2")}) format("woff2"); font-style: italic; font-weight: 200 900; }
html, body { margin: 0; width: 1200px; height: 1800px; overflow: hidden; }
body {
  position: relative; color: #fff3d6; font-family: "Atkinson Next", sans-serif;
  background: radial-gradient(120% 80% at 70% 12%, #2b6a6b 0%, #143b3c 48%, #0b2022 100%);
}
/* A soft beam of light, as in the emblem */
.beam { position: absolute; inset: -10% 0 0 0; background: linear-gradient(180deg, rgba(255,243,214,.16), rgba(255,243,214,0) 70%);
        clip-path: polygon(62% 0, 82% 0, 40% 100%, 22% 100%); }
.emblem { position: absolute; left: 50%; top: 170px; width: 640px; height: 640px; transform: translateX(-50%); }
.emblem svg { width: 100%; height: 100%; }
.text { position: absolute; left: 110px; right: 110px; top: 860px; text-align: center; }
h1 { font-size: 112px; line-height: 1.02; font-weight: 750; letter-spacing: -0.02em; margin: 0 0 44px; }
.voice { font-family: "Literata Voice", serif; font-style: italic; font-size: 50px; line-height: 1.3; color: #fbdc98; margin: 0 0 56px; text-wrap: balance; }
.what { font-size: 38px; line-height: 1.4; margin: 0; color: #e8efe9; text-wrap: balance; }
.rule { width: 160px; height: 3px; margin: 0 auto 48px; background: #f2b84e; border-radius: 2px; }
.who { position: absolute; left: 0; right: 0; bottom: 110px; text-align: center; font-size: 34px; letter-spacing: 0.14em; text-transform: uppercase; color: #cfe3dc; }
</style></head><body>
<div class="beam"></div>
<div class="emblem">${emblem}</div>
<div class="text">
  <h1>AI Co-Evolution in Education</h1>
  <p class="voice">Not to replace teachers, but to walk beside them.</p>
  <div class="rule"></div>
  <p class="what">The library: guides, lesson plans and templates for teaching with AI while protecting student voice, wellbeing and privacy</p>
</div>
<p class="who">Planetary Restoration Archive</p>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 }, deviceScaleFactor: 1 });
  await page.setContent(COVER);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: "jpeg", quality: 84 });
  console.log(`Cover: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
