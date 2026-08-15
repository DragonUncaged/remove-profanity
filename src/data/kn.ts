/**
 * Kannada language pack (native script + romanized "Kanglish").
 *
 * Severity rubric is the shared one (README); severity-1 coarse words are not
 * shipped, per the word-list policy in docs/language-packs.md.
 *
 * Kannada and Telugu are sister scripts and this pack is deliberately built
 * alongside `te.ts` — but the two word lists barely overlap, and the places
 * where Kannada needed a different answer are noted on the entries:
 *
 * 1. **Compound-only romanizations.** Kannada's strongest abuse is built by
 *    suffixing ಮಗ "son" (ಸೂಳೆಮಗ, ಬೋಳಿಮಗ, ಬಡ್ಡಿಮಗ). That is a gift for
 *    precision: the bare stems collide badly in Latin script (`boli` is the
 *    everyday Hindi word बोली "speech", `sule` is a well-known surname),
 *    while the compounds are unambiguous. Several entries therefore ship the
 *    compound romanizations only, with the bare stem native-script-only.
 * 2. **Prefix mode, twice, both with a real word to defend against.** ಬೋಳಿ-
 *    would otherwise swallow ಬೋಳಿಸು "to shave"; ತುಲ್ಲು sits one letter away
 *    from ತುಳು, the Tulu language and its people. See test/kannada-prefix.ts.
 * 3. **No degemination expander.** Same reasoning as te.ts — the Tamil
 *    half-geminate typing habit does not carry over, and Kannada gemination
 *    is contrastive (ಕಳ್ಳ "thief" vs ಕಳ "steal").
 *
 * Deliberately EXCLUDED, and why:
 *   - ಚಂಡಾಲ — a genuine Kannada insult, but 'chandala' is also the
 *     descriptive Sanskrit varna term used in academic and religious writing,
 *     and Kannada does not build a personal -ಉಡು form the way Telugu does
 *     (te.ts ships చండాలుడు for exactly that reason). Dropped rather than
 *     shipped with a hopeful allowlist.
 *   - ಕೀಳು ಜಾತಿ ("low caste") — shipped until 2026-08-14, removed on the
 *     caste-term decision. It names a category people write about,
 *     not a person, so matching it censored the discourse about caste
 *     discrimination. kn therefore carries no `casteist` entry at all; see
 *     the flagged-review note in docs/language-packs.md.
 *   - ಹೊಲೆಯ / ಮಾದಿಗ / ಚಲುವಾದಿ — community names, used neutrally and as
 *     self-description. They are allowlisted, never matched. Kannada caste
 *     abuse is overwhelmingly "community name + generic abuse", which this
 *     pack catches through the abuse half; see the flagged-review note in
 *     docs/language-packs.md.
 *   - ಮಿಂಡ / ಮಿಂಡಿ — Minda is an Indian auto-components firm and a surname.
 *   - ಬಜಾರಿ — Marathi बाजरी is pearl millet, an everyday word.
 *   - ordinary insults with no bite: ನಾಯಿ (dog), ಕತ್ತೆ (donkey), ಹಂದಿ (pig),
 *     ದಡ್ಡ (dolt), ಮಂಗ (monkey) — matched only inside the ಮಗ compounds.
 *   - ಹುಚ್ಚ "mad" — heavily casual in Kannada and ableist to list at all.
 *
 * Romanizations dropped on purpose:
 *   'boli'   Hindi बोली "speech / dialect / bid"
 *   'sule'   a common Indian surname
 *   'tika'   Hindi टीका (tilak, and a vaccine dose)
 *   'kundi'  Hindi कुंडी "latch", and a surname
 *   'munde'  reaches the Munda community, which ta.ts and te.ts also protect
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function kn(entry: Omit<LemmaEntry, 'language' | 'script'> & { script?: string }): LemmaEntry {
	return { language: 'kn', script: 'Knda', ...entry };
}

const entries: LemmaEntry[] = [
	kn({
		lemma: 'ತುಲ್ಲು',
		severity: 4,
		categories: ['sexual'],
		// 'tulli' is listed alongside 'tullu' because the oblique stem is
		// ತುಲ್ಲಿ- (ತುಲ್ಲಿನ, ತುಲ್ಲಲ್ಲಿ), which the 'tullu' prefix cannot reach.
		// 'tull' would reach both but also reaches "tulle", the fabric.
		// 'tulli' was tried and REMOVED: the dictionary sweep caught it firing
		// on "Tullian" and "tullibee", and Tulli- is an open set of proper
		// nouns (Tullius, Tulliola, Tullahoma), so no allowlist finishes it.
		// The native ತುಲ್ಲ variant still reaches ತುಲ್ಲಿನ / ತುಲ್ಲಲ್ಲಿ.
		romanizations: ['tullu', 'thullu'],
		variants: ['ತುಲ್ಲ'],
		matchMode: 'prefix',
		// ತುಳು / Tulu is a Dravidian language and the people of coastal
		// Karnataka. The native spellings differ (ಳ vs ಲ್ಲ), but the Latin ones
		// are one keystroke apart and the repeat-collapsing pass folds "tullu"
		// toward "tulu" — hence skeletonSafe: false.
		//
		// Bare 'tulu' is deliberately NOT in this allowlist, and that is not an
		// oversight: an allow span for it would cover the whole 'tullu' match
		// through that same collapsing pass and silently disable the entry.
		// "tulu" needs no help — a pattern that changes under repeat-collapsing
		// is excluded from the collapsed index, so 'tullu' can never fire on it.
		allowlist: ['tulunadu', 'tulu nadu', 'tuluva', 'tulu language'],
		skeletonSafe: false, // key "tl" (2), identical to skeleton("tulu")
	}),
	kn({
		lemma: 'ಸೂಳೆ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// 'sule' deliberately excluded — a well-known Indian surname. The
		// compounds are unambiguous and are what actually gets typed.
		romanizations: ['soole', 'soolemaga', 'soole maga', 'soolemagane', 'soolegara'],
		variants: ['ಸೂಳೆಮಗ', 'ಸೂಳೆಮಗನೆ', 'ಸೂಳೆಯ', 'ಸೂಳೆಗಾರ'],
		// Dictionary sweep: keys "slmg" / "slgr" reach the whole sluggard /
		// slugger / salmagundi / sillograph family — 20 English words. By far
		// the worst skeleton collision in these three packs.
		skeletonSafe: false,
	}),
	kn({
		lemma: 'ಬೋಳಿ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// 'boli' deliberately excluded — बोली is one of the commonest words in
		// Hindi. Only the compound romanizations ship, and they are safe as
		// prefixes.
		romanizations: ['bolimaga', 'boli maga', 'bolimagane'],
		matchMode: 'prefix',
		skeletonSafe: false, // dictionary sweep: key "blmg" reaches "bloomage"
		// The native prefix ಬೋಳಿ- opens ಬೋಳಿಸು "to shave" and its whole
		// inflectional family. Allowlist phrases are matched as substrings, so
		// the two stems below cover ಬೋಳಿಸಿದ / ಬೋಳಿಸುವ / ಬೋಳಿಸಿಕೊಂಡ as well.
		allowlist: ['ಬೋಳಿಸು', 'ಬೋಳಿಸಿ', 'bolisu', 'bolisi', 'bolisikondu'],
	}),
	kn({
		lemma: 'ಲೌಡಿ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// 'laudee' overlaps a spelling the hi pack's inflection expander
		// generates from लौड़ा. It ships anyway: a pack must be self-sufficient
		// for a consumer who imports only data/kn, and the matcher reports one
		// match per span regardless of how many packs claim the surface.
		romanizations: ['laudi', 'loudi', 'laudee', 'lavdi'],
		skeletonSafe: false, // key "ld" (2)
	}),
	kn({
		lemma: 'ತುರುಕ',
		severity: 4,
		categories: ['religious', 'slur'],
		// REVIEW: also attested as a surname; same question as the te entry.
		// The Kannada counterpart of Tamil துலுக்கன் and Telugu తురక — a slur
		// for Muslims. ತುರುಕ is the usual Kannada spelling, but 'turaka' is
		// typed too and ships here as well as in te: a kn-only consumer must
		// not lose it to another pack.
		romanizations: ['turuka', 'thuruka', 'turukaru', 'turaka'],
		variants: ['ತುರುಕರು'],
		skeletonSafe: false, // key "trk" (3)
	}),

	kn({
		lemma: 'ಬೇವರ್ಸಿ',
		severity: 3,
		categories: ['general'],
		// "Heirless" (from Urdu be-wārisī) — one of the most common Kannada
		// abuses. Collision-free as a spelling, but not as a skeleton.
		romanizations: ['bevarsi', 'bevarsee', 'bevarasi', 'bevaarsi'],
		skeletonSafe: false, // key "bvrs" == skeleton("beavers")
	}),
	kn({
		lemma: 'ಬಡ್ಡಿಮಗ',
		severity: 3,
		categories: ['general'],
		// Compound only. Bare 'baddi' is Baddi, the Himachal Pradesh industrial
		// town, and बड़ी in Hindi.
		romanizations: ['baddimaga', 'baddi maga', 'baddimagane', 'baddhimaga'],
		variants: ['ಬಡ್ಡಿಮಗನೆ'],
		// The -ಮಗ compounds all key to consonant skeletons that English
		// -m-g- words reach; see ಸೂಳೆ above. Exact tier only, for all of them.
		skeletonSafe: false,
	}),
	kn({
		lemma: 'ಹಾದರಗಿತ್ತಿ',
		severity: 3,
		categories: ['gendered', 'sexual'],
		romanizations: ['hadaragitti', 'haadaragitti', 'hadargitti'],
		skeletonSafe: false, // sweep: key "hdrgt" reaches headright, hydroergotinine
	}),
	kn({
		lemma: 'ಚಿನಾಲಿ',
		severity: 3,
		categories: ['gendered', 'sexual'],
		// 'chinali' deliberately excluded: the Chinali are a real ethnic group
		// in Himachal Pradesh, and the spelling is identical. Caught by the or
		// pack's clean-trap suite, not by inspection — policy rule 1.
		romanizations: ['chinaali', 'chinal'],
		skeletonSafe: false, // key "knl" (3)
	}),
	kn({
		lemma: 'ಮುಂಡೆ',
		severity: 3,
		categories: ['gendered', 'slur'],
		// Bare 'munde' is not shipped because it reaches the Munda community
		// and language family — a policy rule 1 collision, not a deferral to
		// another pack. The ಮಗ compound is unambiguous.
		romanizations: ['mundemaga', 'munde maga', 'mundemagane'],
		variants: ['ಮುಂಡೆಮಗ', 'ಮುಂಡೆಮಗನೆ'],
		skeletonSafe: false, // -ಮಗ compound; see ಸೂಳೆ
	}),
	// ಕೀಳು ಜಾತಿ ("low caste") was REMOVED on the caste-term
	// decision (2026-08-14): it is a category written about, not an epithet
	// thrown at a person, and blocking it censors the discourse about caste
	// discrimination. See the epithet-versus-category test in
	// docs/language-packs.md. The epithets stay.
	kn({
		lemma: 'ಆತ್ಮಹತ್ಯೆ ಮಾಡ್ಕೊ',
		severity: 3,
		categories: ['violence'],
		romanizations: ['aatmahatye madko', 'atmahatye madko', 'aathmahatye maadko'],
		variants: ['ಆತ್ಮಹತ್ಯೆ ಮಾಡ್ಕೊಂಡು ಸಾಯಿ'],
	}),

	kn({
		lemma: 'ಕುಂಡಿ',
		severity: 2,
		categories: ['sexual'],
		// Native script only — 'kundi' is Hindi कुंडी "latch" and a surname.
		variants: ['ಕುಂಡಿಗೆ', 'ಕುಂಡಿಯ'],
	}),
	kn({
		lemma: 'ತಿಕ',
		severity: 2,
		categories: ['sexual'],
		// Native script only — 'tika' is टीका, and 'thika' is one vowel from
		// ठीक. The native vowel signs disambiguate; the Latin ones do not.
		variants: ['ತಿಕದ', 'ತಿಕಕ್ಕೆ'],
	}),
	kn({
		lemma: 'ನಾಯಿಮಗ',
		severity: 2,
		categories: ['general'],
		// The compound, never bare ನಾಯಿ "dog".
		romanizations: ['nayimaga', 'naayimaga', 'nayi maga', 'naayi maga', 'nayimagane'],
		variants: ['ನಾಯಿ ಮಗ', 'ನಾಯಿಮಗನೆ'],
		// Sweep: "nmgn" is nomogenist / nonhomogeneous / nonmagnetic /
		// nonimaginary — nine English words.
		skeletonSafe: false,
	}),
	kn({
		lemma: 'ಕತ್ತೆಮಗ',
		severity: 2,
		categories: ['general'],
		romanizations: ['kattemaga', 'katte maga', 'kattemagane'],
		variants: ['ಕತ್ತೆ ಮಗ'],
		skeletonSafe: false, // sweep: key "ktmg" reaches "kathemoglobin"
	}),
	kn({
		lemma: 'ಕಂತ್ರಿ',
		severity: 2,
		categories: ['general'],
		// REVIEW: "scoundrel". Kantri is also a 2008 Telugu film title, which
		// is the kind of bare-token collision policy rule 1 usually settles by
		// dropping the romanization — but the film is a decade-old one-off.
		romanizations: ['kantri', 'kanthri'],
		skeletonSafe: false, // key "kntr" is one letter from skeleton("country")
	}),
];

export const kannada: LanguagePack = {
	language: 'kn',
	name: 'Kannada + Kanglish',
	entries,
	allowlist: [
		// Kannada words a prefix entry would swallow.
		'ಬೋಳಿಸು', // "to shave" — opens with the ಬೋಳಿ prefix
		'ಬೋಳಿಸಿ',
		'bolisu',
		'bolisi',
		'boli', // Hindi बोली, and why the bare romanization is not shipped
		// Tulu: the language, the region and the people.
		'tulunadu',
		'tulu nadu',
		'tuluva',
		// Community names. Neutral usage is never censored.
		'holeya',
		'holeyaru',
		'madiga',
		'chalavadi',
		'dalit',
		// Ordinary words and proper nouns that reach a Kannada key.
		// This phrase used to reach much further than its own spelling: allow
		// spans were harvested from the repeat-collapsed pass without the
		// stretch gate that pass's candidates require, so it silenced this
		// pack's own 'chinaali' and or's 'chhinali'/'chhinaali', all three of
		// which collapse to exactly 'chinali'. Fixed in matcher.ts; the phrase
		// is unchanged and still protects the spelling it names.
		'chinali', // the Chinali people of Himachal Pradesh
		'chinali people',
		'baddi', // the Himachal town
		'kundapura', // Udupi district
		'tikkanna', // the Telugu poet
		'country',
	],
};
