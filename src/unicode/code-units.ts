/**
 * Code-unit access for the per-character loops of the engine.
 *
 * Every hot loop in this package reads a string one UTF-16 unit at a time,
 * and MUST do so through these helpers rather than `s.charCodeAt(i)`,
 * `s.codePointAt(i)` or `s[i]` — with `s.length` read ONCE per call into a
 * local, never in the loop condition. The reason is measured, not stylistic:
 *
 * V8 keys the inline cache behind `s.charCodeAt`, `s.length` and `s[i]` on
 * the receiver's hidden class, and a string's hidden class encodes its
 * representation — sequential, cons, sliced, thin, internalized, each in a
 * one-byte and a two-byte flavour. A matcher that has scanned a few hundred
 * strings of assorted origin (literals, slices, concatenations, Devanagari
 * next to ASCII) has shown every hot site more than four of those, the cache
 * goes megamorphic, and the optimising compiler emits a generic property
 * lookup per character. Measured on the 20k-word ASCII benchmark row: the
 * same `isClean()` costs 5.7 ms in a fresh process and 11.7 ms after the
 * benchmark battery, and a bare `s.charCodeAt(i)` counting loop over the same
 * text goes from 0.12 ms to 0.49 ms (0.72 ms with `s.length` in the loop
 * test). Calling the builtin through `Function.prototype.call` has no
 * receiver-map cache at all — the receiver is checked to be a string, then
 * read — and stays at 0.11 ms whatever the process has seen before.
 *
 * Semantics are exactly the builtins': `codeUnitAt` past the end is NaN,
 * `codePointAt` past the end is undefined.
 */

const CHAR_CODE_AT = String.prototype.charCodeAt;
const CODE_POINT_AT = String.prototype.codePointAt;

/** `s.charCodeAt(i)`. */
export function codeUnitAt(s: string, i: number): number {
	return CHAR_CODE_AT.call(s, i);
}

/** `s.codePointAt(i)`. */
export function codePointAt(s: string, i: number): number | undefined {
	return CODE_POINT_AT.call(s, i);
}

/**
 * A string as its UTF-16 code units, for the scans that would otherwise read
 * it one `codeUnitAt` at a time — the automata and the whole-token tiers.
 * A `Uint16Array` element read is one hidden class for the whole process,
 * so a loop over it costs the same whatever strings came before (measured:
 * 0.067 ms per 120 KB in either ordering, against 0.11–0.49 ms for the
 * string forms above), and the array is built once per pass, not once per
 * scan of it.
 *
 * On Node the array is a widening memcpy through `Buffer.from(s, 'utf16le')`
 * (~0.004 ms per 120 KB, lone surrogates preserved); anywhere else, or on a
 * big-endian host, the portable loop below. Which path is live is decided
 * once at load, after a self-test of the fast one against the loop.
 */
export function stringToCodeUnitsPortable(s: string): Uint16Array {
	const n = s.length;
	const out = new Uint16Array(n);
	for (let i = 0; i < n; i++) out[i] = codeUnitAt(s, i);
	return out;
}

interface NodeBufferLike {
	readonly buffer: ArrayBufferLike;
	readonly byteOffset: number;
	readonly length: number;
}
interface NodeBufferCtor {
	from(s: string, encoding: 'utf16le'): NodeBufferLike;
}

const nodeBufferToCodeUnits: ((s: string) => Uint16Array) | undefined = (() => {
	const Buffer = (globalThis as { Buffer?: NodeBufferCtor }).Buffer;
	if (typeof Buffer?.from !== 'function') return undefined;
	// Uint16Array reads host order; 'utf16le' writes little-endian.
	if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) return undefined;
	const viaBuffer = (s: string): Uint16Array => {
		const b = Buffer.from(s, 'utf16le');
		return new Uint16Array(b.buffer, b.byteOffset, s.length);
	};
	try {
		const probe = 'aZ\ud800न्😀\udc00z';
		const fast = viaBuffer(probe);
		const slow = stringToCodeUnitsPortable(probe);
		if (fast.length !== slow.length) return undefined;
		for (let i = 0; i < slow.length; i++) if (fast[i] !== slow[i]) return undefined;
		return viaBuffer;
	} catch {
		return undefined;
	}
})();

export const stringToCodeUnits: (s: string) => Uint16Array =
	nodeBufferToCodeUnits ?? stringToCodeUnitsPortable;

/**
 * The string whose code units are `units[0 .. n)` — the inverse of
 * `stringToCodeUnits`, in native chunks. Lone surrogates round-trip.
 */
export function codeUnitsToString(units: Uint16Array, n: number): string {
	const CHUNK = 8192;
	if (n <= CHUNK) return String.fromCharCode.apply(null, units.subarray(0, n) as unknown as number[]);
	let out = '';
	for (let i = 0; i < n; i += CHUNK) {
		const end = i + CHUNK < n ? i + CHUNK : n;
		out += String.fromCharCode.apply(null, units.subarray(i, end) as unknown as number[]);
	}
	return out;
}

/**
 * `s.codePointAt(i)` over a code-unit array of length `n`: undefined past the
 * end, the unit itself for a lone surrogate, the combined code point for a
 * valid pair.
 */
export function codePointAtUnits(units: Uint16Array, i: number, n: number): number | undefined {
	if (i < 0 || i >= n) return undefined;
	const u = units[i]!;
	if (u >= 0xd800 && u <= 0xdbff && i + 1 < n) {
		const low = units[i + 1]!;
		if (low >= 0xdc00 && low <= 0xdfff) return (u - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
	}
	return u;
}

/**
 * Facts about a code-unit array that decide, before a fold or a scan runs,
 * whether it could possibly do anything on this text. Each flag is
 * CONSERVATIVE in the same direction: `false` is a proof that the thing is
 * absent; `true` only means "not ruled out". Every gate that consults a flag
 * carries, at the gate, the argument from the gated code that a `false`
 * flag makes it a no-op — the flag definitions here are the other half of
 * those arguments.
 */
export interface UnitProfile {
	/** Every unit < 0x80. */
	readonly allAscii: boolean;
	/** Some unit in A–Z. */
	readonly hasUpper: boolean;
	/** Some unit in 0–9. */
	readonly hasDigit: boolean;
	/**
	 * Some unit is a leet source — one of `@ 4 3 1 ! | 0 $ 5 7 2 6 9` — or a
	 * `p` is immediately followed by an `h`. These are the only positions
	 * `leetFold` rewrites.
	 */
	readonly hasLeetSource: boolean;
	/** Some unit equals the unit before it. */
	readonly hasDoubleUnit: boolean;
	/** Some unit equals the two units before it. */
	readonly hasTripleUnit: boolean;
	/** Some unit is a UTF-16 surrogate, i.e. a code point may span two units. */
	readonly hasSurrogate: boolean;
	/** Some unit is one of the mask characters `* # @ $ %`. */
	readonly hasMask: boolean;
	/** Some unit is ≥ U+2100, ©, or ® — the pre-gate for Extended_Pictographic. */
	readonly mayHaveEmoji: boolean;
	/** Some unit is `#` or `@`. */
	readonly hasHashOrAt: boolean;
	/** Some unit is `.` or `-`. */
	readonly hasDotOrHyphen: boolean;
	/**
	 * Some position i has spelled-run separators (space, tab, `.` `-` `_`
	 * newline `/`) at i+1, i+3 and i+5 — the separated tier's
	 * `couldStartRun` shape. Conservative: also true for a run beginning at
	 * i = -1.
	 */
	readonly hasSpelledRunShape: boolean;
}

const C_UPPER = 1;
const C_DIGIT = 2;
const C_LEET = 4;
const C_MASK = 8;
const C_HASH_AT = 16;
const C_DOT_HYPHEN = 32;
const C_SEP = 64;

/** Bit classes of the ASCII units, so the sweep does one table read per unit. */
const ASCII_CLASS: Uint8Array = (() => {
	const t = new Uint8Array(0x80);
	for (let c = 0x41; c <= 0x5a; c++) t[c]! |= C_UPPER;
	for (let c = 0x30; c <= 0x39; c++) t[c]! |= C_DIGIT;
	for (const ch of '@431!|0$57269') t[ch.charCodeAt(0)]! |= C_LEET;
	for (const ch of '*#@$%') t[ch.charCodeAt(0)]! |= C_MASK;
	for (const ch of '#@') t[ch.charCodeAt(0)]! |= C_HASH_AT;
	for (const ch of '.-') t[ch.charCodeAt(0)]! |= C_DOT_HYPHEN;
	for (const ch of ' \t.-_\n/') t[ch.charCodeAt(0)]! |= C_SEP;
	return t;
})();

export function profileUnits(units: Uint16Array, n: number): UnitProfile {
	let cls = 0;
	let allAscii = true;
	let hasSurrogate = false;
	let mayHaveEmoji = false;
	let hasDoubleUnit = false;
	let hasTripleUnit = false;
	let hasPh = false;
	let hasSpelledRunShape = false;
	let prev = -1;
	let prev2 = -1;
	// Separator-ness of the last five positions, bit 0 = this one, so the
	// i+1 / i+3 / i+5 shape is "bits 4, 2 and 0 all set" at position i+5 —
	// whatever else sits at i+2 and i+4.
	let sepBits = 0;
	for (let i = 0; i < n; i++) {
		const u = units[i]!;
		let isSep = 0;
		if (u < 0x80) {
			const c = ASCII_CLASS[u]!;
			cls |= c;
			isSep = c & C_SEP;
			if (u === 0x68 && prev === 0x70) hasPh = true;
		} else {
			allAscii = false;
			if (u >= 0x2100 || u === 0xa9 || u === 0xae) mayHaveEmoji = true;
			if (u >= 0xd800 && u <= 0xdfff) hasSurrogate = true;
		}
		sepBits = ((sepBits << 1) | (isSep !== 0 ? 1 : 0)) & 0x1f;
		if ((sepBits & 0b10101) === 0b10101) hasSpelledRunShape = true;
		if (u === prev) {
			hasDoubleUnit = true;
			if (u === prev2) hasTripleUnit = true;
		}
		prev2 = prev;
		prev = u;
	}
	return {
		allAscii,
		hasUpper: (cls & C_UPPER) !== 0,
		hasDigit: (cls & C_DIGIT) !== 0,
		hasLeetSource: (cls & C_LEET) !== 0 || hasPh,
		hasDoubleUnit,
		hasTripleUnit,
		hasSurrogate,
		hasMask: (cls & C_MASK) !== 0,
		mayHaveEmoji,
		hasHashOrAt: (cls & C_HASH_AT) !== 0,
		hasDotOrHyphen: (cls & C_DOT_HYPHEN) !== 0,
		hasSpelledRunShape,
	};
}
