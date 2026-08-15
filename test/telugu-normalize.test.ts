/**
 * Telugu script handling in the base fold.
 *
 * The interesting content here is the folds Telugu DOES have and Tamil does
 * not (nasal + virama → anusvara), and the folds it deliberately does NOT
 * have even though a neighbouring script does.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS, INDIC_CASELESS_RANGE } from '../src/unicode/indic-scripts.js';

const VIRAMA = '్'; // ్
const ANUSVARA = 'ం'; // ం

const telugu = INDIC_SCRIPTS.find((s) => s.script === 'Telu')!;

describe('Telugu is registered', () => {
	it('appears in INDIC_SCRIPTS with a well-formed block', () => {
		expect(telugu).toBeDefined();
		expect(telugu.name).toBe('Telugu');
		expect(telugu.block).toEqual([0x0c00, 0x0c7f]);
	});

	it('sits inside the caseless fast-path range', () => {
		const [lo, hi] = INDIC_CASELESS_RANGE;
		expect(telugu.block[0]).toBeGreaterThanOrEqual(lo);
		expect(telugu.block[1]).toBeLessThanOrEqual(hi);
	});

	it('does not overlap the Tamil or Kannada blocks', () => {
		const tamil = INDIC_SCRIPTS.find((s) => s.script === 'Taml')!;
		const kannada = INDIC_SCRIPTS.find((s) => s.script === 'Knda')!;
		expect(tamil.block[1]).toBeLessThan(telugu.block[0]);
		expect(telugu.block[1]).toBeLessThan(kannada.block[0]);
	});
});

describe('Telugu: nasal + virama → anusvara', () => {
	// Unlike Tamil, this rule is correct Telugu orthography: ం (sunna) is the
	// ordinary spelling of a homorganic nasal, and the conjunct spelling is
	// the Sanskritic alternate for the same word.
	it('folds all five nasals', () => {
		for (const nasal of ['ఙ', 'ఞ', 'ణ', 'న', 'మ']) {
			expect(indicFold(`${nasal}${VIRAMA}`).output, nasal).toBe(ANUSVARA);
		}
	});

	it('unifies ముణ్డ with ముండ', () => {
		expect(baseFold('ముణ్డ').output).toBe(baseFold('ముండ').output);
	});

	it('unifies the Sanskritic చన్ద్ర with చంద్ర', () => {
		expect(baseFold('చన్ద్ర').output).toBe(baseFold('చంద్ర').output);
	});

	it('keeps an exact two-to-one offset map', () => {
		const r = indicFold(`కన${VIRAMA}డ`);
		expect(r.output).toBe(`క${ANUSVARA}డ`);
		expect(r.map).toEqual([0, 1, 3]);
	});
});

describe('Telugu: signs that are dropped', () => {
	it('drops the visarga ః', () => {
		expect(indicFold('ః').output).toBe('');
		expect(baseFold('దుఃఖం').output).toBe(baseFold('దుఖం').output);
	});

	it('drops the nukta U+0C3C', () => {
		expect(indicFold('఼').output).toBe('');
	});
});

describe('Telugu: the TSA / DZA letters', () => {
	it('folds ౘ → చ and ౙ → జ', () => {
		expect(indicFold('ౘ').output).toBe('చ');
		expect(indicFold('ౙ').output).toBe('జ');
	});
});

describe('Telugu: the folds it deliberately does NOT have', () => {
	it('leaves the arasunna ఁ alone', () => {
		// Its modern reflex is deletion (వాఁడు → వాడు), not anusvara, while
		// the same code point carries the Sanskrit candrabindu in
		// transliteration, whose reflex IS anusvara. Two answers, so no rule.
		expect(indicFold('ఁ').output).toBe('ఁ');
		expect(baseFold('వాఁడు').output).not.toBe(baseFold('వాడు').output);
	});

	it('leaves ఱ (bandi ra) unfolded — the contrast is dead but the merge is not ours to make', () => {
		expect(indicFold('ఱ').output).toBe('ఱ');
		expect(baseFold('కఱ్ఱ').output).not.toBe(baseFold('కర్ర').output);
	});

	it('does not touch the voiced or aspirated series', () => {
		// The whole reason Telugu could not reuse Tamil's arm: గ/ఘ, జ/ఝ, డ/ఢ,
		// ద/ధ, బ/భ are all contrastive, and Tamil-style merging would destroy
		// them.
		for (const [plain, aspirate] of [
			['గ', 'ఘ'],
			['జ', 'ఝ'],
			['డ', 'ఢ'],
			['ద', 'ధ'],
			['బ', 'భ'],
			['క', 'ఖ'],
		]) {
			expect(indicFold(aspirate!).output, aspirate).toBe(aspirate);
			expect(baseFold(plain!).output).not.toBe(baseFold(aspirate!).output);
		}
	});

	it('collapses a doubled virama (typing artifact / evasion vector)', () => {
		const doubled = `క${VIRAMA}${VIRAMA}క`;
		expect(indicFold(doubled).output).toBe(`క${VIRAMA}క`);
	});

	it('is not fooled by ZWNJ injected after a virama', () => {
		expect(baseFold(`మొడ${VIRAMA}‌డ`).output).toBe(baseFold('మొడ్డ').output);
	});
});

describe('regression: the other scripts are unchanged by the Telugu entry', () => {
	it('still folds Devanagari and Bengali as before', () => {
		expect(indicFold('हिन्दी').output).toBe('हिंदी');
		expect(indicFold('क़').output).toBe('क');
		expect(indicFold('चाँद').output).toBe('चांद');
		expect(indicFold('ঁ').output).toBe('ং');
	});

	it('still folds Tamil grantha letters and the alveolar nasal', () => {
		for (const grantha of ['ஜ', 'ஶ', 'ஷ', 'ஸ']) {
			expect(indicFold(grantha).output, grantha).toBe('ச');
		}
		expect(indicFold('ன').output).toBe('ந');
	});

	it('still does NOT fold Tamil nasal clusters to anusvara', () => {
		for (const cluster of ['ங்', 'ஞ்', 'ண்', 'ந்', 'ம்']) {
			expect(indicFold(cluster).output).toBe(cluster);
		}
	});

	it('leaves English and Hinglish text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi', 'classic assessment']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});

describe('Telugu: NFC composition exclusions', () => {
	it('has none — every decomposable code point in the block recomposes', () => {
		// Devanagari's precomposed nukta letters (U+0958–U+095F) ARE
		// exclusions, so NFC leaves them decomposed and the nukta rule has to
		// cope with base + nukta. Telugu has no such trap: the only
		// decomposable code points are vowel signs, and all of them recompose,
		// so nothing reaches indicFold in a form the rules do not expect.
		let checked = 0;
		for (let cp = 0x0c00; cp <= 0x0c7f; cp++) {
			const ch = String.fromCodePoint(cp);
			const nfd = ch.normalize('NFD');
			if (nfd === ch) continue;
			checked += 1;
			expect(nfd.normalize('NFC'), `U+${cp.toString(16)} recomposes`).toBe(ch);
		}
		expect(checked, 'expected at least one decomposable vowel sign').toBeGreaterThan(0);
	});
});
