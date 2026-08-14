/**
 * Regression suite for the second evasion review (2026-08-14): trailing
 * letter-stretch, Hindi inflection families, and cheap exact variants.
 * Every "flags" case was a confirmed miss before the fixes.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const matcher = createMatcher({ packs: [hindi, english] });

describe('trailing letter-stretch now collapses', () => {
	it.each(['shittt', 'bitchhh', 'fuckkkk', 'lundddd', 'randiii', 'gaanduu'])(
		'%s flags',
		(text) => {
			expect(matcher.isClean(text)).toBe(false);
		},
	);

	it('censoring covers the whole elongated run', () => {
		expect(matcher.censor('shittt')).toBe('******');
	});

	it('doubled letters without a 3+ run still stay clean', () => {
		expect(matcher.isClean('baat pakki ho gayi')).toBe(true);
		expect(matcher.isClean('He was rapping on stage')).toBe(true);
	});
});

describe('Hindi inflection families (exact-tier expander)', () => {
	it.each([
		'chutiyo',
		'chutiyon',
		'chuteya',
		'choothiya',
		'chuutiya',
		'ganduon',
		'gandua',
		'gandus',
		'chodo',
		'chodne',
		'lodu',
		'lowda',
		'bhadwe',
		'bharve',
		'kamino',
		'lundon',
	])('%s flags', (text) => {
		expect(matcher.isClean(text)).toBe(false);
	});

	it('excluded collision words stay clean', () => {
		expect(matcher.isClean('the laundry chute broke')).toBe(true);
		expect(matcher.isClean('they struck the mother lode')).toBe(true);
		expect(matcher.isClean('Amir Khusro wrote qawwalis')).toBe(true);
		expect(matcher.isClean('mere launde aa gaye')).toBe(true);
	});
});

describe('cheap exact variants from the evasion report', () => {
	it.each([
		'niggr',
		'fuk',
		'fukk',
		'fcuk',
		'fvck',
		'cvnt',
		'azzhole',
		'biatch',
		'beeyotch',
		'muthafucka',
		'dumbfuck',
		'fuckface',
		'bhosadi',
		'bhonsdike',
		'madarchut',
		'madarchoot',
	])('%s flags', (text) => {
		expect(matcher.isClean(text)).toBe(false);
	});
});
