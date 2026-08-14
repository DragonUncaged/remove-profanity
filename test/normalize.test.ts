import { describe, it, expect } from 'vitest';
import {
	nfcFold,
	stripInvisiblesFold,
	foldWidthFold,
	lowercaseFold,
	indicFold,
	baseFold,
} from '../src/unicode/normalize.js';

/**
 * Map a span [start, end) of a fold's OUTPUT back to a span of the fold's
 * input, using the standard convention the matcher uses: original start is
 * map[start]; original end is map[end] when the span ends mid-output, or
 * input.length when the match runs to the end of the output.
 */
function originalSpan(
	input: string,
	map: number[],
	start: number,
	end: number,
): [number, number] {
	const s = map[start]!;
	const e = end < map.length ? map[end]! : input.length;
	return [s, e];
}

describe('nfcFold', () => {
	it('is the identity (with identity map) on already-NFC ASCII', () => {
		const r = nfcFold('abc');
		expect(r.output).toBe('abc');
		expect(r.map).toEqual([0, 1, 2]);
	});

	it('composes e + U+0301 into é and maps the output unit to the segment start', () => {
		const r = nfcFold('é');
		expect(r.output).toBe('é');
		expect(r.map).toEqual([0]);
	});

	it('keeps exact maps around a composed segment', () => {
		const r = nfcFold('aéb');
		expect(r.output).toBe('aéb');
		expect(r.map).toEqual([0, 1, 3]);
	});

	it('maps every unit of an unchanged multi-unit segment to the segment start', () => {
		// ति = त + vowel sign ि (a combining mark): one segment starting at 0.
		const r = nfcFold('ति');
		expect(r.output).toBe('ति');
		expect(r.map).toEqual([0, 0]);
	});

	it('decomposes the composition-exclusion nukta letter क़ U+0958', () => {
		const r = nfcFold('क़');
		expect(r.output).toBe('क़'); // क + nukta
		expect(r.map).toEqual([0, 0]);
	});

	it('handles a leading orphan combining mark without crashing', () => {
		const r = nfcFold('́a');
		expect(r.output).toBe('́a');
		expect(r.map).toEqual([0, 1]);
	});
});

describe('stripInvisiblesFold', () => {
	it('deletes ZWSP and SOFT HYPHEN with an exact deletion map', () => {
		const r = stripInvisiblesFold('a​b­c');
		expect(r.output).toBe('abc');
		expect(r.map).toEqual([0, 2, 4]);
	});

	it('deletes every listed invisible', () => {
		const r = stripInvisiblesFold('x​‌‍­﻿⁠᠎y');
		expect(r.output).toBe('xy');
		expect(r.map).toEqual([0, 8]);
	});
});

describe('foldWidthFold', () => {
	it('folds fullwidth ASCII to ASCII', () => {
		const r = foldWidthFold('ｆｕｃｋ');
		expect(r.output).toBe('fuck');
		expect(r.map).toEqual([0, 1, 2, 3]);
	});

	it('leaves characters outside U+FF01–U+FF5E alone', () => {
		const r = foldWidthFold('abc हिंदी');
		expect(r.output).toBe('abc हिंदी');
	});
});

describe('lowercaseFold', () => {
	it('lowercases per code point with identity-length map', () => {
		const r = lowercaseFold('AbC');
		expect(r.output).toBe('abc');
		expect(r.map).toEqual([0, 1, 2]);
	});

	it('maps 1→2 expansions like İ back to the single input unit', () => {
		const r = lowercaseFold('aİb'); // İ lowercases to i + U+0307
		expect(r.output).toBe('ai̇b');
		expect(r.map).toEqual([0, 1, 1, 2]);
	});
});

describe('indicFold', () => {
	it('folds Devanagari nasal + virama to anusvara with exact map', () => {
		// हिन्दी: ह(0) ि(1) न(2) ्(3) द(4) ी(5) → हिंदी
		const r = indicFold('हिन्दी');
		expect(r.output).toBe('हिंदी');
		expect(r.map).toEqual([0, 1, 2, 4, 5]);
	});

	it('folds all five Devanagari nasals before virama', () => {
		for (const nasal of ['न', 'म', 'ण', 'ङ', 'ञ']) {
			expect(indicFold(`${nasal}्`).output).toBe('ं');
		}
	});

	it('folds Bengali nasal + virama to Bengali anusvara', () => {
		const r = indicFold('ন্'); // ন + virama
		expect(r.output).toBe('ং');
		expect(r.map).toEqual([0]);
		for (const nasal of ['ন', 'ম', 'ণ', 'ঙ', 'ঞ']) {
			expect(indicFold(`${nasal}্`).output).toBe('ং');
		}
	});

	it('maps chandrabindu to anusvara in both scripts', () => {
		const r = indicFold('चाँद'); // ँ U+0901 at index 2
		expect(r.output).toBe('चांद');
		expect(r.map).toEqual([0, 1, 2, 3]);
		expect(indicFold('ঁ').output).toBe('ং');
	});

	it('drops visarga', () => {
		const r = indicFold('दुःख'); // ः U+0903 at index 2
		expect(r.output).toBe('दुख');
		expect(r.map).toEqual([0, 1, 3]);
		expect(indicFold('ঃ').output).toBe('');
	});

	it('strips bare nukta', () => {
		const r = indicFold('क़');
		expect(r.output).toBe('क');
		expect(r.map).toEqual([0]);
		expect(indicFold('়').output).toBe('');
	});

	it('still folds a nasal cluster when a nukta sits between nasal and virama', () => {
		expect(indicFold('ऩ्').output).toBe('ं');
	});
});

describe('baseFold', () => {
	it('makes हिन्दी and हिंदी identical', () => {
		expect(baseFold('हिन्दी').output).toBe('हिंदी');
		expect(baseFold('हिन्दी').output).toBe(baseFold('हिंदी').output);
	});

	it('matches precomposed क़ (U+0958) to क: NFC decomposes, indicFold strips nukta', () => {
		expect(baseFold('क़').output).toBe('क');
		expect(baseFold('क़').output).toBe(baseFold('क').output);
	});

	it('makes क़ुत्ता (with U+0958-style nukta) ≡ कुत्ता', () => {
		const withNukta = 'क़ुत्ता'; // क़ुत्ता
		expect(baseFold(withNukta).output).toBe('कुत्ता');
		expect(baseFold(withNukta).output).toBe(baseFold('कुत्ता').output);
	});

	it('folds fullwidth ｆｕｃｋ (and uppercase ＦＵＣＫ) to fuck', () => {
		expect(baseFold('ｆｕｃｋ').output).toBe('fuck');
		expect(baseFold('ＦＵＣＫ').output).toBe('fuck');
	});

	it('maps ZWJ injection inside चूतिया back to the full original span', () => {
		const original = 'च‍ूतिया'; // ZWJ injected after च, 7 code units
		const { output, map } = baseFold(original);
		expect(output).toBe('चूतिया');
		expect(map).toEqual([0, 1, 3, 3, 5, 5]);
		// A match covering the whole folded output maps back to the whole
		// original string, ZWJ included.
		const [s, e] = originalSpan(original, map, 0, output.length);
		expect(s).toBe(0);
		expect(e).toBe(original.length);
		expect(original.slice(s, e)).toBe(original);
	});

	it('composes all stages: fullwidth + invisibles + case + indic at once', () => {
		const r = baseFold('Ｆ​UcK हिन्दी‍');
		expect(r.output).toBe('fuck हिंदी');
	});
});
