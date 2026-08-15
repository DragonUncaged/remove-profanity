/**
 * `matchMode: 'prefix'` boundary suite for the Telugu pack.
 *
 * Telugu agglutinates case and postposition suffixes onto stems, which is why
 * the pack uses prefix mode at all — and prefix mode is the single most
 * dangerous thing in it, because it fires on any token that STARTS with a
 * listed surface form. Every prefix entry needs both halves proved:
 *   (a) it catches the inflected forms it exists for, and
 *   (b) it does not swallow the innocent words that share its opening.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { telugu } from '../src/data/te.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [telugu] });
const prefixEntries = telugu.entries.filter((e) => e.matchMode === 'prefix');

describe('prefix mode: the entries that use it', () => {
	it('is used by exactly the lemmas this suite covers', () => {
		expect(prefixEntries.map((e) => e.lemma).sort()).toEqual(['దెంగు', 'లంజ'].sort());
	});
});

describe('prefix mode CATCHES the inflected forms it exists for', () => {
	const inflections: [stem: string, inflected: string][] = [
		// Native script: the productive case and compound suffixes.
		['లంజ', 'లంజలు'],
		['లంజ', 'లంజకు'],
		['లంజ', 'లంజని'],
		['లంజ', 'లంజకొడుకు'],
		['లంజ', 'లంజముండ'],
		['దెంగు', 'దెంగుతా'],
		['దెంగు', 'దెంగుడు'],
		['దెంగు', 'దెంగులాట'],
		// Romanized: the same suffixes typed on an English keyboard.
		['లంజ', 'lanjalu'],
		['లంజ', 'lanjaki'],
		['లంజ', 'lanjakoduku'],
		['దెంగు', 'dengutha'],
		['దెంగు', 'dengudu'],
		['దెంగు', 'denginav'],
	];

	it.each(inflections)('%s matches its inflection %j', (lemma, text) => {
		const result = matcher.scan(text);
		expect(result.matches.map((m) => m.lemma)).toContain(lemma);
	});

	it('extends the match span over the whole agglutinated token', () => {
		// Without the prefix span extension, లంజకొడుకు would censor as
		// ***కొడుకు, leaving the suffix dangling.
		const text = 'లంజకొడుకు';
		const m = matcher.scan(text).matches[0]!;
		expect(m.start).toBe(0);
		// The reported end lands on the START of the final grapheme cluster —
		// nfcFold maps every unit of a cluster to the cluster's start index, so
		// a word ending in a combining mark reports one unit short. This is
		// engine-wide and pre-existing; censorText compensates, which is what
		// the next assertion checks.
		expect(m.end).toBeGreaterThanOrEqual(text.length - 1);
		expect(matcher.censor(text)).not.toMatch(/\p{Script=Telugu}/u);
	});

	it('extends over a romanized suffix too', () => {
		expect(matcher.censor('lanjakoduku')).toBe('***********');
		expect(matcher.censor('dengutha')).toBe('********');
	});
});

describe('prefix mode does NOT swallow innocent words', () => {
	// Each case is a word that begins with a prefix surface form but is not
	// profanity. These are the entries' own allowlists doing their job.
	const innocent: [why: string, text: string][] = [
		['"dengue" literally opens with the దెంగు prefix', 'dengue'],
		['…in a sentence', 'the dengue fever season'],
		['…and its longer forms', 'dengue virus serotypes'],
		['Lanja, the Ratnagiri taluka', 'Lanja taluka'],
		['…spelled out', 'Lanja Maharashtra'],
	];

	it.each(innocent)('stays clean — %s: %j', (_why, text) => {
		const result = matcher.scan(text);
		expect(result.matches, JSON.stringify(result.matches)).toEqual([]);
	});

	it('keeps an allowlisted word clean when it is itself inflected', () => {
		// Allowlist suppression is tested against the UNEXTENDED stem span, so
		// an allowlisted word plus a suffix must stay suppressed.
		expect(matcher.isClean('dengue-like illness')).toBe(true);
	});
});

describe('prefix mode still respects the START boundary', () => {
	// Prefix mode relaxes the END boundary only. A profane stem buried in the
	// MIDDLE of a token must not match, or every prefix entry becomes a
	// substring search.
	const embedded = ['xlanja', 'adengu', 'notlanja', 'reallydengu'];

	it.each(embedded)('does not match mid-token: %j', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('matches the same stems when they do start a token', () => {
		for (const text of ['lanja', 'dengu']) {
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
				// Native surfaces are allowed 3 units: one Telugu code unit
				// routinely carries a consonant plus a vowel sign or an
				// anusvara, so లంజ is three units and five phonemes.
				expect(surface.length, `${entry.lemma} → "${surface}"`).toBeGreaterThanOrEqual(3);
			}
		}
	});
});
