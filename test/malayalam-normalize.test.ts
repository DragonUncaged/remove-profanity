/**
 * Malayalam script handling in the base fold.
 *
 * Two things carry this suite, and they are the two things the task brief
 * singled out as the hard parts of Malayalam:
 *
 * 1. **Chillu letters**, which Unicode encodes twice over — atomically
 *    (ൻ U+0D7B) and as the older consonant + virama + ZWJ sequence. Both are
 *    in live use, and the fold makes them one key.
 * 2. **Old vs reformed orthography.** The chillu rule settles the only
 *    old/new difference that exists at the code-point level: pre-reform ൻറ
 *    and reformed ന്റ. The rest of the 1971 reform changed glyphs over
 *    identical code points, which this suite also asserts.
 *
 * Plus the fold Malayalam deliberately does NOT have, which is the one its
 * two nearest neighbours in the table DO have.
 */
import { describe, it, expect } from 'vitest';
import { indicFold, baseFold } from '../src/unicode/normalize.js';
import { INDIC_SCRIPTS, INDIC_CASELESS_RANGE } from '../src/unicode/indic-scripts.js';

const VIRAMA = '്'; // chandrakkala U+0D4D
const ZWJ = '‍';
const ZWNJ = '‌';

const malayalam = INDIC_SCRIPTS.find((s) => s.script === 'Mlym')!;

describe('Malayalam is registered', () => {
	it('appears in INDIC_SCRIPTS with a well-formed block', () => {
		expect(malayalam).toBeDefined();
		expect(malayalam.name).toBe('Malayalam');
		expect(malayalam.block).toEqual([0x0d00, 0x0d7f]);
	});

	it('sits inside the caseless fast-path range', () => {
		const [lo, hi] = INDIC_CASELESS_RANGE;
		expect(malayalam.block[0]).toBeGreaterThanOrEqual(lo);
		expect(malayalam.block[1]).toBeLessThanOrEqual(hi);
	});
});

describe('Malayalam: chillu letters', () => {
	const chillus: [chillu: string, expanded: string, name: string][] = [
		['ൺ', `ണ${VIRAMA}`, 'CHILLU NN'],
		['ൻ', `ന${VIRAMA}`, 'CHILLU N'],
		['ർ', `ര${VIRAMA}`, 'CHILLU RR'],
		['ൽ', `ല${VIRAMA}`, 'CHILLU L'],
		['ൾ', `ള${VIRAMA}`, 'CHILLU LL'],
		['ൿ', `ക${VIRAMA}`, 'CHILLU K'],
		['ൔ', `മ${VIRAMA}`, 'CHILLU M'],
		['ൕ', `യ${VIRAMA}`, 'CHILLU Y'],
		['ൖ', `ഴ${VIRAMA}`, 'CHILLU LLL'],
	];

	it.each(chillus)('expands %s to its consonant + chandrakkala (%s)', (chillu, expanded) => {
		expect(indicFold(chillu).output).toBe(expanded);
	});

	it('unifies the atomic chillu with the older ZWJ sequence', () => {
		// അവൻ, typed two ways, on two different decades of keyboard.
		expect(baseFold('അവൻ').output).toBe(baseFold(`അവന${VIRAMA}${ZWJ}`).output);
		expect(baseFold('കുണ്ടൻ').output).toBe(baseFold(`കുണ്ടന${VIRAMA}${ZWJ}`).output);
	});

	it('is a rule NFC cannot do for us — no chillu has a canonical decomposition', () => {
		// This is the load-bearing fact behind the whole `map` entry, and the
		// mirror image of the Odia ୟ U+0B5F case: there, a rule keyed on a
		// decomposition that does not exist would silently do nothing. Here,
		// WITHOUT an explicit rule the two live encodings of ൻ would never
		// converge, because Unicode deliberately gave the atomic chillu no
		// decomposition (that is what makes it distinct from the ZWJ form).
		for (const chillu of ['ൺ', 'ൻ', 'ർ', 'ൽ', 'ൾ', 'ൿ', 'ൔ', 'ൕ', 'ൖ']) {
			expect(chillu.normalize('NFD'), `${chillu} NFD`).toBe(chillu);
			expect(chillu.normalize('NFC'), `${chillu} NFC`).toBe(chillu);
		}
	});

	it('has no composition exclusions in the Malayalam block', () => {
		// Devanagari's precomposed nukta letters are exclusions, so NFC leaves
		// them decomposed and a rule must handle base + nukta. Malayalam has
		// no such trap: every decomposable code point in the block recomposes,
		// so nothing arrives at indicFold in an unexpected form.
		for (let cp = 0x0d00; cp <= 0x0d7f; cp++) {
			const ch = String.fromCodePoint(cp);
			const nfd = ch.normalize('NFD');
			if (nfd === ch) continue;
			expect(nfd.normalize('NFC'), `U+${cp.toString(16)} recomposes`).toBe(ch);
		}
	});

	it('maps a 1-to-2 expansion back to the chillu it came from', () => {
		const r = indicFold('അവൻ'); // ൻ at index 2
		expect(r.output).toBe(`അവന${VIRAMA}`);
		expect(r.map).toEqual([0, 1, 2, 2]);
	});
});

describe('Malayalam: old vs reformed orthography', () => {
	it('unifies pre-reform ൻറ with reformed ന്റ', () => {
		// The single commonest old/new difference in ordinary words, and it
		// falls out of the chillu rule with no dictionary duplication.
		expect(baseFold('നായിൻറെ').output).toBe(baseFold('നായിന്റെ').output);
		expect(baseFold('എൻറെ').output).toBe(baseFold('എന്റെ').output);
	});

	it('unifies the ZWNJ-separated conjunct with the ligated one', () => {
		// The reform's other visible habit is forcing unligated conjuncts with
		// a ZWNJ. Same code points either way once invisibles are stripped.
		expect(baseFold(`കുണ${VIRAMA}${ZWNJ}ണ`).output).toBe(baseFold('കുണ്ണ').output);
	});

	it('leaves the reformed detached vowel signs alone — they are the same code points', () => {
		// ു / ൂ / ൃ ligate in old orthography and detach in reformed, but the
		// encoding is identical, so no rule is needed and none is present.
		expect(baseFold('കു').output).toBe('കു');
		expect(baseFold('കൃ').output).toBe('കൃ');
	});
});

describe('Malayalam: the anusvara fold it deliberately does NOT have', () => {
	it('declares no nasalsToAnusvara, unlike Telugu and Kannada', () => {
		expect(malayalam.nasalsToAnusvara).toBeUndefined();
		expect(INDIC_SCRIPTS.find((s) => s.script === 'Telu')!.nasalsToAnusvara).toBeDefined();
		expect(INDIC_SCRIPTS.find((s) => s.script === 'Knda')!.nasalsToAnusvara).toBeDefined();
	});

	it('keeps ചന്ദ്രൻ distinct from the non-word ചംദ്രൻ', () => {
		// Malayalam writes homorganic nasal clusters as conjuncts and ONLY as
		// conjuncts. Folding here would rewrite a large fraction of ordinary
		// Malayalam onto spellings that are not Malayalam.
		expect(baseFold('ചന്ദ്രൻ').output).not.toBe(baseFold('ചംദ്രൻ').output);
		for (const cluster of [`ങ${VIRAMA}`, `ഞ${VIRAMA}`, `ണ${VIRAMA}`, `ന${VIRAMA}`, `മ${VIRAMA}`]) {
			expect(indicFold(cluster).output, cluster).toBe(cluster);
		}
	});

	it('leaves word-final ം (which is just /m/) untouched', () => {
		expect(baseFold('പൂരം').output).toBe('പൂരം');
		expect(baseFold('മലയാളം').output).toBe('മലയാളം');
	});
});

describe('Malayalam: other rules, present and absent', () => {
	it('drops the visarga ഃ', () => {
		expect(indicFold('ഃ').output).toBe('');
		expect(baseFold('ദുഃഖം').output).toBe(baseFold('ദുഖം').output);
	});

	it('collapses a doubled chandrakkala', () => {
		expect(indicFold(`ക${VIRAMA}${VIRAMA}ക`).output).toBe(`ക${VIRAMA}ക`);
	});

	it('has no nukta rule — Malayalam has no nukta', () => {
		expect(malayalam.drop).toEqual([0x0d03]);
	});

	it('leaves the candrabindu and the manuscript viramas alone', () => {
		// ഁ U+0D01 is a Vedic sign; U+0D3B / U+0D3C are manuscript viramas for
		// Prakrit and Sanskrit editions. None occurs in typed Malayalam, so
		// mapping them would be a guess made for no reader.
		expect(indicFold('ഁ').output).toBe('ഁ');
		expect(indicFold('഻').output).toBe('഻');
		expect(indicFold('഼').output).toBe('഼');
	});

	it('does not touch the voiced or aspirated series', () => {
		for (const [plain, aspirate] of [
			['ഗ', 'ഘ'],
			['ജ', 'ഝ'],
			['ഡ', 'ഢ'],
			['ദ', 'ധ'],
			['ബ', 'ഭ'],
			['ക', 'ഖ'],
		]) {
			expect(indicFold(aspirate!).output, aspirate).toBe(aspirate);
			expect(baseFold(plain!).output).not.toBe(baseFold(aspirate!).output);
		}
	});

	it('keeps the ണ്ണ / ന്ന contrast — പണ്ണി is not പന്നി', () => {
		// The pair that forces പണ്ണ് to ship native-script-only.
		expect(baseFold('പണ്ണി').output).not.toBe(baseFold('പന്നി').output);
	});
});

describe('regression: the other scripts are unchanged by the Malayalam entry', () => {
	it('still folds Devanagari, Bengali, Tamil, Telugu and Kannada as before', () => {
		expect(indicFold('हिन्दी').output).toBe('हिंदी');
		expect(indicFold('ঁ').output).toBe('ং');
		expect(indicFold('ஷ').output).toBe('ச');
		expect(indicFold('ன').output).toBe('ந');
		expect(indicFold('న్').output).toBe('ం');
		expect(indicFold('ನ್').output).toBe('ಂ');
	});

	it('leaves English text byte-identical', () => {
		expect(baseFold('classic assessment').output).toBe('classic assessment');
	});
});
