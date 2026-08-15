/**
 * Gujarati language pack (native script + romanized).
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * Gujarati sits closer to Hindi than Tamil or Punjabi do — same Indo-Aryan
 * stock, same conjunct-writing abugida, and a large shared Perso-Arabic
 * vocabulary — and this pack follows the same self-sufficiency rule as pa:
 * the shared Latin spellings are repeated here rather than deferred to hi,
 * so that `import { gujarati } from 'remove-profanity/data/gu'` on its own
 * gives full coverage. See the pa.ts header for the full reasoning; in
 * short, Gujarati lemma strings differ from Devanagari ones, so nothing is
 * lost to the duplicate-lemma discard in `collectExact`, and every borrowed
 * romanization brought its hi allowlist entries with it (gandhi/uganda for
 * 'gand', chutney for 'chut', the candlestick phrases for 'harami', Lund
 * University for 'lund').
 *
 * `expandInflections` in hi.ts silently generates several Gujarati-looking
 * forms — chutiyo, hijdo, bhadvo, kamino, lavdo are all hi's as well as
 * this pack's. That is now expected overlap rather than a collision.
 *
 * What is genuinely Gujarati, and unreachable from any other pack:
 *   - the masculine -ો / feminine -ી / plural -ા gender endings, which make
 *     ચૂતિયો / લવડો / ભડવો / લુચ્ચો distinct surfaces from their Hindi -ा forms;
 *   - છિનાળ, ઢેડ, વાઘરી, બાયલો, હલકટ, રખડેલ, ઝવવું — none of which the hi
 *     pack has in any spelling;
 *   - ભોસડીના, the Gujarati genitive of a word Hindi writes ભોસડીકે.
 *
 * Gender/number variants are listed by hand rather than generated. Gujarati
 * -ો/-ી/-ા alternation is regular enough to tempt an expander, but the pack
 * only has a handful of gendered lemmas and a generator would invent forms
 * nobody writes.
 *
 * No entry uses `matchMode: 'prefix'`: Gujarati marks case with free-standing
 * postpositions (નો / ને / થી), so the token boundary is a real boundary.
 *
 * Deliberately EXCLUDED (not profanity, or hopelessly collision-prone):
 *   - ordinary insults with no real bite: ડોબો (buffalo/dolt), ગધેડો
 *     (donkey), મૂરખ (fool), ડફોળ (dimwit), બદમાશ (rascal), મવાલી (hooligan).
 *   - ગાંડો "mad / crazy": an ableist reading exists, but the word is
 *     ordinary everyday Gujarati for "crazy" in a way the Hindi equivalents
 *     are not, and severity-1 coarse words are out per policy rule 3.
 *   - romanizations that cannot be disambiguated. Note these are spellings
 *     hi DROPPED, not spellings hi owns — self-sufficiency does not mean
 *     resurrecting them:
 *       salo    hi excludes it on purpose (Slavic *salo*); so does this pack,
 *               along with 'sale' and 'salon'.
 *       bailo   "બાયલો", but also Spanish *bailo*; 'baylo' and 'bayalo' only.
 *       lavado  Spanish/Portuguese for "washed".
 *       gando   see above; the lemma is not in the pack at all.
 *       rand / hijra / kamini / lauda — all dropped by hi for reasons that
 *               apply here unchanged.
 *   - severity-1 coarse words, matching the Hindi pack's bar.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function gu(entry: Omit<LemmaEntry, 'language' | 'script'>): LemmaEntry {
	return { language: 'gu', script: 'Gujr', ...entry };
}

const entries: LemmaEntry[] = [
	gu({
		lemma: 'ભોસડીના',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The Gujarati genitive form. Hindi writes भोसड़ीके; -ના is Gujarati
		// and none of these spellings is in the hi pack.
		romanizations: ['bhosdina', 'bhosadina', 'bhosdi na', 'bhosdino'],
		variants: ['ભોંસડીના', 'ભોસડી', 'ભોસડીનો', 'ભોસડીવાળો'],
		// Sweep-sourced, key "bsdn": 'besodden' is the one English word that
		// reaches it ("the cloth was besodden").
		allowlist: ['besodden', 'besoddens'],
	}),
	gu({
		lemma: 'છિનાળ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// "Adulteress / whore" — a strong Gujarati gendered slur with no Hindi
		// pack equivalent.
		// 'chhinali' is absent. The original reason no longer holds: it was
		// dropped because kn's 'chinali' allow phrase (the Chinali people of
		// Himachal Pradesh) reached it through the repeat-collapsed pass, and
		// that pass now gates allow spans on a real letter-stretch exactly as
		// it gates candidates, so the surface would detect. Re-adding it is a
		// Gujarati question rather than an engine one — gu never needed the
		// double-h spelling, and the -al forms below cover the word — so it
		// stays out until a speaker asks for it. or ships 'chhinali'.
		romanizations: ['chhinal', 'chinal', 'chhinaal'],
		variants: ['છિનાળી', 'છીનાળ'],
		skeletonSafe: false, // key "knl" (3)
	}),
	gu({
		lemma: 'રાંડનો દીકરો',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// "Son of a whore" — the phrase form, which is how it is actually
		// written. The bare રાંડ is a separate, lower-severity entry below.
		romanizations: ['randno dikro', 'randna dikra', 'rand no dikro'],
		variants: ['રાંડના દીકરા', 'રાંડનો છોકરો'],
	}),
	gu({
		lemma: 'માદરચોદ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// Shared with Hindi in both scripts; the Latin family is repeated from
		// hi so that data/gu alone is sufficient.
		romanizations: [
			'madarchod',
			'madar chod',
			'maderchod',
			'madharchod',
			'madarchood',
			'madrchod',
			'madarchut',
			'madarchoot',
		],
		variants: ['માદર ચોદ', 'મા ચોદ'],
	}),
	gu({
		lemma: 'બહેનચોદ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// Key "bnkd" keeps this in the skeleton tier — the same key and the
		// same three allowlisted English words as hi's बहनचोद.
		romanizations: ['bhenchod', 'behenchod', 'bhenchood', 'bhen chod'],
		variants: ['બેનચોદ', 'બહેન ચોદ'],
		// The last four came from the repaired sweep; the hand-written three
		// missed "bounced", "benched" and "bunched", which are ordinary prose.
		// 'boonked' is the same key again, previously covered only by the
		// collapsed pass folding it onto 'bonked' — see hi's बहनचोद.
		allowlist: [
			'banked',
			'bunked',
			'bonked',
			'boonked',
			'bounced',
			'benched',
			'bunched',
			'bunkoed',
			'beancod',
			'beancods',
			'beinked',
		],
	}),
	gu({
		lemma: 'રંડી',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Known limitation carried over from hi: "Randi" is also a Western
		// given name, deliberately not allowlisted.
		romanizations: ['randi', 'rendi'],
		variants: ['રંડીબાજ'],
		skeletonSafe: false, // key "rnd" (3)
	}),

	// Caste slurs. Gujarat's caste vocabulary is its own: ઢેડ and વાઘરી do
	// not appear in the Hindi pack in any spelling, and both are used as
	// abuse far more often online than as neutral description. Community
	// self-names are allowlisted, never matched (policy rule 2).
	gu({
		lemma: 'ઢેડ',
		severity: 4,
		categories: ['casteist', 'slur'],
		// THE Gujarati caste slur, aimed at the Vankar/Meghwal communities.
		// REVIEW: 'dhed' is only four characters and the -a/-o/-h tails make
		// five near-identical patterns. Nothing in English collides, but it is
		// the shortest Latin spelling either of these two packs ships.
		romanizations: ['dhed', 'dheda', 'dhedo', 'dhedh', 'dhediyo'],
		variants: ['ઢેડા', 'ઢેડિયો'],
		allowlist: ['vankar', 'meghwal', 'meghwar', 'rohit community'],
		skeletonSafe: false, // key "d" (1)
	}),
	gu({
		lemma: 'વાઘરી',
		severity: 4,
		categories: ['casteist', 'slur'],
		// REVIEW: used as caste abuse against the Devipujak community, but
		// Vaghri IS that community's older name and still appears descriptively
		// in Gujarati writing about them. Unlike ઢેડ there is no separate
		// abusive form to isolate, so this is the closest this pack comes to
		// the policy-rule-1 line. Ranked first in the flagged list.
		romanizations: ['vaghri', 'vagri', 'vaghari'],
		variants: ['વાઘરણ', 'વાઘરા'],
		allowlist: ['devipujak', 'vaghri samaj', 'vaghari samaj'],
		skeletonSafe: false, // key "vgr" (3)
	}),
	gu({
		lemma: 'ચમાર',
		severity: 4,
		categories: ['casteist', 'slur'],
		// The regiment allowlist is repeated so a gu-only consumer keeps that
		// protection.
		romanizations: ['chamar'],
		allowlist: ['chamar regiment', 'rohit community'],
		skeletonSafe: false, // key "kmr" (3)
	}),
	gu({
		lemma: 'ભંગી',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['bhangi'],
		allowlist: ['valmiki samaj', 'balmiki samaj'],
		skeletonSafe: false, // key "bng" (3)
	}),

	gu({
		lemma: 'લવડો',
		severity: 3,
		categories: ['sexual'],
		// 'lavdo' is the Gujarati masculine and 'lavda' the shared Hindi form;
		// both ship. 'lavado' stays out — it is Spanish/Portuguese for
		// "washed". લંડ brings the shared 'lund' spelling and hi's Lund
		// University allowlist with it.
		romanizations: ['lavdo', 'lavda', 'lawda', 'loda', 'laude', 'lodu', 'lund'],
		variants: ['લવડા', 'લોડો', 'લંડ'],
		// 'cum laude' for the same reason as the Lund phrases, and found the
		// same way: 'laude' is the Latin honorific, and this pack alone
		// flagged "summa cum laude". See hi's लौड़ा.
		allowlist: [
			'lund university',
			'lunds',
			'lund sweden',
			'lund, sweden',
			'cum laude',
			'magna cum laude',
			'summa cum laude',
		],
		skeletonSafe: false, // keys "lvd" / "ld" / "lnd" (≤3)
	}),
	gu({
		lemma: 'કૂતરી',
		severity: 3,
		categories: ['gendered'],
		// The Gujarati word for a bitch; the hi pack has कुतिया / kutti, not
		// this stem.
		romanizations: ['kutri', 'kootri', 'kutrini'],
		variants: ['કુતરી', 'કૂતરીના'],
		skeletonSafe: false, // key "ktr" (3)
	}),
	gu({
		lemma: 'ઝવવું',
		severity: 3,
		categories: ['sexual'],
		// REVIEW: the vulgar Gujarati verb "to fuck". Severity 3 assumes it
		// sits with चोद rather than with the severity-4 compounds; a native
		// speaker should confirm the register.
		romanizations: ['jhavvu', 'jhavine', 'jhavvanu'],
		variants: ['ઝવીને', 'ઝવાય'],
		skeletonSafe: false, // key "jv" (2)
	}),
	gu({
		lemma: 'ભડવો',
		severity: 3,
		categories: ['sexual', 'gendered'],
		romanizations: ['bhadvo', 'bhadwa', 'bhadva', 'bharwa', 'bharva', 'bhadua'],
		variants: ['ભડવા', 'ભડવી'],
		skeletonSafe: false, // keys "bdv" / "brv" (3)
	}),
	gu({
		lemma: 'હિજડો',
		severity: 3,
		categories: ['slur', 'gendered'],
		// Also a community self-identifier; severity reflects slur usage.
		// 'hijra' is deliberately NOT listed — the standard English spelling
		// of the Islamic Hijra and the community's own neutral term.
		romanizations: ['hijdo', 'hijda', 'hijraa', 'hizra'],
		variants: ['હિજડા', 'હીજડો'],
		skeletonSafe: false, // keys "hjd" / "hjr" (3)
	}),
	gu({
		lemma: 'ચૂત',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chut', 'choot'],
		variants: ['ચૂતડી'],
		allowlist: ['chutney', 'chutki', 'chutkule'],
		skeletonSafe: false, // key "kt" (2)
	}),
	gu({
		lemma: 'ચૂતિયો',
		severity: 3,
		categories: ['sexual', 'general'],
		romanizations: ['chutiyo', 'chutiya', 'chutia', 'chutya', 'chutiye'],
		variants: ['ચૂતિયા', 'ચુતિયો'],
		skeletonSafe: false, // key "kt" (2)
	}),
	gu({
		lemma: 'ગાંડ',
		severity: 3,
		categories: ['sexual'],
		// ગાંડુ is deliberately NOT listed: with the short ુ it is one
		// keystroke from ગાંડું "crazy / mad", which is ordinary Gujarati.
		// Only the long-ū ગાંડૂ spelling is matched. The Latin family covers
		// both ગાંડ and ગાંડૂ, which hi splits into two entries at the same
		// severity.
		romanizations: ['gaand', 'gand', 'gandu', 'gaandu', 'gandoo', 'ganduu'],
		variants: ['ગાંડૂ'],
		allowlist: ['gandhi', 'uganda', 'gandalf', 'propaganda'],
		skeletonSafe: false, // key "gnd" (3) — also collides with gandhi
	}),
	gu({
		lemma: 'રાંડ',
		severity: 3,
		categories: ['gendered'],
		// 'rand' stays excluded for hi's reasons — rand(), Rand Corp, the ZAR.
		romanizations: ['raand'],
		variants: ['રાંડું'],
		skeletonSafe: false, // key "rnd" (3)
	}),
	gu({
		lemma: 'આપઘાત કરી લે',
		severity: 3,
		categories: ['violence'],
		romanizations: ['aapghat kari le', 'apghat kari le', 'aapghat kar'],
		variants: ['આપઘાત કર'],
	}),

	gu({
		lemma: 'લુચ્ચો',
		severity: 2,
		categories: ['sexual', 'general'],
		// "Lecher / rogue". The pa pack has the -ਾ form; these -o/-i spellings
		// are Gujarati and distinct from it.
		// 'luchchi' belongs to the pa pack (ਲੁੱਚੀ) and is not repeated here.
		romanizations: ['luchcho', 'luchho'],
		variants: ['લુચ્ચી', 'લુચ્ચા', 'લુચો'],
		skeletonSafe: false, // key "lk" (2)
	}),
	gu({
		lemma: 'બાયલો',
		severity: 2,
		categories: ['gendered', 'slur'],
		// "Effeminate / unmanly" — a gendered insult, not a neutral word.
		// 'bailo' deliberately excluded (Spanish).
		romanizations: ['baylo', 'bayalo', 'bayla'],
		variants: ['બાયલા', 'બાયલી'],
		skeletonSafe: false, // key "bl" (2)
	}),
	gu({
		lemma: 'હલકટ',
		severity: 2,
		categories: ['general'],
		// REVIEW: severity 2 assumes "vile / contemptible" rather than merely
		// "cheap". Same question for રખડેલ below. If either reads as merely
		// coarse, policy rule 3 says drop it.
		// "Vile / low" — a genuine insult in Gujarati, distinct from the
		// merely-rude vocabulary excluded above.
		romanizations: ['halkat', 'halkatt', 'halkatno'],
		variants: ['હલકટા'],
		skeletonSafe: false, // key "hlkt" == skeleton("hellcat")
	}),
	gu({
		lemma: 'રખડેલ',
		severity: 2,
		categories: ['gendered', 'general'],
		// "Vagrant", used of women to mean "loose".
		romanizations: ['rakhdel', 'rakhdal', 'rakhdela'],
		variants: ['રખડેલી'],
		skeletonSafe: false, // key "rkdl" — "Rockdale", and the -del tail is common
	}),
	gu({
		lemma: 'હરામી',
		severity: 2,
		categories: ['general'],
		// "Harami" is also a candlestick pattern in trading — hence the
		// allowlist phrases, copied from hi along with the spelling.
		// હરામજાદો is deliberately NOT a variant: hi rates हरामज़ादा a 3, and
		// listing it here would ship it at 2.
		romanizations: ['harami', 'haraami', 'haramkhor', 'haraamkhor'],
		variants: ['હરામખોર'],
		allowlist: ['bullish harami', 'bearish harami', 'harami candlestick'],
		casualUse: true,
		skeletonSafe: false, // key "hrm" (3)
	}),
	gu({
		lemma: 'કમીનો',
		severity: 2,
		categories: ['general'],
		// 'kamini' excluded — common female given name. Same call as hi.
		romanizations: ['kamino', 'kamina', 'kameena', 'kaminey', 'kaminay'],
		variants: ['કમીના', 'કમીની'],
		casualUse: true,
		skeletonSafe: false, // key "kmn" (3)
	}),
	gu({
		lemma: 'સાળો',
		severity: 2,
		categories: ['general'],
		// Literally "brother-in-law" — hence casualUse. 'salo' stays excluded
		// (Slavic *salo*), as do 'sale' and 'salon'; hi dropped all three on
		// purpose and self-sufficiency does not mean reopening them.
		romanizations: ['saala', 'sala', 'saale', 'saaley'],
		variants: ['સાળા', 'સાળી'],
		casualUse: true,
		skeletonSafe: false, // key "sl" (2)
	}),
];

export const gujarati: LanguagePack = {
	language: 'gu',
	name: 'Gujarati',
	entries,
	allowlist: [
		// Allowlist phrases that came with the romanizations borrowed from
		// the hi pack. Without these a gu-ONLY matcher would censor
		// Gandhi, chutney and Lund University, which hi handles fine.
		'gandhi',
		'uganda',
		'gandalf',
		'propaganda',
		'chutney',
		'chutki',
		'chutkule',
		'lund university',
		'lunds',
		'lund sweden',
		'lund, sweden',
		'bullish harami',
		'bearish harami',
		'harami candlestick',
		'banked',
		'bunked',
		'bonked',
		'motorcade',
		'motorcades',
		'matricide',
		'matricides',
		'matricidal',
		// Community names and caste vocabulary used neutrally.
		'vankar',
		'meghwal',
		'meghwar',
		'rohit community',
		'devipujak',
		'vaghri samaj',
		'vaghari samaj',
		'valmiki samaj',
		'balmiki samaj',
		'chamar regiment',
		// English words and names whose spelling or skeleton reaches a
		// Gujarati key. "hellcat" is the reason હલકટ leaves the skeleton
		// tier; these cover the exact/collapsed tiers as well.
		'hellcat',
		'hellcats',
		'halkett',
		'rockdale',
	],
};
