/**
 * Marathi language pack (Devanagari + romanized).
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * ## Marathi shares a script AND vocabulary with Hindi — read this first
 *
 * This is the only pack so far whose script is already occupied by another
 * pack. Overlap with `data/hi` is therefore a design decision, not an
 * accident, and it was made after measuring what the matcher actually does
 * with a lemma that appears in two loaded packs (see
 * docs/language-packs.md, "Cross-pack overlap"). The measured behaviour:
 *
 * - Two entries producing a candidate over the **same span** are collapsed to
 *   ONE reported match, always. Loading hi + mr never doubles a hit.
 * - When the two entries have **different lemma strings**, overlap resolution
 *   keeps the **higher severity** — deterministic, order-independent.
 * - When the two entries have the **same lemma string**, the deduplication
 *   key is `lemma + span`, so the second one is dropped before severity is
 *   ever compared: **pack order decides**. A shared lemma carrying a
 *   different severity in the two packs would silently resolve by load order.
 *
 * **Standing project decision: every pack is SELF-SUFFICIENT.** A consumer
 * importing only `data/mr` gets full Marathi coverage, including the Latin
 * spellings of words Marathi shares with Hindi. Nothing is deferred to another
 * pack. That is why `chut`, `madarchod`, `randi`, `lund` and `harami` appear
 * below even though `data/hi` also carries them: the subpath export means a
 * Marathi-only consumer is a real consumer, and a word this pack knows about
 * must not go uncaught because someone did not also install Hindi.
 *
 * Hence the three rules this pack follows, one per case in the overlap:
 *
 * 1. **Same lemma STRING as a hi entry** (गांड, गांडू, चूत, मादरचोद, रंडी,
 *    लंड, हरामी): `severity`, `categories`, `casualUse` and `skeletonSafe`
 *    must be byte-identical to hi's, so the engine's order-dependent collapse
 *    is a no-op whichever pack loads first. `test/marathi-overlap.test.ts`
 *    enforces that mechanically — it fails if hi's severity for a shared
 *    lemma ever moves without this pack moving with it. Their hi-side
 *    allowlists are repeated here too, because `data/mr` may be loaded alone.
 * 2. **Same word, DIFFERENT lemma string** (भडवा / भड़वा, लवडा / लौड़ा,
 *    चुत्या / चूतिया): one match key after the folds, two strings, which lands
 *    them in the safe branch where the engine compares severities. Free to
 *    carry Marathi spellings and severities; kept equal anyway.
 * 3. **Marathi-specific** (झवाड्या, आयझव्या, महाऱ्या): ordinary entries. This
 *    is the pack's actual value, and it is most of the file.
 *
 * Known consequence of rule 1, worth stating: when two packs reach the same
 * span through DIFFERENT lemma strings with equal severity, the reported
 * `lemma` and `language` follow pack order. The match, span and severity do
 * not. Do not route on `language` for a Devanagari match.
 *
 * ## Caste abuse specific to Maharashtra
 *
 * The `casteist` category is the reason a Marathi pack is worth shipping at
 * all: महाऱ्या, मांग्या and चांभाऱ्या are live abusive vocatives aimed at the
 * Mahar, Matang and Chambhar communities, and no Hindi list contains them. In
 * every case only the abusive form is matched and the neutral community name
 * is allowlisted (policy rule 2).
 *
 * मांग्या ships **native-script only**: romanized `mangya` is
 * indistinguishable from मंग्या, one of the commonest Marathi nicknames
 * (Mangesh, Mangal). The Devanagari spellings differ (मांग्या vs मंग्या) and
 * that is enough — native-only beats dropping the lemma when the Latin
 * spelling is the ambiguous part.
 *
 * Deliberately EXCLUDED:
 *   - ढोऱ्या — caste abuse aimed at the Dhor community, but ढोर is also the
 *     everyday Marathi word for cattle, in both scripts. Nothing to
 *     disambiguate on (policy rule 1).
 *   - merely-coarse words the Hindi pack's bar rejects: बेवडा (drunkard),
 *     फडतूस (worthless), टकल्या (baldy), वेंधळा (clumsy), मुर्दाड.
 *   - तृतीयपंथी, the respectful Marathi term for a trans person, must never
 *     appear in a list like this.
 *   - शिंच्या — a euphemistic Marathi expletive, closer to "dash it" than to
 *     profanity.
 *
 * ## Why no `matchMode: 'prefix'`
 *
 * Marathi agglutinates case endings (गांड → गांडीत, गांडीच्या) but nowhere
 * near as deeply as Tamil, and its stems are short enough that prefix mode
 * would swallow ordinary words (गांडूळ "earthworm" starts with गांडू). The
 * inflected forms are listed by hand instead, the way the hi pack does it.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function mr(entry: Omit<LemmaEntry, 'language' | 'script'>): LemmaEntry {
	return { language: 'mr', script: 'Deva', ...entry };
}

/**
 * Lemmas re-shipped from `data/hi` under case 1 above — the ones whose lemma
 * STRING is byte-identical, which is the only case that lands in the engine's
 * order-dependent dedupe branch. Listed here as data so the overlap test can
 * assert the mirror is exact rather than re-deriving the intent from the
 * entry list.
 *
 * भडवा is deliberately NOT here even though it is the same word: Hindi spells
 * it भड़वा with a nukta and Marathi does not, so the two lemma strings differ
 * and the pair lands in the safe branch (different strings → the engine
 * compares severities) even though the nukta fold makes them one match key.
 * Same for चुत्या / चूतिया and लवड्या / लौड़ा.
 */
export const SHARED_WITH_HINDI: readonly string[] = [
	'गांड',
	'गांडू',
	'चूत',
	'मादरचोद',
	'रंडी',
	'लंड',
	'हरामी',
];

const entries: LemmaEntry[] = [
	mr({
		lemma: 'गांड',
		severity: 3, // must equal hi's — enforced by test/marathi-overlap.test.ts
		categories: ['sexual'],
		// The bare stem AND Marathi's oblique/genitive forms. The stem is also
		// in `data/hi`; it is repeated here because this pack is self-sufficient.
		romanizations: [
			'gand',
			'gaand',
			'gandit',
			'gandicha',
			'gandichya',
			'gandmasti',
			'gandfat',
		],
		variants: ['गांडीत', 'गांडीचा', 'गांडीच्या', 'गांडमस्ती'],
		// गांडूळ "earthworm" (गांडूळ खत = vermicompost, an everyday Marathi
		// agriculture term) is the local trap the hi allowlist does not know
		// about. The Hindi-side allowlist is repeated because a consumer may
		// load `data/mr` alone.
		allowlist: [
			'gandhi',
			'uganda',
			'gandalf',
			'gandul',
			'gandool',
			'gandul khat',
			'गांडूळ',
			'गांडूळ खत',
		],
		skeletonSafe: false, // key "gnd" (3) — as in hi
	}),
	mr({
		lemma: 'गांडू',
		severity: 3, // must equal hi's
		categories: ['sexual', 'gendered'],
		romanizations: ['gandu', 'gaandu', 'gandoo', 'gandya', 'gandubaj', 'gandyala'],
		variants: ['गांड्या', 'गांडूला'],
		allowlist: ['gandul', 'gandool', 'गांडूळ', 'गांडूळ खत'],
		skeletonSafe: false, // key "gnd" (3) — as in hi
	}),
	mr({
		lemma: 'भडवा',
		// Same word as hi's भड़वा, spelled the Marathi way (no nukta). The
		// nukta fold makes them one match KEY but two lemma strings, so the
		// engine compares severities rather than deduping — kept equal anyway.
		severity: 3,
		categories: ['sexual', 'gendered'],
		// भडव्या is the Marathi vocative and by far the commonest live form.
		romanizations: [
			'bhadva',
			'bhadwa',
			'bharva',
			'bhadvya',
			'bhadwya',
			'bhadavya',
			'bhadvyachya',
			'bhadvegiri',
		],
		variants: ['भडव्या', 'भडवीच्या', 'भडवेगिरी'],
		// भाड्याने "on rent" is the near-miss Marathi readers will think of.
		allowlist: ['bhadyane', 'bhadotri', 'भाड्याने'],
		skeletonSafe: false, // key "bdv" (3) — as in hi
	}),

	// The shared Indo-Aryan core. Every one of these is ordinary Marathi
	// profanity as well as ordinary Hindi profanity, so a Marathi-only
	// consumer must get it. Lemma string, severity, categories, casualUse
	// and skeletonSafe all mirror `data/hi` exactly.
	mr({
		lemma: 'चूत',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chut', 'choot', 'chutit'],
		variants: ['चूतीत'],
		allowlist: ['chutney', 'chutki', 'chutkule'],
		skeletonSafe: false, // key "kt" (2) — as in hi
	}),
	mr({
		lemma: 'मादरचोद',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: [
			'madarchod',
			'maderchod',
			'madharchod',
			'madarchood',
			'madarchodya',
		],
		variants: ['मादरचोद्या', 'मादरचोदच्या'],
	}),
	mr({
		lemma: 'रंडी',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Known limitation inherited from the hi pack: "Randi" is a Western
		// given name and is deliberately not allowlisted — the slur reading
		// dominates in Indian text.
		romanizations: ['randi', 'rendi', 'randibaj'],
		variants: ['रंडीबाज'],
		skeletonSafe: false, // key "rnd" (3) — as in hi
	}),
	mr({
		lemma: 'लंड',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['lund', 'laund', 'lundat'],
		variants: ['लंडात'],
		allowlist: ['lund university', 'lunds', 'lund sweden', 'lund, sweden'],
		skeletonSafe: false, // key "lnd" (3) — as in hi
	}),
	mr({
		lemma: 'हरामी',
		severity: 2,
		categories: ['general'],
		romanizations: ['harami', 'haraami', 'haramkhor'],
		variants: ['हरामखोर'],
		allowlist: ['bullish harami', 'bearish harami', 'harami candlestick'],
		casualUse: true,
		skeletonSafe: false, // key "hrm" (3) — as in hi
	}),

	mr({
		lemma: 'आयझव्या',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The Marathi mother-insult, and one of the words that most marks a
		// text as Marathi rather than Hindi.
		romanizations: [
			'aayzavya',
			'aaizavya',
			'ayzavya',
			'aayjhavya',
			'aaijhavya',
			'mayzavya',
			'maizavya',
			'mayjhavya',
		],
		variants: ['आयझव', 'आयझवी', 'मायझव्या', 'मायझव'],
		skeletonSafe: false, // key "ajv" (3)
	}),
	mr({
		lemma: 'आईघाल्या',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['aaighalya', 'ayghalya', 'aighalya', 'aayghalya'],
		variants: ['आयघाल्या', 'आईघाल'],
		skeletonSafe: false, // key "agl" (3)
	}),
	mr({
		lemma: 'झवाड्या',
		severity: 4,
		categories: ['sexual'],
		// 'javadya' deliberately excluded — too close to the given name Jawad.
		romanizations: [
			'zavadya',
			'jhavadya',
			'zavadi',
			'jhavadi',
			'zavadyano',
			'zavdya',
		],
		variants: ['झवाडी', 'झवड्या', 'झवाड्यांनो'],
		skeletonSafe: false, // key "jvd" (3)
	}),
	mr({
		lemma: 'मादरझव्या',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['madarzavya', 'madarjhavya', 'madarzav'],
		variants: ['मादरझव'],
	}),
	mr({
		lemma: 'भोसडीच्या',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The Marathi genitive, where the hi pack has the Hindi dative भोसड़ीके.
		romanizations: [
			'bhosadichya',
			'bhosdichya',
			'bhosdicha',
			'bhosadicha',
			'bhosadya',
			'bhosdya',
			'bhosdike',
			'bhosadike',
			'bhosdi ke',
		],
		variants: ['भोसडिच्या', 'भोसड्या', 'भोसडीचा'],
	}),
	mr({
		lemma: 'चुतमारीच्या',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['chutmarichya', 'chutmaricha', 'chutmarya'],
		variants: ['चुतमारीचा'],
		// Found by running the false-positive suite with `data/mr` ALONE: the
		// keys are "ktmr" / "ktmrk" / "ktmrn", which are skeleton("catamaran")
		// and skeleton("kitemark"). Loading hi or bn hid it, because their
		// allowlists already carry those words.
		skeletonSafe: false,
	}),
	mr({
		lemma: 'रांडेच्या',
		severity: 4,
		categories: ['gendered', 'sexual'],
		romanizations: ['randechya', 'randecha', 'randichya', 'randechi'],
		variants: ['रांडेचा', 'रांडीच्या', 'रांडेची'],
		// Key "rndk" == skeleton("reindict") / skeleton("rondache"), found by
		// sweeping /usr/share/dict/words.
		skeletonSafe: false,
	}),

	// Caste abuse specific to Maharashtra. Only the abusive vocative is
	// matched; the community name itself is allowlisted in every case.
	mr({
		lemma: 'महाऱ्या',
		severity: 4,
		categories: ['casteist', 'slur'],
		// महाऱ्या and महार्या are one key because of the ऱ→र rule added to the
		// Devanagari table for this pack. They were NOT one key before: U+0931
		// is not a composition exclusion, so NFC composes र + nukta into ऱ and
		// the nukta rule never fires. See src/unicode/indic-scripts.ts.
		romanizations: ['maharya', 'maharadya', 'mahardya', 'mharya'],
		variants: ['म्हाऱ्या', 'महारड्या'],
		allowlist: [
			'mahar',
			'mahar regiment',
			'mahar community',
			'mahar samaj',
			'maharashtra',
			'maharwada',
			'महार',
			'महार समाज',
			'महाराष्ट्र',
		],
		skeletonSafe: false, // key "mr" (2)
	}),
	mr({
		lemma: 'मांग्या',
		severity: 4,
		categories: ['casteist', 'slur'],
		// NATIVE SCRIPT ONLY. Romanized `mangya` is मंग्या, the standard
		// Marathi nickname for Mangesh/Mangal — the Devanagari spellings differ
		// (मांग्या has the ा) but the Latin ones do not.
		variants: ['मांगड्या', 'मांग्यांनो'],
		allowlist: ['मांग', 'मातंग', 'मांग समाज', 'मातंग समाज', 'मंग्या', 'मंगेश'],
	}),
	mr({
		lemma: 'चांभाऱ्या',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['chambharya', 'chamharya', 'chambhardya'],
		variants: ['चांभारड्या'],
		allowlist: [
			'chambhar',
			'chambhar samaj',
			'chambhar community',
			'चांभार',
			'चांभार समाज',
		],
		skeletonSafe: false, // key "kmbr" == skeleton("chamber")
	}),

	mr({
		lemma: 'झवणे',
		severity: 3,
		categories: ['sexual'],
		// The bare stems 'zav' / 'jhav' are deliberately absent — three and four
		// characters is too short to survive contact with real text.
		romanizations: [
			'zavne',
			'jhavne',
			'zavto',
			'jhavto',
			'zavla',
			'jhavla',
			'zavli',
			'jhavli',
			'zavaycha',
		],
		variants: ['झवतो', 'झवला', 'झवली', 'झवायचं'],
		skeletonSafe: false, // key "jvn" (3)
	}),
	mr({
		lemma: 'झवाझवी',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['zavazavi', 'jhavajhavi', 'zavajhavi', 'zavazav'],
		variants: ['झवाझव'],
		skeletonSafe: false, // key "jvjv" collapses to "jv" (2)
	}),
	mr({
		lemma: 'येडझव्या',
		severity: 3,
		categories: ['sexual', 'ableist'],
		romanizations: ['yedzavya', 'yedjhavya', 'yadzavya', 'edzavya'],
		variants: ['येडझव', 'येडझवी'],
	}),
	mr({
		lemma: 'लवड्या',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['lavdya', 'lawdya', 'lavadya', 'lavdyachya'],
		variants: ['लवडा', 'लवड्याच्या'],
		// लवकर "soon" is the everyday word Marathi readers will worry about; it
		// does not share a pattern, but the allowlist records that it was checked.
		allowlist: ['lavkar', 'लवकर'],
		skeletonSafe: false, // key "lvd" (3)
	}),
	mr({
		lemma: 'भाडखाऊ',
		severity: 3,
		categories: ['sexual', 'general'],
		romanizations: ['bhadkhau', 'bhadkhav', 'bhadkhaun'],
		variants: ['भाडखाव'],
		skeletonSafe: false, // key "bdk" (3)
	}),
	mr({
		lemma: 'चुत्या',
		severity: 3, // matches the hi pack's चूतिया — a different lemma string,
		categories: ['sexual', 'general'], // so the engine takes the max anyway
		// The Marathi spelling of hi's चूतिया — different lemma string, so the
		// engine compares severities rather than deduping. Carries the shared
		// Latin spellings as well as the Marathi vocative plurals, because this
		// pack is self-sufficient.
		romanizations: [
			'chutya',
			'chutiya',
			'chutia',
			'chutiye',
			'chutyano',
			'chutyanno',
			'chutyagiri',
		],
		variants: ['चुत्ये', 'चुत्यांनो', 'चुत्यागिरी'],
		skeletonSafe: false, // key "kt" (2) — as in hi
	}),

	mr({
		lemma: 'बोच्या',
		severity: 2,
		categories: ['sexual'],
		// REVIEW: crude rather than abusive in some registers — severity 2
		// assumes the insult reading. 'bocha' deliberately excluded: बोचणे
		// "to prick" is an ordinary verb with forms one letter away.
		romanizations: ['bochya', 'bochyat', 'bochyavar'],
		variants: ['बोच्यात', 'बोच्यावर'],
		skeletonSafe: false, // key "bk" (2)
	}),
	mr({
		lemma: 'कुत्र्या',
		severity: 2,
		categories: ['general'],
		// The Marathi vocative; the neutral noun कुत्रा "dog" is a different
		// token and is not matched.
		romanizations: ['kutrya', 'kutrichya', 'kutryachya'],
		variants: ['कुत्रीच्या', 'कुत्र्याच्या'],
		allowlist: ['kutra', 'कुत्रा', 'कुत्री'],
		casualUse: true,
		skeletonSafe: false, // key "ktr" (3)
	}),
	mr({
		lemma: 'हलकट',
		severity: 2,
		categories: ['general'],
		romanizations: ['halkat', 'halkata', 'halkatpana', 'halkatgiri'],
		variants: ['हलकटपणा', 'हलकटगिरी'],
		skeletonSafe: false, // key "hlkt" == skeleton("hellcat") / skeleton("helictite")
	}),
	mr({
		lemma: 'आयचा घो',
		severity: 2,
		categories: ['sexual', 'general'],
		// REVIEW: the classic Marathi expletive, but its everyday use is closer
		// to "damn" than to abuse — hence casualUse and severity 2. Confirm it
		// clears the "genuinely offensive, not merely rude" bar at all.
		romanizations: ['aaycha gho', 'ayacha gho', 'aicha gho', 'maycha gho'],
		variants: ['मायचा घो', 'आयचा घोव'],
		casualUse: true,
	}),
];

export const marathi: LanguagePack = {
	language: 'mr',
	name: 'Marathi + romanized',
	entries,
	allowlist: [
		// Marathi words and proper nouns this pack must never touch.
		'गांडूळ', // "earthworm" — गांडूळ खत is vermicompost
		'गांडूळ खत',
		'gandul',
		'gandul khat',
		'कुत्रा', // the neutral noun; only the vocative कुत्र्या is matched
		'लवकर', // "soon"
		'भाड्याने', // "on rent"
		'bhadyane',
		'मंग्या', // the nickname for Mangesh — why मांग्या is native-only
		'मंगेश',
		'mangesh',
		// Community names. Only the abusive vocatives are matched.
		'महार',
		'महार समाज',
		'महाराष्ट्र',
		'mahar',
		'mahar regiment',
		'maharashtra',
		'मांग',
		'मातंग',
		'matang',
		'चांभार',
		'चांभार समाज',
		'chambhar',
		// English words whose skeletons reach a Marathi key.
		'chamber', // skeleton "kmbr" == chambharya
		'chambers',
		'chamber of commerce',
		'catamaran', // skeleton "ktmr(n)" == chutmarya
		'catamarans',
		'kitemark',
		// The Hindi-side allowlist, repeated because `data/mr` may be
		// loaded on its own.
		'gandhi',
		'uganda',
		'gandalf',
	],
};
