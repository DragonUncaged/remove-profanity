/**
 * Malayalam evasion-resistance suite — everything here must be FLAGGED.
 *
 * The chillu and old/new-orthography cases are the ones worth reading: the
 * same word, spelled the way three different generations of keyboard spell
 * it, all has to reach the same lemma.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { malayalam } from '../src/data/ml.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [malayalam, hindi, english] });

const ZWJ = '‍';
const ZWNJ = '‌';
const VIRAMA = '്';

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

describe('malayalam native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'പൂറ്'],
		['in a sentence', 'നീ ഒരു പൂറ്'],
		['inflected stem', 'പൂറി'],
		['native-only lemma', 'പണ്ണി'],
		['native-only lemma, infinitive', 'പണ്ണാൻ'],
		['native-only slur', 'കുണ്ടൻ'],
		['caste slur', 'പുലയൻ'],
		['caste slur 2', 'ചെറുമൻ'],
		['compound', 'നായിന്റെ മോൻ'],
		['casual expletive', 'മൈരൻ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('malayalam chillu and orthography evasion', () => {
	it('flags the atomic chillu and the ZWJ sequence identically', () => {
		const atomic = matcher.scan('കുണ്ടൻ');
		const sequence = matcher.scan(`കുണ്ടന${VIRAMA}${ZWJ}`);
		expect(sequence.matches.length).toBeGreaterThan(0);
		expect(sequence.matches[0]!.lemma).toBe(atomic.matches[0]!.lemma);
	});

	it('flags the pre-reform ൻറ spelling as well as the reformed ന്റ', () => {
		const reformed = matcher.scan('നായിന്റെ മോൻ');
		const old = matcher.scan('നായിൻറെ മോൻ');
		expect(old.matches.length).toBeGreaterThan(0);
		expect(old.matches[0]!.lemma).toBe(reformed.matches[0]!.lemma);
		expect(old.maxSeverity).toBe(reformed.maxSeverity);
	});

	it('is not fooled by ZWNJ forcing an unligated conjunct', () => {
		flagged(`കുണ${VIRAMA}${ZWNJ}ണ`);
	});

	it('is not fooled by ZWJ injection', () => {
		flagged(`കുണ${VIRAMA}${ZWJ}ണ`);
	});

	it('is not fooled by a doubled chandrakkala', () => {
		flagged(`കുണ${VIRAMA}${VIRAMA}ണ`);
	});

	it('is not fooled by a visarga glued on', () => {
		flagged('പൂറ്ഃ');
	});
});

describe('romanized malayalam (Manglish) evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'pooru'],
		['in a sentence', 'nee oru thayoli aanu'],
		['uppercase', 'THEVIDISSI'],
		['leetspeak 0', 'p00ru'],
		['leetspeak 3', 'th3ndi'],
		['leetspeak @', 'kunn@'],
		['letter stretching', 'pooruuuu'],
		['letter stretching 2', 'thayoliiii'],
		['mathematical bold', '𝐩𝐨𝐨𝐫𝐮'],
		['fullwidth', 'ｐｏｏｒｕ'],
		['Cyrillic homoglyph', 'pооru'],
		['agglutinated suffix', 'poorimon'],
		['mixed script sentence', 'അവൻ ഒരു thayoli'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('masked tier', () => {
	it('resolves th*yoli against the dictionary', () => {
		const result = flagged('th*yoli');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('തായോളി');
	});

	it('resolves kazhu*eri', () => {
		expect(flagged('kazhu*eri').matches[0]!.tier).toBe('masked');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports severity, categories and language for a caste slur', () => {
		const m = flagged('pulayan').matches[0]!;
		expect(m.lemma).toBe('പുലയൻ');
		expect(m.language).toBe('ml');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
		expect(m.categories).toContain('slur');
	});

	it('flags മൈര് as casualUse (it is also the ordinary word for body hair)', () => {
		const m = flagged('myre').matches[0]!;
		expect(m.casualUse).toBe(true);
		expect(m.severity).toBe(2);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		const result = flagged('chutiya thayoli fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'ml', 'en']),
		);
	});
});

describe('severity and category filters still work on the ml pack', () => {
	it('minSeverity suppresses the mild entries', () => {
		const strict = createMatcher({ packs: [malayalam], minSeverity: 3 });
		expect(strict.isClean('thendi')).toBe(true); // severity 2
		expect(strict.isClean('pooru')).toBe(false); // severity 4
	});

	it('category filter isolates caste slurs', () => {
		const caste = createMatcher({ packs: [malayalam], categories: ['casteist'] });
		expect(caste.isClean('pooru')).toBe(true);
		expect(caste.isClean('pulayan')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Malayalam', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('നീ ഒരു പൂറ്');
		expect(censored.startsWith('നീ ഒരു ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('നീ ഒരു '.length))).toBe(false);
	});

	it('censors a chillu as one grapheme cluster', () => {
		// ൻ is a single code point and a single cluster; the ZWJ sequence is
		// three code points and still one cluster.
		expect(matcher.censor('കുണ്ടൻ')).not.toMatch(/\p{Script=Malayalam}/u);
		expect(matcher.censor(`കുണ്ടന${VIRAMA}${ZWJ}`)).not.toMatch(/\p{Script=Malayalam}/u);
	});

	it('censors the whole agglutinated token, not just the stem', () => {
		expect(matcher.censor('poorimon')).toBe('********');
	});

	it('keepFirst works on romanized Malayalam', () => {
		expect(matcher.censor('thayoli', { keepFirst: true })).toBe('t******');
	});
});

describe('spelled-out letters (separated tier)', () => {
	// The separated tier joins a maximal run of standalone letters and requires
	// the joined run to equal a dictionary surface OUTRIGHT. That makes every
	// romanization in this pack reachable when spelled out — and nothing else.
	const cases: [label: string, text: string][] = [
		['spaces', 'p o o r u'],
		['dots', 'k.u.n.n.a'],
		['hyphens', 't-h-a-y-o-l-i'],
		['underscores', 'm_y_r_e'],
		['mid sentence', 'nee oru p o o r u'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		const result = flagged(text);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('reports the lemma, not a fragment of it', () => {
		expect(flagged('p o o r u').matches[0]!.lemma).toBe('പൂറ്');
	});
});
