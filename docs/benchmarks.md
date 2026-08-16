# Benchmarks

Every measured claim this project makes, with the unflattering readings kept in.
Every number comes from [../benchmark/results.txt](../benchmark/results.txt) —
one run of `npm run build && node benchmark/compare.mjs` (packs `[hi, en, ta,
or, bn, mr, te, kn, ml, pa, gu]`, 338 lemmas, node v22.22.3, darwin/arm64;
~8.5 min, or ~2 with `RP_SKIP_DICT=1` for the perf rows).

> Profane examples are masked with `*`. Clean-case texts are quoted verbatim,
> because the whole point of a false positive is that the word is innocent.

The battery is this project's own: a taxonomy of 97 axes written down first,
cases instantiated from it, run against the five rivals each in its **maximum
claimed configuration**, nothing taken from another library's tests, README or
issue tracker. **Most evasion cases are generated** — one transform function per
axis applied to all eleven languages, so nobody can hand a language the easy
transforms — and the battery **deliberately contains cases this package fails**
(151 of 952, with no expected outcome on any case, so a red row cannot be
quietly reclassified). Rivals: `@2toad` gets its opt-in `unicodeWordBoundaries`
flag plus `languages: ['en','hi']`, without which a Devanagari entry cannot
match anything at all; `allprofanity` gets `loadIndianLanguages()`; `obscenity`
its recommended transformers. Full rules and the adversarial audit that rebuilt
the battery: [../benchmark/METHODOLOGY.md](../benchmark/METHODOLOGY.md).

## English evasion — the head-to-head

The only like-for-like comparison, English being the only language all six
claim, and the number to compare on. **remove-profanity comes first, and is one
of only two libraries doing it with three or fewer false positives.**

| Library | English evasion (88) | of which generated (61) | named (20) | control (7) | False positives (486 clean) |
|---|---|---|---|---|---|
| **remove-profanity** | **81 (92%)** | **54 (89%)** | 20 | 7 | **3** |
| obscenity | 61 (69%) | 40 (66%) | 14 | 7 | 10 |
| allprofanity | 57 (65%) | 38 (62%) | 12 | 7 | 28 |
| bad-words | 39 (44%) | 15 (25%) | 17 | 7 | **3** |
| @2toad/profanity | 38 (43%) | 17 (28%) | 14 | 7 | 14 |
| leo-profanity | 18 (20%) | 4 (7%) | 7 | 7 | 4 |

Seven of the 88 English cases are missed here — token-edge masks,
disemvowelling, two-chunk splits, leet punctuation, a standalone letter beside a
spelled-out run, an inflected spelled-out run, three-transform combinations —
all [priced below](#which-tier-does-the-work-and-what-is-missed). `obscenity`'s
pattern-side wildcards catch `f4ck`, `fu.c*`, `fck` and `ffuuc*kk`; three of the
four are caught here too, as whole-token matcher rules rather than folds, and
`fck` is deliberately left on the table because FCK is how two football clubs
write their own names. That approach's cost shows up in the [dictionary
sweep](#the-dictionary-sweep). Per-axis grid: `results.txt`, SCORECARD A.

## Indian languages — coverage the others do not attempt

Three of the five rivals advertise no Indian-language support at all, so a zero
there is not a defeat and is not reported as one. `@2toad`'s Hindi list reads as
machine-translated — it contains गेंद ("ball") and शस्त्र ("weapon") and none of
the common Hindi profanity.

| Library | Indian suites *claimed* | caught there | on suites it does not claim | all claimed suites | caught | rate |
|---|---|---|---|---|---|---|
| **remove-profanity** | hi bn mr pa gu or ta te kn ml | **720 / 864 (83%)** | — (claims all) | + en | 801 / 952 | 84% |
| allprofanity | hi bn ta te | 182 / 348 (52%) | 41 / 516 (8%) | + en | 239 / 436 | 55% |
| @2toad/profanity | hi | 1 / 89 (1%) | 22 / 775 (3%) | + en | 39 / 177 | 22% |
| obscenity | none | — | 0 / 864 | en | 61 / 88 | 69% |
| bad-words | none | — | 0 / 864 | en | 39 / 88 | 44% |
| leo-profanity | none | — | 0 / 864 | en | 18 / 88 | 20% |

The right-hand columns are **not** a like-for-like scorecard and must not be
quoted as one — the denominators differ and remove-profanity is scored on ten
languages no rival contests. They answer a different question: "across
everything this library says it does, how much does it catch?"

Per suite, evasion cases caught and false positives produced (`n/c` in
`results.txt` marks a language a library does not claim; those misses are not
counted against it):

| Suite | caught | false pos | | Suite | caught | false pos |
|---|---|---|---|---|---|---|
| hindi + hinglish | 77 / 89 | 0 / 43 | | telugu + tenglish | 66 / 86 | 0 / 26 |
| english | 81 / 88 | 0 / 120 | | kannada + kanglish | 65 / 85 | 0 / 22 |
| tamil + tanglish | 74 / 88 | 0 / 29 | | malayalam + manglish | 72 / 84 | 0 / 23 |
| odia + odlish | 71 / 86 | 0 / 25 | | punjabi + punglish | 71 / 86 | 0 / 26 |
| bengali + banglish | 74 / 85 | 0 / 33 | | gujarati | 72 / 86 | 0 / 27 |
| marathi | 78 / 89 | 1 / 29 | | cross-language collisions | — | 2 / 83 |

### Pack isolation

Each pack alone against its own suite versus with all eleven loaded — the
measurement behind "every pack is self-sufficient". Every row is zero except
two: Malayalam is the one pack that gains from company, and Marathi gains a
false positive, which is the cross-language cost of loading packs you do not
need ([usage.md](usage.md#choosing-which-packs-to-load)).

| Pack | caught alone | caught with all 11 | FP alone | FP with all 11 |
|---|---|---|---|---|
| ml | **70/84** | **72/84** | 0/23 | 0/23 |
| mr | 78/89 | 78/89 | 0/29 | **1/29** |
| hi, en, ta, or, bn, te, kn, pa, gu | identical | identical | 0 | 0 |

## Clean text

486 distinct clean cases — the runner throws if one text is counted twice. The
per-library counts are the last column of the head-to-head table above:
remove-profanity and `bad-words` 3, `leo-profanity` 4, `obscenity` 10, `@2toad`
14, `allprofanity` 28. **Our three are real, and all in the committed output:**

| Suite | Case | What fired | Text |
|---|---|---|---|
| mr-clean | no school today | the Bengali entry, exact tier | `aaj shala nahi` |
| cross-clean | Suar town (UP) | the Hindi entry, exact tier | `Suar is a town in Rampur district` |
| cross-clean | umbu-rana (bot.) | the Tamil entry, exact tier | `umbu-rana is a Brazilian shrub` |

All three are cross-language collisions — a word innocent in one language that
is listed in another. Loading only the packs you need removes the first two.

### The dictionary sweep

**1,771,208 English forms** — `/usr/share/dict/web2`, its regular inflections
and the `web2a` compounds. An upper bound rather than a pure count, since the
dictionary genuinely contains profanity. The middle two columns are what matter
(real English somebody could type); the last is the inflection generator
over-producing, where a hit is noise.

| Library | Sweep hits /1,771,208 | Real headwords /235,976 | Real compounds /76,175 | Generated /1,459,057 |
|---|---|---|---|---|
| leo-profanity | 404 (0.023%) | 101 | 287 | 16 |
| **remove-profanity** | 464 (0.026%) | **46** | **247** | 171 |
| @2toad/profanity | 536 (0.030%) | 96 | 404 | 36 |
| bad-words | 795 (0.045%) | 115 | 640 | 40 |
| allprofanity | 874 (0.049%) | 173 | 422 | 279 |
| obscenity | 4537 (0.256%) | 567 | 324 | 3646 |

**`leo-profanity` edges it on the total** while trailing on both real-word
columns; its lead is flagging almost nothing among the 1.46M generated forms —
16 against 171, the price of the phonetic skeleton tier, paid on strings nobody
types. All 46 of our headword hits are words the packs mean to flag, and 246 of
the 247 compound hits contain an English profanity as a whole token (`bast*rd
ash`, `ball c*ck`, `pr*ck song` — the dictionary's own botanical and mechanical
vocabulary), the odd one out being `umbu-rana`, which is in the battery as a
case. `obscenity`'s 4537 is substring leakage spread wide — `cryptanalysis`,
`cuminseed`, `Gentianales`.

### The allowlists are not what is doing the work

Rebuild the matcher with every pack-wide and per-entry allowlist emptied and
re-run the clean side: of 486 cases, **455 are carried by the whole-token
boundary rule**, 28 by an allowlist, and 3 were already false positives. Of the
42 Scunthorpe-class cases, 3 are allowlist-carried. The 28, and what fires
without them, are listed individually in `results.txt` under ALLOWLIST
DEPENDENCE (`moby dick`, `cum laude`, `great tit`, `banked`, `bounced`,
`motorcade`, `Lund University`, `dengue`, `Lanja taluka`, `புண்டரீகம்`…) —
printed so the claim is checkable rather than asserted.
[matching.md](matching.md#the-allowlist-mechanism) explains the mechanism.

## Which tier does the work, and what is missed

Tier that resolved each caught evasion case (a case can count under more than
one tier): `exact` 603, `separated` 108, `masked` 86, `skeleton` 4. The skeleton
tier's four is not a measure of its worth — its job is the spellings nobody has
written down, which a benchmark of enumerated transforms cannot contain by
construction.

**151 of 952 evasion cases are missed.** Accepted **for now** rather than
settled. The full list, derived from the run rather than hand-written, is in
`results.txt` under KNOWN GAPS; each miss is priced against the innocent text
that keeps it out in
[matching.md](matching.md#what-it-deliberately-does-not-catch). The classes,
largest first:

| Axis | Cases | Class |
|---|---|---|
| E7.1/E7.2 | 20 | **Script mixing fails completely** — `मा*archod` and its siblings, one case in each direction for every pack that has a script. The roadmap item, quantified. |
| E12.2/E12.3 | 15 | Phonetic respellings not curated |
| E5.6 | 11 | A standalone letter beside a spelled-out run |
| E5.9 | 11 | Two space-separated chunks (`fu c*`) |
| E4.5 | 11 | Masks at a token edge (`*uck`, `fuc*`, `f***`) |
| E5.7 | 10 | Spelled-out runs of inflected forms |
| E2.4 | 10 | A variation selector inside native script |
| E12.1 | 10 | Disemvowelling (`fck`) |
| E13.6 | 8 | Three transforms at once |
| E1.3 | 6 | Leet punctuation as letters (`fu(k`) |
| — | few | A doubled separator (`f..uc*`); mask-plus-stretch (`5HII*T`) |

**Three romanizations are deliberately unlisted** because they cannot be told
apart from ordinary words: `magi` (bn — the Magi, Maggi), `boli` (kn — Hindi
for "speech"), `kundan` (ml — Kundan jewellery). They are in the battery as
controls and score as misses; the native-script spellings are listed.

## Speed

Same six libraries, same maximum claimed configurations. `isClean()` against
each rival's boolean check. Median of seven trials, ms per check.

| Text | remove-profanity | leo-profanity | @2toad/profanity | allprofanity | bad-words | obscenity |
|---|---|---|---|---|---|---|
| short profane (10w) | 0.002 | 0.000 | 0.000 | 0.000 | 0.200 | 0.009 |
| short clean (10w) | 0.003 | 0.000 | 0.001 | 0.003 | 0.200 | 0.013 |
| medium clean (1k w) | 0.102 | 0.033 | 0.113 | 0.194 | 0.928 | 0.613 |
| medium profane (1k w) | 0.022 | 0.020 | 0.001 | 0.000 | 0.956 | 0.568 |
| **large clean (20k w)** | **1.987** | **0.658** | **2.228** | **3.795** | **8.667** | **11.529** |
| large profane (20k w) | 0.347 | 0.393 | 0.006 | 0.006 | 8.608 | 10.637 |
| prose (20k w) | 6.695 | 0.983 | 5.479 | 12.455 | 7.602 | 11.322 |
| devanagari (20k w) | 6.359 | 0.803 | 3.660 | 9.195 | 4.915 | 7.048 |
| tamil (20k w) | 9.425 | 0.887 | 2.808 | 15.691 | 8.424 | 14.226 |
| bengali (20k w) | 6.707 | 0.845 | 2.074 | 11.021 | 5.709 | 9.331 |
| gurmukhi (20k w) | 4.691 | 0.780 | 1.608 | 7.304 | 4.439 | 6.879 |

That bold row per 1,000 words, with the min–max of the same seven trials:
leo-profanity 32.9 µs (0.648–0.675 ms) · **remove-profanity 99.4 µs
(1.940–5.053)** · @2toad 111.4 µs (2.219–2.256) · allprofanity 189.8 µs
(3.771–3.810) · bad-words 433.4 µs (8.496–8.853) · obscenity 576.5 µs
(11.515–11.582).

**Read that honestly.** On the one squarely like-for-like row — 20k words of
Latin text, which all six claim — this package is **second of six** by median,
1.9x faster than `allprofanity` while carrying eleven packs and returning spans.
Its ordering against `@2toad` is within noise by this file's own rule (its worst
of seven trials, 5.053, one GC, straddles `@2toad`'s median), so call that pair
level. `leo-profanity` is 3x faster still, and is a lowercase-and-hash-lookup
catching 18 of 88 English evasion cases. **On the native-script rows it is
fourth**: `leo-profanity`, `@2toad` and `bad-words` lead on Devanagari and
Tamil, and two of the three detect nothing in those scripts at all — they are
fast there because they do nothing there. On mixed-case prose it is third.

The clean rows are the fairest single comparison, since nobody exits early on
them; `allprofanity` and `@2toad` answer a 20k-word *profane* document in
0.006 ms by scanning raw lowercase text before any normalisation exists, a real
advantage on profane input and theirs. The min–max column is there so you can
check the ordering — the rivals' spreads are tight, our max on several rows is
one GC-hit trial, and the medians are what the tables rank. The 2026-08-15 speed
program took the Latin row from 11.815 ms and **fourth place** to this, every
accuracy figure byte-identical before and after; what it changed, and the
invariants that keep the win, are in [performance.md](performance.md).

### Construction

One-time, ms. Amortized across every check — real for a serverless cold start,
irrelevant for a long-lived chat server.

| Library | cold | rebuild median | rebuild min–max |
|---|---|---|---|
| **remove-profanity** (11 packs) | **33.71** | 11.50 | 10.73–12.55 |
| allprofanity | 3.38 | 0.35 | 0.33–1.92 |
| obscenity | 0.45 | 0.11 | 0.09–0.15 |
| leo-profanity | 0.06 | 0.01 | 0.01–0.03 |
| bad-words | 0.04 | 0.00 | 0.00–0.01 |
| @2toad/profanity | 0.01 | 0.00 | 0.00–0.01 |

33.71 ms cold is **10x the next largest here** (a fresh process measures 30–34;
the pre-speed-program figure was 26.80). Budget for it if you rebuild the
matcher per request, which you should not — a 10-word chat message costs
0.003 ms. `leo-profanity` has no constructor, so its figure is an explicit
reload of the `en` list it already has.

### Spans, not a boolean

`obscenity` is the only rival reporting match positions, so this is the one
like-for-like row for a consumer who needs to know *where* the match is; the
other four have no equivalent call and are omitted rather than scored zero.

| Call | 20k ASCII, ms | µs / 1k words | 20k Devanagari, ms | Returns |
|---|---|---|---|---|
| `remove-profanity` `scan()` | 1.910 | 95.5 | 6.185 | lemma, surface, tier, language, severity, categories, span |
| `obscenity` `getAllMatches()` | 11.949 | 597.4 | 7.308 | term id and indices; caller resolves the word |

On Latin text `scan()` is 6x faster and hands back more; on Devanagari it is
1.2x faster, and `obscenity` finds nothing there.

### What `isClean()`'s early exit actually saves

`isClean()` stops at the first candidate it can prove survives, streaming its
exact tier. What no exit skips is the per-text preparation — the code-unit
array, its one profile sweep, and any fold the text needs. On 20k words:

| Measurement | median ms |
|---|---|
| `isClean()`, no match | 1.944 |
| `isClean()`, profane at word 0 / 10000 / 19999 | 0.329 / 0.521 / 0.719 |
| `scan()`, no match / profane at word 0 | 1.869 / 2.305 |
| the preparation alone (unit array, profile, three eager fold passes) | 0.209 |
| `leo.check()` control, no match / profane at word 0 | 0.641 / 0.392 |

The position-0 row is the floor (preparation plus one window of the exact tier);
the gap to position 19999 is the exact-tier walk a late match still pays, and
nothing after the exact tier runs once a candidate survives. It is **not** the
constant-time exit `allprofanity` and `@2toad` get, and cannot be while the
preparation is whole-text. **On clean text `isClean()` and `scan()` cost the
same — pick whichever returns what you need.**

### Why more languages are nearly free

A check is a fixed number of Aho-Corasick passes, one per fold stage, and an
automaton searches for every pattern at once: the dictionary changes the
automaton's size, never the number of passes, so cost is O(text), not
O(text × dictionary). The usual alternative is one regex per blacklisted term —
`obscenity` compiles its English dataset to 119 terms and makes 119 passes per
check. One matcher per pack subset, same texts, timed back to back:

| Packs | Lemmas | 20k ASCII, ms | prose 20k, ms | Devanagari 20k, ms | marginal vs the row above |
|---|---|---|---|---|---|
| en | 70 | 1.026 | 5.653 | 5.010 | — |
| en+hi | 126 | 1.949 | 6.651 | 6.300 | +90% |
| en+hi+ta+bn | 187 | 1.944 | 6.553 | 6.309 | −0% |
| all 11 | 338 | 1.949 | 6.622 | 6.256 | 0% |
| hi alone (reference) | 56 | 1.910 | 6.595 | 6.281 | — |

Strongly sub-linear and **not flat**. Lemma count does not drive the cost — the
56-lemma Hindi pack *alone* costs more on pure ASCII (1.910) than the 70-lemma
English pack (1.026), because what a pack contributes is surface patterns and
live tiers, for Hindi the phonetic skeleton pass, not headwords. And the curve
flattens hard rather than staying level: the first pack added to English is the
expensive one, and the nine after `en+hi` add 212 lemmas for a few percent
between them. "Sub-linear, and flat once the tiers are live" is the honest
description; "flat in dictionary size" is not. These rows are comparable to each
other, same process back to back, and **not** to the grid above.

**Timing runs must be quiet.** The perf section runs last, after the battery and
the dictionary sweep; a test suite or a build running during it inflates the
rebuild-construction column and the maxes, and if that happened, re-run. Rank by
the medians. Every number in this repository's documentation must be traceable
to a full eleven-pack run of `benchmark/results.txt`.
