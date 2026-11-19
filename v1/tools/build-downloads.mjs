#!/usr/bin/env node
/* =========================================================================
   build-downloads.mjs: the library in formats people can take anywhere.

   From the cleaned library in site/library (made by build-library.mjs) and
   the single-file edition (made by build-standalone.mjs), this writes:

   1. site/download/ai-co-evolution-library-markdown.zip
      Every document as a Markdown file, to open in any text editor and
      adapt, plus a README listing them. Links between documents still work.
   2. site/download/ai-co-evolution-library.epub
      An EPUB 3 e-book for e-readers and reading apps (Apple Books, Kobo,
      Thorium, Calibre and others), with a table of contents and
      accessibility metadata. Checked with EPUBCheck in the tests.
   3. site/download/ai-co-evolution-kolibri.zip
      The single-file edition packaged as an HTML5 app for Kolibri, the
      offline learning platform (import it in Kolibri Studio).
   4. CODE_OF_CONDUCT.md and CONTRIBUTING.md at the repository root, so
      GitHub shows them on the repository's community pages.

   Everything is built with fflate (MIT), turndown (MIT) and Joplin's
   GitHub-flavoured Markdown plugin (MIT), and comes out identical every time
   for the same input, so a rebuild only changes what really changed.

   Usage (from the repository root, after `cd tools && npm ci`):
     node tools/build-downloads.mjs
   Run it after build-library.mjs and build-standalone.mjs.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { zipSync, strToU8 } from "fflate";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.argv[2] || path.join(here, ".."));
const site = path.join(repo, "site");
const outDir = path.join(site, "download");
const read = (rel) => fs.readFileSync(path.join(site, rel), "utf8");
const index = JSON.parse(read("library/index.json"));
const VERSION = (/var APP_VERSION = "([\d.]+)"/.exec(read("assets/app.js")) || [, "2"])[1];
const DATE = index.generated;                                  // the library's build date, so output is repeatable
const MTIME = new Date(DATE + "T00:00:00Z");
const docs = index.documents;
const byId = new Map(docs.map((d) => [d.id, d]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bodyOf = (id) => new JSDOM(`<!DOCTYPE html><body>${read(`library/docs/${id}.html`)}</body>`).window.document.body;
const PROVENANCE = "Personal contact details, retired links and badge images were removed, and outdated crisis helpline details updated.";
const LICENSE_LINE = "License: the project repository uses the GNU Affero General Public License v3.0 or later, and some documents state Creative Commons Attribution-ShareAlike 4.0; LICENSE-NOTES.md in the app's repository explains.";   // the same words as MD_LICENSE in site/assets/app.js
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Markdown: the same rules as the app's "Download as Markdown" (markdownOf in site/assets/app.js) ----------
   Keep the two in step: tools/tests/downloads.test.mjs checks they give identical files. */
function markdown(body) {
  const doc = body.ownerDocument;
  // Table cells hold one line in Markdown: headings become bold, list items "•" lines, paragraphs line breaks
  body.querySelectorAll("td, th").forEach((cell) => {
    const br = () => doc.createElement("br");
    cell.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => { const s = doc.createElement("strong"); s.append(...h.childNodes); h.replaceWith(s, br()); });
    cell.querySelectorAll("li").forEach((li) => li.replaceWith("• ", ...li.childNodes, br()));
    cell.querySelectorAll("ul, ol, p").forEach((b) => b.replaceWith(...b.childNodes, br()));
    cell.querySelectorAll("hr").forEach((hr) => hr.remove());
    while (cell.lastChild && (cell.lastChild.nodeName === "BR" || (cell.lastChild.nodeType === 3 && !cell.lastChild.textContent.trim()))) cell.lastChild.remove();
  });
  const t = new TurndownService({ headingStyle: "atx", hr: "---", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*", strongDelimiter: "**" });
  t.use(gfm);
  // Tables become Markdown tables (with an empty header row when they have none); the rare table with
  // a code block or another table inside stays as plain HTML, which Markdown allows
  const complex = (n) => !!n.querySelector("pre, table, blockquote") || (n.rows.length === 1 && n.rows[0].cells.length <= 1);
  t.addRule("table", { filter: (n) => n.nodeName === "TABLE", replacement: (c, n) => {
    if (complex(n)) return `\n\n${n.outerHTML}\n\n`;
    let content = c.replace(/\n+/g, "\n").trim();
    if (!/^\|\s*:?-{3}/.test(content.split("\n")[1] || "")) {
      const cols = Math.max(...[...n.rows].map((r) => r.cells.length));
      content = "|" + "     |".repeat(cols) + "\n|" + " --- |".repeat(cols) + "\n" + content;
    }
    return `\n\n${content}\n\n`;
  } });
  // Callouts go back to GitHub's alert syntax (> [!NOTE]), which GitHub and Obsidian both show as boxes;
  // kinds GitHub doesn't know (like "danger") keep their label in bold
  t.addRule("alert-label", { filter: (n) => n.nodeName === "P" && n.classList.contains("doc-alert-label"), replacement: (c, n) => {
    const kind = (n.parentNode.getAttribute("data-kind") || "").toLowerCase();
    return ["note", "tip", "important", "warning", "caution"].indexOf(kind) >= 0 ? `\n\n[!${kind.toUpperCase()}]\n\n` : `\n\n**${n.textContent.trim()}**\n\n`;
  } });
  // Checklists stay checklists, wherever the box sits in the list item
  t.addRule("task", { filter: (n) => n.nodeName === "INPUT" && n.type === "checkbox", replacement: (c, n) => (n.checked ? "[x] " : "[ ] ") });
  // Fold-out sections become a bold line and their content, readable in any editor
  t.addRule("details", { filter: "details", replacement: (c) => `\n\n${c}\n\n` });
  t.addRule("summary", { filter: "summary", replacement: (c) => (c.trim() ? `\n\n**${c.trim().replace(/^\*\*|\*\*$/g, "")}**\n\n` : "") });
  return t.turndown(body).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
/* Links between library documents become links to the other Markdown files (or plain text) */
function relinkForMarkdown(body, target) {
  body.querySelectorAll(".sr-only").forEach((n) => n.remove());
  body.querySelectorAll('a[href^="#library/"]').forEach((a) => {
    const [, id, slug] = /^#library\/([^/]+)(?:\/(.+))?$/.exec(a.getAttribute("href")) || [];
    const href = target(id, slug);
    if (href) a.setAttribute("href", href);
    else a.replaceWith(...a.childNodes);
  });
  body.querySelectorAll("a[target]").forEach((a) => { a.removeAttribute("target"); a.removeAttribute("rel"); });
  return body;
}
const footer = (d) => `\n---\n\n*From the AI Co-Evolution in Education library, version ${VERSION}. Source in the project repository: \`${d.source}\`. ${PROVENANCE} ${LICENSE_LINE}*\n`;

/* 1. The Markdown zip */
const md = {};
const folder = "ai-co-evolution-library/";
for (const d of docs) {
  const body = relinkForMarkdown(bodyOf(d.id), (id, slug) => (byId.has(id) ? `${id}.md${slug ? "#" + slug : ""}` : null));
  md[folder + d.id + ".md"] = strToU8(markdown(body) + footer(d));
}
const groups = [...new Set(docs.map((d) => d.group))];
const readme = [
  "# AI Co-Evolution in Education: the library", "",
  `${docs.length} guides, lesson plans and templates from the project repository, as Markdown files you can open in any text editor, adapt for your classroom, and share. Version ${VERSION}, built ${DATE}.`, "",
  "## How to use these files", "",
  "- Open any `.md` file in a text editor, or in a Markdown app such as Obsidian, Typora or VS Code. Links between documents work when the files stay together in this folder.",
  "- Adapt freely, and keep adaptations open under the same license, with credit to the Planetary Restoration Archive.",
  "- Never add students' names, photos or personal details to an adapted version.",
  "- For children under 13, AI use stays teacher-led: the teacher runs the tool while students ask, question and decide.", "",
  `${PROVENANCE} ${LICENSE_LINE}`, "",
  ...groups.flatMap((g) => ["## " + g, "", ...docs.filter((d) => d.group === g).map((d) => `- [${d.title}](${d.id}.md): ${d.summary || ""}`.trim()), ""])
].join("\n");
md[folder + "README.md"] = strToU8(readme);
const zipFiles = {};
for (const [name, data] of Object.entries(md)) zipFiles[name] = [data, { level: 9, mtime: MTIME }];
fs.writeFileSync(path.join(outDir, "ai-co-evolution-library-markdown.zip"), zipSync(zipFiles));

/* ---------- 2. The EPUB ---------- */
/* Element ids become short, safe ones (s1, s2...) and every link is pointed at them */
const idMaps = new Map();
const bodies = new Map();
for (const d of docs) {
  const body = bodyOf(d.id);
  const map = new Map();
  let n = 0;
  body.querySelectorAll("[id]").forEach((el) => {
    const old = el.getAttribute("id");
    const fresh = "s" + (++n);
    map.set(old.replace(/^doc-/, ""), fresh);
    el.setAttribute("id", fresh);
  });
  idMaps.set(d.id, map);
  bodies.set(d.id, body);
}
const xmlSerialize = (node) => new (node.ownerDocument.defaultView.XMLSerializer)().serializeToString(node);
function epubBody(d) {
  const body = bodies.get(d.id);
  body.querySelectorAll(".sr-only").forEach((n) => n.remove());
  body.querySelectorAll('a[href^="#library/"]').forEach((a) => {
    const [, id, slug] = /^#library\/([^/]+)(?:\/(.+))?$/.exec(a.getAttribute("href")) || [];
    if (!byId.has(id)) { a.replaceWith(...a.childNodes); return; }
    const frag = slug && idMaps.get(id).get(slug);
    a.setAttribute("href", `${id}.xhtml${frag ? "#" + frag : ""}`);
  });
  body.querySelectorAll("a[target], a[rel]").forEach((a) => { a.removeAttribute("target"); a.removeAttribute("rel"); });
  // Task-list checkboxes become symbols; e-books aren't forms
  body.querySelectorAll('input[type="checkbox"]').forEach((c) => c.replaceWith(body.ownerDocument.createTextNode(c.hasAttribute("checked") ? "☑ " : "☐ ")));
  body.querySelectorAll("[data-slug]").forEach((el) => el.removeAttribute("data-slug"));
  // Fold-out sections start open: some e-readers can't open them
  body.querySelectorAll("details").forEach((el) => el.setAttribute("open", "open"));
  const section = body.ownerDocument.createElement("section");
  section.setAttribute("aria-label", d.title);
  section.append(...body.childNodes);
  return xmlSerialize(section);
}
const xhtml = (title, inner, css = "style.css", extraHead = "") => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="${css}"/>${extraHead}
</head>
<body>
${inner}
</body>
</html>
`;
const EPUB_CSS = `/* Simple, readable defaults; e-readers let people change type and colours */
body { line-height: 1.55; margin: 0 4%; }
h1, h2, h3, h4 { line-height: 1.25; page-break-after: avoid; break-after: avoid; }
h1 { font-size: 1.6em; } h2 { font-size: 1.3em; margin-top: 1.6em; } h3 { font-size: 1.1em; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9em; }
th, td { border: 1px solid #999; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }
pre { white-space: pre-wrap; font-size: 0.85em; padding: 0.6em; border: 1px solid #ccc; }
blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid #17656c; }
.doc-alert-label { font-weight: bold; }
.title-page { text-align: center; margin-top: 2em; }
.title-page img { max-width: 60%; height: auto; }
.subtitle { font-style: italic; }
nav ol { list-style: none; padding-left: 1em; }
`;
const uuid = (() => {
  const h = crypto.createHash("sha256").update(docs.map((d) => d.id + d.hash).join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
})();
const cover = fs.readFileSync(path.join(here, "assets", "epub-cover.jpg"));
const epub = {
  mimetype: [strToU8("application/epub+zip"), { level: 0, mtime: MTIME }],   // must come first, uncompressed
  "META-INF/container.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`),
  "OEBPS/style.css": strToU8(EPUB_CSS),
  "OEBPS/images/cover.jpg": cover,
  "OEBPS/title.xhtml": strToU8(xhtml("AI Co-Evolution in Education", `<section class="title-page" epub:type="titlepage" aria-label="Title page">
<img src="images/cover.jpg" alt="A golden leaf in a beam of light on deep green, the toolkit's emblem"/>
<h1>AI Co-Evolution in Education</h1>
<p class="subtitle">The library: ${docs.length} guides, lesson plans and templates</p>
<p>Planetary Restoration Archive · version ${VERSION} · ${DATE}</p>
</section>`)),
  "OEBPS/about.xhtml": strToU8(xhtml("About this library", `<section aria-label="About this library">
<h1>About this library</h1>
<p>Not to replace teachers, but to walk beside them. These documents come from the project repository of AI Co-Evolution in Education, an open toolkit for teaching with AI while protecting student voice, wellbeing and privacy.</p>
<p>${esc(PROVENANCE)} Some documents mention community channels such as a Discord server, office hours or a newsletter; these may not be running yet.</p>
<h2>Safeguards</h2>
<ul>
<li>For children under 13, AI use stays teacher-led: the teacher runs the tool while students ask, question and decide.</li>
<li>Never enter students' names or personal details into an AI tool.</li>
<li>Every AI activity needs a way to take part without AI.</li>
</ul>
<h2>License</h2>
<p>${esc(LICENSE_LINE)} You can use, adapt and share these documents; keep adaptations open under the same license and credit the Planetary Restoration Archive.</p>
</section>`)),
  "OEBPS/nav.xhtml": strToU8(xhtml("Contents", `<nav epub:type="toc" id="toc" aria-label="Contents">
<h1>Contents</h1>
<ol>
<li><a href="about.xhtml">About this library</a></li>
${groups.map((g) => `<li><span>${esc(g)}</span>
<ol>
${docs.filter((d) => d.group === g).map((d) => `<li><a href="docs/${d.id}.xhtml">${esc(d.title)}</a></li>`).join("\n")}
</ol></li>`).join("\n")}
</ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="hidden" aria-label="Landmarks">
<ol>
<li><a epub:type="toc" href="nav.xhtml#toc">Contents</a></li>
<li><a epub:type="bodymatter" href="about.xhtml">Start reading</a></li>
</ol>
</nav>`))
};
for (const d of docs) epub[`OEBPS/docs/${d.id}.xhtml`] = strToU8(xhtml(d.title, epubBody(d), "../style.css"));
const manifest = [
  `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
  `<item id="css" href="style.css" media-type="text/css"/>`,
  `<item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`,
  `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
  `<item id="about" href="about.xhtml" media-type="application/xhtml+xml"/>`,
  ...docs.map((d) => `<item id="d-${d.id}" href="docs/${d.id}.xhtml" media-type="application/xhtml+xml"/>`)
];
const spine = ["title", "nav", "about", ...docs.map((d) => "d-" + d.id)].map((id) => `<itemref idref="${id}"/>`);
epub["OEBPS/content.opf"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>AI Co-Evolution in Education: the library</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Planetary Restoration Archive</dc:creator>
    <dc:publisher>Planetary Restoration Archive</dc:publisher>
    <dc:date>${DATE}</dc:date>
    <dc:rights>${esc(LICENSE_LINE)}</dc:rights>
    <dc:description>Guides, lesson plans and templates for teaching with AI while protecting student voice, wellbeing and privacy.</dc:description>
    <dc:subject>Education</dc:subject>
    <dc:subject>Artificial intelligence</dc:subject>
    <meta property="dcterms:modified">${DATE}T00:00:00Z</meta>
    <meta property="schema:accessMode">textual</meta>
    <meta property="schema:accessModeSufficient">textual</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">readingOrder</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">alternativeText</meta>
    <meta property="schema:accessibilityHazard">none</meta>
    <meta property="schema:accessibilitySummary">Text with headings, lists and tables, a table of contents, and a described cover image. No flashing, sound or motion.</meta>
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine>
    ${spine.join("\n    ")}
  </spine>
</package>
`);
const epubFiles = {};
for (const [name, value] of Object.entries(epub)) epubFiles[name] = Array.isArray(value) ? value : [value, { level: 9, mtime: MTIME }];
fs.writeFileSync(path.join(outDir, "ai-co-evolution-library.epub"), zipSync(epubFiles));

/* ---------- 3. Kolibri: the single file as an HTML5 app (index.html at the root of a zip) ----------
   The one change: data-host="kolibri" on <html>, so the page shows outside links' addresses
   (Kolibri apps can't open other sites) and a note about Kolibri keeping saved data. */
const single = fs.readFileSync(path.join(outDir, "ai-co-evolution-in-education.html"), "utf8");
if (!single.includes('data-build="standalone"')) throw new Error("The single-file edition is missing or out of date. Run: node tools/build-standalone.mjs");
const kolibri = single.replace('data-build="standalone"', 'data-build="standalone" data-host="kolibri"');
fs.writeFileSync(path.join(outDir, "ai-co-evolution-kolibri.zip"), zipSync({ "index.html": [strToU8(kolibri), { level: 9, mtime: MTIME }] }));

/* ---------- 4. Community files for GitHub, from the library's own versions ---------- */
function community(id, file, intro) {
  const d = byId.get(id);
  if (!d) return;
  const body = relinkForMarkdown(bodyOf(id), (other, slug) => (other === id && slug ? "#" + slug : null));
  const note = `<!-- Generated by tools/build-downloads.mjs from the library document "${d.title}" (${d.source}). Edit it there, then rebuild. -->\n\n`;
  fs.writeFileSync(path.join(repo, file), note + intro + markdown(body) + footer(d));
}
community("code-of-conduct", "CODE_OF_CONDUCT.md", "");
community("contributing", "CONTRIBUTING.md", "> For this app's repository: use the issue forms for lessons, classroom stories and problems, and run `npm test` in `tools/` before opening a pull request (see `tools/tests/README.md`).\n\n");

const kb = (f) => (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(0) + " KB";
console.log(`Downloads: library-markdown.zip ${kb("ai-co-evolution-library-markdown.zip")}, library.epub ${kb("ai-co-evolution-library.epub")}, kolibri.zip ${kb("ai-co-evolution-kolibri.zip")}; CODE_OF_CONDUCT.md and CONTRIBUTING.md updated.`);
