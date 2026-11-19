/* =========================================================================
   The question ladder (Lesson 2) and its topics from Kiwix libraries:
   - a typed topic: five rungs that follow the words, singular or plural,
     other wordings in turn, and care questions on every rung for a topic
     that can hurt;
   - a Kiwix library file on the device (a small one made for these tests by
     tests/fixtures/make-ladder-zim.py with python-libzim): its name and
     size; title search as typed, with a capital letter and through
     redirects, never offering an image; nothing uploaded;
   - a ladder from an article: the definition, a cause, a view, something
     uncertain and two key ideas, each question with the sentence it came
     from and the reason it was asked, and nothing from tables, "See also"
     lists or references; exactly the same every time, in a fresh page too
     (the rules are deterministic); other wordings; the source and its
     license; care questions for a topic that can hurt; general questions
     for a page that only points elsewhere;
   - the topic of the day: the same all day, never a list, a pointer page, a
     stub or a topic on the care list; "Another topic" moves on;
   - copying (with the source), printing, and starting a unit in the
     curriculum studio; typing a topic goes back to your own words;
   - on a 320px phone with the largest text, nothing goes off the edge;
   - with openZIM's real Wikipedia samples (when ZIM_TESTING_SUITE points to
     zim-testing-suite's data folder; the CI downloads it): the newest, the
     oldest and the listing-less layouts give the same ladder; Belarusian
     Wikibooks opens; every deliberately damaged file stops with a message;
   - the single file does all of it with no network.
   The ladder inside a real Kiwix server is tested in kiwix.test.mjs.
   Run: cd tools && node --test tests/ladder.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { serve, watch, singleFileUrl, ladderLibrary, ZIM_SUITE } from "./helpers.mjs";

const LIBRARY = ladderLibrary();
const noLibrary = LIBRARY ? false : "python-libzim isn't installed here (pip install libzim==4.1.0); the CI installs it";

/* What the ladder shows: each rung's label, question, reason and quoted sentence */
const ladder = (page) => page.$$eval("#ladder-list > li", (lis) => lis.map((li) => ({
  label: li.querySelector(".rung").textContent,
  q: li.querySelector(".rung-q").textContent,
  why: (li.querySelector(".rung-why") || {}).textContent || "",
  quote: (li.querySelector(".rung-quote") || {}).textContent || ""
})));
const questions = async (page) => (await ladder(page)).map((r) => r.q);
const status = (page) => page.textContent("#ladder-lib");
async function statusIs(page, re) {
  await page.waitForFunction((src) => new RegExp(src).test(document.getElementById("ladder-lib").textContent), re.source, { timeout: 30000 });
  return status(page);
}
async function openLibrary(page, file) {
  if (!(await page.evaluate(() => document.getElementById("ladder-kiwix").open))) await page.click("#ladder-kiwix summary");
  await page.setInputFiles("#ladder-file", file);
  return statusIs(page, /Search its titles|isn't|damaged|can't|no articles|doesn't know/);
}
/* Search titles; the results list says which search it shows (data-query) once it's done */
async function find(page, text) {
  await page.fill("#ladder-search", "");
  await page.fill("#ladder-search", text);
  const q = text.replace(/\s+/g, " ").trim();
  if (q.length < 2) { await page.waitForTimeout(400); }
  else await page.waitForFunction((want) => document.getElementById("ladder-results").getAttribute("data-query") === want || /damaged|isn't/.test(document.getElementById("ladder-lib").textContent), q, { timeout: 30000 });
  return page.$$eval("#ladder-results button", (bs) => bs.map((b) => b.textContent));
}
/* Pick an article from the results, after going back to typed words, so the new ladder is plain to see */
async function choose(page, query, title) {
  const found = await find(page, query);
  assert.ok(found.some((f) => f.startsWith(title)), `“${title}” is offered for “${query}”: ${found.join(" | ")}`);
  await page.fill("#ladder-topic", "");
  await page.locator("#ladder-results button", { hasText: title }).first().click();
  await page.waitForFunction((t) => !document.getElementById("ladder-source").hidden &&
    document.getElementById("ladder-source-text").textContent.startsWith("Built from “" + t + "”"), title, { timeout: 30000 });
  return ladder(page);
}

/* The ladder the rules give for "Photosynthesis" in the test library, first wording */
const PHOTOSYNTHESIS = [
  { label: "Basic facts", q: "What is photosynthesis? Say how the article describes it, in your own words.",
    why: "The article's first sentence says what photosynthesis is.",
    quote: "“Photosynthesis is the process by which plants, algae and some bacteria turn the energy of light into chemical energy stored in sugars.”" },
  { label: "Connections", q: "What leads to what in this sentence, and what would change if one part were different?",
    why: "This sentence links a cause and an effect (it says “because”).",
    quote: "“The energy captured from light is then used to join carbon dioxide into sugars, because the plant needs them to grow and to store energy.” (Process)" },
  { label: "Perspectives", q: "Who might see this differently, and what evidence would each side point to?",
    why: "This sentence shows a view, a claim or a disagreement (it says “argued”).",
    quote: "“Later scientists argued about where the oxygen came from, and the debate was settled when experiments showed it comes from water, not from carbon dioxide.” (History)" },
  { label: "Critical analysis", q: "How sure can we be about this? What evidence would change our minds?",
    why: "“could” is a sign that something here is estimated, uncertain or debated.",
    quote: "“Farmers, gardeners and foresters all depend on photosynthesis, and some researchers think that understanding it better could help grow more food with less water.” (Importance)" },
  { label: "Creative synthesis", q: "Make a drawing, a model or a short story that brings together water and oxygen. What does it show about photosynthesis?",
    why: "Making something from two key ideas shows how they fit together.", quote: "" }
];

describe("the question ladder", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: server.origin });
    await context.addInitScript(() => {   // stands in for the print window, and remembers what was printed
      window.print = () => { const r = document.getElementById("print-root"); window.__printed = r ? r.innerText : ""; };
    });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.locator("#ladder-tool").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("builds five rungs from a typed topic, singular or plural, with other wordings in turn", async () => {
    await page.fill("#ladder-topic", "photosynthesis");
    assert.deepEqual(await questions(page), [
      "What is photosynthesis, and what are its key parts?",
      "How does photosynthesis connect to other things we've studied, or to life in our community?",
      "How might a scientist, an artist and a community elder each see photosynthesis differently?",
      "What assumptions sit underneath the way photosynthesis is usually taught or explained?",
      "How could understanding photosynthesis help a community care for people and places better?"
    ]);
    await page.fill("#ladder-topic", "fractions");
    const q = await questions(page);
    assert.equal(q[0], "What are fractions, and what are their key parts?");
    assert.equal(q[1], "How do fractions connect to other things we've studied, or to life in our community?");
    assert.equal(q[3], "What assumptions sit underneath the way fractions are usually taught or explained?");
    assert.equal(await page.textContent("#ladder-wording-n"), "Wording 1 of 2");
    await page.click("#ladder-wording");
    const q2 = await questions(page);
    assert.equal(q2[0], "How would you explain fractions to someone younger than you?");
    assert.equal(q2[1], "Where could we notice fractions in our own lives, our community or the land around us?");
    assert.equal(q2[4], "If you explained fractions through the lens of fairness or justice, what connections would you make?");
    assert.equal(await page.textContent("#ladder-wording-n"), "Wording 2 of 2");
    await page.click("#ladder-wording");
    assert.deepEqual(await questions(page), q, "the wordings go round");
    // Every question says why it was asked; typed topics have no source line
    for (const r of await ladder(page)) assert.ok(r.why.length > 10, r.label);
    assert.equal(await page.isHidden("#ladder-source"), true);
    assert.equal(await page.isHidden("#ladder-care"), true);
  });

  it("switches every rung to care questions for a topic that can hurt", async () => {
    await page.fill("#ladder-topic", "war");
    assert.equal(await page.isVisible("#ladder-care"), true);
    assert.deepEqual(await questions(page), [
      "What do we already know about war, and where did we learn it?",
      "What helps people and communities stay safe, heal or rebuild when it comes to war?",
      "Whose voices are heard in what we read about war, and whose are missing?",
      "How does the way war is written about shape how we feel? What is said carefully, and what is left out?",
      "What could a community do to prevent harm, or to support people affected by war?"
    ]);
    await page.fill("#ladder-topic", "soil");
    assert.equal(await page.isHidden("#ladder-care"), true);
  });

  it("opens a Kiwix library file on the device, and searches its titles", { skip: noLibrary }, async () => {
    assert.equal(await openLibrary(page, LIBRARY), "Ladder test library: 19 articles. Search its titles, or try the topic of the day.");
    assert.equal(await page.isVisible("#ladder-finder"), true);
    assert.equal(await page.isHidden("#ladder-inside"), true, "searching inside articles needs a Kiwix server");
    assert.deepEqual(await find(page, "pho"), ["Photosynthesis"]);
    assert.deepEqual(await find(page, "photosynthesis"), ["Photosynthesis"], "with a capital letter");
    assert.deepEqual(await find(page, "Photosynthetic"), ["Photosynthesis (from Photosynthetic)"], "through a redirect");
    assert.deepEqual(await find(page, "bees"), ["Honey bee (from Bees)"]);
    assert.deepEqual(await find(page, "leaf"), [], "an image is never offered");
    assert.deepEqual(await find(page, "w"), [], "one letter isn't enough");
    assert.deepEqual(await find(page, "w "), []);
    assert.deepEqual(await find(page, "wa"), ["Water cycle"]);
    // Nothing went anywhere: the file was read on the device
    assert.ok(server.requests.every((r) => !/\.zim/.test(r)), server.requests.join(", "));
  });

  it("builds the ladder from an article: each question with its sentence and its reason", { skip: noLibrary }, async () => {
    assert.deepEqual(await choose(page, "photo", "Photosynthesis"), PHOTOSYNTHESIS);
    assert.equal(await page.inputValue("#ladder-topic"), "Photosynthesis");
    assert.equal(await page.textContent("#ladder-source-text"), "Built from “Photosynthesis” in Ladder test library (text: CC BY-SA 4.0).");
    assert.equal(await status(page), "Ladder test library: 19 articles.");
    assert.equal(await page.textContent("#ladder-ideas"), "carbon dioxide · water · oxygen · leaves · chloroplasts · chlorophyll · Jan Ingenhousz · plants");
    // Nothing comes from the infobox table, the "See also" list or the references
    const shown = await page.textContent("#ladder-tool");
    assert.doesNotMatch(shown, /Takes place in|textbook of plant biology/);
  });

  it("gives exactly the same ladder every time, in a fresh page too", { skip: noLibrary }, async () => {
    assert.deepEqual(await choose(page, "Photosynthesis", "Photosynthesis"), PHOTOSYNTHESIS);
    const other = await browser.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: "block" });
    const fresh = await other.newPage();
    const freshProblems = watch(fresh, "fresh page");
    await fresh.goto(server.base, { waitUntil: "load" });
    await openLibrary(fresh, LIBRARY);
    assert.deepEqual(await choose(fresh, "photosynthetic", "Photosynthesis"), PHOTOSYNTHESIS);
    assert.deepEqual(freshProblems, []);
    await other.close();
  });

  it("offers other wordings, each with its own evidence, and goes round", { skip: noLibrary }, async () => {
    assert.equal(await page.textContent("#ladder-wording-n"), "Wording 1 of 5");
    await page.click("#ladder-wording");
    const two = await ladder(page);
    assert.deepEqual(two.map((r) => r.q), [
      "What is photosynthesis, and how do carbon dioxide and water fit in?",
      "How are carbon dioxide and water connected? Draw the link and label it.",
      "How have ideas about photosynthesis changed over time, and who changed them?",
      "Where might this number come from, and how could someone check it?",
      "Invent a “what if” for photosynthesis: change one cause, and trace what might happen next."
    ]);
    assert.equal(two[2].quote, "“In 1779 the Dutch scientist Jan Ingenhousz showed that plants need light to give off oxygen.” (History)");
    assert.equal(two[3].quote, "“Scientists estimate that land plants and ocean algae together capture more than 100 billion tonnes of carbon each year.” (Importance)");
    for (let i = 0; i < 4; i++) await page.click("#ladder-wording");
    assert.deepEqual(await ladder(page), PHOTOSYNTHESIS);
  });

  it("asks care questions for a topic that can hurt, and general ones for a page that only points elsewhere", { skip: noLibrary }, async () => {
    const care = await choose(page, "landm", "Landmine");
    assert.equal(await page.isVisible("#ladder-care"), true);
    assert.deepEqual(care.map((r) => r.q), [
      "What does this source say about landmines, and which words does it choose?",
      "What helps people and communities stay safe, heal or rebuild when it comes to landmines?",
      "Whose voices are heard in what we read about landmines, and whose are missing?",
      "How does the way landmines are written about shape how we feel? What is said carefully, and what is left out?",
      "What could a community do to prevent harm, or to support people affected by landmines?"
    ]);
    assert.equal(care[0].quote, "“A landmine is an explosive weapon hidden in or on the ground that is set off by a person or a vehicle.”");
    const pointer = await choose(page, "merc", "Mercury");
    assert.equal(await page.isHidden("#ladder-care"), true);
    assert.equal(await status(page), "“Mercury” only points to other pages, so these questions are general. Search for the one you mean.");
    assert.ok(pointer.every((r) => !/may refer to/.test(r.quote)), "a “may refer to” line is never evidence");
    const viaRedirect = await choose(page, "bees", "Honey bee");
    assert.equal(viaRedirect[0].q, "What is the honey bee? Say how the article describes it, in your own words.");
  });

  it("the topic of the day is the same all day, skips lists, pointer pages, stubs and care topics, and moves on", { skip: noLibrary }, async () => {
    await page.clock.setFixedTime(new Date("2026-11-17T10:00:00"));
    await page.click("#ladder-day");
    const first = await statusIs(page, /^Topic of the day \(2026-11-17\): “[^”]+” in Ladder test library\.$/);
    const topic = /“([^”]+)”/.exec(first)[1];
    await page.click("#ladder-day");
    assert.equal(await statusIs(page, /^Topic of the day/), first, "the same when asked again");
    assert.equal(await page.inputValue("#ladder-topic"), topic);
    const seen = [topic];
    for (let n = 2; n <= 12; n++) {
      await page.click("#ladder-next");
      const s = await statusIs(page, new RegExp(`^Topic ${n} of the day \\(2026-11-17\\): “[^”]+”`));
      seen.push(/“([^”]+)”/.exec(s)[1]);
    }
    for (const t of seen) assert.ok(!["List of rivers", "Mercury", "Seed", "Landmine"].includes(t), `“${t}” shouldn't be a topic of the day`);
    // The same library opened again gives the same topic of the day
    await openLibrary(page, LIBRARY);
    await page.click("#ladder-day");
    assert.equal(await statusIs(page, /^Topic of the day/), first);
  });

  it("copies the ladder with its source, prints it, and starts a unit in the curriculum studio", { skip: noLibrary }, async () => {
    await choose(page, "photo", "Photosynthesis");
    await page.click("#ladder-copy");
    await page.waitForFunction(() => [...document.querySelectorAll("#toasts .toast-msg")].some((t) => /Copied the ladder/.test(t.textContent)));
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(copied.split("\n")[0], "Question ladder: Photosynthesis");
    assert.ok(copied.includes("1. Basic facts: What is photosynthesis? Say how the article describes it, in your own words.\n   From the article: “Photosynthesis is the process by which plants"));
    assert.ok(copied.includes("Source: “Photosynthesis” in Ladder test library (text: CC BY-SA 4.0). Credit the source when you share quotes."));
    assert.match(copied, /rules, not a chatbot; wording 1\)\.$/);
    await page.click("#ladder-print");
    const printed = await page.evaluate(() => window.__printed);
    assert.match(printed, /Question ladder: Photosynthesis/);
    assert.match(printed, /Critical analysis: How sure can we be about this\?/);
    assert.match(printed, /Source: “Photosynthesis” in Ladder test library/);
    await page.click("#ladder-plan");
    await page.waitForSelector("#studio-editor:not([hidden])");
    assert.equal(await page.inputValue("#su-title"), "Photosynthesis");
    assert.equal(await page.inputValue("#su-question"), "How could understanding photosynthesis help a community care for people and places better?");
    const unit = await page.evaluate(() => JSON.parse(localStorage.getItem("aice:units")).units[0]);
    assert.equal(unit.plan.length, 1);
    assert.equal(unit.plan[0].title, "Climb the question ladder: Photosynthesis");
    assert.equal(unit.plan[0].routine, "think-pair-share");
    assert.match(unit.plan[0].notes, /^Question ladder: Photosynthesis\n1\. Basic facts: /);
    assert.match(unit.history[0].note, /^Started from the question ladder on “Photosynthesis” in Ladder test library \(text: CC BY-SA 4\.0\)\.$/);
    await page.click("#su-back");
    await page.locator("#ladder-tool").scrollIntoViewIfNeeded();
  });

  it("goes back to your own words when you type a topic, or press “Use my own words”", { skip: noLibrary }, async () => {
    await choose(page, "water", "Water cycle");
    assert.equal(await page.isVisible("#ladder-source"), true);
    await page.click("#ladder-own");
    assert.equal(await page.isHidden("#ladder-source"), true);
    assert.equal((await questions(page))[0], "What is Water cycle, and what are its key parts?");
    await choose(page, "water", "Water cycle");
    await page.fill("#ladder-topic", "rivers");
    assert.equal(await page.isHidden("#ladder-source"), true);
    assert.equal((await questions(page))[0], "What are rivers, and what are their key parts?");
    assert.deepEqual(problems, []);
  });
});

describe("the question ladder on a small phone", { skip: noLibrary }, () => {
  it("keeps everything inside a 320px screen with the largest text", async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 320, height: 700 }, serviceWorkers: "block", colorScheme: "dark" });
    await context.addInitScript(() => localStorage.setItem("aice:settings", JSON.stringify({ text: "xl", letters: true, space: "relaxed" })));
    const page = await context.newPage();
    const problems = watch(page, "phone");
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await openLibrary(page, LIBRARY);
    await choose(page, "photo", "Photosynthesis");
    await page.click("#ladder-list li:nth-child(1) .rung-more summary");
    await page.click("#ladder-list li:nth-child(2) .rung-more summary");
    // The same measure as the read-along and studio tests: nothing may run off the right edge
    const over = await page.evaluate(() => {
      const W = window.innerWidth, out = [];
      const inScroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(x).overflowX)) return true; return false; };
      const off = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.right > W + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("dialog, .sr-only") && !inScroller(e); };
      for (const e of document.querySelectorAll("#ladder-tool *")) if (off(e) && !(e.parentElement && off(e.parentElement))) out.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + "." + String(e.className).split(" ")[0]);
      return out;
    });
    assert.deepEqual(over, []);
    assert.deepEqual(problems, []);
    await browser.close();
  });
});

describe("the question ladder with real Wikipedia samples (openZIM's test files)", { skip: ZIM_SUITE ? false : "set ZIM_TESTING_SUITE to zim-testing-suite's data folder; the CI does" }, () => {
  let browser, page, problems;
  const at = (rel) => path.join(ZIM_SUITE || "", rel);
  before(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    problems = watch(page, "wikipedia");
    await page.goto(singleFileUrl(), { waitUntil: "load" });
  });
  after(async () => { await browser?.close(); });

  it("gives the same ladder from the newest, the oldest and the listing-less layouts", async () => {
    const ladders = [];
    for (const [rel, count] of [["nons/wikipedia_en_climate_change_mini_2024-06.zim", "3,821"], ["noTitleListingV0/wikipedia_en_climate_change_mini_2024-06.zim", "3,821"], ["withns/wikipedia_en_climate_change_mini_2024-06.zim", "20,387"]]) {
      assert.equal(await openLibrary(page, at(rel)), `Climate change by Wikipedia: ${count} articles. Search its titles, or try the topic of the day.`, rel);
      const l = await choose(page, "greenhouse eff", "Greenhouse effect");
      assert.equal(l[0].q, "What is the greenhouse effect? Say how the article describes it, in your own words.", rel);
      assert.match(l[0].quote, /^“The greenhouse effect occurs when greenhouse gases in a planet's atmosphere insulate the planet/);
      assert.equal(await page.textContent("#ladder-source-text"), "Built from “Greenhouse effect” in Climate change by Wikipedia (text: CC BY-SA 4.0).");
      ladders.push(l);
      // A redirect: "Global warming" leads to "Climate change"
      assert.ok((await find(page, "global warming")).includes("Climate change (from Global warming)"), rel);
    }
    assert.deepEqual(ladders[1], ladders[0]);
    assert.deepEqual(ladders[2], ladders[0]);
    // Kiwix's own "this article is issued from Wikipedia" box is never quoted
    assert.ok(ladders[0].every((r) => !/issued from/.test(r.quote)));
  });

  it("opens Wikibooks in Belarusian, and finds titles in its own alphabet", async () => {
    assert.equal(await openLibrary(page, at("nons/wikibooks_be_all_nopic_2017-02.zim")), "Wikibooks: 66 articles. Search its titles, or try the topic of the day.");
    const found = await find(page, "Аз");
    assert.ok(found.length > 0);
    const l = await choose(page, "Аз", found[0]);
    assert.equal(l.length, 5);
    assert.match(await page.textContent("#ladder-source-text"), new RegExp(`^Built from “${found[0]}” in Wikibooks( \\(text: CC [A-Z-]+ \\d\\.\\d\\))?\\.$`));
  });

  it("stops every deliberately damaged file with a message, never an error", async () => {
    const dir = at("nons");
    const bad = fs.readdirSync(dir).filter((f) => f.startsWith("invalid.")).sort();
    assert.ok(bad.length >= 15);
    for (const f of bad) {
      const said = await openLibrary(page, path.join(dir, f));
      if (/Search its titles/.test(said)) {
        // Some damage is in parts the ladder never reads; then searching must still behave
        await find(page, "Te");
        await page.waitForFunction(() => document.getElementById("ladder-tool").getAttribute("aria-busy") !== "true");
      } else assert.match(said, /isn't a Kiwix library|looks damaged or unfinished|no articles this page can read/, f);
    }
    assert.equal(await openLibrary(page, at("nons/invalid.smaller_than_header.zim")), "That file isn't a Kiwix library (a .zim file).");
    assert.deepEqual(problems, []);
  });
});

describe("the question ladder in the single file, with no network", { skip: noLibrary }, () => {
  it("opens a library, searches and builds the ladder, contacting nothing", async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const outside = [];
    await context.route("**/*", (route) => { const u = route.request().url(); if (!/^(file|data|blob):/.test(u)) { outside.push(u); return route.abort(); } return route.continue(); });
    const page = await context.newPage();
    const problems = watch(page, "single file");
    await page.goto(singleFileUrl(), { waitUntil: "load" });
    await openLibrary(page, LIBRARY);
    assert.deepEqual(await choose(page, "photo", "Photosynthesis"), PHOTOSYNTHESIS);
    assert.deepEqual(outside, []);
    assert.deepEqual(problems, []);
    await browser.close();
  });
});
