/**
 * Separated-letter tier (f u c k, s.h.i.t, b-i-t-c-h): words spelled out one
 * letter at a time.
 *
 * The clean half of this file is the point of the file. Any rule that joins
 * letters across separators is one bad boundary condition away from turning
 * every initialism, hyphenation and spelled-out sequence in ordinary prose
 * into a false positive, so the traps below outnumber the hits ~4:1 and are
 * deliberately drawn from the shapes that break naive implementations:
 * dotted acronyms, hyphenated compounds, single-letter English words, note
 * names, keyboard rows, version numbers and initials.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';

const matcher = createMatcher({ packs: [hindi, english, tamil] });

describe('spelled-out profanity is caught', () => {
	it.each([
		['spaces', 'f u c k you'],
		['dots', 'f.u.c.k'],
		['dots, uppercase', 'S.H.I.T.'],
		['spaces, mid-sentence', 'what a s h i t day'],
		['hyphens', 'you are a b-i-t-c-h honestly'],
		['underscores', 'c_h_u_t_i_y_a'],
		['hinglish abbreviation', 'abe b s d k'],
		['hinglish, long', 'm a d a r c h o d'],
		['leading article dropped', 'stop being a d i c k'],
		['tabs', 'f\tu\tc\tk'],
		// 2026-08-15: newline and slash joined the separator set (benchmark
		// axes E5.4 / E5.5). Same four locks as every other separator.
		['newlines', 'f\nu\nc\nk'],
		['slashes', 'f/u/c/k'],
	])('%s: %s flags', (_label, text) => {
		const result = matcher.scan(text);
		expect(result.matches.length, `expected ${text} to flag`).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('censors the whole run, separators included', () => {
		expect(matcher.censor('f.u.c.k off')).toBe('******* off');
	});

	it('reports the run span in original coordinates', () => {
		const [match] = matcher.scan('say f u c k now').matches;
		expect(match).toBeDefined();
		expect(match!.surface).toBe('f u c k');
	});
});

describe('ordinary prose is not swept up', () => {
	it.each([
		// Dotted acronyms — all too short, or not dictionary words.
		'U.S.A. and U.K. relations',
		'e.g. this and i.e. that',
		'R.S.V.P. by Friday please',
		'N.A.S.A. launched it',
		'the F.B.I. and the C.I.A. agreed',
		'S.H.I.E.L.D. agents assemble',
		'M.A.S.H. reruns are great',
		'B.Y.O.B. tonight',
		'A.D.H.D. diagnosis confirmed',
		'Ph.D. and M.D. degrees',
		'a.k.a. the other name',
		'O.M.G. that is wild',
		// Initials: the separator is two characters, so no run forms.
		'J.R.R. Tolkien wrote it',
		'Dr. A. B. Smith arrived',
		'A.B. Smith arrived',
		// Hyphenation: the segments are not single letters.
		'T-shirt and e-mail and x-ray and co-op',
		'the r-value and the p-value',
		'a long-tailed tit in the willow',
		// Spelled-out innocent words, including ones with profane substrings.
		'spelled out: c a t s',
		'w-a-t-e-r is wet',
		'p l e a s e stop',
		'h e l l o there',
		'b a s s guitar',
		'a n a l y s i s of the data',
		'c l a s s i c cinema',
		'grades: a b c d e f were given',
		'notes c d e f g a b in order',
		'q w e r t y keyboard row',
		'x y z coordinates',
		// Single-letter English words in a row.
		'plan a b or c',
		'the U N and the E U',
		'point A to point B to point C to point D',
		'I C U in the I.C.U.',
		// Numbers and versions.
		'version 3.5.1 and 1.2.3.4 released',
		'I have 100 dollars and 50 cents',
		// Too short to qualify.
		'a s s',
		'a-s-s',
		'x x x',
		// The run must not butt up against a longer token.
		'f u c ku',
		'f u c k9',
		// Allowlisted phrases survive being spelled out.
		'g a n d h i was here',
		'l u n d university',
		'c h u t n e y is nice',
	])('%s stays clean', (text) => {
		const result = matcher.scan(text);
		expect(
			result.matches,
			`expected ${text} to stay clean, got ${JSON.stringify(result.matches)}`,
		).toHaveLength(0);
	});
});

describe('separator rules', () => {
	it('needs exactly one separator between letters', () => {
		expect(matcher.scan('f  u  c  k').matches).toHaveLength(0);
	});

	it('needs at least four letters', () => {
		expect(matcher.scan('a s s hole').matches).toHaveLength(0);
	});

	it('drops at most one leading standalone-word letter', () => {
		// "b a s s" must not surrender "ass"; only a/i/o may be skipped.
		expect(matcher.scan('b a s s').matches).toHaveLength(0);
	});

	it('does not treat arbitrary punctuation as a separator', () => {
		// The slash graduated to a real separator on 2026-08-15 (axis E5.5);
		// the comma stays out — "1,2,3" lists are everywhere.
		expect(matcher.scan('f,u,c,k').matches).toHaveLength(0);
	});

	it('newline and slash runs still obey the whole-run locks', () => {
		expect(matcher.scan('n/a and a/b tests').matches).toHaveLength(0);
		expect(matcher.scan('read a\nb\nc\nd down the page').matches).toHaveLength(0);
		expect(matcher.scan('s3://bucket/key/part-0000').matches).toHaveLength(0);
	});
});
