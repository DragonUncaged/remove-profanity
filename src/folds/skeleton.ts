/**
 * Module C — phonetic consonant skeleton for ROMANIZED Indian-language text.
 *
 * Input is assumed to be already base-folded + latin-folded (lowercase,
 * ASCII-ish). The skeleton collapses the many romanization spellings of the
 * same word (behenchod / bhenchod / bahanchod …) onto one key, at the cost of
 * some collisions (gandhi / gandu) — those are handled by allowlists upstream.
 *
 * Logical stages (fused into a single pass for speed; semantics are identical
 * to the six composed folds this replaced, and the test suite pins them):
 *   1. digraph consumption, longest-first, left to right;
 *   2. single-consonant folds (z→j w→v q→k y→i c→k x→ks) — applied to
 *      digraph replacements too (ch → c → k);
 *   3. drop 'h' everywhere except word-initial (previous stage-2 char
 *      not [a-z]);
 *   4. drop vowels a e i o u except word-initial (previous stage-3 survivor
 *      not [a-z]);
 *   5. collapse ALL repeat runs to 1;
 *   6. keep only [a-z]; any whitespace becomes a single space.
 */

import { unitTextOf, type Fold, type FoldResult, type UnitFold, type UnitText } from '../types.js';
import { codePointAtUnits, codeUnitsToString } from '../unicode/code-units.js';

const DIGRAPHS: ReadonlyArray<readonly [token: string, replacement: string]> = [
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

const SINGLE_FOLDS = new Map<string, string>([
	['z', 'j'],
	['w', 'v'],
	['q', 'k'],
	['y', 'i'],
	['c', 'k'],
	['x', 'ks'],
]);

/** A string as its UTF-16 code units, for tables the hot loop reads. */
const codesOf = (s: string): readonly number[] => [...s].map((c) => c.charCodeAt(0));

/** Stage 2 of one code unit: the character itself, or its single fold. */
const stage2Of = (code: number): readonly number[] => {
	const rep = SINGLE_FOLDS.get(String.fromCharCode(code));
	return rep === undefined ? [code] : codesOf(rep);
};

/**
 * Digraphs bucketed by their first code unit, in flat typed arrays: bucket
 * `[DG_START[c], DG_END[c])` (empty when DG_START[c] < 0) indexes DG_OFF /
 * DG_LEN (the token's units in DG_TOKENS) and DG_A / DG_B, the digraph's
 * replacement ALREADY taken through the stage-2 single folds (ch → c → k;
 * ksh → ks), one or two characters, `DG_B = -1` when one. Without the
 * bucketing every input position would pay 13 `startsWith` calls; with it
 * only positions whose first character begins a digraph look further. Order
 * within a bucket stays longest-first, which is what the stage-1 contract
 * requires.
 */
const DG_START = new Int32Array(0x80).fill(-1);
const DG_END = new Int32Array(0x80).fill(-1);
let DG_TOKENS: Int32Array;
let DG_OFF: Int32Array;
let DG_LEN: Int32Array;
let DG_A: Int32Array;
let DG_B: Int32Array;
{
	const byFirst = new Map<number, Array<readonly [string, string]>>();
	for (const dg of DIGRAPHS) {
		const first = dg[0].charCodeAt(0);
		let list = byFirst.get(first);
		if (list === undefined) byFirst.set(first, (list = []));
		list.push(dg);
	}
	const tokens: number[] = [];
	const off: number[] = [];
	const len: number[] = [];
	const a: number[] = [];
	const b: number[] = [];
	for (const [first, list] of byFirst) {
		DG_START[first] = off.length;
		for (const [token, replacement] of list) {
			const stage2: number[] = [];
			for (const c of codesOf(replacement)) stage2.push(...stage2Of(c));
			if (stage2.length < 1 || stage2.length > 2) {
				throw new Error(`digraph ${token}: stage-2 replacement must be 1 or 2 characters`);
			}
			off.push(tokens.length);
			len.push(token.length);
			tokens.push(...codesOf(token));
			a.push(stage2[0]!);
			b.push(stage2[1] ?? -1);
		}
		DG_END[first] = off.length;
	}
	DG_TOKENS = Int32Array.from(tokens);
	DG_OFF = Int32Array.from(off);
	DG_LEN = Int32Array.from(len);
	DG_A = Int32Array.from(a);
	DG_B = Int32Array.from(b);
}

/** Second units of the digraphs (h and s today), so a bucket walk is skipped unless one follows. */
const DIGRAPH_SECOND: Uint8Array = (() => {
	const t = new Uint8Array(0x80);
	for (const [token] of DIGRAPHS) t[token.charCodeAt(1)] = 1;
	return t;
})();

const SINGLE_A = new Int32Array(0x80);
const SINGLE_B = new Int32Array(0x80).fill(-1);
for (let c = 0; c < 0x80; c++) {
	const st = stage2Of(c);
	if (st.length > 2) throw new Error(`single fold of ${c}: at most two characters`);
	SINGLE_A[c] = st[0]!;
	SINGLE_B[c] = st[1] ?? -1;
}

const A_CODE = 0x61;
const Z_CODE = 0x7a;
const H_CODE = 0x68;
const SPACE_CODE = 0x20;
/** Sentinel for "no previous character yet" in the rolling stage state. */
const NONE = -1;

function isAsciiLowerCode(code: number): boolean {
	return code >= A_CODE && code <= Z_CODE;
}

function isVowelCode(code: number): boolean {
	return (
		code === 0x61 /* a */ ||
		code === 0x65 /* e */ ||
		code === 0x69 /* i */ ||
		code === 0x6f /* o */ ||
		code === 0x75 /* u */
	);
}

const WHITESPACE_RE = /\s/;

/** `/\s/` on a code point, with the ASCII cases decided without a regex. */
function isWhitespaceCode(code: number): boolean {
	if (code === SPACE_CODE) return true;
	if (code < 0x09) return false;
	if (code <= 0x0d) return true; // \t \n \v \f \r
	if (code < 0xa0) return false;
	if (code > 0xffff) return false;
	return WHITESPACE_RE.test(String.fromCharCode(code));
}

/**
 * The skeleton of a text as code units: `units[0 .. n)` is the fold output,
 * `map[i]` the input index (into the UnitText's `text`) of the character or
 * digraph that produced output unit i — the FoldResult contract, in typed
 * arrays. This is what the matcher's pass 2 runs its automaton over; the
 * output STRING is never needed there, so it is never built.
 */
export interface SkeletonUnits {
	readonly units: Uint16Array;
	readonly n: number;
	readonly map: Int32Array;
}

/**
 * The full skeleton fold, fused into one pass. Every emitted unit maps back
 * to the input index of the character (or digraph start) that produced it.
 *
 * The rolling stage state is held as code points rather than one-character
 * strings: a non-letter code point behaves exactly like the non-letter string
 * it stands for (it is never a vowel, never 'h', and is dropped by stage 6),
 * so the semantics are unchanged and the hot loop allocates nothing.
 *
 * Output is written straight into typed arrays sized to the input: the fold
 * only ever shrinks a text (vowels, h, repeats and non-letters are dropped)
 * except at `x` → `ks`, so the arrays start at the input length and grow
 * only if a text is mostly x's.
 */
export function skeletonUnitsOf({ units, n }: UnitText): SkeletonUnits {
	let cap = n > 0 ? n : 1;
	let outUnits = new Uint16Array(cap);
	let outMap = new Int32Array(cap);
	// Rolling stage state, in one typed array rather than closure variables —
	// measured 0.75 → 0.48 ms per 20k words against locals captured by the
	// cascade closure (the captured form keeps every state variable in a
	// heap context). Slots: 0 prevS2 (last char of the stage-2 stream, the
	// h word-initial test), 1 prevS3 (last char surviving stage 3, the vowel
	// word-initial test), 2 prevS5 (last char entering stage 5, repeat
	// collapse), 3 lastOut (last char emitted, space-run collapse), 4 = k,
	// the output length.
	const st = new Int32Array(5);
	st[0] = st[1] = st[2] = st[3] = NONE;
	st[4] = 0;

	/** Stages 3–6 for one stage-2 character. */
	const cascade = (ch: number, srcIdx: number): void => {
		const wordInitialH = !isAsciiLowerCode(st[0]!);
		st[0] = ch;
		if (ch === H_CODE && !wordInitialH) return; // stage 3
		const wordInitialV = !isAsciiLowerCode(st[1]!);
		st[1] = ch;
		if (isVowelCode(ch) && !wordInitialV) return; // stage 4
		if (ch === st[2]) return; // stage 5
		st[2] = ch;
		// stage 6
		let unit: number;
		if (isAsciiLowerCode(ch)) {
			unit = ch;
			st[3] = ch;
		} else if (isWhitespaceCode(ch) && st[3] !== SPACE_CODE) {
			unit = SPACE_CODE;
			st[3] = SPACE_CODE;
		} else {
			return; // everything else deleted
		}
		const k = st[4]!;
		if (k === cap) {
			cap *= 2;
			const u2 = new Uint16Array(cap);
			u2.set(outUnits);
			outUnits = u2;
			const m2 = new Int32Array(cap);
			m2.set(outMap);
			outMap = m2;
		}
		outUnits[k] = unit;
		outMap[k] = srcIdx;
		st[4] = k + 1;
	};

	let i = 0;
	while (i < n) {
		const code = units[i]!;
		// Stages 1–2 for the code point at i: one or two stage-2 characters
		// (a, then b unless -1) and how many units they consumed.
		let a: number;
		let b = -1;
		let adv = 1;
		if (code < 0x80) {
			a = SINGLE_A[code]!;
			b = SINGLE_B[code]!;
			const first = DG_START[code]!;
			// Only a digraph's second unit (h or s today) opens the bucket
			// walk; `DIGRAPH_SECOND` is derived from the table, not assumed.
			if (first >= 0) {
				const next = units[i + 1]!;
				if (next < 0x80 && DIGRAPH_SECOND[next] === 1) {
					const end = DG_END[code]!;
					for (let d = first; d < end; d++) {
						// `input.startsWith(token, i)` by unit; the first unit
						// is the bucket's, so the compare starts at 1, and past
						// the end `units[]` is undefined and never equal.
						const off = DG_OFF[d]!;
						const len = DG_LEN[d]!;
						let ok = true;
						for (let q = 1; q < len; q++) {
							if (units[i + q] !== DG_TOKENS[off + q]) {
								ok = false;
								break;
							}
						}
						if (ok) {
							a = DG_A[d]!;
							b = DG_B[d]!;
							adv = len;
							break;
						}
					}
				}
			}
		} else {
			// Non-ASCII: no digraph or single fold can apply, so it goes
			// straight through the stage cascade (which deletes everything
			// but whitespace).
			a = codePointAtUnits(units, i, n)!;
			if (a > 0xffff) adv = 2;
		}
		cascade(a, i);
		if (b >= 0) cascade(b, i);
		i += adv;
	}
	return { units: outUnits, n: st[4]!, map: outMap };
}

/** `skeletonUnitsOf` as a FoldResult — the string form, for callers that want one. */
export const skeletonFoldUnits: UnitFold = (t: UnitText): FoldResult => {
	const { units, n, map } = skeletonUnitsOf(t);
	return { output: codeUnitsToString(units, n), map: Array.from(map.subarray(0, n)) };
};

export const skeletonFold: Fold = (input: string): FoldResult => skeletonFoldUnits(unitTextOf(input));

/**
 * Skeleton key of a single word/romanization — the fold output only.
 * Used by the pack compiler on romanizations.
 */
export function skeletonKey(word: string): string {
	return skeletonFold(word).output;
}
