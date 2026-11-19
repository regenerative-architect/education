#!/usr/bin/env node
/* =========================================================================
   check-site.mjs: the zero-harm and quality check for the published site.
   Needs only Node.js (no npm install). Run it before every publish; the
   GitHub workflow runs it on every push and pull request.

     node tools/check-site.mjs

   It fails (and nothing is published) if it finds:
   1. Tracking or third-party code: analytics or ad scripts, or any script,
      stylesheet, font, image or frame loaded from another website.
   2. Personal contact details: email addresses, phone numbers, mailto:/tel:.
   3. A page without its content security policy, or a policy that allows
      other websites.
   4. Broken pieces: links to sections that don't exist, library links to
      documents that don't exist, manifest icons or offline files that are
      missing, library fingerprints that don't match, JSON that doesn't parse.
   Each problem is printed in plain words with the file it's in.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(process.argv[2] || path.join(here, "..", "site"));
const problems = [];
const notes = [];
const rel = (p) => path.relative(site, p) || ".";
const problem = (file, msg) => problems.push(`${file}: ${msg}`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(site);
const text = (p) => fs.readFileSync(p, "utf8");
const isText = (p) => /\.(html|js|mjs|css|json|webmanifest|svg|txt|md)$/i.test(p);
/* Library documents are fragments placed inside the app, not pages of their own */
const isPage = (p) => /\.html$/i.test(p) && /<html[\s>]/i.test(text(p));
/* HTML without its comments, so examples written in comments aren't mistaken for real links */
const withoutComments = (t) => t.replace(/<!--[\s\S]*?-->/g, "");
/* The single file carries the open-source libraries inline; their code (which mentions "mailto:" to
   handle such links safely) is checked as the library files in vendor/ instead */
const withoutVendor = (t) => t.replace(/<script>\n\/\* vendor\/[\s\S]*?<\/script>/g, "");

/* ---------- 1. Tracking and third-party code ---------- */
const TRACKERS = [
  "google-analytics.com", "googletagmanager.com", "gtag(", "ga('create'", "analytics.js", "doubleclick.net",
  "facebook.net", "connect.facebook", "fbq(", "hotjar", "segment.com", "segment.io", "mixpanel", "amplitude.com",
  "plausible.io", "matomo", "piwik", "clarity.ms", "fullstory", "heap.io", "heapanalytics", "newrelic", "nr-data.net",
  "sentry.io", "bugsnag", "datadoghq", "quantserve", "scorecardresearch", "adservice", "adsystem", "googlesyndication",
  "intercom.io", "crisp.chat", "tawk.to", "hs-scripts", "linkedin.com/insight", "snap.licdn", "tiktok.com/i18n/pixel"
];
for (const f of files.filter(isText)) {
  const t = text(f).toLowerCase();
  for (const marker of TRACKERS) if (t.includes(marker.toLowerCase())) problem(rel(f), `contains "${marker}", which looks like tracking or advertising code`);
}
for (const f of files.filter((p) => /\.html$/i.test(p))) {
  const t = withoutComments(text(f));
  // Anything that would load from another website (links people click are fine)
  const loads = [
    [/<script\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//gi, "a script from another website"],
    [/<link\b(?=[^>]*\brel\s*=\s*["']?(?:stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|manifest))[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//gi, "a file from another website"],
    [/<(?:img|iframe|frame|embed|object|audio|video|source|track)\b[^>]*\b(?:src|data|srcset)\s*=\s*["']?(?:https?:)?\/\//gi, "media or a frame from another website"],
    [/@import\s+(?:url\()?["']?(?:https?:)?\/\//gi, "a stylesheet import from another website"],
    [/url\(\s*["']?(?:https?:)?\/\//gi, "a CSS file from another website"]
  ];
  for (const [re, what] of loads) if (re.test(t)) problem(rel(f), `loads ${what}`);
}
for (const f of files.filter((p) => /\.css$/i.test(p))) {
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(text(f))) problem(rel(f), "loads a file from another website");
}

/* ---------- 2. Personal contact details ---------- */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\+?1[\s.-]\d{3}[\s.-]\d{3}[\s.-]\d{4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g;
/* Public crisis helplines are not personal contact details and must stay (keep in step with
   HELPLINES in tools/build-library.mjs). Digits only. */
const HELPLINES = new Set(["18664887386", "8775658860", "8773306366", "18006564673", "8006564673"]);
const isHelpline = (m) => { const d = m.replace(/\D/g, ""); return HELPLINES.has(d) || HELPLINES.has("1" + d); };
for (const f of files.filter((p) => isText(p) && !p.includes(`${path.sep}vendor${path.sep}`))) {
  const t = withoutVendor(text(f));
  const e = EMAIL.exec(t);
  // "x@2x" image names and "@media"-style CSS are not addresses; the pattern above needs a real domain
  if (e && !/\.(png|jpe?g|svg|webp)$/i.test(e[0])) problem(rel(f), `contains what looks like an email address ("${e[0]}")`);
  // Numbers inside web addresses (like article IDs) aren't phone numbers
  const ph = (t.replace(/https?:\/\/[^\s"'<>)]+/g, "").match(PHONE) || []).find((m) => !isHelpline(m));
  if (ph) problem(rel(f), `contains what looks like a phone number ("${ph}")`);
  if (/\b(?:mailto|tel):/i.test(t)) problem(rel(f), "contains a mailto: or tel: link");
}

/* ---------- 3. Content security policies ---------- */
for (const f of files.filter(isPage)) {
  const t = text(f);
  const m = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i.exec(t);
  if (!m) { problem(rel(f), "has no content security policy"); continue; }
  const csp = m[1];
  if (!/default-src 'none'/.test(csp)) problem(rel(f), "its content security policy doesn't start from default-src 'none'");
  if (/https?:|\*/.test(csp)) problem(rel(f), "its content security policy allows other websites");
  const hash = /script-src 'sha256-([^']+)'/.exec(csp);
  if (hash) {
    // Pages with one small inline script allow exactly that script by its fingerprint
    const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((s) => s[1]);
    const ok = scripts.some((s) => crypto.createHash("sha256").update(s).digest("base64") === hash[1]);
    if (!ok) problem(rel(f), `its script fingerprint is out of date. Use: script-src 'sha256-${scripts.map((s) => crypto.createHash("sha256").update(s).digest("base64"))[0]}'`);
  }
}

/* ---------- 4. Broken pieces ---------- */
function json(p) {
  try { return JSON.parse(text(p)); } catch (e) { problem(rel(p), "isn't valid JSON (" + e.message + ")"); return null; }
}
const exists = (p) => fs.existsSync(path.join(site, p.split(/[?#]/)[0]));

// The app page: every in-page link points at something that exists
const indexHtml = path.join(site, "index.html");
if (!fs.existsSync(indexHtml)) problem(".", "index.html is missing");
else {
  const t = withoutComments(text(indexHtml));
  const ids = new Set([...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of t.matchAll(/href="#([^"/]+)"/g)) if (!ids.has(m[1])) problem("index.html", `links to #${m[1]}, which doesn't exist`);
  for (const m of t.matchAll(/\b(?:href|src)="(?!https?:|#|data:|mailto:|tel:)([^"]+)"/g)) if (!exists(m[1])) problem("index.html", `refers to ${m[1]}, which doesn't exist`);
  for (const m of t.matchAll(/data-(?:open|copy|print|listen)="([^"]+)"/g)) if (!ids.has(m[1])) problem("index.html", `a button refers to #${m[1]}, which doesn't exist`);
}

// The manifest: icons, screenshots and shortcuts exist
const manifestPath = path.join(site, "manifest.webmanifest");
if (fs.existsSync(manifestPath)) {
  const m = json(manifestPath);
  if (m) {
    for (const k of ["name", "short_name", "start_url", "display", "icons"]) if (!m[k]) problem("manifest.webmanifest", `is missing "${k}"`);
    const imgs = [...(m.icons || []), ...(m.screenshots || []), ...(m.shortcuts || []).flatMap((s) => s.icons || [])];
    for (const i of imgs) if (!exists(i.src)) problem("manifest.webmanifest", `lists ${i.src}, which doesn't exist`);
    if (!(m.icons || []).some((i) => /512/.test(i.sizes))) problem("manifest.webmanifest", "needs a 512×512 icon to be installable");
    for (const s of m.shortcuts || []) {
      const id = (s.url.split("#")[1] || "").split("/")[0];
      if (id && fs.existsSync(indexHtml) && !text(indexHtml).includes(`id="${id}"`)) problem("manifest.webmanifest", `the shortcut "${s.name}" points at #${id}, which doesn't exist`);
    }
  }
} else problem(".", "manifest.webmanifest is missing");

// The service worker: everything it saves exists, and it has a version stamp
const swPath = path.join(site, "sw.js");
if (fs.existsSync(swPath)) {
  const sw = text(swPath);
  const list = /const PRECACHE = \[([\s\S]*?)\];/.exec(sw);
  for (const m of (list ? list[1] : "").matchAll(/"([^"]+)"/g)) if (!exists(m[1])) problem("sw.js", `saves ${m[1]} for offline use, but it doesn't exist`);
  if (/const BUILD = "dev";/.test(sw)) problem("sw.js", "has no version stamp yet. Run: node tools/stamp-sw.mjs");
} else problem(".", "sw.js is missing");

// The library: catalog, documents, fingerprints and links between documents
const libIndexPath = path.join(site, "library", "index.json");
if (fs.existsSync(libIndexPath)) {
  const ix = json(libIndexPath);
  if (ix) {
    const ids = new Set(ix.documents.map((d) => d.id));
    const slugs = {};
    for (const d of ix.documents) {
      const p = path.join(site, "library", "docs", d.id + ".html");
      if (!fs.existsSync(p)) { problem("library/index.json", `lists "${d.id}", but library/docs/${d.id}.html is missing`); continue; }
      const html = text(p);
      if (crypto.createHash("sha256").update(html).digest("hex").slice(0, 10) !== d.hash) problem(`library/docs/${d.id}.html`, "changed without rebuilding the library (its fingerprint doesn't match). Run tools/build-library.mjs");
      slugs[d.id] = new Set([...html.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]));
      if (/<(?:script|iframe|img|style|form)\b/i.test(html)) problem(`library/docs/${d.id}.html`, "contains a script, frame, image, style or form tag");
    }
    for (const d of ix.documents) {
      const p = path.join(site, "library", "docs", d.id + ".html");
      if (!fs.existsSync(p)) continue;
      for (const m of text(p).matchAll(/href="#library\/([^"/]+)(?:\/([^"]+))?"/g)) {
        if (!ids.has(m[1])) problem(`library/docs/${d.id}.html`, `links to the library document "${m[1]}", which doesn't exist`);
        else if (m[2] && slugs[m[1]] && !slugs[m[1]].has(m[2].replace(/&amp;/g, "&"))) problem(`library/docs/${d.id}.html`, `links to the section "${m[2]}" in "${m[1]}", which doesn't exist`);
      }
    }
    const sp = path.join(site, "library", "search.json");
    if (!fs.existsSync(sp)) problem("library", "search.json is missing");
    else if (crypto.createHash("sha256").update(text(sp)).digest("hex").slice(0, 10) !== ix.searchHash) problem("library/search.json", "doesn't match index.json. Run tools/build-library.mjs");
    else json(sp);
    notes.push(`library: ${ix.documents.length} documents`);
  }
} else problem(".", "library/index.json is missing");

// The single-file edition: present, and built from the current app
const single = path.join(site, "download", "ai-co-evolution-in-education.html");
if (!fs.existsSync(single)) problem(".", "the single-file edition is missing. Run: node tools/build-standalone.mjs");
else {
  const t = text(single);
  if (!t.includes('data-build="standalone"')) problem(rel(single), "isn't marked as the single-file edition");
  if (/<script\b[^>]*\bsrc=/i.test(t) || /<link\b[^>]*rel="stylesheet"/i.test(t)) problem(rel(single), "still refers to separate files, so it won't work on its own");
  const app = text(path.join(site, "assets", "app.js")).replace(/<(\/script)/gi, "\\x3C$1").replace(/<!--/g, "\\x3C!--");
  if (!t.includes(app.slice(0, 2000)) || !t.includes(app.slice(-2000))) problem(rel(single), "is older than the app. Run: node tools/build-standalone.mjs");
  notes.push(`single file: ${(fs.statSync(single).size / 1048576).toFixed(1)} MB`);
}

// The library in other formats (made by tools/build-downloads.mjs), so the page's download links work
for (const f of ["ai-co-evolution-library.epub", "ai-co-evolution-library-markdown.zip", "ai-co-evolution-kolibri.zip"]) {
  const p = path.join(site, "download", f);
  if (!fs.existsSync(p) || fs.statSync(p).size < 1024) problem("download", `${f} is missing. Run: cd tools && npm ci && node build-downloads.mjs`);
  else notes.push(`${f}: ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
}

// Every JSON file parses
for (const f of files.filter((p) => /\.json$/i.test(p))) json(f);

/* ---------- Report ---------- */
if (problems.length) {
  console.error(`\nThe site check found ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const p of problems) console.error("  • " + p);
  console.error("\nNothing should be published until these are fixed.");
  process.exit(1);
}
console.log(`Site check passed: no tracking or third-party code, no personal contact details, every page has a strict security policy, and nothing is broken (${files.length} files; ${notes.join("; ")}).`);
