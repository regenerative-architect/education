/* =========================================================================
   The AI Lab:
   - the token counter gives exactly the counts of the GPT-4o token set
     (checked against gpt-tokenizer here in Node.js), is fetched once and
     saved for offline use in the app, and is unpacked from inside the
     single file with no network at all;
   - the language comparison shows all twelve languages, largest first, and
     choosing one shows its pieces;
   - the next-word model is built from the library on this device, explains
     each guess, says where each word came from, and at adventurousness 0
     always makes the same choice;
   - the training-data comparison trains two models on different parts of
     the library;
   - chart tooltips open on hover and keyboard focus, and close with Escape.
   Run: cd tools && node --test tests/lab.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { serve, watch, recordPolicyViolations, singleFileUrl } from "./helpers.mjs";

const DEFAULT_TEXT = "Every student deserves to be heard, in every language.";

describe("AI Lab in the installable app", () => {
  let server, browser, context, page, problems;
  const outside = [];
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    context.on("request", (r) => { if (!r.url().startsWith(server.origin) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url()); });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.locator("#lab").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("counts tokens exactly like the GPT-4o token set, on this device", async () => {
    await page.click("#tok-load");
    await page.waitForSelector("#tok-ui:not([hidden])");
    const expected = encode(DEFAULT_TEXT).length;
    assert.match(await page.textContent("#tok-stats"), new RegExp("^" + expected + " tokens"));
    assert.equal(await page.locator("#tok-view .tok").count(), expected);
    const mine = "Kindness is a skill we practise together.";
    await page.fill("#tok-input", mine);
    await page.waitForFunction((n) => document.getElementById("tok-stats").textContent.startsWith(n + " tokens"), encode(mine).length);
    assert.equal(await page.locator("#tok-list li").count(), encode(mine).length);
  });

  it("downloads the token counter once and keeps it for offline use", async () => {
    const saved = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((n) => /^aice-extras-[0-9a-f]{12}@/.test(n));
      if (names.length !== 1) return names;
      const keys = await (await caches.open(names[0])).keys();
      return keys.map((r) => new URL(r.url).pathname.replace(/^.*\/site\//, ""));
    });
    assert.deepEqual(saved, ["vendor/gpt-tokenizer.js"]);
    assert.equal(server.requests.filter((r) => r.startsWith("/site/vendor/gpt-tokenizer.js")).length, 1, "fetched once");
    // Listed under Your data (the list refreshes a moment after the service worker saves it)
    await page.waitForFunction(() => /Saved tool helpers/.test(document.getElementById("data-rows").textContent), null, { timeout: 5000 });
  });

  it("compares Article 1 in twelve languages, largest first, and shows a language's pieces", async () => {
    const rows = await page.$$eval("#tok-chart .hbar", (bs) => bs.map((b) => b.textContent));
    assert.equal(rows.length, 12);
    assert.match(rows[0], /^Inuktitut/);
    assert.match(rows[rows.length - 1], /^English.*baseline/);
    assert.equal(await page.locator("#tok-table tr").count(), 12);
    const counts = rows.map((t) => Number(/([\d,]+) tokens/.exec(t)[1].replace(/,/g, "")));
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "ranked largest first");
    await page.locator("#tok-chart .hbar").first().click();
    const text = await page.inputValue("#tok-input");
    assert.match(text, /^ᐃᓅᔪᓕᒫᑦ/);
    await page.waitForFunction((n) => document.getElementById("tok-stats").textContent.startsWith(n + " tokens"), encode(text).length);
    assert.equal(counts[0], encode(text).length);
  });

  it("opens chart tooltips on hover and keyboard focus, and closes them with Escape", async () => {
    await page.locator("#tok-chart .hbar").nth(2).hover();
    await page.waitForSelector("#lab-tokens .lab-tip:not([hidden])");
    assert.match(await page.textContent("#lab-tokens .lab-tip"), /tokens/);
    await page.mouse.move(0, 0);
    await page.waitForSelector("#lab-tokens .lab-tip", { state: "hidden" });
    await page.locator("#tok-chart .hbar").nth(3).focus();
    await page.waitForSelector("#lab-tokens .lab-tip:not([hidden])");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#lab-tokens .lab-tip", { state: "hidden" });
  });

  it("builds a next-word model from the library and explains each guess", async () => {
    await page.click("#next-build");
    await page.waitForSelector("#next-ui:not([hidden])", { timeout: 30000 });
    const bars = await page.locator("#next-chart .hbar").count();
    assert.ok(bars > 0 && bars <= 6);
    assert.match(await page.textContent("#next-context"), /It looked at the last two words, “ai can”, seen \d+ times in the library\./);
    await page.click("#next-one");
    assert.equal(await page.locator("#next-out .gen").count(), 1);
    assert.match(await page.textContent("#next-source"), /First seen in/);
    assert.match(await page.getAttribute("#next-source a", "href"), /^#library\/[a-z0-9-]+$/);
    // Choosing a bar adds that word
    const word = (await page.locator("#next-chart .hbar .hbar-label").first().textContent()).trim();
    await page.locator("#next-chart .hbar").first().click();
    assert.equal((await page.locator("#next-out .gen").last().textContent()).trim(), word);
  });

  it("at adventurousness 0 it always takes the likeliest word", async () => {
    await page.fill("#next-temp", "0");
    await page.dispatchEvent("#next-temp", "input");
    assert.equal(await page.textContent("#next-temp-out"), "0.0");
    const run = async () => {
      await page.click("#next-reset");
      await page.click("#next-ten");
      await page.waitForFunction(() => !document.getElementById("next-ten").disabled);
      return page.textContent("#next-out");
    };
    const first = await run();
    assert.ok((await page.locator("#next-out .gen").count()) >= 3, "it wrote several words");
    assert.equal(await run(), first, "the same words both times");
  });

  it("trains two models on different parts of the library and compares them", async () => {
    await page.selectOption("#data-a", "Lessons and classroom tools");
    await page.selectOption("#data-b", "Local ecosystem study");
    await page.fill("#data-prompt", "students");
    await page.click("#data-run");
    await page.waitForSelector("#data-out:not([hidden])", { timeout: 30000 });
    assert.ok(await page.locator("#data-chart-a .hbar").count() > 0);
    assert.ok(await page.locator("#data-chart-b .hbar").count() > 0);
    assert.match(await page.textContent("#data-summary"), /Model A's likeliest next word is “.+” \(\d+%|under 1%\)\. Model B's likeliest/);
    assert.match(await page.textContent("#data-card-a"), /^Read [\d,]+ words from \d+ documents\./);
    await page.selectOption("#data-b", "Lessons and classroom tools");
    await page.click("#data-run");
    await page.waitForFunction(() => /Both models read the same documents/.test(document.getElementById("data-summary").textContent));
  });

  it("stays on this device: no errors and no requests to other websites", () => {
    assert.deepEqual(problems, []);
    assert.deepEqual(outside, []);
  });
});

describe("AI Lab in the single file, offline", () => {
  let browser;
  before(async () => { browser = await chromium.launch(); });
  after(async () => { await browser?.close(); });

  it("unpacks the token counter from inside the file and builds the models with no network", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: "reduce" });
    const requests = [];
    context.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
    await recordPolicyViolations(context);
    const page = await context.newPage();
    const problems = watch(page, "single file");
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.locator("#lab").scrollIntoViewIfNeeded();
    await page.click("#tok-load");
    await page.waitForSelector("#tok-ui:not([hidden])", { timeout: 20000 });
    assert.match(await page.textContent("#tok-stats"), new RegExp("^" + encode(DEFAULT_TEXT).length + " tokens"));
    assert.equal(await page.locator("#tok-chart .hbar").count(), 12);
    await page.click("#next-build");
    await page.waitForSelector("#next-ui:not([hidden])", { timeout: 30000 });
    await page.click("#next-one");
    assert.equal(await page.locator("#next-out .gen").count(), 1);
    assert.deepEqual(await page.evaluate(() => window.__csp), []);
    assert.deepEqual(requests, []);
    assert.deepEqual(problems, []);
    await context.close();
  });
});
