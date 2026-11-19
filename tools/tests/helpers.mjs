/* =========================================================================
   Shared helpers for the test suite.

   serve()  starts a small web server that behaves like GitHub Pages for a
            project site: the repository folder is served at /, so the app
            lives at /site/ (a sub-path, like /<repository>/). Missing files
            get site/404.html with status 404, as on GitHub Pages.
   watch()  collects anything that should never happen on a page: console
            errors, script errors, content-security-policy violations and
            unexpected alert/confirm dialogs.

   Tests use Playwright (Apache-2.0). In CI the workflow installs Chromium;
   on your computer, run `npx playwright install chromium` once in tools/.
   ========================================================================= */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const SITE = path.join(REPO, "site");
export const SINGLE_FILE = path.join(SITE, "download", "ai-co-evolution-in-education.html");
export const singleFileUrl = (hash = "") => "file://" + SINGLE_FILE + hash;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".zip": "application/zip", ".epub": "application/epub+zip"
};

export function serve() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    requests.push(url.pathname + url.search);
    let file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end(fs.readFileSync(path.join(SITE, "404.html")));
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        port,
        origin: `http://localhost:${port}`,
        base: `http://localhost:${port}/site/`,
        requests,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); })
      });
    });
  });
}

/* A small Kiwix library for the question ladder's tests, written by tests/fixtures/make-ladder-zim.py
   with python-libzim into a temporary folder (removed when the tests end). Returns the file's path, or
   null where python-libzim isn't installed (pip install libzim==4.1.0; the CI installs it). */
let ladderZim;
export function ladderLibrary() {
  if (ladderZim !== undefined) return ladderZim;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aice-ladder-"));
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, "ladder-test.zim");
  const made = spawnSync(process.env.PYTHON || "python3", [path.join(REPO, "tools", "tests", "fixtures", "make-ladder-zim.py"), out], { encoding: "utf8" });
  ladderZim = made.status === 0 && fs.existsSync(out) ? out : null;
  return ladderZim;
}
/* openZIM's test files (github.com/openzim/zim-testing-suite, its data/ folder), when ZIM_TESTING_SUITE
   points to them: small real Wikipedia libraries in each layout, and deliberately damaged files. */
export const ZIM_SUITE = process.env.ZIM_TESTING_SUITE && fs.existsSync(path.join(process.env.ZIM_TESTING_SUITE, "nons")) ? process.env.ZIM_TESTING_SUITE : null;

/* Watch a page for problems. Returns an array that fills up as problems happen. */
export function watch(page, label = "page", { allow = [] } = {}) {
  const problems = [];
  page.on("console", (m) => {
    const text = m.text();
    if (allow.some((re) => re.test(text))) return;
    if (m.type() === "error" || /Content Security Policy|Refused to/.test(text)) problems.push(`${label}: ${text}`);
  });
  page.on("pageerror", (e) => problems.push(`${label}: script error: ${e.message}`));
  page.on("dialog", (d) => { problems.push(`${label}: unexpected dialog: ${d.message()}`); d.dismiss().catch(() => {}); });
  return problems;
}

/* Record content-security-policy violations inside the page (for pages that start in this context) */
export async function recordPolicyViolations(context) {
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
}

/* A stand-in for the browser's built-in translator (the Translator and Language Detector APIs),
   for tests: run it with context.addInitScript(fakeTranslator). It "translates" by putting the
   language code in brackets in front of the text, so tests can check exactly what was translated.
   Like the real thing, creating a translator needs a recent click, languages can need a download
   (French here, with progress events), some languages aren't offered (Tamil and Somali here), and
   a running translation can be stopped. window.__created lists the translators made. */
export function fakeTranslator() {
  window.__created = [];
  window.__destroyed = 0;
  const AVAILABLE = { fr: "downloadable", ta: "unavailable", so: "unavailable" };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.Translator = {
    availability: async ({ targetLanguage }) => AVAILABLE[targetLanguage] || "available",
    create: async ({ sourceLanguage, targetLanguage, monitor }) => {
      if (!navigator.userActivation.isActive) throw new DOMException("Requires a user gesture.", "NotAllowedError");
      window.__created.push(sourceLanguage + ">" + targetLanguage);
      if (monitor && AVAILABLE[targetLanguage] === "downloadable") {
        const m = new EventTarget();
        monitor(m);
        for (const loaded of [0, 0.5, 1]) { const e = new Event("downloadprogress"); e.loaded = loaded; m.dispatchEvent(e); await wait(60); }
        AVAILABLE[targetLanguage] = "available";
      }
      return {
        sourceLanguage, targetLanguage,
        async translate(text, opts) {
          await wait(window.__trMs ?? 2);
          if (opts && opts.signal && opts.signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
          return "⟦" + targetLanguage + "⟧ " + text;
        },
        destroy() { window.__destroyed++; }
      };
    }
  };
  window.LanguageDetector = {
    availability: async () => "available",
    create: async () => ({
      detect: async (t) => [{ detectedLanguage: /\b(los|las|para|aprendizaje)\b/i.test(t) ? "es" : "en", confidence: 0.95 }],
      destroy() {}
    })
  };
}
