/**
 * Tamil script handling in the base fold, plus the regression guarantee that
 * generalizing `indicFold` into a per-script table did not change Devanagari
 * or Bengali behaviour.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS, INDIC_CASELESS_RANGE } from '../src/unicode/indic-scripts.js';

const PULLI = '்';
const AYTHAM = 'ஃ';

describe('INDIC_SCRIPTS registry', () => {
	it('registers Devanagari, Bengali and Tamil', () => {
		// Containment, not equality: the registry is appended to (and ordered by
		// Unicode block) as languages land, so this suite asserts only the three
		// scripts it owns. The uniqueness check below is what an exact list was
		// really guarding — two entries claiming one script code would make
		// `normalize.ts`'s derived tables silently order-dependent.
		const codes = INDIC_SCRIPTS.map((s) => s.script);
		expect(codes).toEqual(expect.arrayContaining(['Deva', 'Beng', 'Taml']));
		expect(new Set(codes).size, `duplicate script code in [${codes.join(', ')}]`).toBe(
			codes.length,
		);
		const names = INDIC_SCRIPTS.map((s) => s.name);
		expect(new Set(names).size, `duplicate script name in [${names.join(', ')}]`).toBe(
			names.length,
		);
	});

	it('gives every script a well-formed, non-overlapping block', () => {
		const sorted = [...INDIC_SCRIPTS].sort((a, b) => a.block[0] - b.block[0]);
		let prevEnd = -1;
		for (const rules of sorted) {
			const [start, end] = rules.block;
			expect(start, `${rules.script} block start < end`).toBeLessThan(end);
			expect(start, `${rules.script} block overlaps a previous one`).toBeGreaterThan(prevEnd);
			prevEnd = end;
			// Every code point a script touches must live inside its own block.
			for (const cp of rules.drop ?? []) {
				expect(cp, `${rules.script} drop U+${cp.toString(16)}`).toBeGreaterThanOrEqual(start);
				expect(cp).toBeLessThanOrEqual(end);
			}
			for (const [cp] of rules.map ?? []) {
				expect(cp, `${rules.script} map U+${cp.toString(16)}`).toBeGreaterThanOrEqual(start);
				expect(cp).toBeLessThanOrEqual(end);
			}
			if (rules.virama !== undefined) {
				expect(rules.virama).toBeGreaterThanOrEqual(start);
				expect(rules.virama).toBeLessThanOrEqual(end);
			}
		}
	});

	it('requires virama + anusvara wherever nasal folding is declared', () => {
		for (const rules of INDIC_SCRIPTS) {
			if (!rules.nasalsToAnusvara?.length) continue;
			expect(rules.virama, `${rules.script} virama`).toBeDefined();
			expect(rules.anusvara, `${rules.script} anusvara`).toBeDefined();
		}
	});

	it('covers every registered block with the caseless fast-path range', () => {
		const [lo, hi] = INDIC_CASELESS_RANGE;
		for (const rules of INDIC_SCRIPTS) {
			expect(rules.block[0]).toBeGreaterThanOrEqual(lo);
			expect(rules.block[1]).toBeLessThanOrEqual(hi);
		}
	});
});

describe('Tamil: aytham ஃ (U+0B83)', () => {
	it('drops the aytham, exactly like Devanagari/Bengali visarga', () => {
		const r = indicFold(AYTHAM);
		expect(r.output).toBe('');
	});

	it('unifies the borrowed-f spelling ஃப with plain ப', () => {
		// ஃபேஸ்புக் ("Facebook") ≡ பேஸ்புக்
		expect(baseFold('ஃபேஸ்புக்').output).toBe(baseFold('பேஸ்புக்').output);
	});

	it('unifies the literary அஃது with the colloquial அது', () => {
		expect(baseFold('அஃது').output).toBe(baseFold('அது').output);
	});

	it('keeps an exact deletion map', () => {
		const r = indicFold(`அ${AYTHAM}து`); // ஃ at index 1
		expect(r.output).toBe('அது');
		expect(r.map).toEqual([0, 2, 3]);
	});
});

describe('Tamil: pulli / virama U+0BCD', () => {
	it('does NOT fold nasal + pulli to anusvara (Tamil is not Devanagari)', () => {
		// ங்க / ந்த / ம்ப are the only way Tamil writes these clusters —
		// folding them to U+0B82 would invent an orthography Tamil lacks.
		for (const cluster of ['ங்', 'ஞ்', 'ண்', 'ந்', 'ம்']) {
			expect(indicFold(cluster).output).toBe(cluster);
		}
		expect(baseFold('தமிழ்நாடு').output).toBe('தமிழ்நாடு');
	});

	it('collapses a doubled pulli (typing artifact / evasion vector)', () => {
		const doubled = `க${PULLI}${PULLI}க`;
		expect(indicFold(doubled).output).toBe(`க${PULLI}க`);
		expect(baseFold(doubled).output).toBe(baseFold(`க${PULLI}க`).output);
	});

	it('maps a collapsed pulli run back to the first pulli', () => {
		const r = indicFold(`க${PULLI}${PULLI}${PULLI}க`);
		expect(r.output).toBe(`க${PULLI}க`);
		expect(r.map).toEqual([0, 1, 4]);
	});

	it('leaves a legitimate single pulli untouched', () => {
		expect(indicFold(`பூல்`).output).toBe('பூல்');
	});

	it('survives ZWNJ injected after a pulli (a real Tamil rendering trick)', () => {
		const withZwnj = `புண${PULLI}‌டை`;
		expect(baseFold(withZwnj).output).toBe('புண்டை');
	});
});

describe('Tamil: grantha letters', () => {
	it('folds ஜ ஶ ஷ ஸ to ச', () => {
		for (const grantha of ['ஜ', 'ஶ', 'ஷ', 'ஸ']) {
			expect(indicFold(grantha).output, grantha).toBe('ச');
		}
	});

	it('unifies the caste-term doublet ஜாதி ≡ சாதி', () => {
		expect(baseFold('ஜாதி').output).toBe(baseFold('சாதி').output);
	});

	it('unifies கஸ்மாலம் with its ச spelling', () => {
		expect(baseFold('கஸ்மாலம்').output).toBe(baseFold('கச்மாலம்').output);
	});

	it('leaves ஹ alone (its Tamilization is inconsistent — deliberately unfolded)', () => {
		expect(indicFold('ஹ').output).toBe('ஹ');
	});
});

describe('Tamil: the confusable nasals', () => {
	it('folds ன (alveolar) to ந (dental) — phonetically identical in modern Tamil', () => {
		expect(indicFold('ன').output).toBe('ந');
		expect(baseFold('சனியன்').output).toBe(baseFold('சநியந்').output);
	});

	it('does NOT fold ண (retroflex) — it is contrastive', () => {
		// மணம் "scent" must not collapse onto மனம் "mind".
		expect(indicFold('ண').output).toBe('ண');
		expect(baseFold('மணம்').output).not.toBe(baseFold('மனம்').output);
	});

	it('does NOT fold the ல/ள/ழ or ர/ற sets — all phonemically contrastive', () => {
		expect(baseFold('வலி').output).not.toBe(baseFold('வளி').output);
		expect(baseFold('வளி').output).not.toBe(baseFold('வழி').output);
		expect(baseFold('மரம்').output).not.toBe(baseFold('மறம்').output);
	});
});

describe('Tamil: NFC and vowel signs', () => {
	it('composes the decomposed ஒ/ஓ/ஔ vowel signs', () => {
		// ொ U+0BCA decomposes to ெ U+0BC6 + ா U+0BBE; NFC recomposes.
		const decomposed = 'பொட்டை';
		expect(baseFold(decomposed).output).toBe(baseFold('பொட்டை').output);
	});

	it('keeps a Tamil grapheme cluster mapping back to its whole original span', () => {
		const original = 'பு‍ண்டை'; // ZWJ injected after the first cluster
		const { output, map } = baseFold(original);
		expect(output).toBe('புண்டை');
		expect(map[0]).toBe(0);
		expect(map[map.length - 1]).toBeGreaterThan(2);
	});
});

describe('regression: Devanagari and Bengali are unchanged by the table rewrite', () => {
	it('still folds Devanagari nasal + virama to anusvara', () => {
		const r = indicFold('हिन्दी');
		expect(r.output).toBe('हिंदी');
		expect(r.map).toEqual([0, 1, 2, 4, 5]);
		for (const nasal of ['न', 'म', 'ण', 'ङ', 'ञ']) {
			expect(indicFold(`${nasal}्`).output).toBe('ं');
		}
	});

	it('still folds Bengali nasal + virama to Bengali anusvara', () => {
		for (const nasal of ['ন', 'ম', 'ণ', 'ঙ', 'ঞ']) {
			expect(indicFold(`${nasal}্`).output).toBe('ং');
		}
	});

	it('still strips nukta, folds chandrabindu, drops visarga', () => {
		expect(indicFold('क़').output).toBe('क');
		expect(indicFold('चाँद').output).toBe('चांद');
		expect(indicFold('दुःख').output).toBe('दुख');
		expect(indicFold('ঁ').output).toBe('ং');
		expect(indicFold('ঃ').output).toBe('');
	});

	it('does NOT collapse doubled Devanagari viramas (opt-in per script)', () => {
		const doubled = 'क््क';
		expect(indicFold(doubled).output).toBe(doubled);
	});

	it('leaves English and Hinglish text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi', 'classic assessment']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});
