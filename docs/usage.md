# Usage

The API in full: building a matcher, the three calls it gives you, every option
and default, the shape `scan()` returns, and how to pick packs. See also
[matching.md](matching.md) (how detection works),
[benchmarks.md](benchmarks.md) (measured accuracy and speed) and
[language-packs.md](language-packs.md) (contributing a language).

> Examples here use masked spellings (`f*ck`, `bh#sdike`). They are real inputs
> the matcher resolves. The unmasked word lists live in `src/data/`.

## Install and import

```
npm install remove-profanity
```

Node 18+. Zero runtime dependencies, types bundled. The package is ESM
(`"type": "module"`); from CommonJS use a dynamic `import()`. The engine and
each language pack are separate entry points:

```js
import { createMatcher } from 'remove-profanity';
import { hindi } from 'remove-profanity/data/hi';
import { english } from 'remove-profanity/data/en';
```

Every subpath, its export, and what the pack holds — 338 lemmas across the
eleven:

| Language | Subpath `remove-profanity/…` | Export | Entries |
|---|---|---|---|
| Hindi + Hinglish | `data/hi` | `hindi` | 56 lemmas, hundreds of surface forms |
| English | `data/en` | `english` | 70 lemmas, `-s`/`-ed`/`-ing`/`-er` generated |
| Tamil + Tanglish | `data/ta` | `tamil` | 32, incl. caste and religious slurs |
| Punjabi + Punglish | `data/pa` | `punjabi` | 30 (Gurmukhi + Punglish), incl. caste slurs |
| Bengali + Banglish | `data/bn` | `bengali` | 29, Kolkata + Dhaka romanizations |
| Marathi | `data/mr` | `marathi` | 28, incl. Maharashtra caste slurs |
| Gujarati | `data/gu` | `gujarati` | 27, incl. caste slurs |
| Telugu + Tenglish | `data/te` | `telugu` | 18, incl. caste and religious slurs |
| Malayalam + Manglish | `data/ml` | `malayalam` | 17, incl. caste slurs |
| Kannada + Kanglish | `data/kn` | `kannada` | 16, incl. a religious slur |
| Odia + Odlish | `data/or` | `odia` | 15 — deliberately short, see below |

**Severity rubric:** 4 = extreme slurs / sexual-violence terms · 3 = strong
profanity · 2 = moderate insults · 1 = mild insults. Pack data is heavily
filtered: only genuinely profane lemmas ship, since everyday words like *item*,
*paagal* and *ullu* cause false positives.

**The Odia pack is short on purpose**: every entry is backed by a dictionary or
a crowd-sourced list with usage votes, and padding the thinnest romanized corpus
here would buy recall at the cost of permanent false positives. Several obvious
romanizations are deliberately absent (`ban*a`, `gan*i`, `mag*a`, `b*a`) — each
an ordinary word in another language — so those lemmas ship in native script
plus an unambiguous Latin spelling (`baan*a`, `gaan*i`). The Dravidian packs
make the same call where the Latin spelling is the ambiguous half (`గు*్ద`,
`ము*డ`, `ಕುಂ*ಿ`, `പ*്ണ്` — "panni" is also `പന്നി` "pig").

## `createMatcher`

```ts
function createMatcher(options: MatcherOptions): Matcher;
```

Construction is the expensive part — 33.71 ms cold for all eleven packs,
11.50 ms warm — and it amortizes across every check. **Build it at module scope,
never per request.**

| Option | Type | Default | Meaning |
|---|---|---|---|
| `packs` | `LanguagePack[]` | *(required)* | Packs to load. An empty array is legal and matches only your `customWords`. |
| `minSeverity` | `0 \| 1 \| 2 \| 3 \| 4` | `0` | Suppress matches below this severity. |
| `categories` | `Category[]` | *(all)* | Only report matches carrying one of these categories. |
| `skeletonTier` | `boolean \| 'flag'` | `true` | The phonetic recall tier. `'flag'` still reports its matches; the convention is that callers review rather than block them. |
| `maskedTier` | `boolean` | `true` | Resolve masked tokens (`f*ck`, `bh#sdike`) against the dictionary. |
| `customWords` | `string[]` | `[]` | Extra terms, registered with `language: 'custom'`, `severity: 2`, `categories: ['general']`. |
| `customAllowlist` | `string[]` | `[]` | Extra phrases that must never match. |

`Category` is one of `'slur' | 'casteist' | 'religious' | 'gendered' |
'sexual' | 'ableist' | 'violence' | 'general'`.

Two defaults surprise people. **`minSeverity` defaults to `0`**, so every term
in every loaded pack is reported, mildest included — a low severity in the data
is not advisory, only `minSeverity` makes it so. And **`skeletonTier` defaults
to `true`**, with its matches indistinguishable from exact ones in the result;
read `match.tier === 'skeleton'` to treat them differently, or pass
`skeletonTier: 'flag'` to make that intent explicit in the config.

## `isClean`, `scan`, `censor`

```ts
isClean(text: string): boolean;                                 // true when scan() finds nothing
scan(text: string): ScanResult;                                 // every match, with spans
censor(text: string, options?: CensorOptions): string;          // mask, keepFirst
```

```js
matcher.isClean('Mahatma Gandhi');                    // true
matcher.isClean('kya bh#sdike yaar');                 // false
matcher.censor('kya bh#sdike yaar');                  // 'kya ******** yaar'
matcher.censor('what the f*ck', { keepFirst: true }); // 'what the f***'
```

`isClean` stops at the first candidate it can prove survives, so a profane word
near the top of a long document is answered without scanning the rest — but on
**clean** text nothing can exit early, so `isClean()` and `scan()` cost the same
([measured](benchmarks.md#what-iscleans-early-exit-actually-saves)). Pick by
what you need back, not for speed. `censor` takes `mask` (default `'*'`) and
`keepFirst` (default `false`, leaving the first grapheme cluster of each match
visible); masking counts **grapheme clusters**, not code units, so Indic matches
mask cleanly instead of leaving orphaned matras behind. `scan` returns:

```ts
interface ScanResult {
  matches: ProfanityMatch[];
  maxSeverity: Severity | null;      // highest among matches; null when clean
}

interface ProfanityMatch {
  lemma: string;        // canonical entry — native script where one exists
  surface: string;      // the exact original-text slice that matched
  tier: 'exact' | 'masked' | 'separated' | 'skeleton';
  language: string;     // ISO 639-1 code of the pack that matched, or 'custom'
  severity: 0 | 1 | 2 | 3 | 4;
  categories: Category[];
  start: number;        // UTF-16 code units into the ORIGINAL input string
  end: number;          // exclusive
  casualUse: boolean;   // term often used conversationally rather than abusively
}
```

`start`/`end` index the string you passed in: normalization happens on internal
shadow copies carrying offset maps, so you can highlight, slice or censor
against the original safely, including for Indic scripts where a fold may have
changed the internal character count. `maxSeverity` is `null` when `matches` is
empty, not `0` — test with `matches.length` or `isClean()`, never
`maxSeverity === 0`. `casualUse` marks terms frequently conversational rather
than abusive (`sa*la`, `su*r` in its literal "pig" sense); it annotates, and
never suppresses.

## Other exports

```ts
function censorText(text, spans: { start: number; end: number }[], options?): string;
function skeletonKey(word: string): string;
```

`censorText` applies the same grapheme-aware masking to spans you supply
yourself — useful once you have filtered `scan()` results by your own rules.
`skeletonKey` returns the phonetic consonant skeleton the skeleton tier compares
on; for debugging a pack, not for production filtering. Types exported from the
root: `Category`, `CensorOptions`, `LanguagePack`, `LemmaEntry`, `Matcher`,
`MatcherOptions`, `MatchTier`, `ProfanityMatch`, `ScanResult`, `Severity`.
## Choosing which packs to load

Load the packs your users actually write in. **Each pack is self-sufficient** —
importing one language gives full coverage of it, *including romanizations it
shares with another pack*, so you never load Hindi to catch a borrowed word in
Marathi. Measured, each pack alone scores identically to that pack with all
eleven loaded, for ten of the eleven; Malayalam is the exception, catching 70 of
84 alone against 72 with neighbours.

Loading more than you need costs **construction time** (33.71 ms cold for all
eleven, against a few ms for one or two) and **cross-language false positives**:
measured on the clean corpus, loading all eleven turns Marathi's *aaj shala
nahi* ("no school today") into a false positive via the Bengali entry it
collides with, where the Marathi pack alone has zero. Per-check cost is a
different story — past the first two packs, extra ones are close to free, and
`en`+`hi` to all eleven adds 212 lemmas while moving a 20,000-word check by 0%
([the curve](benchmarks.md#why-more-languages-are-nearly-free)).

Loading several packs never doubles a match: two entries reaching the same span
collapse to one, and where they disagree the stricter reading wins (highest
severity, union of categories). Two entries with the *same lemma string* resolve
their reported `language` by load order — see
[language-packs.md](language-packs.md).

## Recipes

```js
const matcher = createMatcher({ packs: [hindi, english] });

export function moderate(message) {                       // moderate a chat message
  const { matches, maxSeverity } = matcher.scan(message);
  if (matches.length === 0) return { action: 'allow', text: message };
  if (maxSeverity >= 4) return { action: 'block' };
  return { action: 'censor', text: matcher.censor(message) };
}

createMatcher({ packs: [hindi, english], minSeverity: 3,  // slurs only
                categories: ['slur', 'casteist', 'religious'] });
createMatcher({ packs: [english], skeletonTier: false }); // precision-first
```

`skeletonTier: false` drops the recall tier that catches spellings nobody listed
(`bahanch*d` ≡ `behench*d` ≡ `bhainch*d`, from one entry) in exchange for its
small false-positive surface. `'flag'` is the middle path — matches still
arrive, tagged `tier: 'skeleton'`, and you route them yourself on
`m.tier === 'skeleton' || m.casualUse`.
