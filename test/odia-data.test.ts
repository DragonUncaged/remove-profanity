/**
 * Odia pack schema validity — the or.ts counterpart of data.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts, so the check stays an independent restatement of
 * the Module C algorithm rather than a tautology against the engine.
 */
import { describe, it, expect } from 'vitest';
import type { Category } from '../src/types.js';
// createMatcher only — the skeleton-key restatement below stays independent
// of src/folds/skeleton.ts, which is what the header note is about.
import { createMatcher } from '../src/index.js';
import { odia } from '../src/data/or.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';

const ALLOWED_CATEGORIES: Category[] = [
	'slur',
	'casteist',
	'religious',
	'gendered',
	'sexual',
	'ableist',
	'violence',
	'general',
];

function skeletonKey(word: string): string {
	const digraphs: [string, string][] = [
		['kshh', 'ks'],
		['ksh', 'ks'],
		['chh', 'c'],
		['ch', 'c'],
		['bh', 'b'],
		['dh', 'd'],
		['gh', 'g'],
		['jh', 'j'],
		['kh', 'k'],
		['ph', 'f'],
		['sh', 's'],
		['th', 't'],
		['zh', 'j'],
	];
	let out = '';
	let i = 0;
	while (i < word.length) {
		const hit = digraphs.find(([from]) => word.startsWith(from, i));
		if (hit) {
			out += hit[1];
			i += hit[0].length;
		} else {
			out += word[i]!;
			i += 1;
		}
	}
	const singles: Record<string, string> = { z: 'j', w: 'v', q: 'k', y: 'i', c: 'k', x: 'ks' };
	out = [...out].map((ch) => singles[ch] ?? ch).join('');
	out = out
		.split(' ')
		.map((w) => {
			let r = '';
			for (let j = 0; j < w.length; j++) {
				const ch = w[j]!;
				if (j > 0 && ch === 'h') continue;
				if (j > 0 && 'aeiou'.includes(ch)) continue;
				r += ch;
			}
			return r;
		})
		.join(' ');
	out = out.replace(/(.)\1+/gu, '$1');
	return out.replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim();
}

describe('odia pack schema', () => {
	it('has language or, a name, and a deliberately short entry count', () => {
		expect(odia.language).toBe('or');
		expect(odia.name.length).toBeGreaterThan(0);
		// Odia has the thinnest romanized corpus of the packs here. A short
		// honest list is the intended outcome — if this ever grows past the
		// Tamil pack's 34, something is being padded.
		expect(odia.entries.length).toBeGreaterThanOrEqual(10);
		expect(odia.entries.length).toBeLessThanOrEqual(34);
	});

	it('validates every entry', () => {
		for (const entry of odia.entries) {
			const label = `entry "${entry.lemma}"`;

			expect(Number.isInteger(entry.severity), `${label} severity integral`).toBe(true);
			expect(entry.severity, `${label} severity >= 0`).toBeGreaterThanOrEqual(0);
			expect(entry.severity, `${label} severity <= 4`).toBeLessThanOrEqual(4);

			expect(entry.categories.length, `${label} has categories`).toBeGreaterThan(0);
			for (const cat of entry.categories) {
				expect(ALLOWED_CATEGORIES, `${label} category "${cat}"`).toContain(cat);
			}
			expect(new Set(entry.categories).size, `${label} duplicate category`).toBe(
				entry.categories.length,
			);

			expect(entry.lemma.trim(), `${label} lemma trimmed`).toBe(entry.lemma);
			expect(entry.lemma.length, `${label} lemma non-empty`).toBeGreaterThan(0);
			expect(entry.language, `${label} language`).toBe('or');
			expect(entry.script, `${label} script`).toBe('Orya');
			expect(
				/\p{Script=Oriya}/u.test(entry.lemma),
				`${label} lemma is Odia script`,
			).toBe(true);

			for (const r of entry.romanizations ?? []) {
				expect(r.length, `${label} romanization non-empty`).toBeGreaterThan(0);
				expect(r, `${label} romanization "${r}" lowercase`).toBe(r.toLowerCase());
				expect(r.trim(), `${label} romanization "${r}" trimmed`).toBe(r);
				expect(
					/^[a-z ]+$/.test(r),
					`${label} romanization "${r}" is plain Latin`,
				).toBe(true);
			}

			for (const v of entry.variants ?? []) {
				expect(v.length, `${label} variant non-empty`).toBeGreaterThan(0);
				expect(v.trim(), `${label} variant trimmed`).toBe(v);
			}
			for (const a of entry.allowlist ?? []) {
				expect(a.length).toBeGreaterThan(0);
				expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
			}

			if (entry.matchMode !== undefined) {
				expect(['word', 'prefix']).toContain(entry.matchMode);
			}
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = odia.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const e of odia.entries) {
			for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				expect(seen.has(s), `surface "${s}" appears twice in the or pack`).toBe(false);
				seen.add(s);
			}
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of odia.entries) {
			const roms = entry.romanizations ?? [];
			if (roms.length === 0) continue;
			const keys = roms.map(skeletonKey);
			const maxLen = Math.max(...keys.map((k) => k.length));
			if (maxLen < 4) {
				expect(
					entry.skeletonSafe,
					`entry "${entry.lemma}" has only short skeleton keys [${keys.join(', ')}] and must set skeletonSafe: false`,
				).toBe(false);
			}
		}
	});

	it('gives every prefix-mode entry a deliberate allowlist', () => {
		const prefixEntries = odia.entries.filter((e) => e.matchMode === 'prefix');
		// Odia attaches its case suffixes to the noun (ଗାଣ୍ଡିରେ, ଗାଣ୍ଡିକୁ), so
		// prefix mode is not a Dravidian-only device; if this drops to zero that
		// finding has been lost.
		expect(prefixEntries.length).toBeGreaterThanOrEqual(1);
		for (const e of prefixEntries) {
			expect(
				(e.allowlist ?? []).length,
				`prefix entry "${e.lemma}" must carry an allowlist`,
			).toBeGreaterThan(0);
			for (const surface of [e.lemma, ...(e.romanizations ?? [])]) {
				expect(
					surface.length,
					`prefix surface "${surface}" is too short to be safe`,
				).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it('keeps ବାଣ୍ଡ in word mode — its stem starts three innocent words', () => {
		// ବାଣ୍ଡି "bullock cart", ବାଣ୍ଡେଜ୍ "bandage", ବାଣ୍ଡ୍ "(musical) band".
		const banda = odia.entries.find((e) => e.lemma === 'ବାଣ୍ଡ');
		expect(banda).toBeDefined();
		expect(banda!.matchMode ?? 'word').toBe('word');
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			odia.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('ମାଘିଆ')).toBe(4);
		expect(severityOf('ଭଉଣୀଘିଆ')).toBe(4);
		expect(severityOf('ବେଧେଈ')).toBe(4);
		expect(severityOf('ଗାଣ୍ଡିଆ')).toBe(4);
		expect(severityOf('ଗାଣ୍ଡି')).toBe(3);
		expect(severityOf('ବାଣ୍ଡ')).toBe(3);
		expect(severityOf('ଚଣ୍ଡାଳ')).toBe(3);
		expect(odia.entries.find((e) => e.lemma === 'ମାଘିଆ')!.casualUse).toBe(true);
	});

	it('tags the caste slur casteist and ships it native-script-only', () => {
		const chandala = odia.entries.find((e) => e.lemma === 'ଚଣ୍ଡାଳ');
		expect(chandala).toBeDefined();
		expect(chandala!.categories).toContain('casteist');
		// "chandala" is also the spelling used in academic and religious writing
		// about the varna system — the Latin form is the ambiguous half, so the
		// pack ships native script only (policy rule 2, the தோட்டி precedent).
		expect(chandala!.romanizations ?? []).toEqual([]);
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(odia.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'banda', // Banda Aceh / the Banda Sea; "band, gang" in Spanish and Italian
			'gandi', // Hindi गंदी "dirty" — "gandi baat"
			'gandia', // Gandía, the Valencian city
			'magia', // "magic" in Italian, Spanish and Polish
			'magi', // the Magi; also ମାଗି "having begged"
			'maghi', // the Maghi festival
			'bia', // three letters, and a name/acronym in Latin script
			'chinali', // the Chinali people and language of Himachal Pradesh
			'chandala', // the academic spelling of the varna term
			'randa', // ରଣ୍ଡା is the ordinary Odia word for "widow"
			'pela', // ପେଲିବା "to push" is an everyday verb
			'dana', // "grain"
			'senti', // Indian-English "senti" (sentimental)
			'hijra', // the neutral self-identifier, never a pattern
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be an or romanization`).toBe(false);
		}
	});

	it('excludes the merely-rude and the clinical vocabulary', () => {
		const surfaces = new Set(
			odia.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const junk of [
			'ଅଭଦ୍ର', // "mannerless"
			'ବୋକା', // "fool"
			'ଗଧ', // "donkey"
			'ଘୁଷୁରି', // "pig"
			'କୁକୁର', // "dog"
			'ପାଗଳ', // "mad"
			'ବେଶ୍ୟା', // the neutral dictionary word for "prostitute"
			'ତୃତୀୟ ଲିଙ୍ଗ', // the respectful term — must never appear in a list like this
			'ପେଲିବା',
			'ଚୁକିବା',
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the or pack`).toBe(false);
		}
	});

	it('ships no severity-1 entries at all, matching the Hindi pack’s bar', () => {
		for (const e of odia.entries) {
			expect(e.severity, `"${e.lemma}" severity`).toBeGreaterThanOrEqual(2);
		}
	});

	it('carries the pack-wide allowlist for Odia proper nouns and homographs', () => {
		for (const phrase of ['ଗାଣ୍ଡିବ', 'ବାଣ୍ଡି', 'ପୁଦିନା', 'gandiva', 'gandhi', 'magha', 'pudina']) {
			expect(odia.allowlist, phrase).toContain(phrase);
		}
		for (const a of odia.allowlist ?? []) {
			expect(a).toBe(a.toLowerCase());
		}
	});
});

describe('cross-pack sanity', () => {
	// Standing project decision: every pack is SELF-SUFFICIENT. A consumer
	// importing only data/or must get full Odia coverage, so Latin spellings
	// Odia shares with another language are listed here too rather than
	// deferred. These two tests are the guard rails on that: the overlap must
	// exist where the shared word is real, and must stay a short deliberate
	// list rather than drifting into a copy of the Hindi pack.
	const otherSurfaces = new Set(
		[...hindi.entries, ...english.entries, ...tamil.entries].flatMap((e) => [
			e.lemma,
			...(e.romanizations ?? []),
			...(e.variants ?? []),
		]),
	);

	it('carries the borrowed romanizations rather than deferring them', () => {
		const roms = new Set(odia.entries.flatMap((e) => e.romanizations ?? []));
		for (const shared of ['randi', 'gandu', 'madarchod']) {
			expect(roms.has(shared), `"${shared}" must be listed in the or pack too`).toBe(true);
			expect(otherSurfaces.has(shared), `"${shared}" should be a KNOWN overlap`).toBe(true);
		}
	});

	it('keeps the overlap deliberate and small', () => {
		// Every intentional overlap, with the reason it is one. Anything else
		// appearing here means a surface was copied in by accident.
		const intended = new Set([
			'randi', // ରଣ୍ଡୀ, in Praharaj and in the Odia crowd list
			'gandu', // ଗାଣ୍ଡୁ, in Praharaj
			'gaandu',
			'gandoo',
			'madarchod', // ମାଦରଚୋଦ, attested romanized as "madarchaut"
		]);
		for (const e of odia.entries) {
			for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				if (!otherSurfaces.has(s)) continue;
				expect(intended.has(s), `undocumented cross-pack surface "${s}"`).toBe(true);
			}
		}
	});

	it('does not import the pan-Indian words Odia’s own corpus never attested', () => {
		// Self-sufficiency is not "copy the Hindi pack": a borrowed lemma still
		// needs an Odia source.
		const surfaces = new Set(
			odia.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const unsourced of ['chutiya', 'chutia', 'bhosdike', 'bhosadi', 'jhaant', 'harami']) {
			expect(surfaces.has(unsourced), `"${unsourced}" is not sourced for Odia`).toBe(false);
		}
	});

	it('keeps every Odia entry tagged with the Orya script code', () => {
		// The Hindi pack proves an entry may be Latn; this pack has no such
		// entry, so a stray one means a romanization was promoted by accident.
		expect(odia.entries.every((e) => e.script === 'Orya')).toBe(true);
	});

	it('has no allowlist phrase that suppresses one of its own surface forms', () => {
		// or is the pack the cross-pack allowlist bug was reported against
		// (`chhinali` dead whenever data/kn was loaded), so it carries the
		// same self-check the bn, mr, pa and gu suites do. The all-packs half
		// of it lives in test/all-packs-dictionary-sweep.test.ts.
		const matcher = createMatcher({ packs: [odia] });
		for (const e of odia.entries) {
			for (const surface of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]) {
				expect(
					matcher.isClean(surface),
					`surface "${surface}" of "${e.lemma}" is suppressed by an allowlist phrase in its own pack`,
				).toBe(false);
			}
		}
	});
});
