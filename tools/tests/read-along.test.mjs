/* =========================================================================
   Read along, and reading comfort for following a line:
   - while a part of the page is read aloud, the sentence is shaded and the
     word being spoken is highlighted, exactly where it is;
   - a voice on this device is used even when the system's default voice is
     an online one; online voices are used only when you allow them;
   - the voice and speed you choose are used; each paragraph is read in its
     own language, with a voice for that language;
   - the reader reads the open document and stops when it closes;
   - the reading guide follows the pointer, also inside panels;
   - wider letter and word spacing (WCAG's text-spacing amounts) doesn't
     push anything sideways at phone width, even with the largest text.
   The browser's speech engine is replaced by a stand-in that "speaks" a
   word every few milliseconds and reports each word the way browsers do
   (boundary events), so the tests are exact and silent.
   Run: cd tools && node --test tests/read-along.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, watch } from "./helpers.mjs";

/* A stand-in speech engine. voices: what getVoices() returns. */
function fakeSpeech(voices) {
  const spoken = (window.__spoken = []);
  window.__words = [];
  class Utterance extends EventTarget {
    constructor(text) { super(); this.text = text || ""; this.lang = ""; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; }
  }
  function fire(u, type, extra) {
    const e = new Event(type);
    Object.assign(e, extra || {});
    if (typeof u["on" + type] === "function") u["on" + type](e);
    u.dispatchEvent(e);
  }
  let queue = [], current = null, timer = 0;
  function next() {
    if (current || !queue.length) return;
    const u = (current = queue.shift());
    spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, rate: u.rate, lang: u.lang });
    const words = [...u.text.matchAll(/\S+/g)];
    let i = 0;
    const step = () => {
      if (current !== u) return;
      if (i < words.length) {
        const w = words[i++];
        window.__words.push(w[0]);
        fire(u, "boundary", { name: "word", charIndex: w.index, charLength: w[0].length });
        timer = setTimeout(step, window.__wordMs || 15);
      } else {
        current = null;
        fire(u, "end", { charIndex: u.text.length });
        next();
      }
    };
    timer = setTimeout(() => { fire(u, "start", { charIndex: 0 }); step(); }, 5);
  }
  const engine = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: () => voices,
    speak(u) { queue.push(u); next(); },
    cancel() { queue = []; const u = current; current = null; clearTimeout(timer); if (u) fire(u, "error", { error: "interrupted" }); },
    pause() {}, resume() {},
    addEventListener() {}, removeEventListener() {}
  };
  Object.defineProperty(window, "speechSynthesis", { value: engine, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
}
const VOICES = [
  { voiceURI: "Online English", name: "Online English", lang: "en-US", localService: false, default: true },
  { voiceURI: "Local English", name: "Local English", lang: "en-GB", localService: true, default: false },
  { voiceURI: "Voz local", name: "Voz local", lang: "es-ES", localService: true, default: false }
];

/* The text of the word and the sentence highlighted right now */
const marked = (page) => page.evaluate(() => {
  const one = (name) => { const h = CSS.highlights.get(name); return h && h.size ? [...h][0].toString() : null; };
  return { word: one("aice-speak"), line: one("aice-speak-line") };
});

describe("read along", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(fakeSpeech, VOICES);
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("highlights each word as it's spoken, inside the sentence being read", async () => {
    const btn = page.locator('.listen[data-listen="purpose"]');
    await page.evaluate(() => { window.__wordMs = 60; });
    await btn.click();
    assert.equal(await btn.getAttribute("aria-pressed"), "true");
    assert.equal((await btn.textContent()).trim(), "Stop");
    // Several times over: the highlighted word is the word just spoken, and it sits in the shaded sentence
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(140);
      const now = await page.evaluate(() => {
        const h = CSS.highlights.get("aice-speak"), l = CSS.highlights.get("aice-speak-line");
        if (!h || !l) return null;
        const w = [...h][0], s = [...l][0];
        return { word: w.toString(), last: window.__words[window.__words.length - 1], inside: s.compareBoundaryPoints(Range.START_TO_START, w) <= 0 && s.compareBoundaryPoints(Range.END_TO_END, w) >= 0, inSection: !!w.startContainer.parentElement.closest("#purpose") };
      });
      assert.ok(now, "something is highlighted");
      assert.equal(now.word, now.last, "the highlighted word is the one being spoken");
      assert.ok(now.inside && now.inSection, "it's inside the shaded sentence, in the Purpose section");
    }
    await btn.click();
    assert.equal(await btn.getAttribute("aria-pressed"), "false");
    assert.deepEqual(await marked(page), { word: null, line: null }, "stopping clears the highlights");
  });

  it("uses a voice on this device, not the system's online default", async () => {
    const first = await page.evaluate(() => window.__spoken[0]);
    assert.equal(first.voice, "Local English");
    // Reading comfort explains it, and lists online voices as unavailable until you allow them
    await page.click('[data-open="comfort-dialog"]');
    await page.waitForSelector("#c-voice-field:not([hidden])");
    assert.match(await page.textContent("#c-voice-note"), /Local English, which runs on this device: nothing is sent anywhere/);
    const options = await page.$$eval("#c-voice option", (os) => os.map((o) => ({ label: o.textContent, disabled: o.disabled, group: o.parentElement.label || "" })));
    assert.deepEqual(options.map((o) => o.label), ["Automatic: a voice on this device", "Local English (en-GB)", "Online English (en-US)"]);
    assert.equal(options[2].disabled, true);
    assert.match(options[2].group, /turn on “Allow online voices”/);
  });

  it("uses the voice and speed you choose, and online voices only once allowed", async () => {
    await page.click("label:has(#c-online)");
    assert.equal(await page.$eval('#c-voice option[value="Online English"]', (o) => o.disabled), false);
    await page.selectOption("#c-voice", "Online English");
    await page.fill("#c-rate", "1.4");
    await page.dispatchEvent("#c-rate", "input");
    assert.equal(await page.textContent("#c-rate-out"), "1.4×");
    assert.match(await page.textContent("#c-voice-note"), /an online voice: what's read is sent to the company that makes it/);
    await page.click("#c-voice-try");
    await page.waitForFunction(() => window.__spoken.some((s) => /how reading aloud will sound/.test(s.text)));
    const sample = await page.evaluate(() => window.__spoken.find((s) => /how reading aloud will sound/.test(s.text)));
    assert.deepEqual({ voice: sample.voice, rate: sample.rate }, { voice: "Online English", rate: 1.4 });
    // Turning online voices off again goes back to the voice on this device
    await page.click("label:has(#c-online)");
    assert.equal(await page.inputValue("#c-voice"), "");
    assert.match(await page.textContent("#c-voice-note"), /Local English/);
    await page.keyboard.press("Escape");
  });

  it("reads each paragraph in its own language", async () => {
    await page.evaluate(() => {
      const p = document.createElement("p");
      p.lang = "es";
      p.id = "test-es";
      p.textContent = "Hola a todas y a todos.";
      document.querySelector("#purpose .lede").after(p);
      window.__spoken.length = 0;
      window.__wordMs = 2;
    });
    const btn = page.locator('.listen[data-listen="purpose"]');
    await btn.click();
    await page.waitForFunction(() => window.__spoken.some((s) => /Hola/.test(s.text)));
    const spoken = await page.evaluate(() => window.__spoken.slice(0, 4));
    const es = spoken.find((s) => /Hola/.test(s.text));
    assert.deepEqual({ voice: es.voice, lang: es.lang }, { voice: "Voz local", lang: "es-ES" });
    assert.equal(spoken.find((s) => !/Hola/.test(s.text)).voice, "Local English");
    await btn.click();
    await page.evaluate(() => document.getElementById("test-es").remove());
  });

  it("reads the open document in the reader, and stops when it closes", async () => {
    await page.evaluate(() => { location.hash = "#library/welcome-ritual"; window.__wordMs = 40; window.__spoken.length = 0; });
    await page.waitForSelector("#reader[open] #reader-doc h2");
    const btn = page.locator('#reader .listen[data-listen="reader-doc"]');
    await btn.click();
    await page.waitForFunction(() => CSS.highlights.get("aice-speak") && CSS.highlights.get("aice-speak").size);
    assert.ok(await page.evaluate(() => !![...CSS.highlights.get("aice-speak")][0].startContainer.parentElement.closest("#reader-doc")));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("reader").open);
    const after = await page.evaluate(() => ({ count: window.__spoken.length, highlights: CSS.highlights.has("aice-speak") || CSS.highlights.has("aice-speak-line") }));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__spoken.length), after.count, "nothing more is spoken");
    assert.equal(after.highlights, false);
  });

  it("the reading guide follows the pointer, also inside panels", async () => {
    await page.click('[data-open="comfort-dialog"]');
    await page.click("label:has(#c-guide)");
    await page.keyboard.press("Escape");
    // The guide moves back out of the dialog when it has closed (the close event comes a moment after Escape)
    await page.waitForSelector("#reading-guide", { state: "visible", timeout: 2000 });
    const centre = () => page.$eval("#reading-guide", (g) => { const r = g.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
    await page.mouse.move(400, 300);
    assert.ok(Math.abs((await centre()) - 300) <= 2);
    await page.mouse.move(420, 620);
    assert.ok(Math.abs((await centre()) - 620) <= 2);
    // Inside the reader, the guide is in front of it
    await page.evaluate(() => { location.hash = "#library/starter-pack"; });
    await page.waitForSelector("#reader[open] #reader-doc h2");
    assert.equal(await page.evaluate(() => document.getElementById("reader").contains(document.getElementById("reading-guide"))), true);
    await page.mouse.move(500, 450);
    assert.ok(Math.abs((await centre()) - 450) <= 2);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("reading-guide").parentNode === document.body);
    await page.click('[data-open="comfort-dialog"]');
    await page.click("label:has(#c-guide)");
    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#reading-guide"), false);
  });

  /* Nothing may run off the right edge (the page clips sideways overflow, so it would be lost).
     Folded sections are opened so their contents are measured too. Text inside its own sideways
     scroller (wide tables, code) and visually hidden screen-reader text are fine. */
  for (const settings of [{ text: "xl" }, { letters: true, text: "xl", space: "relaxed" }]) {
    it(`fits a 320 px phone screen with ${settings.letters ? "wider letter and word spacing and " : ""}the largest text`, async () => {
      const phone = await browser.newContext({ viewport: { width: 320, height: 720 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await phone.addInitScript((s) => localStorage.setItem("aice:settings", JSON.stringify(s)), settings);
      const p = await phone.newPage();
      const issues = watch(p, "phone");
      await p.goto(server.base, { waitUntil: "load" });
      await p.waitForSelector(".lib-card");
      if (settings.letters) assert.equal(await p.getAttribute("html", "data-letters"), "wide");
      await p.evaluate(() => document.querySelectorAll("main details").forEach((d) => { d.open = true; }));
      const off = await p.evaluate(() => {
        const W = window.innerWidth, out = [];
        const inScroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(x).overflowX)) return true; return false; };
        const over = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.right > W + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("dialog, .sr-only") && !inScroller(e); };
        for (const e of document.querySelectorAll("body *")) if (over(e) && !(e.parentElement && over(e.parentElement))) out.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + "." + String(e.className).split(" ")[0] + " → " + Math.round(e.getBoundingClientRect().right) + "px");
        return out;
      });
      assert.deepEqual(off, [], "nothing runs off the right edge");
      assert.deepEqual(issues, []);
      await phone.close();
    });
  }

  it("stays quiet in the console", () => { assert.deepEqual(problems, []); });
});

describe("read along without suitable voices", () => {
  it("says so plainly instead of sending the text to an online voice", async () => {
    const server = await serve();
    const browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(fakeSpeech, [{ voiceURI: "Online only", name: "Online only", lang: "en-US", localService: false, default: true }]);
    const page = await context.newPage();
    const problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.click('.listen[data-listen="purpose"]');
    await page.waitForFunction(() => /voices for English in this browser work online/.test(document.getElementById("toasts").textContent));
    await page.waitForFunction(() => document.querySelector('.listen[data-listen="purpose"]').getAttribute("aria-pressed") === "false");
    assert.equal(await page.evaluate(() => window.__spoken.length), 0, "nothing was sent to the online voice");
    assert.deepEqual(problems, []);
    await browser.close();
    await server.close();
  });
});
