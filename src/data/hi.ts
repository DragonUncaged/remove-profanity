/**
 * Hindi + Hinglish language pack.
 *
 * Curated for quality over quantity. Every entry here is a genuinely
 * profane / abusive lemma with an honest severity on the shared rubric:
 *
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * Deliberately EXCLUDED from the source list (not profanity, or hopelessly
 * collision-prone in ordinary speech):
 *   - objectifying-but-common nouns used as "junk" filler: item, maal, pataka,
 *     pig, paagal/pagal, ullu, bandar, gadha, joota, chamcha, nibba/nibbi,
 *     dhakkan, bhikari, kanjoos, murkh, darpok, kayar, ghatiya, awaara, etc.
 *   - ordinary words with legitimate primary meanings: dalal (broker/surname),
 *     launda/laundiya (colloquial boy/girl), goo/gu ("goo" in English),
 *     mut/moot ("moot point"), soar, sale, laura/lora (Western given names),
 *     chhod/छोड़ ("leave" — NOT the profanity chod), mutthi ("fist"),
 *     peshab/hastmaithun (clinical), besharam-adjacent duplicates.
 *   - threat-phrases too generic to list ("dekh lunga", "mar ja", "aukat").
 *
 * Known limitations, kept deliberately (documented, not allowlisted):
 *   - "randi" is a Western given name (Randi); we still match it — the
 *     profane reading dominates in Indian text. Known false-positive source.
 *   - "chutia" IS matched: it is a common profanity spelling. (It is also the
 *     name of an Assamese community; per spec we keep it matched.)
 *   - "kutiya" also means "hut" (कुटिया with ट); the romanization collides.
 *   - "chakka"/"chhakka" also means a cricket six — flagged casualUse.
 *
 * Deliberately included (severity-4 identity slurs an India-first
 * moderation filter cannot omit): चमार and भंगी used as caste slurs (both
 * are also community self-identifiers — matching them is a
 * moderation-context decision), and कटुआ (anti-Muslim slur).
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

/**
 * Hindi noun/vocative morphology expander. skeletonSafe:false lemmas are
 * matched exact-only, so their romanizations must cover the inflection
 * family: -a nouns take -e/-o/-on (chutiya → chutiye/chutiyo/chutiyon),
 * -i nouns take -yon/-yan, -u nouns take -on/-a/-s, consonant stems take
 * -o/-e/-u/-on/-ne (chod → chodo/chodne). Generated forms are exact-tier
 * patterns, so the false-positive risk is only real-word collisions —
 * excluded below.
 */
const INFLECTION_EXCLUDE = new Set([
	'chute', // parachute/laundry chute
	'chuto',
	'lode', // mother lode
	'khusro', // Amir Khusro
	'khusrau',
	'launde', // colloquial "boys" — deliberately unmatched
	'laundo',
	'laundon',
	'laundu',
	'laundne',
	'sale', // English word (from sala)
	'salon', // English word (from sala + -on)
	'salo',
	'dalle', // dictionary headword — "dalle de verre" (slab glass), from dalla
]);

function expandInflections(roms: readonly string[]): string[] {
	const out = new Set(roms);
	for (const r of roms) {
		if (/\s/.test(r)) continue;
		const stem = r.slice(0, -1);
		const last = r[r.length - 1];
		const forms: string[] = [];
		if (last === 'a') for (const sfx of ['e', 'o', 'on']) forms.push(stem + sfx);
		else if (last === 'i') for (const sfx of ['yon', 'yan']) forms.push(r + sfx);
		else if (last === 'u') for (const sfx of ['on', 'a', 's']) forms.push(r + sfx);
		else for (const sfx of ['o', 'e', 'u', 'on', 'ne']) forms.push(r + sfx);
		for (const f of forms) if (!INFLECTION_EXCLUDE.has(f)) out.add(f);
	}
	return [...out];
}

function hi(entry: Omit<LemmaEntry, 'language'>): LemmaEntry {
	return { language: 'hi', ...entry };
}

function expandPack(list: LemmaEntry[]): LemmaEntry[] {
	const seen = new Set<string>();
	for (const e of list) {
		seen.add(e.lemma);
		for (const v of e.variants ?? []) seen.add(v);
		for (const r of e.romanizations ?? []) seen.add(r);
	}
	return list.map((e) => {
		if (!e.romanizations) return e;
		const expanded: string[] = [...e.romanizations];
		for (const f of expandInflections(e.romanizations)) {
			if (seen.has(f)) continue;
			seen.add(f);
			expanded.push(f);
		}
		return { ...e, romanizations: expanded };
	});
}

const entries: LemmaEntry[] = [
	hi({
		lemma: 'मादरचोद',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: [
			'madarchod',
			'madar chod',
			'maderchod',
			'madharchod',
			'madarchood',
			'madrchod',
			'motherchod',
			'madarchut',
			'madarchoot',
		],
		variants: ['मादर चोद', 'मदरचोद', 'मादरचूड'],
	}),
	hi({
		lemma: 'बहनचोद',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// behenchod/bahanchod/bhainchod etc. are intentionally NOT listed as
		// exact romanizations: the skeleton tier (key "bnkd") catches the whole
		// vowel-shifted family, and the acceptance suite asserts they surface
		// at tier 'skeleton'.
		romanizations: ['bhenchod', 'bhenchood', 'behen chod', 'bhen chod', 'bhnchd'],
		variants: ['भैनचोद', 'भेनचोड', 'बहेनचोद'],
		// Sweep-sourced: every English word the dictionary and its regular
		// inflections put on key "bnkd". 'banked'/'bunked'/'bonked' were
		// already carried pack-wide; the repaired sweep added the rest, three
		// of which are ordinary prose ("the ball bounced", "he benched it").
		// 'boonked' was covered only by accident until the collapsed pass
		// stopped harvesting allow spans without a stretch: it is a doubled
		// vowel away from 'bonked', and the repeat-collapsing pass used to
		// fold it onto that phrase for free. Enumerated now, like the rest.
		allowlist: [
			'beancod',
			'beancods',
			'beinked',
			'benched',
			'boonked',
			'bounced',
			'bunched',
			'bunkoed',
		],
	}),
	hi({
		lemma: 'भोसड़ीके',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: [
			'bhosdike',
			'bhosdi ke',
			'bhosadike',
			'bhoshdike',
			'bhosarike',
			'bhosdiwala',
			'bhosdiwale',
			'bhosadi',
			'bhonsdike',
		],
		variants: ['भोसडीके', 'भोस्डिके', 'भोसड़ी के', 'भोसड़ी वाले'],
		// Sweep-sourced, keys "bsdk" / "bsdn": the dictionary's whole
		// be-/basi- family. 'besodden' is the one an ordinary sentence can
		// contain ("the cloth was besodden").
		allowlist: [
			'besodden',
			'beshriek',
			'beshrieks',
			'beshrieked',
			'beshrieking',
			'basiarachnitis',
			'basiarachnoiditis',
		],
	}),
	hi({
		lemma: 'भोसड़ा',
		script: 'Deva',
		severity: 4,
		categories: ['sexual'],
		romanizations: ['bhosda', 'bhosada', 'bhosra', 'bhosad'],
		variants: ['भोसड़ी'],
		skeletonSafe: false, // key "bsd" (3)
	}),
	hi({
		lemma: 'रंडी',
		script: 'Deva',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Known limitation: "Randi" is a Western given name; no allowlist —
		// in Indian text the slur reading dominates (see file header).
		romanizations: ['randi', 'rendi'],
		skeletonSafe: false, // key "rnd" (3)
	}),
	hi({
		lemma: 'माचोद',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['maachod', 'maa chod', 'ma chod'],
		variants: ['माँ चोद'],
		skeletonSafe: false, // key "mkd" (3)
	}),
	hi({
		lemma: 'तेरी माँ की चूत',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['teri maa ki chut', 'teri ma ki chut'],
	}),
	hi({
		lemma: 'चूत मारीके',
		script: 'Deva',
		severity: 4,
		categories: ['sexual'],
		romanizations: ['chutmarike'],
		allowlist: ['catamarcan', 'catamarcans'], // sweep: key "ktmrk"
	}),
	hi({
		lemma: 'बहन के लोड़े',
		script: 'Deva',
		severity: 4,
		categories: ['sexual', 'gendered'],
		romanizations: ['behen ke lode', 'bhen ke lode', 'behen ke laude', 'bhenkelode'],
		// Sweep: key "bnkld" from 'bhenkelode'.
		allowlist: ['bunkload', 'bunkloads', 'binnacled', 'binocled'],
	}),
	// Caste slurs (curated additions; see file header). Both words are also
	// legitimate community names — severity reflects slur usage.
	hi({
		lemma: 'चमार',
		script: 'Deva',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['chamar'],
		allowlist: ['chamar regiment'], // Indian Army regiment — proper noun
		skeletonSafe: false, // key "kmr" (3)
	}),
	hi({
		lemma: 'भंगी',
		script: 'Deva',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['bhangi'],
		skeletonSafe: false, // key "bng" (3)
	}),
	hi({
		lemma: 'कटुआ',
		script: 'Deva',
		severity: 4,
		categories: ['religious', 'slur'],
		romanizations: ['katua'],
		skeletonSafe: false, // key "kt" (2)
	}),

	hi({
		lemma: 'चूत',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chut', 'choot'],
		allowlist: ['chutney', 'chutki', 'chutkule'],
		skeletonSafe: false, // key "kt" (2)
	}),
	hi({
		lemma: 'चूतिया',
		script: 'Deva',
		severity: 3,
		categories: ['sexual', 'general'],
		romanizations: ['chutiya', 'chutia', 'chutya', 'chutiyaa', 'chutiye', 'chootiya', 'chootya', 'chuteya', 'choothiya', 'chuutiya'],
		variants: ['चूतिये', 'चुतिया'],
		// 'chutia' stays matched — it is a common profanity spelling. The
		// Chutia (Sutiya) kingdom of Assam and its people are real, so the
		// historical contexts are allowlisted as phrases, exactly as
		// 'chamar regiment' is. The bare word is not allowlisted.
		allowlist: [
			'chutia kingdom',
			'chutia dynasty',
			'chutia king',
			'chutia kings',
			'chutia people',
			'chutia community',
			'sadiya chutia',
		],
		skeletonSafe: false, // key "kt" (2) — collides with kutta/chutney-tier keys
	}),
	hi({
		lemma: 'गांडू',
		script: 'Deva',
		severity: 3,
		categories: ['sexual', 'gendered'],
		romanizations: ['gandu', 'gaandu', 'gandoo', 'ganduu', 'gaanduu'],
		variants: ['गांडु'],
		skeletonSafe: false, // key "gnd" (3) — also collides with gandhi
	}),
	hi({
		lemma: 'गांड',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['gaand', 'gand'],
		allowlist: ['gandhi', 'uganda', 'gandalf'],
		variants: ['गंड', 'गांद'],
		skeletonSafe: false, // key "gnd" (3)
	}),
	hi({
		lemma: 'लंड',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['lund', 'laund'],
		allowlist: ['lund university', 'lunds', 'lund sweden', 'lund, sweden'],
		skeletonSafe: false, // key "lnd" (3)
	}),
	hi({
		lemma: 'लौड़ा',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		// 'laura' and 'lora' (Western names) deliberately excluded.
		// 'lauda' dropped: famous surname (Niki Lauda, Lauda Air).
		romanizations: ['loda', 'lavda', 'lawda', 'laude', 'lodu', 'looda', 'lowda'],
		variants: ['लोड़ा', 'लवड़ा', 'लौड़े'],
		// Self-sufficiency: 'laude' is the Latin honorific too, and this pack
		// alone flagged "she graduated summa cum laude". The en pack carries
		// 'cum laude', which hid it from every all-packs measurement — the one
		// place a pack-wide allowlist was propping up a lemma that was not its
		// own. Fixed here, in the pack that owns the weaker spelling.
		allowlist: ['cum laude', 'magna cum laude', 'summa cum laude'],
		skeletonSafe: false, // key "ld" (2)
	}),
	hi({
		lemma: 'चोद',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		// Ambiguity note: romanized "chod" is also how many people spell
		// छोड़ (chhod, "leave") — hence casualUse. 'chhod' itself excluded.
		romanizations: ['chod', 'chodd'],
		casualUse: true,
		skeletonSafe: false, // key "kd" (2)
	}),
	hi({
		lemma: 'चोदू',
		script: 'Deva',
		severity: 3,
		categories: ['sexual', 'general'],
		romanizations: ['chodu'],
		skeletonSafe: false, // key "kd" (2)
	}),
	hi({
		lemma: 'चुदाई',
		script: 'Deva',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chudai', 'chudayi'],
		skeletonSafe: false, // key "kd" (2)
	}),
	hi({
		lemma: 'भड़वा',
		script: 'Deva',
		severity: 3,
		categories: ['sexual', 'gendered'],
		romanizations: ['bhadwa', 'bhadva', 'bharwa', 'bharva', 'bhadua'],
		variants: ['भड़वे', 'भरवा'],
		skeletonSafe: false, // key "bdv"/"brv" (3)
	}),
	hi({
		lemma: 'हरामज़ादा',
		script: 'Deva',
		severity: 3,
		categories: ['general'],
		romanizations: ['haramzada', 'haramzade', 'haramjada', 'haram zaada'],
		variants: ['हरामज़ादे', 'हरामजादा'],
	}),
	hi({
		lemma: 'मादरजात',
		script: 'Deva',
		severity: 3,
		categories: ['sexual', 'gendered'],
		romanizations: ['madarjaat', 'madarjaad', 'madarzaat'],
	}),
	hi({
		lemma: 'कुतिया',
		script: 'Deva',
		severity: 3,
		categories: ['gendered'],
		// Romanization collides with कुटिया "hut" — known limitation.
		romanizations: ['kutiya', 'kutti', 'kuttiya'],
		variants: ['कुत्ती'],
		skeletonSafe: false, // key "kt" (2)
	}),
	hi({
		lemma: 'हिजड़ा',
		script: 'Deva',
		severity: 3,
		categories: ['slur', 'gendered'],
		// Also a community self-identifier; severity reflects slur usage.
		// 'hijra' romanization dropped: it is the standard English spelling of
		// the Islamic Hijra and the community's neutral self-identifier.
		romanizations: ['hijda', 'hijraa', 'hizra'],
		skeletonSafe: false, // key "hjr" (3)
	}),
	hi({
		lemma: 'छक्का',
		script: 'Deva',
		severity: 3,
		categories: ['slur', 'gendered'],
		// Also cricket slang for a six — hence casualUse.
		romanizations: ['chakka', 'chakke', 'chhakka'],
		variants: ['छक्के'],
		casualUse: true,
		skeletonSafe: false, // key "k" (1)
	}),
	hi({
		lemma: 'खुसरा',
		script: 'Deva',
		severity: 3,
		categories: ['slur', 'gendered'],
		romanizations: ['khusra'],
		skeletonSafe: false, // key "ksr" (3)
	}),
	hi({
		lemma: 'रंडीबाज़',
		script: 'Deva',
		severity: 3,
		categories: ['gendered', 'sexual'],
		romanizations: ['randibaaz', 'randibaj'],
	}),
	hi({
		lemma: 'रांड',
		script: 'Deva',
		severity: 3,
		categories: ['gendered'],
		// 'rand' romanization deliberately excluded (rand(), Rand Corp, ZAR).
		romanizations: ['raand'],
		skeletonSafe: false, // key "rnd" (3)
	}),
	hi({
		lemma: 'लौंडेबाज़',
		script: 'Deva',
		severity: 3,
		categories: ['slur', 'sexual'],
		romanizations: ['laundebaaz'],
	}),
	hi({
		lemma: 'खुदकुशी कर ले',
		script: 'Deva',
		severity: 3,
		categories: ['violence'],
		romanizations: ['khudkushi kar le'],
	}),

	// Hinglish abbreviations: separate Latn entries so their parents keep
	// skeleton matching while the abbreviations themselves never enter the
	// skeleton tier (spec: skeletonSafe false).
	hi({
		lemma: 'bsdk',
		script: 'Latn',
		severity: 3,
		categories: ['sexual', 'gendered'],
		casualUse: true,
		skeletonSafe: false,
	}),
	hi({
		lemma: 'bkl',
		script: 'Latn',
		severity: 3,
		categories: ['sexual', 'gendered'],
		casualUse: true,
		skeletonSafe: false,
	}),
	hi({
		lemma: 'tmkc',
		script: 'Latn',
		severity: 3,
		categories: ['sexual', 'gendered'],
		casualUse: true,
		skeletonSafe: false,
	}),

	hi({
		lemma: 'हरामी',
		script: 'Deva',
		severity: 2,
		categories: ['general'],
		romanizations: ['harami', 'haraami'],
		casualUse: true,
		skeletonSafe: false, // key "hrm" (3)
	}),
	hi({
		lemma: 'हरामखोर',
		script: 'Deva',
		severity: 2,
		categories: ['general'],
		romanizations: ['haramkhor', 'haraamkhor'],
	}),
	hi({
		lemma: 'कमीना',
		script: 'Deva',
		severity: 2,
		categories: ['general'],
		// 'kamini' excluded — common female given name.
		romanizations: ['kamina', 'kameena', 'kaminey', 'kaminay'],
		variants: ['कमीने', 'कमीनी'],
		casualUse: true,
		skeletonSafe: false, // key "kmn" (3)
	}),
	hi({
		lemma: 'साला',
		script: 'Deva',
		severity: 2,
		categories: ['general'],
		// 'sale' excluded (English word); 'sala' kept despite Romance-language
		// collision — dominant Hinglish spelling.
		romanizations: ['saala', 'sala', 'saale', 'saaley'],
		variants: ['साले'],
		casualUse: true,
		skeletonSafe: false, // key "sl" (2)
	}),
	// कुत्ता / 'kutta' / 'kutte' was REMOVED after the false-positive review,
	// the same call bc, mc, गश्ती and मूठ got: it is the ordinary Hindi word
	// for a dog, so "kutte ko khana do" (give the dog food) was censored for
	// every default consumer. By the epithet-versus-category test it is a
	// category — an animal — not an epithet, and the abusive use is carried
	// by the words it is paired with (कमीने, साले), which the pack still has.
	hi({
		lemma: 'बकचोद',
		script: 'Deva',
		severity: 2,
		categories: ['general', 'sexual'],
		romanizations: ['bakchod', 'bakchodi', 'bakchodd'],
		variants: ['बकचोदी'],
		casualUse: true,
		skeletonSafe: false, // key "bkd" (3)
	}),
	hi({
		lemma: 'चूतियापा',
		script: 'Deva',
		severity: 2,
		categories: ['general', 'sexual'],
		romanizations: ['chutiyapa', 'chutyapa', 'chutiyapanti'],
		variants: ['चूतियापंती'],
		casualUse: true,
		skeletonSafe: false, // key "ktp" (3)
	}),
	hi({
		lemma: 'चुदक्कड़',
		script: 'Deva',
		severity: 2,
		categories: ['sexual'],
		romanizations: ['chudakkad'],
		allowlist: ['caddiced', 'kodaked'], // sweep: key "kdkd"
	}),
	hi({
		lemma: 'झांट',
		script: 'Deva',
		severity: 2,
		categories: ['sexual', 'general'],
		romanizations: ['jhaant', 'jhant', 'jhaat', 'jhantu', 'jhatu'],
		variants: ['झाँट', 'झाटू'],
		skeletonSafe: false, // key "jnt" (3)
	}),
	hi({
		lemma: 'टट्टे',
		script: 'Deva',
		severity: 2,
		categories: ['sexual'],
		romanizations: ['tatte', 'tatta'],
		skeletonSafe: false, // key "t" (1)
	}),
	hi({
		lemma: 'सूअर',
		script: 'Deva',
		severity: 2,
		categories: ['general'],
		// 'soar' and English 'pig' excluded.
		romanizations: ['suar', 'suwar'],
		variants: ['सुअर'],
		skeletonSafe: false, // key "sr" (2)
	}),
	hi({
		lemma: 'नामर्द',
		script: 'Deva',
		severity: 2,
		categories: ['gendered'],
		romanizations: ['namard', 'naamard'],
		// Sweep: key "nmrd" is the Nimrod- family ("a Nimrodian appetite for
		// hunting") plus the naemorhedus / naemorhedine / naemorhedinae
		// genus names. 'nimrod' and 'nimrods' were allowlisted by hand and
		// 'nimrodian' was missed — a proper-noun family is open-ended, so no
		// allowlist can close it. Exact spellings still match.
		skeletonSafe: false,
	}),
	hi({
		lemma: 'दल्ला',
		script: 'Deva',
		severity: 2,
		categories: ['general', 'sexual'],
		// 'dalal'/'dalaal' excluded — legitimate word (broker) and surname.
		romanizations: ['dalla'],
		skeletonSafe: false, // key "dl" (2)
	}),
	hi({
		lemma: 'नीच',
		script: 'Deva',
		severity: 2,
		categories: ['casteist', 'general'],
		// 'nich' excluded (German "nich"/typo of niche).
		romanizations: ['neech'],
		skeletonSafe: false, // key "nk" (2)
	}),

	hi({
		lemma: 'टट्टी',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['tatti'],
		casualUse: true,
		skeletonSafe: false, // key "t" (1)
	}),
	hi({
		lemma: 'बेशर्म',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['besharam', 'besharm'],
		casualUse: true,
	}),
	hi({
		lemma: 'बेवकूफ',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['bewakoof', 'bevakoof', 'bewaqoof'],
		casualUse: true,
	}),
	hi({
		lemma: 'नालायक',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['nalayak'],
		casualUse: true,
		skeletonSafe: false, // key "nlk" (3)
	}),
	hi({
		lemma: 'गंवार',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['gawar', 'ganwar'],
		skeletonSafe: false, // key "gvr" (3)
	}),
	hi({
		lemma: 'चिचोरा',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['chichora'],
		skeletonSafe: false, // key "kr" (2)
	}),
	hi({
		lemma: 'चपरी',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		// Modern classist slang; romanization collides with "capri" via
		// skeleton, hence skeletonSafe false.
		romanizations: ['chapri'],
		skeletonSafe: false, // key "kpr" (3)
	}),
	hi({
		lemma: 'बकलोल',
		script: 'Deva',
		severity: 1,
		categories: ['general'],
		romanizations: ['baklol'],
		casualUse: true,
		skeletonSafe: false, // key "bkl" (3)
	}),
];

export const hindi: LanguagePack = {
	language: 'hi',
	name: 'Hindi + Hinglish',
	entries: expandPack(entries),
	allowlist: [
		'gandhi',
		'chutney',
		'chutki',
		'chutkule',
		'uganda',
		'propaganda',
		'lund university',
		'bal thackeray',
		'sunni muslim',
		// English words whose consonant skeletons collide with Hinglish keys
		// (bnkd, mdrkd, nmrd, ktmrk...). Suppress in the original text.
		'banked',
		'bunked',
		'bonked',
		'motorcade',
		'motorcades',
		'matricide',
		'matricides',
		'matricidal',
		'matriciding',
		'motorcading',
		'nimrod',
		'nimrods',
		'kitemark',
		'kitemarks',
		// Innocent polysemy phrases.
		'gawar phali',
		'gawar ki phali',
		'kutti story',
		'bullish harami',
		'bearish harami',
		'harami candlestick',
	],
};
