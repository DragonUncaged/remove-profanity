/**
 * Punjabi pack schema validity — the pa.ts counterpart of data.test.ts.
 *
 * The skeleton-key reimplementation is duplicated from data.test.ts on
 * purpose: per SPEC.md a data module (and its test) must not import
 * src/folds/skeleton.ts, so the check stays an independent restatement of the
 * Module C algorithm rather than a tautology against the engine.
 *
 * The section that matters most here is "no surface is shared with the hi
 * pack": Punjabi and Hindi share a large vocabulary and the pa pack's whole
 * word-list policy is that the hi pack owns the shared Latin spellings while
 * pa owns Gurmukhi. That check has to run against hi's *expanded*
 * romanizations, because hi.ts generates inflections at module load.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
import type { Category, LanguagePack } from '../src/types.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';
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

describe('punjabi pack schema', () => {
	it('has language pa, a name, and a curated entry count', () => {
		expect(punjabi.language).toBe('pa');
		expect(punjabi.name.length).toBeGreaterThan(0);
		expect(punjabi.entries.length).toBeGreaterThanOrEqual(25);
		expect(punjabi.entries.length).toBeLessThanOrEqual(120);
	});

	it('validates every entry', () => {
		for (const entry of punjabi.entries) {
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
			expect(entry.language, `${label} language`).toBe('pa');
			expect(entry.script, `${label} script`).toBe('Guru');
			expect(
				/\p{Script=Gurmukhi}/u.test(entry.lemma),
				`${label} lemma is Gurmukhi script`,
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
				expect(v.length, `${label} variant non-empty`).toBeGreaterThan(0);
			}
			for (const a of entry.allowlist ?? []) {
				expect(a, `${label} allowlist "${a}" lowercase`).toBe(a.toLowerCase());
			}
		}
	});

	it('has no duplicate lemmas and no surface form listed twice', () => {
		const lemmas = punjabi.entries.map((e) => e.lemma);
		expect(new Set(lemmas).size, 'duplicate lemma').toBe(lemmas.length);

		const seen = new Set<string>();
		for (const s of surfacesOf(punjabi)) {
			expect(seen.has(s), `surface "${s}" appears twice in the pa pack`).toBe(false);
			seen.add(s);
		}
	});

	it('marks every entry whose skeleton keys are all short as skeletonSafe: false', () => {
		for (const entry of punjabi.entries) {
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

	it('leaves only the three defensible entries in the skeleton tier', () => {
		// Punjabi romanizations are short and consonant-sparse; almost every
		// key lands on an ordinary English word (knjr = conjure, pnkd =
		// punched, fnkd = funked…). The three that stay are exactly the three
		// the hi pack already ships, with the same allowlists borrowed:
		//   bnkd  (ਭੈਣਚੋਦ)  -> banked / bunked / bonked
		//   bsdk  (ਭੋਸੜੀਕੇ) -> no English word reaches it
		//   mdrkd (ਮਾਦਰਚੋਦ) -> none; but 'motherchod' keys to mtrkd, which is
		//                      skeleton("motorcade") and skeleton("matricide")
		const inTier = punjabi.entries.filter(
			(e) =>
				e.skeletonSafe !== false &&
				// The engine only keys the skeleton tier off single-token
				// romanizations, so phrase-only entries never enter it.
				(e.romanizations ?? []).some((r) => !/\s/.test(r)),
		);
		expect(inTier.map((e) => e.lemma).sort()).toEqual(
			['ਭੈਣਚੋਦ', 'ਭੋਸੜੀਕੇ', 'ਮਾਦਰਚੋਦ'].sort(),
		);
		const bhainchod = inTier.find((e) => e.lemma === 'ਭੈਣਚੋਦ')!;
		for (const rom of bhainchod.romanizations!) {
			expect(skeletonKey(rom), rom).toBe('bnkd');
		}
		for (const phrase of ['banked', 'bunked', 'bonked']) {
			expect(bhainchod.allowlist, phrase).toContain(phrase);
		}
		// The mtrkd guard has to be pack-wide: it comes from 'motherchod',
		// whose entry carries no allowlist of its own.
		for (const phrase of ['motorcade', 'matricide']) {
			expect(punjabi.allowlist, phrase).toContain(phrase);
		}
	});

	it('uses no prefix mode — Punjabi is not agglutinative', () => {
		// Case is marked with free-standing postpositions (ਦਾ / ਨੂੰ / ਤੋਂ), so
		// the token boundary is real and relaxing it would only cost precision.
		expect(punjabi.entries.some((e) => e.matchMode === 'prefix')).toBe(false);
	});

	it('tags caste slurs with the casteist category at severity 4', () => {
		const casteist = punjabi.entries.filter((e) => e.categories.includes('casteist'));
		expect(casteist.length).toBeGreaterThanOrEqual(3);
		for (const lemma of ['ਚੂਹੜਾ', 'ਚਮਾਰ', 'ਭੰਗੀ']) {
			const entry = punjabi.entries.find((e) => e.lemma === lemma);
			expect(entry, lemma).toBeDefined();
			expect(entry!.categories, lemma).toContain('casteist');
			expect(entry!.severity, lemma).toBe(4);
		}
	});

	it('assigns honest severities to the anchor lemmas', () => {
		const severityOf = (lemma: string): number | undefined =>
			punjabi.entries.find((e) => e.lemma === lemma)?.severity;
		expect(severityOf('ਭੈਣਚੋਦ')).toBe(4);
		expect(severityOf('ਫੁੱਡੀ')).toBe(4);
		expect(severityOf('ਚੂਹੜਾ')).toBe(4);
		expect(severityOf('ਲੰਨ')).toBe(3);
		expect(severityOf('ਕੰਜਰ')).toBe(3);
		expect(severityOf('ਲੁੱਚਾ')).toBe(2);
		expect(severityOf('ਪੇਂਡੂ')).toBe(1);
		expect(punjabi.entries.find((e) => e.lemma === 'ਸਾਲਾ')!.casualUse).toBe(true);
	});

	it('omits the romanizations that cannot be disambiguated', () => {
		// Note what is NOT on this list any more: chamar, bhangi, randi, sala,
		// harami, gandu and the rest are now deliberately present, because
		// every pack must be self-sufficient. What stays out is only what hi
		// itself DROPPED — self-sufficiency does not mean resurrecting a
		// spelling another pack rejected on the merits.
		const roms = new Set(punjabi.entries.flatMap((e) => e.romanizations ?? []));
		for (const excluded of [
			// Dropped by this pack, for Punjabi-specific reasons.
			'lun', // three letters; a Chinese romanization and a surname
			'lucha', // Spanish lucha / lucha libre
			'luchi', // the Bengali fried bread
			'gasti', // an Italian surname
			'fudi', // no distinctive consonant left
			// Dropped by hi, and still dropped here for the same reasons.
			'hijra', // the Islamic Hijra, and a neutral self-identifier
			'kamini', // common female given name
			'lauda', // Niki Lauda, Lauda Air
			'laura',
			'lora',
			'rand', // rand(), Rand Corp, the ZAR
			'sale', // English
			'salon',
			'salo', // Slavic cured fat
			'chhod', // छोड़ "to leave"
		]) {
			expect(roms.has(excluded), `"${excluded}" must not be a pa romanization`).toBe(false);
		}
	});

	it('is self-sufficient: the shared Latin spellings are present', () => {
		// The project rule — importing data/pa alone must give full
		// coverage, so the spellings that used to be deferred to hi are here.
		const roms = new Set(punjabi.entries.flatMap((e) => e.romanizations ?? []));
		for (const shared of [
			'madarchod',
			'randi',
			'chamar',
			'bhangi',
			'hijda',
			'khusra',
			'gaand',
			'gand',
			'gandu',
			'chut',
			'chutiya',
			'chudai',
			'bhadwa',
			'kutti',
			'loda',
			'lund',
			'tatte',
			'harami',
			'kamina',
			'sala',
			'bhosdike',
		]) {
			expect(roms.has(shared), `"${shared}" must be a pa romanization`).toBe(true);
		}
	});

	it('borrowed the hi allowlist entries along with the spellings', () => {
		// The half that is easy to forget: importing 'gand' without
		// gandhi/uganda, or 'harami' without the candlestick phrases, would
		// make a pa-ONLY matcher fail on text hi handles fine.
		const all = new Set(punjabi.allowlist ?? []);
		for (const e of punjabi.entries) for (const a of e.allowlist ?? []) all.add(a);
		for (const phrase of [
			'gandhi',
			'uganda',
			'gandalf',
			'propaganda',
			'chutney',
			'chutki',
			'chutkule',
			'lund university',
			'kutti story',
			'bullish harami',
			'bearish harami',
			'harami candlestick',
			'chamar regiment',
			'motorcade',
			'matricide',
		]) {
			expect(all.has(phrase), `pa must carry the allowlist phrase "${phrase}"`).toBe(true);
		}
	});

	it('excludes the merely-rude and hopelessly polysemous vocabulary', () => {
		const surfaces = new Set(surfacesOf(punjabi));
		for (const junk of ['ਖੋਤਾ', 'ਢੱਗਾ', 'ਬਕਵਾਸ', 'ਨਿਕੰਮਾ', 'ਮੂਰਖ', 'ਰੰਨ', 'ਭਈਆ', 'ਮੋਨਾ', 'ਭਾਪਾ']) {
			expect(surfaces.has(junk), `"${junk}" must not be in the pa pack`).toBe(false);
		}
	});

	it('generates addak-less native variants but never a real Punjabi word', () => {
		const surfaces = new Set(
			punjabi.entries.flatMap((e) => [e.lemma, ...(e.variants ?? [])]),
		);
		// Generated by dropAddak().
		expect(surfaces.has('ਫੁਡੀ'), 'from ਫੁੱਡੀ').toBe(true);
		expect(surfaces.has('ਫੁਦੀ'), 'from ਫੁੱਦੀ').toBe(true);
		expect(surfaces.has('ਕੁਤੀ'), 'from ਕੁੱਤੀ').toBe(true);
		expect(surfaces.has('ਲੁਚਾ'), 'from ਲੁੱਚਾ').toBe(true);
		// Guarded by ADDAK_EXCLUDE — every one of these is a real word.
		for (const real of ['ਪਤਾ', 'ਦਸ', 'ਸਤ', 'ਕਲ']) {
			expect(surfaces.has(real), `"${real}" is a real Punjabi word`).toBe(false);
		}
	});

	it('carries the pack-wide allowlist for Punjabi community and proper nouns', () => {
		for (const phrase of [
			'jatt',
			'ravidassia',
			'mazhabi',
			'balmiki',
			'bhangi misl',
			'chamar regiment',
			'chuhar chak',
			'sally lunn',
		]) {
			expect(punjabi.allowlist, phrase).toContain(phrase);
		}
		for (const a of punjabi.allowlist ?? []) {
			expect(a).toBe(a.toLowerCase());
		}
	});
});

describe('cross-pack sanity under the self-sufficiency policy', () => {
	it('shares Latin spellings with hi deliberately, and native script never', () => {
		// Romanization overlap is now expected. What must NEVER overlap is the
		// native-script surfaces: a Gurmukhi string appearing in another pack
		// would mean a genuine copy-paste error, and — because the dedupe in
		// collectExact keys on the lemma STRING — a lemma collision would
		// silently discard one of the two entries.
		const otherNative = new Set(
			[hindi, english, tamil, gujarati].flatMap((p) =>
				surfacesOf(p).filter((x) => !/^[a-z ]+$/.test(x)),
			),
		);
		for (const s of surfacesOf(punjabi)) {
			if (/^[a-z ]+$/.test(s)) continue;
			expect(otherNative.has(s), `native surface "${s}" also appears in another pack`).toBe(
				false,
			);
		}
	});

	it('shares no LEMMA string with any other pack', () => {
		// The assertion that actually protects against the duplicate-lemma
		// discard. Gurmukhi lemmas cannot collide with Devanagari, Tamil,
		// Gujarati or Latin ones — but this pins it rather than assuming it.
		const otherLemmas = new Set(
			[hindi, english, tamil, gujarati].flatMap((p) => p.entries.map((e) => e.lemma)),
		);
		for (const e of punjabi.entries) {
			expect(otherLemmas.has(e.lemma), `lemma "${e.lemma}" collides across packs`).toBe(
				false,
			);
		}
	});

	it('does overlap hi on the Latin side, which is the point', () => {
		const hiRoms = new Set(hindi.entries.flatMap((e) => e.romanizations ?? []));
		const paRoms = punjabi.entries.flatMap((e) => e.romanizations ?? []);
		const shared = paRoms.filter((r) => hiRoms.has(r));
		expect(shared.length, 'pa must carry the shared Latin core').toBeGreaterThan(30);
	});
});

describe('engine behaviour when two loaded packs carry the same lemma', () => {
	// Documented here rather than assumed: this is the thing the pa word-list
	// policy exists to avoid, so it is worth knowing exactly what it costs.
	const pack = (
		language: string,
		lemma: string,
		severity: 1 | 2 | 3 | 4,
		extra: { categories?: Category[]; casualUse?: boolean } = {},
	): LanguagePack => ({
		language,
		name: `synthetic ${language}`,
		entries: [
			{
				lemma,
				language,
				script: 'Latn',
				severity,
				categories: extra.categories ?? ['general'],
				...(extra.casualUse === undefined ? {} : { casualUse: extra.casualUse }),
				romanizations: ['sharedsurface'],
				skeletonSafe: false,
			},
		],
	});

	it('reports ONE match, attributed to the first pack in the list', () => {
		const a = createMatcher({ packs: [pack('xa', 'same', 3), pack('xb', 'same', 3)] });
		const b = createMatcher({ packs: [pack('xb', 'same', 3), pack('xa', 'same', 3)] });
		expect(a.scan('sharedsurface').matches.map((m) => m.language)).toEqual(['xa']);
		expect(b.scan('sharedsurface').matches.map((m) => m.language)).toEqual(['xb']);
	});

	it('takes the STRICTEST severity when the LEMMA STRING is identical', () => {
		// collectExact dedupes candidates on `${lemma} ${start} ${end}`, so a
		// second pack whose lemma string is byte-identical cannot produce a
		// second candidate. It used to be discarded outright, which let import
		// order silently downgrade a severity; the surviving candidate now
		// takes the severer entry's reading, either way round.
		const lenientFirst = createMatcher({
			packs: [pack('xa', 'same', 1), pack('xb', 'same', 4)],
		});
		const strictFirst = createMatcher({
			packs: [pack('xb', 'same', 4), pack('xa', 'same', 1)],
		});
		for (const m of [lenientFirst, strictFirst]) {
			const [match] = m.scan('sharedsurface').matches;
			expect(match!.severity).toBe(4);
			expect(match!.language).toBe('xb');
		}
		expect(lenientFirst.scan('sharedsurface').maxSeverity).toBe(4);
	});

	it('and the UNION of the categories, whichever pack carries them', () => {
		const m = createMatcher({
			packs: [
				pack('xa', 'same', 2, { categories: ['general', 'sexual'] }),
				pack('xb', 'same', 2, { categories: ['slur', 'general'] }),
			],
		});
		const [match] = m.scan('sharedsurface').matches;
		// Equal severity, so attribution still follows load order.
		expect(match!.language).toBe('xa');
		expect([...match!.categories].sort()).toEqual(['general', 'sexual', 'slur']);
	});

	it('keeps casualUse only when both packs agree the term has one', () => {
		const disagree = createMatcher({
			packs: [
				pack('xa', 'same', 2, { casualUse: true }),
				pack('xb', 'same', 2, { casualUse: false }),
			],
		});
		const agree = createMatcher({
			packs: [
				pack('xa', 'same', 2, { casualUse: true }),
				pack('xb', 'same', 2, { casualUse: true }),
			],
		});
		expect(disagree.scan('sharedsurface').matches[0]!.casualUse).toBe(false);
		expect(agree.scan('sharedsurface').matches[0]!.casualUse).toBe(true);
	});

	it('does not let merging leak between distinct lemmas', () => {
		// The merge is keyed on lemma AND span; two different lemma strings
		// stay two candidates and go through ordinary overlap resolution.
		const m = createMatcher({
			packs: [
				pack('xa', 'one', 4, { categories: ['slur'] }),
				pack('xb', 'two', 1, { categories: ['sexual'] }),
			],
		});
		const [match] = m.scan('sharedsurface').matches;
		expect(match!.language).toBe('xa');
		expect(match!.categories).toEqual(['slur']);
	});

	it('but resolves by severity when the lemma strings DIFFER', () => {
		// Which is the case that actually arises across packs: Devanagari
		// मादरचोद and Gurmukhi ਮਾਦਰਚੋਦ are different strings, so both
		// candidates exist and normal overlap resolution picks the severer.
		const m = createMatcher({ packs: [pack('xa', 'one', 1), pack('xb', 'two', 4)] });
		const [match] = m.scan('sharedsurface').matches;
		expect(match!.language).toBe('xb');
		expect(match!.severity).toBe(4);
	});

	it('so a shared spelling costs attribution, never a duplicate match', () => {
		// The accepted price of self-sufficiency. 'madarchod' is now in both
		// packs under different lemma strings, so BOTH candidates exist — and
		// the result is still exactly one match, attributed to whichever pack
		// was passed first.
		const paFirst = createMatcher({ packs: [punjabi, hindi] });
		const hiFirst = createMatcher({ packs: [hindi, punjabi] });
		expect(paFirst.scan('madarchod').matches.map((x) => x.language)).toEqual(['pa']);
		expect(hiFirst.scan('madarchod').matches.map((x) => x.language)).toEqual(['hi']);
		// Same severity and span either way — only the label moves.
		expect(paFirst.scan('madarchod').maxSeverity).toBe(4);
		expect(hiFirst.scan('madarchod').maxSeverity).toBe(4);
	});

	it('and each pack alone still catches it', () => {
		expect(createMatcher({ packs: [punjabi] }).isClean('madarchod')).toBe(false);
		expect(createMatcher({ packs: [gujarati] }).isClean('madarchod')).toBe(false);
		expect(createMatcher({ packs: [hindi] }).isClean('madarchod')).toBe(false);
	});
});
