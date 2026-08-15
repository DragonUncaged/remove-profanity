/**
 * Gurmukhi script handling in the base fold, plus the regression guarantee
 * that registering Guru did not change Devanagari, Bengali or Tamil.
 *
 * The interesting half of this file is the folds that are DELIBERATELY
 * ABSENT: addak (gemination is phonemic) and nasal+virama→anusvara (Punjabi
 * does not write halant nasal clusters). Both would have come for free by
 * copying the Devanagari arm.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS } from '../src/unicode/indic-scripts.js';

const NUKTA = '਼';
const BINDI = 'ਂ';
const TIPPI = 'ੰ';
const ADAK_BINDI = 'ਁ';
const ADDAK = 'ੱ';
const VIRAMA = '੍';

describe('Gurmukhi is registered with its own rules', () => {
	const guru = INDIC_SCRIPTS.find((s) => s.script === 'Guru');

	it('is in the registry with the Gurmukhi block', () => {
		expect(guru).toBeDefined();
		expect(guru!.block).toEqual([0x0a00, 0x0a7f]);
	});

	it('declares NO nasal+virama→anusvara rule (the Devanagari-copy trap)', () => {
		// ਹਿੰਦੀ has no ਹਿਨ੍ਦੀ spelling the way हिंदी has हिन्दी: modern Punjabi
		// simply does not write halant nasal clusters, so declaring the rule
		// would fold a sequence the language never produces.
		expect(guru!.nasalsToAnusvara).toBeUndefined();
		expect(guru!.anusvara).toBeUndefined();
	});

	it('does not touch the addak — gemination is phonemic in Punjabi', () => {
		expect(guru!.drop ?? []).not.toContain(0x0a71);
		expect((guru!.map ?? []).map(([cp]) => cp)).not.toContain(0x0a71);
	});
});

describe('Gurmukhi: nukta U+0A3C', () => {
	it('drops a standalone nukta', () => {
		expect(indicFold(NUKTA).output).toBe('');
	});

	it('has NO Gurmukhi letter that NFC RE-composes (the Devanagari trap)', () => {
		// Devanagari splits both ways: U+0958–U+095F are composition
		// exclusions, but ऩ U+0929, ऱ U+0931 and ऴ U+0934 are NOT — NFC
		// composes those back into one code point, so a `drop` rule never
		// sees the nukta and silently does nothing. That cost the Marathi
		// pack its eyelash-reph spelling doublet.
		//
		// Scanning the WHOLE block rather than a hand-listed set is the point:
		// hand-listing is how U+0929 was missed in the first place.
		const recomposed: string[] = [];
		for (let cp = 0x0a00; cp <= 0x0a7f; cp++) {
			const ch = String.fromCodePoint(cp);
			if (ch.normalize('NFD') === ch) continue;
			if (ch.normalize('NFC').length === 1) recomposed.push(cp.toString(16));
		}
		expect(
			recomposed,
			`these Gurmukhi letters need explicit map entries, not the drop rule: ${recomposed.join(', ')}`,
		).toEqual([]);
	});

	it('unifies all six precomposed nukta letters with their base letters', () => {
		// These are composition exclusions: NFD splits them and NFC does NOT
		// put them back, so by the time the table runs inside baseFold they
		// are already base + U+0A3C and the single drop rule catches them.
		// Asserted here from the code points so the source encoding of this
		// file cannot make the test pass for the wrong reason.
		const pairs: [precomposed: number, base: number][] = [
			[0x0a33, 0x0a32], // ਲ਼ → ਲ
			[0x0a36, 0x0a38], // ਸ਼ → ਸ
			[0x0a59, 0x0a16], // ਖ਼ → ਖ
			[0x0a5a, 0x0a17], // ਗ਼ → ਗ
			[0x0a5b, 0x0a1c], // ਜ਼ → ਜ
			[0x0a5e, 0x0a2b], // ਫ਼ → ਫ
		];
		for (const [precomposed, base] of pairs) {
			const p = String.fromCodePoint(precomposed);
			const b = String.fromCodePoint(base);
			expect(p.normalize('NFC'), `NFC must decompose U+${precomposed.toString(16)}`).toBe(
				b + NUKTA,
			);
			expect(baseFold(p).output, `fold of U+${precomposed.toString(16)}`).toBe(b);
			expect(baseFold(b + NUKTA).output).toBe(b);
		}
	});

	it('unifies ਗਸ਼ਤੀ with the nukta-less ਗਸਤੀ that people actually type', () => {
		const withNukta = 'ਗਸ਼ਤੀ';
		const without = 'ਗਸਤੀ';
		expect(baseFold(withNukta).output).toBe(baseFold(without).output);
	});

	it('leaves ੜ RRA alone — it is an atomic letter, not a nukta form', () => {
		// The asymmetry with Devanagari worth knowing about: ड़ U+095C IS
		// ड + nukta and therefore merges into ड, but Gurmukhi ੜ U+0A5C does
		// not decompose and stays distinct from ਡ and ਢ.
		expect('ੜ'.normalize('NFD')).toBe('ੜ');
		expect(indicFold('ੜ').output).toBe('ੜ');
		expect(baseFold('ਪੜ੍ਹ').output).not.toBe(baseFold('ਪਡ੍ਹ').output);
	});

	it('keeps an exact deletion map', () => {
		const r = indicFold(`ਸ${NUKTA}ਤ`);
		expect(r.output).toBe('ਸਤ');
		expect(r.map).toEqual([0, 2]);
	});
});

describe('Gurmukhi: the two nasal signs', () => {
	it('folds tippi ੰ to bindi ਂ', () => {
		expect(indicFold(TIPPI).output).toBe(BINDI);
	});

	it('folds adak bindi ਁ (Gurmukhi candrabindu) to bindi', () => {
		expect(indicFold(ADAK_BINDI).output).toBe(BINDI);
	});

	it('makes the commonest Punjabi typo invisible: ਕੰਜਰ ≡ ਕਂਜਰ', () => {
		// Which sign is correct is decided by the preceding vowel, never by
		// meaning — there is no Punjabi minimal pair separated by tippi vs
		// bindi, so merging them is orthography, not a recall guess.
		expect(baseFold('ਕੰਜਰ').output).toBe(baseFold('ਕਂਜਰ').output);
		expect(baseFold('ਪੇਂਡੂ').output).toBe(baseFold('ਪੇੰਡੂ').output);
	});

	it('leaves bindi itself untouched', () => {
		expect(indicFold(BINDI).output).toBe(BINDI);
	});
});

describe('Gurmukhi: addak ੱ is NOT folded away', () => {
	it('keeps the addak, so phonemic gemination survives', () => {
		expect(indicFold(ADDAK).output).toBe(ADDAK);
	});

	it('does not collapse the minimal pairs a degemination fold would destroy', () => {
		// ਪਤਾ "knowledge" / ਪੱਤਾ "leaf"; ਦਸ "ten" / ਦੱਸ "tell";
		// ਸਤ "truth" / ਸੱਤ "seven".
		expect(baseFold('ਪਤਾ').output).not.toBe(baseFold('ਪੱਤਾ').output);
		expect(baseFold('ਦਸ').output).not.toBe(baseFold('ਦੱਸ').output);
		expect(baseFold('ਸਤ').output).not.toBe(baseFold('ਸੱਤ').output);
	});
});

describe('Gurmukhi: virama U+0A4D', () => {
	it('does NOT fold nasal + virama to a nasal sign', () => {
		for (const nasal of ['ਨ', 'ਮ', 'ਣ', 'ਙ', 'ਞ']) {
			expect(indicFold(`${nasal}${VIRAMA}`).output).toBe(`${nasal}${VIRAMA}`);
		}
	});

	it('leaves the subjoined letters intact — they are ordinary orthography', () => {
		// ਪੜ੍ਹ "paṛh" (to read) is not a variant spelling of ਪੜਹ.
		expect(baseFold('ਪੜ੍ਹ').output).not.toBe(baseFold('ਪੜਹ').output);
		expect(indicFold(`${VIRAMA}ਹ`).output).toBe(`${VIRAMA}ਹ`);
	});

	it('collapses a doubled virama (typing artifact / evasion vector)', () => {
		const doubled = `ਪ${VIRAMA}${VIRAMA}ਰ`;
		expect(indicFold(doubled).output).toBe(`ਪ${VIRAMA}ਰ`);
	});
});

describe('Gurmukhi: visarga', () => {
	it('drops ਃ U+0A03, the Sanskrit-loan-only sign', () => {
		expect(indicFold('ਃ').output).toBe('');
	});
});

describe('regression: the other scripts are unchanged by registering Guru', () => {
	it('still folds Devanagari nasal + virama to anusvara', () => {
		const r = indicFold('हिन्दी');
		expect(r.output).toBe('हिंदी');
		expect(r.map).toEqual([0, 1, 2, 4, 5]);
	});

	it('still folds Bengali nasal + virama to Bengali anusvara', () => {
		expect(indicFold('ন্').output).toBe('ং');
	});

	it('still leaves Tamil nasal clusters alone', () => {
		expect(baseFold('தமிழ்நாடு').output).toBe('தமிழ்நாடு');
	});

	it('does NOT collapse doubled Devanagari viramas (still opt-in per script)', () => {
		expect(indicFold('क््क').output).toBe('क््क');
	});

	it('leaves English and Hinglish text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi', 'classic assessment']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});
