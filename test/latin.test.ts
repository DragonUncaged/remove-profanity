import { describe, it, expect } from 'vitest';
import {
	confusablesFold,
	leetFold,
	collapseRepeatsFold,
	collapseAllRepeatsFold,
	latinFold,
} from '../src/folds/latin.js';

describe('confusablesFold', () => {
	it('folds Mathematical Alphanumeric bold 𝐟𝐮𝐜𝐤 to fuck with a correct map', () => {
		const { output, map } = confusablesFold('𝐟𝐮𝐜𝐤');
		expect(output).toBe('fuck');
		// Each input letter is a surrogate pair: starts at 0, 2, 4, 6.
		expect(map).toEqual([0, 2, 4, 6]);
	});

	it('folds enclosed alphanumerics ⓕⓤⓒⓚ to fuck', () => {
		const { output, map } = confusablesFold('ⓕⓤⓒⓚ');
		expect(output).toBe('fuck');
		expect(map).toEqual([0, 1, 2, 3]);
	});

	it('folds uppercase enclosed Ⓐ to a', () => {
		expect(confusablesFold('Ⓐ').output).toBe('a');
	});

	it('handles uppercase and other math alphabets algorithmically', () => {
		// 𝐀 (bold capital A, U+1D400) and 𝗓 (sans-serif z, U+1D5D3).
		expect(confusablesFold('\u{1D400}').output).toBe('a');
		expect(confusablesFold('\u{1D5D3}').output).toBe('z');
	});

	it('leaves reserved math-alphanumeric gaps like U+1D455 untouched', () => {
		const input = '\u{1D455}';
		const { output, map } = confusablesFold(input);
		expect(output).toBe(input);
		expect(map).toEqual([0, 0]); // surrogate pair kept, both units map to cp start
	});

	it('folds mathematical digits to ASCII digits', () => {
		expect(confusablesFold('\u{1D7CE}').output).toBe('0'); // 𝟎
		expect(confusablesFold('\u{1D7D3}').output).toBe('5'); // 𝟓
	});

	it('folds Cyrillic lookalikes: ѕех → sex', () => {
		// ѕ U+0455, е U+0435, х U+0445 — all Cyrillic.
		const { output, map } = confusablesFold('ѕех');
		expect(output).toBe('sex');
		expect(map).toEqual([0, 1, 2]);
	});

	it('folds uppercase Cyrillic/Greek lookalikes to lowercase ASCII', () => {
		expect(confusablesFold('Ѕ').output).toBe('s'); // Ѕ
		expect(confusablesFold('Α').output).toBe('a'); // Α
		expect(confusablesFold('ν').output).toBe('v'); // ν
	});

	it('folds ƒ, ç and Latin-1 accents', () => {
		expect(confusablesFold('ƒ').output).toBe('f');
		expect(confusablesFold('çà').output).toBe('ca');
		expect(confusablesFold('ñüé').output).toBe('nue');
	});

	it('leaves plain ASCII untouched with an identity map', () => {
		const { output, map } = confusablesFold('hello');
		expect(output).toBe('hello');
		expect(map).toEqual([0, 1, 2, 3, 4]);
	});
});

describe('leetFold', () => {
	it('folds b!tch to bitch with an identity-shaped map', () => {
		const { output, map } = leetFold('b!tch');
		expect(output).toBe('bitch');
		expect(map).toEqual([0, 1, 2, 3, 4]);
	});

	it('folds chut1ya, chutiy@, bh0sdike', () => {
		expect(leetFold('chut1ya').output).toBe('chutiya');
		expect(leetFold('chutiy@').output).toBe('chutiya');
		expect(leetFold('bh0sdike').output).toBe('bhosdike');
	});

	it('folds ph to f (longest token first) with a 2→1 map', () => {
		const { output, map } = leetFold('phuck');
		expect(output).toBe('fuck');
		expect(map).toEqual([0, 2, 3, 4]);
	});

	it('leaves "500 BC" unchanged', () => {
		const { output, map } = leetFold('500 BC');
		expect(output).toBe('500 BC');
		expect(map).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('does not fold digits in number-led tokens like "45s"', () => {
		expect(leetFold('45s').output).toBe('45s');
		expect(leetFold('500').output).toBe('500');
	});

	it('does not fold symbols with no Latin-letter neighbor', () => {
		expect(leetFold('@ 4 !').output).toBe('@ 4 !');
		expect(leetFold('(1)').output).toBe('(1)');
	});

	it('folds digits inside letter-led tokens (a55 leading 5)', () => {
		// First 5 has letter neighbor 'a'; trailing 5 has none — guard is literal.
		expect(leetFold('a55').output).toBe('as5');
		expect(leetFold('h4x').output).toBe('hax');
	});

	it('deliberately has no ( → c mapping, so fu(k is a documented miss', () => {
		// SPEC.md Module B and the leetFold docstring both used to list `(→c`;
		// the table never had it. The mapping is not the fix: an opening paren
		// before a word satisfies the letter-neighbor guard, so `(um` would
		// fold to `cum` and flag an ordinary parenthetical. Precision wins
		// over recall (docs/language-packs.md), and the masked tier already
		// covers the shape people actually type (`f*ck`).
		expect(leetFold('fu(k').output).toBe('fu(k');
		expect(leetFold('(um').output).toBe('(um');
	});
});

describe('collapseRepeatsFold', () => {
	it('truncates runs above the threshold: fuuuuck → fuuck at 2', () => {
		const { output, map } = collapseRepeatsFold(2)('fuuuuck');
		expect(output).toBe('fuuck');
		expect(map).toEqual([0, 1, 2, 5, 6]);
	});

	it('keeps legitimate doubles at threshold 2', () => {
		const { output, map } = collapseRepeatsFold(2)('assess');
		expect(output).toBe('assess');
		expect(map).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('collapseAllRepeatsFold collapses every run to 1', () => {
		const { output, map } = collapseAllRepeatsFold('fuuuuck');
		expect(output).toBe('fuck');
		expect(map).toEqual([0, 1, 5, 6]);
	});

	it('compares whole code points (astral-safe)', () => {
		// Three bold 𝐟 (U+1D41F), each a surrogate pair.
		const { output, map } = collapseAllRepeatsFold('\u{1D41F}\u{1D41F}\u{1D41F}');
		expect(output).toBe('\u{1D41F}');
		expect(map).toEqual([0, 0]);
	});
});

describe('latinFold (composed)', () => {
	it('folds 𝐟𝐮𝐜𝐤 to fuck with the composed map back to the original', () => {
		const { output, map } = latinFold('𝐟𝐮𝐜𝐤');
		expect(output).toBe('fuck');
		expect(map).toEqual([0, 2, 4, 6]);
	});

	it('applies confusables before leet: 𝐛1tch → bitch', () => {
		// 𝐛 U+1D41B occupies units 0–1, so '1' is at original index 2.
		const { output, map } = latinFold('\u{1D41B}1tch');
		expect(output).toBe('bitch');
		expect(map).toEqual([0, 2, 3, 4, 5]);
	});

	it('applies leet then repeat-collapse: b!tchhhh → bitchh', () => {
		expect(latinFold('b!tchhhh').output).toBe('bitchh');
	});

	it('collapses repeats: fuuuuck → fuuck', () => {
		expect(latinFold('fuuuuck').output).toBe('fuuck');
	});

	it('leaves clean text alone', () => {
		const { output, map } = latinFold('classic assessment in 500 bc');
		expect(output).toBe('classic assessment in 500 bc');
		expect(map).toEqual(Array.from({ length: output.length }, (_, i) => i));
	});
});
