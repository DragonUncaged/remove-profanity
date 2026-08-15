/**
 * Telugu language pack (native script + romanized "Tenglish").
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults — NOT shipped, per the
 *       word-list policy in docs/language-packs.md.
 *
 * Telugu is Dravidian like Tamil, and the two packs share a shape, but the
 * decisions underneath are not the same:
 *
 * 1. **No degemination expander.** `ta.ts` generates a half-geminate spelling
 *    for every lemma (சக்கிலி → சகிலி) because casual Tamil really is typed
 *    that way. Telugu is not: the anusvara carries most of what Tamil writes
 *    with a doubled consonant, and the geminates that remain (మొడ్డ, గుద్ద)
 *    degeminate onto shapes with no readership. The expander is deliberately
 *    absent rather than copied.
 * 2. **The anusvara is a fold, not dictionary data.** Telugu writes homorganic
 *    nasals with ం, so ముణ్డ and ముండ reach the same key through
 *    `INDIC_SCRIPTS` — see src/unicode/indic-scripts.ts. Tamil has no such
 *    rule, which is why its pack lists more native variants than this one.
 * 3. **Agglutination is handled the same way**, with `matchMode: 'prefix'`
 *    on the stems that carry the most suffixes (లంజ-, దెంగు-). Prefix mode is
 *    a loaded gun: both prefix entries here carry an allowlist naming a real
 *    word they would otherwise swallow, and test/telugu-prefix.test.ts proves
 *    both halves.
 *
 * Deliberately EXCLUDED, and why:
 *   - రండి — Hindi रंडी is a severe slur, but the identical Telugu string is
 *     the ordinary imperative "come (pl.)". Never listed, in either script.
 *   - సన్యాసి / సన్నాసి — used as "wretch", but it is the word for a
 *     renunciant. Religious identity beats one insult (policy rule 1).
 *   - వేశ్య — the formal word for a sex worker, used in news copy and
 *     legislation. లంజ below is the abusive term and is what this pack
 *     catches.
 *   - ordinary insults with no real bite: గాడిద (donkey), కుక్క (dog),
 *     పంది (pig), దద్దమ్మ (dolt), చెత్త (garbage) — the Telugu equivalents
 *     of the merely-rude junk the Hindi pack drops.
 *   - polysemous words whose innocent sense dominates: దొంగ (thief), బొక్క
 *     (hole / bone), కుమ్ము (to pile up), తొక్క (peel), పిచ్చి (mad — also
 *     everyday praise, "పిచ్చ బాగుంది").
 *   - severity-1 coarse words as a class, matching the Hindi and Tamil bar.
 *
 * Romanizations dropped on purpose (each is a false-positive machine):
 *   'munda'   the Munda community and language family — same call ta.ts made
 *   'gudda'   गुड्डा, a North Indian given-name diminutive
 *   'chandala' the descriptive Sanskrit varna term used in academic writing
 *   'shudra'   likewise — and as of 2026-08-14 the whole శూద్రుడు lemma is
 *              gone with it, on the caste-term decision: a varna is
 *              a category written about, not an epithet aimed at a person
 *   'edava'    Edava is a village in Kerala, and Malayalam ഇടവ "middle"
 *   'moda'     too short, and a Spanish/Italian everyday word
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function te(entry: Omit<LemmaEntry, 'language' | 'script'> & { script?: string }): LemmaEntry {
	return { language: 'te', script: 'Telu', ...entry };
}

const entries: LemmaEntry[] = [
	te({
		lemma: 'లంజ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// The commonest Telugu vulgarity, and the base of a large compound
		// family (లంజకొడుకు, లంజముండ, లంజలాడి) that prefix mode covers without
		// listing each one.
		romanizations: ['lanja'],
		matchMode: 'prefix',
		// REVIEW: Lanja is also a taluka town in Ratnagiri district,
		// Maharashtra. Its name is only ever written bare, so a phrase
		// allowlist catches the contexts it actually appears in — but a lone
		// "Lanja" in a dateline will false-positive. Drop the romanization
		// instead? That would give up most of the pack's real-world recall.
		// 'lanjam' is the everyday Telugu word for a bribe (లంచం), which
		// prefix mode swallows whole — an audit false positive, not a
		// dictionary one, because the English sweep cannot see Telugu.
		allowlist: [
			'lanja taluka',
			'lanja ratnagiri',
			'lanja maharashtra',
			'lanja town',
			'lanjam',
		],
		skeletonSafe: false, // key "lnj" (3)
	}),
	te({
		lemma: 'దెంగు',
		severity: 4,
		categories: ['sexual'],
		// The verb, so the suffix family is unbounded: దెంగుతా, దెంగుడు,
		// దెంగులాట, denginav, dengutha. Prefix mode is the only sane option.
		romanizations: ['dengu', 'denga', 'dengi', 'dengey'],
		variants: ['దెంగ', 'దెంగి', 'దెంగా'],
		matchMode: 'prefix',
		// The trap that makes this entry dangerous: "dengue" literally starts
		// with the surface form 'dengu'.
		// 'dengue' was allowlisted; the spelling Telugu speakers actually type
		// for the fever is 'dengu', which IS the surface form. The disease
		// contexts are allowlisted as phrases — the bare stem stays matched.
		allowlist: [
			'dengue',
			'dengue fever',
			'dengue virus',
			'dengue cases',
			'dengu jwaram',
			'dengu jwara',
			'dengu fever',
			'dengu virus',
			'dengu cases',
		],
		skeletonSafe: false, // key "dng" (3), and skeleton("dengue") is "dng" too
	}),
	te({
		lemma: 'పూకు',
		severity: 4,
		categories: ['sexual'],
		// Word mode, not prefix: the productive forms are few enough to list,
		// and 'pooku' as a prefix reaches into Malayalam പൂ- vocabulary.
		romanizations: ['pooku', 'pookulo', 'pookuloki', 'pookuni', 'pookumoham'],
		variants: ['పూకులో', 'పూకులోకి', 'పూకుని', 'పూకుమొహం'],
		skeletonSafe: false, // key "pk" (2)
	}),
	te({
		lemma: 'కొజ్జా',
		severity: 4,
		categories: ['slur', 'gendered'],
		// Anti-trans slur. The respectful terms (హిజ్రా, ట్రాన్స్‌జెండర్,
		// ట్రాన్స్ మహిళ) must never appear in a list like this, and do not.
		romanizations: ['kojja', 'kojjaa', 'kojjodu'],
		skeletonSafe: false, // key "kj" (2)
	}),
	te({
		lemma: 'తురక',
		severity: 4,
		categories: ['religious', 'slur'],
		// The Telugu counterpart of Tamil துலுக்கன் — a slur for Muslims.
		// REVIEW: Turaka is also attested as a Telugu surname. Ship anyway,
		// as the Tamil pack does for துலுக்கன், or restrict to the -ఓడు forms?
		romanizations: ['turaka', 'thuraka', 'turakodu', 'turakalu'],
		variants: ['తురకోడు', 'తురకలు'],
		skeletonSafe: false, // key "trk" (3)
	}),

	// Caste slurs. Telugu caste abuse is a live category and the reason
	// the `casteist` tag exists. In every entry the community name itself
	// (మాల, మాదిగ, పంచమ) is NOT matched — only the -ఓడు / -ుడు abusive
	// derivations — and the neutral names are allowlisted pack-wide.
	te({
		lemma: 'చండాలుడు',
		severity: 4,
		categories: ['casteist', 'slur'],
		// Only the personal -ుడు form. చండాలం on its own is everyday Telugu
		// for "awful" ("చండాలంగా ఉంది") and must not be reachable from here,
		// which is why this entry is word mode and 'chandala' is not listed.
		romanizations: ['chandaludu', 'chandalodu', 'chandaludi'],
		variants: ['చండాలోడు'],
		// Dictionary sweep: key "kndld" also reaches candleholder, condyloid
		// and cicindelid. Exact tier only.
		skeletonSafe: false,
		allowlist: ['chandala', 'chandalam', 'chandalika', 'chandala varna'],
	}),
	te({
		lemma: 'మాదిగోడు',
		severity: 4,
		categories: ['casteist', 'slur'],
		// REVIEW: is -ఓడు the right abusive derivation to ship? Bare మాదిగ is
		// the community's own name (Madiga Reservation Porata Samithi uses it
		// as self-description) and is allowlisted, never matched.
		romanizations: ['madigodu', 'maadigodu', 'madigodi'],
		allowlist: ['madiga', 'madiga community', 'madiga dandora', 'mrps'],
	}),
	te({
		lemma: 'మాలోడు',
		severity: 4,
		categories: ['casteist', 'slur'],
		// REVIEW: same question as మాదిగోడు. మాల is the community name and is
		// allowlisted; only the -ఓడు form is matched.
		romanizations: ['malodu', 'maalodu', 'malodi'],
		allowlist: ['mala', 'mala community', 'mala mahanadu'],
		skeletonSafe: false, // key "mld" (3)
	}),
	te({
		lemma: 'పంచముడు',
		severity: 4,
		categories: ['casteist', 'slur'],
		// The Telugu counterpart of Tamil பஞ்சமன், shipped at the same
		// severity. "panchama" also appears descriptively in historical
		// writing about the varna system, so only the -ుడు form is listed.
		romanizations: ['panchamudu', 'panchamudi'],
		allowlist: ['panchami', 'panchamrutham', 'panchamritam', 'panchamukhi'],
	}),

	te({
		lemma: 'మొడ్డ',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['modda', 'moddalu', 'moddaki', 'moddani', 'moddagadu'],
		variants: ['మొడ్డలు', 'మొడ్డని', 'మొడ్డగాడు'],
		skeletonSafe: false, // key "md" (2)
	}),
	te({
		lemma: 'గుద్ద',
		severity: 3,
		categories: ['sexual'],
		// Native script only. 'gudda' is indistinguishable from गुड्डा, a
		// common North Indian given-name diminutive — the same call ta.ts
		// made for தோட்டி, where the Latin spelling is the ambiguous half.
		variants: ['గుద్దలో', 'గుద్దని', 'గుద్దలోకి'],
	}),
	te({
		lemma: 'ముండ',
		severity: 3,
		categories: ['gendered', 'slur'],
		// Native script only: 'munda' is the Munda community and the Munda
		// language family. ta.ts dropped the same romanization for the same
		// reason.
		variants: ['ముండా', 'ముండలు', 'ముండాకొడుకు', 'ముసలిముండ'],
	}),
	// శూద్రుడు (śūdra) and తక్కువ కులం ("low caste") were REMOVED on the
	// caste-term decision (2026-08-14): both are categories written
	// about rather than epithets aimed at a person. చండాలుడు, మాదిగోడు,
	// మాలోడు and పంచముడు are epithets and all stay. See the
	// epithet-versus-category test in docs/language-packs.md.
	//
	// శూద్రుడు was also the cause of the "she shuddered at the thought"
	// false positive: skeleton("shudrudu") == skeleton("shuddered") == "sdrd".
	// Removing the lemma removes the key with it.
	te({
		lemma: 'ఆత్మహత్య చేసుకో',
		severity: 3,
		categories: ['violence'],
		romanizations: ['aatmahatya chesuko', 'atmahatya chesuko', 'uresuko'],
		variants: ['ఆత్మహత్యచేసుకో', 'ఉరేసుకో'],
		// Dictionary sweep: 'uresuko' keys to "ursk", which is the whole
		// uroscopy / ursicide family. The two-word forms never entered the
		// skeleton index anyway (phrases are skipped), so this costs nothing.
		skeletonSafe: false,
	}),

	te({
		lemma: 'వెధవ',
		severity: 2,
		categories: ['general'],
		// REVIEW: "wretch / scoundrel" — very common, and possibly closer to
		// coarse than offensive. Severity 2 or below the bar?
		// 'edava' deliberately excluded (Edava is a Kerala village, and
		// Malayalam ഇടവ); the distinctive 'yedava' spelling is kept.
		romanizations: ['vedhava', 'vedava', 'yedava', 'vedhavaa'],
		variants: ['ఎదవ', 'వెధవా'],
		skeletonSafe: false, // key "vdv" (3)
	}),
	te({
		lemma: 'రంకుమొగుడు',
		severity: 2,
		categories: ['sexual', 'general'],
		romanizations: ['rankumogudu', 'ranku mogudu'],
		variants: ['రంకు మొగుడు'],
	}),
	te({
		lemma: 'గాడిదకొడుకు',
		severity: 2,
		categories: ['general'],
		// The compound, never bare గాడిద "donkey" — which is ordinary Telugu.
		romanizations: ['gadidakoduku', 'gadida koduku', 'gaadida koduku'],
		variants: ['గాడిద కొడుకు'],
	}),
	te({
		lemma: 'పీనుగు',
		severity: 2,
		categories: ['general'],
		// REVIEW: "corpse", used as an insult ("పీనుగా"). Coarse rather than
		// offensive? It sits right on the severity-2 line.
		romanizations: ['peenugu', 'pinugu', 'peenuga'],
		casualUse: true,
		skeletonSafe: false, // key "png" (3)
	}),
	te({
		lemma: 'దొబ్బెయ్',
		severity: 2,
		categories: ['general'],
		// REVIEW: vulgar dismissal ("get lost"). Severity 2 or below the bar?
		romanizations: ['dobbey', 'dobbeyyi'],
		variants: ['దొబ్బెయ్యి'],
		skeletonSafe: false, // key "db" (2)
	}),
];

export const telugu: LanguagePack = {
	language: 'te',
	name: 'Telugu + Tenglish',
	entries,
	allowlist: [
		// Telugu and Indian words a prefix entry or a fold would swallow.
		'dengue', // "dengue" starts with the దెంగు prefix
		'dengue fever',
		'dengue virus',
		'lanja taluka', // the Ratnagiri town
		'lanja ratnagiri',
		'chandalam', // "awful", everyday Telugu
		'chandala',
		'chandalika',
		// Community names. Neutral usage must never be censored; only the
		// abusive -ఓడు / -ుడు derivations above are matched.
		'mala',
		'mala mahanadu',
		'madiga',
		'madiga dandora',
		'mrps',
		'dalit',
		'panchami',
		'panchamrutham',
		'panchamukhi',
		// Religious vocabulary this pack must never reach. సన్యాసి is not
		// listed as a lemma at all; these are belt-and-braces.
		'sanyasi',
		'sannyasi',
	],
};
