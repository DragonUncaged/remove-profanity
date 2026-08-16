# How matching works

What `remove-profanity` catches, how, and what it deliberately does not catch.

> **Masked examples.** Profane words here have one letter replaced by `*`
> (`f*ck`, `bahanch*d`, `बहन*ोद`). The *shapes* are real; the literal strings
> mostly are not, so do not paste one into a test and expect the described tier
> to fire. `SPEC.md` is the per-module contract; this is the readable version.

Related: [usage.md](usage.md) (the API),
[benchmarks.md](benchmarks.md) (what all of this scores),
[language-packs.md](language-packs.md) (adding a language).

**The problem this is built around:** romanized Indian languages have no fixed
spelling. The same word appears as `ch*tiya`, `ch*tia`, `ch*tya`, `ch*t1ya`,
and a curated list can never contain all of them. Everything below follows.

## The four tiers

A check runs a fixed number of passes over the text, each an Aho-Corasick
automaton searching for every pattern at once.

| Tier | Catches | Notes |
|---|---|---|
| `exact` | Curated surface forms, normalized hard: NFC, zero-width stripping, confusable and leetspeak folding, letter-stretch collapsing | High precision — safe to auto-censor |
| `masked` | `f*ck`, `b***h`, `bh#sd*ke`, `चू*िया` — one to three masks from `* # @ $ %`, never at a token edge | Off with `maskedTier: false` |
| `separated` | `f u c *`, `s.h.i.*`, `b-i-t-c-*`, and chunked `fu.c*` / `as sh o*e` | The most constrained tier; its locks are [below](#the-separated-tiers-locks) |
| `skeleton` | A phonetic consonant skeleton collapsing aspiration (bh/b), vowel length (aa/a), retroflex/dental (t/ṭ), so `behench*d` ≡ `bahanch*d` ≡ `bhainch*d` from one entry | High recall. `skeletonTier`: `true` (default), `false`, `'flag'`. Entries opt out with `skeletonSafe: false` |

In the `masked` tier an *unresolvable* leet digit counts as a mask: `f4ck`
folds to `fack`, which matches nothing, so the `4` is retried as a wildcard —
under locks that keep `T2T`, `b2b`, `4chan`, `covid19` and postcodes clean. An
interior emoji is a deletable mask (`fu🔥c*`). Digit folding is decided **per
token, asymmetrically**: a letter-led token keeps literal adjacency (the A55
road must never fold into a profanity); a digit-led token folds whole or not at
all (`5h17`'s trailing `7` has no letter neighbour).

The `separated` tier is worth calling out. `obscenity` built the same idea and
then **turned it off** — `skipNonAlphabeticTransformer` is commented out of its
English preset with the note `// See #23 and #46`, i.e. false positives. It is
shipped and on here because the rule that deletes separators is a **whole-token
matcher tier, not a fold**: a separator-deleting fold would turn "a.m." into
"am" for the whole dictionary at once, whereas a tier applies the same idea to
one candidate span and can demand evidence before accepting it.

The skeleton tier resolves 4 benchmark evasion cases the other tiers do not
reach; its real job is the spellings nobody has written down yet.

## The fold pipeline

Folds are string-level rewrites that run *before* matching, each carrying an
offset map back to the original text, so reported spans always index the string
you passed in.

`baseFold` is the high-precision chain feeding the `exact` tier. Because a fold
rewrites every word of the language, the correctness bar there is absolute: **a
fold must never be a recall guess** — recall guesses belong in a pack's
`variants` or in the skeleton tier. An obfuscation that would need a fold to
*delete* characters between letters (masks, separators) is a whole-token matcher
rule instead, precisely so it cannot rewrite unrelated words.

What the pipeline folds: Unicode NFC; zero-width and format characters (ZWSP,
ZWJ, ZWNJ, variation selectors, CGJ), so ZWJ injection cannot evade matching;
confusables (the full Cyrillic and Greek homoglyph sets, Mathematical
Alphanumeric Symbols, Enclosed Alphanumerics, fullwidth forms, small capitals
and modifier letters); leetspeak substitutions under the per-token locks above;
combining marks on **Latin** bases only (`f́úć*` — Indic combining marks are
orthography and are never touched); letter-stretch collapsing and initial
doubling; and per-script Indic orthography, from the data table in
`src/unicode/indic-scripts.ts`.

## Unicode done right for Indic text

Word boundaries come from Unicode properties (`\p{L}\p{M}\p{N}`), never ASCII
`\b`, which is broken for Devanagari. Censoring works in grapheme clusters, so
an Indic match masks cleanly instead of leaving orphaned matras behind.

Per-script orthography is a data table, not hard-coded branching, and each
script gets its own rules rather than its neighbour's: Devanagari the nukta,
anusvara and Marathi eyelash reph; Bengali khanda ta and hosonto runs; Gurmukhi
tippi/bindi unified but a deliberately *unfolded* addak, because Punjabi
gemination is phonemic; Gujarati and Odia candrabindu and nukta; Tamil aytham
and the grantha letters; Telugu and Kannada the sunna, so అన్త ≡ అంత; Malayalam
chillu expansion, which also makes the pre-reform and reformed spellings one key
(നായിൻറെ ≡ നായിന്റെ) — and deliberately *not* the anusvara rule its two
neighbours take, because Malayalam writes those clusters only as conjuncts. The
full table, with the reasoning for every rule deliberately absent, is in
[language-packs.md](language-packs.md).

**Languages that attach case suffixes.** The Dravidian languages glue suffixes
onto stems (பு*்டை → பு*்டைக்கு) and Odia does the same (ଗା*୍ଡି → ଗା*୍ଡିରେ), so
entries that need it match on the stem (`matchMode: 'prefix'`) and censor the
whole token — each fenced by an allowlist and a boundary test so it does not
swallow குதிரை ("horse"), புண்டரீகம் ("lotus"), ଗାଣ୍ଡିବ (Arjuna's bow),
"dengue", or ಬೋಳಿಸು ("to shave"). Where the innocent words sharing a stem are an
**open** set — every Kunna- place name in Kerala — the entry stays in word mode,
because no allowlist could ever be complete. Punjabi and Gujarati mark case with
free-standing postpositions and use no prefix entries at all.

## Whole-token matching beats the Scunthorpe problem

Every pattern must span a complete token, and the boundary is computed with
Unicode properties and re-checked against the **original** text, so a fold can
never manufacture a false interior. `Scunthorpe` is clean because the boundary
test rejects it before any allowlist is consulted — and this **generalises to
words nobody listed**: `Penistone` is clean here and appears in no allowlist of
ours, while `obscenity` flags it. Same for `Middlesex`, `cocktail`, `assassin`,
`shiitake`.

The corollary for contributors: close a recall gap on the **dictionary** side,
never by loosening the token boundary. Inflection and gemination families are
generated inside each pack at module load, and the engine never learns they
exist.

## The allowlist mechanism

Allowlists are the second line, and a narrow one. They earn their keep in the
two places a boundary test cannot see: **multi-word and prefix-mode collisions**
(`Lund University`, `moby dick`, `kuthirai`, `புண்டரீகம்`) and **skeleton-tier
collisions** (`banked`, `bounced`, `benched`, `motorcade`, `besodden`). Two
levels exist — a pack-wide `allowlist` of phrases and a per-entry `allowlist` —
plus the user's `customAllowlist`.

**Allowlist scope is global across loaded packs.** A phrase declared by one
pack suppresses matches from every loaded pack. That sounds dangerous and is
measured not to be: across 1.69M dictionary forms plus the clean corpus, with
eleven packs loaded, 127 allowlist suppressions fire and **zero** are one
pack's phrase silencing another pack's entry. What keeps that zero is data
discipline — every allow phrase a lemma needs lives in the pack that owns it.

**Most pack-wide entries protect nothing**, and that is the system working.
Measured, 17 of 306 pack-wide phrases are load-bearing; the entire English
list, `scunthorpe` included, is inert, because the boundary rule was already
doing the work. `test/allowlist-liveness.test.ts` enforces that a new phrase is
either live or has its reason written down.

The benchmark measures the same thing from the other end: empty every allowlist
in every pack and **455 of the 486 clean cases stay clean**, 28 flip, 3 were
already false positives. Of the 42 Scunthorpe-class cases, 3 flip. Printed in
`benchmark/results.txt`, so the claim is checkable rather than asserted.
`test/scunthorpe.test.ts` enforces the clean corpus.

## Severity and categories

Every entry carries a severity 0–4 and a set of categories, so you filter at
the level your product needs rather than the level the word-list author chose.

**Severity:** 4 = extreme slurs / sexual-violence terms · 3 = strong profanity
· 2 = moderate insults · 1 = mild insults.
**Categories:** `slur`, `casteist`, `religious`, `gendered`, `sexual`,
`ableist`, `violence`, `general`.

`minSeverity` defaults to `0`, so out of the box **everything the loaded packs
list is reported**; narrow it on `createMatcher`
(see [usage.md](usage.md#creatematcher)). `casualUse: true` marks entries used
conversationally rather than abusively — it annotates, never suppresses.

**Caste terms follow a rule, not a severity threshold:** ship the epithets —
the words thrown *at* a person — and remove the category names, the words
written *about* a group. Because `minSeverity` defaults to 0, a retained entry
is censored by default, so the decision has to be a removal rather than a
downgrade.

## What it catches

Native script (`बहन*ोद`, `புண்*ை`, `খান*ি`, `ਫੁੱ*ੀ`, `ભોસ*ીના`, `ମା*ିଆ`,
`ముం*`, `ಮುಂ*ೆ`, `കുണ്*ൻ`) and ZWJ-injected native script; romanized Indic —
Hinglish, Banglish, Punglish, Odlish, Tanglish, Tenglish, Kanglish, Manglish —
including **unseen vowel variants** via the skeleton tier; leetspeak
(`bh0sd*ke`, digit-led `5h*t` / `5h17`) while `45s`, `500`, `1337`, `4x4` and
the A55 road never fold; Unicode lookalikes (math alphanumerics, fullwidth,
Cyrillic and Greek homoglyphs `fu*к` / `fυ*κ`, small capitals `ꜰᴜ*ᴋ`,
parenthesized letters `⒡⒰⒞*`, Latin Extended `fū*k`, combining marks on Latin
bases `f́úć*`); letter stretching and initial doubling; masks, spelled-out
words and chunk splits per the tier table above; camelCase hashtags and handles
(`#F*ckThis`, while `#SussexDowns` and `#ClassicCars` stay clean because a
fragment must equal a dictionary term whole); and distinctive abbreviations
(`bsd*`, `bk*`, `tmk*`).

Bare `bc`/`mc` are deliberately **not** matched — they flag dates (753 BC),
British Columbia and emcees. Add them with `customWords` if your context wants
them.

Per language on top of that, each pack adds the spelling doublets its script
actually has — Tamil's grantha/native pair (`ஜாதி` ≡ `சாதி`), agglutinated and
degeminated forms; Odia's conjunct/anusvara (`ଗା*୍ଡି` ≡ `ଗା*ଡି`) and
nukta-less spellings; Bengali's `চাঁদ` ≡ `চান্দ`, `হঠাৎ` ≡ `হঠাত্` and both the
Kolkata and Dhaka conventions; Marathi's eyelash reph (`महा*्या`), its own
register and the Maharashtra caste slurs no Hindi list contains;
Telugu/Kannada's sunna/conjunct pair (`ము*్డ` ≡ `ము*డ`); Malayalam's two chillu
encodings and both orthographies of one word (`നായിൻറെ` ≡ `നായിന്റെ`);
Punjabi's tippi/bindi pair (`ਕੰ*ਰ` ≡ `ਕਂ*ਰ`, the commonest Punjabi typing
error) and addak-less spellings; Gujarati's `ગા*્ડ` ≡ `ગા*ડ`.

## What it deliberately does not catch

Every miss is priced: it stays a miss because the lock that would catch it also
breaks innocent text, and that innocent text is named.

### The separated tier's locks

The spelled-out tier is the one most likely to misfire, so it is the most
constrained. It considers only a **maximal** run of single letters, each joined
by exactly **one** separator (space, tab, `.`, `-`, `_`, newline, `/`) and
bounded by non-word characters; the run must be at least four letters long; and
the joined run must equal a dictionary term **in full** — no substrings, no
skeleton, no stretch collapsing. That keeps `U.S.A.`, `R.S.V.P.`, `T-shirt`,
`x-ray`, `Dr. A. B. Smith`, `q w e r t y` and `b a s s guitar` clean. Allowlist
phrases are re-tested against the run and its neighbours, so
`l u n d university` and `g a n d h i` stay clean too.

The price of that strictness is a documented miss: the run is maximal, so an
adjacent *single letter* joins it, and only a leading `a`/`i`/`o` may be
dropped again. `what a s h i * day` resolves; `u r a s h i *` — one run,
`urashi*` — does not.

**Chunk merging** extends the same doctrine to short fragments: 2–4 pure-letter
fragments joined by single separators merge only when the **whole** run equals
a dictionary term. Dot and hyphen joins accept fragments up to five letters
(`fu.c*`, `b.it.c*`). Space-joined runs need at least **three** fragments of at
least two letters each (`as sh o*e`), because two space-joined fragments are
structurally just adjacent short words — `lo da` is ordinary romanized Telugu
and `ga and ma` is a sentence about sargam notes. A run that borders a hyphen
or dot into a longer word is abandoned (`who re-elected` never merges), and
all-single-letter runs stay the separated tier's, so `a.s.*` cannot bypass its
four-letter floor.

### The measured recall gaps

151 of 952 evasion cases missed. The full list, derived from the run rather
than hand-written, is in `benchmark/results.txt` under KNOWN GAPS.

- **Script mixing fails completely.** `मा*archod` and its nine siblings:
  **20 of 20 missed.** The one roadmap item, quantified rather than described.
- **Disemvowelling is not covered.** `fck` folds no character, and listing it
  as a variant would flag FCK — FC København and FC Köln both go by it.
  `obscenity` gets `fck` from pattern-side wildcards. The *phonetic*
  respellings (`sh*t`, `k*nt`, `fo*ck`, `f*k`) ship as curated variants
  instead, which is the dictionary-side recall rule working.
- **Two space-separated chunks.** `fu c*` misses by design, for the `lo da` /
  `ga and` reason above. Three or more chunks, or a binding separator, resolve.
- **A doubled separator** (`f..uc*`) misses: fragments must be joined by
  exactly one separator, the lock that keeps `Dr. A. B. Smith` clean.
- **Masks at a token edge** (`*uck`, `fuc*`, `f***`) miss deliberately. Markdown
  italics donate leading-mask tokens (`*hit save*` → `*hit`, which would
  wildcard onto a real word) and footnote asterisks donate trailing ones
  (`boo*`, `wan*`). No lock separates those from the evasions. **This is why
  `f***` in your test file will not be detected.**
- **`( → c` is not a leet mapping**, so `fu(k` misses. Adding it folds `(um`
  and flags ordinary parentheticals like "Hello (um, maybe)"; precision wins.
- **Mask-plus-stretch** (`5HII*T`) misses: a mask is a single-character
  wildcard, and no tier both collapses the stretch and spends the mask on what
  remains.
- **Three romanizations are deliberately unlisted** because they cannot be told
  apart from ordinary words: `magi` (bn — the Magi, Maggi), `boli` (kn — Hindi
  for "speech"), `kundan` (ml — Kundan jewellery). They sit in the benchmark as
  controls and score as misses; the native-script spellings are listed.

### Known false positives, documented and deliberate

- "Randi" as a Western given name matches — the profane reading dominates in
  Indian text.
- The transmission sense of `tr*nny` matches in automotive contexts.
- "bkl" matches the Linux Big Kernel Lock.
- "prick" matches in needle contexts. The verb family — pricked, pricking,
  pricker — stays clean, mirroring the same call made for cock.
- Literal senses of `su*r` ("pig") and `sa*la` ("brother-in-law") match; both
  carry `casualUse: true` so you can soften handling.
- `kutta`/`kutte` ("dog") was removed outright: a category, not an epithet.

The whole false-positive surface is governed by a regression suite of 100+
cases (Gandhi, chutney, banked, bounced, motorcade, besodden, "she shuddered at
the thought", "753 BC", Kike Hernandez, sp*c-and-span…) plus a pinned
dictionary sweep of every pack over 1.7M English word forms. On the benchmark's
clean corpus three false positives survive, named in
[benchmarks.md](benchmarks.md#clean-text).

## Roadmap

Mixed-script words (`मा*archod`) are the outstanding gap — 0 for 20, one case
in each direction in every pack that has a script.

All eleven packs ship today. The engine is language-agnostic and packs are
data, so [language-packs.md](language-packs.md) is what a twelfth would follow.
Native-speaker contributions are the only way several Indian languages will
ever get quality coverage.
