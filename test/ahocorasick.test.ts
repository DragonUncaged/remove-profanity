import { describe, it, expect } from 'vitest';
import { AhoCorasick, type AcMatch } from '../src/engine/ahocorasick.js';

/** Order-insensitive comparison helper. */
function sorted(matches: AcMatch[]): AcMatch[] {
	return [...matches].sort(
		(a, b) => a.start - b.start || a.end - b.end || a.patternId - b.patternId,
	);
}

describe('AhoCorasick', () => {
	it('reports ALL matches on the classic ushers example (she, he, hers)', () => {
		const patterns = ['he', 'she', 'his', 'hers'];
		const ac = new AhoCorasick(patterns);
		const matches = ac.findAll('ushers');
		expect(sorted(matches)).toEqual([
			{ start: 1, end: 4, patternId: 1 }, // she
			{ start: 2, end: 4, patternId: 0 }, // he (via output link)
			{ start: 2, end: 6, patternId: 3 }, // hers
		]);
	});

	it('end is exclusive: slicing [start, end) yields the pattern text', () => {
		const patterns = ['he', 'she', 'his', 'hers'];
		const ac = new AhoCorasick(patterns);
		const text = 'she sells his herbs to ushers';
		for (const m of ac.findAll(text)) {
			expect(text.slice(m.start, m.end)).toBe(patterns[m.patternId]);
		}
	});

	it('finds overlapping occurrences of the same pattern', () => {
		const ac = new AhoCorasick(['aa']);
		expect(sorted(ac.findAll('aaaa'))).toEqual([
			{ start: 0, end: 2, patternId: 0 },
			{ start: 1, end: 3, patternId: 0 },
			{ start: 2, end: 4, patternId: 0 },
		]);
	});

	it('finds repeated non-overlapping occurrences', () => {
		const ac = new AhoCorasick(['abc']);
		expect(sorted(ac.findAll('abcxabc'))).toEqual([
			{ start: 0, end: 3, patternId: 0 },
			{ start: 4, end: 7, patternId: 0 },
		]);
	});

	it('reports a pattern that is a suffix of another at the same end position', () => {
		const ac = new AhoCorasick(['abcd', 'bcd', 'd']);
		const matches = sorted(ac.findAll('abcd'));
		expect(matches).toEqual([
			{ start: 0, end: 4, patternId: 0 },
			{ start: 1, end: 4, patternId: 1 },
			{ start: 3, end: 4, patternId: 2 },
		]);
	});

	it('reports every id of duplicate patterns', () => {
		const ac = new AhoCorasick(['x', 'x']);
		expect(sorted(ac.findAll('x'))).toEqual([
			{ start: 0, end: 1, patternId: 0 },
			{ start: 0, end: 1, patternId: 1 },
		]);
	});

	it('returns [] on empty text, no patterns, or no occurrences', () => {
		expect(new AhoCorasick(['he']).findAll('')).toEqual([]);
		expect(new AhoCorasick([]).findAll('anything')).toEqual([]);
		expect(new AhoCorasick(['zzz']).findAll('abcabc')).toEqual([]);
	});

	it('ignores empty-string patterns', () => {
		const ac = new AhoCorasick(['', 'ab']);
		expect(sorted(ac.findAll('ab'))).toEqual([
			{ start: 0, end: 2, patternId: 1 },
		]);
	});

	it('matches Devanagari patterns with correct UTF-16 offsets', () => {
		const patterns = ['चूतिया', 'मादरचोद'];
		const ac = new AhoCorasick(patterns);
		const text = 'अबे चूतिया, तू मादरचोद है';
		const matches = sorted(ac.findAll(text));
		expect(matches).toHaveLength(2);
		expect(text.slice(matches[0]!.start, matches[0]!.end)).toBe(patterns[0]);
		expect(matches[0]!.patternId).toBe(0);
		expect(text.slice(matches[1]!.start, matches[1]!.end)).toBe(patterns[1]);
		expect(matches[1]!.patternId).toBe(1);
	});

	it('handles overlapping Devanagari suffix patterns', () => {
		// बहनचोद contains चोद as a suffix.
		const patterns = ['बहनचोद', 'चोद'];
		const ac = new AhoCorasick(patterns);
		const text = 'बहनचोद';
		expect(sorted(ac.findAll(text))).toEqual([
			{ start: 0, end: 6, patternId: 0 },
			{ start: 3, end: 6, patternId: 1 },
		]);
	});

	it('matches patterns containing surrogate pairs at code-unit offsets', () => {
		const pattern = '\u{1D41F}\u{1D42E}'; // 𝐟𝐮 — two astral code points, 4 code units
		const ac = new AhoCorasick([pattern]);
		const text = 'ab\u{1D41F}\u{1D42E}cd';
		expect(ac.findAll(text)).toEqual([{ start: 2, end: 6, patternId: 0 }]);
		expect(text.slice(2, 6)).toBe(pattern);
	});

	it('scans a 10k-char haystack in under 50ms', () => {
		const patterns = [
			'he', 'she', 'his', 'hers', 'chutiya', 'madarchod', 'bhosdike',
			'चूतिया', 'gandu', 'behenchod',
		];
		const ac = new AhoCorasick(patterns);
		const filler = 'the quick brown fox jumps over the lazy dog chutiya ';
		let text = '';
		while (text.length < 10_000) text += filler;
		text = text.slice(0, 10_000);
		const plantedChutiya = [...text.matchAll(/chutiya/g)].length;

		const t0 = Date.now();
		const matches = ac.findAll(text);
		const elapsed = Date.now() - t0;

		expect(elapsed).toBeLessThan(50);
		const chutiyaId = patterns.indexOf('chutiya');
		expect(matches.filter((m) => m.patternId === chutiyaId)).toHaveLength(
			plantedChutiya,
		);
		// 'he' occurs inside every 'the' (2x per filler repeat) — sanity that
		// overlap reporting scales.
		expect(matches.some((m) => m.patternId === 0)).toBe(true);
	});
});
