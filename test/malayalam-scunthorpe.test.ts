/**
 * Malayalam false-positive acceptance suite — everything here must be CLEAN.
 *
 * Malayalam romanization collides with more than the other three Dravidian
 * packs do, because Manglish drops the ണ/ന and റ/ര distinctions that carry
 * the meaning: "panni" is both പണ്ണി and പന്നി, "parayan" is both പറയൻ and
 * പറയാൻ, and every Kunna- toponym in Kerala opens like കുണ്ണ. Those are the
 * cases this suite exists for.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { malayalam } from '../src/data/ml.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const mlOnly = createMatcher({ packs: [malayalam] });
const allPacks = createMatcher({ packs: [malayalam, hindi, english] });

const cleanTexts: string[] = [
	// The minimal pairs that decided which lemmas ship native-script-only.
	'panni is Malayalam for pig',
	'പന്നി കാട്ടിലുണ്ട്', // "there is a pig in the forest"
	'പണി തീർന്നു', // പണി "work" — what a degemination fold would have created
	'avan parayan thudangi', // പറയാൻ "to say"
	'enthu parayan und',

	// Kerala place names built on കുന്ന് "hill", the open trap set.
	'Kunnamkulam municipality',
	'Kunnathunad taluk',
	'Kunnathur in Kollam district',
	'Kunnamthanam panchayat',
	'the kunnu behind the house',

	// The പൂറ് prefix's closed trap set.
	'Thrissur Pooram festival',
	'pooram is celebrated in April',
	'pooruruttathi nakshatram',
	'pooradam natchathiram',
	'Poornima Sharma spoke',
	'poori masala for breakfast',
	'a poor decision',
	'the pool is closed for repairs',

	// Community names and history. Neutral usage is never censored.
	'Pulaya community welfare board',
	'the Pulayar of central Kerala',
	'Pulayanarkotta in Thiruvananthapuram',
	'Cheraman Perumal legend',
	'the Cheraman Juma Masjid at Kodungallur',
	'Cheruma and Pulaya histories',
	'devadasi tradition',
	'Dalit writing in Malayalam',

	// Names and ordinary words that reach a Malayalam key.
	'Kundan jewellery set',
	'thendral breeze',
	'Thendral is a common name',
	'kashuvandi is the cashew',
	'vedi kettu at the temple', // വെടി "firecracker"

	// Ordinary Malayalam prose, old and new orthography.
	'ഇത് ഒരു നല്ല ദിവസം',
	'മലയാളം പഠിക്കുന്നു',
	'കേരളത്തിന്റെ തലസ്ഥാനം തിരുവനന്തപുരം',
	'എന്റെ പേര് രാജു',
	'എൻറെ പേര് രാജു', // the same sentence, pre-reform
	'ചന്ദ്രൻ ഉദിച്ചു',
	'അവൻ ഒരു നല്ല മനുഷ്യൻ',
	'അവന്‍ വന്നു', // ZWJ chillu, the older encoding

	// Separated-letter traps. Runs of standalone letters are joined and
	// matched whole, so South Indian dotted initials and recited alphabets
	// are the shapes that would break a careless implementation.
	'A. P. J. Abdul Kalam',
	'E. M. S. Namboodiripad led it',
	'K. S. E. B. office is closed',
	'M. G. R. and N. T. R.',
	'അ ആ ഇ ഈ ഉ ഊ',
	'ക ഖ ഗ ഘ ങ',
	'p a n n i',
	'k u n n u',
	'p o o r a m',
	'm a l a y a l a m',
];

describe('malayalam scunthorpe suite: legitimate text is clean (ml pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = mlOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(mlOnly.censor(text)).toBe(text);
	});
});

describe('malayalam scunthorpe suite: still clean alongside the hi + en packs', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the ml pack does not disturb the existing packs', () => {
	const everything = createMatcher({
		packs: [malayalam, kannada, telugu, tamil, hindi, english],
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
		'Mayiladuthurai district',
		'dengue fever cases',
		'tulu nadu heritage',
		'ಬೋಳಿಸಿದ ತಲೆ',
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(everything.isClean(text)).toBe(true);
	});

	it('still flags every pack it is loaded with', () => {
		expect(everything.isClean('chutiya')).toBe(false);
		expect(everything.isClean('fuuuuck')).toBe(false);
		expect(everything.isClean('बहनचोद')).toBe(false);
		expect(everything.isClean('pundai')).toBe(false);
		expect(everything.isClean('lanja')).toBe(false);
		expect(everything.isClean('tullu')).toBe(false);
		expect(everything.isClean('pooru')).toBe(false);
	});
});
