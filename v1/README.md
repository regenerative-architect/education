# AI Co-Evolution in Education: the app

> Not to replace teachers, but to walk beside them. Not to accelerate standardization, but to ignite curiosity.

An open, offline-first toolkit for teaching with AI while protecting student voice, wellbeing and privacy. This repository holds the toolkit as an **installable web app** and as a **single HTML file**, both with the full library of 29 guides, lesson plans and templates from the project's education repository, an **AI Lab** that shows how language models read and write, and a **private notebook**. The library also comes as an e-book, as Markdown files and as a package for the Kolibri offline learning platform.

It has no trackers, analytics, cookies, ads or accounts, and it keeps working without internet.

---

## What's in this folder

| Folder or file | What it is | Who it's for |
|---|---|---|
| `site/` | The app: the page, its styles and scripts, the library, and the service worker that makes it work offline. This is what gets published. | Everyone (it's the website) |
| `site/download/ai-co-evolution-in-education.html` | The single-file edition: one file with everything inside, including the library. | Anyone without reliable internet, or who wants to pass it on by USB stick or email |
| `site/download/` (the other files) | The library as an e-book (EPUB), as Markdown files to adapt (zip), and as a package for the Kolibri offline learning platform (zip). | Readers, teachers who adapt materials, schools that use Kolibri |
| `tools/` | Small scripts that rebuild the library, copy in the open-source libraries, make the single file and the downloads, version the app, and check it for privacy and broken links. `tools/tests/` uses the app in a real browser. | Maintainers |
| `docs/REPOSITORIES.md` | A field guide to the open-source projects this toolkit uses, links to, or left for later, and how they were chosen. | Maintainers, and anyone choosing tools for their own project |
| `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` | How we treat each other, how to contribute, and how to report a problem privately. The first two are made from the library's own versions. | Contributors |
| `.github/` | Automatic checks and publishing, plus friendly forms for sharing lessons, classroom stories and bug reports. | Maintainers and contributors |
| `LICENSE`, `LICENSE-NOTES.md`, `THIRD-PARTY-NOTICES.md` | The license, a plain-language summary with notes for the steward, and credits for the open-source parts. | Everyone |

---

## Use it today: three ways

### 1. Open the single file (no setup at all)

Open `site/download/ai-co-evolution-in-education.html` in any modern browser. Everything works, including the library, search and the classroom tools. It never connects to the internet; only links you choose to open do. Copy it to a USB stick or a shared drive to pass it on.

### 2. Publish it free on GitHub Pages (about five minutes)

1. Create a new repository on GitHub, for example `education-app`.
2. Put the contents of this folder in it, keeping the folder structure, **including the hidden `.github` folder**. The simplest way is git:
   ```bash
   git init
   git add .
   git commit -m "AI Co-Evolution in Education app 2.2"
   git branch -M main
   git remote add origin https://github.com/<your-account>/education-app.git
   git push -u origin main
   ```
   GitHub Desktop works too. (Dragging files into the GitHub website can skip the hidden `.github` folder.)
3. In the repository, open **Settings → Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. When "Check and publish" finishes, the app is live at `https://<your-account>.github.io/education-app/`.

From then on, every change you push is checked and published automatically. Installed copies on people's devices offer the update; they're never forced.

### 3. Run it on your own computer

```bash
python3 -m http.server 8080 --directory site
```

Then open <http://localhost:8080>. (Opening `site/index.html` by double-clicking works for the page and tools, but browsers don't let a page read its neighbouring files that way, so the library points you to the single-file edition instead.)

### Take the library somewhere else

In `site/download/` (and under **Take the library with you** in the app):

- **`ai-co-evolution-library.epub`**: an e-book for e-readers and reading apps (Apple Books, Kobo, Thorium, Calibre), with a table of contents and accessibility information. Checked with the W3C's EPUBCheck on every change.
- **`ai-co-evolution-library-markdown.zip`**: every document as a Markdown file to adapt in any editor, links between them kept. Callouts use GitHub's alert syntax, which Obsidian understands too. Each document in the reader also has **Download as Markdown**.
- **`ai-co-evolution-kolibri.zip`**: the single-file edition as an HTML5 app for [Kolibri](https://learningequality.org/kolibri/), the free offline learning platform. In Kolibri Studio, add it to a channel as an HTML5 app. It's tested in a strict sandbox like Kolibri's but **not yet on a real Kolibri server**; inside Kolibri, outside links show their addresses, and Kolibri may keep what the tools save with each learner's account on the school's server.

---

## Install it like an app

Once it's on a website:

- **Chrome or Edge on a computer:** use the **Install** button at the top of the page, or the install icon in the address bar.
- **Android:** browser menu (⋮) → **Install app** or **Add to home screen**.
- **iPhone or iPad:** in Safari, **Share** → **Add to Home Screen**.
- **Firefox on a computer:** doesn't install web apps; use the single-file edition or a pinned tab.

The installed app opens without internet. Under **Offline and install** you can save the whole library (about 1.7 MB), ask the browser to keep it safe from automatic clean-up, check for updates, or remove everything from the device. On computers with Chrome or Edge, the installed app can also open `.md` files directly ("Open with").

---

## Privacy and zero harm

- **Nothing is tracked.** No analytics, no cookies, no accounts, no ads, no third-party files of any kind.
- **A strict content security policy on every page.** The app may load only its own files from the site it came from. The single-file edition may load nothing at all.
- **Your work stays on your device.** Everything a tool saves, including your private notebook, is listed under **Your data on this device**, with a delete button for each item and one to delete everything (including the offline copy). To move to another device, download it as one file and import it there; you see what's in the file before anything changes.
- **The AI Lab runs here too.** The token counter, the next-word model and the training-data comparison all run in the browser. There's no chatbot, nothing you type is sent anywhere, and the models only know the library's own text.
- **The library is cleaned.** Building it removes email addresses, phone numbers, contact links, retired accounts and badge images, and the build stops if any slip back in.
- **The check runs on every change.** `tools/check-site.mjs` blocks publishing if it finds tracking code, files from other websites, personal contact details, a missing security policy, or broken links.

**Zero Harm and Anti-Coercion.** This toolkit never pressures, tracks, ranks or manipulates anyone. Every tool is optional, works without AI, and keeps data on the device. Nothing in it may be used to surveil, shame, exclude or coerce students, teachers or families. If any part of it causes harm, stop, check in with the people affected, and help repair it.

---

## What works offline

| | Installable app | Single file |
|---|---|---|
| The page and every tool | After the first visit | Always |
| Library documents | Each one after you open it once, or all of them with "Save the whole library" | Always (they're inside the file) |
| Search across the page and library | After the library's search index is saved (it's saved with the library, or the first time you search) | Always |
| Present mode, print, QR codes, opening your own Markdown files | Yes | Yes (QR codes need a website address to point to) |
| Download a document as Markdown | Yes | Yes |
| The AI Lab | Yes, once the token counter has been used online (about 1 MB, then saved) | Always (it's inside the file) |
| Find in a document, your notebook, moving your data | Yes | Yes |
| The e-book, Markdown and Kolibri downloads | Downloading them needs internet; once downloaded they're yours | Listed on the website version |
| Links to other websites | Need internet | Need internet |

---

## For maintainers

You'll need [Node.js](https://nodejs.org) 22.22 or newer for the library build, the downloads and the tests (`cd tools && npm ci` installs their exact pinned versions). `build-standalone`, `stamp-sw` and `check-site` work with Node.js 18 or newer and need no installation.

### Rebuild the library from the education repository

```bash
cd tools
npm ci                                                   # installs the exact pinned versions
node build-library.mjs ../../education ../site/library   # path to your copy of the education repository
cd ..
node tools/build-standalone.mjs                          # refresh the single file
node tools/build-downloads.mjs                           # the e-book, Markdown and Kolibri downloads
node tools/stamp-sw.mjs                                  # give the app a new version
node tools/check-site.mjs                                # the zero-harm check
```

To add or rename a library document, edit the `CATALOG` list at the top of `tools/build-library.mjs`. To keep a link that the build removes, or remove one it keeps, edit the `UNLINK` list beside it.

The library build is also a privacy gate. It removes email addresses, phone numbers and personal links from the documents, keeps only listed public crisis helplines, and refuses to finish if anything personal is left. A retired username it has to remove is stored only as a fingerprint (a SHA-256 hash), so the tools never spell out what they're removing; `node tools/build-library.mjs --fingerprint "a name"` makes one. Rebuilding unchanged documents gives byte-for-byte identical files, including the e-book and zip downloads.

### Change the app

The app is plain files you can read and edit: `site/index.html` (the page), `site/assets/app.css` (styles) and `site/assets/app.js` (the tools). Every major part starts with a comment saying what it does and how to extend it. After changing anything, run `build-standalone`, `build-downloads`, `stamp-sw` and `check-site` as above. (The publish workflow also runs them for you.)

### Test it

```bash
cd tools
npm ci && npx playwright install chromium   # once
npm test                                    # everything, in a real browser (a few minutes)
```

The tests use the app the way people do: installing, offline use, the library and reader, every tool on the page, accessibility (axe-core, WCAG 2.2 A and AA), HTML validation, and every download. `tools/tests/README.md` explains each file. To include the e-book check, download [EPUBCheck](https://github.com/w3c/epubcheck/releases) and set `EPUBCHECK_JAR` to its `epubcheck.jar`. A weekly workflow (`.github/workflows/links.yml`) also checks every outside link and opens an issue if any break.

### Update the open-source libraries

The app never loads code from a CDN. The exact versions in `tools/package.json` are copied into `site/vendor/` with their licenses:

```bash
cd tools
npm install marked@<new-version>    # or another library
node vendor.mjs                     # copies it in (turndown and gpt-tokenizer are bundled with esbuild)
cd ..
node tools/build-standalone.mjs && node tools/build-downloads.mjs
node tools/stamp-sw.mjs && node tools/check-site.mjs
cd tools && npm test                # then update the version in THIRD-PARTY-NOTICES.md
```

Dependabot (`.github/dependabot.yml`) opens a pull request each month when a GitHub Action or one of the test tools (Playwright, axe-core, html-validate) has a new version, and the whole test suite runs on it. The libraries copied into the site stay manual on purpose, so each update gets the steps above.

### How it fits together

```
site/
├── index.html              the page (with <!-- build:… --> markers for the single-file build)
├── manifest.webmanifest    name, icons, shortcuts and file handling for installing
├── sw.js                   service worker: saves the app, serves it offline, offers updates
├── offline.html            shown when you're offline and a page isn't saved
├── 404.html                for addresses that don't exist (GitHub Pages)
├── assets/                 app.css, app.js, boot.js, fonts, icons, screenshots
├── vendor/                 MiniSearch, marked, DOMPurify, qrcode-generator, turndown, gpt-tokenizer, and their licenses
├── library/                index.json, search.json and docs/*.html (built from the education repository)
└── download/               the single-file edition, the e-book, the Markdown zip and the Kolibri package
tools/
├── build-library.mjs       Markdown → clean, private HTML library (+ search index), with a privacy check
├── vendor.mjs              copies (or bundles, with esbuild) the pinned open-source libraries into site/vendor
├── build-standalone.mjs    makes the single file from site/
├── build-downloads.mjs     makes the e-book, the Markdown zip, the Kolibri package and the community files
├── make-epub-cover.mjs     draws the e-book cover (tools/assets/epub-cover.jpg); run it only to change the cover
├── stamp-sw.mjs            versions the service worker from a fingerprint of its files
├── check-site.mjs          the zero-harm and broken-link check
└── tests/                  the test suite (Playwright, axe-core, html-validate, EPUBCheck)
```

- **Service worker.** On install it saves the app shell (the files listed in `PRECACHE` in `sw.js`). Big helpers that only one tool needs (the `EXTRAS` list, like the AI Lab's token counter) are saved the first time that tool is used. Library documents are saved as they're read, or all at once on request. Each document's address carries a fingerprint of its text (`docs/<id>.html?v=<hash>`), so only changed documents are fetched again, and outdated copies are removed when a new version starts. A new version waits for the reader's "Update now".
- **Two editions from one source.** `build-standalone.mjs` swaps each marked part of `index.html` for an inline version (styles with embedded fonts, scripts, and the library as JSON), and switches to a policy that blocks all network requests.
- **Search.** MiniSearch builds a full-text index in the browser from the page and the library (`library/search.json`, or the documents inside the single file). Nothing typed leaves the device.
- **Accessibility.** Landmarks, a skip link, visible focus, dialogs with focus management, live announcements, reduced motion and transparency, adjustable text size and spacing, a plain-language mode, table views for charts, read-aloud where the browser offers it, and print layouts.

---

## Contributing

Lessons, classroom stories, translations, accessibility fixes and code are all welcome. Use the forms under **Issues → New issue**, or open a pull request; its template has a short zero-harm checklist, and `npm test` in `tools/` runs the same checks as CI. Never include student names, photos, voices or identifying stories in anything you share. Please read `CODE_OF_CONDUCT.md` and `CONTRIBUTING.md` (also in the app's library, under **Community**).

## License

The toolkit is licensed under the **GNU Affero General Public License v3.0 or later** (`LICENSE`), with the project's ethical-use intentions summarized in plain words in `LICENSE-NOTES.md`, which also has notes for the steward. The open-source parts and fonts keep their own licenses: see `THIRD-PARTY-NOTICES.md`.

## Credits

Stewarded by Foster + Navi, a human–AI partnership, with the [Planetary Restoration Archive](https://planetaryrestorationarchive.com). Built on the work of the people behind MiniSearch, marked, DOMPurify, qrcode-generator, turndown, gpt-tokenizer and tiktoken, fflate, esbuild, Playwright, axe-core, html-validate, EPUBCheck, Atkinson Hyperlegible Next (Braille Institute) and Literata, and inspired by Learning Equality's Kolibri. `docs/REPOSITORIES.md` explains how open-source projects were chosen for this toolkit.
