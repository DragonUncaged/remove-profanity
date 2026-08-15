/**
 * Marathi pack schema validity — the mr.ts counterpart of data.test.ts.
 *
 * The cross-pack half of the story (what happens when hi and mr are loaded
 * together) lives in test/marathi-overlap.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import type { Category } from '../src/types.js';
import { marathi } from '../src/data/mr.js';

const ALLOWED_CATEGORIES: Category[] = [
	'slur',
	'casteist',
	'religious',
	'gendered',
	'sexual',
	'ableist',
	'violence',
	'general',
];

function skeletonKey(word: string): string {
	const digraphs: [string, string][] = [
		['kshh', 'ks'],
		['ksh', 'ks'],
		['chh', 'c'],
		['ch', 'c'],
		['bh', 'b'],
		['dh', 'd'],
		['gh', 'g'],
		['jh', 'j'],
		['kh', 'k'],
		['ph', 'f'],
		['sh', 's'],
		['th', 't'],
		['zh', 'j'],
	];
	let out = '';
	let i = 0;
	while (i < word.length) {
		const hit = digraphs.find(([from]) => word.startsWith(from, i));
		if (hit) {
			out += hit[1];
			i += hit[0].length;
		} else {
			out += word[i]!;
			i += 1;
		}
	}
	const singles: Record<string, string> = { z: 'j', w: 'v', q: 'k', y: 'i', c: 'k', x: 'ks' };
	out = [...out].map((ch) => singles[ch] ?? ch).join('');
	out = out
		.split(' ')
		.map((w) => {
			let r = '';
			for (let j = 0; j < w.length; j++) {
				const ch = w[j]!;
				if (j > 0 && ch === 'h') continue;
				if (j > 0 && 'aeiou'.includes(ch)) continue;
				r += ch;
			}
			return r;
		})
		.join(' ');
	out = out.replace(/(.)\1+/gu, '$1');
	return out.replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim();
}

describe('marathi pack schema', () => {
	it('has language mr, a name, and a curated entry count', () => {
		expect(marathi.language).toBe('mr');
		expect(marathi.name.length).toBeGreaterThan(0);
		expect(marathi.entries.length).toBeGreaterThanOrEqual(18);
		expect(marathi.entries.length).toBeLessThanOrEqual(120);
	});

	it('validates every entry', () => {
		for (const entry of marathi.entries) {
			const label = `entry "${entry.lemma}"`;

			expect(Number.isInteger(entry.severity), `${label} severity integral`).toBe(true);
			expect(entry.severity, `${label} severity >= 1`).toBeGreaterThanOrEqual(1);
			expect(entry.severity, `${label} severity <= 4`).toBeLessThanOrEqual(4);

			expect(entry.categories.length, `${label} has categories`).toBeGreaterThan(0);
			for (const cat of entry.categories) {
				expect(ALLOWED_CATEGORIES, `${label} category "${cat}"`).toContain(cat);
			}
			expect(new Set(entry.categories).size, `${label} duplicate category`).toBe(
				entry.categories.length,
			);

			expect(entry.lemma.trim(), `${label} lemma trimmed`).toBe(entry.lemma);
			expect(entry.language, `${label} language`).toBe('mr');
			expect(entry.script, `${label} script`).toBe('Deva');
			expect(
				/\p{Script=Devanagari}/u.test(entry.lemma),
				`${label} lemma is Devanagari`,
			).toBe(true);

			for (const r of entry.romanizations ?? []) {
				expect(r, `${label} romanization "${r}" lowercase`).toBe(r.toLowerCase());
				expect(r.trim(), `${label} romanization "${r}" trimmed`).toBe(r);
				expect(
					/^[a-z ]+$/.test(r),
					`${label} romanization "${r}" is plain Latin`,
				).toBe(true);
			}
			for (const v of entry.variants ?? []) {
				expect(v.trim(), `${label} variant trimmed`).toBe(v);
				expect(v.length).toBeGreaterThan(0);
			}
			for (const a of entry.allowlist ?? []) {
				expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
			}
		}
	});

	it('uses no prefix mode — Marathi stems are too short for it to be safe', () => {
		// गांडू is five characters and गांडूळ "earthworm" starts with it; prefix
		// mode would swallow the whole vermicompost vocabulary.
		for (const e of marathi.entries) {
			expect(e.matchMode ?? 'word', `entry "${e.lemma}"`).toBe('word');
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = marathi.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const e of marathi.entries) {
			for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				expect(seen.has(s), `surface "${s}" appears twice in the mr pack`).toBe(false);
				seen.add(s);
			}
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of marathi.entries) {
			const roms = entry.romanizations ?? [];
			if (roms.length === 0) continue;
			const keys = roms.map(skeletonKey);
			const maxLen = Math.max(...keys.map((k) => k.length));
			if (maxLen < 4) {
				expect(
					entry.skeletonSafe,
					`entry "${entry.lemma}" has only short skeleton keys [${keys.join(', ')}] and must set skeletonSafe: false`,
				).toBe(false);
			}
		}
	});

	it('opts the measured English skeleton collisions out of the skeleton tier', () => {
		// Found by sweeping /usr/share/dict/words with the mr pack loaded
		// ALONE — loading hi or bn hid three of them behind their allowlists.
		const collisions: [lemma: string, englishWord: string][] = [
			['हलकट', 'hellcat'],
			['रांडेच्या', 'reindict'],
			['चुतमारीच्या', 'catamaran'],
			['चांभाऱ्या', 'chamber'],
		];
		for (const [lemma, word] of collisions) {
			const entry = marathi.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(
				entry!.skeletonSafe,
				`"${lemma}" shares a skeleton key with "${word}" and must stay out of the skeleton tier`,
			).toBe(false);
			const target = skeletonKey(word);
			const keys = (entry!.romanizations ?? []).map(skeletonKey);
			expect(
				keys.some((k) => target.startsWith(k) && target.length - k.length <= 3),
				`${lemma} keys [${keys.join(', ')}] should reach skeleton("${word}") = "${target}"`,
			).toBe(true);
		}
	});

	it('ships the Maharashtra caste slurs, abusive forms only', () => {
		const casteist = marathi.entries.filter((e) => e.categories.includes('casteist'));
		expect(casteist.length).toBeGreaterThanOrEqual(3);
		for (const lemma of ['महाऱ्या', 'मांग्या', 'चांभाऱ्या']) {
			const entry = marathi.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
			expect(entry!.severity, lemma).toBe(4);
			// Only the abusive vocative is matched; the community name is not.
			const surfaces = [entry!.lemma, ...(entry!.variants ?? [])];
			for (const neutral of ['महार', 'मांग', 'चांभार', 'मातंग']) {
				expect(surfaces, `${lemma} must not match the community name`).not.toContain(neutral);
			}
		}
	});

	it('allowlists every neutral community name it abuts', () => {
		for (const name of [
			'महार',
			'महाराष्ट्र',
			'mahar',
			'mahar regiment',
			'maharashtra',
			'मांग',
			'मातंग',
			'चांभार',
			'chambhar',
		]) {
			expect(marathi.allowlist, name).toContain(name);
		}
	});

	it('ships मांग्या native-script only', () => {
		// Romanized `mangya` is मंग्या, the standard Marathi nickname for
		// Mangesh — the Devanagari spellings differ, the Latin ones do not.
		const entry = marathi.entries.find((e) => e.lemma === 'मांग्या')!;
		expect(entry.romanizations ?? []).toEqual([]);
		expect(marathi.allowlist).toContain('मंग्या');
		expect(marathi.allowlist).toContain('mangesh');
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			marathi.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('आयझव्या')).toBe(4);
		expect(severityOf('झवाड्या')).toBe(4);
		expect(severityOf('भोसडीच्या')).toBe(4);
		expect(severityOf('झवणे')).toBe(3);
		expect(severityOf('हलकट')).toBe(2);
		expect(marathi.entries.find((e) => e.lemma === 'कुत्र्या')!.casualUse).toBe(true);
		expect(marathi.entries.find((e) => e.lemma === 'आयचा घो')!.casualUse).toBe(true);
	});

	it('omits the surfaces that cannot be disambiguated', () => {
		const roms = new Set(marathi.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'mangya', // मंग्या, the nickname for Mangesh
			'zav', // three characters
			'jhav',
			'javadya', // too close to the given name Jawad
			'bocha', // बोचणे "to prick"
			'dhorya', // ढोर is the everyday word for cattle
			'dhor',
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be an mr romanization`).toBe(false);
		}
	});

	it('excludes the merely-coarse vocabulary and the respectful term', () => {
		const surfaces = new Set(
			marathi.entries.flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
				...(e.variants ?? []),
			]),
		);
		for (const junk of [
			'बेवडा', // "drunkard"
			'फडतूस',
			'टकल्या',
			'वेंधळा',
			'मुर्दाड',
			'शिंच्या',
			'ढोऱ्या', // dropped: ढोर is cattle
			'तृतीयपंथी', // the respectful term — must never appear here
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the mr pack`).toBe(false);
		}
	});

	it('ships no severity-1 entry — the Hindi pack sets the bar', () => {
		for (const e of marathi.entries) {
			expect(e.severity, `"${e.lemma}" severity`).toBeGreaterThanOrEqual(2);
		}
	});

	it('has no allowlist phrase that suppresses one of its own surface forms', () => {
		// The trap this catches, found the hard way: an allow phrase that is a
		// PREFIX of a pack surface kills it, because a match's reported `end`
		// lands on the start of its final grapheme cluster. Allowlisting শাল
		// "sal tree" silently disabled শালা, and allowlisting `maggi` silently
		// disabled `maagi` through the repeat-collapsed pass.
		const matcher = createMatcher({ packs: [marathi] });
		for (const e of marathi.entries) {
			for (const surface of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]) {
				expect(
					matcher.isClean(surface),
					`surface "${surface}" of "${e.lemma}" is suppressed by an allowlist phrase in its own pack`,
				).toBe(false);
			}
		}
	});

	it('carries the Marathi-local traps in the pack-wide allowlist', () => {
		for (const phrase of [
			'गांडूळ', // "earthworm" — गांडूळ खत is vermicompost
			'गांडूळ खत',
			'gandul',
			'कुत्रा', // the neutral noun
			'लवकर', // "soon"
			'भाड्याने', // "on rent"
			'chamber',
			'catamaran',
			// the hi-side allowlist, repeated so `data/mr` works standalone
			'gandhi',
			'uganda',
		]) {
			expect(marathi.allowlist, phrase).toContain(phrase);
		}
		for (const a of marathi.allowlist ?? []) {
			expect(a, `allowlist "${a}" lowercase`).toBe(a.toLowerCase());
		}
	});
});
