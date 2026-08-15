# Benchmark methodology

`battery.mjs` is the battery (taxonomy, transform matrix, per-language suites,
and what each rival claims); `compare.mjs` runs it; `results.txt` is the
committed output of a full run. This document exists because a profanity
benchmark published by the author of one of the libraries in it is worth exactly
as much as its methodology, and no more.

## Why the battery was rebuilt, twice

The version before this one opened with two suites lifted verbatim from a
rival's own `compare-libraries.mjs`. The intent was comparability with their
published table; the effect was a general-evasion section testing the cases
*they* had chosen to be good at — a biased sample however carefully run. Those
suites are gone: not relabelled, not demoted, removed. Nothing in the current
battery is taken from another library's test files, README examples or issue
tracker. One qualification — about a dozen of the *words* in the C1 Scunthorpe
axis (scunthorpe, classic, assassin, grass, analysis, cocktail, therapist,
shiitake) are the canonical traps of this problem domain and appear in
everybody's tests. They are public knowledge, not anyone's invention, and are
used here in sentences of our own.

That rebuild was then audited adversarially, and the audit found three
structural distortions that all pushed the same way. They are recorded rather
than quietly fixed, because a methodology document that lists only the rules and
never the times the rules failed is not evidence of anything.

1. **Six whole classes of English evasion had no axis at all** — partial-token
   split (`fu ck`), vowel deletion (`fck`), phonetic respelling (`fuk`, `azz`),
   two-or-more combined transforms, Latin Extended confusables (`shıt`), and
   two-or-more interior non-letters (`f..uck`) — every one a class where a
   whole-token fold-then-lookup engine is structurally weak. All six now have
   axes: E5.9/E5.10, E12.1, E12.2/E12.3, E13.1–E13.6, E1.13, E2.6.
2. **The transform matrix was replicated across the Indic packs only where the
   engine wins.** 15 of the 20 replicated axes were 100% passes and exactly one a
   100% failure; of the 34 axes left English-only, 17 were 100% failures. That
   asymmetry — not any per-case cherry-pick — turned 64% on English into an 85%
   headline.
3. **The clean side was padded and, on its riskiest axis, shaped to the
   allowlist.** 60 of 367 clean "cases" were the same text counted two to four
   times; and the caste axis, which claimed to test neutral use, tested the exact
   collocations the packs allowlist (`the Chamar Regiment was raised in 1943`)
   while ordinary use of the same term was a false positive.

The audit attacked two things and could not break them: the rival
configurations were fair and are unchanged here (see "Fairness to the other
libraries"), and the committed `results.txt` reproduced from the committed
battery — it still does, being nothing but the output of the one command under
"Reproducing".

## The rule the battery is built around

**Design the taxonomy first. Instantiate cases from the taxonomy. Run.
Report.** In that order, and not iterating the case set after seeing the
results. The failure mode this guards against is invisible in a diff: an author
runs the battery, sees a case fail, and quietly deletes it or files it as "out
of scope"; the finished file then looks like a fair test the author happened to
pass. Four mechanisms enforce it, the fourth answering finding 2 above:

1. **The taxonomy is written down, in the file, above the cases.** Every case
   cites the axis it instantiates; `compare.mjs` throws if a case cites an
   undeclared axis, and reports any declared axis with no case.
2. **No case is annotated with an expected outcome.** No `expectedMiss: true`,
   no commented-out case, no "known gaps" array — the KNOWN GAPS section is
   *computed from the run*. A case cannot be reclassified from failure to
   expectation without deleting it outright, which is a visible deletion of a
   line that cites an axis.
3. **The cases were not built by reading the dictionary**, i.e. not by grepping
   `src/data/*.ts` for something that would match. Each language declares a
   handful of **base forms** and a handful of **E0 control** cases whose only job
   is to prove those bases are listed at all; every generated evasion case is one
   of those bases with exactly one transform applied, so when a transformed case
   misses and its control hits, the transform is what failed.
4. **Most evasion cases are GENERATED, not written.** `battery.mjs` declares
   `LATIN_MATRIX` — one transform *function* per language-independent axis — and
   `compare.mjs` applies the whole list to every language. There is nowhere in
   either file that an author chooses which transforms a language receives: a
   transform the engine fails is applied to all eleven languages exactly as a
   transform it passes is. The output proves this rather than asserting it — the
   BATTERY COMPOSITION table prints, per language, how many cases were generated
   and how many hand-written, and names every axis that came out inapplicable
   (no leet-mappable letter in any base, no doubled letter, no base short
   enough), so selective replication would show up as a lopsided row.
   Hand-written cases remain only for the axes a function cannot express: a
   language's own morphology (E8), its transliteration spread (E9), its script's
   spelling doublets (S1, S2), script mixing (E7 — splitting a native word and
   appending a romanized tail needs a romanization, which is data), and lexicon
   breadth (E11).

### Two rules about how the axes are worded

Both fix the audit's finding that the taxonomy was partly written backwards,
derived from the engine rather than from attacker behaviour.

- **No axis is split at an implementation boundary.** The previous taxonomy had
  "Cyrillic homoglyphs, the common set" and "…beyond the common set" as two
  axes, weighted 14 cases to 4 — that list was the engine's `CONFUSABLE_MAP`
  transcribed. The axes now split on *attacker* behaviour: minimal substitution
  (one vowel, the way a person types it) versus maximal (every mappable letter,
  the way a homoglyph converter does it). The character tables are the standard
  Unicode confusable sets, deliberately including letters the engine does not
  fold.
- **No axis description carries the defender's verdict.** Three axes were
  annotated "(declared non-goal)" and one described its case as "an inflection,
  not a listed surface" — the engine's policy and dictionary written into what is
  supposed to describe attacker behaviour. The non-goals are declared below,
  where policy belongs, and their cases still score as misses.

### The one sanctioned feedback path, and the one case changed

Clean axis **C2** — "an English word, inflection or compound whose consonant
skeleton collides with a lemma" — is instantiated from the output of the C14
dictionary sweep, because that is the only way instances of that class are ever
found; nobody guesses "beancod", "Nimrodian" or "chain-pull" from a chair. That
path is **add-only**: a word the sweep shows being flagged is promoted into C2
so it counts in the headline totals, and nothing is ever removed from C2 because
it fails. It is called out because it is the one place the arrow runs from
results back to cases. The same feed lands in **C5** when the collision is
cross-language rather than skeleton; it has produced exactly one case so far,
`umbu-rana`, a real `web2a` compound (a Brazilian shrub) whose first token is
the romanization of a Tamil lemma, and it is a false positive in the committed
run.

One clean case was changed on linguistic grounds, disclosed here: the audit
reported `lanjam means bribe in Telugu` as a false positive, but the Telugu word
for bribe is లంచం, romanized *lancham*, and *lanjam* is not a spelling that word
takes — so the case was testing a premise that is not true. The battery carries
`lancham teesukovadam neram` instead. The other two romanized-Telugu cases the
audit found, `dengu jwaram vachindi` (dengue fever) and the Hindi `kutte ko
khana do`, are in the battery unchanged.

## The battery deliberately contains cases this package fails

This is the decision that makes the document worth publishing: a benchmark its
own author scores 100% on convinces nobody, because the first reader assumes the
test was written to fit the answer. The declared non-goals are in the battery and
score as misses, because "we decided not to" is a fact a reader should be able to
weigh rather than a reason to hide the row:

- a mask at a token edge (`*uck`, `fuc*`) and three or more masks (`f***`) —
  E4.3, E4.5;
- a spelled-out run shorter than four letters (`a s s`) — E5.8;
- `( → c` as a leet mapping, which would fold `(um` to `cum` and flag ordinary
  parentheticals — inside E1.3;
- concatenation into a longer token (`#FuckThis`) — E10.6 — the direct price of
  the whole-token rule that solves Scunthorpe.

Everything else in the miss list is derived from the run; `results.txt` prints
it in full, per axis, with the count of cases beside it.

## Fairness to the other libraries

Several rivals have no Indian-language support and never claimed any. Reporting
"0/88 Tamil" as a defeat would be dishonest, and a reader would notice.

- **What each library claims is recorded in the battery**, with the source it
  was read from (README section, `package.json`, `supported-languages.md`), at
  the versions pinned in `benchmark/package.json`.
- **Every library is run in its maximum claimed configuration**, the way a user
  who wanted that coverage would configure it, not at whatever its default
  happens to be: `allprofanity` gets `loadIndianLanguages()` (Hindi, Bengali,
  Tamil, Telugu on top of its default English + Hindi); `@2toad/profanity` gets
  `languages: ['en', 'hi']`, Hindi being one of the twelve locales it lists;
  remove-profanity gets all eleven packs.
- **Scorecard A is English, and it is the number to compare libraries on** — the
  only language all six claim, so the only place the same cases are scored
  against the same advertised capability. It is printed first, breaks out the
  generated subset separately, and is the number the README leads with.
- **Scorecard B — every language a library claims — is explicitly not a
  like-for-like comparison** and says so in the output: ten of the eleven suites
  are on ground five of the six libraries never claimed, so a high aggregate
  there is an artefact of a denominator. The previous version of this file
  labelled that card "the number to compare libraries on"; that label was wrong
  and has moved to Scorecard A.
- **Scorecard C reports the rest as coverage not attempted**, languages named,
  so the Indian-language rows read as coverage the others do not offer rather
  than as losses.
- **False positives count everywhere, claimed or not** (Scorecard D). The
  asymmetry is deliberate and is the one place a library is judged outside its
  claim: a filter that flags Malayalam prose while claiming only English is still
  breaking its user's app, and the user does not care that the README never
  promised Malayalam.

Two observations belong here rather than in a footnote, because both make a
rival look better or worse than the raw column does. **`@2toad/profanity` needs
a second flag before its Hindi works at all**: at its default `(?:\b|_)`
boundary — ASCII `\b` — a Devanagari entry cannot match anything, not even
itself handed back verbatim, because a Devanagari string contains no
`\w`/non-`\w` transition. Its opt-in `unicodeWordBoundaries: true` fixes this,
so the battery runs it with that flag as well as `languages: ['en', 'hi']`;
scoring it at the default would have measured a configuration flag rather than
the library. Its Hindi rows are still near zero, but now for a reason genuinely
about the library — its Hindi list reads as machine-translated (गेंद "ball",
शस्त्र "weapon", none of the common Hindi profanity). And **`obscenity`'s high
dictionary-sweep count is substring leakage, spread wide**, not one family:
`cryptanalysis`, `epanalepsis`, `Gentianales`, `Pandanales` (from `anal`),
`cumin`, `Cumaean`, `cuminseed` (from `cum`), `Fagus`, `Fagara` (from `fag`),
`assonant`, `intravaginal`, `pissant`, `pretardy`, `boobyish`. Its protection on
the *classic* traps is intact — `Scunthorpe`, `classic`, `assassin`,
`associate`, `cockatoo` are all clean — so this is a per-pattern boundary gap
rather than a missing mechanism, and the report prints an evenly spaced sample
so a reader can judge without taking this paragraph's word for it.

## The caste terms, and where they sit

The packs deliberately flag the caste **epithets** — chamar, bhangi, paraiyan,
pulayan, chuhra, madigodu and their siblings — and deliberately do **not** flag
the varna and category terms (shudra, soothiran, "low caste"), which were
removed from the packs on 2026-08-14 precisely so that writing *about* caste is
not censored. The test applied was: is the word an epithet aimed at a person, or
a category written about?

The battery follows that line rather than blurring it: the epithets are
**evasion** cases (axis E11), scored as intended hits; **C4** tests the community
self-names (Valmiki, Ravidassia, Vankar, Meghwal, Namasudra, Holeya, Paraiyar,
Pulaya), the varna and category terms, and anti-caste discourse.

The previous version put the epithets on the *clean* side, each wrapped in the
one collocation its pack allowlists, which measured the allowlist rather than the
axis. To make that failure mode visible rather than merely promised, the report
prints an **ALLOWLIST DEPENDENCE** section: every clean case whose text contains
a shipped allow phrase, computed from the pack data. Not a defect by itself — an
allow phrase is a shipped mechanism — but a clean suite made entirely of
allowlist phrases would score a perfect zero while testing nothing, and that is
not visible any other way.

## What is measured

- **Evasion suites** (`want HIT`): per language, E0 controls plus the generated
  matrix plus the named cases. 84–89 cases per language, 61–67 of them generated
  by the same functions everywhere; 952 across eleven languages.
- **Clean suites** (`want ok`): per language, plus a cross-language collision
  suite that only exists when several packs are loaded. **Every text is
  distinct** — the runner throws if one appears in two suites, so the clean count
  counts distinct texts, not rows. It is smaller than the evasion suite (486
  against 952) and the report says so; the bulk clean measurement is C14 below.
- **Battery composition** (generated / named / control per language, and the
  axes that came out inapplicable — the check on rule 4), **allowlist
  dependence** (which clean cases contain a shipped allow phrase), and **tier
  coverage** (which of the four tiers resolved each caught case, from `scan()`).
- **Pack isolation**: every language suite re-run with *only* that pack loaded,
  diffed against the all-packs run. Both are shipped configurations, since a
  consumer may import a single subpath, and they differ in both directions — a
  pack alone can miss a word it borrows from a neighbour, and a pack alone is
  free of the other packs' allow phrases, which are global once loaded.
- **C14, the dictionary sweep**: every library against `/usr/share/dict/web2`,
  its regular English inflections and `web2a` (compounds and phrases) —
  1,771,208 forms, 400 s of the run. The headword list alone cannot see
  `shuddered`, `calloused`, `chain-pull` or `can-polishing`; the forms that
  actually collide are the inflections and compounds. It is the fairest single
  number here, because every library claims English. Reported apart from the
  headline totals because it would swamp them, and because it is an **upper
  bound** on false positives rather than a pure count — the dictionary genuinely
  contains profanity. Hits are split into a consensus set (flagged by ≥4 of 6)
  and an idiosyncratic set (flagged by exactly one).
- **Performance**: all six libraries in the same maximum claimed configurations,
  over ASCII, mixed prose, Devanagari, Tamil, Bengali and Gurmukhi corpora — a
  Latin-only corpus hides the cost of the Indic path entirely. Seven blocks:

| Block | What it reports, and why that form |
|---|---|
| Construction | **cold** — the first construction in the process, captured at module load, which is what a serverless cold start pays — and the **median, min and max of seven further constructions** warm. They differ by up to an order of magnitude, and only the cold one is a cold start. `leo-profanity` has no constructor (its dictionary is a module singleton loaded at import), so its figure is an explicit reload of the `en` list it already holds. |
| ms per check | **Median of seven trials**, each the mean over many in-process iterations — median rather than one run, because one run at 20k words is dominated by whichever trial collides with a GC. |
| µs per 1,000 words | The same medians divided by document size: the normalized figure for comparing rows of different lengths. Raw ms are kept, not replaced. The 10-word rows run high for every library because they are fixed per-call overhead rather than text cost. |
| Spread | **min–max** of the same seven trials per cell. Where two libraries' ranges overlap, the ordering of that pair is not a result. |
| Spans, not booleans | `scan()` against `obscenity`'s `getAllMatches()`, in its own table. `obscenity` is the only rival reporting positions; the other four are absent rather than scored zero, because there is no call to score. The block says what each hands back. |
| Early-exit anatomy | A single profane word moved through a 20k-word document, with the per-text preparation priced on its own and `leo-profanity` as a control that also stops at the match. |
| Cost vs dictionary size | Matchers built from `en`, `en`+`hi`, `en`+`hi`+`ta`+`bn` and all eleven — a nested chain, so its marginal column always means "what the packs on this row cost on top of the row above" — plus `hi` alone as an off-chain reference. Always runs over the full pack roster, independent of `RP_PACKS`. |

Two caveats the perf section prints for itself. It runs **last**, in a process
that has already pushed the whole battery through every library: in a fresh
ASCII-only process this package's Latin rows come out roughly half of what is
published, and no rival's move — the published figure is what a mixed-traffic
application sees, which is the conservative direction for the library being
defended. And the dictionary-scaling rows are comparable to each other, not to
the grid above them, measured earlier in the same run.

## Reproducing

```
npm run build && node benchmark/compare.mjs > benchmark/results.txt
```

About seven minutes, almost all of it the C14 sweep. `RP_PACKS` narrows the
matcher and the suites together; `RP_DICT=headwords`, `RP_SKIP_DICT=1` and
`RP_SKIP_PERF=1` cut the run down while iterating. The numbers in `README.md`
and `docs/benchmarks.md` come from a full eleven-pack run and must match
`results.txt` exactly.
