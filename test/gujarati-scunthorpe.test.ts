/**
 * Gujarati false-positive acceptance suite — the gu.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. The collisions that actually bite Gujarati
 * are community names (Vankar, Meghwal, Devipujak, Valmiki Samaj), ordinary
 * Gujarati words one keystroke from a lemma (ગાંડું "crazy" vs ગાંડૂ), and the
 * English words the skeleton keys reach (hellcat, Rockdale).
 *
 * The pack is exercised BOTH on its own and alongside the others, because the
 * per-language subpath export means consumers really do load only `data/gu`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { gujarati } from '../src/data/gu.js';
import { punjabi } from '../src/data/pa.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const guOnly = createMatcher({ packs: [gujarati] });
const allPacks = createMatcher({ packs: [gujarati, punjabi, tamil, hindi, english] });

const cleanTexts: string[] = [
	// Ordinary Gujarati one keystroke from a lemma.
	'એ સાવ ગાંડું છે', // ગાંડું "crazy" — why ગાંડુ is not a listed variant
	'ગાંડો માણસ', // and the masculine
	'આ કુટીર ઉદ્યોગ છે', // કુટીર "cottage" vs કૂતરી
	'લવાદ નિમાયો', // લવાદ "arbitrator"
	'રાંદલ માતાનો મંડપ', // the folk goddess — ંદ, not ંડ
	'હલકું વજન', // હલકું "light" vs હલકટ

	// Orthography the folds must not damage.
	'મને દુઃખ થયું', // visarga
	'અન્ત અને અંત એક જ છે', // the conjunct/anusvara pair
	'મેં કૉલ કર્યો', // ઑ/ઍ loan vowels are contrastive
	'આ કોલસો છે',
	'બાળક શાળામાં ગયું', // ળ is ordinary; it is not merged into લ

	// Community names and caste vocabulary used neutrally.
	'the Vankar community of Gujarat',
	'Meghwal weavers',
	'Meghwar artisans',
	'Devipujak samaj',
	'Valmiki samaj gathering',
	'Balmiki samaj gathering',
	'the Chamar Regiment was raised in 1943',
	'Rohit community leaders met',
	'Vaghri samaj sammelan',

	// Ordinary English a Gujarati key reaches.
	'the Grumman Hellcat flew',
	'Dodge Challenger Hellcats',
	'Rockdale County, Georgia',
	'Halkett boat design',

	// Traps that arrived with the Latin spellings borrowed from hi. Clean
	// in hi thanks to an allowlist phrase; gu copied those phrases, and
	// this suite runs gu ALONE.
	'Mahatma Gandhi visited Porbandar',
	'Uganda and Kenya',
	'Gandalf the Grey',
	'propaganda posters',
	'chutney recipe please',
	'Lund University in Sweden',
	'a bearish harami candlestick formed',
	'The presidential motorcade passed',
	'this happened in 500 BC',

	// The separated (spelled-out) tier.
	'l u n d university',
	'g a n d h i was born in Porbandar',
	'the F.B.I. and the C.I.A. agreed',
	'R.S.V.P. by Friday, e.g. today',
	'T-shirt, e-mail, x-ray, co-op',
	'it is spelled c a t s',
	'q w e r t y',
	'ક ખ ગ ઘ ચ',
	'એ જ છે',

	// Ordinary Gujarati prose.
	'આજે સરસ દિવસ છે',
	'ગુજરાતની રાજધાની ગાંધીનગર છે',
	'મને ગુજરાતી આવડે છે',
	'એ સારો માણસ છે',
	'મહાત્મા ગાંધી પોરબંદરમાં જન્મ્યા',
];

describe('gujarati scunthorpe suite: legitimate text is clean (gu pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = guOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(guOnly.censor(text)).toBe(text);
	});
});

describe('gujarati scunthorpe suite: still clean alongside every other pack', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the gu pack does not disturb the existing packs', () => {
	const existing = [
		'Mahatma Gandhi',
		'chutney recipe',
		'Lund University is in Sweden',
		'He is a Sunni Muslim',
		'This happened in 500 BC',
		'classic assessment of grass',
		'Scunthorpe United',
		'मालिक आ गया',
		'हिन्दी सीखो',
		'propaganda',
		'baat pakki ho gayi',
		'woh naukri chhod raha hai',
		'hair salon booking',
		'kuthirai race in Chennai',
		'poramboke land records',
		'a soothing melody',
		'The committee banked the funds',
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});

	it('still flags everything it always flagged', () => {
		expect(allPacks.isClean('chutiya')).toBe(false);
		expect(allPacks.isClean('bh0sdike')).toBe(false);
		expect(allPacks.isClean('fuuuuck')).toBe(false);
		expect(allPacks.isClean('pundai')).toBe(false);
	});
});
