/**
 * Odia script handling in the base fold.
 *
 * Odia is the closest relative of Bengali in INDIC_SCRIPTS, so this suite is
 * written to prove the two places the arms differ as much as the places they
 * agree — and, as with Tamil, that registering the script left Devanagari,
 * Bengali, Tamil and English untouched.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS } from '../src/unicode/indic-scripts.js';

const HALANT = '୍'; // ORIYA SIGN VIRAMA U+0B4D
const NUKTA = '଼'; // ORIYA SIGN NUKTA U+0B3C

describe('INDIC_SCRIPTS: Odia registration', () => {
	it('registers Odia with its own block', () => {
		const odia = INDIC_SCRIPTS.find((s) => s.script === 'Orya');
		expect(odia).toBeDefined();
		expect(odia!.name).toBe('Odia');
		expect(odia!.block).toEqual([0x0b00, 0x0b7f]);
	});

	it('does not overlap the Tamil block that follows it', () => {
		const odia = INDIC_SCRIPTS.find((s) => s.script === 'Orya')!;
		const tamil = INDIC_SCRIPTS.find((s) => s.script === 'Taml')!;
		expect(odia.block[1]).toBeLessThan(tamil.block[0]);
	});
});

describe('Odia: nukta U+0B3C', () => {
	it('drops the nukta, like Devanagari and Bengali', () => {
		expect(indicFold(NUKTA).output).toBe('');
	});

	it('unifies the two live spellings of the language’s own name', () => {
		// ଓଡ଼ିଆ ≡ ଓଡିଆ — writing ଡ without the dot is a mainstream habit, not a
		// typo, which is what makes this rule orthography rather than a guess.
		expect(baseFold('ଓଡ଼ିଆ').output).toBe(baseFold('ଓଡିଆ').output);
	});

	it('folds the precomposed flap letters through NFC first', () => {
		// U+0B5C and U+0B5D are composition exclusions: NFC hands the fold a
		// base + nukta pair, which then loses the nukta.
		expect(baseFold('ଡ଼').output).toBe('ଡ');
		expect(baseFold('ଢ଼').output).toBe('ଢ');
	});

	it('leaves ୟ U+0B5F alone — Odia YYA has NO canonical decomposition', () => {
		// This is the one place copying the Bengali arm would have been wrong:
		// Bengali য় U+09DF decomposes to ଯ + nukta, so the nukta rule reaches
		// it. Its Odia counterpart is atomic, so ୟ survives — which is correct
		// anyway, ଯ /dʒ/ and ୟ /j/ being distinct letters in ordinary words.
		expect('ୟ'.normalize('NFD')).toBe('ୟ');
		expect('য়'.normalize('NFD')).toBe('য়');
		expect(baseFold('ୟ').output).toBe('ୟ');
		expect(baseFold('ପ୍ରିୟ').output).not.toBe(baseFold('ପ୍ରିଯ').output);
	});
});

describe('Odia: candrabindu and anusvara', () => {
	it('folds candrabindu ଁ to anusvara ଂ', () => {
		expect(indicFold('ଁ').output).toBe('ଂ');
		// ନାହିଁ ≡ ନାହିଂ "no / not": both signs write vowel nasalisation in Odia.
		expect(baseFold('ନାହିଁ').output).toBe(baseFold('ନାହିଂ').output);
	});

	it('does NOT delete the nasal sign, so ହସ and ହଁସ stay different words', () => {
		// ହସ "laugh" vs ହଁସ "swan" — the fold only unifies the two nasal SIGNS.
		expect(baseFold('ହସ').output).not.toBe(baseFold('ହଁସ').output);
		expect(baseFold('ହଁସ').output).toBe(baseFold('ହଂସ').output);
	});

	it('folds nasal + halant to anusvara for all five nasals', () => {
		for (const nasal of ['ନ', 'ମ', 'ଣ', 'ଙ', 'ଞ']) {
			expect(indicFold(`${nasal}${HALANT}`).output, nasal).toBe('ଂ');
		}
		// ଅଙ୍କ ≡ ଅଂକ, ସମ୍ଭବ ≡ ସଂଭବ — Odia writes these clusters both ways.
		expect(baseFold('ଅଙ୍କ').output).toBe(baseFold('ଅଂକ').output);
		expect(baseFold('ସମ୍ଭବ').output).toBe(baseFold('ସଂଭବ').output);
	});

	it('keeps an exact offset map across the two-unit nasal cluster', () => {
		const r = indicFold(`ଅଙ${HALANT}କ`);
		expect(r.output).toBe('ଅଂକ');
		expect(r.map).toEqual([0, 1, 3]);
	});
});

describe('Odia: visarga and halant', () => {
	it('drops the visarga ଃ (ଦୁଃଖ ≡ ଦୁଖ)', () => {
		expect(indicFold('ଃ').output).toBe('');
		expect(baseFold('ଦୁଃଖ').output).toBe(baseFold('ଦୁଖ').output);
	});

	it('collapses a doubled halant (typing artifact / evasion vector)', () => {
		const doubled = `କ${HALANT}${HALANT}ଷ`;
		expect(indicFold(doubled).output).toBe(`କ${HALANT}ଷ`);
	});

	it('leaves a legitimate single halant untouched', () => {
		expect(indicFold('ବାଣ୍ଡ').output).toBe('ବାଂଡ'); // ଣ୍ + ଡ → ଂଡ
		expect(indicFold(`ପ${HALANT}ର`).output).toBe(`ପ${HALANT}ର`);
	});

	it('survives ZWNJ injected to break a conjunct', () => {
		expect(baseFold(`ଗାଣ${HALANT}‌ଡି`).output).toBe(baseFold('ଗାଣ୍ଡି').output);
	});
});

describe('Odia: folds deliberately NOT added', () => {
	it('does not fold ୱ WA onto ବ BA', () => {
		// The ସ୍ୱାମୀ ≡ ସ୍ବାମୀ alternation is real but lives in the conjunct;
		// folding the standalone letter would rewrite w-loanwords (ୱାର୍ଡ).
		expect(indicFold('ୱ').output).toBe('ୱ');
		expect(baseFold('ୱାର୍ଡ').output).not.toBe(baseFold('ବାର୍ଡ').output);
	});

	it('does not fold ଳ onto ଲ — both are contrastive letters', () => {
		expect(indicFold('ଳ').output).toBe('ଳ');
		expect(baseFold('ଛିନାଳି').output).not.toBe(baseFold('ଛିନାଲି').output);
	});

	it('does not touch the Odia digits or the isshar sign', () => {
		for (const ch of ['୦', '୭', '୰']) {
			expect(indicFold(ch).output, ch).toBe(ch);
		}
	});
});

describe('regression: the other scripts are unchanged by the Odia entry', () => {
	it('still folds Devanagari and Bengali nasal clusters and nukta', () => {
		expect(indicFold('हिन्दी').output).toBe('हिंदी');
		expect(indicFold('क़').output).toBe('क');
		expect(indicFold('চাঁদ').output).toBe('চাংদ');
		expect(indicFold('ঃ').output).toBe('');
		for (const nasal of ['ন', 'ম', 'ণ', 'ঙ', 'ঞ']) {
			expect(indicFold(`${nasal}্`).output).toBe('ং');
		}
	});

	it('still leaves Tamil nasal + pulli alone and drops the aytham', () => {
		for (const cluster of ['ங்', 'ஞ்', 'ண்', 'ந்', 'ம்']) {
			expect(indicFold(cluster).output).toBe(cluster);
		}
		expect(indicFold('ஃ').output).toBe('');
		expect(baseFold('தமிழ்நாடு').output).toBe('தமிழ்நாடு');
	});

	it('does NOT collapse doubled Devanagari viramas (still opt-in per script)', () => {
		expect(indicFold('क््क').output).toBe('क््क');
	});

	it('leaves English and Hinglish text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi', 'classic assessment']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});
