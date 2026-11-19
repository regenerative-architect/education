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
| `accessibility.test.mjs` | axe-core against WCAG 2.2 A and AA plus best practices, in every state people meet (light, dark, phone, reader, presenting, search, sharing, settings, offline page, 404 page, single file). |
| `html.test.mjs` | html-validate on every page, with the rules in `.htmlvalidate.json`. |

## Run them

```bash
cd tools
npm ci                               # once: installs the pinned tools
npx playwright install chromium      # once: the test browser
node build-standalone.mjs && node build-downloads.mjs && node stamp-sw.mjs   # from tools/ these default to ../site
npm test                             # everything (about three minutes)
EPUBCHECK_JAR=/path/to/epubcheck.jar npm run test:downloads   # with the e-book check
npm run test:accessibility           # just accessibility
```

To add a check, add an `it(...)` step to the file that fits. Each file explains its parts at the top.

## Automated checks have limits

axe-core finds roughly a third to half of accessibility problems. Keep trying the toolkit with only a keyboard, with a screen reader (NVDA, VoiceOver or TalkBack), at 200% zoom, and with people who use these tools every day.

## Why a few HTML rules are relaxed (`.htmlvalidate.json`)

- **`no-inline-style` is off.** The evidence charts place their markers with inline positions (`style="left:62%"`), which are data, not styling.
- **`wcag/h32` is off.** The calculators (SACRED check, disclosure, footprint, readiness) are forms that update as you type and never submit; `app.js` stops submission, and the content security policy blocks it anyway.
- **`form-dup-name` allows shared checkbox names.** Checkbox groups (like the point multipliers) share one name on purpose.
- **`prefer-native-element` allows a few ARIA patterns.** The role picker (radio buttons), styled progress meters, the two-by-two evidence grid (a table built from rows and cells) and the search results list (a listbox) use ARIA roles deliberately; the accessibility tests check that they work.
