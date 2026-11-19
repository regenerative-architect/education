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
import path from "node:path";
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
