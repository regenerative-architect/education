#!/usr/bin/env node
/* =========================================================================
   build-standalone.mjs: makes the single-file edition from the app.

   One HTML file with the styles, fonts, scripts and the whole library
   inside it. It opens from a USB stick, an email attachment or a shared
   drive, with no installation and no internet, and its content security
   policy blocks every network request.

   Usage (from the repository root):
     node tools/build-standalone.mjs
   Writes site/download/ai-co-evolution-in-education.html, which the app
   offers as a download. Run it after changing anything in site/.

   How it works: site/index.html marks the parts that differ between the two
   editions with comments like <!-- build:style --> ... <!-- /build:style -->.
   This script swaps each marked part for its inline, single-file version.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(process.argv[2] || path.join(here, "..", "site"));
const outFile = path.resolve(process.argv[3] || path.join(site, "download", "ai-co-evolution-in-education.html"));
const read = (rel) => fs.readFileSync(path.join(site, rel), "utf8");

let page = read("index.html");
function swap(name, replacement) {
  const re = new RegExp(`<!-- build:${name} -->[\\s\\S]*?<!-- /build:${name} -->`);
  if (!re.test(page)) throw new Error(`Marker not found in index.html: <!-- build:${name} -->`);
  page = page.replace(re, () => replacement);   // a function, so "$" in the code is never treated specially
}

/* Text placed inside <script> must not contain "</script" or "<!--", which would end or confuse
   the block. Writing the "<" as \x3C means the same thing to JavaScript inside strings, regular
   expressions and comments, which is the only place these appear in the scripts. */
function inlineScript(rel) {
  const code = read(rel).replace(/<(\/script)/gi, "\\x3C$1").replace(/<!--/g, "\\x3C!--");
  return `<script>\n/* ${rel} */\n${code}\n</script>`;
}
/* JSON inside a <script> data block: escaping "<" makes "</script" and "<!--" impossible, and JSON reads it back unchanged */
const jsonBlock = (id, value) => `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
/* A big helper that only one tool needs, stored compressed (gzip, then base64, which has no "<" in it).
   The page unpacks it with the browser's DecompressionStream the first time that tool is used
   (unpack() in app.js), so it costs nothing until then. */
const packedBlock = (id, rel) => `<script type="application/octet-stream" id="${id}">${zlib.gzipSync(fs.readFileSync(path.join(site, rel)), { level: 9 }).toString("base64")}</script>`;

/* 1. A policy that blocks every network request */
swap("csp", `<!-- Zero network by design: this policy stops the file from contacting any server,
     so it can't track anyone even by accident. Links you click still open normally. -->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'">`);

/* 2. The icon, inside the file (no manifest: a single file can't be installed) */
const svgIcon = read("assets/icons/icon.svg").replace(/\s+/g, " ").trim();
swap("icons", `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svgIcon)}">`);

/* 3. The boot script and the styles, with both fonts embedded */
swap("boot", inlineScript("assets/boot.js"));
const css = read("assets/app.css").replace(/url\((["']?)fonts\/([\w.-]+\.woff2)\1\)/g, (m, q, file) =>
  `url(data:font/woff2;base64,${fs.readFileSync(path.join(site, "assets", "fonts", file)).toString("base64")})`);
if (/url\((["']?)(?!data:)[^)]+\)/.test(css)) throw new Error("app.css refers to a file that isn't embedded; add it to this script.");
swap("style", `<style>\n${css}\n</style>`);

/* 4. The library and every script, inside the file */
const index = JSON.parse(read("library/index.json"));
const docs = {};
for (const d of index.documents) docs[d.id] = read(`library/docs/${d.id}.html`);
swap("scripts", [
  jsonBlock("library-index", index),
  jsonBlock("library-docs", docs),
  inlineScript("vendor/marked.umd.js"),
  inlineScript("vendor/purify.min.js"),
  inlineScript("vendor/minisearch.js"),
  inlineScript("vendor/qrcode.js"),
  inlineScript("vendor/turndown.js"),
  packedBlock("packed-gpt-tokenizer", "vendor/gpt-tokenizer.js"),
  inlineScript("assets/app.js")
].join("\n"));

/* 5. Tell the script which edition this is */
if (!page.includes('data-build="pwa"')) throw new Error('index.html should have data-build="pwa" on <html>.');
page = page.replace('data-build="pwa"', 'data-build="standalone"');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, page);
const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
console.log(`Single-file edition: ${path.relative(process.cwd(), outFile)} (${mb} MB, ${index.documents.length} library documents inside)`);
