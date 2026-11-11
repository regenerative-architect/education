#!/usr/bin/env node
/* =========================================================================
   stamp-sw.mjs: gives the service worker a new version whenever anything it
   saves for offline use changes.

   It reads the PRECACHE list in site/sw.js, makes a fingerprint (SHA-256)
   of those files, and writes the first 12 characters into `const BUILD`.
   It does the same for the EXTRAS list (big helpers saved on first use) in
   `const EXTRAS_BUILD`, so those are fetched again only when they change.
   Installed apps notice the new sw.js and offer "Update now".

   Usage (from the repository root):
     node tools/stamp-sw.mjs            # stamps site/sw.js
     node tools/stamp-sw.mjs --check    # only checks the stamp is current (used by CI)
   The deploy workflow runs it for you before publishing.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");
const siteArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const site = path.resolve(siteArg || path.join(here, "..", "site"));
const swPath = path.join(site, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");

const block = /\/\* PRECACHE:start[\s\S]*?\*\/\s*const PRECACHE = \[([\s\S]*?)\];\s*\/\* PRECACHE:end \*\//.exec(sw);
if (!block) { console.error("Couldn't find the PRECACHE list in sw.js (look for the PRECACHE:start and PRECACHE:end comments)."); process.exit(1); }
const files = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const extrasBlock = /\/\* EXTRAS:start[\s\S]*?\*\/\s*const EXTRAS = \[([\s\S]*?)\];\s*\/\* EXTRAS:end \*\//.exec(sw);
const extras = extrasBlock ? [...extrasBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
const BUILD_LINE = /const BUILD = "[^"]*";/;
const EXTRAS_LINE = /const EXTRAS_BUILD = "[^"]*";/;

/* A fingerprint of some files: their names and contents */
function fingerprint(list, what) {
  const hash = crypto.createHash("sha256");
  for (const file of list) {
    const p = path.join(site, file);
    if (!fs.existsSync(p)) { console.error(`sw.js ${what} "${file}", but it doesn't exist in ${path.relative(process.cwd(), site) || "."}.`); process.exit(1); }
    hash.update(file + "\0");
    hash.update(fs.readFileSync(p));
  }
  return hash;
}
const extrasBuild = fingerprint(extras, "saves on first use").digest("hex").slice(0, 12);
const withExtras = EXTRAS_LINE.test(sw) ? sw.replace(EXTRAS_LINE, `const EXTRAS_BUILD = "${extrasBuild}";`) : sw;
const hash = fingerprint(files, "saves for offline use");
hash.update(withExtras.replace(BUILD_LINE, ""));   // changes to the worker itself (and to the extras) count too
const build = hash.digest("hex").slice(0, 12);
const stamped = withExtras.replace(BUILD_LINE, `const BUILD = "${build}";`);

if (checkOnly) {
  if (stamped !== sw) {
    console.error(`The service worker's version is out of date (expected ${build}). Run: node tools/stamp-sw.mjs`);
    process.exit(1);
  }
  console.log(`Service worker version is current: ${build}`);
} else {
  fs.writeFileSync(swPath, stamped);
  console.log(`Service worker stamped: ${build} (${files.length} files saved for offline use, ${extras.length} saved on first use)`);
}
