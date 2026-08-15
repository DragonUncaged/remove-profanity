/**
 * `matchMode: 'prefix'` boundary suite.
 *
 * Tamil agglutinates case and postposition suffixes onto stems, which is why
 * the pack uses prefix mode at all. Prefix mode is also the single most
 * dangerous thing in this pack: it fires on any token that STARTS with a
 * listed surface form. Every prefix entry needs both halves proved —
 *   (a) it catches the inflected forms it exists for, and
 *   (b) it does not swallow the innocent words that share its opening.
 *
 * If you add a prefix entry to any language pack, add both halves here.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { tamil } from '../src/data/ta.js';
import type { Matcher } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [tamil] });

const prefixEntries = tamil.entries.filter((e) => e.matchMode === 'prefix');

describe('prefix mode: the entries that use it', () => {
	it('is used by exactly the lemmas this suite covers', () => {
		expect(prefixEntries.map((e) => e.lemma).sort()).toEqual(
			['கூதி', 'சூத்து', 'தேவடியா', 'புண்டை', 'மயிர்'].sort(),
		);
	});
});

describe('prefix mode CATCHES the inflected forms it exists for', () => {
	const inflections: [stem: string, inflected: string][] = [
		// Native script: accusative, dative, locative, vocative.
		['புண்டை', 'புண்டைய'],
		['புண்டை', 'புண்டைக்கு'],
		['புண்டை', 'புண்டையில'],
		['கூதி', 'கூதிக்கு'],
		['சூத்து', 'சூத்துல'],
		['சூத்து', 'சூத்துக்கு'],
		['தேவடியா', 'தேவடியாக்கு'],
		['மயிர்', 'மயிராண்டி'],
		// Romanized: the same suffixes typed on an English keyboard.
		['புண்டை', 'pundaiku'],
		['புண்டை', 'pundaiya'],
		['கூதி', 'koothiya'],
		['சூத்து', 'soothula'],
		['தேவடியா', 'thevidiyapaya'],
		['மயிர்', 'mayiru'],
	];

	it.each(inflections)('%s matches its inflection %j', (lemma, text) => {
		const result = matcher.scan(text);
		expect(result.matches.map((m) => m.lemma)).toContain(lemma);
	});

	it('extends the match span over the whole agglutinated token', () => {
		// Without the prefix span extension, புண்டைக்கு would censor as
		// *****க்கு, leaving the suffix dangling.
		const text = 'புண்டைக்கு';
		const m = matcher.scan(text).matches[0]!;
		expect(m.start).toBe(0);
		// The reported end lands on the start of the final grapheme cluster,
		// not its last code unit — nfcFold maps every unit of a cluster to the
		// cluster's start index, so a word ending in a combining mark reports
		// one unit short. This is engine-wide (Hindi चूतिया reports चूतिय the
		// same way) and censorText compensates by expanding spans to cluster
		// boundaries, which is what the next assertion checks.
		expect(m.end).toBeGreaterThanOrEqual(text.length - 1);
		expect(matcher.censor(text)).not.toMatch(/\p{Script=Tamil}/u);
	});

	it('extends over a romanized suffix too', () => {
		expect(matcher.censor('soothula')).toBe('********');
		expect(matcher.censor('pundaiku')).toBe('********');
	});
});

describe('prefix mode does NOT swallow innocent words', () => {
	// Each case is a word that begins with a prefix surface form but is not
	// profanity. These are the entries' own allowlists doing their job.
	const innocent: [why: string, text: string][] = [
		['குதிரை "horse" starts with the kuthi prefix', 'kuthirai'],
		['…in a sentence', 'the kuthirai race was cancelled'],
		['…and its dh spelling', 'kudhirai vandi'],
		['கூதிர் "the cold season" starts with the கூதி prefix', 'கூதிர் காலம்'],
		['கூத்து, the folk theatre form', 'koothu'],
		['therukoothu, the same form', 'therukoothu performance'],
		['புண்டரீகம் "lotus" starts with the புண்ட prefix', 'புண்டரீகம்'],
		['புண்டரீகன், a given name', 'புண்டரீகன் வந்தார்'],
		['Pundalik, the Vithoba devotee', 'Pundalik temple'],
		['Pundarika, a Sanskrit name', 'Pundarika Vitthala'],
		['சூத்திரம் "formula"', 'soothiram'],
		['the English soothsayer/soothing', 'a soothing soothsayer'],
		['தேவரடியார் / devadasi, the etymological source', 'devadasi tradition'],
		['Thevaram, the Shaiva hymns', 'Thevaram hymns'],
		['Mayiladuthurai, a district', 'Mayiladuthurai district'],
	];

	it.each(innocent)('stays clean — %s: %j', (_why, text) => {
		const result = matcher.scan(text);
		expect(result.matches, JSON.stringify(result.matches)).toEqual([]);
	});
});

describe('prefix mode still respects the START boundary', () => {
	// Prefix mode relaxes the END boundary only. A profane stem buried in the
	// MIDDLE of a token must not match, or every prefix entry becomes a
	// substring search.
	const embedded = ['xpundai', 'akoothi', 'notsoothu', 'reallymayir'];

	it.each(embedded)('does not match mid-token: %j', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('matches the same stems when they do start a token', () => {
		for (const text of ['pundai', 'koothi', 'soothu', 'mayir']) {
			expect(matcher.isClean(text), text).toBe(false);
		}
	});
});

describe('every prefix surface form is defended', () => {
	it('has a minimum length and an allowlist on every prefix entry', () => {
		for (const entry of prefixEntries) {
			expect((entry.allowlist ?? []).length, entry.lemma).toBeGreaterThan(0);
			for (const surface of [entry.lemma, ...(entry.romanizations ?? [])]) {
				expect(surface.length, `${entry.lemma} → "${surface}"`).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it('does not let a prefix entry match a bare one-or-two-letter extension of an allowlisted word', () => {
		// Regression guard: allowlist suppression is span-containment based,
		// so an allowlisted word plus a suffix must stay suppressed.
		expect(matcher.isClean('kuthiraiyil')).toBe(true); // "on the horse"
		expect(matcher.isClean('koothukku')).toBe(true); // "for the koothu"
	});
});
