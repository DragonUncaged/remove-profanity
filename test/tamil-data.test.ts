/**
 * Tamil pack schema validity — the ta.ts counterpart of data.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts, so the check stays an independent restatement of
 * the Module C algorithm rather than a tautology against the engine.
 */
import { describe, it, expect } from 'vitest';
import type { Category, LemmaEntry } from '../src/types.js';
import { tamil } from '../src/data/ta.js';
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

describe('tamil pack schema', () => {
	it('has language ta, a name, and a curated entry count', () => {
		expect(tamil.language).toBe('ta');
		expect(tamil.name.length).toBeGreaterThan(0);
		expect(tamil.entries.length).toBeGreaterThanOrEqual(30);
		expect(tamil.entries.length).toBeLessThanOrEqual(120);
	});

	it('validates every entry', () => {
		for (const entry of tamil.entries) {
			const label = `entry "${entry.lemma}"`;

			expect(Number.isInteger(entry.severity), `${label} severity integral`).toBe(true);
			expect(entry.severity, `${label} severity >= 0`).toBeGreaterThanOrEqual(0);
			expect(entry.severity, `${label} severity <= 4`).toBeLessThanOrEqual(4);

			expect(entry.categories.length, `${label} has categories`).toBeGreaterThan(0);
			for (const cat of entry.categories) {
				expect(ALLOWED_CATEGORIES, `${label} category "${cat}"`).toContain(cat);
			}
			expect(new Set(entry.categories).size, `${label} duplicate category`).toBe(
				entry.categories.length,
			);

			expect(entry.lemma.trim(), `${label} lemma trimmed`).toBe(entry.lemma);
			expect(entry.lemma.length, `${label} lemma non-empty`).toBeGreaterThan(0);
			expect(entry.language, `${label} language`).toBe('ta');
			expect(entry.script, `${label} script`).toBe('Taml');
			expect(
				/\p{Script=Tamil}/u.test(entry.lemma),
				`${label} lemma is Tamil script`,
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
				expect(v.length, `${label} variant non-empty`).toBeGreaterThan(0);
				expect(v.trim(), `${label} variant trimmed`).toBe(v);
			}
			for (const a of entry.allowlist ?? []) {
				expect(a.length).toBeGreaterThan(0);
				expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
			}

			if (entry.matchMode !== undefined) {
				expect(['word', 'prefix']).toContain(entry.matchMode);
			}
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = tamil.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const e of tamil.entries) {
			for (const s of [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]) {
				expect(seen.has(s), `surface "${s}" appears twice in the ta pack`).toBe(false);
				seen.add(s);
			}
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of tamil.entries) {
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

	it('gives every prefix-mode entry a deliberate allowlist', () => {
		const prefixEntries = tamil.entries.filter((e) => e.matchMode === 'prefix');
		// Prefix mode is the whole reason this pack exists; if it ever drops to
		// zero, the agglutination story has silently regressed.
		expect(prefixEntries.length).toBeGreaterThanOrEqual(4);
		for (const e of prefixEntries) {
			expect(
				(e.allowlist ?? []).length,
				`prefix entry "${e.lemma}" must carry an allowlist`,
			).toBeGreaterThan(0);
			// A short prefix pattern matches far too much.
			for (const surface of [e.lemma, ...(e.romanizations ?? [])]) {
				expect(
					surface.length,
					`prefix surface "${surface}" is too short to be safe`,
				).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it('tags caste slurs with the casteist category', () => {
		const casteist = tamil.entries.filter((e) => e.categories.includes('casteist'));
		expect(casteist.length).toBeGreaterThanOrEqual(5);
		for (const lemma of ['பறையன்', 'பள்ளன்', 'சக்கிலியன்', 'பஞ்சமன்']) {
			const entry = tamil.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
			expect(entry!.severity, lemma).toBe(4);
		}
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			tamil.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('புண்டை')).toBe(4);
		expect(severityOf('கூதி')).toBe(4);
		expect(severityOf('தேவடியா')).toBe(4);
		expect(severityOf('தாயோலி')).toBe(4);
		expect(severityOf('சூத்து')).toBe(3);
		expect(severityOf('மயிர்')).toBe(2);
		expect(severityOf('நாய்')).toBe(1);
		expect(tamil.entries.find((e) => e.lemma === 'மயிர்')!.casualUse).toBe(true);
		expect(tamil.entries.find((e) => e.lemma === 'நாய்')!.casualUse).toBe(true);
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		const roms = new Set(tamil.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			'pool', // English word
			'sunni', // the Sunni sect
			'sunny',
			'loose', // English word
			'suthu', // சுத்து "to roam"
			'munda', // the Munda community / language family
			'nari', // நரி "fox", and a given name
			'nai',
			'shudra', // descriptive varna term
			'thotti', // தொட்டி "water tank"
			'ali', // the given name Ali
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a ta romanization`).toBe(false);
		}
	});

	it('excludes the merely-rude vocabulary', () => {
		const surfaces = new Set(
			tamil.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const junk of ['முட்டாள்', 'கழுதை', 'பன்றி', 'கஞ்சன்', 'ரௌடி', 'திருநங்கை', 'சரக்கு']) {
			expect(surfaces.has(junk), `"${junk}" must not be in the ta pack`).toBe(false);
		}
	});

	it('drops the lemmas resolved by review', () => {
		// Settled decisions, not open questions — see the "Decisions" section
		// of docs/language-packs.md. Re-adding any of these needs that record
		// updated first.
		const surfaces = new Set(
			tamil.entries.flatMap((e) => [e.lemma, ...(e.romanizations ?? []), ...(e.variants ?? [])]),
		);
		for (const dropped of [
			'சுன்னி', // collides with the Sunni sect in BOTH scripts
			'சுன்னீ',
			'மூஞ்சி', // severity-1 coarse, below the Hindi pack's bar
			'moonji',
			'munji',
			'சனியன்', // severity-1 coarse
			'saniyan',
		]) {
			expect(surfaces.has(dropped), `"${dropped}" was dropped by review`).toBe(false);
		}
		// …and their allowlist phrases went with them.
		for (const orphan of ['sunni muslim', 'sunni islam', 'sani peyarchi', 'sanikizhamai']) {
			expect(tamil.allowlist ?? [], `orphaned allowlist "${orphan}"`).not.toContain(orphan);
		}
	});

	it('ships no severity-1 entry that is merely coarse rather than offensive', () => {
		// The bar the Hindi pack sets: severity 1 means genuinely offensive,
		// not merely informal.
		for (const e of tamil.entries) {
			expect(e.severity, `"${e.lemma}" severity`).toBeGreaterThanOrEqual(1);
		}
	});

	it('carries the pack-wide allowlist for Tamil proper nouns and homographs', () => {
		for (const phrase of [
			'kuthirai',
			'koothu',
			'poramboke',
			'parai',
			'paraiyar',
			'pundalik',
			'soothiram',
			'mayiladuthurai',
		]) {
			expect(tamil.allowlist, phrase).toContain(phrase);
		}
		for (const a of tamil.allowlist ?? []) {
			expect(a).toBe(a.toLowerCase());
		}
	});

	it('generates degeminated native variants but never a real Tamil word', () => {
		const surfaces = new Set(tamil.entries.flatMap((e) => [e.lemma, ...(e.variants ?? [])]));
		// Generated by the degeminate() expander.
		expect(surfaces.has('சகிலி')).toBe(true); // from சக்கிலி
		expect(surfaces.has('பொறுகி')).toBe(true); // from பொறுக்கி
		// Suppressed by DEGEMINATE_EXCLUDE — each of these IS a real word.
		expect(surfaces.has('சூது'), 'சூது "gambling"').toBe(false);
		expect(surfaces.has('தோடி'), 'தோடி, the raga').toBe(false);
		expect(surfaces.has('ஓதா'), 'ஓதா, from ஓது "to recite"').toBe(false);
		expect(surfaces.has('பொறம்போகு'), 'poramboke, the land class').toBe(false);
	});
});

describe('cross-pack sanity', () => {
	it('shares no lemma or romanization with the hi or en packs', () => {
		const others = new Set(
			[...hindi.entries, ...english.entries].flatMap((e) => [
				e.lemma,
				...(e.romanizations ?? []),
			]),
		);
		for (const e of tamil.entries) {
			expect(others.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(false);
			for (const r of e.romanizations ?? []) {
				expect(others.has(r), `romanization "${r}" collides across packs`).toBe(false);
			}
		}
	});

	it('keeps prefix mode confined to the Tamil pack for now', () => {
		const usesPrefix = (e: LemmaEntry): boolean => e.matchMode === 'prefix';
		expect(hindi.entries.some(usesPrefix)).toBe(false);
		expect(english.entries.some(usesPrefix)).toBe(false);
	});
});
