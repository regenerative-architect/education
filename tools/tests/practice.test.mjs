/* =========================================================================
   Practice the key ideas:
   - the ideas come from the page (five promises, SACRED check, repair
     circle, glossary), new ones first in teaching order;
   - each rating button says when the idea would come back, and the saved
     schedule is exactly what ts-fsrs (FSRS) gives, checked here in Node;
   - ideas still being learned come back in the same session; the daily
     limit for new ideas holds; due ideas come back days later;
   - keys 1 to 4 rate; "That's enough for today" stops kindly;
   - the schedule is listed under Your data, travels in "Download all",
     imports only well-formed cards, and is deleted with everything else;
   - the single file practises offline, from the copy of ts-fsrs inside it.
   Dates are fixed with Playwright's clock, so the schedules are exact.
   Run: cd tools && node --test tests/practice.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { fsrs, generatorParameters, createEmptyCard, Rating } from "ts-fsrs";
import { serve, watch, singleFileUrl } from "./helpers.mjs";

const T0 = new Date("2026-11-16T09:00:00");   // a Monday morning, local time
const DAY = 86400000;
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, maximum_interval: 365 }));
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("aice:practice") || "null"));
const stat = (page, label) => page.evaluate((l) => {
  const tile = [...document.querySelectorAll(".practice-stat")].find((t) => t.querySelector(".practice-stat-label").textContent === l);
  return tile ? Number(tile.querySelector(".practice-stat-n").textContent) : null;
}, label);
function minutesLabel(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `back in ${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  if (h < 24) return `back in ${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `back in ${d} day${d === 1 ? "" : "s"}`;
}

describe("practice the key ideas", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.clock.setFixedTime(T0);
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.locator("#practice-tool").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("takes its ideas from the page, new ones first, in teaching order", async () => {
    const expected = await page.evaluate(() => document.querySelectorAll("#promises tbody tr").length + document.querySelectorAll("#sacred .sacred-item").length + document.querySelectorAll("#repair .cycle-steps li").length + document.querySelectorAll("#glossary dl.glossary > div").length);
    assert.ok(expected >= 35, `${expected} ideas`);
    assert.equal(await stat(page, "key ideas"), expected);
    assert.equal(await stat(page, "started"), 0);
    assert.equal(await stat(page, "new today"), 5);
    await page.click("#practice-start");
    await page.waitForSelector("#practice-card:not([hidden])");
    assert.equal(await page.textContent("#practice-kind"), "The five promises · new idea");
    assert.equal(await page.textContent("#practice-front"), "One of the five promises to every learner is “Student agency first”. What does it mean in practice?");
    assert.equal(await page.evaluate(() => document.activeElement.id), "practice-front");
    assert.equal(await page.isHidden("#practice-back"), true, "the answer waits until you've tried");
  });

  it("says when each answer brings the idea back, exactly as FSRS schedules it", async () => {
    await page.click("#practice-show");
    assert.match(await page.textContent("#practice-answer"), /^Learners control their AI interactions/);
    const outcomes = scheduler.repeat(createEmptyCard(T0), T0);
    const labels = await page.$$eval("[data-grade] .practice-when", (s) => s.map((x) => x.textContent));
    assert.deepEqual(labels, [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => minutesLabel(outcomes[r].card.due - T0)));
    assert.deepEqual(labels, ["back in 1 minute", "back in 6 minutes", "back in 10 minutes", "back in 8 days"]);
    await page.click('[data-grade="3"]');
    const card = (await stored(page)).cards["p-student-agency-first"];
    const want = scheduler.next(createEmptyCard(T0), T0, Rating.Good).card;
    assert.deepEqual({ due: card.due, state: card.state, steps: card.learning_steps, reps: card.reps },
      { due: want.due.toISOString(), state: want.state, steps: want.learning_steps, reps: want.reps });
    assert.ok(Math.abs(card.stability - want.stability) < 1e-9 && Math.abs(card.difficulty - want.difficulty) < 1e-9);
  });

  it("keeps ideas still being learned in the session, and holds the daily limit", async () => {
    // Four more new ideas today (five in all): Easy, Forgot, Easy, Easy
    for (const key of ["4", "1", "4", "4"]) {
      await page.click("#practice-show");
      await page.keyboard.press(key);   // keys 1 to 4 rate
    }
    // Back come the two still being learned (Good on the first, Forgot on the second), soonest first
    const kinds = [];
    for (let i = 0; i < 2; i++) {
      kinds.push(await page.textContent("#practice-kind"));
      await page.click("#practice-show");
      await page.click('[data-grade="4"]');
    }
    assert.deepEqual(kinds, ["The five promises · review", "The five promises · review"]);
    await page.waitForSelector("#practice-done:not([hidden])");
    assert.equal(await page.textContent("#practice-done-title"), "That's everything for now.");
    assert.match(await page.textContent("#practice-done-text"), /^You practised 7 ideas\. The next ones come back in \d+ days? \(.+\)\.$/);
    const data = await stored(page);
    assert.equal(Object.keys(data.cards).length, 5);
    assert.equal(data.newToday, 5);
    assert.equal(data.today, "2026-11-16");
    await page.click("#practice-back-btn");
    assert.equal(await stat(page, "new today"), 0);
    assert.equal(await page.isDisabled("#practice-start"), true);
    assert.match(await page.textContent("#practice-stats"), /Nothing to practise right now\. The next ideas come back in \d+ days? \(/);
  });

  it("brings ideas back when they're due, and stops kindly when you've had enough", async () => {
    await page.clock.setFixedTime(new Date(T0.getTime() + 10 * DAY));
    await page.reload({ waitUntil: "load" });
    await page.locator("#practice-tool").scrollIntoViewIfNeeded();
    assert.equal(await stat(page, "to review now"), 5);
    assert.equal(await stat(page, "new today"), 5, "a new day, new ideas");
    await page.click("#practice-start");
    await page.waitForSelector("#practice-card:not([hidden])");
    assert.match(await page.textContent("#practice-kind"), / · review$/);
    await page.click("#practice-stop");
    assert.equal(await page.textContent("#practice-done-title"), "A good place to pause.");
    assert.match(await page.textContent("#practice-done-text"), /What's left will wait for you; nothing is lost\./);
    await page.click("#practice-back-btn");
  });

  it("is listed under Your data, travels in Download all, and imports only well-formed cards", async () => {
    await page.waitForFunction(() => /Practice schedule/.test(document.getElementById("data-rows").textContent));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#data-export")]);
    const file = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    assert.equal(Object.keys(file.data.practice.cards).length, 5);
    // A file with one good card and two bad ones
    file.data = { practice: { v: 1, perDay: 10, today: "2026-11-26", newToday: 0, cards: {
      "g-prompt": { due: "2026-11-30T09:00:00.000Z", stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 4, learning_steps: 0, reps: 2, lapses: 0, state: 2, last_review: "2026-11-26T09:00:00.000Z" },
      "g-bias": { due: "not a date", stability: 3, difficulty: 5, scheduled_days: 4, learning_steps: 0, reps: 2, lapses: 0, state: 2 },
      "../../x": { due: "2026-11-30T09:00:00.000Z", stability: 3, difficulty: 5, scheduled_days: 4, learning_steps: 0, reps: 2, lapses: 0, state: 2 }
    } } };
    await page.setInputFiles("#data-import", { name: "practice.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)) });
    await page.waitForSelector("#import-dialog[open]");
    await page.click("#import-go");
    await page.keyboard.press("Escape");
    const data = await stored(page);
    assert.deepEqual(Object.keys(data.cards), ["g-prompt"]);
    assert.equal(data.perDay, 10);
    await page.waitForFunction(() => document.querySelector("#practice-new").value === "10");
    // Delete everything: the practice starts over
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForFunction(() => !localStorage.getItem("aice:practice"));
    await page.waitForFunction(() => [...document.querySelectorAll(".practice-stat")].some((t) => t.textContent === "0started"));
    assert.deepEqual(problems, []);
  });
});

describe("practice in the single file, offline", () => {
  it("schedules with the copy of ts-fsrs inside the file", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ offline: true, reducedMotion: "reduce" });
      const page = await context.newPage();
      const problems = watch(page, "single file");
      await page.clock.setFixedTime(T0);
      await page.goto(singleFileUrl(), { waitUntil: "load" });
      await page.locator("#practice-tool").scrollIntoViewIfNeeded();
      await page.click("#practice-start");
      await page.waitForSelector("#practice-card:not([hidden])");
      await page.click("#practice-show");
      assert.equal(await page.textContent('[data-grade="4"] .practice-when'), "back in 8 days");
      await page.click('[data-grade="4"]');
      assert.equal((await stored(page)).cards["p-student-agency-first"].due, scheduler.next(createEmptyCard(T0), T0, Rating.Easy).card.due.toISOString());
      assert.deepEqual(problems, []);
    } finally { await browser.close(); }
  });
});
