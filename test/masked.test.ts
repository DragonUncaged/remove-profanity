/**
 * Masked-character tier (f*ck, bh#sdike, चू*िया): input-side single-char
 * wildcards resolved against the dictionary — the capability obscenity gets
 * from `?` wildcards in its pattern DSL.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const matcher = createMatcher({ packs: [hindi, english] });

describe('masked tokens resolve against the dictionary', () => {
	it.each([
		'f*ck',
		'f**k',
		'f#ck',
		'sh*t',
		'b*tch',
		'ch*tiya',
		'chut*ya',
		'bh*sdike',
		'g*ndu',
		'r*ndi',
		'चू*िया',
	])('%s flags', (text) => {
		const result = matcher.scan(text);
		expect(result.matches.length, `expected ${text} to flag`).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('masked');
	});

	it('reports correct spans and censors cleanly', () => {
		const m = matcher.scan('kya bh*sdike yaar').matches[0]!;
		expect(m.surface).toBe('bh*sdike');
		expect(matcher.censor('kya bh*sdike yaar')).toBe('kya ******** yaar');
	});

	it('an exact match on the same span outranks a masked one', () => {
		expect(matcher.scan('chutiya').matches[0]!.tier).toBe('exact');
	});
});

/**
 * The tier reads every non-collapsed exact pass, not just pass 0, so a token
 * may mix masks with leet and confusable characters. It cannot read the
 * richest pass ALONE, because '@' and '$' are both leet characters and mask
 * characters: pass 1 spends them as letters, so a token that needs them as
 * wildcards only ever resolves in pass 0. Each pass sees the masks the other
 * has spent.
 */
describe('masked tokens that also carry leet characters', () => {
	it.each([
		'b!t*h',    // ! -> i in pass 1, * still a mask
		'b1t*h',
		'$h*t',     // $ -> s in pass 1
		'ph*ck',    // ph -> f in pass 1
		'chu*!ya',
		'r*nd!',
	])('%s flags on the folded pass', (text) => {
		const result = matcher.scan(text);
		expect(result.matches.length, `expected ${text} to flag`).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('masked');
	});

	it('ch@t*ya still flags on pass 0, where @ is a mask and not a letter', () => {
		// On the folded pass this is "chat*ya", which matches nothing. The
		// tier only catches it because pass 0 is still consulted.
		const result = matcher.scan('ch@t*ya');
		expect(result.matches.length).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('masked');
	});

	it('reports one match, not one per pass', () => {
		expect(matcher.scan('b!t*h').matches).toHaveLength(1);
	});
});

describe('masked-tier precision rules', () => {
	it.each([
		'C# is a language',           // mask at token edge
		'50% off today',              // pure-mask token
		'100% genuine',               // pure-mask token
		'email me user@example.com',  // no same-length dictionary word aligns
		'*ck',                        // mask at edge
		'f*',                         // mask at edge
		'a$$',                        // masks not fewer than visible chars
		'see y@ l8r',                 // y@ too short / edge
		// Ordinary text where the extra folded pass gives the tier a second
		// chance to be wrong: leet characters and masks in the same token.
		'ping me at ankit@work.io tomorrow',
		'p@ssword reset link',
		'the a$$et class returned 7%',
		'st@ck overflow',
		'm@il me the f!le',
		'save $5 on the #1 selling item',
		'gr@de 4 st33l',
		'the M*A*S*H finale',
		'b*y one get one free',
		'w*rk in progress',
	])('%s stays clean', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('maskedTier: false disables the tier', () => {
		const off = createMatcher({ packs: [hindi, english], maskedTier: false });
		expect(off.isClean('f*ck')).toBe(true);
		expect(off.isClean('fuck')).toBe(false);
	});
});
