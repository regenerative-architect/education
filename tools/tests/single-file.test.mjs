/* =========================================================================
   The single-file edition (opened from a file, with no internet), the app's
   index.html opened straight from a folder, and layouts from 320px phones
   to wide screens.
   Run: cd tools && npm test   (or: node --test tests/single-file.test.mjs)
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
import { watch, recordPolicyViolations, singleFileUrl, SITE } from "./helpers.mjs";

describe("single-file edition", () => {
  let browser, context, page, problems;
  const requests = [];

  before(async () => {
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    context.on("request", (r) => requests.push(r.url()));
    await recordPolicyViolations(context);
    page = await context.newPage();
    problems = watch(page, "single file");
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
  });
  after(async () => { await browser?.close(); });

  it("carries the whole library inside the file", async () => {
    const s = await page.evaluate(() => ({ build: document.documentElement.getAttribute("data-build"), cards: document.querySelectorAll(".lib-card").length, stats: document.getElementById("library-stats").textContent }));
    assert.equal(s.build, "standalone");
    assert.ok(s.cards > 20);
    assert.match(s.stats, /all inside this file/);
  });

  it("hides app-only controls and shows the single-file notes", async () => {
    const v = await page.evaluate(() => ({
      app: [...document.querySelectorAll(".pwa-only")].filter((n) => n.offsetParent !== null).length,
      single: [...document.querySelectorAll(".standalone-only")].filter((n) => n.offsetParent !== null).length,
      install: document.getElementById("install-btn").offsetParent !== null
    }));
    assert.deepEqual(v, { app: 0, single: v.single, install: false });
    assert.ok(v.single >= 2);
  });

  it("opens documents in the reader", async () => {
    await page.click('.lib-card[data-doc="class-ai-agreement"]');
    await page.waitForFunction(() => document.querySelector("#reader-doc h2"));
    assert.match(await page.textContent("#reader-title"), /Class AI agreement/);
    assert.equal(await page.evaluate(() => location.hash), "#library/class-ai-agreement");
  });

  it("explains that a file's address can't be shared, instead of showing a useless QR code", async () => {
    await page.click("#reader-share");
    await page.waitForSelector("#share-dialog[open]");
    const s = await page.evaluate(() => ({ qr: !document.getElementById("share-qr").hidden, link: !document.getElementById("share-link-row").hidden, note: document.getElementById("share-note").textContent }));
    assert.equal(s.qr, false);
    assert.equal(s.link, false);
    assert.match(s.note, /send the file itself/);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  it("searches the library from the documents inside the file", async () => {
    await page.keyboard.press("Control+k");
    await page.fill("#search-input", "citizen science");
    await page.waitForFunction(() => [...document.querySelectorAll("#search-results .sr-group")].some((g) => /library/i.test(g.textContent)), null, { timeout: 8000 });
    const lib = await page.$$eval("#search-results [role=option]", (o) => o.map((x) => x.getAttribute("data-href")).filter((h) => h.startsWith("#library/")));
    assert.ok(lib.length >= 3, lib.join(" "));
    await page.keyboard.press("Escape");
  });

  it("makes no network requests at all, with no errors or policy violations", async () => {
    await page.goto(singleFileUrl("#offline"));
    await page.waitForTimeout(400);
    assert.deepEqual(requests.filter((u) => !/^(file|data|blob):/.test(u)), []);
    assert.deepEqual(problems, []);
    assert.equal(await page.evaluate(() => window.__csp.length + window.__aiceErrors.length), 0);
  });
});

describe("the app opened straight from a folder", () => {
  let browser, page, problems;
  before(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    problems = watch(page, "folder");
    await page.goto("file://" + path.join(SITE, "index.html"), { waitUntil: "load" });
    await page.waitForTimeout(800);
  });
  after(async () => { await browser?.close(); });

  it("still runs its scripts and fonts", async () => {
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("js") && document.fonts.check('16px "Atkinson Next"')));
  });
  it("points the library to the single-file edition", async () => {
    const f = await page.evaluate(() => ({ note: (document.querySelector("#library-groups .callout") || {}).textContent || "", link: !!document.querySelector('#library-groups a[href="download/ai-co-evolution-in-education.html"]') }));
    assert.match(f.note, /single-file edition/);
    assert.ok(f.link);
  });
  it("explains why the offline copy isn't available, without errors", async () => {
    assert.match(await page.textContent("#off-app"), /opened from a folder/);
    assert.deepEqual(problems, []);
  });
});

describe("layouts from phones to wide screens", () => {
  let browser, page;
  before(async () => { browser = await chromium.launch(); page = await browser.newPage(); });
  after(async () => { await browser?.close(); });

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    it(`fits at ${width}px: no sideways scrolling, and the reader's buttons fit`, async () => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(singleFileUrl("#library"), { waitUntil: "load" });
      await page.waitForSelector(".lib-card");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "page fits");
      await page.goto(singleFileUrl("#library/implementation-roadmap"), { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#reader-doc h2"));
      const r = await page.evaluate(() => {
        const scroll = document.getElementById("reader-scroll");
        const head = document.querySelector(".reader-head").getBoundingClientRect();
        const btns = [...document.querySelectorAll(".reader-actions button")].filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect());
        return { fits: scroll.scrollWidth <= scroll.clientWidth, head: btns.every((b) => b.right <= head.right + 1 && b.left >= head.left - 1) };
      });
      assert.deepEqual(r, { fits: true, head: true });
    });
  }
});
