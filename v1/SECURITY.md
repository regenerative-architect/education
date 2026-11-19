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
- A strict content security policy on every page: the app may load only its own files; the single-file edition may load nothing.
- Files people open from their own device are cleaned with DOMPurify, shown only on that device, and never uploaded or saved.
- `tools/check-site.mjs` runs on every change and blocks publishing if it finds tracking code, third-party files, personal contact details, a missing policy or broken links.
