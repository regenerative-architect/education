# Tests

These tests open the toolkit in a real browser and use it the way people do. They run on every push and pull request (`.github/workflows/pages.yml`), and nothing is published unless they pass.

| File | What it checks |
|---|---|
| `app.test.mjs` | The installable app end to end: installing, the service worker, the library and reader, search, sharing and QR codes, present mode, opening your own Markdown safely, saving the library, working offline, the update flow, removal, the 404 page, and that nothing is requested from any other website. |
| `single-file.test.mjs` | The single-file edition with no internet: the library inside it, search, sharing notes, zero network requests; the app opened straight from a folder; and layouts from 320px phones to wide screens. |
| `page-tools.test.mjs` | Every tool on the page, used on a phone in dark mode: contents, search, reading comfort, theme, role paths, quick start, question ladder, SACRED check, class agreement with print and download, disclosure statement, prompt deck, footprint, system map, readiness, delete everything, the breathing ritual. Also reduced motion and a browser that blocks storage. |
| `notebook.test.mjs` | The reader's find (every match highlighted, folded sections opened, Escape closes find only), reading progress and “continue where you stopped”, the private notebook (saving, gathering, Markdown download, deleting), and cancelling a document that's still loading. |
| `lab.test.mjs` | The AI Lab: token counts identical to the GPT-4o token set (checked against gpt-tokenizer in Node.js), the token counter saved for offline use, the twelve-language comparison, chart tooltips on hover and keyboard focus, the next-word model and its sources, temperature 0 being repeatable, the training-data comparison, and all of it in the single file with no network. |
| `workspace.test.mjs` | Moving your data: the data format version, downloading, importing with a preview, combining notebooks, files from version 2.1, turning away wrong files (including a hand-written `__proto__`), and two tabs keeping each other up to date. |
| `downloads.test.mjs` | The library downloads: the Markdown zip (every document, working links, no contact details), “Download as Markdown” matching it exactly in both editions, the e-book's structure and EPUBCheck (when `EPUBCHECK_JAR` is set), the Kolibri package in a sandboxed frame with no network or storage, and `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md`. |
| `embedded.test.mjs` | The single file inside another page, the way file previews and learning platforms show it (`about:srcdoc` and `blob:` frames, with the strictest sandbox and with one that allows storage): it starts without errors, links stay in the frame, search, the reader, present mode, the notebook and the AI Lab work, blocked printing says so, a blocked download offers the text to copy, a blocked link shows its address, the browser is asked only once for anything blocked, and nothing is requested from anywhere. Also a frame with no limits, the notice shown when something fails, and the installable app's page in a preview. |
| `read-along.test.mjs` | Read along: the sentence and the exact word highlighted as they're spoken, voices on the device first (online ones only when allowed), the chosen voice and speed, each paragraph in its own language, the reader reading the open document, the reading guide, and wider spacing at phone width with the largest text. A stand-in speech engine makes it exact and silent. |
| `translate.test.mjs` | Every family's language: a document translated part by part under its original (in its own language and writing direction, labeled as a machine translation), languages that can't be translated or need downloading, stopping, clearing up, your own files in other languages, the class agreement's family-language version in print and download, and a plain message where there's no translator. A stand-in translator plays the browser's part. |
| `circles.test.mjs` | Circles: turns, the chime that never cuts anyone off, passing, pause and +30 seconds, the consent round and its record (downloaded exactly as shown), Big screen, and nothing saved. Playwright's clock makes a minute take no time. |
| `practice.test.mjs` | Practice the key ideas: the ideas taken from the page, schedules identical to ts-fsrs (FSRS) run in Node.js, ideas still being learned, the daily limit, keys 1 to 4, stopping kindly, Your data, import and delete, and the single file practising offline. |
| `writing-check.test.mjs` | The writing check: exactly what the retext rules find (checked in Node.js with the same bundle), plain-language reasons, marks in the text, replacements, checking again, offline use, the single file, and nothing saved. |
| `lock.test.mjs` | Lock it with a passphrase: the locked download (opened by Node.js's own Web Crypto, so the format is standard), unlocking on import, a wrong passphrase, a changed file, a file that would keep the device busy, and a file locked by another program. |
| `announcements.test.mjs` | What a screen reader hears, with Guidepup's Virtual Screen Reader in the page: panels named as they open; toasts, circle turns, translation progress and the writing check announced politely; and the notice when something fails announced straight away. |
| `curriculum.test.mjs` | The curriculum studio: its goals, routines and AI use levels; planning a unit with a suggested sequence that hands the thinking to learners (the same every time) and design checks that follow along; AI teacher-led under 13 everywhere it shows; printing; copying an example with credit and ShareAlike; unit files valid against `docs/unit-card.schema.json`, opened on another device as a credited copy; the web page (no scripts) and Markdown; broken, oversized and unsafe files; asking before sharing an email address or phone number; the note to families through the writing check and back; Your data; 320 px with the largest text; and the single file offline. |
| `kiwix.test.mjs` | The Kiwix package: a sound ZIM file (header, MD5 checksum, every entry read with Node.js's own zstd), the single file as its main page (allowed to talk only to the Kiwix server it came from), every library document as a page whose links stay inside, the licenses, openZIM's metadata limits and illustration, both search indexes, no contact details; and, when `kiwix-serve` is installed, the toolkit running in a real Kiwix server, a library page, Kiwix's own search, and the question ladder finding topics in a second library on the same server (title suggestions, search inside articles, the same questions as from the file, a topic of the day), asking nothing of any other website. |
| `ladder.test.mjs` | The question ladder: typed topics (singular or plural, other wordings in turn, care questions for a topic that can hurt); a Kiwix library file read on the device (made for the test by `fixtures/make-ladder-zim.py` with python-libzim): title search as typed, with a capital and through redirects, never an image; ladders from articles with each question's sentence and reason, exactly the same every time and in a fresh page; the source and license; pages that only point elsewhere; the topic of the day (the same all day, never a list, a pointer page, a stub or a care topic); copying, printing and starting a unit in the curriculum studio; a 320px phone with the largest text; openZIM's real Wikipedia samples in three layouts giving the same ladder, Belarusian Wikibooks, and every deliberately damaged file stopping with a message (when `ZIM_TESTING_SUITE` is set); and the single file with no network. |
| `trust.test.mjs` | The software bill of materials against CycloneDX's official 1.6 schema, every vendor file and package in it with its license, the license files, every download listed, building it again giving the same file, and that nothing is checked by fingerprint any more: no hashes in the bill of materials, no signing in the publish workflow (which asks only for what GitHub Pages needs), and no fingerprint steps in the notes. |
| `accessibility.test.mjs` | axe-core against WCAG 2.2 A and AA plus best practices, in every state people meet (light, dark, phone, reader, presenting, search, sharing, settings, planning a unit in the curriculum studio, the question ladder built from a Kiwix library (and with a topic that can hurt, on a phone), a circle and its decision record, practising, the writing check, translations, reading comfort with the reading guide, locking your data, offline page, 404 page, single file, and the single file inside a preview). |
| `html.test.mjs` | html-validate on every page, with the rules in `.htmlvalidate.json`. |

## Run them

```bash
cd tools
npm ci                               # once: installs the pinned tools
npx playwright install chromium      # once: the test browser
node build-standalone.mjs && node build-downloads.mjs && python3 build-zim.py && node build-sbom.mjs && node stamp-sw.mjs   # from tools/ these default to ../site
npm test                             # everything (about six minutes)
EPUBCHECK_JAR=/path/to/epubcheck.jar npm run test:downloads   # with the e-book check
npm run test:accessibility           # just accessibility
npm run test:embedded                # just the single file inside previews
npm run test:announcements           # just what a screen reader hears
npm run test:kiwix                   # just the Kiwix package (kiwix-serve: sudo apt install kiwix-tools)
npm run test:ladder                  # just the question ladder (python-libzim: pip install libzim==4.1.0)
# openZIM's real Wikipedia samples, for the ladder's last checks:
git clone --depth 1 https://github.com/openzim/zim-testing-suite /tmp/zts && ZIM_TESTING_SUITE=/tmp/zts/data npm run test:ladder
```

To add a check, add an `it(...)` step to the file that fits. Each file explains its parts at the top.

## Automated checks have limits

axe-core finds roughly a third to half of accessibility problems, and the Virtual Screen Reader in `announcements.test.mjs` follows the ARIA rules, which real screen readers each interpret a little differently. Keep trying the toolkit with only a keyboard, with a screen reader (NVDA, VoiceOver or TalkBack), at 200% zoom, and with people who use these tools every day.

## Why a few HTML rules are relaxed (`.htmlvalidate.json`)

- **`no-inline-style` is off.** The evidence charts place their markers with inline positions (`style="left:62%"`), which are data, not styling.
- **`wcag/h32` is off.** The calculators (SACRED check, disclosure, footprint, readiness) are forms that update as you type and never submit; `app.js` stops submission, and the content security policy blocks it anyway.
- **`form-dup-name` allows shared checkbox names.** Checkbox groups (like the point multipliers) share one name on purpose.
- **`prefer-native-element` allows a few ARIA patterns.** The role picker (radio buttons), styled progress meters, the two-by-two evidence grid (a table built from rows and cells) and the search results list (a listbox) use ARIA roles deliberately; the accessibility tests check that they work.
