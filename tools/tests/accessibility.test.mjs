/* =========================================================================
   Accessibility, checked by axe-core (Deque, MPL-2.0) against WCAG 2.2 A
   and AA plus best practices, in every state people meet: the page in
   light and dark, phones, the reader (also presenting, with its section
   list open, with find open, and with notes), your notebook, the AI Lab,
   search with results, sharing, settings, importing your data, the question
   ladder built from a Kiwix library (with a topic that can hurt), the offline
   and 404 pages, the single file, and the single file inside a preview (the
   "copy the text instead" box, and the notice shown when something fails).
   Automated checks find about a third to half of accessibility problems.
   They don't replace trying the toolkit with a keyboard and a screen reader.
   To add a state: add one line to STATES below. Steps get the page, or for
   { preview: true } states the frame the toolkit is shown in.
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { serve, singleFileUrl, SINGLE_FILE, fakeTranslator, ladderLibrary } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const openDoc = (id) => async (p) => {
  await p.evaluate((h) => { location.hash = h; }, "#library/" + id);
  await p.waitForFunction(() => document.querySelector("#reader-doc h2"));
  await p.waitForTimeout(300);
};
/* The question ladder built from the test Kiwix library, with every "Why this question" open */
const ladderFrom = (query, title) => async (p) => {
  await p.locator("#ladder-tool").scrollIntoViewIfNeeded();
  await p.click("#ladder-kiwix summary");
  await p.setInputFiles("#ladder-file", ladderLibrary());
  await p.waitForFunction(() => /Search its titles/.test(document.getElementById("ladder-lib").textContent));
  await p.fill("#ladder-search", query);
  await p.waitForFunction((q) => document.getElementById("ladder-results").getAttribute("data-query") === q, query);
  await p.locator("#ladder-results button", { hasText: title }).first().click();
  await p.waitForFunction((t) => document.getElementById("ladder-source-text").textContent.startsWith("Built from “" + t), title);
  await p.evaluate(() => document.querySelectorAll("#ladder-list details").forEach((d) => { d.open = true; }));
};
const STATES = [
  ...(ladderLibrary() ? [
    ["the question ladder built from a Kiwix library, with its reasons and quotes open", {}, ladderFrom("photo", "Photosynthesis")],
    ["the question ladder on a phone, dark, with a topic that can hurt", { viewport: { width: 390, height: 844 }, scheme: "dark" }, ladderFrom("landm", "Landmine")]
  ] : []),
  ["planning a unit in the curriculum studio", {}, async (p) => { await p.locator("#studio-tool").scrollIntoViewIfNeeded(); await p.selectOption("#studio-example", "0"); await p.click("#studio-example-open"); await p.waitForSelector("#studio-editor:not([hidden])"); }],
  ["the curriculum studio on a phone, dark, with AI teacher-led", { viewport: { width: 390, height: 844 }, scheme: "dark" }, async (p) => { await p.locator("#studio-tool").scrollIntoViewIfNeeded(); await p.selectOption("#studio-example", "1"); await p.click("#studio-example-open"); await p.waitForSelector(".su-young-note:not([hidden])"); }],
  ["the page, light", {}],
  ["the page, dark", { scheme: "dark" }],
  ["the page on a phone", { viewport: { width: 390, height: 844 } }],
  ["the reader, light", {}, openDoc("starter-pack")],
  ["the reader, dark", { scheme: "dark" }, openDoc("implementation-roadmap")],
  ["the reader on a phone, sections open", { viewport: { width: 390, height: 844 } }, async (p) => { await openDoc("code-of-conduct")(p); await p.click("#reader-toc-btn"); }],
  ["the reader, presenting", {}, async (p) => { await openDoc("welcome-ritual")(p); await p.click("#reader-present"); await p.waitForTimeout(300); }],
  ["search with results", {}, async (p) => { await p.keyboard.press("Control+k"); await p.fill("#search-input", "privacy"); await p.waitForTimeout(1500); }],
  ["sharing", {}, async (p) => { await openDoc("assessment-rubrics")(p); await p.click("#reader-share"); await p.waitForSelector(".qr-svg"); }],
  ["reading comfort settings", {}, async (p) => { await p.click('[data-open="comfort-dialog"]'); await p.waitForTimeout(200); }],
  ["contents on a phone", { viewport: { width: 390, height: 844 } }, async (p) => { await p.click('[data-open="toc-dialog"]'); await p.waitForTimeout(200); }],
  ["the reader with find open", {}, async (p) => { await openDoc("reflection-prompts")(p); await p.click("#reader-find-btn"); await p.fill("#reader-find-input", "reflection"); await p.waitForTimeout(400); }],
  ["the reader's notebook on a phone, dark", { viewport: { width: 390, height: 844 }, scheme: "dark" }, async (p) => { await openDoc("welcome-ritual")(p); await p.fill("#nb-notes", "Try the pause on Monday."); await p.waitForTimeout(800); await p.locator("#nb-notes").scrollIntoViewIfNeeded(); }],
  ["your notebook, with notes", {}, async (p) => { await openDoc("starter-pack")(p); await p.fill("#nb-answer", "Lesson one first."); await p.waitForTimeout(800); await p.keyboard.press("Escape"); await p.locator("#notebook").scrollIntoViewIfNeeded(); }],
  ["the AI Lab, token counter on", {}, async (p) => { await p.locator("#lab").scrollIntoViewIfNeeded(); await p.click("#tok-load"); await p.waitForSelector("#tok-ui:not([hidden])"); await p.locator("#tok-chart .hbar").nth(1).hover(); }],
  ["the AI Lab's models on a phone, dark", { viewport: { width: 390, height: 844 }, scheme: "dark" }, async (p) => { await p.locator("#lab-next").scrollIntoViewIfNeeded(); await p.click("#next-build"); await p.waitForSelector("#next-ui:not([hidden])", { timeout: 30000 }); await p.click("#next-one"); await p.click("#data-run"); await p.waitForSelector("#data-out:not([hidden])", { timeout: 30000 }); }],
  ["importing your data", {}, async (p) => { await p.setInputFiles("#data-import", { name: "my-data.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ schema: 2, data: { role: "student", rest: true, unknown: 1 } })) }); await p.waitForSelector("#import-dialog[open]"); }],
  ["the offline page", { path: "offline.html" }],
  ["the 404 page", { path: "missing/page" }],
  ["the single file", { file: true }],
  ["the reader with a family-language translation, dark", { scheme: "dark", init: fakeTranslator }, async (p) => { await openDoc("welcome-ritual")(p); await p.click("#reader-translate-btn"); await p.selectOption("#tr-lang", "ar"); await p.click("#tr-go"); await p.waitForFunction(() => /^Translated/.test(document.getElementById("tr-status").textContent)); }],
  ["the class agreement with a family-language translation", { init: fakeTranslator }, async (p) => { await p.locator("#agreement").scrollIntoViewIfNeeded(); await p.selectOption("#agreement-tr-lang", "es"); await p.click("#agreement-tr-go"); await p.waitForFunction(() => /^Translated/.test(document.getElementById("agreement-tr-status").textContent)); }],
  ["a circle in progress, dark", { scheme: "dark" }, async (p) => { await p.locator("#circle-tool").scrollIntoViewIfNeeded(); await p.fill("#circle-people", "8"); await p.click("#circle-start"); await p.click("#circle-next"); await p.click("#circle-pass"); }],
  ["a decision by consent, with its record", {}, async (p) => { await p.locator("#circle-tool").scrollIntoViewIfNeeded(); await p.click('label:has(input[name="circle-kind"][value="decide"])'); await p.fill("#circle-proposal", "We try AI-free Fridays."); await p.fill("#circle-people", "2"); await p.click("#circle-start"); for (let i = 0; i < 4; i++) await p.click("#circle-next"); await p.click('[data-answer="consent"]'); await p.click('[data-answer="concern"]'); await p.waitForSelector("#circle-record:not([hidden])"); }],
  ["practising a key idea, the answer showing", {}, async (p) => { await p.locator("#practice-tool").scrollIntoViewIfNeeded(); await p.click("#practice-start"); await p.waitForSelector("#practice-card:not([hidden])"); await p.click("#practice-show"); }],
  ["the practice overview on a phone, dark", { viewport: { width: 390, height: 844 }, scheme: "dark" }, async (p) => { await p.locator("#practice-tool").scrollIntoViewIfNeeded(); }],
  ["the writing check with suggestions, dark", { scheme: "dark" }, async (p) => { await p.locator("#wc-tool").scrollIntoViewIfNeeded(); await p.click("#wc-example"); await p.waitForSelector("#wc-results:not([hidden])"); await p.locator("#wc-list .wc-item").first().getByRole("button", { name: "Show it" }).click(); }],
  ["the writing check on a phone", { viewport: { width: 390, height: 844 } }, async (p) => { await p.locator("#wc-tool").scrollIntoViewIfNeeded(); await p.click("#wc-example"); await p.waitForSelector("#wc-results:not([hidden])"); }],
  ["locking your data with a passphrase", {}, async (p) => { await p.locator("#your-data").scrollIntoViewIfNeeded(); await p.click("#data-export-locked"); await p.fill("#lock-pass", "short"); await p.click("#lock-go"); }],
  ["reading comfort with the reading guide and wider letters, dark", { scheme: "dark", settings: { guide: true, letters: true } }, async (p) => { await p.click('[data-open="comfort-dialog"]'); await p.mouse.move(400, 300); await p.waitForTimeout(200); }],
  ["inside a preview: “Copy the text instead”", { preview: true }, async (f) => { await f.locator("#agreement-download").scrollIntoViewIfNeeded(); await f.click("#agreement-download"); await f.click('#toasts button:has-text("Show the text to copy")'); await f.waitForSelector("#copy-dialog[open]"); }],
  ["inside a preview: the notice when something fails, dark", { preview: true, scheme: "dark" }, async (f) => { await f.evaluate(() => { setTimeout(() => { throw new Error("A test problem"); }, 0); }); await f.waitForSelector("#problem-note"); await f.click("#problem-note summary"); }]
];

/* The single file in a sandboxed frame that may use storage, the way a file preview shows it */
async function inPreview(ctx, page) {
  await ctx.route("http://preview.test/**", (route) => route.fulfill(route.request().url().endsWith("/the-file.html")
    ? { contentType: "text/html; charset=utf-8", body: fs.readFileSync(SINGLE_FILE) }
    : { contentType: "text/html", body: '<!DOCTYPE html><html lang="en"><title>A preview</title><link rel="icon" href="data:,"><body style="margin:0"></body></html>' }));
  await page.goto("http://preview.test/");
  await page.evaluate(async () => {
    const frame = document.createElement("iframe");
    frame.id = "app";
    frame.title = "The toolkit";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.style.cssText = "width:100%;height:860px;border:0";
    frame.srcdoc = await (await fetch("the-file.html")).text();
    document.body.appendChild(frame);
  });
  await page.frameLocator("#app").locator(".lib-card").first().waitFor();
  return page.frames().find((f) => f !== page.mainFrame());
}

describe("accessibility (axe-core)", () => {
  let server, browser;
  before(async () => { server = await serve(); browser = await chromium.launch(); });
  after(async () => { await browser?.close(); await server?.close(); });

  for (const [label, opts, steps] of STATES) {
    it(`${label}: no violations`, async () => {
      // bypassCSP only lets the test inject axe; the app itself runs under its normal policy
      const ctx = await browser.newContext({ bypassCSP: true, viewport: opts.viewport || { width: 1280, height: 900 }, colorScheme: opts.scheme || "light", serviceWorkers: "block", reducedMotion: "reduce" });
      if (opts.init) await ctx.addInitScript(opts.init);   // a stand-in for a browser feature (the translator)
      if (opts.settings) await ctx.addInitScript((s) => localStorage.setItem("aice:settings", JSON.stringify(s)), opts.settings);
      const page = await ctx.newPage();
      let target = page;
      if (opts.preview) target = await inPreview(ctx, page);
      else await page.goto(opts.file ? singleFileUrl() : server.base + (opts.path || ""), { waitUntil: "load" });
      await page.waitForTimeout(400);
      if (steps) await steps(target);
      await target.addScriptTag({ path: AXE });
      const violations = await target.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
        return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("; ")}`);
      }, TAGS);
      await ctx.close();
      assert.deepEqual(violations, []);
    });
  }
});
