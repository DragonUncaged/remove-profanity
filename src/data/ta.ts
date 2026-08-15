/**
 * Tamil language pack (native script + romanized "Tanglish").
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * Three things make Tamil different from the Hindi pack, and they drive every
 * design decision in this file (the full write-up is docs/language-packs.md):
 *
 * 1. **Agglutination.** Tamil glues case and postposition suffixes onto
 *    stems: புண்டை → புண்டைக்கு / புண்டையில / புண்டைய. Listing every
 *    inflection is hopeless, so the worst offenders use
 *    `matchMode: 'prefix'`. Prefix mode is a loaded gun — every prefix entry
 *    below carries an allowlist and a test in test/tamil-prefix.test.ts
 *    proving it does not swallow innocent words.
 * 2. **Romanization dominates.** Most Tamil profanity online is typed on an
 *    English keyboard, so `romanizations` matter more than the lemma. They
 *    also collide with English and with Indian proper nouns far more than
 *    Hinglish does — several obvious romanizations are DELIBERATELY absent
 *    (see the exclusion notes on individual entries).
 * 3. **Doubled consonants.** Casual Tamil drops half of a geminate
 *    (சக்கிலி → சகிலி). That variation is generated here, on the dictionary
 *    side (`degeminate` below), NOT in the normalizer: a fold would
 *    degeminate every innocent Tamil word too, and Tamil gemination is
 *    phonemic (படம் "picture" vs பட்டம் "title").
 *
 * Deliberately EXCLUDED (not profanity, or hopelessly collision-prone):
 *   - ordinary insults with no real bite: முட்டாள் (fool), கழுதை (donkey),
 *     பன்றி (pig), கஞ்சன் (miser), ரௌடி (rowdy) — the Tamil equivalents of
 *     the merely-rude junk words the Hindi pack drops.
 *   - polysemous words whose innocent sense dominates: சரக்கு (goods /
 *     liquor), கஞ்சா (cannabis), சூது (gambling), தோடி (a raga).
 *   - terms whose spelling collides with a religious identity, a given name,
 *     a community name, or a common word in another language, where the
 *     collision cannot be allowlisted away. Precision wins over recall:
 *       அலி    a trans slur, but also exactly how the given name Ali is
 *              written, in Tamil and in Latin.
 *       சுன்னி  "penis", but also exactly how the Sunni sect is written — in
 *              Tamil script as well as Latin, so native-script-only does not
 *              rescue it either. Wrongly censoring a religious identity term
 *              is a worse failure than missing one vulgarity.
 *       pool   the English word (the lemma பூல் ships native-script + 'poolu').
 *     (திருநங்கை, the respectful term for a trans woman, must never appear in
 *     a list like this.)
 *   - severity-1 coarse words, matching the Hindi pack's bar: மூஞ்சி ("mug",
 *     for someone's face) and சனியன் ("jinx") are informal, not offensive.
 *
 * Known limitations, kept deliberately:
 *   - "otha"/"potta" are short romanizations with plausible non-Tamil
 *     readings; they are matched word-only, never as prefixes.
 *   - பூல் ships WITHOUT the romanization "pool" — native script + 'poolu'.
 *   - "paraiyar" / "pallar" / "panchama" are community names as well as the
 *     root of the slur forms listed here; only the slur forms are matched.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

const PULLI = '்'; // TAMIL SIGN VIRAMA

/**
 * Native-script degemination: C + pulli + C → C (சக்கிலி → சகிலி). This is
 * the "doubled consonant" spelling variation, generated per-lemma instead of
 * folded globally.
 *
 * The exclusion set is the whole point — degeminating these produces a REAL
 * Tamil word, so the generated variant would be a false-positive machine:
 *   சூத்து → சூது   "gambling / deceit"
 *   ஓத்தா  → ஓதா    inflection of ஓது "to recite"
 *   தோட்டி → தோடி   the raga Todi / an ear ornament
 *   பொறம்போக்கு → பொறம்போகு  ≈ poramboke, the land classification
 *   கூத்தி → கூதி   a different lemma in this same pack
 */
const DEGEMINATE_EXCLUDE = new Set([
	'சூது',
	'ஓதா',
	'தோடி',
	'பொறம்போகு',
	'பொரம்போகு', // the ர-spelling of the same land term
	'கூதி',
]);

function degeminate(word: string): string | null {
	let out = '';
	let i = 0;
	let changed = false;
	while (i < word.length) {
		if (
			i + 2 < word.length &&
			word[i + 1] === PULLI &&
			word[i + 2] === word[i]
		) {
			i += 2; // drop the first consonant and its pulli
			changed = true;
			continue;
		}
		out += word[i];
		i += 1;
	}
	return changed && !DEGEMINATE_EXCLUDE.has(out) ? out : null;
}

function ta(entry: Omit<LemmaEntry, 'language' | 'script'> & { script?: string }): LemmaEntry {
	return { language: 'ta', script: 'Taml', ...entry };
}

/**
 * Add the degeminated spelling of each native-script surface as a variant,
 * with global dedupe so no surface form is ever listed twice in the pack.
 */
function expandPack(list: LemmaEntry[]): LemmaEntry[] {
	const seen = new Set<string>();
	for (const e of list) {
		seen.add(e.lemma);
		for (const v of e.variants ?? []) seen.add(v);
		for (const r of e.romanizations ?? []) seen.add(r);
	}
	return list.map((e) => {
		const extra: string[] = [];
		for (const surface of [e.lemma, ...(e.variants ?? [])]) {
			if (/\s/.test(surface)) continue;
			const d = degeminate(surface);
			if (d === null || seen.has(d)) continue;
			seen.add(d);
			extra.push(d);
		}
		if (extra.length === 0) return e;
		return { ...e, variants: [...(e.variants ?? []), ...extra] };
	});
}

const entries: LemmaEntry[] = [
	ta({
		lemma: 'புண்டை',
		severity: 4,
		categories: ['sexual'],
		// 'punda' is a 5-char prefix pattern; the Indian proper nouns it would
		// otherwise swallow are allowlisted below.
		romanizations: ['pundai', 'poondai', 'punda', 'poonda', 'pundei'],
		variants: ['புண்ட', 'புண்டா'],
		matchMode: 'prefix',
		// புண்டரீகம் "lotus" (and the name புண்டரீகன்) starts with the native
		// prefix புண்ட — the classic prefix-mode trap.
		allowlist: [
			'pundalik',
			'pundarika',
			'pundarik',
			'pundari',
			'புண்டரீகம்',
			'புண்டரீகன்',
		],
		skeletonSafe: false, // key "pnd" (3)
	}),
	ta({
		lemma: 'கூதி',
		severity: 4,
		categories: ['sexual'],
		// 'kuthi' is kept despite குதிரை "horse" starting with it — the
		// allowlist handles that, and 'kuthi' is too common a spelling to drop.
		romanizations: ['koothi', 'kuthi', 'kooththi'],
		// கூத்தி (whore) is a distinct lemma folded in here as a variant: it
		// shares every romanization, so a separate entry would only produce
		// duplicate surface forms.
		variants: ['கூத்தி'],
		matchMode: 'prefix',
		// குதிரை "horse" starts with the romanized prefix 'kuthi', and கூதிர்
		// "the cold season" starts with the native prefix கூதி.
		allowlist: [
			'kuthirai',
			'kudhirai',
			'kuthiraivali',
			'koothu',
			'therukoothu',
			'கூதிர்',
			'கூதிர்காலம்',
			'குதிரை',
		],
		skeletonSafe: false, // key "kt" (2)
	}),
	ta({
		lemma: 'தேவடியா',
		severity: 4,
		categories: ['gendered', 'sexual'],
		romanizations: [
			'thevidiya',
			'thevadiya',
			'thevudiya',
			'thevdiya',
			'devadiya',
			'thevidiyaa',
		],
		variants: ['தேவிடியா', 'தேவுடியா'],
		matchMode: 'prefix',
		// தேவரடியாள் / devadasi is the (non-abusive) etymological source.
		allowlist: ['devadasi', 'devaradiyar', 'devadiyar', 'thevaram'],
		skeletonSafe: false, // key "tvd" (3)
	}),
	ta({
		lemma: 'தாயோலி',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['thayoli', 'thaayoli', 'tayoli', 'thayolli'],
		variants: ['தாயோளி'],
		skeletonSafe: false, // key "tl" (2)
	}),
	ta({
		lemma: 'ஓத்தா',
		severity: 4,
		categories: ['sexual'],
		// Reviewed, kept as built: 'otha' is only four characters and has
		// plausible non-Tamil readings, but the term is genuinely severe.
		// Word-mode only, never a prefix; the collision risk is accepted.
		romanizations: ['otha', 'oththa', 'ootha', 'oththaa'],
		skeletonSafe: false, // key "ot" (2)
	}),
	ta({
		lemma: 'வேசி',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// வேஷி is the grantha spelling; indicFold already unifies ஷ→ச, so it
		// is listed only for documentation of the pair.
		romanizations: ['vesi', 'vesai', 'veshi', 'veshai', 'vaesi'],
		variants: ['வேசை'],
		skeletonSafe: false, // key "vs" (2)
	}),

	// Caste slurs. Tamil caste abuse is a live, serious category; the
	// `casteist` tag exists for exactly this. In every case the community
	// name itself (Paraiyar, Pallar, Arunthathiyar) is NOT matched — only
	// the -an/-i abusive forms.
	ta({
		lemma: 'பறையன்',
		severity: 4,
		categories: ['casteist', 'slur'],
		// 'parayan' dropped when the ml pack landed: it is spelled exactly
		// like Malayalam പറയാൻ "to say", one of the commonest verbs in that
		// language, and Manglish is typed in the same Latin script this list
		// is. Policy rule 1: a collision with a common word in another
		// language that cannot be allowlisted away, since an allow entry for
		// the bare token would disable the spelling just as completely. The
		// primary 'paraiyan' spelling and 'paraian' are unaffected.
		romanizations: ['paraiyan', 'paraian'],
		variants: ['பறையச்சி'],
		// பறை is a traditional drum and parai attam a living art form; the
		// community name and the English derivative "pariah" are not slurs here.
		allowlist: ['parai', 'parai attam', 'paraiattam', 'paraiyar', 'pariah', 'thappattam'],
		skeletonSafe: false, // key "prn" (3)
	}),
	ta({
		lemma: 'பள்ளன்',
		severity: 4,
		categories: ['casteist', 'slur'],
		// Reviewed, shipped as built. 'pallan' is also a (rare) surname, and
		// Pallar/Devendrakula Vellalar is a community name used neutrally —
		// so only the abusive -an form is matched and the community name is
		// allowlisted. The Latin spelling stays: caste abuse online is
		// overwhelmingly typed in Latin, so dropping it would miss most cases.
		romanizations: ['pallan'],
		allowlist: ['pallar', 'devendrakula', 'pallavaram', 'pallavan'],
		skeletonSafe: false, // key "pln" (3)
	}),
	ta({
		lemma: 'சக்கிலியன்',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['chakkiliyan', 'chakkili', 'sakkiliyan', 'sakkili', 'chakiliyan'],
		variants: ['சக்கிலி'],
		skeletonSafe: false, // keys "kln" (3) and "skln" == skeleton("sicilian")
	}),
	ta({
		lemma: 'பஞ்சமன்',
		severity: 4,
		categories: ['casteist', 'slur'],
		// Reviewed, shipped as built at severity 4. "panchama" also appears
		// descriptively in historical and academic writing about the varna
		// system; only the abusive forms are listed and panchami /
		// panchamirtham are allowlisted.
		romanizations: ['panchaman', 'panchamar', 'panjaman'],
		allowlist: ['panchami', 'panchamirtham', 'panchamritham'],
		skeletonSafe: false, // key "pnkmn" collides with the surname "Pinkman"
	}),
	ta({
		lemma: 'துலுக்கன்',
		severity: 4,
		categories: ['religious', 'slur'],
		romanizations: ['thulukkan', 'thulukan', 'tulukan', 'thulukka'],
		skeletonSafe: false, // key "tlkn" collides with "talkin"
	}),

	ta({
		lemma: 'பூல்',
		severity: 3,
		categories: ['sexual'],
		// 'pool' deliberately excluded (English word). 'poolu' only.
		romanizations: ['poolu'],
		skeletonSafe: false, // key "pl" (2)
	}),
	ta({
		lemma: 'சூத்து',
		severity: 3,
		categories: ['sexual'],
		// 'suthu' deliberately excluded: சுத்து "to go around / roam" is an
		// extremely common everyday word with the same romanization.
		romanizations: ['soothu', 'sootthu'],
		matchMode: 'prefix',
		allowlist: ['soothiram', 'soothsayer', 'soothing'],
		skeletonSafe: false, // key "st" (2)
	}),
	ta({
		lemma: 'ஊம்பு',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['oombu', 'oomba', 'umbu', 'oombhu'],
		variants: ['ஊம்ப', 'ஊம்புற'],
		skeletonSafe: false, // key "omb" (3)
	}),
	ta({
		lemma: 'பொட்டை',
		severity: 3,
		categories: ['slur', 'gendered'],
		// Reviewed, kept as built: severity 3 assumes the anti-effeminate slur
		// reading, which dominates. 'potta' is short — word mode only.
		romanizations: ['pottai', 'potta', 'pottaiya'],
		skeletonSafe: false, // key "pt" (2)
	}),
	ta({
		lemma: 'முண்டை',
		severity: 3,
		categories: ['gendered', 'slur'],
		// 'munda' deliberately excluded — Munda is an Adivasi community and a
		// language family.
		romanizations: ['mundai', 'mundaye', 'moondai'],
		skeletonSafe: false, // key "mnd" (3)
	}),
	// கீழ்ஜாதி ("low caste") and சூத்திரன் (śūdra, a varna in classical
	// scripture) were REMOVED on the caste-term decision
	// (2026-08-14). Both are categories written about — by journalists,
	// historians and anti-caste activists — rather than epithets aimed at a
	// person, and blocking them censors the discourse about caste
	// discrimination. பறையன், பள்ளன், சக்கிலியன், பஞ்சமன் and தோட்டி are
	// epithets and all stay. See the epithet-versus-category test in
	// docs/language-packs.md.
	ta({
		lemma: 'தோட்டி',
		severity: 3,
		categories: ['casteist', 'slur'],
		// Reviewed, shipped as built. Caste slur for manual scavengers, with
		// NO romanizations — 'thotti' is identical to தொட்டி "water tank",
		// one of the commonest Tamil nouns. Native script only, where the
		// vowel signs disambiguate: native-only beats dropping the lemma when
		// the Latin spelling is the ambiguous part.
	}),
	ta({
		lemma: 'தற்கொலை பண்ணிக்கோ',
		severity: 3,
		categories: ['violence'],
		romanizations: ['tharkolai pannikko', 'tharkolai panniko'],
	}),

	ta({
		lemma: 'மயிர்',
		severity: 2,
		categories: ['sexual', 'general'],
		// Also the ordinary word for "hair" — hence casualUse. Prefix mode
		// covers மயிரு / மயிரே / மயிராண்டி.
		romanizations: ['mayir', 'mayiru', 'mayire', 'mayirandi', 'mayiraandi'],
		variants: ['மயிரு', 'மயிரே', 'மயிராண்டி'],
		matchMode: 'prefix',
		allowlist: ['mayiladuthurai', 'mayilai'],
		casualUse: true,
		skeletonSafe: false, // key "mr" (2)
	}),
	ta({
		lemma: 'பொறம்போக்கு',
		severity: 2,
		categories: ['general'],
		romanizations: ['porambokku', 'poramboku', 'porambokk'],
		variants: ['பொரம்போக்கு'],
		// poramboke is a land classification (and a well-known protest song);
		// its skeleton key is identical, hence skeletonSafe:false as well.
		allowlist: ['poramboke', 'poramboke land', 'chennai poramboke'],
		skeletonSafe: false, // key "prmbk" == skeleton("poramboke")
	}),
	ta({
		lemma: 'பொறுக்கி',
		severity: 2,
		categories: ['general'],
		romanizations: ['porukki', 'poruki', 'porukkis'],
		skeletonSafe: false, // key "prk" (3)
	}),
	ta({
		lemma: 'கஸ்மாலம்',
		severity: 2,
		categories: ['general'],
		// Grantha ஸ folds to ச, so கச்மாலம் matches this too.
		romanizations: ['kasmalam', 'kasmaalam', 'kazhmalam'],
	}),
	ta({
		lemma: 'பன்னாடை',
		severity: 2,
		categories: ['general'],
		romanizations: ['pannadai', 'pannada'],
		skeletonSafe: false, // key "pnd" (3)
	}),
	ta({
		lemma: 'கழிசடை',
		severity: 2,
		categories: ['general'],
		romanizations: ['kazhisadai', 'kalisadai', 'kazhisada'],
		variants: ['களிசடை'],
		// Sweep: key "klsd" is one of the densest shapes in English — 83
		// dictionary families reach it, including closed, classed, clashed,
		// claused, calloused, callused, cellulosed and coleseed. No allowlist
		// can close that, and four of them are everyday prose.
		skeletonSafe: false,
	}),
	ta({
		lemma: 'அயோக்கியன்',
		severity: 2,
		categories: ['general'],
		romanizations: ['ayokkiyan', 'ayokiyan', 'ayogyan'],
		skeletonSafe: false, // key "akn" (3)
	}),
	ta({
		lemma: 'நாறி',
		severity: 2,
		categories: ['general'],
		// 'nari' deliberately excluded: நரி "fox", and a common given name.
		romanizations: ['naari', 'naaringa'],
		skeletonSafe: false, // key "nr" (2)
	}),

	ta({
		lemma: 'நாய்',
		severity: 1,
		categories: ['general'],
		// 'nai' / 'nay' deliberately excluded — far too short and collides
		// with ordinary English and Japanese romanization.
		romanizations: ['naaye', 'naaya', 'nayee'],
		casualUse: true,
		skeletonSafe: false, // key "n" (1)
	}),
	ta({
		lemma: 'லூசு',
		severity: 1,
		categories: ['ableist', 'general'],
		// 'loose' deliberately excluded (English word).
		romanizations: ['loosu', 'lusu'],
		casualUse: true,
		skeletonSafe: false, // key "ls" (2)
	}),
	ta({
		lemma: 'கூமுட்டை',
		severity: 1,
		categories: ['general'],
		romanizations: ['koomuttai', 'koomutai', 'kumutai'],
		skeletonSafe: false, // key "kmt" (3)
	}),
	ta({
		lemma: 'கேணப்பயல்',
		severity: 1,
		categories: ['general'],
		romanizations: ['kenappayal', 'kenapayal', 'kena payale'],
		// Sweep: key "knpl" reaches cineplasty, kineplasty, kinoplasm,
		// conoplain, conplane and the cyanoplatin- family — and, because the
		// skeleton drops the hyphen, every compound of the same shape:
		// "chain-pull", "can-polishing". A hyphen family is open-ended.
		skeletonSafe: false,
	}),
	ta({
		lemma: 'அரைவேக்காடு',
		severity: 1,
		categories: ['general'],
		romanizations: ['araivekkadu', 'araivekadu'],
	}),
	ta({
		lemma: 'தண்டச்சோறு',
		severity: 1,
		categories: ['general'],
		romanizations: ['thandachoru', 'thandasoru', 'thanda choru'],
	}),
];

export const tamil: LanguagePack = {
	language: 'ta',
	name: 'Tamil + Tanglish',
	entries: expandPack(entries),
	allowlist: [
		// Tamil words and proper nouns that a prefix entry would swallow.
		'kuthirai', // குதிரை "horse" — starts with the 'kuthi' prefix
		'kudhirai',
		'kuthiraivali',
		'koothu', // கூத்து, the folk theatre form
		'therukoothu',
		'koothu pattarai',
		'kuthu paattu',
		'devadasi',
		'devaradiyar',
		'poramboke',
		'poramboke land',
		'parai', // பறை, the drum — and the art form built on it
		'parai attam',
		'paraiattam',
		'thappattam',
		'soothiram', // சூத்திரம் "formula / sutra"
		'mayiladuthurai',
		'mayilai',
		// Indian proper nouns and place names.
		'pundalik',
		'pundarika',
		'pundarik',
		'pallavaram',
		'pallavan',
		'pallar',
		'devendrakula',
		'paraiyar',
		'pariah',
		'panchami',
		'panchamirtham',
		'thevaram',
		'thevar',
		'ottapidaram',
		'ottanchatram',
		'thottiyam',
		// English words whose spelling or skeleton reaches a Tamil key.
		'soothsayer',
		'soothing',
		'soothe',
		'stern',
		'talkin',
		'pinkman',
	],
};
