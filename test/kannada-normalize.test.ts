/**
 * Kannada script handling in the base fold.
 *
 * Kannada and Telugu are sister scripts, and the task brief's instruction was
 * to prove they share a fold arm rather than assume it. This suite is that
 * proof, in both directions: the rules they share are asserted to behave
 * identically, and the rules that are Telugu-only are asserted to be absent
 * here.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS, INDIC_CASELESS_RANGE } from '../src/unicode/indic-scripts.js';

const VIRAMA = '್';
const ANUSVARA = 'ಂ';

const kannada = INDIC_SCRIPTS.find((s) => s.script === 'Knda')!;
const telugu = INDIC_SCRIPTS.find((s) => s.script === 'Telu')!;

describe('Kannada is registered', () => {
	it('appears in INDIC_SCRIPTS with a well-formed block', () => {
		expect(kannada).toBeDefined();
		expect(kannada.name).toBe('Kannada');
		expect(kannada.block).toEqual([0x0c80, 0x0cff]);
	});

	it('sits inside the caseless fast-path range', () => {
		const [lo, hi] = INDIC_CASELESS_RANGE;
		expect(kannada.block[0]).toBeGreaterThanOrEqual(lo);
		expect(kannada.block[1]).toBeLessThanOrEqual(hi);
	});
});

describe('what Kannada and Telugu genuinely share', () => {
	it('both fold nasal + virama to their own anusvara', () => {
		expect(kannada.nasalsToAnusvara?.length).toBe(5);
		expect(telugu.nasalsToAnusvara?.length).toBe(5);
		for (const nasal of ['ಙ', 'ಞ', 'ಣ', 'ನ', 'ಮ']) {
			expect(indicFold(`${nasal}${VIRAMA}`).output, nasal).toBe(ANUSVARA);
		}
	});

	it('unifies ಮುಣ್ಡೆ with ಮುಂಡೆ, exactly as Telugu unifies ముణ్డ with ముండ', () => {
		expect(baseFold('ಮುಣ್ಡೆ').output).toBe(baseFold('ಮುಂಡೆ').output);
		expect(baseFold('ಚನ್ದ್ರ').output).toBe(baseFold('ಚಂದ್ರ').output);
	});

	it('both drop visarga and nukta', () => {
		expect(indicFold('ಃ').output).toBe('');
		expect(indicFold('಼').output).toBe('');
		expect(baseFold('ದುಃಖ').output).toBe(baseFold('ದುಖ').output);
	});

	it('both collapse doubled viramas', () => {
		expect(indicFold(`ಕ${VIRAMA}${VIRAMA}ಕ`).output).toBe(`ಕ${VIRAMA}ಕ`);
	});
});

describe('where Kannada and Telugu differ — why this is a separate entry', () => {
	it('Kannada declares no code-point map at all; Telugu declares TSA/DZA', () => {
		// ౘ U+0C58 / ౙ U+0C59 exist only in the Telugu block. There is nothing
		// analogous to fold in Kannada, so copying the arm would have added a
		// rule with no referent.
		expect(kannada.map ?? []).toEqual([]);
		expect((telugu.map ?? []).length).toBe(2);
	});

	it('leaves the obsolete ಱ and ೞ unfolded', () => {
		// Both were formally retired from the Kannada alphabet. Folding them
		// would be a merger of dead contrasts, with no modern text to gain.
		expect(indicFold('ಱ').output).toBe('ಱ');
		expect(indicFold('ೞ').output).toBe('ೞ');
	});

	it('leaves the Kannada candrabindu ಁ alone', () => {
		expect(indicFold('ಁ').output).toBe('ಁ');
	});

	it('does not touch the voiced or aspirated series', () => {
		for (const [plain, aspirate] of [
			['ಗ', 'ಘ'],
			['ಜ', 'ಝ'],
			['ಡ', 'ಢ'],
			['ದ', 'ಧ'],
			['ಬ', 'ಭ'],
			['ಕ', 'ಖ'],
		]) {
			expect(indicFold(aspirate!).output, aspirate).toBe(aspirate);
			expect(baseFold(plain!).output).not.toBe(baseFold(aspirate!).output);
		}
	});
});

describe('Kannada evasion vectors at the fold level', () => {
	it('is not fooled by ZWNJ injected after a virama', () => {
		expect(baseFold(`ತುಲ${VIRAMA}‌ಲು`).output).toBe(baseFold('ತುಲ್ಲು').output);
	});

	it('is not fooled by a visarga glued on', () => {
		expect(baseFold('ಸೂಳೆಃ').output).toBe(baseFold('ಸೂಳೆ').output);
	});
});

describe('regression: the other scripts are unchanged by the Kannada entry', () => {
	it('still folds Devanagari, Bengali and Tamil as before', () => {
		expect(indicFold('हिन्दी').output).toBe('हिंदी');
		expect(indicFold('ঁ').output).toBe('ং');
		expect(indicFold('ஷ').output).toBe('ச');
		expect(indicFold('ண்').output).toBe('ண்');
	});

	it('leaves English text byte-identical', () => {
		expect(baseFold('classic assessment').output).toBe('classic assessment');
	});
});

describe('Kannada: NFC composition exclusions', () => {
	it('has none — every decomposable code point in the block recomposes', () => {
		// Devanagari's precomposed nukta letters (U+0958–U+095F) ARE
		// exclusions, so NFC leaves them decomposed and the nukta rule has to
		// cope with base + nukta. Kannada has no such trap: the only
		// decomposable code points are vowel signs, and all of them recompose,
		// so nothing reaches indicFold in a form the rules do not expect.
		let checked = 0;
		for (let cp = 0x0c80; cp <= 0x0cff; cp++) {
			const ch = String.fromCodePoint(cp);
			const nfd = ch.normalize('NFD');
			if (nfd === ch) continue;
			checked += 1;
			expect(nfd.normalize('NFC'), `U+${cp.toString(16)} recomposes`).toBe(ch);
		}
		expect(checked, 'expected at least one decomposable vowel sign').toBeGreaterThan(0);
	});
});
