/**
 * hi + mr cross-pack overlap — the suite that replaces `<lang>-prefix` for
 * Marathi.
 *
 * Marathi is the first pack to share a script AND a vocabulary with an
 * existing one. The recipe's fifth suite exists to pin down whatever is
 * genuinely hard about a language; for Tamil that was `matchMode: 'prefix'`,
 * and for Marathi it is this. Everything asserted here was MEASURED against
 * the engine before the mr pack was written, not assumed — see
 * docs/language-packs.md, "Cross-pack overlap".
 *
 * The three properties that matter:
 *
 *   1. Loading hi + mr never doubles a match.
 *   2. Different lemma strings sharing a surface → the higher severity wins,
 *      whatever the pack order.
 *   3. The SAME lemma string in two packs → the `lemma + span` dedupe drops
 *      the second before severity is compared, so pack order decides. Which
 *      is why every shared lemma must carry the same severity, and why that
 *      is enforced mechanically below rather than by comment.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import { marathi, SHARED_WITH_HINDI } from '../src/data/mr.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

const mrFirst = createMatcher({ packs: [marathi, hindi, english] });
const hiFirst = createMatcher({ packs: [hindi, marathi, english] });
const mrOnly = createMatcher({ packs: [marathi] });

describe('shared lemmas are mirrored exactly', () => {
	it('lists every lemma that appears in both packs in SHARED_WITH_HINDI', () => {
		const hiLemmas = new Set(hindi.entries.map((e) => e.lemma));
		const actual = marathi.entries
			.map((e) => e.lemma)
			.filter((l) => hiLemmas.has(l))
			.sort();
		expect(actual).toEqual([...SHARED_WITH_HINDI].sort());
	});

	it('gives every shared lemma the SAME severity and categories in both packs', () => {
		// Not cosmetic. The engine's dedupe key is `lemma + span`, so a shared
		// lemma with two different severities resolves by pack load order —
		// silently, and differently for every consumer.
		for (const lemma of SHARED_WITH_HINDI) {
			const h = hindi.entries.find((e) => e.lemma === lemma);
			const m = marathi.entries.find((e) => e.lemma === lemma);
			expect(h, `hi is missing "${lemma}"`).toBeDefined();
			expect(m, `mr is missing "${lemma}"`).toBeDefined();
			expect(m!.severity, `severity of "${lemma}"`).toBe(h!.severity);
			expect([...m!.categories].sort(), `categories of "${lemma}"`).toEqual(
				[...h!.categories].sort(),
			);
			expect(m!.skeletonSafe, `skeletonSafe of "${lemma}"`).toBe(h!.skeletonSafe);
		}
	});

	it('mirrors casualUse too, not just severity', () => {
		for (const lemma of SHARED_WITH_HINDI) {
			const h = hindi.entries.find((e) => e.lemma === lemma)!;
			const m = marathi.entries.find((e) => e.lemma === lemma)!;
			expect(m.casualUse ?? false, `casualUse of "${lemma}"`).toBe(h.casualUse ?? false);
		}
	});

	it('recognises that "same word" is not "same lemma string"', () => {
		// भडवा (mr) and भड़वा (hi) are the same word and, after the nukta fold,
		// the same match KEY — but two different lemma strings, which puts them
		// in the severity-comparison branch, not the dedupe branch. Same for
		// लवडा / लौड़ा. They are therefore NOT in SHARED_WITH_HINDI, and the
		// engine still reports exactly one match.
		const hiLemmas = new Set(hindi.entries.map((e) => e.lemma));
		expect(hiLemmas.has('भड़वा')).toBe(true);
		expect(hiLemmas.has('भडवा')).toBe(false);
		expect(SHARED_WITH_HINDI).not.toContain('भडवा');
		expect(mrFirst.scan('भडवा').matches).toHaveLength(1);
		expect(hiFirst.scan('भडवा').matches).toHaveLength(1);
	});

	it('repeats the hi-side allowlist on shared entries so data/mr works alone', () => {
		const gaand = marathi.entries.find((e) => e.lemma === 'गांड')!;
		for (const phrase of ['gandhi', 'uganda', 'gandalf']) {
			expect(gaand.allowlist, phrase).toContain(phrase);
		}
		expect(mrOnly.isClean('Mahatma Gandhi')).toBe(true);
		expect(mrOnly.isClean('Uganda is in Africa')).toBe(true);
	});
});

describe('loading hi + mr never doubles a match', () => {
	const sharedTexts = [
		'गांड',
		'गांडीत',
		'gandit',
		'gandichya',
		'गांडू',
		'gandya',
		'भडव्या',
		'bhadvya',
		'lavdya',
		'chutyano',
		'randechya',
	];

	it.each(sharedTexts)('scan(%j) reports exactly one match, both orders', (text) => {
		expect(mrFirst.scan(text).matches).toHaveLength(1);
		expect(hiFirst.scan(text).matches).toHaveLength(1);
	});

	it.each(sharedTexts)('censor(%j) is identical whichever pack loads first', (text) => {
		expect(mrFirst.censor(text)).toBe(hiFirst.censor(text));
	});

	it('reports the same severity in both orders for every shared surface', () => {
		for (const text of sharedTexts) {
			expect(mrFirst.scan(text).maxSeverity, text).toBe(hiFirst.scan(text).maxSeverity);
		}
	});
});

describe('different lemma strings sharing a surface take the higher severity', () => {
	it('picks severity 4 for a rom both packs reach, whatever the order', () => {
		// लवडा is an hi variant of लौड़ा (severity 3); लवड्या is an mr lemma
		// (severity 3). Different lemma strings, so the engine compares
		// severities rather than deduping — and the result is order-independent.
		for (const text of ['lavdya', 'लवडा']) {
			const a = mrFirst.scan(text);
			const b = hiFirst.scan(text);
			expect(a.matches).toHaveLength(1);
			expect(b.matches).toHaveLength(1);
			expect(a.maxSeverity, text).toBe(b.maxSeverity);
		}
	});
});

describe('Marathi-only terms do not need the hi pack', () => {
	const marathiOnly = [
		'आयझव्या',
		'aayzavya',
		'झवाड्या',
		'zavadya',
		'महाऱ्या',
		'maharya',
		'मांग्या',
		'चांभाऱ्या',
		'chambharya',
		'भोसडीच्या',
		'bhosadichya',
		'येडझव्या',
		'हलकट',
		'बोच्यात',
	];
	it.each(marathiOnly)('mr alone flags %j', (text) => {
		expect(mrOnly.isClean(text)).toBe(false);
	});

	it('the hi pack reaches none of them at the exact tier (else mr adds nothing)', () => {
		// hi's skeleton tier does reach 'bhosadichya' — skeleton("bhosadike")
		// and skeleton("bhosadichya") are both "bsdk". That is exactly the
		// upgrade this pack exists to provide: report-and-review becomes an
		// exact, auto-censorable match.
		const hiEn = createMatcher({ packs: [hindi, english] });
		for (const text of marathiOnly) {
			for (const m of hiEn.scan(text).matches) {
				expect(m.tier, `hi already matches ${JSON.stringify(text)} exactly`).toBe('skeleton');
			}
		}
		expect(mrOnly.scan('bhosadichya').matches[0]!.tier).toBe('exact');
	});
});

describe('the pack is self-sufficient — nothing is deferred to data/hi', () => {
	// Standing project decision: a consumer importing only `data/mr` gets full
	// coverage, including the Latin spellings of the shared Indo-Aryan core.
	const sharedCore = [
		'चूत',
		'chut',
		'choot',
		'मादरचोद',
		'madarchod',
		'maderchod',
		'रंडी',
		'randi',
		'लंड',
		'lund',
		'हरामी',
		'harami',
		'gand',
		'gaand',
		'gandu',
		'gaandu',
		'bhadva',
		'chutiya',
		'chutia',
		'bhosdike',
	];
	it.each(sharedCore)('mr alone flags %j', (text) => {
		expect(mrOnly.isClean(text)).toBe(false);
	});

	it('reports the same severity for the shared core with or without hi', () => {
		for (const text of sharedCore) {
			expect(mrOnly.scan(text).maxSeverity, text).toBe(mrFirst.scan(text).maxSeverity);
			expect(hiFirst.scan(text).maxSeverity, text).toBe(mrFirst.scan(text).maxSeverity);
		}
	});

	it('still reports exactly one match for the shared core when both are loaded', () => {
		for (const text of sharedCore) {
			expect(mrFirst.scan(text).matches, text).toHaveLength(1);
			expect(hiFirst.scan(text).matches, text).toHaveLength(1);
		}
	});

	it('carries the hi-side allowlists for the shared core', () => {
		for (const text of [
			'chutney recipe',
			'Mahatma Gandhi',
			'Lund University is in Sweden',
			'bullish harami candlestick',
		]) {
			expect(mrOnly.isClean(text), text).toBe(true);
		}
	});
});
