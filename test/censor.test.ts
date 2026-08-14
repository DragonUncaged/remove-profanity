import { describe, it, expect } from 'vitest';
import { censorText } from '../src/engine/censor.js';
import {
	graphemeSlices,
	graphemeSlicesFallback,
	hasIntlSegmenter,
} from '../src/unicode/graphemes.js';

const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}'; // 👨‍👩‍👧 (8 code units)

describe('graphemeSlices', () => {
	it('reports Intl.Segmenter as available on Node >= 18', () => {
		expect(hasIntlSegmenter).toBe(true);
	});

	it('splits plain ASCII into one slice per char', () => {
		expect(graphemeSlices('abc')).toEqual([
			{ start: 0, end: 1 },
			{ start: 1, end: 2 },
			{ start: 2, end: 3 },
		]);
	});

	it('returns [] for the empty string', () => {
		expect(graphemeSlices('')).toEqual([]);
		expect(graphemeSlicesFallback('')).toEqual([]);
	});

	it('keeps Devanagari matras attached (चूतिया)', () => {
		const slices = graphemeSlices('चूतिया');
		// च+ू, त+ि, य+ा — every slice is 2 code units, no slice starts on a mark.
		expect(slices).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 4 },
			{ start: 4, end: 6 },
		]);
		for (const s of slices) {
			expect(/^\p{M}/u.test('चूतिया'.slice(s.start, s.end))).toBe(false);
		}
	});

	it('covers the whole string with no gaps', () => {
		const text = `a${FAMILY}हिन्दीb`;
		const slices = graphemeSlices(text);
		let pos = 0;
		for (const s of slices) {
			expect(s.start).toBe(pos);
			expect(s.end).toBeGreaterThan(s.start);
			pos = s.end;
		}
		expect(pos).toBe(text.length);
	});

	it('treats the family emoji as one cluster', () => {
		expect(graphemeSlices(FAMILY)).toEqual([{ start: 0, end: FAMILY.length }]);
	});
});

describe('graphemeSlicesFallback', () => {
	it('matches the segmenter on simple matra clusters', () => {
		expect(graphemeSlicesFallback('चूतिया')).toEqual(graphemeSlices('चूतिया'));
	});

	it('keeps virama conjuncts attached (हिन्दी → हि | न्दी)', () => {
		expect(graphemeSlicesFallback('हिन्दी')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 6 },
		]);
	});

	it('keeps ZWJ emoji sequences as one cluster', () => {
		expect(graphemeSlicesFallback(FAMILY)).toEqual([
			{ start: 0, end: FAMILY.length },
		]);
	});

	it('keeps ZWNJ attached to the previous cluster without joining the next', () => {
		// a + ZWNJ + b → [a+ZWNJ, b]
		expect(graphemeSlicesFallback('a‌b')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 3 },
		]);
	});

	it('handles surrogate pairs as single clusters', () => {
		expect(graphemeSlicesFallback('\u{1F468}x')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 3 },
		]);
	});
});

describe('censorText', () => {
	it('masks चूतिया with exactly one mask per grapheme cluster', () => {
		const text = 'चूतिया';
		const clusterCount = graphemeSlices(text).length;
		const censored = censorText(text, [{ start: 0, end: text.length }]);
		expect(censored).toBe('*'.repeat(clusterCount));
		// No combining marks may survive anywhere near the masks.
		expect(/\p{M}/u.test(censored)).toBe(false);
	});

	it('expands a mid-cluster span to full cluster boundaries', () => {
		// Span covers only the matra ि (code unit 3) — must mask the whole ति.
		const censored = censorText('चूतिया', [{ start: 3, end: 4 }]);
		expect(censored).toBe('चू*या');
		// No orphaned combining mark adjacent to a mask.
		expect(censored).not.toMatch(/\*\p{M}/u);
		expect(censored).not.toMatch(/^\p{M}/u);
	});

	it('never leaves a combining mark adjacent to a mask on partial spans', () => {
		const text = 'हिन्दी';
		const slices = graphemeSlices(text);
		// Censor only the last cluster, whatever the segmenter says it is.
		const last = slices[slices.length - 1]!;
		const censored = censorText(text, [{ start: last.start + 1, end: last.end }]);
		expect(censored).not.toMatch(/\*\p{M}/u);
		expect(censored.endsWith('*')).toBe(true);
		expect(censored).toBe(text.slice(0, last.start) + '*');
	});

	it('keepFirst keeps the first cluster: fuck → f***', () => {
		expect(censorText('fuck', [{ start: 0, end: 4 }], { keepFirst: true })).toBe(
			'f***',
		);
	});

	it('keepFirst keeps the first native-script cluster', () => {
		const censored = censorText('चूतिया', [{ start: 0, end: 6 }], {
			keepFirst: true,
		});
		const clusterCount = graphemeSlices('चूतिया').length;
		expect(censored).toBe('चू' + '*'.repeat(clusterCount - 1));
	});

	it('merges overlapping spans', () => {
		expect(
			censorText('abcdefgh', [
				{ start: 0, end: 4 },
				{ start: 2, end: 6 },
			]),
		).toBe('******gh');
	});

	it('merged overlapping spans keep only ONE first cluster with keepFirst', () => {
		expect(
			censorText(
				'abcdefgh',
				[
					{ start: 2, end: 6 },
					{ start: 0, end: 4 },
				],
				{ keepFirst: true },
			),
		).toBe('a*****gh');
	});

	it('masks the family emoji inside a span as ONE cluster', () => {
		const text = `a${FAMILY}b`;
		const censored = censorText(text, [
			{ start: 1, end: 1 + FAMILY.length },
		]);
		expect(censored).toBe('a*b');
	});

	it('expands a span that cuts into the emoji to the whole emoji', () => {
		const text = `a${FAMILY}b`;
		// Span lands strictly inside the ZWJ sequence.
		const censored = censorText(text, [{ start: 3, end: 5 }]);
		expect(censored).toBe('a*b');
	});

	it('supports a custom mask character', () => {
		expect(censorText('fuck', [{ start: 0, end: 4 }], { mask: '#' })).toBe(
			'####',
		);
	});

	it('returns text unchanged for no spans or empty spans', () => {
		expect(censorText('hello', [])).toBe('hello');
		expect(censorText('hello', [{ start: 2, end: 2 }])).toBe('hello');
		expect(censorText('', [{ start: 0, end: 3 }])).toBe('');
	});

	it('clamps out-of-bounds spans', () => {
		expect(censorText('ab', [{ start: -2, end: 100 }])).toBe('**');
	});

	it('leaves no ZWJ or marks behind when masking ZWJ-injected Devanagari', () => {
		const text = 'बहन‍चोद';
		const censored = censorText(text, [{ start: 0, end: text.length }]);
		expect(/[\p{M}‌‍]/u.test(censored)).toBe(false);
		expect(censored).toBe('*'.repeat(graphemeSlices(text).length));
	});
});
