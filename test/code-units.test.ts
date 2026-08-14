/**
 * The code-unit layer under every per-character loop (src/unicode/code-units.ts):
 *
 * 1. `stringToCodeUnits` — the Buffer fast path and the portable loop must
 *    agree unit for unit, including lone surrogates and astral pairs.
 * 2. `profileUnits` — every flag is checked against its brute-force
 *    definition on random strings, because a wrong `false` would silently
 *    skip a fold or a tier (the gates treat `false` as a proof of absence).
 * 3. The string folds and their UnitFold twins are one code path.
 */
import { describe, expect, it } from 'vitest';
import {
	codePointAt,
	codePointAtUnits,
	codeUnitAt,
	profileUnits,
	stringToCodeUnits,
	stringToCodeUnitsPortable,
} from '../src/unicode/code-units.js';
import { unitTextOf } from '../src/types.js';
import { baseFold, baseFoldUnits } from '../src/unicode/normalize.js';
import {
	collapseAllRepeatsFold,
	collapseAllRepeatsFoldUnits,
	latinFold,
	latinFoldUnits,
	leetFold,
} from '../src/folds/latin.js';
import { skeletonFold, skeletonFoldUnits } from '../src/folds/skeleton.js';

const SAMPLES = [
	'',
	'a',
	'Hello, World! 42 t1mes',
	'यह एक सामान्य वाक्य है',
	'இது ஒரு சாதாரண',
	'a\ud800b',
	'\udc00',
	'😀😀 fire🔥works',
	'é café ñ',
	'ph f u c k s.h.i.t #FuckThis',
	'aaa bb c 500 45s',
	'ＡＢ​‍',
];

/** Deterministic pseudo-random strings mixing every unit class the profile cares about. */
function randomStrings(count: number, seed = 7): string[] {
	let x = seed;
	const rnd = (): number => {
		x = (x * 1103515245 + 12345) & 0x7fffffff;
		return x / 0x7fffffff;
	};
	const pool = [
		...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
		...'@4!|$57*#%._-/ \t\n',
		'ph',
		'😀',
		'\ud83d',
		'\ude00',
		'é',
		'য',
		'℀',
		'©',
		'aa',
		'ऽऽऽ',
	];
	const out: string[] = [];
	for (let k = 0; k < count; k++) {
		const len = Math.floor(rnd() * 24);
		let s = '';
		for (let i = 0; i < len; i++) s += pool[Math.floor(rnd() * pool.length)]!;
		out.push(s);
	}
	return out;
}

const ALL = [...SAMPLES, ...randomStrings(1500)];

describe('stringToCodeUnits', () => {
	it('matches charCodeAt unit for unit, on both paths', () => {
		for (const s of ALL) {
			const fast = stringToCodeUnits(s);
			const slow = stringToCodeUnitsPortable(s);
			expect(fast.length).toBe(s.length);
			expect(slow.length).toBe(s.length);
			for (let i = 0; i < s.length; i++) {
				expect(fast[i]).toBe(s.charCodeAt(i));
				expect(slow[i]).toBe(s.charCodeAt(i));
			}
		}
	});

	it('codeUnitAt / codePointAt / codePointAtUnits agree with the builtins', () => {
		for (const s of ALL) {
			const units = stringToCodeUnits(s);
			for (let i = 0; i <= s.length; i++) {
				expect(codeUnitAt(s, i)).toEqual(s.charCodeAt(i));
				expect(codePointAt(s, i)).toBe(s.codePointAt(i));
				expect(codePointAtUnits(units, i, s.length)).toBe(s.codePointAt(i));
			}
		}
	});
});

describe('profileUnits', () => {
	const sepRe = /[ \t.\-_\n/]/;
	it('every flag agrees with its brute-force definition', () => {
		for (const s of ALL) {
			const p = profileUnits(stringToCodeUnits(s), s.length);
			const units = [...Array(s.length)].map((_, i) => s.charCodeAt(i));
			expect(p.allAscii, s).toBe(units.every((u) => u < 0x80));
			expect(p.hasUpper, s).toBe(/[A-Z]/.test(s));
			expect(p.hasDigit, s).toBe(/[0-9]/.test(s));
			expect(p.hasLeetSource, s).toBe(/[@431!|0$57269]|ph/.test(s));
			expect(p.hasDoubleUnit, s).toBe(units.some((u, i) => i > 0 && u === units[i - 1]));
			expect(p.hasTripleUnit, s).toBe(
				units.some((u, i) => i > 1 && u === units[i - 1] && u === units[i - 2]),
			);
			expect(p.hasSurrogate, s).toBe(units.some((u) => u >= 0xd800 && u <= 0xdfff));
			expect(p.hasMask, s).toBe(/[*#@$%]/.test(s));
			expect(p.mayHaveEmoji, s).toBe(units.some((u) => u >= 0x2100 || u === 0xa9 || u === 0xae));
			expect(p.hasHashOrAt, s).toBe(/[#@]/.test(s));
			expect(p.hasDotOrHyphen, s).toBe(/[.-]/.test(s));
			// couldStartRun shape at some i >= 0, or the conservative i = -1.
			let shape = false;
			for (let i = -1; i < s.length; i++) {
				const at = (k: number): boolean => k >= 0 && k < s.length && sepRe.test(s[k]!);
				if (at(i + 1) && at(i + 3) && at(i + 5)) shape = true;
			}
			expect(p.hasSpelledRunShape, s).toBe(shape);
		}
	});

	it('the flags that gate folds are exact where the gate needs them', () => {
		// A false flag must mean the fold is the identity — checked here by
		// running the fold: with the flag false, output === input.
		for (const s of ALL) {
			const p = profileUnits(stringToCodeUnits(s), s.length);
			if (!p.hasLeetSource) expect(leetFold(s).output).toBe(s);
			if (!p.hasSurrogate && !p.hasDoubleUnit) expect(collapseAllRepeatsFold(s).output).toBe(s);
			if (p.allAscii && !p.hasUpper) expect(baseFold(s).output).toBe(s);
		}
	});
});

describe('string folds and their UnitFold twins are one code path', () => {
	it('produce identical output and map', () => {
		for (const s of ALL) {
			const t = unitTextOf(s);
			for (const [f, g] of [
				[baseFold, baseFoldUnits],
				[latinFold, latinFoldUnits],
				[collapseAllRepeatsFold, collapseAllRepeatsFoldUnits],
				[skeletonFold, skeletonFoldUnits],
			] as const) {
				const a = f(s);
				const b = g(t);
				expect(b.output).toBe(a.output);
				expect([...b.map]).toEqual([...a.map]);
			}
		}
	});
});
