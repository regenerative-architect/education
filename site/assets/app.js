/* =========================================================================
   AI Co-Evolution in Education: page script
   -------------------------------------------------------------------------
   Everything here runs on the reader's device. Nothing is sent anywhere.
   The single-file edition's content security policy blocks all network
   requests; the installable app may load only its own files from the site
   it came from (its library, scripts and fonts), and nothing else.

   The script is a set of small, independent modules. Each one starts with
   a comment saying what it does and how to extend it. If one module fails,
   the others keep working (see safe() below).
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Small helpers ---------- */
  var html = document.documentElement;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }
  var nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  var errors = (window.__aiceErrors = []);
  function safe(name, fn) {
    try { return fn(); } catch (err) { errors.push(name + ": " + (err && err.message ? err.message : err)); return null; }
  }
  function listJoin(items) {
    try { return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items); }
    catch (e) { return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]; }
  }
  function tidy(s) { return s.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, ""); }
  function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function formatBytes(b) { return b < 1024 ? b + " B" : b < 1048576 ? nf0.format(b / 1024) + " KB" : nf1.format(b / 1048576) + " MB"; }
  /* GitHub-style heading slugs ("Why it matters" becomes "why-it-matters"), the
     same rule the library build uses, so section links match. */
  function makeSlugger() {
    var seen = {};
    return function (text) {
      var base = String(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
      var n = seen[base] || 0;
      seen[base] = n + 1;
      return n ? base + "-" + n : base;
    };
  }

  /* ---------- Which edition is this? ----------
     "pwa": the installable app (separate files, a service worker, and the
     library as files it fetches and saves). "standalone": one HTML file with
     the library and every script inside it. The build sets data-build. */
  var BUILD = html.getAttribute("data-build") === "pwa" ? "pwa" : "standalone";
  var IS_FILE = location.protocol === "file:";
  var APP_VERSION = "2.2";
  /* Cache names carry the app's folder, so two copies on one website never mix. */
  var SCOPE_TAG = "@" + (IS_FILE ? "/" : new URL("./", location.href).pathname);

  /* ---------- Open-source helpers, loaded only when a tool needs them ----------
     marked (Markdown), DOMPurify (HTML cleaning), MiniSearch (full-text search),
     qrcode-generator (QR codes), turndown (HTML back to Markdown) and
     gpt-tokenizer (the AI Lab's token counter). Versions and licenses:
     vendor/LICENSES and THIRD-PARTY-NOTICES.md. In the single-file edition
     they're already inside the page, so nothing is fetched; the big token
     counter is stored there compressed (PACKED) and unpacked on first use. */
  var VENDOR = { marked: "vendor/marked.umd.js", DOMPurify: "vendor/purify.min.js", MiniSearch: "vendor/minisearch.js", qrcode: "vendor/qrcode.js",
    TurndownService: "vendor/turndown.js", GPTTokenizer: "vendor/gpt-tokenizer.js" };
  var PACKED = { GPTTokenizer: "packed-gpt-tokenizer" };
  var vendorLoading = {};
  /* Single file: base64 text of a gzip file, unpacked with the browser's own DecompressionStream,
     then run as an inline script (the file's security policy allows inline scripts, nothing else) */
  function unpack(name) {
    var block = document.getElementById(PACKED[name]);
    if (!block) return Promise.reject(new Error(name + " isn't available"));
    if (typeof DecompressionStream === "undefined" || typeof Response === "undefined") return Promise.reject(new Error("needs a newer browser"));
    var bin = atob(block.textContent.replace(/\s+/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then(function (code) {
      var s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);   // inline scripts run as soon as they're added
      s.remove();
      if (!window[name]) throw new Error(name + " didn't load");
      return window[name];
    });
  }
  function needs(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (BUILD !== "pwa" && PACKED[name]) {
      if (!vendorLoading[name]) {
        vendorLoading[name] = unpack(name);
        vendorLoading[name].catch(function () { delete vendorLoading[name]; });
      }
      return vendorLoading[name];
    }
    if (BUILD !== "pwa" || !VENDOR[name]) return Promise.reject(new Error(name + " isn't available"));
    if (!vendorLoading[name]) {
      vendorLoading[name] = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = VENDOR[name];
        s.async = true;
        s.onload = function () {
          if (window[name]) resolve(window[name]);
          else { delete vendorLoading[name]; reject(new Error(name + " didn't load")); }
        };
        s.onerror = function () { delete vendorLoading[name]; s.remove(); reject(new Error("Couldn't load " + VENDOR[name])); };
        document.head.appendChild(s);
      });
    }
    return vendorLoading[name];
  }

  /* ---------- Local storage: namespaced, optional, never sent anywhere ----------
     Every key starts with "aice:". If storage is blocked (private browsing,
     strict settings), the tools still work; they just don't remember.
     To add a stored item, give it a label in LABELS so it shows up under
     "Your data on this device". */
  /* The shape ("schema") of everything saved. Raise it when a saved item changes shape, and add a
     step to MIGRATIONS (below Store) that converts older data; imports from older files use it too. */
  var DATA_SCHEMA = 2;
  var Store = (function () {
    var NS = "aice:";
    var ok = false;
    try { localStorage.setItem(NS + "__test", "1"); localStorage.removeItem(NS + "__test"); ok = true; } catch (e) { ok = false; }
    var LABELS = {
      settings: ["Reading comfort settings", "Theme, text size, spacing, motion, transparency and plain mode"],
      role: ["Your path", "The role you picked under Purpose"],
      quickstart: ["Quick start progress", "Which first-week steps you've ticked"],
      sacredLog: ["SACRED decision log", "Activities you checked and their scores"],
      agreement: ["Agreement draft", "Grade band, class name, and chosen and custom promises"],
      readiness: ["Readiness answers", "Which readiness items you ticked"],
      rest: ["Rest reminder", "Whether rest reminders are on"],
      reading: ["Recently read", "The last library documents you opened and where you stopped in each, so you can pick up where you left off"],
      notebook: ["Your notebook", "Notes and reflections you wrote while reading library documents"],
      schema: ["Data format version", "Tells this toolkit how your saved items are organized, so later versions can read them"],
      libraryOffline: ["Keep the library offline", "Whether to keep every library document saved on this device"]
    };
    function emit() { document.dispatchEvent(new CustomEvent("aice:store")); }
    function get(key, fallback) {
      if (!ok) return fallback;
      try { var v = localStorage.getItem(NS + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    }
    function set(key, value) {
      if (!ok) return false;
      try {
        localStorage.setItem(NS + key, JSON.stringify(value));
        if (key !== "schema" && localStorage.getItem(NS + "schema") === null) localStorage.setItem(NS + "schema", String(DATA_SCHEMA));
        emit();
        return true;
      } catch (e) { return false; }
    }
    function remove(key) {
      if (!ok) return;
      try { localStorage.removeItem(NS + key); } catch (e) {}
      emit();
    }
    function keys() {
      var out = [];
      if (!ok) return out;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(NS) === 0 && k !== NS + "__test") out.push(k.slice(NS.length));
        }
      } catch (e) {}
      return out.sort();
    }
    function raw(key) { try { return localStorage.getItem(NS + key) || ""; } catch (e) { return ""; } }
    return { ok: ok, get: get, set: set, remove: remove, keys: keys, raw: raw, LABELS: LABELS };
  })();

  /* ---------- Saved data from older versions is converted once ----------
     MIGRATIONS[n] turns data of shape n-1 into shape n. It receives { key: value } for every
     saved item and returns the converted object (leave a key out to drop it). */
  var MIGRATIONS = {
    /* 1 to 2 (version 2.2): "Recently read" can now say where you stopped, and the notebook is new.
       Nothing older needs converting. */
    2: function (data) { return data; }
  };
  function migrate(data, from) {
    for (var v = from + 1; v <= DATA_SCHEMA; v++) if (MIGRATIONS[v]) data = MIGRATIONS[v](data);
    return data;
  }
  (function upgradeSavedData() {
    if (!Store.ok) return;
    var keys = Store.keys().filter(function (k) { return k !== "schema"; });
    var at = Number(Store.get("schema", 1)) || 1;
    if (!keys.length || at >= DATA_SCHEMA) return;
    var data = {};
    keys.forEach(function (k) { data[k] = Store.get(k, null); });
    try {
      data = migrate(data, at);
      keys.forEach(function (k) { if (!(k in data)) Store.remove(k); });
      Object.keys(data).forEach(function (k) { if (Store.LABELS[k]) Store.set(k, data[k]); });
      Store.set("schema", DATA_SCHEMA);
    } catch (e) { /* keep the data as it was; the tools read it defensively */ }
  })();
  function isPlain(o) { return !!o && typeof o === "object" && !Array.isArray(o); }

  /* Reset handlers: when the reader deletes a stored item, the matching tool resets. */
  var Resets = {};

  /* ---------- Your notebook: private notes and reflections on library documents ----------
     Kept only in this browser under "aice:notebook" (listed under Your data).
     Shape: { v: 1, docs: { <document id>: { title, notes, q, a, updated } } }
     q is the reflection question that was shown, a is your answer. To add a field,
     add it to FIELDS and to markdown(); raise v only if old notebooks need converting. */
  var Notes = (function () {
    var FIELDS = ["notes", "q", "a"];
    function read() {
      var nb = Store.get("notebook", null);
      if (!nb || typeof nb !== "object" || !nb.docs || typeof nb.docs !== "object" || Array.isArray(nb.docs)) nb = { v: 1, docs: {} };
      return nb;
    }
    function clean(d) {
      var out = { title: String((d && d.title) || ""), updated: String((d && d.updated) || "") };
      FIELDS.forEach(function (k) { out[k] = typeof (d && d[k]) === "string" ? d[k] : ""; });
      return out;
    }
    function doc(id) { var d = read().docs[id]; return d ? clean(d) : null; }
    function write(nb) {
      if (!Object.keys(nb.docs).length) { Store.remove("notebook"); return true; }
      return Store.set("notebook", nb);
    }
    /* Save some fields for one document; a document with nothing written is dropped */
    function save(id, title, fields) {
      var nb = read(), d = clean(nb.docs[id]);
      d.title = title || d.title || id;
      FIELDS.forEach(function (k) { if (typeof fields[k] === "string") d[k] = fields[k]; });
      d.updated = new Date().toISOString();
      if (d.notes.trim() || d.a.trim()) nb.docs[id] = d; else delete nb.docs[id];
      return write(nb);
    }
    function remove(id) { var nb = read(); delete nb.docs[id]; write(nb); }
    function list() {
      var docs = read().docs;
      return Object.keys(docs).map(function (id) { var d = clean(docs[id]); d.id = id; return d; })
        .sort(function (x, y) { return x.updated < y.updated ? 1 : x.updated > y.updated ? -1 : 0; });
    }
    /* Everything as one Markdown file, newest first */
    function markdown() {
      var out = ["# My notebook: AI Co-Evolution in Education", "",
        "Exported " + new Date().toISOString().slice(0, 10) + " from this browser. These are your private notes; share them only if you choose to.", ""];
      list().forEach(function (d) {
        out.push("## " + d.title, "");
        if (d.notes.trim()) out.push(d.notes.trim(), "");
        if (d.a.trim()) out.push("**Reflection:** *" + (d.q || "Your reflection") + "*", "", d.a.trim(), "");
        out.push("*Library document “" + d.id + "”" + (d.updated ? ", last edited " + d.updated.slice(0, 10) : "") + ".*", "");
      });
      return out.join("\n");
    }
    /* A notebook from a file: only well-formed documents, with sensible lengths */
    function sanitize(book) {
      if (!isPlain(book) || !isPlain(book.docs)) return null;
      var out = { v: 1, docs: {} };
      Object.keys(book.docs).forEach(function (id) {
        if (!/^[a-z0-9-]{1,80}$/.test(id) || !isPlain(book.docs[id])) return;
        var d = clean(book.docs[id]);
        d.title = d.title.slice(0, 300); d.notes = d.notes.slice(0, 20000); d.q = d.q.slice(0, 500); d.a = d.a.slice(0, 5000);
        d.updated = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(d.updated) ? d.updated : "";
        if (d.notes.trim() || d.a.trim()) out.docs[id] = d;
      });
      return Object.keys(out.docs).length ? out : null;
    }
    /* Combine: documents from both; for a document in both, the more recently edited notes are kept */
    function merge(book) {
      var nb = read();
      Object.keys(book.docs).forEach(function (id) {
        var mine = nb.docs[id], theirs = book.docs[id];
        if (!mine || String(theirs.updated) > String(mine.updated || "")) nb.docs[id] = theirs;
      });
      return write(nb);
    }
    return { doc: doc, save: save, remove: remove, list: list, markdown: markdown, sanitize: sanitize, merge: merge };
  })();

  /* ---------- Announcements and toasts ---------- */
  function announce(msg) {
    var a = $("#announcer");
    if (!a) return;
    a.textContent = "";
    setTimeout(function () { a.textContent = msg; }, 40);
  }
  /* A toast is a short, polite message at the bottom of the screen.
     opts.actions: [{ label, fn, primary }] adds buttons (each one closes the toast).
     opts.sticky keeps it until a button is pressed; otherwise it fades after a few seconds.
     While a dialog is open, toasts appear inside it so they're never hidden behind it. */
  function toast(msg, opts) {
    opts = opts || {};
    var region = $("#toasts");
    if (!region) return null;
    var host = document.fullscreenElement || (Dialogs && Dialogs.top && Dialogs.top()) || document.body;
    if (region.parentNode !== host) host.appendChild(region);
    var t = el("div", "toast");
    t.appendChild(el("span", "toast-msg", msg));
    var row = el("span", "toast-actions");
    (opts.actions || [{ label: opts.action || "OK" }]).forEach(function (a) {
      var b = el("button", a.primary ? "is-primary" : null, a.label);
      b.type = "button";
      on(b, "click", function () { t.remove(); if (a.fn) a.fn(); });
      row.appendChild(b);
    });
    t.appendChild(row);
    region.appendChild(t);
    if (!opts.sticky) setTimeout(function () { t.remove(); }, opts.timeout || 3400);
    return t;
  }

  /* ---------- Clipboard, download and print helpers ---------- */
  function copyText(text) {
    return new Promise(function (resolve) {
      function fallback() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          ta.style.top = "0";
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand("copy");
          ta.remove();
          resolve(!!ok);
        } catch (e) { resolve(false); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
      } else { fallback(); }
    });
  }
  function download(filename, text, type) {
    try {
      var blob = new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast("Downloaded " + filename + ".");
    } catch (e) { toast("This browser couldn't create the download."); }
  }
  /* ---------- Library documents as Markdown ----------
     Turns a library document back into Markdown with turndown (MIT) and its
     GitHub-flavoured tables and task lists. The same rules make the library's
     Markdown download (tools/build-downloads.mjs) and a test checks the two
     give identical files, so change both together. */
  var MD_NOTE = "Personal contact details, retired links and badge images were removed, and outdated crisis helpline details updated.";
  var MD_LICENSE = "License: the project repository uses the GNU Affero General Public License v3.0 or later, and some documents state Creative Commons Attribution-ShareAlike 4.0; LICENSE-NOTES.md in the app's repository explains.";
  var GITHUB_ALERTS = ["note", "tip", "important", "warning", "caution"];
  function markdownOf(TurndownService, html, meta) {
    var body = new DOMParser().parseFromString("<!DOCTYPE html><body>" + html + "</body>", "text/html").body;   // inert: nothing runs or loads
    $$(".sr-only", body).forEach(function (n) { n.remove(); });
    // Links to other library documents point at their Markdown files (as in the library download)
    $$('a[href^="#library/"]', body).forEach(function (a) {
      var m = /^#library\/([^/]+)(?:\/(.+))?$/.exec(a.getAttribute("href")) || [];
      if (m[1]) a.setAttribute("href", m[1] + ".md" + (m[2] ? "#" + m[2] : ""));
      else a.replaceWith.apply(a, Array.prototype.slice.call(a.childNodes));
    });
    // Table cells hold one line in Markdown: headings become bold, list items "•" lines, paragraphs line breaks
    var doc = body.ownerDocument;
    function br() { return doc.createElement("br"); }
    function kids(node) { return Array.prototype.slice.call(node.childNodes); }
    $$("td, th", body).forEach(function (cell) {
      $$("h1, h2, h3, h4, h5, h6", cell).forEach(function (h) { var s = doc.createElement("strong"); kids(h).forEach(function (k) { s.appendChild(k); }); h.replaceWith(s, br()); });
      $$("li", cell).forEach(function (li) { li.replaceWith.apply(li, ["• "].concat(kids(li), [br()])); });
      $$("ul, ol, p", cell).forEach(function (b) { b.replaceWith.apply(b, kids(b).concat([br()])); });
      $$("hr", cell).forEach(function (hr) { hr.remove(); });
      while (cell.lastChild && (cell.lastChild.nodeName === "BR" || (cell.lastChild.nodeType === 3 && !cell.lastChild.textContent.trim()))) cell.lastChild.remove();
    });
    var t = new TurndownService({ headingStyle: "atx", hr: "---", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*", strongDelimiter: "**" });
    if (TurndownService.gfm) t.use(TurndownService.gfm);
    // Tables become Markdown tables (with an empty header row when they have none); the rare table
    // with a code block or another table inside stays as plain HTML, which Markdown allows
    t.addRule("table", { filter: function (n) { return n.nodeName === "TABLE"; }, replacement: function (c, n) {
      if (n.querySelector("pre, table, blockquote") || (n.rows.length === 1 && n.rows[0].cells.length <= 1)) return "\n\n" + n.outerHTML + "\n\n";
      var content = c.replace(/\n+/g, "\n").trim();
      if (!/^\|\s*:?-{3}/.test(content.split("\n")[1] || "")) {
        var cols = 0;
        for (var i = 0; i < n.rows.length; i++) cols = Math.max(cols, n.rows[i].cells.length);
        content = "|" + new Array(cols + 1).join("     |") + "\n|" + new Array(cols + 1).join(" --- |") + "\n" + content;
      }
      return "\n\n" + content + "\n\n";
    } });
    // Callouts become GitHub alerts (> [!NOTE]); other kinds keep their label in bold
    t.addRule("alert-label", { filter: function (n) { return n.nodeName === "P" && n.classList.contains("doc-alert-label"); }, replacement: function (c, n) {
      var kind = (n.parentNode.getAttribute("data-kind") || "").toLowerCase();
      return GITHUB_ALERTS.indexOf(kind) >= 0 ? "\n\n[!" + kind.toUpperCase() + "]\n\n" : "\n\n**" + n.textContent.trim() + "**\n\n";
    } });
    t.addRule("task", { filter: function (n) { return n.nodeName === "INPUT" && n.type === "checkbox"; }, replacement: function (c, n) { return n.checked ? "[x] " : "[ ] "; } });
    t.addRule("details", { filter: "details", replacement: function (c) { return "\n\n" + c + "\n\n"; } });
    t.addRule("summary", { filter: "summary", replacement: function (c) { return c.trim() ? "\n\n**" + c.trim().replace(/^\*\*|\*\*$/g, "") + "**\n\n" : ""; } });
    return t.turndown(body).replace(/\n{3,}/g, "\n\n").trim() + "\n" +
      "\n---\n\n*From the AI Co-Evolution in Education library, version " + APP_VERSION + ". Source in the project repository: `" + (meta.source || meta.id) + "`. " + MD_NOTE + " " + MD_LICENSE + "*\n";
  }

  /* Wide tables and code blocks scroll sideways on small screens. Keyboard users need
     to reach them too, so while one actually scrolls it gets a tab stop and a name;
     when it fits again, the extra tab stop goes away. Call after content changes. */
  /* A name for a scrolling box: its caption, or the heading above it, made unique on the page */
  function scrollName(box, used) {
    var cap = box.querySelector("caption"), name = cap ? cap.textContent : "";
    if (!name) {
      for (var n = box; n && !name; n = n.parentElement) {
        for (var prev = n.previousElementSibling; prev && !name; prev = prev.previousElementSibling) {
          if (/^H[1-6]$/.test(prev.tagName)) name = prev.textContent;
          else { var inner = prev.querySelectorAll ? prev.querySelectorAll("h1,h2,h3,h4,h5,h6") : []; if (inner.length) name = inner[inner.length - 1].textContent; }
        }
        if (n.classList && (n.classList.contains("doc") || n.classList.contains("section"))) break;
      }
    }
    name = (box.tagName === "PRE" ? "Code example: " : "Table: ") + (name || "details").replace(/\s+/g, " ").trim().slice(0, 70);
    var unique = name, k = 2;
    while (used[unique]) unique = name + " (" + (k++) + ")";
    used[unique] = 1;
    return unique + ", scrolls sideways";
  }
  function scrollablesReachable(root) {
    var used = {};
    $$("[data-scroll-stop]").forEach(function (b) { used[(b.getAttribute("aria-label") || "").replace(/, scrolls sideways$/, "")] = 1; });
    $$(".table-wrap, .doc pre", root || document).forEach(function (box) {
      var scrolls = box.scrollWidth > box.clientWidth + 1;
      if (scrolls && !box.hasAttribute("tabindex")) {
        box.setAttribute("tabindex", "0");
        box.setAttribute("data-scroll-stop", "");
        if (!box.getAttribute("role")) box.setAttribute("role", "region");
        if (!box.getAttribute("aria-label")) box.setAttribute("aria-label", scrollName(box, used));
      } else if (!scrolls && box.hasAttribute("data-scroll-stop")) {
        box.removeAttribute("tabindex");
        box.removeAttribute("data-scroll-stop");
        if (box.getAttribute("role") === "region") box.removeAttribute("role");
        box.removeAttribute("aria-label");
      }
    });
  }
  var scrollTimer = 0;
  on(window, "resize", function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(function () { scrollablesReachable(); }, 200); });

  /* Tells the tools that list offline copies (Your data, the Library) to refresh */
  var cachesTimer = 0;
  function announceCaches() {
    clearTimeout(cachesTimer);
    cachesTimer = setTimeout(function () { document.dispatchEvent(new CustomEvent("aice:caches")); }, 150);
  }
  function today() {
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date()); } catch (e) { return new Date().toDateString(); }
  }

  /* =========================================================================
     SETTINGS: theme, text size, spacing, motion, transparency, plain mode.
     Applied as data- attributes on <html>; the stylesheet does the rest.
     ========================================================================= */
  var Settings = (function () {
    var defaults = { theme: "system", text: "md", space: "normal", motion: false, transparency: false, simple: false };
    var s = Object.assign({}, defaults, Store.get("settings", {}));
    var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    var mqMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function resolvedTheme() { return s.theme === "system" ? (mqDark && mqDark.matches ? "dark" : "light") : s.theme; }
    function reducedMotion() { return !!s.motion || !!(mqMotion && mqMotion.matches); }
    function apply() {
      if (s.theme === "system") html.removeAttribute("data-theme"); else html.setAttribute("data-theme", s.theme);
      html.setAttribute("data-resolved-theme", resolvedTheme());
      html.setAttribute("data-text", s.text);
      html.setAttribute("data-space", s.space);
      if (s.motion) html.setAttribute("data-motion", "reduce"); else html.removeAttribute("data-motion");
      if (s.transparency) html.setAttribute("data-transparency", "reduce"); else html.removeAttribute("data-transparency");
      if (s.simple) html.setAttribute("data-simple", "on"); else html.removeAttribute("data-simple");
      var tt = $("#theme-toggle");
      if (tt) tt.setAttribute("aria-label", resolvedTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme");
      var meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#0b2022");
      document.dispatchEvent(new CustomEvent("aice:settings"));
    }
    function withTransition(fn) {
      if (document.startViewTransition && !reducedMotion()) {
        try { document.startViewTransition(fn); return; } catch (e) {}
      }
      fn();
    }
    function update(patch, transition) {
      var run = function () { s = Object.assign({}, s, patch); Store.set("settings", s); apply(); syncForm(); };
      if (transition) withTransition(run); else run();
    }
    function syncForm() {
      $$('input[name="c-theme"]').forEach(function (i) { i.checked = i.value === s.theme; });
      $$('input[name="c-text"]').forEach(function (i) { i.checked = i.value === s.text; });
      $$('input[name="c-space"]').forEach(function (i) { i.checked = i.value === s.space; });
      var m = $("#c-motion"), t = $("#c-transparency"), p = $("#c-simple");
      if (m) m.checked = !!s.motion;
      if (t) t.checked = !!s.transparency;
      if (p) p.checked = !!s.simple;
    }
    function bindForm() {
      $$('input[name="c-theme"]').forEach(function (i) { on(i, "change", function () { update({ theme: i.value }, true); }); });
      $$('input[name="c-text"]').forEach(function (i) { on(i, "change", function () { update({ text: i.value }); }); });
      $$('input[name="c-space"]').forEach(function (i) { on(i, "change", function () { update({ space: i.value }); }); });
      on($("#c-motion"), "change", function (e) { update({ motion: e.target.checked }); });
      on($("#c-transparency"), "change", function (e) { update({ transparency: e.target.checked }); });
      on($("#c-simple"), "change", function (e) { update({ simple: e.target.checked }); });
      on($("#c-reset"), "click", function () { s = Object.assign({}, defaults); Store.remove("settings"); apply(); syncForm(); toast("Reading comfort settings reset."); });
      on($("#theme-toggle"), "click", function () { update({ theme: resolvedTheme() === "dark" ? "light" : "dark" }, true); });
      syncForm();
    }
    function listen(mq, fn) {
      if (!mq) return;
      if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn);
    }
    listen(mqDark, apply);
    listen(mqMotion, function () { document.dispatchEvent(new CustomEvent("aice:settings")); });
    Resets.settings = function () { s = Object.assign({}, defaults); apply(); syncForm(); };
    function reload() { s = Object.assign({}, defaults, Store.get("settings", {})); apply(); syncForm(); }
    return { apply: apply, bindForm: bindForm, reducedMotion: reducedMotion, resolvedTheme: resolvedTheme, reload: reload };
  })();

  /* =========================================================================
     LIGHT FIELD: the hero's breathing scene.
     - Background: a dawn forest painted once per resize (sky glow, two hazy
       tree lines, ground mist).
     - Light shafts: drawn at low resolution and scaled up, which softens them.
     - Pollen: particles at different depths. Near ones are large soft bokeh,
       mid-depth ones are crisp, far ones are faint. Each brightens as it
       crosses a light shaft, the way dust glints in real sunlight.
     - Air: a slow flow field plus warm air rising; the pointer stirs it.
     - Breath: the ritual sets breath (0 to 1); particles gather on the
       in-breath and drift free on the out-breath, and a seedling grows.
     Performance: a quality ladder lowers the particle count if frames run
     slow; the loop stops off-screen, in background tabs, when paused, and
     when reduced motion is requested.
     To tune the look, start with COUNT_DIVISOR, the beam list and the colors.
     ========================================================================= */
  var LightField = safe("lightfield", function () {
    var canvas = $("#hero-canvas");
    var hero = $("#top");
    if (!canvas || !hero || !canvas.getContext) return null;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var COUNT_DIVISOR = 3600;            // fewer pixels per particle = more particles
    var W = 0, H = 0, DPR = 1;
    var particles = [];
    var bgCanvas = null, beamCanvas = null, sprites = {};
    var sun = { x: 0, y: 0 };
    var beams = [];
    var quality = 1;
    var running = false, rafId = 0, lastT = 0, time = 0;
    var inView = true, userPaused = false;
    var frameSamples = [];
    var breath = 0, breathShown = 0, ritualOn = false;
    var growth = 0, growthShown = 0;
    var gather = { x: 0, y: 0 };
    var pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false, t: 0 };

    function makeSprite(stops, size) {
      var c = document.createElement("canvas");
      c.width = c.height = size;
      var g = c.getContext("2d");
      var r = size / 2;
      var grd = g.createRadialGradient(r, r, 0, r, r, r);
      stops.forEach(function (s) { grd.addColorStop(s[0], s[1]); });
      g.fillStyle = grd;
      g.fillRect(0, 0, size, size);
      return c;
    }
    function buildSprites() {
      // Crisp mote: bright core, quick falloff (the plane of focus)
      sprites.sharp = makeSprite([[0, "rgba(255,248,226,1)"], [0.18, "rgba(255,236,190,0.95)"], [0.42, "rgba(246,198,110,0.35)"], [1, "rgba(242,184,78,0)"]], 64);
      // Bokeh disc: flat body, slightly brighter rim, like an out-of-focus highlight
      sprites.bokeh = makeSprite([[0, "rgba(255,236,196,0.42)"], [0.72, "rgba(255,228,176,0.48)"], [0.88, "rgba(255,222,160,0.62)"], [1, "rgba(255,214,150,0)"]], 128);
      // Far haze: soft and dim
      sprites.haze = makeSprite([[0, "rgba(214,236,226,0.85)"], [0.35, "rgba(190,222,210,0.35)"], [1, "rgba(160,200,190,0)"]], 64);
      // Cool mote: skylight reflected
      sprites.cool = makeSprite([[0, "rgba(226,246,240,1)"], [0.2, "rgba(190,232,224,0.8)"], [0.5, "rgba(140,200,196,0.2)"], [1, "rgba(120,190,190,0)"]], 64);
    }

    // A tiny deterministic noise so the tree lines are stable between resizes
    function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
    function noise1(x) { var i = Math.floor(x), f = x - i; var u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); }

    function drawTreeLine(g, baseY, amp, color, seed, minW, maxW) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      var x = -20;
      var k = 0;
      while (x < W + 40) {
        var n = noise1(seed + k * 0.37);
        var w = lerp(minW, maxW, hash(seed * 3 + k));
        var h = amp * (0.45 + 0.75 * n) * (0.75 + 0.5 * hash(seed + k * 1.7));
        var top = baseY - h;
        // a conifer: narrow, slightly ragged triangle
        g.lineTo(x, baseY);
        g.lineTo(x + w * 0.18, baseY - h * 0.45);
        g.lineTo(x + w * 0.08, baseY - h * 0.45);
        g.lineTo(x + w * 0.38, baseY - h * 0.78);
        g.lineTo(x + w * 0.3, baseY - h * 0.78);
        g.lineTo(x + w * 0.5, top);
        g.lineTo(x + w * 0.7, baseY - h * 0.78);
        g.lineTo(x + w * 0.62, baseY - h * 0.78);
        g.lineTo(x + w * 0.92, baseY - h * 0.45);
        g.lineTo(x + w * 0.82, baseY - h * 0.45);
        g.lineTo(x + w, baseY);
        x += w * (0.55 + 0.4 * hash(seed + k * 2.3));
        k++;
      }
      g.lineTo(W + 40, H);
      g.closePath();
      g.fill();
    }

    function buildBackground() {
      bgCanvas = document.createElement("canvas");
      bgCanvas.width = Math.max(1, Math.round(W * DPR));
      bgCanvas.height = Math.max(1, Math.round(H * DPR));
      var g = bgCanvas.getContext("2d");
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      // Sky: deep spruce at the edges, warmer near the sun
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0e2b2d");
      sky.addColorStop(0.55, "#12352f");
      sky.addColorStop(1, "#0a1d1e");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      var glow = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(W, H) * 0.9);
      glow.addColorStop(0, "rgba(255,214,140,0.55)");
      glow.addColorStop(0.18, "rgba(242,184,78,0.22)");
      glow.addColorStop(0.5, "rgba(120,150,110,0.08)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      // Far trees, hazy with distance (atmospheric perspective)
      drawTreeLine(g, H * 0.8, H * 0.2, "rgba(58,98,88,0.55)", 11, 26, 52);
      var haze = g.createLinearGradient(0, H * 0.55, 0, H);
      haze.addColorStop(0, "rgba(160,196,180,0)");
      haze.addColorStop(1, "rgba(160,196,180,0.10)");
      g.fillStyle = haze;
      g.fillRect(0, 0, W, H);
      // Near trees, darker
      drawTreeLine(g, H * 0.95, H * 0.3, "rgba(9,27,26,0.92)", 47, 34, 74);
      // Ground mist and a pool of light where the shafts land
      var mist = g.createLinearGradient(0, H * 0.82, 0, H);
      mist.addColorStop(0, "rgba(190,214,200,0)");
      mist.addColorStop(1, "rgba(190,214,200,0.08)");
      g.fillStyle = mist;
      g.fillRect(0, 0, W, H);
      var pool = g.createRadialGradient(W * 0.72, H * 0.94, 0, W * 0.72, H * 0.94, W * 0.32);
      pool.addColorStop(0, "rgba(255,214,140,0.16)");
      pool.addColorStop(1, "rgba(255,214,140,0)");
      g.fillStyle = pool;
      g.fillRect(0, 0, W, H);
      // Vignette
      var vig = g.createRadialGradient(W * 0.55, H * 0.45, Math.min(W, H) * 0.35, W * 0.55, H * 0.5, Math.max(W, H) * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,8,8,0.45)");
      g.fillStyle = vig;
      g.fillRect(0, 0, W, H);
    }

    function buildBeams() {
      // Each beam: a direction from the sun, a width that grows with distance, and a strength
      var base = Math.atan2(H, -W * 0.55); // pointing down and to the left
      beams = [
        { a: base - 0.16, w0: 6, k: 0.07, s: 0.9 },
        { a: base - 0.05, w0: 10, k: 0.11, s: 1.0 },
        { a: base + 0.07, w0: 5, k: 0.06, s: 0.75 },
        { a: base + 0.17, w0: 8, k: 0.09, s: 0.85 },
        { a: base + 0.29, w0: 4, k: 0.05, s: 0.55 }
      ];
      beams.forEach(function (b) { b.dx = Math.cos(b.a); b.dy = Math.sin(b.a); });
      // Paint them small, then let the browser's smoothing blur them as they scale up
      var scale = 0.1;
      beamCanvas = document.createElement("canvas");
      beamCanvas.width = Math.max(2, Math.round(W * scale));
      beamCanvas.height = Math.max(2, Math.round(H * scale));
      var g = beamCanvas.getContext("2d");
      g.setTransform(scale, 0, 0, scale, 0, 0);
      var L = Math.hypot(W, H) * 1.3;
      beams.forEach(function (b) {
        g.save();
        g.translate(sun.x, sun.y);
        g.rotate(b.a - Math.PI / 2);
        var w1 = b.w0 + b.k * L;
        var grd = g.createLinearGradient(0, 0, 0, L);
        grd.addColorStop(0, "rgba(255,226,170,0)");
        grd.addColorStop(0.1, "rgba(255,226,170," + (0.32 * b.s).toFixed(3) + ")");
        grd.addColorStop(0.55, "rgba(255,226,170," + (0.16 * b.s).toFixed(3) + ")");
        grd.addColorStop(1, "rgba(255,226,170,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(-b.w0, 0);
        g.lineTo(b.w0, 0);
        g.lineTo(w1, L);
        g.lineTo(-w1, L);
        g.closePath();
        g.fill();
        g.restore();
      });
    }

    // How much shaft light falls on a point (0 to about 1.2). Used to make motes glint.
    function beamLight(x, y) {
      var sx = x - sun.x, sy = y - sun.y, total = 0;
      for (var i = 0; i < beams.length; i++) {
        var b = beams[i];
        var t = sx * b.dx + sy * b.dy;
        if (t <= 0) continue;
        var perp = Math.abs(sx * b.dy - sy * b.dx);
        var w = b.w0 + b.k * t;
        var q = perp / w;
        if (q > 2.2) continue;
        total += Math.exp(-q * q * 1.6) * b.s;
      }
      return Math.min(total, 1.25);
    }

    function spawn(anywhere) {
      var z = Math.random();
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : H + 10 + Math.random() * 40,
        z: z,
        vx: 0, vy: 0,
        size: lerp(0.7, 2.3, z),
        tw: Math.random() * Math.PI * 2,
        tws: 0.5 + Math.random() * 1.8,
        cool: Math.random() < 0.14,
        seed: Math.random() * 1000
      };
    }
    function populate() {
      var target = Math.round(clamp((W * H) / COUNT_DIVISOR, 80, 560) * quality);
      while (particles.length < target) particles.push(spawn(true));
      if (particles.length > target) particles.length = target;
      particles.sort(function (a, b) { return a.z - b.z; });
    }

    function resize() {
      var r = hero.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      DPR = Math.min(window.devicePixelRatio || 1, quality < 0.7 ? 1 : 1.75);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      sun.x = W * 0.86;
      sun.y = -H * 0.22;
      buildBackground();
      buildBeams();
      particles.forEach(function (p) { p.x = Math.random() * W; p.y = Math.random() * H; });
      populate();
      updateGatherPoint();
      if (!running) frame(performance.now(), true);
    }

    function updateGatherPoint() {
      var ring = $("#ritual-ring");
      var hr = hero.getBoundingClientRect();
      if (ring && ring.offsetParent !== null) {
        var rr = ring.getBoundingClientRect();
        gather.x = rr.left + rr.width / 2 - hr.left;
        gather.y = rr.top + rr.height / 2 - hr.top;
      } else {
        gather.x = W * 0.5;
        gather.y = H * 0.45;
      }
    }

    function flowAngle(x, y, t) {
      return Math.sin(x * 0.0023 + t * 0.07) * 1.3 + Math.cos(y * 0.0031 - t * 0.05) * 1.1 + Math.sin((x + y) * 0.0011 + t * 0.03) * 0.8;
    }

    function update(dt) {
      time += dt;
      breathShown += (breath - breathShown) * Math.min(1, dt * 4);
      growthShown += (growth - growthShown) * Math.min(1, dt * 1.6);
      var pullBase = ritualOn ? breathShown : 0;
      var release = ritualOn ? (1 - breathShown) : 0;
      // pointer momentum fades
      pointer.vx *= 0.92; pointer.vy *= 0.92;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var depth = 0.35 + p.z * 0.9;
        var a = flowAngle(p.x, p.y, time);
        var speed = 9 * depth;
        var tx = Math.cos(a) * speed;
        var ty = Math.sin(a) * speed * 0.6 - 6 * depth; // warm air rises
        // The breath: gather on the in-breath, drift free on the out-breath
        if (pullBase > 0.02 || release > 0.02) {
          var gx = gather.x - p.x, gy = gather.y - p.y;
          var d = Math.sqrt(gx * gx + gy * gy) + 1;
          var reach = Math.max(W, H) * 0.75;
          var fall = Math.max(0, 1 - d / reach);
          tx += (gx / d) * 70 * pullBase * fall * depth;
          ty += (gy / d) * 70 * pullBase * fall * depth;
          if (d < 160) { tx -= (gx / d) * 40 * release * depth; ty -= (gy / d) * 40 * release * depth; }
        }
        // The pointer stirs the air nearby
        if (pointer.active) {
          var px = p.x - pointer.x, py = p.y - pointer.y;
          var pd2 = px * px + py * py;
          if (pd2 < 22500) {
            var f = 1 - Math.sqrt(pd2) / 150;
            tx += pointer.vx * 0.9 * f * depth - py * 0.35 * f;
            ty += pointer.vy * 0.9 * f * depth + px * 0.35 * f;
          }
        }
        p.vx += (tx - p.vx) * Math.min(1, dt * 1.8);
        p.vy += (ty - p.vy) * Math.min(1, dt * 1.8);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // wrap around the edges
        if (p.y < -30) { p.y = H + 20; p.x = Math.random() * W; }
        if (p.y > H + 40) { p.y = -20; }
        if (p.x < -30) p.x = W + 20;
        if (p.x > W + 30) p.x = -20;
      }
    }

    function drawSeedling(t) {
      if (W < 900 || growthShown < 0.01) return;
      var g = growthShown;
      var bx = W * 0.72, by = H * 0.93;
      // contact shadow: a radial gradient squashed into an ellipse on the ground
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.min(1, g * 1.5);
      ctx.save();
      ctx.scale(1, 0.28);
      var cy = (by + 2) / 0.28;
      var sh = ctx.createRadialGradient(bx, cy, 0, bx, cy, 46);
      sh.addColorStop(0, "rgba(0,0,0,0.45)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(bx - 50, cy - 50, 100, 100);
      ctx.restore();
      // stem, swaying a little in the moving air
      var hgt = 26 + 80 * g;
      var sway = Math.sin(t * 0.9) * 3 * g;
      var tipX = bx + sway, tipY = by - hgt;
      ctx.strokeStyle = "rgba(122,170,96,0.95)";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx - 6, by - hgt * 0.55, tipX, tipY);
      ctx.stroke();
      // leaves: first a pair of seed leaves, then a pair of true leaves
      function leaf(x, y, len, ang, open) {
        if (open <= 0) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        var L = len * open, Wd = len * 0.42 * open;
        var lg = ctx.createLinearGradient(0, -Wd, 0, Wd);
        lg.addColorStop(0, "rgba(196,232,140,0.98)");
        lg.addColorStop(1, "rgba(52,110,62,0.98)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(L * 0.3, -Wd, L * 0.85, -Wd * 0.8, L, 0);
        ctx.bezierCurveTo(L * 0.85, Wd * 0.7, L * 0.3, Wd * 0.8, 0, 0);
        ctx.fill();
        // rim light from the sun's side
        ctx.strokeStyle = "rgba(255,226,160,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L * 0.1, -Wd * 0.35);
        ctx.bezierCurveTo(L * 0.35, -Wd * 0.95, L * 0.8, -Wd * 0.75, L, 0);
        ctx.stroke();
        ctx.restore();
      }
      var o1 = clamp((g - 0.15) / 0.35, 0, 1);
      var o2 = clamp((g - 0.6) / 0.4, 0, 1);
      leaf(tipX, tipY, 26, -0.35 + sway * 0.01, o1);
      leaf(tipX, tipY, 26, Math.PI + 0.35 + sway * 0.01, o1);
      leaf(bx - 2, by - hgt * 0.55, 20, -0.75, o2);
      leaf(bx - 2, by - hgt * 0.62, 18, Math.PI + 0.85, o2);
      // a warm glint where light meets the tip
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 * g;
      ctx.drawImage(sprites.sharp, tipX - 14, tipY - 14, 28, 28);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function draw() {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(bgCanvas, 0, 0, W, H);
      // light shafts: slow shimmer, as if clouds drift past the sun
      var shimmer = 0.78 + 0.16 * Math.sin(time * 0.21) + 0.08 * Math.sin(time * 0.53 + 1.3);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = clamp(shimmer + breathShown * 0.25, 0, 1);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(beamCanvas, 0, 0, W, H);
      // pollen and dust
      ctx.globalCompositeOperation = "lighter";
      var glowBoost = 1 + breathShown * 0.7;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var light = beamLight(p.x, p.y);
        var tw = 0.62 + 0.38 * Math.sin(p.tw + time * p.tws);
        var alpha, size, spr;
        if (p.z > 0.86) {           // near the eye: large, soft bokeh
          spr = sprites.bokeh;
          size = 14 + (p.z - 0.86) * 260;
          alpha = (0.035 + 0.16 * light) * (0.75 + 0.25 * tw);
        } else if (p.z < 0.32) {    // far away: faint haze
          spr = sprites.haze;
          size = p.size * 3.2;
          alpha = (0.05 + 0.3 * light) * tw;
        } else {                     // the plane of focus: crisp glints
          spr = p.cool ? sprites.cool : sprites.sharp;
          size = p.size * 3.4;
          alpha = (0.08 + 0.92 * light) * tw;
        }
        alpha *= glowBoost;
        if (alpha < 0.01) continue;
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        ctx.drawImage(spr, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      // a soft halo around the gathering point while breathing
      if (ritualOn && breathShown > 0.02) {
        var halo = ctx.createRadialGradient(gather.x, gather.y, 0, gather.x, gather.y, 180);
        halo.addColorStop(0, "rgba(255,220,150," + (0.22 * breathShown).toFixed(3) + ")");
        halo.addColorStop(1, "rgba(255,220,150,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(gather.x - 180, gather.y - 180, 360, 360);
      }
      ctx.globalCompositeOperation = "source-over";
      drawSeedling(time);
    }

    function shouldRun() { return inView && !userPaused && !document.hidden && !Settings.reducedMotion(); }

    function frame(now, once) {
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now;
      if (!once) {
        update(dt);
        // quality ladder: if frames are slow, ease off
        frameSamples.push(dt);
        if (frameSamples.length >= 90) {
          var avg = frameSamples.reduce(function (a, b) { return a + b; }, 0) / frameSamples.length;
          frameSamples = [];
          if (avg > 0.024 && quality > 0.45) { quality *= 0.75; populate(); }
        }
      } else {
        breathShown = breath;
        growthShown = growth;
      }
      draw();
      if (!once && running) rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (running || !shouldRun()) return;
      running = true;
      lastT = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      frame(performance.now(), true);
    }
    function refresh() {
      if (shouldRun()) start(); else stop();
      var btn = $("#motion-toggle");
      if (btn) {
        var label = $("span", btn);
        var use = $("use", btn);
        var reduced = Settings.reducedMotion();
        btn.hidden = reduced;
        btn.setAttribute("aria-pressed", userPaused ? "true" : "false");
        if (label) label.textContent = userPaused ? "Play motion" : "Pause motion";
        if (use) use.setAttribute("href", userPaused ? "#i-play" : "#i-pause");
      }
    }

    buildSprites();
    resize();
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { resize(); });
      ro.observe(hero);
    } else {
      on(window, "resize", resize);
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        refresh();
      }, { threshold: 0 });
      io.observe(hero);
    }
    on(document, "visibilitychange", refresh);
    on(document, "aice:settings", refresh);
    on($("#motion-toggle"), "click", function () { userPaused = !userPaused; refresh(); announce(userPaused ? "Motion paused" : "Motion playing"); });
    on(hero, "pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var now = performance.now();
      if (pointer.active && now - pointer.t < 120) {
        var k = 1000 / Math.max(8, now - pointer.t);
        pointer.vx = clamp((x - pointer.x) * k * 0.25, -260, 260);
        pointer.vy = clamp((y - pointer.y) * k * 0.25, -260, 260);
      }
      pointer.x = x; pointer.y = y; pointer.t = now; pointer.active = true;
    });
    on(hero, "pointerleave", function () { pointer.active = false; });
    refresh();

    return {
      setBreath: function (b) { breath = clamp(b, 0, 1); if (!running) frame(performance.now(), true); },
      setGrowth: function (g) { growth = clamp(g, 0, 1); if (!running) frame(performance.now(), true); },
      setRitual: function (onOff) { ritualOn = !!onOff; updateGatherPoint(); if (!onOff) breath = 0; if (!running) frame(performance.now(), true); },
      refreshGather: updateGatherPoint
    };
  });

  /* =========================================================================
     WELCOME RITUAL: "Take three breaths" (from 00-welcome-ritual.md).
     4 seconds in, 6 seconds out, three times. The phase word's weight
     breathes too, using the variable font. Then the intention appears.
     To change the rhythm, edit IN, OUT and CYCLES.
     ========================================================================= */
  var Ritual = safe("ritual", function () {
    var hero = $("#top"), panel = $("#ritual"), phaseEl = $("#ritual-phase"), countEl = $("#ritual-count");
    var ring = $("#ritual-ring"), done = $("#ritual-done"), dotsList = $("#ritual-dots");
    if (!hero || !panel || !phaseEl || !ring || !done) return null;
    var dots = $$("li", dotsList);
    var IN = 4000, OUT = 6000, CYCLES = 3, LEAD = 1800;
    var startT = 0, rafId = 0, active = false, lastPhase = "", lastCycle = -1, lastCount = "";
    function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
    function setPhase(text) {
      if (text !== lastPhase) { phaseEl.textContent = text; lastPhase = text; }
    }
    function setBreath(b, cycleProgress) {
      var reduced = Settings.reducedMotion();
      ring.style.setProperty("--breath-scale", reduced ? "1" : String(0.72 + 0.28 * b));
      ring.style.setProperty("--breath-glow", String(0.3 + 0.7 * b));
      phaseEl.style.fontWeight = reduced ? "400" : String(Math.round(300 + 400 * b));
      if (LightField) { LightField.setBreath(b); LightField.setGrowth(cycleProgress); }
    }
    function tick() {
      var elapsed = performance.now() - startT;
      if (elapsed < LEAD) {
        setPhase("Get comfortable");
        countEl.textContent = "";
        setBreath(0, 0);
        rafId = requestAnimationFrame(tick);
        return;
      }
      var e = elapsed - LEAD;
      var cycle = Math.floor(e / (IN + OUT));
      if (cycle >= CYCLES) { finish(); return; }
      var inCycle = e - cycle * (IN + OUT);
      var b, phase, remaining, k;
      if (inCycle < IN) {
        k = inCycle / IN; b = ease(k); phase = "Breathe in"; remaining = Math.ceil((IN - inCycle) / 1000);
      } else {
        k = (inCycle - IN) / OUT; b = 1 - ease(k); phase = "Breathe out"; remaining = Math.ceil((IN + OUT - inCycle) / 1000);
      }
      setPhase(phase);
      var count = String(remaining);
      if (count !== lastCount) { countEl.textContent = count; lastCount = count; }
      var grown = (cycle + (inCycle < IN ? ease(k) : 1)) / CYCLES;
      setBreath(b, grown);
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        dots.forEach(function (d, i) { d.classList.toggle("done", i < cycle); });
        dotsList.setAttribute("aria-label", "Breaths completed: " + cycle + " of " + CYCLES);
      }
      rafId = requestAnimationFrame(tick);
    }
    function begin() {
      if (active) return;
      active = true;
      lastPhase = ""; lastCycle = -1; lastCount = "";
      hero.setAttribute("data-ritual", "");
      hero.removeAttribute("data-ritual-done");
      panel.hidden = false;
      done.hidden = true;
      dots.forEach(function (d) { d.classList.remove("done"); });
      dotsList.setAttribute("aria-label", "Breaths completed: 0 of " + CYCLES);
      if (hero.getBoundingClientRect().top < -40) hero.scrollIntoView({ behavior: Settings.reducedMotion() ? "auto" : "smooth", block: "start" });
      if (LightField) { LightField.setRitual(true); setTimeout(function () { if (LightField) LightField.refreshGather(); }, 60); }
      startT = performance.now();
      tick();
      var skip = $("#ritual-skip");
      if (skip) skip.focus({ preventScroll: true });
    }
    function finish() {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      dots.forEach(function (d) { d.classList.add("done"); });
      dotsList.setAttribute("aria-label", "Breaths completed: " + CYCLES + " of " + CYCLES);
      setBreath(0, 1);
      hero.setAttribute("data-ritual-done", "");
      done.hidden = false;
      var intention = $("#ritual-intention");
      if (intention) intention.focus({ preventScroll: true });
    }
    function close(silent) {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      panel.hidden = true;
      hero.removeAttribute("data-ritual");
      hero.removeAttribute("data-ritual-done");
      if (LightField) { LightField.setBreath(0); LightField.setRitual(false); }
      phaseEl.style.fontWeight = "";
      if (!silent) { var s = $("#ritual-start"); if (s) s.focus({ preventScroll: true }); }
    }
    on($("#ritual-start"), "click", begin);
    on($("#ritual-skip"), "click", finish);
    on($("#ritual-close"), "click", function () { close(false); });
    on($("#ritual-begin"), "click", function () { close(true); });
    on(panel, "keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(false); } });
    $$("[data-ritual-launch]").forEach(function (b) { on(b, "click", begin); });
    return { begin: begin, close: close };
  });

  /* =========================================================================
     DIALOGS: contents, search and reading comfort. Native <dialog> handles
     focus trapping and Esc. Clicking the backdrop closes it too.
     ========================================================================= */
  var Dialogs = safe("dialogs", function () {
    var stack = [];   // open dialogs, newest last (the reader can have the share sheet on top)
    function top() {
      for (var i = stack.length - 1; i >= 0; i--) if (stack[i].open) return stack[i];
      return null;
    }
    function open(id, opener) {
      var d = document.getElementById(id);
      if (!d || typeof d.showModal !== "function" || d.open) return false;
      d._opener = opener || document.activeElement;
      d._skipRestore = false;
      d.showModal();
      stack.push(d);
      d.dispatchEvent(new CustomEvent("aice:open"));
      return true;
    }
    $$("[data-open]").forEach(function (btn) {
      on(btn, "click", function () { open(btn.getAttribute("data-open"), btn); });
    });
    $$("dialog.sheet").forEach(function (d) {
      on(d, "click", function (e) { if (e.target === d) d.close(); });
      $$("[data-close]", d).forEach(function (b) { on(b, "click", function () { d.close(); }); });
      on(d, "close", function () {
        stack = stack.filter(function (x) { return x !== d; });
        // Toasts showing inside this dialog move back out to the next layer
        var region = $("#toasts");
        if (region && d.contains(region)) (top() || document.body).appendChild(region);
        var o = d._opener;
        if (!d._skipRestore && o && typeof o.focus === "function" && document.contains(o)) o.focus();
      });
    });
    return { open: open, top: top };
  });

  /* =========================================================================
     IN-PAGE NAVIGATION: smooth scrolling that respects reduced motion,
     and moves keyboard focus to the section you jumped to.
     ========================================================================= */
  function goTo(hash, push) {
    var id = "";
    try { id = decodeURIComponent(String(hash).replace(/^#/, "")); } catch (e) { id = String(hash).replace(/^#/, ""); }
    if (!id) return false;
    var target = document.getElementById(id);
    if (!target) return false;
    // Glide to nearby sections; jump straight to far ones (a long glide only makes you wait)
    var far = Math.abs(target.getBoundingClientRect().top) > window.innerHeight * 3;
    try { target.scrollIntoView({ behavior: Settings.reducedMotion() || far ? "instant" : "smooth", block: "start" }); }
    catch (e) { target.scrollIntoView(true); }   // older browsers without "instant"
    if (push) { try { history.pushState(null, "", "#" + id); } catch (e) {} }
    var focusEl = target;
    if (/^(SECTION|ARTICLE|MAIN|DIV)$/.test(target.tagName)) focusEl = target.querySelector("h1, h2, h3, h4") || target;
    if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(focusEl.tagName) && !focusEl.hasAttribute("tabindex")) focusEl.setAttribute("tabindex", "-1");
    try { focusEl.focus({ preventScroll: true }); } catch (e) {}
    return true;
  }
  on(document, "click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var hash = a.getAttribute("href");
    if (!hash || hash === "#") return;
    var dlg = a.closest("dialog");
    // Library documents (#library/<document>/<section>) open in the reader
    if (/^#library\//.test(hash) && Library) {
      e.preventDefault();
      var opener = a;
      if (dlg && dlg.open && dlg.id !== "reader") { opener = dlg._opener || a; dlg._skipRestore = true; dlg.close(); }
      Library.go(hash, opener);
      return;
    }
    if (dlg && dlg.open) { dlg._skipRestore = true; dlg.close(); }
    if (goTo(hash, true)) e.preventDefault();
  });

  /* =========================================================================
     CONTENTS RAIL: scroll-spy, the root line that fills as you read, and a
     copy of the contents for the narrow-screen menu. Also tells the top bar
     when it's floating over the dark hero.
     ========================================================================= */
  safe("toc", function () {
    var toc = $("#toc");
    if (!toc) return;
    var body = $("#toc-dialog-body");
    if (body) {
      var clone = toc.cloneNode(true);
      clone.removeAttribute("id");
      $$("[id]", clone).forEach(function (n) { n.removeAttribute("id"); });
      clone.setAttribute("aria-label", "Contents menu");
      var title = $(".toc-title", clone);
      if (title) title.remove();
      body.appendChild(clone);
    }
    var allLinks = $$('.toc a[href^="#"]');
    var railLinks = $$('a[href^="#"]', toc);
    var ids = railLinks.map(function (a) { return a.getAttribute("href").slice(1); });
    var sections = ids.map(function (id) { return document.getElementById(id); });
    var fill = $("#toc-fill");
    var rail = toc.closest(".rail");
    var hero = $("#top");
    var ticking = false, lastIdx = -2;
    function update() {
      ticking = false;
      if (hero) {
        var over = hero.getBoundingClientRect().bottom > 56;
        if (over) html.setAttribute("data-over-hero", ""); else html.removeAttribute("data-over-hero");
      }
      var probe = window.innerHeight * 0.3;
      var idx = -1, tops = [];
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        var top = s ? s.getBoundingClientRect().top : Infinity;
        tops.push(top);
        if (top <= probe) idx = i;
      }
      if (idx !== lastIdx) {
        lastIdx = idx;
        var activeId = idx >= 0 ? ids[idx] : "";
        allLinks.forEach(function (a) {
          var id = a.getAttribute("href").slice(1);
          var pos = ids.indexOf(id);
          if (id === activeId) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
          a.classList.toggle("is-read", pos > -1 && pos < idx);
        });
        // Keep the current link visible when the rail itself has to scroll
        if (rail && idx >= 0 && rail.scrollHeight > rail.clientHeight + 4) {
          var link = railLinks[idx];
          var y = link.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop;
          if (y < rail.scrollTop + 48 || y > rail.scrollTop + rail.clientHeight - 64) rail.scrollTop = Math.max(0, y - rail.clientHeight / 2);
        }
      }
      // Fill the root line down to the current link, easing between links as you read
      if (fill && railLinks.length) {
        var y = 0;
        if (idx >= 0) {
          var a0 = railLinks[idx], y0 = a0.offsetTop + 10;
          var y1 = idx + 1 < railLinks.length ? railLinks[idx + 1].offsetTop + 10 : y0;
          var t0 = tops[idx], t1 = idx + 1 < tops.length ? tops[idx + 1] : t0 + 1;
          var k = t1 - t0 > 0 ? clamp((probe - t0) / (t1 - t0), 0, 1) : 1;
          y = lerp(y0, y1, k);
        }
        fill.style.height = Math.max(0, y) + "px";
      }
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    on(window, "scroll", request, { passive: true });
    on(window, "resize", request);
    update();
  });

  /* =========================================================================
     SEARCH: one box for this page and the whole library.
     - Page results come from every section, sub-heading and tool here.
     - Library results come from every section of every library document.
       The library's search index loads the first time you open search.
     Full-text matching uses MiniSearch (MIT license): it forgives small typos
     and matches the start of words, so "priv" finds "privacy". It all happens
     on this device; nothing you type is sent anywhere. If MiniSearch can't
     load, a simpler built-in matcher takes over.
     To make a page section easier to find, add words to its data-keywords.
     ========================================================================= */
  safe("search", function () {
    var dlg = $("#search-dialog"), input = $("#search-input"), list = $("#search-results");
    if (!dlg || !input || !list) return;

    /* 1. Quick index of page headings: suggestions, and the fallback matcher */
    var quick = [];
    var currentPart = "";
    $$("main > *").forEach(function (node) {
      if (node.classList.contains("part-opener")) { var pn = $(".part-name", node); currentPart = pn ? pn.textContent.trim() : ""; return; }
      if (!node.classList.contains("section")) return;
      var h2 = $("h2", node);
      if (!h2) return;
      var title = h2.textContent.trim();
      quick.push({ title: title, href: "#" + node.id, ctx: currentPart, kw: (node.getAttribute("data-keywords") || "").toLowerCase(), weight: 2 });
      $$("h3, h4.tool-title", node).forEach(function (h) {
        var holder = h.id ? h : h.closest("[id]");
        if (!holder) return;
        quick.push({ title: h.textContent.trim(), href: "#" + holder.id, ctx: title, kw: "", weight: 1 });
      });
    });
    var SUGGEST = ["#quick-start", "#library", "#sacred", "#lessons", "#your-data"];
    function quickMatch(terms) {
      function score(item) {
        var t = item.title.toLowerCase(), c = item.ctx.toLowerCase(), s = 0;
        for (var i = 0; i < terms.length; i++) {
          var q = terms[i], hit = 0;
          if (t.indexOf(q) === 0) hit = 6; else if (t.indexOf(" " + q) > -1) hit = 5; else if (t.indexOf(q) > -1) hit = 4;
          else if (item.kw.indexOf(q) > -1) hit = 3;
          else if (c.indexOf(q) > -1) hit = 1;
          if (!hit) return 0;
          s += hit;
        }
        return s + item.weight * 0.1;
      }
      return quick.map(function (it) { return { it: it, s: score(it) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .map(function (r) { return { href: r.it.href, title: r.it.title, ctx: r.it.ctx, text: "", terms: terms }; });
    }

    /* 2. The full text of this page, split at sub-headings */
    var BLOCKS = "p, li, td, th, dt, dd, div, tr, h1, h2, h3, h4, h5, h6, label, button, summary, legend, caption, figcaption, blockquote, option";
    function pageChunks() {
      var out = [], range = document.createRange(), n = 0, part = "";
      $$("main > *").forEach(function (sec) {
        if (sec.classList.contains("part-opener")) { var pn = $(".part-name", sec); part = pn ? pn.textContent.trim() : ""; return; }
        if (!sec.classList.contains("section") || !sec.id) return;
        var h2 = $("h2", sec);
        if (!h2) return;
        var title = h2.textContent.trim();
        var subs = $$("h3", sec);
        function textBetween(start, end) {
          try {
            if (start) range.setStartBefore(start); else range.setStart(sec, 0);
            if (end) range.setEndBefore(end); else range.setEnd(sec, sec.childNodes.length);
            // A copy of that stretch, with a space after each block so words from neighbouring cells don't run together
            var frag = range.cloneContents();
            $$(BLOCKS, frag).forEach(function (n) { n.appendChild(document.createTextNode(" ")); });
            return frag.textContent.replace(/\s+/g, " ").trim();
          } catch (e) { return ""; }
        }
        out.push({ key: "p" + (n++), kind: "page", href: "#" + sec.id, heading: title, title: part, ctx: part, text: textBetween(null, subs[0] || null) + " " + (sec.getAttribute("data-keywords") || "") });
        subs.forEach(function (h, i) {
          var holder = h.id ? h : h.closest("[id]");
          out.push({ key: "p" + (n++), kind: "page", href: "#" + (holder ? holder.id : sec.id), heading: h.textContent.trim(), title: title, ctx: title, text: textBetween(h, subs[i + 1] || null) });
        });
      });
      return out;
    }

    /* 3. The full-text index, built the first time search opens */
    var ms = null, msFailed = false, libState = "idle", libChunks = null;
    function addLibrary(chunks) {
      var seen = {};
      ms.addAll(chunks.filter(function (c) {
        if (!c || !c.id || seen[c.id]) return false;
        seen[c.id] = 1;
        return true;
      }).map(function (c) {
        return { key: "l:" + c.id, kind: "library", href: "#library/" + c.doc + (c.slug ? "/" + c.slug : ""), heading: c.heading, title: c.title, ctx: c.title, text: c.text };
      }));
    }
    function ensureIndex() {
      if (ms || msFailed) return;
      needs("MiniSearch").then(function (MiniSearch) {
        var idx = new MiniSearch({
          idField: "key",
          fields: ["heading", "title", "text"],
          storeFields: ["kind", "href", "heading", "title", "ctx", "text"],
          searchOptions: { boost: { heading: 3, title: 1.5 }, prefix: true, fuzzy: 0.2 }
        });
        idx.addAll(pageChunks());
        ms = idx;
        if (libChunks) addLibrary(libChunks);
        if (dlg.open) render();
      }, function (err) { msFailed = true; errors.push("search: " + err.message); if (dlg.open) render(); });
    }
    function ensureLibrary(force) {
      if (!Library || (libState !== "idle" && !(force && libState === "ask"))) return;
      // On a data-saving connection, ask before downloading the library index
      var c = navigator.connection;
      if (!force && BUILD === "pwa" && c && c.saveData) { libState = "ask"; return; }
      libState = "loading";
      Library.searchChunks().then(function (chunks) {
        libChunks = chunks;
        libState = "ready";
        if (ms) addLibrary(chunks);
        if (dlg.open) render();
      }, function (err) {
        libState = err && err.message === "file" ? "file" : "unavailable";
        if (dlg.open) render();
      });
    }
    function naiveLibrary(terms) {
      if (!libChunks) return [];
      return libChunks.filter(function (c) {
        var hay = (c.heading + " " + c.title + " " + c.text).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) > -1; });
      }).map(function (c) {
        return { href: "#library/" + c.doc + (c.slug ? "/" + c.slug : ""), title: c.heading, ctx: c.title, text: c.text, terms: terms, kind: "library" };
      });
    }
    function query(raw) {
      var terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
      var page = [], lib = [], seen = {};
      if (ms) {
        var hits = ms.search(raw, { combineWith: "AND" });
        if (!hits.length) hits = ms.search(raw, { combineWith: "OR" });
        hits.forEach(function (h) {
          var key = h.href + "|" + h.heading;
          if (seen[key]) return;
          seen[key] = 1;
          var item = { href: h.href, title: h.heading, ctx: h.ctx, text: h.text, terms: (h.terms || []).concat(terms), kind: h.kind };
          if (h.kind === "page") { if (page.length < 6) page.push(item); }
          else if (lib.length < 8) lib.push(item);
        });
      } else {
        page = quickMatch(terms).slice(0, 6);
        lib = naiveLibrary(terms).slice(0, 8);
      }
      return { page: page, lib: lib };
    }

    /* 4. Snippets with the matching words marked (built from text nodes, never HTML) */
    function snippet(text, terms) {
      if (!text) return "";
      var lower = text.toLowerCase(), pos = -1;
      terms.forEach(function (t) { var p = lower.indexOf(t.toLowerCase()); if (p > -1 && (pos < 0 || p < pos)) pos = p; });
      if (pos < 0) return text.length > 150 ? text.slice(0, 150).replace(/\s+\S*$/, "") + "…" : text;
      var start = Math.max(0, pos - 60), end = Math.min(text.length, pos + 110);
      if (start > 0) { var sp = text.indexOf(" ", start); if (sp > -1 && sp < pos) start = sp + 1; }
      if (end < text.length) { var ep = text.lastIndexOf(" ", end); if (ep > pos) end = ep; }
      return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    }
    function markTerms(node, str, terms) {
      var words = terms.filter(function (t) { return t && t.length > 1; }).sort(function (a, b) { return b.length - a.length; }).map(escapeRe);
      if (!words.length) { node.textContent = str; return; }
      var re = new RegExp("(" + words.join("|") + ")", "gi"), last = 0, m;
      while ((m = re.exec(str))) {
        if (m.index > last) node.appendChild(document.createTextNode(str.slice(last, m.index)));
        node.appendChild(el("mark", null, m[0]));
        last = m.index + m[0].length;
        if (!m[0].length) re.lastIndex++;
      }
      if (last < str.length) node.appendChild(document.createTextNode(str.slice(last)));
    }

    /* 5. The results list (a listbox: arrow keys move, Enter opens) */
    var active = -1, results = [];
    function addGroup(label) { var li = el("li", "sr-group", label); li.setAttribute("role", "presentation"); list.appendChild(li); }
    function addNote(text, action) {
      var li = el("li", "empty");
      li.setAttribute("role", "presentation");
      li.appendChild(el("span", null, text));
      if (action) {
        var b = el("button", "btn btn-small btn-quiet", action.label);
        b.type = "button";
        on(b, "click", action.fn);
        li.appendChild(b);
      }
      list.appendChild(li);
    }
    function addItem(item) {
      var i = results.length;
      results.push(item);
      // Each result is an option in the list (activated by click or Enter), not a link inside one
      var li = el("li");
      li.setAttribute("role", "option");
      li.id = "sr-" + i;
      li.setAttribute("data-href", item.href);
      var t = el("span", "sr-title");
      markTerms(t, item.title, item.terms || []);
      li.appendChild(t);
      if (item.ctx && item.ctx !== item.title) li.appendChild(el("span", "sr-part", (item.kind === "library" ? "Library · " : "") + item.ctx));
      var snip = snippet(item.text, item.terms || []);
      if (snip) { var s = el("span", "sr-snippet"); markTerms(s, snip, item.terms || []); li.appendChild(s); }
      list.appendChild(li);
    }
    function render() {
      var raw = input.value.trim();
      list.textContent = "";
      results = [];
      if (!raw) {
        addGroup("Suggestions");
        SUGGEST.forEach(function (href) { for (var i = 0; i < quick.length; i++) if (quick[i].href === href) { addItem({ href: href, title: quick[i].title, ctx: quick[i].ctx }); return; } });
        var recent = Library ? Library.recent() : [];
        if (recent.length) {
          addGroup("Recently read in the library");
          recent.slice(0, 3).forEach(function (r) { addItem({ href: "#library/" + r.id, title: r.title, ctx: "", kind: "library" }); });
        }
      } else {
        var r = query(raw);
        if (r.page.length) { addGroup("On this page"); r.page.forEach(addItem); }
        if (r.lib.length) { addGroup("In the library"); r.lib.forEach(addItem); }
        if (libState === "loading") addNote("Loading the library’s search index…");
        else if (libState === "ask") addNote("You’re saving data, so the library isn’t searched yet.", { label: "Search the library too (about " + (Library ? Library.searchSize() : "0.7 MB") + ")", fn: function () { ensureLibrary(true); render(); } });
        else if (libState === "unavailable") addNote("The library can’t be searched right now: it hasn’t been saved on this device yet. Connect to the internet once, or save it under Offline and install.");
        else if (libState === "file") addNote("To search the library, open the single-file edition or the website version.");
        if (!results.length && libState !== "loading") addNote("Nothing matches “" + raw + "”. Try a shorter or different word.");
      }
      active = results.length ? 0 : -1;
      sync();
      input.setAttribute("aria-expanded", results.length ? "true" : "false");
    }
    function sync() {
      $$("li[role=option]", list).forEach(function (li, i) { li.setAttribute("aria-selected", i === active ? "true" : "false"); });
      if (active >= 0) input.setAttribute("aria-activedescendant", "sr-" + active); else input.removeAttribute("aria-activedescendant");
    }
    function move(delta) {
      if (!results.length) return;
      active = (active + delta + results.length) % results.length;
      sync();
      var cur = $("#sr-" + active);
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    }
    function activate(item) {
      dlg._skipRestore = true;
      var opener = dlg._opener;
      dlg.close();
      if (/^#library\//.test(item.href) && Library) Library.go(item.href, opener);
      else goTo(item.href, true);
    }
    on(input, "input", render);
    on(list, "click", function (e) {
      var li = e.target && e.target.closest ? e.target.closest("li[role=option]") : null;
      if (!li) return;
      var i = Number(li.id.slice(3));
      if (results[i]) activate(results[i]);
    });
    on(input, "keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && results[active]) activate(results[active]); }
    });
    on(dlg, "aice:open", function () {
      input.value = "";
      ensureIndex();
      ensureLibrary(false);
      render();
      setTimeout(function () { input.focus(); }, 10);
    });
    function isTyping(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
    on(document, "keydown", function (e) {
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k === "k" || k === "K")) {
        e.preventDefault();
        if (Dialogs && !document.querySelector("dialog.sheet-reader.is-presenting")) Dialogs.open("search-dialog");
        return;
      }
      if (k === "/" && !isTyping(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        if (Dialogs) Dialogs.open("search-dialog");
      }
    });
    var kbd = $("#search-kbd");
    if (kbd && /Mac|iPhone|iPad/.test(navigator.userAgent || "")) kbd.textContent = "⌘ K";
  });

  /* =========================================================================
     READ ALOUD: uses the browser's own speech engine (offline on most
     systems). Buttons stay hidden where speech isn't available. Long text is
     spoken sentence by sentence so it doesn't cut off.
     ========================================================================= */
  safe("listen", function () {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") return;
    var buttons = $$(".listen[data-listen]");
    var current = null, queue = [];
    function setBtn(b, playing) {
      b.setAttribute("aria-pressed", playing ? "true" : "false");
      var span = $("span", b);
      if (span) span.textContent = playing ? "Stop" : "Listen";
    }
    function stop() {
      queue = [];
      try { window.speechSynthesis.cancel(); } catch (e) {}
      if (current) setBtn(current, false);
      current = null;
    }
    function textOf(sec) {
      var c = sec.cloneNode(true);
      $$("button, svg, input, select, .sr-only, .js-only, .tool-actions, .print-only, .db-axis, details:not([open]) > :not(summary)", c).forEach(function (n) { n.remove(); });
      return c.textContent.replace(/\s+/g, " ").trim();
    }
    function speakNext() {
      if (!queue.length) { if (current) setBtn(current, false); current = null; return; }
      var u = new SpeechSynthesisUtterance(queue.shift());
      u.lang = html.lang || "en";
      u.rate = 1;
      u.onend = speakNext;
      u.onerror = function () { stop(); };
      window.speechSynthesis.speak(u);
    }
    buttons.forEach(function (b) {
      b.hidden = false;
      setBtn(b, false);
      on(b, "click", function () {
        if (current === b) { stop(); return; }
        stop();
        var sec = document.getElementById(b.getAttribute("data-listen"));
        if (!sec) return;
        var text = textOf(sec);
        queue = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
        current = b;
        setBtn(b, true);
        try { speakNext(); } catch (e) { stop(); toast("Read-aloud isn't available in this browser."); }
      });
    });
    on(window, "pagehide", stop);
    // Other tools (the reader) ask for quiet when they close
    on(document, "aice:stop-speech", stop);
  });

  /* ---------- Role picker ("Find your path") ---------- */
  safe("roles", function () {
    var picker = $("#role-picker");
    if (!picker) return;
    var buttons = $$("button[data-role]", picker), paths = $$(".role-path");
    function select(role, save, focus) {
      var found = buttons.some(function (b) { return b.getAttribute("data-role") === role; });
      if (!found) role = "teacher";
      buttons.forEach(function (b) {
        var sel = b.getAttribute("data-role") === role;
        b.setAttribute("aria-checked", sel ? "true" : "false");
        b.tabIndex = sel ? 0 : -1;
        if (sel && focus) b.focus();
      });
      paths.forEach(function (p) { p.hidden = p.getAttribute("data-role") !== role; });
      if (save) Store.set("role", role);
    }
    buttons.forEach(function (b, i) {
      on(b, "click", function () { select(b.getAttribute("data-role"), true); });
      on(b, "keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = buttons[(i + 1) % buttons.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = buttons[(i - 1 + buttons.length) % buttons.length];
        if (e.key === "Home") n = buttons[0];
        if (e.key === "End") n = buttons[buttons.length - 1];
        if (n) { e.preventDefault(); select(n.getAttribute("data-role"), true, true); }
      });
    });
    select(Store.get("role", "teacher"), false);
    Resets.role = function () { select("teacher", false); };
  });

  /* ---------- Quick start checklist ---------- */
  safe("quickstart", function () {
    var boxes = $$("#quickstart input[data-qs]");
    if (!boxes.length) return;
    var meter = $("#qs-meter"), status = $("#qs-status");
    function render() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      if (meter) {
        meter.setAttribute("aria-valuenow", String(n));
        var f = $(".meter-fill", meter);
        if (f) f.style.width = (n / boxes.length * 100) + "%";
      }
      if (status) status.textContent = n + " of " + boxes.length + " done";
    }
    var saved = Store.get("quickstart", []);
    boxes.forEach(function (b, i) {
      b.checked = !!saved[i];
      on(b, "change", function () {
        var s = boxes.map(function (x) { return x.checked; });
        Store.set("quickstart", s);
        render();
        if (s.every(Boolean)) toast("All three steps done. Welcome to the circle.");
      });
    });
    render();
    Resets.quickstart = function () { boxes.forEach(function (b) { b.checked = false; }); render(); };
  });

  /* ---------- Question ladder builder (Lesson 2) ----------
     Each rung is a sentence template. Edit TEMPLATES to change the wording. */
  safe("ladder", function () {
    var input = $("#ladder-topic"), qs = $$("#ladder-list .rung-q");
    if (!input || qs.length !== 5) return;
    var TEMPLATES = [
      function (t) { return "What is " + t + ", and what are its key parts?"; },
      function (t) { return "How does " + t + " connect to other things we've studied, or to life in our community?"; },
      function (t) { return "How might a scientist, an artist and a community elder each see " + t + " differently?"; },
      function (t) { return "What assumptions sit underneath the way " + t + " is usually taught or explained?"; },
      function (t) { return "If you explained " + t + " through the lens of fairness or justice, what connections would you make?"; }
    ];
    on(input, "input", function () {
      var t = input.value.replace(/\s+/g, " ").trim() || "this topic";
      qs.forEach(function (q, i) { q.textContent = TEMPLATES[i](t); });
    });
  });

  /* ---------- Copy buttons: any button with data-copy="element-id" ---------- */
  safe("copy", function () {
    $$("[data-copy]").forEach(function (btn) {
      on(btn, "click", function () {
        var target = document.getElementById(btn.getAttribute("data-copy"));
        if (!target) return;
        var text;
        if (target.matches("ol, ul")) {
          text = $$("li", target).map(function (li, i) {
            var r = $(".rung", li), q = $(".rung-q", li);
            return (i + 1) + ". " + (r && q ? r.textContent.trim() + ": " + q.textContent.trim() : li.textContent.replace(/\s+/g, " ").trim());
          }).join("\n");
        } else {
          text = (target.innerText || target.textContent || "").trim();
        }
        copyText(text).then(function (ok) {
          toast(ok ? "Copied to the clipboard." : "Couldn't copy. Select the text and copy it yourself.");
        });
      });
    });
  });

  /* ---------- Print one part of the page (a lesson, the agreement, a library document) ----------
     Printer.print(element, { title, note }) copies the element into a print-only
     area, so only that part prints. Buttons with data-print="id" use it too. */
  var Printer = safe("print", function () {
    var root = null;
    function cleanup() {
      html.removeAttribute("data-printing");
      if (root) { root.remove(); root = null; }
    }
    on(window, "afterprint", cleanup);
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var fn = function (e) { if (!e.matches) cleanup(); };
      if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn);
    }
    function print(target, opts) {
      if (!target) return;
      opts = opts || {};
      cleanup();
      root = el("div");
      root.id = "print-root";
      if (opts.title) root.appendChild(el("p", "print-title", opts.title));
      if (opts.note) root.appendChild(el("p", "print-note", opts.note));
      var copy = target.cloneNode(true);
      copy.removeAttribute("id");
      $$("[id]", copy).forEach(function (n) { n.removeAttribute("id"); });
      $$(".btn, .listen, .sr-only", copy).forEach(function (n) { n.remove(); });
      root.appendChild(copy);
      document.body.appendChild(root);
      html.setAttribute("data-printing", "");
      try { window.print(); } catch (e) { cleanup(); }
    }
    $$("[data-print]").forEach(function (btn) {
      on(btn, "click", function () { print(document.getElementById(btn.getAttribute("data-print"))); });
    });
    return { print: print };
  });

  /* =========================================================================
     SACRED CHECK (from teacher-resources/ethical-framework.md)
     Rule from the framework: every area 3 or more, total at least 18 of 30.
     Added in 2.0: two harm checks (opt-out and reversibility), a "proceed with
     care" band for totals of 18 to 23, a decision log and a text export.
     ========================================================================= */
  safe("sacred", function () {
    var form = $("#sacred-form");
    if (!form) return;
    var AREAS = [["S", "Student agency"], ["A", "Authentic learning"], ["C", "Care for wellbeing"], ["R", "Responsibility to community"], ["E", "Educational purpose"], ["D", "Dignity of the future"]];
    var barsEl = $("#sacred-bars"), statusEl = $("#sacred-status"), logEl = $("#sacred-log"), logCount = $("#sacred-log-count"), logEmpty = $("#sacred-log-empty");
    function read() {
      var scores = {};
      AREAS.forEach(function (a) {
        var v = form.querySelector('input[name="' + a[0] + '"]:checked');
        scores[a[0]] = v ? Number(v.value) : null;
      });
      return {
        activity: ($("#sacred-activity").value || "").trim(),
        scores: scores,
        optout: !!form.elements.optout.checked,
        reversible: !!form.elements.reversible.checked
      };
    }
    function evaluate(d) {
      var answered = 0, total = 0, low = [], lowest = null;
      AREAS.forEach(function (a) {
        var v = d.scores[a[0]];
        if (v === null) return;
        answered++; total += v;
        if (v < 3) low.push(a[1]);
        if (!lowest || v < lowest.v) lowest = { name: a[1], v: v };
      });
      if (answered < AREAS.length) return { state: "empty", answered: answered, total: total };
      if (low.length) return { state: "stop", total: total, low: low };
      if (!d.optout || !d.reversible) return { state: "harm", total: total, optout: d.optout, reversible: d.reversible };
      if (total < 24) return { state: "care", total: total, lowest: lowest };
      return { state: "go", total: total };
    }
    var LABEL = { stop: "Pause and redesign", harm: "Fix the harm checks first", care: "Proceed with care", go: "Ready to proceed" };
    function statusParts(r) {
      if (r.state === "empty") return { cls: "status-empty", ic: "i-info", title: "Score all six areas to see a result.", text: r.answered + " of 6 scored so far. Rule of thumb from the framework: every area at 3 or more, and a total of at least 18 out of 30." };
      if (r.state === "stop") return { cls: "status-stop", ic: "i-stop", title: LABEL.stop, text: listJoin(r.low) + " scored below 3. Change the activity until every area reaches 3, or offer a non-AI path. Total " + r.total + " of 30." };
      if (r.state === "harm") {
        var missing = [];
        if (!r.optout) missing.push("not every student can opt out without penalty");
        if (!r.reversible) missing.push("it can't easily be stopped or undone");
        return { cls: "status-care", ic: "i-alert", title: LABEL.harm, text: "The scores pass (" + r.total + " of 30), but " + listJoin(missing) + ". Fix that before you begin." };
      }
      if (r.state === "care") return { cls: "status-care", ic: "i-info", title: LABEL.care, text: "Every area passes, total " + r.total + " of 30. Keep an eye on the lowest area: " + r.lowest.name + " (" + r.lowest.v + ")." };
      return { cls: "status-go", ic: "i-check-circle", title: LABEL.go, text: "Total " + r.total + " of 30, every area at 3 or more, and both harm checks pass. Check in with students afterward." };
    }
    function render() {
      var d = read(), r = evaluate(d);
      barsEl.textContent = "";
      AREAS.forEach(function (a) {
        var v = d.scores[a[0]];
        var isLow = v !== null && v < 3;
        var row = el("div", "bar-row" + (isLow ? " is-low" : ""));
        var label = el("span", "bar-label");
        if (isLow) label.appendChild(icon("i-alert"));
        label.appendChild(document.createTextNode(a[1] + (isLow ? ", below 3" : "")));
        var track = el("span", "bar-track");
        var fill = el("span", "bar-fill");
        fill.style.width = (v ? v / 5 * 100 : 0) + "%";
        var th = el("span", "bar-threshold");
        th.style.left = "60%";
        track.appendChild(fill);
        track.appendChild(th);
        var val = el("span", "bar-value", v === null ? "–" : v + " of 5");
        row.setAttribute("role", "img");
        row.setAttribute("aria-label", a[1] + ": " + (v === null ? "not scored" : v + " of 5"));
        row.appendChild(label); row.appendChild(track); row.appendChild(val);
        barsEl.appendChild(row);
      });
      var p = statusParts(r);
      statusEl.className = "status " + p.cls;
      statusEl.textContent = "";
      statusEl.appendChild(icon(p.ic));
      var box = el("div");
      box.appendChild(el("p", "status-title", p.title));
      box.appendChild(el("p", "status-text", p.text));
      statusEl.appendChild(box);
      return { d: d, r: r };
    }
    function summary(d, r) {
      var lines = ["SACRED check, AI Co-Evolution in Education", "Activity: " + (d.activity || "Untitled activity"), "Date: " + today(), ""];
      AREAS.forEach(function (a) { lines.push(a[1] + ": " + (d.scores[a[0]] === null ? "not scored" : d.scores[a[0]] + " of 5")); });
      lines.push("Total: " + r.total + " of 30");
      lines.push("Any student can opt out without penalty: " + (d.optout ? "yes" : "no"));
      lines.push("Easy to stop and undo: " + (d.reversible ? "yes" : "no"));
      lines.push("Result: " + (LABEL[r.state] || "Incomplete"));
      return lines.join("\n");
    }
    function renderLog() {
      var log = Store.get("sacredLog", []);
      if (!Array.isArray(log)) log = [];
      logEl.textContent = "";
      log.forEach(function (entry, i) {
        var li = el("li");
        var left = el("span");
        left.appendChild(el("strong", null, entry.activity || "Untitled activity"));
        left.appendChild(document.createTextNode(" "));
        left.appendChild(el("span", "log-meta", entry.date + ", " + entry.total + " of 30, " + (LABEL[entry.state] || "")));
        var rm = el("button", "btn btn-small btn-quiet", "Remove");
        rm.type = "button";
        rm.setAttribute("aria-label", "Remove " + (entry.activity || "untitled activity") + " from the log");
        on(rm, "click", function () {
          var cur = Store.get("sacredLog", []);
          cur.splice(i, 1);
          if (cur.length) Store.set("sacredLog", cur); else Store.remove("sacredLog");
          renderLog();
        });
        li.appendChild(left); li.appendChild(rm);
        logEl.appendChild(li);
      });
      if (logCount) logCount.textContent = "(" + log.length + ")";
      if (logEmpty) logEmpty.hidden = log.length > 0;
    }
    on(form, "change", render);
    on(form, "input", render);
    on(form, "submit", function (e) { e.preventDefault(); });
    on(form, "reset", function () { setTimeout(render, 0); });
    on($("#sacred-save"), "click", function () {
      var x = render();
      if (x.r.state === "empty") { toast("Score all six areas first."); return; }
      var log = Store.get("sacredLog", []);
      if (!Array.isArray(log)) log = [];
      log.unshift({ activity: x.d.activity, date: today(), total: x.r.total, state: x.r.state, scores: x.d.scores, optout: x.d.optout, reversible: x.d.reversible });
      if (log.length > 50) log.length = 50;
      if (Store.set("sacredLog", log)) { toast("Saved to your decision log on this device."); var w = $("#sacred-log-wrap"); if (w) w.open = true; }
      else toast("This browser isn't allowing storage, so the log can't be saved. Try Download instead.");
      renderLog();
    });
    on($("#sacred-download"), "click", function () {
      var x = render();
      if (x.r.state === "empty") { toast("Score all six areas first."); return; }
      download("sacred-check.txt", summary(x.d, x.r));
    });
    render();
    renderLog();
    Resets.sacredLog = renderLog;
  });

  /* =========================================================================
     CLASS AI AGREEMENT BUILDER (from templates/class-ai-agreement.md)
     Promises live in the HTML as checkboxes with data-promise text.
     To add a promise, add another <label class="check-row"> to a band list.
     ========================================================================= */
  safe("agreement", function () {
    var tool = $("#agreement-tool"), preview = $("#agreement-preview");
    if (!tool || !preview) return;
    var bandInputs = $$('input[name="band"]', tool), lists = $$(".band-list", tool);
    var nameInput = $("#agreement-class"), customInput = $("#agreement-custom"), customList = $("#agreement-custom-list");
    var TITLES = { k5: "Our classroom AI promise", "68": "Our AI collaboration code", "912": "Our AI ethics and collaboration charter" };
    var SUBS = { k5: "We are learning to use AI kindly, safely and wisely.", "68": "We are pioneers of human–AI collaboration.", "912": "We are architects of the future relationship between human and artificial intelligence." };
    var PLEDGE = { k5: "I promise to be a careful, kind AI learner.", "68": "I commit to this agreement and to growing as a conscious AI collaborator.", "912": "I commit to this charter and to helping our community use AI with integrity." };
    var blank = function () { return { band: "68", name: "", off: { k5: [], "68": [], "912": [] }, custom: [] }; };
    var state = Store.get("agreement", null);
    if (!state || typeof state !== "object") state = blank();
    state.off = state.off || { k5: [], "68": [], "912": [] };
    state.custom = Array.isArray(state.custom) ? state.custom : [];
    var saveTimer = 0;
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { Store.set("agreement", state); }, 300);
    }
    function applyState() {
      bandInputs.forEach(function (i) { i.checked = i.value === state.band; });
      nameInput.value = state.name || "";
      lists.forEach(function (l) {
        var band = l.getAttribute("data-band");
        l.hidden = band !== state.band;
        var off = state.off[band] || [];
        $$("input[data-promise]", l).forEach(function (cb) { cb.checked = off.indexOf(cb.getAttribute("data-promise")) === -1; });
      });
      renderCustom();
      renderPreview();
    }
    function renderCustom() {
      customList.textContent = "";
      state.custom.forEach(function (text, i) {
        var li = el("li");
        li.appendChild(el("span", null, text));
        var rm = el("button", "btn btn-small btn-quiet", "Remove");
        rm.type = "button";
        rm.setAttribute("aria-label", "Remove promise: " + text);
        on(rm, "click", function () { state.custom.splice(i, 1); save(); renderCustom(); renderPreview(); });
        li.appendChild(rm);
        customList.appendChild(li);
      });
    }
    function chosen() {
      var list = lists.filter(function (l) { return l.getAttribute("data-band") === state.band; })[0];
      var out = list ? $$("input[data-promise]", list).filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.getAttribute("data-promise"); }) : [];
      return out.concat(state.custom);
    }
    function renderPreview() {
      preview.textContent = "";
      preview.appendChild(el("h4", null, TITLES[state.band]));
      preview.appendChild(el("p", "ap-sub", (state.name ? state.name + ". " : "") + SUBS[state.band]));
      var ul = el("ul");
      var items = chosen();
      if (!items.length) ul.appendChild(el("li", null, "Choose at least one promise."));
      items.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      preview.appendChild(ul);
      preview.appendChild(el("p", "ap-sub", "“" + PLEDGE[state.band] + "”"));
      var sign = el("div", "ap-sign");
      ["Student name", "Signature and date", "Teacher", "Date"].forEach(function (t) { sign.appendChild(el("p", null, t)); });
      preview.appendChild(sign);
    }
    function asText() {
      var lines = [TITLES[state.band], (state.name ? state.name + ". " : "") + SUBS[state.band], ""];
      chosen().forEach(function (t) { lines.push("- " + t); });
      lines.push("", "“" + PLEDGE[state.band] + "”", "", "Student name: ____________________   Signature and date: ____________________", "Teacher: ____________________   Date: ____________________", "", "Made with the AI Co-Evolution in Education agreement builder.");
      return lines.join("\n");
    }
    bandInputs.forEach(function (i) { on(i, "change", function () { if (i.checked) { state.band = i.value; save(); applyState(); } }); });
    on(nameInput, "input", function () { state.name = nameInput.value.trim(); save(); renderPreview(); });
    lists.forEach(function (l) {
      var band = l.getAttribute("data-band");
      $$("input[data-promise]", l).forEach(function (cb) {
        on(cb, "change", function () {
          var off = state.off[band] || (state.off[band] = []);
          var p = cb.getAttribute("data-promise");
          var at = off.indexOf(p);
          if (cb.checked && at > -1) off.splice(at, 1);
          if (!cb.checked && at === -1) off.push(p);
          save(); renderPreview();
        });
      });
    });
    function addCustom() {
      var t = customInput.value.replace(/\s+/g, " ").trim();
      if (!t) { customInput.focus(); return; }
      state.custom.push(t.slice(0, 160));
      customInput.value = "";
      save(); renderCustom(); renderPreview();
      announce("Promise added.");
    }
    on($("#agreement-add"), "click", addCustom);
    on(customInput, "keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
    on($("#agreement-download"), "click", function () { download("class-ai-agreement.txt", asText()); });
    on($("#agreement-reset"), "click", function () { state = blank(); Store.remove("agreement"); applyState(); toast("Agreement reset to the template."); });
    applyState();
    Resets.agreement = function () { state = blank(); applyState(); };
  });

  /* ---------- AI contribution statement ---------- */
  safe("disclose", function () {
    var form = $("#disclose-form"), out = $("#d-output");
    if (!form || !out) return;
    function render() {
      var tool = tidy($("#d-tool").value), mine = tidy($("#d-mine").value), changed = tidy($("#d-changed").value), learned = tidy($("#d-learned").value);
      var uses = $$(".chip-checks input:checked", form).map(function (i) { return i.value; });
      if (!tool && !uses.length && !mine && !changed && !learned) { out.textContent = "Fill in the fields to build your statement."; return; }
      var parts = ["I used " + (tool || "an AI tool") + (uses.length ? " to " + listJoin(uses) : "") + "."];
      if (mine) parts.push("I did this myself: " + lowerFirst(mine) + ".");
      if (changed) parts.push("I changed or rejected: " + lowerFirst(changed) + ".");
      parts.push("The ideas I chose and the final voice are mine.");
      if (learned) parts.push("What I learned: " + lowerFirst(learned) + ".");
      out.textContent = parts.join(" ");
    }
    on(form, "input", render);
    on(form, "change", render);
    on(form, "submit", function (e) { e.preventDefault(); });
  });

  /* ---------- Reflection prompt deck: reads its prompts from the HTML list ---------- */
  safe("deck", function () {
    var sel = $("#deck-family"), drawBtn = $("#deck-draw");
    if (!sel || !drawBtn) return;
    var fams = $$("#deck-families .deck-fam").map(function (f) {
      return {
        name: f.getAttribute("data-family"),
        sets: $$(".deck-set", f).map(function (s) { return { name: s.getAttribute("data-set"), qs: $$("li", s).map(function (li) { return li.textContent.trim(); }) }; })
      };
    });
    fams.forEach(function (f) { var o = el("option", null, f.name); o.value = f.name; sel.appendChild(o); });
    var last = "";
    on(drawBtn, "click", function () {
      var pool = [];
      fams.forEach(function (f) {
        if (sel.value !== "all" && sel.value !== f.name) return;
        f.sets.forEach(function (s) { s.qs.forEach(function (q) { pool.push({ f: f.name, s: s.name, q: q }); }); });
      });
      if (!pool.length) return;
      var pick, guard = 0;
      do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pick.q === last && pool.length > 1 && guard++ < 12);
      last = pick.q;
      $("#deck-card-family").textContent = pick.f + ": " + pick.s;
      $("#deck-card-q").textContent = pick.q;
    });
  });

  /* ---------- Quest scoring (rules from overlay/gamification/schema/scoring.json) ---------- */
  safe("xp", function () {
    var form = $("#xp-form"), out = $("#xp-output");
    if (!form || !out) return;
    function render() {
      var base = clamp(Math.round(Number($("#xp-base").value) || 0), 0, 500);
      var sofar = clamp(Math.round(Number($("#xp-today").value) || 0), 0, 2000);
      var mults = $$('input[name="mult"]:checked', form).map(function (i) { return Number(i.value); });
      var factor = mults.reduce(function (a, m) { return a * m; }, 1);
      var xp = Math.round(base * factor);
      var text = base + mults.map(function (m) { return " × " + m; }).join("") + " = " + xp + " XP. Virtues: Stewardship 3 × 1.4 = 4.2, Care 2 × 1.3 = 2.6.";
      if (sofar + xp > 300) text += " That would bring today's total to " + (sofar + xp) + " XP, past the 300 XP soft cap. Rest is part of the game; the next quest can wait until tomorrow.";
      out.textContent = text;
    }
    on(form, "input", render);
    on(form, "change", render);
    on(form, "submit", function (e) { e.preventDefault(); });
    render();
  });

  /* ---------- Gentle rest reminder (safety.json: rest prompt every 45 minutes); off by default ---------- */
  safe("rest", function () {
    var t = $("#rest-toggle");
    if (!t) return;
    var timer = 0;
    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        toast("You've been here 45 minutes. Stretch, sip some water, and look at something far away.", { sticky: true, action: "Thanks" });
      }, 45 * 60 * 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }
    t.checked = !!Store.get("rest", false);
    if (t.checked) startTimer();
    on(t, "change", function () {
      if (t.checked) { startTimer(); Store.set("rest", true); toast("Rest reminders are on for this page."); }
      else { stopTimer(); Store.remove("rest"); toast("Rest reminders are off."); }
    });
    Resets.rest = function () { t.checked = false; stopTimer(); };
  });

  /* ---------- Footprint estimator. Ranges, not certainties. ---------- */
  /* =========================================================================
     FOOTPRINT: a class's AI use, estimated with the open EcoLogits method by
     GenAI Impact (ecologits.ai, "LLM inference" methodology):
       energy per answer token, per GPU   f_E = alpha·e^(beta·B)·P + gamma   (Wh; P = billions of parameters in use)
       GPUs the model needs                memory = 1.2 × P × 2 GB, in 80 GB H100s, rounded up to 1, 2, 4, 8…
       time to write the answer            tokens × (latA·P + latB·B + latC) seconds
       the rest of the server              time × 1.2 kW × (GPUs / 8) ÷ B
       the data center                     × PUE
     with B = 64 answers being written at once. Training, making the hardware,
     networks and people's own devices are left out. Every assumption is in MODEL. */
  function fpWhPerAnswer(params, tokens) {
    var M = { alpha: 1.17e-6, beta: -1.12e-2, gamma: 4.05e-5, batch: 64, latA: 6.78e-4, latB: 3.12e-4, latC: 1.94e-2, serverW: 1200, gpusPerServer: 8, gpuGb: 80, pue: 1.2 };
    var perToken = M.alpha * Math.exp(M.beta * M.batch) * params + M.gamma;
    var gpus = Math.pow(2, Math.ceil(Math.log(Math.max(1, (1.2 * params * 2) / M.gpuGb)) / Math.LN2 - 1e-9));
    var gpuWh = tokens * perToken * gpus;
    var seconds = tokens * (M.latA * params + M.latB * M.batch + M.latC);
    var serverWh = seconds * M.serverW * (gpus / M.gpusPerServer) / M.batch / 3600;
    return (gpuWh + serverWh) * M.pue;
  }
  safe("footprint", function () {
    var form = $("#fp-form");
    if (!form) return;
    var WATER_LOW_ML = 0.26;   // Google: median Gemini app text prompt, data-center cooling (August 2025)
    var WATER_HIGH_ML = 45;    // Mistral AI: one 400-token Le Chat answer, life-cycle study (July 2025)
    function num(id, max) { return clamp(Math.round(Number($(id).value) || 0), 0, max); }
    function litres(ml) { return ml >= 1000 ? nf1.format(ml / 1000) + " L" : nf0.format(Math.round(ml)) + " mL"; }
    function render() {
      var n = num("#fp-students", 2000) * num("#fp-prompts", 200) * num("#fp-lessons", 200);
      var per = fpWhPerAnswer(Number($("#fp-model").value) || 70, Number($("#fp-length").value) || 500), wh = n * per;
      $("#fp-total").textContent = nf0.format(n);
      $("#fp-energy").textContent = wh >= 1000 ? nf1.format(wh / 1000) + " kWh" : nf0.format(Math.round(wh)) + " Wh";
      $("#fp-energy-label").textContent = "electricity: about " + (per < 1 ? per.toFixed(2) : nf1.format(per)) + " Wh per answer, or a 10\u00a0W LED bulb burning for " + nf0.format(Math.round(wh / 10)) + (Math.round(wh / 10) === 1 ? " hour" : " hours");
      var lo = n * WATER_LOW_ML, hi = n * WATER_HIGH_ML;
      $("#fp-water").textContent = hi >= 1000 && lo < 1000 ? nf1.format(lo / 1000) + " to " + nf0.format(Math.round(hi / 1000)) + " L" : litres(lo) + " to " + litres(hi);
      $("#fp-water-label").textContent = "water: from the data center's cooling alone, to a full life-cycle count";
    }
    on(form, "input", render);
    on(form, "change", render);
    on(form, "submit", function (e) { e.preventDefault(); });
    render();
  });

  /* =========================================================================
     SYSTEM MAP: builds a 3 × 3 map from the <article data-branch> blocks.
     The center is the core vision; the eight branches sit around it.
     Keyboard: arrow keys move between branches.
     ========================================================================= */
  safe("sysmap", function () {
    var grid = $("#sysmap-grid"), detail = $("#sysmap-detail");
    var arts = $$("#branches .branch");
    if (!grid || !detail || !arts.length) return;
    var ORDER = ["play", "wellbeing", "adaptive", "decentral", "core", "restore", "arch", "timeline", "nodes"];
    var nodes = [];
    ORDER.forEach(function (key, i) {
      var art = arts.filter(function (a) { return a.getAttribute("data-branch") === key; })[0];
      if (!art) return;
      var b = el("button", "sysmap-node" + (key === "core" ? " is-center" : ""));
      b.type = "button";
      b.id = "tab-" + key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "sysmap-detail");
      b.setAttribute("aria-selected", "false");
      b.tabIndex = -1;
      b.style.gridRow = String(Math.floor(i / 3) + 1);
      b.style.gridColumn = String((i % 3) + 1);
      b.appendChild(el("span", null, art.getAttribute("data-short")));
      b.appendChild(el("span", "node-status", art.getAttribute("data-status")));
      grid.appendChild(b);
      nodes.push({ b: b, art: art, key: key, i: i });
    });
    function select(n, focus) {
      nodes.forEach(function (x) {
        var sel = x === n;
        x.b.setAttribute("aria-selected", sel ? "true" : "false");
        x.b.tabIndex = sel ? 0 : -1;
      });
      detail.textContent = "";
      var status = n.art.getAttribute("data-status") || "";
      var chip = el("span", "status-chip " + (/built|started/i.test(status) ? "chip-go" : "chip-wait"), "Status: " + status);
      detail.appendChild(chip);
      Array.prototype.forEach.call(n.art.children, function (c) { detail.appendChild(c.cloneNode(true)); });
      detail.setAttribute("aria-labelledby", n.b.id);
      if (focus) n.b.focus();
    }
    nodes.forEach(function (n) {
      on(n.b, "click", function () { select(n); });
      on(n.b, "keydown", function (e) {
        var row = Math.floor(n.i / 3), col = n.i % 3, t = null;
        if (e.key === "ArrowRight") t = row * 3 + Math.min(2, col + 1);
        if (e.key === "ArrowLeft") t = row * 3 + Math.max(0, col - 1);
        if (e.key === "ArrowDown") t = Math.min(2, row + 1) * 3 + col;
        if (e.key === "ArrowUp") t = Math.max(0, row - 1) * 3 + col;
        if (e.key === "Home") t = 0;
        if (e.key === "End") t = 8;
        if (t === null) return;
        e.preventDefault();
        var target = nodes.filter(function (x) { return x.i === t; })[0];
        if (target) select(target, true);
      });
    });
    var core = nodes.filter(function (x) { return x.key === "core"; })[0] || nodes[0];
    select(core);
  });

  /* =========================================================================
     READINESS COMPASS (from institutional/implementation-roadmap.md)
     Four areas of 25 points. Answers save on this device.
     ========================================================================= */
  safe("readiness", function () {
    var form = $("#ready-form");
    if (!form) return;
    var domains = $$(".ready-domain", form);
    var inputs = $$("input", form);
    var totalEl = $("#ready-total"), bandEl = $("#ready-band"), barsEl = $("#ready-bars"), nextEl = $("#ready-next");
    var saved = Store.get("readiness", null);
    if (saved && Array.isArray(saved.checked) && saved.checked.length === inputs.length) {
      inputs.forEach(function (inp, i) { inp.checked = !!saved.checked[i]; });
    }
    function labelText(inp) {
      var span = inp.parentNode.querySelector("span");
      if (!span) return "";
      var c = span.cloneNode(true);
      $$(".pts", c).forEach(function (p) { p.remove(); });
      return c.textContent.replace(/\s+/g, " ").trim();
    }
    function band(total, any) {
      if (!any) return "Tick what's true today to see where to begin.";
      if (total >= 80) return "Ready for full implementation. Go ahead with confidence, and keep the exit ramps.";
      if (total >= 60) return "A good foundation. Close the gaps below before a full rollout.";
      if (total >= 40) return "Significant preparation needed. Focus on foundations first.";
      return "Extensive groundwork needed. Start with culture and infrastructure.";
    }
    function compute() {
      var total = 0;
      var per = domains.map(function (d) {
        var pts = $$("input:checked", d).reduce(function (a, i) { return a + Number(i.value); }, 0);
        total += pts;
        return { name: d.getAttribute("data-domain"), pts: pts, d: d };
      });
      return { total: total, per: per, any: inputs.some(function (i) { return i.checked; }) };
    }
    function render(save) {
      var c = compute();
      totalEl.textContent = String(c.total);
      bandEl.textContent = band(c.total, c.any);
      barsEl.textContent = "";
      c.per.forEach(function (p) {
        var row = el("div", "bar-row");
        row.setAttribute("role", "img");
        row.setAttribute("aria-label", p.name + ": " + p.pts + " of 25");
        row.appendChild(el("span", "bar-label", p.name));
        var track = el("span", "bar-track"), fill = el("span", "bar-fill");
        fill.style.width = (p.pts / 25 * 100) + "%";
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(el("span", "bar-value", p.pts + "/25"));
        barsEl.appendChild(row);
      });
      nextEl.textContent = "";
      if (c.any) {
        var weakest = c.per.slice().sort(function (a, b) { return a.pts - b.pts; })[0];
        var todo = $$('input[type="checkbox"]:not(:checked)', weakest.d).sort(function (a, b) { return Number(b.value) - Number(a.value); }).slice(0, 3).map(labelText);
        if (todo.length) {
          nextEl.appendChild(el("p", "status-title", "Your next three moves, from your lowest area (" + weakest.name.toLowerCase() + ")"));
          var ul = el("ul");
          todo.forEach(function (t) { ul.appendChild(el("li", null, t)); });
          nextEl.appendChild(ul);
        }
      }
      if (save) Store.set("readiness", { checked: inputs.map(function (i) { return i.checked; }) });
      return c;
    }
    on(form, "change", function () { render(true); });
    on(form, "submit", function (e) { e.preventDefault(); });
    on(form, "reset", function () { setTimeout(function () { Store.remove("readiness"); render(false); }, 0); });
    on($("#ready-download"), "click", function () {
      var c = render(false);
      var lines = ["School AI readiness compass, AI Co-Evolution in Education", "Date: " + today(), "", "Total: " + c.total + " of 100", band(c.total, c.any), ""];
      c.per.forEach(function (p) { lines.push(p.name + ": " + p.pts + " of 25"); });
      lines.push("", "Ticked:");
      inputs.filter(function (i) { return i.checked; }).forEach(function (i) { lines.push("- " + labelText(i)); });
      download("readiness-compass.txt", lines.join("\n"));
    });
    render(false);
    Resets.readiness = function () { form.reset(); setTimeout(function () { render(false); }, 0); };
  });

  /* =========================================================================
     YOUR DATA: a live list of everything this toolkit keeps on this device,
     with delete and export. That's your saved work and settings (browser
     storage) and, in the installable app, its offline copies (Cache Storage).
     Deleting everything needs two clicks so nothing goes by accident.
     ========================================================================= */
  safe("data", function () {
    var rows = $("#data-rows"), empty = $("#data-empty"), clearBtn = $("#data-clear"), exportBtn = $("#data-export");
    if (!rows) return;
    var CACHE_LABELS = {
      shell: ["Offline app files", "The page, styles, scripts, fonts and icons, so the toolkit opens without internet"],
      library: ["Saved library documents", "Library documents kept on this device for reading offline"],
      extras: ["Saved tool helpers", "Larger helpers saved the first time a tool used them, like the AI Lab's token counter"]
    };
    function size(str) {
      var b = 0;
      try { b = new Blob([str]).size; } catch (e) { b = str.length; }
      return formatBytes(b);
    }
    /* The installable app's offline copies, with their sizes */
    function cacheInfo() {
      if (BUILD !== "pwa" || IS_FILE || !("caches" in window)) return Promise.resolve([]);
      return caches.keys().then(function (names) {
        var mine = names.filter(function (n) { return n.indexOf("aice-") === 0 && n.slice(-SCOPE_TAG.length) === SCOPE_TAG; });
        return Promise.all(mine.map(function (name) {
          return caches.open(name).then(function (c) {
            return c.keys().then(function (reqs) {
              return Promise.all(reqs.map(function (r) {
                return c.match(r).then(function (res) { return res ? res.blob().then(function (b) { return b.size; }) : 0; });
              })).then(function (sizes) {
                var kind = name.indexOf("aice-library") === 0 ? "library" : name.indexOf("aice-extras") === 0 ? "extras" : "shell";
                return { name: name, kind: kind, count: reqs.length, bytes: sizes.reduce(function (a, b) { return a + b; }, 0) };
              });
            });
          });
        }));
      }).catch(function () { return []; });
    }
    function addRow(label, what, sizeText, button) {
      var tr = el("tr");
      tr.appendChild(el("td", null, label));
      tr.appendChild(el("td", null, what));
      tr.appendChild(el("td", "num", sizeText));
      var td = el("td");
      if (button) td.appendChild(button);
      tr.appendChild(td);
      rows.appendChild(tr);
    }
    function deleteButton(label, onDelete) {
      var b = el("button", "btn btn-small btn-quiet btn-danger", "Delete");
      b.type = "button";
      b.setAttribute("aria-label", "Delete " + label);
      on(b, "click", onDelete);
      return b;
    }
    var token = 0;
    function render() {
      var mine = ++token;
      rows.textContent = "";
      var keys = Store.ok ? Store.keys() : [];
      keys.forEach(function (k) {
        var meta = Store.LABELS[k] || [k, "Saved by this page"];
        addRow(meta[0], meta[1], size(Store.raw(k)), deleteButton(meta[0], function () {
          Store.remove(k);
          if (Resets[k]) safe("reset " + k, Resets[k]);
          toast(meta[0] + " deleted.");
        }));
      });
      function finish(count) {
        empty.hidden = count > 0;
        empty.textContent = Store.ok || count ? "Nothing is stored yet." : "This browser isn't allowing storage here, so nothing is saved. The tools still work.";
        if (clearBtn) clearBtn.disabled = !count;
        if (exportBtn) exportBtn.disabled = !keys.length;
      }
      finish(keys.length);
      cacheInfo().then(function (list) {
        if (mine !== token) return;
        list.forEach(function (c) {
          var meta = CACHE_LABELS[c.kind];
          var what = meta[1] + " (" + c.count + (c.count === 1 ? " file)" : " files)");
          addRow(meta[0], what, formatBytes(c.bytes), deleteButton(meta[0], function () {
            if (c.kind === "library") {
              if (Library) Library.removeSaved().then(function () { toast("Saved library documents deleted."); });
            } else if (c.kind === "extras") {
              caches.delete(c.name).then(function () { toast("Saved tool helpers deleted. They'll be fetched again if a tool needs them."); announceCaches(); });
            } else if (Offline) {
              Offline.remove(true);
            }
          }));
        });
        finish(keys.length + list.length);
      });
    }
    var armed = 0;
    on(clearBtn, "click", function () {
      var label = clearBtn.lastChild;
      if (!armed) {
        armed = setTimeout(function () { armed = 0; if (label) label.textContent = "Delete everything"; }, 4000);
        if (label) label.textContent = "Click again to delete everything";
        return;
      }
      clearTimeout(armed); armed = 0;
      if (label) label.textContent = "Delete everything";
      Store.keys().forEach(function (k) { Store.remove(k); if (Resets[k]) safe("reset " + k, Resets[k]); });
      if (Offline && BUILD === "pwa" && !IS_FILE) Offline.remove(false).then(function () { toast("Everything this toolkit stored on this device has been deleted, including its offline copy."); });
      else toast("Everything this page stored has been deleted.");
    });
    on(exportBtn, "click", function () {
      var data = {};
      Store.keys().forEach(function (k) { if (k !== "schema") data[k] = Store.get(k, null); });
      download("ai-co-evolution-my-data.json", JSON.stringify({ format: "ai-co-evolution-data", schema: DATA_SCHEMA, exported: new Date().toISOString(), page: "AI Co-Evolution in Education " + APP_VERSION, data: data }, null, 2), "application/json");
    });
    on(document, "aice:store", render);
    on(document, "aice:caches", render);
    render();
  });

  /* ---------- WORKSPACE: bring your data from another device, and keep tabs in step ----------
     Import reads a file made by "Download all as JSON" on this device only, checks every item
     (CHECKS below: only items this toolkit knows, in the right shape, not too big), converts
     older files (MIGRATIONS), and shows what will happen before anything changes. The notebook
     is combined; other items replace what's here. Other tabs: when another tab of this toolkit
     saves something, the browser tells this tab (the "storage" event) and it catches up.
     To make a new saved item importable, add a check for it to CHECKS. */
  safe("workspace", function () {
    var input = $("#data-import"), dialog = $("#import-dialog"), rows = $("#import-rows"), plan = null;
    var LIMIT = 5 * 1048576, ITEM_LIMIT = 1048576;
    function str(v, max) { return typeof v === "string" && v.length <= max; }
    var CHECKS = {
      settings: function (v) {
        if (!isPlain(v)) return;
        var out = {};
        Object.keys(v).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,20}$/i.test(k) && (typeof v[k] === "boolean" || str(v[k], 20))) out[k] = v[k]; });
        return out;
      },
      role: function (v) { return typeof v === "string" && /^[a-z-]{1,20}$/.test(v) ? v : undefined; },
      quickstart: function (v) { return Array.isArray(v) && v.length <= 20 ? v.map(Boolean) : undefined; },
      sacredLog: function (v) { return Array.isArray(v) && v.length <= 500 && v.every(isPlain) ? v : undefined; },
      agreement: function (v) { return isPlain(v) ? v : undefined; },
      readiness: function (v) { return isPlain(v) && Array.isArray(v.checked) ? { checked: v.checked.slice(0, 100).map(Boolean) } : undefined; },
      rest: function (v) { return typeof v === "boolean" ? v : undefined; },
      libraryOffline: function (v) { return typeof v === "boolean" ? v : undefined; },
      reading: function (v) {
        if (!Array.isArray(v)) return;
        return v.filter(function (x) { return isPlain(x) && typeof x.id === "string" && /^[a-z0-9-]{1,80}$/.test(x.id) && str(x.title, 300); }).slice(0, 12).map(function (x) {
          return { id: x.id, title: x.title, slug: str(x.slug, 300) ? x.slug : "", heading: str(x.heading, 300) ? x.heading : "", at: typeof x.at === "number" && x.at >= 0 && x.at <= 1 ? x.at : 0 };
        });
      },
      notebook: function (v) { return Notes.sanitize(v) || undefined; }
    };
    function makePlan(file) {
      if (!isPlain(file) || !isPlain(file.data)) return { error: "That file isn't a data file from this toolkit. Make one with “Download all as JSON”." };
      var schema = file.schema === undefined ? 1 : Number(file.schema);
      if (!(schema >= 1) || Math.floor(schema) !== schema) return { error: "That data file's format isn't one this toolkit knows." };
      if (schema > DATA_SCHEMA) return { error: "That file comes from a newer version of this toolkit. Update this copy first, then import it." };
      var data;
      try { data = migrate(JSON.parse(JSON.stringify(file.data)), schema); } catch (e) { return { error: "Couldn't convert that file from its older format." }; }
      var items = [], skipped = 0, skippedNames = [];
      Object.keys(data).forEach(function (k) {
        if (k === "schema") return;
        var label = Object.prototype.hasOwnProperty.call(Store.LABELS, k) ? Store.LABELS[k] : null;
        var check = label && Object.prototype.hasOwnProperty.call(CHECKS, k) ? CHECKS[k] : null;
        var size = 0;
        try { size = JSON.stringify(data[k]).length; } catch (e) { size = Infinity; }
        var value = check && size <= ITEM_LIMIT ? check(data[k]) : undefined;
        if (value === undefined) { skipped++; if (label) skippedNames.push(label[0]); return; }
        items.push({ key: k, label: label[0], value: value, here: Store.raw(k) !== "" });
      });
      if (!items.length) return { error: "There's nothing in that file this toolkit can use." };
      return { items: items, skipped: skipped, skippedNames: skippedNames, exported: file.exported, page: file.page };
    }
    function show(p) {
      plan = p;
      var when = new Date(p.exported), made = isNaN(when) ? "" : " was made on " + when.toLocaleDateString(undefined, { dateStyle: "long" });
      var from = typeof p.page === "string" && /^AI Co-Evolution in Education [\d.]+$/.test(p.page) ? " by " + p.page : "";
      $("#import-summary").textContent = "This file" + made + from + ". Choose what to bring in. Nothing changes until you choose Import.";
      rows.textContent = "";
      p.items.forEach(function (it) {
        var tr = el("tr"), td = el("td"), box = el("input");
        box.type = "checkbox";
        box.checked = true;
        box.id = "imp-" + it.key;
        box.setAttribute("aria-labelledby", "imp-l-" + it.key);
        td.appendChild(box);
        tr.appendChild(td);
        var name = el("td", null, it.label);
        name.id = "imp-l-" + it.key;
        tr.appendChild(name);
        var count = it.key === "notebook" ? Object.keys(it.value.docs).length : 0;
        tr.appendChild(el("td", null, it.key === "notebook" ? "Combined with your notebook here (" + count + (count === 1 ? " document" : " documents") + " in the file; for a document in both, the newer notes are kept)" : it.here ? "Replaces what's here" : "Added"));
        rows.appendChild(tr);
      });
      $("#import-skipped").textContent = p.skipped ? p.skipped + (p.skipped === 1 ? " item was" : " items were") + " left out because this toolkit doesn't know " + (p.skipped === 1 ? "it" : "them") + " or " + (p.skipped === 1 ? "it wasn't" : "they weren't") + " in the right shape" + (p.skippedNames.length ? ": " + p.skippedNames.join(", ") : "") + "." : "";
      $("#import-table-wrap").hidden = false;
      $("#import-go").parentNode.hidden = false;
      $("#import-done").hidden = true;
      if (Dialogs) Dialogs.open("import-dialog", input); else if (dialog.showModal) dialog.showModal();
    }
    on(input, "change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!Store.ok) { toast("This browser isn't allowing storage here, so there's nowhere to import to."); input.value = ""; return; }
      if (file.size > LIMIT) { toast("That file is too big to be a data file from this toolkit."); input.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function () {
        input.value = "";   // the same file can be chosen again
        var parsed;
        try { parsed = JSON.parse(String(reader.result)); } catch (e) { toast("That file isn't a data file from this toolkit (it isn't JSON)."); return; }
        var p = makePlan(parsed);
        if (p.error) toast(p.error); else show(p);
      };
      reader.onerror = function () { input.value = ""; toast("Couldn't read that file."); };
      reader.readAsText(file);
    });
    on($("#import-go"), "click", function () {
      if (!plan) return;
      var done = 0;
      plan.items.forEach(function (it) {
        var box = document.getElementById("imp-" + it.key);
        if (!box || !box.checked) return;
        var ok = it.key === "notebook" ? Notes.merge(it.value) : Store.set(it.key, it.value);
        if (ok) done++;
      });
      plan = null;
      Settings.reload();
      $("#import-table-wrap").hidden = true;
      $("#import-go").parentNode.hidden = true;
      $("#import-skipped").textContent = "";
      $("#import-done-text").textContent = done ? "Imported " + done + (done === 1 ? " item" : " items") + ". Reload the page so every tool shows " + (done === 1 ? "it." : "them.") : "Nothing was imported.";
      $("#import-done").hidden = false;
      $("#import-summary").textContent = "";
      var btn = $("#import-reload");
      btn.hidden = !done;
      if (done) btn.focus();
    });
    on($("#import-reload"), "click", function () { location.reload(); });

    /* Other tabs of this toolkit saved something: catch up */
    on(window, "storage", function (e) {
      if (e.key !== null && String(e.key).indexOf("aice:") !== 0) return;
      var key = e.key ? e.key.slice(5) : null;
      if (key === "__test") return;
      if (!key || key === "settings") Settings.reload();
      if (key && e.newValue === null && Resets[key]) safe("reset " + key, Resets[key]);
      document.dispatchEvent(new CustomEvent("aice:store", { detail: { key: key, otherTab: true } }));
    });
  });

  /* ---------- Chart tooltips: any element with data-tip (hover and keyboard focus) ---------- */
  safe("tips", function () {
    var tip = $("#tip");
    if (!tip) return;
    function show(target) {
      tip.textContent = target.getAttribute("data-tip");
      tip.hidden = false;
      var r = target.getBoundingClientRect();
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8);
      var top = r.top - h - 10;
      if (top < 8) top = r.bottom + 10;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hide() { tip.hidden = true; }
    $$("[data-tip]").forEach(function (t) {
      on(t, "pointerenter", function () { show(t); });
      on(t, "pointerleave", hide);
      on(t, "focus", function () { show(t); });
      on(t, "blur", hide);
      on(t, "click", function () { show(t); });
    });
    on(window, "scroll", hide, { passive: true });
  });

  /* ---------- Small-screen tables: copy column names onto cells so rows can stack ---------- */
  safe("tables", function () {
    $$(".table-stack").forEach(function (t) {
      var heads = $$("thead th", t).map(function (th) { return th.textContent.trim(); });
      $$("tbody tr", t).forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (cell, i) {
          if (cell.tagName === "TD" && heads[i]) cell.setAttribute("data-label", heads[i]);
        });
      });
    });
  });

  /* =========================================================================
     SHARE: a link, a QR code made on this device, and the system share sheet
     where there is one. Share.open({ url, label, opener }) shares any link:
     the footer button shares this page, the reader shares a document.
     The QR code is drawn here from the qrcode-generator library (MIT); the
     address is never sent anywhere to make it.
     ========================================================================= */
  var Share = safe("share", function () {
    var dlg = $("#share-dialog"), footerBtn = $("#share-btn");
    if (!dlg) return null;
    var what = $("#share-what"), linkRow = $("#share-link-row"), urlInput = $("#share-url"), copyBtn = $("#share-copy"),
        qrBox = $("#share-qr"), note = $("#share-note"), sysBtn = $("#share-system"), dlBtn = $("#share-qr-download");
    var current = { url: "", label: "" }, svgNow = null;
    function pageUrl() { return location.href.split("#")[0]; }
    function svgFor(qr) {
      var n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2, d = "";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
      var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 " + size + " " + size);
      svg.setAttribute("shape-rendering", "crispEdges");
      svg.setAttribute("class", "qr-svg");
      svg.setAttribute("aria-hidden", "true");
      var bg = document.createElementNS(ns, "rect");
      bg.setAttribute("width", size);
      bg.setAttribute("height", size);
      bg.setAttribute("fill", "#ffffff");
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "#0b2022");
      svg.appendChild(bg);
      svg.appendChild(p);
      return svg;
    }
    function draw(url) {
      qrBox.textContent = "";
      needs("qrcode").then(function (qrcode) {
        if (current.url !== url) return;
        var qr = qrcode(0, "M");   // type 0 = smallest size that fits; "M" recovers from about 15% damage
        qr.addData(url);
        qr.make();
        svgNow = svgFor(qr);
        qrBox.appendChild(svgNow);
        dlBtn.hidden = false;
      }).catch(function () {
        qrBox.hidden = true;
        note.textContent = "The QR code maker couldn't load, but you can still copy the link.";
      });
    }
    function open(opts) {
      opts = opts || {};
      var url = opts.url || pageUrl();
      current = { url: url, label: opts.label || "This page" };
      svgNow = null;
      what.textContent = current.label;
      var web = /^https?:/i.test(url);
      var localOnly = web && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
      linkRow.hidden = !web;
      urlInput.value = web ? url : "";
      qrBox.hidden = !web;
      qrBox.textContent = "";
      dlBtn.hidden = true;
      sysBtn.hidden = !(web && navigator.share);
      note.textContent = !web
        ? "This copy is a file on this device, so its address won't open anywhere else. To share it, send the file itself: it works offline in any web browser. Or publish the toolkit on a website (see the README) and share that link."
        : localOnly
          ? "This address only works on this computer. Publish the toolkit on a website to share it with other people."
          : "Point a phone camera at the code to open this on another device. The code is made right here; nothing is sent anywhere.";
      if (web) draw(url);
      if (Dialogs) Dialogs.open("share-dialog", opts.opener);
    }
    on(copyBtn, "click", function () {
      copyText(current.url).then(function (ok) { toast(ok ? "Link copied." : "Couldn't copy. Select the link and copy it yourself."); });
    });
    on(urlInput, "focus", function () { try { urlInput.select(); } catch (e) {} });
    on(sysBtn, "click", function () {
      if (!navigator.share) return;
      navigator.share({ title: current.label + " · AI Co-Evolution in Education", url: current.url }).catch(function (e) {
        if (e && e.name !== "AbortError") toast("Sharing didn't work here. Copy the link instead.");
      });
    });
    on(dlBtn, "click", function () {
      if (!svgNow) return;
      download("ai-co-evolution-qr-code.svg", new XMLSerializer().serializeToString(svgNow), "image/svg+xml");
    });
    on(footerBtn, "click", function () { open({ opener: footerBtn }); });
    return { open: open, pageUrl: pageUrl };
  });

  /* =========================================================================
     THE LIBRARY AND THE READER
     Every document from the project repository, turned into web pages when
     the toolkit is built (see tools/build-library.mjs).
     - The installable app fetches library/index.json, then each document as
       you open it. Opening a document also keeps a copy on this device, so it
       reads offline next time. "Save the whole library" keeps them all.
     - The single-file edition carries the whole library inside the file.
     Links look like #library/<document>/<section>, so they can be bookmarked,
     shared, and followed with the browser's back button.
     The reader can also open a Markdown file from your own device. It's
     cleaned with DOMPurify and shown only here: never uploaded or saved.
     To change what's in the library, edit CATALOG in tools/build-library.mjs.
     ========================================================================= */
  var Library = safe("library", function () {
    var reader = $("#reader");
    if (!reader) return null;
    var LIB_CACHE = "aice-library" + SCOPE_TAG;
    var listEl = $("#library-groups"), statsEl = $("#library-stats"), resumeEl = $("#library-resume"), sectionEl = $("#library");
    var docEl = $("#reader-doc"), titleEl = $("#reader-title"), kickerEl = $("#reader-kicker"), tocEl = $("#reader-toc"),
        tocBtn = $("#reader-toc-btn"), scrollEl = $("#reader-scroll"), pagerEl = $("#reader-pager"), sourceEl = $("#reader-source"),
        liveEl = $("#reader-live"), noteEl = $("#reader-note"), adaptEl = $("#reader-adapt"), shareBtn = $("#reader-share"), presentBtn = $("#reader-present"),
        presentState = $("#present-state"), frame = $("#reader-frame") || reader,
        findBar = $("#reader-find"), findInput = $("#reader-find-input"), findCount = $("#reader-find-count"), findBtn = $("#reader-find-btn"),
        progressEl = $("#reader-progress"), resumeBox = $("#reader-resume"), resumeText = $("#reader-resume-text"),
        nbBox = $("#reader-notebook"), nbAnswer = $("#nb-answer"), nbNotes = $("#nb-notes"), nbStatus = $("#nb-status"), nbAnother = $("#nb-another");
    var loadCtl = null;
    var baseTitle = document.title;
    var wide = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : null;
    var indexP = null, lastIndex = null, chunksP = null, embeddedDocs = null, current = null;
    var embeddedIndex = readJson("library-index");

    function readJson(id) {
      var n = document.getElementById(id);
      if (!n) return null;
      try { return JSON.parse(n.textContent); } catch (e) { errors.push("library data: " + e.message); return null; }
    }

    /* ---- Data: the catalog, the documents, and the search sections ---- */
    function getIndex() {
      if (!indexP) {
        if (embeddedIndex) indexP = Promise.resolve(embeddedIndex);
        else if (IS_FILE) indexP = Promise.reject(new Error("file"));
        else indexP = fetch("library/index.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
        indexP.then(function (ix) { lastIndex = ix; }, function () { indexP = null; });
      }
      return indexP;
    }
    function find(index, id) {
      for (var i = 0; i < index.documents.length; i++) if (index.documents[i].id === id) return index.documents[i];
      return null;
    }
    function docUrl(m) { return "library/docs/" + m.id + ".html?v=" + m.hash; }
    function searchUrl(ix) { return "library/search.json?v=" + ix.searchHash; }
    function libraryBytes(ix) { return ix.documents.reduce(function (a, d) { return a + (d.bytes || 0); }, 0) + (ix.searchBytes || 0); }
    function searchSize() { return lastIndex && lastIndex.searchBytes ? formatBytes(lastIndex.searchBytes) : "0.7 MB"; }
    /* A library file: this device's saved copy first, then the network (keeping a copy) */
    function libFetch(url, signal) {
      var saved = "caches" in window ? caches.match(url).catch(function () { return null; }) : Promise.resolve(null);
      return saved.then(function (hit) {
        if (hit) return hit;
        if (signal && signal.aborted) throw new Error("aborted");
        return fetch(url, signal ? { signal: signal } : undefined).then(function (r) {
          if (!r.ok) throw new Error(r.status === 504 ? "offline" : "HTTP " + r.status);
          if ("caches" in window) {
            var copy = r.clone();
            caches.open(LIB_CACHE).then(function (c) { return c.put(url, copy); }).then(announceCaches, function () {});
          }
          return r;
        }, function (err) { throw new Error(err && err.name === "AbortError" ? "aborted" : "offline"); });
      });
    }
    function getDoc(id, signal) {
      return getIndex().then(function (index) {
        var m = find(index, id);
        if (!m) throw new Error("missing");
        if (embeddedIndex) {
          if (!embeddedDocs) embeddedDocs = readJson("library-docs") || {};
          if (typeof embeddedDocs[id] !== "string") throw new Error("missing");
          return { meta: m, html: embeddedDocs[id] };
        }
        return libFetch(docUrl(m), signal).then(function (r) { return r.text(); }).then(function (h) { return { meta: m, html: h }; });
      });
    }
    /* Search sections: a ready-made file in the app; worked out from the documents in the single file */
    function searchChunks() {
      if (!chunksP) {
        chunksP = getIndex().then(function (index) {
          if (embeddedIndex) return deriveChunks(index);
          return libFetch(searchUrl(index)).then(function (r) { return r.json(); });
        });
        chunksP.catch(function () { chunksP = null; });
      }
      return chunksP;
    }
    function deriveChunks(index) {
      if (!embeddedDocs) embeddedDocs = readJson("library-docs") || {};
      var out = [], tpl = document.createElement("template");   // a template's contents are inert: nothing runs or loads
      index.documents.forEach(function (m) {
        tpl.innerHTML = embeddedDocs[m.id] || "";
        $$(".sr-only", tpl.content).forEach(function (n) { n.remove(); });
        var cur = { heading: m.title, slug: "", text: [] };
        function push() {
          var t = cur.text.join(" ").replace(/\s+/g, " ").trim();
          if (t) out.push({ id: m.id + (cur.slug ? "#" + cur.slug : ""), doc: m.id, title: m.title, heading: cur.heading, slug: cur.slug, text: t.slice(0, 4000) });
        }
        Array.prototype.forEach.call(tpl.content.children, function (node) {
          if (/^H[23]$/.test(node.tagName)) { push(); cur = { heading: node.textContent.replace(/\s+/g, " ").trim(), slug: node.getAttribute("data-slug") || "", text: [] }; }
          else if (node.tagName !== "H1") cur.text.push(node.textContent);
        });
        push();
      });
      return out;
    }

    /* ---- Recently read (kept only in this browser; listed under Your data) ---- */
    function recent() {
      var r = Store.get("reading", []);
      return Array.isArray(r) ? r.filter(function (x) { return x && typeof x.id === "string" && typeof x.title === "string"; }) : [];
    }
    function spotOf(id) { var r = recent(); for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }
    function remember(m) {
      if (!Store.ok) return;
      var before = spotOf(m.id) || {};
      var r = recent().filter(function (x) { return x.id !== m.id; });
      r.unshift({ id: m.id, title: m.title, slug: before.slug || "", heading: before.heading || "", at: before.at || 0 });
      Store.set("reading", r.slice(0, 12));
    }
    function renderResume() {
      if (!resumeEl) return;
      var r = recent();
      resumeEl.textContent = "";
      resumeEl.hidden = !r.length;
      if (!r.length) return;
      resumeEl.appendChild(el("span", "resume-label", "Pick up where you left off:"));
      r.slice(0, 3).forEach(function (x) {
        var a = el("a", "chip-link", x.title);
        a.href = "#library/" + x.id + (x.slug ? "/" + x.slug : "");
        if (x.heading) a.appendChild(el("span", "chip-sub", " · " + (x.heading.length > 40 ? x.heading.slice(0, 39) + "…" : x.heading)));
        resumeEl.appendChild(a);
      });
    }

    /* ---- The list of documents in the Library section ---- */
    function renderList(index) {
      if (!listEl) return;
      listEl.textContent = "";
      var groups = [], byName = {};
      index.documents.forEach(function (d) {
        if (!byName[d.group]) { byName[d.group] = { name: d.group, docs: [] }; groups.push(byName[d.group]); }
        byName[d.group].docs.push(d);
      });
      groups.forEach(function (g) {
        var box = el("div", "lib-group");
        var h = el("h3", "lib-group-title");
        h.appendChild(el("span", null, g.name));
        h.appendChild(el("span", "lib-count", g.docs.length + (g.docs.length === 1 ? " document" : " documents")));
        box.appendChild(h);
        var ul = el("ul", "lib-list");
        g.docs.forEach(function (d) {
          var li = el("li", "lib-item");
          var a = el("a", "lib-card");
          a.href = "#library/" + d.id;
          a.setAttribute("data-doc", d.id);
          a.appendChild(el("span", "lib-title", d.title));
          var meta = el("span", "lib-meta", d.minutes + " min read · " + d.sections + (d.sections === 1 ? " section" : " sections"));
          var saved = el("span", "lib-saved");
          saved.hidden = true;
          saved.appendChild(icon("i-check"));
          saved.appendChild(document.createTextNode("Saved offline"));
          meta.appendChild(saved);
          a.appendChild(meta);
          if (d.summary) a.appendChild(el("span", "lib-summary", d.summary));
          li.appendChild(a);
          ul.appendChild(li);
        });
        box.appendChild(ul);
        listEl.appendChild(box);
      });
      var minutes = index.documents.reduce(function (a, d) { return a + (d.minutes || 0); }, 0);
      if (statsEl) statsEl.textContent = index.documents.length + " documents · about " + nf0.format(Math.round(minutes / 60)) + " hours of reading" + (embeddedIndex ? " · all inside this file" : "");
      listEl.setAttribute("aria-busy", "false");
      refreshSaved();
    }
    function renderListError(err) {
      if (!listEl) return;
      listEl.textContent = "";
      listEl.setAttribute("aria-busy", "false");
      var box = el("div", "callout");
      if (err && err.message === "file") {
        box.appendChild(el("p", "callout-title", "To read the library from a folder, open the single-file edition"));
        box.appendChild(el("p", null, "Browsers don't let a page read its neighbouring files when it's opened straight from a folder. The single-file edition has the whole library inside it, or you can serve this folder as a website (see the README)."));
        var a = el("a", "btn btn-secondary btn-small", "Open the single-file edition");
        a.href = "download/ai-co-evolution-in-education.html";
        box.appendChild(a);
      } else {
        box.appendChild(el("p", "callout-title", "The library list couldn't load"));
        box.appendChild(el("p", null, navigator.onLine === false ? "You're offline, and the library hasn't been saved on this device yet. Connect once and it will be." : "Something went wrong while loading it."));
        var b = el("button", "btn btn-secondary btn-small", "Try again");
        b.type = "button";
        on(b, "click", function () { getIndex().then(renderList, renderListError); });
        box.appendChild(b);
      }
      listEl.appendChild(box);
    }

    /* ---- Saving for offline use (installable app) ---- */
    function libKeys() {
      return caches.has(LIB_CACHE).then(function (has) { return has ? caches.open(LIB_CACHE).then(function (c) { return c.keys(); }) : []; });
    }
    function refreshSaved() {
      if (BUILD !== "pwa" || IS_FILE || !("caches" in window)) return Promise.resolve(null);
      return Promise.all([getIndex(), libKeys()]).then(function (res) {
        var index = res[0], have = {}, n = 0;
        res[1].forEach(function (req) { have[req.url] = 1; });
        index.documents.forEach(function (m) {
          var ok = !!have[new URL(docUrl(m), location.href).href];
          if (ok) n++;
          var badge = listEl ? listEl.querySelector('[data-doc="' + m.id + '"] .lib-saved') : null;
          if (badge) badge.hidden = !ok;
        });
        var info = { saved: n, total: index.documents.length, search: !!have[new URL(searchUrl(index), location.href).href], bytes: libraryBytes(index) };
        document.dispatchEvent(new CustomEvent("aice:library", { detail: info }));
        return info;
      }).catch(function () { return null; });
    }
    function progress(done, total) {
      $$("[data-library-progress]").forEach(function (box) {
        if (done < 0) { box.hidden = true; return; }
        box.hidden = false;
        var pct = total ? Math.round(done / total * 100) : 0;
        var bar = $(".meter", box), fill = $(".meter-fill", box), txt = $(".progress-text", box);
        if (bar) bar.setAttribute("aria-valuenow", String(pct));
        if (fill) fill.style.width = pct + "%";
        if (txt) txt.textContent = "Saving " + done + " of " + total;
      });
    }
    var saving = null;
    function saveAll(opts) {
      opts = opts || {};
      if (saving) return saving;
      if (BUILD !== "pwa" || IS_FILE || !("caches" in window)) {
        if (!opts.quiet) toast("This edition can't save files for offline use, but the single-file edition already has everything inside it.");
        return Promise.resolve(null);
      }
      $$("[data-save-library]").forEach(function (b) { b.disabled = true; });
      saving = getIndex().then(function (index) {
        var urls = index.documents.map(docUrl).concat([searchUrl(index)]);
        var total = urls.length, done = 0, failed = 0, i = 0;
        if (!opts.quiet) progress(0, total);
        return caches.open(LIB_CACHE).then(function (cache) {
          function next() {
            if (i >= urls.length) return null;
            var url = urls[i++];
            return cache.match(url).then(function (hit) {
              if (hit) return null;
              return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return cache.put(url, r); });
            }).then(function () { done++; }, function () { failed++; }).then(function () {
              if (!opts.quiet) progress(done + failed, total);
              return next();
            });
          }
          return Promise.all([next(), next(), next()]);
        }).then(function () {
          if (!failed) Store.set("libraryOffline", true);
          progress(-1);
          announceCaches();
          return refreshSaved().then(function () {
            if (!opts.quiet) toast(failed ? "Saved " + done + " of " + total + " files. Connect to the internet and try again for the rest." : "The whole library is saved on this device, so it reads offline now.", { timeout: 5000 });
            return { done: done, failed: failed, total: total };
          });
        });
      }).catch(function (err) {
        progress(-1);
        if (!opts.quiet) toast(err && err.message === "file" ? "Open the toolkit from a website to save the library." : "The library couldn't be saved right now. Check your connection and try again.");
        return null;
      }).then(function (r) {
        saving = null;
        $$("[data-save-library]").forEach(function (b) { b.disabled = false; });
        return r;
      });
      return saving;
    }
    function removeSaved() {
      if (!("caches" in window)) return Promise.resolve(null);
      return caches.delete(LIB_CACHE).then(function () { Store.remove("libraryOffline"); announceCaches(); return refreshSaved(); });
    }
    $$("[data-save-library]").forEach(function (b) { on(b, "click", function () { saveAll(); }); });

    /* ---- The reader ---- */
    var REFLECT = [
      "What's one idea here you could try this week, and who could you talk it through with?",
      "Whose voice is missing from this, and how could you invite it in?",
      "What would this look like with no AI at all? Keep that version ready.",
      "Which part would your students say yes to first? Ask them.",
      "What would help you rest and reflect before you begin?",
      "What does this ask of you, and what could you let go of to make room for it?",
      "How would a student who finds reading hard meet this? What would help them in?",
      "Where could this connect your students with the land, their community or each other?",
      "What would you want families to know before you start?"
    ];
    function parseRoute(hash) {
      var m = /^#library\/([a-z0-9-]+)(?:\/(.+))?$/i.exec(hash || "");
      return m ? { id: m[1].toLowerCase(), slug: m[2] ? safeDecode(m[2]) : "" } : null;
    }
    function setToc(openIt) {
      reader.setAttribute("data-toc", openIt ? "open" : "closed");
      if (tocBtn) tocBtn.setAttribute("aria-expanded", openIt ? "true" : "false");
    }
    function showReader(opener) {
      if (reader.open) return;
      setToc(wide ? wide.matches : false);
      if (Dialogs) Dialogs.open("reader", opener);
      else if (typeof reader.showModal === "function") reader.showModal();
    }
    function focusTitle() {
      titleEl.setAttribute("tabindex", "-1");
      try { titleEl.focus({ preventScroll: true }); } catch (e) {}
    }
    /* Move to a heading in the reader: glide if it's near, jump if it's far, then let it glow briefly */
    function land(t) {
      var far = Math.abs(t.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top) > scrollEl.clientHeight * 2;
      try { t.scrollIntoView({ block: "start", behavior: Settings.reducedMotion() || far ? "instant" : "smooth" }); }
      catch (e) { t.scrollIntoView(true); }
      if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
      try { t.focus({ preventScroll: true }); } catch (e) {}
      t.classList.remove("is-landed");
      void t.offsetWidth;   // restart the glow if the same heading is chosen twice
      t.classList.add("is-landed");
      setTimeout(function () { t.classList.remove("is-landed"); }, 2500);
    }
    function scrollToSlug(slug) {
      var t = slug ? document.getElementById("doc-" + slug) : null;
      if (!t) { scrollEl.scrollTop = 0; focusTitle(); return; }
      land(t);
    }
    function clearReader(title) {
      titleEl.textContent = title;
      kickerEl.textContent = "";
      tocEl.textContent = "";
      pagerEl.textContent = "";
      sourceEl.textContent = "";
      reader.classList.remove("has-toc");
      if (tocBtn) tocBtn.hidden = true;
    }
    function loading() {
      clearReader("Opening…");
      docEl.setAttribute("aria-busy", "true");
      docEl.textContent = "";
      docEl.appendChild(el("p", "reader-loading", "Opening the document…"));
    }
    function showError(id, err) {
      var msg = err && err.message;
      clearReader("Couldn't open this document");
      docEl.setAttribute("aria-busy", "false");
      docEl.textContent = "";
      var box = el("div", "callout");
      box.appendChild(el("p", null,
        msg === "missing" ? "There's no library document called “" + id + "”. It may have been renamed. The full list is in the Library section." :
        msg === "file" ? "Browsers don't let a page read its neighbouring files when it's opened straight from a folder. The single-file edition has the whole library inside it." :
        msg === "offline" ? "This document isn't saved on this device yet, and you're offline. Connect once and it will be, or use “Save the whole library” next time you're online." :
        "Something went wrong while opening it. Please try again."));
      var row = el("div", "tool-actions");
      if (msg === "file") {
        var f = el("a", "btn btn-secondary btn-small", "Open the single-file edition");
        f.href = "download/ai-co-evolution-in-education.html";
        row.appendChild(f);
      } else if (msg !== "missing") {
        var retry = el("button", "btn btn-secondary btn-small", "Try again");
        retry.type = "button";
        on(retry, "click", function () { current = null; open({ id: id, slug: "" }); });
        row.appendChild(retry);
      }
      var back = el("a", "btn btn-quiet btn-small", "Back to the full list");
      back.href = "#library";
      row.appendChild(back);
      box.appendChild(row);
      docEl.appendChild(box);
      liveEl.textContent = titleEl.textContent;
      focusTitle();
    }
    function buildToc(local) {
      tocEl.textContent = "";
      var hs = $$("h2[data-slug], h3[data-slug]", docEl);
      reader.classList.toggle("has-toc", hs.length > 1);
      if (tocBtn) tocBtn.hidden = hs.length < 2;
      if (hs.length < 2) return;
      tocEl.appendChild(el("p", "reader-toc-title", "In this document"));
      var ol = el("ol");
      hs.forEach(function (h) {
        var li = el("li", h.tagName === "H3" ? "is-sub" : null);
        var a = el("a", null, h.textContent.replace(/\s+/g, " ").trim());
        if (local) { a.href = "#"; a.setAttribute("data-target", h.id); }
        else a.href = "#library/" + current.id + "/" + h.getAttribute("data-slug");
        li.appendChild(a);
        ol.appendChild(li);
      });
      tocEl.appendChild(ol);
    }
    function buildPager(m) {
      pagerEl.textContent = "";
      if (!m) return;
      getIndex().then(function (index) {
        var docs = index.documents, i = -1;
        for (var k = 0; k < docs.length; k++) if (docs[k].id === m.id) i = k;
        if (i < 0) return;
        [[docs[i - 1], "Previous"], [docs[i + 1], "Next"]].forEach(function (p) {
          if (!p[0]) return;
          var a = el("a", "pager-link pager-" + p[1].toLowerCase());
          a.href = "#library/" + p[0].id;
          a.appendChild(el("span", "pager-label", p[1]));
          a.appendChild(el("span", "pager-title", p[0].title));
          pagerEl.appendChild(a);
        });
      });
    }
    /* Your own Markdown file: give headings ids, keep in-page links working, open web links in a new tab */
    function prepareLocal() {
      var slug = makeSlugger();
      $$("h1, h2, h3, h4, h5, h6", docEl).forEach(function (h) {
        var s = slug(h.textContent.trim());
        h.id = "doc-" + s;
        h.setAttribute("data-slug", s);
      });
      $$("a[href]", docEl).forEach(function (a) {
        var href = a.getAttribute("href") || "";
        if (href.charAt(0) === "#") { a.setAttribute("href", "#"); a.setAttribute("data-target", "doc-" + safeDecode(href.slice(1)).toLowerCase()); }
        else if (/^https?:\/\//i.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
        else a.replaceWith.apply(a, Array.prototype.slice.call(a.childNodes));   // other files next to it can't be reached from here
      });
    }
    function fill(m, htmlStr, local) {
      titleEl.textContent = m.title;
      kickerEl.textContent = m.group || "";
      // Library pages were cleaned when the toolkit was built; your own files are cleaned by DOMPurify first.
      docEl.innerHTML = htmlStr;
      docEl.setAttribute("aria-busy", "false");
      $$('input[type="checkbox"]', docEl).forEach(function (c) { c.disabled = true; if (!c.getAttribute("aria-label")) c.setAttribute("aria-label", "Task (read-only)"); });
      if (local) prepareLocal();
      buildToc(local);
      buildPager(local ? null : m);
      sourceEl.textContent = local ? "Opened from your device. It's shown only here: nothing was uploaded or saved." : (m.source ? "Source in the project repository: " + m.source : "");
      if (noteEl) noteEl.hidden = !!local;
      if (shareBtn) shareBtn.hidden = !!local;
      if (adaptEl) adaptEl.hidden = !!local;
      if (nbBox) nbBox.hidden = true;            // shown again by notebookFor() for library documents
      if (resumeBox) resumeBox.hidden = true;
      setProgress();
      if (findBar && !findBar.hidden) runFind();
      var q = $("#reader-reflect-q");
      if (q) q.textContent = REFLECT[String(m.id || m.title || "").length % REFLECT.length];   // notebookFor() may show a saved question instead
      scrollEl.scrollTop = 0;
      requestAnimationFrame(function () { scrollablesReachable(docEl); });
      document.title = m.title + " · AI Co-Evolution in Education";
      liveEl.textContent = "Opened " + m.title;
    }
    function open(route, opener) {
      showReader(opener);
      if (current && !current.local && current.id === route.id && current.loaded) { scrollToSlug(route.slug); return; }
      var mine = current = { id: route.id, loaded: false, local: false };
      // A document still loading is no longer wanted: stop fetching it
      if (loadCtl) loadCtl.abort();
      loadCtl = typeof AbortController === "function" ? new AbortController() : null;
      loading();
      getDoc(route.id, loadCtl && loadCtl.signal).then(function (res) {
        if (current !== mine) return;
        var spot = route.slug ? null : spotOf(route.id);
        fill(res.meta, res.html, false);
        mine.loaded = true;
        mine.meta = res.meta;
        mine.html = res.html;   // as published, for "Download as Markdown"
        remember(res.meta);
        scrollToSlug(route.slug);
        offerResume(spot);
        notebookFor(res.meta);
        if (BUILD === "pwa") refreshSaved();
      }, function (err) {
        if (current === mine) showError(route.id, err);
      });
    }
    function go(hash, opener) {
      var r = parseRoute(hash);
      if (!r) return false;
      if (safeDecode(location.hash) !== safeDecode(hash)) { try { history.pushState(null, "", hash); } catch (e) {} }
      open(r, opener);
      return true;
    }
    function sync() {
      var r = parseRoute(location.hash);
      if (r) open(r);
      else if (reader.open && current && !current.local) reader.close();
    }
    on(window, "popstate", sync);
    on(window, "hashchange", sync);
    on(tocBtn, "click", function () { setToc(reader.getAttribute("data-toc") !== "open"); requestAnimationFrame(function () { scrollablesReachable(docEl); }); });
    on(reader, "click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      if (a.hasAttribute("data-target")) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute("data-target"));
        if (t) land(t);
      }
      if (a.closest("#reader-toc") && !(wide && wide.matches)) setToc(false);
    });
    on(reader, "close", function () {
      if (loadCtl) { loadCtl.abort(); loadCtl = null; }
      closeFind(false);
      if (spotTimer) saveSpot();   // where you stopped, measured while you were reading
      present(false);
      document.dispatchEvent(new CustomEvent("aice:stop-speech"));
      var wasLink = !reader._opener || reader._opener === document.body;
      if (parseRoute(location.hash)) {
        try { history.replaceState(null, "", "#library"); } catch (e) {}
        if (wasLink && !reader._skipRestore) goTo("#library", false);   // arrived from a shared link: land on the list
      }
      current = null;
      document.title = baseTitle;
    });
    on($("#reader-print"), "click", function () {
      if (!current || (!current.loaded && !current.local) || !Printer) return;
      Printer.print(docEl, { title: titleEl.textContent, note: current.local ? "Opened from a file on this device." : "From the AI Co-Evolution in Education library. " + sourceEl.textContent });
    });
    /* ---- Find in this document ----
       Every match is highlighted without changing the document, using the CSS Custom
       Highlight API where the browser has it (otherwise the current match is selected).
       Matches can cross bold or italic text. Folded sections open when a match is inside. */
    var HIGHLIGHTS = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function";
    var finds = [], findAt = -1, findTimer = 0;
    function escapeRegExp(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function clearFind() {
      finds = []; findAt = -1;
      if (HIGHLIGHTS) { CSS.highlights.delete("aice-find"); CSS.highlights.delete("aice-find-current"); }
    }
    function runFind() {
      clearFind();
      var q = findInput.value.trim();
      if (!q) { findCount.textContent = ""; return; }
      // All visible text in order, remembering where each piece starts
      var nodes = [], starts = [], text = "";
      var walk = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        return n.parentElement && n.parentElement.closest(".sr-only, script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      } });
      while (walk.nextNode()) { nodes.push(walk.currentNode); starts.push(text.length); text += walk.currentNode.data; }
      function at(pos) {   // the text node holding character `pos`
        var lo = 0, hi = starts.length - 1;
        while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
        return { node: nodes[lo], offset: pos - starts[lo] };
      }
      var re;
      try { re = new RegExp(escapeRegExp(q), "giu"); } catch (e) { re = new RegExp(escapeRegExp(q), "gi"); }
      var m;
      while ((m = re.exec(text)) && finds.length < 1000) {
        if (!m[0].length) { re.lastIndex++; continue; }
        var a = at(m.index), b = at(m.index + m[0].length - 1), r = document.createRange();
        r.setStart(a.node, a.offset);
        r.setEnd(b.node, b.offset + 1);
        finds.push(r);
      }
      if (HIGHLIGHTS && finds.length) {
        var all = new Highlight();
        finds.forEach(function (range) { all.add(range); });
        CSS.highlights.set("aice-find", all);
      }
      if (!finds.length) { findCount.textContent = "No matches"; return; }
      // Start from the first match below where you're reading
      var top = scrollEl.getBoundingClientRect().top, first = 0;
      for (var i = 0; i < finds.length; i++) { if (finds[i].getBoundingClientRect().bottom >= top) { first = i; break; } }
      showMatch(first);
    }
    function showMatch(i) {
      if (!finds.length) return;
      findAt = (i + finds.length) % finds.length;
      var r = finds[findAt];
      for (var p = r.startContainer.parentElement; p && p !== docEl; p = p.parentElement) if (p.tagName === "DETAILS" && !p.open) p.open = true;
      if (HIGHLIGHTS) CSS.highlights.set("aice-find-current", new Highlight(r));
      else { try { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r.cloneRange()); } catch (e) {} }
      var box = scrollEl.getBoundingClientRect(), rect = r.getBoundingClientRect();
      if (rect.top < box.top + 40 || rect.bottom > box.bottom - 40) scrollEl.scrollTop += rect.top - box.top - box.height / 3;
      findCount.textContent = (findAt + 1) + " of " + finds.length + (finds.length >= 1000 ? "+" : "");
    }
    function openFind() {
      if (!findBar) return;
      findBar.hidden = false;
      if (findBtn) findBtn.setAttribute("aria-expanded", "true");
      findInput.focus();
      findInput.select();
      if (findInput.value.trim()) runFind();
    }
    function closeFind(returnFocus) {
      if (!findBar || findBar.hidden) return;
      findBar.hidden = true;
      if (findBtn) findBtn.setAttribute("aria-expanded", "false");
      clearFind();
      findCount.textContent = "";
      if (returnFocus && findBtn) findBtn.focus();
    }
    on(findBtn, "click", function () { if (findBar.hidden) openFind(); else closeFind(true); });
    on(findInput, "input", function () { clearTimeout(findTimer); findTimer = setTimeout(function () { findTimer = 0; runFind(); }, 160); });
    on(findInput, "keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (findTimer) { clearTimeout(findTimer); findTimer = 0; runFind(); return; }   // still typing: search now
        showMatch(findAt + (e.shiftKey ? -1 : 1));
      } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFind(true); }   // closes find, not the reader
    });
    on($("#reader-find-next"), "click", function () { showMatch(findAt + 1); });
    on($("#reader-find-prev"), "click", function () { showMatch(findAt - 1); });
    on($("#reader-find-close"), "click", function () { closeFind(true); });

    /* ---- Reading progress, and continuing where you stopped ----
       The bar fills as you read. Where you stopped (the section at the top of the
       reading area) is kept with "Recently read", only in this browser. */
    var progressTick = 0, spotTimer = 0, lastSpot = null;
    function readRatio() { var max = scrollEl.scrollHeight - scrollEl.clientHeight; return max > 0 ? clamp(scrollEl.scrollTop / max, 0, 1) : 0; }
    function setProgress() { if (progressEl) progressEl.style.transform = "scaleX(" + readRatio().toFixed(3) + ")"; }
    function sectionInView() {
      var line = scrollEl.getBoundingClientRect().top + 90, found = null;
      var hs = $$("h2[data-slug], h3[data-slug]", docEl);
      for (var i = 0; i < hs.length; i++) { if (hs[i].getBoundingClientRect().top <= line) found = hs[i]; else break; }
      return found;
    }
    /* Measured while the document is on screen (a closed reader has no layout to measure) */
    function measureSpot() {
      var h = sectionInView();
      lastSpot = { id: current.id, at: Math.round(readRatio() * 1000) / 1000, slug: h ? h.getAttribute("data-slug") : "", heading: h ? h.textContent.replace(/\s+/g, " ").trim().slice(0, 120) : "" };
    }
    function saveSpot() {
      clearTimeout(spotTimer); spotTimer = 0;
      var s = lastSpot;
      lastSpot = null;
      if (!s || !Store.ok) return;
      var r = recent(), changed = false;
      r.forEach(function (x) { if (x.id === s.id) { x.at = s.at; x.slug = s.slug; x.heading = s.heading; changed = true; } });
      if (changed) Store.set("reading", r);
    }
    on(scrollEl, "scroll", function () {
      if (progressTick) return;
      progressTick = requestAnimationFrame(function () {
        progressTick = 0;
        setProgress();
        if (current && !current.local && current.loaded && reader.open) { measureSpot(); clearTimeout(spotTimer); spotTimer = setTimeout(saveSpot, 800); }
      });
    }, { passive: true });
    function offerResume(spot) {
      if (!resumeBox) return;
      var target = spot && spot.slug && spot.at > 0.04 && spot.at < 0.97 ? document.getElementById("doc-" + spot.slug) : null;
      resumeBox.hidden = !target;
      if (!target) return;
      resumeText.textContent = "You stopped at “" + (spot.heading || target.textContent.trim()) + "”.";
      resumeBox._target = target;
    }
    on($("#reader-resume-go"), "click", function () { var t = resumeBox._target; resumeBox.hidden = true; if (t) land(t); });
    on($("#reader-resume-top"), "click", function () { resumeBox.hidden = true; focusTitle(); });

    /* ---- Your notebook, in the reader: an answer to the question, and notes ----
       Saved as you type (after a short pause), only in this browser. */
    var nbTimer = 0, nbFor = null, nbQ = "";
    function nbSay(text) { if (nbStatus) nbStatus.textContent = text; }
    function nbSave() {
      clearTimeout(nbTimer); nbTimer = 0;
      if (!nbFor) return;
      var ok = Notes.save(nbFor.id, nbFor.title, { notes: nbNotes.value, a: nbAnswer.value, q: nbQ });
      nbSay(!Store.ok ? "This browser isn't allowing storage here, so notes last only until you close the page." : ok ? "Saved on this device." : "Couldn't save: this browser's storage may be full.");
      if (nbAnother) nbAnother.hidden = !!nbAnswer.value.trim();
    }
    function notebookFor(m) {
      if (!nbBox) return;
      if (nbTimer) nbSave();         // anything still waiting to be saved for the previous document
      nbFor = { id: m.id, title: m.title };
      var d = Notes.doc(m.id) || { notes: "", q: "", a: "" };
      var qEl = $("#reader-reflect-q");
      nbQ = d.a.trim() && d.q ? d.q : (qEl ? qEl.textContent : "");
      if (qEl) qEl.textContent = nbQ;
      nbAnswer.value = d.a;
      nbNotes.value = d.notes;
      if (nbAnother) nbAnother.hidden = !!d.a.trim();
      nbSay("");
      nbBox.hidden = false;
    }
    function nbChanged() { nbSay("Saving…"); clearTimeout(nbTimer); nbTimer = setTimeout(nbSave, 500); }
    on(nbAnswer, "input", nbChanged);
    on(nbNotes, "input", nbChanged);
    on(nbAnswer, "blur", function () { if (nbTimer) nbSave(); });
    on(nbNotes, "blur", function () { if (nbTimer) nbSave(); });
    on(nbAnother, "click", function () {
      var qEl = $("#reader-reflect-q");
      nbQ = REFLECT[(REFLECT.indexOf(nbQ) + 1) % REFLECT.length];
      if (qEl) qEl.textContent = nbQ;
      liveEl.textContent = "New question: " + nbQ;
    });
    on($("#nb-section"), "click", function () {
      var h = sectionInView() || $("h1, h2", docEl);
      var name = h ? h.textContent.replace(/\s+/g, " ").trim() : (nbFor ? nbFor.title : "");
      var before = nbNotes.value.replace(/\s+$/, "");
      nbNotes.value = (before ? before + "\n\n" : "") + "### " + name + "\n";
      nbNotes.focus();
      try { nbNotes.setSelectionRange(nbNotes.value.length, nbNotes.value.length); } catch (e) {}
      nbNotes.scrollTop = nbNotes.scrollHeight;
      nbSave();
    });
    Resets.notebook = function () { if (nbFor) { nbAnswer.value = ""; nbNotes.value = ""; nbSay(""); if (nbAnother) nbAnother.hidden = false; } };
    on(document, "aice:store", function (e) {
      var d = e.detail || {};
      if (!d.otherTab || d.key !== "notebook" || !nbFor || nbBox.hidden || nbTimer) return;
      if (document.activeElement === nbNotes || document.activeElement === nbAnswer) return;
      var saved = Notes.doc(nbFor.id) || { notes: "", a: "" };
      nbNotes.value = saved.notes;
      nbAnswer.value = saved.a;
      if (nbAnother) nbAnother.hidden = !!saved.a.trim();
      nbSay("Updated from another tab.");
    });

    /* ---- Download as Markdown: this document as plain text, to adapt in any editor ---- */
    on($("#reader-markdown"), "click", function () {
      var doc = current;
      if (!doc || doc.local || !doc.loaded) return;
      needs("TurndownService").then(function (T) {
        download(doc.id + ".md", markdownOf(T, doc.html, doc.meta), "text/markdown");
      }, function () { toast("Couldn't load the Markdown converter. Check your connection and try again."); });
    });
    on(shareBtn, "click", function () {
      if (!Share || !current || current.local) return;
      Share.open({ url: Share.pageUrl() + "#library/" + current.id, label: titleEl.textContent, opener: shareBtn });
    });

    /* ---- Present mode: full screen, large type, and the screen kept awake ---- */
    var presenting = false, wake = null, presentSize = 2, stoppedAt = 0;
    function presentStatus() {
      if (!presentState) return;
      presentState.textContent = !presenting ? "" : wake ? "Screen stays on while you present." : ("wakeLock" in navigator ? "Your screen may dim: the browser didn't keep it awake." : "Your screen may dim: this browser can't keep it awake.");
    }
    function setWake(onOff) {
      if (onOff) {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") { presentStatus(); return; }
        navigator.wakeLock.request("screen").then(function (s) {
          wake = s;
          on(s, "release", function () { wake = null; presentStatus(); });
          if (!presenting) { s.release().catch(function () {}); wake = null; }
          presentStatus();
        }, function () { wake = null; presentStatus(); });
      } else if (wake) {
        wake.release().catch(function () {});
        wake = null;
      }
    }
    function setPresentSize(n) { presentSize = clamp(n, 1, 4); reader.setAttribute("data-present-size", String(presentSize)); }
    function present(onOff) {
      if (onOff === presenting) return;
      presenting = onOff;
      reader.classList.toggle("is-presenting", onOff);
      if (presentBtn) presentBtn.setAttribute("aria-pressed", onOff ? "true" : "false");
      if (onOff) {
        setPresentSize(presentSize);
        if (frame.requestFullscreen && !document.fullscreenElement) {
          try { var p = frame.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        }
        setWake(true);
        liveEl.textContent = "Presenting. Press Escape or Stop presenting to finish.";
        var stop = $("#present-exit");
        if (stop) try { stop.focus({ preventScroll: true }); } catch (e) {}
      } else {
        stoppedAt = Date.now();
        if (document.fullscreenElement === frame && document.exitFullscreen) { try { var q = document.exitFullscreen(); if (q && q.catch) q.catch(function () {}); } catch (e) {} }
        setWake(false);
        liveEl.textContent = "Stopped presenting.";
      }
      presentStatus();
    }
    on(presentBtn, "click", function () { present(!presenting); });
    on($("#present-exit"), "click", function () { present(false); if (presentBtn) try { presentBtn.focus(); } catch (e) {} });
    on($("#present-smaller"), "click", function () { setPresentSize(presentSize - 1); });
    on($("#present-larger"), "click", function () { setPresentSize(presentSize + 1); });
    // Escape finishes presenting first; only a second Escape closes the reader
    on(reader, "cancel", function (e) { if (presenting || Date.now() - stoppedAt < 600) { e.preventDefault(); present(false); } });
    on(document, "fullscreenchange", function () {
      if (presenting && document.fullscreenElement !== frame) present(false);
      // Toasts shown while full screen move back into the reader afterwards
      var region = $("#toasts");
      if (region && !document.fullscreenElement && frame.contains(region) && frame !== reader) reader.appendChild(region);
    });
    on(document, "visibilitychange", function () { if (presenting && document.visibilityState === "visible" && !wake) setWake(true); });

    /* ---- Open a Markdown file from this device (button, drag and drop, or "Open with" once installed) ---- */
    function openFile(file) {
      if (!file) return;
      if (!/\.(md|markdown|mdown|txt)$/i.test(file.name || "")) { toast("That isn't a Markdown file. Choose a file ending in .md."); return; }
      if (file.size > 3 * 1048576) { toast("That file is over 3 MB, which is too big to open here."); return; }
      Promise.all([file.text(), needs("marked"), needs("DOMPurify")]).then(function (res) {
        var raw = res[1].parse(res[0], { gfm: true, async: false });
        var clean = res[2].sanitize(raw, {
          FORBID_TAGS: ["style", "form", "script", "iframe", "object", "embed", "img", "picture", "video", "audio", "source", "button", "textarea", "select", "dialog"],
          FORBID_ATTR: ["style", "class", "id", "name", "srcset", "autofocus"],
          ALLOW_DATA_ATTR: false
        });
        showReader(document.activeElement);
        current = { id: "", loaded: true, local: true };
        fill({ title: file.name, group: "Your file" }, clean, true);
        focusTitle();
      }).catch(function (e) {
        errors.push("open file: " + (e && e.message));
        toast("That file couldn't be opened here.");
      });
    }
    var fileInput = $("#md-file");
    on(fileInput, "change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      openFile(f);
    });
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, "Files") > -1; }
    if (sectionEl) {
      on(sectionEl, "dragover", function (e) { if (hasFiles(e)) { e.preventDefault(); sectionEl.classList.add("is-dropping"); } });
      on(sectionEl, "dragleave", function (e) { if (!e.relatedTarget || !sectionEl.contains(e.relatedTarget)) sectionEl.classList.remove("is-dropping"); });
      on(sectionEl, "drop", function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        sectionEl.classList.remove("is-dropping");
        openFile(e.dataTransfer.files[0]);
      });
    }
    // Installed app: "Open with" a .md file (File Handling API, where supported)
    if (window.launchQueue && typeof window.launchQueue.setConsumer === "function") {
      window.launchQueue.setConsumer(function (params) {
        if (params && params.files && params.files.length) params.files[0].getFile().then(openFile, function () { toast("That file couldn't be opened."); });
      });
    }

    /* ---- Start ---- */
    if (listEl) getIndex().then(renderList, renderListError);
    renderResume();
    on(document, "aice:store", renderResume);
    on(document, "aice:caches", function () { refreshSaved(); });
    Resets.reading = renderResume;
    if (parseRoute(location.hash)) setTimeout(sync, 0);   // a shared or bookmarked link to a document
    return { go: go, recent: recent, searchChunks: searchChunks, searchSize: searchSize, saveAll: saveAll, refreshSaved: refreshSaved, removeSaved: removeSaved, getIndex: getIndex, libraryBytes: libraryBytes };
  });

  /* =========================================================================
     OFFLINE AND INSTALL (the installable app edition)
     - Registers the service worker (sw.js), which keeps the app on this
       device so it opens without internet.
     - When a new version is published, offers to update. Never forced.
     - Shows install, storage and offline status, with buttons to save the
       library, ask the browser to keep the offline copy, check for updates,
       and remove it all from this device.
     Nothing here is tracked or reported anywhere: these are the browser's
     own features, and their answers stay on this device.
     ========================================================================= */
  /* ---------- YOUR NOTEBOOK: everything written in the reader, in one place ----------
     Lists each document you've written about (newest first) with a link back, lets you
     download it all as one Markdown file, and delete one document's notes or all of them.
     Data comes from Notes (above); this part only shows it. */
  /* ---------- AI LAB: look inside ----------
     1. Tokens: gpt-tokenizer splits text into the pieces GPT-4o reads (the o200k_base set),
        and compares Article 1 of the Universal Declaration of Human Rights in twelve languages.
     2. Next word: a trigram model (which word follows each pair of words) built here from
        the library's own text, with "adventurousness" (temperature) and where each word came from.
     3. Who's in the data: two such models, each trained on one part of the library.
     Everything runs in this browser. Nothing is stored or sent. To add a language to the
     comparison, add a line to UDHR with Article 1 from the OHCHR translation project. */
  var Lab = safe("lab", function () {
    var root = $("#lab");
    if (!root) return null;
    var nf = (function () { try { return new Intl.NumberFormat(); } catch (e) { return { format: String }; } })();
    function pct(x) { return x >= 0.995 ? "100%" : x < 0.005 ? "under 1%" : Math.round(x * 100) + "%"; }

    /* ---- Shared: ranked horizontal bars, one hue, value at the tip, a tooltip on hover and focus ----
       rows: [{ label, value, valueText, tip: [value line, detail lines...], onPick }].
       Rows with onPick are buttons, so they work with a keyboard. Every number in a tooltip
       is also in the chart's table view. */
    function hbars(box, rows) {
      box.textContent = "";
      var fig = box.closest("figure") || box.parentNode, tip = fig.querySelector(".lab-tip");
      if (!tip) {
        tip = el("div", "lab-tip");
        tip.hidden = true;
        tip.setAttribute("aria-hidden", "true");   // the same facts are in the table view
        fig.appendChild(tip);
        on(tip, "pointerenter", function () { clearTimeout(tip._t); });
        on(tip, "pointerleave", function () { tip.hidden = true; });
      }
      var max = 0;
      rows.forEach(function (r) { if (r.value > max) max = r.value; });
      rows.forEach(function (r) {
        var row = el(r.onPick ? "button" : "div", "hbar");
        if (r.onPick) { row.type = "button"; on(row, "click", r.onPick); }
        var name = el("span", "hbar-label");
        if (typeof r.label === "string") name.textContent = r.label; else name.appendChild(r.label);
        row.appendChild(name);
        var track = el("span", "hbar-track"), fill = el("span", "hbar-fill");
        fill.style.width = "calc((100% - 9.5rem) * " + (max ? r.value / max : 0).toFixed(4) + ")";   // room for the value at the tip
        track.appendChild(fill);
        track.appendChild(el("span", "hbar-value", r.valueText));
        row.appendChild(track);
        function show() {
          if (!r.tip) return;
          clearTimeout(tip._t);
          tip.textContent = "";
          tip.appendChild(el("strong", null, r.tip[0]));
          r.tip.slice(1).forEach(function (line) { tip.appendChild(el("span", null, line)); });
          tip.hidden = false;
          var top = row.offsetTop + row.offsetHeight + 4;
          tip.style.top = top + "px";
          tip.style.left = Math.max(0, Math.min(track.offsetLeft, fig.clientWidth - tip.offsetWidth)) + "px";
        }
        function hide() { tip._t = setTimeout(function () { tip.hidden = true; }, 150); }
        on(row, "pointerenter", show);
        on(row, "pointerleave", hide);
        on(row, "focus", show);
        on(row, "blur", function () { tip.hidden = true; });
        on(row, "keydown", function (e) { if (e.key === "Escape" && !tip.hidden) { e.stopPropagation(); tip.hidden = true; } });
        box.appendChild(row);
      });
    }

    /* ---- 1. Tokens ---- */
    var UDHR = [
      { code: "iu", name: "Inuktitut", native: "ᐃᓄᒃᑎᑐᑦ", text: "ᐃᓅᔪᓕᒫᑦ ᐊᓂᖅᑎᕆᔪᓕᒫᑦ ᐃᓅᓚᐅᕐᒪᑕ ᐃᓱᒪᕐᓱᕐᖢᑎᒃ ᐊᒻᒪᓗ ᐊᔾᔨᐅᖃᑎᒌᒃᖢᑎᒃ ᓂᕐᓱᐊᖑᓂᒃᑯᑦ ᐊᒻᒪᓗ ᐱᔪᓐᓇᐃᑎᑎᒍᑦ. ᐃᓱᖃᖅᑐᖁᑎᖃᕐᑎᑕᐅᕙᓕᕐᐳᑦ ᐱᔾᔪᑎᖃᕐᓂᒃᑯᑦ ᖃᑕᙳᑎᒌᑦᑎᐊᕆᐊᖃᕐᓂᒃᑯᓪᓗ." },
      { code: "oj", name: "Anishinaabemowin", native: "Northwestern Ojibwe", text: "ᑭᑲᓇᐌᓀᓐ ᑲᐱᒪᑎᓯᐗᑦ ᓂᑕᐎᑭᐗᒃ ᑎᐯᓂᒥᑎᓱᐎᓂᒃ ᒥᓇ ᑕᐱᑕ ᑭᒋᐃᓀᑕᑯᓯᐎᓐ ᑲᔦ ᑌᐸᑫᑕᑯᓯᐎᓐ. ᐅᑕᔦᓇᐗ ᒥᑲᐎᐎᓐ ᑲᔦ ᓂᑄᑲᐎᓐ ᒥᓇᐗ ᑕᔥ ᒋᐃᔑᑲᓇᐗᐸᑎᐗᐸᓐ ᐊᒐᑯ ᒥᓄᐎᒋᐎᑎᐎᓂᒃ." },
      { code: "am", name: "Amharic", native: "አማርኛ", text: "የሰው፡ልጅ፡ሁሉ፡ሲወለድ፡ነጻና፡በክብርና፡በመብትም፡እኩልነት፡ያለው፡ነው።፡የተፈጥሮ፡ማስተዋልና፡ሕሊና፡ስላለው፡አንዱ፡ሌላውን፡በወንድማማችነት፡መንፈስ፡መመልከት፡ይገባዋል።" },
      { code: "yo", name: "Yoruba", native: "Èdè Yorùbá", text: "Gbogbo ènìyàn ni a bí ní òmìnira; iyì àti ẹ̀tọ́ kọ̀ọ̀kan sì dọ́gba. Wọ́n ní ẹ̀bùn ti làákàyè àti ti ẹ̀rí‐ọkàn, ó sì yẹ kí wọn ó máa hùwà sí ara wọn gẹ́gẹ́ bí ọmọ ìyá." },
      { code: "ta", name: "Tamil", native: "தமிழ்", text: "மனிதப் பிறிவியினர் சகலரும் சுதந்திரமாகவே பிறக்கின்றனர் ; அவர்கள் மதிப்பிலும், உரிமைகளிலும் சமமானவர்கள், அவர்கள் நியாயத்தையும் மனச்சாட்சியையும் இயற்பண்பாகப் பெற்றவர்கள். அவர்கள் ஒருவருடனொருவர் சகோதர உணர்வுப் பாங்கில் நடந்துகொள்ளல் வேண்டும்." },
      { code: "hi", name: "Hindi", native: "हिन्दी", text: "सभी मनुष्यों को गौरव और अधिकारों के मामले में जन्मजात स्वतन्त्रता और समानता प्राप्त है । उन्हें बुद्घि और अन्तरात्मा की देन प्राप्त है और परस्पर उन्हें भाईचारे के भाव से बर्ताव करना चाहिए ।" },
      { code: "ar", name: "Arabic", native: "العربية", text: "يولد جميع الناس أحرارًا متساوين في الكرامة والحقوق. وقد وهبوا عقلاً وضميرًا وعليهم أن يعامل بعضهم بعضًا بروح الإخاء." },
      { code: "fr", name: "French", native: "français", text: "Tous les êtres humains naissent libres et égaux en dignité et en droits. Ils sont doués de raison et de conscience et doivent agir les uns envers les autres dans un esprit de fraternité." },
      { code: "es", name: "Spanish", native: "español", text: "Todos los seres humanos nacen libres e iguales en dignidad y derechos y, dotados como están de razón y conciencia, deben comportarse fraternalmente los unos con los otros." },
      { code: "zh", name: "Chinese (simplified)", native: "中文", text: "人人生而自由,在尊严和权利上一律平等。他们赋有理性和良心,并应以兄弟关系的精神相对待。" },
      { code: "sw", name: "Swahili", native: "Kiswahili", text: "Watu wote wamezaliwa huru, hadhi na haki zao ni sawa. Wote wamejaliwa akili na dhamiri, hivyo yapasa watendeane kindugu." },
      { code: "en", name: "English", native: "", text: "All human beings are born free and equal in dignity and rights. They are endowed with reason and conscience and should act towards one another in a spirit of brotherhood." }
    ];
    var T = null, tokTimer = 0;
    var tokInput = $("#tok-input"), tokView = $("#tok-view"), tokList = $("#tok-list"), tokStats = $("#tok-stats"), tokStatus = $("#tok-load-status");
    var SHOW_MAX = 600;   // tokens drawn at once; the count is always complete
    function chip(text, count) {
      var c = el("span", "tok");
      text.split(/( |\n)/).forEach(function (part) {
        if (part === " ") c.appendChild(el("span", "tok-sp", "·"));
        else if (part === "\n") c.appendChild(el("span", "tok-sp", "↵"));
        else if (part) c.appendChild(document.createTextNode(part));
      });
      if (count > 1) c.appendChild(el("span", "tok-n", "×" + count));
      return c;
    }
    function renderTokens() {
      if (!T) return;
      var text = tokInput.value, ids = T.encode(text), chars = Array.from(text).length;
      tokStats.textContent = nf.format(ids.length) + (ids.length === 1 ? " token" : " tokens") + " · " + nf.format(chars) + " characters" +
        (ids.length ? " · about " + (chars / ids.length).toFixed(1) + " characters per token" : "");
      tokView.textContent = "";
      tokList.textContent = "";
      // Some letters are stored as several tokens (pieces of the letter's bytes). Those tokens are
      // shown together as one piece, marked ×2, ×3…, so you see the letter and what it cost.
      var shown = ids.slice(0, SHOW_MAX), start = 0;
      for (var i = 0; i < shown.length; i++) {
        var group = shown.slice(start, i + 1), piece = T.decode(group);
        if (piece.indexOf("\uFFFD") < 0 || group.length >= 8 || i === shown.length - 1) {
          tokView.appendChild(chip(piece, group.length));
          start = i + 1;
        }
        var li = el("li"), one = T.decode([shown[i]]);
        li.appendChild(el("code", null, JSON.stringify(one)));
        li.appendChild(document.createTextNode(" → " + shown[i] + (one.indexOf("\uFFFD") >= 0 ? " (part of a letter)" : "")));
        tokList.appendChild(li);
      }
      if (ids.length > SHOW_MAX) tokView.appendChild(el("span", "tok-more small muted", "…and " + nf.format(ids.length - SHOW_MAX) + " more"));
    }
    function renderLanguages() {
      var base = 0, data = UDHR.map(function (l) {
        var n = T.encode(l.text).length;
        if (l.code === "en") base = n;
        return { l: l, n: n, chars: Array.from(l.text).length };
      });
      data.sort(function (a, b) { return b.n - a.n; });   // largest first
      hbars($("#tok-chart"), data.map(function (d) {
        var times = base ? d.n / base : 1, label = el("span");
        label.appendChild(document.createTextNode(d.l.name));
        if (d.l.native) { label.appendChild(document.createTextNode(" ")); var b = el("bdi", "muted", d.l.native); label.appendChild(b); }
        return {
          label: label, value: d.n,
          valueText: nf.format(d.n) + " tokens · " + (d.l.code === "en" ? "baseline" : times.toFixed(1) + "×"),
          tip: [nf.format(d.n) + " tokens", d.l.name + (d.l.code === "en" ? ": the baseline" : ": " + times.toFixed(1) + " times as many as English"), nf.format(d.chars) + " characters. Choose it to see the pieces."],
          onPick: function () {
            tokInput.value = d.l.text;
            renderTokens();
            try { tokInput.scrollIntoView({ block: "center", behavior: Settings.reducedMotion() ? "instant" : "smooth" }); } catch (e) {}
            announce("Showing Article 1 in " + d.l.name + ": " + d.n + " tokens.");
          }
        };
      }));
      var tbody = $("#tok-table");
      tbody.textContent = "";
      data.forEach(function (d) {
        var tr = el("tr");
        var th = el("th", null, d.l.name + (d.l.native ? " (" + d.l.native + ")" : ""));
        th.scope = "row";
        tr.appendChild(th);
        tr.appendChild(el("td", "num", nf.format(d.n)));
        tr.appendChild(el("td", "num", d.l.code === "en" ? "baseline" : (d.n / base).toFixed(1) + "×"));
        tr.appendChild(el("td", "num", nf.format(d.chars)));
        tbody.appendChild(tr);
      });
    }
    on($("#tok-load"), "click", function () {
      var btn = this;
      btn.disabled = true;
      tokStatus.textContent = BUILD === "pwa" ? "Getting the token counter…" : "Unpacking the token counter…";
      needs("GPTTokenizer").then(function (lib) {
        T = lib;
        if (BUILD === "pwa") setTimeout(announceCaches, 600);   // the service worker has just saved it: refresh "Your data"
        $("#tok-start").hidden = true;
        $("#tok-ui").hidden = false;
        renderTokens();
        renderLanguages();
        announce("The token counter is on.");
      }, function (err) {
        btn.disabled = false;
        tokStatus.textContent = err && /newer browser/.test(err.message) ? "This browser is too old to unpack the token counter. Try a current Chrome, Edge, Firefox or Safari." :
          navigator.onLine === false ? "You're offline, and the token counter isn't saved on this device yet. Connect once, then it works offline." :
          "Couldn't load the token counter. Please try again.";
      });
    });
    on(tokInput, "input", function () { clearTimeout(tokTimer); tokTimer = setTimeout(renderTokens, 120); });

    /* ---- Word models for 2 and 3: which word follows each pair of words ---- */
    var WORD = (function () {
      try { return new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}\\p{M}'’\\-]*|[.!?]", "gu"); }
      catch (e) { return /[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’\-]*|[.!?]/g; }
    })();
    var START = "<s>";
    function wordsOf(text) { return String(text || "").toLowerCase().match(WORD) || []; }
    function isEnd(w) { return w === "." || w === "!" || w === "?"; }
    function pause() {   // let the page breathe between slices of work (cooperative scheduling)
      if (window.scheduler && typeof window.scheduler.yield === "function") return window.scheduler.yield();
      return new Promise(function (r) { setTimeout(r, 0); });
    }
    function bump(map, key, word, doc) {
      var m = map.get(key);
      if (!m) { m = new Map(); map.set(key, m); }
      var e = m.get(word);
      if (e) e.n++; else m.set(word, { n: 1, doc: doc });
    }
    /* Train on library sections (from Library.searchChunks), a few at a time */
    function train(chunks, keep, onProgress) {
      var model = { tri: new Map(), bi: new Map(), words: 0, docs: [], docIndex: {} };
      var list = chunks.filter(function (c) { return !keep || keep(c); }), i = 0;
      function slice() {
        var until = Date.now() + 12;
        while (i < list.length && Date.now() < until) {
          var c = list[i++];
          if (!(c.doc in model.docIndex)) { model.docIndex[c.doc] = model.docs.length; model.docs.push({ id: c.doc, title: c.title }); }
          var d = model.docIndex[c.doc], a = START, b = START;
          wordsOf(c.heading + ". " + c.text).forEach(function (w) {
            bump(model.tri, a + " " + b, w, d);
            bump(model.bi, b, w, d);
            model.words++;
            if (isEnd(w)) { a = START; b = START; } else { a = b; b = w; }
          });
        }
        if (onProgress) onProgress(list.length ? i / list.length : 1);
        return i < list.length ? pause().then(slice) : model;
      }
      return Promise.resolve().then(slice);
    }
    /* What might come next after these words: the last two, else the last one, else a sentence start */
    function predict(model, words, anywhere) {
      var n = words.length, a = n > 1 ? words[n - 2] : START, b = n ? words[n - 1] : START;
      if (isEnd(b)) { a = START; b = START; }
      else if (isEnd(a)) a = START;
      var level = 3, m = anywhere && a === START && b !== START ? null : model.tri.get(a + " " + b);
      if (!m && anywhere && a === START && b !== START) { m = model.bi.get(b); if (m && m.size) return finish(2, true); }
      if (!m || !m.size) { level = 2; m = model.bi.get(b); }
      if (!m || !m.size) { level = 1; m = model.tri.get(START + " " + START); b = START; }
      return finish(level, false);
      function finish(lvl, any) {
        var list = [], total = 0;
        if (m) m.forEach(function (e, w) { list.push({ word: w, n: e.n, doc: e.doc }); total += e.n; });
        list.sort(function (x, y) { return y.n - x.n || (x.word < y.word ? -1 : 1); });
        return { level: lvl, anywhere: any, a: a, b: b, list: list, total: total };
      }
    }
    /* Chances after "adventurousness" (temperature): 0 always picks the likeliest word */
    function chances(list, temp) {
      if (!list.length) return [];
      if (temp < 0.05) return list.map(function (x, i) { return i === 0 ? 1 : 0; });
      var logs = list.map(function (x) { return Math.log(x.n) / temp; }), top = Math.max.apply(null, logs);
      var w = logs.map(function (l) { return Math.exp(l - top); }), sum = w.reduce(function (s, v) { return s + v; }, 0);
      return w.map(function (v) { return v / sum; });
    }
    function sample(p) { var r = Math.random(), acc = 0; for (var i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i; } return p.length - 1; }
    function joinWords(ws) { return ws.reduce(function (s, w) { return s + (isEnd(w) || !s ? "" : " ") + w; }, ""); }
    var chunksP = null;
    function libraryChunks() {
      if (!chunksP) {
        chunksP = Library ? Library.searchChunks() : Promise.reject(new Error("no library"));
        chunksP.catch(function () { chunksP = null; });
      }
      return chunksP;
    }
    function libraryProblem(err) {
      return IS_FILE && BUILD === "pwa" ? "This copy was opened straight from a folder, so it can't read the library. Use the single-file edition." :
        navigator.onLine === false ? "The library's text isn't saved on this device yet. Connect once (or use “Save the whole library”), then this works offline." :
        "Couldn't read the library. Please try again.";
    }

    /* ---- 2. Next word ---- */
    var full = null, gen = [], busy = false;
    var nextInput = $("#next-input"), nextTemp = $("#next-temp"), nextOut = $("#next-out");
    function temp() { return Number(nextTemp.value) || 0; }
    function contextWords() { return wordsOf(nextInput.value).concat(gen); }
    function describe(pr, words, where) {
      var said = function (t) { return "“" + t + "”"; };
      where = where || "in the library";
      if (pr.level === 3 && pr.a !== START) return "It looked at the last two words, " + said(pr.a + " " + pr.b) + ", seen " + nf.format(pr.total) + (pr.total === 1 ? " time " : " times ") + where + ".";
      if (pr.level === 3) return pr.b === START ? "It's starting a new sentence, so it looked at how sentences " + where + " begin." : "It looked at " + said(pr.b) + " at the start of a sentence, seen " + nf.format(pr.total) + (pr.total === 1 ? " time " : " times ") + where + ".";
      if (pr.anywhere) return "It looked at what comes after " + said(pr.b) + ", seen " + nf.format(pr.total) + (pr.total === 1 ? " time " : " times ") + where + ".";
      if (pr.level === 2 && words.length < 2) return "It had never seen " + said(pr.b) + " start a sentence, so it looked at what follows it anywhere.";
      if (pr.level === 2) return "It had never seen " + said(words.slice(-2).join(" ")) + ", so it looked only at the last word, " + said(pr.b) + ".";
      return "It had never seen " + said(words[words.length - 1] || "") + ", so it guessed a word that often starts a sentence.";
    }
    function renderNext() {
      if (!full) return;
      var words = contextWords(), pr = predict(full, words), p = chances(pr.list, temp());
      var rows = pr.list.map(function (x, i) { return { x: x, p: p[i] }; }).sort(function (u, v) { return v.p - u.p || v.x.n - u.x.n; });
      var shown = rows.slice(0, 6);
      var last = words.length ? words.slice(-2).join(" ") : "";
      $("#next-cap").textContent = last ? "What could come next after “…" + last + "”" : "How a sentence could begin";
      hbars($("#next-chart"), shown.map(function (r) {
        return {
          label: r.x.word, value: r.p, valueText: pct(r.p),
          tip: [pct(r.p) + " chance", "“" + r.x.word + "”: seen " + nf.format(r.x.n) + (r.x.n === 1 ? " time" : " times") + " here", "First seen in: " + full.docs[r.x.doc].title],
          onPick: function () { addWord(r.x, pr); }
        };
      }));
      var tbody = $("#next-table");
      tbody.textContent = "";
      shown.forEach(function (r) {
        var tr = el("tr"), th = el("th", null, r.x.word);
        th.scope = "row";
        tr.appendChild(th);
        tr.appendChild(el("td", "num", pct(r.p)));
        tr.appendChild(el("td", "num", nf.format(r.x.n)));
        tbody.appendChild(tr);
      });
      $("#next-context").textContent = describe(pr, words) + (rows.length > 6 ? " " + nf.format(rows.length - 6) + " other words were seen there too." : "");
      return { pr: pr, p: p };
    }
    function renderOut(fresh) {
      nextOut.textContent = "";
      var start = nextInput.value.trim().replace(/\s+/g, " ");
      nextOut.appendChild(document.createTextNode(start));
      gen.forEach(function (w, i) {
        if (!isEnd(w) && (start || i)) nextOut.appendChild(document.createTextNode(" "));
        nextOut.appendChild(el("span", "gen" + (fresh && i === gen.length - 1 ? " gen-new" : ""), w));
      });
    }
    function addWord(x, pr) {
      gen.push(x.word);
      renderOut(true);
      var src = $("#next-source");
      src.textContent = "";
      var where = full.docs[x.doc], times = nf.format(x.n) + (x.n === 1 ? " time" : " times");
      var how = pr.level === 1 || pr.b === START ? "starts a sentence " + times : "came after “" + (pr.level === 3 && pr.a !== START ? pr.a + " " : "") + pr.b + "” " + times;
      src.appendChild(document.createTextNode("“" + x.word + "” " + how + " in the library. First seen in "));
      var a = el("a", null, where.title);
      a.href = "#library/" + where.id;
      src.appendChild(a);
      src.appendChild(document.createTextNode("."));
      renderNext();
    }
    function nextWord() {
      var r = renderNext();
      if (!r || !r.pr.list.length) return false;
      addWord(r.pr.list[sample(r.p)], r.pr);
      return true;
    }
    function setBusy(b) { busy = b; ["#next-one", "#next-ten", "#next-reset"].forEach(function (id) { var x = $(id); if (x) x.disabled = b; }); }
    on($("#next-build"), "click", function () {
      var btn = this, bar = $("#next-progress"), meter = bar && bar.querySelector('[role="progressbar"]'), fill = bar && bar.querySelector(".meter-fill");
      btn.disabled = true;
      if (bar) bar.hidden = false;
      function progress(f) {
        var v = Math.round(f * 100);
        if (meter) meter.setAttribute("aria-valuenow", String(v));
        if (fill) fill.style.width = v + "%";
        $("#next-progress-text").textContent = "Reading the library… " + v + "%";
      }
      libraryChunks().then(function (chunks) { return train(chunks, null, progress); }).then(function (model) {
        full = model;
        $("#next-start").hidden = true;
        $("#next-ui").hidden = false;
        renderOut(false);
        renderNext();
        announce("The model is ready. It read " + nf.format(model.words) + " words from " + model.docs.length + " documents.");
      }, function (err) {
        btn.disabled = false;
        if (bar) bar.hidden = true;
        $("#next-progress-text").textContent = "";
        toast(libraryProblem(err));
      });
    });
    on($("#next-one"), "click", function () { if (!busy) nextWord(); });
    on($("#next-ten"), "click", function () {
      if (busy) return;
      setBusy(true);
      var left = 10, wait = Settings.reducedMotion() ? 0 : 220;
      (function step() {
        if (left-- <= 0 || !nextWord()) { setBusy(false); return; }
        setTimeout(step, wait);
      })();
    });
    on($("#next-reset"), "click", function () { gen = []; $("#next-source").textContent = ""; renderOut(false); renderNext(); });
    on(nextInput, "input", function () { gen = []; $("#next-source").textContent = ""; renderOut(false); renderNext(); });
    on(nextTemp, "input", function () { $("#next-temp-out").textContent = Number(nextTemp.value).toFixed(1); renderNext(); });

    /* ---- 3. Who's in the data ---- */
    var selA = $("#data-a"), selB = $("#data-b"), groupModels = {};
    if (Library && selA && selB) {
      Library.getIndex().then(function (index) {
        var groups = [];
        index.documents.forEach(function (d) { if (groups.indexOf(d.group) < 0) groups.push(d.group); });
        [selA, selB].forEach(function (sel) {
          sel.textContent = "";
          groups.forEach(function (g) {
            var o = el("option", null, g);
            o.value = g;
            sel.appendChild(o);
          });
        });
        selA.value = groups.indexOf("Lessons and classroom tools") >= 0 ? "Lessons and classroom tools" : groups[0];
        selB.value = groups.indexOf("Local ecosystem study") >= 0 ? "Local ecosystem study" : groups[Math.min(1, groups.length - 1)];
      }, function () {});
    }
    function groupModel(group, chunks) {
      if (!groupModels[group]) {
        groupModels[group] = Library.getIndex().then(function (index) {
          var ids = {};
          index.documents.forEach(function (d) { if (d.group === group) ids[d.id] = true; });
          return train(chunks, function (c) { return ids[c.doc]; });
        });
        groupModels[group].catch(function () { delete groupModels[group]; });
      }
      return groupModels[group];
    }
    on($("#data-run"), "click", function () {
      var btn = this, words = wordsOf($("#data-prompt").value), ga = selA.value, gb = selB.value;
      btn.disabled = true;
      $("#data-summary").textContent = "Training both models on this device…";
      libraryChunks().then(function (chunks) {
        return Promise.all([groupModel(ga, chunks), groupModel(gb, chunks)]);
      }).then(function (models) {
        var tops = [];
        [["a", ga, models[0]], ["b", gb, models[1]]].forEach(function (s) {
          var model = s[2], pr = predict(model, words, true), p = chances(pr.list, 1), rows = pr.list.slice(0, 6);
          tops.push({ group: s[1], pr: pr, p: p, words: rows.map(function (x) { return x.word; }) });
          $("#data-cap-" + s[0]).textContent = "Model " + s[0].toUpperCase() + ": " + s[1];
          $("#data-card-" + s[0]).textContent = "Read " + nf.format(model.words) + " words from " + model.docs.length + (model.docs.length === 1 ? " document. " : " documents. ") + describe(pr, words, "in what it read");
          hbars($("#data-chart-" + s[0]), rows.map(function (x, i) {
            return { label: x.word, value: p[i], valueText: pct(p[i]), tip: [pct(p[i]) + " chance", "“" + x.word + "”: seen " + nf.format(x.n) + (x.n === 1 ? " time" : " times"), "First seen in: " + model.docs[x.doc].title] };
          }));
        });
        $("#data-out").hidden = false;
        var a = tops[0], b = tops[1], shared = a.words.filter(function (w) { return b.words.indexOf(w) >= 0; }).length;
        var first = function (t, name) { return t.words.length ? "Model " + name + "'s likeliest next word is “" + t.words[0] + "” (" + pct(t.p[0]) + ")." : "Model " + name + " has nothing to say."; };
        $("#data-summary").textContent = ga === gb ? "Both models read the same documents, so they guess the same. Choose two different parts of the library." :
          first(a, "A") + " " + first(b, "B") + " They share " + shared + " of their top " + Math.max(a.words.length, b.words.length) + " guesses.";
        btn.disabled = false;
      }, function (err) {
        btn.disabled = false;
        $("#data-summary").textContent = libraryProblem(err);
      });
    });

    return { train: train, predict: predict, chances: chances };
  });

  var NotebookPage = safe("notebook", function () {
    var list = $("#nb-list"), empty = $("#nb-empty"), exportBtn = $("#nb-export"), clearBtn = $("#nb-clear");
    if (!list) return null;
    var dateFmt = (function () { try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }); } catch (e) { return null; } })();
    function when(iso) { var d = new Date(iso); return isNaN(d) ? "" : dateFmt ? dateFmt.format(d) : d.toDateString(); }
    function excerpt(t, n) { t = t.trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; }
    /* A delete button that asks once more before acting */
    function confirmButton(btn, label, again, act) {
      var armed = 0, text = btn.querySelector(".btn-label") || btn;
      on(btn, "click", function () {
        if (!armed) {
          text.textContent = again;
          armed = setTimeout(function () { armed = 0; text.textContent = label; }, 4000);
          return;
        }
        clearTimeout(armed); armed = 0; text.textContent = label;
        act();
      });
    }
    function render() {
      var items = Notes.list();
      list.textContent = "";
      empty.hidden = items.length > 0;
      exportBtn.disabled = clearBtn.disabled = !items.length;
      items.forEach(function (d) {
        var li = el("li", "nb-item");
        var head = el("div", "nb-item-head");
        var a = el("a", null, d.title);
        a.href = "#library/" + d.id;
        head.appendChild(a);
        if (d.updated) head.appendChild(el("span", "small muted", "Edited " + when(d.updated)));
        li.appendChild(head);
        if (d.notes.trim()) li.appendChild(el("p", null, excerpt(d.notes, 280)));
        if (d.a.trim()) {
          li.appendChild(el("p", "nb-q", d.q || "Your reflection"));
          li.appendChild(el("p", null, excerpt(d.a, 200)));
        }
        var row = el("div", "tool-actions");
        var del = el("button", "btn btn-small btn-quiet btn-danger");
        del.type = "button";
        del.appendChild(el("span", "btn-label", "Delete"));
        del.setAttribute("aria-label", "Delete your notes on " + d.title);
        confirmButton(del, "Delete", "Click again to delete", function () {
          Notes.remove(d.id);
          if (Resets.notebook) safe("reset notebook", Resets.notebook);
          toast("Your notes on " + d.title + " were deleted.");
        });
        row.appendChild(del);
        li.appendChild(row);
        list.appendChild(li);
      });
    }
    on(exportBtn, "click", function () {
      download("ai-co-evolution-notebook-" + new Date().toISOString().slice(0, 10) + ".md", Notes.markdown(), "text/markdown");
    });
    confirmButton(clearBtn, "Delete the notebook", "Click again to delete every note", function () {
      Store.remove("notebook");
      if (Resets.notebook) safe("reset notebook", Resets.notebook);
      toast("Your notebook was deleted from this device.");
    });
    render();
    on(document, "aice:store", render);
    return { render: render };
  });

  var Offline = safe("offline", function () {
    if (BUILD !== "pwa") return null;
    var chip = $("#net-chip"), installBtn = $("#install-btn");
    var st = { app: $("#off-app"), lib: $("#off-lib"), storage: $("#off-storage"), persist: $("#off-persist"), version: $("#off-version") };
    var persistBtn = $("#off-persist-btn"), updateBtn = $("#off-update"), removeBtn = $("#off-remove");
    function set(key, text) { if (st[key]) st[key].textContent = text; }

    /* Online or offline: a small chip in the top bar, and a gentle message when it changes */
    function network(say) {
      var off = navigator.onLine === false;
      if (chip) chip.hidden = !off;
      if (off) html.setAttribute("data-offline", ""); else html.removeAttribute("data-offline");
      if (say) toast(off ? "You're offline. Everything saved on this device still works." : "You're back online.");
    }
    on(window, "online", function () { network(true); });
    on(window, "offline", function () { network(true); });
    network(false);

    /* Install: the browser's own prompt where it offers one, or simple steps on iPhone and iPad */
    var standaloneMode = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    var ua = navigator.userAgent || "";
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var deferredPrompt = null;
    if (standaloneMode) html.setAttribute("data-installed", "");
    on(window, "beforeinstallprompt", function (e) {
      e.preventDefault();   // show our quiet Install button instead of a pop-up
      deferredPrompt = e;
      if (installBtn) installBtn.hidden = false;
    });
    on(window, "appinstalled", function () {
      deferredPrompt = null;
      if (installBtn) installBtn.hidden = true;
      toast("Installed. Open it from your apps, even without internet.", {
        timeout: 15000,
        actions: [{ label: "Save the library too", primary: true, fn: function () { if (Library) Library.saveAll(); } }, { label: "Not now" }]
      });
    });
    if (isIOS && !standaloneMode && installBtn) installBtn.hidden = false;
    on(installBtn, "click", function () {
      if (deferredPrompt) {
        var p = deferredPrompt;
        deferredPrompt = null;
        installBtn.hidden = true;
        try { p.prompt(); } catch (e) {}
        return;
      }
      if (Dialogs) Dialogs.open("install-dialog", installBtn);
    });

    var swOk = "serviceWorker" in navigator && window.isSecureContext && !IS_FILE;
    var reg = null, registering = swOk, updateRequested = false, reloading = false, offered = false;
    function askVersion(ctrl) {
      try {
        var ch = new MessageChannel();
        ch.port1.onmessage = function (e) { var b = e.data && e.data.build; set("version", APP_VERSION + (b ? " (build " + b + ")" : "")); };
        ctrl.postMessage({ type: "VERSION" }, [ch.port2]);
      } catch (e) { set("version", APP_VERSION); }
    }
    function refresh() {
      var ctrl = swOk ? navigator.serviceWorker.controller : null;
      if (!swOk) set("app", IS_FILE ? "Not available when the page is opened from a folder. Use the single-file edition, or serve the folder as a website (see the README)." : "This browser can't keep an offline copy of this page.");
      else if (!reg) set("app", registering ? "Setting up…" : "Not set up on this device. Reload the page to set it up again.");
      else if (reg.waiting) set("app", "Ready, with an update waiting.");
      else if (ctrl || reg.active) set("app", "Ready: the toolkit opens without internet on this device.");
      else set("app", "Setting up…");
      if (ctrl) askVersion(ctrl); else set("version", APP_VERSION);
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function (e) { set("storage", formatBytes(e.usage || 0) + " used by this website on this device"); }, function () { set("storage", "Your browser didn't say."); });
      } else set("storage", "This browser doesn't say.");
      if (navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(function (p) {
          set("persist", p ? "Yes: your browser won't clear it to free up space." : "Not yet: your browser may clear it if the device runs low on space.");
          if (persistBtn) persistBtn.hidden = !!p;
        }, function () { if (persistBtn) persistBtn.hidden = true; });
      } else {
        set("persist", "This browser doesn't offer this.");
        if (persistBtn) persistBtn.hidden = true;
      }
      if (Library) Library.refreshSaved().then(function (info) { if (!info) set("lib", swOk ? "Nothing saved yet." : "Not available here."); });
    }
    on(document, "aice:library", function (e) {
      var d = e.detail || {};
      set("lib", d.saved + " of " + d.total + " documents" + (d.search ? " and the search index" : "") + ". Everything together is about " + formatBytes(d.bytes || 0) + ".");
    });
    on(document, "aice:caches", function () { if (swOk) refresh(); });
    function remove(say) {
      var scope = new URL("./", location.href).href, jobs = [];
      if ("serviceWorker" in navigator) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.filter(function (r) { return r.scope === scope; }).map(function (r) { return r.unregister(); }));
        }));
      }
      if ("caches" in window) {
        jobs.push(caches.keys().then(function (names) {
          return Promise.all(names.filter(function (n) { return n.indexOf("aice-") === 0 && n.slice(-SCOPE_TAG.length) === SCOPE_TAG; }).map(function (n) { return caches.delete(n); }));
        }));
      }
      return Promise.all(jobs).then(function () {
        reg = null;
        Store.remove("libraryOffline");
        announceCaches();
        if (say) toast("Removed. The offline copy and the saved library are gone from this device. This page keeps working until you close it.", { timeout: 6000 });
        refresh();
      }, function () {
        if (say) toast("Something went wrong while removing it. Try again, or clear this site's data in your browser settings.");
      });
    }
    on(persistBtn, "click", function () {
      if (!navigator.storage || !navigator.storage.persist) return;
      navigator.storage.persist().then(function (granted) {
        toast(granted ? "Done. Your browser will keep the offline copy." : "Your browser decided not to for now. It often agrees once the app is installed or used regularly.", { timeout: 6000 });
        refresh();
      });
    });
    on(updateBtn, "click", function () {
      if (!reg) { toast("The offline copy isn't set up. Reload the page to set it up."); return; }
      updateBtn.disabled = true;
      reg.update().then(function () {
        if (reg && (reg.installing || reg.waiting)) toast("A new version was found. It's getting ready…");
        else toast("You have the latest version.");
      }, function () {
        toast(navigator.onLine === false ? "You're offline. Check again when you're connected." : "Couldn't check for updates just now.");
      }).then(function () { updateBtn.disabled = false; });
    });
    var armed = 0;
    on(removeBtn, "click", function () {
      var label = $(".btn-label", removeBtn);
      if (!armed) {
        armed = setTimeout(function () { armed = 0; if (label) label.textContent = "Remove from this device"; }, 4000);
        if (label) label.textContent = "Click again to remove";
        return;
      }
      clearTimeout(armed); armed = 0;
      if (label) label.textContent = "Remove from this device";
      remove(true);
    });

    if (!swOk) {
      [updateBtn, removeBtn, persistBtn].forEach(function (b) { if (b) b.disabled = true; });
      $$("[data-save-library]").forEach(function (b) { b.disabled = true; });
      refresh();
      return { refresh: refresh, remove: remove };
    }

    /* Updates: offered, never forced. The page reloads only after you choose "Update now". */
    function offerUpdate(worker) {
      if (offered) return;
      offered = true;
      refresh();
      toast("A new version of the toolkit is ready.", {
        sticky: true,
        actions: [
          { label: "Update now", primary: true, fn: function () { updateRequested = true; worker.postMessage({ type: "SKIP_WAITING" }); } },
          { label: "Later", fn: function () { offered = false; } }
        ]
      });
    }
    var hadController = !!navigator.serviceWorker.controller;
    on(navigator.serviceWorker, "controllerchange", function () {
      if (updateRequested && !reloading) { reloading = true; location.reload(); return; }
      refresh();
      // Someone chose "Update now" in another tab: this tab keeps working, and can reload when ready
      if (hadController) toast("This toolkit was updated in another tab. Reload this page when you're ready.", { sticky: true, actions: [{ label: "Reload now", primary: true, fn: function () { location.reload(); } }, { label: "Not now" }] });
      hadController = true;
    });
    refresh();   // storage and library lines fill in right away; the offline copy follows
    navigator.serviceWorker.register("sw.js").then(function (r) {
      registering = false;
      if (!r) { set("app", "This browser didn't set up an offline copy (service workers may be turned off)."); return; }   // some managed or test browsers
      reg = r;
      if (r.waiting && navigator.serviceWorker.controller) offerUpdate(r.waiting);
      on(r, "updatefound", function () {
        var w = r.installing;
        if (!w) return;
        on(w, "statechange", function () {
          if (w.state === "installed") {
            if (navigator.serviceWorker.controller) offerUpdate(w);
            else toast("Saved for offline use: this toolkit now opens without internet on this device.", { timeout: 5000 });
          }
          if (w.state === "activated") refresh();
          if (w.state === "redundant") {
            refresh();
            // An install that didn't finish (a file couldn't be saved, or storage is full)
            if (!r.active && !r.waiting && !r.installing) set("app", "Couldn't finish saving the app for offline use. Reload the page to try again.");
          }
        });
      });
      refresh();
      // Keep the whole library saved, if you asked for that earlier
      navigator.serviceWorker.ready.then(function () {
        if (Store.get("libraryOffline", false) && navigator.onLine !== false && Library) setTimeout(function () { Library.saveAll({ quiet: true }); }, 4000);
      });
    }, function (e) {
      registering = false;
      errors.push("service worker: " + (e && e.message));
      set("app", "Couldn't set up the offline copy in this browser.");
      set("version", APP_VERSION);
    });
    return { refresh: refresh, remove: remove };
  });

  /* ---------- Start ---------- */
  safe("settings", function () { Settings.apply(); Settings.bindForm(); });
  safe("scrollables", function () { scrollablesReachable(); });
})();
