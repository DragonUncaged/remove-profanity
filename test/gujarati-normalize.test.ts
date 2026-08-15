/**
 * Gujarati script handling in the base fold.
 *
 * Gujarati is the one script in the table where all four Devanagari rules are
 * correct, so this file's job is to prove that each of them was actually
 * checked rather than inherited — in particular the nukta rule, whose NFC
 * story is the OPPOSITE of Devanagari's: Gujarati has no precomposed nukta
 * letters at all, so the drop rule stands on its own instead of depending on
 * NFC having decomposed something first.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS } from '../src/unicode/indic-scripts.js';

const NUKTA = '઼';
const ANUSVARA = 'ં';
const CANDRABINDU = 'ઁ';
const VIRAMA = '્';

describe('Gujarati is registered', () => {
	const gujr = INDIC_SCRIPTS.find((s) => s.script === 'Gujr');

	it('is in the registry with the Gujarati block', () => {
		expect(gujr).toBeDefined();
		expect(gujr!.block).toEqual([0x0a80, 0x0aff]);
	});

	it('declares the nasal+virama rule that Gurmukhi and Tamil refuse', () => {
		expect(gujr!.nasalsToAnusvara).toEqual([0x0aa8, 0x0aae, 0x0aa3, 0x0a99, 0x0a9e]);
		expect(gujr!.anusvara).toBe(ANUSVARA);
	});
});

describe('Gujarati: nukta U+0ABC', () => {
	it('has NO precomposed nukta letters anywhere in the block', () => {
		// The fact the drop rule depends on. Devanagari's क़ U+0958–U+095F and
		// Gurmukhi's six are composition exclusions that NFC leaves split;
		// Gujarati simply never encoded any, so nothing in the block
		// decomposes and nothing can silently recompose either.
		for (let cp = 0x0a80; cp <= 0x0aff; cp++) {
			const ch = String.fromCodePoint(cp);
			expect(ch.normalize('NFD'), `U+${cp.toString(16)} must not decompose`).toBe(ch);
		}
	});

	it('never lets NFC compose base + nukta into one code point', () => {
		for (const base of ['જ', 'ઝ', 'ફ', 'ક']) {
			expect((base + NUKTA).normalize('NFC')).toBe(base + NUKTA);
		}
	});

	it('has NO Gujarati letter that NFC RE-composes (the Devanagari trap)', () => {
		// Devanagari ऩ U+0929, ऱ U+0931 and ऴ U+0934 are NOT composition
		// exclusions, so NFC composes base + nukta back into one code point
		// and a `drop` rule silently does nothing. Gujarati has no code point
		// with a canonical decomposition at all, so it cannot happen here —
		// asserted over the whole block rather than a hand-listed set, since
		// hand-listing is how U+0929 was missed.
		const recomposed: string[] = [];
		for (let cp = 0x0a80; cp <= 0x0aff; cp++) {
			const ch = String.fromCodePoint(cp);
			if (ch.normalize('NFD') === ch) continue;
			if (ch.normalize('NFC').length === 1) recomposed.push(cp.toString(16));
		}
		expect(recomposed).toEqual([]);
	});

	it('drops the nukta, so જ઼ ≡ જ', () => {
		expect(indicFold(NUKTA).output).toBe('');
		expect(baseFold('જ' + NUKTA).output).toBe('જ');
	});
});

describe('Gujarati: nasalization', () => {
	it('folds candrabindu ઁ to anusvara ં', () => {
		expect(indicFold(CANDRABINDU).output).toBe(ANUSVARA);
	});

	it('folds nasal + virama to anusvara: અન્ત ≡ અંત', () => {
		expect(baseFold('અન્ત').output).toBe(baseFold('અંત').output);
		expect(baseFold('ગાન્ધી').output).toBe(baseFold('ગાંધી').output);
		for (const nasal of ['ન', 'મ', 'ણ', 'ઙ', 'ઞ']) {
			expect(indicFold(`${nasal}${VIRAMA}`).output, nasal).toBe(ANUSVARA);
		}
	});

	it('maps the folded cluster back to the consonant, not the virama', () => {
		const r = indicFold(`અન${VIRAMA}ત`);
		expect(r.output).toBe(`અ${ANUSVARA}ત`);
		expect(r.map).toEqual([0, 1, 3]);
	});
});

describe('Gujarati: virama and visarga', () => {
	it('drops visarga ઃ: દુઃખ ≡ દુખ', () => {
		expect(indicFold('ઃ').output).toBe('');
		expect(baseFold('દુઃખ').output).toBe(baseFold('દુખ').output);
	});

	it('keeps a legitimate conjunct', () => {
		// લુચ્ચો is written with a real ચ્ચ conjunct; only nasals fold.
		expect(baseFold('લુચ્ચો').output).toBe('લુચ્ચો');
	});

	it('collapses a doubled virama (typing artifact / evasion vector)', () => {
		expect(indicFold(`ચ${VIRAMA}${VIRAMA}ચ`).output).toBe(`ચ${VIRAMA}ચ`);
	});
});

describe('Gujarati: what is deliberately NOT folded', () => {
	it('keeps the ઑ / ઍ loan-vowel signs, which are contrastive', () => {
		expect(indicFold('ઑ').output).toBe('ઑ');
		expect(indicFold('ઍ').output).toBe('ઍ');
		expect(baseFold('કૉલ').output).not.toBe(baseFold('કોલ').output);
	});

	it('keeps ળ distinct from લ', () => {
		// છિનાળ ends in ળ; merging the two laterals would be a recall guess.
		expect(baseFold('છિનાળ').output).not.toBe(baseFold('છિનાલ').output);
	});
});

describe('regression: Gujarati does not reach the other scripts', () => {
	it('leaves Devanagari, Bengali and Tamil folds as they were', () => {
		expect(indicFold('हिन्दी').output).toBe('हिंदी');
		expect(indicFold('ন্').output).toBe('ং');
		expect(baseFold('தமிழ்நாடு').output).toBe('தமிழ்நாடு');
		expect(indicFold('क््क').output).toBe('क््क');
	});

	it('keeps the Gujarati and Gurmukhi anusvara signs separate', () => {
		// U+0A82 vs U+0A02 — adjacent blocks, different code points, and a
		// single shared lookup table. If either script's map leaked into the
		// other, this is where it would show.
		expect(baseFold('ં').output).toBe('ં');
		expect(baseFold('ਂ').output).toBe('ਂ');
		expect(baseFold('ં').output).not.toBe(baseFold('ਂ').output);
	});

	it('leaves English text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});
