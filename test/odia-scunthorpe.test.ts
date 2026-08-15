/**
 * Odia false-positive acceptance suite — the or.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. Romanized Odia is short and vowel-poor, so
 * it collides with ordinary English, with Spanish/Italian, with Indian proper
 * nouns and — worst of all — with other Odia words that merely start the same
 * way. Several romanizations were dropped outright for that reason; the cases
 * below are the record of which, and of what the folds must not over-merge.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers may load only `data/or`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { odia } from '../src/data/or.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const orOnly = createMatcher({ packs: [odia] });
const allPacks = createMatcher({ packs: [odia, hindi, english] });

const cleanTexts: string[] = [
	// Odia words the prefix entry would otherwise swallow.
	'ଅର୍ଜୁନଙ୍କ ଗାଣ୍ଡିବ ଧନୁ', // Gāṇḍīva, Arjuna's bow
	'ଗାଣ୍ଡୀବ ଧନୁର କଥା',
	'ଗାଣ୍ଡିମୁଣ୍ଡ ବୁଝିଲି', // "beginning and end", an ordinary idiom

	// Odia words that merely START with, or sit next to, a listed word.
	'ବାଣ୍ଡି ଗାଡ଼ିରେ ଯାଉଛି', // ବାଣ୍ଡି "bullock cart"
	'ହାତରେ ବାଣ୍ଡେଜ ବାନ୍ଧିଲା', // "bandage"
	'ପୁଦିନା ଚଟଣି', // ପୁଦିନା "mint"
	'ବିଆଣ ଦିନ ପାଖେଇ ଆସିଲା', // ବିଆଣ "childbirth"
	'ବ୍ୟାଙ୍କ ବିଆଜ ହାର', // ବିଆଜ "interest"
	'ବିଆଳି ଧାନ କଟା ହେଲା', // ବିଆଳି, the autumn paddy
	'ଛିନ୍ନ ପତ୍ର', // ଛିନ୍ନ "severed" — not ଛିନାଳ
	'ଛିନ୍ନମସ୍ତା ମନ୍ଦିର',
	'ମାଘ ମାସର ଶୀତ', // ମାଘ, the month
	'ମାଘ ସପ୍ତମୀ ମେଳା',
	'ସେ ଭିକ ମାଗିବାକୁ ଗଲା', // ମାଗିବା "to beg" — why 'magi' is not a romanization
	'ମାଗି ଆଣିଲା',
	'ରଣ୍ଡା ସ୍ତ୍ରୀଲୋକ', // ରଣ୍ଡା "widow" — censoring bereavement would be worse
	'ଗାଣ୍ଡୁଆ ଝୁଡ଼ି', // ଗାଣ୍ଡୁଆ, a bamboo basket
	'ପେଲି ଦିଅ', // ପେଲିବା "to push"
	'ଦାନା ଦାନା ଚାଉଳ', // ଦାନା "grain"
	'ବେଶ୍ୟାବୃତ୍ତି ଏକ ସାମାଜିକ ସମସ୍ୟା', // the clinical register is not profanity

	// Ordinary Odia prose, including the words the folds must not merge.
	'ଓଡ଼ିଆ ଆମର ମାତୃଭାଷା',
	'ଓଡିଶାର ରାଜଧାନୀ ଭୁବନେଶ୍ୱର',
	'ମୋର ପ୍ରିୟ ବନ୍ଧୁ', // ୟ, the letter the nukta rule must not reach
	'ଭାରତୀୟ ସଂସ୍କୃତି',
	'ପିଲାଟି ହସୁଛି', // ହସ "laugh" — must not become ହଁସ "swan"
	'ହଁସ ପାଣିରେ ପହଁରୁଛି',
	'ଅଙ୍କ ପରୀକ୍ଷା ଭଲ ହେଲା',
	'ଏହା ସମ୍ଭବ ନୁହେଁ',
	'ତା ମନରେ ବହୁତ ଦୁଃଖ',
	'ଆଜି ପାଣିପାଗ ଭଲ ଅଛି',
	'ଜଗନ୍ନାଥ ମନ୍ଦିର ପୁରୀରେ ଅଛି',
	'ୱାର୍ଡ ନମ୍ବର ପାଞ୍ଚ', // ୱ, the letter deliberately not folded onto ବ

	// Latin-script proper nouns and other-language words.
	'Mahatma Gandhi',
	'Indira Gandhi memorial',
	'the Gandiva bow of Arjuna',
	'Banda Aceh in Indonesia',
	'sailing the Banda Sea',
	'Banda district of Uttar Pradesh',
	'la banda sonora',
	'Gandia is near Valencia',
	'magia nera',
	'the three Magi',
	'Maghi Purnima celebrations',
	'Magahi and Magadhi Prakrit',
	'pudina chutney recipe',
	'the Chinali people of Himachal',
	'chandala appears in the Manusmriti', // the academic spelling is not a pattern
	'gandi baat', // Hindi गंदी "dirty" — exactly why 'gandi' was dropped
	'she is feeling senti today',
	'dana is ready',

	// Spelled-out / separated text, against the separated tier.
	'the file is named p u d i c a t',
	'spell it g a n d h i',
	'O.D.I.A. is the language code',
	'ଓ ଡ଼ ି ଆ ଅକ୍ଷର',

	// Ordinary English that a short Odia key could reach.
	'a hinged door',
	'chocolate pudding',
	'apply a bandage',
	'the band played on',
	'panda in the veranda',
	'a hidden agenda',
	'bad head, bed head',
	'gehen means to go in German',
];

describe('odia scunthorpe suite: legitimate text is clean (or pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = orOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(orOnly.censor(text)).toBe(text);
	});
});

describe('odia scunthorpe suite: still clean alongside the hi + en packs', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('the word-mode / prefix-mode boundary holds', () => {
	it('leaves ବାଣ୍ଡ୍ "(musical) band" alone — the trailing halant is a boundary', () => {
		expect(orOnly.isClean('ବାଣ୍ଡ୍ ବାଜୁଛି')).toBe(true);
	});

	it('does not match a listed stem buried mid-token', () => {
		// Prefix mode relaxes the END boundary only; a stem in the middle of a
		// token must stay unmatched or prefix mode becomes substring search.
		expect(orOnly.isClean('ଅଗାଣ୍ଡିରେ')).toBe(true);
		expect(orOnly.isClean('xgaandi')).toBe(true);
	});
});

describe('adding the or pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts, re-run with Odia loaded.
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
