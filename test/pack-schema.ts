/**
 * Shared schema assertions for the te / kn / ml packs.
 *
 * `test/data.test.ts` and `test/tamil-data.test.ts` each inline these checks.
 * Repeating them a third, fourth and fifth time would have meant five copies
 * of the same invariants drifting apart, so the language-agnostic half lives
 * here and each `<lang>-data.test.ts` keeps only what is actually specific to
 * its language (severities, deliberate omissions, prefix defences).
 *
 * Imports nothing from `src/` except the shared types — the skeleton
 * algorithm is restated independently in `dravidian-skeleton-key.ts`.
 */
import { expect } from 'vitest';
import type { Category, LanguagePack } from '../src/types.js';
import { MIN_SKELETON_KEY_LENGTH, skeletonKey } from './dravidian-skeleton-key.js';

const ALLOWED_CATEGORIES: readonly Category[] = [
	'slur',
	'casteist',
	'religious',
	'gendered',
	'sexual',
	'ableist',
	'violence',
	'general',
];

export interface PackExpectations {
	language: string;
	script: string;
	/** Matches the lemma of every entry, e.g. /\p{Script=Telugu}/u. */
	lemmaScript: RegExp;
	/**
	 * Minimum length of a surface form used as a `matchMode: 'prefix'`
	 * pattern. Latin needs 4 (the Tamil bar). Native Indic surfaces are
	 * allowed 3, because one Indic code unit routinely carries a consonant
	 * plus a vowel sign or an anusvara — లంజ is three units and five phonemes.
	 */
	minPrefixLatin?: number;
	minPrefixNative?: number;
}

/** Every invariant that does not depend on which language the pack is. */
export function expectValidPack(pack: LanguagePack, opts: PackExpectations): void {
	expect(pack.language).toBe(opts.language);
	expect(pack.name.length).toBeGreaterThan(0);

	for (const entry of pack.entries) {
		const label = `entry "${entry.lemma}"`;

		expect(Number.isInteger(entry.severity), `${label} severity integral`).toBe(true);
		expect(entry.severity, `${label} severity >= 0`).toBeGreaterThanOrEqual(0);
		expect(entry.severity, `${label} severity <= 4`).toBeLessThanOrEqual(4);
		// Word-list policy rule 3: severity-1 coarse words are not shipped in
		// the Dravidian packs at all.
		expect(entry.severity, `${label} is above the coarse-word bar`).toBeGreaterThanOrEqual(2);

		expect(entry.categories.length, `${label} has categories`).toBeGreaterThan(0);
		for (const cat of entry.categories) {
			expect(ALLOWED_CATEGORIES, `${label} category "${cat}"`).toContain(cat);
		}
		expect(new Set(entry.categories).size, `${label} duplicate category`).toBe(
			entry.categories.length,
		);

		expect(entry.lemma.trim(), `${label} lemma trimmed`).toBe(entry.lemma);
		expect(entry.lemma.length, `${label} lemma non-empty`).toBeGreaterThan(0);
		expect(entry.language, `${label} language`).toBe(opts.language);
		expect(entry.script, `${label} script`).toBe(opts.script);
		expect(opts.lemmaScript.test(entry.lemma), `${label} lemma is native script`).toBe(true);

		for (const r of entry.romanizations ?? []) {
			expect(r.length, `${label} romanization non-empty`).toBeGreaterThan(0);
			expect(r, `${label} romanization "${r}" lowercase`).toBe(r.toLowerCase());
			expect(r.trim(), `${label} romanization "${r}" trimmed`).toBe(r);
			expect(/^[a-z ]+$/.test(r), `${label} romanization "${r}" is plain Latin`).toBe(true);
		}
		for (const v of entry.variants ?? []) {
			expect(v.length, `${label} variant non-empty`).toBeGreaterThan(0);
			expect(v.trim(), `${label} variant trimmed`).toBe(v);
			expect(opts.lemmaScript.test(v), `${label} variant "${v}" is native script`).toBe(true);
		}
		for (const a of entry.allowlist ?? []) {
			expect(a.length, `${label} allowlist non-empty`).toBeGreaterThan(0);
			expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
		}
		if (entry.matchMode !== undefined) {
			expect(['word', 'prefix']).toContain(entry.matchMode);
		}

		// The mechanical half of the skeletonSafe rule: an entry whose keys
		// are ALL below the engine's minimum can never contribute to the
		// skeleton tier, so saying so explicitly keeps the intent readable.
		const keys = (entry.romanizations ?? []).map(skeletonKey);
		if (keys.length > 0 && Math.max(...keys.map((k) => k.length)) < MIN_SKELETON_KEY_LENGTH) {
			expect(
				entry.skeletonSafe,
				`${label} has only short skeleton keys [${keys.join(', ')}] and must set skeletonSafe: false`,
			).toBe(false);
		}
	}

	// No lemma twice, and no surface form listed twice anywhere in the pack.
	const lemmas = pack.entries.map((e) => e.lemma);
	expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);
	const seen = new Set<string>();
	for (const e of pack.entries) {
		for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
			expect(seen.has(s), `surface "${s}" appears twice in the ${opts.language} pack`).toBe(
				false,
			);
			seen.add(s);
		}
	}

	for (const a of pack.allowlist ?? []) {
		expect(a, `pack allowlist "${a}" lowercase`).toBe(a.toLowerCase());
	}
}

/**
 * Prefix mode is the most dangerous thing in a Dravidian pack: it fires on
 * any token that STARTS with a listed surface. Every prefix entry must carry
 * an allowlist naming something real it would otherwise swallow, and no
 * prefix surface may be short enough to be a substring search.
 */
export function expectDefendedPrefixEntries(
	pack: LanguagePack,
	opts: PackExpectations,
): void {
	const minLatin = opts.minPrefixLatin ?? 4;
	const minNative = opts.minPrefixNative ?? 3;
	for (const e of pack.entries.filter((x) => x.matchMode === 'prefix')) {
		expect(
			(e.allowlist ?? []).length,
			`prefix entry "${e.lemma}" must carry an allowlist`,
		).toBeGreaterThan(0);
		for (const surface of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]) {
			const native = opts.lemmaScript.test(surface);
			const min = native ? minNative : minLatin;
			expect(
				surface.length,
				`prefix surface "${surface}" (${native ? 'native' : 'latin'}) is too short to be safe`,
			).toBeGreaterThanOrEqual(min);
		}
	}
}
