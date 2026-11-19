# Third-party notices

The app includes these open-source components. They're copied into the site (nothing loads from a CDN), and each keeps its own license. Full license texts ship with the app in `site/vendor/LICENSES/` and `site/assets/fonts/OFL.txt`.

## In the app

| Component | Version | License | Copyright | Used for | File |
|---|---|---|---|---|---|
| [MiniSearch](https://github.com/lucaong/minisearch) | 7.2.0 | MIT | Copyright 2022 Luca Ongaro | Full-text search on the device | `site/vendor/minisearch.js` |
| [marked](https://github.com/markedjs/marked) | 18.1.1 | MIT | Copyright (c) 2018+, MarkedJS; Copyright (c) 2011-2018, Christopher Jeffrey | Showing Markdown files you open | `site/vendor/marked.umd.js` |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 | Apache-2.0 or MPL-2.0 (used here under Apache-2.0) | (c) Cure53 and other contributors | Cleaning the HTML of files you open | `site/vendor/purify.min.js` |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 2.0.4 | MIT | Copyright (c) 2009 Kazuhiko Arase | Making QR codes on the device | `site/vendor/qrcode.js` |
| [turndown](https://github.com/mixmark-io/turndown) | 7.2.4 | MIT | Copyright (c) 2017 Dom Christie | "Download as Markdown": turning a library document back into Markdown | `site/vendor/turndown.js` (bundled with the plugin below) |
| [@joplin/turndown-plugin-gfm](https://www.npmjs.com/package/@joplin/turndown-plugin-gfm) | 1.0.68 | MIT | Copyright (c) 2017 Dom Christie; maintained by the Joplin project | Tables and checklists in that Markdown | `site/vendor/turndown.js` |
| [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) | 4.1.0 | MIT | Copyright (c) 2023-2024 Bazyli Brzoska | The AI Lab's token counter, on the device | `site/vendor/gpt-tokenizer.js` (saved on first use) |
| o200k_base vocabulary from [tiktoken](https://github.com/openai/tiktoken) | (in gpt-tokenizer 4.1.0) | MIT | Copyright (c) 2022 OpenAI, Shantanu Jain | The same token boundaries GPT-4o-family models use | inside `site/vendor/gpt-tokenizer.js` |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 5.4.2 | MIT | Copyright (c) 2026 Open Spaced Repetition | Practice the key ideas: the FSRS-6 schedule | `site/vendor/fsrs.js` |
| [fzstd](https://github.com/101arrowz/fzstd) | 0.1.1 | MIT | Copyright (c) 2020 Arjun Barrett | The question ladder's Kiwix reader: unpacking the compressed parts (Zstandard) of Kiwix libraries on the device | `site/vendor/fzstd.js` (saved on first use) |
| [retext](https://github.com/retextjs/retext) and [unified](https://github.com/unifiedjs/unified): retext-english 5.0.0, retext-readability 8.0.0, retext-simplify 8.0.0, retext-passive 5.0.0, retext-equality 7.1.0, retext-stringify 4.0.0, unified 11.0.5, syllable 5.0.1, and 34 smaller packages they use | as listed | MIT (all 42 packages) | Copyright (c) Titus Wormer, and the others named in the license file | The plain and kind writing check | `site/vendor/plain-kind.js` (saved on first use); every package, version and license text is in `site/vendor/LICENSES/plain-kind.txt` |
| [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next) | 2.001 | SIL Open Font License 1.1 | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors | Body text | `site/assets/fonts/atkinson-hyperlegible-next.woff2` |
| [Literata](https://github.com/googlefonts/literata) (italic) | 3.103 | SIL Open Font License 1.1 | Copyright 2017 The Literata Project Authors | The "ritual voice" | `site/assets/fonts/literata-italic.woff2` |

The bundled files (`turndown.js`, `gpt-tokenizer.js`, `fsrs.js`, `plain-kind.js`, `fzstd.js`) are made with [esbuild](https://github.com/evanw/esbuild) 0.28.2 (MIT, Copyright (c) 2020 Evan Wallace), which adds a few lines of its own glue code. `tools/vendor.mjs` finds every package esbuild puts into each bundle and writes its license text into `site/vendor/LICENSES/`, with a list in `site/vendor/LICENSES/packages.json`; `tools/build-sbom.mjs` turns that list into the software bill of materials, `site/sbom.cdx.json`. Email addresses in copyright lines are left out of those files, as everywhere in this project; names, years and license terms are kept in full, and each package's original files are in its npm package. The single-file edition carries the same components inside it (the token counter, the practice schedule, the writing check and the Kiwix reader's decompressor compressed, unpacked on first use).

The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## Used only to build the library and the downloads (not shipped to visitors)

| Component | Version | License | Used for |
|---|---|---|---|
| [marked](https://github.com/markedjs/marked) | 18.1.1 | MIT | Turning the repository's Markdown into HTML |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 | Apache-2.0 or MPL-2.0 | Cleaning that HTML |
| [jsdom](https://github.com/jsdom/jsdom) | 30.1.3 | MIT | Running DOMPurify and the clean-up steps in Node.js |
| [python-libzim](https://github.com/openzim/python-libzim) | 4.1.0 (libzim 9.8) | GPL-3.0-or-later | Writing the Kiwix package (ZIM file); not inside the toolkit |
| [esbuild](https://github.com/evanw/esbuild) | 0.28.2 | MIT | Bundling turndown, gpt-tokenizer, ts-fsrs and the writing check into single browser files, and listing the packages inside each |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT | Writing the e-book and zip downloads |
| [turndown](https://github.com/mixmark-io/turndown) and its GFM plugin | as above | MIT | Writing the Markdown downloads and `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md` |

## Used only to test and check (not shipped)

| Component | Version | License | Used for |
|---|---|---|---|
| [Playwright](https://github.com/microsoft/playwright) | 1.63.0 | Apache-2.0 | Using the app in a real browser in the tests |
| [axe-core](https://github.com/dequelabs/axe-core) | 4.14.0 | MPL-2.0 | Accessibility checks (WCAG 2.2 A and AA) |
| [html-validate](https://html-validate.org/) | 11.17.0 | MIT | HTML checks |
| [EPUBCheck](https://github.com/w3c/epubcheck) | 5.3.0 | BSD-3-Clause | Checking the e-book; CI downloads the official 5.3.0 release |
| [lychee-action](https://github.com/lycheeverse/lychee-action) | v2 | Apache-2.0 or MIT | The weekly link watch |
| [Guidepup Virtual Screen Reader](https://github.com/guidepup/virtual-screen-reader) | 0.33.0 | MIT | Listening to what a screen reader announces |
| [kiwix-tools](https://github.com/kiwix/kiwix-tools) (`kiwix-serve`) | 3.5, from Ubuntu | GPL-3.0-or-later | Opening the Kiwix package in a real Kiwix server |
| [CycloneDX JavaScript library](https://github.com/CycloneDX/cyclonedx-javascript-library) | 10.3.0 | Apache-2.0 | Checking the software bill of materials against CycloneDX's official schema |
| [Ajv](https://github.com/ajv-validator/ajv), [ajv-formats](https://github.com/ajv-validator/ajv-formats), [ajv-formats-draft2019](https://github.com/luzlab/ajv-formats-draft2019) | 8.20.0, 3.0.1, 1.6.1 | MIT | The JSON schema checker the CycloneDX library uses |
| [zim-testing-suite](https://github.com/openzim/zim-testing-suite) (openZIM) | commit 2edf720 | no license file; the Wikipedia articles inside are CC BY-SA 4.0, as each one says | Small real Wikipedia libraries for testing the question ladder's Kiwix reader. The tests download them; they aren't stored or shipped here |

## Texts and methods

- **Article 1 of the Universal Declaration of Human Rights in twelve languages** (the AI Lab's language comparison). Source: the [OHCHR translation project](https://www.ohchr.org/en/human-rights/universal-declaration/universal-declaration-human-rights/about-universal-declaration-human-rights-translation-project), which asks that reproductions name it as the source; plain-text versions from the UDHR in Unicode collection, under the Unicode License. The full notice and license text ship with the app in `site/vendor/LICENSES/udhr-article-1.txt`. The texts were normalized to Unicode NFC, and Yoruba is written with today's dot-below letters.
- **The footprint estimator** follows the published [EcoLogits method](https://ecologits.ai/latest/methodology/llm_inference/) for LLM inference by GenAI Impact (the EcoLogits software is MPL-2.0). The formula was implemented here from the documentation; no EcoLogits code is included. The reference figures beside it are cited in the app where they appear.
- **Practice the key ideas** asks questions written from this toolkit's own text (the five promises, the SACRED check, the repair circle and the glossary). Its schedule uses FSRS, the open algorithm of the [Open Spaced Repetition](https://github.com/open-spaced-repetition) community.
- **Circles** draw on the practices of many Indigenous peoples and on restorative justice, and the consent round on consent decision-making as practised in sociocracy. The app says so where they're used and encourages learning from local Knowledge Keepers.
- **The writing check's word lists and rules** come from the retext packages above; their messages are rewritten here in plain language.
- **The curriculum studio's routine library** describes sixteen teaching routines in this toolkit's own words and credits each one's source: Project Zero at the Harvard Graduate School of Education (see, think, wonder; what makes you say that?; the ladder of feedback), Annemarie Palincsar and Ann Brown (reciprocal teaching), the Digital Inquiry Group's Civic Online Reasoning (lateral reading), Katherine McNeill and Joseph Krajcik (claim, evidence, reasoning), Frank Lyman (think, pair, share), Dorothy Frayer and colleagues (the Frayer model), Matthew Lipman (community of inquiry), Mortimer Adler (Socratic seminar), Paul Black and Dylan Wiliam (formative assessment), Barry Zimmerman (self-regulated learning) and CAST's Universal Design for Learning 3.0. The six steps follow backward design (Grant Wiggins and Jay McTighe) and the gradual release of responsibility (P. David Pearson and Margaret Gallagher).
- **AI use levels** take their names from the AI Assessment Scale by Mike Perkins, Jasper Roe, Leon Furze and Jason MacVaugh ([aiassessmentscale.com](https://aiassessmentscale.com/)); the descriptions are this toolkit's own words, and none of the scale's diagrams are copied.
- **Evidence figures** in the studio come from the EEF's Teaching and Learning Toolkit (checked November 2026), Rosenshine and Meister (1994), Okkinga and colleagues (2018), Reeve and Cheon (2021), Lewis and Perry (2017) and the EEF's trial reports, as cited where they appear.
- **Chart colors and layout** follow a data-visualization checklist (one validated hue per series, contrast against both light and dark surfaces, values at the tip of each bar, a table view for every chart).

## Formats made to work with other projects

The Kolibri package follows the HTML5 app format of [Kolibri](https://github.com/learningequality/kolibri) (MIT, Learning Equality). Nothing from Kolibri is included.

Versions are pinned in `tools/package.json` and `tools/package-lock.json`.
