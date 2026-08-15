/**
 * Kannada pack schema and curation decisions.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { kannada } from '../src/data/kn.js';
import { telugu } from '../src/data/te.js';
import { malayalam } from '../src/data/ml.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { LanguagePack } from '../src/types.js';
import { expectDefendedPrefixEntries, expectValidPack, type PackExpectations } from './pack-schema.js';

const EXPECT: PackExpectations = {
	language: 'kn',
	script: 'Knda',
	lemmaScript: /\p{Script=Kannada}/u,
};

describe('kannada pack schema', () => {
	it('validates every entry', () => {
		expectValidPack(kannada, EXPECT);
	});

	it('is a curated list, not a dump', () => {
		expect(kannada.entries.length).toBeGreaterThanOrEqual(15);
		expect(kannada.entries.length).toBeLessThanOrEqual(120);
	});

	it('gives every prefix-mode entry a deliberate allowlist', () => {
		const prefixEntries = kannada.entries.filter((e) => e.matchMode === 'prefix');
		expect(prefixEntries.length).toBeGreaterThanOrEqual(2);
		expectDefendedPrefixEntries(kannada, EXPECT);
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			kannada.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('ತುಲ್ಲು')).toBe(4);
		expect(severityOf('ಸೂಳೆ')).toBe(4);
		expect(severityOf('ಬೋಳಿ')).toBe(4);
		expect(severityOf('ತುರುಕ')).toBe(4);
		expect(severityOf('ಬೇವರ್ಸಿ')).toBe(3);
		expect(severityOf('ನಾಯಿಮಗ')).toBe(2);
		// ಕೀಳು ಜಾತಿ ("low caste") was removed on the caste-term
		// decision of 2026-08-14 — a category written about, not an epithet.
		expect(severityOf('ಕೀಳು ಜಾತಿ')).toBeUndefined();
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(kannada.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'boli', // Hindi बोली "speech / dialect / bid"
			'sule', // a common Indian surname
			'tika', // Hindi टीका
			'thika',
			'kundi', // Hindi कुंडी "latch"
			'munde', // reaches the Munda community
			'chandala', // the descriptive varna term
			'holeya', // a community name
			'madiga',
			'naayi', // just "dog"
			'katte', // just "donkey"
			'tulu', // the Tulu language and its people
			'tulli', // opens Tullian / tullibee, an open set of proper nouns
			'chinali', // the Chinali people of Himachal Pradesh
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a kn romanization`).toBe(false);
		}
	});

	it('ships the compound abuse forms, never the bare stem, in Latin script', () => {
		// ಸೂಳೆ / ಬೋಳಿ / ಬಡ್ಡಿ / ನಾಯಿ / ಕತ್ತೆ are all safe or innocent bare; the
		// abuse is the ಮಗ compound, and that is what the romanizations list.
		const roms = new Set(kannada.entries.flatMap((e) => e.romanizations ?? []));
		for (const compound of ['soolemaga', 'bolimaga', 'baddimaga', 'nayimaga', 'kattemaga']) {
			expect(roms.has(compound), `"${compound}" should be a kn romanization`).toBe(true);
		}
		for (const bare of ['baddi', 'nayi', 'maga']) {
			expect(roms.has(bare), `"${bare}" must not be a kn romanization`).toBe(false);
		}
	});

	it('ships ಕುಂಡಿ and ತಿಕ native-script-only', () => {
		for (const lemma of ['ಕುಂಡಿ', 'ತಿಕ']) {
			const entry = kannada.entries.find((e) => e.lemma === lemma)!;
			expect(entry.romanizations ?? [], lemma).toEqual([]);
		}
	});

	it('excludes the merely-rude and the unwinnable vocabulary', () => {
		const surfaces = new Set(
			kannada.entries.flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
				...(e.variants ?? []),
			]),
		);
		for (const junk of [
			'ನಾಯಿ', // dog
			'ಕತ್ತೆ', // donkey
			'ಹಂದಿ', // pig
			'ದಡ್ಡ', // dolt
			'ಮಂಗ', // monkey
			'ಹುಚ್ಚ', // "mad"
			'ಚಂಡಾಲ', // the descriptive varna term
			'ಹೊಲೆಯ', // a community name
			'ಮಾದಿಗ',
			'ಮಿಂಡ', // Minda, the firm and the surname
			'ಬಜಾರಿ', // Marathi बाजरी, pearl millet
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the kn pack`).toBe(false);
		}
	});

	it('does NOT allowlist bare "tulu", which would disable the ತುಲ್ಲು entry', () => {
		// The repeat-collapsing pass folds "tullu" toward "tulu", so an allow
		// span for the bare word would contain the whole match. This is a
		// mechanism the Tamil pack never hit, and it is easy to "fix" wrongly.
		expect(kannada.allowlist ?? []).not.toContain('tulu');
		const tullu = kannada.entries.find((e) => e.lemma === 'ತುಲ್ಲು')!;
		expect(tullu.allowlist ?? []).not.toContain('tulu');
		expect(tullu.allowlist ?? []).toContain('tulunadu');
	});

	it('carries the pack-wide allowlist for the collisions it knows about', () => {
		for (const phrase of ['bolisu', 'tulunadu', 'holeya', 'madiga', 'baddi', 'country']) {
			expect(kannada.allowlist, phrase).toContain(phrase);
		}
	});
});

describe('cross-pack sanity', () => {
	// Packs are self-sufficient by policy: a consumer importing only data/kn
	// must get full Kannada coverage, so a romanization is never withheld just
	// because another pack also claims it. Every overlap must be DELIBERATE.
	const otherSurfaces = (...packs: LanguagePack[]): Set<string> =>
		new Set(packs.flatMap((p) => p.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? [])])));

	it('shares no lemma with any other pack', () => {
		const others = otherSurfaces(hindi, english, tamil, telugu, malayalam);
		for (const e of kannada.entries) {
			expect(others.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(false);
		}
	});

	it('shares exactly the romanizations it means to', () => {
		const others = otherSurfaces(hindi, english, tamil, telugu, malayalam);
		const shared = kannada.entries
			.flatMap((e) => e.romanizations ?? [])
			.filter((r) => others.has(r))
			.sort();
		// 'laudee' is generated by the hi pack's inflection expander from
		// लौड़ा; 'turaka' is the te spelling of the same slur. Both ship here
		// so that data/kn stands alone.
		expect(shared).toEqual(['laudee', 'turaka']);
	});

	it('reports a shared romanization once, not twice, when both packs load', () => {
		for (const [text, packs] of [
			['turaka', [kannada, telugu]],
			['laudee', [kannada, hindi]],
		] as const) {
			const result = createMatcher({ packs: [...packs] }).scan(text);
			expect(result.matches.length, text).toBe(1);
		}
	});

	it('does not allowlist anything another pack matches', () => {
		const others = otherSurfaces(hindi, english, tamil, telugu, malayalam);
		for (const phrase of kannada.allowlist ?? []) {
			expect(others.has(phrase), `allowlist "${phrase}" disables another pack`).toBe(false);
		}
	});

	it('has no allowlist phrase that suppresses one of its own surface forms', () => {
		// The check above compares allow phrases to other packs' surfaces as
		// STRINGS, so it could never see the real failure: `chinali` and
		// `chinaali` are different strings that the repeat-collapsed pass folds
		// together, and kn's own `chinaali` was dead for it. Only running the
		// surfaces through the matcher finds that class.
		const matcher = createMatcher({ packs: [kannada] });
		for (const e of kannada.entries) {
			for (const surface of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]) {
				expect(
					matcher.isClean(surface),
					`surface "${surface}" of "${e.lemma}" is suppressed by an allowlist phrase in its own pack`,
				).toBe(false);
			}
		}
	});
});
