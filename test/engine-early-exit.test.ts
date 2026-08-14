/**
 * Two engine optimisations that must be invisible from the outside.
 *
 * 1. `isClean` stops at the first surviving candidate instead of running
 *    every tier, sorting and building match objects. Its answer must still be
 *    exactly `scan(text).matches.length === 0` for every input — including
 *    the ones where a candidate exists but is vetoed by an allow span or by
 *    the severity / category filters, which is where a naive early exit gets
 *    it wrong.
 * 2. Pass 2 is not built when the loaded packs contribute no skeleton keys.
 *    English contributes none, so an English-only consumer skips the fold and
 *    the automaton run entirely — and must get identical results either way.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';
import { bengali } from '../src/data/bn.js';

const CORPUS = [
	// clean
	'hello there, how is your day going today',
	'the shop opens at nine tomorrow morning',
	'kya haal hai bhai, sab theek?',
	'mera naam ankit hai aur main dilli se hoon',
	'',
	'   ',
	'12345 !!! ???',
	'நான் நாளை வருகிறேன்',
	'আমি কাল আসব',
	// allowlist-protected (a candidate exists and is then vetoed)
	'the banked turn was sharp',
	'mahatma gandhi was born in porbandar',
	'chicken tikka with mint chutney',
	'moby dick is a long book',
	'scunthorpe is in north lincolnshire',
	'i visited penistone last summer',
	'shiitake mushrooms are delicious',
	// profane, one per tier
	'you are a fucking idiot',
	'bhosdike kya kar raha hai',
	'f*ck this',
	'f u c k off',
	'behenchod',
	'fuuuuck',
	'चूतिया',
	// profanity late in a long string — the early exit must not miss it
	`${'ordinary words here and there '.repeat(200)} bhosdike`,
	// profanity early in a long string — the case the early exit is for
	`bhosdike ${'ordinary words here and there '.repeat(200)}`,
];

const MATCHERS: [string, ReturnType<typeof createMatcher>][] = [
	['all four packs', createMatcher({ packs: [hindi, english, tamil, bengali] })],
	['english only', createMatcher({ packs: [english] })],
	['skeleton off', createMatcher({ packs: [hindi, english], skeletonTier: false })],
	['masked off', createMatcher({ packs: [hindi, english], maskedTier: false })],
	['minSeverity 4', createMatcher({ packs: [hindi, english], minSeverity: 4 })],
	['sexual only', createMatcher({ packs: [hindi, english], categories: ['sexual'] })],
	['custom words', createMatcher({ packs: [english], customWords: ['frobnicate'] })],
];

describe('isClean agrees with scan on every input', () => {
	for (const [label, matcher] of MATCHERS) {
		it(`${label}`, () => {
			for (const text of CORPUS) {
				expect(matcher.isClean(text), JSON.stringify(text)).toBe(
					matcher.scan(text).matches.length === 0,
				);
			}
		});
	}

	it('holds for a filter that removes the only candidate', () => {
		// severity 4 only: a severity-2 hit leaves scan() empty, so isClean
		// must not report the text as dirty just because a candidate existed.
		const strict = createMatcher({ packs: [english], minSeverity: 4 });
		const loose = createMatcher({ packs: [english] });
		const text = 'what a bollocks mess';
		expect(loose.scan(text).matches.length).toBeGreaterThan(0);
		expect(strict.isClean(text)).toBe(strict.scan(text).matches.length === 0);
	});
});

describe('skipping pass 2 when no pack contributes skeleton keys', () => {
	const on = createMatcher({ packs: [english] });
	const off = createMatcher({ packs: [english], skeletonTier: false });

	it('English-only results are identical with the tier on and off', () => {
		for (const text of CORPUS) {
			expect(on.scan(text), JSON.stringify(text)).toEqual(off.scan(text));
			expect(on.isClean(text), JSON.stringify(text)).toBe(off.isClean(text));
		}
	});

	it('English contributes no skeleton keys at all', () => {
		// The premise of the optimisation. If a future en entry gains a
		// skeleton key this fails loudly rather than the skip going wrong.
		expect(on.scan('behenchod').matches.map((m) => m.tier)).not.toContain('skeleton');
		const withHindi = createMatcher({ packs: [hindi] });
		expect(withHindi.scan('bahanchod').matches.map((m) => m.tier)).toContain('skeleton');
	});
});
