/* =========================================================================
   The page's own tools, used the way a teacher would on a phone in dark
   mode: contents, search, reading comfort, theme, role paths, quick start,
   question ladder, SACRED check, class agreement (with print and
   download), disclosure statement, prompt deck, footprint, system map,
   readiness, data inventory and delete-everything, the breathing ritual
   and copy buttons. Then reduced motion, and a browser that blocks storage.
   Runs on the single-file edition. Run: cd tools && npm test
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { watch, recordPolicyViolations, singleFileUrl } from "./helpers.mjs";

describe("page tools on a phone, dark mode", () => {
  let browser, ctx, page, problems;
  const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
  before(async () => {
    browser = await chromium.launch();
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
    await recordPolicyViolations(ctx);
    await ctx.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    page = await ctx.newPage();
    problems = watch(page, "phone");
    await page.goto(singleFileUrl());
    await page.waitForTimeout(700);
  });
  after(async () => { await browser?.close(); });

  it("contents: opens, navigates, and moves focus to the section heading", async () => {
    await page.click('button[data-open="toc-dialog"]');
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.getElementById("toc-dialog").open));
    await page.click('#toc-dialog-body a[href="#evidence"]');
    await page.waitForTimeout(900);
    assert.ok(await page.evaluate(() => !document.getElementById("toc-dialog").open && location.hash === "#evidence"));
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "evidence-h");
  });

  it("search: opens with Ctrl+K, finds, and Enter navigates", async () => {
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => document.getElementById("search-dialog").open));
    await page.keyboard.type("privacy");
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => !!document.querySelector('#search-results li[aria-selected="true"]')));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    assert.ok(await page.evaluate(() => !document.getElementById("search-dialog").open && location.hash.length > 1));
  });

  it("reading comfort: text size and plain mode apply, reset, and Escape closes", async () => {
    await page.click('button[data-open="comfort-dialog"]');
    await page.waitForTimeout(250);
    await page.click('#comfort-dialog label:has(input[name="c-text"][value="lg"])');
    await page.click("#comfort-dialog label.switch:has(#c-simple)");
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-text")), "lg");
    assert.ok(await page.evaluate(() => document.documentElement.getAttribute("data-simple") === "on" && getComputedStyle(document.getElementById("under-hood")).display === "none"), "plain mode hides technical parts");
    await page.click("#c-reset");
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => document.documentElement.getAttribute("data-text") === "md" && !document.documentElement.hasAttribute("data-simple")));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => !document.getElementById("comfort-dialog").open));
  });

  it("theme: toggles to light and back", async () => {
    await page.click("#theme-toggle");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-resolved-theme")), "light");
    await page.click("#theme-toggle");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-resolved-theme")), "dark");
  });

  it("role paths, quick start and the question ladder respond", async () => {
    await page.click('#role-picker button[data-role="family"]');
    assert.ok(await page.evaluate(() => !document.querySelector('.role-path[data-role="family"]').hidden && document.querySelector('.role-path[data-role="teacher"]').hidden));
    await page.check('#quickstart input[data-qs="0"]');
    assert.equal(await text("#qs-status"), "1 of 3 done");
    await page.fill("#ladder-topic", "fractions");
    assert.match(await text("#ladder-list .rung-q"), /fractions/);
  });

  it("SACRED check: ready, then pause, then save and download", async () => {
    for (const k of ["S", "A", "C", "R", "E", "D"]) await page.check(`input[name="${k}"][value="4"]`, { force: true });
    await page.check('#sacred-form input[name="optout"]');
    await page.check('#sacred-form input[name="reversible"]');
    await page.fill("#sacred-activity", "Socratic questioning with AI");
    assert.equal(await text("#sacred-status .status-title"), "Ready to proceed");
    await page.check('input[name="R"][value="2"]', { force: true });
    assert.equal(await text("#sacred-status .status-title"), "Pause and redesign");
    await page.click("#sacred-save");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#sacred-log li").length), 1);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 4000 }), page.click("#sacred-download")]);
    assert.equal(dl.suggestedFilename(), "sacred-check.txt");
  });

  it("class agreement: preview, print only the agreement, and download", async () => {
    await page.check('#agreement-tool input[name="band"][value="k5"]', { force: true });
    await page.fill("#agreement-class", "Room 4");
    await page.fill("#agreement-custom", "We take turns.");
    await page.click("#agreement-add");
    const preview = await text("#agreement-preview");
    assert.ok(preview.includes("Our classroom AI promise") && preview.includes("We take turns.") && preview.includes("Room 4"));
    await page.click('button[data-print="agreement-preview"]');
    assert.ok(await page.evaluate(() => window.__printed === 1 && !!document.getElementById("print-root") && document.documentElement.hasAttribute("data-printing")));
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.ok(await page.evaluate(() => !document.getElementById("print-root") && !document.documentElement.hasAttribute("data-printing")), "print clean-up");
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 4000 }), page.click("#agreement-download")]);
    assert.ok(dl.suggestedFilename());
  });

  it("disclosure statement, prompt deck, points, footprint and system map", async () => {
    await page.fill("#d-tool", "the class chatbot");
    await page.click("#disclose-form .chip-checks label:nth-child(1)");
    await page.click("#disclose-form .chip-checks label:nth-child(4)");
    await page.fill("#d-mine", "Wrote every paragraph.");
    const stmt = await text("#d-output");
    assert.ok(stmt.startsWith("I used the class chatbot to brainstorm ideas and check facts.") && stmt.includes("I did this myself: wrote every paragraph."), stmt);
    const before = await text("#deck-card-q");
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) { await page.click("#deck-draw"); changed = (await text("#deck-card-q")) !== before; }
    assert.ok(changed, "the deck draws a new prompt");
    await page.fill("#xp-today", "260");
    assert.match(await text("#xp-output"), /soft cap/);
    // Footprint: 25 students × 10 prompts × 12 lessons, worked out with the EcoLogits method
    await page.fill("#fp-students", "25");
    assert.equal(await text("#fp-total"), "3,000");
    assert.equal(await text("#fp-energy"), "987 Wh");
    assert.equal(await text("#fp-energy-label"), "electricity: about 0.33 Wh per answer, or a 10\u00a0W LED bulb burning for 99 hours");
    assert.equal(await text("#fp-water"), "0.8 to 135 L");
    await page.selectOption("#fp-model", "200");
    await page.selectOption("#fp-length", "1500");
    assert.equal(await text("#fp-energy"), "11.6 kWh");
    assert.match(await text("#fp-energy-label"), /^electricity: about 3\.9 Wh per answer, or a 10\u00a0W LED bulb burning for 1,161 hours$/);
    await page.click("#tab-wellbeing");
    assert.match(await text("#sysmap-detail"), /Pillar 2/);
  });

  it("readiness self-check adds up", async () => {
    await page.check('#ready-form input[name="lead"][value="10"]', { force: true });
    for (const b of await page.$$('#ready-form .ready-domain[data-domain="Infrastructure"] input[type="checkbox"]')) await b.check();
    assert.equal(await text("#ready-total"), "35");
  });

  it("delete everything empties storage in two clicks and resets the tools", async () => {
    const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("aice:")).length);
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("aice:")).length);
    assert.ok(before > 0 && after === 0, `${before} -> ${after}`);
    assert.ok(await page.evaluate(() => document.querySelectorAll("#sacred-log li").length === 0 && !document.querySelector('#quickstart input[data-qs="0"]').checked));
  });

  it("the breathing ritual runs and closes; copy buttons confirm", async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.click("#ritual-start");
    await page.waitForTimeout(1500);
    await page.click("#ritual-skip");
    await page.click("#ritual-close");
    assert.ok(await page.evaluate(() => document.getElementById("ritual").hidden));
    await page.click('button[data-copy="p-tutor"]');
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => document.querySelectorAll("#toasts .toast").length > 0));
  });

  it("nothing scrolls sideways, and there were no errors or policy violations", async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    assert.deepEqual(await page.evaluate(() => ({ errors: window.__aiceErrors, csp: window.__csp })), { errors: [], csp: [] });
    assert.deepEqual(problems, []);
  });
});

describe("reduced motion", () => {
  let browser;
  after(async () => { await browser?.close(); });
  it("hides the motion toggle and keeps the ritual's text steady", async () => {
    browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })).newPage();
    const problems = watch(page, "reduced motion");
    await page.goto(singleFileUrl());
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => document.getElementById("motion-toggle").hidden));
    await page.click("#ritual-start");
    await page.waitForTimeout(2500);
    assert.equal(await page.evaluate(() => document.getElementById("ritual-phase").style.fontWeight), "400");
    assert.deepEqual(problems, []);
  });
});

describe("a browser that blocks storage", () => {
  let browser;
  after(async () => { await browser?.close(); });
  it("still works, and the data panel explains", async () => {
    browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const problems = watch(page, "storage blocked");
    await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
    await page.goto(singleFileUrl());
    await page.waitForTimeout(400);
    assert.deepEqual(problems, []);
    assert.equal(await page.evaluate(() => window.__aiceErrors.length), 0);
    assert.match(await page.textContent("#data-empty"), /isn't allowing storage/);
  });
});
