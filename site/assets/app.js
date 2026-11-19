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

/* =========================================================================
   SAFETY NET: if something fails, say so on the page
   -------------------------------------------------------------------------
   A page gets opened in places nobody tested: an older browser, a preview
   inside another app, a locked-down school device. If a script error
   happens there, buttons would simply stop responding with no explanation.
   This block shows a plain notice instead, with the technical detail folded
   underneath for whoever looks after the copy. It keeps no record and sends
   nothing anywhere. It stands apart from the rest of the script, so it
   still works when the rest can't start.
   To change the wording, edit the sentences in report(): one for a page
   of its own, one for a page shown inside another page.
   ========================================================================= */
(function () {
  "use strict";
  var box = null, list = null, seen = {}, count = 0;
  /* An open dialog covers the page, so the notice goes inside the newest one */
  function host() {
    var open = document.querySelectorAll("dialog[open]");
    return document.fullscreenElement || (open.length ? open[open.length - 1] : document.body);
  }
  function report(detail) {
    try {
      detail = String(detail || "Unknown problem").slice(0, 300);
      if (seen[detail] || count >= 6 || !document.body) return;   // each problem once, and never a wall of them
      seen[detail] = true;
      count++;
      if (!box) {
        /* A named section is a landmark, so screen-reader users can find the notice again later */
        box = document.createElement("section");
        box.className = "problem-note";
        box.id = "problem-note";
        box.setAttribute("aria-label", "Notice: something didn't work");
        /* The message sits in an alert that's on the page, empty, a moment before its words arrive:
           screen readers reliably announce words added to an alert, less so an alert that appears whole */
        var p = document.createElement("p");
        p.className = "problem-lead";
        p.setAttribute("role", "alert");
        var framed = true;
        try { framed = window.self !== window.top; } catch (e) {}
        setTimeout(function () {
          var lead = document.createElement("strong");
          lead.textContent = "Something in this toolkit didn't work here.";
          p.appendChild(lead);
          p.appendChild(document.createTextNode(framed
            ? " You can keep reading, but a tool or button may not respond. The page showing this toolkit (a preview or a learning platform) may be limiting it; opening the toolkit's own file in an up-to-date web browser usually fixes this."
            : " You can keep reading, but a tool or button may not respond. Reloading the page, or opening it in an up-to-date web browser, usually fixes this."));
        }, 100);
        var more = document.createElement("details"), summary = document.createElement("summary");
        summary.textContent = "Technical details";
        list = document.createElement("ul");
        more.appendChild(summary);
        more.appendChild(list);
        var close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-quiet";
        close.textContent = "Close this notice";
        close.addEventListener("click", function () { box.remove(); });
        box.appendChild(p);
        box.appendChild(more);
        box.appendChild(close);
      }
      var item = document.createElement("li");
      item.textContent = detail;
      list.appendChild(item);
      var where = host();
      if (box.parentNode !== where) where.appendChild(box);
    } catch (e) { /* the safety net must never cause a problem itself */ }
  }
  window.__aiceProblem = report;   // safe() below reports parts that couldn't start
  window.addEventListener("error", function (e) {
    if (!e || !e.message) return;                                           // a picture or file that didn't load: not a script error
    if (/^ResizeObserver loop|^Script error\.?$/.test(e.message)) return;   // harmless browser notices
    if (/^(chrome|moz|safari-web)-extension:|^webkit-masked-url:/.test(e.filename || "")) return;   // a browser extension's own error
    report(e.message + (e.lineno ? " (line " + e.lineno + ")" : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e && e.reason;
    if (reason && reason.name === "AbortError") return;                       // something cancelled on purpose, such as a document you moved away from
    if (reason && /-extension:\/\//.test(String(reason.stack || ""))) return;
    report(reason && reason.message ? reason.message : reason);
  });
})();

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
  /* Runs one part of the page. If it fails, the rest carries on, and the safety net above says so. */
  function safe(name, fn) {
    try { return fn(); } catch (err) {
      var why = err && err.message ? err.message : err;
      errors.push(name + ": " + why);
      if (window.__aiceProblem) window.__aiceProblem("The “" + name + "” part couldn't start: " + why);
      return null;
    }
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
  /* Is this page somewhere other than a website? Only on a website (http or https) can a page
     fetch its neighbouring files, be installed, or be shared by link. Everywhere else it's a file:
     opened from a folder (file:), from a phone's downloads (content:), or shown inside another
     page such as a file preview or a learning platform (about:srcdoc, blob: or data:). */
  var IS_FILE = !/^https?:$/.test(location.protocol);
  var APP_VERSION = "2.5";
  /* An address worked out from this page's own, or null where the page has no usable address
     (new URL() throws there, and one uncaught error at startup would stop every tool). */
  function pageAddress(relative) {
    try { return new URL(relative, location.href); } catch (e) { return null; }
  }
  /* Cache names carry the app's folder, so two copies on one website never mix. */
  var SCOPE_TAG = "@" + ((!IS_FILE && pageAddress("./")) || { pathname: "/" }).pathname;

  /* ---------- Is the toolkit being shown inside another page? ----------
     A file preview in a chat or mail app, or a learning platform, shows this page in a frame and
     decides what it may do there. Many block printing, downloads, opening links in a new tab and
     saving on the device, and the browser then ignores those buttons without a word.
     hostAllows("downloads" | "modals" | "popups") answers true or false where the frame's rules
     can be seen, and null ("can't tell") where they can't; each tool then tries, checks what
     happened, and offers another way. ("modals" is the browser's word for the print window.)
     Nothing here asks the surrounding page for anything, or tells it anything. */
  var EMBEDDED = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  var UNKNOWN_RULES = {};   // rules this browser doesn't know, so it doesn't enforce them either
  var FRAME_RULES = (function () {
    if (!EMBEDDED) return null;
    try {
      var frame = window.frameElement;   // null when the surrounding page belongs to another website
      if (!frame) return null;
      if (!frame.hasAttribute("sandbox")) return "";
      ["downloads", "modals", "popups"].forEach(function (what) {
        try { if (frame.sandbox && frame.sandbox.supports && !frame.sandbox.supports("allow-" + what)) UNKNOWN_RULES[what] = true; } catch (e) {}
      });
      return " " + frame.getAttribute("sandbox").toLowerCase().replace(/\s+/g, " ") + " ";
    } catch (e) {}
    return null;
  })();
  /* A website can also serve a page with frame-like rules of its own; the sign is a page on the
     web that has no identity ("origin") of its own. */
  var RULES_UNSEEN = EMBEDDED ? FRAME_RULES === null : (!IS_FILE && (function () { try { return window.origin === "null"; } catch (e) { return false; } })());
  var foundBlocked = {};   // what trying has shown to be blocked here, so it's tried only once
  function hostAllows(what) {
    if (foundBlocked[what]) return false;
    if (RULES_UNSEEN) return null;
    if (!EMBEDDED || FRAME_RULES === "" || UNKNOWN_RULES[what]) return true;   // a page of its own, or a plain frame with no rules
    return FRAME_RULES.indexOf(" allow-" + what + " ") >= 0;
  }
  /* Browser features a surrounding page can switch off for this frame (its "permissions policy"):
     "fullscreen", "screen-wake-lock", "clipboard-write". Asking for one that's off is reported as
     an error, so ask only where the browser says it's allowed (or can't say). */
  function featureAllowed(name) {
    try { if (document.featurePolicy && document.featurePolicy.allowsFeature) return document.featurePolicy.allowsFeature(name); } catch (e) {}
    return true;
  }
  var HOST_NAME = "the page showing this toolkit (a preview or a learning platform)";
  if (EMBEDDED || RULES_UNSEEN) html.setAttribute("data-embedded", "");   // shows the note under "Your data on this device"

  /* ---------- Open-source helpers, loaded only when a tool needs them ----------
     marked (Markdown), DOMPurify (HTML cleaning), MiniSearch (full-text search),
     qrcode-generator (QR codes), turndown (HTML back to Markdown),
     gpt-tokenizer (the AI Lab's token counter), ts-fsrs (the practice
     schedule), the retext checkers (the plain and kind writing check) and
     fzstd (unpacking Kiwix libraries for the question ladder). Versions and licenses:
     vendor/LICENSES and THIRD-PARTY-NOTICES.md. In the single-file edition
     they're already inside the page, so nothing is fetched; the big token
     counter is stored there compressed (PACKED) and unpacked on first use. */
  var VENDOR = { marked: "vendor/marked.umd.js", DOMPurify: "vendor/purify.min.js", MiniSearch: "vendor/minisearch.js", qrcode: "vendor/qrcode.js",
    TurndownService: "vendor/turndown.js", GPTTokenizer: "vendor/gpt-tokenizer.js", FSRS: "vendor/fsrs.js", PlainKind: "vendor/plain-kind.js", FZSTD: "vendor/fzstd.js" };
  var PACKED = { GPTTokenizer: "packed-gpt-tokenizer", FSRS: "packed-fsrs", PlainKind: "packed-plain-kind", FZSTD: "packed-fzstd" };
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
      settings: ["Reading comfort settings", "Theme, text size, spacing, reading guide, motion, transparency, plain mode, reading-aloud voice and speed, and the family language you last chose"],
      role: ["Your path", "The role you picked under Purpose"],
      quickstart: ["Quick start progress", "Which first-week steps you've ticked"],
      sacredLog: ["SACRED decision log", "Activities you checked and their scores"],
      agreement: ["Agreement draft", "Grade band, class name, and chosen and custom promises"],
      readiness: ["Readiness answers", "Which readiness items you ticked"],
      rest: ["Rest reminder", "Whether rest reminders are on"],
      reading: ["Recently read", "The last library documents you opened and where you stopped in each, so you can pick up where you left off"],
      notebook: ["Your notebook", "Notes and reflections you wrote while reading library documents"],
      practice: ["Practice schedule", "Which key ideas you've practised and when each is due again (your answers aren't kept)"],
      units: ["Your units", "Units you planned in the curriculum studio: their plans, notes, history and credits"],
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

  /* ---------- Forms that work as you type ----------
     The calculators are forms that update as you type and never send anything. Pressing Enter in
     a text box would still ask the browser to submit the form; inside a preview that's reported
     as an error, so the key is stopped before it gets that far. */
  function neverSubmits(form) {
    on(form, "submit", function (e) { e.preventDefault(); });
    on(form, "keydown", function (e) {
      var t = e.target;
      if (e.key === "Enter" && !e.isComposing && t && t.tagName === "INPUT" && !/^(button|submit|reset|checkbox|radio|file|image)$/.test(t.type)) e.preventDefault();
    });
  }

  /* ---------- Clipboard, download and print helpers ---------- */
  function copyText(text) {
    return new Promise(function (resolve) {
      /* The older way: select the text in a hidden box and ask the browser to copy the selection.
         It works where the newer clipboard isn't offered (plain http, some previews). The box goes
         inside an open dialog, because everything behind a dialog can't be selected. */
      function fallback() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.setAttribute("aria-hidden", "true");
          ta.tabIndex = -1;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          ta.style.top = "0";
          var before = document.activeElement;
          (document.fullscreenElement || (Dialogs && Dialogs.top && Dialogs.top()) || document.body).appendChild(ta);
          ta.focus({ preventScroll: true });
          ta.select();
          var ok = document.execCommand("copy");
          ta.remove();
          if (before && before.focus) { try { before.focus({ preventScroll: true }); } catch (e) {} }
          resolve(!!ok);
        } catch (e) { resolve(false); }
      }
      /* Inside another page the newer clipboard may be switched off for this frame. Asking anyway is
         reported as an error, so check first where the browser can tell (Chromium browsers). */
      var offered = !!(navigator.clipboard && navigator.clipboard.writeText) && featureAllowed("clipboard-write");
      if (offered) navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
      else fallback();
    });
  }
  /* download(filename, text, type, { picture: true } for files that aren't readable text).
     Inside another page, downloads may be blocked and the browser doesn't say so; the message
     then says what's known, and offers the text itself to copy (see CopyBox). */
  function download(filename, text, type, opts) {
    var allowed = hostAllows("downloads"), from = document.activeElement;
    if (allowed !== false) {
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
      } catch (e) { toast("This browser couldn't create the download."); return; }
    }
    if (allowed === true) { toast("Downloaded " + filename + "."); return; }
    var said = allowed === false
      ? "Downloads are blocked by " + HOST_NAME + "."
      : "Download started: " + filename + ". If no file appears, it's blocked by " + HOST_NAME + ".";
    if ((opts && opts.picture) || !CopyBox) { toast(said, { timeout: 12000 }); return; }
    toast(said, { timeout: 15000, actions: [{ label: "Show the text to copy", primary: true, fn: function () {
      CopyBox.open({ title: "Copy the text instead", label: "What " + filename + " would contain",
        note: "If the download didn't arrive, copy this text and paste it into a document, a note or an email.", text: text, opener: from });
    } }, { label: "OK" }] });
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
     SETTINGS: theme, text size, spacing, wider letters, reading guide,
     motion, transparency, plain mode, and the reading-aloud voice and speed.
     Applied as data- attributes on <html>; the stylesheet does the rest.
     To add a setting: give it a default here, apply it in apply(), and
     connect its control in syncForm() and bindForm().
     ========================================================================= */
  var Settings = (function () {
    var defaults = { theme: "system", text: "md", space: "normal", letters: false, guide: false, motion: false, transparency: false, simple: false,
      voice: "", rate: "1", online: false, trlang: "" };
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
      if (s.letters) html.setAttribute("data-letters", "wide"); else html.removeAttribute("data-letters");
      if (s.guide) html.setAttribute("data-guide", ""); else html.removeAttribute("data-guide");
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
      var m = $("#c-motion"), t = $("#c-transparency"), p = $("#c-simple"), l = $("#c-letters"), g = $("#c-guide"), o = $("#c-online"), r = $("#c-rate");
      if (m) m.checked = !!s.motion;
      if (t) t.checked = !!s.transparency;
      if (p) p.checked = !!s.simple;
      if (l) l.checked = !!s.letters;
      if (g) g.checked = !!s.guide;
      if (o) o.checked = !!s.online;
      if (r) r.value = rate();
      var ro = $("#c-rate-out");
      if (ro) ro.textContent = rate().toFixed(1) + "×";
    }
    /* Reading-aloud speed, kept between 0.6 and 1.6 times normal */
    function rate() { var n = Number(s.rate); return n >= 0.6 && n <= 1.6 ? Math.round(n * 10) / 10 : 1; }
    function bindForm() {
      $$('input[name="c-theme"]').forEach(function (i) { on(i, "change", function () { update({ theme: i.value }, true); }); });
      $$('input[name="c-text"]').forEach(function (i) { on(i, "change", function () { update({ text: i.value }); }); });
      $$('input[name="c-space"]').forEach(function (i) { on(i, "change", function () { update({ space: i.value }); }); });
      on($("#c-motion"), "change", function (e) { update({ motion: e.target.checked }); });
      on($("#c-transparency"), "change", function (e) { update({ transparency: e.target.checked }); });
      on($("#c-simple"), "change", function (e) { update({ simple: e.target.checked }); });
      on($("#c-letters"), "change", function (e) { update({ letters: e.target.checked }); });
      on($("#c-guide"), "change", function (e) { update({ guide: e.target.checked }); });
      on($("#c-online"), "change", function (e) { update({ online: e.target.checked }); });
      on($("#c-rate"), "input", function (e) { update({ rate: String(e.target.value) }); });
      on($("#c-voice"), "change", function (e) { update({ voice: e.target.value }); });
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
    function get() { return Object.assign({}, s); }
    return { apply: apply, bindForm: bindForm, reducedMotion: reducedMotion, resolvedTheme: resolvedTheme, reload: reload, get: get, update: update, rate: rate };
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
      var guide = $("#reading-guide");   // the reading guide works inside panels too
      if (guide) d.appendChild(guide);
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
        // Toasts, a problem notice and the reading guide showing inside this dialog move back out to the next layer
        [$("#toasts"), $("#problem-note"), $("#reading-guide")].forEach(function (n) { if (n && d.contains(n)) (top() || document.body).appendChild(n); });
        var o = d._opener;
        if (!d._skipRestore && o && typeof o.focus === "function" && document.contains(o)) o.focus();
      });
    });
    return { open: open, top: top };
  });

  /* =========================================================================
     COPY IT INSTEAD: for when the page around the toolkit blocks something
     Inside a preview or a learning platform, a download or a link to another
     website may be blocked. Rather than a button that does nothing, the text
     (or the address) is shown in a box to select and copy.
     CopyBox.open({ title, note, label, text, opener }). Nothing is sent anywhere.
     ========================================================================= */
  var CopyBox = safe("copy box", function () {
    var dlg = $("#copy-dialog");
    if (!dlg || !Dialogs) return null;
    var title = $("#copy-h"), note = $("#copy-note"), label = $("#copy-label"), box = $("#copy-text"), status = $("#copy-status");
    function open(opts) {
      if (dlg.open) dlg.close();
      title.textContent = opts.title;
      note.textContent = opts.note;
      label.textContent = opts.label;
      box.value = opts.text;
      box.rows = opts.text.length < 240 ? 3 : 10;
      status.textContent = "";
      Dialogs.open("copy-dialog", opts.opener);
      try { box.focus(); box.select(); box.scrollTop = 0; } catch (e) {}
    }
    on($("#copy-all"), "click", function () {
      try { box.focus(); box.select(); } catch (e) {}
      copyText(box.value).then(function (ok) {
        status.textContent = ok ? "Copied." : "Copying is blocked here too. The text is selected: press Ctrl+C (or Cmd+C), or press and hold it and choose Copy.";
      });
    });
    return { open: open };
  });

  /* =========================================================================
     EVERY FAMILY'S LANGUAGE: translation on this device
     Uses the browser's own built-in translator (the Translator and Language
     Detector APIs; Chrome and Edge on computers have them). The browser
     downloads each language once and translates on this device, so the text
     isn't sent anywhere. Where there's no built-in translator, nothing is
     sent to an online service instead: the toolkit says what would help.
     A translation is added beside the original, part by part (a bilingual
     page), labelled as machine-made, in its own language (lang) and writing
     direction (dir), so read-aloud picks a matching voice and screen readers
     pronounce it properly. Families deserve a human check, and the label
     says so every time.
     Translate.run(root, { target, source, signal, status }) translates a
     part of the page; Translate.clear(root) removes the translation.
     To offer another language, add it to LANGS (a BCP 47 code and its
     English name); the browser decides which it can actually translate.
     ========================================================================= */
  var Translate = safe("translate", function () {
    var LANGS = [["ar", "Arabic"], ["bn", "Bengali"], ["zh", "Chinese (Simplified)"], ["zh-Hant", "Chinese (Traditional)"], ["fr", "French"],
      ["en", "English"], ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"], ["hi", "Hindi"], ["it", "Italian"], ["ja", "Japanese"], ["ko", "Korean"],
      ["fa", "Persian (Farsi)"], ["pl", "Polish"], ["pt", "Portuguese"], ["pa", "Punjabi"], ["ru", "Russian"], ["so", "Somali"],
      ["es", "Spanish"], ["fil", "Tagalog (Filipino)"], ["ta", "Tamil"], ["tr", "Turkish"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["vi", "Vietnamese"]];
    var RTL = /^(ar|fa|ur|he|iw|ps|sd|ug|yi|dv|ckb)\b/;
    /* Parts of a page that get their own translation. List items, table cells and the like keep
       theirs inside them; paragraphs and headings get theirs just after. */
    var PARTS = "h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, summary, caption, figcaption";
    var INSIDE = /^(LI|TD|TH|DT|DD|SUMMARY|CAPTION|FIGCAPTION)$/, NESTED = /^(UL|OL|DL|P|DIV|TABLE|PRE|BLOCKQUOTE|DETAILS|FIGURE|H[1-6]|SECTION|ASIDE)$/;
    var translators = {};
    function englishName(code) { var row = LANGS.filter(function (l) { return l[0] === code; })[0]; return row ? row[1] : code; }
    /* "Spanish · español": the English name, and the language's name for itself */
    function name(code) {
      var english = englishName(code), own = "";
      try { own = new Intl.DisplayNames([code], { type: "language" }).of(code) || ""; } catch (e) {}
      return own && own.toLowerCase() !== english.toLowerCase() ? english + " · " + own : english;
    }
    function dirOf(code) { return RTL.test(code) ? "rtl" : "ltr"; }
    /* Why there's no translator here, in plain words (empty when there is one) */
    function why() {
      if (!window.isSecureContext) return "Translation on this device needs the toolkit to be opened from a secure (https) address or as a file.";
      if (!("Translator" in window)) return "This browser doesn't have a built-in translator. Chrome and Edge on a computer have one, which works on the device without sending the text anywhere.";
      if (!featureAllowed("translator")) return "Translation is blocked by " + HOST_NAME + ".";
      return "";
    }
    function fillSelect(select, chosen) {
      if (!select || select.options.length) return;
      LANGS.forEach(function (l) { var o = el("option", null, name(l[0])); o.value = l[0]; select.appendChild(o); });
      select.value = chosen && LANGS.some(function (l) { return l[0] === chosen; }) ? chosen : "es";
    }
    /* A browser's translator can stay silent (switched off, or still setting up): don't wait forever */
    function within(promise, ms, fallback) {
      return Promise.race([promise, new Promise(function (done) { setTimeout(function () { done(fallback); }, ms); })]);
    }
    /* Mark the languages this browser can't translate into (checking downloads nothing).
       Resolves with how many it can, or -1 when it didn't say. */
    function markAvailable(select, source) {
      if (why() || !select) return Promise.resolve(-1);
      var heard = 0, can = 0;
      return Promise.all($$("option", select).map(function (o) {
        return within(Translator.availability({ sourceLanguage: source || "en", targetLanguage: o.value }), 3000, "unknown").then(function (a) {
          if (a === "unknown") return;
          heard++;
          if (a !== "unavailable") can++;
          o.disabled = a === "unavailable";
          o.textContent = name(o.value) + (a === "unavailable" ? " (not offered by this browser)" : "");
        }, function () {});
      })).then(function () { return heard ? can : -1; });
    }
    /* The words that belong to an element itself: up to its first nested block, so a list item that
       holds another list doesn't swallow it */
    function ownText(e) {
      var out = "";
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1 && NESTED.test(n.tagName)) break;
        if (n.nodeType === 1 && n.matches(".sr-only, button, svg, script, style, input, select, textarea, .tr-text")) continue;
        out += n.textContent;
      }
      return out.replace(/\s+/g, " ").trim();
    }
    function parts(root) {
      return $$(PARTS, root).filter(function (e) {
        return !e.closest(".tr-text, .tr-banner, pre, .sr-only, [hidden], button, .reader-notebook") && /\p{L}{2}/u.test(ownText(e));
      });
    }
    function add(e, text, lang) {
      var heading = /^H([1-6])$/.exec(e.tagName), inside = INSIDE.test(e.tagName);
      var t = el(inside ? "span" : "p", "tr-text" + (heading ? " tr-heading" : ""), text);
      t.setAttribute("lang", lang);
      t.setAttribute("dir", dirOf(lang));
      t.setAttribute("translate", "no");   // the browser's own page translation leaves it alone
      if (heading) { t.setAttribute("role", "heading"); t.setAttribute("aria-level", heading[1]); }
      if (inside) {
        var nested = null;
        for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && NESTED.test(n.tagName)) { nested = n; break; }
        e.insertBefore(t, nested);
      } else e.parentNode.insertBefore(t, e.nextSibling);
      return t;
    }
    function clear(root) {
      if (!root) return;
      $$(".tr-text, .tr-banner", root).forEach(function (n) { n.remove(); });
      root.removeAttribute("data-translated");
    }
    function translatorFor(source, target, onDownload, signal) {
      var key = source + ">" + target;
      if (!translators[key]) {
        var options = { sourceLanguage: source, targetLanguage: target, monitor: function (m) {
          m.addEventListener("downloadprogress", function (e) { if (onDownload) onDownload(e.loaded); });
        } };
        if (signal) options.signal = signal;   // Stop also stops a download
        translators[key] = Translator.create(options);
        translators[key].catch(function () { delete translators[key]; });
      }
      return translators[key];
    }
    /* Let go of the language models when they're no longer needed (they use a lot of memory) */
    function release() {
      Object.keys(translators).forEach(function (k) {
        translators[k].then(function (t) { try { t.destroy(); } catch (e) {} }, function () {});
        delete translators[k];
      });
    }
    /* Which language is this text in? Used for your own files; library documents are in English. */
    function detect(text) {
      if (!("LanguageDetector" in window) || !featureAllowed("language-detector")) return Promise.resolve("en");
      return LanguageDetector.create().then(function (d) {
        return d.detect(text.slice(0, 2000)).then(function (r) {
          try { d.destroy(); } catch (e) {}
          var top = r && r[0];
          return top && top.confidence > 0.6 && top.detectedLanguage !== "und" ? top.detectedLanguage : "en";
        });
      }).catch(function () { return "en"; });
    }
    function stopped() { var e = new Error("Stopped"); e.name = "AbortError"; return e; }
    /* Translate a part of the page, part by part. Calls opts.status(text) as it goes and resolves
       with the number of parts translated. Start it from a click: the browser asks for that. */
    function run(root, opts) {
      var source = opts.source || "en", target = opts.target, signal = opts.signal, say = opts.status || function () {};
      var reason = why();
      if (reason) return Promise.reject(new Error(reason));
      if (source.split("-")[0] === target.split("-")[0]) return Promise.reject(new Error("This is already in " + englishName(target) + "."));
      var list = parts(root);
      if (!list.length) return Promise.reject(new Error("There's nothing to translate here yet."));
      say("Getting the translator ready…");
      return within(Translator.availability({ sourceLanguage: source, targetLanguage: target }), 6000, "silent").then(function (a) {
        if (signal && signal.aborted) throw stopped();
        if (a === "silent") throw new Error("This browser's built-in translator isn't answering. It may be switched off on this device. Try again in a moment, or restart the browser.");
        if (a === "unavailable") throw new Error("This browser can't translate into " + englishName(target) + ".");
        if (a !== "available") say("Your browser is downloading " + englishName(target) + " (only the first time)…");
        return translatorFor(source, target, function (loaded) {
          say("Your browser is downloading " + englishName(target) + " (only the first time): " + Math.round((loaded || 0) * 100) + "%");
        }, signal);
      }).then(function (tr) {
        if (signal && signal.aborted) throw stopped();
        clear(root);
        root.setAttribute("data-translated", target);
        var banner = el("div", "tr-banner");
        banner.setAttribute("role", "note");
        var lead = el("p");
        lead.appendChild(el("strong", null, "Machine translation into " + englishName(target) + ", made by your browser on this device."));
        lead.appendChild(document.createTextNode(" It can be wrong or sound awkward. Before you share it with families, ask someone fluent to check it."));
        banner.appendChild(lead);
        root.insertBefore(banner, root.firstChild);
        var done = 0, chain = Promise.resolve();
        // The label is translated too, so families can read that it's a machine translation
        [lead].concat(list).forEach(function (e, i) {
          chain = chain.then(function () {
            if (signal && signal.aborted) throw stopped();
            return tr.translate(ownText(e), signal ? { signal: signal } : undefined).then(function (out) {
              if (signal && signal.aborted) throw stopped();
              add(e, out, target);
              if (i === 0) return;
              done++;
              if (done % 5 === 0 || done === list.length) say("Translating into " + englishName(target) + ": " + done + " of " + list.length + " parts…");
            });
          });
        });
        return chain.then(function () { return list.length; });
      });
    }
    /* The translation alone, as plain text in reading order (for an email or a letter) */
    function textOf(root) {
      return $$(".tr-text", root).filter(function (t) { return !t.closest(".tr-banner"); }).map(function (t) { return t.textContent; }).join("\n\n");
    }
    return { run: run, clear: clear, release: release, why: why, fillSelect: fillSelect, markAvailable: markAvailable, detect: detect,
      textOf: textOf, englishName: englishName, dirOf: dirOf };
  });

  /* Shared controls for a translate panel: a language list, Translate / Stop / Remove / Copy, and a
     status line. ui: { root() (what to translate), select, go, stop, clear, copy, status, note (shown
     when there's no translator), source() (the text's language, or a promise of it) } */
  function translatePanel(ui) {
    if (!Translate) return null;
    var ctl = null, done = false;
    function say(t) { if (ui.status) ui.status.textContent = t; }
    function buttons(running) {
      if (ui.go) ui.go.hidden = running;
      if (ui.stop) ui.stop.hidden = !running;
      if (ui.clear) ui.clear.hidden = running || !done;
      if (ui.copy) ui.copy.hidden = running || !done;
    }
    var checked = false;
    /* Ask the browser which languages it offers: only once someone shows interest, so a page that's
       just being read never wakes the translator */
    function check() {
      if (checked || Translate.why()) return;
      checked = true;
      Promise.resolve(ui.source ? ui.source() : "en").then(function (src) { return Translate.markAvailable(ui.select, src); }).then(function (can) {
        if (can !== 0 || !ui.note) return;   // -1: the browser didn't say, so let people try
        ui.note.hidden = false;
        ui.note.textContent = "This browser has a built-in translator, but it isn't offering any of these languages on this device right now. It may be switched off by your organization's settings.";
        if (ui.go) ui.go.disabled = true;
      });
    }
    on(ui.select, "focus", check);
    on(ui.select, "pointerdown", check);
    function prepare(now) {
      Translate.fillSelect(ui.select, Settings.get().trlang);
      var reason = Translate.why();
      if (ui.note) {
        ui.note.hidden = !reason;
        ui.note.textContent = reason ? reason + " Many languages, including most Indigenous languages, aren't offered by machine translation at all: community interpreters, settlement workers and families themselves are the best help." : "";
      }
      if (ui.go) ui.go.disabled = !!reason;
      if (ui.select) ui.select.disabled = !!reason;
      if (now) { checked = false; check(); }   // asked for: check again (the text's language may have changed)
    }
    function stop() { if (ctl) { ctl.abort(); ctl = null; } }
    function reset(message) {
      stop();
      var root = ui.root();
      if (root) { Translate.clear(root); root.removeAttribute("aria-busy"); }
      done = false;
      buttons(false);
      say(message || "");
    }
    on(ui.go, "click", function () {
      var root = ui.root(), target = ui.select && ui.select.value;
      if (!root || !target) return;
      stop();
      Settings.update({ trlang: target });
      var mine = ctl = typeof AbortController === "function" ? new AbortController() : { signal: null, abort: function () {} };
      done = false;
      buttons(true);
      root.setAttribute("aria-busy", "true");
      Promise.resolve(ui.source ? ui.source() : "en").then(function (source) {
        return Translate.run(root, { source: source, target: target, signal: mine.signal, status: function (t) { if (ctl === mine) say(t); } });
      }).then(function (n) {
        if (ctl !== mine) return;
        ctl = null;
        done = true;
        buttons(false);
        say("Translated " + n + " parts into " + Translate.englishName(target) + ". Each sits under its original. Read-aloud uses a " + Translate.englishName(target) + " voice for them where this device has one.");
      }, function (err) {
        var aborted = err && err.name === "AbortError";
        if (ctl !== mine && !aborted) return;   // a newer translation took over
        if (ctl === mine) ctl = null;
        done = !!root.querySelector(".tr-text");
        buttons(false);
        if (!done) Translate.clear(root);
        say(aborted ? (done ? "Stopped. The parts translated so far stay; translate again to finish." : "Stopped.") : (err && err.message) || "The translator couldn't finish.");
      }).then(function () { root.removeAttribute("aria-busy"); });
    });
    on(ui.stop, "click", stop);
    on(ui.clear, "click", function () { reset("Translation removed."); if (ui.go) ui.go.focus(); });
    on(ui.copy, "click", function () {
      var root = ui.root(), text = root ? Translate.textOf(root) : "";
      if (!text) return;
      text = "Machine translation into " + Translate.englishName(root.getAttribute("data-translated")) + ", made on this device. Ask someone fluent to check it.\n\n" + text;
      copyText(text).then(function (ok) {
        if (ok) toast("Translation copied.");
        else if (CopyBox) CopyBox.open({ title: "Copy the translation", label: "Translation", text: text, note: "Select the text and copy it.", opener: ui.copy });
      });
    });
    return { prepare: prepare, reset: reset, stop: stop, busy: function () { return !!ctl; },
      translated: function () { return done || !!(ui.root() && ui.root().querySelector(".tr-text")); } };
  }

  /* ---------- Links to other websites, when the toolkit is inside another page ----------
     Outside links open in a new tab. A preview or a learning platform may not allow new tabs;
     the browser then ignores the click and the link looks broken. So here the toolkit opens the
     link itself and, if that's refused, shows the address to copy. On a page of its own this
     does nothing: the browser handles links as usual. */
  safe("outside links", function () {
    if (hostAllows("popups") === true || !CopyBox) return;
    on(document, "click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href][target="_blank"]') : null;
      if (!a || !/^https?:\/\//i.test(a.getAttribute("href"))) return;
      e.preventDefault();
      var opened = null;
      if (hostAllows("popups") !== false) { try { opened = window.open(a.href, "_blank"); } catch (err) { opened = null; } }
      if (opened) { try { opened.opener = null; } catch (err) {} return; }   // the new tab gets no handle on this page
      foundBlocked.popups = true;
      CopyBox.open({ title: "Open this link in your browser", label: "Address", text: a.href, opener: a,
        note: "Links to other websites are blocked by " + HOST_NAME + ". Copy the address and paste it into your web browser's address bar." });
    });
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
     READ ALOUD, WITH READ-ALONG HIGHLIGHTING
     - Uses the browser's own speech engine. Voices that run on this device
       are preferred: an "online" voice sends the text to the company that
       makes it, so one is used only if you allow online voices (Reading
       comfort > Reading aloud).
     - While a part of the page is read, the sentence is shaded and each word
       lights up as it's spoken, so listeners can follow along. This uses the
       CSS Custom Highlight API: nothing in the page itself changes.
     - Each paragraph is read in its own language (the nearest lang
       attribute), with a voice for that language where there is one, so a
       translation side by side with the original is read in both voices.
     - Long text is spoken a sentence at a time, so it doesn't cut off.
     To read another part of the page aloud, add a button with
     class="listen" data-listen="<id of the part>".
     ========================================================================= */
  var Speech = safe("listen", function () {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") return null;
    var synth = window.speechSynthesis;
    var marks = !!(window.CSS && CSS.highlights && typeof window.Highlight === "function");
    var voices = [], current = null, active = null, chunks = [], index = 0, map = [], cursor = 0, scroller = null, lastUserScroll = 0, warned = {};
    /* Parts of the page that aren't read: controls, hidden text, and tool panels */
    var SKIP = "button, svg, input, select, textarea, script, style, noscript, output, [hidden], [aria-hidden='true'], .sr-only, .js-only, .tool-actions, .print-only, .db-axis, .reader-notebook";
    var BLOCK = /^(P|LI|H[1-6]|DT|DD|TD|TH|SUMMARY|BLOCKQUOTE|FIGCAPTION|PRE|CAPTION|LEGEND|LABEL|DIV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|TR|UL|OL|DL|TABLE|DETAILS|FIGURE|NAV)$/;

    /* ---------- Voices ---------- */
    function base(lang) { return String(lang || "").toLowerCase().split(/[-_]/)[0]; }
    function forLang(lang) { var b = base(lang); return voices.filter(function (v) { return base(v.lang) === b; }); }
    function languageName(lang) {
      try { return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang; } catch (e) { return lang; }
    }
    function loadVoices() {
      try { voices = (synth.getVoices() || []).slice(); } catch (e) { voices = []; }
      renderVoices();
    }
    /* The voice for a language: yours if it fits; otherwise a voice on this device (the system's
       default first); an online voice only if you've allowed them */
    function pickVoice(lang) {
      var s = Settings.get(), pool = forLang(lang);
      var mine = s.voice ? pool.filter(function (v) { return v.voiceURI === s.voice; })[0] : null;
      if (mine && (mine.localService || s.online)) return mine;
      function best(list) {
        var exact = String(lang).toLowerCase();
        return list.slice().sort(function (a, b) {
          function score(v) { return (v.default ? 2 : 0) + (String(v.lang).toLowerCase() === exact ? 1 : 0); }
          return score(b) - score(a);
        })[0] || null;
      }
      return best(pool.filter(function (v) { return v.localService; })) || (s.online ? best(pool) : null);
    }
    /* Voices can arrive a moment after the page loads */
    function whenVoices(fn) {
      if (!voices.length) loadVoices();
      if (voices.length) { fn(); return; }
      var done = false;
      function go() { if (done) return; done = true; loadVoices(); fn(); }
      try { synth.addEventListener("voiceschanged", go, { once: true }); } catch (e) {}
      setTimeout(go, 1200);
    }

    /* ---------- What to read, and where each word is ----------
       The text nodes of a part of the page are joined in reading order, with a line break between
       blocks (paragraphs, list items, headings). "map" remembers which text node each character
       came from, so a spoken word can be highlighted exactly where it is. */
    function blockOf(node, root) {
      for (var e = node.parentElement; e && e !== root; e = e.parentElement) if (BLOCK.test(e.tagName)) return e;
      return root;
    }
    function langAt(node) {
      var e = node.parentElement && node.parentElement.closest("[lang]");
      return (e && e.getAttribute("lang")) || html.lang || "en";
    }
    function collect(root) {
      var text = "", out = [], last = null;
      var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        var d = p.closest("details");
        if (d && !d.open && root.contains(d) && !p.closest("summary")) return NodeFilter.FILTER_REJECT;   // folded away
        return NodeFilter.FILTER_ACCEPT;
      } });
      for (var n = walk.nextNode(); n; n = walk.nextNode()) {
        var block = blockOf(n, root);
        if (block !== last && text && text.charAt(text.length - 1) !== "\n") text += "\n";
        last = block;
        out.push({ node: n, start: text.length, end: text.length + n.data.length, lang: langAt(n) });
        text += n.data;
      }
      return { text: text, map: out };
    }
    /* Sentences of at most about 220 characters (some browsers stop long utterances part-way) */
    function sentences(text) {
      var out = [], lineStart = 0;
      function add(start, piece) { if (/[\p{L}\p{N}]/u.test(piece)) out.push({ start: start, text: piece }); }
      function pieces(start, piece) {
        while (piece.length > 220) {
          var cut = piece.lastIndexOf(", ", 220);
          if (cut < 80) cut = piece.lastIndexOf(" ", 220);
          cut = cut < 40 ? 220 : cut + 1;
          add(start, piece.slice(0, cut));
          start += cut;
          piece = piece.slice(cut);
        }
        add(start, piece);
      }
      text.split("\n").forEach(function (line) {
        var re = /[^.!?]+(?:[.!?]+["'”’)\]]*)?\s*|[.!?]+\s*/g, m;
        while ((m = re.exec(line))) { if (!m[0]) { re.lastIndex++; continue; } pieces(lineStart + m.index, m[0]); }
        lineStart += line.length + 1;
      });
      return out;
    }
    function entryAt(offset) {
      for (var i = 0; i < map.length; i++) if (offset < map[i].end) return map[i];
      return map[map.length - 1] || null;
    }
    /* A DOM Range for characters [start, end) of the joined text. Words move forward, so the
       search starts where the last one was found. */
    function rangeFor(start, end) {
      if (cursor >= map.length || (map[cursor] && map[cursor].start > start)) cursor = 0;
      var a = null;
      for (var i = cursor; i < map.length; i++) {
        var m = map[i];
        if (!a && start < m.end) { a = { node: m.node, off: Math.max(0, start - m.start) }; cursor = i; }
        if (a && end <= m.end) {
          try {
            var r = document.createRange();
            r.setStart(a.node, Math.min(a.off, a.node.data.length));
            r.setEnd(m.node, Math.max(0, Math.min(m.node.data.length, end - m.start)));
            return r;
          } catch (e) { return null; }
        }
      }
      return null;
    }

    /* ---------- Showing what's being read ---------- */
    function clearMarks() {
      if (!marks) return;
      CSS.highlights.delete("aice-speak");
      CSS.highlights.delete("aice-speak-line");
    }
    function follow(range) {
      if (Date.now() - lastUserScroll < 4000) return;   // you scrolled away on purpose: don't pull you back for a while
      var rect = range.getBoundingClientRect();
      if (!rect.height) return;
      var box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      if (rect.top < box.top + 70 || rect.bottom > box.bottom - 70) {
        var e = range.startContainer.parentElement;
        if (e) e.scrollIntoView({ block: "center", behavior: Settings.reducedMotion() ? "auto" : "smooth" });
      }
    }
    function sayWhere(range) {
      var rect = range.getBoundingClientRect();
      if (rect.height) document.dispatchEvent(new CustomEvent("aice:reading-at", { detail: { y: rect.top + rect.height / 2 } }));
    }
    function showSentence(c) {
      var r = rangeFor(c.start, c.start + c.text.replace(/\s+$/, "").length);
      if (!r) return;
      if (marks) { CSS.highlights.set("aice-speak-line", new Highlight(r)); CSS.highlights.delete("aice-speak"); }
      follow(r);
      sayWhere(r);
    }
    function showWord(c, at, len) {
      var rest = c.text.slice(at || 0), m = /\S+/.exec(rest);
      if (!m) return;
      at = (at || 0) + m.index;
      if (!(len > 0)) len = m[0].length;
      var r = rangeFor(c.start + at, c.start + at + len);
      if (!r) return;
      if (marks) CSS.highlights.set("aice-speak", new Highlight(r));
      sayWhere(r);
    }

    /* ---------- Speaking ---------- */
    function setBtn(b, playing) {
      b.setAttribute("aria-pressed", playing ? "true" : "false");
      var span = $("span", b);
      if (span) span.textContent = playing ? "Stop" : "Listen";
    }
    function stop() {
      active = null;
      chunks = [];
      try { synth.cancel(); } catch (e) {}
      clearMarks();
      if (current) setBtn(current, false);
      current = null;
    }
    function finish() {
      var b = current;
      active = null;
      clearMarks();
      if (b) setBtn(b, false);
      current = null;
    }
    function noVoice(lang) {
      var key = base(lang);
      if (warned[key]) return;
      warned[key] = true;
      var name = languageName(key);
      toast(forLang(lang).length
        ? "The voices for " + name + " in this browser work online: they'd send the text to the company that makes them. To use them, turn on online voices in Reading comfort."
        : "There's no voice for " + name + " on this device, so the parts in " + name + " are skipped.", { timeout: 10000 });
    }
    function speakNext() {
      if (!active) return;
      if (index >= chunks.length) { finish(); return; }
      var c = chunks[index++], voice = pickVoice(c.lang);
      if (!voice) { noVoice(c.lang); speakNext(); return; }
      var u = new SpeechSynthesisUtterance(c.text), run = active;
      u.voice = voice;
      u.lang = voice.lang || c.lang;
      u.rate = Settings.rate();
      u.onstart = function () { if (active === run) showSentence(c); };
      u.onboundary = function (e) { if (active === run && (!e.name || e.name === "word")) showWord(c, e.charIndex, e.charLength); };
      u.onend = function () { if (active === run) speakNext(); };
      u.onerror = function (e) {
        if (active !== run || (e && /interrupted|canceled/.test(e.error || ""))) return;
        stop();
        toast("Reading aloud stopped: this browser's speech engine reported a problem.");
      };
      synth.speak(u);
    }
    function start(b) {
      var root = document.getElementById(b.getAttribute("data-listen"));
      if (!root) return;
      stop();
      var got = collect(root);
      map = got.map;
      cursor = 0;
      chunks = sentences(got.text).map(function (c) { var e = entryAt(c.start); c.lang = e ? e.lang : (html.lang || "en"); return c; });
      if (!chunks.length) { toast("There's nothing to read aloud here yet."); return; }
      current = b;
      active = {};
      index = 0;
      scroller = root.closest(".reader-scroll");
      lastUserScroll = 0;
      setBtn(b, true);
      whenVoices(function () {
        if (current !== b) return;
        if (!voices.length) { stop(); toast("No voices for reading aloud are installed on this device."); return; }
        try { speakNext(); } catch (e) { stop(); toast("Read-aloud isn't available in this browser."); }
      });
    }
    $$(".listen[data-listen]").forEach(function (b) {
      b.hidden = false;
      setBtn(b, false);
      on(b, "click", function () { if (current === b) stop(); else start(b); });
    });
    /* You scrolled yourself: stop following the voice for a few seconds */
    ["wheel", "touchmove"].forEach(function (t) { on(window, t, function () { lastUserScroll = Date.now(); }, { passive: true, capture: true }); });
    on(window, "keydown", function (e) { if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown| )$/.test(e.key)) lastUserScroll = Date.now(); }, true);
    on(window, "pagehide", stop);
    // Other tools (the reader) ask for quiet when they close
    on(document, "aice:stop-speech", stop);

    /* ---------- Reading comfort > Reading aloud: voice, speed, online voices, a sample ---------- */
    var field = $("#c-voice-field"), select = $("#c-voice"), note = $("#c-voice-note");
    function option(value, label, disabled) {
      var o = el("option", null, label);
      o.value = value;
      o.disabled = !!disabled;
      return o;
    }
    function renderVoices() {
      if (!select) return;
      var s = Settings.get(), pool = forLang(html.lang || "en");
      var local = pool.filter(function (v) { return v.localService; }), online = pool.filter(function (v) { return !v.localService; });
      select.textContent = "";
      select.appendChild(option("", local.length ? "Automatic: a voice on this device" : "Automatic"));
      [[local, "On this device"], [online, s.online ? "Online: sends the text to its maker" : "Online (turn on “Allow online voices” to use)"]].forEach(function (g) {
        if (!g[0].length) return;
        var group = el("optgroup");
        group.label = g[1];
        g[0].forEach(function (v) { group.appendChild(option(v.voiceURI, v.name + " (" + v.lang + ")", !v.localService && !s.online)); });
        select.appendChild(group);
      });
      select.value = s.voice && pool.some(function (v) { return v.voiceURI === s.voice && (v.localService || s.online); }) ? s.voice : "";
      if (note) {
        var chosen = pickVoice(html.lang || "en");
        note.textContent = !pool.length ? "No voices for English were found on this device yet."
          : !chosen ? "This browser's English voices all work online. Turn on “Allow online voices” to hear them; they send the text to the company that makes them."
          : chosen.localService ? "Reading aloud uses " + chosen.name + ", which runs on this device: nothing is sent anywhere."
          : "Reading aloud uses " + chosen.name + ", an online voice: what's read is sent to the company that makes it.";
      }
    }
    if (field) field.hidden = false;
    on($("#c-voice-try"), "click", function () {
      stop();
      whenVoices(function () {
        var v = pickVoice(html.lang || "en");
        if (!v) { noVoice(html.lang || "en"); return; }
        var u = new SpeechSynthesisUtterance("This is how reading aloud will sound.");
        u.voice = v;
        u.lang = v.lang;
        u.rate = Settings.rate();
        synth.speak(u);
      });
    });
    on(document, "aice:settings", renderVoices);
    try { synth.addEventListener("voiceschanged", loadVoices); } catch (e) {}
    loadVoices();
    return { stop: stop, pickVoice: pickVoice };
  });

  /* ---------- Reading guide (Reading comfort): a clear band that follows your pointer, the
     keyboard focus or the word being read aloud, and softly dims the rest of the screen, to
     help keep your place in a line. It never catches clicks. ---------- */
  safe("reading guide", function () {
    var band = el("div", "reading-guide");
    band.id = "reading-guide";
    band.setAttribute("aria-hidden", "true");
    document.body.appendChild(band);
    function place(y) { band.style.transform = "translateY(" + Math.round(y - band.offsetHeight / 2) + "px)"; }
    function onAt(y) { if (html.hasAttribute("data-guide")) place(y); }
    on(document, "pointermove", function (e) { if (e.pointerType !== "touch") onAt(e.clientY); }, { passive: true });
    on(document, "pointerdown", function (e) { onAt(e.clientY); }, { passive: true });
    on(document, "focusin", function (e) {
      var r = e.target && e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null;
      if (r && r.height) onAt(r.top + Math.min(r.height, 48) / 2);
    });
    on(document, "aice:reading-at", function (e) { if (e.detail) onAt(e.detail.y); });
    on(document, "aice:settings", function () { if (html.hasAttribute("data-guide") && !band.style.transform) place(window.innerHeight * 0.4); });
    if (html.hasAttribute("data-guide")) place(window.innerHeight * 0.4);
  });

  /* =========================================================================
     CIRCLES: a talking-circle timer
     - Seats sit around a ring, with no names ("person 3 of 12"). The person
       whose turn it is is highlighted; people who spoke, passed, consented
       or objected are marked with different shapes, not only colours.
     - Each turn can have a time. When it's up, a soft chime says so (made by
       the browser: a tone and two quiet overtones fading over two seconds),
       but nobody is cut off: the person finishes their thought, and the
       facilitator moves on.
     - "Deciding together" runs three rounds (questions, reactions, consent),
       counts consents, concerns, objections and passes, and writes a
       decision record without names, with a date to look at it again. An
       objection sends the proposal back to be changed, then asked again.
     - Nothing is saved or sent: closing the page forgets the circle.
     To add a question, add it to QUESTIONS under its kind of circle.
     ========================================================================= */
  safe("circles", function () {
    var tool = $("#circle-tool");
    if (!tool) return;
    var QUESTIONS = {
      checkin: ["What's one word for how you're arriving today?", "What's something small that went well this week?", "What do you need from this group today?",
        "Who or what helped you learn something recently?", "What are you looking forward to?"],
      ai: ["When has AI helped your learning, and when has it got in the way?", "How can we tell when the thinking is ours?", "What should AI never do for us at school?",
        "Who might be left out when a class uses AI?", "What would you want an AI to know before it helps you?", "What's something AI can't do that people can?"],
      repair: ["What happened, as you saw it?", "How has this affected you, or people you care about?", "What has been the hardest part?",
        "What would help put things right?", "What can each of us do so it doesn't happen again?"]
    };
    var NOTES = {
      checkin: "A short round to arrive together. One word or one sentence each is plenty.",
      ai: "Questions for thinking together about AI and learning. There are no right answers.",
      repair: "After a harm, to understand what happened and what would help. Taking part is a choice; talk with the people most affected first.",
      decide: "Three rounds: questions to understand the proposal, reactions, then consent. An objection means “this could cause harm, or stop us doing what we're here for”."
    };
    var ROUNDS = [
      { title: "Round 1 of 3: questions to understand", q: "What would you like to understand better about the proposal?" },
      { title: "Round 2 of 3: reactions", q: "How does the proposal sit with you?" },
      { title: "Round 3 of 3: consent", q: "Can you live with this proposal? Is it safe enough to try?" }
    ];
    var setup = $("#circle-setup"), runBox = $("#circle-run"), doneBox = $("#circle-done");
    var kinds = $$('input[name="circle-kind"]', tool), qInput = $("#circle-question"), proposal = $("#circle-proposal");
    var peopleIn = $("#circle-people"), timeIn = $("#circle-time"), chimeIn = $("#circle-chime");
    var svg = $("#circle-seats"), whoEl = $("#circle-who"), clockEl = $("#circle-clock"), upEl = $("#circle-timeup"), stageEl = $("#circle-stage"), qEl = $("#circle-q");
    var consentBox = $("#circle-consent"), nextBtn = $("#circle-next"), passBtn = $("#circle-pass"), pauseBtn = $("#circle-pause"), moreBtn = $("#circle-more"), bigBtn = $("#circle-big");
    var notes = $("#circle-notes"), review = $("#circle-review"), recordText = $("#circle-record-text");
    var NS = "http://www.w3.org/2000/svg";
    var c = null, timer = 0, audio = null, lock = null, asked = {};
    neverSubmits(setup);

    /* ---------- Setting up ---------- */
    function kind() { var k = kinds.filter(function (i) { return i.checked; })[0]; return k ? k.value : "checkin"; }
    function nextQuestion() {
      var k = kind(), list = QUESTIONS[k];
      if (!list) return;
      asked[k] = asked[k] === undefined ? 0 : (asked[k] + 1) % list.length;
      qInput.value = list[asked[k]];
    }
    function showKind() {
      var k = kind();
      $("#circle-kind-note").textContent = NOTES[k];
      $(".circle-question-field", tool).hidden = k === "decide";
      $(".circle-proposal-field", tool).hidden = k !== "decide";
      if (k !== "decide") { asked[k] = undefined; nextQuestion(); }
    }
    kinds.forEach(function (i) { on(i, "change", showKind); });
    on($("#circle-another"), "click", nextQuestion);
    showKind();

    /* ---------- The chime: made by the browser, only after a click (browsers ask for that) ---------- */
    function wakeAudio() {
      if (!chimeIn.checked) return;
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!audio && Ctx) audio = new Ctx();
        if (audio && audio.state === "suspended") audio.resume();
      } catch (e) { audio = null; }
    }
    function chime() {
      if (!chimeIn.checked || !audio) return;
      try {
        var t = audio.currentTime;
        [[523.25, 0.16], [784, 0.07], [1046.5, 0.035]].forEach(function (p) {   // a tone and two quiet overtones, like a small bowl
          var o = audio.createOscillator(), g = audio.createGain();
          o.type = "sine";
          o.frequency.value = p[0];
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(p[1], t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
          o.connect(g).connect(audio.destination);
          o.start(t);
          o.stop(t + 2.5);
        });
      } catch (e) {}
    }

    /* ---------- Keeping a projector's screen awake, where allowed ---------- */
    function keepAwake(onOff) {
      if (onOff && !lock && navigator.wakeLock && featureAllowed("screen-wake-lock") && document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then(function (l) { lock = l; }, function () {});
      } else if (!onOff && lock) { lock.release().catch(function () {}); lock = null; }
    }
    on(document, "visibilitychange", function () { if (c && document.visibilityState === "visible") keepAwake(true); });

    /* ---------- Seats around the ring, and the time left as an arc in the middle ---------- */
    var ARC = 2 * Math.PI * 58;
    function node(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (parent) parent.appendChild(n);
      return n;
    }
    function drawSeats() {
      $$("g, circle", svg).forEach(function (n) { n.remove(); });
      node("circle", { class: "circle-track", cx: 110, cy: 110, r: 58 }, svg);
      var arc = node("circle", { class: "circle-time-ring", id: "circle-arc", cx: 110, cy: 110, r: 58, "stroke-dasharray": ARC.toFixed(1), "stroke-dashoffset": 0 }, svg);
      arc.style.display = c.seconds ? "" : "none";
      var n = c.people, R = 92, r = n > 24 ? 5 : n > 14 ? 7 : 9;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * 2 * Math.PI - Math.PI / 2, x = 110 + R * Math.cos(a), y = 110 + R * Math.sin(a);
        var g = node("g", { class: "seat", "data-seat": i, transform: "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" }, svg);
        node("circle", { class: "seat-halo", r: (r * 1.9).toFixed(1) }, g);
        node("circle", { class: "seat-dot", r: r }, g);
        // marks: a tick (spoke or consented), a dot (a concern), a cross (an objection); a pass is a dashed ring
        var k = r * 0.5;
        node("path", { class: "seat-mark seat-tick", d: "M" + (-k) + " 0l" + (k * 0.7) + " " + (k * 0.7) + "l" + (k * 1.3) + " " + (-k * 1.4) }, g);
        node("path", { class: "seat-mark seat-cross", d: "M" + (-k) + " " + (-k) + "l" + (2 * k) + " " + (2 * k) + "M" + k + " " + (-k) + "l" + (-2 * k) + " " + (2 * k) }, g);
        node("circle", { class: "seat-mark seat-dotmark", r: (r * 0.28).toFixed(1) }, g);
      }
      paintSeats();
    }
    function paintSeats() {
      $$(".seat", svg).forEach(function (g) {
        var i = Number(g.getAttribute("data-seat")), mark = c.marks[i];
        g.setAttribute("class", "seat" + (i === c.turn && !c.finished ? " seat-now" : "") + (mark ? " seat-" + mark : ""));
      });
      var count = function (m) { return c.marks.filter(function (x) { return x === m; }).length; };
      var label = c.finished ? "Everyone has had a turn." : "Person " + (c.turn + 1) + " of " + c.people + " is speaking.";
      label += " " + (count("spoke") + count("consent") + count("concern") + count("objection")) + " spoke, " + count("pass") + " passed.";
      $("title", svg).textContent = label;
    }
    function fmt(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    function arc(fraction) {
      var a = $("#circle-arc");
      if (a) a.setAttribute("stroke-dashoffset", (ARC * (1 - Math.max(0, Math.min(1, fraction)))).toFixed(1));
    }

    /* ---------- A turn ---------- */
    function update() {
      if (!c || c.paused || !c.seconds || c.finished) return;
      var left = Math.max(0, c.endsAt - performance.now());
      clockEl.textContent = fmt(left);
      arc(left / (c.seconds * 1000));
      if (left <= 0 && !c.up) {
        c.up = true;
        clearInterval(timer);
        tool.classList.add("is-up");
        upEl.textContent = "Time's up. Finish your thought.";
        chime();
      }
    }
    function startTurn() {
      c.up = false;
      c.paused = false;
      tool.classList.remove("is-up");
      upEl.textContent = "";
      pauseBtn.querySelector("span").textContent = "Pause";
      clearInterval(timer);
      whoEl.textContent = "Person " + (c.turn + 1) + " of " + c.people;
      clockEl.textContent = c.seconds ? fmt(c.seconds * 1000) : "";
      pauseBtn.hidden = moreBtn.hidden = !c.seconds;
      paintSeats();
      if (c.seconds) { c.endsAt = performance.now() + c.seconds * 1000; arc(1); timer = setInterval(update, 250); }
    }
    function showRound() {
      var consentRound = c.kind === "decide" && c.round === 2;
      stageEl.textContent = c.kind === "decide" ? ROUNDS[c.round].title + (consentRound && c.attempt > 1 ? " (asking again)" : "") : "";
      // In a decision the proposal stays in view; the consent question sits with the answer buttons
      qEl.textContent = c.kind !== "decide" ? c.question : (c.round === 1 ? ROUNDS[1].q + " " : "") + "Proposal: " + c.proposal;
      consentBox.hidden = !consentRound;
      nextBtn.hidden = consentRound;
      c.marks = [];
      c.turn = 0;
      c.finished = false;
      drawSeats();
      startTurn();
    }
    function begin(round, attempt) {
      var people = Math.round(Number(peopleIn.value));
      if (!(people >= 2)) people = 2;
      if (people > 40) people = 40;
      peopleIn.value = people;
      var k = kind();
      if (k === "decide" && !proposal.value.trim()) { toast("Write the proposal first: what are you deciding?"); proposal.focus(); return; }
      if (k !== "decide" && !qInput.value.trim()) nextQuestion();
      wakeAudio();
      c = { kind: k, people: people, seconds: Number(timeIn.value) || 0, question: qInput.value.trim(), proposal: proposal.value.replace(/\s+/g, " ").trim(),
        round: round || 0, attempt: attempt || 1, started: Date.now(), marks: [], turn: 0, tally: null };
      setup.hidden = true;
      doneBox.hidden = true;
      runBox.hidden = false;
      keepAwake(true);
      showRound();
      nextBtn.focus();
    }
    function advance(mark) {
      if (!c || c.finished) return;
      c.marks[c.turn] = mark;
      if (c.turn + 1 < c.people) { c.turn++; startTurn(); return; }
      if (c.kind === "decide" && c.round < 2) { c.round++; showRound(); announce(ROUNDS[c.round].title); return; }
      finish();
    }
    on(nextBtn, "click", function () { advance("spoke"); });
    on(passBtn, "click", function () { advance("pass"); });
    $$("[data-answer]", consentBox).forEach(function (b) { on(b, "click", function () { advance(b.getAttribute("data-answer")); }); });
    on(pauseBtn, "click", function () {
      if (!c || !c.seconds || c.up) return;
      if (!c.paused) { c.paused = true; c.left = c.endsAt - performance.now(); clearInterval(timer); pauseBtn.querySelector("span").textContent = "Resume"; }
      else { c.paused = false; c.endsAt = performance.now() + c.left; timer = setInterval(update, 250); pauseBtn.querySelector("span").textContent = "Pause"; update(); }
    });
    on(moreBtn, "click", function () {
      if (!c || !c.seconds) return;
      if (c.paused) { c.left += 30000; clockEl.textContent = fmt(c.left); return; }
      c.endsAt = Math.max(c.endsAt, performance.now()) + 30000;
      if (c.up) { c.up = false; tool.classList.remove("is-up"); upEl.textContent = ""; clearInterval(timer); timer = setInterval(update, 250); }
      c.seconds = Math.max(c.seconds, Math.ceil((c.endsAt - performance.now()) / 1000));   // the arc shows the longer turn
      update();
    });

    /* ---------- After a round: a summary, or for a decision, the result and its record ---------- */
    function count(m) { return c.marks.filter(function (x) { return x === m; }).length; }
    function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
    function longDate(d) { try { return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(d); } catch (e) { return d.toDateString(); } }
    function record() {
      var t = c.tally, when = review.value ? new Date(review.value + "T12:00:00") : null;
      return ["Decision record", "Date: " + longDate(new Date()), "Proposal: " + c.proposal,
        "Decided by consent" + (c.attempt > 1 ? ", after the proposal was changed and asked again (" + c.attempt + " consent rounds)." : " in the first consent round."),
        "Consent round: " + plural(t.consent, "consent", "consents") + ", " + plural(t.concern, "consent with a concern", "consents with a concern") + ", " + plural(t.pass, "pass", "passes") + ", " + plural(t.objection, "objection", "objections") + ".",
        "Concerns and objections: " + (notes.value.trim() || "none noted."),
        "Look at it again by: " + (when && !isNaN(when) ? longDate(when) : "not set") + ".",
        "No names were recorded. Made with the circle timer in AI Co-Evolution in Education."].join("\n");
    }
    function showRecord() { recordText.textContent = record(); }
    on(notes, "input", showRecord);
    on(review, "input", showRecord);
    function finish() {
      clearInterval(timer);
      c.finished = true;
      tool.classList.remove("is-up");
      paintSeats();
      runBox.hidden = true;
      doneBox.hidden = false;
      var title = $("#circle-done-title"), text = $("#circle-done-text"), minutes = Math.max(1, Math.round((Date.now() - c.started) / 60000));
      var decided = false, isDecision = c.kind === "decide";
      if (isDecision) {
        c.tally = { consent: count("consent"), concern: count("concern"), objection: count("objection"), pass: count("pass") };
        decided = c.tally.objection === 0 && c.tally.consent + c.tally.concern > 0;
        title.textContent = decided ? "Decided by consent." : c.tally.objection ? "Not decided yet: " + plural(c.tally.objection, "objection", "objections") + "." : "Not decided yet: everyone passed.";
        text.textContent = decided
          ? plural(c.tally.consent, "consent", "consents") + ", " + plural(c.tally.concern, "with a concern", "with concerns") + ", " + plural(c.tally.pass, "pass", "passes") + ". Note the concerns, set a date to look at it again, and keep the record."
          : "Work with what you heard: what would make the proposal safe enough to try? Change it together, then ask again.";
      } else {
        title.textContent = "Everyone has had a turn.";
        text.textContent = plural(c.people, "person", "people") + ": " + count("spoke") + " spoke and " + count("pass") + " passed, in about " + plural(minutes, "minute", "minutes") + ".";
      }
      $("#circle-record").hidden = !decided;
      $("#circle-amend").hidden = !isDecision || decided;
      $("#circle-record-dl").hidden = $("#circle-record-print").hidden = !decided;
      $("#circle-again").hidden = isDecision;
      if (decided) {
        var d = new Date(Date.now() + 28 * 86400000);
        review.value = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        notes.value = "";
        showRecord();
      }
      keepAwake(false);
      title.focus();
    }
    on($("#circle-again"), "click", function () {
      if (!c) return;
      nextQuestion();
      c.question = qInput.value.trim();
      c.started = Date.now();
      doneBox.hidden = true;
      runBox.hidden = false;
      keepAwake(true);
      showRound();
      nextBtn.focus();
    });
    on($("#circle-amend"), "click", function () {
      if (!c) return;
      c.amending = c.attempt + 1;
      doneBox.hidden = true;
      setup.hidden = false;
      proposal.focus();
      proposal.select();
      toast("Change the proposal, then press “Start the circle” to ask for consent again.", { timeout: 6000 });
    });
    on($("#circle-start"), "click", function () {
      var amend = c && c.amending && kind() === "decide" ? c.amending : 0;
      begin(amend ? 2 : 0, amend || 1);
    });
    on($("#circle-record-dl"), "click", function () {
      var d = new Date();
      download("decision-record-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + ".txt", record());
    });
    on($("#circle-record-print"), "click", function () { if (Printer) Printer.print(recordText, { title: "Decision record" }); });
    function end() {
      clearInterval(timer);
      big(false);
      keepAwake(false);
      c = null;
      tool.classList.remove("is-up");
      runBox.hidden = doneBox.hidden = true;
      setup.hidden = false;
      $("#circle-start").focus();
    }
    on($("#circle-end"), "click", end);
    on($("#circle-new"), "click", end);

    /* ---------- Big screen: full screen where allowed, otherwise the circle covers the page ---------- */
    function big(onOff) {
      var full = document.fullscreenElement === tool, covered = tool.classList.contains("is-big");
      if (onOff === undefined) onOff = !(full || covered);
      if (onOff) {
        if (tool.requestFullscreen && document.fullscreenEnabled !== false && featureAllowed("fullscreen")) {
          tool.requestFullscreen().catch(function () { tool.classList.add("is-big"); });
        } else tool.classList.add("is-big");
      } else {
        if (full && document.exitFullscreen) document.exitFullscreen().catch(function () {});
        tool.classList.remove("is-big");
      }
      setTimeout(label, 50);
    }
    function label() {
      var onNow = document.fullscreenElement === tool || tool.classList.contains("is-big");
      bigBtn.lastChild.textContent = onNow ? "Leave the big screen" : "Big screen";
      bigBtn.setAttribute("aria-pressed", onNow ? "true" : "false");
    }
    on(bigBtn, "click", function () { big(); });
    on(document, "fullscreenchange", label);
    on(document, "keydown", function (e) { if (e.key === "Escape" && tool.classList.contains("is-big")) big(false); });
    label();
  });

  /* =========================================================================
     PRACTICE THE KEY IDEAS: recall practice, spaced out over days
     - The ideas are read from this page: the five promises, the SACRED check,
       the repair circle's steps and the glossary. Change the page and the
       practice follows.
     - The schedule comes from ts-fsrs (the FSRS algorithm; MIT), loaded only
       when you start. Each rating button says when that idea would come
       back, so the schedule is never a mystery.
     - Kept only in this browser as "aice:practice" (listed under Your data):
       { v: 1, perDay, today, newToday, cards: { <idea id>: <FSRS card> } }.
       Your answers aren't stored, and there are no streaks or points.
     To add a kind of idea, add it to ideas(); everything else follows.
     ========================================================================= */
  var Practice = safe("practice", function () {
    var tool = $("#practice-tool");
    if (!tool) return null;
    var overview = $("#practice-overview"), cardBox = $("#practice-card"), doneBox = $("#practice-done");
    var front = $("#practice-front"), kindEl = $("#practice-kind"), answer = $("#practice-answer"), back = $("#practice-back"), ask = $("#practice-ask");
    var perDayIn = $("#practice-new"), statsEl = $("#practice-stats"), progressEl = $("#practice-progress"), sourceLink = $("#practice-source"), startBtn = $("#practice-start");
    var LEARN_AHEAD = 20 * 60000;   // an idea due within 20 minutes may come back now rather than waiting
    var scheduler = null, F = null, list = null, queue = [], current = null, seen = 0;
    function clean(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
    function slug(t) { return clean(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
    function pad(n) { return ("0" + n).slice(-2); }

    /* ---------- The ideas, from the page itself, in teaching order ---------- */
    function ideas() {
      if (list) return list;
      list = [];
      $$("#promises table tbody tr").forEach(function (tr) {
        var th = $("th", tr), td = $("td", tr);
        if (th && td) list.push({ id: "p-" + slug(th.textContent), kind: "The five promises", src: "#promises",
          q: "One of the five promises to every learner is “" + clean(th.textContent) + "”. What does it mean in practice?", a: clean(td.textContent) });
      });
      $$("#sacred .sacred-item").forEach(function (f) {
        var letter = f.getAttribute("data-key"), legend = $("legend", f), q = $(".sacred-q", f);
        if (!letter || !legend || !q) return;
        var name = legend.cloneNode(true);
        $$(".sacred-letter", name).forEach(function (n) { n.remove(); });
        list.push({ id: "s-" + letter.toLowerCase(), kind: "The SACRED check", src: "#sacred",
          q: "In the SACRED check, what does the “" + letter + "” stand for, and what does it ask?", a: clean(name.textContent) + ": " + clean(q.textContent) });
      });
      var steps = $$("#repair .cycle-steps li").map(function (li) { return { name: clean(($("strong", li) || li).textContent), what: clean(($("span", li) || li).textContent) }; });
      steps.forEach(function (s, i) {
        list.push({ id: "r-" + slug(s.name), kind: "The repair circle", src: "#repair",
          q: i === 0 ? "When a red flag appears, what's the first step of the repair circle?" : "In the repair circle, what comes after “" + steps[i - 1].name + "”?",
          a: s.name + ": " + s.what });
      });
      $$("#glossary dl.glossary > div").forEach(function (d) {
        var dt = $("dt", d), dd = $("dd", d);
        if (dt && dd) list.push({ id: "g-" + slug(dt.textContent), kind: "Glossary", src: "#glossary", q: "What does “" + clean(dt.textContent) + "” mean?", a: clean(dd.textContent) });
      });
      return list;
    }
    function byId(id) { return ideas().filter(function (i) { return i.id === id; })[0] || null; }

    /* ---------- What's kept ---------- */
    function load() {
      var d = Store.get("practice", null);
      if (!isPlain(d) || !isPlain(d.cards)) d = { v: 1, perDay: 5, today: "", newToday: 0, cards: {} };
      if ([3, 5, 10].indexOf(d.perDay) < 0) d.perDay = 5;
      return d;
    }
    var data = load(), lastRaw = Store.raw("practice");
    function save() { Store.set("practice", data); lastRaw = Store.raw("practice"); }
    function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function newLeft() {
      if (data.today !== dayKey()) { data.today = dayKey(); data.newToday = 0; }
      return Math.max(0, data.perDay - (data.newToday || 0));
    }
    function dueAt(c) { var t = Date.parse(c && c.due); return isNaN(t) ? 0 : t; }
    function when(ms) {
      var m = Math.max(1, Math.round(ms / 60000));
      if (m < 60) return "in " + m + (m === 1 ? " minute" : " minutes");
      var h = Math.round(m / 60);
      if (h < 24) return "in " + h + (h === 1 ? " hour" : " hours");
      var d = Math.round(h / 24);
      if (d < 45) return "in " + d + (d === 1 ? " day" : " days");
      var mo = Math.round(d / 30);
      return "in " + mo + (mo === 1 ? " month" : " months");
    }
    function dateLabel(t) { try { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(t)); } catch (e) { return new Date(t).toDateString(); } }

    /* ---------- The overview: a few plain numbers, and when the next ideas come back ---------- */
    function stats() {
      var all = ideas(), now = Date.now(), started = 0, due = 0, next = Infinity;
      all.forEach(function (i) {
        var c = data.cards[i.id];
        if (!c) return;
        started++;
        var t = dueAt(c);
        if (t <= now) due++; else next = Math.min(next, t);
      });
      var fresh = Math.min(newLeft(), all.length - started);
      statsEl.textContent = "";
      [[all.length, "key ideas"], [started, "started"], [due, "to review now"], [fresh, "new today"]].forEach(function (s) {
        var tile = el("p", "practice-stat");
        tile.appendChild(el("span", "practice-stat-n", String(s[0])));
        tile.appendChild(el("span", "practice-stat-label", s[1]));
        statsEl.appendChild(tile);
      });
      var note = el("p", "practice-next small");
      note.textContent = due + fresh ? "" : isFinite(next) ? "Nothing to practise right now. The next ideas come back " + when(next - now) + " (" + dateLabel(next) + ")." : "You've started every idea. Come back tomorrow for reviews.";
      if (note.textContent) statsEl.appendChild(note);
      startBtn.disabled = !(due + fresh);
      perDayIn.value = String(data.perDay);
    }

    /* ---------- A session ---------- */
    function queueUp() {
      var now = Date.now(), all = ideas();
      var due = all.filter(function (i) { var c = data.cards[i.id]; return c && dueAt(c) <= now + LEARN_AHEAD; })
        .sort(function (a, b) { return dueAt(data.cards[a.id]) - dueAt(data.cards[b.id]); });
      var fresh = all.filter(function (i) { return !data.cards[i.id]; }).slice(0, newLeft());
      return due.concat(fresh).map(function (i) { return i.id; });
    }
    function cardFor(id, now) { var c = data.cards[id]; return c ? F.TypeConvert.card(c) : F.createEmptyCard(now); }
    function plain(card) {
      var out = { due: card.due.toISOString(), stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days || 0, scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps || 0, reps: card.reps, lapses: card.lapses, state: card.state };
      if (card.last_review) out.last_review = new Date(card.last_review).toISOString();
      return out;
    }
    function showPanel(which) {
      overview.hidden = which !== "overview";
      cardBox.hidden = which !== "card";
      doneBox.hidden = which !== "done";
    }
    function nextIdea() {
      while (queue.length && !byId(queue[0])) queue.shift();   // an idea no longer on the page
      if (!queue.length) { finish(false); return; }
      current = byId(queue.shift());
      kindEl.textContent = current.kind + (data.cards[current.id] ? " · review" : " · new idea");
      front.textContent = current.q;
      answer.textContent = current.a;
      sourceLink.setAttribute("href", current.src);
      ask.hidden = false;
      back.hidden = true;
      progressEl.textContent = seen ? seen + " practised · " + queue.length + " more after this" : (queue.length ? queue.length + " more after this" : "The last one for now");
      showPanel("card");
      front.focus();
    }
    function reveal() {
      if (!current) return;
      var now = new Date(), outcomes = scheduler.repeat(cardFor(current.id, now), now);
      $$("[data-grade]", back).forEach(function (b) {
        var g = Number(b.getAttribute("data-grade"));
        $(".practice-when", b).textContent = "back " + when(outcomes[g].card.due.getTime() - now.getTime());
      });
      ask.hidden = true;
      back.hidden = false;
      $('[data-grade="3"]', back).focus();
    }
    function rate(g) {
      if (!current || back.hidden) return;
      var now = new Date(), res = scheduler.next(cardFor(current.id, now), now, g), fresh = !data.cards[current.id];
      data.cards[current.id] = plain(res.card);
      if (fresh) { newLeft(); data.newToday = (data.newToday || 0) + 1; }
      save();
      seen++;
      if (dueAt(data.cards[current.id]) - Date.now() <= LEARN_AHEAD) queue.push(current.id);   // still learning: it comes back in this session
      nextIdea();
    }
    function finish(early) {
      current = null;
      var title = $("#practice-done-title"), text = $("#practice-done-text"), next = Infinity, now = Date.now();
      ideas().forEach(function (i) { var c = data.cards[i.id]; if (c && dueAt(c) > now) next = Math.min(next, dueAt(c)); });
      title.textContent = early ? "A good place to pause." : "That's everything for now.";
      text.textContent = (seen ? "You practised " + seen + (seen === 1 ? " idea" : " ideas") + ". " : "") +
        (early ? "What's left will wait for you; nothing is lost. " : "") +
        (isFinite(next) ? "The next ones come back " + when(next - now) + " (" + dateLabel(next) + ")." : "");
      showPanel("done");
      title.focus();
    }
    function start() {
      startBtn.disabled = true;
      needs("FSRS").then(function (lib) {
        F = lib;
        scheduler = scheduler || F.fsrs(F.generatorParameters({ enable_fuzz: false, maximum_interval: 365 }));
        list = null;   // read the ideas afresh, in case the page changed
        queue = queueUp();
        seen = 0;
        nextIdea();
      }, function () {
        toast("The practice schedule couldn't load. Reload the page and try again.");
      }).then(function () { startBtn.disabled = false; });
    }
    on(startBtn, "click", start);
    on($("#practice-show"), "click", reveal);
    $$("[data-grade]", back).forEach(function (b) { on(b, "click", function () { rate(Number(b.getAttribute("data-grade"))); }); });
    /* Keys 1 to 4 rate an idea once its answer is showing */
    on(cardBox, "keydown", function (e) {
      if (back.hidden || e.ctrlKey || e.metaKey || e.altKey || !/^[1-4]$/.test(e.key)) return;
      e.preventDefault();
      rate(Number(e.key));
    });
    on($("#practice-stop"), "click", function () { finish(true); });
    on($("#practice-back-btn"), "click", function () { stats(); showPanel("overview"); startBtn.focus(); });
    on(perDayIn, "change", function () { data.perDay = Number(perDayIn.value) || 5; save(); stats(); });
    /* Another tab practised, or the schedule was deleted or imported: catch up (not in the middle of a session) */
    function reload() { data = load(); lastRaw = Store.raw("practice"); if (!overview.hidden) stats(); }
    on(document, "aice:store", function () { if (cardBox.hidden && Store.raw("practice") !== lastRaw) reload(); });
    Resets.practice = reload;
    stats();
    return { reload: reload };
  });

  /* =========================================================================
     PLAIN AND KIND WRITING CHECK
     Open rules from the retext project (bundled as vendor/plain-kind.js,
     loaded the first time you check): plainer words (retext-simplify), hard
     sentences for the readers you chose (retext-readability: seven formulas,
     marked when four agree), the passive voice (retext-passive), and words
     that may leave people out (retext-equality). Each suggestion says why,
     and changes nothing unless you pick a replacement.
     The marks in "Your text, marked" use the CSS Custom Highlight API with a
     different underline style for each kind, so meaning isn't in colour
     alone. Nothing you paste is saved or sent.
     To change an explanation, edit why(); to add a kind, add it to KINDS.
     ========================================================================= */
  safe("writing check", function () {
    var tool = $("#wc-tool");
    if (!tool) return;
    var text = $("#wc-text"), audience = $("#wc-audience"), status = $("#wc-status"), results = $("#wc-results");
    var summary = $("#wc-summary"), preview = $("#wc-preview"), listEl = $("#wc-list");
    var marks = !!(window.CSS && CSS.highlights && typeof window.Highlight === "function");
    var KINDS = {
      "retext-simplify": { key: "simplify", name: "Plainer word", plural: "plainer words" },
      "retext-readability": { key: "readability", name: "Hard sentence", plural: "hard sentences" },
      "retext-passive": { key: "passive", name: "Passive voice", plural: "passive voice" },
      "retext-equality": { key: "equality", name: "Word to reconsider", plural: "words to reconsider" }
    };
    var EXAMPLE = "Dear parents and guardians,\n\nWe would like to inform you that, notwithstanding the aforementioned considerations regarding the utilization of artificial intelligence tools within the learning environment, a comprehensive framework has been developed in order to facilitate responsible practices across all grade levels, which necessitates the commencement of a consultation process.\n\nThe form was given to every student. Each chairman of a parent committee should ask his members for feedback, because some students are crazy about chatbots.\n\nThank you for your support.";
    var checked = "", found = [], timer = 0, running = false;
    function quote(t) { return "“" + t + "”"; }
    function list(words) { return words.map(quote).join(", ").replace(/, ([^,]*)$/, " or $1"); }
    /* Plain-language reasons, written for this toolkit (the libraries' own messages are for programmers) */
    /* The rules' alternatives; "remove" means the words can simply go */
    function alternatives(m) { return (m.expected || []).filter(Boolean).slice(0, 3); }
    function why(m, age) {
      var k = KINDS[m.source].key, alt = alternatives(m), drop = alt.indexOf("remove") > -1;
      alt = alt.filter(function (a) { return a !== "remove"; });
      var offer = alt.length ? "Try " + list(alt) + (drop ? ", or leaving it out" : "") + ". " : drop ? "Try leaving it out. " : "";
      if (k === "simplify") return offer + "Plain words are easier for everyone, including people reading in a second language.";
      if (k === "readability") {
        var n = /(\d+) out of (\d+)|all (\d+)/.exec(m.reason || ""), agree = n ? (n[3] ? "all " + n[3] : n[1] + " of " + n[2]) : "most";
        return "This may be hard for readers around age " + age + ": " + agree + " readability formulas say so. Try splitting it, or using shorter words.";
      }
      if (k === "passive") return "This may be the passive voice, which can hide who did it. Saying who acts is usually clearer, for example “we gave the form” instead of “the form was given”.";
      return offer.replace(/^Try/, "Consider") + "This word can leave people out or hurt. It may be fine where you use it (a quotation or a name, for example): you decide.";
    }
    function fkGrade(t) {
      var words = t.match(/[A-Za-z][A-Za-z’'-]*/g) || [], sentences = (t.match(/[.!?]+(\s|$)/g) || []).length || 1, syl = 0;
      if (words.length < 10 || !window.PlainKind) return null;
      words.forEach(function (w) { syl += Math.max(1, PlainKind.syllables(w)); });
      return Math.max(1, Math.round(0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59));
    }
    function clearMarks() { if (marks) ["wc-simplify", "wc-readability", "wc-passive", "wc-equality", "wc-current"].forEach(function (n) { CSS.highlights.delete(n); }); }
    function range(node, m) {
      try { var r = document.createRange(); r.setStart(node, m.start); r.setEnd(node, m.end); return r; } catch (e) { return null; }
    }
    function render(age) {
      var value = checked, node = document.createTextNode(value);
      preview.textContent = "";
      preview.appendChild(node);
      clearMarks();
      var groups = {};
      found.forEach(function (m) { var k = KINDS[m.source].key; (groups[k] = groups[k] || []).push(m); });
      if (marks) Object.keys(groups).forEach(function (k) {
        var h = new Highlight();
        groups[k].forEach(function (m) { var r = range(node, m); if (r) h.add(r); });
        CSS.highlights.set("wc-" + k, h);
      });
      // A few plain numbers
      summary.textContent = "";
      var grade = fkGrade(value);
      [["simplify"], ["readability"], ["passive"], ["equality"]].forEach(function (row) {
        var k = row[0], kind = Object.keys(KINDS).filter(function (s) { return KINDS[s].key === k; })[0], n = (groups[k] || []).length;
        var tile = el("p", "wc-stat wc-stat-" + k);
        tile.appendChild(el("span", "wc-stat-n", String(n)));
        tile.appendChild(el("span", "wc-stat-label", n === 1 ? KINDS[kind].name.toLowerCase() : KINDS[kind].plural));
        summary.appendChild(tile);
      });
      if (grade) summary.appendChild(el("p", "wc-grade small", "Reading level: about grade " + grade + " (a Flesch–Kincaid estimate; grade 6 to 8 suits most families)."));
      // The suggestions, in the order they appear
      listEl.textContent = "";
      found.forEach(function (m, i) {
        var kind = KINDS[m.source], li = el("li", "wc-item wc-item-" + kind.key);
        var head = el("p", "wc-item-head");
        head.appendChild(el("span", "wc-kind", kind.name));
        var bit = value.slice(m.start, m.end).replace(/\s+/g, " ").trim();
        head.appendChild(document.createTextNode(" " + quote(bit.length > 90 ? bit.slice(0, 87) + "…" : bit)));
        li.appendChild(head);
        li.appendChild(el("p", "wc-item-why", why(m, age)));
        var row = el("div", "wc-item-actions");
        var show = el("button", "btn btn-small btn-quiet", "Show it");
        show.type = "button";
        on(show, "click", function () { showOne(node, m); });
        row.appendChild(show);
        if (kind.key === "simplify" || kind.key === "equality") alternatives(m).forEach(function (alt) {
          var b = el("button", "btn btn-small btn-secondary", alt === "remove" ? "Leave it out" : "Use " + quote(alt));
          b.type = "button";
          on(b, "click", function () { replace(m, alt); });
          row.appendChild(b);
        });
        li.appendChild(row);
        listEl.appendChild(li);
      });
      if (!found.length) listEl.appendChild(el("li", "wc-item wc-none", "Nothing to suggest. It still helps to ask someone from your readers to look it over."));
      results.hidden = false;
    }
    function showOne(node, m) {
      var r = range(node, m);
      if (!r) return;
      if (marks) CSS.highlights.set("wc-current", new Highlight(r));
      var e = r.getBoundingClientRect(), box = preview.getBoundingClientRect();
      if (e.top < box.top || e.bottom > box.bottom) preview.scrollTop += e.top - box.top - 40;
      preview.focus({ preventScroll: true });
      announce("Marked in your text.");
    }
    /* Swap in a suggestion, keeping a capital letter at the start, then check again */
    function replace(m, alt) {
      if (text.value !== checked) { toast("The text changed since the check. Checking again first."); run(); return; }
      var old = checked.slice(m.start, m.end), before = checked.slice(0, m.start), after = checked.slice(m.end);
      if (alt === "remove") {
        // Leave the words out, and tidy the space they leave behind
        before = before.replace(/[ \t]+$/, "");
        after = after.replace(/^[ \t]+/, "");
        alt = /^[\s.,;:!?)]/.test(after) || !after || !before || /[\s(]$/.test(before) ? "" : " ";
        if (/^[A-Z]/.test(old) && after) after = after.charAt(0).toUpperCase() + after.slice(1);
      } else if (/^[A-Z]/.test(old)) alt = alt.charAt(0).toUpperCase() + alt.slice(1);
      text.value = before + alt + after;
      run(function () { announce((alt.trim() ? "Replaced with " + alt + ". " : "Left out. ") + found.length + (found.length === 1 ? " suggestion" : " suggestions") + " left."); });
    }
    function run(after) {
      var value = text.value;
      if (!value.trim()) { results.hidden = true; status.textContent = "Paste or type some text first."; clearMarks(); return; }
      if (running) return;
      running = true;
      status.textContent = window.PlainKind ? "Checking…" : "Getting the checker ready (the first time only)…";
      needs("PlainKind").then(function (lib) {
        var age = Number(audience.value) || 12;
        checked = value;
        found = lib.check(value, age).filter(function (m) {
          return KINDS[m.source] && m.start !== null && m.end !== null && m.end > m.start && m.end <= value.length;
        }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
        render(age);
        status.textContent = found.length ? found.length + (found.length === 1 ? " suggestion." : " suggestions.") + " Each one says why; change only what you agree with." : "Checked: nothing to suggest.";
        if (after) after();
      }, function () {
        status.textContent = "The checker couldn't load. Reload the page and try again.";
      }).then(function () { running = false; });
    }
    on($("#wc-check"), "click", function () { run(); });
    on($("#wc-example"), "click", function () { text.value = EXAMPLE; run(); });
    on($("#wc-clear"), "click", function () { text.value = ""; checked = ""; found = []; results.hidden = true; status.textContent = ""; clearMarks(); text.focus(); });
    on(audience, "change", function () { if (checked) run(); });
    /* After the first check, check again a moment after you stop typing */
    on(text, "input", function () {
      if (!checked) return;
      clearTimeout(timer);
      timer = setTimeout(function () { run(); }, 700);
    });
  });

  /* =========================================================================
     LOCK IT WITH A PASSPHRASE
     "Download all, locked" encrypts the same data file with the browser's
     own cryptography (Web Crypto): the passphrase becomes a key through
     PBKDF2 with SHA-256 and 600,000 rounds, which makes guessing slow, and
     the data is sealed with AES-256-GCM, which also reveals any change to
     the file. Importing a locked file asks for the passphrase first.
     The passphrase is never stored or sent, and nobody (not even the
     toolkit's makers) can open the file without it.
     Locked file: { format: "ai-co-evolution-locked", v: 1, about,
       kdf: { name, hash, iterations, salt }, cipher: { name, iv }, data }
     (base64). Its first line of defence is the passphrase you choose.
     ========================================================================= */
  var Locker = safe("locker", function () {
    var FORMAT = "ai-co-evolution-locked", ROUNDS = 600000;
    function ok() { return !!(window.crypto && crypto.subtle && window.isSecureContext && typeof TextEncoder === "function"); }
    function bytes(t) { return new TextEncoder().encode(t); }
    function b64(u8) { var s = ""; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
    function unb64(t) { var bin = atob(t), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
    var LABEL = bytes(FORMAT + "/v1");   // sealed in with the data, so the file can't be passed off as another kind
    function keyFrom(pass, salt, rounds) {
      return crypto.subtle.importKey("raw", bytes(String(pass).normalize("NFC")), "PBKDF2", false, ["deriveKey"]).then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: rounds }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
    }
    function lock(text, pass) {
      var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      return keyFrom(pass, salt, ROUNDS).then(function (key) {
        return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: LABEL }, key, bytes(text));
      }).then(function (sealed) {
        return JSON.stringify({ format: FORMAT, v: 1,
          about: "AI Co-Evolution in Education: your saved data, locked with a passphrase. To open it, use “Import from a file” in the toolkit and enter the passphrase.",
          kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ROUNDS, salt: b64(salt) }, cipher: { name: "AES-GCM", iv: b64(iv) }, data: b64(new Uint8Array(sealed)) }, null, 2);
      });
    }
    function isLocked(o) { return isPlain(o) && o.format === FORMAT; }
    function unlock(o, pass) {
      var bad = new Error("shape");
      if (!isLocked(o) || o.v !== 1 || !isPlain(o.kdf) || !isPlain(o.cipher) || typeof o.data !== "string") return Promise.reject(bad);
      var rounds = o.kdf.iterations;
      // Only the kinds of lock this toolkit makes, and no file that would keep a device busy for minutes
      if (o.kdf.name !== "PBKDF2" || o.kdf.hash !== "SHA-256" || o.cipher.name !== "AES-GCM" || !(Number.isInteger(rounds) && rounds >= 100000 && rounds <= 5000000)) return Promise.reject(bad);
      var salt, iv, data;
      try { salt = unb64(o.kdf.salt); iv = unb64(o.cipher.iv); data = unb64(o.data); } catch (e) { return Promise.reject(bad); }
      if (salt.length < 16 || iv.length !== 12 || data.length < 17) return Promise.reject(bad);
      return keyFrom(pass, salt, rounds).then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, additionalData: LABEL }, key, data);
      }).then(function (plain) { return new TextDecoder().decode(plain); });
    }
    return { ok: ok, lock: lock, unlock: unlock, isLocked: isLocked };
  });

  /* The passphrase dialog: choosing one to lock with, or entering one to unlock a file */
  var LockUI = safe("lock dialog", function () {
    var dlg = $("#lock-dialog"), form = $("#lock-form");
    if (!dlg || !Locker || !Dialogs) return null;
    var pass = $("#lock-pass"), pass2 = $("#lock-pass2"), field2 = $("#lock-pass2-field"), show = $("#lock-show"), msg = $("#lock-msg"), strengthEl = $("#lock-strength");
    var go = $("#lock-go"), title = $("#lock-h"), intro = $("#lock-intro"), passLabel = $("#lock-pass-label");
    var mode = "lock", file = null, busy = false;
    neverSubmits(form);
    /* A rough guide only: length matters most, and random words are easy to remember */
    function strength(p) {
      if (!p) return "";
      var words = p.trim().split(/[\s._-]+/).filter(function (w) { return w.length >= 3; }).length;
      var kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter(function (r) { return r.test(p); }).length;
      if (p.length < 10) return "Too short: use at least 10 characters. Four or more random words are easy to remember and hard to guess.";
      if (words >= 4 || p.length >= 20 || (p.length >= 14 && kinds >= 3)) return "Strong.";
      return "OK. Longer is stronger: four or more random words work well.";
    }
    function reset() {
      pass.value = pass2.value = "";
      show.checked = false;
      pass.type = pass2.type = "password";
      msg.textContent = strengthEl.textContent = "";
      busy = false;
      go.disabled = false;
    }
    function open(newMode, opener) {
      mode = newMode;
      reset();
      var locking = mode === "lock";
      title.textContent = locking ? "Lock your data with a passphrase" : "Unlock this file";
      intro.textContent = locking
        ? "You'll download the same data file as “Download all as JSON”, locked so that only someone with the passphrase can open it. If you forget the passphrase, nobody can open the file: not even the people who made this toolkit."
        : "This data file is locked. Enter its passphrase to see what's in it before anything changes.";
      passLabel.textContent = locking ? "Choose a passphrase" : "Passphrase";
      pass.setAttribute("autocomplete", locking ? "new-password" : "current-password");
      field2.hidden = !locking;
      strengthEl.hidden = !locking;
      go.lastChild.textContent = locking ? "Download the locked file" : "Unlock and continue";
      if (!Locker.ok()) {
        msg.textContent = "Locking needs a secure (https) address, or the toolkit's file opened from this device.";
        go.disabled = true;
      }
      Dialogs.open("lock-dialog", opener);
      pass.focus();
    }
    on(pass, "input", function () { if (mode === "lock") strengthEl.textContent = strength(pass.value); msg.textContent = ""; });
    on(pass2, "input", function () { msg.textContent = ""; });
    on(show, "change", function () { pass.type = pass2.type = show.checked ? "text" : "password"; });
    function act() {
      if (busy || go.disabled) return;
      if (mode === "lock") {
        if (pass.value.length < 10) { msg.textContent = "Use at least 10 characters."; pass.focus(); return; }
        if (pass.value !== pass2.value) { msg.textContent = "The two passphrases aren't the same."; pass2.focus(); return; }
        busy = true;
        go.disabled = true;
        msg.textContent = "Locking… (this takes a moment on purpose: it makes guessing slow)";
        Locker.lock(allData(), pass.value).then(function (locked) {
          var d = new Date();
          dlg.close();
          download("ai-co-evolution-my-data-locked-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + ".json", locked, "application/json");
          toast("Keep the passphrase somewhere safe: without it, the file can't be opened.", { timeout: 9000 });
        }, function () {
          msg.textContent = "This browser couldn't lock the file.";
        }).then(function () { busy = false; go.disabled = false; pass.value = pass2.value = ""; });
      } else {
        if (!pass.value) { msg.textContent = "Enter the passphrase."; pass.focus(); return; }
        busy = true;
        go.disabled = true;
        msg.textContent = "Unlocking…";
        Locker.unlock(file, pass.value).then(function (text) {
          var parsed;
          try { parsed = JSON.parse(text); } catch (e) { throw new Error("shape"); }
          dlg._skipRestore = true;
          dlg.close();
          if (Workspace) Workspace.take(parsed);
        }, function (err) {
          msg.textContent = err && err.message === "shape"
            ? "That file says it's locked, but it isn't in a shape this toolkit can open."
            : "That passphrase doesn't open this file, or the file was changed after it was locked.";
          pass.select();
        }).then(function () { busy = false; go.disabled = false; });
      }
    }
    on(go, "click", act);
    on(form, "keydown", function (e) { if (e.key === "Enter" && !e.isComposing && e.target.tagName === "INPUT" && e.target.type !== "checkbox") { e.preventDefault(); act(); } });
    on(dlg, "close", function () { pass.value = pass2.value = ""; file = null; });
    var exportBtn = $("#data-export-locked");
    if (exportBtn && !Locker.ok()) exportBtn.hidden = true;
    return {
      lock: function (opener) { open("lock", opener); },
      unlock: function (parsed, opener) { file = parsed; open("unlock", opener); }
    };
  });

  /* =========================================================================
     CURRICULUM STUDIO (new in 2.4): teachers design units that grow reasoning, literacy and
     autonomy, then share them as files others can open, adapt and improve.
     - The goals, routines and AI use levels come from the section's own markup (data-goal,
       data-routine, data-level), so adding one there adds it here.
     - Units are kept only in this browser under "aice:units" (listed under Your data):
       { v: 1, units: [unit, ...] }. sanitize() below is the one place that decides what a unit may
       contain; it checks this browser's own copy, unit files, and data files from other devices.
       docs/UNIT-FORMAT.md documents the format and docs/unit-card.schema.json is its JSON Schema.
     - Files: a unit file (JSON), a web page (the plan and the student page, with the unit inside so
       the studio can open it again) and Markdown. Nothing is ever sent anywhere.
     - Credit travels with a unit: opening someone's unit file makes a copy "based on" it, and a unit
       based on a ShareAlike one is shared alike too.
     To add an example unit, add it to EXAMPLES (the same shape as a saved unit).
     ========================================================================= */
  var Studio = safe("curriculum studio", function () {
    var tool = $("#studio-tool");
    if (!tool) return null;
    var STRANDS = ["reasoning", "literacy", "autonomy"];
    var STRAND_NAMES = { reasoning: "Reasoning", literacy: "Literacy", autonomy: "Autonomy" };
    var STAGES = ["model", "guided", "together", "alone"];
    var STAGE_NAMES = { model: "I show", guided: "We practise", together: "You try together", alone: "You lead" };
    var STAGE_LONG = { model: "I show (the teacher models)", guided: "We practise (guided)", together: "You try together (in groups)", alone: "You lead (on your own)" };
    var BANDS = { "5-8": "Ages 5 to 8", "9-12": "Ages 9 to 12", "13-15": "Ages 13 to 15", "16-18": "Ages 16 to 18", adult: "Adult learners" };
    var YOUNG = { "5-8": true, "9-12": true };   // under 13: any AI use is teacher-led
    var MINUTES = [30, 45, 50, 60, 90];
    var LICENSES = {
      "CC-BY-SA-4.0": { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/", says: "Others may adapt it if they credit its authors and share their version alike." },
      "CC-BY-4.0": { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", says: "Others may adapt it if they credit its authors." },
      "CC0-1.0": { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", says: "Others may use it in any way, with no conditions." },
      none: { name: "not for sharing yet", url: "", says: "Others should ask its authors before sharing or adapting it." }
    };
    var AI_WHY = { 2: "AI may help with ideas at the start; the work is the learner's.", 3: "Learners judge, change and credit what AI gives them.", 4: "The learning is in directing AI and judging what it makes.", 5: "We explore new uses of AI together." };
    var SUPPORT_IDEAS = ["Texts read aloud with Listen, each word highlighted", "Sentence starters for talk and writing", "Key words with pictures or gestures",
      "A choice of how to show learning", "Extra time, or a shorter version of the task", "Thinking in a home language first, then sharing",
      "A quiet minute to think before anyone speaks", "Work in pairs before working alone"];
    var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

    /* ---------- The studio's data, read from the page ---------- */
    var GOALS = {}, GOAL_TEXT = {}, GOAL_STRAND = {};
    STRANDS.forEach(function (s) {
      GOALS[s] = $$('.studio-strands [data-strand="' + s + '"] [data-goal]').map(function (li) {
        var id = li.getAttribute("data-goal"), text = li.textContent.trim();
        GOAL_TEXT[id] = text;
        GOAL_STRAND[id] = s;
        return { id: id, text: text };
      });
    });
    var ROUTINES = $$("#studio .routine[data-routine]").map(function (a) {
      return { id: a.getAttribute("data-routine"), name: $("h4", a).textContent.trim(),
        strands: a.getAttribute("data-strands").split(/\s+/), stages: a.getAttribute("data-stages").split(/\s+/),
        ai: Number(a.getAttribute("data-ai")) || 1, what: ($(".routine-what", a) || { textContent: "" }).textContent.trim() };
    });
    var ROUTINE = {};
    ROUTINES.forEach(function (r) { ROUTINE[r.id] = r; });
    var LEVELS = {};
    $$("#studio-ai-levels [data-level]").forEach(function (li) {
      var name = $("strong", li).textContent;
      LEVELS[li.getAttribute("data-level")] = { name: name.replace(/\.$/, ""), text: li.textContent.replace(name, "").trim() };
    });

    /* ---------- Example units: ready to copy and adapt ---------- */
    var EXAMPLE_BY = "AI Co-Evolution in Education (example unit)";
    var EXAMPLES = [
      { id: "u-exampleclaims", title: "Who's behind it? Checking claims online and from AI", subject: "Any subject: media and information literacy",
        question: "How can we tell whether a claim is worth believing?", band: "13-15", minutes: 50,
        why: "Learners meet claims every day, from friends, feeds and AI chatbots. Checking them is a habit that protects them, and the people they share things with.",
        goals: { reasoning: ["r-claim", "r-question", "r-change"], literacy: ["l-source", "l-ai", "l-summary"], autonomy: ["a-ai", "a-check", "a-reflect"] },
        task: "Choose a claim you've seen online or from an AI tool. Check it the way fact-checkers do, decide how far to trust it, and explain your verdict to someone who believed it.",
        choices: ["A one-page verdict with your sources", "A two-minute audio or video explainer", "A short talk to a small group, with notes", "A comic strip that shows how you checked"],
        criteria: ["I say who is behind the claim, and how I found out.", "I compare at least two other sources that don't copy each other.", "My verdict matches my evidence, and I say how sure I am.", "I explain it kindly, without making anyone feel foolish for believing it."],
        plan: [
          { title: "I show: checking a claim out loud", stage: "model", routine: "think-aloud", ai: 1, notes: "Pick a real but low-stakes claim. Leave the page and search for who's behind it, thinking aloud at each step, including one wrong turn." },
          { title: "We practise: reading sideways", stage: "guided", routine: "lateral-reading", ai: 1, notes: "Pairs check two prepared sources with the three questions: Who's behind it? What's the evidence? What do other sources say?" },
          { title: "You try together: checking an AI answer", stage: "together", routine: "claim-evidence-reasoning", ai: 3, aiWhy: "Learners question an AI answer and correct it with sources; the judging is theirs.", notes: "Groups get an AI answer to a question from the topic (the teacher can create it on a shared screen). They mark each claim in it: checked, wrong, or can't tell yet, with the source." },
          { title: "You lead: your own verdict", stage: "alone", routine: "choice-board", ai: 1, notes: "Learners choose a claim and a way to show their verdict, and check it against the success criteria. Close with: what will you check next time, before you share something?" }],
        supports: ["Prepared sets of sources for anyone who needs them", "Sentence starters: “I found out that…”, “Other sources say…”, “I'm fairly sure, because…”", "Texts read aloud with Listen, each word highlighted", "Work in pairs before working alone"],
        family: "Dear families,\n\nOver the next four lessons we're exploring a big question: how can we tell whether a claim is worth believing?\n\nYour child is learning the checks that professional fact-checkers use: find out who is behind a claim, look for the evidence, and see what other sources say. They'll also check an answer from an AI tool, because AI can sound sure and still be wrong.\n\nYou can help by asking at home: “Where did that come from, and how could we check it?”\n\nAI is used in one lesson, in class, so learners can practise questioning it. Their final work is done without AI.\n\nThank you,",
        core: ["The three questions: Who's behind it? What's the evidence? What do other sources say?", "Learners leave a source to check it before reading it closely (lateral reading).", "Each learner's final verdict is their own work, done without AI."],
        adapt: ["The claims and topics, to fit your subject and community", "The ways to show it", "The number of sessions, though four is the shortest that works"] },
      { id: "u-examplewater", title: "Our water, our story", subject: "Science and geography, outdoors",
        question: "Where does our water come from, and how can we care for it?", band: "9-12", minutes: 45,
        why: "Water connects every home in our community. Learners investigate their own watershed, listen to people who know it well, and share what they find with families.",
        goals: { reasoning: ["r-claim", "r-explain", "r-question"], literacy: ["l-question", "l-words", "l-audience"], autonomy: ["a-goal", "a-choice", "a-reflect"] },
        task: "Make a guide to caring for our water, for families or younger learners, using what you observed, read and heard.",
        choices: ["An illustrated poster or map with labels", "A short spoken tour, recorded or live", "A picture-book page for younger learners", "A model with an explanation card"],
        criteria: ["I show where our water comes from and where it goes.", "I explain one way people help or harm our water, with evidence from our walk, our reading or our guest.", "I use at least three new water words correctly.", "My guide suggests one caring action a family could really do."],
        plan: [
          { title: "I show: what do we notice about water?", stage: "model", routine: "see-think-wonder", ai: 1, notes: "Use photos, or a short walk near a stream, drain or tap. Model see, think, wonder aloud, then gather the class's wonderings on a chart to come back to." },
          { title: "We practise: water words", stage: "guided", routine: "frayer-model", ai: 1, notes: "Build Frayer squares together for watershed, runoff and filter. Keep them on the wall for the rest of the unit." },
          { title: "We practise: reading about our watershed", stage: "guided", routine: "reciprocal-teaching", ai: 1, notes: "Use a short local text from the council, a conservation group or the library. Model the four roles before groups take turns." },
          { title: "You try together: questions for someone who knows our water", stage: "together", routine: "community-of-inquiry", ai: 2, aiWhy: "The teacher asks an AI for background on a shared screen, and learners check what it says with our guest.", notes: "Invite a local Knowledge Keeper, water worker or conservation volunteer, following local protocols. Groups prepare questions together and take turns asking. Thank your guest in the way that's right locally." },
          { title: "You lead: make the guide", stage: "alone", routine: "choice-board", ai: 1, notes: "Learners choose a format, check their guide against the success criteria, and share it with families. Close with: what helped you learn the most?" }],
        supports: ["Key words with pictures or gestures", "A walking buddy for the outdoor session", "Sentence starters for questions: “Why does…?”, “What happens when…?”", "Thinking in a home language first, then sharing"],
        family: "Dear families,\n\nOver the next five lessons we're exploring a big question: where does our water come from, and how can we care for it?\n\nYour child will look closely at water near our school, learn new words like watershed and runoff, read about our local area, and ask questions of a guest who knows our water well. At the end, they'll make a guide for families.\n\nYou can help by asking at home: “Where does our water go after it leaves the sink?”\n\nYour child won't use AI directly. In one lesson the teacher will ask an AI tool for background facts on a shared screen, and the class will check what it says with our guest.\n\nThank you,",
        core: ["Learners observe a real place or object before they read about it.", "A local voice is heard and thanked, following local protocols.", "The guide is made for a real audience: families or younger learners."],
        adapt: ["The place: a stream, a beach, a drain, a tap or a rain barrel", "The guest", "The formats for the guide"] },
      { id: "u-exampledisagree", title: "Disagreeing well: deciding a real question together", subject: "Civics, ethics or any subject",
        question: "How can people who disagree make a fair decision together?", band: "16-18", minutes: 60,
        why: "Classes, communities and countries all have to decide things while people disagree. Learners practise arguing for what they think while understanding others, then use a fair process to decide something real.",
        goals: { reasoning: ["r-claim", "r-weigh", "r-steelman", "r-change"], literacy: ["l-source", "l-audience"], autonomy: ["a-strategy", "a-help", "a-ai"] },
        task: "As a class, decide a real question that affects you, such as a class rule for using AI, using evidence, the strongest case for each side, and a consent decision. Each learner then shows how their thinking changed.",
        choices: ["A written position and reflection", "A recorded dialogue with a partner who disagreed", "An argument map with a short reflection"],
        criteria: ["I state my position and back it with evidence.", "I put the strongest case for a view I disagree with, so fairly that its supporters would agree.", "I explain whether my thinking changed, and why.", "I help the group decide fairly: I listen, I don't interrupt, and I object only to a real risk of harm."],
        plan: [
          { title: "I show: arguing with myself", stage: "model", routine: "think-aloud", ai: 1, notes: "Model building a case for a position, then the strongest case against it. Show how you decide which reasons count most." },
          { title: "We practise: claims that hold up", stage: "guided", routine: "claim-evidence-reasoning", ai: 2, aiWhy: "AI can suggest arguments to test, and learners judge every one.", notes: "Pairs write a claim, evidence and reasoning for both sides. They may ask an AI for the strongest argument against their claim, then check it." },
          { title: "You try together: a seminar on the question", stage: "together", routine: "socratic-seminar", ai: 1, notes: "Inner and outer circles. The outer circle notes good uses of evidence, and moments when someone changed their mind." },
          { title: "You try together: decide with a consent round", stage: "together", routine: "talking-circle", ai: 1, notes: "Use the Circles timer's “Deciding together” mode: hear everyone, shape the proposal, then hold a consent round. Keep the decision record, with no names." },
          { title: "You lead: how did your thinking change?", stage: "alone", routine: "goal-plan-check-reflect", ai: 1, notes: "Each learner chooses how to show their reflection and checks it against the success criteria." }],
        supports: ["Sentence starters: “I see it differently because…”, “The strongest case for that is…”", "A quiet minute to think before anyone speaks", "A choice of how to show learning", "Roles for the seminar, so everyone has a way in"],
        family: "Dear families,\n\nOver the next five lessons we're exploring a big question: how can people who disagree make a fair decision together?\n\nYour child will practise backing a view with evidence, putting the strongest case for views they disagree with, and deciding a real class question using a fair process called consent: a proposal goes ahead when nobody sees a risk of harm in it.\n\nYou can help by asking at home: “What's the best argument for the other side?”\n\nAI is used once, as a sparring partner: learners may ask it for arguments against their own view, then check those arguments themselves.\n\nThank you,",
        core: ["Everyone puts the strongest case for a view they disagree with before the decision.", "The decision uses consent, with equal turns.", "The reflection is each learner's own, done without AI."],
        adapt: ["The question to decide", "The seminar text and the sources", "The ways to show the reflection"] }
    ].map(function (x) {
      x.by = EXAMPLE_BY;
      x.license = "CC-BY-SA-4.0";
      x.history = [{ date: "2026-11-14", note: "Example unit in version 2.4 of the toolkit." }];
      x.created = x.updated = "2026-11-14T00:00:00Z";
      return x;
    });

    /* ---------- Small helpers ---------- */
    function now() { return new Date().toISOString(); }
    function today() { return now().slice(0, 10); }
    function newId() {
      var a = new Uint8Array(10);
      try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
      return "u-" + Array.prototype.map.call(a, function (b) { return (b % 36).toString(36); }).join("");
    }
    function lines(text) { return String(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
    function str(v, max) { return typeof v === "string" ? v.slice(0, max) : ""; }
    function list(v, items, len) {
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, items).map(function (x) { return x.trim().slice(0, len); }) : [];
    }
    function nameOf(u) { return u.title.trim() || "Untitled unit"; }
    function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
    function fmtDate(iso) {
      var d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
      return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    }
    function goalTexts(u, s) { return u.goals[s].map(function (id) { return GOAL_TEXT[id]; }).concat(u.own[s]); }
    function young(u) { return !!YOUNG[u.band]; }
    function levelText(u, p) { return LEVELS[p.ai].name + (young(u) && p.ai > 1 ? " (teacher-led)" : ""); }

    /* ---------- What a unit may contain (the format, in code) ---------- */
    function blank() {
      var t = now();
      return { v: 1, id: newId(), title: "", subject: "", question: "", band: "13-15", minutes: 50, why: "",
        goals: { reasoning: [], literacy: [], autonomy: [] }, own: { reasoning: [], literacy: [], autonomy: [] },
        task: "", choices: [], criteria: [], plan: [], supports: [], family: "", core: [], adapt: [],
        reflect: { kept: "", change: "", voice: "" }, history: [], by: "", license: "CC-BY-SA-4.0", basedOn: [], created: t, updated: t };
    }
    var STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    function sanitize(u) {
      if (!isPlain(u)) return null;
      var out = blank();
      if (typeof u.id === "string" && /^u-[a-z0-9]{6,20}$/.test(u.id)) out.id = u.id;
      out.title = str(u.title, 120); out.subject = str(u.subject, 80); out.question = str(u.question, 200); out.why = str(u.why, 1200);
      out.band = has(BANDS, u.band) ? u.band : "13-15";
      out.minutes = MINUTES.indexOf(u.minutes) > -1 ? u.minutes : 50;
      STRANDS.forEach(function (s) {
        var g = isPlain(u.goals) && Array.isArray(u.goals[s]) ? u.goals[s] : [];
        out.goals[s] = g.filter(function (id, i) { return GOAL_STRAND[id] === s && g.indexOf(id) === i; });
        out.own[s] = list(isPlain(u.own) ? u.own[s] : [], 6, 200);
      });
      out.task = str(u.task, 2000); out.choices = list(u.choices, 12, 200); out.criteria = list(u.criteria, 12, 300);
      out.plan = (Array.isArray(u.plan) ? u.plan : []).filter(isPlain).slice(0, 20).map(function (p) {
        var ai = Number(p.ai);
        return { title: str(p.title, 160), stage: STAGES.indexOf(p.stage) > -1 ? p.stage : "guided", routine: has(ROUTINE, p.routine) ? p.routine : "",
          ai: ai >= 1 && ai <= 5 && Math.floor(ai) === ai ? ai : 1, aiWhy: str(p.aiWhy, 300), notes: str(p.notes, 2000) };
      });
      out.supports = list(u.supports, 12, 300); out.family = str(u.family, 3000); out.core = list(u.core, 10, 300); out.adapt = list(u.adapt, 10, 300);
      var r = isPlain(u.reflect) ? u.reflect : {};
      out.reflect = { kept: str(r.kept, 1500), change: str(r.change, 1500), voice: str(r.voice, 1500) };
      out.history = (Array.isArray(u.history) ? u.history : []).filter(function (h) {
        return isPlain(h) && typeof h.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && typeof h.note === "string" && h.note.trim();
      }).slice(-50).map(function (h) { return { date: h.date, note: h.note.trim().slice(0, 200) }; });
      out.by = str(u.by, 120).trim();
      out.license = has(LICENSES, u.license) ? u.license : "CC-BY-SA-4.0";
      out.basedOn = (Array.isArray(u.basedOn) ? u.basedOn : []).filter(function (b) { return isPlain(b) && typeof b.title === "string"; }).slice(0, 20).map(function (b) {
        var c = { title: str(b.title, 160).trim() || "Untitled unit", by: str(b.by, 120).trim(), license: has(LICENSES, b.license) ? b.license : "none" };
        if (typeof b.id === "string" && /^u-[a-z0-9]{6,20}$/.test(b.id)) c.id = b.id;
        return c;
      });
      if (typeof u.created === "string" && STAMP.test(u.created)) out.created = u.created;
      if (typeof u.updated === "string" && STAMP.test(u.updated)) out.updated = u.updated;
      return out;
    }

    /* ---------- Kept in this browser ---------- */
    var units = [], current = null, lastRaw = "", writing = false, saveTimer = null;
    function readAll() {
      var d = Store.get("units", null), out = [];
      if (isPlain(d) && Array.isArray(d.units)) d.units.forEach(function (u) {
        var c = sanitize(u);
        if (c && !out.some(function (x) { return x.id === c.id; })) out.push(c);
      });
      return out;
    }
    function writeAll() {
      writing = true;
      var ok = units.length ? Store.set("units", { v: 1, units: units }) : (Store.remove("units"), true);
      writing = false;
      lastRaw = Store.raw("units");
      return ok;
    }
    function find(id) { for (var i = 0; i < units.length; i++) if (units[i].id === id) return units[i]; return null; }
    /* For "Your data": a units item from a data file, checked unit by unit */
    function sanitizeAll(v) {
      if (!isPlain(v) || !Array.isArray(v.units)) return undefined;
      var out = [];
      v.units.slice(0, 200).forEach(function (u) { var c = sanitize(u); if (c && !out.some(function (x) { return x.id === c.id; })) out.push(c); });
      return out.length ? { v: 1, units: out } : undefined;
    }
    /* Combine: units from both; for a unit in both, the more recently edited one is kept */
    function merge(value) {
      units = readAll();
      value.units.forEach(function (u) {
        var mine = find(u.id);
        if (!mine) units.push(u);
        else if (u.updated > mine.updated) units[units.indexOf(mine)] = u;
      });
      var ok = writeAll();
      reload();
      return ok;
    }

    /* ---------- Elements ---------- */
    var shelf = $("#studio-shelf"), editor = $("#studio-editor"), form = $("#studio-form"), listEl = $("#studio-units"), emptyEl = $("#studio-empty");
    var statusEl = $("#su-status"), planEl = $("#su-plan"), releaseEl = $("#su-release"), checksEl = $("#su-checks"), checksSum = $("#su-checks-sum");
    var F = {};
    ["title", "subject", "question", "band", "minutes", "why", "task", "choices", "criteria", "count", "supports", "family", "core", "adapt",
      "kept", "change", "voice", "note", "by", "license"].forEach(function (k) { F[k] = $("#su-" + k); });
    neverSubmits(form);

    // The goals of each strand, as checkboxes, with room for the teacher's own
    var goalsBox = $("#su-goals");
    STRANDS.forEach(function (s) {
      var fs = el("fieldset", "su-strand");
      fs.setAttribute("data-strand", s);
      fs.appendChild(el("legend", null, STRAND_NAMES[s]));
      GOALS[s].forEach(function (g) {
        var lab = el("label", "check-row"), box = el("input");
        box.type = "checkbox";
        box.value = g.id;
        lab.appendChild(box);
        lab.appendChild(el("span", null, g.text));
        fs.appendChild(lab);
      });
      var f = el("div", "field"), lab2 = el("label", null, "Your own " + s + " goals "), ta = el("textarea");
      lab2.htmlFor = ta.id = "su-own-" + s;
      lab2.appendChild(el("span", "label-note", "(optional, one per line)"));
      ta.rows = 2;
      ta.maxLength = 1300;
      f.appendChild(lab2);
      f.appendChild(ta);
      fs.appendChild(f);
      goalsBox.appendChild(fs);
    });
    var ideas = $("#su-support-ideas");
    SUPPORT_IDEAS.forEach(function (idea) {
      var b = el("button", "chip");
      b.type = "button";
      b.setAttribute("data-idea", idea);
      b.appendChild(el("span", "sr-only", "Add: "));
      b.appendChild(document.createTextNode(idea));
      ideas.appendChild(b);
    });
    var exampleSel = $("#studio-example");
    EXAMPLES.forEach(function (x, i) {
      var o = el("option", null, x.title + " (" + BANDS[x.band].toLowerCase() + ")");
      o.value = String(i);
      exampleSel.appendChild(o);
    });

    /* ---------- The form and the unit ---------- */
    function fill(u) {
      ["title", "subject", "question", "why", "task", "family", "by"].forEach(function (k) { F[k].value = u[k]; });
      F.band.value = u.band;
      F.minutes.value = String(u.minutes);
      F.license.value = u.license;
      ["choices", "criteria", "supports", "core", "adapt"].forEach(function (k) { F[k].value = u[k].join("\n"); });
      F.kept.value = u.reflect.kept; F.change.value = u.reflect.change; F.voice.value = u.reflect.voice;
      F.note.value = "";
      STRANDS.forEach(function (s) {
        $$('#su-goals [data-strand="' + s + '"] input[type="checkbox"]').forEach(function (b) { b.checked = u.goals[s].indexOf(b.value) > -1; });
        $("#su-own-" + s).value = u.own[s].join("\n");
      });
      F.count.value = String(clamp(u.plan.length || 4, 2, 10));
      renderPlan();
      renderHistory();
      renderCredits();
      renderChecks();
    }
    function collect() {
      var u = current;
      ["title", "subject", "question", "why", "task", "family"].forEach(function (k) { u[k] = F[k].value; });
      u.by = F.by.value.trim();
      u.band = F.band.value;
      u.minutes = Number(F.minutes.value);
      u.license = F.license.value;
      u.choices = lines(F.choices.value).slice(0, 12); u.criteria = lines(F.criteria.value).slice(0, 12);
      u.supports = lines(F.supports.value).slice(0, 12); u.core = lines(F.core.value).slice(0, 10); u.adapt = lines(F.adapt.value).slice(0, 10);
      u.reflect = { kept: F.kept.value, change: F.change.value, voice: F.voice.value };
      STRANDS.forEach(function (s) {
        u.goals[s] = $$('#su-goals [data-strand="' + s + '"] input:checked').map(function (b) { return b.value; });
        u.own[s] = lines($("#su-own-" + s).value).slice(0, 6);
      });
    }
    function changed() {
      if (!current) return;
      collect();
      current.updated = now();
      renderChecks();
      renderCredits();
      renderYoungNotes();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    }
    function save() {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (!current) return;
      var mine = find(current.id);   // after a reload the list holds fresh copies: put the one being edited in its place
      if (!mine) units.unshift(current); else units[units.indexOf(mine)] = current;
      var ok = writeAll();
      statusEl.textContent = ok ? "Saved on this device." : "Not saved: this browser isn't keeping data. Download the unit file to keep it.";
    }
    function flush() { if (saveTimer) save(); }
    on(form, "input", function (e) { if (e.target !== F.note && !planEl.contains(e.target)) changed(); });
    on(form, "change", function (e) { if (e.target !== F.note && !planEl.contains(e.target)) changed(); });

    /* ---------- Sessions ---------- */
    function routineOptions(sel, stage, value) {
      sel.textContent = "";
      var none = el("option", null, "No routine");
      none.value = "";
      sel.appendChild(none);
      [["Fits this stage", true], ["Other routines", false]].forEach(function (g) {
        var group = el("optgroup");
        group.label = g[0];
        ROUTINES.filter(function (r) { return (r.stages.indexOf(stage) > -1) === g[1]; }).forEach(function (r) {
          var o = el("option", null, r.name);
          o.value = r.id;
          group.appendChild(o);
        });
        if (group.children.length) sel.appendChild(group);
      });
      sel.value = value;
    }
    function field(label, control, note) {
      var f = el("div", "field"), lab = el("label", null, label);
      lab.htmlFor = control.id;
      if (note) { lab.appendChild(document.createTextNode(" ")); lab.appendChild(el("span", "label-note", note)); }
      f.appendChild(lab);
      f.appendChild(control);
      return f;
    }
    function sessionCard(p, i, n) {
      var li = el("li", "su-session"), id = "su-s" + i + "-";
      li.setAttribute("data-i", String(i));
      var head = el("div", "su-session-head");
      head.appendChild(el("h4", "su-session-n", "Session " + (i + 1)));
      var acts = el("div", "su-session-acts");
      [["up", "Earlier", "Move session " + (i + 1) + " earlier", i === 0], ["down", "Later", "Move session " + (i + 1) + " later", i === n - 1],
        ["remove", "Remove", "Remove session " + (i + 1), false]].forEach(function (a) {
        var b = el("button", "btn btn-small btn-quiet", a[1]);
        b.type = "button";
        b.setAttribute("data-act", a[0]);
        b.setAttribute("aria-label", a[2]);
        b.disabled = a[3];
        acts.appendChild(b);
      });
      head.appendChild(acts);
      li.appendChild(head);
      var title = el("input");
      title.type = "text"; title.id = id + "title"; title.maxLength = 160; title.autocomplete = "off"; title.value = p.title; title.setAttribute("data-f", "title");
      var stage = el("select");
      stage.id = id + "stage"; stage.setAttribute("data-f", "stage");
      STAGES.forEach(function (s) { var o = el("option", null, STAGE_LONG[s]); o.value = s; stage.appendChild(o); });
      stage.value = p.stage;
      var grid1 = el("div", "form-grid form-grid-2");
      grid1.appendChild(field("What happens", title));
      grid1.appendChild(field("Who leads the thinking", stage));
      li.appendChild(grid1);
      var routine = el("select");
      routine.id = id + "routine"; routine.setAttribute("data-f", "routine");
      routineOptions(routine, p.stage, p.routine);
      var ai = el("select");
      ai.id = id + "ai"; ai.setAttribute("data-f", "ai");
      Object.keys(LEVELS).forEach(function (k) { var o = el("option", null, k + ". " + LEVELS[k].name); o.value = k; ai.appendChild(o); });
      ai.value = String(p.ai);
      var grid2 = el("div", "form-grid form-grid-2");
      grid2.appendChild(field("Routine", routine));
      grid2.appendChild(field("AI use", ai));
      li.appendChild(grid2);
      var hint = el("p", "small su-routine-hint");
      li.appendChild(hint);
      var why = el("input");
      why.type = "text"; why.id = id + "aiwhy"; why.maxLength = 300; why.autocomplete = "off"; why.value = p.aiWhy; why.setAttribute("data-f", "aiWhy");
      li.appendChild(field("Why this AI level", why, "(needed when AI is used)"));
      var youngNote = el("p", "small su-young-note");
      youngNote.appendChild(icon("i-info"));
      youngNote.appendChild(document.createTextNode("For learners under 13, AI use is teacher-led: the teacher runs it on a shared screen."));
      li.appendChild(youngNote);
      var notes = el("textarea");
      notes.id = id + "notes"; notes.rows = 2; notes.maxLength = 2000; notes.value = p.notes; notes.setAttribute("data-f", "notes");
      li.appendChild(field("Notes", notes, "(materials, timing, questions to ask)"));
      routineHint(li, p);
      return li;
    }
    function routineHint(li, p) {
      var hint = $(".su-routine-hint", li), r = ROUTINE[p.routine];
      hint.textContent = "";
      if (!r) return;
      hint.appendChild(document.createTextNode(r.what + " "));
      var a = el("a", null, "See the routine");
      a.href = "#routine-" + r.id;
      hint.appendChild(a);
    }
    function renderYoungNotes() {
      if (!current) return;
      $$(".su-session", planEl).forEach(function (li, i) {
        var p = current.plan[i];
        $(".su-young-note", li).hidden = !(p && young(current) && p.ai > 1);
      });
    }
    function renderRelease() {
      releaseEl.textContent = "";
      current.plan.forEach(function (p, i) {
        var li = el("li", "rel rel-" + p.stage), bar = el("span", "rel-bar");
        bar.setAttribute("aria-hidden", "true");
        li.appendChild(bar);
        li.appendChild(el("span", "sr-only", "Session "));
        li.appendChild(el("span", "rel-n", String(i + 1)));
        li.appendChild(el("span", "sr-only", ": "));
        li.appendChild(el("span", "rel-label", STAGE_NAMES[p.stage]));
        releaseEl.appendChild(li);
      });
      releaseEl.hidden = !current.plan.length;
    }
    function renderPlan() {
      planEl.textContent = "";
      current.plan.forEach(function (p, i) { planEl.appendChild(sessionCard(p, i, current.plan.length)); });
      renderRelease();
      renderYoungNotes();
    }
    function planChanged() {
      current.updated = now();
      renderRelease();
      renderChecks();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    }
    function onSession(e) {
      var t = e.target, f = t.getAttribute && t.getAttribute("data-f"), li = t.closest && t.closest(".su-session");
      if (!f || !li || !current) return;
      var p = current.plan[Number(li.getAttribute("data-i"))];
      if (!p) return;
      if (f === "ai") {
        p.ai = Number(t.value);
        if (p.ai > 1 && !p.aiWhy.trim()) { p.aiWhy = AI_WHY[p.ai]; $('[data-f="aiWhy"]', li).value = p.aiWhy; }
        renderYoungNotes();
      } else p[f] = t.value;
      if (f === "stage") routineOptions($('[data-f="routine"]', li), p.stage, p.routine);
      if (f === "routine" || f === "stage") routineHint(li, p);
      planChanged();
    }
    on(planEl, "input", onSession);
    on(planEl, "change", onSession);
    on(planEl, "click", function (e) {
      var b = e.target.closest && e.target.closest("[data-act]");
      if (!b || !current) return;
      var i = Number(b.closest(".su-session").getAttribute("data-i")), plan = current.plan, act = b.getAttribute("data-act"), to = i;
      if (act === "remove") {
        var gone = plan.splice(i, 1)[0];
        renderPlan();
        planChanged();
        var next = $$(".su-session", planEl)[Math.min(i, plan.length - 1)];
        (next ? $('[data-f="title"]', next) : $("#su-add")).focus();
        toast("Session " + (i + 1) + " removed.", { actions: [{ label: "Undo", primary: true, fn: function () {
          if (!current) return;
          current.plan.splice(i, 0, gone);
          renderPlan();
          planChanged();
          $('[data-f="title"]', $$(".su-session", planEl)[i]).focus();
        } }, { label: "OK" }] });
        return;
      }
      to = act === "up" ? i - 1 : i + 1;
      if (to < 0 || to >= plan.length) return;
      plan.splice(to, 0, plan.splice(i, 1)[0]);
      renderPlan();
      planChanged();
      var moved = $$(".su-session", planEl)[to], again = $('[data-act="' + act + '"]', moved);
      (again && !again.disabled ? again : $('[data-f="title"]', moved)).focus();
      announce("Session moved to place " + (to + 1) + ".");
    });
    on($("#su-add"), "click", function () {
      if (!current) return;
      if (current.plan.length >= 20) { toast("A unit can have up to 20 sessions."); return; }
      var last = current.plan[current.plan.length - 1];
      current.plan.push({ title: "", stage: last ? last.stage : "model", routine: "", ai: 1, aiWhy: "", notes: "" });
      renderPlan();
      planChanged();
      $('[data-f="title"]', planEl.lastElementChild).focus();
    });

    /* A suggested sequence: the release of responsibility spread over the sessions (I show, then we
       practise, you try together and you lead), each with a routine for that stage that grows the
       strands chosen, taking turns between them. The same goals always give the same suggestion. */
    function suggest(u, n) {
      var chosen = STRANDS.filter(function (s) { return u.goals[s].length || u.own[s].length; });
      if (!chosen.length) chosen = STRANDS.slice();
      var aiGoal = u.goals.literacy.indexOf("l-ai") > -1 || u.goals.autonomy.indexOf("a-ai") > -1;
      var used = {}, plan = [];
      function best(stage, focus) {
        var score = function (r) {
          return (r.strands.indexOf(focus) > -1 ? 100 : 0) + (used[r.id] ? 0 : 50)
            + chosen.filter(function (s) { return r.strands.indexOf(s) > -1; }).length * 10 - ROUTINES.indexOf(r) / 100;
        };
        return ROUTINES.filter(function (r) { return r.stages.indexOf(stage) > -1; }).sort(function (a, b) { return score(b) - score(a); })[0];
      }
      for (var i = 0; i < n; i++) {
        var stage = STAGES[Math.round(i * 3 / (n - 1))], focus = chosen[i % chosen.length], pick = null;
        if (i === 0) pick = ROUTINE["think-aloud"];
        else if (i === n - 1 && chosen.indexOf("autonomy") > -1) pick = ROUTINE["choice-board"];
        else if (aiGoal && !used["should-i-use-ai"] && i === Math.floor(n / 2)) pick = ROUTINE["should-i-use-ai"];
        if (!pick || pick.stages.indexOf(stage) < 0 || used[pick.id]) pick = best(stage, focus);
        used[pick.id] = true;
        var ai = young(u) || stage === "model" ? 1 : pick.ai;
        plan.push({ title: STAGE_NAMES[stage] + ": " + lowerFirst(pick.name), stage: stage, routine: pick.id, ai: ai, aiWhy: ai > 1 ? AI_WHY[ai] : "", notes: "" });
      }
      return plan;
    }
    on($("#su-suggest"), "click", function () {
      if (!current) return;
      var n = Number(F.count.value);
      function go() {
        current.plan = suggest(current, n);
        renderPlan();
        planChanged();
        announce("Suggested " + n + " sessions, from “I show” to “You lead”.");
        $('[data-f="title"]', planEl).focus();
      }
      var typed = current.plan.some(function (p) { return p.notes.trim(); });
      if (!typed) { go(); return; }
      toast("Replace your " + current.plan.length + " sessions, and their notes, with a suggestion?", { sticky: true, actions: [{ label: "Replace them", fn: go }, { label: "Keep mine", primary: true }] });
    });

    /* ---------- Design checks: prompts, not a score ---------- */
    function checks(u) {
      var plan = u.plan, last = plan[plan.length - 1];
      var strand = function (s) { return u.goals[s].length + u.own[s].length > 0; };
      return [
        { ok: !!u.question.trim(), text: "A big question to explore", hint: "Add it in step 1." },
        { ok: STRANDS.every(strand), text: "Goals in all three strands", hint: "Step 2: at least one goal for reasoning, literacy and autonomy." },
        { ok: u.choices.length >= 2, text: "A real choice in how to show it", hint: "Step 3: offer at least two ways." },
        { ok: u.criteria.length >= 1, text: "Success criteria in learners' words", hint: "Step 3: “Start from the goals” drafts them." },
        { ok: plan.length >= 2 && /^(model|guided)$/.test(plan[0].stage) && /^(together|alone)$/.test(last.stage) && plan.some(function (p) { return p.stage === "alone"; }),
          text: "The thinking moves to learners", hint: "Step 4: start with “I show” or “We practise”, and include a “You lead” session." },
        { ok: plan.length > 0 && plan.every(function (p) { return p.ai === 1 || !!p.aiWhy.trim(); }), text: "Every use of AI says why", hint: "Step 4: give a reason for each session that uses AI." },
        { ok: plan.some(function (p) { return p.routine === "goal-plan-check-reflect"; }) || u.goals.autonomy.indexOf("a-reflect") > -1,
          text: "Time for learners to reflect", hint: "Add the “Goal, plan, check, reflect” routine, or the reflection goal." },
        { ok: !!u.family.trim(), text: "Families know what's happening", hint: "Step 5: “Draft it from the unit” helps." },
        { ok: u.core.length > 0 && u.adapt.length > 0, text: "Another teacher could teach it", hint: "Step 5: say what must stay and what can change." }
      ];
    }
    function renderChecks() {
      var all = checks(current), done = 0;
      checksEl.textContent = "";
      all.forEach(function (c) {
        var li = el("li", c.ok ? "is-ok" : "is-todo");
        li.appendChild(icon(c.ok ? "i-check-circle" : "i-info"));
        var body = el("span", "su-check-text");
        body.appendChild(el("span", null, c.text));
        body.appendChild(el("span", "su-check-state", c.ok ? "In place" : "Not yet: " + c.hint));
        li.appendChild(body);
        checksEl.appendChild(li);
        if (c.ok) done++;
      });
      if (young(current) && current.plan.some(function (p) { return p.ai > 1; })) {
        var li = el("li", "is-note");
        li.appendChild(icon("i-info"));
        li.appendChild(el("span", "su-check-text", "Under 13: sessions with AI are teacher-led, on a shared screen."));
        checksEl.appendChild(li);
      }
      checksSum.textContent = done + " of " + all.length + " in place.";
    }

    /* ---------- History and credits ---------- */
    function renderHistory() {
      var ol = $("#su-history");
      ol.textContent = "";
      current.history.forEach(function (h) {
        var li = el("li");
        li.appendChild(el("strong", null, fmtDate(h.date) + ": "));
        li.appendChild(document.createTextNode(h.note));
        ol.appendChild(li);
      });
      ol.hidden = !current.history.length;
    }
    function addNote() {
      var t = F.note.value.trim();
      if (!t) { toast("Write a short note about what changed first."); F.note.focus(); return; }
      current.history.push({ date: today(), note: t.slice(0, 200) });
      F.note.value = "";
      renderHistory();
      changed();
      announce("Added to the history.");
    }
    on($("#su-note-add"), "click", addNote);
    on(F.note, "keydown", function (e) { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addNote(); } });
    function shareAlike(u) { return u.basedOn.some(function (b) { return b.license === "CC-BY-SA-4.0"; }); }
    function renderCredits() {
      var u = current, sa = shareAlike(u), box = $("#su-credits"), note = $("#su-license-note");
      $$("option", F.license).forEach(function (o) { o.disabled = sa && o.value !== "CC-BY-SA-4.0" && o.value !== "none"; });
      if (sa && u.license !== "CC-BY-SA-4.0" && u.license !== "none") { u.license = "CC-BY-SA-4.0"; F.license.value = u.license; }
      var says = sa ? "It's based on a unit shared alike, so yours is shared alike too, or kept to yourself." : LICENSES[u.license].says;
      if (u.basedOn.some(function (b) { return b.license === "none"; })) says += " A unit it's based on isn't licensed for sharing: ask its authors before you share yours.";
      note.textContent = says;
      box.textContent = "";
      if (!u.basedOn.length) return;
      box.appendChild(el("p", "small su-credits-h", "Based on, with thanks:"));
      var ul = el("ul", "small");
      u.basedOn.forEach(function (b) { ul.appendChild(el("li", null, "“" + b.title + "”" + (b.by ? " by " + b.by : "") + " (" + LICENSES[b.license].name + ")")); });
      box.appendChild(ul);
    }

    /* ---------- Helpers for step 3 and step 5 ---------- */
    on($("#su-criteria-draft"), "click", function () {
      if (!current) return;
      var have = lines(F.criteria.value), add = [];
      STRANDS.forEach(function (s) { goalTexts(current, s).forEach(function (t) { if (have.indexOf(t) < 0 && add.indexOf(t) < 0) add.push(t); }); });
      if (!add.length) { toast(have.length ? "Every goal is already in the success criteria." : "Choose some goals in step 2 first."); return; }
      F.criteria.value = have.concat(add).slice(0, 12).join("\n");
      changed();
      F.criteria.focus();
      announce("Added " + Math.min(add.length, 12 - have.length) + " criteria from the goals. Rewrite them in your learners' words.");
    });
    on(ideas, "click", function (e) {
      var b = e.target.closest && e.target.closest("[data-idea]");
      if (!b || !current) return;
      var have = lines(F.supports.value), idea = b.getAttribute("data-idea");
      if (have.indexOf(idea) > -1) { announce("Already in the supports."); return; }
      F.supports.value = have.concat([idea]).join("\n");
      changed();
      announce("Added: " + idea + ".");
    });
    /* A first draft of the note to families, in plain words, from the unit itself */
    function theirs(t) {
      return t.replace(/^I can /, "").replace(/\.$/, "").replace(/\bI've\b/g, "they've").replace(/\bI'll\b/g, "they'll").replace(/\bI'm\b/g, "they're")
        .replace(/\bmy\b/g, "their").replace(/\bme\b/g, "them").replace(/\bI\b/g, "they");
    }
    function familyDraft(u) {
      var n = u.plan.length, goals = [], withAI = u.plan.filter(function (p) { return p.ai > 1; }).length;
      STRANDS.forEach(function (s) { goalTexts(u, s).forEach(function (t) { goals.push("- " + theirs(t)); }); });
      var out = ["Dear families,", ""];
      out.push((n ? "Over the next " + n + " lessons" : "In our next unit") + (u.question.trim() ? ", we're exploring a big question: " + u.question.trim() : ", we're starting something new: " + nameOf(u) + "."));
      out.push("");
      if (goals.length) out.push("Your child will be learning to:", goals.slice(0, 6).join("\n"), "");
      if (!withAI) out.push("We won't use AI in this unit.");
      else out.push("AI is used in " + withAI + " of the " + n + " lessons, and each time we explain why." + (young(u) ? " Your child won't use AI directly: the teacher runs it on a shared screen." : ""));
      out.push("");
      if (u.question.trim()) out.push("You can help by asking at home: “" + u.question.trim().replace(/[.?!]*$/, "") + "?”", "");
      out.push("Thank you,");
      return out.join("\n");
    }
    on($("#su-family-draft"), "click", function () {
      if (!current) return;
      function draft() { F.family.value = familyDraft(current); changed(); F.family.focus(); announce("Drafted the note to families. Make it your own."); }
      if (!F.family.value.trim()) { draft(); return; }
      toast("Replace your note to families with a new draft?", { sticky: true, actions: [{ label: "Replace it", fn: draft }, { label: "Keep mine", primary: true }] });
    });
    /* The note goes to the plain and kind writing check further down the page, and can come back */
    on($("#su-family-check"), "click", function () {
      var text = F.family.value.trim(), wc = $("#wc-text"), go = $("#wc-check"), audience = $("#wc-audience");
      if (!text) { toast("Write or draft the note to families first."); F.family.focus(); return; }
      if (!wc || !go) { toast("The writing check isn't available here."); return; }
      if (audience) audience.value = "12";
      wc.value = text;
      wc.dispatchEvent(new Event("input", { bubbles: true }));
      go.click();
      var reduce = Settings && Settings.reducedMotion && Settings.reducedMotion();
      $("#writing-check").scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      wc.focus({ preventScroll: true });
      var unit = current;
      toast("Your note to families is in the writing check. When it reads well, bring it back.", { sticky: true, actions: [
        { label: "Bring it back to the unit", primary: true, fn: function () {
          if (current !== unit) return;
          F.family.value = wc.value;
          changed();
          F.family.focus();
          announce("The note to families is back in your unit.");
        } }, { label: "Close" }] });
    });

    /* ---------- What a unit looks like on paper and as a web page ---------- */
    function add(parent, tag, cls, text) { var n = el(tag, cls, text); parent.appendChild(n); return n; }
    function bullets(parent, items, tag) { var l = add(parent, tag || "ul"); items.forEach(function (t) { add(l, "li", null, t); }); return l; }
    function creditLine(u) {
      var parts = [];
      if (u.by) parts.push("By " + u.by + ".");
      if (u.basedOn.length) parts.push("Based on " + u.basedOn.map(function (b) { return "“" + b.title + "”" + (b.by ? " by " + b.by : "") + " (" + LICENSES[b.license].name + ")"; }).join("; ") + ".");
      parts.push(u.license === "none" ? "Not for sharing yet." : "License: " + LICENSES[u.license].name + ", " + LICENSES[u.license].url);
      return parts.join(" ");
    }
    function planView(u) {
      var a = el("article", "unit-view");
      add(a, "h1", null, nameOf(u));
      if (u.question.trim()) add(a, "p", "unit-question", "Big question: " + u.question.trim());
      add(a, "p", "unit-meta", BANDS[u.band] + " · " + u.plan.length + " session" + (u.plan.length === 1 ? "" : "s") + " of " + u.minutes + " minutes" + (u.subject.trim() ? " · " + u.subject.trim() : ""));
      if (u.why.trim()) { add(a, "h2", null, "Why it matters"); add(a, "p", "unit-text", u.why.trim()); }
      add(a, "h2", null, "Goals");
      STRANDS.forEach(function (s) { var g = goalTexts(u, s); if (g.length) { add(a, "h3", null, STRAND_NAMES[s]); bullets(a, g); } });
      if (u.task.trim() || u.choices.length || u.criteria.length) add(a, "h2", null, "How learners will show it");
      if (u.task.trim()) add(a, "p", "unit-text", u.task.trim());
      if (u.choices.length) { add(a, "h3", null, "Ways to show it"); bullets(a, u.choices); }
      if (u.criteria.length) { add(a, "h3", null, "Success criteria"); bullets(a, u.criteria); }
      if (u.plan.length) add(a, "h2", null, "Sessions");
      var ol = add(a, "ol", "unit-sessions");
      u.plan.forEach(function (p, i) {
        var li = add(ol, "li");
        add(li, "h3", null, "Session " + (i + 1) + ": " + (p.title.trim() || STAGE_NAMES[p.stage]));
        add(li, "p", null, "Who leads the thinking: " + STAGE_LONG[p.stage] + ".");
        if (ROUTINE[p.routine]) add(li, "p", null, "Routine: " + ROUTINE[p.routine].name + ". " + ROUTINE[p.routine].what);
        add(li, "p", null, "AI use: " + levelText(u, p) + "." + (p.aiWhy.trim() ? " " + p.aiWhy.trim() : ""));
        if (p.notes.trim()) add(li, "p", "unit-text", p.notes.trim());
      });
      if (u.supports.length) { add(a, "h2", null, "Supports"); bullets(a, u.supports); }
      if (u.family.trim()) { add(a, "h2", null, "A note to families"); add(a, "p", "unit-text", u.family.trim()); }
      if (u.core.length) { add(a, "h2", null, "What must stay, so it still works"); bullets(a, u.core); }
      if (u.adapt.length) { add(a, "h2", null, "What others can change"); bullets(a, u.adapt); }
      var r = u.reflect;
      if (r.kept.trim() || r.change.trim() || r.voice.trim()) {
        add(a, "h2", null, "After teaching");
        var dl = add(a, "dl");
        [["What worked", r.kept], ["What to change next time", r.change], ["What learners said", r.voice]].forEach(function (x) {
          if (!x[1].trim()) return;
          add(dl, "dt", null, x[0]);
          add(dl, "dd", "unit-text", x[1].trim());
        });
      }
      if (u.history.length) { add(a, "h2", null, "History"); bullets(a, u.history.map(function (h) { return h.date + ": " + h.note; }), "ol"); }
      add(a, "p", "unit-credits", creditLine(u));
      return a;
    }
    function studentView(u) {
      var a = el("article", "unit-student");
      add(a, "h1", null, nameOf(u));
      if (u.question.trim()) add(a, "p", "unit-question", "Our big question: " + u.question.trim());
      var can = u.criteria.length ? u.criteria : STRANDS.reduce(function (all, s) { return all.concat(goalTexts(u, s)); }, []);
      if (can.length) { add(a, "h2", null, "What you'll be able to do"); bullets(a, can); }
      if (u.choices.length) { add(a, "h2", null, "How you can show it"); bullets(a, u.choices.concat(["Your own idea, if your teacher agrees"])); }
      if (u.plan.length) {
        add(a, "h2", null, "How we'll use AI, session by session");
        bullets(a, u.plan.map(function (p, i) { return "Session " + (i + 1) + (p.title.trim() ? ", " + p.title.trim() : "") + ": " + levelText(u, p) + "." + (p.aiWhy.trim() ? " " + p.aiWhy.trim() : ""); }), "ol");
      }
      add(a, "h2", null, "My plan");
      var grid = add(a, "div", "unit-boxes");
      ["My goal, in my own words", "My plan: the strategy I'll use", "Halfway check: is it working?", "What helped me learn"].forEach(function (t) {
        var box = add(grid, "div", "unit-box");
        add(box, "p", "unit-box-label", t);
      });
      add(a, "h2", null, "How sure am I?");
      bullets(a, ["☐ I could teach it to someone else", "☐ I'm getting there", "☐ Not yet, and that's fine: I know what to ask"]);
      return a;
    }
    var UNIT_CSS = [
      ":root { color-scheme: light dark; --ink: #142f2c; --ink-2: #3c5552; --page: #fbfcf9; --line: #cdd8d1; --accent: #17656c; --soft: #eef2ec; }",
      "@media (prefers-color-scheme: dark) { :root { --ink: #e6eee9; --ink-2: #b9c9c3; --page: #102627; --line: #35585a; --accent: #6cc4c7; --soft: #163031; } }",
      "body { margin: 0 auto; max-width: 46rem; padding: 1.5rem 1rem 3rem; background: var(--page); color: var(--ink); font: 1.05rem/1.6 system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif; }",
      "h1 { font-size: 1.8rem; line-height: 1.2; margin: .5rem 0 .75rem; } h2 { font-size: 1.3rem; margin: 2rem 0 .5rem; } h3 { font-size: 1.08rem; margin: 1.2rem 0 .3rem; }",
      "a { color: var(--accent); } .unit-question { font-size: 1.15rem; font-weight: 700; } .unit-meta, .unit-credits, .made-with { color: var(--ink-2); }",
      ".unit-text { white-space: pre-wrap; } .unit-sessions { list-style: none; padding: 0; } .unit-sessions > li { margin: 0 0 1rem; } .unit-sessions h3 { margin-top: .4rem; }",
      ".unit-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: .75rem; } .unit-box { min-height: 6rem; border: 1px solid var(--line); border-radius: 10px; padding: .5rem .75rem; }",
      ".unit-box-label { margin: 0; font-weight: 700; } .zero-harm { margin-top: 2.5rem; padding: .75rem 1rem; border-radius: 10px; background: var(--soft); font-size: .95rem; }",
      "hr { border: 0; border-top: 2px dashed var(--line); margin: 3rem 0; }",
      "@media print { body { background: #fff; color: #000; max-width: none; } .unit-student { break-before: page; } hr, .made-with { display: none; } }"
    ].join("\n");
    function webPage(u) {
      var doc = document.implementation.createHTMLDocument(nameOf(u));
      doc.documentElement.lang = "en";
      var head = doc.head, body = doc.body;
      var charset = doc.createElement("meta");
      charset.setAttribute("charset", "utf-8");
      head.insertBefore(charset, head.firstChild);
      var vp = doc.createElement("meta");
      vp.name = "viewport";
      vp.content = "width=device-width, initial-scale=1";
      head.appendChild(vp);
      var csp = doc.createElement("meta");   // a page with no scripts, that loads nothing
      csp.httpEquiv = "Content-Security-Policy";
      csp.content = "default-src 'none'; style-src 'unsafe-inline'";
      head.appendChild(csp);
      var style = doc.createElement("style");
      style.textContent = UNIT_CSS;
      head.appendChild(style);
      body.appendChild(el("p", "made-with", "A unit plan made with the Curriculum studio in AI Co-Evolution in Education " + APP_VERSION + ". To adapt it, open this file in the studio (“Open a unit file”). The student page follows the plan."));
      body.appendChild(planView(u));
      body.appendChild(el("hr"));
      body.appendChild(studentView(u));
      body.appendChild(el("p", "zero-harm", "Zero Harm and Anti-Coercion: this plan is for learning, never for surveilling, ranking, shaming or excluding anyone. Keep students' names and personal details out of it, and if anything in it causes harm, stop, check in with the people affected, and repair it together."));
      var data = doc.createElement("script");   // the unit itself, so the studio can open this page again (data, never run)
      data.type = "application/json";
      data.id = "aice-unit";
      data.textContent = JSON.stringify(fileData(u)).replace(/</g, "\\u003c");
      body.appendChild(data);
      return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
    }
    function markdown(u) {
      var L = [];
      function p() { for (var i = 0; i < arguments.length; i++) L.push(arguments[i]); }
      function list(items, ordered) { items.forEach(function (t, i) { p((ordered ? (i + 1) + ". " : "- ") + t.replace(/\n+/g, " ")); }); p(""); }
      p("# " + nameOf(u), "");
      if (u.question.trim()) p("**Big question:** " + u.question.trim(), "");
      p("**Learners:** " + BANDS[u.band] + " · **Sessions:** " + u.plan.length + " of " + u.minutes + " minutes" + (u.subject.trim() ? " · **Subject:** " + u.subject.trim() : ""), "");
      if (u.why.trim()) p("## Why it matters", "", u.why.trim(), "");
      p("## Goals", "");
      STRANDS.forEach(function (s) { var g = goalTexts(u, s); if (g.length) { p("### " + STRAND_NAMES[s], ""); list(g); } });
      if (u.task.trim() || u.choices.length || u.criteria.length) p("## How learners will show it", "");
      if (u.task.trim()) p(u.task.trim(), "");
      if (u.choices.length) { p("**Ways to show it**", ""); list(u.choices); }
      if (u.criteria.length) { p("**Success criteria**", ""); list(u.criteria); }
      if (u.plan.length) p("## Sessions", "");
      u.plan.forEach(function (s, i) {
        p("### " + (i + 1) + ". " + (s.title.trim() || STAGE_NAMES[s.stage]), "");
        p("- **Who leads the thinking:** " + STAGE_LONG[s.stage]);
        if (ROUTINE[s.routine]) p("- **Routine:** " + ROUTINE[s.routine].name + ". " + ROUTINE[s.routine].what);
        p("- **AI use:** " + levelText(u, s) + "." + (s.aiWhy.trim() ? " " + s.aiWhy.trim() : ""), "");
        if (s.notes.trim()) p(s.notes.trim(), "");
      });
      if (u.supports.length) { p("## Supports", ""); list(u.supports); }
      if (u.family.trim()) p("## A note to families", "", u.family.trim(), "");
      if (u.core.length) { p("## What must stay, so it still works", ""); list(u.core); }
      if (u.adapt.length) { p("## What others can change", ""); list(u.adapt); }
      var r = u.reflect;
      if (r.kept.trim() || r.change.trim() || r.voice.trim()) {
        p("## After teaching", "");
        if (r.kept.trim()) p("**What worked:** " + r.kept.trim(), "");
        if (r.change.trim()) p("**What to change next time:** " + r.change.trim(), "");
        if (r.voice.trim()) p("**What learners said:** " + r.voice.trim(), "");
      }
      if (u.history.length) { p("## History", ""); list(u.history.map(function (h) { return h.date + ": " + h.note; })); }
      p("---", "", creditLine(u), "", "*Made with the Curriculum studio in AI Co-Evolution in Education " + APP_VERSION + ". To adapt it, open the unit file in the studio.*");
      return L.join("\n") + "\n";
    }
    function fileData(u) {
      return { format: "ai-co-evolution-unit", v: 1, exported: now(), app: "AI Co-Evolution in Education " + APP_VERSION, unit: u };
    }
    function slug(u) {
      var s = nameOf(u).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
      return "unit-" + (s || "untitled");
    }

    /* ---------- Sharing, with a privacy check first ---------- */
    var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, PHONE = /(\+?\d[\s().-]*){9,}/;
    function personal(text) { return EMAIL.test(text) || PHONE.test(text); }
    function share(go) {
      if (!current) return;
      collect();
      save();
      var u = current, texts = [u.title, u.subject, u.question, u.why, u.task, u.family, u.by, u.reflect.kept, u.reflect.change, u.reflect.voice]
        .concat(u.choices, u.criteria, u.supports, u.core, u.adapt, u.own.reasoning, u.own.literacy, u.own.autonomy,
          u.history.map(function (h) { return h.note; }), u.plan.map(function (p) { return p.title + " " + p.aiWhy + " " + p.notes; }));
      if (!texts.some(personal)) { go(); return; }
      toast("This unit seems to include an email address or phone number. Units are made for sharing, so you may want to take it out first.", { sticky: true, actions: [
        { label: "Show me", primary: true, fn: function () {
          var spot = $$('input[type="text"], textarea', form).filter(function (f) { return personal(f.value); })[0];
          if (spot) spot.focus();
        } }, { label: "Share it anyway", fn: go }] });
    }
    on($("#su-export-json"), "click", function () { share(function () { download(slug(current) + ".json", JSON.stringify(fileData(current), null, 2) + "\n", "application/json"); }); });
    on($("#su-export-html"), "click", function () { share(function () { download(slug(current) + ".html", webPage(current), "text/html"); }); });
    on($("#su-export-md"), "click", function () { share(function () { download(slug(current) + ".md", markdown(current), "text/markdown"); }); });
    on($("#su-print"), "click", function () { if (current && Printer) { collect(); Printer.print(planView(current), { title: "Unit plan: " + nameOf(current) }); } });
    on($("#su-print-student"), "click", function () { if (current && Printer) { collect(); Printer.print(studentView(current), { title: "Student page: " + nameOf(current) }); } });

    /* ---------- Opening units ---------- */
    function renderList() {
      listEl.textContent = "";
      var sorted = units.slice().sort(function (a, b) { return a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0; });
      emptyEl.hidden = sorted.length > 0;
      sorted.forEach(function (u) {
        var li = el("li", "studio-unit"), b = el("button", "studio-unit-open", nameOf(u));
        b.type = "button";
        b.setAttribute("data-id", u.id);
        li.appendChild(b);
        li.appendChild(el("span", "small muted", u.plan.length + " session" + (u.plan.length === 1 ? "" : "s") + " · " + BANDS[u.band] + " · edited " + fmtDate(u.updated)));
        listEl.appendChild(li);
      });
    }
    function open(u) {
      current = u;
      fill(u);
      shelf.hidden = true;
      editor.hidden = false;
      statusEl.textContent = "";
      F.title.focus();
    }
    function close() {
      flush();
      current = null;
      editor.hidden = true;
      shelf.hidden = false;
      renderList();
    }
    on($("#su-back"), "click", function () { close(); $("#studio-new").focus(); });
    on(listEl, "click", function (e) {
      var b = e.target.closest && e.target.closest("[data-id]"), u = b && find(b.getAttribute("data-id"));
      if (u) open(u);
    });
    on($("#studio-new"), "click", function () { open(blank()); });   // kept once something is typed
    /* A copy to adapt: new id, and the original credited under "Based on" */
    function copyOf(u, note) {
      var c = sanitize(JSON.parse(JSON.stringify(u)));
      c.id = newId();
      c.created = c.updated = now();
      c.basedOn = c.basedOn.concat([{ id: u.id, title: nameOf(u), by: u.by, license: u.license }]);
      c.by = "";
      if (u.license !== "CC-BY-SA-4.0") c.license = u.license === "none" ? "none" : "CC-BY-SA-4.0";
      c.history = c.history.concat([{ date: today(), note: note }]);
      return c;
    }
    /* A unit started from another tool on the page (the question ladder): kept, then opened to edit */
    function startFrom(seed) {
      flush();
      var u = sanitize(Object.assign(blank(), seed || {}));
      if (!u) return false;
      u.id = newId();
      u.created = u.updated = now();
      units.unshift(u);
      writeAll();
      open(u);
      return true;
    }
    on($("#studio-example-open"), "click", function () {
      var x = EXAMPLES[Number(exampleSel.value)];
      if (!x) return;
      var c = copyOf(sanitize(x), "Copied from the example “" + x.title + "” to adapt.");
      units.unshift(c);
      writeAll();
      open(c);
      announce("Opened a copy of “" + x.title + "”. Change anything to make it yours.");
    });
    on($("#su-duplicate"), "click", function () {
      if (!current) return;
      collect();
      var c = sanitize(JSON.parse(JSON.stringify(current)));
      c.id = newId();
      c.title = (nameOf(current) + " (copy)").slice(0, 120);
      c.created = c.updated = now();
      c.history.push({ date: today(), note: "Copied from “" + nameOf(current) + "”." });
      flush();
      units.unshift(c);
      writeAll();
      open(c);
      announce("Made a copy. You're now editing the copy.");
    });
    on($("#su-delete"), "click", function () {
      if (!current) return;
      var gone = current, at = units.indexOf(gone);
      clearTimeout(saveTimer);
      saveTimer = null;
      if (at > -1) units.splice(at, 1);
      writeAll();
      close();
      $("#studio-new").focus();
      toast("Deleted “" + nameOf(gone) + "” from this device.", { timeout: 9000, actions: [{ label: "Undo", primary: true, fn: function () {
        if (!find(gone.id)) units.splice(Math.max(0, at), 0, gone);
        writeAll();
        open(gone);
      } }, { label: "OK" }] });
    });

    /* Opening a unit file (.json) or a unit web page (.html): read as data, checked by sanitize() */
    function unitFromText(text) {
      var t = text.replace(/^﻿/, "").trim(), data = null;
      if (t.charAt(0) === "{") { try { data = JSON.parse(t); } catch (e) { return null; } }
      else {
        var doc = new DOMParser().parseFromString(t, "text/html");   // inert: nothing in it runs or loads
        var block = doc.querySelector('script#aice-unit[type="application/json"]');
        if (!block) return null;
        try { data = JSON.parse(block.textContent); } catch (e) { return null; }
      }
      if (!isPlain(data) || data.format !== "ai-co-evolution-unit") return null;
      if (data.v !== 1) return { newer: true };
      return sanitize(data.unit);
    }
    var SECTIONS = [["the title and question", ["title", "subject", "question", "band", "minutes", "why"]], ["the goals", ["goals", "own"]],
      ["the evidence", ["task", "choices", "criteria"]], ["the sessions", ["plan"]], ["the supports and family note", ["supports", "family", "core", "adapt"]],
      ["the reflections and history", ["reflect", "history"]], ["the credits", ["by", "license", "basedOn"]]];
    function differences(a, b) {
      return SECTIONS.filter(function (s) { return s[1].some(function (k) { return JSON.stringify(a[k]) !== JSON.stringify(b[k]); }); }).map(function (s) { return s[0]; });
    }
    function importText(text) {
      var u = unitFromText(text);
      if (!u) { toast("That file isn't a unit from this toolkit. Unit files come from “Download the unit file” or “Save as a web page”.", { timeout: 9000 }); return; }
      if (u.newer) { toast("That unit comes from a newer version of this toolkit. Update this copy first, then open it.", { timeout: 9000 }); return; }
      flush();
      var mine = find(u.id);
      if (mine) {
        var diff = differences(mine, u);
        if (!diff.length) { open(mine); announce("You already have this unit, exactly as it is in the file."); return; }
        toast("You already have “" + nameOf(mine) + "”. The file's version differs in " + diff.join(", ") + ".", { sticky: true, actions: [
          { label: "Keep both", primary: true, fn: function () { var c = copyOf(u, "Opened from a unit file, next to my own version."); units.unshift(c); writeAll(); open(c); } },
          { label: "Replace mine", fn: function () { units[units.indexOf(mine)] = u; writeAll(); open(u); announce("Replaced with the file's version."); } },
          { label: "Cancel" }] });
        return;
      }
      var before = units.filter(function (x) { return x.basedOn.some(function (b) { return b.id === u.id; }); })[0];
      function adopt() {
        var c = copyOf(u, "Opened from a unit file to adapt: “" + nameOf(u) + "”" + (u.by ? " by " + u.by : "") + ".");
        units.unshift(c);
        writeAll();
        open(c);
        toast("Opened “" + nameOf(u) + "” as a copy to adapt. Its authors are credited in step 6." + (u.license === "none" ? " It isn't licensed for sharing, so ask them before you share your version." : ""), { timeout: 12000 });
      }
      if (before) {
        toast("You've opened this unit before, as “" + nameOf(before) + "”.", { sticky: true, actions: [
          { label: "Open that one", primary: true, fn: function () { open(before); } }, { label: "Open another copy", fn: adopt }, { label: "Cancel" }] });
        return;
      }
      adopt();
    }
    on($("#studio-import"), "change", function () {
      var input = this, file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 2 * 1048576) { toast("That file is too big to be a unit."); input.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function () { input.value = ""; importText(String(reader.result || "")); };
      reader.onerror = function () { input.value = ""; toast("Couldn't read that file."); };
      reader.readAsText(file);
    });

    /* ---------- Starting up, and keeping up with other tabs and Your data ---------- */
    function reload() {
      units = readAll();
      lastRaw = Store.raw("units");
      // Everything was deleted (under Your data, or in another tab): close the unit that was open too
      if (current && !lastRaw && find(current.id) === null && current.updated) { clearTimeout(saveTimer); saveTimer = null; current = null; editor.hidden = true; shelf.hidden = false; }
      renderList();
    }
    on(document, "aice:store", function () { if (!writing && Store.raw("units") !== lastRaw) reload(); });
    // Leaving or hiding the page saves what was typed in the last moment, too
    on(window, "pagehide", flush);
    on(document, "visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
    Resets.units = reload;
    reload();
    return { sanitize: sanitize, sanitizeAll: sanitizeAll, merge: merge, reload: reload, suggest: suggest, examples: EXAMPLES, startFrom: startFrom };
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

  /* =========================================================================
     QUESTION LADDER BUILDER (Lesson 2): any topic, or a near limitless shelf of them from Kiwix
     Four parts, each with its own job:
       Zim           reads a Kiwix library file (.zim) picked on this device;
       KiwixServer   asks the Kiwix server this page came from, when it came from one;
       LadderEngine  the rule-based ("deterministic") question builder: no chatbot, no randomness,
                     so the same article always gives the same five questions;
       the tool      wires them to the page.
     Nothing is uploaded, saved or sent anywhere: a library file stays on the device, and the only
     server ever asked is the one that served this page (the Kiwix package's own policy allows that
     and nothing else; the single file and the app don't use a server here at all).
     To change the questions, edit TEMPLATES and CARE_TEMPLATES in LadderEngine.
     ========================================================================= */
  safe("ladder", function () {
    var tool = $("#ladder-tool"), input = $("#ladder-topic"), list = $("#ladder-list");
    if (!tool || !input || !list) return;

    /* ---------- Zim: Kiwix library files, read on this device ----------
       Zim.open(file) returns a library with: meta (Title, Creator, License...), count (articles),
       suggest(text), at(position), article(entry). It follows openZIM's description of the format
       (wiki.openzim.org/wiki/ZIM_file_format) and reads only the small parts it needs, so the
       full English Wikipedia (over 100 GB with pictures) opens as quickly as a small one:
         - the 80-byte header says where everything is;
         - the path and title indexes are lists of positions, searched by halving the range;
         - an article sits in a "cluster", unpacked with fzstd (Zstandard) when it's compressed.
       Every position read from the file is checked against the file's size, so a damaged or
       unfinished file stops with a message instead of hanging or filling the memory.
       Older files compressed with xz aren't supported yet (a future extension). */
    var Zim = (function () {
      var MAGIC = 72173914, NO_PAGE = 0xFFFFFFFF, CHUNK = 512;
      var MAX_ARTICLE = 16 * 1048576;   // a bigger "article" is media or damage
      var MAX_UNPACKED = 64 * 1048576;  // the most one cluster may unpack to
      var MAX_PACKED = 32 * 1048576;    // the most read for one compressed cluster
      var decoder = new TextDecoder("utf-8"), encoder = new TextEncoder();
      function fail(kind, message) { var e = new Error(message); e.zim = kind; return e; }
      function damaged() { return fail("damaged", "This file looks damaged or unfinished. If it's still downloading, wait for it to finish; otherwise download it again."); }
      function u64(dv, at) { return dv.getUint32(at, true) + dv.getUint32(at + 4, true) * 4294967296; }
      function compare(a, b) { var n = Math.min(a.length, b.length); for (var i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }
      function startsWith(a, p) { if (a.length < p.length) return false; for (var i = 0; i < p.length; i++) if (a[i] !== p[i]) return false; return true; }
      function hex(bytes) { var s = ""; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16); return s; }
      /* A small memory of recent reads, so searching doesn't read the same parts twice */
      function Memo(limit) { this.limit = limit; this.map = new Map(); }
      Memo.prototype.get = function (k) { return this.map.get(k); };
      Memo.prototype.set = function (k, v) {
        var map = this.map;
        if (map.size >= this.limit) map.delete(map.keys().next().value);
        map.set(k, v);
        if (v && v.catch) v.catch(function () { if (map.get(k) === v) map.delete(k); });
        return v;
      };
      /* Where a Zstandard frame ends, from its block headers, without unpacking it (so whatever the
         file keeps after a cluster is never fed to the decompressor): its length, -1 if this isn't
         Zstandard, or -2 if more bytes are needed to tell. */
      function frameEnd(b) {
        if (b.length < 6) return -2;
        if (b[0] !== 0x28 || b[1] !== 0xB5 || b[2] !== 0x2F || b[3] !== 0xFD) return -1;
        var fhd = b[4], single = (fhd >> 5) & 1;
        var at = 5 + (single ? 0 : 1) + [0, 1, 2, 4][fhd & 3] + [single ? 1 : 0, 2, 4, 8][fhd >> 6];
        for (;;) {
          if (at + 3 > b.length) return -2;
          var h = b[at] | (b[at + 1] << 8) | (b[at + 2] << 16), type = (h >> 1) & 3;
          if (type === 3) return -1;
          at += 3 + (type === 1 ? 1 : h >>> 3);
          if (h & 1) break;
        }
        at += (fhd >> 2) & 1 ? 4 : 0;
        return at <= b.length ? at : -2;
      }
      function inflate(z, frame) {
        var parts = [], total = 0;
        new z.Decompress(function (chunk) {
          total += chunk.length;
          if (total > MAX_UNPACKED) throw damaged();
          parts.push(chunk.slice());
        }).push(frame, true);
        var out = new Uint8Array(total), at = 0;
        parts.forEach(function (p) { out.set(p, at); at += p.length; });
        return out;
      }

      function open(file) {
        var size = file.size;
        function read(pos, len) {
          if (!(pos >= 0 && len >= 0 && pos + len <= size)) return Promise.reject(damaged());
          return file.slice(pos, pos + len).arrayBuffer().then(function (b) { return new Uint8Array(b); });
        }
        if (size < 80) return Promise.reject(fail("not-zim", "That file isn't a Kiwix library (a .zim file)."));
        return read(0, 80).then(function (h) {
          var dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
          if (dv.getUint32(0, true) !== MAGIC) throw fail("not-zim", "That file isn't a Kiwix library (a .zim file).");
          var head = { major: dv.getUint16(4, true), minor: dv.getUint16(6, true), uuid: hex(h.subarray(8, 24)),
            entryCount: dv.getUint32(24, true), clusterCount: dv.getUint32(28, true), pathPtrPos: u64(dv, 32), titlePtrPos: u64(dv, 40),
            clusterPtrPos: u64(dv, 48), mimeListPos: u64(dv, 56), mainPage: dv.getUint32(64, true), checksumPos: u64(dv, 72) };
          if (head.major !== 5 && head.major !== 6) throw fail("version", "This Kiwix library uses a version of the format this page doesn't know (" + head.major + "). Kiwix's library offers current copies.");
          if (!head.entryCount || !head.clusterCount || head.mimeListPos < 80 || head.mimeListPos >= size ||
            head.pathPtrPos + 8 * head.entryCount > size || head.clusterPtrPos + 8 * head.clusterCount > size) throw damaged();
          return new Library(read, size, head).init();
        });
      }

      function Library(read, size, head) {
        this.read = read; this.size = size; this.head = head;
        this.ns = head.major === 6 && head.minor >= 1 ? "C" : "A";   // where articles live: "C" in newer files, "A" in older ones
        this.ptrs = new Memo(256); this.entries = new Memo(4000); this.clusters = new Memo(4); this.chunks = new Memo(256);
      }
      Library.prototype.init = function () {
        var self = this;
        return self.readMimes().then(function () {
          return Promise.all(["Title", "Description", "Language", "Creator", "Publisher", "License", "Name", "Date"].map(function (k) {
            return self.metaText(k).catch(function () { return ""; });
          }));
        }).then(function (vals) {
          self.meta = { Title: vals[0], Description: vals[1], Language: vals[2], Creator: vals[3], Publisher: vals[4], License: vals[5], Name: vals[6], Date: vals[7] };
          return self.findTitles();
        }).then(function () {
          if (!self.count) throw fail("empty", "This library has no articles this page can read.");
          return self;
        });
      };
      Library.prototype.readMimes = function () {
        var self = this, h = self.head;
        return self.read(h.mimeListPos, Math.min(65536, self.size - h.mimeListPos)).then(function (b) {
          var mimes = [], at = 0;
          for (;;) {
            var end = b.indexOf(0, at);
            if (end < 0) throw damaged();
            if (end === at) break;
            mimes.push(decoder.decode(b.subarray(at, end)));
            at = end + 1;
          }
          self.mimes = mimes;
        });
      };
      /* The position of entry i's description ("dirent"), from the path index, 512 at a time */
      Library.prototype.pointer = function (i) {
        var self = this, c = Math.floor(i / CHUNK), p = self.ptrs.get(c);
        if (!p) {
          var first = c * CHUNK, n = Math.min(CHUNK, self.head.entryCount - first);
          p = self.ptrs.set(c, self.read(self.head.pathPtrPos + 8 * first, 8 * n).then(function (b) { return new DataView(b.buffer, b.byteOffset, b.byteLength); }));
        }
        return p.then(function (dv) { return u64(dv, 8 * (i - c * CHUNK)); });
      };
      /* Entry i: its namespace, path, title, type, and where its content is (or which entry it redirects to) */
      Library.prototype.entry = function (i) {
        var self = this;
        if (!(i >= 0 && i < self.head.entryCount && Math.floor(i) === i)) return Promise.reject(damaged());
        var hit = self.entries.get(i);
        if (hit) return hit;
        return self.entries.set(i, self.pointer(i).then(function (pos) {
          function attempt(len) {
            len = Math.min(len, self.size - pos);
            if (len < 12) throw damaged();
            return self.read(pos, len).then(function (b) {
              var dv = new DataView(b.buffer, b.byteOffset, b.byteLength), mime = dv.getUint16(0, true), at;
              var e = { index: i, mime: mime, ns: String.fromCharCode(b[3]) };
              if (mime === 0xFFFF) { e.redirect = dv.getUint32(8, true); at = 12; }
              else if (mime >= 0xFFFD) at = 8;   // old "link target" and "deleted" entries: nothing to read
              else { if (len < 16) throw damaged(); e.cluster = dv.getUint32(8, true); e.blob = dv.getUint32(12, true); at = 16; }
              var z1 = b.indexOf(0, at), z2 = z1 < 0 ? -1 : b.indexOf(0, z1 + 1);
              if (z2 < 0) {
                if (len < 8192 && pos + len < self.size) return attempt(8192);
                throw damaged();
              }
              e.pathBytes = b.slice(at, z1);
              var t = b.subarray(z1 + 1, z2);
              e.titleBytes = t.length ? b.slice(z1 + 1, z2) : e.pathBytes;
              e.path = decoder.decode(e.pathBytes);
              e.title = t.length ? decoder.decode(t) : e.path;
              e.type = mime < self.mimes.length ? self.mimes[mime] : "";
              return e;
            });
          }
          return attempt(512);
        }));
      };
      /* The first entry at or after (namespace, path), searching the path index by halves */
      Library.prototype.lowerPath = function (ns, bytes) {
        var self = this, nsCode = ns.charCodeAt(0), lo = 0, hi = self.head.entryCount;
        function step() {
          if (lo >= hi) return lo;
          var mid = (lo + hi) >>> 1;
          return self.entry(mid).then(function (e) {
            if ((e.ns.charCodeAt(0) - nsCode || compare(e.pathBytes, bytes)) < 0) lo = mid + 1; else hi = mid;
            return step();
          });
        }
        return Promise.resolve().then(step);
      };
      Library.prototype.byPath = function (ns, path) {
        var self = this, bytes = encoder.encode(path);
        return self.lowerPath(ns, bytes).then(function (i) {
          if (i >= self.head.entryCount) return null;
          return self.entry(i).then(function (e) { return e.ns === ns && compare(e.pathBytes, bytes) === 0 ? e : null; });
        });
      };
      /* Where the last cluster could end: the nearest list the header knows about after it. (Not the
         old title list: newer files keep it inside a cluster, as an entry of its own.) */
      Library.prototype.lastBound = function (start) {
        var h = this.head, end = this.size;
        [h.pathPtrPos, h.clusterPtrPos, h.checksumPos].forEach(function (p) { if (p > start && p < end) end = p; });
        return end;
      };
      /* Cluster n: read straight from the file when it's stored as is, unpacked when compressed */
      Library.prototype.cluster = function (n) {
        var self = this, h = self.head;
        if (!(n >= 0 && n < h.clusterCount)) return Promise.reject(damaged());
        var hit = self.clusters.get(n);
        if (hit) return hit;
        return self.clusters.set(n, self.read(h.clusterPtrPos + 8 * n, n + 1 < h.clusterCount ? 16 : 8).then(function (b) {
          var dv = new DataView(b.buffer, b.byteOffset, b.byteLength), start = u64(dv, 0);
          var bound = n + 1 < h.clusterCount ? u64(dv, 8) : self.lastBound(start);
          if (!(start >= 80 && start < bound && bound <= self.size)) throw damaged();
          return self.read(start, 1).then(function (info) {
            var kind = info[0] & 15, wide = (info[0] & 16) !== 0;
            if (kind === 0 || kind === 1) return { file: true, at: start + 1, wide: wide, end: bound };
            if (kind === 4) throw fail("xz", "This library is compressed the older way (xz), which this page can't unpack yet. Kiwix's library has current copies of most titles.");
            if (kind !== 5) throw fail("old", "This library is compressed in a very old way this page can't unpack. Kiwix's library has current copies of most titles.");
            var from = start + 1;
            function attempt(len) {
              return self.read(from, len).then(function (packed) {
                var end = frameEnd(packed);
                if (end === -2 && len < bound - from && len < MAX_PACKED) return attempt(Math.min(bound - from, len * 4, MAX_PACKED));
                if (end < 0) throw damaged();
                return needs("FZSTD").then(function (z) {
                  var data = inflate(z, packed.subarray(0, end));
                  return { file: false, data: data, wide: wide, end: data.length };
                });
              });
            }
            return attempt(Math.min(bound - from, 1048576));
          });
        }));
      };
      /* An entry's content as a range: read(offset, length) gets part of it, all() gets all of it */
      Library.prototype.blob = function (e) {
        var self = this;
        return self.cluster(e.cluster).then(function (c) {
          var w = c.wide ? 8 : 4;
          function offsets() {
            if (!c.file) return Promise.resolve(c.data.subarray(e.blob * w, e.blob * w + 2 * w));
            return self.read(c.at + e.blob * w, 2 * w);
          }
          return (c.file ? self.read(c.at, w) : Promise.resolve(c.data.subarray(0, w))).then(function (firstB) {
            var first = new DataView(firstB.buffer, firstB.byteOffset, firstB.byteLength), count = (c.wide ? u64(first, 0) : first.getUint32(0, true)) / w - 1;
            if (!(e.blob < count)) throw damaged();
            return offsets();
          }).then(function (ob) {
            var dv = new DataView(ob.buffer, ob.byteOffset, ob.byteLength);
            var a = c.wide ? u64(dv, 0) : dv.getUint32(0, true), z = c.wide ? u64(dv, w) : dv.getUint32(w, true);
            if (!(z >= a && z <= c.end - (c.file ? c.at : 0))) throw damaged();
            return {
              length: z - a,
              read: function (off, len) {
                if (!(off >= 0 && off + len <= z - a)) return Promise.reject(damaged());
                return c.file ? self.read(c.at + a + off, len) : Promise.resolve(c.data.subarray(a + off, a + off + len));
              },
              all: function () { return this.read(0, z - a); }
            };
          });
        });
      };
      Library.prototype.metaText = function (name) {
        var self = this;
        return self.byPath("M", name).then(function (e) {
          if (!e || e.cluster === undefined) return "";
          return self.blob(e).then(function (b) { return b.length > 4096 ? "" : b.all(); }).then(function (bytes) { return bytes ? decoder.decode(bytes).trim() : ""; });
        });
      };
      /* The titles, in order: newer files keep a list of their articles ("front articles") sorted by
         title; older ones a list of every entry sorted by namespace and title. Failing both, paths. */
      Library.prototype.findTitles = function () {
        var self = this, h = self.head;
        function fromBlob(b, from, count) {
          self.order = function (k) {
            var c = Math.floor((from + k) / 1024), p = self.chunks.get(c);
            if (!p) {
              var first = c * 1024, n = Math.min(1024, (b.length >>> 2) - first);
              p = self.chunks.set(c, b.read(first * 4, n * 4).then(function (x) { return new DataView(x.buffer, x.byteOffset, x.byteLength); }));
            }
            return p.then(function (dv) { return dv.getUint32(4 * (from + k - c * 1024), true); });
          };
          self.count = count;
        }
        var listing = self.ns === "C" ? self.byPath("X", "listing/titleOrdered/v1") : Promise.resolve(null);
        return listing.then(function (e) {
          return e && e.cluster !== undefined ? self.blob(e) : null;
        }).then(function (b) {
          if (b && b.length >= 4) return fromBlob(b, 0, b.length >>> 2);
          if (h.titlePtrPos > 0 && h.titlePtrPos + 4 * h.entryCount <= self.size) {
            var titles = { length: 4 * h.entryCount, read: function (off, len) { return self.read(h.titlePtrPos + off, len); } };
            fromBlob(titles, 0, h.entryCount);
            // keep only the article namespace: find where it starts and ends
            var nsCode = self.ns.charCodeAt(0);
            function bound(after) {
              var lo = 0, hi = h.entryCount;
              function step() {
                if (lo >= hi) return lo;
                var mid = (lo + hi) >>> 1;
                return self.order(mid).then(function (i) { return self.entry(i); }).then(function (x) {
                  var d = x.ns.charCodeAt(0) - nsCode;
                  if (d < 0 || (after && d === 0)) lo = mid + 1; else hi = mid;
                  return step();
                });
              }
              return Promise.resolve().then(step);
            }
            return Promise.all([bound(false), bound(true)]).then(function (r) { fromBlob(titles, r[0], r[1] - r[0]); });
          }
          // No title list: the path index, inside the article namespace
          return Promise.all([self.lowerPath(self.ns, new Uint8Array(0)), self.lowerPath(String.fromCharCode(self.ns.charCodeAt(0) + 1), new Uint8Array(0))]).then(function (r) {
            self.order = function (k) { return Promise.resolve(r[0] + k); };
            self.count = r[1] - r[0];
            self.byPathOrder = true;
          });
        });
      };
      /* Position k in title order: its entry */
      Library.prototype.at = function (k) {
        var self = this;
        return self.order(k).then(function (i) { return self.entry(i); });
      };
      Library.prototype.resolve = function (e, hops) {
        var self = this;
        if (!e || e.redirect === undefined) return Promise.resolve(e);
        if ((hops || 0) > 8) return Promise.resolve(null);
        return self.entry(e.redirect).then(function (t) { return self.resolve(t, (hops || 0) + 1); });
      };
      function isPage(e) { return !!e && e.cluster !== undefined && /^text\/html\b/.test(e.type); }
      /* Up to `limit` articles whose titles start with the text (tried as typed, then with a capital
         first letter, and lower case), plus redirects found by path ("Global warming" leads to
         "Climate change"). Each result: { title, index, via }. */
      Library.prototype.suggest = function (text, limit) {
        var self = this, q = String(text).replace(/\s+/g, " ").trim();
        limit = limit || 12;
        if (!q) return Promise.resolve([]);
        var upper = q.charAt(0).toUpperCase() + q.slice(1), sentence = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
        var variants = [q, upper, sentence, q.toLowerCase()].filter(function (v, i, a) { return a.indexOf(v) === i; });
        var found = [], seen = {};
        function add(e, via) {
          if (!isPage(e) || seen[e.index] || found.length >= limit) return;
          seen[e.index] = true;
          found.push({ title: e.title, index: e.index, via: via && via !== e.title ? via : "" });
        }
        function byTitle(v) {
          var bytes = encoder.encode(v), lo = 0, hi = self.count;
          function step() {
            if (lo >= hi) return scan(lo, 0);
            var mid = (lo + hi) >>> 1;
            return self.at(mid).then(function (e) { if (compare(e.titleBytes, bytes) < 0) lo = mid + 1; else hi = mid; return step(); });
          }
          function scan(k, n) {
            if (k >= self.count || n >= limit * 2 || found.length >= limit) return null;
            return self.at(k).then(function (e) {
              if (!startsWith(e.titleBytes, bytes)) return null;
              return self.resolve(e).then(function (t) { add(t, e.title); return scan(k + 1, n + 1); });
            });
          }
          return Promise.resolve().then(step);
        }
        function byPath(v) {
          var bytes = encoder.encode(v.replace(/ /g, "_"));
          return self.lowerPath(self.ns, bytes).then(function scan(i, n) {
            n = n || 0;
            if (i >= self.head.entryCount || n >= limit * 2 || found.length >= limit) return null;
            return self.entry(i).then(function (e) {
              if (e.ns !== self.ns || !startsWith(e.pathBytes, bytes)) return null;
              return self.resolve(e).then(function (t) { add(t, e.title); return scan(i + 1, n + 1); });
            });
          });
        }
        var chain = Promise.resolve();
        variants.forEach(function (v) { chain = chain.then(function () { return byTitle(v); }); });
        if (!self.byPathOrder) variants.forEach(function (v) { chain = chain.then(function () { return byPath(v); }); });
        return chain.then(function () {
          // An exact match (any capitals) first; otherwise the order found: alphabetical, as typed first
          var low = q.toLowerCase();
          return found.filter(function (f) { return f.title.toLowerCase() === low; }).concat(found.filter(function (f) { return f.title.toLowerCase() !== low; }));
        });
      };
      /* An article's page: { title, path, html }. Redirects are followed; anything else (an image, a
         script, a page too big to be an article) is refused with a reason. */
      Library.prototype.article = function (index) {
        var self = this;
        return self.entry(index).then(function (e) { return self.resolve(e); }).then(function (e) {
          if (!isPage(e)) throw fail("not-page", "That entry isn't an article this page can read.");
          return self.blob(e).then(function (b) {
            if (b.length > MAX_ARTICLE) throw fail("too-big", "That article is too big to read here.");
            return b.all();
          }).then(function (bytes) { return { title: e.title, path: e.path, index: e.index, html: decoder.decode(bytes) }; });
        });
      };
      Library.prototype.mainIndex = function () { return this.head.mainPage === NO_PAGE ? -1 : this.head.mainPage; };
      return { open: open };
    })();

    /* ---------- KiwixServer: the other libraries on the Kiwix server this page came from ----------
       Only in the Kiwix package (data-host="kiwix"), served by kiwix-serve at /content/<book>/.
       Uses kiwix-serve's public endpoints, on the same server and nowhere else: the catalog
       (/catalog/v2/entries), title suggestions (/suggest), full-text search (/search) and raw pages
       (/raw/<book>/content/<path>). Tested with kiwix-serve 3.5. */
    var KiwixServer = (function () {
      if (html.getAttribute("data-host") !== "kiwix" || IS_FILE) return null;
      var m = /^(.*)\/content\/([^/]+)\//.exec(location.pathname);
      if (!m) return null;
      var root = m[1], own = safeDecode(m[2]);
      function get(url, kind) {
        var ctrl = typeof AbortController === "function" ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
        return fetch(url, { credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
          if (!r.ok) {
            var no = new Error(r.status === 404 ? "That page isn't in this library." : "The Kiwix server said no (" + r.status + ").");
            no.status = r.status;
            throw no;
          }
          return kind === "json" ? r.json() : r.text();
        }).then(function (v) { clearTimeout(timer); return v; }, function (err) {
          clearTimeout(timer);
          if (err && err.status) throw err;
          var e = new Error("The Kiwix server didn't answer. Check the connection to it, then try again.");
          e.server = true;
          throw e;
        });
      }
      function q(s) { return encodeURIComponent(s); }
      function encPath(p) { return String(p).split("/").map(function (s) { return encodeURIComponent(safeDecode(s)); }).join("/"); }
      function xml(text) { return new DOMParser().parseFromString(text, "application/xml"); }
      function books() {
        return get(root + "/catalog/v2/entries?count=500", "text").then(function (t) {
          var doc = xml(t), out = [];
          $$("entry", doc).forEach(function (en) {
            var link = $$("link", en).filter(function (l) { return /^text\/html/.test(l.getAttribute("type") || "") && /\/content\//.test(l.getAttribute("href") || ""); })[0];
            if (!link) return;
            var book = safeDecode(link.getAttribute("href").split("/content/")[1].replace(/\/.*$/, ""));
            if (!book || book === own) return;
            var pick = function (tag) { var n = en.getElementsByTagName(tag)[0]; return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; };
            out.push({ book: book, title: pick("title") || book, language: pick("language"), count: Number(pick("articleCount")) || 0, author: pick("author") });
          });
          out.sort(function (a, b) { return a.title < b.title ? -1 : a.title > b.title ? 1 : 0; });
          return out;
        });
      }
      function suggest(book, text, limit) {
        var tail = "&term=" + q(text) + "&count=" + (limit || 12);
        function parse(list) {
          if (!Array.isArray(list)) throw new Error("not a list");
          return list.filter(function (x) { return x && x.kind === "path" && typeof x.path === "string" && typeof x.value === "string"; })
            .map(function (x) { return { title: x.value, path: x.path }; });
        }
        return get(root + "/suggest?content=" + q(book) + tail, "json").then(parse).catch(function () {
          return get(root + "/suggest?books.name=" + q(book) + tail, "json").then(parse);
        });
      }
      function search(book, text, limit) {
        return get(root + "/search?content=" + q(book) + "&pattern=" + q(text) + "&format=xml&pageLength=" + (limit || 12), "text").then(function (t) {
          var prefix = "/content/" + book + "/";
          return $$("item", xml(t)).map(function (it) {
            var title = (it.getElementsByTagName("title")[0] || {}).textContent || "", link = (it.getElementsByTagName("link")[0] || {}).textContent || "";
            var at = safeDecode(link).indexOf(prefix);
            return at < 0 ? null : { title: title.trim(), path: safeDecode(link).slice(at + prefix.length) };
          }).filter(Boolean);
        });
      }
      function article(book, path) {
        return get(root + "/raw/" + q(book) + "/content/" + encPath(path), "text").catch(function () {
          return get(root + "/content/" + q(book) + "/" + encPath(path), "text");
        });
      }
      return { books: books, suggest: suggest, search: search, article: article, own: own };
    })();

    /* ---------- LadderEngine: five questions from an article, by rules you can read ----------
       analyse(html, info) reads an article: its own text (no menus, tables or references), its
       sentences, the key ideas (what it links to and repeats most), and which sentences define,
       show a cause, compare, place things in time, show a view or disagreement, show
       uncertainty, or measure something. fromWords(topic) does the same for a typed topic, with
       nothing to read. build(analysis, wording) fills the five rungs: each rung tries its
       question patterns in order and uses the first the article can support, with the sentence
       as evidence. "Another wording" starts one pattern further along. Nothing here is random,
       and nothing depends on the date, the device or its language settings. */
    var LadderEngine = (function () {
      var LABELS = ["Basic facts", "Connections", "Perspectives", "Critical analysis", "Creative synthesis"];
      var STOP = {};
      ("a about above according across after again against all almost along already also although always am among an and another any are around as at away " +
        "back be became because become becomes been before began being below between both but by called can cannot could did do does doing done down due " +
        "during each early either else end even ever every few first for found from further generally given had has have having he her here hers him his how " +
        "however i if in include included includes including into is it its itself just known large largely last later least less like made main mainly make " +
        "makes many may me might more most mostly much must my near nearly new no nor not now of off often on once one only or other others our out over own " +
        "part per perhaps rather same see several she should since so some such than that the their them then there these they this those though three " +
        "through thus to too toward towards two under until up upon us use used uses using usually various very via was way we well were what when where " +
        "whether which while who whom whose why will with within without would year years yet you your").split(" ").forEach(function (w) { STOP[w] = true; });
      var END_SECTIONS = /^(see also|references|notes|footnotes|citations|sources|bibliography|further reading|external links|works cited|gallery|notes and references|references and notes|explanatory notes|literature|links)$/i;
      var DROP = "script, style, noscript, template, link, meta, table, figure, figcaption, img, svg, audio, video, iframe, object, sup, nav, header, footer, aside, " +
        ".reference, .references, .reflist, .mw-references-wrap, .navbox, .vertical-navbox, .infobox, .sidebar, .hatnote, .metadata, .ambox, .noprint, .thumb, " +
        ".gallery, .toc, #toc, .mw-editsection, .mw-empty-elt, .shortdescription, .navigation-not-searchable, [role=note], [role=navigation], [hidden]";
      /* Cue words for each kind of sentence. Add a word to a list to widen what it catches. */
      var CUES = {
        definition: /\b(is|are|was|were|refers to|describes|means|represents|consists of|denotes|occurs when|happens when)\b/i,
        cause: /\b(because|due to|caused by|causes?|causing|leads? to|led to|results? in|resulting in|as a result|therefore|thus|so that|which means|produces?|produced|drives?|driven by|enables?|allows?|prevents?|prevented|reduces?|reducing|increases?|increasing|raises?|raising|depends? on|affects?|contributes? to|triggers?)\b/i,
        /* The clearest cause words: a sentence with one of these is preferred, and the word is the one shown */
        causeStrong: /\b(because|due to|caused by|causes?|leads? to|led to|results? in|resulting in|as a result|therefore|so that|which means|driven by|contributes? to)\b/i,
        contrast: /\b(however|whereas|unlike|in contrast|on the other hand|instead|although|compared (?:with|to)|differs?|different from)\b/i,
        time: /\b(1[0-9]{3}|20[0-9]{2})s?\b|\b(centur(?:y|ies)|decades?|originally|historically|ancient)\b/i,
        /* Words that tell a story of change: a dated sentence with one of these is history, not a statistic */
        history: /\b(first|discover\w*|propos\w*|invent\w*|founded|began|begun|introduced|named|coined|described|demonstrated|showed|shown|developed|built|adopted|signed|established|originally|historically|centur(?:y|ies)|ancient|earlier|later)\b/i,
        perspective: /\b(argues?|argued|critics?|criticism|criticized|criticised|supporters?|opponents?|oppos(?:e|ed|es|ition)|debated?|debates|controvers(?:y|ies|ial)|disagree(?:s|d|ment)?|disputed?|according to|claims?|claimed|advocates?)\b/i,
        uncertain: /\b(may|might|could|possibly|probably|likely|unlikely|uncertain(?:ty)?|unclear|unknown|estimated?|estimates|approximately|roughly|hypothes(?:is|es|ized|ised)|theor(?:y|ies)|suggests?|suggested|thought to)\b|\babout [−-]?\d/i,
        number: /\d[\d,.]*\s?(?:%|°|percent|per cent|km\b|kilomet|met(?:re|er)s?\b|kg\b|grams?\b|tonnes?\b|tons?\b|million|billion|thousand|hundred|times\b|degrees?\b|litres?\b|liters?\b|hectares?\b|people\b|species\b)/i
      };
      /* Topics that can hurt. Checked against the title and the first sentence only. */
      var CARE = /\b(suicid\w*|self[- ]harm\w*|violence|sexual (?:abuse|assault|exploitation)|rap(?:e|ed|es|ist|ists)|abuse[ds]?|genocid\w*|holocaust|massacres?|terroris\w*|tortur\w*|murder\w*|homicid\w*|lynch\w*|shootings?|war crimes?|ethnic cleansing|slavery|enslav\w*|trafficking|overdos\w*|eating disorders?|anorexia|bulimia|weapons?|bombs?|bombings?|explosives?|firearms?|guns?|executions?|wars?|battles?|invasions?|armed conflicts?)\b/i;
      /* Not for the topic of the day (searching can still find them) */
      var ADULT = /\b(porn\w*|erotic\w*|sexual intercourse|sex (?:act|acts|position|positions|work|worker|workers)|prostitut\w*|nud(?:e|ity|ism)|fetish\w*|strip(?:per|pers|tease)|brothels?)\b/i;
      /* Viewpoints for the Perspectives rung, by what the article is about */
      var DOMAINS = [
        { name: "the living world", roles: ["an ecologist", "a farmer", "a neighbour who lives nearby"], cue: /\b(species|plants?|animals?|ecosystems?|habitats?|forests?|rivers?|oceans?|soils?|climate|atmosphere|weather|cells?|organisms?|biolog\w*|ecolog\w*|environment\w*|water|carbon|planet\w*)\b/gi },
        { name: "health and the body", roles: ["a nurse", "a patient", "a researcher"], cue: /\b(health|diseases?|medic\w*|patients?|symptoms?|treatments?|hospitals?|nutrition|virus\w*|bacteri\w*|vaccin\w*|body|brain|heart)\b/gi },
        { name: "history and society", roles: ["a historian", "a person who was there", "a young person today"], cue: /\b(empires?|kings?|queens?|revolutions?|treat(?:y|ies)|dynast(?:y|ies)|colon\w*|ancient|centur(?:y|ies)|governments?|politic\w*|elections?|independence|rights)\b/gi },
        { name: "technology", roles: ["an engineer", "an everyday user", "a repair worker"], cue: /\b(computers?|software|internet|digital|devices?|machines?|engineer\w*|technolog\w*|algorithms?|electric\w*|networks?|programs?)\b/gi },
        { name: "the arts", roles: ["an artist", "an audience member", "a critic"], cue: /\b(music\w*|songs?|artists?|paint\w*|novels?|poe(?:m|ms|t|ts|try)|films?|theat(?:re|er)|danc\w*|literature|albums?|sculpt\w*)\b/gi },
        { name: "mathematics", roles: ["a mathematician", "a builder", "a student new to the idea"], cue: /\b(numbers?|equations?|theorems?|geometr\w*|algebra\w*|mathemati\w*|functions?|primes?|proofs?|calculus|statistic\w*|probabilit\w*)\b/gi },
        { name: "places", roles: ["someone who lives there", "a visitor", "a mapmaker"], cue: /\b(city|cities|towns?|villages?|country|countries|regions?|provinces?|capital|islands?|mountains?|valleys?|population|located)\b/gi }
      ];
      var DEFAULT_ROLES = ["a scientist", "an artist", "a community elder"];

      function clean(t) {
        return String(t || "").replace(/ /g, " ")
          .replace(/\[(?:\d+|[a-z]|note \d+|nb \d+|citation needed|clarification needed|when\?|who\?|which\?|by whom\?|according to whom\?|dubious[^\]]*|failed verification|better source needed)\]/gi, "")
          .replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
          .replace(/([\p{Ll}\)\]])([.!?])(\p{Lu}\p{Ll})/gu, "$1$2 $3")   // "bleaching.The ocean": two sentences run together
          .trim();
      }
      function upperFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
      function countIn(textLower, phraseLower) {
        if (!phraseLower) return 0;
        var m = textLower.match(new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(phraseLower) + "(?=$|[^\\p{L}\\p{N}])", "gu"));
        return m ? m.length : 0;
      }
      function stem(phrase) {
        return phrase.toLowerCase().replace(/(\w)ies$/, "$1y").replace(/(s|x|ch|sh)es$/, "$1").replace(/([^s])s$/, "$1");
      }
      /* Sentences, by rule: a full stop, question or exclamation mark followed by a space and a
         capital letter or digit ends one, unless the word before it is a common abbreviation or an
         initial ("Dr.", "e.g.", "J."). */
      var ABBR = /^(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|st|mt|jr|sr|no|nos|fig|figs|approx|ca|c|cf|al|inc|ltd|co|corp|gen|gov|sen|rep|rev|sgt|capt|lt|col|vol|pp|ed|eds|[a-z])\.$|^(?:[a-z]\.){2,}$/i;
      function sentences(text) {
        var words = text.split(" "), out = [], cur = [];
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          if (!w) continue;
          cur.push(w);
          var next = words[i + 1];
          if (next && /[.!?]["”’')\]]*$/.test(w) && /^["“‘'(\[]?[\p{Lu}\p{N}]/u.test(next) && !ABBR.test(w.replace(/["”’')\]]+$/, ""))) {
            out.push(cur.join(" "));
            cur = [];
          }
        }
        if (cur.length) out.push(cur.join(" "));
        return out;
      }
      /* A link's address that stays inside the library (not another website, not this page) */
      function internal(href) { return !!href && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href); }
      function licenseIn(doc) {
        var a = $$("a[href*='creativecommons.org/']", doc)[0];
        if (!a) return "";
        var m = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(a.getAttribute("href"));
        if (m) return "CC " + m[1].toUpperCase() + " " + m[2];
        return /publicdomain\/zero/i.test(a.getAttribute("href")) ? "CC0" : "";
      }
      /* Kiwix marks its own "this article is from…" box with <!--htdig_noindex--> comments; drop it */
      function dropMarked(doc) {
        var walker = doc.createTreeWalker(doc.body || doc, 128), starts = [];
        while (walker.nextNode()) if (/^\s*htdig_noindex\s*$/.test(walker.currentNode.nodeValue)) starts.push(walker.currentNode);
        starts.forEach(function (c) {
          var n = c.nextSibling;
          while (n && !(n.nodeType === 8 && /^\s*\/htdig_noindex\s*$/.test(n.nodeValue))) { var next = n.nextSibling; n.remove(); n = next; }
        });
      }
      /* Plurals, for "A landmine is…" (the topic becomes "landmines"): the common rules, and the
         common words that break them */
      var IRREGULAR = { person: "people", child: "children", man: "men", woman: "women", mouse: "mice", foot: "feet", tooth: "teeth", goose: "geese",
        sheep: "sheep", deer: "deer", fish: "fish", species: "species", series: "series", crisis: "crises", analysis: "analyses", thesis: "theses",
        hypothesis: "hypotheses", phenomenon: "phenomena", criterion: "criteria", cactus: "cacti", fungus: "fungi", nucleus: "nuclei", radius: "radii",
        ox: "oxen", leaf: "leaves", loaf: "loaves", wolf: "wolves", knife: "knives", life: "lives", wife: "wives", shelf: "shelves", half: "halves",
        calf: "calves", thief: "thieves", volcano: "volcanoes", potato: "potatoes", tomato: "tomatoes", hero: "heroes", echo: "echoes", torpedo: "torpedoes" };
      function plural(phrase) {
        var m = /^(.*?)(\p{L}+)$/u.exec(phrase);
        if (!m) return phrase;
        var w = m[2], low = w.toLowerCase(), p;
        if (IRREGULAR[low]) p = w.charAt(0) === low.charAt(0) ? IRREGULAR[low] : upperFirst(IRREGULAR[low]);
        else if (/[^aeiou]y$/.test(low)) p = w.slice(0, -1) + "ies";
        else if (/(s|x|z|ch|sh)$/.test(low)) p = w + "es";
        else p = w + "s";
        return m[1] + p;
      }
      /* Does a typed topic look plural? ("fractions" yes; "physics", "news", "gas" no) */
      var SINGULAR_S = /(ss|us|is|as|os|ics|ness|news|lens|means|series|species|measles|mumps)$/i;
      function looksPlural(t) {
        var last = (/(\p{L}+)$/u.exec(t) || [])[1] || "";
        return /^\p{Ll}/u.test(last) && /s$/.test(last) && !SINGULAR_S.test(last) && last.length > 3;
      }
      /* "Surface heating" at the start of a sentence is "surface heating" in the middle of one. A single
         capitalized word stays capitalized only if the article also capitalizes it mid-sentence
         ("Jupiter"); with no sign either way it becomes lower case ("Pollination is…": pollination). */
      function natural(t, textAll) {
        if (!/^\p{Lu}\p{Ll}/u.test(t)) return t;
        var low = t.charAt(0).toLowerCase() + t.slice(1);
        if (textAll.indexOf(" " + low) >= 0) return low;
        if (/\s/.test(t)) return t;
        return new RegExp("[\\p{Ll},;:)] " + escapeRe(t) + "(?![\\p{L}])", "u").test(textAll) ? t : low;
      }

      function analyse(htmlText, info) {
        info = info || {};
        var doc = new DOMParser().parseFromString(String(htmlText), "text/html");
        var license = licenseIn(doc);
        dropMarked(doc);
        $$("math, .mwe-math-element", doc).forEach(function (n) { n.replaceWith(doc.createTextNode(" (formula) ")); });
        $$(DROP, doc).forEach(function (n) { n.remove(); });
        var root = doc.querySelector("#mw-content-text, main, article, [role=main]") || doc.body;
        var h1 = doc.querySelector("h1");
        var title = clean(info.title) || clean(h1 && h1.textContent) || clean(doc.title) || "this topic";
        var blocks = [], links = [], section = "", skipping = false, lead = true, bold = "";
        var BLOCKS = "h2, h3, h4, p, li, dd, blockquote";
        if (root) $$(BLOCKS, root).forEach(function (n) {
          if (/^H[2-4]$/.test(n.tagName)) {
            var h = clean(n.textContent);
            if (n.tagName === "H2") skipping = END_SECTIONS.test(h);
            if (!skipping) section = h;
            lead = false;
            return;
          }
          if (skipping) return;
          var up = n.parentElement && n.parentElement.closest("p, li, dd, blockquote");
          if (up && root.contains(up)) return;   // counted with the block around it
          var text = clean(n.textContent);
          if (text.length < 25 || !/\p{L}/u.test(text)) return;
          var linkText = $$("a", n).reduce(function (sum, a) { return sum + clean(a.textContent).length; }, 0);
          if (n.tagName === "LI" && (text.length < 60 || linkText / text.length > 0.6)) return;   // menus and "see also" lists
          if (lead && !bold && n.tagName === "P") { var b = n.querySelector("b, strong"); if (b) bold = clean(b.textContent); }
          $$("a[href]", n).forEach(function (a) {
            var t = clean(a.textContent);
            if (internal(a.getAttribute("href")) && t.length >= 3 && t.length <= 60 && /\p{L}/u.test(t)) links.push({ text: t, lead: lead });
          });
          blocks.push({ text: text, section: section, lead: lead });
        });
        var all = [];
        blocks.forEach(function (b) {
          if (all.length < 2000) sentences(b.text).forEach(function (s) { all.push({ text: s, section: b.section, lead: b.lead }); });
        });
        var textAll = " " + blocks.map(function (b) { return b.text; }).join(" ") + " ";
        var an = { title: title, path: info.path || "", library: info.library || "", license: license || info.license || "", creator: info.creator || "",
          sentences: all, links: links, bold: bold, text: textAll, lower: textAll.toLowerCase(), article: true };
        an.leadText = all.filter(function (s) { return s.lead; }).map(function (s) { return s.text; }).join(" ");
        an.first = (all[0] && all[0].text) || "";
        finish(an);
        return an;
      }
      function fromWords(topic) {
        var t = String(topic || "").replace(/\s+/g, " ").trim() || "this topic";
        var an = { title: t, topic: t, sentences: [], links: [], bold: "", text: " " + t + " ", lower: " " + t.toLowerCase() + " ", leadText: "", first: "", article: false, library: "", license: "" };
        finish(an);
        return an;
      }
      /* What the rungs need: the topic in the article's own words, key ideas, care, viewpoints */
      function finish(an) {
        an.topic = topicPhrase(an);
        an.is = an.plural ? "are" : "is";
        an.does = an.plural ? "do" : "does";
        an.its = an.plural ? "their" : "its";
        an.it = an.plural ? "them" : "it";
        an.pointer = /\bmay (?:also )?refer to\b/i.test(an.leadText);   // a page that only points to other pages
        an.care = CARE.test(an.title) || CARE.test(an.first);
        an.adult = ADULT.test(an.title) || ADULT.test(an.leadText.slice(0, 1200));
        an.ideas = an.article ? keyIdeas(an) : [];
        var probe = an.title + " " + an.leadText.slice(0, 1500), best = null;
        DOMAINS.forEach(function (d) {
          var n = (probe.match(d.cue) || []).length;
          if (n >= 2 && (!best || n > best.n)) best = { d: d, n: n };
        });
        an.domain = best ? best.d.name : "";
        an.roles = best ? best.d.roles : DEFAULT_ROLES;
      }
      /* The article's own words for its topic: the bold term in its first paragraph, with "the"
         when the article says "The greenhouse effect occurs…"; otherwise the title, in lower case
         only when the article itself writes it that way. */
      function topicPhrase(an) {
        var first = an.first, b = an.bold;
        // The bold term counts only when it's a name for the title's subject (it shares a word with the title)
        var titleWords = an.title.toLowerCase().split(/\s+/).map(stem);
        var shares = b && b.toLowerCase().split(/\s+/).some(function (w) { return !STOP[w] && titleWords.indexOf(stem(w)) > -1; });
        if (b && shares && b.length <= 80 && first.indexOf(b) >= 0) {
          var at = first.indexOf(b), before = first.slice(0, at).trim(), after = first.slice(at + b.length);
          if (/^(a|an)$/i.test(before)) { an.plural = true; return plural(b); }   // "A landmine is…": landmines
          an.plural = /^\s+(are|were|have)\b/.test(after);
          if (/^the$/i.test(before)) return "the " + b;
          return before === "" ? natural(b, an.text) : b;
        }
        var t = an.title, low = t.charAt(0).toLowerCase() + t.slice(1);
        an.plural = !an.article && looksPlural(t);
        if (an.article && low !== t && countIn(an.text, low) > countIn(an.text, t) - 1 && countIn(an.text, low) > 0) return low;
        return t;
      }
      /* Words that rarely make good key ideas on their own (they're fine inside a phrase) */
      var WEAK = {};
      ("process example number people study studies trend trends change changes result results effect effects level levels rate rates part parts " +
        "case cases type types form forms kind kinds area areas world time times period periods average amount amounts system systems group groups " +
        "role roles term terms fact facts range relationship relationships ways lack source sources reason reasons idea ideas needs order line lines " +
        "point points side sides place places value values total size provide provides include includes become becomes emit emits increase " +
        "increases reduce reduces affect affects require requires contain contains produce produces allow allows makes take takes give gives " +
        "show shows called known began begin like within around million millions billion billions thousand thousands hundred hundreds percent " +
        "per cent whole number numbers").split(" ").forEach(function (w) { WEAK[w] = true; });
      var VERBISH = /(?:ed|ing|ly|ize|ise|izes|ises)$/;
      var NUMBER_WORD = /^(?:millions?|billions?|thousands?|hundreds?|percent|cent|dozens?|half|third|quarter)$/;
      var BE = /^(?:is|are|was|were|be|been|being|has|have|had|will|would|can|could|may|might|should|must|do|does|did)$/;
      /* Link texts are sometimes a phrase from a sentence ("regularly report", "United States withdrew"); these words give that away */
      var NOT_NOUN = /^(?:regularly|usually|mostly|largely|mainly|nearly|recently|rapidly|directly|highly|widely|generally|especially|increasingly|slightly|significantly|strongly|commonly|typically|currently|formally|officially|withdrew|began|became|made|took|gave|grew|rose|fell|led|left|found|held|kept|brought|built|sent|spent|won|lost|paid|said|told|met|ran|saw|wrote|chose|drew|flew|threw|broke|spoke|stood|struck|sought|taught|thought|caught|bought|fought|report|reports|agreed|announced|joined)$/i;
      /* Key ideas: what the article links to (its writers' own choice of key terms) and the words and
         two-word phrases it repeats. A phrase counts for more than the words inside it ("carbon
         dioxide", not "carbon"), linked ideas count for more than unlinked ones, and earlier wins ties. */
      function keyIdeas(an) {
        var cands = new Map(), topicStem = stem(an.title), topicWords = {};
        an.title.toLowerCase().split(/\s+/).forEach(function (w) { topicWords[stem(w)] = true; });
        stem(an.topic).split(/\s+/).forEach(function (w) { topicWords[w] = true; });
        var topicLow = an.topic.toLowerCase().replace(/^the\s+/, "");
        function add(t, linked, lead, order) {
          t = t.replace(/\s*\([^)]*\)/g, "").replace(/^(?:the|a|an)\s+/i, "").replace(/["“”'’(),.;:]+$/g, "").replace(/^["“‘'(]+/, "").replace(/\s+/g, " ").trim();
          var words = t.toLowerCase().split(/\s+/);
          if (t.length < 3 || t.length > 50 || words.length > 4 || !/\p{L}/u.test(t) || /\d/.test(t)) return;
          if (words.every(function (w) { return STOP[w] || WEAK[w]; })) return;
          if (words.some(function (w) { return NOT_NOUN.test(w) || NUMBER_WORD.test(w) || BE.test(w); }) || (words.length > 1 && VERBISH.test(words[words.length - 1]) && !/ing$/.test(words[words.length - 1]))) return;
          if (words.slice(0, -1).some(function (w) { return /ly$/.test(w) && w.length > 5; }) || /\b\p{L}+ed by\b/u.test(t)) return;   // "primarily caused by humans"
          if (words.length > 1 && countIn(" " + words.join(" ") + " ", topicLow)) return;   // "deforestation and climate change" on Deforestation
          if (words.length === 1 && (STOP[words[0]] || WEAK[words[0]] || words[0].length < 4 || topicWords[stem(words[0])] || (!linked && VERBISH.test(words[0])))) return;
          var key = stem(t);
          if (key === topicStem || key === stem(an.topic)) return;
          if (words.length === 1 && countIn(an.lower, "to " + words[0]) && countIn(an.lower, "to " + words[0]) === countIn(an.lower, words[0])) return;   // "to evaporate": a verb
          var c = cands.get(key);
          if (!c) cands.set(key, { text: natural(t, an.text), linked: linked, lead: lead, order: order, words: words.length });
          else { c.linked = c.linked || linked; c.lead = c.lead || lead; }
        }
        an.links.slice(0, 150).forEach(function (l, i) { add(l.text, true, l.lead, i); });
        // Repeated words, and pairs of words that sit side by side in the same clause
        var pairs = new Map(), singles = new Map(), at = 0;
        an.sentences.forEach(function (s) {
          s.text.split(/[,;:()\[\]"“”–—]+/).forEach(function (clause) {
            var toks = (clause.match(/\p{L}[\p{L}\p{N}'’-]*/gu) || []).map(function (w) { return { w: w, l: w.toLowerCase() }; });
            toks.forEach(function (t, i) {
              at++;
              if (STOP[t.l] || t.l.length < 3) return;
              var one = singles.get(t.l);
              if (one) one.n++; else singles.set(t.l, { n: 1, raw: t.w, at: at, lead: s.lead });
              var u = toks[i + 1];
              if (u && !STOP[u.l] && u.l.length >= 3) {
                var k = t.l + " " + u.l, p = pairs.get(k);
                if (p) p.n++; else pairs.set(k, { n: 1, raw: t.w + " " + u.w, at: at, lead: s.lead });
              }
            });
          });
        });
        // The 40 most repeated of each, earlier first, so long articles stay quick
        function top(map, min, minLen) {
          var arr = [];
          map.forEach(function (v, k) { if (v.n >= min && k.length >= minLen) arr.push(v); });
          return arr.sort(function (x, y) { return y.n - x.n || x.at - y.at; }).slice(0, 40);
        }
        top(pairs, 2, 7).forEach(function (p) { add(p.raw, false, p.lead, 1000 + p.at); });
        top(singles, 3, 5).forEach(function (one) { add(one.raw, false, one.lead, 100000 + one.at); });
        var list = [];
        cands.forEach(function (c) { c.n = countIn(an.lower, c.text.toLowerCase()) || countIn(an.lower, stem(c.text)); list.push(c); });
        // A word counts only where it isn't part of a longer idea ("carbon" in "carbon dioxide")
        list.forEach(function (c) {
          if (c.words > 1) return;
          var w = c.text.toLowerCase(), inside = 0;
          list.forEach(function (o) { if (o.words > 1 && countIn(" " + o.text.toLowerCase() + " ", w)) inside += o.n; });
          c.n = Math.max(0, c.n - inside);
        });
        list = list.filter(function (c) { return c.n > 0 || c.linked; }).map(function (c) {
          return { text: c.text, n: c.n, linked: c.linked, order: c.order,
            score: Math.min(c.n, c.words > 1 ? 8 : 5) + (c.linked ? 4 : 0) + (c.lead ? 1.5 : 0) + (c.words > 1 ? 1.5 : 0) };
        });
        list.sort(function (x, y) { return y.score - x.score || x.order - y.order || (x.text < y.text ? -1 : x.text > y.text ? 1 : 0); });
        var out = [];
        function content(t) { return t.toLowerCase().split(/\s+/).filter(function (w) { return !STOP[w]; }).map(stem); }
        list.forEach(function (c) {
          var lc = c.text.toLowerCase(), mine = content(c.text);
          if (out.length >= 8 || out.some(function (o) {
            var lo = o.text.toLowerCase(), theirs = content(o.text);
            // one inside the other, or two content words in common ("carbon dioxide emissions" and "atmospheric carbon dioxide levels")
            return countIn(" " + lo + " ", lc) || countIn(" " + lc + " ", lo) || mine.filter(function (w) { return theirs.indexOf(w) > -1; }).length >= 2;
          })) return;
          out.push(c);
        });
        return out;
      }
      /* The best sentence of a kind that no earlier rung has used: the most cue words and key
         ideas, the lead section, and earlier sentences first. */
      function bestFor(kind, an, used) {
        var best = null, n = an.sentences.length;
        an.sentences.forEach(function (s, i) {
          if (used[i] || s.text.length < 40 || s.text.length > 420 || !/^["“‘'(]?[\p{Lu}\p{N}]/u.test(s.text) || /\bmay (?:also )?refer to\b/i.test(s.text)) return;
          if (/:$/.test(s.text) || /•|\b(?:license|version|last updated|stewarded by)\s*:/i.test(s.text)) return;   // list openers and credit lines aren't evidence
          if (kind === "definition" && i > 0) return;
          var m = CUES[kind].exec(s.text);
          if (!m) return;
          var story = kind === "time" && CUES.history.test(s.text);
          if (kind === "time" && !story && CUES.number.test(s.text)) return;   // a dated statistic belongs to "number"
          var strong = kind === "cause" && CUES.causeStrong.exec(s.text);
          var lower = s.text.toLowerCase();
          var ideas = an.ideas.slice(0, 5).filter(function (k) { return lower.indexOf(k.text.toLowerCase()) >= 0; }).length;
          var score = 3 + (strong || story ? 2 : 0) + ideas + (s.lead ? 1 : 0) - i / (n + 1);
          var cue = (strong || m)[0].trim();
          if (/^about\b/i.test(cue)) cue = "about";   // "about 15 °C": an estimate
          if (!best || score > best.score) best = { i: i, s: s, cue: cue, score: score };
        });
        return best;
      }
      function shorten(t) {
        if (t.length <= 260) return t;
        var cut = Math.max(t.lastIndexOf("; ", 240), t.lastIndexOf(", ", 240));
        if (cut < 120) cut = t.lastIndexOf(" ", 240);
        return t.slice(0, cut).replace(/[,;:]$/, "") + " …";
      }
      function sourceName(an) { return an.library ? "“" + an.title + "” in " + an.library : "“" + an.title + "”"; }

      /* Question patterns, tried in order on each rung. need(an) says whether the article can
         support it; kind names the sentence it quotes as evidence (none for the others). */
      function I(an, k) { return an.ideas[k] ? an.ideas[k].text : ""; }
      var TEMPLATES = [
        [ // Basic facts
          { id: "define", kind: "definition", ask: function (an) { return "What " + an.is + " " + an.topic + "? Say how the article describes " + an.it + ", in your own words."; }, why: function (an) { return "The article's first sentence says what " + an.topic + " " + an.is + "."; } },
          { id: "parts", need: function (an) { return an.ideas.length >= 2; }, ask: function (an) { return "What " + an.is + " " + an.topic + ", and how do " + I(an, 0) + " and " + I(an, 1) + " fit in?"; }, why: function (an) { return "“" + I(an, 0) + "” and “" + I(an, 1) + "” are the ideas this article links to and repeats most."; } },
          { id: "rank", need: function (an) { return an.ideas.length >= 3; }, ask: function (an) { return "Which matters most for understanding " + an.topic + ": " + I(an, 0) + ", " + I(an, 1) + " or " + I(an, 2) + "? Why?"; }, why: function () { return "Ranking key ideas makes learners say what each one does."; } },
          { id: "basic", ask: function (an) { return "What " + an.is + " " + an.topic + ", and what are " + an.its + " key parts?"; }, why: function () { return "Starts with what it is and what it's made of."; } },
          { id: "explain", ask: function (an) { return "How would you explain " + an.topic + " to someone younger than you?"; }, why: function () { return "Explaining to a younger learner shows what you really understand."; } }
        ],
        [ // Connections
          { id: "cause", kind: "cause", ask: function () { return "What leads to what in this sentence, and what would change if one part were different?"; }, why: function (an, ev) { return "This sentence links a cause and an effect (it says “" + ev.cue + "”)."; } },
          { id: "link", need: function (an) { return an.ideas.length >= 2; }, ask: function (an) { return "How are " + I(an, 0) + " and " + I(an, 1) + " connected? Draw the link and label it."; }, why: function () { return "Two key ideas from the article; joining them builds a map of the topic."; } },
          { id: "studied", ask: function (an) { return "How " + an.does + " " + an.topic + " connect to other things we've studied, or to life in our community?"; }, why: function () { return "Links new learning to what learners already know."; } },
          { id: "place", ask: function (an) { return "Where could we notice " + an.topic + " in our own lives, our community or the land around us?"; }, why: function () { return "Grounds the topic in places learners know."; } }
        ],
        [ // Perspectives
          { id: "views", kind: "perspective", ask: function () { return "Who might see this differently, and what evidence would each side point to?"; }, why: function (an, ev) { return "This sentence shows a view, a claim or a disagreement (it says “" + ev.cue + "”)."; } },
          { id: "history", kind: "time", ask: function (an) { return "How have ideas about " + an.topic + " changed over time, and who changed them?"; }, why: function (an, ev) { return "This sentence places " + an.topic + " in time (" + ev.cue + ")."; } },
          { id: "roles", ask: function (an) { return "How might " + an.roles[0] + ", " + an.roles[1] + " and " + an.roles[2] + " each see " + an.topic + " differently?"; }, why: function (an) { return an.domain ? "Three viewpoints that fit a topic about " + an.domain + "." : "Three different ways of knowing: science, art and lived experience."; } }
        ],
        [ // Critical analysis
          { id: "sure", kind: "uncertain", ask: function () { return "How sure can we be about this? What evidence would change our minds?"; }, why: function (an, ev) { return "“" + ev.cue + "” is a sign that something here is estimated, uncertain or debated."; } },
          { id: "number", kind: "number", ask: function () { return "Where might this number come from, and how could someone check it?"; }, why: function () { return "A measurement invites the question: how was it measured, and by whom?"; } },
          { id: "compare", kind: "contrast", ask: function () { return "What's being compared here, and is the comparison fair?"; }, why: function (an, ev) { return "This sentence compares or contrasts (it says “" + ev.cue + "”)."; } },
          { id: "source", need: function (an) { return an.article; }, ask: function (an) { return "This comes from " + sourceName(an) + ". What might it leave out, and where else could we look to check?"; }, why: function () { return "Every source has an angle. Checking another one is how lateral reading starts."; } },
          { id: "assume", ask: function (an) { return "What assumptions sit underneath the way " + an.topic + " " + an.is + " usually taught or explained?"; }, why: function () { return "Looks underneath the usual explanation."; } }
        ],
        [ // Creative synthesis
          { id: "make", need: function (an) { return an.ideas.length >= 2; }, ask: function (an) { var k = an.ideas.length >= 3 ? 1 : 0; return "Make a drawing, a model or a short story that brings together " + I(an, k) + " and " + I(an, k + 1) + ". What does it show about " + an.topic + "?"; }, why: function () { return "Making something from two key ideas shows how they fit together."; } },
          { id: "whatif", need: function (an, used) { return !!bestFor("cause", an, {}); }, ask: function (an) { return "Invent a “what if” for " + an.topic + ": change one cause, and trace what might happen next."; }, why: function () { return "The article describes causes, so learners can imagine changing one."; } },
          { id: "care", ask: function (an) { return "How could understanding " + an.topic + " help a community care for people and places better?"; }, why: function () { return "A regenerative lens: knowledge in service of care."; } },
          { id: "justice", ask: function (an) { return "If you explained " + an.topic + " through the lens of fairness or justice, what connections would you make?"; }, why: function () { return "Asks who is helped, who is harmed, and what would be fair."; } }
        ]
      ];
      /* For topics that can hurt: understanding, care and prevention, on every rung */
      var CARE_TEMPLATES = [
        [
          { id: "care-source", need: function (an) { return an.article; }, kind: "definition", ask: function (an) { return "What does this source say about " + an.topic + ", and which words does it choose?"; }, why: function () { return "Begins with what the source says, carefully, before any opinions."; } },
          { id: "care-know", ask: function (an) { return "What do we already know about " + an.topic + ", and where did we learn it?"; }, why: function () { return "Starts from what learners bring, so nobody is surprised."; } },
          { id: "care-facts", ask: function (an) { return "Which facts about " + an.topic + " are most important to get right, and why?"; }, why: function () { return "Care with facts is a way of respecting the people affected."; } }
        ],
        [
          { id: "care-heal", ask: function (an) { return "What helps people and communities stay safe, heal or rebuild when it comes to " + an.topic + "?"; }, why: function () { return "Focuses on safety, care and repair."; } },
          { id: "care-repair", ask: function () { return "Who has worked to prevent harm or to repair it, and what did they do?"; }, why: function () { return "Looks for the helpers and what they did."; } }
        ],
        [
          { id: "care-voices", ask: function (an) { return "Whose voices are heard in what we read about " + an.topic + ", and whose are missing?"; }, why: function () { return "Asks who gets to tell the story."; } },
          { id: "care-tell", ask: function () { return "How might people who lived through it, and people who study it, tell this story differently?"; }, why: function () { return "Respects lived experience alongside study."; } }
        ],
        [
          { id: "care-words", ask: function (an) { return "How does the way " + an.topic + " " + an.is + " written about shape how we feel? What is said carefully, and what is left out?"; }, why: function () { return "Looks at wording and framing, not graphic detail."; } },
          { id: "care-trust", ask: function (an) { return "Which sources would you trust most for " + an.topic + ", and why?"; }, why: function () { return "Weighs sources without dwelling on harm."; } }
        ],
        [
          { id: "care-prevent", ask: function (an) { return "What could a community do to prevent harm, or to support people affected by " + an.topic + "?"; }, why: function () { return "Turns understanding toward prevention and support."; } },
          { id: "care-remember", ask: function (an) { return "How can we remember " + an.topic + " in a way that honours the people affected?"; }, why: function () { return "Remembering with dignity."; } }
        ]
      ];
      function build(an, wording) {
        var sets = an.care ? CARE_TEMPLATES : TEMPLATES, used = {}, rungs = [];
        function usable(t, taken) {
          if (t.need && !t.need(an, taken)) return null;
          if (!t.kind) return { t: t, ev: null };
          var ev = bestFor(t.kind, an, taken);
          return ev ? { t: t, ev: ev } : null;
        }
        // How many wordings there are: the most patterns any rung can use. Wording numbers go round, so
        // pressing "Another wording" that many times always comes back to the first.
        var most = Math.max.apply(null, sets.map(function (options) { return options.filter(function (t) { return usable(t, {}); }).length; }).concat([1]));
        wording = Math.max(0, Math.floor(wording || 0)) % most;
        // Rungs choose their evidence in this order, so the rarer kinds (views, uncertainty) get first pick
        [0, 2, 3, 1, 4].forEach(function (r) {
          var ok = sets[r].map(function (t) { return usable(t, used); }).filter(Boolean);
          var pick = ok[wording % ok.length];
          if (pick.ev) used[pick.ev.i] = true;
          var text = pick.t.ask(an, pick.ev);
          rungs[r] = { label: LABELS[r], text: upperFirst(text), why: pick.t.why(an, pick.ev), rule: pick.t.id,
            evidence: pick.ev ? { text: shorten(pick.ev.s.text), section: pick.ev.s.section } : null };
        });
        return { rungs: rungs, wording: wording, wordings: most };
      }
      function suitable(an) {
        if (!an || an.care || an.adult) return false;
        if (/^(lists? of|index of|outline of|timeline of|glossary of)\b/i.test(an.title) || /\(disambiguation\)$/i.test(an.title)) return false;
        if (/\bmay (?:also )?refer to\b/i.test(an.leadText)) return false;
        return an.leadText.length >= 160 && an.sentences.length >= 3;
      }
      /* A unit's big question: open, standing on its own, and pointed at care for people and places */
      function bigQuestion(an) {
        var t = an.care ? CARE_TEMPLATES[1][0] : TEMPLATES[4][2];
        return upperFirst(t.ask(an));
      }
      return { analyse: analyse, fromWords: fromWords, build: build, suitable: suitable, bigQuestion: bigQuestion, labels: LABELS };
    })();

    /* ---------- The tool ---------- */
    var details = $("#ladder-kiwix"), fileInput = $("#ladder-file"), libStatus = $("#ladder-lib"), finder = $("#ladder-finder");
    var search = $("#ladder-search"), results = $("#ladder-results"), dayBtn = $("#ladder-day"), nextBtn = $("#ladder-next"), insideBtn = $("#ladder-inside");
    var serverRow = $("#ladder-server"), bookSel = $("#ladder-book"), sourceEl = $("#ladder-source"), sourceText = $("#ladder-source-text"), careEl = $("#ladder-care");
    var wordingBtn = $("#ladder-wording"), wordingN = $("#ladder-wording-n"), ideasWrap = $("#ladder-ideas-wrap"), ideasEl = $("#ladder-ideas"), planBtn = $("#ladder-plan");
    var items = $$("li", list);
    var nf = new Intl.NumberFormat();
    var state = { lib: null, analysis: LadderEngine.fromWords(input.value), ladder: null, wording: 0, day: 0, ticket: 0, books: null };

    function render() {
      var an = state.analysis, ladder = (state.ladder = LadderEngine.build(an, state.wording));
      state.wording = ladder.wording;
      ladder.rungs.forEach(function (r, i) {
        var li = items[i];
        if (!li) return;
        $(".rung", li).textContent = r.label;
        $(".rung-q", li).textContent = r.text;
        var more = $(".rung-more", li);
        if (!more) {
          more = el("details", "rung-more");
          var sum = el("summary", null, "Why this question");
          sum.appendChild(el("span", "sr-only", " (" + r.label + ")"));
          more.appendChild(sum);
          more.appendChild(el("p", "rung-why small"));
          li.appendChild(more);
        }
        $(".rung-why", more).textContent = r.why;
        var q = $(".rung-quote", more);
        if (r.evidence) {
          if (!q) { q = el("blockquote", "rung-quote small"); more.appendChild(q); }
          q.textContent = "“" + r.evidence.text + "”" + (r.evidence.section ? " (" + r.evidence.section + ")" : "");
        } else if (q) q.remove();
      });
      wordingN.textContent = "Wording " + (ladder.wording + 1) + " of " + ladder.wordings;
      wordingBtn.disabled = ladder.wordings < 2;
      careEl.hidden = !an.care;
      sourceEl.hidden = !an.article;
      if (an.article) sourceText.textContent = "Built from " + sourceLine(an) + ".";
      ideasWrap.hidden = !an.ideas.length;
      ideasEl.textContent = an.ideas.map(function (k) { return k.text; }).join(" · ");
      planBtn.hidden = !Studio || !Studio.startFrom;
    }
    function sourceLine(an) {
      return "“" + an.title + "”" + (an.library ? " in " + an.library : "") + (an.license ? " (text: " + an.license + ")" : "");
    }
    /* Typed topics: the patterns that need no article, on every keystroke */
    on(input, "input", function () {
      state.ticket++;
      state.analysis = LadderEngine.fromWords(input.value);
      state.wording = 0;
      render();
    });
    on($("#ladder-own"), "click", function () {
      state.analysis = LadderEngine.fromWords(input.value);
      state.wording = 0;
      render();
      input.focus();
    });
    on(wordingBtn, "click", function () {
      state.wording++;
      render();
      announce("Wording " + (state.ladder.wording + 1) + " of " + state.ladder.wordings + ".");
    });

    /* ---------- Libraries: a file on this device, or the Kiwix server ---------- */
    function libName(lib) { return lib.title || "this library"; }
    function setStatus(msg) { libStatus.textContent = msg; }
    function busy(isBusy) {
      tool.setAttribute("aria-busy", isBusy ? "true" : "false");
      [dayBtn, nextBtn, insideBtn].forEach(function (b) { b.disabled = isBusy || (b === nextBtn && !state.dayPicked); });
    }
    function ready(lib) {
      state.lib = lib;
      state.day = 0;
      state.dayPicked = false;
      finder.hidden = false;
      insideBtn.hidden = lib.kind !== "server";
      results.textContent = "";
      search.value = "";
      busy(false);
      setStatus(summary(lib) + " Search its titles, or try the topic of the day.");
    }
    function summary(lib) { return libName(lib) + (lib.count ? ": " + nf.format(lib.count) + " articles." : "."); }
    function failMessage(err) { return err && err.message ? err.message : "Something went wrong reading the library."; }
    on(fileInput, "change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!f) return;
      var ticket = ++state.ticket;
      finder.hidden = true;
      setStatus("Opening " + f.name + "…");
      Zim.open(f).then(function (z) {
        if (ticket !== state.ticket) return;
        var m = z.meta;
        ready({ kind: "file", zim: z, key: z.head.uuid, title: m.Title || f.name.replace(/\.zim$/i, ""), count: z.count, license: m.License || "", creator: m.Creator || "" });
      }).catch(function (err) {
        if (ticket !== state.ticket) return;
        setStatus(failMessage(err));
      });
    });
    /* Results: one button per article */
    function showResults(found, query, inside) {
      results.textContent = "";
      results.setAttribute("data-query", (inside ? "inside:" : "") + query);   // which search these results answer
      found.forEach(function (f) {
        var li = el("li"), b = el("button", "chip", f.title);
        b.type = "button";
        if (f.via) { b.title = f.via + " leads here"; b.appendChild(el("span", "sr-only", " (from " + f.via + ")")); }
        on(b, "click", function () { choose(f); });
        li.appendChild(b);
        results.appendChild(li);
      });
      var msg = found.length ? (found.length === 1 ? "1 topic" : found.length + " topics") + (inside ? " mention “" : " start with “") + query + "”." :
        (inside ? "No articles mention “" : "No titles start with “") + query + "”." + (!inside && state.lib.kind === "server" ? " Try “Search inside articles”." : "");
      announce(msg);
    }
    var searchTimer = null;
    on(search, "input", function () {
      clearTimeout(searchTimer);
      var query = search.value.replace(/\s+/g, " ").trim(), ticket = ++state.ticket;
      results.textContent = "";   // old results go at once, so nobody picks one by mistake
      results.removeAttribute("data-query");
      if (query.length < 2 || !state.lib) return;
      searchTimer = setTimeout(function () {
        var lib = state.lib;
        (lib.kind === "file" ? lib.zim.suggest(query, 12) : KiwixServer.suggest(lib.book, query, 12)).then(function (found) {
          if (ticket === state.ticket) showResults(found, query, false);
        }).catch(function (err) { if (ticket === state.ticket) setStatus(failMessage(err)); });
      }, 250);
    });
    on(insideBtn, "click", function () {
      var query = search.value.replace(/\s+/g, " ").trim(), ticket = ++state.ticket;
      if (query.length < 2) { search.focus(); setStatus("Type a word or two to search for first."); return; }
      KiwixServer.search(state.lib.book, query, 12).then(function (found) {
        if (ticket === state.ticket) showResults(found, query, true);
      }).catch(function (err) { if (ticket === state.ticket) setStatus(failMessage(err)); });
    });
    /* Reading one article: from the file, or from the server */
    function fetchArticle(lib, f) {
      if (lib.kind === "file") return lib.zim.article(f.index);
      return KiwixServer.article(lib.book, f.path).then(function (h) { return { title: f.title, path: f.path, html: h }; });
    }
    function analyseFrom(lib, page) {
      return LadderEngine.analyse(page.html, { title: page.title, path: page.path, library: lib.title, license: lib.license, creator: lib.creator });
    }
    function show(an, how) {
      state.analysis = an;
      state.wording = 0;
      input.value = an.title.slice(0, 60);
      render();
      announce((how ? how + ": " : "") + "the ladder is built from “" + an.title + "”" + (an.care ? ", with questions for a topic that can hurt" : "") + ".");
    }
    function choose(f) {
      var lib = state.lib, ticket = ++state.ticket;
      busy(true);
      setStatus("Reading “" + f.title + "”…");
      fetchArticle(lib, f).then(function (page) {
        if (ticket !== state.ticket) return;
        busy(false);
        var an = analyseFrom(lib, page);
        setStatus(an.pointer ? "“" + page.title + "” only points to other pages, so these questions are general. Search for the one you mean." : summary(lib));
        show(an);
      }).catch(function (err) {
        if (ticket !== state.ticket) return;
        busy(false);
        setStatus(failMessage(err));
      });
    }
    /* Topic of the day: the same for everyone with the same library on the same day */
    function hash(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
    function todayKey() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    /* Broad starting words for the server, where there's no list to count through */
    var SEEDS = ["Water", "Energy", "Forest", "River", "Soil", "Ocean", "Bird", "Tree", "Bridge", "Music", "Language", "Number", "Light", "Sound",
      "Weather", "Food", "Seed", "Bee", "Mountain", "Island", "Map", "Garden", "Moon", "Star", "Volcano", "Desert", "Wind", "Salt", "Paper", "Clock",
      "Wheel", "Bread", "Rain", "Cloud", "Fish", "Insect", "Fungus", "Rice", "Cotton", "Glass", "Iron", "Copper", "Electricity", "Magnet", "Planet", "Coral", "Wetland", "Pollination"];
    function pickDay(n) {
      var lib = state.lib, ticket = ++state.ticket, date = todayKey(), seed = hash(date + "|" + lib.key + "|" + n), tries = 0;
      busy(true);
      setStatus("Finding " + (n ? "topic " + (n + 1) + " of the day" : "the topic of the day") + "…");
      function next(j) {
        if (ticket !== state.ticket) return null;
        if (j >= 16) throw new Error("No suitable topic turned up today. Try searching instead.");
        var step;
        if (lib.kind === "file") {
          var k = (seed + j * 7919) % lib.count;
          step = lib.zim.at(k).then(function (e) { return lib.zim.resolve(e); }).then(function (e) {
            if (!e || e.cluster === undefined || !/^text\/html\b/.test(e.type)) return null;
            return lib.zim.article(e.index);
          });
        } else {
          var word = SEEDS[(seed + j) % SEEDS.length];
          step = KiwixServer.suggest(lib.book, word, 12).then(function (found) {
            if (!found.length) return null;
            var f = found[(seed >>> 8) % found.length];
            return fetchArticle(lib, f);
          });
        }
        return step.then(function (page) {
          tries++;
          if (!page) return next(j + 1);
          var an = analyseFrom(lib, page);
          return LadderEngine.suitable(an) ? an : next(j + 1);
        }, function (err) {
          // A broken file or a silent server stops the search; one unreadable page just skips ahead
          if (err && (err.server || (err.zim && err.zim !== "not-page"))) throw err;
          return next(j + 1);
        });
      }
      Promise.resolve().then(function () { return next(0); }).then(function (an) {
        if (!an || ticket !== state.ticket) return;
        busy(false);
        state.dayPicked = true;
        nextBtn.disabled = false;
        var label = n ? "Topic " + (n + 1) + " of the day" : "Topic of the day";
        setStatus(label + " (" + date + "): “" + an.title + "” in " + libName(lib) + ".");
        show(an, label);
      }).catch(function (err) {
        if (ticket !== state.ticket) return;
        busy(false);
        setStatus(failMessage(err));
      });
    }
    on(dayBtn, "click", function () { state.day = 0; pickDay(0); });
    on(nextBtn, "click", function () { state.day++; pickDay(state.day); });

    /* The server's other libraries, asked for only when someone opens this part */
    if (KiwixServer) {
      var useBook = function () {
        var b = state.books && state.books[Number(bookSel.value)];
        if (b) ready({ kind: "server", book: b.book, key: b.book, title: b.title, count: b.count, license: "", creator: b.author });
      };
      on(details, "toggle", function () {
        if (!details.open || state.books) return;
        state.books = [];
        setStatus("Asking this Kiwix server which libraries it has…");
        KiwixServer.books().then(function (books) {
          state.books = books;
          if (!books.length) { setStatus("This Kiwix server has no other libraries yet. Add one (Wikipedia, for example) next to this toolkit, or open a library file."); return; }
          serverRow.hidden = false;
          bookSel.textContent = "";
          books.forEach(function (b, i) {
            var o = el("option", null, b.title + (b.count ? " (" + nf.format(b.count) + " articles)" : ""));
            o.value = String(i);
            bookSel.appendChild(o);
          });
          var wiki = books.findIndex(function (b) { return /wikipedia/i.test(b.book + " " + b.title); });
          bookSel.value = String(wiki > -1 ? wiki : 0);
          useBook();
        }).catch(function () {
          state.books = null;
          setStatus("This Kiwix reader doesn't share its other libraries with pages. Open a library file instead.");
        });
      });
      on(bookSel, "change", useBook);
    }

    /* ---------- Copy, print, and plan a unit ---------- */
    function ladderText() {
      var an = state.analysis, lines = ["Question ladder: " + an.title];
      state.ladder.rungs.forEach(function (r, i) {
        lines.push((i + 1) + ". " + r.label + ": " + r.text);
        if (r.evidence) lines.push("   From the article: “" + r.evidence.text + "”");
      });
      if (an.article) lines.push("Source: " + sourceLine(an) + ". Credit the source when you share quotes.");
      lines.push("Made with the question ladder in AI Co-Evolution in Education (rules, not a chatbot; wording " + (state.ladder.wording + 1) + ").");
      return lines.join("\n");
    }
    on($("#ladder-copy"), "click", function () {
      copyText(ladderText()).then(function (ok) { toast(ok ? "Copied the ladder." : "Couldn't copy. Select the questions and copy them yourself."); });
    });
    on($("#ladder-print"), "click", function () {
      var an = state.analysis, box = el("div", "ladder-print"), ol = el("ol");
      box.appendChild(el("h2", null, "Question ladder: " + an.title));
      state.ladder.rungs.forEach(function (r) {
        var li = el("li");
        li.appendChild(el("p", null, r.label + ": " + r.text));
        if (r.evidence) li.appendChild(el("blockquote", null, "“" + r.evidence.text + "”"));
        ol.appendChild(li);
      });
      box.appendChild(ol);
      if (an.article) box.appendChild(el("p", "small", "Source: " + sourceLine(an) + "."));
      if (an.care) box.appendChild(el("p", "small", "A topic that can hurt: read the source first, tell learners before you start, and make sure they know who they can talk to."));
      if (Printer) Printer.print(box, { title: "Question ladder", note: "AI Co-Evolution in Education · Lesson 2: The curious questioner" });
    });
    on(planBtn, "click", function () {
      if (!Studio || !Studio.startFrom) return;
      var an = state.analysis;
      var ok = Studio.startFrom({
        title: upperFirst(an.title).slice(0, 120),
        question: LadderEngine.bigQuestion(an).slice(0, 200),
        plan: [{ title: ("Climb the question ladder: " + an.title).slice(0, 160), stage: "together", routine: "think-pair-share", ai: 1, aiWhy: "", notes: ladderText().slice(0, 2000) }],
        history: [{ date: todayKey(), note: "Started from the question ladder" + (an.article ? " on " + sourceLine(an) : " on “" + an.title + "”") + "." }]
      });
      if (ok) announce("A new unit on “" + an.title + "” is open in the curriculum studio, with the ladder as its first session.");
    });
    function upperFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    render();
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
    /* Inside another page, printing may be blocked. The browser then ignores print() silently,
       so watch for "beforeprint", which only happens when the print window really opens. */
    var printStarted = false;
    on(window, "beforeprint", function () { printStarted = true; foundBlocked.modals = false; });
    function blocked() {
      cleanup();
      toast("Printing is blocked by " + HOST_NAME + ". To print, open the toolkit's own file in a web browser.", { timeout: 12000 });
    }
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var fn = function (e) { if (!e.matches) cleanup(); };
      if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn);
    }
    function print(target, opts) {
      if (!target) return;
      opts = opts || {};
      cleanup();
      var allowed = hostAllows("modals");
      if (allowed === false) { blocked(); return; }
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
      printStarted = false;
      try { window.print(); } catch (e) { cleanup(); }
      if (allowed === null) setTimeout(function () { if (!printStarted) { foundBlocked.modals = true; blocked(); } }, 1000);
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
    neverSubmits(form);
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
      if (family && (family.translated() || family.busy())) family.reset("The agreement changed, so its translation was removed. Translate again when it's ready.");
    }
    /* Every family's language: translate the agreement on this device, beside the English */
    var family = translatePanel({
      root: function () { return preview; }, select: $("#agreement-tr-lang"), go: $("#agreement-tr-go"), stop: $("#agreement-tr-stop"),
      clear: $("#agreement-tr-clear"), copy: $("#agreement-tr-copy"), status: $("#agreement-tr-status"), note: $("#agreement-tr-note")
    });
    if (family) family.prepare();
    function asText() {
      var lines = [TITLES[state.band], (state.name ? state.name + ". " : "") + SUBS[state.band], ""];
      var lang = preview.getAttribute("data-translated");
      chosen().forEach(function (t) { lines.push("- " + t); });
      lines.push("", "“" + PLEDGE[state.band] + "”", "", "Student name: ____________________   Signature and date: ____________________", "Teacher: ____________________   Date: ____________________", "", "Made with the AI Co-Evolution in Education agreement builder.");
      // A family-language translation, when there is one, follows the English
      if (lang && Translate) lines.push("", "----", "Machine translation into " + Translate.englishName(lang) + ", made on this device. Ask someone fluent to check it.", "", Translate.textOf(preview));
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
    neverSubmits(form);
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
    neverSubmits(form);
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
    neverSubmits(form);
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
    neverSubmits(form);
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

  /* Everything this toolkit keeps, as the text of a data file ("Download all as JSON") */
  function allData() {
    var data = {};
    Store.keys().forEach(function (k) { if (k !== "schema") data[k] = Store.get(k, null); });
    return JSON.stringify({ format: "ai-co-evolution-data", schema: DATA_SCHEMA, exported: new Date().toISOString(), page: "AI Co-Evolution in Education " + APP_VERSION, data: data }, null, 2);
  }

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
              if (Library) Library.removeSaved().then(function () { toast("Saved library documents deleted."); }, function () { toast("Couldn't delete the saved documents. Try again."); });
            } else if (c.kind === "extras") {
              caches.delete(c.name).then(function () { toast("Saved tool helpers deleted. They'll be fetched again if a tool needs them."); announceCaches(); }, function () { toast("Couldn't delete the saved tool helpers. Try again."); });
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
    on(exportBtn, "click", function () { download("ai-co-evolution-my-data.json", allData(), "application/json"); });
    on($("#data-export-locked"), "click", function () { if (LockUI) LockUI.lock($("#data-export-locked")); });
    on(document, "aice:store", render);
    on(document, "aice:caches", render);
    render();
  });

  /* ---------- WORKSPACE: bring your data from another device, and keep tabs in step ----------
     Import reads a file made by "Download all as JSON" on this device only, checks every item
     (CHECKS below: only items this toolkit knows, in the right shape, not too big), converts
     older files (MIGRATIONS), and shows what will happen before anything changes. The notebook
     and your units are combined; other items replace what's here. Other tabs: when another tab of this toolkit
     saves something, the browser tells this tab (the "storage" event) and it catches up.
     To make a new saved item importable, add a check for it to CHECKS. */
  var Workspace = safe("workspace", function () {
    var input = $("#data-import"), dialog = $("#import-dialog"), rows = $("#import-rows"), plan = null;
    var LIMIT = 5 * 1048576, ITEM_LIMIT = 1048576;
    function str(v, max) { return typeof v === "string" && v.length <= max; }
    var CHECKS = {
      settings: function (v) {
        if (!isPlain(v)) return;
        var out = {};
        Object.keys(v).slice(0, 30).forEach(function (k) { if (/^[a-z]{1,20}$/i.test(k) && (typeof v[k] === "boolean" || str(v[k], k === "voice" ? 200 : 20))) out[k] = v[k]; });
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
      notebook: function (v) { return Notes.sanitize(v) || undefined; },
      units: function (v) { return Studio ? Studio.sanitizeAll(v) : undefined; },
      practice: function (v) {
        if (!isPlain(v) || !isPlain(v.cards)) return;
        var date = function (x) { return typeof x === "string" && x.length <= 40 && !isNaN(Date.parse(x)); };
        var out = { v: 1, perDay: [3, 5, 10].indexOf(v.perDay) > -1 ? v.perDay : 5, today: str(v.today, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v.today) ? v.today : "",
          newToday: Number.isInteger(v.newToday) && v.newToday >= 0 && v.newToday <= 100 ? v.newToday : 0, cards: {} };
        Object.keys(v.cards).slice(0, 500).forEach(function (id) {
          var c = v.cards[id];
          if (!/^[a-z]-[a-z0-9-]{1,70}$/.test(id) || !isPlain(c) || !date(c.due) || (c.last_review !== undefined && !date(c.last_review))) return;
          var nums = ["stability", "difficulty", "elapsed_days", "scheduled_days", "learning_steps", "reps", "lapses", "state"];
          if (!nums.every(function (k) { return c[k] === undefined && k === "elapsed_days" || (typeof c[k] === "number" && isFinite(c[k]) && c[k] >= 0 && c[k] < 1e6); })) return;
          var card = { due: c.due };
          nums.forEach(function (k) { card[k] = c[k] === undefined ? 0 : c[k]; });
          if (c.last_review) card.last_review = c.last_review;
          out.cards[id] = card;
        });
        return out;
      }
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
        if (Locker && Locker.isLocked(parsed)) { if (LockUI) LockUI.unlock(parsed, input); return; }   // a locked file: ask for its passphrase first
        take(parsed);
      };
      reader.onerror = function () { input.value = ""; toast("Couldn't read that file."); };
      reader.readAsText(file);
    });
    function take(parsed) {
      var p = makePlan(parsed);
      if (p.error) toast(p.error); else show(p);
    }
    on($("#import-go"), "click", function () {
      if (!plan) return;
      var done = 0;
      plan.items.forEach(function (it) {
        var box = document.getElementById("imp-" + it.key);
        if (!box || !box.checked) return;
        var ok = it.key === "notebook" ? Notes.merge(it.value) : it.key === "units" && Studio ? Studio.merge(it.value) : Store.set(it.key, it.value);
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
    return { take: take };
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
        ? "This copy isn't on a website (it's a file on this device, or a preview of one), so there's no link that would open anywhere else. To share it, send the file itself: it works offline in any web browser. Or publish the toolkit on a website (see the README) and share that link."
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
      download("ai-co-evolution-qr-code.svg", new XMLSerializer().serializeToString(svgNow), "image/svg+xml", { picture: true });
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
        box.appendChild(el("p", "callout-title", "To read the library here, open the single-file edition"));
        box.appendChild(el("p", null, "Browsers don't let a page read its neighbouring files when it's opened straight from a folder or shown in a preview. The single-file edition (ai-co-evolution-in-education.html, in the download folder) has the whole library inside it, or you can serve this folder as a website (see the README)."));
        if (location.protocol === "file:") {   // from a folder the neighbouring file can at least be opened; in a preview there's nothing to link to
          var a = el("a", "btn btn-secondary btn-small", "Open the single-file edition");
          a.href = "download/ai-co-evolution-in-education.html";
          box.appendChild(a);
        }
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
          var ok = !!have[(pageAddress(docUrl(m)) || {}).href];
          if (ok) n++;
          var badge = listEl ? listEl.querySelector('[data-doc="' + m.id + '"] .lib-saved') : null;
          if (badge) badge.hidden = !ok;
        });
        var info = { saved: n, total: index.documents.length, search: !!have[(pageAddress(searchUrl(index)) || {}).href], bytes: libraryBytes(index) };
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
        msg === "file" ? "Browsers don't let a page read its neighbouring files when it's opened straight from a folder or shown in a preview. The single-file edition has the whole library inside it." :
        msg === "offline" ? "This document isn't saved on this device yet, and you're offline. Connect once and it will be, or use “Save the whole library” next time you're online." :
        "Something went wrong while opening it. Please try again."));
      var row = el("div", "tool-actions");
      if (msg === "file") {
        if (location.protocol === "file:") {
          var f = el("a", "btn btn-secondary btn-small", "Open the single-file edition");
          f.href = "download/ai-co-evolution-in-education.html";
          row.appendChild(f);
        }
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
      }, function () { /* no list of documents here: the reader simply shows no previous/next links */ });
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
      if (docTranslate) docTranslate.reset("");
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
      if (docTranslate) { docTranslate.stop(); closeTranslate(false); }
      if (Translate) Translate.release();
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
    /* ---- Every family's language: translate the open document on this device ----
       The bar under the header picks a language; each part's translation is added under it
       (see Translate above). Your own files are first checked for their language. */
    var trBar = $("#reader-translate"), trBtn = $("#reader-translate-btn");
    var docTranslate = trBar ? translatePanel({
      root: function () { return docEl; }, select: $("#tr-lang"), go: $("#tr-go"), stop: $("#tr-stop"), clear: $("#tr-clear"),
      copy: $("#tr-copy"), status: $("#tr-status"), note: $("#tr-note"),
      source: function () { return current && current.local && Translate ? Translate.detect(docEl.textContent || "") : "en"; }
    }) : null;
    function openTranslate() {
      if (!docTranslate) return;
      trBar.hidden = false;
      trBtn.setAttribute("aria-expanded", "true");
      docTranslate.prepare(true);
      var sel = $("#tr-lang");
      (sel && !sel.disabled ? sel : $("#tr-close")).focus();
    }
    function closeTranslate(returnFocus) {
      if (!trBar || trBar.hidden) return;
      trBar.hidden = true;
      trBtn.setAttribute("aria-expanded", "false");
      if (returnFocus) trBtn.focus();
    }
    if (trBtn && !docTranslate) trBtn.hidden = true;
    on(trBtn, "click", function () { if (trBar.hidden) openTranslate(); else closeTranslate(true); });
    on($("#tr-close"), "click", function () { closeTranslate(true); });
    on(trBar, "keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeTranslate(true); } });

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
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible" || !featureAllowed("screen-wake-lock")) { presentStatus(); return; }
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
        if (frame.requestFullscreen && !document.fullscreenElement && document.fullscreenEnabled !== false && featureAllowed("fullscreen")) {
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
      return IS_FILE && BUILD === "pwa" ? "This copy was opened from a folder or a preview, so it can't read the library. Use the single-file edition." :
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
      if (!swOk) set("app", IS_FILE ? "Not available when the page is opened from a folder or shown in a preview. Use the single-file edition, or serve the folder as a website (see the README)." : "This browser can't keep an offline copy of this page.");
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
      var scope = (pageAddress("./") || {}).href, jobs = [];
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
      }, function () { toast("Your browser didn't answer. Try again later."); });
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
