/**
 * The repaired dictionary sweep — every shipped pack, no baseline.
 *
 * The sweep that shipped with the Bengali/Marathi packs had two structural
 * blind spots, and the package's worst false positives lived in exactly the
 * two blind spots:
 *
 *   1. It filtered with `if (!base.isClean(lw)) continue` where `base` was
 *      hindi + english. Everything the hi pack already flagged was discarded
 *      as "pre-existing", so **the hi pack's own false positives were
 *      invisible to every sweep ever run** — 'dalle' (dalle de verre) among
 *      them. The fix is the one below: sweep each pack ALONE against NO
 *      baseline, and pin the whole hit list. A deliberate hit is a line in
 *      the pinned table with a reason, not a filter.
 *   2. It only existed from the Bengali/Marathi work onward, so the ta pack,
 *      which shipped earlier, had never been swept at all.
 *
 * And one blind spot the word list itself has: `/usr/share/dict/words` is a
 * list of HEADWORDS. "shudder", "callous", "close" and "class" are in it;
 * "shuddered", "calloused", "closed" and "classed" — the forms that actually
 * false-positived — are not, or are not there as the inflection they are. So
 * the corpus here is the dictionary PLUS its regular English inflections,
 * which is where 'shuddered', 'calloused', 'bounced', 'benched' and 'bunched'
 * came from. None of them was findable any other way.
 *
 * The dictionary is a macOS/BSD file. Where it is absent the sweep is skipped
 * rather than failed — it is a development guard, not a portability claim.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error - this package has no @types/node (zero deps). The two
// functions used are re-typed below rather than pulling in a whole type
// package for a dev guard.
import { readFileSync as rawReadFileSync, existsSync as rawExistsSync } from 'node:fs';
import { createMatcher, skeletonKey } from '../src/index.js';
import { AhoCorasick } from '../src/engine/ahocorasick.js';
import type { LanguagePack } from '../src/types.js';
import { hindi } from '../src/data/hi.js';
import { english } from '../src/data/en.js';
import { tamil } from '../src/data/ta.js';
import { odia } from '../src/data/or.js';
import { bengali } from '../src/data/bn.js';
import { marathi } from '../src/data/mr.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { malayalam } from '../src/data/ml.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';

const readFileSync = rawReadFileSync as (path: string, encoding: string) => string;
const existsSync = rawExistsSync as (path: string) => boolean;

const DICT = '/usr/share/dict/words';
const haveDict = existsSync(DICT);

const PACKS: ReadonlyArray<readonly [string, LanguagePack]> = [
	['hi', hindi],
	['en', english],
	['ta', tamil],
	['or', odia],
	['bn', bengali],
	['mr', marathi],
	['te', telugu],
	['kn', kannada],
	['ml', malayalam],
	['pa', punjabi],
	['gu', gujarati],
];

function headwords(): string[] {
	if (!haveDict) return [];
	const seen = new Set<string>();
	for (const line of readFileSync(DICT, 'utf8').split('\n')) {
		const w = line.trim().toLowerCase();
		if (w.length > 0) seen.add(w);
	}
	return [...seen];
}

/**
 * Regular English inflections of one headword. Deliberately generative rather
 * than curated: it over-produces non-words ("naemorhedusest"), and that is
 * fine — a non-word colliding with a key is noise, but the pinned table below
 * records it anyway so that the next person reviews it instead of the sweep
 * quietly deciding for them.
 */
function inflect(w: string): string[] {
	if (!/^[a-z]+$/.test(w) || w.length < 3) return [];
	const out = [w + 's', w + 'ly'];
	if (/(s|x|z|ch|sh)$/.test(w)) out.push(w + 'es', w + 'ed');
	if (/[^aeiou]y$/.test(w)) out.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied');
	if (w.endsWith('e')) out.push(w + 'd', w + 'r', w + 'st', w.slice(0, -1) + 'ing');
	else out.push(w + 'ed', w + 'ing', w + 'er', w + 'est');
	return out;
}

const WORDS: string[] = headwords();

/** Inflected form -> the headword it was generated from. */
function inflectedCorpus(): Map<string, string> {
	const corpus = new Map<string, string>();
	const isHeadword = new Set(WORDS);
	for (const h of WORDS) {
		for (const f of inflect(h)) {
			if (!isHeadword.has(f) && !corpus.has(f)) corpus.set(f, h);
		}
	}
	return corpus;
}

/** Every hit one pack produces on the headword list, lemma -> words. */
function sweep(pack: LanguagePack, words: Iterable<string>): Record<string, string[]> {
	const matcher = createMatcher({ packs: [pack] });
	const byLemma = new Map<string, string[]>();
	for (const w of words) {
		for (const m of matcher.scan(w).matches) {
			const list = byLemma.get(m.lemma);
			if (list) {
				if (list[list.length - 1] !== w) list.push(w);
			} else byLemma.set(m.lemma, [w]);
		}
	}
	const out: Record<string, string[]> = {};
	for (const key of [...byLemma.keys()].sort()) out[key] = byLemma.get(key)!.sort();
	return out;
}

/**
 * Every dictionary headword each pack flags, with NO baseline subtracted.
 *
 * Every line is a deliberate match with a reason:
 *   - en flags its own vocabulary; those words ARE the pack. Its generated
 *     -s/-ed/-ing/-er forms reach four more headwords (cummer, hookers,
 *     raper, slutter), which is the generator working, not a collision.
 *   - chamar / bhangi / chuhra / paraiyan / pulayan are policy rule 2: the
 *     dictionary entry IS the caste name the lemma targets, shipped with the
 *     community self-names allowlisted. The caste-term decision
 *     (2026-08-14) keeps every one of them.
 *   - chut / tatta / laund / lunn are profanity spellings that happen to be
 *     Webster headwords.
 * Anything that appears here later and is NOT in that list is a regression.
 */
const HEADWORD_HITS: Record<string, Record<string, string[]>> = {
	hi: {
		चमार: ['chamar'],
		चूत: ['chut'],
		टट्टे: ['tatta'],
		भंगी: ['bhangi'],
		लंड: ['laund'],
	},
	en: {
		ass: ['ass'],
		bastard: ['bastard'],
		bitch: ['bitch'],
		boner: ['boner'],
		boob: ['boob'],
		bunghole: ['bunghole'],
		cock: ['cock'],
		coon: ['coon'],
		cum: ['cum', 'cummer'],
		dick: ['dick'],
		dingleberry: ['dingleberry'],
		hooker: ['hooker', 'hookers'],
		kike: ['kike'],
		negro: ['negro'],
		nigger: ['nigger'],
		piss: ['piss'],
		prick: ['prick', 'pricks'],
		pussy: ['pussy'],
		rape: ['rape', 'raper', 'raping', 'rapist'],
		slut: ['slut', 'slutter'],
		tit: ['tit', 'titty'],
		tosser: ['tosser'],
		twat: ['twat'],
		wetback: ['wetback'],
		whore: ['whore'],
	},
	ta: { பறையன்: ['paraiyan'] },
	or: {},
	bn: {},
	mr: { चूत: ['chut'], लंड: ['laund'] },
	te: {},
	kn: {},
	ml: { പുലയൻ: ['pulayan'] },
	pa: {
		ਚਮਾਰ: ['chamar'],
		ਚੂਤ: ['chut'],
		ਚੂਹੜਾ: ['chuhra'],
		ਟੱਟੇ: ['tatta'],
		ਭੰਗੀ: ['bhangi'],
		ਲੰਨ: ['laund', 'lunn'],
	},
	gu: { ચમાર: ['chamar'], ચૂત: ['chut'], ભંગી: ['bhangi'] },
};

describe.skipIf(!haveDict)('dictionary sweep — every pack, empty baseline', () => {
	it('has a real word list to sweep', () => {
		expect(WORDS.length).toBeGreaterThan(100_000);
	});

	it.each(PACKS)('%s flags exactly the pinned dictionary headwords', (code, pack) => {
		expect(sweep(pack, WORDS)).toEqual(HEADWORD_HITS[code]);
	});
});

/**
 * The inflected half. Pinned as lemma -> the HEADWORDS whose inflected forms
 * collide, because the inflected form itself is usually a generated non-word
 * ("bancaled" from banc) and the headword is what a reviewer can judge.
 *
 * Everything left here has been reviewed and is a non-word. The real English
 * words the same sweep found — bounced, benched, bunched, besodden, beancod,
 * beinked, bunkload, catamarcan, caddiced, nimrodian, calloused, closed,
 * classed, coleseed, shuddered — are gone, either allowlisted from this
 * table's own output or with the lemma's skeleton tier switched off. See the
 * collision test in docs/language-packs.md.
 */
const INFLECTION_COLLISIONS: Record<string, Record<string, string[]>> = {
	hi: {
		चुदक्कड़: ['caddiced', 'caduac', 'caduca', 'chudic', 'codiaceae', 'cycadaceae'],
		'बहन के लोड़े': ['bancal', 'bubonocele', 'buncal', 'bunchily', 'bunkload'],
		बहनचोद: [
			'banak',
			'banc',
			'banca',
			'banchi',
			'banco',
			'banked',
			'banky',
			'bannock',
			'beancod',
			'behenic',
			'beinked',
			'benchy',
			'bianca',
			'bianchi',
			'bianco',
			'bink',
			'binukau',
			'bohunk',
			'bonaci',
			'bonce',
			'boneache',
			'bubonic',
			'bunce',
			'bunchy',
			'bunkie',
			'buoyance',
			'buoyancy',
		],
		भोसड़ीके: [
			'babished',
			'based',
			'basidia',
			'basihyoid',
			'basoid',
			'beshade',
			'beshadow',
			'beshod',
			'beside',
			'bossed',
			'bushed',
			'busied',
			'busyhead',
			'byssoid',
		],
		मादरचोद: [
			'matriarch',
			'matriarchic',
			'matriarchy',
			'matric',
			'medrick',
			'metathoracic',
			'meteoric',
			'metric',
			'mithraic',
			'mithriac',
			'motoric',
			'mythoheroic',
		],
		हरामखोर: ['hermaic', 'hieromachy', 'hormic'],
	},
	en: { beaner: ['bean'], bollocks: ['bollock'] },
	ta: {
		அரைவேக்காடு: ['arawak'],
		தண்டச்சோறு: ['tanaidacea', 'tenendas', 'tenodesis', 'thenadays', 'tundish'],
	},
	or: { ମାଦରଚୋଦ: ['medrick'], ହିଞ୍ଜଡ଼ା: ['heinz', 'hienz', 'honzo'] },
	bn: { গুদমারানি: ['goddam', 'godmamma', 'gudame', 'guydom'], মাদারচোদ: ['medrick'] },
	mr: { मादरचोद: ['medrick'] },
	te: {
		దెంగు: ['dengue'],
		పంచముడు: ['panchama', 'panicum', 'pinchem'],
		మాదిగోడు: ['madge', 'madiga', 'midge', 'midgy'],
	},
	kn: {},
	ml: { കഴുവേറി: ['kajawah'] },
	pa: {
		ਭੈਣਚੋਦ: [
			'banak',
			'banc',
			'banca',
			'banchi',
			'banco',
			'banky',
			'bannock',
			'behenic',
			'benchy',
			'bianca',
			'bianchi',
			'bianco',
			'bink',
			'binukau',
			'bohunk',
			'bonaci',
			'bonce',
			'boneache',
			'bubonic',
			'bunce',
			'bunchy',
			'bunkie',
			'buoyance',
			'buoyancy',
		],
		ਭੋਸੜੀਕੇ: ['beshadow'],
		ਮਾਦਰਚੋਦ: [
			'matriarch',
			'matriarchic',
			'matriarchy',
			'matric',
			'medrick',
			'metathoracic',
			'meteoric',
			'metric',
			'mithraic',
			'mithriac',
			'motoric',
			'mythoheroic',
		],
	},
	gu: {
		બહેનચોદ: [
			'banak',
			'banc',
			'banca',
			'banchi',
			'banco',
			'banky',
			'bannock',
			'behenic',
			'benchy',
			'bianca',
			'bianchi',
			'bianco',
			'bink',
			'binukau',
			'bohunk',
			'bonaci',
			'bonce',
			'boneache',
			'bubonic',
			'bunce',
			'bunchy',
			'bunkie',
			'buoyance',
			'buoyancy',
		],
		ભોસડીના: [
			'babished',
			'based',
			'basidia',
			'basihyoid',
			'basoid',
			'beshade',
			'beshod',
			'beside',
			'bossed',
			'bushed',
			'busied',
			'busyhead',
			'byssoid',
		],
		માદરચોદ: ['medrick'],
	},
};

describe.skipIf(!haveDict)('dictionary sweep — regular inflections', () => {
	// 1.4M generated forms are too many to run the whole matcher over, so a
	// prefilter cuts them to the few thousand that can possibly match, and the
	// real matcher decides those. The prefilter is the engine's own matching
	// conditions for a plain lowercase token: its skeleton key reaches a key in
	// the tier, or it IS a Latin surface, or (prefix mode) it starts with one.
	// Repeat-collapsed forms are checked too, because the collapsed pass is a
	// second way in. The headword phase above runs the real matcher over every
	// word with no prefilter at all, so nothing rests on this being exhaustive
	// — it only extends reach to forms the word list does not carry.
	const corpus = inflectedCorpus();

	const keys = new Set<string>();
	const surfaces = new Set<string>();
	const prefixes: string[] = [];
	for (const [, pack] of PACKS) {
		for (const entry of pack.entries) {
			for (const s of [entry.lemma, ...(entry.romanizations ?? [])]) {
				if (!/^[a-z ]+$/.test(s)) continue;
				surfaces.add(s);
				if (entry.matchMode === 'prefix') prefixes.push(s);
			}
			if (entry.skeletonSafe === false) continue;
			for (const rom of entry.romanizations ?? []) {
				if (/\s/.test(rom)) continue;
				const key = skeletonKey(rom);
				if (key.length >= 4) keys.add(key);
			}
		}
	}
	const keyAc = new AhoCorasick([...keys]);
	const collapse = (w: string): string => w.replace(/(.)\1+/g, '$1');

	const candidates: string[] = [];
	for (const form of corpus.keys()) {
		const key = skeletonKey(form);
		const collapsed = collapse(form);
		if (
			(key.length >= 4 && keyAc.findAll(key).length > 0) ||
			surfaces.has(form) ||
			surfaces.has(collapsed) ||
			prefixes.some((p) => form.startsWith(p) || collapsed.startsWith(p))
		) {
			candidates.push(form);
		}
	}

	it('has candidates to confirm', () => {
		expect(corpus.size).toBeGreaterThan(1_000_000);
		expect(candidates.length).toBeGreaterThan(100);
	});

	it.each(PACKS)('%s collides with exactly the pinned headword families', (code, pack) => {
		const hits = sweep(pack, candidates);
		const byHeadword: Record<string, string[]> = {};
		for (const [lemma, forms] of Object.entries(hits)) {
			byHeadword[lemma] = [...new Set(forms.map((f) => corpus.get(f)!))].sort();
		}
		expect(byHeadword).toEqual(INFLECTION_COLLISIONS[code]);
	});
});

/**
 * The mirror of the sweep: an allow phrase is a suppression span for EVERY
 * pack, not only the one that declares it. This branch adds allow phrases in
 * bulk (the sweep-sourced English collisions), so the check that none of them
 * kills a shipped surface is the one that earns its keep here.
 *
 * The global scope is deliberate and measured — see
 * `test/collapsed-allow-scope.test.ts` for the numbers. This check is what
 * keeps it honest.
 */
describe('no pack surface is suppressed once every pack is loaded', () => {
	const all = createMatcher({ packs: PACKS.map(([, p]) => p) });

	// Empty, and it has to stay empty. It used to pin or's 'chhinali' /
	// 'chhinaali' and kn's own 'chinaali', all three killed by kn's allow
	// phrase 'chinali' — not because the phrase belongs to another pack (kn's
	// 'chinaali' is its own), but because allow spans were harvested from the
	// repeat-collapsed pass WITHOUT the stretch gate that pass's candidates
	// require. All three collapse onto exactly 'chinali'. `matcher.ts` now
	// gates both sides of that pass the same way; see
	// `test/collapsed-allow-scope.test.ts` for the direct coverage.
	const KNOWN_DEAD: Record<string, string[]> = {};

	it.each(PACKS)('%s keeps every one of its surfaces matched', (code, pack) => {
		const dead: string[] = [];
		for (const entry of pack.entries) {
			for (const s of [entry.lemma, ...(entry.variants ?? []), ...(entry.romanizations ?? [])]) {
				if (all.isClean(s)) dead.push(s);
			}
		}
		expect(dead).toEqual(KNOWN_DEAD[code] ?? []);
	});
});
