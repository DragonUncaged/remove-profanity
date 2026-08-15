/**
 * Dead-allowlist guard.
 *
 * A pack-wide allowlist phrase earns its place only if removing it lets
 * something match. Allow spans veto candidates *contained in* the span
 * (`matcher.ts`, `containedIn(c.core ?? c, exactRes.allowSpans)`), so the
 * phrase's own text is the complete probe: if the phrase scans clean with the
 * phrase itself removed, that entry suppresses nothing, anywhere.
 *
 * Inert entries are not free. A pack-wide allow phrase is global once the pack
 * is loaded, so it is a live suppression span for every OTHER pack too — see
 * the note in `src/data/ml.ts` about `parayan`. An entry that protects nothing
 * in its own pack can still disable another pack's lemma.
 *
 * Each pack is measured ALONE, because packs are self-sufficient and a
 * consumer may import one subpath.
 */

import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import type { LanguagePack } from '../src/types.js';
import { english } from '../src/data/en.js';
import { hindi } from '../src/data/hi.js';
import { tamil } from '../src/data/ta.js';
import { bengali } from '../src/data/bn.js';
import { marathi } from '../src/data/mr.js';
import { odia } from '../src/data/or.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { malayalam } from '../src/data/ml.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';

const PACKS: LanguagePack[] = [
	english,
	hindi,
	tamil,
	bengali,
	marathi,
	odia,
	telugu,
	kannada,
	malayalam,
	punjabi,
	gujarati,
];

/**
 * Phrases measured inert on 2026-08-14, kept deliberately. Three reasons
 * recur, and none of them is "it protects the phrase":
 *
 *  1. **Belt-and-braces.** The lemma the phrase was written against was later
 *     given `skeletonSafe: false`, dropped, or shipped native-script-only, so
 *     the collision it guarded no longer exists. The phrase stays as a fence
 *     against re-adding the romanization.
 *  2. **Duplicated at entry level.** The same phrase is already on the
 *     `LemmaEntry.allowlist` that needs it (`lund university` on लंड,
 *     `moby dick` on dick), so the pack-wide copy never fires first.
 *  3. **Never reachable.** Whole-token matching with Unicode-property
 *     boundaries already rejects it — the entire English pack-wide list is
 *     this case, `scunthorpe` included. That is the mechanism working, not
 *     the allowlist.
 *
 * Adding a phrase here should mean writing down which of the three it is.
 * Adding one that is none of them means deleting the phrase instead.
 */
const KNOWN_INERT: Record<string, readonly string[]> = {
	// Reason 3, all sixteen: `cunt` in `Scunthorpe`, `ass` in `class`, `cock`
	// in `hancock` are all sub-token, and no pattern spans a whole token here.
	en: [
		'scunthorpe',
		'shitake',
		'matsushita',
		'class',
		'classic',
		'assassin',
		'bass',
		'grass',
		'pass',
		'cassock',
		'cocktail',
		'hancock',
		'dickens',
		'middlesex',
		'essex',
		'sussex',
	],
	// `gandhi`/`uganda`/`chutney` are reason 1 (गांड and चूत carry
	// `skeletonSafe: false` now); `lund university` is reason 2. The plurals
	// are inert where the singular is live because the extra consonant lands
	// in the skeleton key: `motorcade` collides, `motorcades` does not.
	// `nimrod` joined them when नामर्द took `skeletonSafe: false` on the
	// collision test — the key `nmrd` also reaches "Nimrodian", and a
	// proper-noun family is open-ended, so the tier came off rather than the
	// allowlist growing. Both spellings stay as a fence against re-adding it.
	hi: [
		'gandhi',
		'chutney',
		'chutki',
		'chutkule',
		'uganda',
		'propaganda',
		'lund university',
		'bal thackeray',
		'sunni muslim',
		'motorcades',
		'matricides',
		'nimrod',
		'nimrods',
		'kitemarks',
	],
	// Reason 2 throughout: every prefix-mode lemma (குதி, பூண்டை, சூத்து …)
	// carries its own trap set on the entry, which is where a prefix entry's
	// fence has to live. See `docs/language-packs.md` on closed trap sets.
	ta: [
		'kuthirai',
		'kudhirai',
		'kuthiraivali',
		'koothu',
		'therukoothu',
		'koothu pattarai',
		'kuthu paattu',
		'devadasi',
		'devaradiyar',
		'poramboke',
		'poramboke land',
		'parai',
		'parai attam',
		'paraiattam',
		'thappattam',
		'soothiram',
		'mayiladuthurai',
		'mayilai',
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
		'soothsayer',
		'soothing',
		'soothe',
		'stern',
		'talkin',
		'pinkman',
	],
	// Reason 1: the Bengali skeleton collisions these were computed against
	// (bnkt, knkr, ktmrn, kndl) belong to lemmas now marked `skeletonSafe:
	// false`. The native-script entries guard words the pack no longer reaches.
	bn: [
		'banquet',
		'banquets',
		'banqueting',
		'conquer',
		'conquered',
		'catamaran',
		'catamarans',
		'candle',
		'candles',
		'kundli',
		'chandal yog',
		'chandal yoga',
		'গুদাম',
		'গুড়',
		'ধন',
		'ধন্যবাদ',
		'বাড়ি',
		'বাড়া',
		'pathshala',
		'বাল ঠাকরে',
		'sonar bangla',
	],
	// Reason 1: the community names (महार, मांग, चांभार) are inert because only
	// the abusive vocatives are lemmas — the neutral nouns were never patterns.
	mr: [
		'गांडूळ',
		'गांडूळ खत',
		'gandul',
		'gandul khat',
		'कुत्रा',
		'लवकर',
		'भाड्याने',
		'bhadyane',
		'मंग्या',
		'मंगेश',
		'mangesh',
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
		'chamber',
		'chambers',
		'chamber of commerce',
		'catamaran',
		'catamarans',
		'kitemark',
		'gandhi',
		'uganda',
		'gandalf',
	],
	// Reason 2 for the ଗାଣ୍ଡି- traps (the prefix entry carries them) and
	// reason 1 for the rest — the ambiguous romanizations `banda`, `gandi`,
	// `magia` were dropped at the source rather than allowlisted.
	or: [
		'ଗାଣ୍ଡିବ',
		'ଗାଣ୍ଡୀବ',
		'ଗାଣ୍ଡିବଧନ୍ୱା',
		'ଗାଣ୍ଡିମୁଣ୍ଡ',
		'ବାଣ୍ଡି',
		'ବାଣ୍ଡେଜ',
		'ପୁଦିନା',
		'gandiva',
		'gandiv',
		'gandiba',
		'gandibi',
		'pudina',
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
	// Reason 2 (`dengue` is on the దెంగు entry) and reason 1 — the pack's own
	// comment calls `sanyasi`/`sannyasi` belt-and-braces for a lemma that was
	// never added.
	te: [
		'dengue',
		'dengue fever',
		'dengue virus',
		'lanja taluka',
		'lanja ratnagiri',
		'chandalam',
		'chandala',
		'chandalika',
		'mala',
		'mala mahanadu',
		'madiga',
		'madiga dandora',
		'mrps',
		'dalit',
		'panchami',
		'panchamrutham',
		'panchamukhi',
		'sanyasi',
		'sannyasi',
	],
	// Reason 2 for the ಬೋಳಿ traps, reason 1 for the community names.
	kn: [
		'ಬೋಳಿಸು',
		'ಬೋಳಿಸಿ',
		'bolisu',
		'bolisi',
		'boli',
		'tulunadu',
		'tulu nadu',
		'tuluva',
		'holeya',
		'holeyaru',
		'madiga',
		'chalavadi',
		'dalit',
		'chinali',
		'chinali people',
		'baddi',
		'kundapura',
		'tikkanna',
		'country',
	],
	// Reason 1 throughout: the Kunna- place names are inert because കുന്ന
	// stayed in word mode rather than prefix mode — the fix that made an
	// open-ended trap set unnecessary. Keeping them fences a switch back.
	ml: [
		'pooruruttathi',
		'pooradam',
		'pooram',
		'thrissur pooram',
		'poornima',
		'poori',
		'panni',
		'kunnamkulam',
		'kunnathunad',
		'kunnathur',
		'kunnamthanam',
		'kunnukara',
		'kunnappally',
		'pulaya',
		'pulayar',
		'pulayanarkotta',
		'cheruma',
		'cherumar',
		'cheraman',
		'cheraman perumal',
		'cheraman juma masjid',
		'devadasi',
		'devaradiyar',
		'dalit',
		'kundan',
		'thendral',
	],
	// The borrowed hi phrases are reason 1/2 as in hi. `banked`/`bunked`/
	// `bonked` are inert here but LIVE in hi: ਬਹਿਨਚੋਦ carries
	// `skeletonSafe: false`, बहनचोद does not.
	pa: [
		'jatt',
		'jat sikh',
		'jatt sikh',
		'ramgarhia',
		'ravidassia',
		'ramdasia',
		'ad dharmi',
		'mazhabi',
		'majhabi',
		'balmiki',
		'valmiki',
		'chamar regiment',
		'bhangi misl',
		'bhangi misal',
		'kanjar community',
		'kanjarbhat',
		'chuhar',
		'chuhar chak',
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
		'kutti story',
		'bullish harami',
		'bearish harami',
		'harami candlestick',
		'motorcades',
		'matricides',
		'banked',
		'bunked',
		'bonked',
		'sally lunn',
		'conjure',
		'conjurer',
		'conjuror',
	],
	// Same borrowed-phrase story as pa, plus reason 1 for the community names.
	// Unlike pa, gu's `motorcade`/`matricide` are inert too.
	gu: [
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
		'hellcat',
		'hellcats',
		'halkett',
		'rockdale',
	],
};

/** True when removing `phrase` from `pack`'s pack-wide allowlist lets `phrase` match. */
function isLoadBearing(pack: LanguagePack, phrase: string): boolean {
	const without: LanguagePack = {
		...pack,
		allowlist: (pack.allowlist ?? []).filter((p) => p !== phrase),
	};
	return createMatcher({ packs: [without] }).scan(phrase).matches.length > 0;
}

describe('pack-wide allowlist liveness', () => {
	const measured = PACKS.map((pack) => {
		const phrases = pack.allowlist ?? [];
		const inert = phrases.filter((phrase) => !isLoadBearing(pack, phrase));
		return { pack, phrases, inert };
	});

	it('every pack-wide allowlist phrase is load-bearing or declared inert', () => {
		const undeclared: string[] = [];
		for (const { pack, inert } of measured) {
			const declared = new Set(KNOWN_INERT[pack.language] ?? []);
			for (const phrase of inert) {
				if (!declared.has(phrase)) undeclared.push(`${pack.language}: ${phrase}`);
			}
		}
		// A new allowlist phrase that suppresses nothing is dead weight AND a
		// live suppression span for every other loaded pack. Either give it a
		// reason in KNOWN_INERT or delete it.
		expect(undeclared).toEqual([]);
	});

	it('no KNOWN_INERT entry has become load-bearing', () => {
		const nowLive: string[] = [];
		for (const { pack, inert } of measured) {
			const stillInert = new Set(inert);
			for (const phrase of KNOWN_INERT[pack.language] ?? []) {
				const phrases = pack.allowlist ?? [];
				if (phrases.includes(phrase) && !stillInert.has(phrase)) {
					nowLive.push(`${pack.language}: ${phrase}`);
				}
			}
		}
		// The phrase now protects something — drop it from KNOWN_INERT so the
		// list keeps telling the truth about what is inert.
		expect(nowLive).toEqual([]);
	});

	it('no KNOWN_INERT entry names a phrase the pack no longer carries', () => {
		const stale: string[] = [];
		for (const { pack, phrases } of measured) {
			const live = new Set(phrases);
			for (const phrase of KNOWN_INERT[pack.language] ?? []) {
				if (!live.has(phrase)) stale.push(`${pack.language}: ${phrase}`);
			}
		}
		expect(stale).toEqual([]);
	});

	it('records what the pack-wide allowlists actually do today', () => {
		const total = measured.reduce((n, m) => n + m.phrases.length, 0);
		const loadBearing = total - measured.reduce((n, m) => n + m.inert.length, 0);
		// Not a threshold to defend — a reminder of the measurement behind the
		// README's claim that whole-token matching, not the allowlists, is what
		// beats the Scunthorpe problem.
		expect(loadBearing).toBeLessThan(total);
		expect(loadBearing).toBeGreaterThan(0);
	});
});
