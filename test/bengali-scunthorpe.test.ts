/**
 * Bengali false-positive acceptance suite — the bn.ts counterpart of
 * test/scunthorpe.test.ts.
 *
 * Everything here must be CLEAN. Romanized Bengali collides with ordinary
 * English, with other Bengali words, and with religious vocabulary; a filter
 * that censors "the Magi" or "Catholic" is worse than one that misses a word.
 *
 * The pack is exercised BOTH on its own and alongside hi + en, because the
 * per-language subpath export means consumers may load only `data/bn`.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { bengali } from '../src/data/bn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { marathi } from '../src/data/mr.js';

const bnOnly = createMatcher({ packs: [bengali] });
const allPacks = createMatcher({ packs: [bengali, marathi, hindi, english] });

const cleanTexts: string[] = [
	// Bengali words one fold step from a pack entry.
	'গুদাম ঘর ভরা', // "warehouse" — shares the গুদ opening
	'গুড় দিয়ে চা', // "jaggery" — why গুদ has no romanization
	'ধন সম্পদ বেড়েছে', // ধন "wealth" — why ধোন has no romanization
	'ধন্যবাদ আপনাকে',
	'বাড়ি যাব এখন', // "house"
	'বাড়া ভাত', // বাড়া "to increase" — the dropped homograph
	'পড়া শেষ করো', // the nukta fold must not reach this
	'বড় ভালো ছেলে',
	'ভাড়া কত হবে',
	// The শ/ষ/স set, deliberately not folded.
	'সাল ২০২৪ শুরু', // "year"
	'শাল গাছের ছায়া', // "sal tree"
	'ষাঁড়ের দৌড়', // "bull"
	'শালিক পাখি',
	// The nasal and chandrabindu folds must not over-reach.
	'চাঁদ উঠেছে আকাশে', // "moon" — one fold step from চাঁড়াল
	'শান্তি নিকেতন',
	'আনন্দ বাজার পত্রিকা',
	'বাংলা ভাষা আমার',
	'শঙ্কা করার কিছু নেই',
	'দুঃখ পেয়েছি খুব',
	// Khanda ta, added with this pack.
	'হঠাৎ বৃষ্টি এলো',
	'উৎসব শুরু হয়েছে',
	'মৎস্য বিভাগ',
	// ya-phala and ba-phala, deliberately not folded.
	'সত্য কথা বলো',
	'বিশ্ব শান্তি দিবস',
	'স্বামী বিবেকানন্দ',
	'ব্যাপারটা কী',
	// Ordinary Bengali prose.
	'আমি ভালো আছি',
	'তুমি কেমন আছো',
	'কলকাতা শহর খুব সুন্দর',
	'ঢাকা বাংলাদেশের রাজধানী',
	'আজ আমার জন্মদিন',
	'বাল ঠাকরে মহারাষ্ট্রের নেতা ছিলেন', // the name, in Bengali script
	// English words whose skeletons reach a Bengali key (all measured).
	'a banquet hall booking', // skeleton "bnkt" == banchot
	'we shall conquer this', // "knkr" == khankir
	'a catamaran race today', // "ktmrn" == chutmarani
	'light a candle please', // "kndl" == chandal
	'my kundli says otherwise',
	'the Catholic church', // "ktlk" == chotolok
	'a catlike movement',
	'a cedarbird in the tree', // "kdrb" == chudirbhai
	'quadrable functions',
	'a hellcat of a car',
	// Religious and proper-noun traps.
	'the Magi brought gifts', // মাগী ships without the `magi` romanization
	'the gift of the Magi',
	'Maggi noodles for dinner',
	'chandal yog in astrology',
	'the pathshala opened today',
	'Shalimar Bagh in Delhi',
	'Sonar Bangla',
	'nashta is ready', // নাস্তা "breakfast" — why নষ্টা was dropped
	'a chinar tree in Kashmir',
	'the Chinali people of Himachal', // a community name, not the slur
	'gud morning bro', // SMS-English — why গুদ has no romanization
	'Dhoni scored a century',
	'Vodafone Idea results', // why 'voda' is not a romanization
	'a mother lode of data',
];

describe('bengali scunthorpe suite: legitimate text is clean (bn pack alone)', () => {
	it.each(cleanTexts)('scan(%j) reports no matches', (text) => {
		const result = bnOnly.scan(text);
		expect(result.matches).toEqual([]);
		expect(result.maxSeverity).toBeNull();
	});

	it.each(cleanTexts)('censor(%j) leaves the text untouched', (text) => {
		expect(bnOnly.censor(text)).toBe(text);
	});
});

describe('bengali scunthorpe suite: still clean alongside hi + en + mr', () => {
	it.each(cleanTexts)('isClean(%j) is true', (text) => {
		expect(allPacks.isClean(text)).toBe(true);
	});
});

describe('word boundaries hold for the native-script-only lemmas', () => {
	it('does not match গুদ inside গুদাম', () => {
		expect(bnOnly.isClean('গুদাম')).toBe(true);
		expect(bnOnly.isClean('গুদামে রাখো')).toBe(true);
		expect(bnOnly.isClean('গুদ')).toBe(false);
	});

	it('does not match ধোন as ধন', () => {
		expect(bnOnly.isClean('ধন')).toBe(true);
		expect(bnOnly.isClean('ধোন')).toBe(false);
	});

	it('does not match বাল inside বালক', () => {
		expect(bnOnly.isClean('বালক')).toBe(true);
		expect(bnOnly.isClean('বাল')).toBe(false);
	});
});

describe('adding the bn pack does not disturb the existing packs', () => {
	// Every case from test/scunthorpe.test.ts, re-run with Bengali loaded.
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
