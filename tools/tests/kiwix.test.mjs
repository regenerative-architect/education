/* =========================================================================
   The Kiwix package (site/download/ai-co-evolution-in-education.zim):
   - it's a sound ZIM file: the header, the MD5 checksum at its end, and every
     entry readable from its cluster (read here with Node.js's own zstd, not
     libzim, so the test doesn't trust the tool that wrote it);
   - its main page is exactly the single-file edition, marked for Kiwix, and
     allowed to talk to the Kiwix server it came from (for the question
     ladder's topics) and nothing else;
   - every library document has its own page, whose links stay inside the
     package and whose headings the links point at exist; nothing loads from
     outside, and no page has scripts except the toolkit itself;
   - the licenses of the toolkit and every open-source part are inside;
   - the metadata Kiwix shows is there and within openZIM's limits, with a
     48 by 48 pixel illustration, and both search indexes are built in;
   - nothing in the library pages is a personal contact detail;
   - in a real Kiwix server (kiwix-serve, when installed: apt install
     kiwix-tools; the CI installs it): the toolkit runs, a library page
     opens, and search finds words inside the documents; and, with a second
     library beside it (the question ladder's test library), the ladder
     lists it, searches its titles and inside its articles, builds the same
     questions as from the file, picks a topic of the day, and asks nothing
     of any other website.
   Run: cd tools && node --test tests/kiwix.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { SITE, SINGLE_FILE, ladderLibrary } from "./helpers.mjs";

const ZIM = path.join(SITE, "download", "ai-co-evolution-in-education.zim");

/* ---------- A small ZIM reader, from the openZIM format description ---------- */
function readZim(file) {
  const buf = fs.readFileSync(file);
  const u64 = (at) => Number(buf.readBigUInt64LE(at));
  const head = {
    magic: buf.readUInt32LE(0), major: buf.readUInt16LE(4), minor: buf.readUInt16LE(6),
    entryCount: buf.readUInt32LE(24), clusterCount: buf.readUInt32LE(28),
    pathPtrPos: u64(32), clusterPtrPos: u64(48), mimeListPos: u64(56), mainPage: buf.readUInt32LE(64), checksumPos: u64(72)
  };
  const mimes = [];
  for (let at = head.mimeListPos; ;) {
    const end = buf.indexOf(0, at), s = buf.toString("utf8", at, end);
    at = end + 1;
    if (!s) break;
    mimes.push(s);
  }
  const clusters = new Map();
  function blob(c, b) {
    if (!clusters.has(c)) {
      const start = u64(head.clusterPtrPos + 8 * c), end = c + 1 < head.clusterCount ? u64(head.clusterPtrPos + 8 * (c + 1)) : head.checksumPos;
      const info = buf[start], kind = info & 0x0f, wide = (info & 0x10) !== 0;
      let data = buf.subarray(start + 1, end);
      if (kind === 5) data = zlib.zstdDecompressSync(data);
      else if (kind > 1) throw new Error(`cluster ${c} uses compression ${kind}`);
      clusters.set(c, { data, wide });
    }
    const { data, wide } = clusters.get(c);
    const off = (i) => (wide ? Number(data.readBigUInt64LE(i * 8)) : data.readUInt32LE(i * 4));
    return data.subarray(off(b), off(b + 1));
  }
  const entries = [];
  for (let i = 0; i < head.entryCount; i++) {
    let at = u64(head.pathPtrPos + 8 * i);
    const mime = buf.readUInt16LE(at), ns = String.fromCharCode(buf[at + 3]);
    const e = { index: i, ns, mime: mime < 0xfffd ? mimes[mime] : null };
    at += 8;
    if (mime === 0xffff) { e.redirect = buf.readUInt32LE(at); at += 4; } else { e.cluster = buf.readUInt32LE(at); e.blob = buf.readUInt32LE(at + 4); at += 8; }
    let end = buf.indexOf(0, at);
    e.path = buf.toString("utf8", at, end);
    at = end + 1;
    end = buf.indexOf(0, at);
    e.title = buf.toString("utf8", at, end) || e.path;
    e.bytes = () => blob(e.cluster, e.blob);
    e.text = () => e.bytes().toString("utf8");
    entries.push(e);
  }
  const byPath = new Map(entries.map((e) => [e.ns + "/" + e.path, e]));
  const resolve = (e) => { while (e && e.redirect !== undefined) e = entries[e.redirect]; return e; };
  return { buf, head, mimes, entries, byPath, resolve, content: (p) => byPath.get("C/" + p) };
}

const zim = readZim(ZIM);
const library = JSON.parse(fs.readFileSync(path.join(SITE, "library", "index.json"), "utf8")).documents;
const meta = (k) => zim.byPath.get("M/" + k)?.text();
/* Where a relative link on a page in the package leads: a path inside it, and the fragment */
function target(fromPath, href) {
  const u = new URL(href, "zim://pkg/" + fromPath);
  return { path: decodeURIComponent(u.pathname.slice(1)), frag: decodeURIComponent(u.hash.slice(1)) };
}
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

describe("the Kiwix package", () => {
  it("is a sound ZIM file, whole and readable", () => {
    assert.equal(zim.head.magic, 72173914, "the ZIM magic number");
    assert.equal(zim.head.major, 6);
    assert.ok(zim.head.minor >= 1, "openZIM's current layout (C for content, M for metadata)");
    const md5 = crypto.createHash("md5").update(zim.buf.subarray(0, zim.head.checksumPos)).digest();
    assert.ok(md5.equals(zim.buf.subarray(zim.head.checksumPos, zim.head.checksumPos + 16)), "the MD5 checksum at the end matches");
    assert.equal(zim.buf.length, zim.head.checksumPos + 16);
    for (const e of zim.entries.filter((x) => x.ns === "C" || x.ns === "M")) if (e.redirect === undefined) e.bytes();   // every entry reads
  });

  it("opens on the whole toolkit: the single-file edition, marked for Kiwix, that may talk only to its own server", () => {
    const main = zim.resolve(zim.entries[zim.head.mainPage]);
    assert.equal(main.ns + "/" + main.path, "C/index.html");
    assert.equal(main.mime, "text/html");
    const single = fs.readFileSync(SINGLE_FILE, "utf8");
    // Two changes and no others: marked for Kiwix, and connect-src 'self' so the question ladder can ask the
    // Kiwix server it came from for topics (the single file itself may contact nothing)
    const policy = /(<meta http-equiv="Content-Security-Policy" content="[^"]*?)connect-src 'none'/.exec(single);
    assert.ok(policy && policy.index < single.indexOf("</head>"), "the single file's own policy says connect-src 'none'");
    const expected = single.replace('data-build="standalone"', 'data-build="standalone" data-host="kiwix"').replace(policy[0], policy[1] + "connect-src 'self'");
    assert.ok(main.bytes().equals(Buffer.from(expected, "utf8")));
    const shipped = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(main.bytes().toString("utf8"))[1];
    assert.match(shipped, /default-src 'none'/);
    assert.match(shipped, /connect-src 'self';/);
  });

  it("has every library document as its own page, with links that stay inside the package", () => {
    const pages = zim.entries.filter((e) => e.ns === "C" && e.mime === "text/html" && e.path !== "index.html");
    assert.ok(pages.length >= library.length + 2);
    for (const d of library) {
      const e = zim.content(`library/docs/${d.id}.html`);
      assert.ok(e, d.id + " has a page");
      assert.equal(e.title, d.title);
      const frag = fs.readFileSync(path.join(SITE, "library", "docs", d.id + ".html"), "utf8");
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(frag)[1];
      assert.ok(e.text().includes(h1), d.id + " carries the document");
    }
    for (const e of pages) {
      const page = e.text();
      assert.doesNotMatch(page, /<script/i, e.path + " has no scripts");
      assert.doesNotMatch(page, /\ssrc="(https?:)?\/\/|<link[^>]+href="(https?:)?\/\/|url\((https?:)?\/\//i, e.path + " loads nothing from outside");
      for (const [, href] of page.matchAll(/\shref="([^"]+)"/g)) {
        if (/^(https?:|mailto:|tel:)/.test(href)) continue;
        const t = target(e.path, href.replace(/&amp;/g, "&"));
        const to = zim.content(t.path);
        assert.ok(to, `${e.path} links to ${href}, which is in the package`);
        if (t.frag && to.mime === "text/html" && t.path !== "index.html") assert.ok(ids(to.text()).has(t.frag), `${e.path}: ${href} points at a heading that exists`);
      }
    }
    const contents = zim.content("library/index.html").text();
    for (const d of library) assert.ok(contents.includes(`href="docs/${d.id}.html"`), "the contents page lists " + d.id);
  });

  it("carries the licenses of the toolkit and of every open-source part inside", () => {
    assert.match(zim.content("licenses/LICENSE.txt").text(), /GNU AFFERO GENERAL PUBLIC LICENSE/);
    assert.match(zim.content("licenses/THIRD-PARTY-NOTICES.md").text(), /Third-party notices/i);
    assert.match(zim.content("licenses/fonts-OFL.txt").text(), /SIL Open Font License/);
    for (const f of fs.readdirSync(path.join(SITE, "vendor", "LICENSES")).filter((x) => x.endsWith(".txt"))) {
      const e = zim.content("licenses/vendor-" + f);
      assert.ok(e && e.bytes().equals(fs.readFileSync(path.join(SITE, "vendor", "LICENSES", f))), f + " is inside, unchanged");
      assert.ok(zim.content("licenses/index.html").text().includes(`href="vendor-${f}"`), f + " is listed");
    }
  });

  it("describes itself the way Kiwix expects, within openZIM's limits", () => {
    const page = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
    assert.equal(meta("Title"), "AI Co-Evolution in Education");
    assert.ok(meta("Title").length <= 30);
    assert.ok(meta("Description").length > 20 && meta("Description").length <= 80);
    assert.ok(meta("LongDescription").length > meta("Description").length && meta("LongDescription").length <= 4000);
    assert.equal(meta("Language"), "eng");
    assert.match(meta("Name"), /^[a-z0-9.-]+_[a-z]{2}_[a-z0-9.-]+$/, "openZIM's naming convention");
    assert.equal(meta("Date"), /"dateModified": "(\d{4}-\d{2}-\d{2})"/.exec(page)[1]);
    for (const k of ["Creator", "Publisher", "Source", "License", "Tags"]) assert.ok(meta(k), k);
    assert.match(meta("Tags"), /_ftindex:yes/);
    const png = zim.byPath.get("M/Illustration_48x48@1").bytes();
    assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "the illustration is a PNG");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [48, 48]);
    assert.ok(zim.byPath.get("X/fulltext/xapian"), "the full-text search index is inside");
    assert.ok(zim.byPath.get("X/title/xapian"), "the title search index is inside");
  });

  it("has no personal contact details in its library pages", () => {
    const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
    for (const e of zim.entries.filter((x) => x.ns === "C" && x.path.startsWith("library/"))) {
      assert.doesNotMatch(e.text(), EMAIL, e.path);
      assert.doesNotMatch(e.text(), /href="(mailto|tel):/i, e.path);
    }
  });
});

/* ---------- In a real Kiwix server ---------- */
const kiwixServe = spawnSync("kiwix-serve", ["--version"], { encoding: "utf8" });
const hasKiwix = kiwixServe.status === 0;
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const hasLadder = () => (ladderLibrary() ? false : "python-libzim isn't installed here (pip install libzim==4.1.0); the CI installs it");

describe("the Kiwix package in a real Kiwix server", { skip: hasKiwix ? false : "kiwix-serve isn't installed here (apt install kiwix-tools); the CI installs it" }, () => {
  let server, base, browser;
  const LADDER = ladderLibrary();   // null without python-libzim; then the ladder's test below is skipped
  before(async () => {
    const port = await freePort();
    server = spawn("kiwix-serve", ["--port", String(port), "--address", "127.0.0.1", ZIM].concat(LADDER ? [LADDER] : []), { stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + "/catalog/v2/entries")).ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch();
  });
  after(async () => { await browser?.close(); server?.kill(); });

  it("lists it with its title and description", async () => {
    const catalog = await (await fetch(base + "/catalog/v2/entries")).text();
    assert.match(catalog, /<title>AI Co-Evolution in Education<\/title>/);
    assert.ok(catalog.includes(meta("Description")));
  });

  it("runs the toolkit and opens a library page, with no errors", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
    const content = `${base}/content/ai-co-evolution-in-education/`;
    await page.goto(content + "index.html", { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelectorAll(".lib-card").length > 20, null, { timeout: 20000 });
    assert.equal(await page.getAttribute("html", "data-host"), "kiwix");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".kiwix-only")).display === "none"), false, "the Kiwix note shows");
    await page.evaluate(() => { location.hash = "#library/welcome-ritual"; });
    await page.waitForSelector("#reader-doc h1");
    await page.goto(content + "library/docs/code-of-conduct.html", { waitUntil: "load" });
    assert.match(await page.title(), /^Code of conduct/);
    await page.click('a[href="../../library/index.html"]');
    await page.waitForSelector(".contents li");
    assert.equal(await page.locator(".contents li").count(), library.length);
    assert.deepEqual(problems, []);
    await page.close();
  });

  it("lets the question ladder find topics in the server's other libraries, and asks nothing of any other website", { skip: hasLadder() }, async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const problems = [], requests = [];
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
    page.on("request", (r) => requests.push(r.url()));
    await page.clock.setFixedTime(new Date("2026-11-17T10:00:00"));
    await page.goto(`${base}/content/ai-co-evolution-in-education/index.html`, { waitUntil: "load" });
    const said = (re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById("ladder-lib").textContent), re.source, { timeout: 20000 });
    // Nothing is asked of the server until the Kiwix part is opened
    assert.ok(!requests.some((u) => /\/catalog\/|\/suggest|\/search/.test(u)));
    await page.click("#ladder-kiwix summary");
    await said(/^Ladder test library: 19 articles\. Search its titles, or try the topic of the day\.$/);
    assert.deepEqual(await page.$$eval("#ladder-book option", (os) => os.map((o) => o.textContent)), ["Ladder test library (19 articles)"], "only the other library is offered");
    assert.equal(await page.isVisible("#ladder-inside"), true);
    await page.fill("#ladder-search", "photo");
    await page.waitForFunction(() => document.getElementById("ladder-results").getAttribute("data-query") === "photo", null, { timeout: 20000 });
    assert.deepEqual(await page.$$eval("#ladder-results button", (bs) => bs.map((b) => b.textContent)), ["Photosynthesis"]);
    await page.click("#ladder-results button");
    await page.waitForFunction(() => /^Built from “Photosynthesis”/.test(document.getElementById("ladder-source-text").textContent), null, { timeout: 20000 });
    assert.equal(await page.textContent("#ladder-source-text"), "Built from “Photosynthesis” in Ladder test library (text: CC BY-SA 4.0).");
    // The same rules as with the file give the same questions
    assert.deepEqual(await page.$$eval("#ladder-list .rung-q", (qs) => qs.map((q) => q.textContent)), [
      "What is photosynthesis? Say how the article describes it, in your own words.",
      "What leads to what in this sentence, and what would change if one part were different?",
      "Who might see this differently, and what evidence would each side point to?",
      "How sure can we be about this? What evidence would change our minds?",
      "Make a drawing, a model or a short story that brings together water and oxygen. What does it show about photosynthesis?"
    ]);
    // Kiwix's full-text search finds articles that mention a word anywhere
    await page.fill("#ladder-search", "pollinators");
    await page.waitForTimeout(400);
    await page.click("#ladder-inside");
    await page.waitForFunction(() => document.getElementById("ladder-results").getAttribute("data-query") === "inside:pollinators", null, { timeout: 20000 });
    const inside = await page.$$eval("#ladder-results button", (bs) => bs.map((b) => b.textContent));
    assert.ok(inside.includes("Pollination") && inside.includes("Rain garden"), inside.join(" | "));
    await page.click("#ladder-day");
    await said(/^Topic of the day \(2026-11-17\): “[^”]+” in Ladder test library\.$/);
    assert.deepEqual(requests.filter((u) => !u.startsWith(base + "/")), [], "nothing from any other website");
    assert.deepEqual(problems, []);
    await page.close();
  });

  it("finds words inside the library documents with Kiwix's own search", async () => {
    const results = await (await fetch(`${base}/search?content=ai-co-evolution-in-education&pattern=${encodeURIComponent("restorative justice")}`)).text();
    assert.match(results, /library\/docs\/[a-z-]+\.html/);
  });
});
