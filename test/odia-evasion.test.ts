/**
 * Odia evasion-resistance suite — the or.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { odia } from '../src/data/or.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [odia, hindi, english] });

const ZWJ = '‍';
const ZWNJ = '‌';
const HALANT = '୍';

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

describe('odia native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'ମାଘିଆ'],
		['in a sentence', 'ତୁ ଏକ ମାଘିଆ'],
		['sister-fucker compound', 'ଭଉଣୀଘିଆ'],
		['spaced compound', 'ଭଉଣୀ ଘିଆ'],
		['unaspirated variant', 'ମାଗିଆ'],
		['arse', 'ଗାଣ୍ଡି'],
		['penis', 'ବାଣ୍ଡ'],
		['adulteress', 'ବେଧେଈ'],
		['bastard phrase', 'ବେଧେଈ ପୁଅ'],
		['vulva (native-script-only entry)', 'ବିଆ'],
		['caste slur (native-script-only entry)', 'ସେ ଏକ ଚଣ୍ଡାଳ'],
		['whore', 'ରଣ୍ଡୀ'],
		['verb', 'ଗେହିବା'],
		['anti-trans slur', 'ହିଞ୍ଜଡ଼ା'],
		['gandu (borrowed layer)', 'ଗାଣ୍ଡୁ'],
		['madarchod (borrowed layer)', 'ମାଦରଚୋଦ'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('odia orthographic variation is folded, not listed', () => {
	it('matches the anusvara spelling of a conjunct cluster', () => {
		// ଗାଣ୍ଡି ≡ ଗାଂଡି, ବାଣ୍ଡ ≡ ବାଂଡ — the nasal + halant fold does this, so
		// neither spelling has to appear in the pack.
		flagged('ଗାଂଡି');
		flagged('ବାଂଡ');
	});

	it('matches the nukta-less spelling of ହିଜଡ଼ା', () => {
		flagged('ହିଜଡା');
	});

	it('matches the candrabindu spelling where a writer uses one', () => {
		flagged('ଗାଁଡି');
	});

	it('matches a stray visarga inside the word', () => {
		flagged('ବାଣ୍ଡଃ');
	});
});

describe('odia script-level evasion', () => {
	it('is not fooled by ZWJ injection', () => {
		flagged(`ଗାଣ${HALANT}${ZWJ}ଡି`);
	});

	it('is not fooled by ZWNJ injection (the conjunct-breaking hint)', () => {
		flagged(`ଗାଣ${HALANT}${ZWNJ}ଡି`);
	});

	it('is not fooled by a doubled halant', () => {
		flagged(`ଗାଣ${HALANT}${HALANT}ଡି`);
	});

	it('is not fooled by a zero-width space mid-word', () => {
		flagged('ମାଘି​ଆ');
	});
});

describe('odia romanized ("Odlish")', () => {
	const cases: [label: string, text: string][] = [
		['motherfucker', 'maghia'],
		['motherfucker in a sentence', 'tu ekta maghia'],
		['spelling variant', 'maagya'],
		['sister-fucker', 'bhaunighia'],
		['sister-fucker spaced', 'to bhauni ghia'],
		['arse', 'gaandi'],
		['penis', 'baanda'],
		['penis phrase', 'banda chhod'],
		['adulteress', 'bedhei'],
		['bastard phrase', 'bedhei pua'],
		['vulva', 'pudi'],
		['slut', 'chhinali'],
		['verb', 'tate gehibi'],
		['anti-trans slur', 'hinjada'],
		['catamite slur', 'gaandia'],
		['borrowed: randi', 'randi'],
		['borrowed: randi puo', 'randi puo'],
		['borrowed: gandu', 'gandu'],
		['borrowed: madarchaut', 'madarchaut'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});
});

describe('odia romanized evasion', () => {
	it('is not fooled by capitals', () => {
		flagged('MAGHIA');
		flagged('GaAnDi');
	});

	it('is not fooled by letter stretching', () => {
		flagged('maghiaaaa');
		flagged('baaaanda');
	});

	it('is not fooled by leet substitution', () => {
		flagged('m@ghia');
		flagged('pud1');
	});

	it('is not fooled by a mask character', () => {
		flagged('mag*ia');
		flagged('gaand*');
	});

	it('is not fooled by fullwidth characters', () => {
		flagged('ｍａｇｈｉａ');
	});

	it('is not fooled by a Cyrillic homoglyph', () => {
		flagged('mаghia'); // U+0430 CYRILLIC SMALL LETTER A
	});

	it('is not fooled by mixed script in one sentence', () => {
		flagged('this ଗାଣ୍ଡି guy again');
		flagged('ସେ ଏକ maghia');
	});
});

describe('the separated tier and Odia', () => {
	// The spelled-out-word tier joins a maximal run of single-CODE-POINT letters
	// and requires the join to equal a listed surface outright.
	it('catches a romanization spelled out one letter at a time', () => {
		flagged('m a g h i a');
		flagged('g.a.a.n.d.i');
	});

	it('cannot fire on native Odia, where every cluster carries a matra', () => {
		// ପ ୁ ଦ ି never joins: ୁ and ି are combining marks, not letters, so the
		// run breaks at the first matra. A miss, deliberately, not a false
		// positive — the alternative rule would delete marks between letters and
		// rewrite every Odia word in the process.
		expect(matcher.isClean('ପ ୁ ଦ ି')).toBe(true);
		expect(matcher.isClean('ଗ ା ଣ ୍ ଡ ି')).toBe(true);
	});

	it('does not resurrect the romanizations this pack deliberately dropped', () => {
		// Whole-run equality means a spelled-out run can only hit a LISTED
		// surface, so 'gandi' and 'banda' stay unmatched here exactly as they do
		// as plain tokens.
		expect(matcher.isClean('g a n d i')).toBe(true);
		expect(matcher.isClean('b a n d a')).toBe(true);
	});
});

describe('odia prefix mode catches attached case suffixes', () => {
	const cases: string[] = [
		'ଗାଣ୍ଡିରେ', // locative
		'ଗାଣ୍ଡିକୁ', // accusative/dative
		'ଗାଣ୍ଡିଠାରୁ', // ablative
		'ତୋ ଗାଣ୍ଡିରେ',
		'gaandire',
		'gaandiku',
	];
	it.each(cases)('flags the inflected form %j', (text) => {
		flagged(text);
	});
});

describe('the pack is self-sufficient on its own', () => {
	// Standing project decision: an `or`-only consumer must get full coverage,
	// including the Latin spellings Odia shares with the Hindi pack. These
	// cases are the ones that would silently go unmatched if the pack deferred
	// them, so they are checked with NO other pack loaded.
	const orOnly: Matcher = createMatcher({ packs: [odia] });

	const cases: string[] = [
		'randi',
		'randi puo',
		'gandu',
		'gaandu',
		'madarchod',
		'madarchaut',
		'maghia',
		'gaandi',
		'ରଣ୍ଡୀ',
		'ମାଦରଚୋଦ',
	];

	it.each(cases)('flags %j with only the or pack loaded', (text) => {
		expect(orOnly.isClean(text)).toBe(false);
	});

	it('reports the match as Odia when only the or pack is loaded', () => {
		const m = orOnly.scan('tu ekta gandu').matches[0]!;
		expect(m.language).toBe('or');
		expect(m.severity).toBe(3);
	});

	it('still resolves to a single match when hi is loaded alongside', () => {
		// Duplicate surfaces across packs are harmless: overlapping candidates
		// collapse to one in the engine's overlap resolution.
		const both = matcher.scan('randi');
		expect(both.matches).toHaveLength(1);
		expect(both.maxSeverity).toBe(4);
	});
});

describe('odia match metadata', () => {
	it('reports language, severity and categories from the pack', () => {
		const { matches, maxSeverity } = flagged('tu ekta maghia');
		const m = matches[0]!;
		expect(m.language).toBe('or');
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('sexual');
		expect(m.casualUse).toBe(true);
		expect(maxSeverity).toBe(4);
	});

	it('censors the whole agglutinated token, not just the stem', () => {
		// The span of a prefix match is extended to the end of the token, so
		// ଗାଣ୍ଡିରେ must not censor as ****ରେ.
		const censored = matcher.censor('ତୋ ଗାଣ୍ଡିରେ');
		expect(censored).not.toContain('ରେ');
		expect(censored).toContain('ତୋ ');
	});

	it('censors a romanized match end to end', () => {
		expect(matcher.censor('tu ekta maghia')).toBe('tu ekta ******');
	});
});
