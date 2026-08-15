/**
 * Telugu evasion-resistance suite — everything here must be FLAGGED.
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { telugu } from '../src/data/te.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [telugu, hindi, english] });

const ZWJ = '‍';
const ZWNJ = '‌';
const VIRAMA = '్';

/** Scan, assert the text is flagged, and check span/surface coherence. */
function flagged(text: string): ScanResult {
	const result = matcher.scan(text);
	expect(result.matches.length, `expected a match in ${JSON.stringify(text)}`).toBeGreaterThan(0);
	for (const m of result.matches) {
		expect(text.slice(m.start, m.end)).toBe(m.surface);
		expect(m.start).toBeGreaterThanOrEqual(0);
		expect(m.end).toBeLessThanOrEqual(text.length);
		expect(m.language).toBeTruthy();
	}
	return result;
}

describe('telugu native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'లంజ'],
		['in a sentence', 'నువ్వు ఒక లంజ'],
		['agglutinated', 'లంజకొడుకు'],
		['verb stem', 'దెంగు'],
		['verb, inflected', 'దెంగుతా'],
		['caste slur', 'మాదిగోడు'],
		['caste slur 2', 'చండాలుడు'],
		['religious slur', 'తురక'],
		['native-only lemma', 'ముండ'],
		['native-only lemma 2', 'గుద్దలో'],
		['anusvara/conjunct doublet', 'ముణ్డ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('telugu script-level evasion', () => {
	it('is not fooled by ZWJ injection', () => {
		flagged(`మొడ${VIRAMA}${ZWJ}డ`);
	});

	it('is not fooled by ZWNJ injection', () => {
		flagged(`మొడ${VIRAMA}${ZWNJ}డ`);
	});

	it('is not fooled by a doubled virama', () => {
		flagged(`మొడ${VIRAMA}${VIRAMA}డ`);
	});

	it('is not fooled by a visarga glued on', () => {
		flagged('లంజః');
	});

	it('flags the anusvara and conjunct spellings identically', () => {
		const sunna = matcher.scan('ముండ');
		const conjunct = matcher.scan('ముణ్డ');
		expect(sunna.matches[0]!.lemma).toBe(conjunct.matches[0]!.lemma);
		expect(sunna.maxSeverity).toBe(conjunct.maxSeverity);
	});
});

describe('romanized telugu (Tenglish) evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'lanja'],
		['in a sentence', 'nuvvu oka lanja ra'],
		['uppercase', 'DENGU'],
		['leetspeak 0', 'm0dda'],
		['leetspeak 3', 'd3ngu'],
		['leetspeak @', 'l@nja'],
		['letter stretching', 'lanjaaaa'],
		['letter stretching 2', 'poooooku'],
		['mathematical bold', '𝐥𝐚𝐧𝐣𝐚'],
		['fullwidth', 'ｌａｎｊａ'],
		['Cyrillic homoglyph', 'lаnja'],
		['agglutinated suffix', 'dengudu'],
		['mixed script sentence', 'వాడు ఒక lanja'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('masked tier', () => {
	it('resolves l*nja against the dictionary', () => {
		const result = flagged('l*nja');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('లంజ');
	});

	it('resolves chandal*du', () => {
		expect(flagged('chandal*du').matches[0]!.tier).toBe('masked');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports severity, categories and language for a caste slur', () => {
		const m = flagged('malodu').matches[0]!;
		expect(m.lemma).toBe('మాలోడు');
		expect(m.language).toBe('te');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
		expect(m.categories).toContain('slur');
	});

	it('reports the religious slur category', () => {
		const m = flagged('turaka').matches[0]!;
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('religious');
	});

	it('flags పీనుగు as casualUse', () => {
		const m = flagged('peenugu').matches[0]!;
		expect(m.casualUse).toBe(true);
		expect(m.severity).toBe(2);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		const result = flagged('chutiya lanja fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'te', 'en']),
		);
	});
});

describe('severity and category filters still work on the te pack', () => {
	it('minSeverity suppresses the mild entries', () => {
		const strict = createMatcher({ packs: [telugu], minSeverity: 3 });
		expect(strict.isClean('vedhava')).toBe(true); // severity 2
		expect(strict.isClean('lanja')).toBe(false); // severity 4
	});

	it('category filter isolates caste slurs', () => {
		const caste = createMatcher({ packs: [telugu], categories: ['casteist'] });
		expect(caste.isClean('lanja')).toBe(true);
		expect(caste.isClean('malodu')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Telugu', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('నువ్వు ఒక లంజ');
		expect(censored.startsWith('నువ్వు ఒక ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('నువ్వు ఒక '.length))).toBe(false);
	});

	it('censors the whole agglutinated token, not just the stem', () => {
		expect(matcher.censor('lanjakoduku')).toBe('***********');
		expect(matcher.censor('దెంగుతా')).not.toMatch(/తా$/);
	});

	it('keepFirst works on romanized Telugu', () => {
		expect(matcher.censor('lanja', { keepFirst: true })).toBe('l****');
	});
});

describe('spelled-out letters (separated tier)', () => {
	// The separated tier joins a maximal run of standalone letters and requires
	// the joined run to equal a dictionary surface OUTRIGHT. That makes every
	// romanization in this pack reachable when spelled out — and nothing else.
	const cases: [label: string, text: string][] = [
		['spaces', 'l a n j a'],
		['dots', 'd.e.n.g.u'],
		['hyphens', 'm-o-d-d-a'],
		['underscores', 'p_o_o_k_u'],
		['mid sentence', 'nuvvu oka l a n j a ra'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		const result = flagged(text);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('reports the lemma, not a fragment of it', () => {
		expect(flagged('l a n j a').matches[0]!.lemma).toBe('లంజ');
	});
});
