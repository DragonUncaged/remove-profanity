/**
 * Scunthorpe (false-positive) acceptance suite — Module G.
 *
 * Every input here must be CLEAN with default matcher options and the
 * default packs [hindi, english]. These texts contain substrings (or
 * skeleton-collisions) of profane lemmas that legitimate text is entitled
 * to use: proper nouns, place names, dates, ordinary vocabulary.
 *
 * Written against the public API contract in src/types.ts only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [hindi, english] });

/**
 * Context notes (per SPEC.md):
 * - "This happened in 500 BC": the 'bc' abbreviation entry must not fire in
 *   numeric/date context — the hi pack entry carries an allowlist (or the
 *   matcher's context rules exempt it). Either way, this text stays clean.
 * - "the MC of the event": same rule for the 'mc' abbreviation — an
 *   emcee reference is not profanity.
 * - "Lund University is in Sweden": the allowlist phrase that covers it is on
 *   the लंड entry, not the hi pack-wide list. "Bal Thackeray" / "He is a
 *   Sunni Muslim" are clean without any allowlist at all.
 * - "classic assessment of grass": these are clean because every pattern must
 *   span a WHOLE token — the en pack-wide allowlist (class / classic /
 *   assassin / grass) is measurably inert, see
 *   test/allowlist-liveness.test.ts. This case really exercises
 *   collapseRepeats threshold 2 ("assessment" keeps its legitimate doubles).
 * - "Hello (um, maybe)": pins the absence of a `( → c` leet mapping. With it,
 *   "(um" folds to "cum". See test/latin.test.ts.
 */
const cleanTexts: string[] = [
	'Mahatma Gandhi',
	'chutney recipe',
	'chutki',
	'Lund University is in Sweden',
	'Bal Thackeray',
	'He is a Sunni Muslim',
	'This happened in 500 BC',
	'the MC of the event',
	'an item on the list',
	'classic assessment of grass',
	'Scunthorpe United',
	'paal means milk',
	'मालिक आ गया',
	'गूगल पर खोजें',
	'हिन्दी सीखो',
	'propaganda',
	'Dickens novels',
	'Middlesex',
	'Hello (um, maybe)',
];

describe('scunthorpe suite: legitimate text is clean with default options', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = matcher.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(matcher.isClean(text)).toBe(true);
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(matcher.censor(text)).toBe(text);
	});
});
