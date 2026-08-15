/**
 * Regression suite for the adversarial-review findings (2026-08-14).
 * Every case here was a CONFIRMED false positive, false negative, or span
 * bug reproduced against v0.1.0 before the fixes.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const matcher = createMatcher({ packs: [hindi, english] });

describe('false positives fixed: skeleton-tier English collisions', () => {
	it.each([
		'The committee banked the funds yesterday.',
		'He bunked class again today.',
		'She bonked her head on the shelf.',
		'The presidential motorcade passed through Delhi.',
		'The motorcades rolled past the embassy.',
		'Nimrod was a mighty hunter in the Bible.',
		'The BSI Kitemark certifies product safety.',
		'A matricide case was reported.',
	])('%s is clean', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});
});

describe('false positives fixed: collapsed-tier doubled letters', () => {
	it.each([
		'woh naukri chhod raha hai',
		'gaana chhod do ab',
		'50% ki chhut mil rahi hai',
		'baat pakki ho gayi',
		'usko pakki naukri mil gayi',
		'He was rapping on stage',
		'school ki chuttiya shuru ho gayi',
	])('%s is clean', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('still catches genuine letter stretching', () => {
		expect(matcher.isClean('fuuuuck')).toBe(false);
		expect(matcher.isClean('gaaandu')).toBe(false);
		expect(matcher.isClean('gaandu')).toBe(false); // curated romanization
		expect(matcher.isClean('chutiyaaaa')).toBe(false);
	});
});

describe('false positives fixed: multi-word skeleton keys removed', () => {
	it.each([
		'behen ki ladai ho gayi',
		'bahan ke ladke aaye hain',
		'teri maa ki kitaab mil gayi',
		'teri maa ki khatir ruk ja',
	])('%s is clean', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('the underlying phrases still match via exact romanizations', () => {
		expect(matcher.isClean('bhosdi ke')).toBe(false);
	});
});

describe('false positives fixed: whitespace is a token separator', () => {
	it.each([
		'The committee approved the ban\nKids celebrated outside.',
		'smoking ban\tkids protested',
	])('multi-line text does not merge into profanity', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});
});

describe('false positives fixed: bc/mc entries removed, data curation', () => {
	it.each([
		'Rome was founded in 753 BC.',
		'Vancouver, BC is beautiful in spring.',
		'BC Roy hospital is in Kolkata.',
		'Our MC tonight is Priya Sharma.',
		'MC Escher drew impossible staircases.',
		'police ki gashti badh gayi hai',
		'गश्ती दल ने इलाके का दौरा किया',
		'The Hijra marks the start of the Islamic calendar.',
		'Niki Lauda won three F1 championships.',
		'तलवार की मूठ सोने की थी',
		'The kitchen was spic and span.',
		'Kike Hernandez hit a home run.',
		'Coon Rapids is a city in Minnesota.',
		'He moved to Lund, Sweden last year.',
		'Poof! The rabbit disappeared.',
		'The Negro Leagues produced legendary players.',
		'Moby Dick is a classic novel.',
		'The willow tit is a declining songbird.',
		'Cumming, Georgia is north of Atlanta.',
		'She said (um, maybe) she would come.',
		'gawar ki phali ki sabzi banao',
		'bullish harami candlestick pattern dikha',
		'kutti story gaana viral hua',
	])('%s is clean', (text) => {
		expect(matcher.scan(text).matches).toEqual([]);
	});

	it('bsdk still flags after bc/mc removal', () => {
		expect(matcher.isClean('abe bsdk')).toBe(false);
	});
});

describe('false negatives fixed: trailing punctuation after leet', () => {
	it.each(['b!tch!', 'b!tch!!!', 'you b!tch!', 'chut1ya!'])(
		'%s flags',
		(text) => {
			expect(matcher.isClean(text)).toBe(false);
		},
	);
});

describe('span mapping fixed: trailing deleted text stays out of spans', () => {
	it('bahanchod!!! reports the word span only', () => {
		const m = matcher.scan('bahanchod!!!').matches[0]!;
		expect([m.start, m.end]).toEqual([0, 9]);
		expect(m.surface).toBe('bahanchod');
	});

	it('censoring bahanchod😀😀 leaves the emoji alone', () => {
		expect(matcher.censor('bahanchod😀😀')).toBe('*********😀😀');
	});
});

describe('API additions', () => {
	it('casualUse surfaces on matches', () => {
		const m = matcher.scan('abe saale').matches[0]!;
		expect(m.casualUse).toBe(true);
	});

	it('categories arrays are copies, not pack references', () => {
		const m = matcher.scan('chutiya').matches[0]!;
		m.categories.push('slur');
		expect(matcher.scan('chutiya').matches[0]!.categories).not.toContain('slur');
	});
});
