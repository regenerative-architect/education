/* =========================================================================
   What a screen reader hears. Automated accessibility checks (axe) look at
   the page's structure; these tests listen to what's actually announced,
   using Guidepup's Virtual Screen Reader (MIT) running in the real page:
   - panels are announced by name when they open;
   - status messages (toasts, a circle's turns, a translation's progress,
     the writing check's result) are announced politely, without moving
     focus;
   - the notice shown when something fails is announced straight away
     (assertively);
   - the passphrase dialog's messages are announced as they change.
   The Virtual Screen Reader complements testing with real screen readers
   (NVDA, JAWS, VoiceOver, TalkBack); it doesn't replace them.
   Run: cd tools && node --test tests/announcements.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { serve, watch, REPO, fakeTranslator } from "./helpers.mjs";

/* The Virtual Screen Reader's browser build, bundled into one script to put in the page */
const require = createRequire(path.join(REPO, "tools", "package.json"));
const esbuild = require("esbuild");
const VSR = esbuild.buildSync({
  entryPoints: [path.join(REPO, "tools", "node_modules", "@guidepup", "virtual-screen-reader", "lib", "esm", "index.browser.js")],
  bundle: true, format: "iife", globalName: "VSR", write: false, platform: "browser", logLevel: "silent"
}).outputFiles[0].text;

async function listen(page) {
  await page.addScriptTag({ content: VSR });
  await page.evaluate(() => window.VSR.virtual.start({ container: document.body }));
}
const clear = (page) => page.evaluate(() => window.VSR.virtual.clearSpokenPhraseLog());
const heard = (page) => page.evaluate(() => window.VSR.virtual.spokenPhraseLog());
async function hears(page, pattern, what) {
  for (let i = 0; i < 50; i++) {
    const log = await heard(page);
    if (log.some((p) => pattern.test(p))) return log;
    await page.waitForTimeout(100);
  }
  assert.fail(`${what}: expected to hear ${pattern}, heard ${JSON.stringify(await heard(page))}`);
}

describe("what a screen reader hears", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    // bypassCSP only lets the test put the Virtual Screen Reader in the page
    context = await browser.newContext({ bypassCSP: true, viewport: { width: 1280, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(fakeTranslator);
    page = await context.newPage();
    problems = watch(page, "app");
    await page.clock.install();
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await listen(page);
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("names each panel as it opens", async () => {
    await clear(page);
    await page.click('[data-open="comfort-dialog"]');
    await hears(page, /^dialog, Reading comfort$/, "reading comfort");
    await page.keyboard.press("Escape");
    await page.locator("#your-data").scrollIntoViewIfNeeded();
    await page.click("#data-export-locked");
    await hears(page, /^dialog, Lock your data with a passphrase$/, "the passphrase dialog");
  });

  it("reads out the passphrase dialog's messages as they change", async () => {
    await clear(page);
    await page.fill("#lock-pass", "short");
    await page.click("#lock-go");
    await hears(page, /^polite: Use at least 10 characters\.$/, "a too-short passphrase");
    await page.keyboard.press("Escape");
  });

  it("announces a circle's turns and the end of a turn's time, politely", async () => {
    await page.locator("#circle-tool").scrollIntoViewIfNeeded();
    await page.fill("#circle-people", "3");
    await page.selectOption("#circle-time", "30");
    await clear(page);
    await page.click("#circle-start");
    await page.click("#circle-next");
    await hears(page, /^polite: Person 2 of 3$/, "the next turn");
    await page.clock.runFor(31000);
    await hears(page, /^polite: Time's up\. Finish your thought\.$/, "time's up");
    await page.click("#circle-end");
  });

  it("announces a translation's progress and result", async () => {
    await page.locator("#agreement").scrollIntoViewIfNeeded();
    await clear(page);
    await page.selectOption("#agreement-tr-lang", "es");
    await page.click("#agreement-tr-go");
    await page.clock.runFor(2000);
    await hears(page, /^polite: Translated \d+ parts into Spanish\./, "the translation");
    await page.click("#agreement-tr-clear");
  });

  it("announces what the writing check found", async () => {
    await page.locator("#wc-tool").scrollIntoViewIfNeeded();
    await clear(page);
    await page.fill("#wc-text", "Each chairman should utilize the form.");
    await page.click("#wc-check");
    // The first check loads the checker (a real file, so it takes real time); keep the page's clock moving until it's done
    let n = 0;
    for (let i = 0; i < 100 && !n; i++) {
      await page.clock.runFor(100);
      if (await page.isVisible("#wc-results")) n = await page.locator("#wc-list .wc-item").count();
      if (!n) await page.waitForTimeout(50);
    }
    assert.ok(n > 0, "the check found something to suggest");
    await hears(page, new RegExp("^polite: " + n + " suggestions\\. Each one says why"), "the writing check");
  });

  it("announces what the curriculum studio does: a suggested sequence, a moved session", async () => {
    await page.locator("#studio-tool").scrollIntoViewIfNeeded();
    await page.click("#studio-new");
    await page.check('#su-goals input[value="r-claim"]');
    await clear(page);
    await page.click("#su-suggest");
    await page.clock.runFor(200);
    await hears(page, /^polite: Suggested 4 sessions, from “I show” to “You lead”\.$/, "the suggested sequence");
    await clear(page);
    await page.click('.su-session:nth-child(1) [data-act="down"]');
    await page.clock.runFor(200);
    await hears(page, /^polite: Session moved to place 2\.$/, "a moved session");
    await page.click("#su-back");
  });

  it("announces the question ladder's other wordings", async () => {
    await page.locator("#ladder-tool").scrollIntoViewIfNeeded();
    await page.fill("#ladder-topic", "fractions");
    await clear(page);
    await page.click("#ladder-wording");
    await page.clock.runFor(200);
    await hears(page, /^polite: Wording 2 of 2\.$/, "another wording");
    await page.click("#ladder-wording");
    await page.clock.runFor(200);
    await hears(page, /^polite: Wording 1 of 2\.$/, "back to the first wording");
  });

  it("announces a toast without moving focus", async () => {
    await page.locator("#agreement").scrollIntoViewIfNeeded();
    await clear(page);
    await page.fill("#agreement-custom", "We take turns.");
    await page.click("#agreement-add");
    await hears(page, /^polite: Promise added\.$/, "adding a promise");
    assert.equal(await page.evaluate(() => document.activeElement.id), "agreement-add");
  });

  it("announces the notice when something fails straight away", async () => {
    await clear(page);
    await page.evaluate(() => { Promise.reject(new Error("A test problem")); });
    await page.waitForSelector("#problem-note");
    await page.clock.runFor(300);
    await hears(page, /^assertive: Something in this toolkit didn't work here\./, "the problem notice");
    await page.click("#problem-note button");
    // That error was ours, on purpose; nothing else went wrong
    assert.deepEqual(problems.filter((p) => !/A test problem/.test(p)), []);
  });
});
