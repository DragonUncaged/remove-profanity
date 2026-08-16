# Adding a language pack

The recipe, derived from actually adding the ten packs after Hindi. The
pitfalls below are the ones that were actually hit, most costing a debugging
round each, so read it literally. Copy from `src/unicode/indic-scripts.ts`
(script rules), `src/data/ta.ts` (a full pack), `src/data/or.ts` (a small one)
and `test/tamil-*.test.ts`.

**The per-language record — settled decisions, dropped lemmas, the word-list
policy and the unresolved native-speaker questions for every shipped pack — is
[pack-decisions.md](pack-decisions.md).** Read your language's section before
touching its pack.

| # | Step | File |
|---|---|---|
| 1 | Register the script's orthography — **or audit the entry already there** | `src/unicode/indic-scripts.ts` |
| 2 | Write the pack, and settle any cross-pack overlap | `src/data/<lang>.ts` |
| 3 | Decide `matchMode: 'prefix'` per entry, and defend each one | `src/data/<lang>.ts` |
| 4 | Add the subpath export | `package.json` |
| 5–7 | Normalization, schema, evasion and false-positive tests | `test/<lang>-*.test.ts` |
| 8 | Sweep an English dictionary, then measure the speed cost | `benchmark/compare.mjs` |
| 9 | Update the docs and flag your uncertainty | `docs/*`, `README.md`, `SPEC.md` |

`npm run typecheck && npm test && npm run build` must be clean, and **every
pre-existing test must still pass** — that is the real acceptance gate. New
packs mostly break *other* languages, not their own.

---

## Step 1 — Register the script

Append one entry to `INDIC_SCRIPTS` in `src/unicode/indic-scripts.ts` (fields:
`drop`, `map`, `virama`, `nasalsToAnusvara`, `anusvara`, `collapseViramaRuns`).
That array is the only place script knowledge lives — `normalize.ts` derives its
lookup tables from it at load, and you should not need to touch `normalize.ts`
at all. Its `fusedPointwiseFold` keeps an ASCII branch that must stay first and
allocation-free, over one fixed range check (`INDIC_CASELESS_RANGE`,
U+0900–U+0DFF, all caseless) that is fixed on purpose, so registering a script
can never silently change the fast path.

**The rule that matters most: every fold in this table must be correct
orthography for that script, not a recall heuristic.** The table feeds pass 0,
the exact high-precision tier, so a wrong fold silently rewrites every word of
the language, innocent ones included — and you will not notice, because your
profanity tests still pass. Recall guesses have two better homes: per-lemma
`variants` (blast radius of one word) or the skeleton tier (explicitly
report-not-block). If you are unsure, **leave it out and write it down** in
[pack-decisions.md](pack-decisions.md); an honest short list beats a confident
long one.

Two chores this step does not look like it has: `test/tamil-normalize.test.ts`
asserts the registry's contents **by containment — never tighten it back to an
exact `INDIC_SCRIPTS` list**, a guaranteed conflict and a guaranteed false
failure while several language tasks are in flight; and `benchmark/compare.mjs`
has its own pack list (step 8).

### Check the precomposed-nukta question for YOUR script

`indicFold` runs inside `baseFold` *after* NFC, so `drop: [nukta]` only unifies
ਸ਼ ≡ ਸ / क़ ≡ क if NFC has already split the precomposed letter into base +
nukta. Whether it does is a per-script fact, and Devanagari gives **both**
answers at once: U+0958–U+095F are composition exclusions (`drop` is enough),
while ऩ U+0929, ऱ U+0931 and ऴ U+0934 are **not** — NFC *composes* them, `drop`
silently does nothing, and they need explicit `map` entries.

That is the trap that cost the most: it silently split Marathi's eyelash reph,
so महाऱ्या and महार्या — one word, both typed constantly — were two keys. The fix
is one `map` entry (`0x0931 → 'र'`); the lesson is that **"NFC handles it" must
be checked in a REPL, per code point.**

```js
'क़'.normalize('NFC').length   // 2 — excluded, decomposed
'ऱ'.normalize('NFC').length   // 1 — NOT excluded, composed
```

Enumerate the whole block rather than hand-listing — that is how U+0929 was
missed — then assert the answer in `<lang>-normalize.test.ts` **from the code
points**, not from string literals, because the test file's source encoding can
otherwise make it pass for the wrong reason. Gurmukhi's six precomposed nukta
letters are all exclusions; Gujarati has none at all; Tamil has no nukta.
`test/punjabi-normalize.test.ts` and `test/gujarati-normalize.test.ts` show both
shapes.

### Do not copy the neighbouring script's arm

Devanagari and Bengali happen to share four rules. That is a coincidence of
those two scripts, not a pattern. What the nine registered scripts take:

| Rule | Deva | Beng | Orya | Taml | Telu | Knda | Mlym | Guru | Gujr |
|---|---|---|---|---|---|---|---|---|---|
| drop visarga | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| strip nukta | ✅ | ✅ | ✅ | ❌ none | ✅ | ✅ | ❌ none | ✅ | ✅ |
| nasal + virama → anusvara | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | **❌** | ❌ | ✅ |
| chandrabindu → anusvara | ✅ | ✅ | ✅ | ❌ none | ❌ ambiguous | ❌ ambiguous | ❌ Vedic | ✅ (tippi/adak) | ✅ |
| collapse virama runs | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| letter merges | eyelash reph ऱ→र | — | — | grantha, ன→ந | ౘ/ౙ | none | chillu expansion | — | — |

An unset field is a deliberate statement that the script does not do that thing;
write the reasoning in a comment, or the next person will "fix" the gap.
`SPEC.md` Module A carries every one of those reasons, and the per-script
comments in `indic-scripts.ts` are the long form. Three shapes of trap to know
before you fill a row in:

- **The anusvara rule splits the family, and Malayalam is on the other side.**
  Telugu and Kannada write homorganic nasal clusters with the sunna (అంత / ಬಂದ
  ordinary, అన్త / ಬನ್ದ the Sanskritic alternates), so folding is correct
  orthography. Malayalam writes them **only** as conjuncts — ചന്ദ്രൻ is Malayalam
  and ചംദ്രൻ is not — so taking the rule there would rewrite a large fraction of
  ordinary Malayalam onto non-words. Tamil is the same trap in another costume:
  ங்க / ந்த / ம்ப are its only native spelling.
- **A rule can be right in the abstract and reach nothing.** Odia takes four of
  Bengali's five rules, but য় U+09DF *decomposes* to য + nukta while ୟ U+0B5F has
  **no canonical decomposition**, so "strip nukta" silently does nothing for
  Odia's ୟ. Verify decomposition claims against the UCD; one `node -e
  "…normalize('NFD')"` settles in a second what a plausible memory gets wrong.
- **Merge letters only where the merge is near-injective, and leave dead
  contrasts alone.** Tamil ன→ந is safe (the alveolar and dental nasals are
  identical in modern Tamil and near-complementary in distribution) and the
  grantha letters ஜ ஶ ஷ ஸ → ச are a merge because they exist only to write
  loanwords (ஜாதி ≡ சாதி) — but ஹ was left unfolded, because its Tamilization is
  inconsistent. ல/ள/ழ, ர/ற, Bengali's শ/ষ/স and Marathi's ळ are phonemically
  contrastive and stay unfolded (வலி "pain" / வளி "air" / வழி "way"); so do the
  obsolete ఱ/ಱ/ೞ and both Telugu/Kannada candrabindus, where the modern reflex
  is genuinely ambiguous. Two answers means no rule.

**If your language's script already has an entry, you still owe it an audit.**
Bengali's existed before the `bn` pack, had been written next to Devanagari by
someone working on Hindi, and was wrong in two places (khanda ta ৎ → ত্ was
missing, so হঠাৎ and হঠাত্ were two keys; virama-run collapsing was missing).
Marathi's Devanagari entry was wrong in one, in a way a comment in the file
confidently asserted was fine. Do not read the rules and nod: for each field ask
*why is this correct for my language*, and expect the answer to differ from the
neighbour's even where the rule is identical. Bengali's audit in full is the
comment on `BENGALI` in `src/unicode/indic-scripts.ts`; the open question it left
is in [pack-decisions.md](pack-decisions.md).

---

## Step 2 — Write the pack

Copy the shape of `src/data/ta.ts`. Quality over quantity: Hindi is 56 lemmas,
Tamil 32, Odia 15. A short honest list beats a long padded one, and every junk
entry is a permanent false-positive liability. Each entry needs a native-script
lemma, an honest `severity`, `categories`, curated `romanizations`, native
`variants`, and per-entry `allowlist` phrases.

### Sourcing, and why romanizations are the deliverable

Tamil had enough material to argue about; Odia did not. What worked, in order: a
**real dictionary** for spellings and for the traps (the Digital South Asia
Library hosts scanned dictionaries per language at
`dsal.uchicago.edu/cgi-bin/app/<dict>_query.py?qs=<word>&searchhws=yes`,
searchable by native script *or* transliteration, marking vulgar senses, and —
more valuable — the fastest way to find the innocent word your entry is about to
collide with); then a **crowd-sourced list with usage votes** for modern slang a
1930s dictionary cannot have (youswear.com gives an accuracy percentage per
entry — treat anything under ~60% as unsourced); and **reject the AI-written
"learn to swear in X" pages entirely**, whose examples are generic Hindi
loanwords or invented, two of which contradicted the dictionary outright. If a
term survives none of that, leave it out and say so in
[pack-decisions.md](pack-decisions.md): Odia shipped 15 lemmas, the honest size
of what could be sourced, and a better pack than 30 with 17 guesses in it.

Most Indian-language profanity online is typed on an English keyboard, so the
romanizations are what actually fire — and where every false positive comes
from, because romanized Indian text collides with three things at once. Ordinary
English (`pool` = பூல், `loose` = லூசு, both dropped); other words in the same
language (`suthu` is both சூத்து "arse" and சுத்து "to roam", dropped; `thotti`
is both the caste slur தோட்டி and தொட்டி "water tank", so that lemma ships
native-script only, where the vowel signs disambiguate); and Indian proper nouns
(`munda` is an Adivasi community, `nari` is நரி "fox" and a given name, both
dropped). **Dropping a romanization is a legitimate, frequently correct
answer** — write a comment saying why, right on the entry, because those
comments are the record of what was already considered.

### Set `skeletonSafe: false` by the collision test

The skeleton tier collapses a romanization to its consonant skeleton. The rule
for when a lemma opts out **is the collision test, never key length**:

> Run the sweep (`test/all-packs-dictionary-sweep.test.ts`). For each of the
> entry's keys, look at what it flags in the dictionary **and in the
> dictionary's regular inflections**. Any hit that is a real English word and is
> not the lemma's own spelling is a collision.
>
> - **No real-word collision** → leave the tier on.
> - **A collision family that is dense, common or open-ended** → `skeletonSafe:
>   false`. Open-ended means no list can close it: proper-noun derivatives
>   (Nimrod → Nimrodian, Nimrodic…) and hyphenated compounds, which the skeleton
>   joins into one token.
> - **A small, closed collision set** on a key the pack depends on for recall →
>   keep the tier and **allowlist every word the sweep names**. Sourced from the
>   sweep, never from imagination, and pinned in the pack's data test.

**Key length is necessary and nowhere near sufficient**, and the packs were once
shipped on the length rule alone — `skeletonSafe: false` applied 31 times with
comments reading `key "kmr" (3)`, while the keys actually causing the reported
false positives were four and five characters. Every shipped opt-out now carries
its colliding English word in a trailing comment; the ones that taught the rule:

| Lemma | Key | Really collides with | Fix |
|---|---|---|---|
| கழிசடை | `klsd` | **closed**, **classed**, **calloused**, callused — 83 families | tier off |
| கேணப்பயல் | `knpl` | cineplasty, **chain-pull**, **can-polishing** | tier off |
| नामर्द | `nmrd` | **Nimrodian**, naemorhedus | tier off |
| ಸೂಳೆಮಗ | `slmg` | **sluggard**, slugger, salmagundi — 20 words | tier off |
| ছোটলোক | `ktlk` | **catholic**, catlike, catalectic | tier off |
| चुतमारीच्या | `ktmr` | **catamaran**, kitemark | tier off |
| बहनचोद | `bnkd` | **bounced**, **benched**, **bunched**, beancod | allowlist |
| भोसड़ीके | `bsdk`/`bsdn` | besodden, beshriek, basiarachnitis | allowlist |

Two lessons the table encodes. **The `bnkd` row is the cautionary one**:
`banked`, `bunked` and `bonked` had been allowlisted *by hand*, which looked
like the collision test being applied. It was not — the same key also carries
`bounced`, `benched` and `bunched`, which nobody thought of and which are
commoner than the three listed. An allowlist is only as complete as its source;
take it from the sweep. And **length is not safety — compounds are the worst
offenders**: the skeleton drops every non-initial vowel, so an eight-letter
compound collapses to four or five consonants and lands in the middle of
English's `-m-g-` and `-r-s-k-` families. `soolemaga` → `slmg` clears any length
rule comfortably and still catches twenty English words.

The pack test enforces the mechanical half (all-keys-short ⇒ must be `false`);
the collision test is judgement on the sweep's output, so leave the reason in
the trailing comment.

### Expand inflections on the dictionary side, never by relaxing the boundary

Four packs generate a spelling family at module load, inside the pack, where the
engine never learns it exists — `expandInflections` (hi), `degeminate` (ta),
`inflect`/`expandPack` (en, over `-s`, `-ed`, `-ing`, `-er`), `dropAddak` (pa) —
each with an **orthographic exclusion set**. The alternative, matching the lemma
anywhere inside a token, is exactly what earns obscenity `shiitake`, `Moby
Dick`, `cum laude`, `great tit` and `Penistone`; generating whole tokens closes
the same gap with the word boundaries left alone. Measured over the whole
shipped set: **zero new false positives on the benchmark clean corpus, and four
new hits in the 235,976-word dictionary sweep** (`cummer`, `hookers`, `raper`,
`slutter`, three of them derived from lemmas already matched). Obscenity scored
18 on the same corpus. Three things that cost time:

- **The exclusion set is orthographic, not semantic.** `spic` + `-ed` is
  `spiced`, `cock` + `-er` is a spaniel, `dick` + `-er` is haggling, `tit` +
  `-er` is a giggle. None are visible from the lemma list; the sweep found them.
- **The doubling rule needs its exceptions written down.** CVC doubling (`shit` →
  `shitting`) is right, but not before `c`, `w`, `x` or `y`, and not for a form
  already inflected — otherwise `cumming` yields `cummings`, a surname, and
  `spic` yields `spicced` rather than the `spiced` the exclusion set awaits.
- **A gemination expander is per-language, and never a fold.** Casual Tamil typing
  drops half of a geminate (சக்கிலி → சகிலி), but gemination is phonemic (படம்
  "picture" vs பட்டம் "title"), so a *fold* would collapse innocent minimal pairs
  across the whole language — as would folding Punjabi's addak. And expect not to
  need one at all: te/kn/ml ship without it deliberately, because Tamil's habit
  follows from its pulli-heavy orthography, Telugu and Kannada carry the same
  information in the anusvara (already a fold), and in Malayalam degeminating
  പണ്ണി "fucked" produces പണി "work".

### Cross-pack overlap — read this if your script is already taken

Marathi was the first pack to share a script *and* a vocabulary with an existing
one. What the engine does:

| Case | Behaviour | Safe? |
|---|---|---|
| Two entries, same span | always collapses to ONE reported match | ✅ never doubles |
| **Different** lemma strings, same surface | overlap resolution keeps the **higher severity** | ✅ order-independent |
| **Same** lemma string, same surface | `collectExact`'s dedupe key is `lemma + span`, so there is one candidate, taking the **strictest** reading of both (`mergeEntries`: highest severity, union of categories, `casualUse` only where both agree) | ✅ verdict order-independent, the `language` label is not |

So:

1. If your lemma string is byte-identical to another pack's, **keep severity and
   categories identical anyway** — a disagreement now resolves strictly rather
   than arbitrarily, but it is still a disagreement about what the word means.
   Enforce it with a test: `test/marathi-overlap.test.ts` fails if hi's severity
   moves; the merge is pinned in `test/punjabi-data.test.ts`.
2. "Same word" is not "same lemma string". भडवा (mr) and भड़वा (hi) are one match
   *key* after the nukta fold but two lemma strings, which puts them in the safe
   row. Check the strings, not your intuition.
3. **Every pack is SELF-SUFFICIENT** (standing project decision; rule 4 of the
   word-list policy below). Never defer a shared romanization — the subpath
   export means a single-pack consumer is a real consumer. Omit a romanization
   only when it is *ambiguous*, and say which word it collides with in the entry
   comment.
4. **Re-ship the other pack's allowlist entries on your entry.** `gandhi` /
   `uganda` / `lund university` live in `data/hi`, and `data/mr` alone would
   otherwise censor them. Include the phrases that guard the borrowed
   romanization's **skeleton key**, not just its spelling — borrowing
   `motherchod` also inherits the key `mtrkd`, which is skeleton("motorcade")
   and skeleton("matricide"), and those phrases are pack-wide in hi rather than
   on the entry you copied. Then run your false-positive suite with **your pack
   alone**: that is the only configuration a missing phrase shows up in.
5. Consequence worth knowing, not a bug: when two packs reach the same span
   through *different* lemma strings with equal severity, the reported `lemma`
   and `language` follow pack order. The match, span and severity do not. Do not
   route on `language` for a match in a shared script.

---

## Step 3 — `matchMode: 'prefix'`

**Most languages should skip this step.** Prefix mode exists for agglutination,
and Indo-Aryan languages mark case with free-standing postpositions (Punjabi ਦਾ
/ ਨੂੰ / ਤੋਂ, Gujarati નો / ને / થી, Hindi का / को), so the token boundary is real
and relaxing it buys nothing but false positives — pa and gu use no prefix
entries, and their data suites assert that with the reason. It is **not a
Dravidian-only device**, though: Odia attaches its case markers too (ଗାଣ୍ଡି →
ଗାଣ୍ଡିରେ), and abuse is written with the suffix attached far more often than
bare. Ask what the language does, not what family it is in.

**Prefix mode is a loaded gun**: it relaxes the end-of-word boundary, so it
fires on far more than you intend. Four rules, and `matchMode` is per **entry**,
not per surface — turning it on makes every romanization a prefix pattern too.

1. **Every prefix surface is ≥ 4 characters for Latin, ≥ 3 for native Indic.**
   One Indic code unit routinely carries a consonant plus a vowel sign — లంజ is
   three units and five phonemes — so 3 native is the same evidence as 4 Latin.
2. **Every prefix entry carries an allowlist.** Both rules are enforced by the
   pack test.
3. **Both halves get a test**: that it catches the inflections it exists for,
   *and* that it spares the innocent words (`test/tamil-prefix.test.ts`).
4. **The start boundary still applies.** Prefix mode relaxes only the end; a stem
   buried mid-token must not match, or prefix mode degenerates into substring
   search. There is a regression test.

### The trap set must be CLOSED, not merely allowlisted

Rule 2 is necessary and not sufficient. The real test is whether the allowlist
can ever be *complete* — an open trap set is not a bigger allowlist, it is the
wrong match mode:

| Stem | Trap set | Verdict |
|---|---|---|
| `pooru` (പൂറ്) | പൂരുരുട്ടാതി, the nakshatram — and essentially nothing else | **closed** → prefix mode |
| `dengu` (దెంగు) | "dengue" and its two or three collocations | **closed** → prefix mode |
| ಬೋಳಿ | ಬೋಳಿಸು "to shave" and its paradigm | **closed** → prefix mode |
| `kunna` (കുണ്ണ) | *every* Kunna-/Kunnu- toponym in Kerala — Kunnamkulam, Kunnathunad, Kunnathur, Kunnukara… | **open** → word mode |
| `kuthi` (കൂതി) | കുത്തി "stabbed", കുതിര "horse", കുതിക്കുക "to leap"… | **open** → the romanization is dropped entirely |
| ବାଣ୍ଡ | ବାଣ୍ଡି "bullock cart", ବାଣ୍ଡେଜ୍ "bandage", ବାଣ୍ଡ୍ "band" | **open** → word mode, and its suffixed forms are knowingly given up |

The Malayalam entries there agglutinate exactly as hard as the ones that got
prefix mode; they are word mode because no finite list of Kerala place names
exists. What makes a closed set cheap to defend is that **allow phrases are
matched as substrings, with no word-boundary check**, so allowlisting a *stem*
covers its whole inflectional family — ಬೋಳಿಸು and ಬೋಳಿಸಿ between them suppress
ಬೋಳಿಸಿದ / ಬೋಳಿಸುವ / ಬೋಳಿಸಿಕೊಂಡ without enumerating the paradigm.

The traps found in practice. Note that the dangerous collisions are mostly *in
the same language*, not in English: search the language's own vocabulary for
words sharing the stem before shipping a prefix entry, and accept that the
answer is sometimes "not this entry".

| Prefix | Innocent word it swallowed | Fix |
|---|---|---|
| `kuthi` (கூதி) | **kuthirai** = குதிரை "horse"; **கூதிர்** "the cold season" | allowlist |
| புண்ட (புண்டை) | **புண்டரீகம்** "lotus", the name புண்டரீகன் | allowlist |
| `punda` | **Pundalik** (the Vithoba devotee), **Pundarika** | allowlist |
| `soothu` (சூத்து) | **soothiram** = சூத்திரம் "formula", English *soothing* | allowlist |
| `thevidiya` | **devadasi / தேவரடியார்**, the etymological source | allowlist |
| `mayir` (மயிர்) | also the ordinary word for "hair" | `casualUse: true` |
| ଗାଣ୍ଡି | **ଗାଣ୍ଡିବ / ଗାଣ୍ଡୀବ** = Gāṇḍīva, Arjuna's bow | allowlist |
| `tulli` | **Tullian**, **tullibee**, Tullius / Tulliola / Tullahoma | removed — open set |

### An allowlist phrase is a suppression span for every pack

Allow phrases veto any candidate contained in them, in any loaded pack, not just
yours. Odia allowlisted ଗାଣ୍ଡିମ (an obscure epithet of Arjuna) and thereby
silenced ଗାଣ୍ଡିମ-anything, including the plural of the profanity it was
protecting. **Keep allow phrases long and specific, and never add a short
generic word "for documentation"** — put that in a comment. Two mechanisms will
silently disable your entry:

1. **Do not allowlist a word that repeat-collapsing folds your pattern onto.**
   `ತುಲ್ಲು` ships `tullu`; ತುಳು (the Tulu language) is `tulu`. Allowlisting the
   bare word `tulu` looks obviously right, silently kills the entry because the
   collapsed pass folds "tullu" → "tulu", and is unnecessary anyway, since a
   pattern that *changes* under repeat-collapsing is excluded from the collapsed
   index. The collapsed pass now gates allow spans on a run of 3+ exactly as it
   always gated candidates, which narrows the rule without retiring it — write
   the phrase correctly anyway. What the gate fixed is the wider class: allow
   phrases silencing lemmas matched in *uncollapsed* space, which is how
   `chhinali` (or) and `chinaali` (kn) both died against kn's `chinali`.
2. **A pack-wide allowlist is global once the pack is loaded**, deliberately and
   measurably: with all eleven packs loaded, across 1,693,513 dictionary forms,
   the 486 benchmark clean cases and all 2,286 shipped surfaces, **127 allowlist
   suppressions fire and zero of them are one pack's phrase silencing another
   pack's entry**. Scoping per declaring pack would change nothing measurable
   while coupling a phrase's reach to which pack wins the shared skeleton index.
   (`test/collapsed-allow-scope.test.ts` records the reasoning; the mirror check
   in `test/all-packs-dictionary-sweep.test.ts` keeps the number at zero.)

   **That zero is a property of the DATA, not the engine** — the self-sufficiency
   rule again: every allow phrase a lemma needs must live in the pack that owns
   the lemma. The one violation found was `hi`'s `laude` (लौड़ा), protected from
   "summa cum laude" only by `en`'s `cum laude`, so `data/hi` alone had a false
   positive no all-packs measurement could see. When a token really is profane in
   one language and innocent in another, **fix it in the pack that owns the
   weaker spelling**, by dropping the romanization or allowlisting it *there*,
   never by relying on another pack's list. Your data test therefore needs both
   halves (copy `test/kannada-data.test.ts` or `test/odia-data.test.ts`): every
   one of your surfaces through a matcher holding **your pack alone**, asserting
   none is clean — a string comparison against other packs' surfaces cannot see
   this, since `chinali` and `chinaali` are different strings the collapsed pass
   folded together — and your clean traps through every OTHER pack alone, so a
   trap that only passes because someone else's allowlist covers it fails where
   you can see it.

Two engine behaviours to know. A prefix match's span is **extended to the end of
the token** so censoring covers the whole agglutinated word (otherwise
புண்டைக்கு censors as `*****க்கு`), while allowlist suppression is tested against
the **unextended** stem span (`Candidate.core`) — getting that backwards made
`kuthiraiyil` ("on the horse") a false positive, because the extended span had
grown past the end of the `kuthirai` allow span. The allowlist decides *whether*
something matched; the extension decides only how much gets censored. And **a
match's reported `end` lands on the start of the final grapheme cluster**, so a
word ending in a combining mark reports one unit short (`புண்டை` reports `புண்ட`,
Hindi `चूतिया` reports `चूतिय` identically); `censorText` compensates by expanding
spans to cluster boundaries, so **censoring is correct** and only the reported
`surface` is short. Assert on `censor()` output, not on exact native-script
`surface` strings. Fixing it would change reported spans for Hindi too, so it is
deliberately left alone.

---

## Step 4 — Wire the subpath export

Add a `./data/<lang>` entry to `exports` in `package.json`, matching
`./data/hi`. Per-language subpaths are how consumers avoid paying for languages
they do not use; **never merge packs into a shared barrel file**, which silently
ships every language to everyone.

---

## Steps 5–7 — Tests

| File | Covers |
|---|---|
| `<lang>-normalize.test.ts` | script rules, the folds you did *not* add, **and that Hindi/Bengali/English are unchanged** |
| `<lang>-data.test.ts` | pack schema, severities, category tagging, deliberate romanization omissions |
| `<lang>-evasion.test.ts` | must-flag: native script, ZW-injection, leet, stretching, masking, mixed script, homoglyphs |
| `<lang>-scunthorpe.test.ts` | must-be-clean: proper nouns, place names, same-language homographs |
| `<lang>-<hard part>.test.ts` | whatever is genuinely hard about YOUR language |

The fifth file is a slot, not a fixed name: Tamil's hard part was prefix mode
(`tamil-prefix.test.ts`), Marathi's was sharing a script and vocabulary with
Hindi (`marathi-overlap.test.ts`), Bengali's was the script audit, which belongs
in the normalize suite — so Bengali has four files and Marathi five. Do not write
an empty prefix suite to fill the row; assert its absence in the data suite
instead, with the reason. Four things worth copying deliberately:

- **Run the false-positive suite twice**, with the pack alone and alongside
  hi + en. The subpath export means consumers really do load one pack, and
  cross-pack allowlists then do not exist to save you — the Marathi pack shipped
  a `catamaran` false positive that only appeared with `data/mr` loaded ALONE,
  because hi's and bn's allowlists were hiding it.
- **Re-run the existing scunthorpe cases with your pack loaded.** The regression
  risk of a new pack is not your language; it is the other ones.
- **Probe the separated ("spelled-out") tier from all three sides.** It joins a
  maximal run of single-CODE-POINT letters and requires the join to equal a
  listed surface outright, so native Indic script cannot reach it at all (ପ ୁ ଦ ି
  breaks at the first matra, a matra being `\p{M}` not `\p{L}`) — making it a
  romanization-only affordance and a deliberate miss in native script. Assert
  that a spelled-out romanization is caught; that the spellings your pack DROPPED
  are not resurrected by it (`g a n d i` must stay clean if `gandi` is not a
  listed surface); and that native script stays clean (`খ া ন ক ি`, `ग ा ं ड`),
  because a future change to the shape lock would otherwise be silent. Then sweep
  the dictionary through this tier too — every word spelled out with spaces and
  with dots, your pack alone. ~200k words × 2 separators found zero, which is the
  result you want before claiming the tier is safe.
- **Assert that no allowlist phrase suppresses one of your own surfaces.** Four
  lines, and it caught two silent failures:

  ```ts
  const m = createMatcher({ packs: [yourPack] });
  for (const e of yourPack.entries)
    for (const s of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])])
      expect(m.isClean(s), `"${s}" is suppressed by its own pack`).toBe(false);
  ```

  | Allow phrase | Silently disabled | Why |
  |---|---|---|
  | `শাল` "sal tree" | the lemma `শালা` | an allow phrase that is a PREFIX of a surface swallows it, because a match's `end` lands on the *start* of its final cluster — so `[0,3] ⊆ [0,3]` |
  | `maggi` | the romanization `maagi` | allow spans are collected across ALL passes, and in the repeat-collapsed pass `maggi` → `magi`, which contains the collapsed `maagi` |

  Both were leftovers from a term already dropped from the pack. **An allowlist
  entry that no longer protects anything is not free** — it is still a global
  suppression span for every other loaded pack. Delete allow phrases when you
  delete the lemma they guarded.

The **chunked** companion tier merges runs of short multi-letter fragments
(`fu.ck`, `as sh ole`) under whole-run equality, and your language's short
function words are its collision surface: two space-joined fragments are banned
outright because `lo da` (Telugu locative + vocative) and `ga and` (sargam) merge
onto surfaces, and the one natural English collision the fragment sweep found
(`be an er` → beaner) is fenced by allow phrases on the en entry. **When you add
a pack, re-run the fragment-split enumeration** — split every surface into 2–4
word-ish parts and eyeball what your language actually writes adjacently. That is
how `be an er` was found; `test/evasion-round3.test.ts` holds the engine-side
locks.

---

## Step 8 — Sweep the dictionary, then measure the speed cost

### The sweep — required, and it will find things

Before you trust a single measurement, run every word of a large English
dictionary **and its regular inflections** through your pack **loaded alone,
against no baseline at all**:

```js
const mine = createMatcher({ packs: [yourPack] });        // no baseline
for (const w of words)
  for (const form of [w.toLowerCase(), ...inflect(w.toLowerCase())])
    if (!mine.isClean(form)) console.log('FP:', form, mine.scan(form).matches);
```

`test/all-packs-dictionary-sweep.test.ts` is that sweep, pinned for all eleven
packs. Two structural blind spots in the version it replaced silently guaranteed
a clean result. **A baseline hides the baseline's own bugs**: the earlier recipe
built `createMatcher({ packs: [hindi, english] })` and skipped anything it
already flagged as "pre-existing, not your regression", which was true for *your*
pack — and meant **the hi pack's own false positives were invisible to every
sweep ever run**, because hi was the filter. Sweep each pack alone with nothing
subtracted and pin the entire hit list; a deliberate hit is a line in a table
with a reason next to it, not a filter that also swallows what you never looked
at. And **the word list is HEADWORDS**: `shudder`, `callous`, `close` and `class`
are in it, but `shuddered`, `calloused`, `closed` and `classed` are the forms
that actually false-positived, so generate the regular inflections (`-s`, `-ed`,
`-ing`, `-er`, `-est`, `-ly`, `-ies`) and sweep those too — 235,000 headwords
become 1.7M forms, and `bounced`, `benched` and `bunched` exist nowhere else.

Scale check: the pre-repair sweep found **six** collisions across the first
Bengali and Marathi drafts and **fifty** across te/kn/ml, the latter after
fifteen green test suites and a zero-false-positive benchmark. None was findable
by staring at the word list, and the fix for nearly every one was `skeletonSafe:
false` rather than an allowlist — an allowlist enumerates the collisions you
thought of, and the sweep is proof you will not think of them all.

Four refinements worth copying (`test/punjabi-gujarati-dictionary.test.ts`):

- **Pin the outcome as a test, asserting the novel set EXACTLY**, so a lemma
  added later either keeps the set or forces whoever widened it to say why. Skip
  when the dictionary file is absent (`describe.skipIf`) — a BSD/macOS path, and
  a development guard rather than a portability claim. Give the file a
  language-scoped name; a shared `dictionary-sweep.test.ts` is a guaranteed
  conflict between concurrent pack tasks.
- **Assert "no new *skeleton-tier* hit" as well as "no new hit".** An exact-tier
  hit on a dictionary word is often intentional — pa matches `chuhra` because the
  dictionary entry IS the caste name the lemma targets, and hi matches `chamar`,
  `bhangi`, `chut`, `laund` and `tatta` the same way — while a skeleton-tier hit
  essentially never is. An accepted survivor needs a written reason: **Pulayan**
  is a Webster's headword for the caste and also the pack's own lemma, which is
  policy rule 2's shape exactly.
- **Re-run it with ALL packs loaded, and run the mirror check**, since an allow
  phrase is a suppression span for every pack and a new pack can break an
  existing one without flagging a single extra dictionary word. Assert in three
  directions: your surfaces vs your own pack, your surfaces vs every pack, and
  every other pack's surfaces before and after yours is loaded. That check caught
  gu's `chhinali` being dead whenever `data/kn` is loaded — sweeping for new
  *hits* found nothing, sweeping for *suppression* found a real bug.
- **The sweep is necessary and not sufficient, because the word list is
  English.** `chinali` — the Chinali people of Himachal Pradesh — survived it and
  was caught by the *Odia* pack's clean-trap suite. Run both gates.

### Adding your language to the benchmark, and what to record

Three edits, all data: `AVAILABLE_PACKS` in `compare.mjs` (ISO code → imported
pack), `LANGUAGE_SUITES` in `battery.mjs`, and
`LIBRARY_CLAIMS['remove-profanity'].packs` in `battery.mjs` — the last, or the
scorecard scores your own language as "not attempted". Nothing else is
language-aware, and **you do not write the evasion suite**: you declare the raw
material (`latin` and `native` base forms, the two `mix` script-mixing cases, two
`sentences` E0 controls, `named` and `clean` cases) and the runner applies the
whole transform matrix. That split is the point of the design — the transforms
are mechanical, so nobody can give their language the easy ones, and the
hand-written list is confined to the axes a function cannot express: morphology
(E8), transliteration spread (E9), spelling doublets (S1/S2), lexicon breadth
(E11).

Draw the clean traps from the same places as your scunthorpe suite: proper
nouns, place names, minimal pairs, ordinary prose in your script **and in your
romanization** (axis C13, the thinnest and riskiest part of the whole clean
side), and the ordinary words of *other* languages your romanizations collide
with — those last in `CROSS_LANGUAGE_SUITE`, not your own clean list, since they
are only false positives when several packs are loaded, and the runner **throws**
if the same clean text appears in two suites.

`benchmark/METHODOLOGY.md` has the rules the battery is built under and they bind
your language too — above all, **do not delete a case because your pack fails
it**, and **do not build cases by reading `src/data/*.ts` for something that will
match**. If a rival flags something in your **clean** column, look hard at
whether they are right.

```
npm run build
RP_PACKS=hi,en node benchmark/compare.mjs      # baseline, without the new pack
node benchmark/compare.mjs > benchmark/results.txt   # every pack, committed run
```

`RP_PACKS` narrows the matcher and the suites together, so a subset run stays
internally consistent; `RP_DICT=headwords`, `RP_SKIP_DICT=1` and
`RP_SKIP_PERF=1` cut the ~7-minute run down while you iterate. Record the
**per-check delta** and the **construction delta**, and diff the accuracy tables
— a new pack must not add false positives to the existing suites. Five report
sections a new pack routinely breaks, all derived from the run rather than
hand-maintained, so you cannot silence them by editing a list:

- **FALSE POSITIVES remove-profanity produced** — must not grow.
- **BATTERY COMPOSITION** — far fewer generated cases than its neighbours means
  your base forms are unusual (too short, no leet-mappable letter); far more
  *named* cases is what selective case-writing looks like.
- **CONTROL FAILURES** — a base form of yours that is not in your own pack. Every
  miss on a transform of that base is a word-list gap, not a transform gap.
- **PACK ISOLATION** — a non-zero delta either way is a finding: negative
  *caught* means your pack leans on a neighbour; positive *FP* means your entries
  fire on someone else's clean text; negative *FP* means one of your allow
  phrases suppresses another pack's lemma.
- **TAXONOMY COVERAGE** — an axis with no case means you skipped a class.

What earlier packs measured — construction tracks *patterns* rather than lemmas,
per-check cost is very nearly flat, and the two ways the construction benchmark
will lie to you — is in
[performance.md](performance.md#what-the-pack-measurements-have-shown).

---

## Step 9 — Docs and uncertainty

Update `docs/usage.md` (the subpath/pack table), `docs/matching.md` (the "what
it catches" list and your language's clause), `docs/benchmarks.md` (the
per-suite and pack-isolation tables, from `benchmark/results.txt`), `README.md`
(the supported-languages grid, and the comparison table if your pack moved it),
`llms.txt` if the public API changed, and `SPEC.md` (the module descriptions), and
[pack-decisions.md](pack-decisions.md) (your language's section).
**Nothing in `README.md` or under `docs/` may print an unmasked slur** — mask
one letter, the way the existing examples do. This file is the exception,
because here the literal strings are load-bearing.

Then flag what you are unsure about. Put a `// REVIEW: <specific question>`
comment on any entry where you are unsure of severity, category, whether a term
is genuinely offensive versus merely coarse or regional, or whether a
romanization is too collision-prone — and collect them in
[pack-decisions.md](pack-decisions.md) so a reviewer can find them without
reading the whole word list. Check them against the word-list policy first; most
questions of the shape "should I ship this risky term?" are already answered
there. Escalate as `needs-decision` only for genuine product calls the policy
does not cover.

Once a reviewer answers, **convert the flags into a settled record** rather than
deleting them: rewrite the section as decisions, change `// REVIEW:` to
`// Reviewed, …`, and add a test that locks in each drop. Otherwise the next
language task re-opens the same questions.

---

## Word-list policy

Four rules, settled by review of the Tamil pack and followed by the ten packs
since. They are the default, not a starting point for re-litigation; the full
reasoning, and the caste-term decision of 2026-08-14 that rule 2
records, are in
[pack-decisions.md](pack-decisions.md#the-word-list-policy-in-full).

1. **Drop a lemma when its spelling collides with a religious identity, a given
   name, a community name, or a common word in another language, and the
   collision cannot be allowlisted away.** Precision wins over recall.
2. **Ship caste slurs — and only the slurs.** Classify by *is the word an
   epithet aimed at a person, or a category written about?*, never by the
   severity number, and remove rather than downgrade.
3. **Do not ship severity-1 coarse words.** Severity 1 means genuinely
   offensive, not merely informal or rude.
4. **Every pack is SELF-SUFFICIENT** — but that is not a licence to copy another
   pack: a borrowed lemma still needs a source in YOUR language, and a spelling
   dropped for precision stays dropped.
