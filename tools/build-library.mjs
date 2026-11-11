#!/usr/bin/env node
/* =========================================================================
   build-library.mjs: turns the education repository's Markdown into the
   app's offline library.

   Usage (from this tools/ folder, after `npm ci`):
     node build-library.mjs <path-to-education-repo> <output-library-folder>
   Example:
     node build-library.mjs ../../education ../library

   What it does, in order, for every document listed in CATALOG:
     1. Privacy: removes email addresses, phone numbers, and mailto:/tel: links.
        (Project rule: never publish personal contact details.) Public crisis
        helplines are kept, and outdated helpline details are updated.
     2. Dead links: removes links to retired or placeholder addresses (old GitHub
        accounts, placeholder Discord/Calendly/newsletter links), keeping the words.
     3. Removes the duplicated license-enforcement sections (the LICENSE file
        is the legal text; the app shows a calm summary instead).
     4. Removes external badge images (the app makes no third-party requests).
     5. Converts GitHub alert blocks (> [!NOTE]) into labeled quotes and
        Mermaid timelines into readable lists.
     6. Renders Markdown with marked, then cleans the HTML with DOMPurify.
     7. Writes: docs/<id>.html (one per document), index.json (the catalog)
        and search.json (sections of plain text for full-text search).

   To add a document: add one line to CATALOG below and run the script again.
   Then publish; the deploy workflow gives the service worker a new version
   automatically, so installed apps pick up the change.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Marked } from "marked";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/* ---------- A name this file has to find, but must never spell ----------
   One retired username has to be removed from the documents. Writing it here would publish it
   all over again, so it's kept as a fingerprint (the SHA-256 of the lowercase name): the build
   recognizes the name without this file containing it. To retire another name, run
     node tools/build-library.mjs --fingerprint "the name"
   and add the line it prints to RETIRED_NAMES. (Phone numbers aren't kept this way: a
   fingerprint of a phone number is easy to guess back. Every phone number that isn't a public
   helpline is refused instead; see PHONE_LIKE.) */
const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");
const RETIRED_NAMES = [
  { length: 14, hash: "6c888989c68a4e36434fb33e7e316fa3af33ca567034dc8f43a6ee700360fc2d" }
];
if (process.argv[2] === "--fingerprint") {
  const name = String(process.argv[3] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!name) { console.error('Usage: node build-library.mjs --fingerprint "the name" (letters and digits only)'); process.exit(1); }
  console.log(`{ length: ${name.length}, hash: "${sha256(name)}" }`);
  process.exit(0);
}
/* Every place a retired name appears in `text`, even inside a longer run of letters and digits */
function findRetired(text) {
  const found = [];
  for (const run of String(text).matchAll(/[A-Za-z0-9]+/g)) {
    const word = run[0].toLowerCase();
    for (const name of RETIRED_NAMES) {
      for (let i = 0; i + name.length <= word.length; i++) {
        if (sha256(word.slice(i, i + name.length)) === name.hash) { found.push({ index: run.index + i, length: name.length }); i += name.length - 1; }
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}
const hasRetired = (text) => findRetired(text).length > 0;
function replaceRetired(text, replacement) {
  const found = findRetired(text);
  if (!found.length) return text;
  let out = "", at = 0;
  for (const f of found) { out += text.slice(at, f.index) + replacement; at = f.index + f.length; }
  return out + text.slice(at);
}

const [, , repoArg, outArg] = process.argv;
if (!repoArg || !outArg) {
  console.error("Usage: node build-library.mjs <path-to-education-repo> <output-library-folder>");
  process.exit(1);
}
const REPO = path.resolve(repoArg);
const OUT = path.resolve(outArg);

/* ---------- The catalog: what goes in the library, grouped for readers ----------
   id: short name used in links (#library/<id>)   title: plain-language title */
const CATALOG = [
  { group: "Start here", id: "welcome-ritual", title: "The welcome ritual", src: "00-welcome-ritual.md" },
  { group: "Start here", id: "onboarding", title: "Teacher onboarding guide", src: "teacher-resources/onboarding-guide2.md" },
  { group: "Lessons and classroom tools", id: "starter-pack", title: "Starter pack: three foundation lessons and the manifesto unit", src: "classroom-tools/lesson-plans/starter-pack.md" },
  { group: "Lessons and classroom tools", id: "more-starter-lessons", title: "More starter lessons for K–12", src: "classroom-tools/lesson-plans/starter-pack2.md" },
  { group: "Lessons and classroom tools", id: "class-ai-agreement", title: "Class AI agreement templates", src: "templates/class-ai-agreement.md" },
  { group: "Lessons and classroom tools", id: "assessment-rubrics", title: "Assessment rubrics", src: "classroom-tools/assessment-rubrics/readme.md" },
  { group: "Lessons and classroom tools", id: "reflection-prompts", title: "Reflection prompts", src: "classroom-tools/reflection-prompts/readme.md" },
  { group: "Teacher resources", id: "ethical-framework", title: "Ethical framework and the SACRED check", src: "teacher-resources/ethical-framework.md" },
  { group: "Teacher resources", id: "conversation-starters", title: "Conversation starters", src: "teacher-resources/conversation-starters.md" },
  { group: "Teacher resources", id: "troubleshooting-guide", title: "Troubleshooting guide", src: "teacher-resources/troubleshooting-guide.md" },
  { group: "Teacher resources", id: "impact-tracker", title: "Impact tracker log", src: "reflection-journals/impact-tracker.md" },
  { group: "Project templates", id: "project-templates", title: "Project templates overview", src: "classroom-tools/project-templates/README.md" },
  { group: "Project templates", id: "project-getting-started", title: "Getting started with project templates", src: "classroom-tools/project-templates/getting-started-guide.md" },
  { group: "Project templates", id: "ai-collaboration", title: "AI collaboration best practices", src: "classroom-tools/project-templates/ai-collaboration-best-practices.md" },
  { group: "Project templates", id: "assessment-philosophy", title: "Assessment philosophy", src: "classroom-tools/project-templates/assessment-philosophy.md" },
  { group: "Project templates", id: "community-partnerships", title: "Community partnership guide", src: "classroom-tools/project-templates/community-partnership-guide.mc" },
  { group: "Project templates", id: "project-troubleshooting", title: "Troubleshooting projects", src: "classroom-tools/project-templates/troubleshooting.md" },
  { group: "Local ecosystem study", id: "ecosystem-study", title: "Local ecosystem study: overview", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/README.md" },
  { group: "Local ecosystem study", id: "ecosystem-teacher-guide", title: "Teacher guide", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/teacher-guide.md" },
  { group: "Local ecosystem study", id: "ecosystem-student-guide", title: "Student starter guide", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/student-starter-guide.md" },
  { group: "Local ecosystem study", id: "ecosystem-ai-prompts", title: "AI collaboration prompts", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/ai-collaboration-prompts.md" },
  { group: "Local ecosystem study", id: "data-collection-sheets", title: "Data collection sheets", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/resources/data-collection-sheets.md" },
  { group: "Local ecosystem study", id: "ecosystem-mapping", title: "Ecosystem mapping guide", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/resources/ecosystem-mapping-guide.md" },
  { group: "Local ecosystem study", id: "expert-interviews", title: "Expert interview questions", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/resources/expert-interview-questions.md" },
  { group: "Local ecosystem study", id: "citizen-science-platforms", title: "Citizen science platform directory", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/resources/platform-connection-directory.md" },
  { group: "Local ecosystem study", id: "research-templates", title: "Research templates", src: "classroom-tools/project-templates/systems-thinking-projects/local-ecosystem-study/resources/research-templates.md" },
  { group: "School leaders", id: "implementation-roadmap", title: "Implementation roadmap for schools", src: "institutional/implementation-roadmap.md" },
  { group: "Community", id: "contributing", title: "Contributing guide", src: "CONTRIBUTING.md" },
  { group: "Community", id: "code-of-conduct", title: "Code of conduct", src: "CODE_OF_CONDUCT.md" }
];

/* Links to these places are removed (the words stay): retired accounts,
   placeholders, share buttons and sites that no longer exist. */
const UNLINK = [
  { test: (t) => /github\.com\/planetaryrestorationarchive\b/i.test(t) || (/github\.com\//i.test(t) && hasRetired(t)) },   // the retired organization and username
  /github\.complanetaryrestorationarchive/i,
  /(^|\.)discord\.(gg|com)$/i, /(^|\.)calendly\.com$/i, /(^|\.)substack\.com$/i,
  /(^|\.)twitter\.com$/i, /(^|\.)x\.com$/i, /(^|\.)forms\.gle$/i, /(^|\.)forms\.google\.com$/i,
  /(^|\.)instructure\.com$/i, /(^|\.)placeholder\.com$/i, /(^|\.)flipgrid\.com$/i,
  /earthchallenge2020\.earthday\.org/i, /(^|\.)zoom\.us$/i, /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i, /(^|\.)planetaryrestorationarchive\.org$/i,
  /(^|\.)planetaryrestoration\.org$/i, /^docs\.planetaryrestorationarchive\.com$/i,
  /^newsletter\./i, /localhost/i, /example\.(com|org)$/i, /star-history\.com$/i, /contrib\.rocks$/i,
  // Checked November 2026: this domain now shows unrelated gambling spam (the organization's data portal is elsewhere)
  /(^|\.)environmentaldatainitiative\.org$/i,
  // Checked November 2026: this page no longer exists
  /ai-4-all\.org\/open-source/i
];
/* Links whose page couldn't be confirmed, pointed at a confirmed page with the same purpose. */
const RETARGET = new Map([
  // UNESCO's document server couldn't be checked; its "AI in education" page links to the current guidance
  ["https://unesdoc.unesco.org/ark:/48223/pf0000377376", "https://www.unesco.org/en/digital-education/artificial-intelligence"]
]);
/* The project's own site is linked only at its front page (deeper pages aren't confirmed). */
const SITE = "planetaryrestorationarchive.com";

/* Sections that repeat the license-enforcement text; dropped from the library. */
const DROP_SECTIONS = new Set([
  "license and anticommercialization protection framework",
  "comprehensive intellectual property protection",
  "commercial use prohibition and legal consequences",
  "ethical use requirements and community protection",
  "active monitoring and violation detection",
  "enforcement commitment and community support",
  "reporting violations and community engagement",
  "international protection and crossborder enforcement",
  "community benefits and resource recovery"
]);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const PHONE = /(?:\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\+?1[\s.-]\d{3}[\s.-]\d{3}[\s.-]\d{4}/g;

/* Public crisis helplines are NOT personal contact details: they must always stay.
   Only these exact numbers survive the phone-number scrub (digits only). Keep this
   list in step with HELPLINES in tools/check-site.mjs. Checked November 2026 on each
   service's own website. */
const HELPLINES = new Set([
  "18664887386",   // The Trevor Project (US): 1-866-488-7386
  "8775658860",    // Trans Lifeline (US): 877-565-8860
  "8773306366",    // Trans Lifeline (Canada): 877-330-6366
  "18006564673",   // RAINN National Sexual Assault Hotline (US): 800-656-4673
  "8006564673"
]);
const digits = (s) => s.replace(/\D/g, "");
const isHelpline = (s) => HELPLINES.has(digits(s)) || HELPLINES.has("1" + digits(s));
/* Crisis details that changed after the documents were written, updated so nobody
   in distress is sent to an old name or number. Each one is counted in the report,
   and the app tells readers that helpline details were updated. */
const HELPLINE_UPDATES = [
  [/National Suicide Prevention Lifeline:\s*988/, "988 Suicide & Crisis Lifeline (US): call or text 988"],
  [/Talk Suicide Canada:\s*1-833-456-4566/, "9-8-8 Suicide Crisis Helpline (Canada): call or text 9-8-8"],
  [/Trans Lifeline:\s*877-565-8860(?![^\n]*Canada)/, "Trans Lifeline: 877-565-8860 (US) or 877-330-6366 (Canada)"]
];
let helplineUpdates = 0;
const ALERT_LABELS = { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution", DANGER: "Danger", SUCCESS: "Success" };

const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const normTitle = (s) => plain(s).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/* GitHub-style heading slugs, so in-document links like (#-purpose) keep working */
function makeSlugger() {
  const seen = new Map();
  return (text) => {
    let base = plain(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    let slug = base, n = seen.get(base) || 0;
    if (n) slug = base + "-" + n;
    seen.set(base, n + 1);
    return slug;
  };
}

/* ---------- Markdown clean-up before rendering ---------- */
/* Code fences. An opening fence may follow a list marker ("1. ```" or "- ```"),
   use backticks or tildes, and carry a language word. A closing fence uses the
   same character, at least as many, and nothing else on the line. Getting this
   exactly right matters: a missed opener flips "inside code" and "outside code"
   for the rest of the file. */
const FENCE_OPEN = /^(\s*(?:(?:[-*+]|\d{1,9}[.)])\s+)?)(`{3,}|~{3,})\s*([\w+#.-]*)(.*)$/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const isClose = (line, fence) => {
  const m = FENCE_CLOSE.exec(line);
  return !!m && m[1][0] === fence.marker[0] && m[1].length >= fence.marker.length;
};

/* Retired repository addresses inside code (e.g. `git clone ...`) become a
   placeholder the reader fills in with their own fork. */
const REPO_ADDRESS = /(?:https?:\/\/)?github\.com\/([\w-]+)\/([\w.-]+)/gi;
const retireRepos = (text) => text.replace(REPO_ADDRESS, (all, account, repo) =>
  (account.toLowerCase() === "planetaryrestorationarchive" || hasRetired(account) ? `github.com/<your-account>/${repo}` : all));

function preprocess(md) {
  md = md.replace(/\r\n?/g, "\n");
  const out = [];
  let fence = null, dropping = false;
  for (const line of md.split("\n")) {
    if (fence) {
      if (isClose(line, fence)) { if (!dropping) out.push(...renderFence(fence, line)); fence = null; }
      else fence.buf.push(line);
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    // A backtick fence's info text can't contain backticks (that would be inline code instead)
    if (open && !(open[2][0] === "`" && open[4].includes("`"))) {
      fence = { opener: line, marker: open[2], lang: open[3].toLowerCase(), buf: [] };
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      if (/^#\s+[\w./-]+\.mc?d?\s*$/.test(line)) continue;           // stray file-path headings
      if (DROP_SECTIONS.has(normTitle(h[2]))) { dropping = true; continue; }
      if (dropping) dropping = false;
    }
    if (dropping) continue;
    if (/^\s*\*\*This educational platform is permanently protected/.test(line)) continue;
    if (/^\s*\*For complete licensing terms, see the LICENSE/.test(line)) continue;
    let fixed = line;
    for (const [re, to] of HELPLINE_UPDATES) if (re.test(fixed)) { fixed = fixed.replace(re, to); helplineUpdates++; }
    out.push(cleanLine(fixed));
  }
  if (fence && !dropping) out.push(...renderFence(fence, null));     // unclosed fence at end of file
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

/* Code blocks keep their exact layout (opener and closer lines are reused as
   written, so list-item code blocks stay inside their list item); only the
   privacy scrub touches the contents. */
function renderFence(fence, closer) {
  if (fence.lang === "mermaid" && /^\s*gantt/.test(fence.buf.join("\n"))) return ganttToList(fence.buf);
  return [fence.opener, ...fence.buf.map(scrubCode), closer ?? fence.marker];
}

function scrubCode(l) {
  const cleaned = l
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)|!\[[^\]]*\]\([^)]*\)/g, "")   // badges pasted into code
    .replace(/(?:mailto|tel):[^\s)"'>]+/gi, "[contact removed]")
    .replace(EMAIL, "[address removed]")
    .replace(PHONE, (m) => (isHelpline(m) ? m : ""));
  return replaceRetired(retireRepos(cleaned), "<your-account>");
}

/* A Mermaid Gantt chart, turned into a readable list */
function ganttToList(buf) {
  const out = [];
  for (const raw of buf) {
    const l = raw.trim();
    if (!l || l === "gantt" || l.startsWith("dateFormat") || l.startsWith("axisFormat")) continue;
    if (l.startsWith("title ")) { out.push("", "**" + l.slice(6).trim() + "**", ""); continue; }
    if (l.startsWith("section ")) { out.push("", "*" + l.slice(8).trim() + "*", ""); continue; }
    const m = /^(.+?)\s*:\s*(.+)$/.exec(l);
    if (!m) continue;
    const parts = m[2].split(",").map((s) => s.trim());
    const milestone = parts.includes("milestone");
    const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
    const dur = parts.find((p) => /^\d+d$/.test(p));
    let text = "- " + m[1].trim();
    if (date) text += milestone ? ": target " + date : ": from " + date;
    if (dur && dur !== "0d") text += ", about " + dur.replace("d", "") + " days";
    out.push(text);
  }
  out.push("");
  return out;
}

/* A Markdown link target that may itself contain one level of parentheses, e.g. (https://x/Phone-(587)-...) */
const TARGET = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const LINKED_IMAGE = new RegExp(String.raw`\[!\[[^\]]*\]` + TARGET + String.raw`\]` + TARGET, "g");
const IMAGE = new RegExp(String.raw`!\[[^\]]*\]` + TARGET, "g");
const CONTACT_LINK = new RegExp(String.raw`\[([^\]]*)\]\((?:mailto|tel):(?:[^()]|\([^()]*\))*\)`, "gi");

/* What's left of a line that only gave contact details: list marks, emoji and words like "Email:" */
const CONTACT_LABEL = /[*_`>#|\-:•·📧📞☎️✉️🆘\s]|(e-?mail|phone|call|contact|questions?|support)\b/gi;
function cleanLine(line) {
  let s = line;
  // Header metadata naming retired repositories or file paths: dropped
  if (/^\s*\*\*(Repository|Path|Folder|Part of):\*\*/i.test(s)) return "";
  // GitHub alerts become labeled quotes: the label is its own paragraph (the app styles these as callouts)
  s = s.replace(/^(\s*>\s*)\[!(\w+)\]\s*$/, (_, q, k) => q + "**" + (ALERT_LABELS[k.toUpperCase()] || k) + "**\n" + q.trimEnd());
  // linked images and images (badges): removed
  s = s.replace(LINKED_IMAGE, "").replace(IMAGE, "").replace(/<img\b[^>]*>/gi, "");
  // mailto: and tel: links keep their words (unless the words are themselves contact details)
  const linked = s;
  s = s.replace(CONTACT_LINK, (_, t) => (/@/.test(t) || /\d{3}.?\d{4}/.test(t) ? "" : t));
  // ...and a line left with only its label ("📧 Email:") is dropped, so nothing looks broken
  if (s !== linked && !s.replace(CONTACT_LABEL, "").trim()) return "";
  const personalPhone = (s.match(PHONE) || []).some((m) => !isHelpline(m));
  const hasContact = new RegExp(EMAIL.source).test(s) || personalPhone;
  if (hasContact) {
    // A line that only exists to give an address or number is dropped entirely
    const stripped = s.replace(EMAIL, "").replace(PHONE, (m) => (isHelpline(m) ? m : "")).replace(CONTACT_LABEL, "");
    if (!stripped.trim()) return "";
    s = s.replace(EMAIL, "the project team (see the project website)").replace(PHONE, (m) => (isHelpline(m) ? m : ""));
  }
  return s.replace(/[ \t]+$/g, "");
}

/* ---------- Rendering ---------- */
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const PURIFY = {
  FORBID_TAGS: ["style", "form", "script", "iframe", "object", "embed", "img", "video", "audio"],
  FORBID_ATTR: ["style", "align", "width", "height", "bgcolor"],
  ADD_ATTR: ["target"]
};
const byPath = new Map(CATALOG.map((d) => [path.posix.normalize(d.src).toLowerCase(), d.id]));
const keptLinks = new Map();
const removedLinks = new Map();

const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

function resolveHref(href, doc, slugFor) {
  if (!href) return null;
  if (/^(mailto|tel|javascript|data|vbscript):/i.test(href)) return null;
  if (href.startsWith("#")) return "#library/" + doc.id + "/" + slugFor(decode(href.slice(1)));
  if (/^https?:\/\//i.test(href)) {
    if (RETARGET.has(href.replace(/\/$/, ""))) href = RETARGET.get(href.replace(/\/$/, ""));
    let u;
    try { u = new URL(href); } catch { return null; }
    const host = u.hostname.toLowerCase();
    if (UNLINK.some((r) => r.test(host) || r.test(host + u.pathname))) { removedLinks.set(href, (removedLinks.get(href) || 0) + 1); return null; }
    if (host.replace(/^www\./, "") === SITE) return "https://" + SITE;
    keptLinks.set(href, (keptLinks.get(href) || 0) + 1);
    return href;
  }
  // Relative link to another file in the repository
  const [file, anchor] = href.split("#");
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(doc.src), decodeURIComponent(file))).toLowerCase();
  const id = byPath.get(target);
  if (!id) return null;
  return "#library/" + id + (anchor ? "/" + decode(anchor).toLowerCase() : "");
}

function render(doc, md) {
  const slug = makeSlugger();
  const headingSlugs = [];
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const s = slug(inner);
        headingSlugs.push({ depth, text: plain(inner).trim(), slug: s });
        return `<h${depth} id="doc-${s}" data-slug="${s}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const target = resolveHref(href, doc, (a) => a.toLowerCase());
        if (!target) return text;
        const ext = /^https?:/i.test(target);
        const t = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
        return `<a href="${target}"${t}${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
      }
    }
  });
  let htmlOut = marked.parse(md);
  htmlOut = DOMPurify.sanitize(htmlOut, PURIFY);
  // Post-process: tables scroll on small screens; raw HTML links get the same treatment as Markdown links
  const dom = new JSDOM(`<body>${htmlOut}</body>`);
  const d = dom.window.document;
  d.querySelectorAll("table").forEach((t) => {
    const w = d.createElement("div");
    w.className = "table-wrap";
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
    t.classList.add("table");
  });
  d.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href.startsWith("#library/")) return;
    const target = resolveHref(href, doc, (x) => x.toLowerCase());
    if (!target) { a.replaceWith(...a.childNodes); return; }
    a.setAttribute("href", target);
    if (/^https?:/i.test(target)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      // Screen readers hear that the link leaves the app
      const note = d.createElement("span");
      note.className = "sr-only";
      note.textContent = " (opens in a new tab)";
      a.appendChild(note);
    }
  });
  // The retired GitHub username, where it appears as words, becomes the steward's name.
  // (Done here, after links are resolved, so it never changes a web address.)
  const walker = d.createTreeWalker(d.body, 4 /* text */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (hasRetired(n.nodeValue)) n.nodeValue = replaceRetired(n.nodeValue, "Foster + Navi");
  }
  // Empty paragraphs and list items left behind by removed badges
  d.querySelectorAll("p, li, div").forEach((n) => { if (!n.textContent.trim() && !n.querySelector("input, table, hr, code")) n.remove(); });
  // Divider lines left side by side (where removed badges used to sit) become one
  d.querySelectorAll("hr").forEach((hr) => {
    const prev = hr.previousElementSibling;
    if (!prev || prev.tagName === "HR" || /^H1$/.test(prev.tagName) && hr.nextElementSibling && hr.nextElementSibling.tagName === "HR") hr.remove();
  });
  // Quotes that began as GitHub alerts get a class, so the app can show them as callouts
  const labels = new Set(Object.values(ALERT_LABELS));
  d.querySelectorAll("blockquote").forEach((q) => {
    const first = q.firstElementChild;
    if (first && first.tagName === "P" && first.children.length === 1 && first.firstElementChild.tagName === "STRONG" && labels.has(first.textContent.trim())) {
      q.className = "doc-alert";
      q.setAttribute("data-kind", first.textContent.trim().toLowerCase());
      first.className = "doc-alert-label";
    }
  });
  d.querySelectorAll('input[type="checkbox"]').forEach((c) => c.setAttribute("aria-label", "Task (read-only)"));
  return { html: d.body.innerHTML, d, headingSlugs };
}

/* Split a rendered document into sections at h2/h3 for full-text search */
function chunk(doc, d) {
  const chunks = [];
  let cur = { heading: doc.title, slug: "", text: [] };
  const push = () => {
    const text = cur.text.join(" ").replace(/\s+/g, " ").trim();
    if (text) chunks.push({ id: doc.id + (cur.slug ? "#" + cur.slug : ""), doc: doc.id, title: doc.title, heading: cur.heading, slug: cur.slug, text: text.slice(0, 4000) });
  };
  for (const node of d.body.children) {
    if (/^H[23]$/.test(node.tagName)) {
      push();
      cur = { heading: node.textContent.replace(/\s+/g, " ").trim(), slug: node.getAttribute("data-slug") || "", text: [] };
    } else if (!/^H1$/.test(node.tagName)) {
      cur.text.push(node.textContent);
    }
  }
  push();
  return chunks;
}

/* ---------- Build ---------- */
/* Pass 1: render every document. Pass 2 checks links between documents, so a
   link to a section that doesn't exist opens the document at the top instead
   of going nowhere. Then everything is written out. */
const built = [];
for (const doc of CATALOG) {
  const file = path.join(REPO, doc.src);
  if (!fs.existsSync(file)) { console.warn("Missing, skipped:", doc.src); continue; }
  const md = preprocess(fs.readFileSync(file, "utf8"));
  built.push({ doc, ...render(doc, md) });
}
const slugsById = new Map(built.map((b) => [b.doc.id, new Set(b.headingSlugs.map((h) => h.slug))]));
let anchorsRetargeted = 0, anchorsUnlinked = 0;
for (const b of built) {
  b.d.querySelectorAll('a[href^="#library/"]').forEach((a) => {
    const m = /^#library\/([^/]+)(?:\/(.+))?$/.exec(a.getAttribute("href")) || [];
    const [, id, slug] = m;
    if (!id || !slugsById.has(id)) { a.replaceWith(...a.childNodes); anchorsUnlinked++; return; }
    if (slug && !slugsById.get(id).has(slug)) { a.setAttribute("href", "#library/" + id); anchorsRetargeted++; }
  });
}

/* A short content fingerprint: the app asks for docs/<id>.html?v=<hash>, so an
   installed app fetches a document again only when its text really changed. */
const fingerprint = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);

fs.rmSync(path.join(OUT, "docs"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "docs"), { recursive: true });
const index = [];
const search = [];
for (const { doc, d, headingSlugs } of built) {
  const html = d.body.innerHTML;
  fs.writeFileSync(path.join(OUT, "docs", doc.id + ".html"), html);
  // Word counts and search text leave out screen-reader-only notes
  d.querySelectorAll(".sr-only").forEach((n) => n.remove());
  const text = d.body.textContent.replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  const firstP = [...d.querySelectorAll("p")].map((p) => p.textContent.replace(/\s+/g, " ").trim()).find((t) => t.length > 60 && !/^(Path|Repository|Stewarded|License|Version)/i.test(t)) || "";
  index.push({
    id: doc.id, title: doc.title, group: doc.group, source: doc.src,
    words, minutes: Math.max(1, Math.round(words / 220)),
    // Shortened by whole characters, so an emoji is never cut in half
    summary: [...firstP].length > 220 ? [...firstP].slice(0, 217).join("").replace(/\s+\S*$/, "") + "…" : firstP,
    sections: headingSlugs.filter((h) => h.depth === 2).length,
    hash: fingerprint(html), bytes: Buffer.byteLength(html)
  });
  search.push(...chunk(doc, d));
}
const searchJson = JSON.stringify(search);
/* The library's date moves only when its content does, so rebuilding unchanged documents gives
   exactly the same files (and the same e-book and zip downloads made from them). */
let generated = new Date().toISOString().slice(0, 10);
try {
  const before = JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8"));
  if (before.searchHash === fingerprint(searchJson) && JSON.stringify(before.documents) === JSON.stringify(index) && /^\d{4}-\d{2}-\d{2}$/.test(before.generated)) generated = before.generated;
} catch (e) { /* the first build: today's date */ }
fs.writeFileSync(path.join(OUT, "search.json"), searchJson);
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({
  generated,
  searchHash: fingerprint(searchJson), searchBytes: Buffer.byteLength(searchJson),
  documents: index
}, null, 1));

/* ---------- Privacy check: the build fails if anything personal slipped through ----------
   This is the safety net behind steps 1-4. If it ever fails, add a rule above
   rather than loosening this list. The project's general address is allowed only
   as the bare website name (no email form of it). */
/* Anything shaped like a North American phone number, with or without separators */
const PHONE_LIKE = /(?<![\w.-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\w-])/g;
const LEAKS = [
  [EMAIL, "an email address"],
  [{ test: (t) => (t.match(PHONE_LIKE) || []).some((m) => !isHelpline(m)) }, "a phone number that isn't a listed public helpline"],
  [/\b(?:mailto|tel):/i, "a mailto:/tel: link"],
  [/shields\.io|img\.shields/i, "a third-party badge image"],
  [{ test: hasRetired }, "a retired username"],
  [/github\.com\/planetaryrestorationarchive/i, "the retired GitHub organization"],
  [/<(?:script|iframe|img|style)\b/i, "an active or tracking HTML element"]
];
const outputs = [
  ...fs.readdirSync(path.join(OUT, "docs")).map((f) => path.join(OUT, "docs", f)),
  path.join(OUT, "index.json"), path.join(OUT, "search.json")
];
const problems = [];
for (const f of outputs) {
  // Content fingerprints are random-looking letters and digits; they're left out so one made only of digits isn't mistaken for a phone number
  const text = fs.readFileSync(f, "utf8").replace(/"(hash|searchHash)": "[0-9a-f]{10}"/g, '"$1": ""');
  for (const [re, what] of LEAKS) {
    if (!(re instanceof RegExp)) { if (re.test(text)) problems.push(`${path.relative(OUT, f)}: ${what}`); continue; }
    const m = new RegExp(re.source, re.flags.replace("g", "")).exec(text);
    if (m) problems.push(`${path.relative(OUT, f)}: ${what} ("${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " ")}")`);
  }
}
if (problems.length) {
  console.error("\nPRIVACY CHECK FAILED. Nothing was published. Fix these first:\n  " + problems.join("\n  "));
  process.exit(2);
}
console.log("Privacy check passed: no emails, phone numbers, contact links, badges or retired accounts.");

/* A short report so a maintainer can review what was kept and removed */
const kb = (f) => Math.round(fs.statSync(f).size / 1024);
console.log(`Library: ${index.length} documents, ${search.length} searchable sections`);
console.log(`index.json ${kb(path.join(OUT, "index.json"))} KB, search.json ${kb(path.join(OUT, "search.json"))} KB`);
console.log(`External links kept: ${keptLinks.size} unique. Links removed: ${removedLinks.size} unique.`);
console.log(`Crisis helplines kept: ${[...HELPLINES].length} numbers protected; ${helplineUpdates} outdated helpline entr${helplineUpdates === 1 ? "y" : "ies"} updated.`);
console.log(`Links between documents: ${anchorsRetargeted} pointed at a missing section (now open the document), ${anchorsUnlinked} pointed at a missing document (now plain text).`);
if (process.env.LINK_REPORT) {
  console.log("\nKept:");
  [...keptLinks.keys()].sort().forEach((u) => console.log("  " + u));
  console.log("\nRemoved:");
  [...removedLinks.keys()].sort().forEach((u) => console.log("  " + u));
}
