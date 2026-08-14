/**
 * Module A — Unicode normalization folds (pass 0: "base").
 *
 * Every fold rewrites a whole string and returns a FoldResult whose `map`
 * points each output UTF-16 code unit back at the input index that produced
 * it (see src/types.ts). `baseFold` is the composed pass-0 fold:
 * NFC ∘ stripInvisibles ∘ foldWidth ∘ lowercase ∘ indicFolds.
 */

import {
	chainFolds,
	codePointFold,
	codePointFoldUnits,
	composeFolds,
	FoldBuilder,
	identityFold,
	unitTextOf,
	unitTextOfResult,
	type Fold,
	type FoldResult,
	type UnitFold,
	type UnitText,
} from '../types.js';
import { INDIC_CASELESS_RANGE, INDIC_SCRIPTS } from './indic-scripts.js';
import { codePointAtUnits } from './code-units.js';

const MARK_RE = /\p{M}/u;

/**
 * Memo table for `isCombiningMark` over the BMP: 0 = not yet asked,
 * 1 = mark, 2 = not a mark. The segment scan asks this of every character
 * of every input, and `\p{M}` on a freshly built one-character string is far
 * too expensive to pay per character of a 100 KB document.
 */
const COMBINING_CACHE = new Uint8Array(0x10000);

function isCombiningMark(cp: number): boolean {
	// The first character with general category M is U+0300.
	if (cp < 0x0300) return false;
	if (cp > 0xffff) return MARK_RE.test(String.fromCodePoint(cp));
	const cached = COMBINING_CACHE[cp]!;
	if (cached !== 0) return cached === 1;
	const isMark = MARK_RE.test(String.fromCharCode(cp));
	COMBINING_CACHE[cp] = isMark ? 1 : 2;
	return isMark;
}

/**
 * NFC normalization with an offset map. Implemented by normalizing
 * grapheme-safe chunks: the string is split before every non-combining code
 * point (a "starter"), each segment is normalized independently (NFC never
 * composes or reorders across starter boundaries), and every output unit of
 * a segment maps to the segment's start index in the input.
 */
export const nfcFoldUnits: UnitFold = ({ text: input, units, n }: UnitText): FoldResult => {
	// One native normalize of the whole string costs a fraction of one call
	// per grapheme, and answers the only question that matters for most text:
	// is anything going to change at all? When nothing is, the segment walk
	// still runs (the offset map still owes every unit of a cluster to the
	// cluster's start) but never slices or normalizes a segment again.
	const alreadyNfc = input.normalize('NFC') === input;
	const b = new FoldBuilder(input);
	let i = 0;
	while (i < n) {
		// Fast path: ASCII is NFC-inert and always a starter. Safe to copy
		// through unless the NEXT char is a combining mark (e + U+0301 must
		// still compose as one segment).
		if (units[i]! < 0x80) {
			const next = i + 1 < n ? codePointAtUnits(units, i + 1, n)! : -1;
			if (next < 0x80 || !isCombiningMark(next)) {
				b.keep(i, 1);
				i += 1;
				continue;
			}
		}
		const segStart = i;
		// Consume the segment's first code point unconditionally (it is either
		// a starter or a leading orphan combining mark).
		let cp = codePointAtUnits(units, i, n)!;
		i += cp > 0xffff ? 2 : 1;
		// Extend the segment through any following combining marks.
		while (i < n) {
			cp = codePointAtUnits(units, i, n)!;
			if (!isCombiningMark(cp)) break;
			i += cp > 0xffff ? 2 : 1;
		}
		const len = i - segStart;
		if (alreadyNfc) {
			b.keepAt(segStart, len, segStart);
			continue;
		}
		const segment = input.slice(segStart, i);
		const normalized = segment.normalize('NFC');
		// A lone code point that NFC leaves alone can be copied straight
		// through, which keeps the builder on its allocation-free fast path.
		// Longer segments keep the documented contract that every output unit
		// of a segment points at the segment's start.
		if (len === 1 && normalized === segment) b.keep(segStart, 1);
		else b.replace(segStart, len, normalized);
	}
	return b.finish();
};

export const nfcFold: Fold = (input: string): FoldResult => nfcFoldUnits(unitTextOf(input));

const INVISIBLES: ReadonlySet<number> = new Set<number>([
	0x200b, // ZERO WIDTH SPACE
	0x200c, // ZERO WIDTH NON-JOINER
	0x200d, // ZERO WIDTH JOINER
	0x00ad, // SOFT HYPHEN
	0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM
	0x2060, // WORD JOINER
	0x180e, // MONGOLIAN VOWEL SEPARATOR
]);

/**
 * Deletes zero-width / invisible format characters from the match key.
 * (Legitimate Indic orthography is preserved in the original string; this
 * only affects the folded text that matching runs over.)
 */
export const stripInvisiblesFold: Fold = codePointFold((cp) =>
	INVISIBLES.has(cp) ? '' : undefined,
);

/** Maps fullwidth ASCII U+FF01–U+FF5E to plain ASCII (subtract 0xFEE0). */
export const foldWidthFold: Fold = codePointFold((cp) =>
	cp >= 0xff01 && cp <= 0xff5e ? String.fromCodePoint(cp - 0xfee0) : undefined,
);

/**
 * Per-code-point lowercasing. Going code point by code point through
 * codePointFold keeps the offset map correct for 1→N expansions
 * (e.g. İ U+0130 → 'i' + U+0307, both output units mapping to İ's index).
 */
export const lowercaseFold: Fold = codePointFold((cp) => {
	const ch = String.fromCodePoint(cp);
	const lower = ch.toLowerCase();
	return lower === ch ? undefined : lower;
});

/**
 * Lookup tables derived once from `INDIC_SCRIPTS`. Adding a script means
 * appending to that array — nothing below this line needs to change.
 */

/** Code point → replacement ('' = delete). Nukta, visarga, aytham, grantha… */
const INDIC_POINT_MAP: ReadonlyMap<number, string> = (() => {
	const table = new Map<number, string>();
	for (const rules of INDIC_SCRIPTS) {
		for (const cp of rules.drop ?? []) table.set(cp, '');
		for (const [cp, replacement] of rules.map ?? []) table.set(cp, replacement);
	}
	return table;
})();

/** Nasal consonant → the (virama, anusvara) pair that consumes it. */
const INDIC_NASAL_CLUSTERS: ReadonlyMap<
	number,
	{ virama: number; anusvara: string }
> = (() => {
	const table = new Map<number, { virama: number; anusvara: string }>();
	for (const rules of INDIC_SCRIPTS) {
		if (!rules.nasalsToAnusvara?.length) continue;
		if (rules.virama === undefined || rules.anusvara === undefined) {
			throw new Error(
				`${rules.script}: nasalsToAnusvara requires both virama and anusvara`,
			);
		}
		for (const nasal of rules.nasalsToAnusvara) {
			table.set(nasal, { virama: rules.virama, anusvara: rules.anusvara });
		}
	}
	return table;
})();

/** Viramas whose repeated runs collapse to one. */
const INDIC_COLLAPSING_VIRAMAS: ReadonlySet<number> = (() => {
	const set = new Set<number>();
	for (const rules of INDIC_SCRIPTS) {
		if (rules.collapseViramaRuns && rules.virama !== undefined) {
			set.add(rules.virama);
		}
	}
	return set;
})();

/**
 * Code-point-level unification, driven by the per-script `drop` and `map`
 * fields: nukta and visarga/aytham stripped, chandrabindu → anusvara, Tamil
 * grantha letters → their native equivalents, and so on.
 *
 * (Precomposed nukta letters such as क़ U+0958–U+095F and U+09DC/09DD/09DF
 * are composition exclusions, so NFC has already decomposed them into base +
 * nukta by the time this runs inside baseFold.)
 */
const indicCodePointFold: Fold = codePointFold((cp) => INDIC_POINT_MAP.get(cp));

/**
 * String-level scan for the rules that span more than one code point:
 *
 * - nasal consonant + virama → anusvara, for the scripts that declare it
 *   (हिन्दी → हिंदी). Two input units become one output unit, mapped to the
 *   first (the consonant);
 * - runs of a collapsing virama reduced to the first one.
 */
const indicClusterFoldUnits: UnitFold = ({ text: input, units, n }: UnitText): FoldResult => {
	const b = new FoldBuilder(input);
	let i = 0;
	let prevCp = -1;
	while (i < n) {
		const cp = codePointAtUnits(units, i, n)!;
		// Everything this fold rewrites lives in the Indic blocks, so ASCII —
		// the bulk of Latin-script input — can be waved straight through.
		if (cp >= INDIC_CASELESS_MIN && cp <= INDIC_CASELESS_MAX) {
			const cluster = INDIC_NASAL_CLUSTERS.get(cp);
			if (cluster !== undefined && i + 1 < n && units[i + 1] === cluster.virama) {
				b.replace(i, 2, cluster.anusvara);
				prevCp = cluster.virama;
				i += 2;
				continue;
			}
			if (cp === prevCp && INDIC_COLLAPSING_VIRAMAS.has(cp)) {
				b.replace(i, 1, '');
				i += 1;
				continue;
			}
		}
		const unitLen = cp > 0xffff ? 2 : 1;
		b.keepCodePoint(i, unitLen);
		prevCp = cp;
		i += unitLen;
	}
	return b.finish();
};

const indicClusterFold: Fold = (input: string): FoldResult =>
	indicClusterFoldUnits(unitTextOf(input));

/**
 * Indic orthographic unification across every script in `INDIC_SCRIPTS`.
 * The code-point folds run first so a stripped nukta cannot hide a
 * nasal+virama cluster from the string-level scan.
 */
export const indicFold: Fold = composeFolds(indicCodePointFold, indicClusterFold);

const [INDIC_CASELESS_MIN, INDIC_CASELESS_MAX] = INDIC_CASELESS_RANGE;

/**
 * Fused pointwise stage: stripInvisibles ∘ foldWidth ∘ lowercase ∘ indic
 * code-point folds in ONE walk, with ASCII and Indic fast paths that skip
 * the per-char toLowerCase() allocation. Semantics identical to composing
 * the individual folds (each remains exported and individually tested).
 */
const fusedPointwiseFoldUnits: UnitFold = codePointFoldUnits((cp0) => {
	// Pure-ASCII fast path (invisibles and fullwidth are all >= U+00AD).
	if (cp0 < 0x80) {
		return cp0 >= 0x41 && cp0 <= 0x5a
			? String.fromCharCode(cp0 + 0x20)
			: undefined;
	}
	if (INVISIBLES.has(cp0)) return '';
	const cp = cp0 >= 0xff01 && cp0 <= 0xff5e ? cp0 - 0xfee0 : cp0;
	// The Indic blocks are caseless, so one table lookup replaces both the
	// per-script rewrite and the toLowerCase() allocation.
	if (cp >= INDIC_CASELESS_MIN && cp <= INDIC_CASELESS_MAX) {
		const mapped = INDIC_POINT_MAP.get(cp);
		if (mapped !== undefined) return mapped;
		return cp === cp0 ? undefined : String.fromCodePoint(cp);
	}
	const ch = String.fromCodePoint(cp);
	const lower = ch.toLowerCase();
	if (lower === ch) return cp === cp0 ? undefined : ch;
	return lower;
});

/**
 * nfc ∘ fusedPointwise ∘ indicCluster, hand-chained exactly as
 * `composeFolds` would chain them, each stage reading the previous stage's
 * output through its units.
 */
const composedBaseFoldUnits: UnitFold = (t: UnitText): FoldResult => {
	const nfc = nfcFoldUnits(t);
	const nfcText = unitTextOfResult(t, nfc);
	const pointwise = chainFolds(nfc, fusedPointwiseFoldUnits(nfcText));
	const pointwiseText = unitTextOfResult(nfcText, pointwise);
	return chainFolds(pointwise, indicClusterFoldUnits(pointwiseText));
};

/**
 * Pure-ASCII input collapses the whole pass-0 pipeline to one rule: ASCII is
 * NFC-inert and NFC-stable, carries no invisibles, no fullwidth forms and no
 * Indic clusters, so baseFold degenerates to A–Z → a–z. Detecting that up
 * front turns three composed passes (three strings, three offset maps, two
 * remap loops) into a single walk — which is the common case for English,
 * Hinglish and any romanized input.
 */
const asciiLowerFoldUnits: UnitFold = ({ text: input, units, n, profile }: UnitText): FoldResult => {
	// Gate: the walk below rewrites exactly the units in A–Z and keeps every
	// other one, so with none present the builder is never dirtied and
	// `finish()` would return `identityFold(input)` — returned here directly.
	if (!profile.hasUpper) return identityFold(input);
	const b = new FoldBuilder(input);
	for (let i = 0; i < n; i++) {
		const c = units[i]!;
		if (c >= 0x41 && c <= 0x5a) b.replace(i, 1, String.fromCharCode(c + 0x20));
		else b.keep(i, 1);
	}
	return b.finish();
};

/** Pass 0 ("base"): NFC ∘ stripInvisibles ∘ foldWidth ∘ lowercase ∘ indic. */
export const baseFoldUnits: UnitFold = (t: UnitText): FoldResult =>
	t.profile.allAscii ? asciiLowerFoldUnits(t) : composedBaseFoldUnits(t);

export const baseFold: Fold = (input: string): FoldResult => baseFoldUnits(unitTextOf(input));
