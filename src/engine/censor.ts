/**
 * Grapheme-safe censoring: rewrite matched spans of the ORIGINAL string,
 * replacing each grapheme cluster with a mask character. Never outputs an
 * orphaned combining mark — spans are expanded outward to cluster boundaries
 * before masking.
 */

import type { CensorOptions } from '../types.js';
import { graphemeSlices } from '../unicode/graphemes.js';

/** Inclusive range of cluster indices into a graphemeSlices() array. */
interface ClusterRange {
	first: number;
	last: number;
}

/** Largest cluster index i with slices[i].start <= pos (binary search). */
function clusterIndexAt(
	slices: { start: number; end: number }[],
	pos: number,
): number {
	let lo = 0;
	let hi = slices.length - 1;
	let ans = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (slices[mid]!.start <= pos) {
			ans = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return ans;
}

/**
 * Censor `text` by masking every grapheme cluster covered by `spans`
 * (UTF-16 code-unit ranges, end exclusive, into `text`). Overlapping spans
 * are merged; each span is expanded outward to grapheme-cluster boundaries;
 * every covered cluster becomes one mask character (default '*').
 * `keepFirst` keeps the first cluster of each merged span visible.
 */
export function censorText(
	text: string,
	spans: { start: number; end: number }[],
	options?: CensorOptions,
): string {
	if (text.length === 0 || spans.length === 0) return text;
	const mask = options?.mask ?? '*';
	const keepFirst = options?.keepFirst ?? false;

	const cleaned = spans
		.map((s) => ({
			start: Math.max(0, s.start),
			end: Math.min(text.length, s.end),
		}))
		.filter((s) => s.start < s.end)
		.sort((a, b) => a.start - b.start);
	if (cleaned.length === 0) return text;

	const slices = graphemeSlices(text);

	const ranges: ClusterRange[] = cleaned.map((s) => ({
		first: clusterIndexAt(slices, s.start),
		last: clusterIndexAt(slices, s.end - 1),
	}));

	// Merge overlapping ranges (expansion can introduce new overlaps).
	const merged: ClusterRange[] = [];
	for (const r of ranges) {
		const prev = merged[merged.length - 1];
		if (prev !== undefined && r.first <= prev.last) {
			if (r.last > prev.last) prev.last = r.last;
		} else {
			merged.push({ first: r.first, last: r.last });
		}
	}

	let out = '';
	let pos = 0;
	for (const r of merged) {
		const startUnit = slices[r.first]!.start;
		const endUnit = slices[r.last]!.end;
		out += text.slice(pos, startUnit);
		const clusterCount = r.last - r.first + 1;
		if (keepFirst) {
			const firstSlice = slices[r.first]!;
			out += text.slice(firstSlice.start, firstSlice.end);
			out += mask.repeat(clusterCount - 1);
		} else {
			out += mask.repeat(clusterCount);
		}
		pos = endUnit;
	}
	out += text.slice(pos);
	return out;
}
