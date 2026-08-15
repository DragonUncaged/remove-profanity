/**
 * Gujarati evasion-resistance suite — the gu.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { gujarati } from '../src/data/gu.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [gujarati, hindi, english] });
const guOnly: Matcher = createMatcher({ packs: [gujarati] });

const ZWJ = '‍';
const ZWNJ = '‌';
const VIRAMA = '્';
const CANDRABINDU = 'ઁ';

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

describe('gujarati native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'ભોસડીના'],
		['in a sentence', 'તું એક ભોસડીના છે'],
		['anusvara spelling', 'ભોંસડીના'],
		['caste slur', 'એ ઢેડ છે'],
		['caste slur 2', 'વાઘરી'],
		['gendered slur', 'છિનાળ'],
		['shared with Hindi, unreachable from the hi pack', 'માદરચોદ'],
		['and another', 'ચૂતિયો'],
		['conjunct', 'લુચ્ચો'],
		['phrase', 'રાંડનો દીકરો'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});

	it('flags Gujarati text with the gu pack alone', () => {
		const hiEn = createMatcher({ packs: [hindi, english] });
		for (const text of ['માદરચોદ', 'ચૂતિયો', 'ઢેડ']) {
			expect(hiEn.isClean(text), `hi+en should not see ${text}`).toBe(true);
			expect(guOnly.isClean(text), `gu should see ${text}`).toBe(false);
		}
	});
});

describe('gujarati script-level evasion', () => {
	it('is not fooled by ZWJ or ZWNJ injection', () => {
		flagged(`ભોસ${ZWJ}ડીના`);
		flagged(`લુચ${ZWNJ}્ચો`);
	});

	it('is not fooled by a candrabindu standing in for the anusvara', () => {
		flagged(`ભો${CANDRABINDU}સડીના`);
	});

	it('is not fooled by a doubled virama inside the conjunct', () => {
		flagged(`લુચ${VIRAMA}${VIRAMA}ચો`);
	});

	it('matches the conjunct and anusvara spellings of the same word identically', () => {
		// The nasal+virama fold Gurmukhi and Tamil refuse, doing its job here.
		const conjunct = matcher.scan('ગાન્ડ');
		const anusvara = matcher.scan('ગાંડ');
		expect(conjunct.matches[0]!.lemma).toBe(anusvara.matches[0]!.lemma);
		expect(conjunct.maxSeverity).toBe(anusvara.maxSeverity);
	});
});

describe('romanized gujarati evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'bhosdina'],
		['in a sentence', 'tu ek bhosdina che'],
		['uppercase', 'CHHINAL'],
		['caste slur', 'dhed'],
		['caste slur 2', 'vaghri'],
		['leetspeak 1', 'chh1nal'],
		['leetspeak @', 'h@lkat'],
		['leetspeak 0', 'bh0sdina'],
		['letter stretching', 'baylooooo'],
		['mathematical bold', '𝐛𝐡𝐨𝐬𝐝𝐢𝐧𝐚'],
		['fullwidth', 'ｃｈｈｉｎａｌ'],
		['Cyrillic homoglyph', 'rаkhdel'],
		['phrase', 'randno dikro'],
		['mixed script sentence', 'તું એક baylo છે'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('skeleton tier', () => {
	it('catches an unlisted bhosdina spelling through the "bsdn" key', () => {
		const result = flagged('bhosadeena', guOnly);
		expect(result.matches[0]!.tier).toBe('skeleton');
		expect(result.matches[0]!.lemma).toBe('ભોસડીના');
	});
});

describe('masked tier', () => {
	it('resolves chh*nal against the dictionary', () => {
		const result = flagged('chh*nal');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('છિનાળ');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports severity, categories and language for a caste slur', () => {
		const m = flagged('dhed').matches[0]!;
		expect(m.lemma).toBe('ઢેડ');
		expect(m.language).toBe('gu');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
	});

	it('flags સાળો as casualUse', () => {
		const m = flagged('સાળો', guOnly).matches[0]!;
		expect(m.casualUse).toBe(true);
		expect(m.severity).toBe(2);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		// 'bakchod' is hi-only and 'bhosdina' gu-only; a shared spelling would
		// attribute to whichever pack came first, which is the documented cost
		// of self-sufficiency rather than a fact about the sentence.
		const result = flagged('bakchod bhosdina fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'gu', 'en']),
		);
	});

	it('attributes a shared spelling to whichever pack was passed first', () => {
		const guFirst = createMatcher({ packs: [gujarati, hindi, english] });
		const hiFirst = createMatcher({ packs: [hindi, gujarati, english] });
		expect(guFirst.scan('madarchod').matches.map((m) => m.language)).toEqual(['gu']);
		expect(hiFirst.scan('madarchod').matches.map((m) => m.language)).toEqual(['hi']);
	});
});

describe('the gu pack is self-sufficient', () => {
	const shared = [
		'madarchod',
		'ae madarchod',
		'bhenchod',
		'randi',
		'chamar',
		'bhangi',
		'gaand',
		'chut',
		'chutiyo',
		'harami',
		'kamino',
		'lund',
		'lavdo',
	];
	it.each(shared)('gu ALONE flags the shared spelling %j', (text) => {
		flagged(text, guOnly);
	});

	it('gu alone reaches the same severity as hi does on those words', () => {
		const hiOnly = createMatcher({ packs: [hindi] });
		for (const text of ['madarchod', 'randi', 'chamar', 'gaand', 'chut']) {
			expect(guOnly.scan(text).maxSeverity, text).toBe(hiOnly.scan(text).maxSeverity);
		}
	});
});

describe('separated (spelled-out) tier on Gujarati', () => {
	const mustFlag = [
		['spelled-out gujarati', 'b h o s d i n a'],
		['dotted', 'c.h.h.i.n.a.l'],
		['hyphenated', 'v-a-g-h-r-i'],
		['spelled-out shared spelling', 'm a d a r c h o d'],
	];
	it.each(mustFlag)('flags %s: %j', (_label, text) => {
		flagged(text, guOnly);
	});

	const mustBeClean = [
		['the allowlist phrase survives the run', 'l u n d university'],
		['and so does Gandhi', 'g a n d h i was born in Porbandar'],
		['acronyms', 'the F.B.I. and the C.I.A. agreed'],
		['initialisms', 'R.S.V.P. by Friday, e.g. today'],
		['hyphenated words', 'T-shirt, e-mail, x-ray, co-op'],
		['spelled out clean', 'it is spelled c a t s'],
		['keyboard row', 'q w e r t y'],
		['gujarati letters recited', 'ક ખ ગ ઘ ચ'],
		['gujarati single-letter particle', 'એ જ છે'],
	];
	it.each(mustBeClean)('stays clean — %s: %j', (_label, text) => {
		expect(guOnly.scan(text).matches, JSON.stringify(guOnly.scan(text).matches)).toEqual([]);
	});
});

describe('severity and category filters work on the gu pack', () => {
	it('minSeverity suppresses the moderate entries', () => {
		const strict = createMatcher({ packs: [gujarati], minSeverity: 3 });
		expect(strict.isClean('halkat')).toBe(true); // severity 2
		expect(strict.isClean('bhosdina')).toBe(false); // severity 4
	});

	it('category filter isolates caste slurs', () => {
		const caste = createMatcher({ packs: [gujarati], categories: ['casteist'] });
		expect(caste.isClean('bhosdina')).toBe(true);
		expect(caste.isClean('vaghri')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Gujarati', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('તું એક ભોસડીના');
		expect(censored.startsWith('તું એક ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('તું એક '.length))).toBe(false);
	});

	it('censors a romanized token whole', () => {
		expect(matcher.censor('bhosdina')).toBe('********');
	});

	it('keepFirst works on romanized Gujarati', () => {
		expect(matcher.censor('bhosdina', { keepFirst: true })).toBe('b*******');
	});
});
