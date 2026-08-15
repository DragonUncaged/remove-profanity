import { describe, it, expect } from 'vitest';
import type { Category, LanguagePack, LemmaEntry } from '../src/types.js';
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

/**
 * Local reimplementation of the Module C phonetic skeleton (per spec the data
 * module must not import src/folds/skeleton.ts). Used to verify that every
 * entry whose skeleton key is shorter than 4 chars opts out of the skeleton
 * tier (skeletonSafe: false).
 */
function skeletonKey(word: string): string {
	// Stage 1: digraph consumption, longest-first, left to right.
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
	// Stage 2: single folds.
	const singles: Record<string, string> = { z: 'j', w: 'v', q: 'k', y: 'i', c: 'k', x: 'ks' };
	out = [...out].map((ch) => singles[ch] ?? ch).join('');
	// Stages 3+4: drop non-word-initial h, drop non-word-initial vowels.
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
	// Stage 5: collapse all repeat runs to 1.
	out = out.replace(/(.)\1+/gu, '$1');
	// Stage 6: strip non [a-z ], collapse whitespace.
	out = out.replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim();
	return out;
}

/** Latin-script surfaces of an entry that the skeleton tier would see. */
function latinSurfaces(entry: LemmaEntry): string[] {
	const surfaces: string[] = [...(entry.romanizations ?? [])];
	if (entry.script === 'Latn') {
		surfaces.push(entry.lemma);
		surfaces.push(...(entry.variants ?? []));
	}
	return surfaces;
}

function validatePack(pack: LanguagePack): void {
	expect(pack.language).toMatch(/^[a-z]{2}$/);
	expect(pack.name.length).toBeGreaterThan(0);
	expect(pack.entries.length).toBeGreaterThan(0);

	for (const entry of pack.entries) {
		const label = `entry "${entry.lemma}"`;

		expect(Number.isInteger(entry.severity), `${label} severity integral`).toBe(true);
		expect(entry.severity, `${label} severity >= 0`).toBeGreaterThanOrEqual(0);
		expect(entry.severity, `${label} severity <= 4`).toBeLessThanOrEqual(4);

		expect(entry.categories.length, `${label} has categories`).toBeGreaterThan(0);
		for (const cat of entry.categories) {
			expect(ALLOWED_CATEGORIES, `${label} category "${cat}"`).toContain(cat);
		}
		expect(new Set(entry.categories).size).toBe(entry.categories.length);

		expect(entry.lemma.trim(), `${label} lemma trimmed`).toBe(entry.lemma);
		expect(entry.lemma.length, `${label} lemma non-empty`).toBeGreaterThan(0);
		expect(entry.language, `${label} language`).toBe(pack.language === 'hi' ? 'hi' : 'en');
		expect(['Deva', 'Latn'], `${label} script`).toContain(entry.script);
		const isDevanagari = /\p{Script=Devanagari}/u.test(entry.lemma);
		expect(entry.script, `${label} script matches lemma`).toBe(isDevanagari ? 'Deva' : 'Latn');

		for (const r of entry.romanizations ?? []) {
			expect(r.length, `${label} romanization non-empty`).toBeGreaterThan(0);
			expect(r, `${label} romanization "${r}" lowercase`).toBe(r.toLowerCase());
			expect(r.trim(), `${label} romanization "${r}" trimmed`).toBe(r);
			expect(/\p{Script=Devanagari}/u.test(r), `${label} romanization is Latin`).toBe(false);
		}

		for (const v of entry.variants ?? []) {
			expect(v.length).toBeGreaterThan(0);
			expect(v.trim()).toBe(v);
		}
		for (const a of entry.allowlist ?? []) {
			expect(a.length).toBeGreaterThan(0);
			expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
		}

		if (entry.matchMode !== undefined) {
			expect(['word', 'prefix']).toContain(entry.matchMode);
		}
	}

	const lemmas = pack.entries.map((e) => e.lemma);
	expect(new Set(lemmas).size, 'duplicate lemma in pack').toBe(lemmas.length);

	const surfaces = pack.entries.flatMap((e) => [
		e.lemma,
		...(e.romanizations ?? []),
		...(e.variants ?? []),
	]);
	const seen = new Set<string>();
	for (const s of surfaces) {
		expect(seen.has(s), `surface "${s}" appears twice in pack ${pack.language}`).toBe(false);
		seen.add(s);
	}

	for (const a of pack.allowlist ?? []) {
		expect(a).toBe(a.toLowerCase());
	}

	// The engine skips individual skeleton keys shorter than 4 chars, so a
	// short key on one romanization is fine. But an entry whose keys are ALL
	// short is skeleton-ineligible in practice and must say so explicitly.
	for (const entry of pack.entries) {
		const keys = latinSurfaces(entry).map(skeletonKey);
		const maxLen = keys.length === 0 ? Infinity : Math.max(...keys.map((k) => k.length));
		if (maxLen < 4) {
			expect(
				entry.skeletonSafe,
				`entry "${entry.lemma}" has only short skeleton key(s) [${keys.join(', ')}] and must set skeletonSafe: false`,
			).toBe(false);
		}
	}
}

describe('hindi pack schema', () => {
	it('validates', () => {
		validatePack(hindi);
	});

	it('has 55–120 entries, language hi', () => {
		// bc, mc, गश्ती, मूठ and कुत्ता ("dog") were removed after the
		// false-positive reviews.
		expect(hindi.language).toBe('hi');
		expect(hindi.entries.length).toBeGreaterThanOrEqual(55);
		expect(hindi.entries.length).toBeLessThanOrEqual(120);
	});

	it('carries the spec pack-wide allowlist', () => {
		for (const phrase of [
			'gandhi',
			'chutney',
			'chutki',
			'chutkule',
			'uganda',
			'propaganda',
			'lund university',
			'bal thackeray',
			'sunni muslim',
		]) {
			expect(hindi.allowlist).toContain(phrase);
		}
	});

	it('groups Devanagari lemma with its romanizations', () => {
		const chutiya = hindi.entries.find((e) => e.lemma === 'चूतिया');
		expect(chutiya).toBeDefined();
		for (const r of ['chutiya', 'chutia', 'chutya']) {
			expect(chutiya!.romanizations).toContain(r);
		}
		expect(chutiya!.severity).toBe(3);
	});

	it('carries per-entry allowlists for known collisions', () => {
		const gaand = hindi.entries.find((e) => e.romanizations?.includes('gand'));
		expect(gaand).toBeDefined();
		for (const a of ['gandhi', 'uganda', 'gandalf']) {
			expect(gaand!.allowlist).toContain(a);
		}

		const lund = hindi.entries.find((e) => e.romanizations?.includes('lund'));
		expect(lund).toBeDefined();
		expect(lund!.allowlist).toContain('lund university');

		const chut = hindi.entries.find((e) => e.romanizations?.includes('chut'));
		expect(chut).toBeDefined();
		expect(chut!.allowlist).toContain('chutney');
		expect(chut!.allowlist).toContain('chutki');

		// 'chutia' must stay matched (it IS a profanity spelling) — assert it
		// is not allowlisted anywhere.
		for (const e of hindi.entries) {
			expect(e.allowlist ?? []).not.toContain('chutia');
		}
	});

	it('includes the abbreviations as skeleton-unsafe entries', () => {
		// bc and mc were removed after the review: they flagged dates
		// (753 BC), British Columbia, and emcees. Only distinctive
		// abbreviations remain.
		for (const abbr of ['bsdk', 'bkl', 'tmkc']) {
			const entry = hindi.entries.find((e) => e.lemma === abbr);
			expect(entry, `abbreviation ${abbr}`).toBeDefined();
			expect(entry!.script).toBe('Latn');
			expect(entry!.skeletonSafe).toBe(false);
			expect(entry!.severity).toBeGreaterThanOrEqual(2);
		}
		expect(hindi.entries.find((e) => e.lemma === 'bc')).toBeUndefined();
		expect(hindi.entries.find((e) => e.lemma === 'mc')).toBeUndefined();
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			hindi.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('मादरचोद')).toBe(4);
		expect(severityOf('बहनचोद')).toBe(4);
		expect(severityOf('भोसड़ीके')).toBe(4);
		expect(severityOf('रंडी')).toBe(4);
		expect(severityOf('चूतिया')).toBe(3);
		expect(severityOf('गांडू')).toBe(3);
		expect(severityOf('लौड़ा')).toBe(3);
		expect(severityOf('कमीना')).toBe(2);
		expect(severityOf('हरामी')).toBe(2);
		expect(severityOf('साला')).toBe(2);
		expect(hindi.entries.find((e) => e.lemma === 'साला')!.casualUse).toBe(true);
	});

	it('excludes merely-rude junk words', () => {
		const surfaces = new Set(
			hindi.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const junk of [
			'item',
			'maal',
			'pig',
			'paagal',
			'pagal',
			'ullu',
			'bandar',
			'gadha',
			'joota',
			'chamcha',
			'nibba',
			'nibbi',
			'kanjoos',
			'bhikari',
			'dalal', // legitimate word/surname
			'sale', // English word
			'laura', // Western given name
			'moot', // English word
		]) {
			expect(surfaces.has(junk), `junk word "${junk}" must not be in the hi pack`).toBe(false);
		}
	});
});

describe('english pack schema', () => {
	it('validates', () => {
		validatePack(english);
	});

	it('has a curated lemma count, language en', () => {
		expect(english.language).toBe('en');
		expect(english.entries.length).toBeGreaterThanOrEqual(60);
		expect(english.entries.length).toBeLessThanOrEqual(100);
	});

	it('carries the spec pack-wide allowlist', () => {
		for (const phrase of [
			'scunthorpe',
			'shitake',
			'matsushita',
			'class',
			'classic',
			'assassin',
			'bass',
			'grass',
			'pass',
			'cassock',
			'cocktail',
			'hancock',
			'dickens',
			'middlesex',
			'essex',
			'sussex',
		]) {
			expect(english.allowlist).toContain(phrase);
		}
	});

	it('has the big slurs at severity 4 with category slur', () => {
		for (const lemma of ['nigger', 'faggot', 'kike', 'spic']) {
			const entry = english.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.severity).toBe(4);
			expect(entry!.categories).toContain('slur');
		}
		// every severity-4 English entry is a slur
		for (const e of english.entries) {
			if (e.severity === 4) {
				expect(e.categories, `severity-4 "${e.lemma}" must be a slur`).toContain('slur');
			}
		}
	});

	it('drops the merely-sexual/medical vocabulary', () => {
		const surfaces = new Set(
			english.entries.flatMap((e) => [e.lemma, ...(e.variants ?? [])]),
		);
		for (const dropped of [
			'anal',
			'sex',
			'sexy',
			'nude',
			'vagina',
			'escort',
			'bdsm',
			'voyeur',
			'suck',
			'sucks',
			'topless',
			'twink',
			'xx',
			'xxx',
			'breast',
			'penis',
			'nipple',
			'swastika', // sacred symbol in India, not profanity
			'octopussy', // film title
			'playboy', // brand
		]) {
			expect(surfaces.has(dropped), `"${dropped}" must not be in the en pack`).toBe(false);
		}
	});
});

describe('cross-pack sanity', () => {
	it('packs do not share lemmas', () => {
		const hiLemmas = new Set(hindi.entries.map((e) => e.lemma));
		for (const e of english.entries) {
			expect(hiLemmas.has(e.lemma)).toBe(false);
		}
	});
});
