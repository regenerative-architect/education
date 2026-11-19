#!/usr/bin/env python3
"""build-zim.py: writes site/download/ai-co-evolution-in-education.zim, the Kiwix package.

What it is: a ZIM file, the open format that Kiwix readers use for offline libraries such as
Wikipedia (Kiwix runs on computers, phones and tablets, and on Raspberry Pi hotspots that share
a library over local Wi-Fi). Inside:
  - index.html: the whole toolkit, as the single-file edition, marked data-host="kiwix" so the
    page shows the address of each outside link (Kiwix asks before opening the web, or can't);
  - library/: every library document as its own page, and a contents page, so Kiwix's search
    finds the words inside them;
  - licenses/: the toolkit's license and the license of every open-source part inside it.
Kiwix's full-text and title search indexes are built in by libzim (openZIM's library).

The question ladder inside (Lesson 2) can find topics in the other libraries on the same Kiwix
server, so this page alone may talk to the server it came from (connect-src 'self'; see
KIWIX_POLICY below). The ZIM format gives every build new random identifiers, so two builds of
this file are never identical byte for byte; that's expected and nothing checks for it.

Usage, from the repository root, after build-standalone.mjs and build-downloads.mjs:
  pip install libzim==4.1.0
  python3 tools/build-zim.py
To adapt: change METADATA below, or add pages to `entries` (a path, a title, a type and the
bytes); keep every link relative so it works inside any Kiwix reader.
"""
import html
import json
import pathlib
import re
import sys

try:
    from libzim.reader import Archive
    from libzim.writer import Creator, Hint, Item, StringProvider
except ImportError:
    sys.exit("build-zim.py needs python-libzim. Install it with: pip install libzim==4.1.0")

root = pathlib.Path(__file__).resolve().parent.parent
site = root / "site"
out = site / "download" / "ai-co-evolution-in-education.zim"


def read(rel):
    return (site / rel).read_bytes()


def esc(text):
    return html.escape(text, quote=True)


# The app's version and "last updated" date come from the page, as in build-sbom.mjs
page = read("index.html").decode("utf-8")
app = read("assets/app.js").decode("utf-8")
version = re.search(r'var APP_VERSION = "([\d.]+)"', app).group(1)
updated = re.search(r'"dateModified": "(\d{4}-\d{2}-\d{2})"', page).group(1)

single = read("download/ai-co-evolution-in-education.html").decode("utf-8")
if 'data-build="standalone"' not in single:
    sys.exit("The single-file edition is missing or out of date. Run: node tools/build-standalone.mjs")
main_page = single.replace('data-build="standalone"', 'data-build="standalone" data-host="kiwix"', 1)
# KIWIX_POLICY: the single file may not contact anything (connect-src 'none'). Inside a Kiwix
# server, the question ladder asks that same server for topics from its other libraries (its
# catalog, title suggestions, search and pages), so this copy may talk to the server it came
# from and nothing else. Kiwix's apps that open the file directly have no server, and the
# ladder says so.
KIWIX_POLICY = re.compile(r'(<meta http-equiv="Content-Security-Policy" content="[^"]*?)connect-src \'none\'')
policy = KIWIX_POLICY.search(main_page)   # the first one: the page's own policy, in its head
if not policy or policy.start() > main_page.index("</head>"):
    sys.exit("The single file's security policy changed; update KIWIX_POLICY in build-zim.py.")
main_page = main_page[:policy.start()] + policy.group(1) + "connect-src 'self'" + main_page[policy.end():]

index = json.loads(read("library/index.json"))
docs = index["documents"]
ids = {d["id"] for d in docs}

METADATA = {
    # Name follows openZIM's convention: {domain}_{language}_{selection}, lowercase
    "Name": "planetaryrestorationarchive.com_en_ai-co-evolution-in-education",
    "Title": "AI Co-Evolution in Education",                          # at most 30 characters
    "Description": "Bring AI into learning without losing voice, wellbeing or privacy",   # at most 80
    "LongDescription": (
        "An offline toolkit for teachers, students, families and school leaders: lessons, a class "
        "AI agreement builder, the SACRED ethics check, talking circles, a curriculum studio for "
        "units that grow reasoning, literacy and autonomy, practice of the key ideas, a plain and "
        "kind writing check, an AI Lab that shows how language models work, evidence summaries, "
        "policy guidance, and a library of 29 guides and lesson plans. No tracking, no accounts, "
        "and everything you save stays on your device."),
    "Language": "eng",
    "Creator": "Planetary Restoration Archive",
    "Publisher": "Planetary Restoration Archive",
    "Date": updated,
    "Source": "https://planetaryrestorationarchive.com",
    "License": "Code: AGPL-3.0-or-later. Text: CC BY-SA 4.0 where stated. See licenses/ inside.",
    "Tags": "education;teaching;artificial-intelligence;wellbeing;offline;_ftindex:yes;_pictures:no;_videos:no;_sw:no",
    "Flavour": "all",
    "Scraper": "build-zim.py " + version + " (python-libzim)",
}
assert len(METADATA["Title"]) <= 30 and len(METADATA["Description"]) <= 80 and len(METADATA["LongDescription"]) <= 4000

# ---------- Pages for the library documents ----------
LINK = re.compile(r'href="#library/([^"/]+)(?:/([^"]*))?"')


def relink(fragment):
    """Links between documents point at their pages here; anything else opens in the toolkit."""
    def fix(m):
        doc, slug = m.group(1), m.group(2)
        if doc in ids:
            return 'href="%s.html%s"' % (doc, "#doc-" + slug if slug else "")
        return 'href="../../index.html#library/%s%s"' % (doc, "/" + slug if slug else "")
    return LINK.sub(fix, fragment)


FOOTER = (
    '<footer class="foot">\n'
    '<p class="zero-harm"><strong>Zero Harm and Anti-Coercion.</strong> This page never pressures, tracks, ranks or '
    "manipulates you. Nothing here may be used to surveil, shame, exclude or coerce students, teachers or families. "
    "If any part of this toolkit causes harm, stop, check in with the people affected, and help us repair it.</p>\n"
    '<p>From <a href="{up}index.html">AI Co-Evolution in Education</a> ' + version + ", by the Planetary Restoration "
    'Archive. Code: AGPL-3.0-or-later; text: CC BY-SA 4.0 where stated (<a href="{up}licenses/index.html">licenses</a>).</p>\n'
    "</footer>")


def page_html(title, body, depth, head_note=""):
    up = "../" * depth
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "<title>" + esc(title) + " · AI Co-Evolution in Education</title>\n"
        '<link rel="stylesheet" href="' + up + 'assets/zim.css">\n</head>\n<body>\n'
        '<header class="top"><a href="' + up + 'index.html">AI Co-Evolution in Education</a> '
        '<span aria-hidden="true">·</span> <a href="' + up + 'library/index.html">The library</a></header>\n'
        + head_note +
        '<main id="main" class="doc">\n' + body + "\n</main>\n" + FOOTER.replace("{up}", up) + "\n</body>\n</html>\n")


entries = []   # (path, title, mimetype, bytes, front article?)
for d in docs:
    fragment = read("library/docs/%s.html" % d["id"]).decode("utf-8")
    note = ('<p class="open-in-app"><a href="../../index.html#library/%s">Open this in the toolkit</a> '
            "to keep notes, listen to it or translate it.</p>\n" % d["id"])
    entries.append(("library/docs/%s.html" % d["id"], d["title"], "text/html",
                    page_html(d["title"], relink(fragment), 2, note).encode("utf-8"), True))

groups = []
for d in docs:
    if d["group"] not in groups:
        groups.append(d["group"])
contents = ['<h1>The library</h1>',
            "<p>Every guide, lesson plan and template in the toolkit's library, as written in the "
            "education repository (with personal contact details removed). Kiwix's search finds words inside them.</p>"]
for g in groups:
    contents.append("<h2>%s</h2>\n<ul class=\"contents\">" % esc(g))
    for d in docs:
        if d["group"] == g:
            contents.append('<li><a href="docs/%s.html">%s</a>%s</li>' % (
                d["id"], esc(d["title"]), (" <span>" + esc(d.get("summary", "")) + "</span>") if d.get("summary") else ""))
    contents.append("</ul>")
entries.append(("library/index.html", "The library: contents", "text/html",
                page_html("The library", "\n".join(contents), 1).encode("utf-8"), True))

# ---------- Licenses ----------
licenses = [("LICENSE.txt", "The toolkit's license (GNU AGPL 3.0 or later)", (root / "LICENSE").read_bytes()),
            ("THIRD-PARTY-NOTICES.md", "Third-party notices", (root / "THIRD-PARTY-NOTICES.md").read_bytes()),
            ("fonts-OFL.txt", "Font license (SIL Open Font License 1.1)", read("assets/fonts/OFL.txt"))]
for f in sorted((site / "vendor" / "LICENSES").glob("*.txt")):
    licenses.append(("vendor-" + f.name, "License: " + f.stem, f.read_bytes()))
for name, title, data in licenses:
    entries.append(("licenses/" + name, title, "text/plain", data, False))
lic_list = "\n".join('<li><a href="%s">%s</a></li>' % (esc(n), esc(t)) for n, t, _ in licenses)
entries.append(("licenses/index.html", "Licenses", "text/html", page_html(
    "Licenses", "<h1>Licenses</h1>\n<p>The toolkit's own license, and the license of every open-source part "
    "inside it, in full.</p>\n<ul>\n" + lic_list + "\n</ul>", 1).encode("utf-8"), False))

# ---------- Styles and the reading font ----------
ZIM_CSS = """/* Pages of the Kiwix package: readable defaults in the toolkit's colours, light and dark */
@font-face { font-family: "Atkinson Next"; src: url(fonts/atkinson-hyperlegible-next.woff2) format("woff2"); font-weight: 200 800; font-display: swap; }
:root { --page: #f4f6f1; --surface: #fbfcf9; --surface-2: #eef2ec; --ink: #142f2c; --ink-2: #3c5552; --line: #cdd8d1;
  --accent: #17656c; --accent-soft: #d3e6e6; --gold-soft: #f6e7c4; --fireweed-soft: #f4dde5; --mark: #0ca30c; --glow: #f2b84e; --fireweed: #a3365c;
  color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root { --page: #0b1d1e; --surface: #102627; --surface-2: #163031; --ink: #e6eee9; --ink-2: #b9c9c3; --line: #23403f;
    --accent: #6cc4c7; --accent-soft: #173f42; --gold-soft: #3a2f16; --fireweed-soft: #3d1f2b; --fireweed: #ee8fb0; }
}
body { margin: 0; background: var(--page); color: var(--ink); font: 1.0625rem/1.6 "Atkinson Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); text-underline-offset: .15em; }
a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
.top, .open-in-app, .doc, .foot { max-width: 44rem; margin: 0 auto; padding: 0 1rem; }
.top { padding-top: 1rem; font-weight: 700; }
.open-in-app { margin-top: .75rem; padding: .6rem 1rem; border-radius: 10px; background: var(--accent-soft); }
.doc { padding-bottom: 1.5rem; }
.doc h1 { font-size: 1.9rem; line-height: 1.2; margin: 1.25rem 0 1rem; }
.doc h2 { font-size: 1.4rem; margin: 2.2rem 0 .7rem; line-height: 1.25; }
.doc h3 { font-size: 1.15rem; margin: 1.6rem 0 .5rem; }
.doc ul, .doc ol { padding-left: 1.4rem; }
.doc li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.25rem; }
.doc a { overflow-wrap: anywhere; }
.doc blockquote { margin: 1rem 0; padding: .75rem 1rem; border-left: 3px solid var(--line); border-radius: 0 10px 10px 0; background: var(--surface-2); color: var(--ink-2); }
.doc .doc-alert { color: var(--ink); border-left-color: var(--accent); background: var(--accent-soft); }
.doc .doc-alert[data-kind="tip"], .doc .doc-alert[data-kind="success"] { border-left-color: var(--mark); }
.doc .doc-alert[data-kind="important"] { border-left-color: var(--glow); background: var(--gold-soft); }
.doc .doc-alert[data-kind="warning"], .doc .doc-alert[data-kind="caution"], .doc .doc-alert[data-kind="danger"] { border-left-color: var(--fireweed); background: var(--fireweed-soft); }
.doc .doc-alert-label { margin: 0 0 .3rem; font-weight: 700; }
.doc pre { overflow-x: auto; padding: .9rem 1rem; border-radius: 10px; background: var(--surface-2); }
.doc table { border-collapse: collapse; display: block; overflow-x: auto; margin: 1rem 0; }
.doc th, .doc td { border: 1px solid var(--line); padding: .4rem .6rem; text-align: left; vertical-align: top; }
.doc details { margin: 1rem 0; padding: .6rem .9rem; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.doc summary { cursor: pointer; font-weight: 700; }
.doc hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
.contents li { margin: .45rem 0; }
.contents span { display: block; color: var(--ink-2); font-size: .95rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.foot { border-top: 1px solid var(--line); padding-top: 1rem; padding-bottom: 2rem; font-size: .92rem; color: var(--ink-2); }
.zero-harm { padding: .75rem 1rem; border-radius: 10px; background: var(--surface-2); }
@media print { .top, .open-in-app { display: none; } body { background: #fff; color: #000; } }
"""
entries.append(("assets/zim.css", "", "text/css", ZIM_CSS.encode("utf-8"), False))
entries.append(("assets/fonts/atkinson-hyperlegible-next.woff2", "", "font/woff2",
                read("assets/fonts/atkinson-hyperlegible-next.woff2"), False))


# ---------- Write the archive ----------
class Entry(Item):
    def __init__(self, path, title, mimetype, data, front):
        super().__init__()
        self.p, self.t, self.m, self.d, self.f = path, title, mimetype, data, front

    def get_path(self):
        return self.p

    def get_title(self):
        return self.t

    def get_mimetype(self):
        return self.m

    def get_contentprovider(self):
        return StringProvider(self.d)

    def get_hints(self):
        # Fonts are already compressed; everything else is compressed in the archive
        return {Hint.FRONT_ARTICLE: self.f, Hint.COMPRESS: self.m != "font/woff2"}


entries.append(("index.html", "AI Co-Evolution in Education", "text/html", main_page.encode("utf-8"), True))
entries.sort(key=lambda e: e[0])   # the same order every time
out.unlink(missing_ok=True)
with Creator(str(out)).config_indexing(True, "eng").config_nbworkers(1) as creator:
    creator.set_mainpath("index.html")
    creator.add_illustration(read("assets/icons/icon-48.png"), 48)   # Illustration_48x48@1
    for key, value in METADATA.items():
        creator.add_metadata(key, value)
    for e in entries:
        creator.add_item(Entry(*e))

# ---------- Check it opens, and that it's whole ----------
zim = Archive(out)
problems = []
if not zim.check():
    problems.append("its checksum doesn't match")
if zim.main_entry.get_item().path != "index.html":
    problems.append("the main page isn't index.html")
if not (zim.has_fulltext_index and zim.has_title_index):
    problems.append("a search index is missing")
for path, *_ in entries:
    if not zim.has_entry_by_path(path):
        problems.append("missing " + path)
if bytes(zim.get_entry_by_path("index.html").get_item().content) != main_page.encode("utf-8"):
    problems.append("the main page isn't the single-file edition")
if problems:
    sys.exit("The Kiwix package has problems: " + "; ".join(problems))
print("Kiwix package: site/download/%s (%d entries, %d library pages, %.1f MB, with a full-text index)" % (
    out.name, len(entries), len(docs), out.stat().st_size / 1048576))
