/* =========================================================================
   Trust: knowing exactly what's inside.
   - the software bill of materials (site/sbom.cdx.json) passes CycloneDX's
     official 1.6 JSON schema;
   - it lists every file in site/vendor, every package bundled into them
     (with version, license and package address), the fonts, the quoted
     texts and every download, the Kiwix package included;
   - the license file for each bundle names every package in it, with its
     license text;
   - it's the same each time it's built (no dates or random numbers sneak in);
   - since version 2.5 nothing is checked by fingerprint (SHA-256): the bill
     of materials lists no hashes, publishing signs nothing, the workflow
     asks only for the permissions GitHub Pages needs, and the notes don't
     tell anyone to compare fingerprints.
   Run: cd tools && node --test tests/trust.test.mjs
   ========================================================================= */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as CDX from "@cyclonedx/cyclonedx-library";
import { SITE, REPO } from "./helpers.mjs";

const sbomFile = path.join(SITE, "sbom.cdx.json");
const sbom = JSON.parse(fs.readFileSync(sbomFile, "utf8"));
const shipped = JSON.parse(fs.readFileSync(path.join(SITE, "vendor", "LICENSES", "packages.json"), "utf8"));
const byRef = new Map(sbom.components.map((c) => [c["bom-ref"], c]));

describe("software bill of materials", () => {
  it("passes CycloneDX's official 1.6 schema", async () => {
    const errors = await new CDX.Validation.JsonStrictValidator(CDX.Spec.Version.v1dot6).validate(fs.readFileSync(sbomFile, "utf8"));
    assert.equal(errors, null, JSON.stringify(errors));
    assert.equal(sbom.specVersion, "1.6");
    const version = /var APP_VERSION = "([\d.]+)"/.exec(fs.readFileSync(path.join(SITE, "assets", "app.js"), "utf8"))[1];
    assert.equal(sbom.metadata.component.version, version);
  });

  it("lists every vendor file, and every package inside it", () => {
    const vendorFiles = fs.readdirSync(path.join(SITE, "vendor")).filter((f) => f.endsWith(".js")).sort();
    assert.deepEqual(shipped.files.map((f) => f.file.replace("vendor/", "")).sort(), vendorFiles, "packages.json covers every vendor file");
    for (const f of shipped.files) {
      assert.ok(byRef.get("file:" + f.file), f.file + " is listed");
      const deps = sbom.dependencies.find((d) => d.ref === "file:" + f.file).dependsOn;
      for (const p of f.packages) {
        const ref = `pkg:npm/${p.name.replace(/^@/, "%40")}@${p.version}`;
        assert.ok(deps.includes(ref), `${f.file} depends on ${p.name}`);
        const lib = byRef.get(ref);
        assert.equal(lib.purl, ref);
        assert.equal(lib.version, p.version);
        assert.ok(lib.licenses && lib.licenses.length, p.name + " has a license");
      }
      // The bundle's license file names every package, with its own license text
      const text = fs.readFileSync(path.join(SITE, f.license), "utf8");
      for (const p of f.packages) assert.ok(text.includes(`${p.name} ${p.version}`), `${f.license} names ${p.name}`);
    }
    // The Kiwix reader's decompressor is one of them
    assert.ok(shipped.files.some((f) => f.packages.some((p) => p.name === "fzstd")), "fzstd is shipped and listed");
    // Each package's version matches what's installed for the build
    for (const lib of sbom.components.filter((c) => c.type === "library")) {
      const name = (lib.group ? lib.group + "/" : "") + lib.name;
      const installed = JSON.parse(fs.readFileSync(path.join(REPO, "tools", "node_modules", ...name.split("/"), "package.json"), "utf8")).version;
      assert.equal(lib.version, installed, name);
    }
  });

  it("lists the fonts, the quoted texts and every download, the Kiwix package included", () => {
    for (const font of ["assets/fonts/atkinson-hyperlegible-next.woff2", "assets/fonts/literata-italic.woff2"]) {
      assert.equal(byRef.get("file:" + font).licenses[0].license.id, "OFL-1.1");
    }
    assert.ok(byRef.get("data:udhr-article-1"));
    const downloads = fs.readdirSync(path.join(SITE, "download")).filter((f) => /\.(html|zip|epub|zim)$/.test(f));
    assert.ok(downloads.length >= 5);
    for (const d of downloads) assert.ok(byRef.get("file:download/" + d), d + " is listed");
    assert.match(byRef.get("file:download/ai-co-evolution-in-education.zim").description, /Kiwix/);
  });

  it("has no fingerprints and no serial number", () => {
    const text = fs.readFileSync(sbomFile, "utf8");
    assert.doesNotMatch(text, /"hashes"/);
    assert.doesNotMatch(text, /SHA-?256/i);
    assert.equal(sbom.serialNumber, undefined);
  });

  it("is the same each time it's built", () => {
    const before = fs.readFileSync(sbomFile);
    execFileSync(process.execPath, [path.join(REPO, "tools", "build-sbom.mjs")], { stdio: "pipe" });
    assert.ok(fs.readFileSync(sbomFile).equals(before));
  });
});

describe("no fingerprint checks", () => {
  const wf = fs.readFileSync(path.join(REPO, ".github", "workflows", "pages.yml"), "utf8");
  const deploy = wf.slice(wf.indexOf("  deploy:"));

  it("publishing signs nothing and asks only for what GitHub Pages needs", () => {
    assert.doesNotMatch(wf, /attest-build-provenance|attestations: write|sha256sum|shasum/);
    assert.match(deploy, /pages: write/);
    assert.match(deploy, /id-token: write/);   // GitHub Pages itself uses it to confirm where a deployment comes from
    // The Kiwix package is made before the bill of materials that lists it, with a pinned python-libzim, and the site is checked last
    assert.ok(deploy.indexOf("build-zim.py") > -1 && deploy.indexOf("build-zim.py") < deploy.indexOf("build-sbom.mjs"));
    assert.ok(deploy.indexOf("build-sbom.mjs") < deploy.indexOf("check-site.mjs"));
    assert.match(deploy, /pip install libzim==\d+\.\d+\.\d+/);
  });

  it("the notes don't ask anyone to compare fingerprints", () => {
    const notes = ["README.md", "SECURITY.md", "THIRD-PARTY-NOTICES.md", path.join("docs", "REPOSITORIES.md"), path.join("tools", "tests", "README.md")];
    for (const n of notes) {
      const t = fs.readFileSync(path.join(REPO, n), "utf8");
      assert.doesNotMatch(t, /gh attestation|compare-zim|sha256sum|Get-FileHash|shasum/, n);
    }
    assert.equal(fs.existsSync(path.join(REPO, "tools", "compare-zim.py")), false, "compare-zim.py is gone");
  });
});
