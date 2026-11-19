# Unit files: the curriculum studio's open format

The curriculum studio saves a unit as a small, plain file, so a unit can travel between teachers, schools and tools, and be improved along the way. This page describes that file, for anyone who wants to read units, make them with another tool, or check one.

- **`unit-<title>.json`**: the unit file (“Download the unit file”). This is the format described below.
- **`unit-<title>.html`**: a web page (“Save as a web page”): the plan and the student page that anyone can read in a browser, with no scripts. The same unit file is inside it, in `<script type="application/json" id="aice-unit">`, so the studio can open the page again. That block is data, and it never runs.
- **`unit-<title>.md`**: the plan as Markdown, for reading and editing anywhere. The studio doesn't open Markdown.

The JSON Schema is [`unit-card.schema.json`](unit-card.schema.json), and the tests check every unit file the studio makes against it (`tools/tests/curriculum.test.mjs`).

## What's in a unit file

```json
{
  "format": "ai-co-evolution-unit",
  "v": 1,
  "exported": "2026-11-14T10:00:00.000Z",
  "app": "AI Co-Evolution in Education 2.4",
  "unit": { "…": "the unit, below" }
}
```

| Field | What it holds |
| --- | --- |
| `id` | `u-` and 6 to 20 lowercase letters or digits. A copy gets a new id. |
| `title`, `subject`, `question`, `why` | The unit's name, subject or theme, big question, and why it matters to these learners. |
| `band` | Learners' ages: `5-8`, `9-12`, `13-15`, `16-18` or `adult`. For the two younger bands (under 13), any AI use is teacher-led. |
| `minutes` | Length of each session: 30, 45, 50, 60 or 90. |
| `goals` | Chosen “I can” goals for `reasoning`, `literacy` and `autonomy`, as ids from the studio (such as `r-claim`, `l-source`, `a-reflect`). |
| `own` | The teacher's own goals for each strand, as text. |
| `task`, `choices`, `criteria` | How learners will show what they've learned, the ways they can choose from, and the success criteria in learners' words. |
| `plan` | The sessions, in order. Each has a `title`, a `stage` (`model` I show, `guided` we practise, `together` you try together, `alone` you lead), a `routine` id from the routine library (or empty), an `ai` level from 1 to 5 with `aiWhy`, and `notes`. |
| `supports`, `family` | Supports so every learner can take part, and the note to families. |
| `core`, `adapt` | What must stay so the unit still works, and what others can change. This is what makes a unit replicable. |
| `reflect` | After teaching: what worked (`kept`), what to change (`change`) and what learners said (`voice`). |
| `history` | Dated version notes, oldest first. |
| `by`, `license`, `basedOn` | Optional credit, the license (`CC-BY-SA-4.0`, `CC-BY-4.0`, `CC0-1.0`, or `none` for not for sharing yet), and the units this one adapts, oldest first. |
| `created`, `updated` | When the unit was made and last changed (ISO 8601, UTC). |

The AI use levels follow the [AI Assessment Scale](https://aiassessmentscale.com/) by Mike Perkins, Jasper Roe, Leon Furze and Jason MacVaugh: 1 no AI, 2 AI planning, 3 AI collaboration, 4 full AI, 5 AI exploration. No level is better than another.

## How credit travels

- Opening someone's unit file makes a copy to adapt. The copy has a new `id`, an empty `by` for the new author, and the original added at the end of `basedOn`, with its id, title, authors and license.
- A unit based on a `CC-BY-SA-4.0` unit can only be shared under `CC-BY-SA-4.0` (or kept private with `none`). The studio enforces this.
- If a unit in `basedOn` is `none`, the studio says to ask its authors before sharing an adaptation.
- The example units in the studio are by this toolkit, under `CC-BY-SA-4.0`.

## Privacy

Units are made to be shared, so they should never hold students' names or personal details. The studio says so in the form, and before it makes a file it checks for anything that looks like an email address or phone number, and asks first. A unit file contains only the unit: nothing else from the device it was made on.

## Opening a unit file

The studio reads a file as data, never as code: JSON with `JSON.parse`, and a web page with the browser's `DOMParser`, which doesn't run or load anything. It then keeps only what this format allows (unknown fields are dropped, text is trimmed to the lengths above, unknown goal and routine ids are removed) before anything is shown or saved.

## Changing the format

A change that older versions couldn't read raises `v`. The studio refuses files with a `v` it doesn't know and says to update. Adding a goal or a routine to the page doesn't change the format: its id simply becomes valid.
