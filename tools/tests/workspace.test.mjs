/* =========================================================================
   Moving your data, and keeping tabs in step:
   - "Download all as JSON" says which format and data shape it uses, and a
     "data format version" is kept with the first saved item;
   - importing shows what's in a file before anything changes, then brings
     back exactly what was chosen, combining notebooks (newer notes win);
   - files from version 2.1 (made before the format version existed) import;
   - wrong files are turned away with a clear message, and unknown or
     malformed items are left out;
   - two tabs keep each other up to date.
   Run: cd tools && node --test tests/workspace.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { serve, watch } from "./helpers.mjs";

const jsonFile = (value, name = "my-data.json") => ({ name, mimeType: "application/json", buffer: Buffer.from(typeof value === "string" ? value : JSON.stringify(value)) });
const toastText = (page) => page.locator("#toasts .toast-msg").last().textContent();
async function openDoc(page, id) {
  await page.evaluate((h) => { location.hash = h; }, "#library/" + id);
  await page.waitForSelector("#reader-notebook:not([hidden])");
}
async function closeReader(page) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("reader").open);
}

describe("moving your data, and other tabs", () => {
  let server, browser, context, page, problems, exported;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("keeps a data format version with your first saved item, and lists it", async () => {
    assert.equal(await page.evaluate(() => localStorage.getItem("aice:schema")), null, "nothing saved, nothing kept");
    await page.click('[data-role="student"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("aice:schema")), "2");
    await page.waitForFunction(() => /Data format version/.test(document.getElementById("data-rows").textContent));
  });

  it("downloads everything with its format and shape", async () => {
    await page.click('[data-open="comfort-dialog"]');
    await page.check('input[name="c-theme"][value="dark"]');
    await page.keyboard.press("Escape");
    await openDoc(page, "welcome-ritual");
    await page.fill("#nb-notes", "Breathing pause on Monday.");
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    await closeReader(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#data-export")]);
    exported = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    assert.equal(exported.format, "ai-co-evolution-data");
    assert.equal(exported.schema, 2);
    assert.equal(exported.data.role, "student");
    assert.equal(exported.data.settings.theme, "dark");
    assert.match(exported.data.notebook.docs["welcome-ritual"].notes, /Breathing pause/);
    assert.ok(!("schema" in exported.data), "the format version travels at the top, not as an item");
  });

  it("shows what a file holds, then brings back what you choose", async () => {
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith("aice:") && k !== "aice:settings" && k !== "aice:schema"));
    await page.setInputFiles("#data-import", jsonFile(exported));
    await page.waitForSelector("#import-dialog[open]");
    assert.match(await page.textContent("#import-summary"), /This file was made on .+ by AI Co-Evolution in Education [\d.]+\. Choose what to bring in\./);
    const names = await page.$$eval("#import-rows tr", (trs) => trs.map((tr) => tr.children[1].textContent));
    assert.deepEqual(names.sort(), ["Reading comfort settings", "Recently read", "Your notebook", "Your path"].sort());
    assert.equal(await page.locator("#import-rows input:checked").count(), 4, "everything is chosen to start with");
    await page.uncheck("#imp-reading");
    await page.click("#import-go");
    assert.match(await page.textContent("#import-done-text"), /^Imported 3 items\./);
    await Promise.all([page.waitForEvent("load"), page.click("#import-reload")]);
    await page.waitForSelector(".lib-card");
    const after = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      role: document.querySelector('[data-role="student"]').getAttribute("aria-checked"),
      notes: document.getElementById("nb-list").textContent,
      reading: localStorage.getItem("aice:reading")
    }));
    assert.deepEqual({ theme: after.theme, role: after.role, reading: after.reading }, { theme: "dark", role: "true", reading: null });
    assert.match(after.notes, /Breathing pause on Monday/);
  });

  it("combines notebooks: notes from both, and the newer notes for a document in both", async () => {
    await openDoc(page, "starter-pack");
    await page.fill("#nb-notes", "Newer notes, written here.");
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    await closeReader(page);
    const file = { format: "ai-co-evolution-data", schema: 2, exported: "2026-01-02T03:04:05.000Z", page: "AI Co-Evolution in Education 2.2", data: { notebook: { v: 1, docs: {
      "starter-pack": { title: "Starter pack", notes: "Older notes from another device.", q: "", a: "", updated: "2026-01-01T00:00:00.000Z" },
      "ethical-framework": { title: "Ethical framework and the SACRED check", notes: "From my laptop.", q: "", a: "", updated: "2026-01-01T00:00:00.000Z" }
    } } } };
    await page.setInputFiles("#data-import", jsonFile(file));
    await page.waitForSelector("#import-dialog[open]");
    assert.match(await page.textContent("#import-rows"), /Combined with your notebook here \(2 documents in the file/);
    await page.click("#import-go");
    await page.keyboard.press("Escape");
    const docs = await page.evaluate(() => JSON.parse(localStorage.getItem("aice:notebook")).docs);
    assert.equal(docs["starter-pack"].notes, "Newer notes, written here.", "the newer notes are kept");
    assert.equal(docs["ethical-framework"].notes, "From my laptop.", "new documents are added");
    assert.match(docs["welcome-ritual"].notes, /Breathing pause/, "nothing already here is lost");
  });

  it("imports files from version 2.1, made before the format version existed", async () => {
    await page.setInputFiles("#data-import", jsonFile({ exported: "2026-11-01T10:00:00.000Z", page: "AI Co-Evolution in Education 2.1", data: { role: "leader", quickstart: [true, false, true] } }));
    await page.waitForSelector("#import-dialog[open]");
    assert.match(await page.textContent("#import-summary"), /by AI Co-Evolution in Education 2\.1/);
    await page.click("#import-go");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => localStorage.getItem("aice:role")), '"leader"');
    assert.equal(await page.evaluate(() => localStorage.getItem("aice:quickstart")), "[true,false,true]");
  });

  it("turns wrong files away, and leaves out what it doesn't know", async () => {
    await page.setInputFiles("#data-import", jsonFile("this is not json", "notes.json"));
    await page.waitForFunction(() => /isn't JSON/.test([...document.querySelectorAll("#toasts .toast-msg")].map((t) => t.textContent).join(" ")));
    await page.setInputFiles("#data-import", jsonFile({ hello: "world" }));
    await page.waitForFunction(() => /isn't a data file from this toolkit/.test([...document.querySelectorAll("#toasts .toast-msg")].map((t) => t.textContent).join(" ")));
    await page.setInputFiles("#data-import", jsonFile({ schema: 99, data: { role: "teacher" } }));
    await page.waitForFunction(() => /newer version of this toolkit/.test([...document.querySelectorAll("#toasts .toast-msg")].map((t) => t.textContent).join(" ")));
    // A "__proto__" key written into the file by hand must not reach anything
    await page.setInputFiles("#data-import", jsonFile('{"schema":2,"data":{"role":"teacher","rest":"yes please","somethingElse":{"a":1},"__proto__":{"polluted":true}}}'));
    await page.waitForSelector("#import-dialog[open]");
    assert.equal(await page.locator("#import-rows tr").count(), 1);
    assert.match(await page.textContent("#import-skipped"), /^3 items were left out because this toolkit doesn't know them or they weren't in the right shape: Rest reminder\.$/);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => ({}).polluted), undefined);
    assert.ok(await toastText(page));
  });

  it("keeps two tabs up to date with each other", async () => {
    const other = await context.newPage();
    const otherProblems = watch(other, "second tab");
    await other.goto(server.base, { waitUntil: "load" });
    await other.waitForSelector(".lib-card");
    // Reading comfort follows at once
    await page.click('[data-open="comfort-dialog"]');
    await page.check('input[name="c-theme"][value="light"]');
    await page.keyboard.press("Escape");
    await other.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
    // The notebook list follows, and an open reader catches up when you're not typing in it
    await openDoc(other, "ethical-framework");
    await openDoc(page, "ethical-framework");
    await page.fill("#nb-notes", "Written in the first tab.");
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    await other.waitForFunction(() => document.getElementById("nb-notes").value === "Written in the first tab.");
    assert.equal(await other.textContent("#nb-status"), "Updated from another tab.");
    await closeReader(other);
    await other.waitForFunction(() => /Written in the first tab/.test(document.getElementById("nb-list").textContent));
    // Deleting in one tab clears the other
    await closeReader(page);
    await page.click("#data-clear");
    await page.click("#data-clear");
    await other.waitForFunction(() => !document.querySelector("#nb-list li"));
    assert.deepEqual(otherProblems, []);
    assert.deepEqual(problems, []);
  });
});
