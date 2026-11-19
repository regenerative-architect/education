/* =========================================================================
   The library in other formats (made by tools/build-downloads.mjs):
   - the Markdown zip: every document and a README, links between documents
     pointing at files that are really there, nothing left over from the app;
   - "Download as Markdown" in the reader gives exactly the same files, in the
     installable app and in the single file with no internet;
   - the e-book: laid out the way EPUB 3 requires, every page well-formed, and
     valid by the W3C's EPUBCheck when it's available (CI downloads it and
     sets EPUBCHECK_JAR; on your computer, point EPUBCHECK_JAR at epubcheck.jar);
   - the Kolibri package: index.html at the root, marked for Kolibri, and
     working in a sandboxed frame with no network and no storage, the
     strictest way Kolibri could show it;
   - the community files GitHub shows: CODE_OF_CONDUCT.md and CONTRIBUTING.md.
   Run: cd tools && npm run test:downloads
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync, strFromU8 } from "fflate";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { REPO, SITE, serve, watch, singleFileUrl } from "./helpers.mjs";

const DL = path.join(SITE, "download");
const index = JSON.parse(fs.readFileSync(path.join(SITE, "library", "index.json"), "utf8"));
const ids = index.documents.map((d) => d.id);
const unzip = (f) => unzipSync(new Uint8Array(fs.readFileSync(path.join(DL, f))));
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
// Documents that use every kind of conversion: tables, callouts, checklists, fold-outs, a code block in a table
const SAMPLES = ["welcome-ritual", "ethical-framework", "ai-collaboration", "project-troubleshooting", "reflection-prompts"];

describe("Markdown files", () => {
  const zip = unzip("ai-co-evolution-library-markdown.zip");
  const md = (id) => strFromU8(zip[`ai-co-evolution-library/${id}.md`]);

  it("has every document and a README that lists them all", () => {
    const names = Object.keys(zip).sort();
    assert.deepEqual(names, ["ai-co-evolution-library/README.md", ...ids.map((id) => `ai-co-evolution-library/${id}.md`)].sort());
    const readme = strFromU8(zip["ai-co-evolution-library/README.md"]);
    for (const id of ids) assert.ok(readme.includes(`](${id}.md)`), `README links ${id}.md`);
    assert.match(readme, /teacher-led/);
  });

  it("keeps links between documents working, and leaves nothing from the app behind", () => {
    for (const id of ids) {
      const text = md(id);
      for (const m of text.matchAll(/\]\(([\w-]+)\.md(?:#[^)]*)?\)/g)) assert.ok(zip[`ai-co-evolution-library/${m[1]}.md`], `${id}.md links ${m[1]}.md, which is in the zip`);
      assert.ok(!text.includes("#library/"), `${id}.md has no app links`);
      assert.ok(!text.includes("opens in a new tab"), `${id}.md has no screen-reader-only text`);
      assert.ok(!text.includes("joplin-table-wrapper"), `${id}.md has no converter leftovers`);
      assert.ok(!EMAIL.test(text) && !/mailto:|tel:/i.test(text), `${id}.md has no contact details`);
      assert.match(text, /\n---\n\n\*From the AI Co-Evolution in Education library, version [\d.]+\. Source in the project repository: `[^`]+`\./, `${id}.md credits its source`);
    }
  });

  it("turns callouts, checklists and tables into Markdown that GitHub and Obsidian understand", () => {
    assert.match(md("welcome-ritual"), /^> \[!NOTE\]$/m);
    assert.match(md("ai-collaboration"), /^-\s+\[[ x]\] /m);
    assert.match(md("ethical-framework"), /^\| --- \| --- \|/m);
    assert.ok(!/^#{1,6} /m.test(md("ethical-framework").split("\n").filter((l) => l.startsWith("|")).join("\n")), "no headings inside table rows");
  });
});

describe("Download as Markdown in the reader", () => {
  let server, browser;
  const zip = unzip("ai-co-evolution-library-markdown.zip");
  before(async () => { server = await serve(); browser = await chromium.launch(); });
  after(async () => { await browser?.close(); await server?.close(); });

  async function downloads(page, label) {
    const problems = watch(page, label);
    for (const id of SAMPLES) {
      await page.evaluate((h) => { location.hash = h; }, "#library/" + id);
      await page.waitForFunction((t) => document.getElementById("reader-title").textContent === t && !document.getElementById("reader-adapt").hidden, index.documents.find((d) => d.id === id).title);
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#reader-markdown")]);
      assert.equal(dl.suggestedFilename(), id + ".md");
      const mine = fs.readFileSync(await dl.path(), "utf8");
      assert.equal(mine, strFromU8(zip[`ai-co-evolution-library/${id}.md`]), `${label}: ${id}.md matches the library download`);
    }
    assert.deepEqual(problems, []);
  }

  it("gives the same file as the library download, in the installable app", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await downloads(page, "app");
    await context.close();
  });

  it("and in the single file, with no internet", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, offline: true });
    const page = await context.newPage();
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await downloads(page, "single file");
    await context.close();
  });

  it("isn't offered for your own files (you already have them)", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.setInputFiles("#md-file", { name: "mine.md", mimeType: "text/markdown", buffer: Buffer.from("# My notes\n\nHello.") });
    await page.waitForFunction(() => document.getElementById("reader-title").textContent === "My notes" || document.querySelector("#reader-doc h1"));
    assert.equal(await page.isHidden("#reader-adapt"), true);
    await context.close();
  });
});

describe("E-book (EPUB 3)", () => {
  const file = path.join(DL, "ai-co-evolution-library.epub");
  const buf = fs.readFileSync(file);
  const zip = unzip("ai-co-evolution-library.epub");

  it("starts with the uncompressed mimetype file, as e-readers expect", () => {
    assert.equal(buf.readUInt32LE(0), 0x04034b50, "a zip file");
    assert.equal(buf.readUInt16LE(8), 0, "stored, not compressed");
    const nameLength = buf.readUInt16LE(26), extraLength = buf.readUInt16LE(28);
    assert.equal(buf.toString("latin1", 30, 30 + nameLength), "mimetype");
    assert.equal(buf.toString("latin1", 30 + nameLength + extraLength, 30 + nameLength + extraLength + 20), "application/epub+zip");
  });

  it("lists every document in its package, contents and reading order, and every page is well-formed XHTML", () => {
    assert.match(strFromU8(zip["META-INF/container.xml"]), /full-path="OEBPS\/content\.opf"/);
    const opf = strFromU8(zip["OEBPS/content.opf"]);
    const nav = strFromU8(zip["OEBPS/nav.xhtml"]);
    for (const d of index.documents) {
      assert.ok(opf.includes(`href="docs/${d.id}.xhtml"`) && opf.includes(`<itemref idref="d-${d.id}"/>`), `${d.id} is in the package and the reading order`);
      assert.ok(nav.includes(`href="docs/${d.id}.xhtml"`), `${d.id} is in the contents`);
    }
    for (const m of opf.matchAll(/href="([^"]+)"/g)) assert.ok(zip["OEBPS/" + m[1]], `${m[1]} is in the e-book`);
    assert.match(opf, /schema:accessibilitySummary/);
    for (const name of Object.keys(zip).filter((n) => n.endsWith(".xhtml"))) {
      assert.doesNotThrow(() => new JSDOM(strFromU8(zip[name]), { contentType: "application/xhtml+xml" }), `${name} is well-formed`);
    }
  });

  it("links between documents point at pages and sections that exist", () => {
    for (const name of Object.keys(zip).filter((n) => n.startsWith("OEBPS/docs/"))) {
      const text = strFromU8(zip[name]);
      assert.ok(!text.includes("#library/") && !text.includes('type="checkbox"'), `${name} has nothing app-only left`);
      for (const m of text.matchAll(/href="([\w-]+)\.xhtml(?:#([\w-]+))?"/g)) {
        const target = strFromU8(zip[`OEBPS/docs/${m[1]}.xhtml`] || new Uint8Array());
        assert.ok(target, `${name} links ${m[1]}.xhtml`);
        if (m[2]) assert.ok(target.includes(`id="${m[2]}"`), `${name} links #${m[2]} in ${m[1]}.xhtml`);
      }
    }
  });

  const jar = process.env.EPUBCHECK_JAR;
  it("passes EPUBCheck, the W3C's e-book checker", { skip: !(jar && fs.existsSync(jar)) && "set EPUBCHECK_JAR to the path of epubcheck.jar to run this" }, () => {
    let out;
    try {
      out = execFileSync("java", ["-jar", jar, file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      assert.fail("EPUBCheck found problems:\n" + (e.stdout || "") + (e.stderr || ""));
    }
    assert.match(out, /No errors or warnings detected/);
  });
});

describe("Kolibri package", () => {
  let browser;
  const zip = unzip("ai-co-evolution-kolibri.zip");
  const single = fs.readFileSync(path.join(DL, "ai-co-evolution-in-education.html"), "utf8");
  before(async () => { browser = await chromium.launch(); });
  after(async () => { await browser?.close(); });

  it("is the single file, with index.html at the root and marked for Kolibri", () => {
    assert.deepEqual(Object.keys(zip), ["index.html"]);
    const page = strFromU8(zip["index.html"]);
    assert.equal(page, single.replace('data-build="standalone"', 'data-build="standalone" data-host="kolibri"'));
  });

  it("works in a sandboxed frame with no network and no storage", async () => {
    // Kolibri shows HTML5 apps in a sandboxed frame from a separate address; this is the strictest version of that
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const outside = [];
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url === "http://kolibri.test/learn.html") return route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><title>Kolibri</title><link rel="icon" href="data:,"><iframe id="app" sandbox="allow-scripts" src="http://zipcontent.kolibri.test/index.html" style="width:100%;height:860px;border:0"></iframe>' });
      if (url === "http://zipcontent.kolibri.test/index.html") return route.fulfill({ contentType: "text/html; charset=utf-8", body: Buffer.from(zip["index.html"]) });
      outside.push(url);
      return route.abort();
    });
    const page = await context.newPage();
    const problems = watch(page, "kolibri");
    await page.goto("http://kolibri.test/learn.html");
    const app = page.frameLocator("#app");
    await app.locator(".lib-card").first().waitFor();
    assert.ok(await app.locator(".lib-card").count() > 20, "the library is there");
    await app.locator('.lib-card[data-doc="class-ai-agreement"]').click();
    await app.locator("#reader-doc h2").first().waitFor();
    await app.locator("#reader [data-close]").click();
    const shown = await app.locator("main").evaluate((main) => {
      const a = [...main.querySelectorAll('a[href^="http"]')].find((x) => x.offsetParent !== null);
      return { after: a ? getComputedStyle(a, "::after").content : "", note: !!document.querySelector(".kolibri-only") && getComputedStyle(document.querySelector(".kolibri-only")).display !== "none" };
    });
    assert.match(shown.after, /https?:/, "outside links show their address");
    assert.equal(shown.note, true, "the note about Kolibri keeping saved data is shown");
    assert.deepEqual(outside, [], "no requests left the frame");
    assert.deepEqual(problems, []);
    await context.close();
  });
});

describe("Community files for GitHub", () => {
  for (const [file, title] of [["CODE_OF_CONDUCT.md", /Code of Conduct/], ["CONTRIBUTING.md", /Contributing/]]) {
    it(`${file} is made from the library and has no contact details or app links`, () => {
      const text = fs.readFileSync(path.join(REPO, file), "utf8");
      assert.match(text, /^<!-- Generated by tools\/build-downloads\.mjs/);
      assert.match(text, title);
      assert.ok(!text.includes("#library/"));
      assert.ok(!EMAIL.test(text) && !/mailto:|tel:/i.test(text));
      assert.ok(!/^-\s+\S*\s*(Email|Phone):\s*$/m.test(text), "no empty contact lines");
    });
  }
});
