/**
 * Odia language pack (native script + romanized "Odlish").
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * **This pack is deliberately short — 15 lemmas.** Odia has the thinnest
 * online romanized corpus of the Indian languages shipped here, and a padded
 * list would be a permanent false-positive liability rather than extra recall.
 * Every entry below is backed by at least one checkable source:
 *
 * - *Purnnachandra Odia Bhashakosha* (Praharaj), via dsal.uchicago.edu, is the
 *   authority for native spellings and for the innocent homographs each entry
 *   has to dodge. Entries it marks ଅଶ୍ଲୀଳ ("obscene") are noted as such.
 * - youswear.com's crowd-sourced Oriya list is the only sizeable romanized
 *   corpus; it carries per-entry accuracy votes, and nothing below came from
 *   an entry voted under ~60% unless a dictionary confirmed it too.
 *
 * Three things shape this file:
 *
 * 1. **Romanizations are the deliverable, and Odia collides badly.** The
 *    obvious Latin spelling of several core words is an ordinary word in
 *    another language — `banda` (Banda Aceh; "band/gang" in Spanish and
 *    Italian), `gandi` (Hindi गंदी "dirty"), `magia` (Italian/Spanish
 *    "magic"), `bia`, `pela`. Where the Latin spelling is the ambiguous half,
 *    this pack ships the native script plus a disambiguated romanization
 *    (`gaandi`, `baanda`) instead of dropping the lemma.
 * 2. **Case suffixes attach to the noun** (ଗାଣ୍ଡି → ଗାଣ୍ଡିରେ "in the arse",
 *    ଗାଣ୍ଡିକୁ), so Odia needs `matchMode: 'prefix'` the way Tamil does — the
 *    trick is not Dravidian-only. Only ଗାଣ୍ଡି uses it, because it is the only
 *    entry whose stem does not also start a common innocent word.
 * 3. **No expander.** Tamil's degemination and Hindi's inflection expander
 *    both encode a spelling variation those languages actually have; Odia has
 *    neither, so generating forms here would be inventing data. The cost is
 *    known: word-mode entries miss suffixed spellings (ବାଣ୍ଡରେ).
 *
 * Deliberately EXCLUDED (not profanity, or hopelessly collision-prone):
 *   - the merely-rude vocabulary, matching the Hindi pack's severity-1 bar:
 *     ଅଭଦ୍ର (mannerless), ବୋକା (fool), ଗଧ (donkey), ଘୁଷୁରି (pig),
 *     କୁକୁର (dog), ପାଗଳ (mad).
 *   - the clinical / literary register: ବେଶ୍ୟା "prostitute" is the neutral
 *     dictionary word (the Hindi pack drops वेश्या for the same reason).
 *   - words whose innocent sense dominates in Odia itself: ପେଳ / ପେଲା
 *     ("testicle", but ପେଲିବା is the everyday verb "to push"), ଚୁକିବା
 *     (vulgar in the crowd list, but ordinarily "to miss / to err"), ଦାନା
 *     ("grain"), ସେଣ୍ଟି (also Indian-English "senti" for sentimental).
 *   - ରଣ୍ଡା "widow" — the dictionary sense is the dominant one and censoring
 *     it would censor bereavement.
 *   - the whole X + ଘିଆ family beyond the two commonest members: the pattern
 *     is productive (ଘୁଷୁରିଘିଆ, କୁକୁରଘିଆ, ମାଙ୍କଡ଼ଘିଆ …) and listing it out
 *     would be padding.
 *
 * **Self-sufficiency (standing project decision).** A consumer importing only
 * `remove-profanity/data/or` must get full Odia coverage, so the borrowed
 * layer Odia speakers actually type is listed HERE even where the same Latin
 * spelling already exists in another pack: `randi`, `gandu`, `madarchod`.
 * Nothing is deferred to the Hindi pack. Duplicate surfaces across packs are
 * harmless to the engine — overlapping candidates collapse to one match — and
 * `test/odia-data.test.ts` pins the overlap list so it stays deliberate.
 * Borrowed lemmas are still SOURCED, not assumed: each one below is attested
 * in an Odia source, and the pan-Indian words Odia's own corpus does not
 * attest (`chutia`, `bhosadi`, `jhaant`) are not listed on a guess.
 *
 * Known limitations, kept deliberately:
 *   - ଚଣ୍ଡାଳ and ବିଆ ship native-script-only; their Latin spellings are the
 *     ambiguous half (see each entry).
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function or(entry: Omit<LemmaEntry, 'language' | 'script'> & { script?: string }): LemmaEntry {
	return { language: 'or', script: 'Orya', ...entry };
}

const entries: LemmaEntry[] = [
	or({
		lemma: 'ମାଘିଆ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// ମା ("mother") + ଘିଆ, the -ia agent form of ଗେହିବା "to cohabit"
		// (Praharaj): literally "mother-fucker", and the single commonest Odia
		// obscenity online.
		// 'magia' deliberately excluded — it is "magic" in Italian, Spanish and
		// Polish. 'magi' likewise: the Magi, and ମାଗି "having begged", an
		// everyday Odia verb form.
		romanizations: ['maghia', 'maaghia', 'maghiaa', 'maagya'],
		variants: ['ମାଗିଆ', 'ମା ଘିଆ'],
		// Also used as a friendly vocative between men ("mate"), the way English
		// speakers use "fucker" — hence casualUse.
		// REVIEW: severity 4 assumes the literal reading. If the vocative use is
		// judged dominant this belongs at 3, like the Hindi pack's छक्का.
		casualUse: true,
		allowlist: [
			'magha', // the month; ମାଘ ସପ୍ତମୀ / Maghi Purnima are festivals
			'maghi',
			'magha saptami',
			'maghi purnima',
			'magha mela',
			'magahi', // the Magahi language and the Magahiya community
			'magahiya',
			'magadhi',
		],
		skeletonSafe: false, // key "mg" (2)
	}),
	or({
		lemma: 'ଭଉଣୀଘିଆ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// ଭଉଣୀ "sister" + ଘିଆ — the Odia-built equivalent of behenchod, and
		// distinct from it in both scripts.
		romanizations: ['bhaunighia', 'bhauni ghia', 'bhaunigia', 'bhauni gia', 'bhauni giha'],
		variants: ['ଭଉଣୀ ଘିଆ', 'ଭଉଣୀଗିଆ'],
		skeletonSafe: false, // key "bng" (3)
	}),
	or({
		lemma: 'ବେଧେଈ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Praharaj: ବେଧେଈ "adulteress", ବେଧେଈ ପୁଅ "a bastard". Both are used as
		// abuse; the phrase form is listed rather than a bare ପୁଅ ("son").
		romanizations: ['bedhei', 'bedhai', 'bedhei pua', 'bedheipua'],
		variants: ['ବେଧେଇ', 'ବେଧେଈ ପୁଅ'],
		skeletonSafe: false, // key "bd" (2)
	}),
	or({
		lemma: 'ଗାଣ୍ଡିଆ',
		severity: 4,
		categories: ['slur', 'gendered', 'sexual'],
		// Praharaj glosses it "catamite; sodomite"; the crowd list glosses the
		// modern use as an anti-gay insult. Slur usage sets the severity.
		// 'gandia' deliberately excluded — Gandía is a Valencian city and a
		// surname; the doubled-a spelling is unambiguous.
		romanizations: ['gaandia', 'gaandiaa'],
		skeletonSafe: false, // key "gnd" (3) — also the skeleton of "gandhi"
	}),
	or({
		lemma: 'ରଣ୍ଡୀ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Praharaj: "harlot"; the crowd list attests the compound abuse
		// "randi puo" ("prostitute's son").
		// 'randi' is listed here even though the Hindi pack also has it — this
		// pack is self-sufficient by decision, and Odia speakers type it.
		// 'randa' stays out: ରଣ୍ଡା is the ordinary Odia word for "widow", and
		// censoring bereavement is a worse failure than missing an insult.
		romanizations: ['randi', 'randi pua', 'randipua', 'randi puo'],
		variants: ['ରଣ୍ଡି'],
		skeletonSafe: false, // key "rnd" (3)
	}),
	or({
		lemma: 'ମାଦରଚୋଦ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// REVIEW: the Odia crowd list attests the ROMANIZED form "madarchaut"
		// (73%), which is the Odia vowel treatment of madarchod; the native
		// spellings here are transliterations of that and want a native
		// speaker's eye.
		// Listed despite the Hindi pack having the same word: an Odia-only
		// consumer must catch the commonest South Asian obscenity.
		romanizations: ['madarchaut', 'madarchod', 'madarchouta'],
		variants: ['ମାଦରଚୌତ'],
	}),

	or({
		lemma: 'ଗାଣ୍ଡି',
		severity: 3,
		categories: ['sexual'],
		// Praharaj: "buttocks; anus" (its other gloss, "knot", is archaic).
		// Prefix mode covers the attached case suffixes — ଗାଣ୍ଡିରେ, ଗାଣ୍ଡିକୁ,
		// ଗାଣ୍ଡିଠାରୁ — which is how the word actually appears in abuse.
		// 'gandi' deliberately excluded: it is Hindi गंदी "dirty" ("gandi baat"),
		// which is far commoner in Indian Latin-script text than this word.
		romanizations: ['gaandi'],
		matchMode: 'prefix',
		// ଗାଣ୍ଡିବ / ଗାଣ୍ଡୀବ is Gāṇḍīva, Arjuna's bow — a Mahabharata proper noun
		// that starts with the native prefix. ଗାଣ୍ଡିମୁଣ୍ଡ "beginning and end" is
		// an ordinary idiom built on the same stem.
		allowlist: [
			'ଗାଣ୍ଡିବ',
			'ଗାଣ୍ଡିବଧନ୍ୱା',
			'ଗାଣ୍ଡିମୁଣ୍ଡ',
			'gandiva',
			'gandiv',
			'gandiba',
			'gandibi',
			'gandhi',
		],
		skeletonSafe: false, // key "gnd" (3) — collides with "gandhi"
	}),
	or({
		lemma: 'ବାଣ୍ଡ',
		severity: 3,
		categories: ['sexual'],
		// Praharaj marks it ଅଶ୍ଲୀଳ: "ଶିଶ୍ନ; ଲିଙ୍ଗ — Penis".
		// Word mode, NOT prefix: ବାଣ୍ଡି is a bullock cart, ବାଣ୍ଡେଜ୍ a bandage and
		// ବାଣ୍ଡ୍ a (musical) band, so a prefix here would fire on three ordinary
		// words. 'banda' is excluded for the mirror-image reason in Latin —
		// Banda Aceh, the Banda Sea, Spanish/Italian "banda". The phrase
		// romanization is safe because the second word disambiguates it.
		romanizations: ['baanda', 'banda chhod', 'banda chhoda'],
		allowlist: ['ବାଣ୍ଡି', 'ବାଣ୍ଡେଜ', 'ବାଣ୍ଡୋରି', 'banda aceh', 'banda sea', 'banda islands'],
		skeletonSafe: false, // key "bnd" (3)
	}),
	or({
		lemma: 'ପୁଦି',
		severity: 3,
		categories: ['sexual'],
		// REVIEW: the crowd list gives "PUDI — vagina" at 100%, but Praharaj has
		// no entry, so the native spelling ପୁଦି is reconstructed rather than
		// attested. ଫୁଦି is the other plausible spelling (and the Punjabi/Urdu
		// cognate is "phudi"); a native speaker should confirm which to ship.
		romanizations: ['pudi'],
		allowlist: ['ପୁଦିନା', 'pudina'], // ପୁଦିନା "mint" — the near neighbour
		skeletonSafe: false, // key "pd" (2)
	}),
	or({
		lemma: 'ବିଆ',
		severity: 3,
		categories: ['sexual'],
		// Praharaj marks it obscene: "female generative organ, vagina". Native
		// script ONLY — 'bia' is three letters and reads as a name, an acronym
		// and a Portuguese diminutive. Word mode keeps it off ବିଆଣ "childbirth",
		// ବିଆଜ "interest" and ବିଆଳି "autumn paddy", which merely start with it.
	}),
	or({
		lemma: 'ଛିନାଳି',
		severity: 3,
		categories: ['gendered', 'slur'],
		// Praharaj: "adultery in the case of a woman; a coquettish woman";
		// ଛିନାଳ is the masculine/base form.
		// 'chinali' (single h) deliberately excluded — the Chinali are a
		// community in Himachal Pradesh, and their language has the same name.
		romanizations: ['chhinali', 'chhinala', 'chhinaali'],
		variants: ['ଛିନାଳ'],
		skeletonSafe: false, // key "cnl" (3)
	}),
	or({
		lemma: 'ଗେହିବା',
		severity: 3,
		categories: ['sexual'],
		// Praharaj: "to cohabit" — the verb the whole ଘିଆ family is built from.
		// The romanizations are the finite forms the crowd list actually
		// attests (gehiba / gehibi / gehin / ghein / gihen); nothing here is a
		// form generated by rule.
		romanizations: ['gehiba', 'gehibi', 'gehin', 'ghein', 'gihen'],
		skeletonSafe: false, // keys "gb"/"gn" (2)
	}),
	or({
		lemma: 'ହିଞ୍ଜଡ଼ା',
		severity: 3,
		categories: ['slur', 'gendered'],
		// The Odia reflex of हिजड़ा, with the nasal the Odia pronunciation adds.
		// Severity matches the Hindi pack's हिजड़ा. As there, the neutral
		// self-identifier is deliberately not a pattern — 'hijra' is absent, and
		// the respectful Odia term ତୃତୀୟ ଲିଙ୍ଗ must never appear in a list like
		// this.
		// REVIEW: ହିଞ୍ଜଡ଼ା vs ହିଜଡ଼ା — both are shipped, but which is the usual
		// written form is a native-speaker call.
		romanizations: ['hinjada', 'hinjida'],
		variants: ['ହିଜଡ଼ା'],
	}),
	or({
		lemma: 'ଗାଣ୍ଡୁ',
		severity: 3,
		categories: ['sexual', 'gendered'],
		// Praharaj has ଗାଣ୍ଡୁ glossed "coward" — the polite half of a word that
		// is now the pan-Indian gandu insult, and one of the commonest things
		// an Odia speaker types. Listed here rather than left to the Hindi
		// pack (self-sufficiency, see the file header).
		// Word mode, not prefix: ଗାଣ୍ଡୁଆ is a bamboo basket.
		romanizations: ['gandu', 'gaandu', 'gandoo'],
		allowlist: ['ଗାଣ୍ଡୁଆ'],
		skeletonSafe: false, // key "gnd" (3) — the skeleton of "gandhi" too
	}),
	or({
		lemma: 'ଚଣ୍ଡାଳ',
		severity: 3,
		categories: ['casteist', 'slur'],
		// Praharaj gives both senses: the caste designation, and "a reprobate
		// and depraved person" — it is the second that makes it live abuse.
		// Native script ONLY, the same call the Tamil pack made for தோட்டி:
		// "chandala" is also the spelling used in historical and academic
		// writing about the varna system, so the Latin form is the ambiguous
		// half. The communities historically labelled with it (ହାଡ଼ି, ଡୋମ, ପାଣ,
		// ବାଉରୀ, କେଉଟ) are not patterns here and need no allowlist entry — see
		// the note in the pack-level allowlist on why adding one would cost
		// more than it buys.
	}),
];

export const odia: LanguagePack = {
	language: 'or',
	name: 'Odia + Odlish',
	entries,
	allowlist: [
		// Odia words and proper nouns a prefix entry would otherwise swallow.
		'ଗାଣ୍ଡିବ', // ଗାଣ୍ଡୀବ, Arjuna's bow
		'ଗାଣ୍ଡୀବ',
		'ଗାଣ୍ଡିବଧନ୍ୱା',
		'ଗାଣ୍ଡିମୁଣ୍ଡ', // "beginning and end", an ordinary idiom
		'ବାଣ୍ଡି', // bullock cart
		'ବାଣ୍ଡେଜ', // bandage
		'ପୁଦିନା', // mint
		'gandiva',
		'gandiv',
		'gandiba',
		'gandibi',
		'pudina',
		// The neutral community names Odia caste abuse is aimed at — ହାଡ଼ି, ଡୋମ,
		// ପାଣ, ବାଉରୀ, କେଉଟ and their Latin spellings — are deliberately NOT
		// listed here. None of them is a pattern in this pack, and every entry
		// added to an allowlist is a live suppression span for every other pack
		// too, so short generic words do not belong in one.
		// Names, places and other-language words the romanizations approach.
		'gandhi',
		'mahatma gandhi',
		'indira gandhi',
		'magha',
		'maghi',
		'magha saptami',
		'maghi purnima',
		'magahi',
		'magahiya',
		'magadhi',
		'banda aceh',
		'banda sea',
		'banda islands',
	],
};
