/**
 * Punjabi false-positive acceptance suite — the pa.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. The three collision classes that actually
 * bite Punjabi are Sikh/Punjabi community names (Jatt, Ravidassia, Mazhabi,
 * the Bhangi Misl), the minimal pairs the addak protects (ਪਤਾ / ਪੱਤਾ), and
 * ordinary English reached through the skeleton keys the pack switched off.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers really do load only `data/pa`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';
import { tamil } from '../src/data/ta.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const paOnly = createMatcher({ packs: [punjabi] });
const allPacks = createMatcher({ packs: [punjabi, gujarati, tamil, hindi, english] });

const cleanTexts: string[] = [
	// The minimal pairs the addak protects. A degemination fold in the
	// normalizer would have collapsed every one of these.
	'ਮੈਨੂੰ ਪਤਾ ਹੈ', // "I know" — ਪਤਾ, not ਪੱਤਾ
	'ਦਰੱਖਤ ਦਾ ਪੱਤਾ',
	'ਦਸ ਬੰਦੇ ਆਏ', // ਦਸ "ten"
	'ਮੈਨੂੰ ਦੱਸ', // ਦੱਸ "tell me"
	'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', // the greeting
	'ਸੱਤ ਦਿਨ',

	// Subjoined letters and other real orthography.
	'ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹ ਰਿਹਾ ਹਾਂ', // ਪੜ੍ਹ, virama + ਹ
	'ਸ਼ੇਰ ਜੰਗਲ ਵਿੱਚ ਹੈ', // ਸ਼ with nukta
	'ਸ਼ਹਿਰ ਵਿੱਚ ਬਹੁਤ ਭੀੜ ਹੈ',
	'ਜ਼ਰੂਰੀ ਕੰਮ ਹੈ',
	'ਜਰੂਰੀ ਕੰਮ ਹੈ', // …and the nukta-less spelling of the same word

	// Community names and caste vocabulary used neutrally.
	'Jatt Sikh farmers protested',
	'ਜੱਟ ਕਿਸਾਨ',
	'the Ravidassia community',
	'Ramdasia and Ramgarhia Sikhs',
	'Mazhabi Sikh regiment history',
	'Balmiki samaj meeting',
	'The Bhangi Misl ruled Amritsar',
	'the Chamar Regiment was raised in 1943',
	'Ad Dharmi movement in Punjab',

	// Punjabi place names and proper nouns.
	'Chuhar Chak is in Moga district',
	'Chuhar Singh was there',

	// Ordinary English that a Punjabi key reaches.
	'The committee banked the funds',
	'we bunked the lecture',
	'a magician can conjure anything',
	'the conjurer took a bow',
	'they punched the clock',
	'she panicked briefly',
	'the crowd funked out',
	'a Sally Lunn bun with jam',

	// Traps that arrived with the Latin spellings borrowed from hi. Each
	// of these is clean in hi because of an allowlist phrase; the pa pack
	// copied those phrases, and this suite runs pa ALONE.
	'Mahatma Gandhi visited Amritsar',
	'the Gandhi family',
	'Uganda and Kenya',
	'Gandalf the Grey',
	'propaganda posters',
	'chutney recipe please',
	'chutki bajate hi',
	'Lund University in Sweden',
	'a bearish harami candlestick formed',
	'bullish harami on the daily',
	'the kutti story was long',
	'The presidential motorcade passed',
	'a matricide case',
	'this happened in 500 BC',

	// The separated (spelled-out) tier, which now has short pa patterns
	// like gand / chut / lund to reach for.
	'l u n d university',
	'g a n d h i was born in Porbandar',
	'the F.B.I. and the C.I.A. agreed',
	'R.S.V.P. by Friday, e.g. today',
	'T-shirt, e-mail, x-ray, co-op',
	'it is spelled c a t s',
	'q w e r t y',
	'ੳ ਅ ੲ ਸ ਹ',

	// Ordinary Punjabi prose.
	'ਇਹ ਇੱਕ ਚੰਗਾ ਦਿਨ ਹੈ',
	'ਪੰਜਾਬ ਦੀ ਰਾਜਧਾਨੀ ਚੰਡੀਗੜ੍ਹ ਹੈ',
	'ਮੈਨੂੰ ਪੰਜਾਬੀ ਆਉਂਦੀ ਹੈ',
	'ਉਹ ਇੱਕ ਚੰਗਾ ਇਨਸਾਨ ਹੈ',
	'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ',
];

describe('punjabi scunthorpe suite: legitimate text is clean (pa pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = paOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(paOnly.censor(text)).toBe(text);
	});
});

describe('punjabi scunthorpe suite: still clean alongside every other pack', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('adding the pa pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts and the Tamil suite, re-run with
	// Punjabi and Gujarati loaded. The regression risk of a new pack is never
	// its own language.
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
		'baat pakki ho gayi',
		'woh naukri chhod raha hai',
		'mere launde aa gaye',
		'hair salon booking',
		'kuthirai race in Chennai',
		'Pundalik was a devotee of Vithoba',
		'Paraiyar community leaders met',
		'poramboke land records',
		'Mayiladuthurai district',
		'just talkin about it',
		'a soothing melody',
	];
	it.each(existing)('isClean(%j) is still true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});

	it('still flags everything it always flagged', () => {
		expect(allPacks.isClean('chutiya')).toBe(false);
		expect(allPacks.isClean('bh0sdike')).toBe(false);
		expect(allPacks.isClean('fuuuuck')).toBe(false);
		expect(allPacks.isClean('बहनचोद')).toBe(false);
		expect(allPacks.isClean('pundai')).toBe(false);
		expect(allPacks.isClean('paraiyan')).toBe(false);
	});
});
