/**
 * Shared types for remove-profanity. This file imports only
 * `unicode/code-units.ts` (which imports nothing), so it sits at the root of
 * the dependency graph and can never create a cycle. Most modules import from
 * it; the two that do not — `ahocorasick.ts` and `graphemes.ts` — are
 * deliberately generic (a string automaton and a grapheme segmenter, neither
 * of which knows what a profanity match is).
 */

import {
	codeUnitAt,
	codeUnitsToString,
	profileUnits,
	stringToCodeUnits,
	type UnitProfile,
} from './unicode/code-units.js';

/** 0 = mild insult … 4 = extreme slur. One rubric, documented in the README. */
export type Severity = 0 | 1 | 2 | 3 | 4;

export type Category =
	| 'slur'
	| 'casteist'
	| 'religious'
	| 'gendered'
	| 'sexual'
	| 'ableist'
	| 'violence'
	| 'general';

/**
 * One dictionary entry = one lemma (canonical word), which may carry many
 * surface forms. The engine — not the data — is responsible for catching
 * spelling variants beyond the curated ones.
 */
export interface LemmaEntry {
	/** Canonical form. Native script preferred where one exists. */
	lemma: string;
	/** ISO 639-1 language code ('hi', 'en', …). */
	language: string;
	/** ISO 15924 script of the lemma field ('Deva', 'Latn', …). */
	script: string;
	severity: Severity;
	categories: Category[];
	/** Curated Latin-script spellings (Hinglish etc.). Lowercase. */
	romanizations?: string[];
	/** Native-script variant spellings not derivable by normalization. */
	variants?: string[];
	/**
	 * Longer phrases containing this word that must NOT match
	 * (e.g. for a romanization "gand": ["gandhi", "uganda"]).
	 * Lowercase; matched in the same normalized space as the term.
	 */
	allowlist?: string[];
	/**
	 * 'word' (default): surface form must span a whole token.
	 * 'prefix': token must *start* with the surface form (Dravidian stems).
	 */
	matchMode?: 'word' | 'prefix';
	/**
	 * Include this lemma in the phonetic-skeleton (recall) tier.
	 * Default true; set false for collision-prone short words.
	 */
	skeletonSafe?: boolean;
	/** Uli-style flag: often used conversationally rather than abusively. */
	casualUse?: boolean;
}

export interface LanguagePack {
	/** ISO 639-1 code. */
	language: string;
	/** Human-readable name, e.g. 'Hindi + Hinglish'. */
	name: string;
	entries: LemmaEntry[];
	/** Pack-wide allowlist phrases (proper nouns, place names …). */
	allowlist?: string[];
}

/**
 * Which tier produced a match. exact = high precision; skeleton = high recall.
 * `masked` (f*ck) and `separated` (f u c k, s.h.i.t) are obfuscation tiers:
 * both resolve a deformed token against the dictionary and are as precise as
 * `exact`, because both require a full dictionary hit rather than a partial one.
 */
export type MatchTier = 'exact' | 'masked' | 'separated' | 'skeleton';

export interface ProfanityMatch {
	/** Canonical lemma of the matched entry. */
	lemma: string;
	/** The exact original-text slice that matched. */
	surface: string;
	tier: MatchTier;
	language: string;
	severity: Severity;
	categories: Category[];
	/** Start index (UTF-16 code units) into the ORIGINAL input string. */
	start: number;
	/** End index, exclusive, into the ORIGINAL input string. */
	end: number;
	/**
	 * True when the matched entry is often used conversationally rather than
	 * abusively (saala, chakka…) — consider a lighter action for these.
	 */
	casualUse: boolean;
}

export interface ScanResult {
	matches: ProfanityMatch[];
	/** Highest severity among matches, or null when clean. */
	maxSeverity: Severity | null;
}

export interface CensorOptions {
	/** Masking character, repeated per grapheme cluster. Default '*'. */
	mask?: string;
	/** Keep the first grapheme cluster of each match visible (f***). */
	keepFirst?: boolean;
}

export interface MatcherOptions {
	packs: LanguagePack[];
	/** Suppress matches below this severity. Default 0 (report all). */
	minSeverity?: Severity;
	/** Only report matches in these categories (default: all). */
	categories?: Category[];
	/**
	 * exact: always on.
	 * skeleton: false = off, true = report as normal matches,
	 * 'flag' = report but callers should treat as review-not-block.
	 * Default: true.
	 */
	skeletonTier?: boolean | 'flag';
	/**
	 * Resolve masked tokens (f*ck, bh#sdike — mask chars * # @ $ %) against
	 * the dictionary, one or two masks per token, never at the edges.
	 * Default: true.
	 */
	maskedTier?: boolean;
	/** Extra terms to detect (treated as language 'custom', severity 2). */
	customWords?: string[];
	/** Extra allowlist phrases. */
	customAllowlist?: string[];
}

export interface Matcher {
	scan(text: string): ScanResult;
	/**
	 * True when scan() would report no match. Stops at the first surviving
	 * candidate, so it skips every later tier (including the skeleton fold
	 * over the whole text) and never sorts or builds match objects. The exact
	 * passes still run whole: an allow phrase found in a later pass can veto a
	 * candidate found in an earlier one.
	 */
	isClean(text: string): boolean;
	censor(text: string, options?: CensorOptions): string;
}

/**
 * Result of applying a fold to a string. `map` has one entry per UTF-16 code
 * unit of `output`; map[i] is the index (code unit, into the fold's INPUT
 * string) of the character that produced output unit i. Deleted characters
 * simply never appear in the map. An inserted/expanded character maps to the
 * input index of the character it came from.
 */
export interface FoldResult {
	output: string;
	map: number[];
}

/** A fold rewrites a whole string, unlike obscenity's 1-codepoint contract. */
export type Fold = (input: string) => FoldResult;

/**
 * True when every code unit is ASCII. The engine reads the same fact from
 * `UnitProfile.allAscii`, which one sweep computes alongside the rest of the
 * profile; this string form remains for callers holding no UnitText.
 */
export function isAllAscii(s: string): boolean {
	const n = s.length;
	for (let i = 0; i < n; i++) {
		if (codeUnitAt(s, i) >= 0x80) return false;
	}
	return true;
}

/**
 * A string together with its code units and its profile — what the engine
 * actually reads. `units[i]` is `text.charCodeAt(i)`, `n` is `text.length`
 * hoisted once, and `profile` is the one-sweep summary the gates consult
 * (`unicode/code-units.ts` has both, and why the hot loops read units rather
 * than the string).
 */
export interface UnitText {
	readonly text: string;
	readonly units: Uint16Array;
	readonly n: number;
	readonly profile: UnitProfile;
}

/**
 * The profile is computed on first read and cached: the collapsed pass and
 * the skeleton pass are consulted by no gate, so their sweep would be paid
 * for nothing.
 */
export function unitTextOf(text: string): UnitText {
	const units = stringToCodeUnits(text);
	const n = text.length;
	let profile: UnitProfile | undefined;
	return {
		text,
		units,
		n,
		get profile(): UnitProfile {
			return (profile ??= profileUnits(units, n));
		},
	};
}

/**
 * A UnitText from code units, for a pass that was produced as units and whose
 * string nobody may ever ask for: `text` is materialised on first read.
 */
export function unitTextOfUnits(units: Uint16Array, n: number): UnitText {
	let text: string | undefined;
	let profile: UnitProfile | undefined;
	return {
		get text(): string {
			return (text ??= codeUnitsToString(units, n));
		},
		units,
		n,
		get profile(): UnitProfile {
			return (profile ??= profileUnits(units, n));
		},
	};
}

/**
 * `result.output` as a UnitText: `prev` itself when the fold changed nothing
 * (its output IS `prev.text`), else built once from the new output.
 */
export function unitTextOfResult(prev: UnitText, result: FoldResult): UnitText {
	return result.output === prev.text ? prev : unitTextOf(result.output);
}

/**
 * A fold over a UnitText — the form the matcher runs. Every string `Fold`
 * in this package is `(input) => f(unitTextOf(input))` for some UnitFold
 * `f`, so there is one code path and the string form is only a wrapper.
 */
export type UnitFold = (t: UnitText) => FoldResult;

/**
 * Identity fold: output === input, map[i] === i.
 *
 * The map is built on first read. Most folds are no-ops on most input, and a
 * no-op's map is usually consumed by nothing at all — `chainFolds` short-cuts
 * past it, and the matcher only reads offsets where a pattern actually hit.
 * Materializing an n-element array per no-op fold was the single biggest cost
 * in the scan pipeline, so it is deferred until something asks for it.
 */
class IdentityResult implements FoldResult {
	readonly output: string;
	private built: number[] | undefined;

	constructor(input: string) {
		this.output = input;
		// An OWN accessor, so the instance has exactly the two enumerable
		// properties the FoldResult contract describes (`output`, `map`) and
		// nothing else observable; a prototype getter would not be an own key.
		Object.defineProperty(this, 'map', {
			get: this.buildMap,
			enumerable: true,
			configurable: true,
		});
	}

	// Never reached at runtime (the own accessor shadows it); declared so the
	// class satisfies FoldResult.
	get map(): number[] {
		return this.buildMap();
	}

	private buildMap(this: IdentityResult): number[] {
		if (this.built === undefined) {
			const n = this.output.length;
			const built = new Array<number>(n);
			for (let i = 0; i < n; i++) built[i] = i;
			this.built = built;
		}
		return this.built;
	}
}

export function identityFold(input: string): FoldResult {
	return new IdentityResult(input);
}

/**
 * True for a result of `identityFold` (output === input, map[i] === i). An
 * `instanceof` rather than a WeakSet registration: identity results are made
 * ~20,000 times per matcher construction (every no-op fold of every
 * dictionary surface), and the WeakSet add was ~30% of construction.
 */
export function isIdentityResult(result: FoldResult): boolean {
	return result instanceof IdentityResult;
}

/**
 * Chain a later FoldResult (computed on `first.output`) onto `first`, so the
 * resulting map points back at `first`'s input coordinates.
 *
 * Both shortcuts below matter because most folds are no-ops on most text:
 * when the second fold changed nothing, `first` is already the answer; when
 * the FIRST was the identity, `second` already points at the right places.
 * Either way the remap loop — and materializing an identity map to feed it —
 * is skipped entirely.
 */
export function chainFolds(first: FoldResult, second: FoldResult): FoldResult {
	if (second.output === first.output) return first;
	if (first instanceof IdentityResult) return second;
	const n = second.output.length;
	const map = new Array<number>(n);
	const firstMap = first.map;
	const secondMap = second.map;
	for (let i = 0; i < n; i++) map[i] = firstMap[secondMap[i]!]!;
	return { output: second.output, map };
}

/**
 * Compose folds left-to-right: composeFolds(a, b)(s) applies a then b,
 * with the returned map pointing all the way back to the original input.
 */
export function composeFolds(...folds: Fold[]): Fold {
	return (input: string): FoldResult => {
		if (folds.length === 0) return identityFold(input);
		let current = folds[0]!(input);
		for (let f = 1; f < folds.length; f++) {
			current = chainFolds(current, folds[f]!(current.output));
		}
		return current;
	};
}

/**
 * Emitter shared by every hand-written fold: accumulates output and its
 * offset map, but stays in a zero-work "unchanged so far" state until the
 * first character is actually rewritten. A fold that changes nothing returns
 * its input string by reference (which `chainFolds` uses to skip remapping)
 * and materializes the identity map in one tight loop.
 */
export class FoldBuilder {
	private readonly input: string;
	/** Pending run of copied-through input, [runStart, runEnd); -1 = none. */
	private runStart = -1;
	private runEnd = 0;
	/** False while nothing has been rewritten yet. */
	private dirty = false;
	private out = '';
	private readonly map: number[] = [];
	private n = 0;

	constructor(input: string) {
		this.input = input;
	}

	/**
	 * Copy input[i .. i+len) through unchanged. Consecutive keeps coalesce
	 * into one run so the output is built with slice-sized appends rather
	 * than one string concatenation per character.
	 */
	keep(i: number, len: number): void {
		if (this.runStart < 0) this.runStart = i;
		this.runEnd = i + len;
	}

	/**
	 * Copy input[i .. i+len) through unchanged, but attribute EVERY output
	 * unit to input index `src` rather than to its own. Used where a whole
	 * cluster is credited to its first character (NFC segments, supplementary
	 * code points), which the identity map cannot express.
	 */
	keepAt(i: number, len: number, src: number): void {
		if (len === 1 && src === i) {
			this.keep(i, 1);
			return;
		}
		this.flushRun();
		this.dirty = true;
		this.out += this.input.slice(i, i + len);
		const map = this.map;
		for (let u = 0; u < len; u++) map[this.n++] = src;
	}

	/**
	 * Copy one whole code point through unchanged. A supplementary code point
	 * cannot use the identity fast path: the FoldResult contract says BOTH of
	 * its UTF-16 units map to the code point's first index, not to their own.
	 */
	keepCodePoint(i: number, unitLen: number): void {
		this.keepAt(i, unitLen, i);
	}

	/** Replace input[i .. i+len) with `replacement` ('' deletes it). */
	replace(i: number, _len: number, replacement: string): void {
		this.flushRun();
		this.dirty = true;
		if (replacement.length === 0) return;
		this.out += replacement;
		const map = this.map;
		const len = replacement.length;
		for (let u = 0; u < len; u++) map[this.n++] = i;
	}

	private flushRun(): void {
		const start = this.runStart;
		if (start < 0) return;
		const end = this.runEnd;
		this.runStart = -1;
		this.out += this.input.slice(start, end);
		const map = this.map;
		for (let k = start; k < end; k++) map[this.n++] = k;
	}

	finish(): FoldResult {
		if (!this.dirty) return identityFold(this.input);
		this.flushRun();
		const map = this.map;
		map.length = this.n;
		return { output: this.out, map };
	}
}

/**
 * Build a fold from a per-code-point mapping function. The callback returns
 * a replacement string ('' = delete, undefined = keep as-is).
 */
export function codePointFoldUnits(
	mapFn: (codePoint: number) => string | undefined,
): UnitFold {
	return ({ text: input, units, n }: UnitText): FoldResult => {
		const b = new FoldBuilder(input);
		let i = 0;
		while (i < n) {
			// Explicit surrogate pairing: same result as codePointAt, without
			// its per-call bounds and pair re-checks.
			const unit = units[i]!;
			let cp = unit;
			let unitLen = 1;
			if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < n) {
				const low = units[i + 1]!;
				if (low >= 0xdc00 && low <= 0xdfff) {
					cp = (unit - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
					unitLen = 2;
				}
			}
			const replacement = mapFn(cp);
			if (replacement === undefined) b.keepCodePoint(i, unitLen);
			else b.replace(i, unitLen, replacement);
			i += unitLen;
		}
		return b.finish();
	};
}

/** `codePointFoldUnits` as a string `Fold`. */
export function codePointFold(
	mapFn: (codePoint: number) => string | undefined,
): Fold {
	const f = codePointFoldUnits(mapFn);
	return (input: string): FoldResult => f(unitTextOf(input));
}
