/**
 * `matchMode: 'prefix'` boundary suite for the Kannada pack.
 *
 * Both halves of every prefix entry are proved here: that it catches the
 * inflections it exists for, and that it leaves alone the innocent words that
 * share its opening. Kannada supplied the two cleanest examples in this
 * repo of each failure mode —
 *
 *   ಬೋಳಿ-  opens ಬೋಳಿಸು "to shave" and its whole inflectional family;
 *   ತುಲ್ಲು  sits one letter from ತುಳು, the Tulu language and its people, and
 *          the repeat-collapsing pass narrows that gap further.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { kannada } from '../src/data/kn.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [kannada] });
const prefixEntries = kannada.entries.filter((e) => e.matchMode === 'prefix');

describe('prefix mode: the entries that use it', () => {
	it('is used by exactly the lemmas this suite covers', () => {
		expect(prefixEntries.map((e) => e.lemma).sort()).toEqual(['ಬೋಳಿ', 'ತುಲ್ಲು'].sort());
	});
});

describe('prefix mode CATCHES the inflected forms it exists for', () => {
	const inflections: [stem: string, inflected: string][] = [
		['ತುಲ್ಲು', 'ತುಲ್ಲಿನ'],
		['ತುಲ್ಲು', 'ತುಲ್ಲಲ್ಲಿ'],
		['ತುಲ್ಲು', 'ತುಲ್ಲುಮುಚ್ಕೊ'],
		['ಬೋಳಿ', 'ಬೋಳಿಮಗ'],
		['ಬೋಳಿ', 'ಬೋಳಿಮಗನೆ'],
		['ಬೋಳಿ', 'ಬೋಳಿಯ'],
		// Romanized: the same suffixes typed on an English keyboard.
		['ಬೋಳಿ', 'bolimagane'],
		['ಬೋಳಿ', 'bolimagalu'],
	];

	it.each(inflections)('%s matches its inflection %j', (lemma, text) => {
		const result = matcher.scan(text);
		expect(result.matches.map((m) => m.lemma)).toContain(lemma);
	});

	it('extends the match span over the whole agglutinated token', () => {
		const text = 'ತುಲ್ಲುಮುಚ್ಕೊ';
		const m = matcher.scan(text).matches[0]!;
		expect(m.start).toBe(0);
		// The reported end lands on the start of the final grapheme cluster;
		// censorText compensates, which the next assertion checks.
		expect(m.end).toBeGreaterThanOrEqual(text.length - 1);
		expect(matcher.censor(text)).not.toMatch(/\p{Script=Kannada}/u);
	});

	it('extends over a romanized suffix too', () => {
		expect(matcher.censor('bolimagane')).toBe('**********');
	});
});

describe('prefix mode does NOT swallow innocent words', () => {
	const innocent: [why: string, text: string][] = [
		['ಬೋಳಿಸು "to shave" opens with the ಬೋಳಿ prefix', 'ಬೋಳಿಸು'],
		['…its past form', 'ಅವನು ತಲೆ ಬೋಳಿಸಿದ'],
		['…and its reflexive', 'ತಲೆ ಬೋಳಿಸಿಕೊಂಡ'],
		['…romanized', 'bolisu'],
		['…romanized, inflected', 'bolisikondu bandanu'],
		['Tulu, the language', 'Tulu is a Dravidian language'],
		['Tulu Nadu, the region', 'tulu nadu heritage'],
		['Tuluva, the people', 'Tuluva culture'],
	];

	it.each(innocent)('stays clean — %s: %j', (_why, text) => {
		const result = matcher.scan(text);
		expect(result.matches, JSON.stringify(result.matches)).toEqual([]);
	});

	it('suppresses an allowlisted stem through its whole inflectional family', () => {
		// Allowlist phrases are matched as substrings, so allowlisting the two
		// stems ಬೋಳಿಸು / ಬೋಳಿಸಿ covers every form built on them without
		// enumerating the paradigm.
		for (const form of ['ಬೋಳಿಸುವ', 'ಬೋಳಿಸಿದರು', 'ಬೋಳಿಸಿಕೊಳ್ಳಲು']) {
			expect(matcher.isClean(form), form).toBe(true);
		}
	});
});

describe('prefix mode still respects the START boundary', () => {
	const embedded = ['xtullu', 'abolimaga', 'nottullu', 'reallytullu'];

	it.each(embedded)('does not match mid-token: %j', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('matches the same stems when they do start a token', () => {
		for (const text of ['tullu', 'bolimaga']) {
			expect(matcher.isClean(text), text).toBe(false);
		}
	});
});

describe('every prefix surface form is defended', () => {
	it('has an allowlist and a safe minimum length', () => {
		for (const entry of prefixEntries) {
			expect((entry.allowlist ?? []).length, entry.lemma).toBeGreaterThan(0);
			for (const surface of entry.romanizations ?? []) {
				expect(surface.length, `${entry.lemma} → "${surface}"`).toBeGreaterThanOrEqual(4);
			}
			for (const surface of [entry.lemma, ...(entry.variants ?? [])]) {
				expect(surface.length, `${entry.lemma} → "${surface}"`).toBeGreaterThanOrEqual(3);
			}
		}
	});
});
