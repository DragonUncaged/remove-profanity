# remove-profanity

**A Hindi and Indian-language profanity filter for JavaScript and TypeScript.**
Detects abuse in Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu,
Kannada and Malayalam — *and* in romanized Hinglish, Banglish, Punglish,
Tanglish, Tenglish, Kanglish, Manglish and Odlish — including spellings it has
never seen. Zero dependencies, fully offline.

![npm version](https://img.shields.io/npm/v/remove-profanity.svg)
![license](https://img.shields.io/npm/l/remove-profanity.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-types%20included-3178c6.svg)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)

> ⚠️ **Offensive content.** This package ships word lists of real slurs in nine
> Indic scripts and in romanized form, under `src/data/`, so that software can
> detect them. This README and the docs use masked spellings only.

## Install (Node 18+, zero dependencies)

```
npm install remove-profanity
```

```js
import { createMatcher } from 'remove-profanity';
import { hindi } from 'remove-profanity/data/hi';
import { english } from 'remove-profanity/data/en';

const matcher = createMatcher({ packs: [hindi, english] });

matcher.isClean('hello world');                       // true
matcher.isClean('kya bh#sdike yaar');                 // false
matcher.censor('kya bh#sdike yaar');                  // 'kya ******** yaar'
matcher.censor('what the f*ck', { keepFirst: true }); // 'what the f***'
matcher.scan('what the f*ck').maxSeverity;            // 3
```

Full API, every option, and the exact shape `scan()` returns:
**[docs/usage.md](docs/usage.md)**.

## Evasion resistance, Indic Unicode correctness, false-positive guarding

- **Romanized Indic text has no fixed spelling**, and a word list cannot
  contain every variant. A phonetic skeleton tier collapses aspiration, vowel
  length and retroflex/dental distinctions, so one entry catches
  `behench*d` ≡ `bahanch*d` ≡ `bhainch*d` — including spellings nobody wrote
  down.
- **Evasion-resistant by construction.** Leetspeak, Cyrillic and Greek
  homoglyphs, fullwidth and math alphanumerics, zero-width injection, letter
  stretching, interior masks (`f*ck`, `b***h`), spelled-out words (`s.h.i.*`)
  and chunk splits (`as sh o*e`) all resolve against the dictionary.
- **Unicode done right for Indian languages.** Word boundaries come from
  Unicode properties, never ASCII `\b` (which is broken for Devanagari).
  Censoring works in grapheme clusters, so Indic matches mask cleanly instead
  of leaving orphaned matras. Each script gets its own orthography rules.
- **Whole-token matching, so the Scunthorpe problem is solved generally.**
  Every pattern must span a complete token, checked against the original text.
  `Scunthorpe`, `Penistone`, `Middlesex`, `cocktail`, `assassin` and
  `shiitake` are clean — and `Penistone` is in no allowlist of ours, while a
  leading rival flags it.

Per-word severity 0–4 and categories (`sexual`, `gendered`, `slur`,
`casteist`, `religious`, …) let you filter at the level your product needs.

## How it compares

Six libraries, each in its **maximum claimed configuration**, against a
97-axis battery this project owns and publishes. English is the only language
all six claim, so it is the only like-for-like comparison — and it is the one
below.

| Library | Evasion caught /88 | False positives /486 | 20k clean words |
|---|---|---|---|
| **remove-profanity** | **81 (92%)** | **3** | 1.99 ms |
| obscenity | 61 (69%) | 10 | 11.53 ms |
| allprofanity | 57 (65%) | 28 | 3.80 ms |
| bad-words | 39 (44%) | **3** | 8.67 ms |
| @2toad/profanity | 38 (43%) | 14 | 2.23 ms |
| leo-profanity | 18 (20%) | 4 | 0.66 ms |

The Indic scorecards (720/864 on ten Indian languages), the full seven-column
speed grid, the 1.77M-word dictionary sweep, and every gap listed by name are
in **[docs/benchmarks.md](docs/benchmarks.md)**. Every figure traces to
[benchmark/results.txt](benchmark/results.txt).

## Supported Indian languages and scripts

Eleven packs, 338 lemmas, imported separately so you only pay for what you
use. Each subpath is `remove-profanity/data/<code>`:

| | | |
|---|---|---|
| Hindi + Hinglish `hi` | Bengali + Banglish `bn` | Punjabi + Punglish `pa` |
| English `en` | Marathi `mr` | Gujarati `gu` |
| Tamil + Tanglish `ta` | Telugu + Tenglish `te` | Odia + Odlish `or` |
| Kannada + Kanglish `kn` | Malayalam + Manglish `ml` | |

Every pack is self-sufficient: importing one language gives you full coverage
of it, including the romanizations it shares with another pack. Load only the
languages your users write in — extra packs cost startup time and can add
cross-language false positives. Guidance:
[docs/usage.md](docs/usage.md#choosing-which-packs-to-load).

**Want your language supported?** Native-speaker contributions are the only
way several Indian languages will ever get quality coverage. The recipe, with
the false-positive traps that actually bite, is in
[docs/language-packs.md](docs/language-packs.md).

## Documentation

| | |
|---|---|
| [docs/usage.md](docs/usage.md) | Install, imports, `createMatcher`, `isClean`, `scan`, `censor`, every option and default, the returned shape, per-language subpath imports, pack selection. |
| [docs/matching.md](docs/matching.md) | The four tiers, the fold pipeline, what it catches and what it deliberately does not, the allowlist mechanism, severity and categories. |
| [docs/benchmarks.md](docs/benchmarks.md) | Every benchmark table in full, with the unflattering readings kept in. |
| [docs/language-packs.md](docs/language-packs.md) | Adding a language pack, step by step. |
| [docs/mcp.md](docs/mcp.md) | The bundled MCP server (`remove-profanity-mcp`): four read-only tools so an agent can moderate text without writing code. Still zero dependencies. |
| [llms.txt](llms.txt) | Terse machine-readable reference. **Hand this to your coding agent** and it will wire the package up correctly first time. |
| [SPEC.md](SPEC.md) | Per-module contract. |
| [benchmark/METHODOLOGY.md](benchmark/METHODOLOGY.md) | How the battery is built and what it refuses to do. |

## Chat moderation for India, and other use cases

Built for products where users type Indian languages on an English keyboard:
Hinglish abuse detection in chat and comments, romanized Indic text moderation
in reviews and user-generated content, community and gaming platforms, and
support inboxes. Works in Node 18+, in bundlers, and offline — no API calls,
no network, no telemetry, no model to download.

## License

MIT.
