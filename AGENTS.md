# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge:
build, test, release, architecture, and sharp-edge notes that travel with the
code.

- **Adding a language pack**: follow `docs/language-packs.md` literally — the
  recipe plus the false-positive traps that actually bite. Per-language settled
  decisions and open native-speaker questions are `docs/pack-decisions.md`.
  Script orthography is data in `src/unicode/indic-scripts.ts`
  (`INDIC_SCRIPTS`); do not add branching to `src/unicode/normalize.ts`. If your
  script already has an entry, audit it anyway — Bengali's and Devanagari's were
  both wrong for the language that arrived second.
- **Packs are self-sufficient, and packs overlap.** A consumer may import one
  subpath, so a pack carries the Latin spellings of words it shares with another
  rather than deferring. Two entries reaching the same span always collapse to
  one match, and because `collectExact`'s dedupe key is `lemma + span`, two packs
  sharing a lemma **string** produce one candidate carrying the strictest reading
  of both (`mergeEntries`: highest severity, union of categories, `casualUse`
  only if both agree). Load order decides the reported `language` on a tie, never
  the verdict. Shared lemmas should still agree on severity, categories and
  `casualUse`; `test/marathi-overlap.test.ts` enforces it.
- **Close a recall gap on the dictionary side, never by loosening the token
  boundary.** Inflection/gemination families are generated inside the pack at
  module load — `expandInflections` (hi), `degeminate` (ta), `inflect` (en) —
  each with an orthographic exclusion set, and the engine never learns they
  exist. Matching the lemma *inside* a token is the alternative, and it is what
  earns rivals `shiitake`, `Moby Dick` and `Penistone`. Measure the cost both
  ways, before and after: the benchmark clean corpus AND the
  `/usr/share/dict/words` sweep, which is the one that finds the collisions
  (`spiced`, `cocker`, `dicker`, `titter` — none visible from the lemma list).
- **Allowlist scope is GLOBAL across loaded packs, and that is measured.** With
  eleven packs loaded, 127 allowlist suppressions fire across 1.69M dictionary
  forms plus the benchmark clean corpus and **zero** are one pack's phrase
  silencing another pack's entry, so scoping per pack would buy nothing and would
  tie a phrase's reach to which pack wins the shared skeleton index. What keeps
  that zero is data, not the engine: every allow phrase a lemma needs must live
  in the pack that owns the lemma — `hi`'s `laude` relying on `en`'s `cum laude`
  meant `data/hi` ALONE had a false positive nothing could see. When a token is
  profane in one language and innocent in another, fix it in the pack that owns
  the weaker spelling. Mirror check: `test/all-packs-dictionary-sweep.test.ts`;
  reasoning and numbers: `test/collapsed-allow-scope.test.ts`.
- **The repeat-collapsed pass is stretch-gated on BOTH sides.** Its candidates
  always required a run of 3+; its allow spans now do too, because otherwise an
  ordinary doubled letter folds your lemma onto an allow phrase and kills it —
  `chhinali` (or) and `chinaali` (kn) both died against kn's `chinali`. Still do
  not allowlist a word that repeat-collapsing folds your pattern onto (`tulu` vs
  `tullu`): the phrase is wrong even where the gate now saves it.
- **`matchMode: 'prefix'` needs a CLOSED trap set, not just an allowlist.** If
  the innocent words sharing the stem are open-ended (every Kunna- place name in
  Kerala, every Tulli- proper noun), no allowlist can ever be complete — use word
  mode, or drop the romanization.
- **Most pack-wide allowlist entries protect nothing.** Whole-token matching with
  Unicode-property boundaries is what beats the Scunthorpe problem; measured, 17
  of 306 pack-wide phrases are load-bearing and the entire English list
  (`scunthorpe` included) is inert. Inert is not free — the entry is still a
  global suppression span for every other loaded pack. Add a phrase only after
  checking the case fails without it; `test/allowlist-liveness.test.ts` enforces
  that, and its `KNOWN_INERT` list is where a deliberate belt-and-braces entry
  gets its reason written down.
- **`skeletonSafe` is decided by the collision test, never by key length,** and
  the sweep that answers it runs **per pack against an EMPTY baseline** over the
  dictionary *plus its regular inflections*
  (`test/all-packs-dictionary-sweep.test.ts`). A baseline of hi+en hid hi's own
  false positives from every sweep ever run, and a headword-only word list cannot
  see `shuddered`, `calloused`, `bounced` or `benched`. Sweep-sourced allowlists
  are legitimate; hand-written ones are how `bnkd` shipped with `banked` listed
  and `bounced` missed. Rule in `docs/language-packs.md`.
- **Caste terms: ship epithets, remove categories.** Maintainer decision,
  2026-08-14 — is the word thrown at a person, or a category written about? —
  and it is a *removal*, because default `minSeverity` is 0 so a retained entry is
  still censored and `casualUse` only annotates. The severity-4 versus severity-3
  line in the data is NOT the rule.
- **The acceptance gate is that every pre-existing test still passes.**
  `npm run typecheck && npm test && npm run build`. New packs and folds mostly
  break *other* languages, not their own — re-run the existing scunthorpe cases
  with your pack loaded.
- **Correctness bar for folds**: `baseFold` feeds the exact, high-precision tier,
  so a fold there rewrites every word of the language. Recall guesses belong in a
  pack's `variants` or the skeleton tier. See `SPEC.md` Module A. An obfuscation
  that would need a fold to *delete* characters between letters (masks,
  separators) is a whole-token matcher rule instead — the `masked` and
  `separated` tiers — precisely so it cannot rewrite unrelated words.
- **Every whole-token rule's lock has a NAMED collision, and a widened lock must
  name its own.** The round-3 rules (digit masks `f4ck`, chunk merging
  `fu.ck`/`as sh ole`, hashtag splitting, emoji infix, initial doubling,
  Latin-only mark stripping) are specified in `SPEC.md` (the lock table under
  "The four tiers") and pinned with their traps in
  `test/evasion-round3.test.ts`; its closing "deliberate misses" block prices
  each remaining miss with the innocent text that keeps it out (`fu ck` ↔ "lo
  da"/"ga and"; `*uck` ↔ `*hit save*` and `boo*` footnotes; `fck` ↔ FCK football
  clubs). Before widening a lock, find the collision that lock was named for;
  when adding a pack, run the fragment-split enumeration in
  `docs/language-packs.md` — that is how "be an er" → beaner was caught before it
  shipped. Digit folding is decided per TOKEN, asymmetrically: letter-led keeps
  literal adjacency (the A55 road must never become "ass"), digit-led folds whole
  or not at all (`5h17`'s trailing 7 has no letter neighbor).
- **Per-check cost is sub-linear in dictionary size, not flat**, and the
  benchmark prints the curve ("cost vs dictionary size" in `results.txt`).
  Measured: `en` alone → `en`+`hi` is +90% on a 20k ASCII check (the skeleton
  pass and the tiers Hindi switches on), and the *next nine packs* — 212 more
  lemmas — move it 0%. `hi` alone (56 lemmas) costs almost twice `en` alone (70)
  on pure ASCII. So a real slowdown is new per-*character* work: a regression on
  YOUR script only is a fold you added; one on every script including ASCII is
  the pattern set. Before optimizing — and before touching the automaton, the
  folds' unit twins, the profile gates or `isClean`'s streaming — read
  `docs/performance.md`, which is where the 2026-08-15 speed program's result,
  its invariants and its dead ends are written down. The invariants to protect:
  no-op folds
  allocate nothing (`FoldBuilder`, `chainFolds`, `identityFold`), no `\p{...}`
  regex runs in a per-character loop, and **every per-character loop reads a
  `Uint16Array` of code units, never the string** — see next.
- **Never read a string per character in a hot loop** — no `s.charCodeAt(i)`,
  `s[i]`, `s.codePointAt(i)`, `s.startsWith(t, i)`, and no `s.length` in a loop
  test. V8 keys those inline caches on the string's hidden class
  (sequential/cons/sliced/thin/internalized × one-/two-byte); after a few hundred
  strings of assorted origin every hot site had seen more than four and TurboFan
  emitted a generic lookup per character — the same `isClean()` was 5.7 ms in a
  fresh process and 11.7 ms after the battery, and the old "JIT-order-sensitive"
  bullet here was that (its suspect, polymorphic `FoldResult` shapes, was
  measured and cleared). Read `unitText.units[i]`; `src/unicode/code-units.ts`
  says how the array is built, and its `codeUnitAt`/`codePointAt` helpers are the
  only sanctioned per-character string reads. Fresh-process and battery-first
  timings now agree within ~10%; the runner is still where published numbers come
  from.
- **Timing runs must be quiet, and the max column tells you when they were not.**
  The perf section runs last, after the battery and sweep (~8.5 min total;
  `RP_SKIP_DICT=1` reproduces its perf rows in ~2 min). A test suite or a build
  running during it inflates the rebuild-construction column and the maxes; if
  that happened, re-run. This package's own max on a row is sometimes one GC-hit
  trial (it allocates a few typed arrays per check); rank by the medians.
- **`README.md` is an npm shop front, not the manual.** Keep it under ~200 lines
  with the first code sample inside the first ~25. Detail lives in
  `docs/usage.md` (API, options, pack selection), `docs/matching.md` (tiers,
  folds, deliberate misses, allowlists), `docs/benchmarks.md` (every table,
  honest readings), `docs/language-packs.md` (the pack recipe),
  `docs/pack-decisions.md` (per-language decisions and open review items),
  `docs/performance.md` (where per-check time goes, and how to measure) and
  `docs/mcp.md` (the MCP server's manual). `SPEC.md` stays the per-module
  contract. Per language you touch all of them — step 9 of
  `docs/language-packs.md` lists which.
- **Nothing in `README.md` or under `docs/` prints an unmasked slur**: mask one
  letter (`f*ck`, `बहन*ोद`), the way the existing examples do. Innocent
  homographs the filter must not break (`Scunthorpe`, `shala`, `Suar`, `Randi`,
  `bkl`) are kept verbatim — that is the point of quoting them. The exceptions
  are `docs/language-packs.md` and `docs/pack-decisions.md`, where the literal
  strings are load-bearing. Verify by scanning the docs with the package itself:
  any match whose `surface` has no mask character and is not a documented
  homograph is a regression.
- **`llms.txt` (repo root) is the agent-facing reference and ships in the
  tarball** (`package.json` `files`); `docs/` deliberately does not. It
  duplicates signatures, defaults and the `scan()` shape on purpose — when the
  public API changes, it changes too, or an agent wires the package up wrong.
  Since the MCP server exists it also carries the client-config block, so an
  agent reads it and calls the tool instead of writing code.
- **`src/mcp/` is ABOVE the library, and that is what keeps it inert.** The
  `remove-profanity-mcp` bin imports `src/index.ts` and the `src/data/<code>`
  subpaths a consumer would; nothing in `src/` may import back, or
  `import 'remove-profanity'` starts pulling in a JSON-RPC server.
  `test/mcp-packaging.test.ts` enforces that plus the rules that make the
  zero-dependency, no-host-access claim checkable rather than promised: empty
  `dependencies`, no `node:` import anywhere, and no `process.` outside
  `stdio.ts`. **This package has no `@types/node`** — the transport declares
  the `process` members it uses locally (tests use `@ts-expect-error` and
  re-type; see `test/punjabi-gujarati-dictionary.test.ts`).
- **The MCP protocol is hand-rolled from the specification, and the tools are
  read-only on purpose.** The official SDK is 4.3 MB with eleven runtime
  dependencies, which would falsify the headline claim for every consumer. The
  server is dual-era — legacy `initialize` and modern `server/discover` plus
  per-request `_meta`, decided per request — and there is no tool that adds a
  word, edits an allowlist, touches the filesystem, spawns or reaches the
  network, because the text it judges is text somebody else wrote. Protocol
  coverage, the deliberate `clientCapabilities` deviation and the client-config
  block are in `docs/mcp.md`; every protocol decision is in
  `src/mcp/server.ts`, and `src/mcp/stdio.ts` only moves bytes.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
