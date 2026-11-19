/* =========================================================================
   The curriculum studio:
   - its data on the page: goals in three strands, sixteen routines with
     steps, a source and the kind of evidence, and five AI use levels;
   - planning a unit from scratch: a suggested sequence that hands the
     thinking over to learners, with routines that fit each stage, the same
     every time; design checks that follow the unit; saved as you type;
   - under 13, AI use is teacher-led, everywhere it shows;
   - copying an example: the original credited, ShareAlike kept;
   - the unit file: valid against docs/unit-card.schema.json, and opening it
     on another device makes a copy with the original credited; opening it
     again, or opening your own unit's file, asks first;
   - the web page has no scripts and opens again in the studio; Markdown;
     printing the plan and the student page;
   - broken, oversized or unsafe files are refused or shown as plain text;
   - sharing a unit with an email address or phone number in it asks first;
   - the note to families goes to the writing check and comes back;
   - Your data lists, exports, combines and deletes units;
   - the single file plans units offline.
   Run: cd tools && node --test tests/curriculum.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { serve, watch, REPO, singleFileUrl } from "./helpers.mjs";

const require = createRequire(path.join(REPO, "tools", "package.json"));
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validUnit = ajv.compile(JSON.parse(fs.readFileSync(path.join(REPO, "docs", "unit-card.schema.json"), "utf8")));
const asFile = (text, name, mimeType = "application/json") => ({ name, mimeType, buffer: Buffer.from(text) });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("aice:units") || "null"));
async function grab(page, button) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(button)]);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), "utf8") };
}
async function toastSays(page, pattern) {
  await page.waitForFunction((src) => [...document.querySelectorAll("#toasts .toast-msg")].some((t) => new RegExp(src).test(t.textContent)), pattern.source);
}
const toastButton = (page, label) => page.click(`#toasts button:has-text("${label}")`);

describe("the curriculum studio", () => {
  let server, browser, context, page, problems;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
    await context.addInitScript(() => {   // stands in for the print window, and remembers what was printed
      window.print = () => { const r = document.getElementById("print-root"); window.__printed = r ? r.innerText : ""; };
    });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.locator("#studio-tool").scrollIntoViewIfNeeded();
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("has goals in three strands, sixteen routines with their sources, and five AI use levels", async () => {
    const data = await page.evaluate(() => ({
      goals: ["reasoning", "literacy", "autonomy"].map((s) => [...document.querySelectorAll(`.studio-strands [data-strand="${s}"] [data-goal]`)].map((g) => g.dataset.goal)),
      routines: [...document.querySelectorAll("#studio .routine[data-routine]")].map((r) => ({
        id: r.dataset.routine, anchor: r.id, strands: r.dataset.strands.split(" "), stages: r.dataset.stages.split(" "), ai: r.dataset.ai,
        steps: r.querySelectorAll(".routine-steps li").length, evidence: r.querySelector(".routine-source .ev-tag")?.textContent,
        helps: /Where it helps:/.test(r.textContent), tomorrow: /Try it tomorrow:/.test(r.textContent)
      })),
      levels: [...document.querySelectorAll("#studio-ai-levels [data-level]")].map((l) => l.querySelector("strong").textContent)
    }));
    assert.deepEqual(data.goals.map((g) => g.length), [6, 6, 7]);
    assert.ok(data.goals.flat().every((id) => /^[rla]-[a-z]{2,20}$/.test(id)), "goal ids fit the unit format");
    assert.equal(data.routines.length, 16);
    for (const r of data.routines) {
      assert.equal(r.anchor, "routine-" + r.id);
      assert.ok(r.strands.every((s) => ["reasoning", "literacy", "autonomy"].includes(s)), r.id);
      assert.ok(r.stages.length && r.stages.every((s) => ["model", "guided", "together", "alone"].includes(s)), r.id);
      assert.match(r.ai, /^[1-5]$/);
      assert.ok(r.steps >= 3 && r.evidence && r.helps && r.tomorrow, r.id + " has steps, evidence, where it helps and something to try");
    }
    assert.deepEqual(data.levels, ["No AI.", "AI planning.", "AI collaboration.", "Full AI.", "AI exploration."]);
    // Every stage has routines to choose from
    for (const s of ["model", "guided", "together", "alone"]) assert.ok(data.routines.some((r) => r.stages.includes(s)), s);
  });

  it("plans a unit: a suggested sequence hands the thinking to learners, and the checks follow along", async () => {
    await page.click("#studio-new");
    assert.equal(await page.evaluate(() => document.activeElement.id), "su-title");
    assert.match(await page.textContent("#su-checks-sum"), /^0 of 9 in place/);
    await page.fill("#su-title", "Arguing well");
    await page.fill("#su-question", "What makes an argument worth believing?");
    for (const g of ["r-claim", "r-weigh", "l-source", "l-ai", "a-check"]) await page.check(`#su-goals input[value="${g}"]`);
    await page.selectOption("#su-count", "6");
    await page.click("#su-suggest");
    const plan = () => page.$$eval(".su-session", (ls) => ls.map((li) => ({ stage: li.querySelector('[data-f="stage"]').value, routine: li.querySelector('[data-f="routine"]').value, ai: li.querySelector('[data-f="ai"]').value })));
    const first = await plan();
    assert.equal(first.length, 6);
    const order = ["model", "guided", "together", "alone"];
    assert.equal(first[0].stage, "model");
    assert.equal(first[5].stage, "alone");
    assert.ok(first.every((p, i) => i === 0 || order.indexOf(p.stage) >= order.indexOf(first[i - 1].stage)), "the thinking only moves towards learners");
    const stagesOf = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#studio .routine")].map((r) => [r.dataset.routine, r.dataset.stages.split(" ")])));
    assert.ok(first.every((p) => stagesOf[p.routine].includes(p.stage)), "each routine fits its stage");
    assert.equal(new Set(first.map((p) => p.routine)).size, 6, "no routine twice");
    assert.ok(first.some((p) => p.routine === "should-i-use-ai"), "an AI goal brings the “Should I use AI here?” routine");
    assert.equal(await page.textContent("#su-release"), "Session 1: I showSession 2: We practiseSession 3: We practiseSession 4: You try togetherSession 5: You try togetherSession 6: You lead");
    // The same goals always give the same suggestion
    await page.click("#su-suggest");
    assert.deepEqual(await plan(), first);
    // The checks follow the unit
    assert.match(await page.textContent("#su-checks-sum"), /^4 of 9 in place/);
    await page.fill("#su-choices", "A short essay\nA recorded talk");
    await page.click("#su-criteria-draft");
    assert.match(await page.inputValue("#su-criteria"), /^I can make a claim and back it with evidence\.\nI can weigh two explanations/);
    await page.click("#su-family-draft");
    assert.match(await page.inputValue("#su-family"), /Over the next 6 lessons, we're exploring a big question: What makes an argument worth believing\?[\s\S]*- check an AI answer against other sources before they use it/);
    await page.fill("#su-core", "Learners judge sources themselves");
    await page.fill("#su-adapt", "The topic");
    assert.match(await page.textContent("#su-checks-sum"), /^8 of 9 in place/);
    assert.match(await page.textContent(".su-checks .is-todo"), /Time for learners to reflect/);
    // Saved on this device, as typed
    await page.waitForFunction(() => document.getElementById("su-status").textContent === "Saved on this device.");
    const saved = (await stored(page)).units.find((u) => u.title === "Arguing well");
    assert.equal(saved.plan.length, 6);
    assert.deepEqual(saved.goals, { reasoning: ["r-claim", "r-weigh"], literacy: ["l-source", "l-ai"], autonomy: ["a-check"] });
    // Moving and removing sessions, with undo
    await page.click('.su-session:nth-child(2) [data-act="down"]');
    assert.equal(await page.inputValue('.su-session:nth-child(3) [data-f="routine"]'), first[1].routine);
    await page.click('.su-session:nth-child(6) [data-act="remove"]');
    assert.equal(await page.locator(".su-session").count(), 5);
    await toastButton(page, "Undo");
    assert.equal(await page.locator(".su-session").count(), 6);
  });

  it("keeps AI teacher-led for learners under 13, wherever it shows", async () => {
    await page.selectOption("#su-band", "9-12");
    await page.click("#su-suggest");
    assert.ok((await page.$$eval('.su-session [data-f="ai"]', (s) => s.map((x) => x.value))).every((v) => v === "1"), "suggestions use no AI");
    await page.selectOption('.su-session:nth-child(3) [data-f="ai"]', "2");
    assert.equal(await page.isVisible(".su-session:nth-child(3) .su-young-note"), true);
    assert.equal(await page.isVisible(".su-session:nth-child(2) .su-young-note"), false);
    assert.match(await page.inputValue('.su-session:nth-child(3) [data-f="aiWhy"]'), /AI may help with ideas/);
    assert.match(await page.textContent("#su-checks"), /Under 13: sessions with AI are teacher-led/);
    await page.click("#su-print-student");
    assert.match(await page.evaluate(() => window.__printed), /Session 3[^\n]*: AI planning \(teacher-led\)/);
    await page.click("#su-family-draft");
    await toastButton(page, "Replace it");
    assert.match(await page.inputValue("#su-family"), /Your child won't use AI directly: the teacher runs it on a shared screen/);
  });

  it("prints the plan and the student page", async () => {
    await page.click("#su-print");
    const plan = await page.evaluate(() => window.__printed);
    assert.match(plan, /Unit plan: Arguing well/);
    for (const part of ["Big question: What makes an argument worth believing?", "Goals", "Reasoning", "Sessions", "Who leads the thinking: I show (the teacher models).", "What must stay, so it still works"]) assert.ok(plan.includes(part), part);
    await page.click("#su-print-student");
    const student = await page.evaluate(() => window.__printed);
    for (const part of ["Our big question:", "What you'll be able to do", "How you can show it", "My plan", "How sure am I?"]) assert.ok(student.includes(part), part);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-printing")), true, "printing waits for the print window");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    assert.equal(await page.evaluate(() => !!document.getElementById("print-root")), false, "and tidies up after");
  });

  let unitFile;
  it("copies an example with its authors credited, and a ShareAlike unit stays ShareAlike", async () => {
    await page.click("#su-back");
    assert.match(await page.textContent("#studio-units"), /Arguing well/);
    await page.selectOption("#studio-example", "1");
    await page.click("#studio-example-open");
    assert.equal(await page.inputValue("#su-title"), "Our water, our story");
    assert.match(await page.textContent("#su-credits"), /“Our water, our story” by AI Co-Evolution in Education \(example unit\) \(CC BY-SA 4\.0\)/);
    assert.deepEqual(await page.$$eval("#su-license option", (o) => o.filter((x) => !x.disabled).map((x) => x.value)), ["CC-BY-SA-4.0", "none"]);
    assert.match(await page.textContent("#su-license-note"), /shared alike too/);
    assert.match(await page.textContent("#su-history"), /Copied from the example “Our water, our story” to adapt\./);
    assert.match(await page.textContent("#su-checks-sum"), /^9 of 9 in place/);
    await page.fill("#su-by", "Room 12 teaching team");
    await page.fill("#su-note", "Added a walking buddy");
    await page.press("#su-note", "Enter");
    assert.match(await page.textContent("#su-history"), /Added a walking buddy/);
    await page.waitForFunction(() => /Added a walking buddy/.test(localStorage.getItem("aice:units") || ""));
    // It's all still there after a reload
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    await page.click('#studio-units button:has-text("Our water, our story")');
    assert.equal(await page.inputValue("#su-by"), "Room 12 teaching team");
    unitFile = await grab(page, "#su-export-json");
    assert.equal(unitFile.name, "unit-our-water-our-story.json");
  });

  it("makes a unit file that matches the documented format", () => {
    const data = JSON.parse(unitFile.text);
    assert.ok(validUnit(data), JSON.stringify(validUnit.errors));
    assert.equal(data.unit.by, "Room 12 teaching team");
    assert.equal(data.unit.basedOn.length, 1);
    assert.equal(data.unit.basedOn[0].id, "u-examplewater");
    assert.match(data.app, /^AI Co-Evolution in Education \d+\.\d+/);
  });

  it("opens a unit file on another device as a copy, with the original credited", async () => {
    const other = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const p2 = await other.newPage();
    const issues = watch(p2, "another device");
    await p2.goto(server.base, { waitUntil: "load" });
    await p2.waitForSelector(".lib-card");
    await p2.setInputFiles("#studio-import", asFile(unitFile.text, unitFile.name));
    await p2.waitForSelector("#studio-editor:not([hidden])");
    assert.equal(await p2.inputValue("#su-title"), "Our water, our story");
    assert.equal(await p2.inputValue("#su-by"), "", "the new author fills in their own name");
    assert.match(await p2.textContent("#su-credits"), /“Our water, our story” by AI Co-Evolution in Education \(example unit\)[\s\S]*“Our water, our story” by Room 12 teaching team \(CC BY-SA 4\.0\)/);
    const copy = (await stored(p2)).units[0];
    assert.notEqual(copy.id, JSON.parse(unitFile.text).unit.id);
    // Opening the same file again asks first
    await p2.click("#su-back");
    await p2.setInputFiles("#studio-import", asFile(unitFile.text, unitFile.name));
    await toastSays(p2, /You've opened this unit before/);
    await toastButton(p2, "Open that one");
    assert.equal((await stored(p2)).units.length, 1);
    assert.deepEqual(issues, []);
    await other.close();
  });

  it("asks before replacing a unit with its own file, and says what differs", async () => {
    await page.fill("#su-why", "Changed after the file was made.");
    await page.waitForFunction(() => document.getElementById("su-status").textContent === "Saved on this device.");
    await page.click("#su-back");
    await page.setInputFiles("#studio-import", asFile(unitFile.text, unitFile.name));
    await toastSays(page, /You already have “Our water, our story”\. The file's version differs in the title and question\./);
    await toastButton(page, "Replace mine");
    assert.equal(await page.inputValue("#su-why"), JSON.parse(unitFile.text).unit.why);
  });

  it("saves a web page with no scripts, which opens again in the studio", async () => {
    const pageFile = await grab(page, "#su-export-html");
    assert.equal(pageFile.name, "unit-our-water-our-story.html");
    assert.match(pageFile.text, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">/);
    assert.equal((pageFile.text.match(/<script/g) || []).length, 1);
    assert.match(pageFile.text, /<script type="application\/json" id="aice-unit">/);
    assert.match(pageFile.text, /Zero Harm and Anti-Coercion/);
    const view = await context.newPage();
    const viewIssues = watch(view, "the unit's web page");
    await view.setContent(pageFile.text);
    assert.equal(await view.textContent("h1"), "Our water, our story");
    assert.equal(await view.locator(".unit-student").count(), 1);
    assert.deepEqual(viewIssues, []);
    await view.close();
    // The page opens again in the studio: here it's the same unit, unchanged, so the studio just opens it
    await page.click("#su-back");
    await page.setInputFiles("#studio-import", asFile(pageFile.text, pageFile.name, "text/html"));
    await page.waitForSelector("#studio-editor:not([hidden])");
    await page.waitForFunction(() => /exactly as it is in the file/.test(document.getElementById("announcer").textContent));
    assert.equal(await page.inputValue("#su-title"), "Our water, our story");
  });

  it("downloads the plan as Markdown", async () => {
    const md = await grab(page, "#su-export-md");
    assert.equal(md.name, "unit-our-water-our-story.md");
    assert.match(md.text, /^# Our water, our story\n\n\*\*Big question:\*\* Where does our water come from, and how can we care for it\?/);
    assert.match(md.text, /### 4\. You try together: questions for someone who knows our water\n\n- \*\*Who leads the thinking:\*\* You try together \(in groups\)\n- \*\*Routine:\*\* Community of inquiry\.[^\n]*\n- \*\*AI use:\*\* AI planning \(teacher-led\)\./);
    assert.match(md.text, /License: CC BY-SA 4\.0, https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\//);
  });

  it("asks before sharing a unit with an email address or phone number in it", async () => {
    await page.fill("#su-family", "Questions? Write to teacher.name@school.example.org");
    await page.click("#su-export-json");
    await toastSays(page, /seems to include an email address or phone number/);
    await toastButton(page, "Show me");
    assert.equal(await page.evaluate(() => document.activeElement.id), "su-family");
    await page.fill("#su-family", "Questions? Call 555 010 2030 4");
    await page.click("#su-export-md");
    await toastSays(page, /seems to include an email address or phone number/);
    const [dl] = await Promise.all([page.waitForEvent("download"), toastButton(page, "Share it anyway")]);
    assert.match(dl.suggestedFilename(), /\.md$/);
    await page.fill("#su-family", "Dear families, thank you.");
  });

  it("refuses broken, oversized and unknown files, and shows what's inside as plain text", async () => {
    await page.click("#su-back");
    await page.setInputFiles("#studio-import", asFile("{ not json", "broken.json"));
    await toastSays(page, /isn't a unit from this toolkit/);
    await page.setInputFiles("#studio-import", asFile(JSON.stringify({ format: "ai-co-evolution-unit", v: 2, unit: {} }), "future.json"));
    await toastSays(page, /comes from a newer version/);
    await page.setInputFiles("#studio-import", { name: "big.json", mimeType: "application/json", buffer: Buffer.alloc(3 * 1048576, 32) });
    await toastSays(page, /too big/);
    const hostile = {
      format: "ai-co-evolution-unit", v: 1,
      unit: { id: "u-hostile0001", title: '<img src=x onerror="window.__hacked=1">Planted', question: "<script>window.__hacked=1</script>", band: "lots", minutes: 7,
        goals: { reasoning: ["r-claim", "x-unknown", "r-claim"], literacy: "nope" }, plan: Array.from({ length: 40 }, () => ({ stage: "everyone", routine: "made-up", ai: 9, title: "S" })),
        license: "WTFPL", basedOn: [{ title: "Somewhere", license: "MIT" }], extra: "dropped" }
    };
    await page.setInputFiles("#studio-import", asFile(JSON.stringify(hostile), "hostile.json"));
    await page.waitForSelector("#studio-editor:not([hidden])");
    assert.equal(await page.inputValue("#su-title"), '<img src=x onerror="window.__hacked=1">Planted');
    assert.equal(await page.evaluate(() => window.__hacked), undefined, "nothing in the file ran");
    assert.equal(await page.inputValue("#su-band"), "13-15");
    assert.equal(await page.inputValue("#su-minutes"), "50");
    assert.equal(await page.locator(".su-session").count(), 20, "at most 20 sessions");
    assert.deepEqual(await page.$$eval('.su-session:first-child select', (s) => s.map((x) => x.value)), ["guided", "", "1"]);
    const saved = (await stored(page)).units.find((u) => u.title.endsWith("Planted"));
    assert.deepEqual(saved.goals.reasoning, ["r-claim"]);
    assert.equal(saved.extra, undefined);
    assert.equal(saved.basedOn[0].license, "none");
    assert.match(await page.textContent("#su-license-note"), /ask its authors before you share yours/);
    // Printing shows it as text too
    await page.click("#su-print");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#print-root img, #print-root script").length), 0);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.click("#su-delete");
    await toastSays(page, /Deleted/);
  });

  it("sends the note to families to the writing check, and brings it back", async () => {
    await page.click('#studio-units button:has-text("Arguing well")');
    await page.fill("#su-family", "Dear families, the homework should be utilized to commence the discussion.");
    await page.click("#su-family-check");
    assert.equal(await page.inputValue("#wc-text"), "Dear families, the homework should be utilized to commence the discussion.");
    await page.waitForSelector("#wc-results:not([hidden])", { timeout: 15000 });
    await page.fill("#wc-text", "Dear families, we'll use the homework to start the discussion.");
    await toastButton(page, "Bring it back to the unit");
    assert.equal(await page.inputValue("#su-family"), "Dear families, we'll use the homework to start the discussion.");
    assert.equal(await page.evaluate(() => document.activeElement.id), "su-family");
  });

  it("lists units under Your data, exports them, deletes them, and combines them on import", async () => {
    await page.click("#su-back");
    await page.locator("#your-data").scrollIntoViewIfNeeded();
    assert.match(await page.textContent("#data-rows"), /Your units/);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#data-export")]);
    const all = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    assert.equal(all.data.units.units.length, 2);
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForFunction(() => !localStorage.getItem("aice:units"));
    assert.equal(await page.isVisible("#studio-empty"), true);
    // One unit made on this device in the meantime is kept alongside the imported ones
    await page.locator("#studio-tool").scrollIntoViewIfNeeded();
    await page.click("#studio-new");
    await page.fill("#su-title", "Made in between");
    await page.waitForFunction(() => document.getElementById("su-status").textContent === "Saved on this device.");
    await page.click("#su-back");
    await page.setInputFiles("#data-import", asFile(JSON.stringify(all), "my-data.json"));
    await page.waitForSelector("#import-dialog[open]");
    assert.match(await page.textContent("#import-rows"), /Your units/);
    await page.click("#import-go");
    await page.keyboard.press("Escape");
    const titles = (await stored(page)).units.map((u) => u.title).sort();
    assert.deepEqual(titles, ["Arguing well", "Made in between", "Our water, our story"]);
    assert.match(await page.textContent("#studio-units"), /Made in between/);
    assert.deepEqual(problems, []);
  });
});

describe("the curriculum studio on a small phone", () => {
  it("fits 320 px with the largest text and the widest spacing, with a unit open", async () => {
    const server = await serve();
    const browser = await chromium.launch();
    try {
      const phone = await browser.newContext({ viewport: { width: 320, height: 720 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await phone.addInitScript(() => localStorage.setItem("aice:settings", JSON.stringify({ text: "xl", letters: true, space: "relaxed" })));
      const p = await phone.newPage();
      const issues = watch(p, "phone");
      await p.goto(server.base, { waitUntil: "load" });
      await p.waitForSelector(".lib-card");
      await p.locator("#studio-tool").scrollIntoViewIfNeeded();
      await p.selectOption("#studio-example", "0");
      await p.click("#studio-example-open");
      await p.evaluate(() => document.querySelectorAll("#studio details").forEach((d) => { d.open = true; }));
      // The same measure as the read-along test: nothing may run off the right edge
      const off = await p.evaluate(() => {
        const W = window.innerWidth, out = [];
        const inScroller = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(x).overflowX)) return true; return false; };
        const over = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.right > W + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("dialog, .sr-only") && !inScroller(e); };
        for (const e of document.querySelectorAll("#studio *")) if (over(e) && !(e.parentElement && over(e.parentElement))) out.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + "." + String(e.className).split(" ")[0]);
        return out;
      });
      assert.deepEqual(off, [], "nothing runs off the right edge");
      assert.deepEqual(issues, []);
    } finally { await browser.close(); await server.close(); }
  });
});

describe("the curriculum studio in the single file", () => {
  it("plans units offline", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
      const page = await context.newPage();
      const problems = watch(page, "single file");
      await page.goto(singleFileUrl(), { waitUntil: "load" });
      await page.locator("#studio-tool").scrollIntoViewIfNeeded();
      await page.selectOption("#studio-example", "2");
      await page.click("#studio-example-open");
      assert.equal(await page.inputValue("#su-title"), "Disagreeing well: deciding a real question together");
      assert.equal(await page.locator(".su-session").count(), 5);
      assert.match(await page.textContent("#su-checks-sum"), /^9 of 9 in place/);
      await page.selectOption("#su-count", "4");
      await page.click("#su-suggest");
      await toastButton(page, "Replace them");
      assert.equal(await page.locator(".su-session").count(), 4);
      assert.deepEqual(problems, []);
    } finally { await browser.close(); }
  });
});
