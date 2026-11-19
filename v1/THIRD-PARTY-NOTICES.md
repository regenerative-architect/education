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
| [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next) | 2.001 | SIL Open Font License 1.1 | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors | Body text | `site/assets/fonts/atkinson-hyperlegible-next.woff2` |
| [Literata](https://github.com/googlefonts/literata) (italic) | 3.103 | SIL Open Font License 1.1 | Copyright 2017 The Literata Project Authors | The "ritual voice" | `site/assets/fonts/literata-italic.woff2` |

The bundled files (`turndown.js`, `gpt-tokenizer.js`) are made with [esbuild](https://github.com/evanw/esbuild) 0.28.2 (MIT, Copyright (c) 2020 Evan Wallace), which adds a few lines of its own glue code. The single-file edition carries the same components inside it (the token counter compressed, unpacked on first use).

The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## Used only to build the library and the downloads (not shipped to visitors)

| Component | Version | License | Used for |
|---|---|---|---|
| [marked](https://github.com/markedjs/marked) | 18.1.1 | MIT | Turning the repository's Markdown into HTML |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 | Apache-2.0 or MPL-2.0 | Cleaning that HTML |
| [jsdom](https://github.com/jsdom/jsdom) | 30.1.3 | MIT | Running DOMPurify and the clean-up steps in Node.js |
| [esbuild](https://github.com/evanw/esbuild) | 0.28.2 | MIT | Bundling turndown and gpt-tokenizer into single browser files |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT | Writing the e-book and zip downloads |
| [turndown](https://github.com/mixmark-io/turndown) and its GFM plugin | as above | MIT | Writing the Markdown downloads and `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md` |

## Used only to test and check (not shipped)

| Component | Version | License | Used for |
|---|---|---|---|
| [Playwright](https://github.com/microsoft/playwright) | 1.63.0 | Apache-2.0 | Using the app in a real browser in the tests |
| [axe-core](https://github.com/dequelabs/axe-core) | 4.14.0 | MPL-2.0 | Accessibility checks (WCAG 2.2 A and AA) |
| [html-validate](https://html-validate.org/) | 11.17.0 | MIT | HTML checks |
| [EPUBCheck](https://github.com/w3c/epubcheck) | 5.3.0 | BSD-3-Clause | Checking the e-book; CI downloads it and checks its SHA-256 fingerprint first |
| [lychee-action](https://github.com/lycheeverse/lychee-action) | v2 | Apache-2.0 or MIT | The weekly link watch |

## Texts and methods

- **Article 1 of the Universal Declaration of Human Rights in twelve languages** (the AI Lab's language comparison). Source: the [OHCHR translation project](https://www.ohchr.org/en/human-rights/universal-declaration/universal-declaration-human-rights/about-universal-declaration-human-rights-translation-project), which asks that reproductions name it as the source; plain-text versions from the UDHR in Unicode collection, under the Unicode License. The full notice and license text ship with the app in `site/vendor/LICENSES/udhr-article-1.txt`. The texts were normalized to Unicode NFC, and Yoruba is written with today's dot-below letters.
- **The footprint estimator** follows the published [EcoLogits method](https://ecologits.ai/latest/methodology/llm_inference/) for LLM inference by GenAI Impact (the EcoLogits software is MPL-2.0). The formula was implemented here from the documentation; no EcoLogits code is included. The reference figures beside it are cited in the app where they appear.
- **Chart colors and layout** follow a data-visualization checklist (one validated hue per series, contrast against both light and dark surfaces, values at the tip of each bar, a table view for every chart).

## Formats made to work with other projects

The Kolibri package follows the HTML5 app format of [Kolibri](https://github.com/learningequality/kolibri) (MIT, Learning Equality). Nothing from Kolibri is included.

Versions are pinned in `tools/package.json` and `tools/package-lock.json`.
