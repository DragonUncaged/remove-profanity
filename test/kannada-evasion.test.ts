/**
 * Kannada evasion-resistance suite — everything here must be FLAGGED.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { kannada } from '../src/data/kn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [kannada, hindi, english] });

const ZWJ = '‍';
const ZWNJ = '‌';
const VIRAMA = '್';

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

describe('kannada native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'ತುಲ್ಲು'],
		['in a sentence', 'ನೀನು ಒಬ್ಬ ಸೂಳೆ'],
		['compound abuse', 'ಬೋಳಿಮಗ'],
		['compound abuse 2', 'ಸೂಳೆಮಗನೆ'],
		['native-only lemma', 'ಕುಂಡಿ'],
		['native-only lemma 2', 'ತಿಕ'],
		['anusvara/conjunct doublet', 'ಮುಣ್ಡೆಮಗ'],
		['religious slur', 'ತುರುಕ'],
		['agglutinated prefix', 'ತುಲ್ಲಿನ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('kannada script-level evasion', () => {
	it('is not fooled by ZWJ injection', () => {
		flagged(`ತುಲ${VIRAMA}${ZWJ}ಲು`);
	});

	it('is not fooled by ZWNJ injection', () => {
		flagged(`ತುಲ${VIRAMA}${ZWNJ}ಲು`);
	});

	it('is not fooled by a doubled virama', () => {
		flagged(`ತುಲ${VIRAMA}${VIRAMA}ಲು`);
	});

	it('is not fooled by a visarga glued on', () => {
		flagged('ಸೂಳೆಃ');
	});

	it('flags the anusvara and conjunct spellings identically', () => {
		const sunna = matcher.scan('ಮುಂಡೆಮಗ');
		const conjunct = matcher.scan('ಮುಣ್ಡೆಮಗ');
		expect(sunna.matches[0]!.lemma).toBe(conjunct.matches[0]!.lemma);
		expect(sunna.maxSeverity).toBe(conjunct.maxSeverity);
	});
});

describe('romanized kannada (Kanglish) evasion', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'tullu'],
		['in a sentence', 'nin ajji soolemaga'],
		['uppercase', 'BEVARSI'],
		['leetspeak 0', 's00le'],
		['leetspeak 3', 'b3varsi'],
		['leetspeak @', 'l@udi'],
		['letter stretching', 'tulluuuu'],
		['letter stretching 2', 'sooooolemaga'],
		['mathematical bold', '𝐭𝐮𝐥𝐥𝐮'],
		['fullwidth', 'ｔｕｌｌｕ'],
		['Cyrillic homoglyph', 'bеvarsi'], // е is Cyrillic IE, not Latin e
		['agglutinated suffix, native', 'ತುಲ್ಲಿನ'],
		['mixed script sentence', 'ಅವನು ಒಬ್ಬ bevarsi'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('masked tier', () => {
	it('resolves s*ole against the dictionary', () => {
		const result = flagged('s*ole');
		expect(result.matches[0]!.tier).toBe('masked');
		expect(result.matches[0]!.lemma).toBe('ಸೂಳೆ');
	});

	it('resolves bev*rsi', () => {
		expect(flagged('bev*rsi').matches[0]!.tier).toBe('masked');
	});
});

describe('metadata surfaces correctly', () => {
	it('reports the religious slur category', () => {
		const m = flagged('turuka').matches[0]!;
		expect(m.language).toBe('kn');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('religious');
		expect(m.categories).toContain('slur');
	});

	it('does not flag the descriptive caste phrase at all', () => {
		// The caste-term decision (2026-08-14): ಕೀಳು ಜಾತಿ ("low caste") is a
		// category written about — by journalists, historians and anti-caste
		// activists — not an epithet aimed at a person. Removed, not lowered:
		// the default minSeverity is 0, so a retained entry would still be
		// censored for a default consumer.
		expect(matcher.isClean('ಕೀಳು ಜಾತಿ')).toBe(true);
		expect(matcher.isClean('keelu jaati')).toBe(true);
	});

	it('reports maxSeverity across a mixed-language sentence', () => {
		const result = flagged('chutiya tullu fuck');
		expect(result.maxSeverity).toBe(4);
		expect(new Set(result.matches.map((m) => m.language))).toEqual(
			new Set(['hi', 'kn', 'en']),
		);
	});
});

describe('severity and category filters still work on the kn pack', () => {
	it('minSeverity suppresses the mild entries', () => {
		const strict = createMatcher({ packs: [kannada], minSeverity: 3 });
		expect(strict.isClean('nayimaga')).toBe(true); // severity 2
		expect(strict.isClean('tullu')).toBe(false); // severity 4
	});

	it('category filter isolates the religious slur', () => {
		// kn carries no casteist entry since ಕೀಳು ಜಾತಿ was removed; ತುರುಕ is
		// the pack's identity-slur case now.
		const religious = createMatcher({ packs: [kannada], categories: ['religious'] });
		expect(religious.isClean('tullu')).toBe(true);
		expect(religious.isClean('turuka')).toBe(false);
	});
});

describe('censoring is grapheme-safe in Kannada', () => {
	it('leaves no orphaned combining mark behind', () => {
		const censored = matcher.censor('ನೀನು ಒಬ್ಬ ಸೂಳೆ');
		expect(censored.startsWith('ನೀನು ಒಬ್ಬ ')).toBe(true);
		expect(/[\p{M}]/u.test(censored.slice('ನೀನು ಒಬ್ಬ '.length))).toBe(false);
	});

	it('censors the whole agglutinated token, not just the stem', () => {
		expect(matcher.censor('bolimagane')).toBe('**********');
		expect(matcher.censor('ತುಲ್ಲಿನ')).not.toMatch(/ನ$/);
	});

	it('keepFirst works on romanized Kannada', () => {
		expect(matcher.censor('bevarsi', { keepFirst: true })).toBe('b******');
	});
});

describe('spelled-out letters (separated tier)', () => {
	// The separated tier joins a maximal run of standalone letters and requires
	// the joined run to equal a dictionary surface OUTRIGHT. That makes every
	// romanization in this pack reachable when spelled out — and nothing else.
	const cases: [label: string, text: string][] = [
		['spaces', 't u l l u'],
		['dots', 'b.e.v.a.r.s.i'],
		['hyphens', 's-o-o-l-e'],
		['underscores', 'l_a_u_d_i'],
		['mid sentence', 'nin ajji t u l l u'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		const result = flagged(text);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('reports the lemma, not a fragment of it', () => {
		expect(flagged('t u l l u').matches[0]!.lemma).toBe('ತುಲ್ಲು');
	});
});
