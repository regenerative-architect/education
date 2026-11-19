/* =========================================================================
   Every family's language: translation on this device.
   - a library document is translated part by part, each translation under
     its original, in its own language and writing direction, under a label
     (itself translated) saying it's a machine translation to have checked;
   - languages the browser can't translate are marked, and a language that
     needs downloading shows its progress, once;
   - translating can be stopped; a new document or closing the reader
     clears it up and lets go of the language models;
   - your own file in another language is translated from that language;
   - the class agreement gets a family-language version that printing and
     "Download as text" include, and that's removed when the agreement
     changes;
   - where there's no built-in translator, it says so plainly, and nothing
     is sent anywhere.
   The browser's translator is replaced by a stand-in (fakeTranslator in
   helpers.mjs) that marks each translation with its language code.
   Run: cd tools && node --test tests/translate.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { serve, watch, fakeTranslator } from "./helpers.mjs";

async function openDoc(page, id) {
  await page.evaluate((h) => { location.hash = h; }, "#library/" + id);
  await page.waitForSelector("#reader[open] #reader-doc h2");
}
async function translateInto(page, lang) {
  if (await page.isHidden("#reader-translate")) await page.click("#reader-translate-btn");
  await page.selectOption("#tr-lang", lang);
  await page.click("#tr-go");
}
const status = (page) => page.textContent("#tr-status");

describe("every family's language", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.origin });
    await context.addInitScript(fakeTranslator);
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("translates a document beside the original, labelled as a machine translation", async () => {
    await openDoc(page, "welcome-ritual");
    const before = await page.evaluate(() => ({ text: document.getElementById("reader-doc").innerText, h2: document.querySelectorAll("#reader-doc h2").length }));
    await page.click("#reader-translate-btn");
    assert.equal(await page.getAttribute("#reader-translate-btn", "aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tr-lang");
    // Each language is named in English and in itself; languages the browser can't do are marked
    await page.waitForFunction(() => /not offered/.test(document.querySelector('#tr-lang option[value="ta"]').textContent));
    assert.equal(await page.$eval('#tr-lang option[value="es"]', (o) => o.textContent), "Spanish · español");
    assert.equal(await page.$eval('#tr-lang option[value="ta"]', (o) => o.disabled), true);
    await translateInto(page, "es");
    await page.waitForFunction(() => /^Translated \d+ parts into Spanish/.test(document.getElementById("tr-status").textContent));
    const got = await page.evaluate(() => {
      const doc = document.getElementById("reader-doc"), tr = [...doc.querySelectorAll(".tr-text")];
      return {
        first: doc.firstElementChild.className,
        label: doc.querySelector(".tr-banner").textContent,
        all: tr.every((t) => t.lang === "es" && t.dir === "ltr" && t.getAttribute("translate") === "no" && t.textContent.startsWith("⟦es⟧ ")),
        headings: [...doc.querySelectorAll("h2")].every((h) => h.nextElementSibling && h.nextElementSibling.matches('p.tr-heading[role="heading"][aria-level="2"]')),
        items: [...doc.querySelectorAll("li")].filter((li) => li.textContent.trim()).every((li) => li.querySelector(":scope > span.tr-text")),
        h2: doc.querySelectorAll("h2").length
      };
    });
    assert.equal(got.first, "tr-banner", "the label comes first");
    assert.match(got.label, /^Machine translation into Spanish, made by your browser on this device\. It can be wrong or sound awkward\. Before you share it with families, ask someone fluent to check it\.⟦es⟧ Machine translation/);
    assert.ok(got.all && got.headings && got.items, JSON.stringify(got));
    assert.equal(got.h2, before.h2, "the document's own headings are unchanged");
    // The original text is all still there
    const after = await page.evaluate(() => { const d = document.getElementById("reader-doc").cloneNode(true); d.querySelectorAll(".tr-text, .tr-banner").forEach((n) => n.remove()); document.body.appendChild(d); const t = d.innerText; d.remove(); return t; });
    assert.equal(after.replace(/\s+/g, " ").trim(), before.text.replace(/\s+/g, " ").trim());
    // Copy the translation alone, with its label, for an email or a letter
    await page.click("#tr-copy");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /^Machine translation into Spanish, made on this device\. Ask someone fluent to check it\.\n\n⟦es⟧ /);
    assert.ok(!/Machine translation into Spanish, made by your browser/.test(copied), "the on-page label isn't copied twice");
    // Remove it
    await page.click("#tr-clear");
    assert.equal(await page.locator("#reader-doc .tr-text, #reader-doc .tr-banner").count(), 0);
    assert.equal(await status(page), "Translation removed.");
  });

  it("writes right-to-left languages right to left", async () => {
    await translateInto(page, "ar");
    await page.waitForFunction(() => /^Translated \d+ parts into Arabic/.test(document.getElementById("tr-status").textContent));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("#reader-doc .tr-text")].every((t) => t.lang === "ar" && t.dir === "rtl")), true);
  });

  it("downloads a language only once, and shows the progress", async () => {
    await page.evaluate(() => {
      window.__said = [];
      new MutationObserver(() => window.__said.push(document.getElementById("tr-status").textContent)).observe(document.getElementById("tr-status"), { childList: true, characterData: true, subtree: true });
    });
    await translateInto(page, "fr");
    await page.waitForFunction(() => /^Translated \d+ parts into French/.test(document.getElementById("tr-status").textContent));
    const said = await page.evaluate(() => window.__said);
    assert.ok(said.some((s) => s === "Your browser is downloading French (only the first time): 50%"), said.join(" | "));
    await translateInto(page, "fr");
    await page.waitForFunction(() => /^Translated \d+ parts into French/.test(document.getElementById("tr-status").textContent));
    assert.deepEqual(await page.evaluate(() => window.__created.filter((c) => c === "en>fr")), ["en>fr"], "the French translator was made once and reused");
  });

  it("stops when asked, keeping what's done", async () => {
    await page.evaluate(() => { window.__trMs = 60; });
    await translateInto(page, "de");
    await page.waitForFunction(() => document.querySelectorAll('#reader-doc .tr-text[lang="de"]').length >= 4);
    await page.click("#tr-stop");
    await page.waitForFunction(() => /^Stopped\./.test(document.getElementById("tr-status").textContent));
    const n = await page.locator('#reader-doc .tr-text[lang="de"]').count();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#reader-doc .tr-text[lang="de"]').count(), n, "nothing more is added");
    assert.equal(await page.isVisible("#tr-go"), true);
    await page.evaluate(() => { window.__trMs = 2; });
  });

  it("starts fresh for the next document, and lets go of the models when the reader closes", async () => {
    await translateInto(page, "es");
    await page.waitForFunction(() => /^Translated/.test(document.getElementById("tr-status").textContent));
    await openDoc(page, "starter-pack");
    assert.equal(await page.locator("#reader-doc .tr-text").count(), 0);
    assert.equal(await status(page), "");
    const before = await page.evaluate(() => window.__destroyed);
    await page.focus("#tr-lang");
    await page.keyboard.press("Escape");   // inside the translate bar, Escape closes the bar first
    assert.equal(await page.isHidden("#reader-translate"), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "reader-translate-btn");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("reader").open);
    await page.waitForFunction((n) => window.__destroyed > n, before);
  });

  it("translates your own file from its language", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aice-")), "notas.md");
    fs.writeFileSync(file, "# Notas para las familias\n\nGracias por apoyar el aprendizaje de sus hijos con la inteligencia artificial.\n\n- Hablamos con los estudiantes cada semana.\n");
    await page.setInputFiles("#md-file", file);
    await page.waitForSelector("#reader[open] #reader-doc h1");
    await translateInto(page, "en");
    await page.waitForFunction(() => /^Translated \d+ parts into English/.test(document.getElementById("tr-status").textContent));
    assert.ok((await page.evaluate(() => window.__created)).includes("es>en"));
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  it("adds a family-language version of the class agreement, for printing and download", async () => {
    await page.locator("#agreement").scrollIntoViewIfNeeded();
    await page.selectOption("#agreement-tr-lang", "es");
    await page.click("#agreement-tr-go");
    await page.waitForFunction(() => /^Translated \d+ parts into Spanish/.test(document.getElementById("agreement-tr-status").textContent));
    const preview = await page.evaluate(() => {
      const p = document.getElementById("agreement-preview");
      return { banner: !!p.querySelector(".tr-banner"), title: p.querySelector("h4 + .tr-text") && p.querySelector("h4 + .tr-text").textContent, items: [...p.querySelectorAll("li")].every((li) => li.querySelector("span.tr-text[lang=es]")) };
    });
    assert.deepEqual(preview, { banner: true, title: "⟦es⟧ Our AI collaboration code", items: true });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#agreement-download")]);
    const text = fs.readFileSync(await dl.path(), "utf8");
    assert.match(text, /\n----\nMachine translation into Spanish, made on this device\. Ask someone fluent to check it\.\n\n⟦es⟧ Our AI collaboration code\n/);
    // Changing the agreement removes the translation, and says so
    await page.click('label:has(input[name="band"][value="912"])');
    assert.equal(await page.locator("#agreement-preview .tr-text").count(), 0);
    assert.match(await page.textContent("#agreement-tr-status"), /The agreement changed, so its translation was removed/);
    await page.click('label:has(input[name="band"][value="68"])');
    assert.deepEqual(problems, []);
  });
});

describe("where the built-in translator is missing or silent", () => {
  let server, browser;
  before(async () => { server = await serve(); browser = await chromium.launch(); });
  after(async () => { await browser?.close(); await server?.close(); });

  it("says so plainly when there's none, and sends nothing anywhere", async () => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    // An older browser, or one without the feature
    await context.addInitScript(() => { delete window.Translator; delete window.LanguageDetector; });
    const page = await context.newPage();
    const problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.evaluate(() => { location.hash = "#library/welcome-ritual"; });
    await page.waitForSelector("#reader[open] #reader-doc h2");
    await page.click("#reader-translate-btn");
    assert.match(await page.textContent("#tr-note"), /^This browser doesn't have a built-in translator\. Chrome and Edge on a computer have one/);
    assert.match(await page.textContent("#tr-note"), /most Indigenous languages/);
    assert.equal(await page.isDisabled("#tr-go"), true);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    assert.match(await page.textContent("#agreement-tr-note"), /doesn't have a built-in translator/);
    assert.equal(await page.isDisabled("#agreement-tr-go"), true);
    assert.deepEqual(problems, []);
    await context.close();
  });

  it("doesn't wait forever when the translator doesn't answer", async () => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => {
      window.Translator = { availability: () => new Promise(() => {}), create: () => new Promise(() => {}) };   // never answers
    });
    const page = await context.newPage();
    const problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.evaluate(() => { location.hash = "#library/welcome-ritual"; });
    await page.waitForSelector("#reader[open] #reader-doc h2");
    await page.click("#reader-translate-btn");
    await page.click("#tr-go");
    await page.waitForFunction(() => /isn't answering/.test(document.getElementById("tr-status").textContent), null, { timeout: 12000 });
    assert.equal(await page.isVisible("#tr-go"), true, "you can try again");
    assert.equal(await page.locator("#reader-doc .tr-banner").count(), 0);
    assert.deepEqual(problems, []);
    await context.close();
  });
});
