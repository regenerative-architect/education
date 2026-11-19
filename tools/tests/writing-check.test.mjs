/* =========================================================================
   The plain and kind writing check:
   - it lists exactly what the retext rules find (checked here by running
     the same bundle, vendor/plain-kind.js, in Node), in text order, each
     with a plain-language reason (never the libraries' own messages);
   - each kind is marked in the text with its own underline style, and
     "Show it" marks the exact words;
   - choosing a replacement swaps it in, keeps a capital letter, and checks
     again; changing the readers or typing checks again;
   - the checker is fetched once and kept for offline use in the app, works
     from inside the single file, and nothing you paste is saved.
   Run: cd tools && node --test tests/writing-check.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";
import { serve, watch, SITE, singleFileUrl } from "./helpers.mjs";

/* The same checker, in Node */
const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(SITE, "vendor", "plain-kind.js"), "utf8"), sandbox);
const KINDS = ["retext-simplify", "retext-readability", "retext-passive", "retext-equality"];
function expected(text, age) {
  // (copied out of the sandbox, so its arrays compare equal to ours)
  return JSON.parse(JSON.stringify(sandbox.PlainKind.check(text, age)))
    .filter((m) => KINDS.includes(m.source) && m.start !== null && m.end > m.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map((m) => [m.source.replace("retext-", ""), text.slice(m.start, m.end)]);
}
async function listed(page) {
  return page.$$eval("#wc-list .wc-item:not(.wc-none)", (items) => items.map((li) => {
    const kind = [...li.classList].find((c) => /^wc-item-/.test(c)).replace("wc-item-", "");
    return { kind, why: li.querySelector(".wc-item-why").textContent, head: li.querySelector(".wc-item-head").textContent };
  }));
}
const marked = (page, name) => page.evaluate((n) => { const h = CSS.highlights.get(n); return h ? [...h].map((r) => r.toString()) : []; }, name);

describe("plain and kind writing check", () => {
  let server, browser, context, page, problems, outside = [];
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    context.on("request", (r) => { if (!r.url().startsWith(server.origin) && !/^(data|blob):/.test(r.url())) outside.push(r.url()); });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.locator("#wc-tool").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("lists exactly what the rules find, in order, each with a plain reason", async () => {
    await page.click("#wc-example");
    await page.waitForSelector("#wc-results:not([hidden])");
    const text = await page.inputValue("#wc-text");
    const want = expected(text, 12);
    assert.ok(want.length >= 8, "the example has plenty to find");
    for (const k of ["simplify", "readability", "passive", "equality"]) assert.ok(want.some(([kind]) => kind === k), `the example shows ${k}`);
    const got = await listed(page);
    assert.deepEqual(got.map((g) => g.kind), want.map(([k]) => k));
    got.forEach((g, i) => {
      const words = want[i][1].replace(/\s+/g, " ").trim();
      assert.ok(g.head.includes(words.length > 90 ? words.slice(0, 87) : words), `item ${i + 1} names the words`);
      assert.ok(!/Unexpected|retext/.test(g.why), "a plain reason, not a programmer's message");
    });
    assert.match(got.find((g) => g.kind === "readability").why, /hard for readers around age 12: (all \d|\d of \d) readability formulas say so/);
    assert.match(await page.textContent("#wc-status"), new RegExp("^" + want.length + " suggestions\\."));
    // The summary counts, and a reading level
    const tiles = await page.$$eval(".wc-stat", (ts) => ts.map((t) => Number(t.querySelector(".wc-stat-n").textContent)));
    assert.deepEqual(tiles, ["simplify", "readability", "passive", "equality"].map((k) => want.filter(([kind]) => kind === k).length));
    assert.match(await page.textContent(".wc-grade"), /^Reading level: about grade \d+/);
    // Each kind is marked in the text, on exactly the flagged words
    for (const k of ["simplify", "passive", "equality"]) assert.deepEqual(await marked(page, "wc-" + k), want.filter(([kind]) => kind === k).map(([, w]) => w));
  });

  it("shows a suggestion in the text, and swaps in a replacement", async () => {
    const first = page.locator("#wc-list .wc-item-simplify").first();
    const words = (await first.locator(".wc-item-head").textContent()).replace(/^Plainer word\s*/, "").replace(/[“”]/g, "");
    await first.getByRole("button", { name: "Show it" }).click();
    assert.deepEqual(await marked(page, "wc-current"), [words]);
    const use = first.locator("button", { hasText: /^Use / }).first();
    const alt = (await use.textContent()).replace(/^Use “|”$/g, "");
    const before = (await listed(page)).length;
    await use.click();
    await page.waitForFunction((n) => document.querySelectorAll("#wc-list .wc-item:not(.wc-none)").length === n - 1, before);
    const text = await page.inputValue("#wc-text");
    const capital = /^[A-Z]/.test(words);
    assert.ok(text.includes(capital ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt), "the replacement is in the text");
    assert.ok(!text.includes(words), "the old words are gone");
  });

  it("checks again for different readers, and after typing", async () => {
    const text = await page.inputValue("#wc-text");
    await page.selectOption("#wc-audience", "16");
    await page.waitForFunction((n) => document.querySelectorAll("#wc-list .wc-item:not(.wc-none)").length === n, expected(text, 16).length);
    await page.fill("#wc-text", "We will utilize the tool.");
    await page.waitForFunction(() => document.querySelectorAll("#wc-list .wc-item").length === 1 && /Try “use”/.test(document.querySelector(".wc-item-why").textContent));
    // A word the rules say can simply go
    await page.fill("#wc-text", "We will use the aforementioned tool.");
    await page.waitForFunction(() => /Try leaving it out\./.test(document.getElementById("wc-list").textContent));
    await page.getByRole("button", { name: "Leave it out" }).click();
    await page.waitForFunction(() => document.getElementById("wc-text").value === "We will use the tool.");
    await page.waitForFunction(() => document.getElementById("wc-status").textContent === "Checked: nothing to suggest.");
    assert.match(await page.textContent("#wc-list"), /Nothing to suggest/);
  });

  it("fetches the checker once, keeps it for offline use, and saves nothing you paste", async () => {
    const saved = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((n) => /^aice-extras-/.test(n));
      const keys = names.length ? await (await caches.open(names[0])).keys() : [];
      return keys.map((r) => new URL(r.url).pathname.replace(/^.*\/site\//, ""));
    });
    assert.deepEqual(saved, ["vendor/plain-kind.js"]);
    assert.equal(server.requests.filter((r) => r.startsWith("/site/vendor/plain-kind.js")).length, 1);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("aice:")));
    assert.ok(keys.every((k) => /^aice:(settings|schema)$/.test(k)), keys.join(", "));
    await page.click("#wc-clear");
    assert.equal(await page.isHidden("#wc-results"), true);
    assert.deepEqual(outside, []);
    assert.deepEqual(problems, []);
  });
});

describe("the writing check in the single file, offline", () => {
  it("checks with the copy inside the file", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ offline: true });
      const page = await context.newPage();
      const problems = watch(page, "single file");
      await page.goto(singleFileUrl(), { waitUntil: "load" });
      await page.locator("#wc-tool").scrollIntoViewIfNeeded();
      await page.fill("#wc-text", "Each chairman should utilize the form.");
      await page.click("#wc-check");
      await page.waitForSelector("#wc-results:not([hidden])");
      assert.deepEqual((await listed(page)).map((g) => g.kind), expected("Each chairman should utilize the form.", 12).map(([k]) => k));
      assert.deepEqual(problems, []);
    } finally { await browser.close(); }
  });
});
