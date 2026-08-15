/**
 * Malayalam pack schema and curation decisions.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { malayalam } from '../src/data/ml.js';
import { tamil } from '../src/data/ta.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { expectDefendedPrefixEntries, expectValidPack, type PackExpectations } from './pack-schema.js';

const EXPECT: PackExpectations = {
	language: 'ml',
	script: 'Mlym',
	lemmaScript: /\p{Script=Malayalam}/u,
};

describe('malayalam pack schema', () => {
	it('validates every entry', () => {
		expectValidPack(malayalam, EXPECT);
	});

	it('is a curated list, not a dump', () => {
		expect(malayalam.entries.length).toBeGreaterThanOrEqual(15);
		expect(malayalam.entries.length).toBeLessThanOrEqual(120);
	});

	it('gives every prefix-mode entry a deliberate allowlist', () => {
		const prefixEntries = malayalam.entries.filter((e) => e.matchMode === 'prefix');
		expect(prefixEntries.length).toBeGreaterThanOrEqual(1);
		expectDefendedPrefixEntries(malayalam, EXPECT);
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			malayalam.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('പൂറ്')).toBe(4);
		expect(severityOf('പണ്ണ്')).toBe(4);
		expect(severityOf('തായോളി')).toBe(4);
		expect(severityOf('കുണ്ടൻ')).toBe(4);
		expect(severityOf('പുലയൻ')).toBe(4);
		expect(severityOf('കുണ്ണ')).toBe(3);
		expect(severityOf('മൈര്')).toBe(2);
		expect(malayalam.entries.find((e) => e.lemma === 'മൈര്')!.casualUse).toBe(true);
	});

	it('tags caste slurs with the casteist category', () => {
		// താഴ്ന്ന ജാതി ("low caste") was removed on the caste-term
		// decision of 2026-08-14. The epithets stay.
		expect(malayalam.entries.find((e) => e.lemma === 'താഴ്ന്ന ജാതി')).toBeUndefined();
		for (const lemma of ['പുലയൻ', 'ചെറുമൻ']) {
			const entry = malayalam.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
		}
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(malayalam.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'panni', // പന്നി "pig" — the minimal pair that decides പണ്ണ്
			'parayan', // പറയാൻ "to say"
			'poor', // the English word
			'poori', // the food
			'pooram', // the Thrissur festival
			'kundan', // a common Hindi given name, and a jewellery style
			'naari', // Sanskrit/Hindi नारी "woman" — wholly neutral
			'cheruma', // the community name, not the abusive -ൻ form
			'pulaya', // likewise
			'vedi', // "gunshot" / "firecracker" dominate
			'chetta', // also a palm-leaf hut
			'andi', // കശുവണ്ടി is the cashew nut
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be an ml romanization`).toBe(false);
		}
	});

	it('ships പണ്ണ് and കുണ്ടൻ native-script-only', () => {
		// Both are cases where the NATIVE spelling is the unambiguous one, so
		// native-only beats dropping the lemma: പണ്ണി vs പന്നി is a real
		// minimal pair, and "Kundan" is a common given name in Latin only.
		for (const lemma of ['പണ്ണ്', 'കുണ്ടൻ']) {
			const entry = malayalam.entries.find((e) => e.lemma === lemma)!;
			expect(entry.romanizations ?? [], lemma).toEqual([]);
			expect((entry.variants ?? []).length, lemma).toBeGreaterThan(0);
		}
	});

	it('does not ship പറയൻ at all', () => {
		// The Paraya caste term, cognate with the ta pack's பறையன். Its
		// romanization is identical to പറയാൻ "to say", one of the commonest
		// verbs in the language, and no allowlist survives that.
		const surfaces = new Set(
			malayalam.entries.flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
				...(e.variants ?? []),
			]),
		);
		expect(surfaces.has('പറയൻ')).toBe(false);
		expect(surfaces.has('parayan')).toBe(false);
	});

	it('keeps കുണ്ണ in word mode, because its trap set is open-ended', () => {
		// Every Kunna-/Kunnu- toponym in Kerala opens with this romanization.
		// An allowlist can be complete against a closed set (പൂരുരുട്ടാതി) but
		// never against an open one, so prefix mode is simply wrong here.
		const entry = malayalam.entries.find((e) => e.lemma === 'കുണ്ണ')!;
		expect(entry.matchMode ?? 'word').toBe('word');
		expect(entry.allowlist).toContain('kunnamkulam');
	});

	it('excludes the merely-rude and the unwinnable vocabulary', () => {
		const surfaces = new Set(
			malayalam.entries.flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
				...(e.variants ?? []),
			]),
		);
		for (const junk of [
			'വെടി', // "gunshot" / "firecracker"
			'ചെറ്റ', // also a palm-leaf hut
			'അണ്ടി', // കശുവണ്ടി is the cashew
			'പുല്ല്', // below the bar
			'പട്ടി', // just "dog"
			'നായാടി', // a community's own name
			'പറയൻ',
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the ml pack`).toBe(false);
		}
	});

	it('fixes the "parayan" collision at the source instead of allowlisting it', () => {
		// പറയാൻ "to say" is the reason പറയൻ is not a lemma here. It is NOT
		// allowlisted: an allow entry is global once a pack is loaded, so it
		// would suppress any other pack's claim on the token. The ta pack's
		// பறையன் used to ship 'parayan' and censored Manglish "to say"; that
		// romanization was dropped there, which is the fix that also works for
		// a consumer who loads data/ta alone.
		expect(malayalam.allowlist ?? []).not.toContain('parayan');
		const taRoms = new Set(tamil.entries.flatMap((e) => e.romanizations ?? []));
		expect(taRoms.has('parayan'), 'ta must not re-add the colliding spelling').toBe(false);
		expect(taRoms.has('paraiyan'), 'the primary ta spelling still ships').toBe(true);
	});
});

describe('cross-pack sanity', () => {
	it('shares no lemma with any other pack', () => {
		const others = new Set(
			[...hindi.entries, ...english.entries, ...telugu.entries, ...kannada.entries].flatMap(
				(e) => [e.lemma, ...(e.romanizations ?? [])],
			),
		);
		for (const e of malayalam.entries) {
			expect(others.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(false);
		}
	});

	it('shares exactly the romanizations it means to with the ta pack', () => {
		// തായോളി / തாயோலി and കൂത്തിച്ചി / கூத்தி are the same Dravidian roots.
		// Packs are self-sufficient by policy: consumers import one subpath at
		// a time, so a Malayalam-only consumer cannot be sent to data/ta for
		// its commonest expletives. Any overlap NOT in this list is an accident
		// and should be looked at.
		const taSurfaces = new Set(
			tamil.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? [])]),
		);
		const shared = malayalam.entries
			.flatMap((e) => e.romanizations ?? [])
			.filter((r) => taSurfaces.has(r))
			.sort();
		expect(shared).toEqual(['koothi', 'oombu', 'thayoli', 'thayolli']);
	});

	it('reports a shared romanization once, not twice, when both packs load', () => {
		// Overlap resolution in the matcher keeps one candidate per span, so
		// the deliberate ta/ml duplication above costs nothing at scan time.
		const both = createMatcher({ packs: [tamil, malayalam] });
		for (const text of ['thayoli', 'koothi', 'oombu']) {
			const result = both.scan(text);
			expect(result.matches.length, text).toBe(1);
		}
		expect(both.scan('thayoli').maxSeverity).toBe(4);
	});

	it('does not allowlist anything another pack matches', () => {
		const otherSurfaces = new Set(
			[
				...hindi.entries,
				...english.entries,
				...telugu.entries,
				...kannada.entries,
				...tamil.entries,
			].flatMap((e) => [e.lemma, ...(e.romanizations ?? [])]),
		);
		for (const phrase of malayalam.allowlist ?? []) {
			expect(otherSurfaces.has(phrase), `allowlist "${phrase}" disables another pack`).toBe(
				false,
			);
		}
	});
});
