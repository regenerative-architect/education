/* =========================================================================
   Circles: every voice, in turn.
   - each person gets a turn; when time is up a soft chime says so, but the
     person isn't cut off; passing is always possible; pause and "+30
     seconds" work; seats show who spoke and who passed by shape;
   - "Deciding together" runs questions, reactions and a consent round;
     an objection sends the proposal back to be changed and asked again;
     a decision by consent gets a record with no names and a date to look
     at it again, which downloads exactly as shown;
   - "Big screen" fills the screen (or the page, where full screen isn't
     allowed) and goes back;
   - nothing about a circle is saved.
   Time is controlled by Playwright's clock, so a minute-long turn takes no
   time at all, and the browser's sound is replaced by a stand-in that counts
   the chime's tones.
   Run: cd tools && node --test tests/circles.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { serve, watch } from "./helpers.mjs";

function fakeAudio() {
  window.__tones = 0;
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createOscillator() { return { type: "", frequency: { value: 0 }, connect: (n) => n, start() { window.__tones++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }; }
  }
  window.AudioContext = FakeAudioContext;
}
const seats = (page) => page.$$eval("#circle-seats .seat", (gs) => gs.map((g) => g.getAttribute("class").replace("seat", "").trim() || "waiting"));

describe("circles", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.addInitScript(fakeAudio);
    page = await context.newPage();
    problems = watch(page, "app");
    await page.clock.install();
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.locator("#circle-tool").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("gives each person a turn, with a soft chime and nobody cut off", async () => {
    await page.click('label:has(input[name="circle-kind"][value="ai"])');
    const first = await page.inputValue("#circle-question");
    assert.equal(first, "When has AI helped your learning, and when has it got in the way?");
    await page.click("#circle-another");
    assert.notEqual(await page.inputValue("#circle-question"), first);
    await page.fill("#circle-people", "3");
    await page.selectOption("#circle-time", "30");
    await page.click("#circle-start");
    assert.equal(await page.isVisible("#circle-run"), true);
    assert.equal(await page.textContent("#circle-who"), "Person 1 of 3");
    assert.equal(await page.textContent("#circle-clock"), "0:30");
    assert.equal(await page.textContent("#circle-q"), await page.inputValue("#circle-question"));
    assert.deepEqual(await seats(page), ["seat-now", "waiting", "waiting"]);
    await page.clock.runFor(29000);
    assert.equal(await page.textContent("#circle-clock"), "0:01");
    assert.equal(await page.textContent("#circle-timeup"), "");
    await page.clock.runFor(1500);
    assert.equal(await page.textContent("#circle-timeup"), "Time's up. Finish your thought.");
    assert.equal(await page.evaluate(() => window.__tones), 3, "one chime: a tone and two overtones");
    assert.equal(await page.textContent("#circle-who"), "Person 1 of 3", "still their turn");
    // +30 seconds gives more time after the chime
    await page.click("#circle-more");
    assert.equal(await page.textContent("#circle-timeup"), "");
    assert.equal(await page.textContent("#circle-clock"), "0:30");
    await page.click("#circle-next");
    assert.equal(await page.textContent("#circle-who"), "Person 2 of 3");
    // Pause stops the clock
    await page.clock.runFor(5000);
    await page.click("#circle-pause");
    assert.equal(await page.textContent("#circle-pause span"), "Resume");
    const paused = await page.textContent("#circle-clock");
    await page.clock.runFor(60000);
    assert.equal(await page.textContent("#circle-clock"), paused);
    await page.click("#circle-pause");
    await page.click("#circle-pass");
    assert.deepEqual(await seats(page), ["seat-spoke", "seat-pass", "seat-now"]);
    assert.match(await page.textContent("#circle-seats title"), /^Person 3 of 3 is speaking\. 1 spoke, 1 passed\.$/);
    await page.click("#circle-next");
    assert.equal(await page.textContent("#circle-done-title"), "Everyone has had a turn.");
    assert.match(await page.textContent("#circle-done-text"), /^3 people: 2 spoke and 1 passed, in about \d+ minutes?\.$/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "circle-done-title");
    // Another round, with the next question
    const q = await page.inputValue("#circle-question");
    await page.click("#circle-again");
    assert.equal(await page.textContent("#circle-who"), "Person 1 of 3");
    assert.notEqual(await page.inputValue("#circle-question"), q);
    await page.click("#circle-end");
    assert.equal(await page.isVisible("#circle-setup"), true);
  });

  it("decides by consent, works with an objection, and keeps a record without names", async () => {
    await page.click('label:has(input[name="circle-kind"][value="decide"])');
    assert.equal(await page.isVisible("#circle-proposal"), true);
    assert.equal(await page.isHidden("#circle-question"), true);
    await page.click("#circle-start");
    assert.match(await page.textContent("#toasts"), /Write the proposal first/);
    await page.fill("#circle-proposal", "We use AI only to brainstorm in our next project.");
    await page.fill("#circle-people", "3");
    await page.selectOption("#circle-time", "0");
    await page.click("#circle-start");
    assert.equal(await page.textContent("#circle-stage"), "Round 1 of 3: questions to understand");
    assert.equal(await page.textContent("#circle-clock"), "", "no timer: a talking piece instead");
    for (let i = 0; i < 3; i++) await page.click("#circle-next");
    assert.equal(await page.textContent("#circle-stage"), "Round 2 of 3: reactions");
    for (let i = 0; i < 3; i++) await page.click("#circle-next");
    assert.equal(await page.textContent("#circle-stage"), "Round 3 of 3: consent");
    assert.equal(await page.isHidden("#circle-next"), true);
    await page.click('[data-answer="consent"]');
    await page.click('[data-answer="objection"]');
    await page.click("#circle-pass");
    assert.equal(await page.textContent("#circle-done-title"), "Not decided yet: 1 objection.");
    assert.equal(await page.isVisible("#circle-amend"), true);
    assert.equal(await page.isHidden("#circle-record"), true);
    // Change the proposal and ask again
    await page.click("#circle-amend");
    assert.equal(await page.evaluate(() => document.activeElement.id), "circle-proposal");
    await page.fill("#circle-proposal", "We use AI only to brainstorm in our next project, and everyone can choose not to.");
    await page.click("#circle-start");
    assert.equal(await page.textContent("#circle-stage"), "Round 3 of 3: consent (asking again)");
    await page.click('[data-answer="consent"]');
    await page.click('[data-answer="concern"]');
    await page.click('[data-answer="consent"]');
    assert.equal(await page.textContent("#circle-done-title"), "Decided by consent.");
    assert.deepEqual(await seats(page), ["seat-consent", "seat-concern", "seat-consent"]);
    // The record: a date to look at it again (four weeks on), the concerns, and no names
    const expected = await page.evaluate(() => { const d = new Date(Date.now() + 28 * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); });
    assert.equal(await page.inputValue("#circle-review"), expected);
    await page.fill("#circle-notes", "Some families have no internet at home.");
    const shown = await page.textContent("#circle-record-text");
    assert.match(shown, /^Decision record\nDate: .+\nProposal: We use AI only to brainstorm in our next project, and everyone can choose not to\.\nDecided by consent, after the proposal was changed and asked again \(2 consent rounds\)\.\nConsent round: 2 consents, 1 consent with a concern, 0 passes, 0 objections\.\nConcerns and objections: Some families have no internet at home\.\nLook at it again by: .+\.\nNo names were recorded\./);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#circle-record-dl")]);
    assert.match(dl.suggestedFilename(), /^decision-record-\d{4}-\d{2}-\d{2}\.txt$/);
    assert.equal(fs.readFileSync(await dl.path(), "utf8"), shown);
    await page.click("#circle-new");
  });

  it("shows the circle on a big screen, and back", async () => {
    await page.click('label:has(input[name="circle-kind"][value="checkin"])');
    await page.fill("#circle-people", "5");
    await page.click("#circle-start");
    await page.click("#circle-big");
    await page.waitForFunction(() => document.fullscreenElement === document.getElementById("circle-tool") || document.getElementById("circle-tool").classList.contains("is-big"));
    await page.waitForFunction(() => document.getElementById("circle-big").getAttribute("aria-pressed") === "true");
    await page.click("#circle-big");
    await page.waitForFunction(() => !document.fullscreenElement && !document.getElementById("circle-tool").classList.contains("is-big"));
    await page.click("#circle-end");
  });

  it("saves nothing about a circle, and stays quiet in the console", async () => {
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("aice:") && !/^aice:(settings|schema)$/.test(k)));
    assert.deepEqual(keys, []);
    assert.deepEqual(problems, []);
  });
});
