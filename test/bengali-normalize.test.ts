/**
 * Bengali script handling in the base fold.
 *
 * The Bengali rules in `src/unicode/indic-scripts.ts` predate this pack —
 * they were written alongside Devanagari by someone working on Hindi. This
 * suite is the re-derivation from Bengali orthography: every rule the script
 * DOES have (and why it survives the audit), the two that were added, the
 * folds Bengali deliberately does NOT have, and a regression block proving
 * Devanagari, Tamil and English are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS } from '../src/unicode/indic-scripts.js';

const HOSONTO = '্'; // BENGALI SIGN VIRAMA
const NUKTA = '়';
const ZWJ = '‍';
const ZWNJ = '‌';

const beng = INDIC_SCRIPTS.find((s) => s.script === 'Beng')!;

describe('Bengali: registry entry', () => {
	it('is registered with the Bengali block and the hosonto', () => {
		expect(beng).toBeDefined();
		expect(beng.block).toEqual([0x0980, 0x09ff]);
		expect(beng.virama).toBe(0x09cd);
		expect(beng.anusvara).toBe('ং');
	});

	it('opts into virama-run collapsing (Devanagari deliberately does not)', () => {
		expect(beng.collapseViramaRuns).toBe(true);
		const deva = INDIC_SCRIPTS.find((s) => s.script === 'Deva')!;
		expect(deva.collapseViramaRuns).toBeUndefined();
	});
});

describe('Bengali: nukta (U+09BC)', () => {
	// Audited, kept: ড় ঢ় য় are full letters, not optional diacritic variants
	// the way Hindi's ज़/ज is — but they are in near complementary distribution
	// with their bases, so the merge is close to injective.
	it('strips the nukta, unifying ড়/ড, ঢ়/ঢ and য়/য', () => {
		expect(indicFold('ড়').output).toBe('ড');
		expect(indicFold('ঢ়').output).toBe('ঢ');
		expect(indicFold('য়').output).toBe('য');
	});

	it('handles both the precomposed and the decomposed spelling', () => {
		// U+09DC/09DD/09DF are composition exclusions, so NFC has already split
		// them into base + nukta by the time indicFold runs inside baseFold.
		expect(baseFold('ড়').output).toBe('ড');
		expect(baseFold('ড' + NUKTA).output).toBe('ড');
		expect(baseFold('য়').output).toBe(baseFold('য' + NUKTA).output);
	});

	it('unifies the two live spellings of শুয়োর "pig"', () => {
		expect(baseFold('শুয়োর').output).toBe(baseFold('শুযোর').output);
	});

	it('does not merge any real Bengali word pair (the reason it survives)', () => {
		// ড় is never word-initial and ড (outside conjuncts) almost always is,
		// so the collapsed keys land in unoccupied space rather than on top of
		// another word.
		expect(baseFold('বড়').output).not.toBe(baseFold('বাড়ি').output);
		expect(baseFold('পড়া').output).not.toBe(baseFold('পদা').output);
	});
});

describe('Bengali: visarga ঃ (U+0983)', () => {
	it('drops the visarga', () => {
		expect(indicFold('ঃ').output).toBe('');
	});

	it('unifies দুঃখ with the casual spelling দুখ', () => {
		expect(baseFold('দুঃখ').output).toBe(baseFold('দুখ').output);
	});
});

describe('Bengali: chandrabindu ঁ and the nasal clusters', () => {
	it('maps chandrabindu to anusvara', () => {
		expect(indicFold('ঁ').output).toBe('ং');
	});

	it('folds every declared nasal + hosonto to anusvara', () => {
		for (const nasal of ['ন', 'ম', 'ণ', 'ঙ', 'ঞ']) {
			expect(indicFold(`${nasal}${HOSONTO}`).output, nasal).toBe('ং');
		}
	});

	it('unifies the ঙ্ক ≡ ংক doublet, which is the rule that earns its keep', () => {
		// শঙ্কা ≡ শংকা and বাংলা ≡ বাঙলা are genuine live Bengali spellings.
		expect(baseFold('শঙ্কা').output).toBe(baseFold('শংকা').output);
	});

	it('unifies চাঁদ ≡ চান্দ and বেজন্মা ≡ বেজম্মা', () => {
		// The chandrabindu rule and the nasal rule are two halves of one
		// spelling variation; বেজম্মা is the casual spelling of বেজন্মা and the
		// script table alone makes them one key.
		expect(baseFold('চাঁদ').output).toBe(baseFold('চান্দ').output);
		expect(baseFold('বেজন্মা').output).toBe(baseFold('বেজম্মা').output);
	});

	it('does not collide the folded forms onto an innocent word', () => {
		// The merged key (ং before a non-velar) is a sequence no native Bengali
		// word occupies — which is why the over-fold is tolerable.
		expect(baseFold('চাঁদ').output).not.toBe(baseFold('চাঁড়াল').output);
		expect(baseFold('শান্তি').output).not.toBe(baseFold('শাঁটি').output);
	});
});

describe('Bengali: khanda ta ৎ (U+09CE) — added with the bn pack', () => {
	it('expands khanda ta to ত + hosonto', () => {
		expect(indicFold('ৎ').output).toBe(`ত${HOSONTO}`);
	});

	it('unifies হঠাৎ ≡ হঠাত্ and উৎসব ≡ উত্সব', () => {
		// Unicode deliberately gives ৎ no canonical decomposition, so before
		// this rule the two live spellings of one word were two keys.
		expect(baseFold('হঠাৎ').output).toBe(baseFold(`হঠাত${HOSONTO}`).output);
		expect(baseFold('উৎসব').output).toBe(baseFold(`উত${HOSONTO}সব`).output);
	});

	it('keeps an exact expansion map', () => {
		const r = indicFold('ৎ');
		expect(r.output).toHaveLength(2);
		expect(r.map).toEqual([0, 0]);
	});
});

describe('Bengali: hosonto runs', () => {
	it('collapses a doubled hosonto (typing artifact / evasion vector)', () => {
		expect(indicFold(`ক${HOSONTO}${HOSONTO}ক`).output).toBe(`ক${HOSONTO}ক`);
	});

	it('maps a collapsed run back to the first hosonto', () => {
		const r = indicFold(`ক${HOSONTO}${HOSONTO}${HOSONTO}ক`);
		expect(r.output).toBe(`ক${HOSONTO}ক`);
		expect(r.map).toEqual([0, 1, 4]);
	});

	it('survives ZWJ / ZWNJ injected around a hosonto', () => {
		expect(baseFold(`ক${HOSONTO}${ZWNJ}ক`).output).toBe(`ক${HOSONTO}ক`);
		expect(baseFold(`ক${HOSONTO}${ZWJ}ক`).output).toBe(`ক${HOSONTO}ক`);
	});
});

describe('Bengali: the folds it deliberately does NOT have', () => {
	it('leaves ya-phala ্য alone — it is a conjunct member, not a diacritic', () => {
		// সত্য "truth" must not collapse onto সত "true".
		expect(baseFold('সত্য').output).not.toBe(baseFold('সত').output);
		expect(baseFold('বেশ্যা').output).toContain(`শ${HOSONTO}য`);
	});

	it('leaves ba-phala ্ব alone for the same reason', () => {
		expect(baseFold('বিশ্ব').output).not.toBe(baseFold('বিশ').output);
		expect(baseFold('স্বামী').output).not.toBe(baseFold('সামী').output);
	});

	it('does NOT fold শ / ষ / স together, however tempting', () => {
		// All three are /ʃ/ in Bengali and confusing them is the classic
		// Bengali spelling mistake — but they are distinct native letters and
		// the merge is not injective: শাল "sal tree" / সাল "year" / ষাঁড় "bull".
		expect(baseFold('শাল').output).not.toBe(baseFold('সাল').output);
		expect(baseFold('সাল').output).not.toBe(baseFold('ষাল').output);
	});

	it('leaves the reph র্ alone — it is phonemic', () => {
		expect(baseFold('কর্ম').output).not.toBe(baseFold('কম').output);
		expect(baseFold(`র${HOSONTO}`).output).toBe(`র${HOSONTO}`);
	});

	it('does not touch the Assamese letterforms ৰ and ৱ', () => {
		// Regional letters that need Assamese judgement; the bn pack does not
		// claim Assamese.
		expect(indicFold('ৰ').output).toBe('ৰ');
		expect(indicFold('ৱ').output).toBe('ৱ');
	});
});

describe('regression: the other scripts are unchanged by the Bengali work', () => {
	it('still folds Devanagari nasal + virama, nukta, chandrabindu, visarga', () => {
		const r = indicFold('हिन्दी');
		expect(r.output).toBe('हिंदी');
		expect(r.map).toEqual([0, 1, 2, 4, 5]);
		expect(indicFold('क़').output).toBe('क');
		expect(indicFold('चाँद').output).toBe('चांद');
		expect(indicFold('दुःख').output).toBe('दुख');
	});

	it('still does NOT collapse doubled Devanagari viramas', () => {
		expect(indicFold('क््क').output).toBe('क््क');
	});

	it('leaves Tamil alone', () => {
		expect(baseFold('தமிழ்நாடு').output).toBe('தமிழ்நாடு');
		expect(indicFold('ஃ').output).toBe('');
		expect(indicFold('ஜ').output).toBe('ச');
	});

	it('leaves English and Hinglish text byte-identical', () => {
		for (const text of ['fuck', 'bh0sdike', 'Mahatma Gandhi', 'classic assessment']) {
			expect(baseFold(text).output).toBe(text.toLowerCase());
		}
	});
});
