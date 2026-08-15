/**
 * Gujarati pack schema validity — the gu.ts counterpart of data.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts, so the check stays an independent restatement of the
 * Module C algorithm rather than a tautology against the engine.
 */
import { describe, it, expect } from 'vitest';
import type { Category, LanguagePack } from '../src/types.js';
import { gujarati } from '../src/data/gu.js';
import { punjabi } from '../src/data/pa.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';

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

const surfacesOf = (pack: LanguagePack): string[] =>
	pack.entries.flatMap((e) => [
		e.lemma,
		...(e.variants ?? []),
		...(e.romanizations ?? []),
	]);

describe('gujarati pack schema', () => {
	it('has language gu, a name, and a curated entry count', () => {
		expect(gujarati.language).toBe('gu');
		expect(gujarati.name.length).toBeGreaterThan(0);
		expect(gujarati.entries.length).toBeGreaterThanOrEqual(25);
		expect(gujarati.entries.length).toBeLessThanOrEqual(120);
	});

	it('validates every entry', () => {
		for (const entry of gujarati.entries) {
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
			expect(entry.language, `${label} language`).toBe('gu');
			expect(entry.script, `${label} script`).toBe('Gujr');
			expect(
				/\p{Script=Gujarati}/u.test(entry.lemma),
				`${label} lemma is Gujarati script`,
			).toBe(true);

			for (const r of entry.romanizations ?? []) {
				expect(r, `${label} romanization "${r}" lowercase`).toBe(r.toLowerCase());
				expect(r.trim(), `${label} romanization "${r}" trimmed`).toBe(r);
				expect(/^[a-z ]+$/.test(r), `${label} romanization "${r}" is plain Latin`).toBe(
					true,
				);
			}
			for (const v of entry.variants ?? []) {
				expect(v.trim(), `${label} variant trimmed`).toBe(v);
				expect(v.length, `${label} variant non-empty`).toBeGreaterThan(0);
			}
			for (const a of entry.allowlist ?? []) {
				expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
			}
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = gujarati.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const s of surfacesOf(gujarati)) {
			expect(seen.has(s), `surface "${s}" appears twice in the gu pack`).toBe(false);
			seen.add(s);
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of gujarati.entries) {
			const roms = entry.romanizations ?? [];
			if (roms.length === 0) continue;
			const keys = roms.map(skeletonKey);
			if (Math.max(...keys.map((k) => k.length)) < 4) {
				expect(
					entry.skeletonSafe,
					`entry "${entry.lemma}" has only short skeleton keys [${keys.join(', ')}] and must set skeletonSafe: false`,
				).toBe(false);
			}
		}
	});

	it('switches off the skeleton tier wherever a key reaches an English word', () => {
		// hlkt == skeleton("hellcat") and rkdl == skeleton("Rockdale") are the
		// two that judgement had to catch; the mechanical short-key rule above
		// would have let both through.
		for (const lemma of ['હલકટ', 'રખડેલ', 'કૂતરી']) {
			const entry = gujarati.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.skeletonSafe, lemma).toBe(false);
		}
		// The three that stay are the ones hi already ships the keys for:
		// bsdn, mdrkd and bnkd.
		const inTier = gujarati.entries.filter(
			(e) => e.skeletonSafe !== false && (e.romanizations ?? []).some((r) => !/\s/.test(r)),
		);
		expect(inTier.map((e) => e.lemma).sort()).toEqual(
			['ભોસડીના', 'બહેનચોદ', 'માદરચોદ'].sort(),
		);
		const behenchod = inTier.find((e) => e.lemma === 'બહેનચોદ')!;
		for (const phrase of ['banked', 'bunked', 'bonked']) {
			expect(behenchod.allowlist, phrase).toContain(phrase);
		}
	});

	it('uses no prefix mode — Gujarati is not agglutinative', () => {
		expect(gujarati.entries.some((e) => e.matchMode === 'prefix')).toBe(false);
	});

	it('tags caste slurs with the casteist category at severity 4', () => {
		const casteist = gujarati.entries.filter((e) => e.categories.includes('casteist'));
		expect(casteist.length).toBeGreaterThanOrEqual(4);
		for (const lemma of ['ઢેડ', 'વાઘરી', 'ચમાર', 'ભંગી']) {
			const entry = gujarati.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
			expect(entry!.severity, lemma).toBe(4);
		}
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			gujarati.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('ભોસડીના')).toBe(4);
		expect(severityOf('છિનાળ')).toBe(4);
		expect(severityOf('ઢેડ')).toBe(4);
		expect(severityOf('લવડો')).toBe(3);
		expect(severityOf('બાયલો')).toBe(2);
		expect(severityOf('હલકટ')).toBe(2);
		expect(gujarati.entries.find((e) => e.lemma === 'સાળો')!.casualUse).toBe(true);
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		// Only spellings that were DROPPED on the merits stay out; the ones
		// that were merely deferred to hi are now present, because every pack
		// must be self-sufficient.
		const roms = new Set(gujarati.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'salo', // Slavic cured fat — hi excludes it on purpose
			'sale',
			'salon',
			'bailo', // Spanish
			'gando', // ordinary Gujarati for "crazy"
			'lavado', // Spanish/Portuguese "washed"
			'rand', // rand(), Rand Corp, the ZAR
			'hijra', // the Islamic Hijra, and a neutral self-identifier
			'kamini', // common female given name
			'lauda', // Niki Lauda, Lauda Air
			'luchchi', // belongs to the pa pack (ਲੁੱਚੀ)
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a gu romanization`).toBe(false);
		}
	});

	it('is self-sufficient: the shared Latin spellings are present', () => {
		const roms = new Set(gujarati.entries.flatMap((e) => e.romanizations ?? []));
		for (const shared of [
			'madarchod',
			'bhenchod',
			'randi',
			'chamar',
			'bhangi',
			'hijdo',
			'hijda',
			'gaand',
			'gand',
			'gandu',
			'chut',
			'chutiyo',
			'chutiya',
			'bhadvo',
			'bhadwa',
			'lavdo',
			'lavda',
			'lund',
			'raand',
			'harami',
			'kamino',
			'kamina',
			'sala',
		]) {
			expect(roms.has(shared), `"${shared}" must be a gu romanization`).toBe(true);
		}
	});

	it('borrowed the hi allowlist entries along with the spellings', () => {
		const all = new Set(gujarati.allowlist ?? []);
		for (const e of gujarati.entries) for (const a of e.allowlist ?? []) all.add(a);
		for (const phrase of [
			'gandhi',
			'uganda',
			'gandalf',
			'propaganda',
			'chutney',
			'chutki',
			'chutkule',
			'lund university',
			'bullish harami',
			'harami candlestick',
			'chamar regiment',
			'banked',
		]) {
			expect(all.has(phrase), `gu must carry the allowlist phrase "${phrase}"`).toBe(true);
		}
	});

	it('excludes the merely-rude vocabulary', () => {
		const surfaces = new Set(surfacesOf(gujarati));
		for (const junk of ['ડોબો', 'ગધેડો', 'મૂરખ', 'ડફોળ', 'બદમાશ', 'મવાલી', 'ગાંડો']) {
			expect(surfaces.has(junk), `"${junk}" must not be in the gu pack`).toBe(false);
		}
	});

	it('carries the pack-wide allowlist for Gujarati community and proper nouns', () => {
		for (const phrase of [
			'vankar',
			'meghwal',
			'devipujak',
			'valmiki samaj',
			'chamar regiment',
			'hellcat',
			'rockdale',
		]) {
			expect(gujarati.allowlist, phrase).toContain(phrase);
		}
		for (const a of gujarati.allowlist ?? []) {
			expect(a).toBe(a.toLowerCase());
		}
	});
});

describe('cross-pack sanity under the self-sufficiency policy', () => {
	it('shares Latin spellings deliberately, and native script never', () => {
		const otherNative = new Set(
			[hindi, english, tamil, punjabi].flatMap((p) =>
				surfacesOf(p).filter((x) => !/^[a-z ]+$/.test(x)),
			),
		);
		for (const s of surfacesOf(gujarati)) {
			if (/^[a-z ]+$/.test(s)) continue;
			expect(otherNative.has(s), `native surface "${s}" also appears in another pack`).toBe(
				false,
			);
		}
	});

	it('shares no LEMMA string with any other pack', () => {
		// What protects against the duplicate-lemma discard in collectExact.
		const otherLemmas = new Set(
			[hindi, english, tamil, punjabi].flatMap((p) => p.entries.map((e) => e.lemma)),
		);
		for (const e of gujarati.entries) {
			expect(otherLemmas.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(
				false,
			);
		}
	});

	it('does overlap hi on the Latin side, which is the point', () => {
		const hiRoms = new Set(hindi.entries.flatMap((e) => e.romanizations ?? []));
		const guRoms = gujarati.entries.flatMap((e) => e.romanizations ?? []);
		expect(guRoms.filter((r) => hiRoms.has(r)).length).toBeGreaterThan(25);
	});
});
