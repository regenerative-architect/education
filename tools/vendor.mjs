#!/usr/bin/env node
/* =========================================================================
   vendor.mjs: copies the open-source browser libraries into site/vendor.

   The app never loads code from a CDN. Instead, the exact versions pinned in
   tools/package.json are copied into the site, with their license files, so
   they work offline and nothing third-party is ever contacted.

   Some libraries only ship as modules, so they're bundled here with esbuild
   (MIT) into single browser files:
   - turndown.js: turndown with Joplin's GitHub-flavoured Markdown plugin, for
     "Download as Markdown" in the reader.
   - gpt-tokenizer.js: the o200k_base tokenizer used by recent GPT models, for
     the AI Lab. It's large (about 2.8 MB, 1.1 MB compressed), so the app loads
     it only when someone opens that activity, and the single file stores it
     compressed (see build-standalone.mjs).
   - fsrs.js: ts-fsrs, the FSRS spaced-repetition scheduler, for "Practice
     the key ideas".
   - plain-kind.js: unified and retext checkers (readability, plain words,
     passive voice, considerate language), for the plain and kind writing
     check.
   - fzstd.js: fzstd, a small Zstandard decompressor, for the question
     ladder's Kiwix reader (Kiwix libraries keep their pages compressed).

   Licenses: every package that ends up inside a bundle is found from
   esbuild's record of the files it read, and its license file is copied
   into site/vendor/LICENSES, with a list of all of them in
   site/vendor/LICENSES/packages.json (used by the software bill of
   materials). Nothing has to be listed by hand.

   Usage (from the repository root, after `cd tools && npm ci`):
     node tools/vendor.mjs
   To update a library: change its version in tools/package.json, run
   `npm install` in tools/, then run this script and `node tools/stamp-sw.mjs`.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = path.resolve(process.argv[2] || path.join(here, "node_modules"));
const site = path.resolve(process.argv[3] || path.join(here, "..", "site"));
const vendor = path.join(site, "vendor");

/* file in node_modules -> name in site/vendor, plus the license to ship with it */
const LIBRARIES = [
  { pkg: "marked", file: "lib/marked.umd.js", as: "marked.umd.js", license: ["LICENSE"], licenseAs: "marked.txt" },
  { pkg: "dompurify", file: "dist/purify.min.js", as: "purify.min.js", license: ["LICENSE", "LICENSE-MPL"], licenseAs: "dompurify.txt" },   // dual-licensed: Apache-2.0 or MPL-2.0
  { pkg: "minisearch", file: "dist/umd/index.js", as: "minisearch.js", license: ["LICENSE.txt"], licenseAs: "minisearch.txt" },
  { pkg: "qrcode-generator", file: "dist/qrcode.js", as: "qrcode.js", license: null, licenseAs: "qrcode-generator.txt" }
];

/* qrcode-generator states its MIT license in the file header but ships no LICENSE file */
const QRCODE_LICENSE = `MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
`;

/* Bundled from modules: the file it makes, its license file, and the code that says what's in it */
const BUNDLES = [
  {
    as: "turndown.js", licenseAs: "turndown.txt",
    entry: `import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
TurndownService.gfm = gfm;
globalThis.TurndownService = TurndownService;`
  },
  {
    as: "gpt-tokenizer.js", licenseAs: "gpt-tokenizer.txt",
    note: "The o200k_base vocabulary comes from OpenAI's tiktoken (MIT License, Copyright (c) 2022 OpenAI, Shantanu Jain).",
    entry: `import { encode, decode } from "gpt-tokenizer/encoding/o200k_base";
globalThis.GPTTokenizer = { encode, decode, encoding: "o200k_base" };`
  },
  {
    as: "fsrs.js", licenseAs: "fsrs.txt",
    entry: `import { fsrs, generatorParameters, createEmptyCard, Rating, State, TypeConvert } from "ts-fsrs";
globalThis.FSRS = { fsrs, generatorParameters, createEmptyCard, Rating, State, TypeConvert };`
  },
  {
    /* PlainKind.check(text, age) lists suggestions with their place in the text (character offsets);
       age is the reader's age the readability formulas aim at. PlainKind.syllables(word) counts syllables. */
    as: "plain-kind.js", licenseAs: "plain-kind.txt",
    entry: `import { unified } from "unified";
import retextEnglish from "retext-english";
import retextStringify from "retext-stringify";
import retextReadability from "retext-readability";
import retextSimplify from "retext-simplify";
import retextPassive from "retext-passive";
import retextEquality from "retext-equality";
import { syllable } from "syllable";
function place(m, end) { const p = m.place; if (!p) return null; const point = p.start ? (end ? p.end : p.start) : p; return point && typeof point.offset === "number" ? point.offset : null; }
globalThis.PlainKind = {
  check(text, age) {
    const file = unified().use(retextEnglish).use(retextReadability, { age: age, threshold: 4 / 7 }).use(retextSimplify).use(retextPassive).use(retextEquality).use(retextStringify).processSync(String(text));
    return file.messages.map((m) => ({ source: m.source, rule: m.ruleId, start: place(m, false), end: place(m, true), actual: m.actual == null ? null : String(m.actual), expected: Array.isArray(m.expected) ? m.expected.map(String) : null, note: m.note || null, reason: String(m.reason) }));
  },
  syllables: syllable
};`
  },
  {
    /* FZSTD.decompress(bytes) and new FZSTD.Decompress(onChunk): Zstandard, for reading Kiwix libraries */
    as: "fzstd.js", licenseAs: "fzstd.txt",
    entry: `import { decompress, Decompress } from "fzstd";
globalThis.FZSTD = { decompress, Decompress };`
  }
];

/* ---------- Which packages a bundle contains, and their licenses ---------- */
const SEPARATOR = "\n\n----------------------------------------------------------------\n\n";
/* This project publishes no email addresses (tools/check-site.mjs checks the license files too).
   A copyright line keeps its year and name and leaves out the address: "Copyright (c) 2014
   Jane Doe" followed by an address in angle brackets becomes "Copyright (c) 2014 Jane Doe".
   The license terms are kept in full, and each package's original files are in its npm package. */
const EMAIL_IN_NOTICE = /[ \t]*[<(]?[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}[>)]?/g;
const withoutEmails = (t) => t.replace(EMAIL_IN_NOTICE, "");
function packageRoot(file) {
  const parts = path.resolve(file).split(path.sep), at = parts.lastIndexOf("node_modules");
  if (at < 0) return null;
  const take = parts[at + 1] && parts[at + 1].startsWith("@") ? 3 : 2;
  return parts.slice(0, at + take).join(path.sep);
}
function packageInfo(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const license = typeof pkg.license === "string" ? pkg.license : (pkg.license && pkg.license.type) || "see package";
  const files = fs.readdirSync(dir).filter((f) => /^(licen[cs]e|copying)([-.][\w.]+)?$/i.test(f)).sort();
  const text = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8").trim()).join("\n\n");
  const author = typeof pkg.author === "string" ? pkg.author : pkg.author && pkg.author.name;
  return { name: pkg.name, version: pkg.version, license, text: text || `${license} license, as stated in the package's package.json${author ? " (author: " + author + ")" : ""}. The package ships no separate license file.` };
}
function packagesIn(metafile) {
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) { const d = packageRoot(input); if (d) dirs.add(d); }
  return [...dirs].map(packageInfo).sort((a, b) => a.name.localeCompare(b.name));
}
const manifest = [];

fs.mkdirSync(path.join(vendor, "LICENSES"), { recursive: true });
const lines = [];
for (const lib of LIBRARIES) {
  const dir = path.join(modules, lib.pkg);
  const { version } = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let code = fs.readFileSync(path.join(dir, lib.file), "utf8");
  // Source-map comments would make browsers ask for files that aren't shipped
  code = code.replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n");
  fs.writeFileSync(path.join(vendor, lib.as), code);
  const license = lib.license ? lib.license.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join(SEPARATOR) : QRCODE_LICENSE;
  fs.writeFileSync(path.join(vendor, "LICENSES", lib.licenseAs), withoutEmails(`${lib.pkg} ${version}\n\n${license}`));
  const info = packageInfo(dir);
  manifest.push({ file: `vendor/${lib.as}`, license: `vendor/LICENSES/${lib.licenseAs}`, packages: [{ name: info.name, version: info.version, license: info.license }] });
  lines.push(`${lib.pkg} ${version} -> vendor/${lib.as}`);
}
const require = createRequire(path.join(modules, "..", "package.json"));
const esbuild = require("esbuild");
for (const b of BUNDLES) {
  const out = path.join(vendor, b.as);
  const result = esbuild.buildSync({
    stdin: { contents: b.entry, resolveDir: path.dirname(modules), sourcefile: b.as.replace(".js", "-entry.mjs") },
    bundle: true, format: "iife", minify: true, platform: "browser", target: ["es2019"], legalComments: "inline", outfile: out, logLevel: "warning", metafile: true
  });
  const pkgs = packagesIn(result.metafile);
  fs.writeFileSync(path.join(vendor, "LICENSES", b.licenseAs), withoutEmails(
    `${b.as} bundles these ${pkgs.length} packages:\n${pkgs.map((p) => `- ${p.name} ${p.version} (${p.license})`).join("\n")}` + SEPARATOR +
    pkgs.map((p) => `${p.name} ${p.version}\n\n${p.text}`).join(SEPARATOR) + (b.note ? "\n\n" + b.note + "\n" : "\n")));
  manifest.push({ file: `vendor/${b.as}`, license: `vendor/LICENSES/${b.licenseAs}`, packages: pkgs.map((p) => ({ name: p.name, version: p.version, license: p.license })) });
  lines.push(`${pkgs.length === 1 ? pkgs[0].name + " " + pkgs[0].version : pkgs.length + " packages"} -> vendor/${b.as} (bundled, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
/* A list of everything shipped in vendor/, for the software bill of materials (tools/build-sbom.mjs) */
fs.writeFileSync(path.join(vendor, "LICENSES", "packages.json"), JSON.stringify({ about: "Open-source packages shipped in site/vendor, with versions and licenses. Written by tools/vendor.mjs.", files: manifest }, null, 2) + "\n");
console.log("Copied:\n  " + lines.join("\n  "));
