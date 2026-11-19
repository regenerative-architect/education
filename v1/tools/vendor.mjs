#!/usr/bin/env node
/* =========================================================================
   vendor.mjs: copies the open-source browser libraries into site/vendor.

   The app never loads code from a CDN. Instead, the exact versions pinned in
   tools/package.json are copied into the site, with their license files, so
   they work offline and nothing third-party is ever contacted.

   Two libraries only ship as modules, so they're bundled here with esbuild
   (MIT) into single browser files:
   - turndown.js: turndown with Joplin's GitHub-flavoured Markdown plugin, for
     "Download as Markdown" in the reader.
   - gpt-tokenizer.js: the o200k_base tokenizer used by recent GPT models, for
     the AI Lab. It's large (about 2.8 MB, 1.1 MB compressed), so the app loads
     it only when someone opens that activity, and the single file stores it
     compressed (see build-standalone.mjs).

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

/* Bundled from modules: name -> entry code, license files */
const BUNDLES = [
  {
    as: "turndown.js", licenseAs: "turndown.txt", pkgs: [["turndown", ["LICENSE"]], ["@joplin/turndown-plugin-gfm", ["LICENSE"]]],
    entry: `import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
TurndownService.gfm = gfm;
globalThis.TurndownService = TurndownService;`
  },
  {
    as: "gpt-tokenizer.js", licenseAs: "gpt-tokenizer.txt", pkgs: [["gpt-tokenizer", ["LICENSE"]]],
    note: "The o200k_base vocabulary comes from OpenAI's tiktoken (MIT License, Copyright (c) 2022 OpenAI, Shantanu Jain).",
    entry: `import { encode, decode } from "gpt-tokenizer/encoding/o200k_base";
globalThis.GPTTokenizer = { encode, decode, encoding: "o200k_base" };`
  }
];

fs.mkdirSync(path.join(vendor, "LICENSES"), { recursive: true });
const lines = [];
for (const lib of LIBRARIES) {
  const dir = path.join(modules, lib.pkg);
  const { version } = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let code = fs.readFileSync(path.join(dir, lib.file), "utf8");
  // Source-map comments would make browsers ask for files that aren't shipped
  code = code.replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n");
  fs.writeFileSync(path.join(vendor, lib.as), code);
  const license = lib.license ? lib.license.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n\n----------------------------------------------------------------\n\n") : QRCODE_LICENSE;
  fs.writeFileSync(path.join(vendor, "LICENSES", lib.licenseAs), `${lib.pkg} ${version}\n\n${license}`);
  lines.push(`${lib.pkg} ${version} -> vendor/${lib.as}`);
}
const require = createRequire(path.join(modules, "..", "package.json"));
const esbuild = require("esbuild");
for (const b of BUNDLES) {
  const out = path.join(vendor, b.as);
  esbuild.buildSync({
    stdin: { contents: b.entry, resolveDir: path.dirname(modules), sourcefile: b.as.replace(".js", "-entry.mjs") },
    bundle: true, format: "iife", minify: true, platform: "browser", target: ["es2019"], legalComments: "inline", outfile: out, logLevel: "warning"
  });
  const versions = b.pkgs.map(([pkg, files]) => {
    const dir = path.join(modules, pkg);
    const { version } = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const text = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n\n");
    return { pkg, version, text };
  });
  fs.writeFileSync(path.join(vendor, "LICENSES", b.licenseAs),
    versions.map((v) => `${v.pkg} ${v.version}\n\n${v.text}`).join("\n\n----------------------------------------------------------------\n\n") + (b.note ? "\n\n" + b.note + "\n" : ""));
  lines.push(`${versions.map((v) => v.pkg + " " + v.version).join(" + ")} -> vendor/${b.as} (bundled, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
console.log("Copied:\n  " + lines.join("\n  "));
