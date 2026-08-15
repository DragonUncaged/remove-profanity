/**
 * Cross-pack allowlist interference, and the tier asymmetry that caused it.
 *
 * The reported symptom was cross-pack: or's `chhinali` and kn's `chinaali`
 * both stopped detecting whenever `data/kn` was loaded, because kn carries
 * `chinali` (the Chinali people of Himachal Pradesh) as an allow phrase. The
 * obvious reading — "an allow phrase belonging to one pack should not veto
 * another pack's lemma" — is the wrong diagnosis, and the measurement says so
 * twice over.
 *
 * 1. It does not explain the whole bug. kn's OWN `chinaali` was dead too,
 *    against kn's OWN allow phrase. No amount of pack scoping revives that.
 * 2. Cross-pack veto is not a thing the packs actually do. Measured across
 *    1,693,513 dictionary forms (`/usr/share/dict/words` plus its regular
 *    inflections), the 486 benchmark clean cases and all 2,286 shipped pack
 *    surfaces, with every pack loaded: 127 allowlist suppressions happen, and
 *    **zero** of them are a phrase from one pack silencing another pack's
 *    entry. The two `chinali` families were the only ones, and they were the
 *    bug. Scoping the allowlist per pack would therefore change nothing
 *    measurable, while coupling a phrase's reach to which pack happens to win
 *    the shared skeleton index — a severity tie-break that has nothing to do
 *    with allowlisting. The global scope stays.
 *
 * To re-measure: build three matchers over all eleven packs — one intact, one
 * with every `pack.allowlist` AND every `entry.allowlist` emptied, and one per
 * pack keeping only that pack's phrases. A match present in the bare matcher
 * and absent from the intact one is a suppression; the packs whose solo
 * matcher also suppresses it are its owners; it is cross-pack when the
 * suppressed entry's `language` is in none of them. Attribute with the
 * keep-one matchers, never with remove-one — three packs carry `banked`, so
 * removing any single pack's list leaves the span covered and credits nobody.
 *
 * The real defect was inside one pass. The repeat-collapsed pass is
 * stretch-gated on the CANDIDATE side (`requireStretch`) so that everyday
 * doubled letters cannot fold onto a profane pattern — pakki/paki,
 * chhod/chod, rapping/raping. The ALLOW side of the same pass had no such
 * gate, so everyday doubled letters folded onto an allow phrase instead:
 * `chhinali`, `chhinaali` and `chinaali` all collapse to exactly `chinali`.
 * Both sides are gated the same way now.
 *
 * `test/all-packs-dictionary-sweep.test.ts` holds the mirror check whose
 * KNOWN_DEAD pin this emptied. These cases are the direct, readable version.
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

const ALL: LanguagePack[] = [
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

describe('the reported bug: chinali no longer kills its neighbours', () => {
	// Both orders, because the whole complaint was that the answer depended on
	// which packs the consumer happened to import, and in what order.
	const sets: Array<[string, LanguagePack[]]> = [
		['or alone', [odia]],
		['kn alone', [kannada]],
		['or then kn', [odia, kannada]],
		['kn then or', [kannada, odia]],
		['all eleven', ALL],
		['all eleven, reversed', [...ALL].reverse()],
	];

	for (const [label, packs] of sets) {
		const matcher = createMatcher({ packs });
		const has = (code: string): boolean => packs.some((p) => p.language === code);

		it(`${label}: or's chhinali detects when or is loaded`, () => {
			for (const surface of ['chhinali', 'chhinaali']) {
				const matches = matcher.scan(surface).matches;
				if (!has('or')) {
					expect(matches).toEqual([]);
					continue;
				}
				expect(matches).toHaveLength(1);
				expect(matches[0]!.lemma).toBe('ଛିନାଳି');
				expect(matches[0]!.language).toBe('or');
			}
		});

		it(`${label}: kn's chinaali detects when kn is loaded`, () => {
			const matches = matcher.scan('chinaali').matches;
			if (!has('kn')) {
				expect(matches).toEqual([]);
				return;
			}
			expect(matches).toHaveLength(1);
			expect(matches[0]!.lemma).toBe('ಚಿನಾಲಿ');
			expect(matches[0]!.language).toBe('kn');
		});

		it(`${label}: the Chinali people stay clean`, () => {
			// The reason the allow phrase exists. It must keep working in every
			// pack combination, which is the constraint the fix had to respect.
			expect(matcher.isClean('chinali')).toBe(true);
			expect(matcher.isClean('the Chinali people of Himachal Pradesh')).toBe(true);
			expect(matcher.isClean('Chinali is spoken in Lahaul')).toBe(true);
		});
	}
});

describe('the collapsed pass is stretch-gated on both sides', () => {
	const matcher = createMatcher({ packs: ALL });

	it('an allow phrase still covers a genuinely stretched spelling', () => {
		// This is what the collapsed allow pass is FOR, and it is exactly the
		// case the gate keeps: a run of 3+ is letter-stretching, not spelling.
		expect(matcher.isClean('he baaanked the shot')).toBe(true);
		expect(matcher.isClean('she was bonnnked on the head')).toBe(true);
	});

	it('an ordinary doubled letter no longer folds onto an allow phrase', () => {
		// `boonked` used to ride on `bonked` for free. It is enumerated in the
		// three packs carrying key "bnkd" now, so it is still clean — but by
		// data, where the sweep can see it, not by an accident of folding.
		expect(matcher.isClean('boonked')).toBe(true);
		for (const pack of [hindi, punjabi, gujarati]) {
			expect(createMatcher({ packs: [pack] }).isClean('boonked')).toBe(true);
		}
	});

	it('stretched evasion of a real term still resolves', () => {
		// The gate must not blunt the tier it guards.
		expect(matcher.isClean('gaaaandu')).toBe(false);
		expect(matcher.isClean('fuuuuck')).toBe(false);
	});
});

describe('cross-language suppression that is kept, and why', () => {
	const matcher = createMatcher({ packs: ALL });

	// Every one of these is a pack-wide allow phrase protecting a word that is
	// innocent in one language and reachable by a lemma in another. They are
	// the reason the allowlist scope was NOT narrowed to the declaring pack.
	const kept = [
		'the Tulu Nadu heritage festival opened',
		'avan parayan thudangi',
		'Lanja taluka is in Ratnagiri district',
		'usne apni boli badal li',
		'a bullish harami candlestick formed',
		'Lund University is in Sweden',
		'the Thrissur Pooram festival draws crowds',
		'Kunnamkulam municipality passed the budget',
		'dengue fever cases are rising',
		'Baddi is in Himachal Pradesh',
		'Chuhar Chak is in Moga district',
		'a Sally Lunn bun with jam',
		'he is a Sunni Muslim',
		'a Kundan jewellery set',
		'therukoothu is a folk theatre form',
		// The one that was NOT self-sufficient, and the reason the second
		// assertion below exists: `laude` is a hi romanization of लौड़ा, and
		// only en's `cum laude` was keeping this clean.
		'she graduated summa cum laude',
	];

	it.each(kept)('stays clean with every pack loaded: %s', (text) => {
		expect(matcher.isClean(text)).toBe(true);
	});

	// And the invariant that makes the global scope harmless rather than merely
	// unused: EVERY pack must be clean on these ALONE. If one pack needed
	// another's allow phrase, the global scope would be load-bearing and
	// `data/<that pack>` would have a false positive on its own — which is
	// exactly what `summa cum laude` was. This is the cheap, always-on version
	// of the 1.69M-form measurement in the header.
	it.each(kept)('needs no other pack to stay clean: %s', (text) => {
		const needy = ALL.filter((p) => !createMatcher({ packs: [p] }).isClean(text)).map(
			(p) => p.language,
		);
		expect(needy).toEqual([]);
	});
});

describe('every pack protects its own lemmas without help from another pack', () => {
	// The measurement behind the decision: with all eleven loaded, no allow
	// phrase suppresses an entry belonging to a different pack. The way that
	// stays true is that each pack is clean on its own traps ALONE — the same
	// self-sufficiency rule the packs already follow for recall.
	//
	// `summa cum laude` is the case that proved it was worth asserting: the hi
	// romanization `laude` was flagged by `data/hi` alone, and only the en
	// pack's `cum laude` hid it from every all-packs measurement.
	const soloTraps: Array<[LanguagePack, string]> = [
		[hindi, 'she graduated summa cum laude'],
		[hindi, 'he was awarded magna cum laude'],
		[english, 'she graduated summa cum laude'],
		[kannada, 'the Chinali people of Himachal Pradesh'],
		[odia, 'the Chinali people of Himachal Pradesh'],
	];

	it.each(soloTraps)('%#: the owning pack alone keeps it clean', (pack, text) => {
		expect(createMatcher({ packs: [pack] }).isClean(text)).toBe(true);
	});
});
