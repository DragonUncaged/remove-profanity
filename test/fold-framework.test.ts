/**
 * The fold framework in src/types.ts.
 *
 * These are the shortcuts the whole scan pipeline's speed rests on — a no-op
 * fold returning its input by reference, a lazily-built identity map, and
 * `chainFolds` skipping the remap when either side is the identity. All three
 * are invisible when they work and produce silently wrong offsets when they
 * do not, so the contract is pinned here rather than left to the folds that
 * happen to exercise it.
 */
import { describe, expect, it } from 'vitest';
import {
	chainFolds,
	codePointFold,
	composeFolds,
	FoldBuilder,
	identityFold,
	isAllAscii,
	type FoldResult,
} from '../src/types.js';

const upper = codePointFold((cp) =>
	cp >= 0x41 && cp <= 0x5a ? String.fromCharCode(cp + 0x20) : undefined,
);
const dropX = codePointFold((cp) => (cp === 0x78 ? '' : undefined));
const doubleY = codePointFold((cp) => (cp === 0x79 ? 'yy' : undefined));

describe('identityFold', () => {
	it('returns the input string by reference', () => {
		const input = 'hello world';
		expect(identityFold(input).output).toBe(input);
	});

	it('builds the identity map on demand, and the same array each time', () => {
		const r = identityFold('abc');
		expect(r.map).toEqual([0, 1, 2]);
		expect(r.map).toBe(r.map);
	});

	it('is empty for the empty string', () => {
		expect(identityFold('')).toEqual({ output: '', map: [] });
	});
});

describe('FoldBuilder', () => {
	it('a fold that changes nothing yields the input by reference', () => {
		const input = 'nothing here changes';
		expect(dropX(input).output).toBe(input);
	});

	it('coalesced keeps produce the same map as one-per-character keeps', () => {
		const r = dropX('axbxc');
		expect(r.output).toBe('abc');
		expect(r.map).toEqual([0, 2, 4]);
	});

	it('credits both units of a supplementary code point to its first index', () => {
		const r = dropX('x\u{1D41F}x');
		expect(r.output).toBe('\u{1D41F}');
		expect(r.map).toEqual([1, 1]);
	});

	it('maps every unit of an expansion to the source index', () => {
		const r = doubleY('ayb');
		expect(r.output).toBe('ayyb');
		expect(r.map).toEqual([0, 1, 1, 2]);
	});

	it('keepAt credits a whole span to one source index', () => {
		const b = new FoldBuilder('abcd');
		b.keep(0, 1);
		b.keepAt(1, 2, 1);
		b.keep(3, 1);
		expect(b.finish()).toEqual({ output: 'abcd', map: [0, 1, 1, 3] });
	});

	it('a builder that only keeps is indistinguishable from the identity', () => {
		const b = new FoldBuilder('abc');
		b.keep(0, 1);
		b.keep(1, 1);
		b.keep(2, 1);
		const r = b.finish();
		expect(r.output).toBe('abc');
		expect(r.map).toEqual([0, 1, 2]);
	});
});

describe('chainFolds', () => {
	const first: FoldResult = { output: 'abc', map: [0, 2, 4] };

	it('returns the first result when the second changed nothing', () => {
		expect(chainFolds(first, identityFold('abc'))).toBe(first);
	});

	it('returns the second result when the first was the identity', () => {
		const second: FoldResult = { output: 'ac', map: [0, 2] };
		expect(chainFolds(identityFold('abc'), second)).toBe(second);
	});

	it('remaps through to the original coordinates otherwise', () => {
		const second: FoldResult = { output: 'ac', map: [0, 2] };
		expect(chainFolds(first, second)).toEqual({ output: 'ac', map: [0, 4] });
	});
});

describe('composeFolds', () => {
	it('is the identity with no folds', () => {
		expect(composeFolds()('abc')).toEqual({ output: 'abc', map: [0, 1, 2] });
	});

	it('applies folds left to right with maps back to the original', () => {
		const r = composeFolds(upper, dropX)('AxByC');
		expect(r.output).toBe('abyc');
		expect(r.map).toEqual([0, 2, 3, 4]);
	});

	it('agrees with hand-chained application', () => {
		const input = 'AxByC';
		const step1 = upper(input);
		const step2 = dropX(step1.output);
		expect(composeFolds(upper, dropX)(input)).toEqual(chainFolds(step1, step2));
	});
});

describe('isAllAscii', () => {
	it.each([
		['', true],
		['plain ascii 123!', true],
		['', true],
		['', false],
		['हिंदी', false],
		['naïve', false],
	])('isAllAscii(%j) is %s', (input, expected) => {
		expect(isAllAscii(input)).toBe(expected);
	});
});
