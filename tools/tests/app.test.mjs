/* =========================================================================
   The installable app, end to end: service worker and install, the
   library and reader, search, sharing, present mode, saving the library,
   working offline, the update flow, removal, and the 404 page.
   Steps run in order and share one browser session, like a real visit.
   Run: cd tools && npm test   (or: node --test tests/app.test.mjs)
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { serve, watch, recordPolicyViolations, SITE } from "./helpers.mjs";

describe("installable app", () => {
  let server, browser, context, page, problems, BASE;
  const swFile = path.join(SITE, "sw.js");
  const swOriginal = fs.readFileSync(swFile, "utf8");
  const options = (sel) => `#search-results [role=option]${sel || ""}`;

  before(async () => {
    server = await serve();
    BASE = server.base;
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.origin });
    await recordPolicyViolations(context);
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(BASE, { waitUntil: "load" });
  });
  after(async () => {
    fs.writeFileSync(swFile, swOriginal);   // the update test edits sw.js; always put it back
    await browser?.close();
    await server?.close();
  });

  it("registers a service worker for the app's folder and takes control", async () => {
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
      return { scope: reg.scope, controlled: !!navigator.serviceWorker.controller };
    });
    assert.equal(sw.scope, BASE);
    assert.ok(sw.controlled, "the page should be controlled after the first visit");
  });

  it("is installable, with a manifest that parses cleanly", async () => {
    const cdp = await context.newCDPSession(page);
    const inst = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(inst.installabilityErrors, []);
    const manifest = await cdp.send("Page.getAppManifest");
    assert.deepEqual(manifest.errors || [], []);
  });

  it("names its offline cache after its own folder", async () => {
    const names = await page.evaluate(() => caches.keys());
    assert.ok(names.some((k) => /^aice-shell-[0-9a-f]{12}@\/site\/$/.test(k)), names.join(", "));
  });

  it("lists the whole library with counts", async () => {
    await page.waitForSelector(".lib-card");
    const index = JSON.parse(fs.readFileSync(path.join(SITE, "library", "index.json"), "utf8"));
    assert.equal(await page.$$eval(".lib-card", (a) => a.length), index.documents.length);
    assert.match(await page.textContent("#library-stats"), /\d+ documents · about \d+ hours of reading/);
  });

  it("opens a document in the reader with sections and next/previous links", async () => {
    await page.click('.lib-card[data-doc="starter-pack"]');
    await page.waitForFunction(() => document.querySelector("#reader-doc h2"));
    const r = await page.evaluate(() => ({
      open: document.getElementById("reader").open, title: document.getElementById("reader-title").textContent, hash: location.hash,
      toc: document.querySelectorAll("#reader-toc a").length, pager: document.querySelectorAll("#reader-pager a").length,
      tocOpen: document.getElementById("reader").getAttribute("data-toc")
    }));
    assert.ok(r.open);
    assert.match(r.title, /Starter pack/);
    assert.equal(r.hash, "#library/starter-pack");
    assert.ok(r.toc > 5, "section list");
    assert.equal(r.tocOpen, "open", "the section list starts open on wide screens");
    assert.equal(r.pager, 2);
  });

  it("follows a section link: updates the address and focuses the heading", async () => {
    const target = await page.$eval("#reader-toc li:nth-child(4) a", (a) => a.getAttribute("href"));
    await page.click("#reader-toc li:nth-child(4) a");
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement && document.activeElement.id }));
    assert.equal(s.hash, target);
    assert.equal(s.focus, "doc-" + target.split("/").slice(2).join("/"));
  });

  it("keeps the back button inside the reader, and Escape closes it back to the card", async () => {
    await page.goBack();
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.getElementById("reader").open && location.hash === "#library/starter-pack"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const c = await page.evaluate(() => ({ open: document.getElementById("reader").open, hash: location.hash, focus: document.activeElement && document.activeElement.getAttribute("data-doc") }));
    assert.deepEqual(c, { open: false, hash: "#library", focus: "starter-pack" });
  });

  it("opens shared document links on arrival, and explains missing ones", async () => {
    const deep = await context.newPage();
    const deepProblems = watch(deep, "deep link");
    await deep.goto(BASE + "#library/ethical-framework", { waitUntil: "load" });
    await deep.waitForFunction(() => document.querySelector("#reader-doc h2"));
    assert.match(await deep.textContent("#reader-title"), /Ethical framework/);
    await deep.keyboard.press("Escape");
    await deep.waitForTimeout(400);
    assert.ok(await deep.evaluate(() => location.hash === "#library" && document.getElementById("library").getBoundingClientRect().top < 200), "closing a shared link lands on the library list");
    await deep.goto(BASE + "#library/no-such-doc", { waitUntil: "load" });
    await deep.waitForFunction(() => /Couldn't open/.test(document.getElementById("reader-title").textContent));
    assert.match(await deep.textContent("#reader-doc"), /no library document/);
    assert.deepEqual(deepProblems, []);
    await deep.close();
  });

  it("searches the page and the library, with highlights and typo tolerance", async () => {
    await page.keyboard.press("Control+k");
    await page.waitForSelector("#search-dialog[open]");
    await page.fill("#search-input", "rubric");
    await page.waitForFunction(() => [...document.querySelectorAll("#search-results .sr-group")].some((g) => /library/i.test(g.textContent)), null, { timeout: 8000 });
    const sr = await page.evaluate(() => ({
      groups: [...document.querySelectorAll("#search-results .sr-group")].map((g) => g.textContent),
      marks: document.querySelectorAll("#search-results mark").length,
      nestedLinks: document.querySelectorAll("#search-results [role=option] a").length
    }));
    assert.ok(sr.groups.includes("On this page") && sr.groups.includes("In the library"), sr.groups.join(", "));
    assert.ok(sr.marks > 0, "matching words are highlighted");
    assert.equal(sr.nestedLinks, 0, "options contain no nested links");
    await page.fill("#search-input", "ecosytem");   // a typo on purpose
    await page.waitForTimeout(300);
    const hrefs = await page.$$eval(options(), (o) => o.map((x) => x.getAttribute("data-href")));
    assert.ok(hrefs.some((h) => /ecosystem/.test(h)), hrefs.slice(0, 3).join(" "));
  });

  it("opens a library result with Enter", async () => {
    await page.fill("#search-input", "data collection sheets");
    await page.waitForTimeout(300);
    const hrefs = await page.$$eval(options(), (o) => o.map((x) => x.getAttribute("data-href")));
    const i = hrefs.findIndex((h) => h.startsWith("#library/"));
    assert.ok(i >= 0, "a library result");
    for (let k = 0; k < i; k++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("reader").open && document.querySelector("#reader-doc h2"));
    assert.equal(await page.evaluate(() => location.hash), hrefs[i]);
  });

  it("shares a document as a link and a QR code made on the device", async () => {
    await page.click("#reader-share");
    await page.waitForSelector("#share-dialog[open] .qr-svg");
    const s = await page.evaluate(() => ({ url: document.getElementById("share-url").value, size: document.querySelector(".qr-svg path").getAttribute("d").length, note: document.getElementById("share-note").textContent }));
    assert.match(s.url, /#library\//);
    assert.ok(s.size > 500, "QR code drawn");
    assert.match(s.note, /only works on this computer/, "explains a localhost address");
    await page.click("#share-copy");
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), s.url);
    assert.ok(await page.evaluate(() => !!document.querySelector("#share-dialog .toast")), "the toast shows inside the open dialog");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  });

  it("presents full screen with large type, and Escape stops presenting first", async () => {
    await page.click("#reader-present");
    await page.waitForTimeout(400);
    const p = await page.evaluate(() => ({ on: document.getElementById("reader").classList.contains("is-presenting"), fs: document.fullscreenElement && document.fullscreenElement.id, font: parseFloat(getComputedStyle(document.getElementById("reader-doc")).fontSize) }));
    assert.ok(p.on && p.fs === "reader-frame" && p.font > 24, JSON.stringify(p));
    await page.click("#present-larger");
    assert.equal(await page.evaluate(() => document.getElementById("reader").getAttribute("data-present-size")), "3");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const a = await page.evaluate(() => ({ on: document.getElementById("reader").classList.contains("is-presenting"), open: document.getElementById("reader").open, fs: !!document.fullscreenElement }));
    assert.deepEqual(a, { on: false, open: true, fs: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  });

  it("opens your own Markdown file privately, with anything risky removed", async () => {
    const md = "# My notes\n\nSee [the plan](#the-plan) and [a site](https://example.org).\n\n<script>window.__pwned=1</script>\n<img src=x onerror=\"window.__pwned=2\">\n[click](javascript:window.__pwned=3)\n\n## The plan\n\n- [x] done\n- [ ] next\n";
    await page.setInputFiles("#md-file", { name: "my-notes.md", mimeType: "text/markdown", buffer: Buffer.from(md) });
    await page.waitForFunction(() => document.getElementById("reader").open && /my-notes/.test(document.getElementById("reader-title").textContent));
    const l = await page.evaluate(() => ({
      pwned: window.__pwned || 0, risky: document.querySelectorAll("#reader-doc script, #reader-doc img").length,
      js: [...document.querySelectorAll("#reader-doc a")].some((a) => /javascript:/i.test(a.getAttribute("href") || "")),
      anchor: !!document.querySelector('#reader-doc a[data-target="doc-the-plan"]'),
      rel: document.querySelector('#reader-doc a[href="https://example.org"]').getAttribute("rel"),
      shareHidden: document.getElementById("reader-share").hidden,
      boxes: [...document.querySelectorAll("#reader-doc input[type=checkbox]")].every((c) => c.disabled)
    }));
    assert.deepEqual({ ...l, rel: /noopener/.test(l.rel) }, { pwned: 0, risky: 0, js: false, anchor: true, rel: true, shareHidden: true, boxes: true });
    await page.keyboard.press("Escape");
  });

  it("saves the whole library for offline use and reports it", async () => {
    await page.goto(BASE + "#offline", { waitUntil: "load" });
    await page.waitForFunction(() => /Ready/.test(document.getElementById("off-app").textContent));
    await page.click("#offline-tool [data-save-library]");
    await page.waitForFunction(() => /whole library is saved/.test(document.getElementById("toasts").textContent), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    assert.match(await page.textContent("#off-lib"), /^(\d+) of \1 documents and the search index/);
    assert.match(await page.textContent("#off-version"), /^\d+\.\d+ \(build [0-9a-f]{12}\)$/);
    const rows = await page.$$eval("#data-rows tr td:first-child", (t) => t.map((x) => x.textContent));
    for (const name of ["Offline app files", "Saved library documents", "Recently read", "Keep the library offline"]) assert.ok(rows.includes(name), name);
  });

  it("works offline: reloads from the device, opens saved documents, searches", async () => {
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    const o = await page.evaluate(() => ({ online: navigator.onLine, chip: !document.getElementById("net-chip").hidden, cards: document.querySelectorAll(".lib-card").length, saved: document.querySelectorAll(".lib-saved:not([hidden])").length }));
    assert.equal(o.saved, o.cards, "every card shows it's saved");
    assert.equal(o.chip, !o.online, "the offline chip follows the connection");
    await page.click('.lib-card[data-doc="implementation-roadmap"]');
    await page.waitForFunction(() => document.querySelector("#reader-doc h2"));
    assert.match(await page.textContent("#reader-title"), /Implementation roadmap/);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await page.fill("#search-input", "wellbeing");
    await page.waitForTimeout(800);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll("#search-results .sr-group")].some((g) => /library/i.test(g.textContent))));
    await page.keyboard.press("Escape");
    const lost = await context.newPage();
    await lost.goto(BASE + "nowhere/at/all.html").catch(() => {});
    assert.ok(await lost.evaluate(() => /You're offline/.test(document.body.textContent) && document.querySelector("a.btn").getAttribute("href") === "/site/"), "offline page with a working home link");
    await lost.close();
    await context.setOffline(false);
  });

  it("offers a new version and updates only when asked", async () => {
    fs.writeFileSync(swFile, swOriginal.replace(/const BUILD = "([0-9a-f]+)";/, 'const BUILD = "test0update0";'));
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForFunction(() => /new version of the toolkit is ready/.test(document.getElementById("toasts").textContent), null, { timeout: 15000 });
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), "the current version keeps running until you choose");
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click("#toasts button.is-primary")]);
    await page.waitForFunction(() => /test0update0/.test(document.getElementById("off-version").textContent), null, { timeout: 10000 });
    const names = await page.evaluate(() => caches.keys());
    assert.equal(names.filter((k) => k.startsWith("aice-shell-")).length, 1, "old copies are tidied");
    assert.ok(names.some((k) => k.startsWith("aice-shell-test0update0")));
    fs.writeFileSync(swFile, swOriginal);
  });

  it("removes everything from the device in two clicks", async () => {
    await page.click("#off-remove");
    await page.click("#off-remove");
    await page.waitForFunction(() => /Removed\./.test(document.getElementById("toasts").textContent));
    const g = await page.evaluate(async () => ({ caches: (await caches.keys()).filter((k) => k.startsWith("aice-")), regs: (await navigator.serviceWorker.getRegistrations()).length }));
    assert.deepEqual(g, { caches: [], regs: 0 });
  });

  it("serves a calm 404 page for missing addresses", async () => {
    const p = await context.newPage();
    const p404 = watch(p, "404", { allow: [/status of 404/] });
    const res = await p.goto(BASE + "missing/page", { waitUntil: "load" });
    assert.equal(res.status(), 404);
    assert.match(await p.textContent("h1"), /isn't here/);
    assert.deepEqual(p404, []);
    await p.close();
  });

  it("had no errors, no policy violations, and asked no other website for anything", async () => {
    assert.deepEqual(await page.evaluate(() => window.__csp), []);
    assert.deepEqual(await page.evaluate(() => window.__aiceErrors), []);
    assert.deepEqual(problems, []);
    const requests = [];
    context.on("request", (r) => requests.push(r.url()));
    const p = await context.newPage();
    await p.goto(BASE, { waitUntil: "networkidle" });
    assert.deepEqual(requests.filter((u) => !u.startsWith(server.origin + "/") && !/^(data|blob):/.test(u)), []);
    await p.close();
  });
});
