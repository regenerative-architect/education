# The question ladder: how it works

The question ladder in Lesson 2 builds five questions on a topic, from simple to deep: **basic facts, connections, perspectives, critical analysis and creative synthesis**. Type any topic, or open a Kiwix library and pick an article. With an article, each question comes from the article itself, with the sentence it came from and the reason it was asked.

It isn't a chatbot. It follows written rules (it's *deterministic*), so the same article always gives the same ladder, on any device. A class, a colleague or a parent who opens the same article gets exactly the same questions, and anyone can read why each question was asked.

All of it is in `site/assets/app.js`, in the part headed `QUESTION LADDER BUILDER`.

---

## Where topics come from

| Source | What happens | Where it works |
|---|---|---|
| **Your own words** | Five questions from patterns that need no article. | Everywhere |
| **A Kiwix library file** (`.zim`) | The file stays on your device. The page reads only the parts it needs: a few kilobytes to search titles, and one compressed "cluster" (usually about 2 MB) per article. Even the full English Wikipedia (over 100 GB with pictures) opens as quickly as a small library. | The app, the single file, the Kiwix package |
| **The Kiwix server the page came from** | The toolkit's Kiwix package, served by `kiwix-serve` next to other libraries, asks that server for its catalog, title suggestions, full-text search and raw pages. | The Kiwix package on a Kiwix server |

Free Kiwix libraries (Wikipedia in many languages, Wiktionary, Wikibooks, Project Gutenberg and many more) are at [library.kiwix.org](https://library.kiwix.org/).

**What it can't read yet** (future extensions): older libraries compressed with xz (Kiwix's library has current copies of most titles); question patterns in languages other than English (libraries in other languages work, but the questions are in English, with quotes in the library's language).

---

## Reading a Kiwix library file

The reader follows openZIM's description of the [ZIM format](https://wiki.openzim.org/wiki/ZIM_file_format):

1. **The header** (80 bytes) says where the indexes and clusters are. Every position is checked against the file's size before it's read.
2. **Finding titles.** Newer libraries keep a list of their articles sorted by title (`X/listing/titleOrdered/v1`); older ones a list of every entry sorted by namespace and title. The reader searches it by halving the range, about 23 steps for 7 million articles. It tries what you typed, then with a capital first letter, and in lower case.
3. **Redirects.** It also searches the path index, so "Global warming" finds "Climate change". Images, scripts and styles are never offered.
4. **Reading an article.** It reads the article's cluster. A cluster stored as is is read straight from the file; a compressed one is unpacked with [fzstd](https://github.com/101arrowz/fzstd) (Zstandard), after working out exactly where its compressed data ends, so nothing else in the file is ever fed to the decompressor. No cluster may unpack to more than 64 MB, and no article may be over 16 MB.
5. **Never run.** The article's HTML is parsed with the browser's inert `DOMParser`: no scripts run, no images or styles load, and only plain text is shown.

A damaged, unfinished or unsupported file stops with a plain message. The tests open every deliberately damaged file in openZIM's test suite.

---

## Turning an article into questions

`LadderEngine.analyse(html)` and `LadderEngine.build(analysis, wording)`:

1. **Read.** Keep the article's own paragraphs and list items. Leave out tables, infoboxes, references, footnotes, navigation, "See also" and other end sections, and Kiwix's own "this article is issued from…" box.
2. **Split into sentences**, by rule: a full stop, question or exclamation mark followed by a capital letter ends a sentence, unless the word before it is a common abbreviation or an initial.
3. **The topic, in the article's own words.** The bold term in the first sentence, with "the" when the article says "The greenhouse effect occurs…", or in the plural for "A landmine is…" (landmines). Questions then agree with it: "What *are* landmines?".
4. **Key ideas.** What the article links to (its writers' own choice of key terms) and the two-word phrases and words it repeats. A phrase counts for more than the words inside it ("carbon dioxide", not "carbon"), linked ideas count for more than unlinked ones, and earlier wins ties. Words that rarely make good ideas on their own ("process", "number", verbs) are left out.
5. **Kinds of sentence**, found with short cue-word lists:

   | Kind | Cue words (some of them) | Used on |
   |---|---|---|
   | Definition | the first sentence, with *is, are, refers to, means* | Basic facts |
   | Cause | *because, due to, leads to, results in, therefore* (strongest), *increases, reduces, allows* | Connections |
   | View or disagreement | *argued, critics, supporters, debate, controversial, according to* | Perspectives |
   | Time | a year or a century, with *first, discovered, showed, founded, began* | Perspectives |
   | Uncertainty | *may, might, could, estimated, about* (before a number), *likely, theory* | Critical analysis |
   | Measurement | a number with a unit: *%, °, km, tonnes, million* | Critical analysis |
   | Comparison | *however, unlike, whereas, in contrast, although* | Critical analysis |

   Rarer kinds choose first (views and uncertainty before causes), so each rung gets the best sentence that no other rung has used.
6. **Fill the rungs.** Each rung has question patterns, tried in order; the first one the article can support is used, with its sentence as evidence. **Another wording** starts one pattern further along, and the wordings go round.

| Rung | Patterns, in order |
|---|---|
| Basic facts | the definition · how two key ideas fit in · which of three ideas matters most · what it is and its key parts · explain it to someone younger |
| Connections | what leads to what in a cause sentence · how two key ideas connect · links to what we've studied · where we notice it in our lives and land |
| Perspectives | who sees a view or disagreement differently · how ideas changed over time · three viewpoints that fit the subject (an ecologist, a farmer and a neighbour for the living world; a historian, a person who was there and a young person today for history; and so on) |
| Critical analysis | how sure we can be · where a number comes from · whether a comparison is fair · what the source might leave out (lateral reading) · the assumptions underneath |
| Creative synthesis | make something that brings two key ideas together · a "what if" that changes a cause · how understanding it helps a community care for people and places · a fairness and justice lens |

### Topics that can hurt

If the title or first sentence is about violence, war, abuse, self-harm, weapons, slavery, genocide, terrorism or similar (the `CARE` list), every rung uses care questions instead: what the source says and the words it chooses; what helps people stay safe, heal or rebuild; whose voices are heard and whose are missing; how the writing shapes feelings; and what a community could do to prevent harm or support people affected. The page also shows a note for the adult leading: read the source first, tell learners before you start, and make sure they know who they can talk to.

### The topic of the day

It picks an article from the library by a number made from the date, the library's own identifier and how many times "Another topic" was pressed. Everyone with the same library gets the same topic on the same day, so a class can find it together. It skips lists, pages that only point to other pages, very short pages, topics on the care list and grown-up topics. On a Kiwix server it starts from a list of broad words (water, energy, forest…) instead.

---

## Change it

- **Add a question pattern:** add an entry to a rung in `TEMPLATES` (`id`, `ask`, `why`, and `kind` for the kind of sentence it quotes, or `need` for what the article must have). Order matters: earlier patterns are tried first.
- **Catch more sentences:** add words to a list in `CUES`.
- **Add viewpoints for a subject:** add an entry to `DOMAINS` with its cue words and three roles (no pronouns, so they read well with any topic).
- **Widen the care list:** add words to `CARE`; the care questions are in `CARE_TEMPLATES`.

Run `npm run test:ladder` in `tools/` afterwards. The tests check exact ladders, so a change that alters questions shows up there; update the expected questions on purpose when you mean to change them.

---

## Privacy and safety

- A library file never leaves the device, and nothing about it is saved.
- The Kiwix package may talk only to the Kiwix server it came from (its content security policy says `connect-src 'self'`); the single file and the app contact nothing for the ladder.
- Libraries can hold grown-up topics. The topic of the day skips them, but searching can still find them: look before you share.
- Quoted sentences belong to their authors. Wikipedia's text is shared under CC BY-SA 4.0, which asks you to credit it: "Copy the ladder" adds the source and its license.

*AI Co-Evolution in Education · CC BY-SA 4.0 · Zero Harm and Anti-Coercion: nothing here may be used to surveil, shame, exclude or coerce students, teachers or families.*
