/**
 * Bengali language pack (native script + romanized "Banglish").
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * What makes Bengali different from the packs that came before it:
 *
 * 1. **Romanization is not one system, it is two.** Bengali is written across
 *    two standards — Kolkata (West Bengal) and Dhaka (Bangladesh) — and
 *    romanized Bengali reflects the writer's dialect, not a spelling rule.
 *    The same word appears as `choda`/`chuda`, `shuor`/`suor`/`shuyor`,
 *    `magi`/`maagi`/`magee`, `banchot`/`banchod`/`bancud`. The
 *    `romanizations` lists below are deliberately wide for exactly this
 *    reason, and they are the bulk of this pack's value: almost no Bengali
 *    profanity online is typed in Bengali script.
 * 2. **The inherent vowel is ɔ and is NOT deleted word-finally.** Hindi
 *    चोद romanizes as "chod"; Bengali চোদা romanizes as "choda", and the
 *    final vowel is written far more often than not. So the Hinglish-shaped
 *    romanization list does not transfer: the forms that carry Bengali are
 *    `choda`/`chudechi`/`chodano`, and the whole inflection family has to be
 *    built from the Bengali stem rather than copied from `hi.ts`.
 * 3. **Bengali case endings agglutinate lightly** (-র genitive, -এর, -কে,
 *    -টা, -রা, -দের): মাগী → মাগীর, খানকি → খানকির. Unlike Tamil this is
 *    shallow enough to list by hand, so this pack uses NO `matchMode:
 *    'prefix'` — prefix mode is a loaded gun and Bengali does not need it.
 *
 * The Bengali script rules in `src/unicode/indic-scripts.ts` were re-derived
 * from Bengali orthography when this pack was written (they had been authored
 * alongside Devanagari, by someone working on Hindi). The audit, including
 * the two rules that changed, is in the comment on that entry.
 *
 * **Standing project decision: every pack is SELF-SUFFICIENT.** A consumer
 * importing only `data/bn` gets full Bengali coverage, including the Latin
 * spellings of Perso-Arabic borrowings Bengali shares with Hindi and Urdu
 * (`haramjada`, `madarchod`). Nothing is deferred to `data/hi`. Where a
 * romanization is absent below it is because it is *ambiguous*, never because
 * another pack has it.
 *
 * Deliberately EXCLUDED (not profanity, or hopelessly collision-prone):
 *   - merely-coarse vocabulary that the Hindi pack's severity bar rejects:
 *     বোকা (fool), গাধা (donkey), ফাজিল (cheeky), বেয়াদব (impudent),
 *     ভোঁদাই (dolt), বেকুব.
 *   - বাড়া — vulgar for "penis" AND the everyday verb "to increase". Same
 *     word, same spelling, in both scripts; there is nothing to disambiguate
 *     on. Dropped outright (policy rule 1).
 *   - the romanization `magi` (the lemma মাগী ships without it) — it is an
 *     English dictionary word for the Zoroastrian priests and the biblical
 *     wise men, and a bare token cannot be allowlisted away.
 *   - নষ্টা — "fallen woman", but its romanization `nashta` is নাস্তা
 *     "breakfast", one of the commonest words in the language.
 *   - কাফের — a real religious slur, but `kafir` is also the standard English
 *     transliteration used descriptively in religious-studies writing. See the
 *     Flagged-for-review section in docs/language-packs.md.
 *
 * Known limitations, kept deliberately:
 *   - মাগী loses its single commonest romanization (`magi`) to the Magi
 *     collision above. `maagi` / `magee` / `magir` and the native spelling
 *     carry it instead; this is a real recall loss and is flagged for review.
 *   - গুদ, ধোন, বাল and পোঁদ ship **native-script only**: `gud` is jaggery and
 *     SMS-English "good", `dhon` is ধন "wealth", `bal` is Bal Thackeray and a
 *     hundred Indian given names, `pod` is an English word. Native-script-only
 *     beats dropping the lemma when the Latin spelling is the ambiguous part
 *     (policy rule 2).
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function bn(entry: Omit<LemmaEntry, 'language' | 'script'>): LemmaEntry {
	return { language: 'bn', script: 'Beng', ...entry };
}

const entries: LemmaEntry[] = [
	bn({
		lemma: 'বাঞ্চোত',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// ঞ্চ folds to ংচ, so বাঞ্চোত and বাঞ্চোদ share a key — but বানচোত
		// (written with a bare ন, no hosonto) does NOT, and is the commoner
		// casual spelling. Both families are listed.
		romanizations: [
			'banchot',
			'banchod',
			'bancot',
			'bancod',
			'banchut',
			'banchoth',
			'baanchod',
			'baanchot',
			'bancud',
		],
		variants: ['বাঞ্চোদ', 'বানচোত', 'বানচোদ', 'বাঞ্চত'],
		skeletonSafe: false, // key "bnkt" == skeleton("banquet")
	}),
	bn({
		lemma: 'বোকাচোদা',
		severity: 4,
		categories: ['sexual', 'general'],
		romanizations: [
			'bokachoda',
			'bokachod',
			'bokachuda',
			'bokachodha',
			'bokacoda',
			'bkchoda',
		],
		variants: ['বোকাচুদা', 'বোকাচোদ'],
		skeletonSafe: false, // key "bkd" (3)
	}),
	bn({
		lemma: 'খানকি',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// খাঙ্কি folds to খাংকি; খানকি (bare ন) does not fold at all. Two
		// different keys for one word — both are live spellings.
		romanizations: [
			'khanki',
			'khanka',
			'khankir',
			'khanki magi',
			'khankir pola',
			'khankir chele',
			'khankir put',
		],
		variants: ['খাঙ্কি', 'খানকী', 'খানকির', 'খানকীর'],
		skeletonSafe: false, // key "knkr" == skeleton("conquer")
	}),
	bn({
		lemma: 'চুতমারানি',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['chutmarani', 'chudmarani', 'chotmarani', 'chutmaranir'],
		variants: ['চুদমারানি', 'চোতমারানি', 'চুতমারানীর'],
		skeletonSafe: false, // key "ktmrn" == skeleton("catamaran")
	}),
	bn({
		lemma: 'গুদমারানি',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The one Latin surface গুদ gets: `gudmarani` is unambiguous where bare
		// `gud` (jaggery / SMS "good") is not.
		romanizations: ['gudmarani', 'gudmara', 'gudmarano', 'gudmaranir'],
		variants: ['গুদমারা'],
	}),
	bn({
		lemma: 'ভোদা',
		severity: 4,
		categories: ['sexual'],
		// 'voda' deliberately excluded — the standard Indian press shorthand
		// for Vodafone.
		romanizations: ['bhoda', 'bhuda', 'bhodar', 'bhodai'],
		variants: ['ভোদার'],
		skeletonSafe: false, // key "bd" (2)
	}),
	bn({
		lemma: 'গুদ',
		severity: 4,
		categories: ['sexual'],
		// NO romanizations: `gud` is গুড় "jaggery" and SMS-English "good".
		// Native script only, where nothing else occupies the spelling.
		// গুদাম "warehouse" is a different token and the word boundary keeps
		// it clean (there is a test).
		variants: ['গুদে', 'গুদের', 'গুদটা'],
	}),
	bn({
		lemma: 'মালাউন',
		severity: 4,
		categories: ['religious', 'slur'],
		// Anti-Hindu slur, current and serious in Bangladeshi text. Exactly the
		// register the `religious` category exists for.
		romanizations: ['malaun', 'malawn', 'malaoon', 'maloun', 'malauner'],
		variants: ['মালাউনের', 'মালাউনরা'],
		skeletonSafe: false, // key "mln" (3)
	}),
	bn({
		lemma: 'চাঁড়াল',
		severity: 4,
		categories: ['casteist', 'slur'],
		// Caste slur (Chandala). চণ্ডাল folds to চংডাল and চাঁড়াল to চাংডাল —
		// different keys, so both spellings are listed.
		// The descriptive Sanskrit/academic use is not listed, and the jyotish
		// term "chandal yog" is allowlisted, matching the ta pack's treatment
		// of சூத்திரன் / shudra.
		romanizations: ['chandal', 'chandaal', 'charal', 'chondal', 'chandaler'],
		variants: ['চণ্ডাল', 'চাঁড়ালের', 'চাঁড়ালটা'],
		allowlist: ['chandal yog', 'chandal yoga', 'chandala dosha'],
		skeletonSafe: false, // key "kndl" == skeleton("candle") and skeleton("kundli")
	}),
	bn({
		lemma: 'তোর মায়েরে চুদি',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: [
			'tor mayere chudi',
			'tor maere chudi',
			'tor mayere chodi',
			'tomar mayere chudi',
		],
		variants: ['তোর মারে চুদি'],
	}),
	bn({
		lemma: 'চুদির ভাই',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['chudir bhai', 'chodir bhai', 'chudirbhai', 'chudir pola'],
		// Found by sweeping /usr/share/dict/words: 'chudirbhai' keys to "kdrb",
		// which is skeleton("cedarbird") and skeleton("quadrable").
		skeletonSafe: false,
	}),
	bn({
		lemma: 'মাদারচোদ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['madarchod', 'maderchod', 'madarchoda', 'madarchuda'],
		variants: ['মাদারচুদ', 'মাদারচোদা'],
	}),

	bn({
		lemma: 'চোদা',
		severity: 3,
		categories: ['sexual'],
		// 'chudi' deliberately excluded: চুড়ি "bangle" has exactly that
		// romanization and is an everyday word. The bare imperative stems are
		// included even though `data/hi` also has them — this pack is
		// self-sufficient — but the forms Bengali's retained final vowel
		// produces are the ones that matter here.
		romanizations: [
			'choda',
			'chuda',
			'chod',
			'chode',
			'chodo',
			'chodar',
			'chudar',
			'chodano',
			'chudano',
			'chudechi',
			'chodachudi',
			'chudachudi',
		],
		variants: ['চুদা', 'চোদার', 'চুদির', 'চোদানো', 'চুদাচুদি'],
		skeletonSafe: false, // key "kd" (2)
	}),
	bn({
		lemma: 'মাগী',
		severity: 3,
		categories: ['gendered', 'slur'],
		// REVIEW: the single commonest romanization of this word, bare `magi`,
		// is DROPPED here under policy rule 1 — it is an English
		// dictionary word (the Zoroastrian priests, the biblical wise men) and a
		// bare token cannot be allowlisted away. The unambiguous romanizations
		// and the native spelling carry the lemma instead — the same call the ta
		// pack made for `pool` and சுன்னி. Should it be restored the way the hi
		// pack restored `randi`, accepting the false positive?
		romanizations: ['maagi', 'magee', 'magir', 'maagir', 'magibaji', 'magider'],
		variants: ['মাগি', 'মাগীর', 'মাগীটা'],
		skeletonSafe: false, // key "mg" (2)
	}),
	bn({
		lemma: 'মাগীবাজ',
		severity: 3,
		categories: ['gendered', 'sexual'],
		romanizations: ['magibaj', 'magibaaj', 'magibajer'],
		variants: ['মাগীবাজি'],
	}),
	bn({
		lemma: 'বেশ্যা',
		severity: 3,
		categories: ['gendered', 'sexual'],
		// Written with ya-phala (শ + hosonto + য). The fold table deliberately
		// leaves ya-phala alone — it is a conjunct member, not a diacritic —
		// so the spelling variants are carried here instead.
		romanizations: ['beshya', 'beshsha', 'besshya', 'beshyar', 'besya'],
		variants: ['বেশ্যার', 'বেস্যা'],
		skeletonSafe: false, // key "bs" (2)
	}),
	bn({
		lemma: 'ছিনাল',
		severity: 3,
		categories: ['gendered', 'slur'],
		// 'chinali' deliberately excluded — the Chinali are a community in
		// Himachal Pradesh and their language has the same name. The `or` pack
		// dropped it for the same reason; this pack had reintroduced it, and
		// the Odia clean suite caught it.
		romanizations: ['chinal', 'chhinal', 'chinaler'],
		variants: ['ছিনালি', 'ছিনালের'],
		skeletonSafe: false, // key "knl" (3)
	}),
	bn({
		lemma: 'জারজ',
		severity: 3,
		categories: ['general', 'slur'],
		// 'jaraj' deliberately excluded — too close to the given name Jaraj/Jarah.
		romanizations: ['jaroj', 'jarojer', 'jarojta'],
		variants: ['জারজের'],
		skeletonSafe: false, // key "jrj" (3)
	}),
	bn({
		lemma: 'বেজন্মা',
		severity: 3,
		categories: ['general', 'slur'],
		// ন্ম folds to ংম, so the common casual spelling বেজম্মা lands on the
		// same key automatically — a case where the script table does the work
		// a variant list would otherwise have to.
		romanizations: ['bejonma', 'bejomma', 'bejanma', 'bejonmar'],
	}),
	bn({
		lemma: 'ল্যাওড়া',
		severity: 3,
		categories: ['sexual'],
		// 'leora' and 'lawra' deliberately excluded — Leora is a given name and
		// Lawra is a district in Ghana.
		romanizations: ['lyaora', 'lyaoda', 'lyawra', 'leaora', 'lyaorar'],
		variants: ['ল্যাওড়ার', 'ল্যাওড়াটা'],
		skeletonSafe: false, // key "lr" (2)
	}),
	bn({
		lemma: 'শুয়োরের বাচ্চা',
		severity: 3,
		categories: ['general'],
		romanizations: [
			'shuorer bachcha',
			'shuorer baccha',
			'suorer baccha',
			'shuyorer bachcha',
			'shuorer bacha',
		],
		variants: ['শুওরের বাচ্চা', 'শুকরের বাচ্চা'],
	}),
	bn({
		lemma: 'ধোন',
		severity: 3,
		categories: ['sexual'],
		// NO romanizations: `dhon` is ধন "wealth". The native spelling ধোন (with
		// the ো vowel sign) is unambiguous where the Latin one is not.
		variants: ['ধোনটা', 'ধোনের'],
	}),
	bn({
		lemma: 'হারামজাদা',
		severity: 3,
		categories: ['general'],
		romanizations: ['haramjada', 'haramzada', 'haramjadi', 'haramzadi'],
		variants: ['হারামজাদি', 'হারামজাদার'],
	}),

	bn({
		lemma: 'শালা',
		severity: 2,
		categories: ['general'],
		// REVIEW: `shala` is also পাঠশালা / शाला "school / hall" in several
		// Indian languages and a given name. Kept because it is the dominant
		// Bengali spelling and the hi pack already accepts the same class of
		// risk for `sala`; 'pathshala' and friends are allowlisted.
		romanizations: ['shala', 'shaala', 'shalar', 'shali', 'shalara'],
		variants: ['শালার', 'শালী', 'শালারা'],
		allowlist: ['pathshala', 'patshala', 'paathshala', 'shala mandir'],
		casualUse: true,
		skeletonSafe: false, // key "sl" (2)
	}),
	bn({
		lemma: 'শুয়োর',
		severity: 2,
		categories: ['general'],
		// 'suar'/'suwar' are absent for a linguistic reason, not a deferral to
		// `data/hi`: they romanize Hindi सूअर, and Bengali does not write
		// সুয়ার. 'shuar' is a real Bengali spelling and is listed.
		romanizations: ['shuor', 'shuyor', 'suor', 'shuar', 'shukor', 'shuorer'],
		variants: ['শুওর', 'শুকর', 'শুয়োরটা'],
		casualUse: true,
		skeletonSafe: false, // key "sr" (2)
	}),
	bn({
		lemma: 'পোঁদ',
		severity: 2,
		categories: ['sexual'],
		// NO romanizations: `pod` is an English word and `ponde` a Spanish verb
		// form. পোঁদ folds to পোংদ; the unnasalised পোদ is listed separately.
		variants: ['পোদ', 'পোঁদে', 'পোদে', 'পোঁদের'],
	}),
	bn({
		lemma: 'বাল',
		severity: 2,
		categories: ['sexual', 'general'],
		// NO romanizations: `bal` is Bal Thackeray, Bal Gangadhar Tilak, and a
		// hundred other Indian given names. Used as a filler expletive, hence
		// casualUse. বাল ঠাকরে (the Bengali spelling of the name) is
		// allowlisted for the native-script side.
		variants: ['বালের', 'বালছাল'],
		allowlist: ['বাল ঠাকরে', 'বাল গঙ্গাধর'],
		casualUse: true,
	}),
	bn({
		lemma: 'ঢ্যামনা',
		severity: 2,
		categories: ['general'],
		// REVIEW: register uncertain — "shameless wretch", with a secondary
		// pimp-adjacent reading. Severity 2 assumes the insult sense.
		// 'dhamna' deliberately excluded — ধামনা / dhaman is a rat snake.
		romanizations: ['dhyamna', 'dhemna', 'dhyamnar'],
		variants: ['ঢেমনা', 'ঢ্যামনার'],
		skeletonSafe: false, // key "dmn" (3)
	}),
	bn({
		lemma: 'ছোটলোক',
		severity: 2,
		categories: ['general'],
		// REVIEW: this is class abuse, not caste abuse, and the Category union
		// has no `classist` member. Tagged `general` rather than stretching
		// `casteist` — is that the right call, or should the union grow?
		romanizations: ['chotolok', 'chhotolok', 'chotoloker', 'chotolokera'],
		variants: ['ছোটলোকের', 'ছোটলোকটা'],
		skeletonSafe: false, // key "ktlk" == skeleton("catholic") — and "catlike"
	}),
];

export const bengali: LanguagePack = {
	language: 'bn',
	name: 'Bengali + Banglish',
	entries,
	allowlist: [
		// English and Indian words whose skeletons reach a Bengali key.
		// (Every one of these was found by computing the key, not by guessing.)
		'banquet', // skeleton "bnkt" == banchot
		'banquets',
		'banqueting',
		'conquer', // skeleton "knkr" == khankir
		'conquered',
		'catamaran', // skeleton "ktmrn" == chutmarani
		'catamarans',
		'candle', // skeleton "kndl" == chandal
		'candles',
		'kundli', // the horoscope — same key
		'chandal yog', // the jyotish term
		'chandal yoga',
		// Bengali words the pack must never touch.
		'গুদাম', // "warehouse" — shares the গুদ opening
		'গুড়', // "jaggery"
		'ধন', // "wealth" — why ধোন ships native-only
		'ধন্যবাদ',
		'বাড়ি', // "house"
		'বাড়া', // "to increase" — the dropped homograph
		// Proper nouns.
		'pathshala',
		'বাল ঠাকরে',
		'sonar bangla',
	],
};
