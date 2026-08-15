/**
 * Marathi in the Devanagari fold — the audit that came with the `mr` pack.
 *
 * Marathi shares its script with Hindi, so almost nothing needed to change;
 * the value of this file is the record of what was CHECKED. One rule was
 * added (eyelash reph ऱ → र) and the rest of the suite proves the existing
 * Devanagari behaviour, and Hindi with it, is untouched.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS } from '../src/unicode/indic-scripts.js';

const VIRAMA = '्';
const NUKTA = '़';
const RRA = 'ऱ'; // DEVANAGARI LETTER RRA — the eyelash reph ऱ

describe('Marathi: eyelash reph ऱ (U+0931)', () => {
	it('is NOT a composition exclusion — NFC composes र + nukta INTO it', () => {
		// This is the whole reason a rule was needed: unlike क़ U+0958–U+095F,
		// U+0931 survives NFC intact, so the nukta rule never sees it and
		// महाऱ्या / महार्या were two different keys.
		expect(('र' + NUKTA).normalize('NFC')).toBe(RRA);
		expect(RRA.normalize('NFC')).toBe(RRA);
		expect('क़'.normalize('NFC')).not.toBe('क़');
	});

	it('folds ऱ to plain र', () => {
		expect(indicFold(RRA).output).toBe('र');
		expect(baseFold('र' + NUKTA).output).toBe('र');
	});

	it('unifies the two Marathi spellings of the same word', () => {
		expect(baseFold('महाऱ्या').output).toBe(baseFold('महार्या').output);
		expect(baseFold('सुऱ्या').output).toBe(baseFold('सुर्या').output);
		expect(baseFold('कऱ्हाड').output).toBe(baseFold('कर्हाड').output);
	});

	it('leaves ऩ and ऴ unfolded — Dravidian-transliteration letters, not Marathi', () => {
		expect(indicFold('ऩ').output).toBe('ऩ');
		expect(indicFold('ऴ').output).toBe('ऴ');
	});
});

describe('Marathi: the Devanagari rules that already worked', () => {
	it('folds nasal + virama to anusvara, which Marathi leans on harder than Hindi', () => {
		expect(baseFold('गाण्ड').output).toBe(baseFold('गांड').output);
		for (const nasal of ['न', 'म', 'ण', 'ङ', 'ञ']) {
			expect(indicFold(`${nasal}${VIRAMA}`).output, nasal).toBe('ं');
		}
	});

	it('folds chandrabindu to anusvara', () => {
		expect(baseFold('गाँड').output).toBe(baseFold('गांड').output);
	});

	it('keeps ळ (U+0933) unfolded — it is a contrastive Marathi phoneme', () => {
		// काळ "time" must not collapse onto काल "yesterday".
		expect(indicFold('ळ').output).toBe('ळ');
		expect(baseFold('काळ').output).not.toBe(baseFold('काल').output);
	});

	it('keeps ॲ and ऍ (candra-e, for English loans) unfolded', () => {
		expect(indicFold('ॲ').output).toBe('ॲ');
		expect(baseFold('ॲड').output).toBe('ॲड');
		expect(indicFold('ऍ').output).toBe('ऍ');
	});

	it('keeps the Marathi vocative distinct from its neutral community name', () => {
		// मांग्या (the slur, native-script-only in the pack) must not fold onto
		// मंग्या, the everyday nickname for Mangesh.
		expect(baseFold('मांग्या').output).not.toBe(baseFold('मंग्या').output);
	});

	it('does NOT collapse doubled Devanagari viramas (Bengali opts in, Devanagari does not)', () => {
		expect(indicFold('क््क').output).toBe('क््क');
	});
});

describe('regression: adding the ऱ rule did not disturb the other scripts', () => {
	it('leaves every other Devanagari fold exactly as it was', () => {
		const r = indicFold('हिन्दी');
		expect(r.output).toBe('हिंदी');
		expect(r.map).toEqual([0, 1, 2, 4, 5]);
		expect(indicFold('क़').output).toBe('क');
		expect(indicFold('चाँद').output).toBe('चांद');
		expect(indicFold('दुःख').output).toBe('दुख');
		expect(baseFold('मालिक').output).toBe('मालिक');
		expect(baseFold('गूगल').output).toBe('गूगल');
	});

	it('touches no Hindi word that does not contain U+0931', () => {
		for (const word of ['मादरचोद', 'चूतिया', 'भोसड़ीके', 'हरामी', 'साले', 'कुत्ता']) {
			const folded = baseFold(word).output;
			expect(folded.includes(RRA), word).toBe(false);
		}
		// ...and the one Hindi word that could contain it means the same thing
		// either way: ड़ (U+095C) IS an exclusion and still decomposes.
		expect(baseFold('भोसड़ीके').output).toBe(baseFold('भोसडीके').output);
	});

	it('leaves Bengali, Tamil and English alone', () => {
		expect(indicFold('ঁ').output).toBe('ং');
		expect(indicFold('ৎ').output).toBe('ত্');
		expect(indicFold('ஜ').output).toBe('ச');
		expect(baseFold('Mahatma Gandhi').output).toBe('mahatma gandhi');
	});

	it('still registers Devanagari, Bengali and Tamil', () => {
		// Containment, not an exact list: other language packs append to
		// INDIC_SCRIPTS and this file has no business failing when they do.
		const codes = INDIC_SCRIPTS.map((s) => s.script);
		for (const code of ['Deva', 'Beng', 'Taml']) expect(codes).toContain(code);
	});
});
