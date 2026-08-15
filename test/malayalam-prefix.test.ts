/**
 * `matchMode: 'prefix'` boundary suite for the Malayalam pack.
 *
 * Malayalam uses prefix mode ONCE, on പൂറ്, and the reason the other
 * candidates were rejected is as much a part of this suite as the one that
 * shipped. The rule this pack contributes to the recipe:
 *
 *   **A prefix entry is only defensible when its trap set is CLOSED.**
 *
 * പൂറ്-/'pooru' has a closed trap set — പൂരുരുട്ടാതി, the nakshatram, and
 * essentially nothing else. കുണ്ണ/'kunna' does not: every Kunna-/Kunnu-
 * toponym in Kerala opens with it, and that list has no end. An allowlist
 * can be complete against the first and never against the second, so കുണ്ണ
 * stays in word mode even though it agglutinates just as hard.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { malayalam } from '../src/data/ml.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [malayalam] });
const prefixEntries = malayalam.entries.filter((e) => e.matchMode === 'prefix');

describe('prefix mode: the entries that use it', () => {
	it('is used by exactly the lemmas this suite covers', () => {
		expect(prefixEntries.map((e) => e.lemma)).toEqual(['പൂറ്']);
	});

	it('is deliberately NOT used by the entries with an open trap set', () => {
		for (const lemma of ['കുണ്ണ', 'കൂതി']) {
			const entry = malayalam.entries.find((e) => e.lemma === lemma)!;
			expect(entry.matchMode ?? 'word', lemma).toBe('word');
		}
	});
});

describe('prefix mode CATCHES the inflected forms it exists for', () => {
	const inflections: [stem: string, inflected: string][] = [
		['പൂറ്', 'പൂറി'],
		['പൂറ്', 'പൂറിമോൻ'],
		['പൂറ്', 'പൂറിമോനെ'],
		['പൂറ്', 'പൂറ്റ്'],
		// Romanized: the same suffixes typed on an English keyboard.
		['പൂറ്', 'pooru'],
		['പൂറ്', 'poorimon'],
		['പൂറ്', 'poorimone'],
		['പൂറ്', 'poorumone'],
	];

	it.each(inflections)('%s matches its inflection %j', (lemma, text) => {
		const result = matcher.scan(text);
		expect(result.matches.map((m) => m.lemma)).toContain(lemma);
	});

	it('extends the match span over the whole agglutinated token', () => {
		const text = 'പൂറിമോൻ';
		const m = matcher.scan(text).matches[0]!;
		expect(m.start).toBe(0);
		expect(m.end).toBeGreaterThanOrEqual(text.length - 1);
		expect(matcher.censor(text)).not.toMatch(/\p{Script=Malayalam}/u);
	});

	it('extends over a romanized suffix too', () => {
		expect(matcher.censor('poorimone')).toBe('*********');
	});
});

describe('prefix mode does NOT swallow innocent words', () => {
	const innocent: [why: string, text: string][] = [
		['പൂരുരുട്ടാതി, the nakshatram, opens with the pooru prefix', 'pooruruttathi'],
		['…in a sentence', 'his star is pooruruttathi'],
		['Pooradam, the neighbouring nakshatram', 'pooradam natchathiram'],
		['Pooram, the Thrissur festival', 'Thrissur Pooram'],
		['Poornima, a given name', 'Poornima spoke'],
		['poori, the food', 'poori masala'],
		['the English word', 'a poor decision'],
		['and the native side, where റ and ര keep them apart', 'പൂരം ആഘോഷിച്ചു'],
		['…the nakshatram in native script', 'പൂരുരുട്ടാതി നക്ഷത്രം'],
	];

	it.each(innocent)('stays clean — %s: %j', (_why, text) => {
		const result = matcher.scan(text);
		expect(result.matches, JSON.stringify(result.matches)).toEqual([]);
	});
});

describe('the word-mode entries that a careless prefix would have broken', () => {
	// These are the cases that decided കുണ്ണ and കൂതി. Each is a token that
	// STARTS with the surface form; under prefix mode every one would fire.
	const openTrapSet = [
		'Kunnamkulam municipality',
		'Kunnathunad taluk',
		'Kunnathur in Kollam district',
		'Kunnamthanam panchayat',
		'kunnukara village',
		'kunnappally church',
		'the kunnu behind the house',
	];

	it.each(openTrapSet)('stays clean in word mode: %j', (text) => {
		expect(matcher.isClean(text), text).toBe(true);
	});

	it('still flags the bare word the entry exists for', () => {
		expect(matcher.isClean('kunna')).toBe(false);
		expect(matcher.isClean('koothi')).toBe(false);
	});
});

describe('prefix mode still respects the START boundary', () => {
	const embedded = ['xpooru', 'apoorimon', 'notpooru', 'reallypooru'];

	it.each(embedded)('does not match mid-token: %j', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('matches the same stem when it does start a token', () => {
		expect(matcher.isClean('pooru')).toBe(false);
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
