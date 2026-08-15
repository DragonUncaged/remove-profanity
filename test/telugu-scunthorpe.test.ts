/**
 * Telugu false-positive acceptance suite — everything here must be CLEAN.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers really do load one pack.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { telugu } from '../src/data/te.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';

const teOnly = createMatcher({ packs: [telugu] });
const allPacks = createMatcher({ packs: [telugu, hindi, english] });

const cleanTexts: string[] = [
	// The prefix traps. Both prefix entries in this pack open a real word.
	'dengue fever cases are rising',
	'the dengue virus spreads via mosquitoes',
	'a dengue outbreak in the district',
	'Lanja taluka is in Ratnagiri',
	'Lanja Maharashtra municipal council',

	// Telugu words the pack must not touch.
	'వచ్చి రండి', // రండి = "come (pl.)" — why the Hindi lemma is never romanized here
	'ఇది చండాలంగా ఉంది', // చండాలం = "awful", everyday Telugu
	'chandalam ga undi',
	'గాడిద బరువు మోసింది', // "the donkey carried the load"
	'ఆ కుక్క పరిగెత్తింది',
	'పంది బురదలో ఉంది',
	'దొంగ పారిపోయాడు',

	// Community names. Neutral usage is never censored.
	'Madiga Dandora movement',
	'the Madiga community met',
	'Mala Mahanadu conference',
	'MRPS leaders spoke',
	'Dalit students union',

	// Religion and proper nouns.
	'the sanyasi left the village',
	'Panchami thithi begins today',
	'panchamrutham prasadam',
	'He is a Sunni Muslim',

	// Ordinary English that lands near a Telugu key.
	'a modern art museum',
	'the model behaviour of students',
	'the pool table',
	'a poor decision',
	'the language of the region',
	'a landslide victory',
	'moddled? no — modelled',
	'peeny? no — the Peenya industrial area',

	// Ordinary Telugu prose.
	'ఇది ఒక మంచి రోజు',
	'తెలుగు నేర్చుకుంటున్నాను',
	'ఆంధ్రప్రదేశ్ రాజధాని అమరావతి',
	'అతను మంచి మనిషి',
	'వాళ్ళు ఇంటికి వెళ్ళారు',
	'చంద్రుడు ఉదయించాడు', // చంద్ర, the anusvara fold's most common victim if wrong
	'కన్నడ భాష',

	// Separated-letter traps. Runs of standalone letters are joined and
	// matched whole, so South Indian dotted initials and recited alphabets
	// are the shapes that would break a careless implementation.
	'the A. P. S. R. T. C. bus to Vijayawada',
	'P. V. N. R. was Prime Minister',
	'N. T. R. and A. N. R. acted together',
	'అ ఆ ఇ ఈ ఉ ఊ',
	'క ఖ గ ఘ ఙ',
	't e l u g u',
	'v e d h a v i',
];

describe('telugu scunthorpe suite: legitimate text is clean (te pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = teOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(teOnly.censor(text)).toBe(text);
	});
});

describe('telugu scunthorpe suite: still clean alongside the hi + en packs', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the te pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts, plus the Tamil suite's, re-run
	// with Telugu loaded. The regression risk of a new pack is never its own
	// language — it is the other ones.
	const withTamil = createMatcher({ packs: [telugu, tamil, hindi, english] });
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
		'Paraiyar community leaders met',
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(withTamil.isClean(text)).toBe(true);
	});

	it('still flags the Hindi, English and Tamil cases it always flagged', () => {
		expect(withTamil.isClean('chutiya')).toBe(false);
		expect(withTamil.isClean('bh0sdike')).toBe(false);
		expect(withTamil.isClean('fuuuuck')).toBe(false);
		expect(withTamil.isClean('बहनचोद')).toBe(false);
		expect(withTamil.isClean('pundai')).toBe(false);
		expect(withTamil.isClean('paraiyan')).toBe(false);
	});
});
