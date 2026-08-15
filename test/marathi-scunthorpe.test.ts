/**
 * Marathi false-positive acceptance suite — the mr.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. Marathi's traps are mostly *in Marathi*:
 * गांडूळ "earthworm" opens with गांडू, कुत्रा "dog" is neutral where कुत्र्या
 * is abuse, and मंग्या is one of the commonest nicknames in Maharashtra while
 * मांग्या is a caste slur.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers may load only `data/mr`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { marathi } from '../src/data/mr.js';
import { bengali } from '../src/data/bn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const mrOnly = createMatcher({ packs: [marathi] });
const allPacks = createMatcher({ packs: [marathi, bengali, hindi, english] });

const cleanTexts: string[] = [
	// The Marathi words that share an opening with a pack entry.
	'गांडूळ खत तयार आहे', // vermicompost — the everyday agriculture term
	'gandul khat vapara',
	'गांडूळ शेतीसाठी चांगले',
	'कुत्रा भुंकतो आहे', // the neutral noun; only कुत्र्या is abuse
	'कुत्री आणि पिल्लं',
	'लवकर या घरी', // "come soon"
	'भाड्याने घर मिळेल का', // "house on rent"
	'भाडोत्री करार',
	'झाड लावा झाड जगवा',
	'हळद कुंकू समारंभ',
	'हलक्या आवाजात बोल', // हलक्या "light", not हलकट
	// Names and community names: the caste entries must never touch these.
	'मंग्या कुठे आहे', // the nickname for Mangesh — why मांग्या is native-only
	'मंगेश देशमुख आले',
	'Mangya is my friend',
	'mangya come here',
	'मांग समाजाची बैठक',
	'मातंग समाज मेळावा',
	'महार समाजाचा इतिहास',
	'महाराष्ट्र राज्य स्थापना दिन',
	'Mahar Regiment parade',
	'the Mahar community in Maharashtra',
	'चांभार समाजाची सभा',
	'chambhar community meeting',
	'Matang and Mahar samaj',
	// Ordinary Marathi prose.
	'माझं नाव राहुल आहे',
	'मी मराठी बोलतो',
	'पुणे शहर खूप छान आहे',
	'आज सकाळी पाऊस पडला',
	'तुम्ही कसे आहात',
	'काळ आणि काल वेगळे आहेत', // ळ is contrastive and must not fold onto ल
	'ॲड. सुनील पाटील',
	'कऱ्हाड तालुका', // eyelash reph in an innocent place name
	'सुऱ्या नदीच्या काठी',
	// English words whose skeletons reach a Marathi key (all measured).
	'chamber of commerce meeting', // "kmbr" == chambharya
	'a hellcat of a car', // "hlkt" == halkat
	'helictite formations in the cave',
	'reindict the defendant', // "rndk" == randechya
	'a catamaran race today', // "ktmr" == chutmarya
	'the kitemark certification',
	'a rondache shield',
	// The hi-side allowlist has to work with data/mr alone.
	'Mahatma Gandhi',
	'Uganda is in Africa',
	'Gandalf the Grey',
];

describe('marathi scunthorpe suite: legitimate text is clean (mr pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = mrOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(mrOnly.censor(text)).toBe(text);
	});
});

describe('marathi scunthorpe suite: still clean alongside hi + en + bn', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('the Marathi-specific boundary traps, stated as pairs', () => {
	it('separates गांडूळ "earthworm" from गांडू', () => {
		expect(mrOnly.isClean('गांडूळ')).toBe(true);
		expect(mrOnly.isClean('गांडूळ खत')).toBe(true);
		expect(mrOnly.isClean('गांड्या')).toBe(false);
	});

	it('separates कुत्रा "dog" from the vocative कुत्र्या', () => {
		expect(mrOnly.isClean('कुत्रा')).toBe(true);
		expect(mrOnly.isClean('कुत्र्या')).toBe(false);
	});

	it('separates मंग्या (Mangesh) from the caste slur मांग्या', () => {
		expect(mrOnly.isClean('मंग्या')).toBe(true);
		expect(mrOnly.isClean('मांग्या')).toBe(false);
		// ...and the Latin spelling, which cannot tell them apart, matches
		// neither — that is why the lemma is native-script-only.
		expect(mrOnly.isClean('mangya')).toBe(true);
	});

	it('separates the community names from the abusive vocatives', () => {
		for (const [neutral, abusive] of [
			['महार', 'महाऱ्या'],
			['मांग', 'मांग्या'],
			['चांभार', 'चांभाऱ्या'],
		]) {
			expect(mrOnly.isClean(neutral!), neutral).toBe(true);
			expect(mrOnly.isClean(abusive!), abusive).toBe(false);
		}
	});
});

describe('adding the mr pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts, re-run with Marathi loaded.
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
