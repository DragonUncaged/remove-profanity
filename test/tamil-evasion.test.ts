/**
 * Tamil evasion-resistance suite — the ta.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [tamil, hindi, english] });

const ZWJ = '‍';
const ZWNJ = '‌';
const PULLI = '்';

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

describe('tamil native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'புண்டை'],
		['in a sentence', 'நீ ஒரு புண்டை'],
		['caste slur in a sentence', 'அவன் ஒரு பறையன் என்றான்'],
		['agglutinated', 'சூத்துல'],
		['degeminated', 'சகிலி'],
		['degeminated 2', 'பொறுகி'],
		['grantha spelling', 'கஸ்மாலம்'],
		['native spelling of a grantha word', 'கச்மாலம்'],
		['ன/ந confusion', 'பறையந்'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('tamil script-level evasion', () => {
	it('is not fooled by ZWJ injection', () => {
		flagged(`புண${PULLI}${ZWJ}டை`);
	});

	it('is not fooled by ZWNJ injection (the standard Tamil pulli hint)', () => {
		flagged(`புண${PULLI}${ZWNJ}டை`);
	});

	it('is not fooled by a doubled pulli', () => {
		flagged(`புண${PULLI}${PULLI}டை`);
	});

	it('is not fooled by an aytham glued to the front', () => {
		flagged('ஃபுண்டை');
	});

	it('flags the grantha and native spellings of the same word identically', () => {
		// Was கீழ்ஜாதி / கீழ்சாதி until that lemma was removed on the
		// caste-term decision of 2026-08-14; கஸ்மாலம் / கச்மாலம் is the same fold.
		const grantha = matcher.scan('கஸ்மாலம்');
		const native = matcher.scan('கச்மாலம்');
		expect(grantha.matches[0]!.lemma).toBe(native.matches[0]!.lemma);
		expect(grantha.maxSeverity).toBe(native.maxSeverity);
	});
});

describe('romanized tamil (Tanglish) evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'pundai'],
		['in a sentence', 'nee oru pundai da'],
		['uppercase', 'THEVIDIYA'],
		['leetspeak 0', 'p00lu'],
		['leetspeak 1', 'thev1diya'],
		['leetspeak @', 'pund@i'],
		['letter stretching', 'pundaiiii'],
		['letter stretching 2', 'sooooothu'],
		['mathematical bold', '𝐩𝐮𝐧𝐝𝐚𝐢'],
		['fullwidth', 'ｐｕｎｄａｉ'],
		['Cyrillic homoglyph', 'pооlu'],
		['agglutinated suffix', 'soothula'],
		['mixed script sentence', 'அவன் ஒரு thevidiya'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('masked tier', () => {
	it('resolves p*ndai against the dictionary', () => {
		const result = flagged('p*ndai');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('புண்டை');
	});

	it('resolves thev*diya', () => {
		expect(flagged('thev*diya').matches[0]!.tier).toBe('masked');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports severity, categories and language for a caste slur', () => {
		const m = flagged('paraiyan').matches[0]!;
		expect(m.lemma).toBe('பறையன்');
		expect(m.language).toBe('ta');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
		expect(m.categories).toContain('slur');
	});

	it('reports the religious slur category', () => {
		const m = flagged('thulukkan').matches[0]!;
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('religious');
	});

	it('flags மயிர் as casualUse (it is also the ordinary word for hair)', () => {
		const m = flagged('mayiru').matches[0]!;
		expect(m.casualUse).toBe(true);
		expect(m.severity).toBe(2);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		const result = flagged('chutiya pundai fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'ta', 'en']),
		);
	});
});

describe('severity and category filters still work on the ta pack', () => {
	it('minSeverity suppresses the mild entries', () => {
		const strict = createMatcher({ packs: [tamil], minSeverity: 3 });
		expect(strict.isClean('loosu')).toBe(true); // severity 1
		expect(strict.isClean('pundai')).toBe(false); // severity 4
	});

	it('category filter isolates caste slurs', () => {
		const caste = createMatcher({ packs: [tamil], categories: ['casteist'] });
		expect(caste.isClean('pundai')).toBe(true);
		expect(caste.isClean('paraiyan')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Tamil', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('நீ ஒரு புண்டை');
		expect(censored.startsWith('நீ ஒரு ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('நீ ஒரு '.length))).toBe(false);
	});

	it('censors the whole agglutinated token, not just the stem', () => {
		expect(matcher.censor('சூத்துல')).not.toMatch(/ல$/);
		expect(matcher.censor('soothula')).toBe('********');
	});

	it('keepFirst works on romanized Tamil', () => {
		expect(matcher.censor('pundai', { keepFirst: true })).toBe('p*****');
	});
});
