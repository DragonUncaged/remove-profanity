/**
 * Bengali evasion-resistance suite — the bn.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { bengali } from '../src/data/bn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [bengali, hindi, english] });
const bnOnly: Matcher = createMatcher({ packs: [bengali] });

const ZWJ = '‍';
const ZWNJ = '‌';
const HOSONTO = '্';

/** Scan, assert the text is flagged, and check span/surface coherence. */
function flagged(text: string, m: Matcher = matcher): ScanResult {
	const result = m.scan(text);
	expect(result.matches.length, `expected a match in ${JSON.stringify(text)}`).toBeGreaterThan(0);
	for (const hit of result.matches) {
		expect(text.slice(hit.start, hit.end)).toBe(hit.surface);
		expect(hit.start).toBeGreaterThanOrEqual(0);
		expect(hit.end).toBeLessThanOrEqual(text.length);
		expect(hit.language).toBeTruthy();
	}
	return result;
}

describe('bengali native script', () => {
	const cases: [label: string, text: string][] = [
		['plain', 'বাঞ্চোত'],
		['bare-ন spelling of the same word', 'বানচোত'],
		['in a sentence', 'তুই একটা খানকি'],
		['ঙ্ক spelling of খানকি', 'খাঙ্কি'],
		['compound', 'বোকাচোদা কোথাকার'],
		['caste slur', 'চাঁড়াল'],
		['caste slur, ণ্ড spelling', 'চণ্ডাল'],
		['religious slur', 'মালাউনের দল'],
		['native-script-only lemma', 'গুদ'],
		['native-script-only lemma 2', 'ধোন'],
		['native-script-only lemma 3', 'বাল'],
		['nasalised and unnasalised', 'পোঁদ'],
		['unnasalised', 'পোদ'],
		['ya-phala word', 'বেশ্যা'],
		['nukta word', 'ল্যাওড়া'],
		['phrase', 'শুয়োরের বাচ্চা'],
		['inherent-vowel verb', 'চুদাচুদি'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});

	it('flags every native case with the bn pack loaded alone', () => {
		for (const [, text] of cases) flagged(text, bnOnly);
	});
});

describe('bengali script-level evasion', () => {
	it('is not fooled by ZWJ injection', () => {
		flagged(`খান${ZWJ}কি`);
		flagged(`বা${ZWJ}ঞ্চোত`);
	});

	it('is not fooled by ZWNJ injection after a hosonto', () => {
		flagged(`বাঞ${HOSONTO}${ZWNJ}চোত`);
	});

	it('is not fooled by a doubled hosonto', () => {
		flagged(`বাঞ${HOSONTO}${HOSONTO}চোত`);
	});

	it('is not fooled by a stray visarga', () => {
		flagged('খানকিঃ');
	});

	it('flags the nukta and non-nukta spellings identically', () => {
		const withNukta = matcher.scan('ল্যাওড়া');
		const without = matcher.scan('ল্যাওডা');
		expect(withNukta.matches[0]!.lemma).toBe(without.matches[0]!.lemma);
	});

	it('flags the chandrabindu and nasal+hosonto spellings identically', () => {
		// বেজন্মা ≡ বেজম্মা comes free from the script table.
		const a = matcher.scan('বেজন্মা');
		const b = matcher.scan('বেজম্মা');
		expect(a.matches[0]!.lemma).toBe(b.matches[0]!.lemma);
	});
});

describe('bengali romanization spread (Kolkata and Dhaka conventions)', () => {
	const spread: [label: string, texts: string[]][] = [
		['banchot family', ['banchot', 'banchod', 'baanchod', 'bancot', 'banchut']],
		['choda family', ['choda', 'chuda', 'chodano', 'chudano', 'chodachudi']],
		['magi family', ['maagi', 'magee', 'magir']],
		['khanki family', ['khanki', 'khankir', 'khankir pola', 'khankir put']],
		['shuor family', ['shuor', 'shuyor', 'suor', 'shukor']],
		['bokachoda family', ['bokachoda', 'bokachod', 'bokachuda']],
		['lyaora family', ['lyaora', 'lyaoda', 'lyawra', 'leaora']],
		['beshya family', ['beshya', 'beshsha', 'besshya', 'besya']],
	];
	for (const [label, texts] of spread) {
		it(`covers the ${label}`, () => {
			for (const t of texts) flagged(t, bnOnly);
		});
	}

	it('reports one lemma for the whole spread of a word', () => {
		const lemmas = new Set(
			['banchot', 'banchod', 'baanchod', 'bancot'].map(
				(t) => bnOnly.scan(t).matches[0]!.lemma,
			),
		);
		expect(lemmas.size).toBe(1);
	});
});

describe('bengali romanized evasion', () => {
	it('folds leetspeak', () => {
		flagged('kh4nki');
		flagged('b0kachoda');
		flagged('ch0da');
	});

	it('collapses letter stretching', () => {
		flagged('khaaaanki');
		flagged('bokachoodaaaa');
	});

	it('resolves masked tokens', () => {
		flagged('kh*nki');
		flagged('bokach*da');
	});

	it('folds fullwidth and mathematical-bold lookalikes', () => {
		flagged('ｋｈａｎｋｉ');
		flagged('𝐤𝐡𝐚𝐧𝐤𝐢');
	});

	it('is case-insensitive', () => {
		flagged('KHANKI');
		flagged('BokaChoda');
	});

	it('flags inside a sentence and censors only the word', () => {
		const text = 'tui ekta khanki';
		const censored = matcher.censor(text);
		expect(censored).toBe('tui ekta ******');
		expect(censored).toHaveLength(text.length);
	});
});

describe('bengali metadata surfaces correctly', () => {
	it('reports severity, categories and language on a caste slur', () => {
		const m = flagged('চাঁড়াল').matches[0]!;
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('casteist');
		expect(m.language).toBe('bn');
	});

	it('reports the religious category on মালাউন', () => {
		const m = flagged('malaun').matches[0]!;
		expect(m.severity).toBe(4);
		expect(m.categories).toContain('religious');
	});

	it('flags casualUse on শালা and শুয়োর', () => {
		expect(flagged('শালা', bnOnly).matches[0]!.casualUse).toBe(true);
		expect(flagged('shuor', bnOnly).matches[0]!.casualUse).toBe(true);
	});

	it('censors native script grapheme-cluster-safely', () => {
		const censored = bnOnly.censor('খানকি');
		expect(censored).toMatch(/^\*+$/);
		expect(/\p{M}/u.test(censored)).toBe(false);
	});
});

describe('bengali and the separated-letter tier', () => {
	// The tier joins a maximal run of standalone letters and requires the run
	// to equal a dictionary surface OUTRIGHT. Bengali is largely immune by
	// construction — its lemmas carry matras, which are \p{M} and break a run —
	// but the ROMANIZATIONS are ordinary Latin and are fully exposed.
	it.each([
		['spaces', 'k h a n k i'],
		['dots', 'c.h.o.d.a'],
		['hyphens', 'b-a-n-c-h-o-t'],
		['underscores', 'm a l a u n'],
		['leading article dropped', 'you are a c h i n a l'],
	])('flags spelled-out %s: %j', (_label, text) => {
		const result = matcher.scan(text);
		expect(result.matches.length, `expected ${text} to flag`).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('does not sweep up ordinary spelled-out or dotted text', () => {
		for (const text of [
			'the letters are b a n g l a',      // "bangla" is not in the pack
			'spell it s h a l i k',             // শালিক, the bird
			'c h a n d spelled out',            // "chand" — the moon, not a lemma
			'g u d a m is a warehouse',         // গুদাম, not গুদ
			'K.O.L.K.A.T.A. is home',
			'B.N. Roy signed it',
			'the b a s a r ghar',
			'p.o.d. cast recording',            // "pod" is not a bn romanization
			'M.A.G.I. conference',              // `magi` is not a bn romanization
			'D.H.O.N.I. batting stats',
		]) {
			expect(matcher.isClean(text), text).toBe(true);
		}
	});

	it('cannot join native-script letters across a matra', () => {
		// খ া ন ক ি — the vowel signs are combining marks, not letters, so the
		// run never forms. Stated as a test because the tier's shape lock is
		// the only thing standing between this and a false-positive machine.
		expect(matcher.isClean('খ া ন ক ি')).toBe(true);
		expect(matcher.isClean('ব া ল')).toBe(true);
	});
});

describe('bengali does not break the existing packs', () => {
	it('still flags the Hindi, English and abbreviation cases', () => {
		for (const text of ['chutiya', 'bh0sdike', 'fuuuuck', 'बहनचोद', 'abe bsdk']) {
			expect(matcher.isClean(text), text).toBe(false);
		}
	});
});
