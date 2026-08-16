# remove-profanity — module specifications

All modules are TypeScript, strict mode, **zero runtime dependencies**, ESM with
`.js` extensions in relative imports (NodeNext). Shared types and the fold
framework live in `src/types.ts` — read it first; do not redefine anything it
exports. Tests use vitest and live in `test/`.

## The pipeline

Implemented in `src/engine/matcher.ts` — not part of a module agent's scope, but
your module must satisfy its contract.

```
original text
  → baseFold     = NFC ∘ stripInvisibles ∘ foldWidth ∘ lowercase ∘ indicFolds  (pass 0: "base")
  → latinFold    = confusables ∘ stripLatinMarks ∘ leet ∘ collapseRepeats(2)   (pass 1: "latin")
  → skeletonFold = phonetic consonant skeleton                                 (pass 2: "skeleton")
```

Each pass output carries a composed offset map back to the ORIGINAL string
(`FoldResult`). Matching runs Aho-Corasick over each pass; matched spans map
back to original indices; word boundaries are checked in the pass's own output
space; allowlist spans (computed in the same space) suppress contained matches;
censoring rewrites the original grapheme-safely.

**Every per-character loop reads a `Uint16Array` of the pass output, never the
string** (`UnitText` in `src/types.ts`, built by `src/unicode/code-units.ts`;
the reason is measured there and in `docs/performance.md`). Each fold has a
`UnitFold` twin (`baseFoldUnits`, `latinFoldUnits`,
`collapseAllRepeatsFoldUnits`, `skeletonUnitsOf`) that the matcher calls; the
string `Fold` is `(input) => f(unitTextOf(input))` and keeps this contract. A
`UnitText` carries a lazily built `UnitProfile` (one sweep: `allAscii`,
`hasUpper`, `hasLeetSource`, `hasDoubleUnit`/`TripleUnit`/`Surrogate`,
`hasDigit`, `hasMask`, `mayHaveEmoji`, `hasHashOrAt`, `hasDotOrHyphen`,
`hasSpelledRunShape`) whose `false` flags let a fold or tier prove itself the
identity and skip. **Every such gate must carry its argument at the gate.**

**Writing a fold:** build output through `FoldBuilder` (types.ts) rather than by
hand. It coalesces copied-through runs, and a fold that rewrites nothing returns
its input **by reference** with a lazily-materialized identity map — which
`chainFolds` recognises and uses to skip the remap loop. Most folds are no-ops
on most text, so this is where the pipeline's speed lives. Use
`keepCodePoint`/`keepAt` (not `keep`) whenever the output units of a cluster must
all be credited to the cluster's first index.

### The four tiers

`exact` and `skeleton` come from the Aho-Corasick passes above; `masked`
(`f*ck`) and `separated` (`f u c k`, `s.h.i.t`) are whole-token rules in the
matcher, **not folds**. That distinction is deliberate: a fold that deleted mask
characters or separators between letters would rewrite EVERY word of every
language and turn ordinary prose profane. Both rules instead require a deformed
token to resolve against the dictionary **in full**, which is why they can be as
precise as `exact`.

Every whole-token rule has locks, and every lock has a named collision. All live
in `src/engine/matcher.ts`, pinned by `test/separated.test.ts` (whose clean
traps outnumber its hits roughly 4:1) and `test/evasion-round3.test.ts`:

| Rule | Locks | The collision the lock is for |
|---|---|---|
| separated | maximal single-letter run; exactly one separator per gap (space, tab, `.`, `-`, `_`, newline, `/`); ≥4 letters; whole-run equality | `U.S.A.`, `Dr. A. B. Smith`, `q w e r t y` |
| masked | up to THREE masks (`b***h`), visible-characters floor, so three masks need length ≥5 | markdown italics and footnote asterisks donate token-edge masks |
| digit-mask | token ≥4 units, ≤2 masks, ≥2 visible letters, trailing character a letter, and a LEADING digit-mask only beside a second interior mask | `2hit combo`, `4chan`, `2fast4u`, `covid19`, postcodes |
| emoji infix | strip 1–2 interior pictographs; the remainder must equal a surface outright | `fire🔥works` cannot fire, because "fireworks" is no surface |
| chunk merging | 2–4 pure-letter fragments, one separator per gap, whole-run equality; dot/hyphen joins allow fragments ≤5 units, space joins need ≥3 fragments of ≥2 letters; a run bordered by a binding separator into a longer word aborts; all-single-letter runs stay the separated tier's | two space-joined fragments ARE adjacent short words — `lo da`, `ga and`; `who re-elected` |
| hashtag splitting | `#`/`@`-led token read from the ORIGINAL text (pass 0 lowercases the seam away), split at ASCII case boundaries; a fragment must equal a surface whole, with allow phrases tested across fragment seams | `#MobyDick`, `#CummingGeorgia` |
| initial doubling | the collapsed pass's stretch gate also accepts a doubled FIRST letter (`ffuck`) | everyday doubles are word-internal (pakki, chhod, assess); words that begin doubled (aardvark, llama, Lloyds) collapse onto nothing profane |

Both whole-token rules read the folded passes, not just pass 0, so a deformed
token may also carry leet and confusable characters (`b!t*h`, `ph*ck`). The
masked rule reads EVERY non-collapsed pass rather than the richest one alone,
because `@` and `$` are both leet characters and mask characters: pass 1 spends
them as letters, so a token needing them as wildcards (`ch@t*ya`) only resolves
in pass 0. Each pass sees the masks the other has spent.

### The repeat-collapsed pass

A fourth exact pass, fully repeat-collapsed, exists for letter-stretching
(`gaaaandu`). It is **stretch-gated on both sides**: a candidate is kept only if
the matched original text contains a run of 3+, and so is an allow span. The
candidate gate stops everyday doubled letters folding onto a profane pattern
(pakki→paki); the allow gate stops them folding onto an allow PHRASE, which
would silence a lemma the uncollapsed passes matched honestly. Without it, kn's
`chinali` allow phrase killed or's `chhinali`/`chhinaali` and kn's own
`chinaali` — all three collapse to exactly `chinali`, and none is
letter-stretching. `test/collapsed-allow-scope.test.ts` pins both directions.

### Allow spans and `isClean()`

Allow spans are **global across loaded packs**, not scoped to the declaring
pack. Measured, not assumed: with all eleven packs loaded, 127 allowlist
suppressions fire across 1,693,513 dictionary forms plus the benchmark clean
corpus, and none is one pack's phrase silencing another pack's entry. The
invariant that keeps it true lives in the data — every allow phrase a lemma
needs is carried by the pack that owns the lemma — and is enforced by the mirror
check in `test/all-packs-dictionary-sweep.test.ts`. `customAllowlist` is global
for the same reason and by definition.

`isClean()` runs the same collection but stops at the first candidate that
survives the allow spans and the severity/category filters — overlap resolution
replaces clashing candidates and never empties the set, so one survivor settles
the question. Its exact tier is streamed (the automaton walks each pass in
chunks and every candidate is judged as it appears) and its allow test is
windowed: an allow phrase found in pass 1 can veto a candidate found in pass 0,
but pass maps are monotone and phrases are bounded in length, so the phrases
that could contain a span lie within a computable window of each pass and only
that window is scanned. `scan()` collects the whole text and its allow spans
once, on demand — allow spans exist to veto candidates, and clean text has none.

## Module A — `src/unicode/normalize.ts` (+ `test/normalize.test.ts`)

Export these `Fold`s:

- `nfcFold`: `normalize('NFC')`. Building the offset map across NFC is subtle;
  implement it by normalizing **grapheme-safe chunks** — iterate in segments
  beginning at every non-combining starter (split before each code point where
  `/\p{M}/u.test()` is false), normalize each segment independently (NFC never
  reorders across starter boundaries), and map every output unit of a segment to
  the segment's start index in the input.
- `stripInvisiblesFold`: delete U+200B, U+200C, U+200D, U+00AD, U+FEFF, U+2060,
  U+180E. (Legit Indic orthography is preserved in the original string; this
  only affects the match key.)
- `foldWidthFold`: fullwidth ASCII U+FF01–U+FF5E → ASCII (subtract 0xFEE0).
- `lowercaseFold`: per-code-point via `codePointFold` (handles 1→2 expansions
  like İ with correct maps).
- `indicFold`: per-script orthographic unification. **The rules are data**,
  declared once per script in `src/unicode/indic-scripts.ts` (`INDIC_SCRIPTS`,
  typed `IndicScriptRules`); `normalize.ts` derives its lookup tables from that
  array at load time. **Adding a script must not require new branching here.**
  Fields: `drop`, `map`, `virama` + `nasalsToAnusvara` + `anusvara` (the
  string-level cluster rule), `collapseViramaRuns`.
- `baseFold`: exported ready-made, semantically `nfcFold ∘ stripInvisibles ∘
  foldWidth ∘ lowercase ∘ indic`. It is no longer that five-fold composition:
  the four pointwise stages are FUSED into one `codePointFold`
  (`fusedPointwiseFold`), so the real shape is `composeFolds(nfcFold,
  fusedPointwiseFold, indicClusterFold)` behind an all-ASCII fast path. The four
  are still exported and still individually tested; nothing composes them into
  `baseFold` any more.

**Anything you are unsure is correct orthography belongs in a pack's `variants`
or the skeleton tier, never in the script table** — it feeds the exact,
high-precision pass. Which rules each of the nine registered scripts takes, and
the reasoning for every rule deliberately *absent*, is the table in
`docs/language-packs.md`, "Do not copy the neighbouring script's arm"; the
per-script comments in `indic-scripts.ts` are the long form. What is spec rather
than guidance:

- The nasal-consonant + virama → anusvara rule is a **string-level 2→1 scan**;
  map both input chars to the first. Devanagari, Bengali, Odia, Gujarati, Telugu
  and Kannada take it. **Malayalam and Tamil must not**, and each must carry a
  test proving the rule is absent — Malayalam writes those clusters only as
  conjuncts, and ங்க/ந்த/ம்ப are Tamil's only native spelling.
- `drop: [nukta]` unifies precomposed letters only where NFC has already
  decomposed them, which is per code point. Write a test proving क़ (U+0958)
  matches क + this fold, and note that ऱ U+0931 is **not** a composition
  exclusion — Marathi's eyelash reph needs an explicit `map` entry, or महाऱ्या
  and महार्या are two keys. Odia's ୟ U+0B5F has no canonical decomposition,
  unlike Bengali য় U+09DF, so the nukta rule never reaches it; assert that
  against the UCD rather than assuming.
- `collapseViramaRuns` is opted into per script and is deliberately **off for
  Devanagari**, where switching it on would change Hindi behaviour.
- Bengali expands khanda ta ৎ U+09CE → ত + hosonto, which Unicode gives no
  canonical decomposition, so হঠাৎ ≡ হঠাত্ stop being two keys. Malayalam expands
  all nine chillu letters to consonant + chandrakkala (ൺ→ണ്, ൻ→ന്, ർ→ര്, ൽ→ല്,
  ൾ→ള്, ൿ→ക്, ൔ→മ്, ൕ→യ്, ൖ→ഴ്), which unifies the atomic encoding with the
  older consonant + virama + ZWJ sequence AND settles the pre-reform vs reformed
  orthography split (ൻറ ≡ ന്റ).
- Letters deliberately **not** folded, because they are contrastive and folding
  them would be a recall heuristic in a precision tier: Devanagari ऩ U+0929, ऴ
  U+0934 and ळ U+0933 (काळ "time" / काल "yesterday"); Bengali ya-phala ্য,
  ba-phala ্ব and the শ/ষ/স merge (শাল / সাল / ষাঁড় are distinct everyday words,
  so it belongs in per-lemma `variants`); Tamil ண and the ல/ள/ழ and ர/ற sets;
  Odia ୱ U+0B71; the obsolete ఱ/ಱ/ೞ and both Telugu/Kannada candrabindus; and the
  Gurmukhi addak ੱ, because Punjabi gemination is phonemic (ਪਤਾ / ਪੱਤਾ) —
  addak-less casual spellings are generated per lemma in `pa.ts` instead.

Tests must cover: map correctness on deletions and expansions (assert exact map
arrays on small inputs); ZWJ injection inside a Devanagari word maps back to the
full original span; हिन्दी ≡ हिंदी after fold; क़ुत्ता ≡ कुत्ता; fullwidth ｆｕｃｋ
folds to fuck. Per-script rules get their own file (`test/tamil-normalize.test.ts`
is the model): the folds the script DOES have, the folds it deliberately does
NOT have, and a regression block proving the other scripts are unchanged.

Three fast paths, all semantics-preserving and all load-bearing for per-check
cost (see `docs/performance.md`):

- `baseFold`'s fused pointwise stage keeps an **ASCII fast path first** and a
  single Indic range check second (`INDIC_CASELESS_RANGE`, U+0900–U+0DFF, all
  caseless). That constant is fixed, not derived from `INDIC_SCRIPTS`, so
  registering a script can never silently change the fast path.
- **All-ASCII input skips the composed pipeline entirely.** ASCII is NFC-inert
  and NFC-stable, carries no invisibles, fullwidth forms or Indic clusters, so
  `baseFold` degenerates to A–Z → a–z in one walk.
- **`nfcFold` normalizes the whole string ONCE to decide whether anything will
  change.** When nothing will, the segment walk still runs (the map contract
  still owes every unit of a multi-unit segment to the segment's start) but never
  slices or re-normalizes a segment. Combining-mark classification is memoized in
  a typed array; `\p{M}` on a per-character string was the single most expensive
  operation in the whole scan for Indic text.

## Module B — `src/folds/latin.ts` (+ `test/latin.test.ts`)

- `leetFold`: string-level, longest-token-first at each position:
  `@→a 4→a 3→e 1→i !→i |→i 0→o $→s 5→s 7→t 2→z 6→g 9→g ph→f`. Non-digit
  substitutions fire only when adjacent to a Latin letter in the input. Digits
  are governed per token (`digitFoldMode`): a LETTER-LED token keeps the literal
  adjacency rule ("a55" → "as5", the A55 road never becomes "ass"); a DIGIT-LED
  token folds ALL its mappable digits when it has ≥2 letters, or exactly one
  leading digit + ≥1 letter + length ≥4 ("5hit", "5h17" — the whole-token fold is
  what reaches the trailing 7, whose only neighbour is another digit);
  number-ish tokens ("500", "45s", "1337", "4x4", "4s5", "2h30") never fold.
  **`(→c` is deliberately NOT in the table**, and `fu(k` is therefore a
  documented miss: an opening paren before a word satisfies the letter guard, so
  the mapping folds `(um` to `cum` and flags an ordinary parenthetical.
- `confusablesFold`: compact but real coverage, mapping TO lowercase ASCII —
  Mathematical Alphanumeric Symbols U+1D400–U+1D7FF (algorithmic: 52-letter
  alphabets in sequence, offset mod 26, reserved gaps like U+1D455 falling back
  to identity); Enclosed Alphanumerics ⒜–ⓩ U+249C–U+24E9 and the Supplement's
  four 26-letter runs U+1F110–U+1F189; the FULL Cyrillic and Greek lookalike sets
  a homoglyph converter uses (а е о р с х у і ѕ ԁ һ ј к м т; ν ο υ α ρ τ β ε ι κ
  μ η χ γ) and their unambiguous uppercase forms (Η and Γ resemble different
  Latin letters and are deliberately unmapped); Latin letters with decomposable
  diacritics, built algorithmically from NFD at module load, plus the
  non-decomposables đ ħ ı ł ŧ ø; small capitals and modifier letters; ƒ→f, ç→c
  and bare-minimum Latin-1.
- `stripLatinMarksFold`: deletes combining marks U+0300–U+036F (CGJ U+034F
  included) ONLY when the preceding character is an ASCII Latin letter — so f́úćḱ
  reaches the dictionary as fuck while Indic combining marks (own blocks,
  non-ASCII bases) can never be touched on either test.
  `test/evasion-round3.test.ts` proves every native-script surface of all eleven
  packs byte-identical through this fold.
- `collapseRepeatsFold(threshold = 2)`: runs of the SAME code point longer than
  `threshold` truncate to `threshold` (fuuuuck→fuuck; the dictionary compiler
  also emits repeat-collapsed surface forms so both spellings match; at threshold
  2, legitimate doubles like "assess" survive). Also export
  `collapseAllRepeatsFold` (threshold 1) for the skeleton pipeline.
- `latinFold = composeFolds(confusablesFold, stripLatinMarksFold, leetFold,
  collapseRepeatsFold(2))`.

Tests: 𝐟𝐮𝐜𝐤→fuck; b!tch→bitch; "500 BC" unchanged by leetFold; ⓕⓤⓒⓚ→fuck; map
arrays verified on at least two cases.

## Module C — `src/folds/skeleton.ts` (+ `test/skeleton.test.ts`)

`skeletonFold`: the phonetic consonant skeleton for ROMANIZED Indian-language
text. Input is assumed already base-folded + latin-folded. Stages, string-level,
with offset maps throughout:

1. digraph consumption, longest-first, left to right: `chh→c ch→c bh→b dh→d gh→g
   jh→j kh→k ph→f sh→s th→t zh→j kshh→ks ksh→ks`;
2. single folds: `z→j w→v q→k y→i c→k x→ks`;
3. drop `h` everywhere EXCEPT word-initial (behen→been, but hindi keeps h);
4. drop vowels `a e i o u` EXCEPT word-initial (gandu→gnd, aand→and);
5. collapse ALL repeat runs to 1;
6. delete every char not `[a-z ]`; collapse whitespace runs to a single space.

Also export `skeletonKey(word: string): string` — run the fold, return output
only (used by the pack compiler on romanizations).

Convergence tests (all pairs must produce identical skeletons):
bhenchod/behenchod/bahanchod/bhainchod; madarchod/madharchod/maderchod;
bhosdike/bhosadike/bhosdiike; chutiya/chutia/chutya/chutiyaa (assert equality,
not a hardcoded string); gandu/gaandu/gandoo. Divergence: skeleton('gandhi') !==
skeleton('gandu') is NOT required (collisions are what allowlists are for), but
skeleton('chutney') !== skeleton('chutiya') IS required — the 'n' survives in the
consonant skeleton.

## Module D — `src/engine/ahocorasick.ts` (+ `test/ahocorasick.test.ts`)

Classic Aho-Corasick over UTF-16 code units:

```ts
export interface AcMatch { start: number; end: number; patternId: number }
export class AhoCorasick {
  constructor(patterns: string[]);           // ids = array indices
  readonly maxPatternLength: number;         // in code units
  findAll(text: string): AcMatch[];          // end exclusive; ALL occurrences,
  findAllUnits(units: Uint16Array, n: number): AcMatch[];   // including overlapping
  scanUnits(units: Uint16Array, from: number, to: number,   // resumable: scans [from, to)
            state: number, sink: AcMatch[]): number;        // from `state`, returns the state after
}
export const AC_ROOT: number;                // the start state for scanUnits
```

The trie is built with `Map<charCode, node>` children, then compiled: states
renumbered in BFS order, failure and output links resolved, a compressed
alphabet (`symOf`), dense fail-resolved transition rows for every state within
two steps of the root (real text keeps the walk that shallow, so nearly every
step is one `Int32Array` read; a full DFA would be ~8 MB per matcher and buys
nothing measurable), and one open-addressing hash of the deeper trie edges,
followed through `fail` on a miss until a dense state answers. From `AC_ROOT` at
`from`, `scanUnits` reports every occurrence that starts at or after `from` —
which is what lets the matcher stream the exact tier and test the allowlist in a
window.

Must report ALL matches (follow output links): patterns ['he','she','his','hers']
on 'ushers' → she, he, hers, in end-position order. Include a test with
Devanagari patterns and a 10k-char haystack sanity check (< 50 ms).

## Module E — `src/unicode/graphemes.ts` + `src/engine/censor.ts` (+ `test/censor.test.ts`)

- `graphemes.ts`: `graphemeSlices(text): { start, end }[]` using
  `Intl.Segmenter('und', { granularity: 'grapheme' })` when available; fallback:
  split on code points but keep `\p{M}`, ZWJ/ZWNJ and virama (U+094D, U+09CD,
  U+0BCD, U+0C4D, U+0CCD, U+0D4D) attached to the previous cluster. Export
  `hasIntlSegmenter: boolean`.
- `censor.ts`: `censorText(text, spans, options?)`. Merge overlapping spans;
  expand each span outward to grapheme-cluster boundaries; replace each cluster
  with one mask char (default `'*'`); `keepFirst` keeps the first cluster of each
  merged span. **NEVER output an orphaned combining mark.**

Tests: censoring a Devanagari word yields exactly one mask per cluster (compute
with the segmenter, assert the count matches, and assert NO combining marks
remain adjacent to masks); keepFirst on 'fuck' → 'f***'; overlapping spans merge;
an emoji ZWJ sequence inside a span is masked as ONE cluster.

## Module F — `src/data/{hi,en,ta,or,bn,mr,te,kn,ml,pa,gu}.ts`

Test files: `test/data.test.ts` plus `test/<lang>-data.test.ts` per pack.

**What a pack must be, whatever a contributor works from:** genuinely profane
lemmas ONLY — no everyday vocabulary, no mild or merely-rude words (`item`,
`maal`, `paagal`, `ullu`, `bandar`, `gadha`, `joota`, `chamcha`, `nibba`) and no
bare abbreviation treated as a word (`BC`). Each native-script lemma is grouped
with its romanizations in ONE entry. Severity must be honest, categories
accurate, allowlists present for known collisions. Export
`hindi | english | tamil | odia | bengali | marathi | telugu | kannada |
malayalam | punjabi | gujarati: LanguagePack`.

The full authoring recipe with the traps that actually bite is
`docs/language-packs.md`; the settled per-language decisions and the open
native-speaker questions are `docs/pack-decisions.md`. Both are required
deliverables of every language task. The rules that are spec, not guidance:

- **The word-list policy** (`docs/language-packs.md`) governs what ships: drop a
  lemma whose spelling collides with a religious identity, given name, community
  name or common word in another language and cannot be allowlisted away; ship
  caste **epithets** and not caste **categories**, classified by "thrown at a
  person or written about?" and never by the severity number — a removal, not a
  downgrade, because default `minSeverity` is 0; no severity-1 coarse words; and
  every pack is SELF-SUFFICIENT.
- **Self-sufficiency has three consequences.** (a) A borrowed romanization also
  brings the lending pack's allowlist entries, including the ones guarding its
  *skeleton key* (`motorcade`/`matricide` for `mtrkd`), and the false-positive
  suites run the pack ALONE to prove it. (b) Spellings another pack *dropped* are
  not resurrected. (c) **No LEMMA string may be shared with any other pack**,
  since `collectExact` dedupes on the lemma string; native-script lemmas make
  this automatic, and the data suites assert it.
- **A data module — and its test — must NOT import `src/folds/skeleton.ts`.**
  Reimplement the six stages of Module C independently when a test needs a key,
  so a bug in the fold cannot make the data assertions agree with it.
  `test/dravidian-skeleton-key.ts` is the shared reimplementation for te/kn/ml.
- **`skeletonSafe: false`** for any entry whose skeleton key is shorter than 4
  characters *and* for any entry the **collision test** condemns, whatever its
  key length. Length was never the rule; it was a proxy that let `klsd` (closed,
  classed, calloused), `nmrd` (Nimrodian) and `bnkd` (bounced, benched, bunched)
  through. The test and the sweep that answers it are specified in
  `docs/language-packs.md`, "Set `skeletonSafe: false` by the collision test",
  and pinned in `test/all-packs-dictionary-sweep.test.ts`. Each entry carries its
  computed key and the colliding English word in a trailing comment.
- **Spelling families are generated on the dictionary side, at module load,
  inside the pack, each with an orthographic exclusion set** — never by relaxing
  the word boundary and never as a fold. `expandInflections` (hi), `inflect()` +
  `expandPack()` over `-s`/`-ed`/`-ing`/`-er` with `INFLECTION_EXCLUDE` (en;
  exclusions `spiced`, `cocked`, `cocking`, `cocker`, `dicker`, `titter`,
  `negros`), `degeminate()` with `DEGEMINATE_EXCLUDE` (ta — Tamil gemination is
  phonemic), `dropAddak()` (pa — Punjabi gemination is phonemic). te/kn/ml ship
  **no** degemination expander deliberately: in Malayalam it would turn പണ്ണി
  "fucked" into പണി "work".
- **`matchMode: 'prefix'`** only where the language attaches case suffixes AND
  the innocent trap set is CLOSED. Every prefix entry MUST carry an allowlist and
  a two-sided test (catches its inflections, spares the innocent word sharing its
  opening). `pooru`/പൂറ്, `dengu`/దెంగు, ಬೋಳಿ and the Tamil and Odia stems
  qualify; `kunna`/കുണ്ണ does not, because every Kunna- toponym in Kerala opens
  with it. pa and gu use no prefix entries at all (free-standing postpositions),
  and their data suites assert that absence with the reason.
- **When a romanization cannot be won, drop it and say why in a comment**;
  where the NATIVE spelling is the unambiguous one, ship native-script-only
  instead of dropping the lemma; where BOTH scripts collide with an identity
  term, drop the lemma outright.

Per-pack sizes and specifics:

| Pack | Size | Specifics |
|---|---|---|
| `hi` | 56 | Devanagari lemma + romanizations in one entry. Abbreviations (bc, mc, bsdk, bkl, tmkc) ARE included, as their own romanizations, with `skeletonSafe: false` and allowlists where needed. Pack-wide allowlist: gandhi, chutney, chutki, chutkule, uganda, propaganda, lund university, bal thackeray, sunni muslim. `randi` is deliberately NOT allowlisted — a documented known limitation. |
| `en` | 70 | Real English profanity MINUS merely-sexual/medical vocabulary (anal, sex, sexy, nude, vagina, escort, bdsm, voyeur, suck, topless, twink, xx, breast…). Big slurs at severity 4, category `slur`. |
| `ta` | 32 | Native script + curated Tanglish. Caste slurs tagged `casteist`, abusive `-an`/`-i` forms only, community names allowlisted. Prefix mode for agglutination. Severity-1 merely-coarse words are not shipped. |
| `or` | 15 | Deliberately short; every entry sourced (Praharaj's *Purnnachandra Odia Bhashakosha*, plus a crowd list with usage votes), nothing generated by rule. Prefix mode is used here too — it is not a Dravidian-only device. Risky romanizations ship as disambiguated Latin spellings (`baanda`, `gaandi`) or native-script only. |
| `bn` | 29 | Romanizations must span BOTH conventions (Kolkata and Dhaka) — `choda`/`chuda`, `shuor`/`suor`, `banchot`/`banchod`/`baanchot`. Bengali's retained word-final inherent vowel means Hinglish-shaped romanizations do NOT transfer: `chod` belongs to `hi`, `choda` here. No prefix mode — case endings are shallow enough to list. |
| `mr` | 28 | Shares script and vocabulary with `hi`: entries whose lemma STRING is byte-identical must carry identical `severity` and `categories`. The pack's real value is the Marathi register hi does not cover and the Maharashtra caste slurs. No prefix mode: गांडूळ "earthworm" opens with गांडू. |
| `te`/`kn`/`ml` | 18/16/17 | Follow the ta pattern. No degemination expander. Language-agnostic schema assertions live in `test/pack-schema.ts`. |
| `pa`/`gu` | 30/27 | Both carry the shared Latin core themselves. Caste slurs (ਚੂਹੜਾ, ਚਮਾਰ, ਭੰਗੀ, ઢેડ, વાઘરી) tagged `casteist` at severity 4 with the community's own names allowlisted. Most entries set `skeletonSafe: false` — Punjabi and Gujarati romanizations produce short keys that land on ordinary English (knjr = conjure, pnkd = punched, hlkt = hellcat, rkdl = Rockdale). |

Every pack's data suite validates the schema (severity 0–4, ≥1 category,
romanizations lowercase, no duplicate lemmas or surface forms within a pack,
script code matching the lemma's actual script) **and asserts that no allowlist
phrase in the pack suppresses one of the pack's own surface forms.**

## Module G — acceptance suites

Written against the PUBLIC API only (`import { createMatcher } from
'../src/index.js'`, `import { hindi } from '../src/data/hi.js'`).

- `test/scunthorpe.test.ts` — ALL clean with default options and packs
  [hindi, english]: "Mahatma Gandhi", "chutney recipe", "chutki", "Lund
  University is in Sweden", "Bal Thackeray", "He is a Sunni Muslim", "This
  happened in 500 BC" (the bc abbreviation must NOT fire in numeric/date
  context), "the MC of the event", "an item on the list", "classic assessment of
  grass", "Scunthorpe United", "paal means milk", "मालिक आ गया", "गूगल पर खोजें",
  "हिन्दी सीखो", "propaganda", "Dickens novels", "Middlesex".
- `test/evasion.test.ts` — ALL must flag: "chutiya", "chutiyaaaa", "ch*tiya",
  "chut1ya", "chutiy@", "bh0sdike", "बहनचोद" plain and with ZWJ injected between
  clusters, "madarch0d", "MADARCHOD", "𝐛𝐡𝐞𝐧𝐜𝐡𝐨𝐝", "fuuuuck", "gaandu",
  "behenchod" AND "bahanchod" (assert `tier === 'skeleton'`), "bsdk",
  "साले मादरचोद". Assert severity and categories surface correctly on at least
  three cases, and that `scan().matches` spans slice the original string to the
  expected surface text.
- `test/engine-early-exit.test.ts` asserts `isClean(t) === (scan(t).matches.length
  === 0)` across every filter combination — exactly the invariant a new tier or a
  new veto breaks. Keep it honest when you change tier collection.

Per-language suites mirror that pair and add two or three more, listed in
`docs/language-packs.md`, "Steps 5–7". Requirements that are spec:

- Each `<lang>-normalize.test.ts` must assert the folds its script does NOT have.
- Each `<lang>-scunthorpe.test.ts` must include separated-tier traps (dotted
  initials, recited alphabets) as well as the usual proper nouns, and — for a
  self-sufficient pack — must run against the pack ALONE, because that pack ships
  the short Latin patterns that tier reaches for.
- `marathi-overlap.test.ts` is the hi + mr cross-pack contract: loading both never
  doubles a match, and every shared lemma string carries the same severity in both
  packs. `punjabi-data.test.ts` pins the collision behaviour — an identical
  **lemma string** makes the second entry vanish (collectExact dedupes on `lemma
  start end`), while entries whose lemma strings differ both survive and normal
  severity resolution applies, which is why the self-sufficiency policy is safe
  across scripts and would not be for two Latin-lemma packs.
- The te/kn/ml suites share their language-agnostic halves through
  `test/pack-schema.ts` and `test/dravidian-skeleton-key.ts` — the pattern to
  follow rather than a sixth copy of the same 60 lines.
- **A reported match `end` lands on the START of the final grapheme cluster**
  (nfcFold maps a cluster's units to its start index), so a word ending in a
  combining mark reports one code unit short. Assert on `censor()` output rather
  than exact native-script `surface` strings.

The acceptance gate for any change: `npm run typecheck && npm test && npm run
build`, with **every pre-existing test still passing.**
