# Security and safety

## Reporting a problem privately

If you find a security or privacy problem in the app (for example, a way for a page to load something from another website, run a script it shouldn't, or reveal what's stored on someone's device), please report it privately:

- Use **Report a vulnerability** on this repository's **Security** tab, if the maintainers have turned on private reporting.
- Otherwise, open an issue that says only that you have a private report, without the details, and a maintainer will arrange a private way to talk.

Please don't include any student's or child's personal information in a report, and don't test on other people's devices or data.

## If a child is in danger

This project and its community aren't an emergency service. Follow your school's safeguarding procedure and contact local emergency services.

## How the app protects people

- No tracking, analytics, cookies, accounts or third-party files.
- A strict content security policy on every page: the app may load only its own files; the single-file edition may load nothing. The copy inside the Kiwix package may also ask the Kiwix server it came from for topics (its catalog, title suggestions, search and pages), and nothing else.
- Files people open from their own device are cleaned with DOMPurify, shown only on that device, and never uploaded or saved.
- Translation and read-aloud use what the browser has on the device. Online voices are used only if someone turns them on in Reading comfort.
- Locked data files (*Download all, locked with a passphrase*) use the browser's Web Crypto: PBKDF2 with SHA-256 and 600,000 rounds over a random 16-byte salt, then AES-256-GCM with a random 12-byte nonce and the additional data `ai-co-evolution-locked/v1`. The file is JSON, `{ format: "ai-co-evolution-locked", v: 1, about, kdf: { name, hash, iterations, salt }, cipher: { name, iv }, data }`, with base64 values, so other programs can open it with the passphrase. Importing refuses any other kind of lock, and fewer than 100,000 or more than 5,000,000 rounds, without trying. A forgotten passphrase can't be recovered.
- Unit files from the curriculum studio are read as data, never run: JSON with `JSON.parse`, and the unit web page with the browser's inert `DOMParser`. Everything is then checked against the unit format (docs/UNIT-FORMAT.md) before it's shown or saved. The web page the studio makes has no scripts, and a content security policy that loads nothing.
- Kiwix libraries (ZIM files) opened in the question ladder are read as data: the page reads the parts it needs from the file on the device, parses articles with the browser's inert `DOMParser`, and shows only plain text from them (no scripts, styles, images or links from the file run or load). Broken, unfinished or unsupported files stop with a message, and nothing is uploaded or saved.
- A software bill of materials, `site/sbom.cdx.json`, lists every part inside and its license. Since version 2.5 the toolkit doesn't publish fingerprints (SHA-256 hashes) or signed build records for its downloads; get them from the site that publishes the toolkit, or from someone you trust.
- `tools/check-site.mjs` runs on every change and blocks publishing if it finds tracking code, third-party files, personal contact details, a missing policy or broken links.
