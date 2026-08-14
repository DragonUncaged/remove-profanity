/**
 * Module B — Latin-script folds (pass 1 of the pipeline).
 *
 * Every fold carries an offset map per the FoldResult contract in types.ts.
 */

import {
	chainFolds,
	codePointFoldUnits,
	FoldBuilder,
	identityFold,
	unitTextOf,
	unitTextOfResult,
	type Fold,
	type FoldResult,
	type UnitFold,
	type UnitText,
} from '../types.js';

/**
 * Reserved (unassigned) gaps in the Mathematical Alphanumeric Symbols block
 * below U+1D6A6 — holes where a letterlike symbol already existed elsewhere
 * (e.g. U+1D455 is missing because ℎ is U+210E). These fall back to identity.
 */
const MATH_ALPHANUM_RESERVED = new Set<number>([
	0x1d455, 0x1d49d, 0x1d4a0, 0x1d4a1, 0x1d4a3, 0x1d4a4, 0x1d4a7, 0x1d4a8,
	0x1d4ad, 0x1d4ba, 0x1d4bc, 0x1d4c4, 0x1d506, 0x1d50b, 0x1d50c, 0x1d515,
	0x1d51d, 0x1d53a, 0x1d53f, 0x1d545, 0x1d547, 0x1d548, 0x1d549, 0x1d551,
]);

/** Explicit single-code-point confusable mappings → lowercase ASCII. */
const CONFUSABLE_MAP = new Map<number, string>([
	// Cyrillic lowercase lookalikes
	[0x0430, 'a'], // а
	[0x0435, 'e'], // е
	[0x043e, 'o'], // о
	[0x0440, 'p'], // р
	[0x0441, 'c'], // с
	[0x0445, 'x'], // х
	[0x0443, 'y'], // у
	[0x0456, 'i'], // і
	[0x0455, 's'], // ѕ
	// Cyrillic uppercase forms
	[0x0410, 'a'], // А
	[0x0415, 'e'], // Е
	[0x041e, 'o'], // О
	[0x0420, 'p'], // Р
	[0x0421, 'c'], // С
	[0x0425, 'x'], // Х
	[0x0423, 'y'], // У
	[0x0406, 'i'], // І
	[0x0405, 's'], // Ѕ
	// Greek lowercase lookalikes
	[0x03bd, 'v'], // ν
	[0x03bf, 'o'], // ο
	[0x03c5, 'u'], // υ
	[0x03b1, 'a'], // α
	[0x03c1, 'p'], // ρ
	[0x03c4, 't'], // τ
	// Greek uppercase forms of the above
	[0x039d, 'v'], // Ν
	[0x039f, 'o'], // Ο
	[0x03a5, 'u'], // Υ
	[0x0391, 'a'], // Α
	[0x03a1, 'p'], // Ρ
	[0x03a4, 't'], // Τ
	// Latin extras
	[0x0192, 'f'], // ƒ
	[0x00e7, 'c'], // ç
	// Bare-minimum Latin-1 accented lowercase
	[0x00e0, 'a'], // à
	[0x00e1, 'a'], // á
	[0x00e2, 'a'], // â
	[0x00e3, 'a'], // ã
	[0x00e4, 'a'], // ä
	[0x00e5, 'a'], // å
	[0x00e8, 'e'], // è
	[0x00e9, 'e'], // é
	[0x00ea, 'e'], // ê
	[0x00eb, 'e'], // ë
	[0x00ec, 'i'], // ì
	[0x00ed, 'i'], // í
	[0x00ee, 'i'], // î
	[0x00ef, 'i'], // ï
	[0x00f2, 'o'], // ò
	[0x00f3, 'o'], // ó
	[0x00f4, 'o'], // ô
	[0x00f5, 'o'], // õ
	[0x00f6, 'o'], // ö
	[0x00f9, 'u'], // ù
	[0x00fa, 'u'], // ú
	[0x00fb, 'u'], // û
	[0x00fc, 'u'], // ü
	[0x00f1, 'n'], // ñ
	[0x00fd, 'y'], // ý
	[0x00ff, 'y'], // ÿ
	[0x0161, 's'], // š
	[0x017e, 'z'], // ž
	// Latin Extended letters with no NFD decomposition (the table below only
	// reaches the decomposable ones).
	[0x00f8, 'o'], // ø
	[0x0111, 'd'], // đ
	[0x0127, 'h'], // ħ
	[0x0131, 'i'], // ı
	[0x0142, 'l'], // ł
	[0x0167, 't'], // ŧ
	// Cyrillic lookalikes beyond the vowel set — the letters a homoglyph
	// converter substitutes, not just the ones a person types.
	[0x0501, 'd'], // ԁ
	[0x04bb, 'h'], // һ
	[0x0458, 'j'], // ј
	[0x043a, 'k'], // к
	[0x043c, 'm'], // м
	[0x0442, 't'], // т
	[0x0500, 'd'], // Ԁ
	[0x04ba, 'h'], // Һ
	[0x0408, 'j'], // Ј
	[0x041a, 'k'], // К
	[0x041c, 'm'], // М
	[0x0422, 't'], // Т
	// Greek lookalikes beyond the vowel set. η → n and γ → y follow the
	// lowercase shapes; the uppercase forms Η and Γ resemble different Latin
	// letters and are deliberately not mapped.
	[0x03b2, 'b'], // β
	[0x03b5, 'e'], // ε
	[0x03b9, 'i'], // ι
	[0x03ba, 'k'], // κ
	[0x03bc, 'm'], // μ
	[0x03b7, 'n'], // η
	[0x03c7, 'x'], // χ
	[0x03b3, 'y'], // γ
	[0x0392, 'b'], // Β
	[0x0395, 'e'], // Ε
	[0x0399, 'i'], // Ι
	[0x039a, 'k'], // Κ
	[0x039c, 'm'], // Μ
	[0x03a7, 'x'], // Χ
	// Small capitals and modifier letters (ꜰᴜᴄᴋ). No small-cap q or x exists.
	[0x1d00, 'a'], // ᴀ
	[0x0299, 'b'], // ʙ
	[0x1d04, 'c'], // ᴄ
	[0x1d05, 'd'], // ᴅ
	[0x1d07, 'e'], // ᴇ
	[0xa730, 'f'], // ꜰ
	[0x0262, 'g'], // ɢ
	[0x029c, 'h'], // ʜ
	[0x026a, 'i'], // ɪ
	[0x1d0a, 'j'], // ᴊ
	[0x1d0b, 'k'], // ᴋ
	[0x029f, 'l'], // ʟ
	[0x1d0d, 'm'], // ᴍ
	[0x0274, 'n'], // ɴ
	[0x1d0f, 'o'], // ᴏ
	[0x1d18, 'p'], // ᴘ
	[0x0280, 'r'], // ʀ
	[0xa731, 's'], // ꜱ
	[0x1d1b, 't'], // ᴛ
	[0x1d1c, 'u'], // ᴜ
	[0x1d20, 'v'], // ᴠ
	[0x1d21, 'w'], // ᴡ
	[0x028f, 'y'], // ʏ
	[0x1d22, 'z'], // ᴢ
]);

/**
 * Latin Extended-A/B and Latin Extended Additional letters that NFD-decompose
 * to an ASCII base plus combining marks (ā ċ ē ń ō ř ş ţ ū ż ḱ ẑ …) fold to
 * that base. Derived once at module load from the Unicode data the runtime
 * already carries, so a new diacritic never needs a table edit, and MERGED
 * into CONFUSABLE_MAP so the per-character path below pays exactly one Map
 * lookup — a second miss per code point is measurable on Indic text. Non-
 * decomposables (đ ı ł …) are explicit entries above, which win on conflict.
 */
(() => {
	const ranges: Array<[number, number]> = [
		[0x0100, 0x024f], // Latin Extended-A and Extended-B
		[0x1e00, 0x1eff], // Latin Extended Additional (incl. Vietnamese)
	];
	for (const [lo, hi] of ranges) {
		for (let cp = lo; cp <= hi; cp++) {
			if (CONFUSABLE_MAP.has(cp)) continue;
			const decomposed = String.fromCodePoint(cp).normalize('NFD');
			if (decomposed.length < 2) continue;
			const base = decomposed.charCodeAt(0);
			const isUpper = base >= 0x41 && base <= 0x5a;
			const isLower = base >= 0x61 && base <= 0x7a;
			if (!isUpper && !isLower) continue;
			let allMarks = true;
			for (let i = 1; i < decomposed.length; i++) {
				const unit = decomposed.charCodeAt(i);
				if (unit < 0x0300 || unit > 0x036f) {
					allMarks = false;
					break;
				}
			}
			if (!allMarks) continue;
			CONFUSABLE_MAP.set(cp, String.fromCharCode(isUpper ? base + 0x20 : base));
		}
	}
})();

function mapConfusable(cp: number): string | undefined {
	// No ASCII code point is a confusable source, so the bulk of Latin text
	// short-circuits before any table lookup.
	if (cp < 0x80) return undefined;
	// Mathematical Alphanumeric Symbols U+1D400–U+1D7FF.
	if (cp >= 0x1d400 && cp <= 0x1d7ff) {
		if (MATH_ALPHANUM_RESERVED.has(cp)) return undefined;
		if (cp <= 0x1d6a3) {
			// 13 Latin alphabets of 52 (A–Z then a–z): offset mod 26 = base letter.
			return String.fromCharCode(0x61 + ((cp - 0x1d400) % 26));
		}
		if (cp === 0x1d6a4) return 'i'; // dotless 𝚤
		if (cp === 0x1d6a5) return 'j'; // dotless 𝚥
		if (cp >= 0x1d7ce) {
			// Mathematical digits (bold … monospace): 5 runs of 0–9.
			return String.fromCharCode(0x30 + ((cp - 0x1d7ce) % 10));
		}
		// Greek math letters (mod-26 would be wrong here) + remaining reserved
		// points: keep as-is.
		return undefined;
	}
	// Enclosed alphanumerics ⒜–⒵ / Ⓐ–Ⓩ / ⓐ–ⓩ (U+249C–U+24E9): three runs of 26
	// (parenthesized lowercase, circled uppercase, circled lowercase).
	if (cp >= 0x249c && cp <= 0x24e9) {
		return String.fromCharCode(0x61 + ((cp - 0x249c) % 26));
	}
	// Enclosed Alphanumeric Supplement: parenthesized 🄐, squared 🄰, negative
	// circled 🅐 and negative squared 🅰 capitals — four aligned runs of 26.
	if (cp >= 0x1f110 && cp <= 0x1f189) {
		const offset = (cp - 0x1f110) % 0x20;
		if (offset < 26) return String.fromCharCode(0x61 + offset);
		return undefined;
	}
	// One lookup covers everything else: explicit confusables AND the merged
	// decomposable-diacritic table.
	return CONFUSABLE_MAP.get(cp);
}

const confusablesCodePointFold: UnitFold = codePointFoldUnits(mapConfusable);

/** Unicode confusables → lowercase ASCII (identity for everything else). */
export const confusablesFoldUnits: UnitFold = (t: UnitText): FoldResult =>
	// Every confusable source is non-ASCII, so pure-ASCII input is untouched.
	t.profile.allAscii ? identityFold(t.text) : confusablesCodePointFold(t);

export const confusablesFold: Fold = (input: string): FoldResult =>
	confusablesFoldUnits(unitTextOf(input));

const LEET_SINGLE = new Map<string, string>([
	['@', 'a'],
	['4', 'a'],
	['3', 'e'],
	['1', 'i'],
	['!', 'i'],
	['|', 'i'],
	['0', 'o'],
	['$', 's'],
	['5', 's'],
	['7', 't'],
	['2', 'z'],
	['6', 'g'],
	['9', 'g'],
]);

/**
 * `LEET_SINGLE` as a code-unit-indexed table. Every leet source is ASCII, so
 * one array read replaces a Map lookup plus the single-character string
 * allocation that `input[i]` would produce.
 */
const LEET_BY_CODE: (string | undefined)[] = (() => {
	const table = new Array<string | undefined>(0x80).fill(undefined);
	for (const [ch, rep] of LEET_SINGLE) table[ch.charCodeAt(0)] = rep;
	return table;
})();

function isLatinLowerCode(code: number): boolean {
	return code >= 0x61 && code <= 0x7a;
}

function isDigitCode(code: number): boolean {
	return code >= 0x30 && code <= 0x39;
}

function isAlnumCode(code: number): boolean {
	return isLatinLowerCode(code) || isDigitCode(code);
}

function hasLetterNeighbor(units: Uint16Array, n: number, start: number, len: number): boolean {
	return (
		(start > 0 && isLatinLowerCode(units[start - 1]!)) ||
		(start + len < n && isLatinLowerCode(units[start + len]!))
	);
}

/**
 * How the digits of the maximal [a-z0-9] run containing position i may fold.
 *
 * - `adjacency`: the token is letter-led ("a55", "st33l", "l8r"). Each digit
 *   folds iff it has a Latin-letter neighbor — the literal, pre-existing rule
 *   ("a55" → "as5", and the UK road "A55" never becomes "ass").
 * - `all`: the token is digit-led but letter-shaped: it has at least two
 *   letters ("2fast4u", "0x1a2b3c"), or exactly one leading digit, at least
 *   one letter and length ≥ 4 ("5hit", "5h17"). Every mappable digit folds,
 *   including one whose only neighbor is another digit — without this, the
 *   trailing 7 of "5h17" has no letter neighbor and never becomes t.
 * - `none`: a number-ish token — "500", "45s", "1337", "4x4", "4s5" (Canadian
 *   postal segment), "2h30". Substituting a leading digit that heads a digit
 *   RUN is how "45s" would become "ass", so a second leading digit blocks.
 */
function digitFoldMode(units: Uint16Array, n: number, i: number): 'adjacency' | 'all' | 'none' {
	let s = i;
	while (s > 0 && isAlnumCode(units[s - 1]!)) s--;
	if (!isDigitCode(units[s]!)) return 'adjacency';
	let e = i + 1;
	while (e < n && isAlnumCode(units[e]!)) e++;
	let letters = 0;
	for (let k = s; k < e; k++) {
		if (isLatinLowerCode(units[k]!)) letters++;
	}
	if (letters >= 2) return 'all';
	if (letters >= 1 && e - s >= 4 && !isDigitCode(units[s + 1]!)) {
		return 'all';
	}
	return 'none';
}

/**
 * Leetspeak fold, longest-token-first at each position:
 * `ph→f`, then `@→a 4→a 3→e 1→i !→i |→i 0→o $→s 5→s 7→t 2→z 6→g 9→g`.
 *
 * Single-character substitutions only fire when adjacent to a Latin letter
 * in the input; digits are additionally governed by `digitFoldMode`, so
 * number-ish tokens ("500", "45s", "1337") never fold while "5hit"-shaped
 * tokens fold whole.
 *
 * `(→c` is deliberately absent, so `fu(k` is a documented miss. The letter
 * guard is satisfied by an opening paren before any word, so the mapping
 * turns `(um` into `cum` and flags ordinary parentheticals — "Hello (um,
 * maybe)". Precision wins over recall (`docs/language-packs.md`), and the
 * masked tier already covers the shape people actually type (`f*ck`).
 * Pinned by `test/latin.test.ts`.
 */
export const leetFoldUnits: UnitFold = ({ text: input, units, n, profile }: UnitText): FoldResult => {
	// Gate: the walk below rewrites at exactly two kinds of position — a `p`
	// followed by `h`, and a unit in `LEET_BY_CODE` (`@ 4 3 1 ! | 0 $ 5 7 2
	// 6 9`); everything else is `b.keep`. `profile.hasLeetSource` is false
	// only when the units contain neither, so the builder could never be
	// dirtied and `finish()` would return `identityFold(input)`.
	if (!profile.hasLeetSource) return identityFold(input);
	const b = new FoldBuilder(input);
	// digitFoldMode is a property of the whole token, so it is computed at the
	// first digit of a token and reused until the scan leaves the token.
	let modeEnd = -1;
	let mode: 'adjacency' | 'all' | 'none' = 'none';
	let i = 0;
	while (i < n) {
		const code = units[i]!;
		// Longest token first: "ph" → "f" (its own characters are Latin
		// letters adjacent to each other, so the letter guard is satisfied).
		if (code === 0x70 /* p */ && units[i + 1] === 0x68 /* h */) {
			b.replace(i, 2, 'f');
			i += 2;
			continue;
		}
		const rep = code < 0x80 ? LEET_BY_CODE[code] : undefined;
		if (rep !== undefined) {
			let ok: boolean;
			if (!isDigitCode(code)) {
				ok = hasLetterNeighbor(units, n, i, 1);
			} else {
				if (i >= modeEnd) {
					mode = digitFoldMode(units, n, i);
					modeEnd = i + 1;
					while (modeEnd < n && isAlnumCode(units[modeEnd]!)) modeEnd++;
				}
				ok =
					mode === 'all' ||
					(mode === 'adjacency' && hasLetterNeighbor(units, n, i, 1));
			}
			if (ok) {
				b.replace(i, 1, rep);
				i += 1;
				continue;
			}
		}
		b.keep(i, 1);
		i += 1;
	}
	return b.finish();
};

export const leetFold: Fold = (input: string): FoldResult => leetFoldUnits(unitTextOf(input));

/**
 * Deletes combining diacritical marks (U+0300–U+036F, the block that includes
 * the combining grapheme joiner U+034F) when the character before them is an
 * ASCII Latin letter — f́úćḱ and fu͏ck reach the dictionary as fuck.
 *
 * The Latin-letter condition is the whole safety argument: Indic combining
 * marks are load-bearing orthography, but they live in their own blocks
 * (U+0900 and up) AND follow non-ASCII bases, so this fold cannot touch them
 * on either test. A mark following anything non-ASCII passes through
 * unchanged. Runs on pass 1 after confusablesFold, so a mark whose base was a
 * confusable (α + acute) is treated the same as one on a plain letter.
 */
export const stripLatinMarksFoldUnits: UnitFold = ({ text: input, units, n, profile }: UnitText): FoldResult => {
	if (profile.allAscii) return identityFold(input);
	// One range sweep decides whether the builder walk runs at all: Indic text
	// carries no U+0300–U+036F marks, so it must not pay a whole fold pass.
	let hasMark = false;
	for (let i = 0; i < n; i++) {
		const code = units[i]!;
		if (code >= 0x0300 && code <= 0x036f) {
			hasMark = true;
			break;
		}
	}
	if (!hasMark) return identityFold(input);
	const b = new FoldBuilder(input);
	let prevIsAsciiLetter = false;
	for (let i = 0; i < n; i++) {
		const code = units[i]!;
		if (code >= 0x0300 && code <= 0x036f && prevIsAsciiLetter) {
			// A run of marks on one letter all strips: prev flag stays true.
			b.replace(i, 1, '');
			continue;
		}
		b.keep(i, 1);
		prevIsAsciiLetter =
			(code >= 0x61 && code <= 0x7a) || (code >= 0x41 && code <= 0x5a);
	}
	return b.finish();
};

export const stripLatinMarksFold: Fold = (input: string): FoldResult =>
	stripLatinMarksFoldUnits(unitTextOf(input));

/**
 * Runs of the SAME code point longer than `threshold` are truncated to
 * `threshold` ("fuuuuck" → "fuuck" at 2; legitimate doubles like "assess"
 * survive).
 */
export function collapseRepeatsFoldUnits(threshold = 2): UnitFold {
	return ({ text: input, units, n, profile }: UnitText): FoldResult => {
		// Gate: the walk below deletes exactly the code points that extend a
		// run of equal code points past `threshold`, and keeps every other
		// one. Without surrogates every code point is one unit, so "no run of
		// threshold+1 equal UNITS" is "no run of threshold+1 equal code
		// points" and the builder could never be dirtied — `finish()` would
		// return `identityFold(input)`. With a surrogate present the unit
		// flags say nothing about code-point runs (😀😀 has no two equal
		// adjacent units), so the walk runs.
		if (
			!profile.hasSurrogate &&
			(threshold >= 2 ? !profile.hasTripleUnit : !profile.hasDoubleUnit)
		) {
			return identityFold(input);
		}
		const b = new FoldBuilder(input);
		let prevCp = -1;
		let runLen = 0;
		let i = 0;
		while (i < n) {
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
			if (cp === prevCp) {
				runLen++;
			} else {
				prevCp = cp;
				runLen = 1;
			}
			if (runLen <= threshold) b.keepCodePoint(i, unitLen);
			else b.replace(i, unitLen, '');
			i += unitLen;
		}
		return b.finish();
	};
}

export function collapseRepeatsFold(threshold = 2): Fold {
	const f = collapseRepeatsFoldUnits(threshold);
	return (input: string): FoldResult => f(unitTextOf(input));
}

/** Threshold-1 collapse for the skeleton pipeline ("fuuuuck" → "fuck"). */
export const collapseAllRepeatsFoldUnits: UnitFold = collapseRepeatsFoldUnits(1);
export const collapseAllRepeatsFold: Fold = (input: string): FoldResult =>
	collapseAllRepeatsFoldUnits(unitTextOf(input));

const collapseDoublesFoldUnits: UnitFold = collapseRepeatsFoldUnits(2);

/**
 * confusables ∘ stripLatinMarks ∘ leet ∘ collapseRepeats(2), hand-chained
 * exactly as `composeFolds` would chain them, each stage reading the previous
 * stage's output through its units and profile.
 */
export const latinFoldUnits: UnitFold = (t: UnitText): FoldResult => {
	const conf = confusablesFoldUnits(t);
	const confText = unitTextOfResult(t, conf);
	const marks = chainFolds(conf, stripLatinMarksFoldUnits(confText));
	const marksText = unitTextOfResult(confText, marks);
	const leet = chainFolds(marks, leetFoldUnits(marksText));
	const leetText = unitTextOfResult(marksText, leet);
	return chainFolds(leet, collapseDoublesFoldUnits(leetText));
};

export const latinFold: Fold = (input: string): FoldResult => latinFoldUnits(unitTextOf(input));
