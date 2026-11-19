/* =========================================================================
   Reading tools in the reader, and the private notebook:
   - Find in this document: every match highlighted (CSS Custom Highlight
     API), Enter and Shift+Enter move between them, folded sections open,
     Escape closes find without closing the reader;
   - reading progress, and "continue where you stopped";
   - the notebook: an answer to the reflection question and notes for each
     document, gathered under Your notebook, downloadable as Markdown, and
     deleted one by one or with "Delete everything";
   - a document still loading is cancelled when you open another one.
   Run: cd tools && node --test tests/notebook.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { serve, watch, SITE } from "./helpers.mjs";

const index = JSON.parse(fs.readFileSync(path.join(SITE, "library", "index.json"), "utf8"));
const titleOf = (id) => index.documents.find((d) => d.id === id).title;

async function openDoc(page, id) {
  await page.evaluate((h) => { location.hash = h; }, "#library/" + id);
  await page.waitForFunction((t) => document.getElementById("reader-title").textContent === t && document.getElementById("reader-doc").getAttribute("aria-busy") === "false", titleOf(id));
}

describe("reading tools and the notebook", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("finds every match, moves between them, and opens folded sections", async () => {
    await openDoc(page, "reflection-prompts");
    await page.click("#reader-find-btn");
    assert.equal(await page.evaluate(() => document.activeElement.id), "reader-find-input");
    const expected = await page.evaluate(() => {
      const doc = document.getElementById("reader-doc").cloneNode(true);
      doc.querySelectorAll(".sr-only").forEach((n) => n.remove());
      return (doc.textContent.match(/reflection/gi) || []).length;
    });
    assert.ok(expected > 5, "the word appears often enough to test with");
    await page.fill("#reader-find-input", "reflection");
    await page.waitForFunction((n) => document.getElementById("reader-find-count").textContent === "1 of " + n, expected);
    assert.equal(await page.evaluate(() => CSS.highlights.get("aice-find").size), expected, "every match is highlighted");
    await page.keyboard.press("Enter");
    assert.equal(await page.textContent("#reader-find-count"), "2 of " + expected);
    await page.keyboard.press("Shift+Enter");
    assert.equal(await page.textContent("#reader-find-count"), "1 of " + expected);
    // Walk through the matches: each one is unfolded and in view
    for (let i = 0; i < Math.min(expected, 30); i++) {
      await page.keyboard.press("Enter");
      const ok = await page.evaluate(() => {
        const r = [...CSS.highlights.get("aice-find-current")][0];
        const box = document.getElementById("reader-scroll").getBoundingClientRect(), rect = r.getBoundingClientRect();
        return { folded: !!r.startContainer.parentElement.closest("details:not([open])"), inView: rect.top >= box.top && rect.bottom <= box.bottom };
      });
      assert.deepEqual(ok, { folded: false, inView: true }, `match ${i + 2}`);
    }
    await page.keyboard.press("Escape");
    const after = await page.evaluate(() => ({ bar: document.getElementById("reader-find").hidden, reader: document.getElementById("reader").open, highlights: CSS.highlights.size, focus: document.activeElement.id }));
    assert.deepEqual(after, { bar: true, reader: true, highlights: 0, focus: "reader-find-btn" });
  });

  it("says so when nothing matches, and matches across bold and italic text", async () => {
    await page.click("#reader-find-btn");
    await page.fill("#reader-find-input", "zzqqxx");
    await page.waitForFunction(() => document.getElementById("reader-find-count").textContent === "No matches");
    // A phrase that spans formatting: take the text of the first <strong> plus what follows it
    const phrase = await page.evaluate(() => {
      const s = [...document.querySelectorAll("#reader-doc p strong")].find((n) => n.nextSibling && n.nextSibling.nodeType === 3 && n.nextSibling.data.trim().length > 4);
      return s ? (s.textContent + s.nextSibling.data).slice(-Math.min(30, (s.textContent + s.nextSibling.data).length)).trim() : "";
    });
    assert.ok(phrase.length > 4);
    await page.fill("#reader-find-input", phrase);
    await page.waitForFunction(() => /^1 of \d+$/.test(document.getElementById("reader-find-count").textContent));
    await page.click("#reader-find-close");
    assert.equal(await page.isHidden("#reader-find"), true);
  });

  it("shows how far you've read and offers to continue where you stopped", async () => {
    await openDoc(page, "ai-collaboration");
    await page.evaluate(() => { const s = document.getElementById("reader-scroll"); s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.6; });
    await page.waitForTimeout(1300);
    const bar = await page.evaluate(() => Number(/scaleX\(([\d.]+)\)/.exec(document.getElementById("reader-progress").style.transform)[1]));
    assert.ok(bar > 0.55 && bar < 0.65, `progress bar at ${bar}`);
    const spot = await page.evaluate(() => JSON.parse(localStorage.getItem("aice:reading")).find((x) => x.id === "ai-collaboration"));
    assert.ok(spot.at > 0.5 && spot.slug && spot.heading, "where you stopped is kept");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("reader").open);
    const chip = await page.evaluate(() => document.querySelector("#library-resume a").getAttribute("href"));
    assert.equal(chip, "#library/ai-collaboration/" + spot.slug, "Pick up where you left off goes to that section");
    await openDoc(page, "ai-collaboration");
    await page.waitForSelector("#reader-resume:not([hidden])");
    assert.match(await page.textContent("#reader-resume-text"), /You stopped at/);
    assert.equal(await page.evaluate(() => document.getElementById("reader-scroll").scrollTop), 0, "nothing moves until you choose");
    await page.click("#reader-resume-go");
    const after = await page.evaluate(() => ({ top: document.getElementById("reader-scroll").scrollTop, hidden: document.getElementById("reader-resume").hidden, focus: document.activeElement.id }));
    assert.ok(after.top > 0 && after.hidden);
    assert.equal(after.focus, "doc-" + spot.slug);
  });

  it("keeps a private notebook for each document", async () => {
    await openDoc(page, "welcome-ritual");
    await page.waitForSelector("#reader-notebook:not([hidden])");
    const question = await page.textContent("#reader-reflect-q");
    await page.fill("#nb-answer", "I'll start Monday with the breathing pause.");
    assert.equal(await page.isHidden("#nb-another"), false, "a new question is offered until you answer");
    await page.fill("#nb-notes", "Ask the class what partnership means to them.");
    await page.click("#nb-section");
    assert.match(await page.inputValue("#nb-notes"), /partnership means to them\.\n\n### .+\n$/);
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    assert.equal(await page.isHidden("#nb-another"), true, "the question stays with your answer");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("reader").open);
    // Gathered under Your notebook
    const item = await page.evaluate(() => { const li = document.querySelector("#nb-list li"); return li ? { title: li.querySelector("a").textContent, text: li.textContent } : null; });
    assert.equal(item.title, titleOf("welcome-ritual"));
    assert.match(item.text, /partnership means/);
    assert.match(item.text, /breathing pause/);
    assert.equal(await page.isHidden("#nb-empty"), true);
    // And still there next time, with the same question
    await openDoc(page, "starter-pack");
    await openDoc(page, "welcome-ritual");
    await page.waitForSelector("#reader-notebook:not([hidden])");
    assert.equal(await page.inputValue("#nb-answer"), "I'll start Monday with the breathing pause.");
    assert.equal(await page.textContent("#reader-reflect-q"), question);
    await page.keyboard.press("Escape");
    // Download it all as Markdown
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#nb-export")]);
    assert.match(dl.suggestedFilename(), /^ai-co-evolution-notebook-\d{4}-\d{2}-\d{2}\.md$/);
    const md = fs.readFileSync(await dl.path(), "utf8");
    assert.match(md, /^# My notebook: AI Co-Evolution in Education/);
    assert.ok(md.includes("## " + titleOf("welcome-ritual")) && md.includes("partnership means") && md.includes("**Reflection:** *" + question + "*"));
    // Listed under Your data
    assert.match(await page.textContent("#data-rows"), /Your notebook/);
  });

  it("deletes notes one document at a time, or everything at once", async () => {
    const del = page.locator("#nb-list li button").first();
    await del.click();
    assert.match(await del.textContent(), /Click again/);
    await del.click();
    await page.waitForFunction(() => !document.querySelector("#nb-list li"));
    assert.equal(await page.evaluate(() => localStorage.getItem("aice:notebook")), null);
    // Write again, then Delete everything
    await openDoc(page, "starter-pack");
    await page.waitForSelector("#reader-notebook:not([hidden])");
    await page.fill("#nb-notes", "Try lesson one.");
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    await page.keyboard.press("Escape");
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForFunction(() => !localStorage.getItem("aice:notebook") && !localStorage.getItem("aice:reading"));
    await openDoc(page, "starter-pack");
    await page.waitForSelector("#reader-notebook:not([hidden])");
    assert.equal(await page.inputValue("#nb-notes"), "");
    await page.keyboard.press("Escape");
    assert.deepEqual(problems, []);
  });

  it("stops loading a document when you open another one first", async () => {
    const ctx = await browser.newContext({ serviceWorkers: "block" });
    const p = await ctx.newPage();
    const failed = [];
    p.on("requestfailed", (r) => failed.push(r.url() + " " + (r.failure() || {}).errorText));
    await ctx.route("**/library/docs/ethical-framework.html*", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue().catch(() => {}); });
    const issues = watch(p, "app");
    await p.goto(server.base, { waitUntil: "load" });
    await p.waitForSelector(".lib-card");
    await p.evaluate(() => { location.hash = "#library/ethical-framework"; });
    await p.waitForTimeout(200);
    await openDoc(p, "onboarding");
    await p.waitForTimeout(1800);
    assert.ok(failed.some((f) => /ethical-framework\.html/.test(f) && /ABORTED|abort/i.test(f)), "the first document's download was stopped: " + failed.join(", "));
    assert.equal(await p.textContent("#reader-title"), titleOf("onboarding"), "the newer document stays open");
    assert.deepEqual(issues, []);
    await ctx.close();
  });
});
