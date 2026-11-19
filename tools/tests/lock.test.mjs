/* =========================================================================
   Lock it with a passphrase:
   - "Download all, locked" asks for a passphrase twice, gives a rough
     strength guide, and downloads a file with none of your data readable
     in it; Node's own Web Crypto opens it with the passphrase (so the
     format is standard and documented: PBKDF2-SHA-256, AES-256-GCM);
   - importing a locked file asks for the passphrase first (Enter works),
     says plainly when it's wrong, then shows the usual import preview;
   - a file changed after locking is refused, and so is one asking for an
     unusual amount of work; a file locked by another program in the same
     documented way opens.
   Run: cd tools && node --test tests/lock.test.mjs
   ========================================================================= */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { chromium } from "playwright";
import { serve, watch } from "./helpers.mjs";

const PASS = "river cedar lantern morning";
const NOTE = "Our class tried the breathing pause on Monday.";
const enc = new TextEncoder();
const LABEL = enc.encode("ai-co-evolution-locked/v1");
async function keyFor(pass, salt, rounds) {
  const base = await webcrypto.subtle.importKey("raw", enc.encode(pass.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return webcrypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function nodeUnlock(file, pass) {
  const key = await keyFor(pass, Buffer.from(file.kdf.salt, "base64"), file.kdf.iterations);
  const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(file.cipher.iv, "base64"), additionalData: LABEL }, key, Buffer.from(file.data, "base64"));
  return new TextDecoder().decode(plain);
}
async function nodeLock(text, pass, rounds = 600000) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
  const sealed = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: LABEL }, await keyFor(pass, salt, rounds), enc.encode(text));
  return { format: "ai-co-evolution-locked", v: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: rounds, salt: Buffer.from(salt).toString("base64") }, cipher: { name: "AES-GCM", iv: Buffer.from(iv).toString("base64") }, data: Buffer.from(sealed).toString("base64") };
}
const asFile = (obj, name = "locked.json") => ({ name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(obj)) });

describe("lock it with a passphrase", () => {
  let server, browser, page, problems, locked;
  before(async () => {
    server = await serve();
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    page = await context.newPage();
    problems = watch(page, "app");
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForSelector(".lib-card");
    // Something to keep: a path and a note
    await page.click('[data-role="student"]');
    await page.evaluate(() => { location.hash = "#library/welcome-ritual"; });
    await page.waitForSelector("#reader-notebook:not([hidden])");
    await page.fill("#nb-notes", NOTE);
    await page.waitForFunction(() => document.getElementById("nb-status").textContent === "Saved on this device.");
    await page.keyboard.press("Escape");
  });
  after(async () => { await browser?.close(); await server?.close(); });

  it("downloads a locked file that only the passphrase opens", async () => {
    await page.locator("#your-data").scrollIntoViewIfNeeded();
    await page.click("#data-export-locked");
    await page.waitForSelector("#lock-dialog[open]");
    assert.equal(await page.evaluate(() => document.activeElement.id), "lock-pass");
    assert.match(await page.textContent("#lock-intro"), /If you forget the passphrase, nobody can open the file/);
    await page.fill("#lock-pass", "short");
    assert.match(await page.textContent("#lock-strength"), /^Too short/);
    await page.click("#lock-go");
    assert.equal(await page.textContent("#lock-msg"), "Use at least 10 characters.");
    await page.fill("#lock-pass", PASS);
    assert.equal(await page.textContent("#lock-strength"), "Strong.");
    await page.fill("#lock-pass2", PASS + " ");
    await page.click("#lock-go");
    assert.equal(await page.textContent("#lock-msg"), "The two passphrases aren't the same.");
    await page.fill("#lock-pass2", PASS);
    await page.check("#lock-show");
    assert.equal(await page.getAttribute("#lock-pass", "type"), "text");
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click("#lock-go")]);
    assert.match(dl.suggestedFilename(), /^ai-co-evolution-my-data-locked-\d{4}-\d{2}-\d{2}\.json$/);
    const raw = fs.readFileSync(await dl.path(), "utf8");
    assert.ok(!raw.includes("breathing pause") && !raw.includes("student"), "nothing of your data is readable in the file");
    locked = JSON.parse(raw);
    assert.deepEqual({ format: locked.format, v: locked.v, kdf: { ...locked.kdf, salt: typeof locked.kdf.salt }, cipher: { ...locked.cipher, iv: typeof locked.cipher.iv } },
      { format: "ai-co-evolution-locked", v: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: "string" }, cipher: { name: "AES-GCM", iv: "string" } });
    // Node's Web Crypto opens it with the passphrase
    const inside = JSON.parse(await nodeUnlock(locked, PASS));
    assert.equal(inside.format, "ai-co-evolution-data");
    assert.equal(inside.data.role, "student");
    assert.equal(inside.data.notebook.docs["welcome-ritual"].notes, NOTE);
    await assert.rejects(nodeUnlock(locked, "wrong passphrase here"), "a wrong passphrase doesn't open it");
    // The dialog closed and forgot the passphrase
    assert.equal(await page.evaluate(() => document.getElementById("lock-dialog").open), false);
    assert.equal(await page.inputValue("#lock-pass"), "");
  });

  it("asks for the passphrase when importing a locked file, then shows what's in it", async () => {
    await page.click("#data-clear");
    await page.click("#data-clear");
    await page.waitForFunction(() => !localStorage.getItem("aice:notebook"));
    await page.setInputFiles("#data-import", asFile(locked));
    await page.waitForSelector("#lock-dialog[open]");
    assert.equal(await page.textContent("#lock-h"), "Unlock this file");
    assert.equal(await page.isHidden("#lock-pass2-field"), true);
    await page.fill("#lock-pass", "not the passphrase");
    await page.press("#lock-pass", "Enter");
    await page.waitForFunction(() => /doesn't open this file/.test(document.getElementById("lock-msg").textContent), null, { timeout: 15000 });
    await page.fill("#lock-pass", PASS);
    await page.press("#lock-pass", "Enter");
    await page.waitForSelector("#import-dialog[open]", { timeout: 15000 });
    assert.match(await page.textContent("#import-rows"), /Your notebook/);
    await page.click("#import-go");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("aice:notebook")).docs["welcome-ritual"].notes), NOTE);
  });

  it("refuses a file that was changed after it was locked", async () => {
    const bytes = Buffer.from(locked.data, "base64");
    bytes[10] ^= 1;   // one bit
    await page.setInputFiles("#data-import", asFile({ ...locked, data: bytes.toString("base64") }));
    await page.waitForSelector("#lock-dialog[open]");
    await page.fill("#lock-pass", PASS);
    await page.click("#lock-go");
    await page.waitForFunction(() => /or the file was changed after it was locked/.test(document.getElementById("lock-msg").textContent), null, { timeout: 15000 });
    await page.keyboard.press("Escape");
  });

  it("refuses a file that would keep the device busy, without trying", async () => {
    await page.setInputFiles("#data-import", asFile({ ...locked, kdf: { ...locked.kdf, iterations: 50000000 } }));
    await page.waitForSelector("#lock-dialog[open]");
    await page.fill("#lock-pass", PASS);
    const t = Date.now();
    await page.click("#lock-go");
    await page.waitForFunction(() => /isn't in a shape this toolkit can open/.test(document.getElementById("lock-msg").textContent));
    assert.ok(Date.now() - t < 3000);
    await page.keyboard.press("Escape");
  });

  it("opens a file locked the same documented way by another program", async () => {
    const made = await nodeLock(JSON.stringify({ format: "ai-co-evolution-data", schema: 2, data: { role: "family" } }), "made in node.js, not the browser", 200000);
    await page.setInputFiles("#data-import", asFile(made));
    await page.waitForSelector("#lock-dialog[open]");
    await page.fill("#lock-pass", "made in node.js, not the browser");
    await page.click("#lock-go");
    await page.waitForSelector("#import-dialog[open]", { timeout: 15000 });
    assert.match(await page.textContent("#import-rows"), /Your path/);
    await page.keyboard.press("Escape");
    assert.deepEqual(problems, []);
  });
});
