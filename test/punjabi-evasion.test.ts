/**
 * Punjabi evasion-resistance suite — the pa.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { punjabi } from '../src/data/pa.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [punjabi, hindi, english] });
const paOnly: Matcher = createMatcher({ packs: [punjabi] });

const ZWJ = '‍';
const ZWNJ = '‌';
const TIPPI = 'ੰ';
const BINDI = 'ਂ';
const NUKTA = '਼';

/** Scan, assert the text is flagged, and check span/surface coherence. */
function flagged(text: string, m: Matcher = matcher): ScanResult {
	const result = m.scan(text);
	expect(result.matches.length, `expected a match in ${JSON.stringify(text)}`).toBeGreaterThan(0);
	for (const match of result.matches) {
		expect(text.slice(match.start, match.end)).toBe(match.surface);
		expect(match.start).toBeGreaterThanOrEqual(0);
		expect(match.end).toBeLessThanOrEqual(text.length);
		expect(match.language).toBeTruthy();
	}
	return result;
}

describe('gurmukhi native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'ਫੁੱਡੀ'],
		['in a sentence', 'ਤੂੰ ਇੱਕ ਫੁੱਡੀ ਹੈਂ'],
		['dental spelling', 'ਫੁੱਦੀ'],
		['addak dropped (casual typing)', 'ਫੁਡੀ'],
		['caste slur', 'ਓਹ ਇੱਕ ਚੂਹੜਾ ਹੈ'],
		['shared with Hindi, unreachable from the hi pack', 'ਮਾਦਰਚੋਦ'],
		['and another', 'ਭੋਸੜੀਕੇ'],
		['nukta omitted', 'ਗਸਤੀ'],
		['nukta typed', 'ਗਸ਼ਤੀ'],
		['phrase', 'ਖਸਮਾਂ ਨੂੰ ਖਾਣੀ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});

	it('flags Gurmukhi text with the pa pack alone', () => {
		// The point of the pack: hi + en cannot see any of this.
		const hiEn = createMatcher({ packs: [hindi, english] });
		for (const text of ['ਮਾਦਰਚੋਦ', 'ਫੁੱਡੀ', 'ਚੂਹੜਾ']) {
			expect(hiEn.isClean(text), `hi+en should not see ${text}`).toBe(true);
			expect(paOnly.isClean(text), `pa should see ${text}`).toBe(false);
		}
	});
});

describe('gurmukhi script-level evasion', () => {
	it('is not fooled by ZWJ or ZWNJ injection', () => {
		flagged(`ਫੁ${ZWJ}ੱਡੀ`);
		flagged(`ਚੂਹ${ZWNJ}ੜਾ`);
	});

	it('is not fooled by a stray nukta', () => {
		flagged(`ਫੁੱਡ${NUKTA}ੀ`);
	});

	it('treats tippi and bindi as the same nasal', () => {
		// The most common Punjabi typing error, and therefore the most
		// convenient accidental evasion.
		const withTippi = `ਕ${TIPPI}ਜਰ`;
		const withBindi = `ਕ${BINDI}ਜਰ`;
		expect(matcher.scan(withTippi).matches[0]!.lemma).toBe('ਕੰਜਰ');
		expect(matcher.scan(withBindi).matches[0]!.lemma).toBe('ਕੰਜਰ');
	});

	it('is not fooled by an adak bindi standing in for a bindi', () => {
		flagged('ਕਁਜਰ');
	});
});

describe('romanized punjabi (Punglish) evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'phuddi'],
		['f-spelling', 'fuddi'],
		['in a sentence', 'tu ik phuddi hai'],
		['uppercase', 'BHAINCHOD'],
		['p-initial punjabi form', 'painchod'],
		['and the short one', 'penchod'],
		['caste slur', 'chuhra'],
		['caste slur, other transliteration of ੜ', 'chuhda'],
		['leetspeak 1', 'phudd1'],
		['leetspeak @', 'k@njar'],
		['leetspeak 0', 'ch00hra'],
		['letter stretching', 'kanjaaaar'],
		['mathematical bold', '𝐩𝐡𝐮𝐝𝐝𝐢'],
		['fullwidth', 'ｇａｓｈｔｉ'],
		['Cyrillic homoglyph', 'kаnjаr'],
		['phrase', 'khasma nu khani'],
		['mixed script sentence', 'ਤੂੰ ਇੱਕ chuhra ਹੈਂ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('skeleton tier', () => {
	it('catches an unlisted bhainchod spelling through the "bnkd" key', () => {
		const result = flagged('bhaeynchodd', paOnly);
		expect(result.matches[0]!.tier).toBe('skeleton');
		expect(result.matches[0]!.lemma).toBe('ਭੈਣਚੋਦ');
	});
});

describe('masked tier', () => {
	it('resolves ph*ddi against the dictionary', () => {
		const result = flagged('ph*ddi');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('ਫੁੱਡੀ');
	});

	it('resolves ka*jar', () => {
		expect(flagged('ka*jar').matches[0]!.tier).toBe('masked');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports severity, categories and language for a caste slur', () => {
		const m = flagged('chuhra').matches[0]!;
		expect(m.lemma).toBe('ਚੂਹੜਾ');
		expect(m.language).toBe('pa');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
		expect(m.categories).toContain('slur');
	});

	it('flags ਸਾਲਾ as casualUse', () => {
		const m = flagged('ਸਾਲਾ', paOnly).matches[0]!;
		expect(m.casualUse).toBe(true);
		expect(m.severity).toBe(2);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		// 'bakchod' is hi-only and 'phuddi' pa-only; a shared spelling like
		// 'chutiya' would attribute to whichever pack came first, which is the
		// documented cost of self-sufficiency, not a fact about the sentence.
		const result = flagged('bakchod phuddi fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'pa', 'en']),
		);
	});

	it('attributes a shared spelling to whichever pack was passed first', () => {
		const paFirst = createMatcher({ packs: [punjabi, hindi, english] });
		const hiFirst = createMatcher({ packs: [hindi, punjabi, english] });
		expect(paFirst.scan('chutiya').matches.map((m) => m.language)).toEqual(['pa']);
		expect(hiFirst.scan('chutiya').matches.map((m) => m.language)).toEqual(['hi']);
	});
});

describe('the pa pack is self-sufficient', () => {
	// The project rule: data/pa alone must give full coverage, including the
	// Latin spellings Punjabi shares with Hindi.
	const shared = [
		'madarchod',
		'oye madarchod',
		'randi',
		'chamar',
		'bhangi',
		'gaand',
		'chut',
		'chutiya',
		'kutti',
		'harami',
		'kamina',
		'lund',
		'bhosdike',
	];
	it.each(shared)('pa ALONE flags the shared spelling %j', (text) => {
		flagged(text, paOnly);
	});

	it('pa alone reaches the same severity as hi does on those words', () => {
		const hiOnly = createMatcher({ packs: [hindi] });
		for (const text of ['madarchod', 'randi', 'chamar', 'gaand', 'chut']) {
			expect(paOnly.scan(text).maxSeverity, text).toBe(hiOnly.scan(text).maxSeverity);
		}
	});
});

describe('separated (spelled-out) tier on Punjabi', () => {
	// The tier main added while this pack was in flight. Because pa now ships
	// short Latin patterns like 'gand', 'chut' and 'lund', the spelled-out
	// runs that reach them have to be checked against the pa pack ALONE.
	const mustFlag = [
		['spelled-out punjabi', 'p h u d d i'],
		['dotted', 'c.h.u.h.r.a'],
		['hyphenated', 'g-a-s-h-t-i'],
		['spelled-out shared spelling', 'm a d a r c h o d'],
	];
	it.each(mustFlag)('flags %s: %j', (_label, text) => {
		flagged(text, paOnly);
	});

	const mustBeClean = [
		['the allowlist phrase survives the run', 'l u n d university'],
		['and so does Gandhi', 'g a n d h i was born in Porbandar'],
		['acronyms', 'the F.B.I. and the C.I.A. agreed'],
		['initialisms', 'R.S.V.P. by Friday, e.g. today'],
		['hyphenated words', 'T-shirt, e-mail, x-ray, co-op'],
		['spelled out clean', 'it is spelled c a t s'],
		['keyboard row', 'q w e r t y'],
		['gurmukhi letters recited', 'ੳ ਅ ੲ ਸ ਹ'],
		['gurmukhi single-letter words', 'ਓ ਏ ਆ'],
	];
	it.each(mustBeClean)('stays clean — %s: %j', (_label, text) => {
		expect(paOnly.scan(text).matches, JSON.stringify(paOnly.scan(text).matches)).toEqual([]);
	});
});

describe('severity and category filters work on the pa pack', () => {
	it('minSeverity suppresses the mild entries', () => {
		const strict = createMatcher({ packs: [punjabi], minSeverity: 3 });
		expect(strict.isClean('pendu')).toBe(true); // severity 1
		expect(strict.isClean('phuddi')).toBe(false); // severity 4
	});

	it('category filter isolates caste slurs', () => {
		const caste = createMatcher({ packs: [punjabi], categories: ['casteist'] });
		expect(caste.isClean('phuddi')).toBe(true);
		expect(caste.isClean('chuhra')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Gurmukhi', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('ਤੂੰ ਇੱਕ ਫੁੱਡੀ');
		expect(censored.startsWith('ਤੂੰ ਇੱਕ ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('ਤੂੰ ਇੱਕ '.length))).toBe(false);
	});

	it('censors a romanized token whole', () => {
		expect(matcher.censor('phuddi')).toBe('******');
	});

	it('keepFirst works on romanized Punjabi', () => {
		expect(matcher.censor('phuddi', { keepFirst: true })).toBe('p*****');
	});
});
