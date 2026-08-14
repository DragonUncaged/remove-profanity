/**
 * An independent restatement of the Module C skeleton algorithm, for the
 * te / kn / ml pack tests.
 *
 * Per SPEC.md a data module and its test must NOT import
 * `src/folds/skeleton.ts` — otherwise the "is this entry skeletonSafe?" check
 * becomes a tautology against the very code it is meant to police. Tamil
 * satisfied that by pasting the algorithm into `test/tamil-data.test.ts`;
 * three more packs would mean three more copies of the same 45 lines, all of
 * which would drift.
 *
 * This file is the compromise: still a hand restatement of the spec, still
 * importing nothing from `src/`, but written once. It is not a `.test.ts`
 * file, so vitest never collects it as a suite.
 */

/** Stage 1 — digraph consumption, longest-first, left to right. */
const DIGRAPHS: readonly (readonly [from: string, to: string])[] = [
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

/** Stage 2 — single-character folds. */
const SINGLES: Readonly<Record<string, string>> = {
	z: 'j',
	w: 'v',
	q: 'k',
	y: 'i',
	c: 'k',
	x: 'ks',
};

export function skeletonKey(word: string): string {
	let out = '';
	let i = 0;
	while (i < word.length) {
		const hit = DIGRAPHS.find(([from]) => word.startsWith(from, i));
		if (hit) {
			out += hit[1];
			i += hit[0].length;
		} else {
			out += word[i]!;
			i += 1;
		}
	}
	out = [...out].map((ch) => SINGLES[ch] ?? ch).join('');
	// Stages 3 and 4 — drop h and vowels everywhere except word-initially.
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
	// Stages 5 and 6 — collapse all repeat runs, keep [a-z ] only.
	out = out.replace(/(.)\1+/gu, '$1');
	return out.replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim();
}

/** The engine ignores skeleton keys shorter than this (see matcher.ts). */
export const MIN_SKELETON_KEY_LENGTH = 4;
