# Performance notes

Where a check's time goes, the invariants that keep it there, and how to
measure a change without lying to yourself. Published numbers live in
[benchmarks.md](benchmarks.md); what the 2026-08-15 speed program changed, and
what it cost to learn, is summarised here — the step-by-step working notes it
was written from are not part of the repository.

**This file is the prerequisite for touching the automaton, the folds' unit
twins, the profile gates or `isClean`'s streaming.** Each of those four is
carrying an invariant below that a plausible-looking change breaks silently:
the benchmark still passes, and the cost comes back somewhere the accuracy
tests cannot see.

## Where the per-check time actually goes

Per-check cost is sub-linear in dictionary size — nine packs on top of `en`+`hi`
move a 20k-word check by 0% — so the way to make a scan slower is to add work
per *character*. The invariants the speed program left, which are what you must
not break:

- **Every per-character loop reads a `Uint16Array` of code units, never the
  string.** V8 keys the inline caches behind `s.charCodeAt`, `s.length` and
  `s[i]` on the string's hidden class, and a matcher that has seen a few hundred
  strings of assorted origin has shown every hot site more than four of them —
  after which the compiler emits a generic property lookup per character. The
  same `isClean()` took 5.7 ms in a fresh ASCII-only process and 11.7 ms after
  the benchmark battery; that was the "JIT-order-sensitive" mystery, and the
  suspect it named (polymorphic `FoldResult` shapes) was measured and cleared.
  **Read `units[i]`, hoist `.length`, and if you must touch the string per
  character use `codeUnitAt` / `codePointAt` from `src/unicode/code-units.ts` —
  never `s.charCodeAt(i)`, `s[i]`, `s.codePointAt(i)` or `s.startsWith(t, i)` in
  a loop.**
- **One profile sweep, then gates that are proofs.** `profileUnits` answers in
  one pass "could this fold or tier change anything here?". Every flag is
  conservative in one direction (`false` proves absence) and **every gate
  carries, at the gate, the argument that a false flag makes the gated code the
  identity**; `test/code-units.test.ts` checks each flag against its definition
  on random strings, and caught a wrong `false` before it shipped. The skeleton
  pass is deliberately NOT gated on ASCII — Hinglish is ASCII, and
  `bhench*d`/`behnch*d`/`bhainch*d` unify only there.
- **No-op folds allocate nothing** (`FoldBuilder`, `chainFolds`, `identityFold`
  — a class instance checked with `instanceof`, because WeakSet registration was
  ~30% of construction), and **no `\p{...}` regex runs per character** (memoised
  in typed tables). Folds are `UnitFold`s and the string folds are wrappers, so
  there is one code path.
- **The automaton is compiled to typed arrays**, with dense fail-resolved
  transition rows only for the states within two steps of the root — real text
  keeps the walk that shallow, and a full DFA would be ~8 MB per matcher for no
  measurable gain. The skeleton pass never becomes a string, and allow spans are
  collected only when a candidate needs them (for `isClean()`, only in a
  computable window around it), so on clean text the allow automata never run.

What is left, per 20k-word ASCII `isClean()` with all packs: skeleton cascade
~0.65 ms, chunked whole-token walk ~0.4, exact automaton ~0.3, profile sweep
~0.2, skeleton automaton ~0.2. Every one is a whole-text pass the accuracy
contract requires on clean text.

Two rules for anyone measuring:

- **Measure in the runner, after the battery**, and only when the machine is
  quiet — the perf section's rebuild-construction column jumps when a test suite
  ran during it. If it was not quiet, re-run.
- **Micro-benchmarks of idioms mislead in both directions.** A function whose
  first call is the 120 KB document is OSR-compiled from that loop's feedback
  and can come out 3× slower or faster than the same function tiered up through
  short calls; variants measured in one process contaminate each other. Compare
  whole engine builds A/B — each variant in its own fresh process, and run both
  orderings, because whichever build goes second inherits a warmed machine.

**History.** Before the speed program the pipeline profiled at 20k words
(hi + en + ta) as folds ~76% of the scan, automata ~20%; the four fixes above
plus the dense root transition table gave a 2.3–3.8× speedup across every
corpus. Two wins from that round are still in and still about work *not* done:
pass 2 is not built when no loaded pack contributes a skeleton key, and
`isClean()` stops at the first surviving candidate. When you change tier
collection, keep `test/engine-early-exit.test.ts` honest — it asserts
`isClean(t) === (scan(t).matches.length === 0)` across every filter
combination, which is exactly the invariant a new tier or a new veto breaks.

The three 20k-word script corpora exist to keep this honest: a Latin-only perf
corpus hides the cost of the Indic path completely, and an all-lowercase one
hides the cost of every fold that fires on capital letters.

## What the pack measurements have shown

**Construction cost tracks PATTERNS, not lemmas.** ta (32 lemmas / 169 surfaces
/ 79 allow phrases) = 248 patterns; bn (29 / 218 / 30) = 248; mr (28 / 213 / 82)
= 295 — different lemma counts, near-identical pattern counts, near-identical
cost. Since romanizations are the deliverable and one lemma can carry a dozen,
**budget by pattern count**. Warm median of 25 builds, per pack: +0.28 ms for
Odia (15 lemmas), +0.48 for Tamil (32), +0.23 each for te/kn/ml, +0.8 for a
self-sufficient Indo-Aryan pack (pa, gu) — the gap being the measured price of
self-sufficiency, since such a pack carries its shared Latin core as well as its
native script and contributes about twice the patterns. All eleven build in
~8.5–9 ms warm, 33.71 ms cold.

**Per-check cost is very nearly flat in dictionary size, and the residual is
worth knowing.** Adding three packs moves text in a script the *new* packs cover
by 1–2%, while ASCII and Devanagari show nothing — that shape is the automaton
getting bigger, not a fold. Hence the diagnostic rule: **a per-check regression
that appears only on YOUR script is a fold you added; one that appears on every
script, ASCII included, is just the pattern set.** The first is a bug, the second
is the price of the pack. (The published curve is in `docs/benchmarks.md`.)

**Two ways to be lied to by the construction benchmark**, both of which produced
confident wrong numbers here before being caught. **Sequential blocks drift** —
"25 builds of A, then 25 of B" once put a 172-lemma matcher *below* a 159-lemma
one, so interleave one build of each per round. And **the median is contaminated
by GC even when interleaved**: the second configuration in each round absorbs the
collection the first triggered, which made a 15-lemma pack look like +2.1 ms and
moved the cost to whichever entry sat second when reordered. Take p10 instead, or
reorder and re-run to confirm. For the per-check side, never compare two
benchmark *processes* — that noise is bigger than any pack; build both matchers
in ONE process and alternate scans of the same text, which reads as ±0.001 ms on
a 1k-word document. And measure construction **warm**: across fresh processes it
scatters 11–30 ms and cannot resolve a delta this size at all.
