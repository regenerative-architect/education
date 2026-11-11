# Open-source projects in this toolkit: a field guide

This toolkit stands on other people's open work. This page explains how projects were found and chosen, which ones the app uses, which ones it points teachers to, and which ones were left for later, with the reasons. Use it to check our choices, suggest better ones, or make the same choices for your own project.

## How the search worked

In November 2026, we searched curated "awesome" lists rather than raw GitHub search, because people who keep those lists have already filtered for quality:

1. **Index.** 8,000 curated lists from the [ecosyste.ms](https://awesome.ecosyste.ms) index were searched for accessibility, offline and local-first apps, responsible and explainable AI, fairness, education, mental health, citizen science, privacy, on-device AI and sustainability.
2. **Crawl.** 23 lists were read in full, giving 3,369 GitHub projects.
3. **Filter.** Projects were scored for fit with this toolkit's needs and kept only with an open license that works alongside AGPL-3.0, recent maintenance, and no trackers or accounts in anything we'd ship. That left 277 candidates.
4. **Check by hand.** For each project we might use, the license file was read from the repository itself, versions and licenses were confirmed in the npm registry, and each website we link to was opened to confirm what it is, who it suits and what it asks of your privacy.

**Limits.** GitHub's own search API wasn't available to us, so the search relied on curated lists, GitHub topic pages and web search. Three topic pages (`ai-education`, `explainable-ai`, `machine-learning-education`) couldn't be read because of rate limits, so projects found only there may have been missed. Lists also favour well-known projects; smaller community tools deserve a look too.

<details><summary>The 23 lists that were read</summary>

[lukeslp/awesome-accessibility](https://github.com/lukeslp/awesome-accessibility), [hemanth/awesome-pwa](https://github.com/hemanth/awesome-pwa), [pazguille/offline-first](https://github.com/pazguille/offline-first), [TalAter/awesome-service-workers](https://github.com/TalAter/awesome-service-workers), [alexanderop/awesome-local-first](https://github.com/alexanderop/awesome-local-first), [AthenaCore/AwesomeResponsibleAI](https://github.com/AthenaCore/AwesomeResponsibleAI), [bwang514/awesome-HAI](https://github.com/bwang514/awesome-HAI), [JShollaj/awesome-llm-interpretability](https://github.com/JShollaj/awesome-llm-interpretability), [wangyongjie-ntu/Awesome-explainable-AI](https://github.com/wangyongjie-ntu/Awesome-explainable-AI), [datamllab/awesome-fairness-in-ai](https://github.com/datamllab/awesome-fairness-in-ai), [yrgo/awesome-educational-games](https://github.com/yrgo/awesome-educational-games), [carlosperate/awesome-microbit](https://github.com/carlosperate/awesome-microbit), [dreamingechoes/awesome-mental-health](https://github.com/dreamingechoes/awesome-mental-health), [dylanrees/citizen-science](https://github.com/dylanrees/citizen-science), [aaronhma/awesome-tensorflow-js](https://github.com/aaronhma/awesome-tensorflow-js), [mikbry/awesome-webgpu](https://github.com/mikbry/awesome-webgpu), [NexaAI/Awesome-LLMs-on-device](https://github.com/NexaAI/Awesome-LLMs-on-device), [pluja/awesome-privacy](https://github.com/pluja/awesome-privacy), [paulo-amaral/awesome-digital-public-infrastructure](https://github.com/paulo-amaral/awesome-digital-public-infrastructure), [philsturgeon/awesome-earth](https://github.com/philsturgeon/awesome-earth), [Grunet/awesome-inclusive-user-research](https://github.com/Grunet/awesome-inclusive-user-research), [luspr/awesome-ml-courses](https://github.com/luspr/awesome-ml-courses), [protontypes/open-sustainable-technology](https://github.com/protontypes/open-sustainable-technology)

</details>

## What the toolkit uses

Everything shipped to visitors is copied into the site: nothing loads from a CDN, and the content security policy blocks other websites.

| Project | Version | License | What it does here | Where |
|---|---|---|---|---|
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | 4.14.0 | MPL-2.0 | Automated accessibility checks of the app in the test suite and on every change | tools (development only) |
| [html-validate/html-validate](https://github.com/html-validate/html-validate) | 11.17.0 | MIT | HTML validation of every page on every change | tools (development only) |
| [microsoft/playwright](https://github.com/microsoft/playwright) | 1.63.0 | Apache-2.0 | End-to-end tests: installing, offline use, updates, the reader, search, sharing, the AI Lab | tests (development only) |
| [lycheeverse/lychee-action](https://github.com/lycheeverse/lychee-action) | v2 | Apache-2.0 OR MIT | Weekly check of every external link; opens an issue when one breaks | .github/workflows |
| [101arrowz/fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT | Builds the library as a Markdown zip and as an EPUB for e-readers | tools (development only) |
| [niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) | 4.1.0 | MIT | AI Lab: shows how recent GPT models split text into tokens (o200k_base vocabulary from OpenAI's MIT-licensed tiktoken) | site/vendor (loaded only when used) |
| [evanw/esbuild](https://github.com/evanw/esbuild) | 0.28.2 | MIT | Bundles the tokenizer into one browser file | tools (development only) |
| [learningequality/kolibri](https://github.com/learningequality/kolibri) | - | MIT | Distribution: a Kolibri-ready HTML5 app package of the single-file edition | site/download |
| [genai-impact/ecologits](https://github.com/genai-impact/ecologits) | - | MPL-2.0 | Methodology reference for the AI footprint estimates | content |
| [mixmark-io/turndown](https://github.com/mixmark-io/turndown) | 7.2.4 | MIT | “Download as Markdown” in the reader, and the library's Markdown download | site/vendor (loaded only when used) and tools |
| [laurent22/joplin](https://github.com/laurent22/joplin) | @joplin/turndown-plugin-gfm 1.0.68 | MIT | Tables and checklists in that Markdown (the plugin is maintained in Joplin's repository) | bundled into site/vendor/turndown.js |
| [w3c/epubcheck](https://github.com/w3c/epubcheck) | 5.3.0 | BSD-3-Clause | Checks the e-book on every change (CI downloads the official release and verifies its SHA-256 fingerprint) | .github/workflows/pages.yml (development only) |

Also in use since version 2.1: [lucaong/minisearch](https://github.com/lucaong/minisearch), [markedjs/marked](https://github.com/markedjs/marked), [cure53/DOMPurify](https://github.com/cure53/DOMPurify), [kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), [jsdom/jsdom](https://github.com/jsdom/jsdom), [googlefonts/atkinson-hyperlegible-next](https://github.com/googlefonts/atkinson-hyperlegible-next), [googlefonts/literata](https://github.com/googlefonts/literata). Versions and licenses for all of these are in `THIRD-PARTY-NOTICES.md`.

The AI Lab's language comparison uses Article 1 of the Universal Declaration of Human Rights from the [OHCHR translation project](https://www.ohchr.org/en/human-rights/universal-declaration/universal-declaration-human-rights/about-universal-declaration-human-rights-translation-project), as plain text from the UDHR in Unicode collection (notice: `site/vendor/LICENSES/udhr-article-1.txt`).

## What the toolkit points to

These are linked from the app (mostly under **Open tools that pair well**), not included in it. Each card in the app gives ages and privacy notes.

| Project | License | Why it's here | Where it appears |
|---|---|---|---|
| [tensorflow/playground](https://github.com/tensorflow/playground) | Apache-2.0 | A neural network learning in the browser | Open tools that pair well |
| [poloclub/transformer-explainer](https://github.com/poloclub/transformer-explainer) | MIT | A live GPT-2 model in the browser, showing next-word choice | Open tools that pair well |
| [poloclub/cnn-explainer](https://github.com/poloclub/cnn-explainer) | MIT | How an image-recognising network makes a guess | Open tools that pair well |
| [bbycroft/llm-viz](https://github.com/bbycroft/llm-viz) | MIT | A 3D walk through a small GPT-style model | Open tools that pair well |
| [IBM/taxinomitis](https://github.com/IBM/taxinomitis) | Apache-2.0 | Machine Learning for Kids: children train models and use them in Scratch | Open tools that pair well |
| [uccser/cs-unplugged](https://github.com/uccser/cs-unplugged) | MIT | Computer science without computers | Open tools that pair well |
| [responsible-ai-collaborative/aiid](https://github.com/responsible-ai-collaborative/aiid) | see the repository | The AI Incident Database: real cases of AI harm | Open tools that pair well |
| [microsoft/AI-For-Beginners](https://github.com/microsoft/AI-For-Beginners) | MIT | A 12-week open AI curriculum with an ethics unit | Open tools that pair well |
| [microsoft/ML-For-Beginners](https://github.com/microsoft/ML-For-Beginners) | MIT | A companion machine-learning curriculum | for maintainers; may join the tools section later |
| [GarethManning/education-agent-skills](https://github.com/GarethManning/education-agent-skills) | see the repository | Teaching skills for AI agents, written by an educator (CC BY-SA 4.0) | for maintainers; not yet linked in the app |
| [iiab/iiab](https://github.com/iiab/iiab) | GPL-2.0 | Internet-in-a-Box: an offline digital library on a Raspberry Pi | Open tools that pair well |
| [kiwix/kiwix-js](https://github.com/kiwix/kiwix-js) | GPL-3.0 | Kiwix: Wikipedia and more, offline | Open tools that pair well |
| [mlco2/codecarbon](https://github.com/mlco2/codecarbon) | MIT | Measure the carbon of your own Python code | Open tools that pair well |
| [fairlearn/fairlearn](https://github.com/fairlearn/fairlearn) | MIT | Check whether a model's mistakes fall unfairly on some groups | Open tools that pair well |
| [jphall663/awesome-machine-learning-interpretability](https://github.com/jphall663/awesome-machine-learning-interpretability) | cc0-1.0 | A curated list for going deeper into explainable AI | for maintainers |

## Left for later

Good projects that don't fit yet. Each one is a possible future extension, with what it would take.

| Project | Why not yet |
|---|---|
| [mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) | A full language model running in the browser; needs a large download (hundreds of MB) and a capable GPU |
| [huggingface/transformers.js](https://github.com/huggingface/transformers.js) | On-device models for demos; model files would come from a third-party host unless bundled |
| [mozilla/translations](https://github.com/mozilla/translations) | Private, on-device translation; language models are 15–40 MB each |
| [webmachinelearning/translation-api](https://github.com/webmachinelearning/translation-api) | Browsers' built-in translator; available in some browsers only |
| [yjs/yjs](https://github.com/yjs/yjs) | Live collaboration between devices; needs a privacy-safe way to connect them |
| [automerge/automerge](https://github.com/automerge/automerge) | Same as Yjs |
| [cozmo/jsQR](https://github.com/cozmo/jsQR) | Scan a QR code to move your notebook between devices, with camera permission |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | Diagrams in library documents; large (over 1 MB) |
| [hakimel/reveal.js](https://github.com/hakimel/reveal.js) | Turn lessons into slide decks |
| [pagedjs/pagedjs](https://github.com/pagedjs/pagedjs) | Book-quality printing of the library |
| [openzim/zimit](https://github.com/openzim/zimit) | Package the toolkit for Kiwix offline readers |
| [h5p/h5p-php-library](https://github.com/h5p/h5p-php-library) | Interactive activities that import into Moodle, Canvas and WordPress |
| [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) | Only if the service worker grows much more complex |
| [pa11y/pa11y](https://github.com/pa11y/pa11y) | A second accessibility engine for cross-checking |
| [guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader) | Test what a screen reader announces |
| [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | Performance budgets on every change |

## Suggest a project

Open an issue in this repository and tell us what the project is and how a class would use it. We look for projects that:

- are free and openly licensed, and compatible with AGPL-3.0 if they'd be shipped;
- work without accounts or tracking, or say clearly what they collect;
- work offline or on slow connections, or can be made to;
- are accessible (keyboard, screen readers, reduced motion);
- help people learn about AI honestly and kindly, with room for every language and culture.

Projects are checked again whenever this page is updated, and the weekly link check (`.github/workflows/links.yml`) flags any link that breaks.
