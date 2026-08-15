/**
 * Tamil false-positive acceptance suite — the ta.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. Romanized Tamil collides with ordinary
 * English, with Indian proper nouns and place names, and (worst of all) with
 * other Tamil words; a filter that censors people's names is worse than one
 * that misses a word.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers may load only `data/ta`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const taOnly = createMatcher({ packs: [tamil] });
const allPacks = createMatcher({ packs: [tamil, hindi, english] });

const cleanTexts: string[] = [
	// Tamil words that a prefix entry would otherwise swallow.
	'குதிரை ஓடுகிறது', // "the horse runs" — starts with the kuthi prefix
	'kuthirai race in Chennai',
	'kudhirai vandi',
	'கூதிர் காலம் வந்தது', // கூதிர் = the cold season (classical Tamil)
	'therukoothu is a folk theatre form',
	'we watched a koothu performance',
	'புண்டரீகம் means lotus', // starts with the puṇṭa prefix
	'Pundalik was a devotee of Vithoba',
	'சுத்து பார்க்கலாம்', // சுத்து "to roam" — why 'suthu' is not a romanization
	'சூது ஆடாதே', // சூது "gambling" — the degemination trap
	'தோடி ராகம்', // the raga Todi
	'மணம் மற்றும் மனம்', // ண is contrastive and must not fold onto ன
	'வலி வளி வழி', // the three la's are contrastive
	'மரம் மறம்', // the two ra's are contrastive

	// Proper nouns and place names.
	'Mayiladuthurai district',
	'Pallavaram is near Chennai',
	'Ottapidaram taluk',
	'Thevaram hymns are sung at the temple',
	'Panchami thithi',
	'Thottiyam in Trichy district',
	'Sani Peyarchi predictions',

	// Community names and neutral usage of caste vocabulary.
	'Paraiyar community leaders met',
	'the parai is a traditional drum',
	'parai attam performance',
	'the word pariah comes from Tamil',
	'Pallar and Devendrakula Vellalar',

	// The land classification, and the protest song named after it.
	'poramboke land records',
	'Chennai Poramboke Paadal',

	// Religion: the sexual entry must never touch the sect.
	'He is a Sunni Muslim',
	'சுன்னி முஸ்லிம் சமூகம்',

	// Ordinary English that reaches a Tamil key by spelling or skeleton.
	'the soothsayer spoke',
	'a soothing melody',
	'a stern warning',
	'just talkin about it',
	'Jesse Pinkman',
	'soothiram means formula',

	// Ordinary Tamil prose.
	'இது ஒரு நல்ல நாள்',
	'தமிழ்நாடு தலைநகரம் சென்னை',
	'எனக்கு தமிழ் தெரியும்',
	'அவர் ஒரு நல்ல மனிதர்',
];

describe('tamil scunthorpe suite: legitimate text is clean (ta pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = taOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(taOnly.censor(text)).toBe(text);
	});
});

describe('tamil scunthorpe suite: still clean alongside the hi + en packs', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the ta pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts, re-run with Tamil loaded.
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
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});

	it('still flags the Hindi and English cases it always flagged', () => {
		expect(allPacks.isClean('chutiya')).toBe(false);
		expect(allPacks.isClean('bh0sdike')).toBe(false);
		expect(allPacks.isClean('fuuuuck')).toBe(false);
		expect(allPacks.isClean('बहनचोद')).toBe(false);
	});
});
