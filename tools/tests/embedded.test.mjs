/* =========================================================================
   The single file shown inside another page: a file preview (as in chat apps,
   email and file managers), a learning platform, or a school portal. There
   the page's address is about:srcdoc or blob:, not a website or a file, so
   ordinary address handling throws ("Failed to construct 'URL'"). And the
   page around it decides what's allowed: storage, printing, downloads and
   new tabs are often blocked, and the browser then ignores those buttons
   without a word.

   Each way of embedding is checked with the strictest sandbox and with one
   that allows storage:
   - the page starts with no errors, the library opens, and "Your data"
     explains what the page around it may block;
   - links to sections stay inside the frame;
   - search, the reader, find, present mode, the notebook, the AI Lab's
     token counter and sharing all work;
   - printing that's blocked says so, every time;
   - a blocked download offers the text to copy instead, and focus goes
     back to the button you pressed;
   - a link to another website that can't open a new tab shows its address
     to copy;
   - pressing Enter in a calculator doesn't try to submit it;
   - nothing is requested from anywhere, and the browser is asked at most
     once for something the page around it blocks.
   Also: in a frame with no limits everything works as on a page of its own;
   the safety net shows a plain notice when something fails; and the
   installable app's index.html, which can't reach its neighbouring files
   there, still shows its page instead of breaking.
   Run: cd tools && node --test tests/embedded.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { SITE, SINGLE_FILE, singleFileUrl, watch } from "./helpers.mjs";

const OUTER = "http://preview.test/";
const WAYS = [
  ["a srcdoc frame with the strictest sandbox", "srcdoc", "allow-scripts"],
  ["a srcdoc frame that may use storage", "srcdoc", "allow-scripts allow-same-origin"],
  ["a blob: address with the strictest sandbox", "blob", "allow-scripts"],
  ["a blob: address that may use storage", "blob", "allow-scripts allow-same-origin"]
];
/* The browser's own notices when it refuses something the page around the frame doesn't allow.
   They aren't script errors; each test counts them instead. */
const BROWSER_NOTICE = /Ignored call to 'print\(\)'|Blocked opening '.*' in a new window/;

/* An outer page that shows `file` in a frame, the way a preview would.
   sandbox: the frame's rules, or null for a frame with no rules at all.
   init: a script to run in every frame first. allowOutside: let links to other websites load. */
async function embed(browser, file, kind, sandbox, { init, allowOutside } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: "reduce" });
  if (init) await context.addInitScript(init);
  const outside = [];
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url === OUTER) return route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><title>A preview</title><link rel="icon" href="data:,"><body style="margin:0"><p id="outer">The outer page</p></body>' });
    if (url === OUTER + "the-file.html") return route.fulfill({ contentType: "text/html; charset=utf-8", body: fs.readFileSync(file) });
    outside.push(url);
    return allowOutside ? route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><title>Elsewhere</title><link rel="icon" href="data:,"><p>Another website</p>' }) : route.abort();
  });
  const page = await context.newPage();
  const notices = [];
  page.on("console", (m) => { if (BROWSER_NOTICE.test(m.text())) notices.push(m.text()); });
  const problems = watch(page, kind, { allow: [BROWSER_NOTICE] });
  await page.goto(OUTER);
  await page.evaluate(async ({ kind, sandbox }) => {
    const html = await (await fetch("the-file.html")).text();
    const frame = document.createElement("iframe");
    frame.id = "app";
    if (sandbox) frame.setAttribute("sandbox", sandbox);
    frame.style.cssText = "width:100%;height:840px;border:0";
    if (kind === "srcdoc") frame.srcdoc = html;
    else frame.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    document.body.appendChild(frame);
  }, { kind, sandbox });
  const app = page.frameLocator("#app");
  const frame = () => page.frames().find((f) => f !== page.mainFrame());
  return { context, page, app, frame, problems, notices, outside };
}

describe("the single file inside a preview or another page", () => {
  let browser;
  before(async () => { browser = await chromium.launch(); });
  after(async () => { await browser?.close(); });

  for (const [name, kind, sandbox] of WAYS) {
    const opaque = !sandbox.includes("allow-same-origin");   // the frame can't see its own rules, so it has to try
    it(`works in ${name}`, async () => {
      const { context, page, app, frame, problems, notices, outside } = await embed(browser, SINGLE_FILE, kind, sandbox);
      await app.locator(".lib-card").first().waitFor({ timeout: 15000 });
      assert.ok(await app.locator(".lib-card").count() > 20, "the library is there");
      assert.equal(await app.locator("#embedded-note").isVisible(), true, "Your data explains what the page around it may block");

      // A link to a section scrolls inside the frame; it must not load the outer page into it
      await app.locator('a[href="#lab"]:visible').first().click();
      let lab = Infinity;
      for (let i = 0; i < 40 && !(lab < 200); i++) {
        await page.waitForTimeout(100);
        lab = await app.locator("#lab").evaluate((el) => Math.round(el.getBoundingClientRect().top));
      }
      assert.ok(lab < 200, `the AI Lab scrolled into view (top: ${lab})`);
      assert.equal(await app.locator("#outer").count(), 0, "the frame still shows the toolkit");

      // Search, then open a library document from the results
      await app.locator("body").press("Control+k");
      await app.locator("#search-dialog[open]").waitFor();
      await app.locator("#search-input").fill("rubric");
      await app.locator('#search-results [role="option"]').first().waitFor({ timeout: 10000 });
      await app.locator("#search-dialog [data-close]").first().click();
      await app.locator("#search-dialog").evaluate((d) => { if (d.open) throw new Error("search should be closed"); });

      // The reader: find, present mode (no full screen or awake screen to ask for here), and the notebook
      await app.locator('.lib-card[data-doc="class-ai-agreement"]').click();
      await app.locator("#reader[open] #reader-doc h2").first().waitFor();
      await app.locator("#reader-find-btn").click();
      await app.locator("#reader-find-input").fill("agreement");
      await app.locator("#reader-find-count").filter({ hasText: /^1 of \d+$/ }).waitFor();
      await app.locator("#reader-find-input").press("Escape");
      await app.locator("#reader-present").click();
      await app.locator("#reader.is-presenting").waitFor();
      await app.locator("#present-exit").click();
      await app.locator("#reader:not(.is-presenting)").waitFor();
      await app.locator("#nb-notes").fill("A note typed inside a preview.");
      await app.locator("#nb-status").filter({ hasText: opaque ? /isn't allowing storage here/ : "Saved on this device." }).waitFor();
      await app.locator("#reader [data-close]").click();
      await app.locator("#reader").evaluate((d) => { if (d.open) throw new Error("the reader should be closed"); });
      assert.equal(await app.locator("#outer").count(), 0, "closing the reader keeps the toolkit in the frame");

      // Printing is blocked here: the toolkit says so, every time
      const printBtn = app.locator('button[data-print="agreement-preview"]');
      await printBtn.scrollIntoViewIfNeeded();
      await printBtn.click();
      await app.locator("#toasts .toast-msg", { hasText: /^Printing is blocked by the page showing this toolkit/ }).first().waitFor({ timeout: 4000 });
      await printBtn.click();
      await app.locator("#toasts .toast-msg", { hasText: /^Printing is blocked/ }).nth(1).waitFor({ timeout: 4000 });
      assert.equal(await frame().evaluate(() => document.documentElement.hasAttribute("data-printing")), false, "nothing is left waiting to print");

      // A blocked download offers the text to copy instead
      const dlBtn = app.locator("#agreement-download");
      await dlBtn.click();
      const show = app.locator("#toasts button", { hasText: "Show the text to copy" }).last();
      await show.waitFor();
      assert.match((await app.locator("#toasts .toast-msg").allTextContents()).pop(), opaque
        ? /^Download started: class-ai-agreement\.txt\. If no file appears, it's blocked by the page showing this toolkit/
        : /^Downloads are blocked by the page showing this toolkit/);
      await show.click();
      await app.locator("#copy-dialog[open]").waitFor();
      assert.equal(await app.locator("#copy-h").textContent(), "Copy the text instead");
      assert.match(await app.locator("#copy-text").inputValue(), /^Our AI collaboration code\n/);
      assert.equal(await frame().evaluate(() => document.activeElement.id), "copy-text", "the text is ready to copy");
      await app.locator("#copy-all").click();
      await app.locator("#copy-status").filter({ hasText: /^(Copied\.|Copying is blocked here too)/ }).waitFor();
      await app.locator("#copy-dialog [data-close]").click();
      assert.equal(await frame().evaluate(() => document.activeElement.id), "agreement-download", "focus goes back to the download button");

      // A link to another website that can't open a new tab shows its address to copy (twice: the browser is asked once)
      const link = app.locator('main a[href^="https://"][target="_blank"]:visible').first();
      const href = new URL(await link.getAttribute("href")).href;
      await link.scrollIntoViewIfNeeded();
      for (let i = 0; i < 2; i++) {
        await link.click();
        await app.locator("#copy-dialog[open]").waitFor();
        assert.equal(await app.locator("#copy-h").textContent(), "Open this link in your browser");
        assert.equal(await app.locator("#copy-text").inputValue(), href);
        await app.locator("#copy-dialog [data-close]").click();
      }

      // Enter in a calculator's text box doesn't try to submit the form (that's an error in a sandbox)
      await app.locator("#sacred-activity").fill("A poster project");
      await app.locator("#sacred-activity").press("Enter");

      // The AI Lab's token counter is unpacked from inside the file
      await app.locator("#tok-load").click();
      await app.locator("#tok-ui").waitFor({ timeout: 20000 });
      const stats = await app.locator("#tok-stats").textContent();
      assert.match(stats, new RegExp("^" + encode("Every student deserves to be heard, in every language.").length + " tokens"));

      // Sharing explains that there's no web address here, instead of offering a link that goes nowhere
      await app.locator("#share-btn").click();
      await app.locator("#share-dialog[open]").waitFor();
      assert.match(await app.locator("#share-note").textContent(), /isn't on a website/);
      assert.equal(await app.locator("#share-link-row").isHidden(), true);

      // The browser was asked at most once for each thing the frame blocks (and never when the frame's rules can be read)
      const count = (re) => notices.filter((n) => re.test(n)).length;
      assert.deepEqual({ print: count(/print\(\)/), links: count(/Blocked opening/) }, opaque ? { print: 1, links: 1 } : { print: 0, links: 0 });
      assert.equal(await app.locator("#problem-note").count(), 0, "no problem notice");
      assert.deepEqual(outside, [], "nothing was requested from anywhere");
      assert.deepEqual(problems, []);
      await context.close();
    });
  }

  it("works like a page of its own in a frame with no limits", async () => {
    const { context, page, app, frame, problems, notices, outside } = await embed(browser, SINGLE_FILE, "srcdoc", null, {
      allowOutside: true,
      init: () => { window.__printed = 0; window.print = () => { window.__printed++; }; }   // stands in for the print window
    });
    await app.locator(".lib-card").first().waitFor({ timeout: 15000 });
    // Printing asks for the print window, with no warning
    const printBtn = app.locator('button[data-print="agreement-preview"]');
    await printBtn.scrollIntoViewIfNeeded();
    await printBtn.click();
    assert.equal(await frame().evaluate(() => window.__printed), 1);
    await page.waitForTimeout(1200);
    assert.equal(await app.locator("#toasts .toast-msg", { hasText: "Printing is blocked" }).count(), 0);
    // Downloading gives a file
    const [download] = await Promise.all([page.waitForEvent("download"), app.locator("#agreement-download").click()]);
    assert.equal(download.suggestedFilename(), "class-ai-agreement.txt");
    await app.locator("#toasts .toast-msg", { hasText: "Downloaded class-ai-agreement.txt." }).waitFor();
    // A link to another website opens in a new tab
    const link = app.locator('main a[href^="https://"][target="_blank"]:visible').first();
    const href = new URL(await link.getAttribute("href")).href;
    await link.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
    await popup.close();
    assert.equal(await frame().evaluate(() => document.getElementById("copy-dialog").open), false, "no copy box needed");
    assert.equal(outside[0], href, "only the link you chose was opened");
    assert.deepEqual(notices, []);
    assert.deepEqual(problems, []);
    await context.close();
  });

  it("says plainly when something fails, instead of failing silently", async () => {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await page.locator(".lib-card").first().waitFor();
    // On a page of its own, nothing extra shows
    assert.equal(await page.locator("html[data-embedded]").count(), 0);
    assert.equal(await page.locator("#embedded-note").isVisible(), false);
    assert.equal(await page.locator("#problem-note").count(), 0, "no notice when all is well");
    // An error nobody expected
    await page.evaluate(() => { setTimeout(() => { throw new Error("A test problem"); }, 0); });
    const note = page.locator("#problem-note");
    await note.waitFor();
    assert.equal(await note.locator(".problem-lead").getAttribute("role"), "alert");
    await note.locator(".problem-lead").filter({ hasText: /\S/ }).waitFor();
    assert.match(await note.locator(".problem-lead").textContent(), /^Something in this toolkit didn't work here\. You can keep reading, but a tool or button may not respond\. Reloading the page/);
    await note.locator("summary").click();
    assert.match((await note.locator("li").allTextContents()).join(" | "), /A test problem/);
    // Something cancelled on purpose isn't a problem; a failure nobody handled is, and is listed once
    await page.evaluate(() => { Promise.reject(new DOMException("Stopped", "AbortError")); });
    await page.evaluate(() => { Promise.reject(new Error("Another test problem")); });
    await page.evaluate(() => { Promise.reject(new Error("Another test problem")); });
    await page.waitForFunction(() => document.querySelectorAll("#problem-note li").length === 2);
    await page.waitForTimeout(200);
    assert.equal(await note.locator("li").count(), 2);
    // With a dialog open, the notice shows inside it (so it isn't hidden behind it), and comes back out when it closes
    await page.click('[data-open="comfort-dialog"]');
    await page.evaluate(() => { setTimeout(() => { throw new Error("A problem while a dialog is open"); }, 0); });
    await page.waitForFunction(() => !!document.querySelector("#comfort-dialog #problem-note"));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("problem-note").parentNode === document.body);
    assert.equal(await note.isVisible(), true);
    await note.locator("button", { hasText: "Close this notice" }).click();
    assert.equal(await page.locator("#problem-note").count(), 0);
    await context.close();
  });

  it("the installable app's page says what it can't do there, instead of breaking", async () => {
    const { context, app, problems } = await embed(browser, path.join(SITE, "index.html"), "srcdoc", "allow-scripts");
    // Its styles and scripts are separate files, which a preview can't reach; the page itself must still be readable
    await app.locator("h1").first().waitFor();
    assert.match(await app.locator("h1").first().textContent(), /AI Co.Evolution in Education/);
    assert.deepEqual(problems.filter((p) => !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED/.test(p)), [], "no script errors");
    await context.close();
  });
});
