/**
 * Telugu pack schema and curation decisions.
 *
 * The language-agnostic invariants live in `pack-schema.ts`; what is here is
 * the part that is genuinely about Telugu — severities, the romanizations
 * that were dropped on purpose, and the caste-slur tagging.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { malayalam } from '../src/data/ml.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { LanguagePack } from '../src/types.js';
import { expectDefendedPrefixEntries, expectValidPack, type PackExpectations } from './pack-schema.js';

const EXPECT: PackExpectations = {
	language: 'te',
	script: 'Telu',
	lemmaScript: /\p{Script=Telugu}/u,
};

describe('telugu pack schema', () => {
	it('validates every entry', () => {
		expectValidPack(telugu, EXPECT);
	});

	it('is a curated list, not a dump', () => {
		expect(telugu.entries.length).toBeGreaterThanOrEqual(15);
		expect(telugu.entries.length).toBeLessThanOrEqual(120);
	});

	it('gives every prefix-mode entry a deliberate allowlist', () => {
		const prefixEntries = telugu.entries.filter((e) => e.matchMode === 'prefix');
		// Telugu agglutinates as hard as Tamil; if this ever drops to zero the
		// agglutination story has silently regressed.
		expect(prefixEntries.length).toBeGreaterThanOrEqual(2);
		expectDefendedPrefixEntries(telugu, EXPECT);
	});

	it('tags caste slurs with the casteist category', () => {
		const casteist = telugu.entries.filter((e) => e.categories.includes('casteist'));
		// Was 5 before శూద్రుడు and తక్కువ కులం were removed as descriptive
		// categories rather than epithets.
		expect(casteist.length).toBeGreaterThanOrEqual(4);
		for (const lemma of ['చండాలుడు', 'మాదిగోడు', 'మాలోడు', 'పంచముడు']) {
			const entry = telugu.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
			expect(entry!.severity, lemma).toBe(4);
		}
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			telugu.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('లంజ')).toBe(4);
		expect(severityOf('దెంగు')).toBe(4);
		expect(severityOf('పూకు')).toBe(4);
		expect(severityOf('కొజ్జా')).toBe(4);
		expect(severityOf('తురక')).toBe(4);
		expect(severityOf('మొడ్డ')).toBe(3);
		expect(severityOf('వెధవ')).toBe(2);
		// శూద్రుడు and తక్కువ కులం were removed on the caste-term
		// decision of 2026-08-14 — categories written about, not epithets.
		expect(severityOf('శూద్రుడు')).toBeUndefined();
		expect(severityOf('తక్కువ కులం')).toBeUndefined();
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(telugu.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'munda', // the Munda community and language family
			'gudda', // गुड्डा, a North Indian given-name diminutive
			'chandala', // the descriptive Sanskrit varna term
			'chandalam', // "awful", everyday Telugu
			'shudra', // likewise descriptive
			'edava', // a Kerala village, and Malayalam ഇടവ
			'moda',
			'randi', // Telugu రండి is the imperative "come"
			'veshya', // the formal word, used in news copy
			'madiga', // community names, never the slur half
			'mala',
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a te romanization`).toBe(false);
		}
	});

	it('ships గుద్ద and ముండ native-script-only', () => {
		// The Latin spelling is the ambiguous half in both cases, so this is
		// the తోట్టి/thotti pattern from the Tamil pack: native-only beats
		// dropping the lemma.
		for (const lemma of ['గుద్ద', 'ముండ']) {
			const entry = telugu.entries.find((e) => e.lemma === lemma)!;
			expect(entry.romanizations ?? [], lemma).toEqual([]);
			expect((entry.variants ?? []).length, lemma).toBeGreaterThan(0);
		}
	});

	it('excludes the merely-rude and the unwinnable vocabulary', () => {
		const surfaces = new Set(
			telugu.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const junk of [
			'గాడిద', // donkey
			'కుక్క', // dog
			'పంది', // pig
			'చెత్త', // garbage
			'దొంగ', // thief
			'పిచ్చి', // "mad", also everyday praise
			'రండి', // the imperative "come"
			'సన్యాసి', // a renunciant
			'వేశ్య', // the formal term
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the te pack`).toBe(false);
		}
	});

	it('carries the pack-wide allowlist for the collisions it knows about', () => {
		for (const phrase of [
			'dengue',
			'dengue fever',
			'lanja taluka',
			'chandalam',
			'madiga',
			'mala',
			'sanyasi',
		]) {
			expect(telugu.allowlist, phrase).toContain(phrase);
		}
	});
});

describe('cross-pack sanity', () => {
	// Packs are self-sufficient by policy: a consumer importing only data/te
	// must get full Telugu coverage, so a romanization is never withheld just
	// because another pack also claims it. What must stay true is that every
	// overlap is DELIBERATE — an accidental one is usually a curation mistake.
	const otherSurfaces = (...packs: LanguagePack[]): Set<string> =>
		new Set(packs.flatMap((p) => p.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? [])])));

	it('shares no lemma with any other pack', () => {
		const others = otherSurfaces(hindi, english, tamil, kannada, malayalam);
		for (const e of telugu.entries) {
			expect(others.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(false);
		}
	});

	it('shares exactly the romanizations it means to', () => {
		const others = otherSurfaces(hindi, english, tamil, kannada, malayalam);
		const shared = telugu.entries
			.flatMap((e) => e.romanizations ?? [])
			.filter((r) => others.has(r))
			.sort();
		// తురక / ತುರುಕ is the same slur in both languages and both packs must
		// carry it; see the note on the ತುರುಕ entry in kn.ts.
		expect(shared).toEqual(['turaka']);
	});

	it('reports a shared romanization once, not twice, when both packs load', () => {
		const both = createMatcher({ packs: [telugu, kannada] });
		const result = both.scan('turaka');
		expect(result.matches.length).toBe(1);
		expect(result.maxSeverity).toBe(4);
	});

	it('does not allowlist anything another pack matches', () => {
		// A pack-wide allowlist entry is global once the pack is loaded, so an
		// entry that happens to be another pack's surface form would silently
		// disable that lemma for anyone loading both.
		const others = otherSurfaces(hindi, english, tamil, kannada, malayalam);
		for (const phrase of telugu.allowlist ?? []) {
			expect(others.has(phrase), `allowlist "${phrase}" disables another pack`).toBe(false);
		}
	});
});
