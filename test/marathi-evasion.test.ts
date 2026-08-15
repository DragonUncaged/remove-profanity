/**
 * Marathi evasion-resistance suite — the mr.ts counterpart of
 * test/evasion.test.ts. Everything here must be FLAGGED.
 *
 * Written against the public API only.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { marathi } from '../src/data/mr.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import type { Matcher, ScanResult } from '../src/types.js';

const matcher: Matcher = createMatcher({ packs: [marathi, hindi, english] });
const mrOnly: Matcher = createMatcher({ packs: [marathi] });

const ZWJ = '‍';
const ZWNJ = '‌';
const VIRAMA = '्';

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

describe('marathi native script', () => {
	const cases: [label: string, text: string][] = [
		['mother insult', 'आयझव्या'],
		['mother insult, माय- form', 'मायझव्या'],
		['verb', 'झवाड्या'],
		['verb form', 'झवला'],
		['genitive', 'भोसडीच्या'],
		['vocative', 'भडव्या'],
		['oblique', 'गांडीत'],
		['vocative 2', 'गांड्या'],
		['caste slur, eyelash reph', 'महाऱ्या'],
		['caste slur, plain र spelling', 'महार्या'],
		['caste slur, native-script-only', 'मांग्या'],
		['caste slur 3', 'चांभाऱ्या'],
		['genitive 2', 'रांडेच्या'],
		['compound', 'येडझव्या'],
		['insult', 'हलकट'],
		['vocative 3', 'कुत्र्या'],
		['locative', 'बोच्यात'],
		['plural vocative', 'चुत्यांनो'],
		['phrase', 'आयचा घो'],
		['in a sentence', 'तू एक नंबरचा भडव्या आहेस'],
	];
	it.each(cases)('flags %s: %j', (_label, text) => {
		flagged(text);
	});

	it('flags every native case with the mr pack loaded alone', () => {
		for (const [, text] of cases) flagged(text, mrOnly);
	});
});

describe('marathi script-level evasion', () => {
	it('is not fooled by ZWJ / ZWNJ injection', () => {
		flagged(`भड${ZWJ}व्या`);
		flagged(`झवा${ZWNJ}ड्या`);
	});

	it('is not fooled by a nasal + virama spelling of the anusvara', () => {
		// गाण्डीत ≡ गांडीत comes free from the Devanagari table.
		flagged('गाण्डीत');
	});

	it('is not fooled by a chandrabindu instead of an anusvara', () => {
		flagged('गाँडीत');
	});

	it('flags the eyelash-reph and plain-र spellings identically', () => {
		const eyelash = matcher.scan('महाऱ्या');
		const plain = matcher.scan('महार्या');
		expect(eyelash.matches[0]!.lemma).toBe(plain.matches[0]!.lemma);
		expect(eyelash.matches[0]!.severity).toBe(plain.matches[0]!.severity);
	});

	it('still needs the virama it was given (no accidental substring match)', () => {
		expect(matcher.scan('भडव्या').matches).toHaveLength(1);
		expect(matcher.scan(`भडव${VIRAMA}या`).matches).toHaveLength(1);
	});
});

describe('marathi romanized', () => {
	const spread: [label: string, texts: string[]][] = [
		['aayzavya family', ['aayzavya', 'aaizavya', 'ayzavya', 'aayjhavya', 'mayzavya']],
		['zavadya family', ['zavadya', 'jhavadya', 'zavadi', 'jhavadi', 'zavdya']],
		['zavne family', ['zavne', 'jhavne', 'zavto', 'zavla', 'jhavli']],
		['bhosadichya family', ['bhosadichya', 'bhosdichya', 'bhosdicha', 'bhosadya']],
		['gaand family', ['gandit', 'gandicha', 'gandichya', 'gandmasti']],
		['caste slurs', ['maharya', 'maharadya', 'chambharya', 'chambhardya']],
		['others', ['lavdya', 'yedzavya', 'halkat', 'kutrya', 'bochya', 'bhadkhau']],
	];
	for (const [label, texts] of spread) {
		it(`covers the ${label}`, () => {
			for (const t of texts) flagged(t, mrOnly);
		});
	}

	it('folds leetspeak and stretching', () => {
		flagged('h4lkat');
		flagged('zav4dya');
		flagged('halkaaaat');
	});

	it('resolves masked tokens', () => {
		flagged('hal*at');
		flagged('zav*dya');
	});

	it('folds fullwidth and mathematical-bold lookalikes', () => {
		flagged('ｈａｌｋａｔ');
		flagged('𝐳𝐚𝐯𝐚𝐝𝐲𝐚');
	});

	it('is case-insensitive', () => {
		flagged('HALKAT');
		flagged('ZavAdya');
	});

	it('censors only the offending token', () => {
		const text = 'tu ek number cha bhadvya ahes';
		const censored = matcher.censor(text);
		expect(censored).toBe('tu ek number cha ******* ahes');
		expect(censored).toHaveLength(text.length);
	});
});

describe('marathi metadata surfaces correctly', () => {
	it('reports the casteist category on the Maharashtra caste slurs', () => {
		for (const text of ['महाऱ्या', 'maharya', 'मांग्या', 'chambharya']) {
			const m = flagged(text).matches[0]!;
			expect(m.categories, text).toContain('casteist');
			expect(m.severity, text).toBe(4);
			expect(m.language, text).toBe('mr');
		}
	});

	it('flags casualUse on कुत्र्या and आयचा घो', () => {
		expect(flagged('कुत्र्या', mrOnly).matches[0]!.casualUse).toBe(true);
		expect(flagged('आयचा घो', mrOnly).matches[0]!.casualUse).toBe(true);
	});

	it('censors Devanagari grapheme-cluster-safely', () => {
		const censored = mrOnly.censor('भडव्या');
		expect(censored).toMatch(/^\*+$/);
		expect(/\p{M}/u.test(censored)).toBe(false);
	});
});

describe('marathi and the separated-letter tier', () => {
	it.each([
		['spaces', 'h a l k a t'],
		['dots', 'z.a.v.a.d.y.a'],
		['hyphens', 'm-a-h-a-r-y-a'],
		['long run', 'a a y z a v y a'],
	])('flags spelled-out %s: %j', (_label, text) => {
		const result = matcher.scan(text);
		expect(result.matches.length, `expected ${text} to flag`).toBeGreaterThan(0);
		expect(result.matches[0]!.tier).toBe('separated');
	});

	it('does not sweep up ordinary spelled-out or dotted text', () => {
		for (const text of [
			'M.A.H.A.R.A.S.H.T.R.A. day',
			'spell it m a h a r for me',        // the community name, not the slur
			'the m a n g samaj',                // ditto
			'g a n d h i wrote that',           // "gandhi" is allowlisted
			'k u t r a means dog',              // कुत्रा, not कुत्र्या
			'l a v k a r means soon',
			'c h a m b h a r community',
			'g a n d u l khat is compost',
			'M.R. Deshmukh called',
			'the P.M.C. bank case',
		]) {
			expect(matcher.isClean(text), text).toBe(true);
		}
	});

	it('cannot join Devanagari letters across a matra', () => {
		// ग ा ं ड — the matra and anusvara are combining marks, so no run forms.
		expect(matcher.isClean('ग ा ं ड')).toBe(true);
		expect(matcher.isClean('भ ड व ् य ा')).toBe(true);
	});
});

describe('marathi does not break the existing packs', () => {
	it('still flags the Hindi and English cases it always flagged', () => {
		for (const text of ['chutiya', 'bh0sdike', 'fuuuuck', 'बहनचोद', 'साले मादरचोद', 'abe bsdk']) {
			expect(matcher.isClean(text), text).toBe(false);
		}
	});
});
