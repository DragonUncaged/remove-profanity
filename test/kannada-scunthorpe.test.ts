/**
 * Kannada false-positive acceptance suite — everything here must be CLEAN.
 *
 * Run both with the kn pack alone and alongside hi + en, because the
 * per-language subpath export means consumers really do load one pack.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { kannada } from '../src/data/kn.js';
import { telugu } from '../src/data/te.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const knOnly = createMatcher({ packs: [kannada] });
const allPacks = createMatcher({ packs: [kannada, hindi, english] });

const cleanTexts: string[] = [
	// Tulu: the language, the region, the people. One letter from ತುಲ್ಲು.
	'Tulu is a Dravidian language',
	'tulu nadu heritage festival',
	'Tuluva culture and Yakshagana',
	'the Tulu language has its own script',

	// ಬೋಳಿಸು "to shave" and its whole inflectional family.
	'ಬೋಳಿಸು',
	'ಅವನು ತಲೆ ಬೋಳಿಸಿದ',
	'ತಲೆ ಬೋಳಿಸಿಕೊಂಡ',
	'bolisu andre shave',

	// The romanizations this pack deliberately does not ship.
	'boli bhasha',
	'usne boli lagai',
	'Supriya Sule spoke in Parliament',
	'the tika ceremony',
	'Minda Industries results',
	'bajari roti with pitla',
	'Gudda came home late',
	'Baddi is in Himachal Pradesh',
	'Kundapura beach in Udupi',

	// Skeleton neighbours in ordinary English.
	'the beavers built a dam',
	'country roads take me home',
	'a countryside walk',

	// Community names. Neutral usage is never censored.
	'Holeya and Chalavadi communities',
	'Madiga welfare board',
	'Dalit literature in Kannada',

	// Ordinary Kannada prose, including the anusvara fold's usual victims.
	'ಇದು ಒಳ್ಳೆಯ ದಿನ',
	'ಕನ್ನಡ ಕಲಿಯುತ್ತಿದ್ದೇನೆ',
	'ಬೆಂಗಳೂರು ಕರ್ನಾಟಕದ ರಾಜಧಾನಿ',
	'ಚಂದ್ರ ಬೆಳಕು ಚೆಲ್ಲಿದೆ',
	'ಅವನು ಒಳ್ಳೆಯ ಮನುಷ್ಯ',
	'ನಾಯಿ ಬೊಗಳಿತು', // just "the dog barked"
	'ಕತ್ತೆ ಹೊರೆ ಹೊತ್ತಿತು', // just "the donkey carried a load"
	'ಹಂದಿ ಕೆಸರಿನಲ್ಲಿದೆ',
	'ಮಗ ಶಾಲೆಗೆ ಹೋದ', // "son" on its own is not abuse

	// Separated-letter traps. Runs of standalone letters are joined and
	// matched whole, so South Indian dotted initials and recited alphabets
	// are the shapes that would break a careless implementation.
	'B. M. T. C. bus number 500',
	'the K. S. R. T. C. depot',
	'B. R. Ambedkar wrote it',
	'ಅ ಆ ಇ ಈ ಉ ಊ',
	'ಕ ಖ ಗ ಘ ಙ',
	't u l u',
	'k a n n a d a',
];

describe('kannada scunthorpe suite: legitimate text is clean (kn pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = knOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(knOnly.censor(text)).toBe(text);
	});
});

describe('kannada scunthorpe suite: still clean alongside the hi + en packs', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the kn pack does not disturb the existing packs', () => {
	const everything = createMatcher({
		packs: [kannada, telugu, tamil, hindi, english],
	});
	const existing = [
		'Mahatma Gandhi',
		'chutney recipe',
		'chutki',
		'Lund University is in Sweden',
		'Bal Thackeray',
		'He is a Sunni Muslim',
		'This happened in 500 BC',
		'the MC of the event',
		'an item on the list',
		'classic assessment of grass',
		'Scunthorpe United',
		'paal means milk',
		'मालिक आ गया',
		'गूगल पर खोजें',
		'हिन्दी सीखो',
		'propaganda',
		'Dickens novels',
		'Middlesex',
		'kuthirai race in Chennai',
		'poramboke land records',
		'Pundalik was a devotee of Vithoba',
		'soothiram means formula',
		'dengue fever cases',
		'Lanja taluka is in Ratnagiri',
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(everything.isClean(text)).toBe(true);
	});

	it('still flags every other pack it is loaded with', () => {
		expect(everything.isClean('chutiya')).toBe(false);
		expect(everything.isClean('fuuuuck')).toBe(false);
		expect(everything.isClean('बहनचोद')).toBe(false);
		expect(everything.isClean('pundai')).toBe(false);
		expect(everything.isClean('lanja')).toBe(false);
		expect(everything.isClean('tullu')).toBe(false);
	});
});
