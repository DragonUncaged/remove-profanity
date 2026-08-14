/**
 * Per-script Indic orthography rules — the DATA half of `indicFold`.
 *
 * `src/unicode/normalize.ts` contains the machinery (code-point rewriting,
 * cluster scanning, offset maps); this file contains the facts about each
 * script. Adding a script should mean appending one entry to
 * `INDIC_SCRIPTS` and nothing else — no new `case` arms, no new folds.
 *
 * Two rules for editing this file:
 *
 * 1. **Every fold here must be correct orthography for that script**, not a
 *    recall heuristic. This table feeds pass 0 (the exact, high-precision
 *    tier); a wrong fold here silently rewrites every word of the language,
 *    including innocent ones. Spelling-variation guesses belong in a pack's
 *    `variants` (dictionary side, bounded blast radius) or in the phonetic
 *    skeleton tier (report-not-block), never here.
 * 2. **Do not copy another script's arm.** The rules are genuinely different:
 *    Devanagari and Bengali write nasal clusters with anusvara, Tamil does
 *    not; Devanagari and Bengali have nukta, Tamil has none. An unset field
 *    is a deliberate statement that the script does not do that thing.
 */

export interface IndicScriptRules {
	/** ISO 15924 code — documentation, and the key tests address rules by. */
	script: string;
	/** Human label, for error messages and docs. */
	name: string;
	/** Inclusive Unicode block range of the script. */
	block: readonly [start: number, end: number];
	/**
	 * Code points deleted from the match key: nukta, visarga and friends.
	 * (Deleting is safe where the sign is orthographically optional or
	 * inconsistently typed; it is NOT safe for anything phonemic.)
	 */
	drop?: readonly number[];
	/** Code point → replacement string, applied per code point. */
	map?: ReadonlyArray<readonly [codePoint: number, replacement: string]>;
	/** The script's virama / pulli / halant. */
	virama?: number;
	/**
	 * Nasal consonants that fold to `anusvara` when followed by `virama`
	 * (हिन्दी ≡ हिंदी). Omit for scripts that do not write nasal clusters
	 * with anusvara — Tamil writes ங்க / ந்த / ம்ப and only those, so
	 * folding them to anusvara would invent an orthography Tamil does not
	 * have.
	 */
	nasalsToAnusvara?: readonly number[];
	/** Replacement emitted by the `nasalsToAnusvara` rule. */
	anusvara?: string;
	/**
	 * Collapse runs of the virama to a single one. A doubled virama is
	 * always a typing artifact (or an evasion attempt): it has no meaning in
	 * any of these scripts. Opt-in per script only because switching it on
	 * for an existing script would be a behaviour change, not because it is
	 * unsafe.
	 */
	collapseViramaRuns?: boolean;
}

/**
 * Devanagari — Hindi, Marathi, Nepali, Sanskrit.
 *
 * Precomposed nukta letters (क़ U+0958–U+095F) are composition exclusions, so
 * NFC has already split them into base + nukta before this fold runs.
 *
 * **Audited for Marathi** when the `mr` pack was added. One rule was ADDED;
 * everything else was verified and left alone:
 *
 * - **Eyelash reph ऱ (U+0931) → र — ADDED.** This was assumed to be handled
 *   for free by the nukta rule, and it is not: unlike क़ U+0958–U+095F,
 *   U+0931 is **not** a composition exclusion, so NFC *composes* र + nukta
 *   INTO ऱ rather than leaving it split, and the nukta rule never sees it.
 *   महाऱ्या and महार्या were two different keys. They are one word: the
 *   eyelash reph is a rendering distinction of र (कऱ्हाड, सुऱ्या, दुऱ्या),
 *   Marathi keyboards differ on which one they emit, and both are typed
 *   constantly. Known cost, accepted: in Devanagari-transliterated Dravidian
 *   text U+0931 is a contrastive ṟ (Tamil ற), and this fold merges it onto र.
 *   The Devanagari packs here are Hindi and Marathi, neither of which uses
 *   that contrast. ऩ U+0929 and ऴ U+0934 are the same shape of letter and are
 *   deliberately NOT folded — they occur only in that transliterated Dravidian
 *   text, so folding them would be a guess with no Marathi payoff.
 * - **Anusvara over nasal + virama is if anything more Marathi than Hindi.**
 *   Marathi prefers मंग / गांड where Sanskrit-leaning spelling writes मङ्ग /
 *   गाण्ड, so the existing `nasalsToAnusvara` rule is exactly right.
 * - **ळ U+0933 (LLA) and ॲ/ऍ (candra-e, for English loans) are NOT folded.**
 *   ळ is a contrastive retroflex lateral phoneme of Marathi (काळ "time" vs
 *   काल "yesterday"); merging it onto ल would be a recall heuristic. ॲ has no
 *   Hindi equivalent to merge with.
 * - **`collapseViramaRuns` stays OFF here.** Turning it on for Devanagari
 *   would change Hindi behaviour, and Hindi is not this task's to change.
 *   See the Bengali entry, where it is opt-in for a script with no shipped
 *   behaviour to regress.
 */
const DEVANAGARI: IndicScriptRules = {
	script: 'Deva',
	name: 'Devanagari',
	block: [0x0900, 0x097f],
	drop: [
		0x093c, // DEVANAGARI SIGN NUKTA
		0x0903, // DEVANAGARI SIGN VISARGA
	],
	map: [
		[0x0901, 'ं'], // CANDRABINDU → ANUSVARA
		[0x0931, 'र'], // RRA (Marathi eyelash reph ऱ) → RA — see above
	],
	virama: 0x094d,
	nasalsToAnusvara: [
		0x0928, // न
		0x092e, // म
		0x0923, // ण
		0x0919, // ङ
		0x091e, // ञ
	],
	anusvara: 'ं',
};

/**
 * Bengali — Bengali, Assamese.
 *
 * These rules were originally written alongside Devanagari, by someone
 * working on Hindi. They were re-derived from Bengali orthography when the
 * `bn` pack was added; the audit and its conclusions are below, because "it
 * happens to match Devanagari" is not a reason and the next person will
 * otherwise assume it was.
 *
 * **Nukta (U+09BC) — KEPT, on distributional grounds, not by analogy.**
 * Bengali nukta is not the optional refinement it is in Hindi: ড় ঢ় য় are
 * full letters of the varnamala, and ড়/ড is not a typing variant the way
 * ज़/ज is. It survives here for the same reason Tamil ன→ந does — the merge
 * is near-injective, because the members of each pair are in near
 * complementary distribution:
 *   ড় ঢ় never occur word-initially and ড ঢ are (outside conjuncts) almost
 *   only word-initial: বড়, পড়া, ঘোড়া vs ডাল, ডিম, and ণ্ড / ন্ড in conjuncts.
 *   য় is never word-initial by rule; standalone non-initial য is vanishingly
 *   rare (non-initial /dʒ/ is written জ).
 * So no real Bengali word pair is merged, while the very common casual
 * ড়/ড and য়/য mistyping is absorbed. NFC has already decomposed the
 * precomposed forms ড় U+09DC, ঢ় U+09DD, য় U+09DF (composition exclusions)
 * into base + nukta by the time this runs.
 *
 * **Visarga ঃ (U+0983) — KEPT, and correct for a Bengali-specific reason.**
 * Bengali really does write তৎসম words both ways in casual text:
 * দুঃখ ≡ দুখ, অন্তঃ ≡ অন্ত. Same rule as Devanagari, arrived at independently.
 *
 * **Chandrabindu ঁ (U+0981) → anusvara ং — KEPT, but it is NOT the Hindi
 * rule.** In Hindi ँ and ं are genuinely interchangeable spellings. In
 * Bengali they are distinct signs: ঁ nasalises the vowel, ং is /ŋ/. The fold
 * survives because, *combined with* the nasal+virama rule below, it unifies a
 * spelling variation Bengali actually has — চাঁদ ≡ চান্দ, বাঁধা ≡ বান্ধা,
 * ভাঁড় ≡ ভান্ড — and because the merged key (ং before a non-velar) is a
 * sequence no native word occupies, so nothing innocent collides into it.
 *
 * **Nasal + virama → anusvara — KEPT, load-bearing for ঙ, tolerated for the
 * rest.** ঙ্ক ≡ ংক and ঙ্গ ≡ ংগ are live Bengali doublets (বাংলা ≡ বাঙলা,
 * শংকা ≡ শঙ্কা) and are the reason to keep the rule at all. ন্ ম্ ণ্ ঞ্ +
 * virama → ং is over-folding by strict Bengali orthography (শান্তি is never
 * written শাংতি); it is kept because it is the other half of the
 * chandrabindu doublet above and lands in the same unoccupied key space.
 *
 * **Khanda ta ৎ (U+09CE) → ত + virama — ADDED with the bn pack.** This is
 * the rule the Devanagari-shaped original was missing: Unicode deliberately
 * gives ৎ no canonical decomposition, so হঠাৎ and হঠাত্, উৎসব and উত্সব —
 * both live spellings of one word — were two different keys.
 *
 * **`collapseViramaRuns` — ADDED.** A doubled hosonto is meaningless in
 * Bengali, so a run is always a typing artifact or an evasion attempt. Opted
 * in here (and not for Devanagari) because Bengali had no shipped matching
 * behaviour to regress.
 *
 * NOT folded, deliberately:
 * - **ya-phala ্য and ba-phala ্ব.** Both are conjunct members, not
 *   diacritics: they carry real contrasts (সত্য "truth" vs সত "true";
 *   বিশ্ব "world" vs বিশ). They do change the *pronunciation* of the
 *   preceding consonant (gemination, and /ɔ/→/æ/ for ya-phala) — that is a
 *   romanization problem, handled per-lemma, not an orthographic fold.
 * - **শ ষ স → শ.** All three are /ʃ/ in Bengali, and confusing them is *the*
 *   classic Bengali spelling mistake, so folding them would help recall a
 *   lot. It is still refused: unlike the Tamil grantha letters, all three are
 *   native Bengali letters with fixed etymological spellings, and the merge
 *   is not injective — শাল "sal tree" / সাল "year" / ষাঁড় "bull" are
 *   distinct everyday words. Per-lemma `variants` carry the cases that occur.
 * - **The inherent vowel.** Bengali's is ɔ, not Hindi's ə, and Bengali does
 *   not delete it word-finally the way Hindi does. That is entirely a
 *   romanization fact (চোদা → "choda" not "chod") and is handled in the
 *   pack's `romanizations`; there is no code point to fold.
 * - **Assamese ৰ U+09F0 / ৱ U+09F1.** Regional letterforms that would need
 *   Assamese judgement, not Bengali. The `bn` pack does not claim Assamese.
 */
const BENGALI: IndicScriptRules = {
	script: 'Beng',
	name: 'Bengali',
	block: [0x0980, 0x09ff],
	drop: [
		0x09bc, // BENGALI SIGN NUKTA
		0x0983, // BENGALI SIGN VISARGA
	],
	map: [
		[0x0981, 'ং'], // CANDRABINDU → ANUSVARA
		[0x09ce, 'ত্'], // KHANDA TA → TA + HOSONTO (হঠাৎ ≡ হঠাত্)
	],
	virama: 0x09cd,
	nasalsToAnusvara: [
		0x09a8, // ন
		0x09ae, // ম
		0x09a3, // ণ
		0x0999, // ঙ
		0x099e, // ঞ
	],
	anusvara: 'ং',
	collapseViramaRuns: true,
};

/**
 * Tamil.
 *
 * Deliberately unlike the two above — see docs/language-packs.md:
 *
 * - **No nukta.** Tamil has none; there is nothing to strip.
 * - **No nasal + virama → anusvara.** ங்க, ஞ்ச, ண்ட, ந்த, ம்ப are the ONLY
 *   way Tamil writes those clusters. U+0B82 TAMIL SIGN ANUSVARA exists but
 *   is a Grantha-era import used for Sanskrit transliteration, not an
 *   alternative native spelling, so it is left untouched rather than made a
 *   fold target.
 * - **Aytham ஃ U+0B83 is dropped.** Its Unicode name is literally TAMIL SIGN
 *   VISARGA, and dropping it is the exact analogue of the Devanagari and
 *   Bengali visarga rule. It also unifies the two live spellings of borrowed
 *   f/z/s sounds (ஃபேஸ்புக் ≡ பேஸ்புக்) and the literary/colloquial pair
 *   அஃது ≡ அது. Known lossy case: எஃகு "steel" → எகு.
 * - **Grantha letters fold to their Tamil equivalents.** ஜ ஶ ஷ ஸ all exist
 *   only to write loanwords; Tamil's own inventory writes every one of those
 *   sounds with ச. Both spellings are in live use for the same word — the
 *   caste term ஜாதி ≡ சாதி is the case that matters most for this pack.
 *   ஹ is deliberately NOT folded: its Tamilization is inconsistent (இந்தி
 *   for ஹிந்தி drops it, other words use க), and guessing would be exactly
 *   the fabrication rule 1 forbids.
 * - **ன U+0BA9 → ந U+0BA8.** The alveolar and dental nasals are phonetically
 *   identical in modern Tamil and near-complementary in distribution (ந is
 *   word-initial, ன is medial/final), so the merge is close to injective and
 *   removes the single most common Tamil spelling confusion. ண U+0BA3 is a
 *   contrastive retroflex (மணம் "scent" vs மனம் "mind") and is NOT folded.
 *
 * Not folded, and why — the confusion sets ல/ள/ழ and ர/ற are famous, but all
 * of those letters are phonemically contrastive (வலி "pain" / வளி "air" /
 * வழி "way"; மரம் "tree" / மறம் "valour"). Folding them would be a recall
 * heuristic wearing an orthography costume; per-lemma `variants` handle the
 * cases that actually occur.
 */
const TAMIL: IndicScriptRules = {
	script: 'Taml',
	name: 'Tamil',
	block: [0x0b80, 0x0bff],
	drop: [
		0x0b83, // TAMIL SIGN VISARGA (aytham ஃ)
	],
	map: [
		[0x0b9c, 'ச'], // ஜ JA  → ச CA
		[0x0bb6, 'ச'], // ஶ SHA → ச CA
		[0x0bb7, 'ச'], // ஷ SSA → ச CA
		[0x0bb8, 'ச'], // ஸ SA  → ச CA
		[0x0ba9, 'ந'], // ன NNA → ந NA
	],
	virama: 0x0bcd, // TAMIL SIGN VIRAMA (pulli)
	collapseViramaRuns: true,
};

/**
 * Odia (Oriya).
 *
 * Odia is Bengali's closest structural relative in this table, and four of its
 * five rules do coincide with the Bengali arm — but they were re-derived, not
 * copied, and two facts came out differently:
 *
 * - **Nukta U+0B3C is dropped, and it earns its place here more than in
 *   Bengali.** Odia writes the retroflex flaps with base + nukta (ଡ଼ ଢ଼), and
 *   omitting the dot is a mainstream spelling habit rather than a typo — the
 *   language's own name is written both ଓଡ଼ିଆ and ଓଡିଆ. Dropping unifies the
 *   pair. Known lossy case: ବାଡ଼ି "stick / garden" → ବାଡି.
 * - **ୟ U+0B5F ORIYA LETTER YYA is NOT touched by that rule, unlike its
 *   Bengali counterpart.** য় U+09DF has a canonical decomposition to
 *   ଯ + nukta, so NFC hands the nukta rule a bare ଯ; U+0B5F has **no**
 *   decomposition at all (verified against the UCD in
 *   test/odia-normalize.test.ts). So ୟ survives as an atomic letter and does
 *   not collapse onto ଯ. That is the right outcome anyway — ଯ /dʒ/ and ୟ /j/
 *   are distinct in Odia, and ୟ is ordinary in everyday words (ପ୍ରିୟ,
 *   ଭାରତୀୟ) — but it is the exact place where copying the Bengali arm would
 *   have produced a rule that silently does nothing.
 * - **Candrabindu ଁ U+0B01 → anusvara ଂ U+0B02.** Both signs write vowel
 *   nasalisation in Odia and the two spellings alternate in live text
 *   (ନାହିଁ ≡ ନାହିଂ, ହଁସ ≡ ହଂସ "swan"). Note the direction: only ଁ→ଂ, never
 *   nasal-sign→nothing, so the minimal pair ହସ "laugh" / ହଁସ "swan" stays
 *   distinct.
 * - **Nasal + virama → anusvara**, the same five nasals as Devanagari and
 *   Bengali. Odia genuinely writes these clusters both ways (ଅଙ୍କ ≡ ଅଂକ,
 *   ସମ୍ଭବ ≡ ସଂଭବ), so this is orthography, not a recall guess.
 * - **Visarga ଃ U+0B03 dropped**, as in Devanagari and Bengali
 *   (ଦୁଃଖ ≡ ଦୁଖ).
 * - **Virama runs collapse.** U+0B4D behaves exactly like the Devanagari
 *   halant — invisible inside a conjunct, visible when ZWNJ blocks the
 *   ligature — and a doubled one is always a typing artifact or an evasion
 *   attempt. Opted in because Odia is new here, not because Devanagari's
 *   omission means anything.
 *
 * Deliberately NOT folded:
 * - **ୱ U+0B71 WA → ବ U+0B2C BA.** Odia really does write the same word two
 *   ways (ସ୍ୱାମୀ ≡ ସ୍ବାମୀ), but that alternation lives in the *conjunct*
 *   ୍ୱ / ୍ବ, while a fold here would also rewrite the standalone letter used
 *   for English w-loanwords (ୱାର୍ଡ "ward"). Left out and flagged for review
 *   rather than guessed at.
 * - **The rounded letterforms.** Odia's distinctive curved shapes are a
 *   typeface matter; the encoding is an ordinary Brahmic base + matra + virama
 *   model, so they have no effect on any rule here.
 */
const ODIA: IndicScriptRules = {
	script: 'Orya',
	name: 'Odia',
	block: [0x0b00, 0x0b7f],
	drop: [
		0x0b3c, // ORIYA SIGN NUKTA
		0x0b03, // ORIYA SIGN VISARGA
	],
	map: [
		[0x0b01, 'ଂ'], // CANDRABINDU → ANUSVARA
	],
	virama: 0x0b4d, // ORIYA SIGN VIRAMA
	nasalsToAnusvara: [
		0x0b28, // ନ
		0x0b2e, // ମ
		0x0b23, // ଣ
		0x0b19, // ଙ
		0x0b1e, // ଞ
	],
	anusvara: 'ଂ',
	collapseViramaRuns: true,
};

/**
 * Telugu.
 *
 * Telugu is NOT Tamil, and the difference is the whole reason this file is a
 * table. Tamil's reduced inventory forced the grantha merges and the ன→ந
 * fold; Telugu has the full voiced and aspirated series (గ/ఘ, జ/ఝ, డ/ఢ …),
 * every one of which is contrastive, so nothing of that kind is folded here.
 * What Telugu *does* share with Devanagari, and Tamil does not, is the
 * anusvara:
 *
 * - **Nasal + virama → anusvara ం U+0C02.** This is real Telugu orthography,
 *   not a Devanagari copy. Telugu grammar treats ం (పూర్ణబిందువు, "sunna")
 *   as the standard way to write a homorganic nasal before a stop: అంత /
 *   పంది / సంధి are the ordinary spellings, and the conjunct spellings
 *   అన్త / సన్ధి are the Sanskritic or older ones for the same words. Folding
 *   the rarer onto the commoner is exactly the हिन्दी ≡ हिंदी rule.
 * - **Visarga ః U+0C03 is dropped**, like every other script here: it is
 *   optional in ordinary typing (దుఃఖం ≡ దుఖం).
 * - **Nukta U+0C3C is dropped.** Added in Unicode 14.0 for minority-language
 *   orthographies written in Telugu script; it never appears in Telugu text,
 *   so this is the Devanagari rule applied for consistency rather than for
 *   recall.
 * - **ౘ U+0C58 TSA → చ, ౙ U+0C59 DZA → జ.** These two letters write the
 *   dental affricates [ts]/[dz], which in Telugu are positional realisations
 *   of చ/జ. Everyday Telugu writes చ/జ for both; the distinct letters survive
 *   in dictionaries and linguistic work. Same shape as the Tamil grantha
 *   rule: two live spellings of one word, folded onto the common one.
 *
 * Deliberately NOT folded:
 *
 * - **ఁ U+0C01 (arasunna).** Unicode calls it CANDRABINDU, but it is not the
 *   Devanagari sign and does not behave like it. Telugu's arasunna marked a
 *   half-nasal, and its modern reflex is *deletion* (వాఁడు → వాడు), not
 *   anusvara — while the same code point also carries the Sanskrit
 *   candrabindu in transliterated text, whose reflex IS anusvara. Two
 *   incompatible answers, a sign that is effectively absent from modern
 *   typing, so the honest move is no rule at all.
 * - **ఱ U+0C31 RRA → ర.** The ర/ఱ contrast is dead in modern spoken Telugu
 *   and modern printing has standardised on ర, so the merge is tempting —
 *   but it is a true merger of two historically contrastive letters rather
 *   than the near-complementary distribution that justified Tamil's ன→ந, and
 *   it buys this pack nothing (no lemma is spelled with ఱ). Left out and
 *   written down; see docs/language-packs.md.
 */
const TELUGU: IndicScriptRules = {
	script: 'Telu',
	name: 'Telugu',
	block: [0x0c00, 0x0c7f],
	drop: [
		0x0c03, // TELUGU SIGN VISARGA
		0x0c3c, // TELUGU SIGN NUKTA
	],
	map: [
		[0x0c58, 'చ'], // ౘ TSA → చ CA
		[0x0c59, 'జ'], // ౙ DZA → జ JA
	],
	virama: 0x0c4d, // TELUGU SIGN VIRAMA
	nasalsToAnusvara: [
		0x0c19, // ఙ
		0x0c1e, // ఞ
		0x0c23, // ణ
		0x0c28, // న
		0x0c2e, // మ
	],
	anusvara: 'ం',
	collapseViramaRuns: true,
};

/**
 * Gurmukhi — Punjabi.
 *
 * Structurally an abugida like Devanagari, and that is exactly the trap: the
 * two scripts agree on only ONE of the four Devanagari rules.
 *
 * | Rule | Deva | Guru | Why |
 * |---|---|---|---|
 * | strip nukta | ✅ | ✅ | same reason, see below |
 * | drop visarga | ✅ | ✅ | ਃ U+0A03 is Sanskrit-only in Punjabi |
 * | nasal + virama → anusvara | ✅ | ❌ | Punjabi does not write halant nasal clusters at all |
 * | candrabindu → anusvara | ✅ | ✅ (as adak bindi → bindi) | same sign pair, different names |
 *
 * - **Nukta U+0A3C is dropped, and it is safe** because Gurmukhi's six
 *   precomposed nukta letters — ਲ਼ U+0A33, ਸ਼ U+0A36, ਖ਼ U+0A59, ਗ਼ U+0A5A,
 *   ਜ਼ U+0A5B, ਫ਼ U+0A5E — are composition exclusions, verified against the
 *   runtime: NFD splits them into base + U+0A3C and NFC does NOT put them
 *   back. So by the time this table runs inside `baseFold`, every one of them
 *   is already base + nukta and the single `drop` entry unifies both
 *   spellings. (Do not assume this for a new script — Gujarati, below, has no
 *   precomposed nukta letters at all, and a script where NFC *did* recompose
 *   them would need explicit `map` entries instead.)
 *
 *   The rationale is Hindi's: the nukta is optional in practice and dropped
 *   constantly in real typing (ਜ਼ਰੂਰ ~ ਜਰੂਰ, ਖ਼ਬਰ ~ ਖਬਰ, ਗਸ਼ਤੀ ~ ਗਸਤੀ).
 *   Known lossy pairs: ਸ਼ੇਰ "lion" ≡ ਸੇਰ (a weight), ਸ਼ਾਮ "evening" ≡ ਸਾਮ.
 *   Unlike Devanagari the rule does NOT touch the retroflex flap: Gurmukhi
 *   ੜ U+0A5C is an atomic letter, where Devanagari ड़ U+095C is ड + nukta and
 *   therefore does merge into ड.
 *
 * - **Tippi ੰ U+0A70 folds to bindi ਂ U+0A02.** Both write the same
 *   nasalization; which one is correct is decided purely by the preceding
 *   vowel sign (tippi after mukta/sihari/aunkar/dulainkar, bindi after
 *   kanna/bihari/lavan/dulavan/hora/kanaura), so the pair is in
 *   complementary distribution and never contrastive — there is no Punjabi
 *   minimal pair separated by tippi vs bindi. Picking the wrong one is one of
 *   the commonest Punjabi typing errors, so the merge is both orthographically
 *   correct and the single highest-value fold for this script.
 *   Adak bindi ਁ U+0A01 joins them: it is Gurmukhi's candrabindu, and folding
 *   it to bindi is the exact analogue of the Devanagari rule above.
 *
 * - **No nasal + virama → anusvara.** Modern Punjabi does not write halant
 *   nasal clusters: ਹਿੰਦੀ has no ਹਿਨ੍ਦੀ spelling the way हिंदी has हिन्दी.
 *   The virama survives only inside the subjoined letters (see below), so
 *   declaring this rule would fold a sequence Punjabi never produces — copying
 *   the Devanagari arm for the sake of symmetry.
 *
 * - **Addak ੱ U+0A71 is deliberately NOT dropped.** It marks gemination of
 *   the following consonant, and Punjabi gemination is phonemic: ਪਤਾ "patā"
 *   (knowledge) vs ਪੱਤਾ "pattā" (leaf), ਦਸ "das" (ten) vs ਦੱਸ "dass" (tell),
 *   ਸਤ "sat" (truth) vs ਸੱਤ "satt" (seven). Folding it away here would
 *   collapse those pairs across the whole language. The casual-typing habit of
 *   omitting the addak is real, so it is handled where it belongs — per-lemma
 *   on the dictionary side, `dropAddak()` in src/data/pa.ts, exactly as
 *   ta.ts handles Tamil gemination.
 *
 * - **Subjoined letters are left alone.** ੍ਹ ੍ਰ ੍ਵ (virama + ਹ/ਰ/ਵ) are
 *   ordinary Punjabi orthography, not a variant spelling of anything —
 *   ਪੜ੍ਹ "paṛh" (read) is not ਪੜਹ. Only *runs* of the virama collapse, which
 *   is the usual typing-artifact/evasion rule and never legitimate.
 */
const GURMUKHI: IndicScriptRules = {
	script: 'Guru',
	name: 'Gurmukhi',
	block: [0x0a00, 0x0a7f],
	drop: [
		0x0a3c, // GURMUKHI SIGN NUKTA
		0x0a03, // GURMUKHI SIGN VISARGA
	],
	map: [
		[0x0a01, 'ਂ'], // ADAK BINDI (Gurmukhi's candrabindu) → BINDI
		[0x0a70, 'ਂ'], // TIPPI → BINDI — same nasal, vowel-conditioned allographs
	],
	virama: 0x0a4d, // GURMUKHI SIGN VIRAMA (halant, only inside subjoined forms)
	collapseViramaRuns: true,
};

/**
 * Kannada.
 *
 * Structurally parallel to Telugu — the two scripts are sisters, and this
 * arm was written by checking each Telugu rule against Kannada rather than
 * by copying it. The rules that survived that check are the same three
 * (visarga drop, nukta drop, nasal + virama → anusvara ಂ U+0C82): Kannada
 * writes ಅಂತ / ಬಂದ / ಚಂದ್ರ with the sunna exactly as Telugu does, and the
 * conjunct spellings ಅನ್ತ / ಚನ್ದ್ರ are the Sanskritic alternates for the
 * same words.
 *
 * The rules that did NOT survive are why this is a separate entry rather
 * than a shared one:
 *
 * - **No ౘ/ౙ analogue.** Those code points are Telugu-block only; Kannada
 *   has no separate TSA/DZA letters to fold.
 * - **ಱ U+0CB1 RRA and ೞ U+0CDE LLLA are not folded**, for the same reason
 *   Telugu's ఱ is not: both were formally retired from the Kannada alphabet
 *   and are absent from modern text, so a fold would be a merger of dead
 *   contrasts with no recall to show for it.
 * - **ಁ U+0C81 candrabindu is left alone**, matching the Telugu decision.
 *
 * Nothing of the voiced/aspirated series is touched: Kannada has the full
 * inventory (ಕ/ಖ/ಗ/ಘ), all of it contrastive.
 */
const KANNADA: IndicScriptRules = {
	script: 'Knda',
	name: 'Kannada',
	block: [0x0c80, 0x0cff],
	drop: [
		0x0c83, // KANNADA SIGN VISARGA
		0x0cbc, // KANNADA SIGN NUKTA
	],
	virama: 0x0ccd, // KANNADA SIGN VIRAMA
	nasalsToAnusvara: [
		0x0c99, // ಙ
		0x0c9e, // ಞ
		0x0ca3, // ಣ
		0x0ca8, // ನ
		0x0cae, // ಮ
	],
	anusvara: 'ಂ',
	collapseViramaRuns: true,
};

/**
 * Malayalam — the most orthographically complicated script in this table,
 * and the one where copying its nearest neighbour would do the most damage.
 *
 * **The chillu rule is the whole point.** A chillu letter is a consonant in
 * its word-final, vowel-less form, and Unicode encodes each one twice over:
 * atomically (ൻ U+0D7B) and as the older consonant + virama + ZWJ sequence
 * (ന ് ZWJ). Both are in live use — the same word is spelled both ways by
 * different keyboards and different decades of text — so every chillu is
 * mapped back to consonant + virama here. `stripInvisibles` has already
 * removed the ZWJ from the sequence form by the time matching runs, so the
 * two spellings converge on one key.
 *
 * That single rule also settles the **old vs reformed orthography** split
 * for the case that actually matters. Pre-reform Malayalam writes the very
 * common /nṯa/ cluster as ൻ + റ (chillu-n + rra); reformed Malayalam writes
 * it ന + ് + റ. Expanding the chillu makes ൻറ and ന്റ the same string, so
 * നായിൻറെ ≡ നായിന്റെ without a word of dictionary duplication. The rest of
 * the reform is a *glyph* change over identical code points (the detached
 * ു/ൂ/ൃ signs, the unligated conjuncts) or a ZWNJ that this pipeline already
 * strips, so no further rule is needed.
 *
 * **No nasal + virama → anusvara**, and this is the Tamil-shaped trap of
 * this script. Telugu and Kannada, immediately above, both take that rule;
 * Malayalam must not. Malayalam writes homorganic nasal clusters as
 * conjuncts and only as conjuncts — ചന്ദ്രൻ, ന്ത, ണ്ട, ങ്ക are the spellings,
 * and ചംദ്രൻ is not Malayalam. ം U+0D02 does occur constantly, but as
 * word-final /m/ (ആണം, പൂരം) and inside Sanskrit tatsamas whose source
 * already had an anusvara — never as an alternative to the native conjunct.
 * Folding here would rewrite a large fraction of ordinary Malayalam.
 *
 * Also deliberately absent:
 *
 * - **No nukta.** Malayalam has none.
 * - **ഁ U+0D01 / U+0D00 candrabindu are left alone** — Vedic and
 *   dialect-transcription signs, not Malayalam orthography.
 * - **U+0D3B / U+0D3C, the vertical-bar and circular viramas**, are not
 *   mapped onto ് U+0D4D. They are manuscript signs added for Prakrit and
 *   Sanskrit editions and do not occur in typed Malayalam; mapping them
 *   would be a guess made for no reader.
 * - The **samvrutokaram** alternation (അവനു് ≡ അവന് ≡ അവനു, three live
 *   spellings of one word-final half-u) is a cluster rule this table cannot
 *   express, and belongs in per-lemma `variants` anyway. See
 *   docs/language-packs.md.
 */
const MALAYALAM: IndicScriptRules = {
	script: 'Mlym',
	name: 'Malayalam',
	block: [0x0d00, 0x0d7f],
	drop: [
		0x0d03, // MALAYALAM SIGN VISARGA
	],
	map: [
		[0x0d7a, 'ണ്'], // ൺ CHILLU NN  → ണ U+0D23
		[0x0d7b, 'ന്'], // ൻ CHILLU N   → ന U+0D28
		[0x0d7c, 'ര്'], // ർ CHILLU RR  → ര U+0D30
		[0x0d7d, 'ല്'], // ൽ CHILLU L   → ല U+0D32
		[0x0d7e, 'ള്'], // ൾ CHILLU LL  → ള U+0D33
		[0x0d7f, 'ക്'], // ൿ CHILLU K   → ക U+0D15
		[0x0d54, 'മ്'], // ൔ CHILLU M   → മ U+0D2E
		[0x0d55, 'യ്'], // ൕ CHILLU Y   → യ U+0D2F
		[0x0d56, 'ഴ്'], // ൖ CHILLU LLL → ഴ U+0D34
	],
	virama: 0x0d4d, // MALAYALAM SIGN VIRAMA (chandrakkala)
	collapseViramaRuns: true,
};

/**
 * Gujarati.
 *
 * The script that loses the shirorekha keeps everything else: Gujarati is
 * genuinely close enough to Devanagari that all four Devanagari rules apply,
 * which makes it the one place in this table where copying the Devanagari arm
 * happens to be RIGHT. It is written out anyway, with the check that was
 * actually run for each rule:
 *
 * - **Nukta U+0ABC is dropped**, and here the NFC question has the opposite
 *   answer to Devanagari's: the Gujarati block contains **no precomposed
 *   nukta letters at all** (nothing in U+0A80–U+0AFF decomposes under NFD,
 *   verified against the runtime), and NFC never composes base + U+0ABC into
 *   one. So the nukta only ever appears as a standalone combining mark and
 *   the `drop` entry catches every occurrence, with no dependency on NFC
 *   having decomposed anything first. Gujarati nukta is confined to
 *   Perso-Arabic transliteration (જ઼, ઝ઼, ફ઼) and is omitted more often than
 *   it is typed.
 * - **Visarga ઃ U+0A83 is dropped**, same as Devanagari: Sanskrit-loan only,
 *   and દુઃખ ≡ દુખ are both live spellings of "sorrow".
 * - **Candrabindu ઁ U+0A81 → anusvara ં U+0A82.** Modern Gujarati writes
 *   nasalization with the anusvara almost exclusively; the candrabindu is
 *   older orthography for the same sound and the two never contrast. This is
 *   the Devanagari rule with Gujarati code points, and unlike Gurmukhi's
 *   tippi/bindi pair the target here really is called ANUSVARA.
 * - **Nasal + virama → anusvara applies.** Gujarati keeps Devanagari's
 *   conjuncts and the same free variation on top of them: અંત ≡ અન્ત,
 *   ગાંધી ≡ ગાન્ધી. This is the rule Tamil had to refuse and Gurmukhi has no
 *   occasion for, and it is correct here for the same reason it is correct in
 *   Hindi.
 *
 * Not folded: the ઑ/ઍ vowel signs U+0AC9/U+0AC5, which write English loan
 * vowels and are contrastive, and the Gujarati numerals.
 */
const GUJARATI: IndicScriptRules = {
	script: 'Gujr',
	name: 'Gujarati',
	block: [0x0a80, 0x0aff],
	drop: [
		0x0abc, // GUJARATI SIGN NUKTA
		0x0a83, // GUJARATI SIGN VISARGA
	],
	map: [
		[0x0a81, 'ં'], // CANDRABINDU → ANUSVARA
	],
	virama: 0x0acd,
	nasalsToAnusvara: [
		0x0aa8, // ન
		0x0aae, // મ
		0x0aa3, // ણ
		0x0a99, // ઙ
		0x0a9e, // ઞ
	],
	anusvara: 'ં',
	collapseViramaRuns: true,
};

/**
 * The registry. Append here to add a script; `normalize.ts` derives every
 * lookup table it needs from this array at module load.
 */
export const INDIC_SCRIPTS: readonly IndicScriptRules[] = [
	DEVANAGARI,
	BENGALI,
	GURMUKHI,
	GUJARATI,
	ODIA,
	TAMIL,
	TELUGU,
	KANNADA,
	MALAYALAM,
];

/**
 * Span of the Indic Unicode blocks (Devanagari U+0900 … Malayalam U+0D7F,
 * plus Sinhala up to U+0DFF). Every script in this span is caseless, so the
 * base fold can skip the per-character `toLowerCase()` allocation for the
 * whole range — including scripts not yet in `INDIC_SCRIPTS`. Kept as a
 * fixed constant rather than derived from the table so that registering a
 * script never silently changes the fast path.
 */
export const INDIC_CASELESS_RANGE: readonly [start: number, end: number] = [
	0x0900, 0x0dff,
];
