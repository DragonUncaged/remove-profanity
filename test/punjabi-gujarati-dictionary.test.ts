/**
 * Dictionary sweep for the pa and gu packs.
 *
 * Every word of /usr/share/dict/words is scanned with ONE pack loaded, and
 * the result is diffed against what the already-shipped packs flag. Anything
 * new is either a deliberate decision with a recorded reason, or a false
 * positive that inspection missed — there is no third category, so the
 * expected set is pinned exactly rather than bounded.
 *
 * This exists because eyeballing a word list does not find these. The
 * skeleton tier in particular reaches words nobody would think to try
 * (the shipped packs already flag "besodden", "beancod", "classed" and
 * "Nimrodian" this way), and a new pack that quietly adds one would sail past
 * every hand-written suite in this directory.
 *
 * The dictionary is a macOS/BSD file. Where it is absent the sweep is skipped
 * rather than failed — it is a development guard, not a portability claim.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error - this package has no @types/node (zero deps, and the only
// test that touches the filesystem is this one). The two functions used are
// re-typed below rather than pulling a whole type package in for a dev guard.
import { readFileSync as rawReadFileSync, existsSync as rawExistsSync } from 'node:fs';
import { createMatcher } from '../src/index.js';
import type { LanguagePack } from '../src/types.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';
import { odia } from '../src/data/or.js';
import { bengali } from '../src/data/bn.js';
import { marathi } from '../src/data/mr.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { malayalam } from '../src/data/ml.js';

const readFileSync = rawReadFileSync as (path: string, encoding: string) => string;
const existsSync = rawExistsSync as (path: string) => boolean;

const DICT = '/usr/share/dict/words';
const haveDict = existsSync(DICT);

function loadDictionary(): string[] {
	if (!haveDict) return [];
	const lines: string[] = readFileSync(DICT, 'utf8').split('\n');
	const seen = new Set<string>();
	for (const line of lines) {
		const w = line.trim();
		if (w.length > 0) seen.add(w);
	}
	return [...seen];
}

const words: string[] = loadDictionary();

function flaggedBy(packs: LanguagePack[]): Set<string> {
	const matcher = createMatcher({ packs });
	const hits = new Set<string>();
	for (const w of words) if (matcher.scan(w).matches.length > 0) hits.add(w);
	return hits;
}

describe.skipIf(!haveDict)('dictionary sweep', () => {
	// What the packs that shipped before this branch already flag. Everything
	// in here is pre-existing behaviour and not this branch's business.
	const shipped: LanguagePack[] = [
		hindi,
		english,
		tamil,
		odia,
		bengali,
		marathi,
		telugu,
		kannada,
		malayalam,
	];
	const baseline = flaggedBy(shipped);

	it('has a non-trivial baseline to diff against', () => {
		expect(words.length).toBeGreaterThan(100_000);
		expect(baseline.size).toBeGreaterThan(10);
	});

	it('pa ALONE flags exactly two words the shipped packs do not', () => {
		const novel = [...flaggedBy([punjabi])].filter((w) => !baseline.has(w)).sort();
		// Both are deliberate, both are recorded in the "Flagged for review —
		// Punjabi" section of docs/language-packs.md, and both have shipped
		// precedent: hi already matches the dictionary entries 'chamar',
		// 'bhangi', 'chut', 'laund' and 'tatta' for the same reason.
		//   chuhra — the dictionary entry IS the caste name this lemma targets;
		//            policy rule 2 says ship it with Balmiki/Valmiki/Mazhabi
		//            allowlisted, which the entry does.
		//   lunn   — a surname and the Sally Lunn teacake; 'sally lunn' is
		//            allowlisted, and the bare word is the Punjabi spelling.
		expect(novel).toEqual(['chuhra', 'lunn']);
	});

	it('gu ALONE flags nothing the shipped packs do not', () => {
		const novel = [...flaggedBy([gujarati])].filter((w) => !baseline.has(w)).sort();
		expect(novel).toEqual([]);
	});

	it('adds no skeleton-tier dictionary hit — the class that bites', () => {
		// The six false positives found in the Bengali and Marathi drafts were
		// all skeleton-tier. pa and gu keep only the three keys hi already
		// ships (bnkd, bsdk, mdrkd / bsdn), so every novel hit here must be a
		// deliberate exact-tier match.
		for (const pack of [punjabi, gujarati]) {
			const matcher = createMatcher({ packs: [pack] });
			for (const w of words) {
				for (const m of matcher.scan(w).matches) {
					if (baseline.has(w)) continue;
					expect(
						m.tier,
						`"${w}" matched ${m.lemma} at tier ${m.tier} in the ${pack.language} pack`,
					).not.toBe('skeleton');
				}
			}
		}
	});

	it('loading pa and gu does not newly flag anything alongside the others', () => {
		const all = [...flaggedBy([...shipped, punjabi, gujarati])].filter(
			(w) => !baseline.has(w),
		);
		expect(all.sort()).toEqual(['chuhra', 'lunn']);
	});
});

/**
 * The mirror of the sweep, and the failure mode main hit when Bengali's
 * romanization landed on an Odia clean case: a pack can break another pack
 * without flagging a single extra dictionary word, because an allow phrase is
 * a suppression span for EVERY pack, not just the one that declares it.
 *
 * Cheap enough to run unconditionally — it needs no dictionary.
 */
describe('cross-pack suppression', () => {
	const shipped: LanguagePack[] = [
		hindi,
		english,
		tamil,
		odia,
		bengali,
		marathi,
		telugu,
		kannada,
		malayalam,
	];
	const surfaces = (p: LanguagePack): string[] =>
		p.entries.flatMap((e) => [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]);

	it('loading pa and gu silences nothing the other packs used to catch', () => {
		const before = createMatcher({ packs: shipped });
		const after = createMatcher({ packs: [...shipped, punjabi, gujarati] });
		const silenced: string[] = [];
		for (const pack of shipped) {
			for (const s of surfaces(pack)) {
				if (!before.isClean(s) && after.isClean(s)) silenced.push(`${s} (${pack.language})`);
			}
		}
		expect(silenced, 'a pa/gu allow phrase is suppressing another pack').toEqual([]);
	});

	it('no pa or gu surface is suppressed by its own pack', () => {
		// An allow phrase that is a PREFIX of one of your own surfaces
		// silently disables it — the trap that killed Bengali's শালা.
		for (const pack of [punjabi, gujarati]) {
			const matcher = createMatcher({ packs: [pack] });
			for (const s of surfaces(pack)) {
				expect(matcher.isClean(s), `"${s}" is suppressed by its own ${pack.language} pack`).toBe(
					false,
				);
			}
		}
	});

	// This is the check that earned its keep: it caught the gu romanization
	// 'chhinali' being silenced by the kn pack's 'chinali' allow phrase (the
	// Chinali people of Himachal), because allow spans were collected from the
	// repeat-collapsed pass too, where 'chhinali' collapses onto 'chinali'.
	// The surface was dropped rather than shipped dead.
	//
	// It read as a cross-pack scoping fault, and it was not one: kn's OWN
	// 'chinaali' was dead the same way. The collapsed pass gates candidates on
	// a real letter-stretch and was gating allow spans on nothing; both sides
	// match now. Keep this check anyway — the global scope it guards is
	// deliberate, and only a check like this keeps it honest. See
	// `test/collapsed-allow-scope.test.ts`.
	it('no pa or gu surface is suppressed by another pack once all are loaded', () => {
		const all = createMatcher({ packs: [...shipped, punjabi, gujarati] });
		for (const pack of [punjabi, gujarati]) {
			for (const s of surfaces(pack)) {
				expect(all.isClean(s), `"${s}" (${pack.language}) is suppressed with all packs loaded`).toBe(
					false,
				);
			}
		}
	});
});
