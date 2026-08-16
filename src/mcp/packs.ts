/**
 * The eleven shipped language packs, and the matcher cache the tools call
 * through.
 *
 * Two rules from the brief meet here:
 *
 *   * "Build one matcher at startup and reuse it." The default matcher — every
 *     enabled pack, `minSeverity` 0 — is built once by `createRegistry` and is
 *     what almost every request uses.
 *   * A request may narrow to a subset of languages. That cannot be served by
 *     filtering the full matcher's output: loading one pack is not the same as
 *     loading eleven and discarding ten languages' matches. The allowlist scope
 *     is global across loaded packs, two packs sharing a lemma string collapse
 *     to one candidate carrying the strictest reading of both, and load order
 *     decides the reported `language` on a tie (AGENTS.md). So a narrowed
 *     request gets a genuinely narrowed matcher — built on first use and then
 *     CACHED, never per request.
 *
 * `minSeverity` is part of the cache key for the same reason. It is not a
 * post-filter on `scan()` output: the matcher applies it before overlap
 * resolution, so a suppressed high-precision candidate can let a lower-ranked
 * one that overlaps it through. Filtering afterwards would answer a subtly
 * different question.
 *
 * The cache is bounded, because the key space is (2^11 - 1) x 5 and a client
 * is free to walk it.
 */

import { createMatcher } from '../index.js';
import type { LanguagePack, Matcher, Severity } from '../index.js';

import { bengali } from '../data/bn.js';
import { english } from '../data/en.js';
import { gujarati } from '../data/gu.js';
import { hindi } from '../data/hi.js';
import { kannada } from '../data/kn.js';
import { malayalam } from '../data/ml.js';
import { marathi } from '../data/mr.js';
import { odia } from '../data/or.js';
import { punjabi } from '../data/pa.js';
import { tamil } from '../data/ta.js';
import { telugu } from '../data/te.js';

/**
 * Every pack the server can load, in the order `createMatcher` receives them.
 * Load order is the tie-break for a match's reported `language`, so it is
 * fixed here rather than derived from whatever order a caller listed codes in.
 */
export const ALL_PACKS: readonly LanguagePack[] = [
	hindi,
	english,
	bengali,
	marathi,
	punjabi,
	gujarati,
	odia,
	tamil,
	telugu,
	kannada,
	malayalam,
];

export const ALL_LANGUAGE_CODES: readonly string[] = ALL_PACKS.map((p) => p.language);

/** What `list_languages` reports for one pack. */
export interface LanguageSummary {
	code: string;
	name: string;
	/** ISO 15924 codes present among the pack's lemmas, in first-seen order. */
	scripts: string[];
	lemmaCount: number;
}

function summarize(pack: LanguagePack): LanguageSummary {
	const scripts: string[] = [];
	for (const entry of pack.entries) {
		if (!scripts.includes(entry.script)) scripts.push(entry.script);
	}
	return {
		code: pack.language,
		name: pack.name,
		scripts,
		lemmaCount: pack.entries.length,
	};
}

/** Most a narrowed matcher cache will hold before the oldest entry is dropped. */
const MATCHER_CACHE_LIMIT = 16;

export interface MatcherRegistry {
	/** Language codes this server process will serve, in load order. */
	readonly enabled: readonly string[];
	readonly summaries: readonly LanguageSummary[];
	/**
	 * A matcher for `codes` (undefined = every enabled pack) at `minSeverity`.
	 * Throws `UnknownLanguageError` if a code is not enabled.
	 */
	matcherFor(codes: readonly string[] | undefined, minSeverity: Severity): Matcher;
}

export class UnknownLanguageError extends Error {
	constructor(readonly code: string, readonly enabled: readonly string[]) {
		super(
			`Unknown or disabled language "${code}". This server was started with: ` +
				`${enabled.join(', ')}.`,
		);
		this.name = 'UnknownLanguageError';
	}
}

/**
 * `languages` narrows which packs the process serves at
 * all (`--languages` / `REMOVE_PROFANITY_LANGUAGES`); undefined means all
 * eleven. The default matcher is constructed eagerly, so the ~34 ms cold cost
 * is paid during client startup rather than inside the first tool call.
 */
export function createRegistry(languages?: readonly string[]): MatcherRegistry {
	const packs =
		languages === undefined
			? ALL_PACKS
			: ALL_PACKS.filter((p) => languages.includes(p.language));

	if (languages !== undefined) {
		for (const code of languages) {
			if (!ALL_LANGUAGE_CODES.includes(code)) {
				throw new UnknownLanguageError(code, ALL_LANGUAGE_CODES);
			}
		}
	}
	if (packs.length === 0) {
		throw new Error('At least one language pack must be enabled.');
	}

	const enabled = packs.map((p) => p.language);
	const summaries = packs.map(summarize);
	const cache = new Map<string, Matcher>();

	const build = (subset: readonly LanguagePack[], minSeverity: Severity): Matcher =>
		createMatcher({ packs: [...subset], minSeverity });

	// Built now, and never evicted: it is the answer to a request that named no
	// languages, which is the overwhelming majority of them.
	const defaultMatcher = build(packs, 0);

	const matcherFor = (
		codes: readonly string[] | undefined,
		minSeverity: Severity,
	): Matcher => {
		if (codes !== undefined) {
			for (const code of codes) {
				if (!enabled.includes(code)) throw new UnknownLanguageError(code, enabled);
			}
		}
		// Normalize to load order and drop duplicates, so ['en','hi'] and
		// ['hi','en','hi'] are one cache entry and one load order.
		const wanted =
			codes === undefined ? enabled : enabled.filter((c) => codes.includes(c));
		if (wanted.length === 0) {
			throw new Error('`languages` was given but selected no packs.');
		}
		if (minSeverity === 0 && wanted.length === enabled.length) return defaultMatcher;

		const key = `${wanted.join(',')}|${minSeverity}`;
		const hit = cache.get(key);
		if (hit !== undefined) return hit;

		const built = build(
			packs.filter((p) => wanted.includes(p.language)),
			minSeverity,
		);
		// Map iterates in insertion order, so the first key is the oldest.
		if (cache.size >= MATCHER_CACHE_LIMIT) {
			const oldest = cache.keys().next();
			if (!oldest.done) cache.delete(oldest.value);
		}
		cache.set(key, built);
		return built;
	};

	return { enabled, summaries, matcherFor };
}
