# Pack decisions and open review items

The per-language record: what was settled and why, and what is still waiting on
a native speaker, under [the word-list policy](#the-word-list-policy-in-full)
below. The recipe itself is [language-packs.md](language-packs.md).

Every open item below has a matching `// REVIEW:` comment on the entry in
`src/data/<lang>.ts`. **None is a blocker for merging locally; they are what a
native speaker signs off before the package goes to npm.** Settled items carry
`// Reviewed, …` comments instead, and a test that locks in each drop.

---

## Settled — Tamil

All eleven review flags raised by the Tamil pack are settled. The pack is
**32 lemmas**; `test/tamil-data.test.ts` asserts the dropped terms stay out, so
re-adding one means updating this record first.

### Dropped

| Term | Was | Decision |
|---|---|---|
| **சுன்னி** | 3, sexual | "Penis", but also exactly how the **Sunni** sect is written — in Tamil script as well as Latin, so native-script-only did not rescue it. Same call as அலி and `pool`. (Rule 1.) |
| **மூஞ்சி** | 1 | "Mug", for someone's face — coarse, not offensive. (Rule 3.) |
| **சனியன்** | 1 | "Jinx". Same bar. (Rule 3.) |
| **சூத்திரன்** | 3, casteist | Removed 2026-08-14 on the caste-term decision — a varna in classical scripture is a category written about, not an epithet. கீழ்ஜாதி went with it. |

Their allowlist phrases went with them (`sunni muslim`, `sunni islam`,
`sani peyarchi`, `sanikizhamai`), and `சுனி` came out of `DEGEMINATE_EXCLUDE`.

### Shipped as built

| Term | Decision |
|---|---|
| **பள்ளன்** (4, casteist) | Romanization included. Only the abusive `-an` form matches; Pallar / Devendrakula Vellalar allowlisted. |
| **பஞ்சமன்** (4, casteist) | Abusive forms only; `panchami` / `panchamirtham` allowlisted. |
| **தோட்டி** (3, casteist) | Native-script only — `thotti` is indistinguishable from தொட்டி "water tank". The model case for rule 2. |
| **ஓத்தா** (4) | Short romanization risk accepted; word mode only, never a prefix. |
| **பொட்டை** (3, slur) | Kept at severity 3. |

### Open — Tamil

1. **Grantha folding ஜ/ஶ/ஷ/ஸ → ச is enabled; ஹ is not.** Both halves are
   orthographic judgements. ஹ was left unfolded rather than guessed, because its
   Tamilization is inconsistent (ஹிந்தி → இந்தி drops it, other words use க).
2. **ல/ள/ழ and ர/ற are deliberately not folded.** Folding them would improve
   recall, but the letters are phonemically contrastive (வலி "pain" / வளி "air"
   / வழி "way"), so it would be a recall heuristic in a precision tier. Confirm
   this is the right layer, or move it to the skeleton tier.
3. **`naari` — flagged, not fixed.** நாறி ships `naari`, which is Sanskrit and
   Hindi नारी "woman", a wholly neutral word — and the reason the Malayalam
   cognate നാറി is not shipped at all. Left alone because it is not currently
   producing a benchmark false positive.
4. **`parayan` — already fixed, needs sign-off.** பறையன் shipped the
   romanization `parayan`, spelled exactly like Malayalam പറയാൻ "to say", one of
   that language's commonest verbs; "avan parayan thudangi" was censored. The
   one romanization was dropped under rule 1; `paraiyan` and `paraian` are
   untouched. Revert it and `TOTAL false positives` goes to 1.

---

## Open — Odia (15 lemmas)

Ordered by how much the answer changes.

1. **Is `maghia` severity 4 or 3?** ମାଘିଆ is literally "mother-fucker" and is
   the commonest Odia obscenity online. It is also a friendly vocative between
   men, the way English speakers use "fucker". Shipped at **4 with `casualUse:
   true`**; the Hindi pack's छक्का precedent would put a term whose casual use
   dominates at 3. Which reading dominates in *written* text?
2. **Two native spellings could not be confirmed.**
   - **ପୁଦି** "vulva" — the crowd list has the romanization at 100% but Praharaj
     has no entry, so the native spelling is reconstructed. ଫୁଦି is the other
     candidate (and is how the Punjabi/Urdu cognate is written). Only `pudi`
     ships; if the ଫ spelling is usual, `phudi` should join it.
   - **ହିଞ୍ଜଡ଼ା** "eunuch" (anti-trans slur) — a modern borrowing, so in no
     dictionary here. ହିଜଡ଼ା ships as a variant and the nukta fold covers ହିଜଡା;
     which is the usual written form is a native-speaker call.
3. **Terms left out for want of a source.** **ମାଇଚିଆ** *maichia*, an effeminacy
   slur — nothing citable; if real it belongs at severity 3, `slur` +
   `gendered`. **ମାଗୀ** *magi* — the sense is well attested in Bengali, but
   Praharaj glosses Odia ମାଗୀ as an affectionate form of the name Maguni, and
   the romanization is ମାଗି "having begged". Dropped in both scripts;
   native-script-only would be the way back in. **ପେଳ / ପେଲା** "testicle"
   (marked obscene in Praharaj) — dropped because ପେଲିବା "to push" is an everyday
   verb and `pela` is a word in Spanish, Portuguese and Italian.
4. **Folds deliberately left out of the script table.** **ୱ U+0B71 → ବ U+0B2C**:
   Odia writes the same word both ways (ସ୍ୱାମୀ ≡ ସ୍ବାମୀ), so this looks like a
   missing rule — but the alternation belongs to the conjunct ୍ୱ / ୍ବ, and
   folding the standalone letter would also rewrite w-loanwords (ୱାର୍ଡ "ward").
   Confirm, or move it to the skeleton tier. **ଳ U+0B33 / ଲ U+0B32 are not
   merged**: both are contrastive, so merging them would be a recall heuristic
   in a precision tier — the same call Tamil made for ல/ள/ழ.
5. **Accepted risks, no answer needed unless a reviewer disagrees.** `pudi` vs
   the surname Pudi and ପୁଦିନା "mint" — the mint word is allowlisted, the
   surname is not and will false-positive as a bare token; accepted, the profane
   reading dominates, the same call hi makes for "Randi". ବିଆ ships as a
   three-character native lemma; word mode keeps it off ବିଆଣ "childbirth", ବିଆଜ
   "interest" and ବିଆଳି "autumn paddy", with a test for each. ବାଣ୍ଡ misses its
   suffixed forms (ବାଣ୍ଡରେ) — it cannot use prefix mode, and this pack generates
   no inflections, so that recall is knowingly given up.

**Settled:** self-sufficiency. `randi` joined ରଣ୍ଡୀ, and two borrowed lemmas
left out only because Hindi had them were added with Odia sources — ଗାଣ୍ଡୁ
*gandu* (Praharaj, glossed "coward") and ମାଦରଚୋଦ *madarchod* (attested
romanized as "madarchaut"). `test/odia-data.test.ts` pins the overlap set in
both directions. What did *not* change: spellings dropped for precision stay
dropped (`gandi` is Hindi गंदी "dirty"; `randa` is Odia for "widow"), and
pan-Indian words with no Odia source — `chutia`, `bhosadi`, `jhaant` — are still
absent, with a test asserting it.

---

## Open — Bengali

1. **`magi` was dropped, and it is মাগী's commonest romanization.** Rule 1 says
   drop: `magi` is an English dictionary word (the Zoroastrian priests, the
   biblical wise men), it is a religious term, and a bare token cannot be
   allowlisted away — the same call ta made for `pool` and சுன்னி. But hi made
   the *opposite* call for `randi` (a Western given name), keeping it as a
   documented known limitation because the profane reading dominates in Indian
   text, and মাগী is at least as common in Bengali. **Restore `magi` on the
   `randi` precedent, accepting the false positive on "the Magi"?** The lemma
   ships via `maagi`, `magee`, `magir` and the native spelling either way, so
   this is a recall trade, not a coverage hole. **The one flag that changes real
   numbers.**
2. **কাফের is not shipped.** A genuine religious slur in Bengali, but `kafir` is
   also the standard English transliteration used descriptively in
   religious-studies writing (and, separately, an unrelated severe slur in South
   African English, where matching it would be *correct*). Ship native-script
   only (কাফের / কাফির), ship with the Latin spellings, or leave out?
3. **The Bengali nukta rule is a judgement call, and it was inherited.**
   ড়/ঢ়/য় are full letters of the varnamala, not optional diacritics the way
   Hindi's ज़ is, so stripping the nukta is not obviously correct orthography.
   Kept on distributional grounds — near complementary distribution, so the merge
   is near-injective, the same argument that justified Tamil ன→ந. A Bengali
   speaker should confirm no real word pair is being merged. Removing it would
   need per-lemma `variants` for ড়/ড and য়/য instead.
4. **ছোটলোক is class abuse, and `Category` has no `classist` member.** Tagged
   `general` rather than stretching `casteist`, which would be factually wrong —
   Bengali class abuse and caste abuse are different registers. Should the union
   grow a `classist` member? Several other languages will hit this.
5. **ঢ্যামনা's severity is a guess.** Roughly "shameless wretch", with a
   secondary pimp-adjacent reading; shipped at 2 assuming the insult sense. If
   the pimp reading dominates it should be 3.
6. **শালা keeps `shala`.** Also পাঠশালা / शाला "school, hall" in several Indian
   languages, and a given name. Kept because it is the dominant Bengali spelling
   and hi accepts the identical risk for `sala`; `pathshala` and friends are
   allowlisted. Confirm the parallel holds.

---

## Open — Marathi

1. **मांग्या ships native-script only, which means it will miss most real
   cases.** Romanized `mangya` is indistinguishable from मंग्या, one of the
   commonest Marathi nicknames (Mangesh, Mangal) — the Devanagari spellings
   differ by one vowel sign, the Latin ones do not. Rule 2 prefers native-only
   to dropping, but also warns that caste abuse online is overwhelmingly typed
   in Latin, so this entry catches almost nothing in practice. **Accept the gap,
   or ship `mangya` and accept censoring people called Mangesh?**
2. **ढोऱ्या was dropped, and it is real caste abuse.** Aimed at the Dhor
   community, but ढोर is also the everyday Marathi word for cattle, in both
   scripts — nothing to disambiguate on, so rule 1 dropped it. A genuine
   coverage hole in a category the pack exists for. Is there a spelling of the
   abusive form that does not collide?
3. **आयचा घो may be below the bar.** The classic Marathi expletive, but everyday
   use is closer to "damn" than to abuse. Shipped at 2 with `casualUse: true`.
   Rule 3 says do not ship merely-coarse words — does this clear it?
4. **बोच्या's severity is a guess.** Crude rather than abusive in some
   registers; shipped at 2 assuming the insult reading. `bocha` was dropped
   because बोचणे "to prick" is an ordinary verb one letter away.
5. **The eyelash-reph fold ऱ→र touches Devanagari, which Hindi shares.** Correct
   for Marathi (महाऱ्या ≡ महार्या, both typed constantly) and a no-op for Hindi,
   which does not use U+0931. The accepted cost: in Devanagari-transliterated
   Dravidian text U+0931 is a contrastive ṟ, and this merges it onto र. Neither
   Devanagari pack needs that contrast; a future Konkani or Devanagari-Tamil pack
   might.
6. **Self-sufficiency makes the reported `language` order-dependent for the
   shared core.** `chut`, `madarchod`, `randi`, `lund` and `harami` resolve to
   `hi` or `mr` depending on load order. Match, span and severity are identical
   either way, and the overlap suite asserts that — but a consumer routing on
   `language` for a Devanagari match will see it flip. Only a label: for
   byte-identical lemma strings the engine merges the two entries strictly, so a
   severity disagreement resolves upward instead of by load order.

---

## Open — Telugu, Kannada, Malayalam (te 18, kn 16, ml 17)

1. **`lanja` also names a taluka town in Maharashtra** (te, 4). లంజ is the single
   commonest Telugu vulgarity and the base of a large compound family, so the
   pack ships the bare romanization in prefix mode. Phrase allowlists cover
   "Lanja taluka" / "Lanja Ratnagiri" / "Lanja Maharashtra", but a bare "Lanja"
   in a dateline will false-positive. Rule 1 names religious identities, given
   names, community names and common words in other languages — not small place
   names — so it ships. **Confirm that reading**, because dropping it would cost
   this pack most of its real-world recall.
2. **Do the -ఓడు caste derivations exist as spelled?** (te, 4). మాదిగోడు and
   మాలోడు ship as the *abusive* derivations of the Madiga and Mala community
   names, on the Tamil precedent (பறையன் ships, பறையர் does not); the bare
   community names are allowlisted and never matched. Two things need a native
   speaker: that the -ఓడు contraction is spelled this way, and that it is in fact
   abusive rather than a neutral colloquial form. If neutral, both should be
   dropped, and te then has no matchable caste slur beyond చండాలుడు / పంచముడు.
3. **Kannada now ships no caste slur at all.** Rule 2 says ship caste slurs, but
   no Kannada term is abusive on its own: ಹೊಲೆಯ, ಮಾದಿಗ and ಚಲುವಾದಿ are community
   names used neutrally and as self-description, and Kannada does not form a
   personal abusive derivation the way Telugu's -ఓడు does. ಚಂಡಾಲ was dropped
   because 'chandala' is also the descriptive Sanskrit varna term in academic
   writing; ಕೀಳು ಜಾತಿ ("low caste") was removed on 2026-08-14 as a category
   written about. **Is that acceptable coverage, or should ಚಂಡಾಲ ship
   native-script only?**
4. **`turaka` / `turuka` is also attested as a surname** (te + kn, 4). The Telugu
   and Kannada counterparts of Tamil துலுக்கன், a slur for Muslims; ships in both
   on the Tamil precedent. Unlike பள்ளன் there is no -an/-ar split to hide
   behind. Ship as-is, restrict to the -ఓడు/-ಅರು forms, or drop?
5. **Severity-2 entries that may be below the bar** — each genuinely used as an
   insult but on the coarse/offensive line rule 3 polices:

   | Entry | Reading | Question |
   |---|---|---|
   | పీనుగు (te, 2, casualUse) | "corpse", as in "you corpse" | coarse, or offensive? |
   | దొబ్బెయ్ (te, 2) | vulgar "get lost" | same |
   | ಕಂತ್ರಿ (kn, 2) | "scoundrel" | also a 2008 Telugu film title; bare-token collision |
   | వెధవ / വെധവ (te, 2) | "wretch" / "scoundrel" | very common; possibly too mild |

6. **Folds left out rather than guessed** — all recall-only, none affects
   precision. **ఱ → ర and ಱ/ೞ → ರ/ಳ**: the contrasts are dead and modern printing
   has standardised on the survivors, so the merge is arguably correct
   orthography; left out because it merges historically contrastive letters
   rather than the near-complementary distribution that justified Tamil's ன→ந,
   and no lemma uses them. **Telugu ఁ (arasunna) and Kannada ಁ**: two
   incompatible modern reflexes on one code point, and the sign is effectively
   absent from typed text. **Telugu ౘ/ౙ → చ/జ IS enabled** — these write the
   dental affricates everyday Telugu spells with చ/జ anyway, the same shape as
   the Tamil grantha rule; confirm it is orthography and not a guess.
   **Malayalam samvrutokaram**: അവനു് ≡ അവന് ≡ അവനു are three live spellings of
   one word-final half-u; the script table cannot express the cluster rule and no
   lemma needs it. If a future Malayalam lemma ends in one, it belongs in that
   lemma's `variants`.
7. **Two sweep survivors that are deliberate.** **`Pulayan` still matches**,
   because it is a Webster's headword for the caste and is also the pack's own
   lemma — rule 2's shape exactly (ship the slur, allowlist `pulaya` /
   `pulayar` / `pulayanarkotta`), the same call ta makes for பறையன். Confirm.
   **`chinali` was dropped from ಚಿನಾಲಿ**, keeping `chinaali` / `chinal`: the
   Chinali are an ethnic group in Himachal Pradesh. Caught by the *Odia* pack's
   clean-trap suite, not by the dictionary sweep — English word lists cannot see
   Indian proper nouns, which is why both gates are needed.
8. **Deliberate cross-pack romanization overlap**, pinned by test so a new one
   shows up as a failure rather than a surprise (`test/malayalam-data.test.ts`,
   `test/kannada-data.test.ts`):

   | Surface | Packs | Why |
   |---|---|---|
   | `thayoli`, `thayolli` | ta, ml | same Dravidian root |
   | `koothi`, `oombu` | ta, ml | same |
   | `turaka` | te, kn | same slur |
   | `laudee` | hi, kn | hi's inflection expander generates it from लौड़ा |

---

## Open — Punjabi

1. **`ਕੰਜਰ` / `kanjar`, severity 3 — ship the Latin spellings?** In Punjabi the
   word is overwhelmingly a general vulgar insult ("pimp / lowlife"), which is
   why it is tagged `gendered` + `general` rather than `casteist`. But Kanjar is
   also the name of a denotified nomadic community in Punjab and Rajasthan, and
   Kanjari is a village in Amritsar district. Rule 1 could argue for
   native-script only. Shipped as-is with `kanjar` / `kanjra` / `kanjari` /
   `kanjariya`; the alternative is to keep the Gurmukhi lemma and drop all five.
   **The one that most deserves a Punjabi speaker's answer.**
2. **`ਪੇਂਡੂ` / `pendu`, severity 1 — above the bar?** Classist mockery of rural
   Punjabis. Kept at 1 on the reading that keeps चपरी in hi: it has a target and
   a bite, unlike the merely-coarse words the Tamil review dropped. The closest
   call in this pack to rule 3.
3. **`ਲੰਨ` — is `lunn` worth its dictionary collision?** One of only two words
   the full dictionary sweep newly flags. `lunn` is a surname and the Sally Lunn
   teacake (allowlisted as a phrase); the bare word is also the distinctly
   Punjabi spelling. Since the self-sufficiency change the lemma also carries
   `lund`, so `lunn` is no longer load-bearing and could be dropped at small
   recall cost. Kept on the precedent that hi ships `chut`, `laund`, `tatta`,
   `chamar` and `bhangi`, all likewise dictionary entries. (`lun` itself stays
   out — three characters, a live Chinese romanization and a surname.)
4. **`ਫੁੱਡੀ`, severity 4 — 4 or 3?** Rated with Tamil புண்டை (4) rather than
   Hindi चूत (3). The two precedents disagree with each other, so this is really
   a question about the rubric, not about Punjabi.
5. **`chuhra` ships with Latin spellings** — the other word the sweep newly
   flags, and the dictionary entry IS the caste name the lemma targets, so the
   match is correct rather than accidental. Rule 2 says ship it with the
   community's own names (Balmiki, Valmiki, Mazhabi) allowlisted, which the entry
   does. Noted rather than asked.

---

## Open — Gujarati

1. **`વાઘરી` / `vaghri`, severity 4 casteist — ship at all?** Used as caste abuse
   against the Devipujak community, but Vaghri IS that community's older name and
   still appears descriptively in Gujarati writing about them. Unlike `ઢેડ` there
   is no separate abusive form to isolate, so allowlisting the neutral name is
   not available — only `devipujak` and `vaghri samaj` / `vaghari samaj` are. The
   closest either pack comes to the rule-1 line. **The one that most deserves a
   Gujarati speaker's answer.**
2. **`ઝવવું` / `jhavvu`, severity 3 — right register?** The vulgar Gujarati verb
   "to fuck". Placed with चोद (3) rather than with the severity-4 compounds. A
   native speaker should confirm it is not a 4.
3. **`હલકટ` and `રખડેલ`, severity 2 — offensive or merely rude?** `halkat` reads
   as "vile / contemptible" and `rakhdel` as "loose" applied to women, which puts
   both above the merely-coarse line. If either reads as ordinary irritation,
   rule 3 says drop it.
4. **`ઢેડ` / `dhed` — the shortest Latin spelling in either pack.** Four
   characters, with -a/-o/-h tails giving five near-identical patterns. Nothing
   in English collides and the false-positive suite is clean, but it is worth a
   second opinion given how much shorter it is than everything else shipped.
5. **`chhinali` stays dropped, and that is a Gujarati data call.** The original
   report was that `data/kn`'s `chinali` allow phrase (the Chinali people of
   Himachal Pradesh) silenced any surface collapsing onto it, killing gu's
   `chhinali` — and, it turned out, kn's own `chinaali`, which is the part that
   showed the cross-pack framing was wrong. **Resolved in the engine, not in
   either word list**: the repeat-collapsed pass was gating its candidates on a
   run of 3+ and its allow spans on nothing; both sides are gated the same way
   now, so all three surfaces detect and `chinali` stays clean. No pack gave way
   and no allow phrase was narrowed. Re-adding gu's `chhinali` is a separate
   question for a Gujarati speaker.

---

## The word-list policy in full

Settled by review of the Tamil pack; the ten packs since follow it. These are
the default, not a starting point for re-litigation, and
[language-packs.md](language-packs.md#word-list-policy) carries the one-line
version.

1. **Drop a lemma when its spelling collides with a religious identity, a given
   name, a community name, or a common word in another language, and the
   collision cannot be allowlisted away.** Precision wins over recall. Wrongly
   censoring someone's identity is a worse failure than missing one vulgarity,
   and zero false positives is this package's actual advantage over every rival
   in the benchmark.
2. **Ship caste slurs — and only the slurs. Classify by the
   epithet-versus-category test, never by the severity number.**

   > **Is the word an epithet aimed at a person, or a category written about?**

   `chamar`, `pulayan`, `chuhra`, `madigodu`, `paraiyan`, `kanjar`, `thotti`
   and `ଚଣ୍ଡାଳ` are thrown at someone; they exist as abuse and are shipped,
   abusive forms only, with the neutral community names allowlisted. "Low caste"
   (கீழ்ஜாதி, ಕೀಳು ಜಾತಿ, താഴ്ന്ന ജാതി, తక్కువ కులం) and the varna terms
   (சூத்திரன், శూద్రుడు) are what a journalist, historian or anti-caste activist
   *writes*. Blocking that second class censors the discourse about caste
   discrimination, which inverts the reason for carrying caste slurs at all. All
   six were removed by maintainer decision, 2026-08-14; every epithet was
   kept, **including the ones carried at severity 3** — Odia ଚଣ୍ଡାଳ sits at 3
   and is the same word Bengali and Telugu carry at 4. **The severity-4-versus-3
   line in the data is not the rule.**

   **Removal is the instrument, not a lower severity.** The default
   `minSeverity` is 0, so a retained entry is still censored for a default
   consumer, and `casualUse: true` only annotates. The same call was made for
   `sunni`, `ali`, `pool`, `parayan` and `chinali`.

   Caste abuse is precisely what an India-first filter exists to catch. Prefer
   native-script-only over dropping the lemma when the *Latin* spelling is the
   ambiguous part — but do not drop Latin spellings just because they are risky,
   since caste abuse online is overwhelmingly typed in Latin.

   The same test settles non-caste lemmas whose primary sense is a category:
   कुत्ता is the ordinary Hindi word for a dog, so `kutte ko khana do` was being
   censored, and it was removed on the same reasoning.
3. **Do not ship severity-1 coarse words.** Severity 1 means genuinely
   offensive, not merely informal or rude.
4. **Every pack is SELF-SUFFICIENT.** A consumer importing only your pack must
   get full coverage of your language, including the romanizations of words it
   shares with any other pack. Never defer a shared Latin spelling — the subpath
   exports exist so people can load one language, and a deferred spelling is
   simply missing for them. Duplicate surfaces across packs are harmless:
   overlapping candidates collapse to a single match.

   Self-sufficiency is **not a licence to copy another pack.** A borrowed lemma
   still needs a source in YOUR language, and the precision rules above still
   apply — a spelling dropped because it collides with an ordinary word (`gandi`
   ≡ Hindi गंदी "dirty") stays dropped. Pin the intended overlap in your pack
   test so it stays deliberate; `test/odia-data.test.ts` has the pattern.
