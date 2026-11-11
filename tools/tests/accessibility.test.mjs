/* =========================================================================
   Accessibility, checked by axe-core (Deque, MPL-2.0) against WCAG 2.2 A
   and AA plus best practices, in every state people meet: the page in
   light and dark, phones, the reader (also presenting, with its section
   list open, with find open, and with notes), your notebook, the AI Lab,
   search with results, sharing, settings, importing your data, the offline
   and 404 pages, and the single file.
   Automated checks find about a third to half of accessibility problems.
   They don't replace trying the toolkit with a keyboard and a screen reader.
   To add a state: add one line to STATES below.
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { serve, singleFileUrl } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const openDoc = (id) => async (p) => {
  await p.evaluate((h) => { location.hash = h; }, "#library/" + id);
  await p.waitForFunction(() => document.querySelector("#reader-doc h2"));
  await p.waitForTimeout(300);
};
const STATES = [
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
  ["the single file", { file: true }]
];

describe("accessibility (axe-core)", () => {
  let server, browser;
  before(async () => { server = await serve(); browser = await chromium.launch(); });
  after(async () => { await browser?.close(); await server?.close(); });

  for (const [label, opts, steps] of STATES) {
    it(`${label}: no violations`, async () => {
      // bypassCSP only lets the test inject axe; the app itself runs under its normal policy
      const ctx = await browser.newContext({ bypassCSP: true, viewport: opts.viewport || { width: 1280, height: 900 }, colorScheme: opts.scheme || "light", serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto(opts.file ? singleFileUrl() : server.base + (opts.path || ""), { waitUntil: "load" });
      await page.waitForTimeout(400);
      if (steps) await steps(page);
      await page.addScriptTag({ path: AXE });
      const violations = await page.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
        return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("; ")}`);
      }, TAGS);
      await ctx.close();
      assert.deepEqual(violations, []);
    });
  }
});
