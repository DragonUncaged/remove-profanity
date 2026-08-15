/**
 * Bengali pack schema validity — the bn.ts counterpart of data.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts, so the check stays an independent restatement of the
 * Module C algorithm rather than a tautology against the engine.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import type { Category } from '../src/types.js';
import { bengali } from '../src/data/bn.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';

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

describe('bengali pack schema', () => {
	it('has language bn, a name, and a curated entry count', () => {
		expect(bengali.language).toBe('bn');
		expect(bengali.name.length).toBeGreaterThan(0);
		expect(bengali.entries.length).toBeGreaterThanOrEqual(25);
		expect(bengali.entries.length).toBeLessThanOrEqual(120);
	});

	it('validates every entry', () => {
		for (const entry of bengali.entries) {
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
			expect(entry.language, `${label} language`).toBe('bn');
			expect(entry.script, `${label} script`).toBe('Beng');
			expect(
				/\p{Script=Bengali}/u.test(entry.lemma),
				`${label} lemma is Bengali script`,
			).toBe(true);

			for (const r of entry.romanizations ?? []) {
				expect(r.length, `${label} romanization non-empty`).toBeGreaterThan(0);
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

	it('uses no prefix mode — Bengali does not agglutinate deeply enough to need it', () => {
		for (const e of bengali.entries) {
			expect(e.matchMode ?? 'word', `entry "${e.lemma}"`).toBe('word');
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = bengali.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const e of bengali.entries) {
			for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				expect(seen.has(s), `surface "${s}" appears twice in the bn pack`).toBe(false);
				seen.add(s);
			}
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of bengali.entries) {
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
		// Every one of these was found by sweeping /usr/share/dict/words with
		// the bn pack loaded ALONE, not by guessing. Re-enabling any of them
		// re-introduces a documented false positive.
		const collisions: [lemma: string, englishWord: string][] = [
			['বাঞ্চোত', 'banquet'],
			['খানকি', 'conquer'],
			['চুতমারানি', 'catamaran'],
			['চাঁড়াল', 'candle'],
			['ছোটলোক', 'catholic'],
			['চুদির ভাই', 'cedarbird'],
		];
		for (const [lemma, word] of collisions) {
			const entry = bengali.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(
				entry!.skeletonSafe,
				`"${lemma}" shares a skeleton key with "${word}" and must stay out of the skeleton tier`,
			).toBe(false);
			// The skeleton tier matches a key at a token start with up to three
			// characters of remainder, so "is a prefix of" is the real test —
			// not equality.
			const target = skeletonKey(word);
			const keys = (entry!.romanizations ?? []).map(skeletonKey);
			expect(
				keys.some((k) => target.startsWith(k) && target.length - k.length <= 3),
				`${lemma} keys [${keys.join(', ')}] should reach skeleton("${word}") = "${target}"`,
			).toBe(true);
		}
	});

	it('tags the caste and religious slurs', () => {
		const chandal = bengali.entries.find((e) => e.lemma === 'চাঁড়াল')!;
		expect(chandal.categories).toContain('casteist');
		expect(chandal.severity).toBe(4);
		const malaun = bengali.entries.find((e) => e.lemma === 'মালাউন')!;
		expect(malaun.categories).toContain('religious');
		expect(malaun.severity).toBe(4);
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			bengali.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('বাঞ্চোত')).toBe(4);
		expect(severityOf('খানকি')).toBe(4);
		expect(severityOf('বোকাচোদা')).toBe(4);
		expect(severityOf('চোদা')).toBe(3);
		expect(severityOf('মাগী')).toBe(3);
		expect(severityOf('শালা')).toBe(2);
		expect(bengali.entries.find((e) => e.lemma === 'শালা')!.casualUse).toBe(true);
		expect(bengali.entries.find((e) => e.lemma === 'শুয়োর')!.casualUse).toBe(true);
	});

	it('ships গুদ, ধোন, বাল and পোঁদ native-script only', () => {
		// Policy rule 2: where the LATIN spelling is the ambiguous part, ship
		// native-only rather than dropping the lemma.
		for (const lemma of ['গুদ', 'ধোন', 'বাল', 'পোঁদ']) {
			const entry = bengali.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.romanizations ?? [], `${lemma} must have no romanizations`).toEqual([]);
		}
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(bengali.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'magi', // the Zoroastrian priests / the biblical wise men
			'gud', // গুড় "jaggery", and SMS-English "good"
			'dhon', // ধন "wealth"
			'bal', // Bal Thackeray, Bal Gangadhar Tilak
			'pod', // an English word
			'voda', // the press shorthand for Vodafone
			'chudi', // চুড়ি "bangle"
			'nashta', // নাস্তা "breakfast"
			'leora', // a given name
			'lawra', // a district in Ghana
			'jaraj',
			'dhamna', // ধামনা, the rat snake
			'chinali', // the Chinali people and language of Himachal Pradesh
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a bn romanization`).toBe(false);
		}
	});

	it('excludes the merely-coarse vocabulary and the dropped homograph', () => {
		const surfaces = new Set(
			bengali.entries.flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
				...(e.variants ?? []),
			]),
		);
		for (const junk of [
			'বোকা', // "fool"
			'গাধা', // "donkey"
			'ফাজিল',
			'বেয়াদব',
			'বেকুব',
			'বাড়া', // vulgar AND the everyday verb "to increase" — dropped
			'নষ্টা',
			'কাফের',
		]) {
			expect(surfaces.has(junk), `"${junk}" must not be in the bn pack`).toBe(false);
		}
	});

	it('ships no severity-1 entry — the Hindi pack sets the bar', () => {
		for (const e of bengali.entries) {
			expect(e.severity, `"${e.lemma}" severity`).toBeGreaterThanOrEqual(2);
		}
	});

	it('has no allowlist phrase that suppresses one of its own surface forms', () => {
		// The trap this catches, found the hard way: an allow phrase that is a
		// PREFIX of a pack surface kills it, because a match's reported `end`
		// lands on the start of its final grapheme cluster. Allowlisting শাল
		// "sal tree" silently disabled শালা, and allowlisting `maggi` silently
		// disabled `maagi` through the repeat-collapsed pass.
		const matcher = createMatcher({ packs: [bengali] });
		for (const e of bengali.entries) {
			for (const surface of [e.lemma, ...(e.variants ?? []), ...(e.romanizations ?? [])]) {
				expect(
					matcher.isClean(surface),
					`surface "${surface}" of "${e.lemma}" is suppressed by an allowlist phrase in its own pack`,
				).toBe(false);
			}
		}
	});

	it('carries the pack-wide allowlist for the measured collisions', () => {
		for (const phrase of [
			'banquet',
			'conquer',
			'catamaran',
			'candle',
			'kundli',
			'chandal yog',
			'pathshala',
			'গুদাম',
			'ধন',
		]) {
			expect(bengali.allowlist, phrase).toContain(phrase);
		}
		for (const a of bengali.allowlist ?? []) {
			expect(a, `allowlist "${a}" lowercase`).toBe(a.toLowerCase());
		}
	});
});

describe('bengali cross-pack sanity', () => {
	it('shares no LEMMA with the hi, en or mr packs — the script keeps them apart', () => {
		const others = new Set([...hindi.entries, ...english.entries].map((e) => e.lemma));
		for (const e of bengali.entries) {
			expect(others.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(false);
		}
	});

	it('is self-sufficient: a bn-only consumer still catches the shared borrowings', () => {
		// Standing project decision — nothing is deferred to another pack. The
		// Perso-Arabic borrowings Bengali shares with Hindi carry their Latin
		// spellings HERE, so `packs: [bengali]` alone is full coverage.
		const bnOnly = createMatcher({ packs: [bengali] });
		for (const text of [
			'haramjada',
			'haramzada',
			'madarchod',
			'maderchod',
			'chod',
			'chode',
			'shuar',
		]) {
			expect(bnOnly.isClean(text), `bn alone must catch "${text}"`).toBe(false);
		}
		for (const lemma of ['হারামজাদা', 'মাদারচোদ']) {
			const entry = bengali.entries.find((e) => e.lemma === lemma)!;
			expect((entry.romanizations ?? []).length, lemma).toBeGreaterThan(0);
		}
	});

	it('omits a romanization only for ambiguity, never because hi has it', () => {
		// The native-script-only lemmas are the audit trail: each one names the
		// word its Latin spelling collides with, in the entry comment.
		const bnOnly = createMatcher({ packs: [bengali] });
		const hiRoms = new Set(hindi.entries.flatMap((e) => e.romanizations ?? []));
		const shared = bengali.entries
			.flatMap((e) => e.romanizations ?? [])
			.filter((r) => hiRoms.has(r));
		expect(shared.length, 'bn should now carry some hi-shared spellings').toBeGreaterThan(0);
		for (const r of shared) expect(bnOnly.isClean(r), r).toBe(false);
	});
});
