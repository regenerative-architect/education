#!/usr/bin/env node
/* =========================================================================
   build-sbom.mjs: writes site/sbom.cdx.json, a software bill of materials.

   What it is: a list, in the CycloneDX 1.6 standard (an OWASP project), of
   every outside component this app ships: each open-source package inside
   site/vendor (found by tools/vendor.mjs, not listed by hand), the fonts,
   the texts it quotes, and the files people download, with versions,
   licenses and package addresses (purl). Think of it as the ingredients
   label: school IT teams and security tools (Dependency-Track, for example)
   read it to see what's inside without having to trust a description.

   It lists no fingerprints (file hashes) and has no serial number. Version
   2.5 dropped checking files by fingerprint, so nothing here has to match a
   build byte for byte. The date comes from the page's own "last updated"
   date, so the same app still gives the same list.

   Usage (from the repository root, after the downloads are built):
     node tools/build-sbom.mjs
   The tests check it against CycloneDX's official JSON schema.
   To add something: push another component into `components` below, with a
   "bom-ref" that's unique, and list it under the app in `dependencies` if
   the app ships it.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const read = (rel) => fs.readFileSync(path.join(site, rel));

/* The app itself: its version and "last updated" date come from the page */
const page = read("index.html").toString("utf8");
const app = read("assets/app.js").toString("utf8");
const version = (/var APP_VERSION = "([\d.]+)"/.exec(app) || [])[1];
const updated = (/"dateModified": "(\d{4}-\d{2}-\d{2})"/.exec(page) || [])[1];
if (!version || !updated) throw new Error("Couldn't find the app version or its dateModified in the page.");

/* ---------- Components ---------- */
const npmRef = (name, ver) => `pkg:npm/${name.replace(/^@/, "%40")}@${ver}`;
function licenses(expr) {
  if (!expr || /^see /i.test(expr)) return [{ license: { name: "See the package's own license" } }];
  return /^[A-Za-z0-9.+-]+$/.test(expr) ? [{ license: { id: expr } }] : [{ expression: expr.replace(/^\((.*)\)$/, "$1") }];
}
/* A file the app ships, by its path in site/ (it must exist) */
const fileComponent = (rel, extra = {}) => {
  if (!fs.existsSync(path.join(site, rel))) throw new Error(`site/${rel} is listed but missing.`);
  return { type: "file", "bom-ref": `file:${rel}`, name: rel, ...extra };
};

const shipped = JSON.parse(read("vendor/LICENSES/packages.json").toString("utf8"));
const libraries = new Map();
const files = [];
const dependencies = [];
for (const f of shipped.files) {
  const refs = f.packages.map((p) => {
    const ref = npmRef(p.name, p.version);
    if (!libraries.has(ref)) {
      const scoped = /^(@[^/]+)\/(.+)$/.exec(p.name);
      libraries.set(ref, {
        type: "library", "bom-ref": ref, ...(scoped ? { group: scoped[1], name: scoped[2] } : { name: p.name }),
        version: p.version, purl: ref, licenses: licenses(p.license)
      });
    }
    return ref;
  });
  files.push(fileComponent(f.file, { description: f.packages.length > 1 ? `Bundled from ${f.packages.length} packages with esbuild; their licenses are in ${f.license}` : `License text in ${f.license}` }));
  dependencies.push({ ref: `file:${f.file}`, dependsOn: refs.sort() });
}
const FONT_NOTE = "assets/fonts/OFL.txt";
const fonts = [
  fileComponent("assets/fonts/atkinson-hyperlegible-next.woff2", { version: "2.001", licenses: [{ license: { id: "OFL-1.1" } }], copyright: "Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors", description: `Atkinson Hyperlegible Next, the body text font. License: ${FONT_NOTE}` }),
  fileComponent("assets/fonts/literata-italic.woff2", { version: "3.103", licenses: [{ license: { id: "OFL-1.1" } }], copyright: "Copyright 2017 The Literata Project Authors", description: `Literata italic, the "ritual voice". License: ${FONT_NOTE}` })
];
const texts = [{
  type: "data", "bom-ref": "data:udhr-article-1", name: "Universal Declaration of Human Rights, Article 1, in twelve languages",
  description: "Quoted in the AI Lab's language comparison. Source: the OHCHR translation project; plain text from the UDHR in Unicode collection. Notice: vendor/LICENSES/udhr-article-1.txt",
  licenses: [{ license: { name: "Unicode License (UDHR in Unicode)" } }]
}];
/* What people download from the site: the single file, the e-book, the zips and the Kiwix package */
const DOWNLOAD_NOTES = {
  ".html": "The whole toolkit in one file, for opening without internet",
  ".epub": "The library as an e-book",
  ".zip": "A download offered on the site",
  ".zim": "The Kiwix package: the toolkit and its library for Kiwix readers and hotspots"
};
const downloads = fs.readdirSync(path.join(site, "download")).filter((f) => /\.(html|zip|epub|zim)$/.test(f)).sort()
  .map((f) => fileComponent(`download/${f}`, { description: DOWNLOAD_NOTES[path.extname(f)] }));

const appRef = "app:ai-co-evolution-in-education";
dependencies.unshift({ ref: appRef, dependsOn: [...files, ...fonts].map((c) => c["bom-ref"]).concat(texts.map((c) => c["bom-ref"])).sort() });
const components = [...libraries.values()].sort((a, b) => a["bom-ref"].localeCompare(b["bom-ref"]))
  .concat(files, fonts, texts, downloads);

/* ---------- The bill of materials ---------- */
const body = {
  metadata: {
    timestamp: `${updated}T00:00:00Z`,
    component: {
      type: "application", "bom-ref": appRef, name: "AI Co-Evolution in Education", version,
      description: "An offline-first toolkit for bringing AI into learning without losing human voice, wellbeing or privacy. Part of the Planetary Restoration Archive.",
      licenses: [{ expression: "AGPL-3.0-or-later AND CC-BY-SA-4.0" }]
    },
    properties: [
      { name: "aice:privacy", value: "No tracking, no analytics, no third-party requests; a strict Content Security Policy on every page." },
      { name: "aice:single-file", value: "download/ai-co-evolution-in-education.html contains the same components, the larger ones compressed." }
    ]
  },
  components,
  dependencies
};
const bom = { $schema: "http://cyclonedx.org/schema/bom-1.6.schema.json", bomFormat: "CycloneDX", specVersion: "1.6", version: 1, ...body };
fs.writeFileSync(path.join(site, "sbom.cdx.json"), JSON.stringify(bom, null, 2) + "\n");
console.log(`Software bill of materials: site/sbom.cdx.json (CycloneDX 1.6: ${libraries.size} packages, ${files.length} vendor files, ${fonts.length} fonts, ${texts.length} text, ${downloads.length} downloads)`);
