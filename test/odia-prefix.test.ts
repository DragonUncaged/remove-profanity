/**
 * `matchMode: 'prefix'` boundary suite for the Odia pack.
 *
 * Prefix mode arrived with Tamil and is easy to read as a Dravidian device.
 * It is not: Odia attaches its case markers to the noun too (ଗାଣ୍ଡି →
 * ଗାଣ୍ଡିରେ "in the arse", ଗାଣ୍ଡିକୁ, ଗାଣ୍ଡିଠାରୁ), and abuse is written with
 * those suffixes attached far more often than bare.
 *
 * Both halves are proved here, as in test/tamil-prefix.test.ts —
 *   (a) it catches the inflected forms it exists for, and
 *   (b) it does not swallow the innocent words that share its opening.
 *
 * The second half is why only ONE Odia entry uses prefix mode: ବାଣ୍ଡ "penis"
 * would have been the obvious second candidate, and it starts ବାଣ୍ଡି "bullock
 * cart", ବାଣ୍ଡେଜ୍ "bandage" and ବାଣ୍ଡ୍ "(musical) band".
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { odia } from '../src/data/or.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [odia] });

const prefixEntries = odia.entries.filter((e) => e.matchMode === 'prefix');

describe('prefix mode: the entries that use it', () => {
	it('is used by exactly the lemmas this suite covers', () => {
		expect(prefixEntries.map((e) => e.lemma)).toEqual(['ଗାଣ୍ଡି']);
	});

	it('keeps ବାଣ୍ଡ out of prefix mode on purpose', () => {
		const banda = odia.entries.find((e) => e.lemma === 'ବାଣ୍ଡ')!;
		expect(banda.matchMode ?? 'word').toBe('word');
	});
});

describe('prefix mode CATCHES the inflected forms it exists for', () => {
	const inflections: string[] = [
		// Native script: locative, accusative/dative, ablative, genitive, plural.
		'ଗାଣ୍ଡିରେ',
		'ଗାଣ୍ଡିକୁ',
		'ଗାଣ୍ଡିଠାରୁ',
		'ଗାଣ୍ଡିର',
		// Romanized: the same suffixes typed on an English keyboard.
		'gaandire',
		'gaandiku',
		'gaandira',
	];

	it.each(inflections)('flags %j', (text) => {
		expect(matcher.isClean(text)).toBe(false);
	});

	it('censors the whole token, not just the stem', () => {
		// One mask per grapheme cluster: ଗା ଣ୍ଡି ରେ — the point is that ରେ, the
		// case suffix outside the matched stem, is covered too.
		expect(matcher.censor('ତୋ ଗାଣ୍ଡିରେ ଗୋଇଠା')).toBe('ତୋ *** ଗୋଇଠା');
		expect(matcher.censor('gaandire')).toBe('********');
	});
});

describe('prefix mode LEAVES the innocent words alone', () => {
	const innocent: [word: string, why: string][] = [
		['ଗାଣ୍ଡିବ', 'Gāṇḍīva, Arjuna’s bow'],
		['ଗାଣ୍ଡିବଧନ୍ୱା', 'an epithet of Arjuna'],
		['ଗାଣ୍ଡିମୁଣ୍ଡ', '"beginning and end", an everyday idiom'],
		['ଅର୍ଜୁନଙ୍କ ଗାଣ୍ଡିବ ଧନୁ', 'the same in a sentence'],
		['gandiva', 'the Latin spelling of the bow'],
		['gandiv', 'ditto'],
		['Gandhi', 'the surname — the reason "gandi" is not a romanization'],
	];

	it.each(innocent)('%j stays clean (%s)', (text) => {
		expect(matcher.isClean(text)).toBe(true);
	});
});

describe('prefix mode still respects the START boundary', () => {
	it('does not match a stem buried mid-token', () => {
		// Prefix mode relaxes only the end boundary. If the start boundary ever
		// relaxes too, prefix mode degenerates into substring search.
		expect(matcher.isClean('ଅଗାଣ୍ଡିରେ')).toBe(true);
		expect(matcher.isClean('mygaandi')).toBe(true);
	});

	it('does match at a real token start after punctuation', () => {
		expect(matcher.isClean('(ଗାଣ୍ଡିରେ)')).toBe(false);
		expect(matcher.isClean('"gaandire"')).toBe(false);
	});
});

describe('every prefix surface is long enough to be safe', () => {
	it('has no prefix surface shorter than four characters', () => {
		for (const e of prefixEntries) {
			for (const surface of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				expect(surface.length, `prefix surface "${surface}"`).toBeGreaterThanOrEqual(4);
			}
		}
	});
});
