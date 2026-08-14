/**
 * Grapheme-cluster segmentation.
 *
 * Fast path: `Intl.Segmenter('und', { granularity: 'grapheme' })`.
 * Fallback (runtimes without Intl.Segmenter): split on code points but keep
 * combining marks (\p{M}), ZWJ/ZWNJ, and virama signs attached to the
 * previous cluster; a ZWJ or virama also glues the FOLLOWING code point onto
 * the current cluster (emoji ZWJ sequences, Indic conjuncts).
 */

export const hasIntlSegmenter: boolean =
	typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

const ZWNJ = 0x200c;
const ZWJ = 0x200d;

/** Virama / halant signs across major Indic scripts. */
const VIRAMAS: ReadonlySet<number> = new Set([
	0x094d, // Devanagari
	0x09cd, // Bengali
	0x0bcd, // Tamil
	0x0c4d, // Telugu
	0x0ccd, // Kannada
	0x0d4d, // Malayalam
]);

const MARK_RE = /\p{M}/u;

function isExtend(cp: number): boolean {
	return cp === ZWJ || cp === ZWNJ || MARK_RE.test(String.fromCodePoint(cp));
}

/**
 * Fallback segmentation used when Intl.Segmenter is unavailable.
 * Exported for direct testing.
 */
export function graphemeSlicesFallback(
	text: string,
): { start: number; end: number }[] {
	const slices: { start: number; end: number }[] = [];
	if (text.length === 0) return slices;
	let clusterStart = 0;
	/** True when the previous code point was ZWJ or a virama. */
	let joinNext = false;
	let i = 0;
	while (i < text.length) {
		const cp = text.codePointAt(i)!;
		const unitLen = cp > 0xffff ? 2 : 1;
		if (i > 0 && !joinNext && !isExtend(cp)) {
			slices.push({ start: clusterStart, end: i });
			clusterStart = i;
		}
		joinNext = cp === ZWJ || VIRAMAS.has(cp);
		i += unitLen;
	}
	slices.push({ start: clusterStart, end: text.length });
	return slices;
}

let segmenter: Intl.Segmenter | undefined;

/**
 * Slice `text` into extended grapheme clusters. Each slice is a half-open
 * UTF-16 code-unit range [start, end) into `text`, in order, covering the
 * whole string with no gaps.
 */
export function graphemeSlices(text: string): { start: number; end: number }[] {
	if (text.length === 0) return [];
	if (hasIntlSegmenter) {
		segmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' });
		const slices: { start: number; end: number }[] = [];
		for (const seg of segmenter.segment(text)) {
			slices.push({ start: seg.index, end: seg.index + seg.segment.length });
		}
		return slices;
	}
	return graphemeSlicesFallback(text);
}
