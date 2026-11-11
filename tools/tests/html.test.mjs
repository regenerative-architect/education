/* =========================================================================
   HTML validation with html-validate (MIT), using the project's rules in
   .htmlvalidate.json at the repository root (the recommended set, with a
   few documented exceptions). Checks the app page, the offline page, the
   404 page, and the single file.
   ========================================================================= */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { HtmlValidate, FileSystemConfigLoader } from "html-validate";
import { REPO, SITE, SINGLE_FILE } from "./helpers.mjs";

const loader = new FileSystemConfigLoader();
const validator = new HtmlValidate(loader);
const PAGES = [path.join(SITE, "index.html"), path.join(SITE, "offline.html"), path.join(SITE, "404.html"), SINGLE_FILE];

describe("HTML validation (html-validate)", () => {
  for (const file of PAGES) {
    it(`${path.relative(REPO, file)} is valid`, async () => {
      const report = await validator.validateFile(file);
      const messages = report.results.flatMap((r) => r.messages.map((m) => `line ${m.line}: ${m.ruleId}: ${m.message}`));
      assert.deepEqual(messages, []);
    });
  }
});
