/**
 * Evasion (recall) acceptance suite — Module G.
 *
 * Every input here must be FLAGGED with default matcher options and the
 * default packs [hindi, english]. Covers leetspeak, repeat stretching,
 * confusable scripts (Mathematical Alphanumeric Symbols), ZWJ injection,
 * casing, native-script Hindi, and the phonetic-skeleton recall tier.
 *
 * Per SPEC.md, "chu+iya" ('+' insertion) and "ch*tiya" (pre-masked text)
 * are intentionally SKIPPED in v0.1 — they are out of scope for this
 * release and are not asserted here.
 *
 * Written against the public API contract in src/types.ts only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Category, Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [hindi, english] });

const VALID_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
	'slur',
	'casteist',
	'religious',
	'gendered',
	'sexual',
	'ableist',
	'violence',
	'general',
]);

/** Map lowercase ASCII letters to Mathematical Bold (U+1D41A ff.). */
function mathBold(s: string): string {
	return [...s]
		.map((ch) => String.fromCodePoint(0x1d41a + ch.charCodeAt(0) - 0x61))
		.join('');
}

const ZWJ = '‍';
/** बहनचोद with a ZWJ injected between every grapheme cluster. */
const zwjBahanchod = ['ब', 'ह', 'न', 'चो', 'द'].join(ZWJ);

const flaggedTexts: string[] = [
	'chutiya',
	'chutiyaaaa',
	'chut1ya',
	'chutiy@',
	'bh0sdike',
	'बहनचोद',
	zwjBahanchod,
	'madarch0d',
	'MADARCHOD',
	mathBold('bhenchod'),
	'fuuuuck',
	'gaandu',
	'behenchod',
	'bahanchod',
	'bsdk',
	'साले मादरचोद',
];

/** Scan, assert the text is flagged, and check span/surface coherence. */
function expectFlagged(text: string): ScanResult {
	const result = matcher.scan(text);
	expect(result.matches.length, `expected ${JSON.stringify(text)} to be flagged`).toBeGreaterThan(0);
	expect(result.maxSeverity).not.toBeNull();
	for (const m of result.matches) {
		// Spans index the ORIGINAL string and slice to the reported surface.
		expect(text.slice(m.start, m.end)).toBe(m.surface);
		expect(m.start).toBeGreaterThanOrEqual(0);
		expect(m.end).toBeGreaterThan(m.start);
		expect(m.end).toBeLessThanOrEqual(text.length);
	}
	return result;
}

describe('evasion suite: obfuscated profanity is flagged with default options', () => {
	it.each(flaggedTexts)('scan(%j) flags the text', (text) => {
		expectFlagged(text);
	});

	it.each(flaggedTexts)('isClean(%j) is false', (text) => {
		expect(matcher.isClean(text)).toBe(false);
	});

	it('behenchod and bahanchod are caught by the skeleton tier', () => {
		for (const text of ['behenchod', 'bahanchod']) {
			const result = expectFlagged(text);
			const m = result.matches[0]!;
			expect(m.tier, `${text} should be a skeleton-tier match`).toBe('skeleton');
		}
	});

	it('chutiya surfaces severity 3 with valid categories and an exact span', () => {
		const result = expectFlagged('chutiya');
		const m = result.matches[0]!;
		expect(m.surface).toBe('chutiya');
		expect(m.start).toBe(0);
		expect(m.end).toBe('chutiya'.length);
		expect(m.severity).toBe(3);
		expect(m.categories.length).toBeGreaterThan(0);
		for (const c of m.categories) expect(VALID_CATEGORIES.has(c)).toBe(true);
	});

	it('MADARCHOD surfaces severity 4 with valid categories', () => {
		const result = expectFlagged('MADARCHOD');
		expect(result.maxSeverity).toBe(4);
		const m = result.matches[0]!;
		expect(m.severity).toBe(4);
		expect(m.categories.length).toBeGreaterThan(0);
		for (const c of m.categories) expect(VALID_CATEGORIES.has(c)).toBe(true);
	});

	it('साले मादरचोद surfaces severity 4 and spans slice to मादरचोद', () => {
		const text = 'साले मादरचोद';
		const result = expectFlagged(text);
		expect(result.maxSeverity).toBe(4);
		const m = result.matches.find((match) => match.surface === 'मादरचोद');
		expect(m, 'expected a match whose surface is मादरचोद').toBeDefined();
		expect(m!.start).toBe(text.indexOf('मादरचोद'));
		expect(m!.end).toBe(text.indexOf('मादरचोद') + 'मादरचोद'.length);
		expect(m!.severity).toBe(4);
		expect(m!.categories.length).toBeGreaterThan(0);
	});

	it('ZWJ injection inside बहनचोद maps back to the full original span', () => {
		const result = expectFlagged(zwjBahanchod);
		const m = result.matches[0]!;
		expect(m.start).toBe(0);
		expect(m.end).toBe(zwjBahanchod.length);
		expect(m.surface).toBe(zwjBahanchod);
		// Stripping the injected joiners recovers the plain word.
		expect(m.surface.split(ZWJ).join('')).toBe('बहनचोद');
	});

	it('mathematical-bold 𝐛𝐡𝐞𝐧𝐜𝐡𝐨𝐝 maps back to the full original span', () => {
		const text = mathBold('bhenchod');
		const result = expectFlagged(text);
		const m = result.matches[0]!;
		expect(m.start).toBe(0);
		expect(m.end).toBe(text.length); // 8 astral code points = 16 code units
		expect(m.surface).toBe(text);
	});

	it('censor() masks flagged text', () => {
		const censored = matcher.censor('yeh chutiya hai');
		expect(censored).not.toContain('chutiya');
		expect(censored).toContain('*');
	});
});
