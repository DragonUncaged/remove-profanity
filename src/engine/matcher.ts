/**
 * The matcher ties the whole pipeline together:
 *
 *   original ──baseFold──▶ pass0 ──latinFold──▶ pass1 ──skeletonFold──▶ pass2
 *
 * Exact-tier Aho-Corasick runs over pass0 and pass1; skeleton-tier over
 * pass2. Every pass carries an offset map back to the original string, so
 * matches, allowlist suppression, and censoring all happen in original
 * coordinates while matching happens in normalized space.
 */

import type {
	Category,
	CensorOptions,
	FoldResult,
	LanguagePack,
	LemmaEntry,
	Matcher,
	MatcherOptions,
	MatchTier,
	ProfanityMatch,
	ScanResult,
	Severity,
} from '../types.js';
import {
	chainFolds,
	isIdentityResult,
	unitTextOf,
	unitTextOfResult,
	unitTextOfUnits,
	type UnitText,
} from '../types.js';
import { baseFold, baseFoldUnits } from '../unicode/normalize.js';
import {
	collapseAllRepeatsFold,
	collapseAllRepeatsFoldUnits,
	latinFold,
	latinFoldUnits,
} from '../folds/latin.js';
import { skeletonKey, skeletonUnitsOf } from '../folds/skeleton.js';
import { AC_ROOT, AhoCorasick, type AcMatch } from './ahocorasick.js';
import { censorText } from './censor.js';
import { codePointAt, codePointAtUnits, codeUnitAt } from '../unicode/code-units.js';

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const MIN_SKELETON_KEY_LENGTH = 4;

/**
 * Per-code-unit `WORD_CHAR`, memoised for the whole process: 1 = word
 * character, 2 = not, 0 = not asked yet. ASCII is filled at load, so the
 * whole-token walks pay one table read per unit there and the `\p{...}`
 * regex runs at most once per distinct non-ASCII unit.
 */
const WORD_UNIT_CLASS: Uint8Array = (() => {
	const t = new Uint8Array(0x10000);
	for (let u = 0; u < 0x80; u++) {
		const isWord =
			(u >= 0x61 && u <= 0x7a) || (u >= 0x41 && u <= 0x5a) || (u >= 0x30 && u <= 0x39);
		t[u] = isWord ? 1 : 2;
	}
	return t;
})();

function isWordUnit(unit: number): boolean {
	const cached = WORD_UNIT_CLASS[unit]!;
	if (cached !== 0) return cached === 1;
	const is = WORD_CHAR.test(String.fromCharCode(unit));
	WORD_UNIT_CLASS[unit] = is ? 1 : 2;
	return is;
}

interface CompiledTerm {
	entry: LemmaEntry;
	matchMode: 'word' | 'prefix';
}

interface Candidate {
	entry: LemmaEntry;
	tier: MatchTier;
	start: number;
	end: number;
	/**
	 * The span the allowlist is tested against. Normally identical to
	 * start/end; for a prefix match it is the STEM only, before the span was
	 * extended over the agglutinated suffix. The allowlist decides whether
	 * something matched at all ("kuthirai" is a horse, not a stem); the
	 * extension only decides how much of the token gets censored, and must
	 * not push the candidate out of an allow span that covers the stem.
	 */
	core?: Span;
}

interface Span {
	start: number;
	end: number;
}

/**
 * What a pass hands the span math: `map[i]` is the ORIGINAL index of output
 * unit i, exactly as `FoldResult.map` — a FoldResult is one of these, and so
 * is the skeleton pass, whose map is a typed array and whose output string
 * is built only if read.
 */
interface PassFold {
	readonly output: string;
	readonly map: ArrayLike<number>;
}

/**
 * Map a span in a pass's output space back to original-string coordinates.
 * The end is derived from the source character of the LAST matched unit, so
 * original text deleted by folds after the match (trailing "!!!", emoji) is
 * never swallowed into the span.
 */
function toOriginalSpan(
	fold: PassFold,
	start: number,
	end: number,
	original: string,
): Span {
	const origStart = fold.map[start]!;
	const lastSource = fold.map[end - 1]!;
	const cp = codePointAt(original, lastSource);
	const origEnd = lastSource + (cp !== undefined && cp > 0xffff ? 2 : 1);
	return { start: origStart, end: Math.max(origEnd, origStart + 1) };
}

/**
 * Reconcile two entries that describe the SAME lemma string over the SAME
 * span — which happens whenever two loaded packs carry a byte-identical
 * lemma, as nine Indian packs sharing vocabulary eventually must. Only one
 * candidate can survive the span, so the survivor takes the strictest reading
 * of the two rather than whichever pack was imported first: the highest
 * severity (and, with it, that entry's attribution), the union of the
 * categories, and `casualUse` only where BOTH packs agree the term has one.
 * Equal severity keeps the first pack's attribution, so load order still
 * decides the label — but never the verdict.
 */
function mergeEntries(a: LemmaEntry, b: LemmaEntry): LemmaEntry {
	// The overwhelmingly common case: the same entry hit twice, once per pass.
	if (a === b) return a;
	const primary = b.severity > a.severity ? b : a;
	const other = primary === a ? b : a;
	const categories = [...primary.categories];
	for (const cat of other.categories) {
		if (!categories.includes(cat)) categories.push(cat);
	}
	const casualUse = (a.casualUse ?? false) && (b.casualUse ?? false);
	if (
		categories.length === primary.categories.length &&
		casualUse === (primary.casualUse ?? false)
	) {
		return primary;
	}
	return { ...primary, categories, casualUse };
}

function containedIn(span: Span, containers: Span[]): boolean {
	for (const c of containers) {
		if (c.start <= span.start && span.end <= c.end) return true;
	}
	return false;
}

/** Normalize a dictionary surface form the same way input text is normalized. */
function normalizeTerm(term: string): string {
	return baseFold(term).output;
}

/**
 * The two spaces a surface form is indexed in: pass-0 normalized, and pass-1
 * latinized (which is the latin fold OF the normalized form, so the base fold
 * runs once). One entry when the latin fold changes nothing.
 */
function termForms(term: string): Set<string> {
	const normalized = normalizeTerm(term);
	return new Set([normalized, latinFold(normalized).output]);
}

export function createMatcher(options: MatcherOptions): Matcher {
	const minSeverity: Severity = options.minSeverity ?? 0;
	const categoryFilter: ReadonlySet<Category> | null = options.categories
		? new Set(options.categories)
		: null;
	const skeletonTier = options.skeletonTier ?? true;
	const maskedTier = options.maskedTier ?? true;

	const entries: LemmaEntry[] = [];
	const packAllowlist: string[] = [...(options.customAllowlist ?? [])];
	for (const pack of options.packs) {
		entries.push(...pack.entries);
		if (pack.allowlist) packAllowlist.push(...pack.allowlist);
	}
	for (const word of options.customWords ?? []) {
		entries.push({
			lemma: word,
			language: 'custom',
			script: 'Latn',
			severity: 2,
			categories: ['general'],
			romanizations: [word.toLowerCase()],
		});
	}

	// Exact tier: pattern string -> terms sharing that surface form.
	const exactPatternIndex = new Map<string, CompiledTerm[]>();
	// Skeleton tier: skeleton key -> best entry for that key.
	const skeletonIndex = new Map<string, LemmaEntry>();
	// Allowlist phrases (matched in exact space; skeleton candidates are
	// checked against these same original-coordinate spans).
	const exactAllowSet = new Set<string>();

	const addExact = (surface: string, term: CompiledTerm): void => {
		for (const form of termForms(surface)) {
			if (form.length === 0) continue;
			const list = exactPatternIndex.get(form);
			if (list) list.push(term);
			else exactPatternIndex.set(form, [term]);
		}
	};

	for (const entry of entries) {
		const term: CompiledTerm = { entry, matchMode: entry.matchMode ?? 'word' };
		const surfaces = [entry.lemma, ...(entry.variants ?? []), ...(entry.romanizations ?? [])];
		for (const surface of surfaces) addExact(surface, term);

		if (entry.skeletonSafe !== false) {
			for (const rom of entry.romanizations ?? []) {
				// Single-token keys only: multi-word phrase skeletons ("bn k ld")
				// swallow innocent continuations (behen ki ladai = sister's fight).
				if (/\s/.test(rom)) continue;
				const key = skeletonKey(rom);
				if (key.length < MIN_SKELETON_KEY_LENGTH) continue;
				const existing = skeletonIndex.get(key);
				if (!existing || entry.severity > existing.severity) {
					skeletonIndex.set(key, entry);
				}
			}
		}

		for (const phrase of entry.allowlist ?? []) packAllowlist.push(phrase);
	}

	for (const phrase of packAllowlist) {
		for (const form of termForms(phrase)) {
			if (form.length > 0) exactAllowSet.add(form);
		}
	}

	// Collapsed tier: catches letter-stretching (gaandu, fuuuuck) by matching
	// a fully repeat-collapsed pass. Only repeat-free patterns participate —
	// a pattern that itself changes under collapse (ass→as) would otherwise
	// degenerate into a false-positive machine.
	const collapsedPatternIndex = new Map<string, CompiledTerm[]>();
	for (const [pattern, terms] of exactPatternIndex) {
		const collapsed = collapseAllRepeatsFold(pattern).output;
		if (collapsed !== pattern) continue;
		const list = collapsedPatternIndex.get(collapsed);
		if (list) list.push(...terms);
		else collapsedPatternIndex.set(collapsed, [...terms]);
	}

	// Masked tier: length buckets of single-token patterns, so f*ck / चू*िया
	// resolve against the dictionary with masks as single-character wildcards
	// (what obscenity achieves with `?` wildcards in its pattern DSL, applied
	// on the input side instead of the dictionary side).
	const maskedByLength = new Map<number, { pattern: string; terms: CompiledTerm[] }[]>();
	for (const [pattern, terms] of exactPatternIndex) {
		if (pattern.includes(' ')) continue;
		const bucket = maskedByLength.get(pattern.length);
		const item = { pattern, terms };
		if (bucket) bucket.push(item);
		else maskedByLength.set(pattern.length, [item]);
	}

	const exactPatterns = [...exactPatternIndex.keys()];
	const exactAc = new AhoCorasick(exactPatterns);
	const collapsedPatterns = [...collapsedPatternIndex.keys()];
	const collapsedAc = new AhoCorasick(collapsedPatterns);
	const skeletonPatterns = [...skeletonIndex.keys()];
	const skeletonAc = new AhoCorasick(skeletonPatterns);
	const exactAllowPatterns = [...exactAllowSet];
	const exactAllowAc = new AhoCorasick(exactAllowPatterns);
	const collapsedAllowSet = new Set<string>();
	for (const phrase of exactAllowSet) {
		collapsedAllowSet.add(collapseAllRepeatsFold(phrase).output);
	}
	const collapsedAllowAc = new AhoCorasick([...collapsedAllowSet]);

	/**
	 * A pass plus its output as a UnitText (`out.text` is `pass.output`,
	 * `out.units` its code units, `out.profile` its one-sweep summary, built
	 * on first read). Every per-character scan — automata, boundary tests,
	 * the whole-token tiers — reads `out.units`, never the string; see
	 * `unicode/code-units.ts` for why. The gates below consult `out.profile`.
	 * Held by reference, never spread: spreading would evaluate the lazy
	 * profile.
	 */
	interface Pass {
		readonly pass: PassFold;
		readonly out: UnitText;
	}

	interface ExactPassConfig {
		p: Pass;
		ac: AhoCorasick;
		patterns: string[];
		patternIndex: Map<string, CompiledTerm[]>;
		allowAc: AhoCorasick;
		/**
		 * The collapsed pass exists to catch letter-stretching. Requiring an
		 * actual stretch (a run of 3+) in the matched original text — or a
		 * doubled FIRST letter, see `hasInitialDouble` — stops it from folding
		 * everyday doubled letters onto profane patterns (pakki→paki,
		 * chhod→chod, rapping→raping).
		 */
		requireStretch?: boolean;
	}

	/**
	 * True when pass 2 could produce anything at all. English contributes zero
	 * skeleton keys, so an English-only consumer has no skeleton patterns and
	 * the whole pass — a fold over the entire text plus an automaton run — is
	 * dead work. `collectSkeleton` already early-returns on this condition.
	 */
	const skeletonPassUseful = skeletonTier !== false && skeletonPatterns.length > 0;

	/**
	 * A pass's output as a `Pass`: the previous pass itself when the fold
	 * changed nothing (`chainFolds` hands back `first` by reference), else
	 * its UnitText built once from the new output.
	 */
	const passOf = (pass: FoldResult, prev: Pass): Pass =>
		pass === prev.pass ? prev : { pass, out: unitTextOfResult(prev.out, pass) };

	/**
	 * Pass 2 from pass 1, in units end to end: the skeleton is emitted as
	 * code units plus a map into pass-1 coordinates, composed here onto
	 * pass 1's own map exactly as `chainFolds` would (identity first →
	 * second's map is already right; otherwise remap). Its output string is
	 * never read by the matcher and is built only on demand.
	 */
	const skeletonPassOf = (p1: Pass, pass1: FoldResult): Pass => {
		const sk = skeletonUnitsOf(p1.out);
		let map: ArrayLike<number> = sk.map;
		if (!isIdentityResult(pass1)) {
			const firstMap = pass1.map;
			const composed = new Int32Array(sk.n);
			for (let i = 0; i < sk.n; i++) composed[i] = firstMap[sk.map[i]!]!;
			map = composed;
		}
		const out = unitTextOfUnits(sk.units, sk.n);
		return {
			pass: {
				get output(): string {
					return out.text;
				},
				map,
			},
			out,
		};
	};

	const passesFor = (
		text: string,
	): { exact: ExactPassConfig[]; skeleton: () => Pass | null; original: UnitText } => {
		const original = unitTextOf(text);
		const pass0 = baseFoldUnits(original);
		const p0: Pass = { pass: pass0, out: unitTextOfResult(original, pass0) };
		const pass1 = chainFolds(pass0, latinFoldUnits(p0.out));
		const p1 = passOf(pass1, p0);
		const p1b = passOf(chainFolds(pass1, collapseAllRepeatsFoldUnits(p1.out)), p1);
		// Deferred: `isClean` answers from an earlier tier most of the time,
		// and then pass 2 is never built at all.
		const pass2 = (): Pass | null => (skeletonPassUseful ? skeletonPassOf(p1, pass1) : null);
		const exactConfig = {
			ac: exactAc,
			patterns: exactPatterns,
			patternIndex: exactPatternIndex,
			allowAc: exactAllowAc,
		};
		const exact: ExactPassConfig[] = [{ p: p0, ...exactConfig }];
		if (p1 !== p0) exact.push({ p: p1, ...exactConfig });
		if (p1b !== p1) {
			exact.push({
				p: p1b,
				ac: collapsedAc,
				patterns: collapsedPatterns,
				patternIndex: collapsedPatternIndex,
				allowAc: collapsedAllowAc,
				requireStretch: true,
			});
		}
		return { exact, skeleton: pass2, original };
	};

	const HAS_STRETCH = /(.)\1\1/su;

	/**
	 * A doubled first letter (ffuck, cchutiya) satisfies the stretch gate too:
	 * initial doubling is an obfuscation people actually type, and the everyday
	 * doubled letters the gate exists to protect (pakki, chhod, rapping,
	 * assess) are all word-internal. Words that legitimately BEGIN doubled
	 * (aardvark, llama, eel, oops) collapse onto nothing profane — pinned by
	 * the per-pack dictionary sweep, which runs the full matcher over every
	 * headword and inflection.
	 */
	const hasInitialDouble = (s: string): boolean => {
		const first = codePointAt(s, 0);
		if (first === undefined) return false;
		const firstLen = first > 0xffff ? 2 : 1;
		const second = codePointAt(s, firstLen);
		if (second === undefined) return false;
		if (first === second) return true;
		// Original text is unfolded, so "FFuck" needs a case-blind compare.
		return (
			String.fromCodePoint(first).toLowerCase() ===
			String.fromCodePoint(second).toLowerCase()
		);
	};

	/**
	 * Boundary test with original-text authority: a "word character" adjacent
	 * to the match in pass space only blocks the match if the ORIGINAL
	 * character it came from is also a word character. Without this, leet
	 * folding a trailing "!" into "i" (b!tch! → bitchi) hides the boundary.
	 */
	const boundaryOkBefore = (p: Pass, original: string, pos: number): boolean => {
		if (pos <= 0) return true;
		let i = pos - 1;
		const { units, n } = p.out;
		const unit = units[i]!;
		if (unit >= 0xdc00 && unit <= 0xdfff && i > 0) i -= 1;
		const cp = codePointAtUnits(units, i, n);
		if (cp === undefined || !WORD_CHAR.test(String.fromCodePoint(cp))) return true;
		const orig = codePointAt(original, p.pass.map[i]!);
		return orig === undefined || !WORD_CHAR.test(String.fromCodePoint(orig));
	};

	const boundaryOkAfter = (p: Pass, original: string, pos: number): boolean => {
		const { units, n } = p.out;
		if (pos >= n) return true;
		const cp = codePointAtUnits(units, pos, n);
		if (cp === undefined || !WORD_CHAR.test(String.fromCodePoint(cp))) return true;
		const orig = codePointAt(original, p.pass.map[pos]!);
		return orig === undefined || !WORD_CHAR.test(String.fromCodePoint(orig));
	};

	/**
	 * The allow spans of every exact pass, in original coordinates. Called
	 * only once some tier has a candidate to test (`collectSurviving`): an
	 * allow span exists to veto a candidate, and clean text — the common
	 * case — never produces one, so on clean text the allow automata never
	 * run. The set is the same whenever it is built, so the verdicts are.
	 */
	const collectAllowSpans = (passes: ExactPassConfig[], text: string): Span[] => {
		const allowSpans: Span[] = [];
		for (const { p, allowAc, requireStretch } of passes) {
			const { pass } = p;
			const { units, n } = p.out;
			for (const hit of allowAc.findAllUnits(units, n)) {
				const span = toOriginalSpan(pass, hit.start, hit.end, text);
				// The collapsed pass is stretch-gated on BOTH sides. Its
				// candidates already require a run of 3+ in the original — or
				// a doubled FIRST letter, see `hasInitialDouble` — so that
				// everyday doubled letters cannot fold onto a profane
				// pattern; without the same gate here, everyday doubled
				// letters fold onto an ALLOW phrase instead and silence a
				// lemma the uncollapsed passes matched honestly. That is what
				// killed `chhinali`/`chhinaali` (or) and `chinaali` (kn)
				// against kn's `chinali` — all three collapse to exactly
				// `chinali` and none of them is letter-stretching. `chinali`
				// itself is still allowed, from pass 0.
				//
				// This cannot weaken the tier it guards for stretch-carrying
				// candidates: an allow span only suppresses candidates it
				// CONTAINS, so a stretch inside a collapsed-tier candidate is
				// a stretch inside any allow span covering it. An
				// initial-double candidate ("ffuck") could in principle
				// escape a stretch-free allow span, but such a phrase would
				// have to allowlist an initial-doubled spelling of a profane
				// pattern — none exists, and the dictionary sweep plus the
				// clean corpus pin the measured union. Measured cost over
				// 1.69M dictionary forms: one word, `boonked`, now enumerated
				// on the three packs carrying skeleton key "bnkd".
				if (requireStretch && !HAS_STRETCH.test(text.slice(span.start, span.end))) {
					continue;
				}
				allowSpans.push(span);
			}
		}
		return allowSpans;
	};

	/**
	 * The exact-tier candidates one automaton hit yields, appended to
	 * `candidates`. `seen` (dedupe key → index) merges two entries that reach
	 * the same lemma over the same span, as two packs sharing a lemma string
	 * do; pass null to skip that — `isClean` may, because a merged entry
	 * survives the severity/category filters exactly when either of its
	 * halves does (severity is the max, categories the union).
	 */
	const exactCandidatesOfHit = (
		cfg: ExactPassConfig,
		hit: AcMatch,
		text: string,
		candidates: Candidate[],
		seen: Map<string, number> | null,
	): void => {
		const { p, patterns, patternIndex, requireStretch } = cfg;
		const { pass } = p;
		const { units, n } = p.out;
		const textLen = text.length;
		const pattern = patterns[hit.patternId]!;
		const terms = patternIndex.get(pattern)!;
		for (const term of terms) {
			const startOk = boundaryOkBefore(p, text, hit.start);
			const isPrefix = term.matchMode === 'prefix';
			const endOk = isPrefix || boundaryOkAfter(p, text, hit.end);
			if (!startOk || !endOk) continue;
			// Prefix mode (Dravidian stems) matches a token that STARTS
			// with the surface form; the agglutinated suffix belongs to
			// the match, so extend to the token end before mapping back.
			// Otherwise புண்டைக்கு would censor as *****க்கு.
			let matchEnd = hit.end;
			if (isPrefix) {
				while (matchEnd < n && isWordUnit(units[matchEnd]!)) matchEnd += 1;
			}
			const span = toOriginalSpan(pass, hit.start, matchEnd, text);
			const core =
				matchEnd === hit.end ? undefined : toOriginalSpan(pass, hit.start, hit.end, text);
			// Extend through a trailing same-character run (shittt): the
			// collapse folds keep only the run's head, but the whole run
			// belongs to the match — and the stretch gate must see it.
			while (
				span.end < textLen &&
				codeUnitAt(text, span.end) === codeUnitAt(text, span.end - 1)
			) {
				span.end += 1;
			}
			if (requireStretch) {
				const slice = text.slice(span.start, span.end);
				if (!HAS_STRETCH.test(slice) && !hasInitialDouble(slice)) {
					continue;
				}
			}
			if (seen !== null) {
				const key = `${term.entry.lemma} ${span.start} ${span.end}`;
				const prior = seen.get(key);
				if (prior !== undefined) {
					const existing = candidates[prior]!;
					existing.entry = mergeEntries(existing.entry, term.entry);
					continue;
				}
				seen.set(key, candidates.length);
			}
			candidates.push({ entry: term.entry, tier: 'exact', ...span, core });
		}
	};

	const collectExact = (passes: ExactPassConfig[], text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		/** dedupe key -> index of the candidate already holding that span. */
		const seen = new Map<string, number>();
		for (const cfg of passes) {
			const { units, n } = cfg.p.out;
			for (const hit of cfg.ac.findAllUnits(units, n)) {
				exactCandidatesOfHit(cfg, hit, text, candidates, seen);
			}
		}
		return candidates;
	};

	/**
	 * Largest j in [0, n) with map[j] <= v, or -1; smallest j with map[j] >= v,
	 * or n. Every pass map is monotone non-decreasing (folds delete, replace
	 * and expand in place, never reorder), which is what makes the allow
	 * window below a bound and not a guess.
	 */
	const lastIndexAtMost = (map: ArrayLike<number>, n: number, v: number): number => {
		let lo = 0;
		let hi = n - 1;
		let ans = -1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (map[mid]! <= v) {
				ans = mid;
				lo = mid + 1;
			} else hi = mid - 1;
		}
		return ans;
	};
	const firstIndexAtLeast = (map: ArrayLike<number>, n: number, v: number): number => {
		let lo = 0;
		let hi = n - 1;
		let ans = n;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (map[mid]! >= v) {
				ans = mid;
				hi = mid - 1;
			} else lo = mid + 1;
		}
		return ans;
	};

	/**
	 * Is `span` (original coordinates) inside some allow span — decided from
	 * a WINDOW of each exact pass rather than the whole text. An allow phrase
	 * that contains the span starts at an original index <= span.start and
	 * ends at one >= span.end; in pass coordinates its first unit hs has
	 * map[hs] <= span.start, so hs <= P = lastIndexAtMost(map, span.start),
	 * and its last unit has map >= span.end - 2 (the -2 because a final
	 * astral source char extends the original end by two, see
	 * toOriginalSpan), so hs + len - 1 >= Q = firstIndexAtLeast(map,
	 * span.end - 2) and, the phrase being at most L units, hs >= Q - L + 1.
	 * The phrase therefore lies within [Q - L, P + L + 1) — one unit of
	 * slack each side — and an automaton started at ROOT at the window's
	 * start reports every phrase occurrence that starts inside it. Same
	 * verdict as `collectAllowSpans`, whose set is a superset of what the
	 * window can find but contains nothing that could contain `span`.
	 */
	const vetoedByAllow = (passes: ExactPassConfig[], span: Span, text: string): boolean => {
		for (const { p, allowAc, requireStretch } of passes) {
			const L = allowAc.maxPatternLength;
			if (L === 0) continue;
			const { pass } = p;
			const { units, n } = p.out;
			let P: number;
			let Q: number;
			if (isIdentityResult(pass as FoldResult)) {
				P = Math.min(span.start, n - 1);
				Q = Math.max(span.end - 2, 0);
			} else {
				P = lastIndexAtMost(pass.map, n, span.start);
				Q = firstIndexAtLeast(pass.map, n, span.end - 2);
			}
			if (P < 0 || Q >= n) continue;
			const w0 = Math.max(0, Q - L);
			const w1 = Math.min(n, P + L + 1);
			if (w0 >= w1) continue;
			const hits: AcMatch[] = [];
			allowAc.scanUnits(units, w0, w1, AC_ROOT, hits);
			for (const hit of hits) {
				const allow = toOriginalSpan(pass, hit.start, hit.end, text);
				if (requireStretch && !HAS_STRETCH.test(text.slice(allow.start, allow.end))) {
					continue;
				}
				if (allow.start <= span.start && span.end <= allow.end) return true;
			}
		}
		return false;
	};

	/**
	 * `isClean`'s exact tier: each pass's automaton is walked in chunks and
	 * every candidate is judged as soon as it appears, so a profane word at
	 * the top of a long document is answered without scanning the rest.
	 * Returns true when a candidate survives (`admit` decides, with the
	 * windowed allow test).
	 */
	const EXACT_STREAM_CHUNK = 1024;
	const streamExact = (
		passes: ExactPassConfig[],
		text: string,
		admit: (found: Candidate[]) => boolean,
	): boolean => {
		const hits: AcMatch[] = [];
		const batch: Candidate[] = [];
		for (const cfg of passes) {
			const { units, n } = cfg.p.out;
			let state = AC_ROOT;
			for (let from = 0; from < n; from += EXACT_STREAM_CHUNK) {
				const to = from + EXACT_STREAM_CHUNK < n ? from + EXACT_STREAM_CHUNK : n;
				hits.length = 0;
				state = cfg.ac.scanUnits(units, from, to, state, hits);
				if (hits.length === 0) continue;
				batch.length = 0;
				for (const hit of hits) exactCandidatesOfHit(cfg, hit, text, batch, null);
				if (batch.length !== 0 && admit(batch)) return true;
			}
		}
		return false;
	};

	const collectSkeleton = (p: Pass | null, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		if (p === null || skeletonTier === false || skeletonPatterns.length === 0) {
			return candidates;
		}
		const { pass } = p;
		const { units, n } = p.out;
		for (const hit of skeletonAc.findAllUnits(units, n)) {
			// Token alignment: must start at a token boundary; must end at one,
			// or leave only a short (inflection-sized) remainder.
			const startOk = hit.start === 0 || units[hit.start - 1] === 0x20;
			if (!startOk) continue;
			let tokenEnd = hit.end;
			while (tokenEnd < n && units[tokenEnd] !== 0x20) tokenEnd += 1;
			if (tokenEnd - hit.end > 3) continue;
			const entry = skeletonIndex.get(skeletonPatterns[hit.patternId]!)!;
			const span = toOriginalSpan(pass, hit.start, hit.end, text);
			candidates.push({ entry, tier: 'skeleton', ...span });
		}
		return candidates;
	};

	const MASKED_TOKEN_RE = /[\p{L}\p{M}*#@$%]+/gu;
	const isMaskChar = (ch: string): boolean =>
		ch === '*' || ch === '#' || ch === '@' || ch === '$' || ch === '%';

	const collectMasked = ({ pass, out }: Pass, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		if (!maskedTier) return candidates;
		// Every masked candidate needs at least one mask character (`* # @ $
		// %`, exactly the set `profile.hasMask` reports); without one the
		// tokenizing scan below can only produce rejects.
		if (!out.profile.hasMask) return candidates;
		for (const m of pass.output.matchAll(MASKED_TOKEN_RE)) {
			const token = m[0];
			let maskCount = 0;
			for (const ch of token) if (isMaskChar(ch)) maskCount += 1;
			// 1–3 masks, never at the token edges, and at least two visible
			// characters — the precision rules that hold in practice
			// (C#, 100%, a$$ stay clean; f**k and b***h resolve). Three masks
			// only clear the visible-characters lock from length 5 up, so a
			// pattern never loses more than three of its letters (M*A*S*H
			// stays clean because no dictionary surface aligns with it).
			if (maskCount < 1 || maskCount > 3) continue;
			if (isMaskChar(token[0]!) || isMaskChar(token[token.length - 1]!)) continue;
			if (token.length - maskCount < 2) continue;
			let best: CompiledTerm | null = null;
			for (const { pattern, terms } of maskedByLength.get(token.length) ?? []) {
				let ok = true;
				for (let i = 0; i < token.length; i++) {
					const ch = token[i]!;
					if (!isMaskChar(ch) && ch !== pattern[i]) {
						ok = false;
						break;
					}
				}
				if (!ok) continue;
				for (const term of terms) {
					if (!best || term.entry.severity > best.entry.severity) best = term;
				}
			}
			if (!best) continue;
			const span = toOriginalSpan(pass, m.index, m.index + token.length, text);
			candidates.push({ entry: best.entry, tier: 'masked', ...span });
		}
		return candidates;
	};

	// An UNRESOLVABLE leet digit is a mask: the 4 in f4ck folds to `a` and
	// produces no dictionary word, so it is retried here as a single-character
	// wildcard, under the classic tier's locks plus three of its own:
	//
	//   - token length ≥ 4, so T2T, b2b and p2p can never align with a
	//     three-letter surface;
	//   - the trailing character must never be a mask of any kind, which
	//     rejects covid19, utf8, 4x4 and every version-suffixed token;
	//   - a LEADING digit-mask is allowed — unlike a leading classic mask —
	//     but only when the token carries another interior mask (5h*t). A
	//     bare leading digit ("2hit combo", "4chan", "2fast4u") is rejected,
	//     because any digit prefixed to an innocent word would otherwise
	//     wildcard onto a surface one letter longer.
	//
	// This scan tokenizes WITH digits, which the classic scan must not (its
	// tokens deliberately exclude digits so that "sh*t5" still resolves as
	// "sh*t"); running both keeps every classic behaviour bit-identical.
	//
	// Digits anchor the scan: only tokens CONTAINING one can match, so the
	// walk jumps digit to digit and expands each into its token instead of
	// tokenizing the whole pass — ordinary prose pays one charCode sweep.
	const isDigitMaskChar = (ch: string): boolean =>
		(ch >= '0' && ch <= '9') || isMaskChar(ch);
	const isMaskCharCode = (u: number): boolean =>
		u === 0x2a || u === 0x23 || u === 0x40 || u === 0x24 || u === 0x25;
	/** Membership in the digit-mask token class [\p{L}\p{M}\p{N}*#@$%]. */
	const isDigitMaskTokenUnit = (u: number): boolean =>
		isWordUnit(u) || isMaskCharCode(u);

	const collectDigitMasked = ({ pass, out: passOut }: Pass, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		if (!maskedTier) return candidates;
		// Gate: the walk below only ever analyses a token around an ASCII digit
		// unit (0x30–0x39) — every other position is `i += 1; continue` — so
		// with no digit in the pass it can produce nothing.
		if (!passOut.profile.hasDigit) return candidates;
		const { units, n } = passOut;
		const out = pass.output;
		let i = 0;
		while (i < n) {
			const c = units[i]!;
			if (c < 0x30 || c > 0x39) {
				i += 1;
				continue;
			}
			let s = i;
			while (s > 0 && isDigitMaskTokenUnit(units[s - 1]!)) s -= 1;
			let e = i + 1;
			while (e < n && isDigitMaskTokenUnit(units[e]!)) e += 1;
			i = e + 1; // one analysis per token, then jump past it
			if (e - s < 4) continue;
			const token = out.slice(s, e);
			let maskCount = 0;
			let letters = 0;
			for (const ch of token) {
				if (isDigitMaskChar(ch)) maskCount += 1;
				else if (ch >= 'a' && ch <= 'z') letters += 1;
				else if (/\p{L}/u.test(ch)) letters += 1;
			}
			if (maskCount < 1 || maskCount > 2) continue;
			if (letters < 2) continue;
			if (isDigitMaskChar(token[token.length - 1]!)) continue;
			const lead = token[0]!;
			if (isMaskChar(lead)) continue; // classic masks never lead
			if (isDigitMaskChar(lead) && maskCount < 2) continue;
			let best: CompiledTerm | null = null;
			for (const { pattern, terms } of maskedByLength.get(token.length) ?? []) {
				let ok = true;
				for (let k = 0; k < token.length; k++) {
					const ch = token[k]!;
					if (!isDigitMaskChar(ch) && ch !== pattern[k]) {
						ok = false;
						break;
					}
				}
				if (!ok) continue;
				for (const term of terms) {
					if (!best || term.entry.severity > best.entry.severity) best = term;
				}
			}
			if (!best) continue;
			const span = toOriginalSpan(pass, s, e, text);
			candidates.push({ entry: best.entry, tier: 'masked', ...span });
		}
		return candidates;
	};

	// fu🔥ck: an interior pictograph is an INSERTED mask, not a substituted
	// one, so the emoji is deleted rather than wildcarded and the remainder
	// must equal a dictionary surface outright. That whole-token equality is
	// the safety argument — fire🔥works survives because "fireworks" is not a
	// surface, and no innocent token can be censored by having an emoji in it
	// unless its letters already spell a listed term.
	const HAS_EMOJI = /\p{Extended_Pictographic}/u;
	const EMOJI_TOKEN_RE = /(?:[\p{L}\p{M}]|\p{Extended_Pictographic})+/gu;

	/**
	 * Cheap pre-gate for the property regex: every Extended_Pictographic code
	 * point is astral (a surrogate unit, ≥ U+D800), in the symbol ranges from
	 * U+2100 up, or © / ® — which is what `profile.mayHaveEmoji` reports, so
	 * Indic and Latin text never pays the whole-string property scan.
	 */
	const collectEmojiMasked = (p: Pass, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		if (!maskedTier) return candidates;
		const { pass } = p;
		if (!p.out.profile.mayHaveEmoji || !HAS_EMOJI.test(pass.output)) return candidates;
		for (const m of pass.output.matchAll(EMOJI_TOKEN_RE)) {
			const token = m[0];
			if (!HAS_EMOJI.test(token)) continue;
			const chars = [...token];
			let stripped = '';
			let emojiCount = 0;
			let edgeEmoji = false;
			for (let i = 0; i < chars.length; i++) {
				const ch = chars[i]!;
				if (HAS_EMOJI.test(ch)) {
					emojiCount += 1;
					if (i === 0 || i === chars.length - 1) edgeEmoji = true;
				} else {
					stripped += ch;
				}
			}
			if (edgeEmoji || emojiCount > 2 || stripped.length < 3) continue;
			if (
				!boundaryOkBefore(p, text, m.index) ||
				!boundaryOkAfter(p, text, m.index + token.length)
			) {
				continue;
			}
			if (exactAllowSet.has(stripped)) continue;
			const terms = exactPatternIndex.get(stripped);
			if (terms === undefined) continue;
			let best: CompiledTerm | null = null;
			for (const term of terms) {
				if (!best || term.entry.severity > best.entry.severity) best = term;
			}
			const span = toOriginalSpan(pass, m.index, m.index + token.length, text);
			candidates.push({ entry: best!.entry, tier: 'masked', ...span });
		}
		return candidates;
	};

	// "f u c k" / "s.h.i.t" — a word spelled out one letter at a time. This is
	// the most dangerous thing the engine does, because a fold that merely
	// deleted separators between letters would turn "Scunthorpe" into a false
	// positive machine and swallow every initialism in ordinary prose. So it
	// is not a fold at all. It is a whole-token rule with four locks:
	//
	//   1. Shape. Only a MAXIMAL run of single-code-point letters — each
	//      standing alone between non-word characters, each pair joined by
	//      exactly ONE separator — qualifies. "T-shirt", "x-ray", "co-op",
	//      "Dr. A. Smith", "f u c ku" and "3.5" all fail on shape alone.
	//   2. Length. At least MIN_SEPARATED_LETTERS letters, which puts every
	//      two- and three-letter initialism (a.m., e.g., U.S.A., F.B.I.) out
	//      of reach.
	//   3. Exact, whole-run equality. The joined run must equal a dictionary
	//      surface form outright — no substring, no skeleton, no collapse. A
	//      run of six spelled letters like "a b c d e f" can only fire if
	//      "abcdef" is itself a listed term. This is what stops the tier from
	//      finding profanity inside innocent spelled-out sequences, and it is
	//      the lock to be most careful with: allowing substrings would turn
	//      "b a s s guitar" into a hit on "ass".
	//   4. The allowlist — tested against the joined run, and against the run
	//      rejoined with its neighbouring word, because a phrase allowlist
	//      entry like "lund university" cannot see a spelled-out run.
	//
	// The single exception to lock 3 is a leading standalone-word letter:
	// English "a"/"i"/"o" join the maximal run ("what a s h i t day" is one
	// run, "ashit"), so exactly one of them may be dropped before matching.
	// Any other adjacent single letter is kept, and the run then fails to
	// match — "u r a s h i t" is one run, "urashit", and is a deliberate miss.
	const MIN_SEPARATED_LETTERS = 4;
	const SINGLE_LETTER_RE = /^\p{L}$/u;

	/** The separators a spelled-out run may use: space, tab, . - _ newline / */
	const isSeparatorCode = (code: number): boolean =>
		code === 0x20 /* space */ ||
		code === 0x09 /* tab */ ||
		code === 0x2e /* . */ ||
		code === 0x2d /* - */ ||
		code === 0x5f /* _ */ ||
		code === 0x0a /* \n */ ||
		code === 0x2f /* / */;

	/**
	 * Shape pre-filter. A run long enough to match must open with
	 * letter-sep-letter-sep-letter-sep-letter, so three code-unit comparisons
	 * rule out every other position before any `\p{L}` test runs. Without it
	 * this tier costs more than the rest of the scan put together.
	 */
	const couldStartRun = (units: Uint16Array, i: number): boolean =>
		isSeparatorCode(units[i + 1]!) &&
		isSeparatorCode(units[i + 3]!) &&
		isSeparatorCode(units[i + 5]!);
	/**
	 * The only letters that stand alone as English words. A run may drop ONE
	 * leading letter from this set before matching, so "what a s h i t day"
	 * (maximal run "a s h i t") still resolves. Dropping more, or dropping any
	 * other letter, would let a spelled-out innocent word donate a profane
	 * suffix — "b a s s" must never surface "ass".
	 */
	const STANDALONE_WORD_LETTERS = new Set(['a', 'i', 'o']);

	/** True when pass.output[i] is one whole code point with category L. */
	const isSingleLetterAt = (units: Uint16Array, n: number, i: number): boolean => {
		const cp = codePointAtUnits(units, i, n);
		if (cp === undefined || cp > 0xffff) return false;
		return SINGLE_LETTER_RE.test(String.fromCharCode(cp));
	};

	/**
	 * The word token immediately before / after a run, across exactly one
	 * separator. A spelled-out run is invisible to the phrase allowlist (which
	 * matches whole strings like "lund university" or "moby dick"), so the
	 * neighbours are rejoined and re-tested before the run can match.
	 */
	const neighbourBefore = ({ pass, out: { units } }: Pass, pos: number): string => {
		const sep = pos - 1;
		if (sep < 0 || !isSeparatorCode(units[sep]!)) return '';
		let k = sep;
		while (k > 0 && isWordUnit(units[k - 1]!)) k -= 1;
		return pass.output.slice(k, sep);
	};

	const neighbourAfter = ({ pass, out: { units, n } }: Pass, pos: number): string => {
		if (pos >= n || !isSeparatorCode(units[pos]!)) return '';
		let k = pos + 1;
		while (k < n && isWordUnit(units[k]!)) k += 1;
		return pass.output.slice(pos + 1, k);
	};

	const collectSeparated = (p: Pass, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		const { pass } = p;
		const { units, n, profile } = p.out;
		// Gate: every run this tier can build starts at a position that passes
		// `couldStartRun` — separators at i+1, i+3 and i+5 — and
		// `profile.hasSpelledRunShape` is false only when no position in the
		// pass has that shape, so the walk below could not admit a single i.
		if (!profile.hasSpelledRunShape) return candidates;
		/** Letter positions of the run being built, in pass coordinates. */
		const positions: number[] = [];
		let i = 0;
		while (i < n) {
			// A run member is a letter standing alone between non-word
			// characters — which is what makes "x-ray" and "f u c ku" fail: in
			// both, a "letter" is really the head of a longer token.
			if (
				!couldStartRun(units, i) ||
				!isSingleLetterAt(units, n, i) ||
				!boundaryOkBefore(p, text, i) ||
				!boundaryOkAfter(p, text, i + 1)
			) {
				i += 1;
				continue;
			}
			positions.length = 0;
			positions.push(i);
			let letters = String.fromCharCode(units[i]!);
			let end = i + 1;
			while (
				end < n &&
				isSeparatorCode(units[end]!) &&
				isSingleLetterAt(units, n, end + 1) &&
				boundaryOkAfter(p, text, end + 2)
			) {
				positions.push(end + 1);
				letters += String.fromCharCode(units[end + 1]!);
				end += 2;
			}
			// Whole run first; then, only if that failed, the run minus a
			// leading standalone-word letter.
			for (let skip = 0; skip <= 1; skip++) {
				if (skip === 1 && !STANDALONE_WORD_LETTERS.has(letters[0]!)) break;
				const candidate = skip === 0 ? letters : letters.slice(1);
				if (candidate.length < MIN_SEPARATED_LETTERS) break;
				const start = positions[skip]!;
				if (
					exactAllowSet.has(candidate) ||
					exactAllowSet.has(`${neighbourBefore(p, start)} ${candidate}`) ||
					exactAllowSet.has(`${candidate} ${neighbourAfter(p, end)}`)
				) {
					break;
				}
				const terms = exactPatternIndex.get(candidate);
				if (terms === undefined) continue;
				let best: CompiledTerm | null = null;
				for (const term of terms) {
					if (!best || term.entry.severity > best.entry.severity) best = term;
				}
				const span = toOriginalSpan(pass, start, end, text);
				candidates.push({ entry: best!.entry, tier: 'separated', ...span });
				break;
			}
			i = Math.max(end, i + 1); // maximal run consumed either way
		}
		return candidates;
	};

	// "fu.ck" / "b.it.ch" / "as sh ole" — a word split into short multi-letter
	// chunks. Same doctrine as the separated tier: never a fold, a whole-run
	// rule with locks, because a rule that merges adjacent tokens is one bad
	// boundary away from flagging "as if" and "in re Gault". The locks:
	//
	//   1. Fragments are PURE-LETTER tokens of 1–4 units, joined by exactly
	//      one separator each. BINDING separators (dot, hyphen) join chunks
	//      people actually type; SPACE/TAB are looser, see lock 4.
	//   2. The run is maximal and must match WHOLE: every fragment in the run
	//      is consumed, and the merged string must equal a dictionary surface
	//      outright. "ga and ma" merges to "gaandma", never to "gaand".
	//   3. A run whose boundary crosses a BINDING separator into a longer
	//      word is abandoned: in "who re-elected", "re" belongs to
	//      "re-elected", and merging [who, re] would invent "whore".
	//   4. A run containing a space/tab needs ≥3 fragments, each ≥2 letters.
	//      Two space-separated fragments are structurally indistinguishable
	//      from adjacent short words — "lo da" (Telugu locative + vocative)
	//      and "ga and" (sargam notes, US states) both merge onto surfaces —
	//      so "fu ck" is a DELIBERATE miss and "fu.ck" is not.
	//   5. All-single-letter runs belong to the separated tier and its own
	//      locks (minimum four letters); this tier skips them, so "a.s.s"
	//      cannot resurrect what the separated tier deliberately rejects.
	const CHUNK_MAX_FRAG_UNITS = 4;
	const CHUNK_MAX_FRAGS = 4;
	const isBindingSepCode = (code: number): boolean =>
		code === 0x2e /* . */ || code === 0x2d /* - */;
	const isLooseSepCode = (code: number): boolean =>
		code === 0x20 /* space */ || code === 0x09 /* tab */;
	const isChunkSepCode = (code: number): boolean =>
		isBindingSepCode(code) || isLooseSepCode(code);

	const isAsciiDigitCode = (unit: number): boolean => unit >= 0x30 && unit <= 0x39;

	const collectChunked = ({ pass, out: passOut }: Pass, text: string): Candidate[] => {
		const candidates: Candidate[] = [];
		const { units, n, profile } = passOut;
		const out = pass.output;
		// Fixed-size run window: a valid run has at most CHUNK_MAX_FRAGS
		// fragments, so the walk streams tokens through this window and never
		// materializes a token table — ordinary prose costs one charCode
		// sweep and no allocation.
		const runStarts = new Array<number>(CHUNK_MAX_FRAGS);
		const runEnds = new Array<number>(CHUNK_MAX_FRAGS);

		// Two walks over the same stream. The MIXED walk joins across every
		// chunk separator with fragments capped at 4 units — the cap is what
		// keeps a following ordinary word ("as sh ole today") out of the run.
		// The BINDING walk joins across dot/hyphen only, where a 5-unit
		// fragment is safe ("ch.utiya") because ordinary prose does not
		// hyphen-chain its words.
		const walk = (bindingOnly: boolean): void => {
			const maxFrag = bindingOnly ? 5 : CHUNK_MAX_FRAG_UNITS;
			/** Fragments in the active run; 0 = no active run. */
			let frags = 0;
			/** Active run exceeded CHUNK_MAX_FRAGS — consume it, emit nothing. */
			let dead = false;
			let hasLoose = false;
			let allSingle = true;
			let minFrag = Infinity;
			/** Lock 3, left side: run began across a binding separator. */
			let leftBind = false;
			/** End of the previous token (any token), -2 = none. */
			let prevEnd = -2;

			const endRun = (rightBind: boolean): void => {
				const count = frags;
				frags = 0;
				if (dead || count < 2 || leftBind || rightBind) return;
				let merged = '';
				let joined = '';
				for (let k = 0; k < count; k++) {
					const frag = out.slice(runStarts[k]!, runEnds[k]!);
					merged += frag;
					joined += k === 0 ? frag : ` ${frag}`;
				}
				if (allSingle || merged.length < MIN_SEPARATED_LETTERS) return;
				if (hasLoose && (count < 3 || minFrag < 2)) return;
				// Both spellings of the run face the allowlist: the merged word
				// and the phrase the fragments literally spell ("be an er").
				if (exactAllowSet.has(merged) || exactAllowSet.has(joined)) return;
				const terms = exactPatternIndex.get(merged);
				if (terms === undefined) return;
				let best: CompiledTerm | null = null;
				for (const term of terms) {
					if (!best || term.entry.severity > best.entry.severity) best = term;
				}
				const span = toOriginalSpan(pass, runStarts[0]!, runEnds[count - 1]!, text);
				candidates.push({ entry: best!.entry, tier: 'separated', ...span });
			};

			let i = 0;
			while (i < n) {
				if (!isWordUnit(units[i]!)) {
					if (frags > 0 && i > prevEnd + 1) endRun(false);
					i += 1;
					continue;
				}
				const start = i;
				let isPure = true;
				while (i < n && isWordUnit(units[i]!)) {
					if (isAsciiDigitCode(units[i]!)) isPure = false;
					i += 1;
				}
				const len = i - start;
				// The single separator joining this token to the previous one,
				// 0 when not joined (no previous, gap ≠ 1, or not a chunk sep).
				let sep = 0;
				if (prevEnd >= 0 && start - prevEnd === 1) {
					const c = units[prevEnd]!;
					if (isChunkSepCode(c)) sep = c;
				}
				const joins = sep !== 0 && (!bindingOnly || isBindingSepCode(sep));
				const isFrag = isPure && len <= maxFrag;
				if (frags > 0) {
					if (joins && isFrag) {
						if (frags >= CHUNK_MAX_FRAGS) dead = true;
						else {
							runStarts[frags] = start;
							runEnds[frags] = i;
						}
						frags += 1;
						if (len > 1) allSingle = false;
						if (len < minFrag) minFrag = len;
						if (!bindingOnly && isLooseSepCode(sep)) hasLoose = true;
						prevEnd = i;
						continue;
					}
					// Lock 3, right side: the token after the run hangs off a
					// binding separator, so the edge fragment belongs to it.
					endRun(sep !== 0 && isBindingSepCode(sep));
				}
				if (isFrag) {
					frags = 1;
					dead = false;
					hasLoose = false;
					allSingle = len <= 1;
					minFrag = len;
					leftBind = sep !== 0 && isBindingSepCode(sep);
					runStarts[0] = start;
					runEnds[0] = i;
				}
				prevEnd = i;
			}
			if (frags > 0) endRun(false);
		};
		walk(false);
		// The binding walk only adds runs containing a 5-unit fragment, which
		// need a dot or hyphen to join at all.
		if (profile.hasDotOrHyphen) walk(true);
		return candidates;
	};

	// #FuckThis: a hashtag or @-handle concatenates words into one token, and
	// case is the only seam left — which pass 0 destroys by lowercasing. So
	// this rule reads the ORIGINAL text: a #/@-led token is split at ASCII
	// camelCase boundaries and each fragment must equal a dictionary surface
	// WHOLE. #Scunthorpe, #ClassicCars and #SussexDowns stay clean because no
	// fragment is a surface; C#Anything is untouched because the # must start
	// its token.
	const HASHTAG_RE = /[#@][\p{L}\p{N}_]+/gu;
	const isAsciiUpper = (unit: number): boolean => unit >= 0x41 && unit <= 0x5a;
	const isAsciiLower = (unit: number): boolean => unit >= 0x61 && unit <= 0x7a;

	const collectHashtag = ({ text, profile }: UnitText): Candidate[] => {
		const candidates: Candidate[] = [];
		// HASHTAG_RE needs a `#` or `@` to match at all.
		if (!profile.hasHashOrAt) return candidates;
		for (const m of text.matchAll(HASHTAG_RE)) {
			// The marker must start its token (kills C# and user@example.com).
			if (m.index > 0) {
				const prevCp = codePointAt(
					text,
					m.index - ((codeUnitAt(text, m.index - 1) & 0xfc00) === 0xdc00 ? 2 : 1),
				);
				if (prevCp !== undefined && WORD_CHAR.test(String.fromCodePoint(prevCp))) {
					continue;
				}
			}
			const inner = m[0];
			// Fragment boundaries at lower→Upper and UPPER→Title transitions.
			const bounds: number[] = [1]; // skip the marker itself
			const innerLen = inner.length;
			for (let i = 2; i < innerLen; i++) {
				const cur = codeUnitAt(inner, i);
				if (!isAsciiUpper(cur)) continue;
				const prev = codeUnitAt(inner, i - 1);
				const next = i + 1 < innerLen ? codeUnitAt(inner, i + 1) : -1;
				if (isAsciiLower(prev) || (isAsciiUpper(prev) && isAsciiLower(next))) {
					bounds.push(i);
				}
			}
			if (bounds.length < 2) continue; // no seam — ordinary tiers own it
			bounds.push(inner.length);
			const fragTexts: string[] = [];
			for (let f = 0; f + 1 < bounds.length; f++) {
				fragTexts.push(inner.slice(bounds[f]!, bounds[f + 1]!).toLowerCase());
			}
			for (let f = 0; f + 1 < bounds.length; f++) {
				const frag = fragTexts[f]!;
				if (frag.length < 3) continue;
				if (
					exactAllowSet.has(frag) ||
					(f > 0 && exactAllowSet.has(`${fragTexts[f - 1]!} ${frag}`)) ||
					(f + 1 < fragTexts.length && exactAllowSet.has(`${frag} ${fragTexts[f + 1]!}`))
				) {
					continue;
				}
				let best: CompiledTerm | null = null;
				for (const form of termForms(frag)) {
					for (const term of exactPatternIndex.get(form) ?? []) {
						if (!best || term.entry.severity > best.entry.severity) best = term;
					}
				}
				if (!best) continue;
				const start = m.index + bounds[f]!;
				const end = m.index + bounds[f + 1]!;
				candidates.push({ entry: best.entry, tier: 'exact', start, end });
			}
		}
		return candidates;
	};

	const TIER_RANK: Record<MatchTier, number> = {
		exact: 2,
		masked: 2,
		separated: 2,
		skeleton: 0,
	};

	/**
	 * Every candidate that survives the allow spans and the severity/category
	 * filters, tier by tier, in the order the tiers are collected.
	 *
	 * `stopAtFirst` is what makes `isClean` cheap: overlap resolution replaces
	 * clashing candidates but never empties the set, so the text is unclean
	 * the moment ONE candidate survives — and every later tier, including the
	 * skeleton fold over the whole text, can be skipped. The allow spans
	 * cannot be short-cut the same way (an allow phrase found in pass 1 may
	 * veto a candidate found in pass 0), so when they are needed at all they
	 * are collected over every exact pass whole — but they are needed only
	 * once a candidate exists, and clean text never has one.
	 */
	const collectSurviving = (text: string, stopAtFirst: boolean): Candidate[] => {
		const { exact, skeleton, original } = passesFor(text);
		let allowSpans: Span[] | null = null;
		const surviving: Candidate[] = [];
		/** Returns true when the caller may stop collecting. */
		const admit = (found: Candidate[]): boolean => {
			for (const c of found) {
				const tested = c.core ?? c;
				// One candidate to judge (isClean): a window of allow spans
				// around it. Many (scan): the whole set, once.
				if (
					stopAtFirst
						? vetoedByAllow(exact, tested, text)
						: containedIn(tested, (allowSpans ??= collectAllowSpans(exact, text)))
				) {
					continue;
				}
				if (c.entry.severity < minSeverity) continue;
				if (
					categoryFilter &&
					!c.entry.categories.some((cat) => categoryFilter.has(cat))
				) {
					continue;
				}
				surviving.push(c);
				if (stopAtFirst) return true;
			}
			return false;
		};
		// Tier order is load-bearing for scan(): overlap resolution below reads
		// candidates in this order and ties are broken by it.
		if (stopAtFirst ? streamExact(exact, text, admit) : admit(collectExact(exact, text))) {
			return surviving;
		}
		// Hashtag case-splitting reads the ORIGINAL text (pass 0 lowercases
		// the seam away), so it hangs off no pass at all.
		if (admit(collectHashtag(original))) return surviving;
		// The masked tiers run on EVERY non-collapsed pass, not just pass 0:
		// folding inside the token is what resolves b!t*h and ph*ck. They
		// cannot use the richest pass alone, because '@' and '$' are both leet
		// characters and mask characters — pass 1 turns them into letters, so
		// ch@t*ya only ever resolves in pass 0. Each pass sees the masks the
		// other has spent, and the digit scan additionally sees the digits the
		// leet fold declined to spend (f4ck folds to fack; 4-as-wildcard is
		// what resolves it). The stretch-collapsed pass is deliberately
		// excluded from these tiers and the separated one: it rewrites runs
		// of repeats, which has nothing to do with masked or spelled-out
		// words.
		const uncollapsed = exact.filter((e) => !e.requireStretch);
		for (const { p } of uncollapsed) {
			if (admit(collectMasked(p, text))) return surviving;
			if (admit(collectDigitMasked(p, text))) return surviving;
			if (admit(collectEmojiMasked(p, text))) return surviving;
		}
		const richest = uncollapsed[uncollapsed.length - 1]!.p;
		if (admit(collectSeparated(richest, text))) return surviving;
		if (admit(collectChunked(richest, text))) return surviving;
		admit(collectSkeleton(skeleton(), text));
		return surviving;
	};

	const scan = (text: string): ScanResult => {
		const candidates = collectSurviving(text, false);

		// Overlap resolution: exact beats skeleton, then severity, then length.
		candidates.sort((a, b) => a.start - b.start || b.end - a.end);
		const kept: Candidate[] = [];
		for (const c of candidates) {
			const clash = kept.find((k) => c.start < k.end && k.start < c.end);
			if (!clash) {
				kept.push(c);
				continue;
			}
			const better =
				TIER_RANK[c.tier] > TIER_RANK[clash.tier] ||
				(TIER_RANK[c.tier] === TIER_RANK[clash.tier] &&
					(c.entry.severity > clash.entry.severity ||
						(c.entry.severity === clash.entry.severity &&
							c.end - c.start > clash.end - clash.start)));
			if (better) kept[kept.indexOf(clash)] = c;
		}
		kept.sort((a, b) => a.start - b.start);

		const matches: ProfanityMatch[] = kept.map((c) => ({
			lemma: c.entry.lemma,
			surface: text.slice(c.start, c.end),
			tier: c.tier,
			language: c.entry.language,
			severity: c.entry.severity,
			categories: [...c.entry.categories],
			casualUse: c.entry.casualUse ?? false,
			start: c.start,
			end: c.end,
		}));
		const maxSeverity =
			matches.length === 0
				? null
				: (Math.max(...matches.map((m) => m.severity)) as Severity);
		return { matches, maxSeverity };
	};

	return {
		scan,
		// Early-exit: stops at the first surviving candidate, and never sorts,
		// resolves overlaps or builds match objects.
		isClean: (text: string): boolean => collectSurviving(text, true).length === 0,
		censor: (text: string, censorOptions?: CensorOptions): string => {
			const { matches } = scan(text);
			return censorText(
				text,
				matches.map((m) => ({ start: m.start, end: m.end })),
				censorOptions,
			);
		},
	};
}
