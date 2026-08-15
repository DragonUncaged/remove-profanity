/**
 * remove-profanity — independent evasion / false-positive battery.
 *
 * Runner. The battery itself (taxonomy, the transform matrix, the per-language
 * suites, and what each rival claims) is `battery.mjs`. The reasoning behind
 * the design is `METHODOLOGY.md`. Read those two first — this file only counts.
 *
 * The taxonomy was written before any case, and every case cites the axis it
 * instantiates (asserted at startup). Nothing is copied from another profanity
 * library's tests, README or issue tracker. Most evasion cases are GENERATED:
 * `battery.mjs` declares one transform function per language-independent axis
 * and this file applies the whole list to every language, so no author choice
 * decides which transforms a language receives — the defect an audit found in
 * the first version of this battery, where the replicated slice turned out to
 * be almost exactly the set of transforms the engine passes. **The battery
 * deliberately contains cases this package fails**, they are not annotated as
 * expected, and the KNOWN GAPS section is derived from the run rather than
 * hand-written. Rivals are run in their maximum *claimed* configuration. The
 * head-to-head number is English, which all six libraries claim; the
 * multi-language card is reported separately and is explicitly not a
 * like-for-like comparison. A false positive counts everywhere.
 *
 * Usage:
 *   npm run build && node benchmark/compare.mjs      # every shipped pack
 *   RP_PACKS=hi,en node benchmark/compare.mjs        # a subset
 *   RP_SKIP_DICT=1 node benchmark/compare.mjs        # skip the dictionary sweep
 *   RP_DICT=headwords node benchmark/compare.mjs     # sweep headwords only (fast)
 *   RP_SKIP_PERF=1 node benchmark/compare.mjs        # skip the timing section
 *
 * RP_PACKS selects which packs remove-profanity loads AND which per-language
 * suites run, so a subset run stays internally consistent.
 *
 * Adding a language pack: one entry in AVAILABLE_PACKS here, one suite in
 * battery.mjs, one entry in LIBRARY_CLAIMS['remove-profanity'].packs. Nothing
 * else in either file is language-aware. See docs/language-packs.md, step 8.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createMatcher } from '../dist/index.js';
// Internal build paths, imported for ONE measurement only: the early-exit
// anatomy block reproduces the per-text preparation `passesFor` runs before
// any matching begins — the code-unit array and profile, then the three
// eager fold passes over it — so the section can price it instead of
// asserting it. Nothing else in this file reaches past the public entry point.
import { baseFoldUnits } from '../dist/unicode/normalize.js';
import { latinFoldUnits, collapseAllRepeatsFoldUnits } from '../dist/folds/latin.js';
import { chainFolds, unitTextOf, unitTextOfResult } from '../dist/types.js';
import { hindi } from '../dist/data/hi.js';
import { english } from '../dist/data/en.js';
import { tamil } from '../dist/data/ta.js';
import { telugu } from '../dist/data/te.js';
import { kannada } from '../dist/data/kn.js';
import { malayalam } from '../dist/data/ml.js';
import { odia } from '../dist/data/or.js';
import { bengali } from '../dist/data/bn.js';
import { marathi } from '../dist/data/mr.js';
import { punjabi } from '../dist/data/pa.js';
import { gujarati } from '../dist/data/gu.js';
import { AllProfanity } from 'allprofanity';
import leo from 'leo-profanity';
import { Filter as BadWordsFilter } from 'bad-words';
import {
	RegExpMatcher,
	englishDataset,
	englishRecommendedTransformers,
} from 'obscenity';
import { Profanity as TwoToadProfanity } from '@2toad/profanity';
import {
	TAXONOMY,
	LIBRARY_CLAIMS,
	LANGUAGE_SUITES,
	CROSS_LANGUAGE_SUITE,
	LATIN_MATRIX,
	NATIVE_MATRIX,
} from './battery.mjs';

const AVAILABLE_PACKS = {
	hi: hindi,
	en: english,
	ta: tamil,
	or: odia,
	bn: bengali,
	mr: marathi,
	te: telugu,
	kn: kannada,
	ml: malayalam,
	pa: punjabi,
	gu: gujarati,
};
const packNames = (process.env.RP_PACKS ?? Object.keys(AVAILABLE_PACKS).join(','))
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);
const packs = packNames.map((n) => {
	const pack = AVAILABLE_PACKS[n];
	if (!pack) throw new Error(`unknown pack "${n}" (have: ${Object.keys(AVAILABLE_PACKS)})`);
	return pack;
});
const rpLemmas = packs.reduce((n, p) => n + p.entries.length, 0);

/**
 * One thunk per library that performs its full setup in its benchmarked
 * configuration and returns the object the checks run against. Timing the
 * *construction* of every rival, not just this package's, is what lets a
 * reader separate the cold-start cost from the per-check cost — the two
 * numbers point in opposite directions for several of these libraries.
 *
 * @2toad claims Hindi among twelve locales, so Hindi is enabled rather than
 * left at its English-only default. `unicodeWordBoundaries` is enabled too:
 * its default `(?:\b|_)` boundary is ASCII, under which a Devanagari entry
 * cannot match anything at all — not even itself handed back verbatim.
 * Running it at the default would have scored a configuration flag rather
 * than the library.
 */
const BUILDERS = {
	'remove-profanity': () => createMatcher({ packs }),
	allprofanity: () => {
		const a = new AllProfanity({ silent: true }); // ships english + hindi loaded
		a.loadIndianLanguages(); // + bengali, tamil, telugu — all claimed in its README
		return a;
	},
	obscenity: () =>
		new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers }),
	// leo's dictionary is a module singleton already loaded at import, so the
	// honest analogue of a constructor is an explicit load of the same list.
	// It is behaviourally a no-op: 'en' is what import leaves loaded, and the
	// word count is identical either side.
	'leo-profanity': () => {
		leo.loadDictionary('en');
		return leo;
	},
	'bad-words': () => new BadWordsFilter(),
	'@2toad/profanity': () =>
		new TwoToadProfanity({ languages: ['en', 'hi'], unicodeWordBoundaries: true }),
};

/** First construction in a fresh process — the serverless cold-start figure. */
const coldBuildMs = {};
const built = {};
for (const [name, build] of Object.entries(BUILDERS)) {
	const t0 = performance.now();
	built[name] = build();
	coldBuildMs[name] = performance.now() - t0;
}
const rp = built['remove-profanity'];
const ap = built.allprofanity;
const obscenityMatcher = built.obscenity;
const badWords = built['bad-words'];
const twoToad = built['@2toad/profanity'];

const libs = {
	'remove-profanity': (t) => !rp.isClean(t),
	allprofanity: (t) => ap.check(t),
	obscenity: (t) => obscenityMatcher.hasMatch(t),
	'leo-profanity': (t) => leo.check(t),
	'bad-words': (t) => {
		try {
			return badWords.isProfane(t);
		} catch {
			return 'ERR';
		}
	},
	'@2toad/profanity': (t) => twoToad.exists(t),
};

const names = Object.keys(libs);
const claimedLangs = Object.fromEntries(
	names.map((n) => [n, new Set(LIBRARY_CLAIMS[n]?.packs ?? [])]),
);

// Case expansion — generated matrix + named cases
//
// The whole LATIN_MATRIX is applied to every language and the whole
// NATIVE_MATRIX to every language that has a native script. Nothing here
// consults the language, the pack, or any library's behaviour. When a
// transform is inapplicable to every base a language declares (no
// leet-mappable letter, no doubled letter, no base short enough) the axis is
// recorded as INAPPLICABLE for that language and printed, so the gap is
// visible rather than silent.

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].map((g) => g.segment);

/** Per language: {cases, inapplicable, collapsed, counts}. */
function expandEvasion(suite) {
	const cases = [];
	const seen = new Set();
	const inapplicable = [];
	let collapsed = 0;
	const counts = { control: 0, generated: 0, generatedNative: 0, named: 0 };
	const add = (axis, label, text, kind) => {
		if (text === null || text === undefined) return;
		if (seen.has(text)) {
			collapsed += 1;
			return;
		}
		seen.add(text);
		cases.push({ axis, label, text, kind });
		counts[kind] += 1;
	};

	for (const w of suite.latin) add('E0', `control (latin): ${w}`, w, 'control');
	for (const w of suite.native) add('E0', `control (native): ${w}`, w, 'control');
	for (const [label, text] of suite.sentences) add('E0', label, text, 'control');

	for (const [axis, label, fn] of LATIN_MATRIX) {
		let out = null;
		for (const w of suite.latin) {
			out = fn(w);
			if (out !== null && out !== undefined) break;
		}
		if (out === null || out === undefined) inapplicable.push(`${axis} (latin)`);
		else add(axis, label, out, 'generated');
	}

	for (const [axis, label, fn] of NATIVE_MATRIX) {
		let out = null;
		for (const w of suite.native) {
			out = fn(graphemes(w));
			if (out !== null && out !== undefined) break;
		}
		if (out === null || out === undefined) {
			if (suite.native.length > 0) inapplicable.push(`${axis} (native)`);
		} else add(axis, `native: ${label}`, out, 'generatedNative');
	}

	for (const [axis, label, text] of suite.mix) add(axis, label, text, 'named');
	for (const [axis, label, text] of suite.named) add(axis, label, text, 'named');

	return { cases, inapplicable, collapsed, counts };
}

const suites = [];
const composition = [];
for (const code of packNames) {
	const suite = LANGUAGE_SUITES[code];
	if (!suite) {
		console.warn(`(no battery suite defined for pack "${code}" — add one to battery.mjs)`);
		continue;
	}
	const ev = expandEvasion(suite);
	composition.push({ code, ...ev });
	suites.push({
		key: `${code}-evasion`,
		lang: code,
		title: `${suite.name} — evasion`,
		kind: 'profane',
		cases: ev.cases,
	});
	suites.push({
		key: `${code}-clean`,
		lang: code,
		title: `${suite.name} — clean traps`,
		kind: 'clean',
		cases: suite.clean.map(([axis, label, text]) => ({ axis, label, text, kind: 'named' })),
	});
}
// The cross-language suite only means anything with several packs loaded.
if (packNames.length > 1) {
	suites.push({
		key: 'cross-clean',
		lang: 'cross',
		title: `${CROSS_LANGUAGE_SUITE.name} — clean traps`,
		kind: 'clean',
		cases: CROSS_LANGUAGE_SUITE.clean.map(([axis, label, text]) => ({
			axis,
			label,
			text,
			kind: 'named',
		})),
	});
}

/** Every case must cite a declared axis, and every axis should have a case. */
const axisUse = new Map(Object.keys(TAXONOMY).map((a) => [a, 0]));
const undeclared = new Set();
for (const suite of suites) {
	for (const c of suite.cases) {
		if (!axisUse.has(c.axis)) undeclared.add(`${c.axis} (${suite.key}: ${c.label})`);
		else axisUse.set(c.axis, axisUse.get(c.axis) + 1);
	}
}
if (undeclared.size > 0) {
	throw new Error(
		`case cites an axis that is not in TAXONOMY:\n  ${[...undeclared].join('\n  ')}`,
	);
}
const unusedAxes = [...axisUse].filter(([, n]) => n === 0).map(([a]) => a);

/**
 * No clean text may appear in two clean suites. The previous version of this
 * battery counted 367 clean "cases" of which 60 were the same text repeated
 * two to four times, which inflated the denominator and made a headline claim
 * ("more clean cases than evasion cases") true only because of the padding.
 * This throws rather than warns, so the count is always a count of distinct
 * texts.
 */
{
	const where = new Map();
	const dupes = [];
	for (const suite of suites.filter((s) => s.kind === 'clean')) {
		for (const c of suite.cases) {
			const prev = where.get(c.text);
			if (prev) dupes.push(`"${c.text}" in ${prev} and ${suite.key}`);
			else where.set(c.text, suite.key);
		}
	}
	if (dupes.length > 0) {
		throw new Error(
			`clean text counted more than once (${dupes.length}):\n  ${dupes.join('\n  ')}`,
		);
	}
}

const pad = (s, n) => String(s).padEnd(n);
const W = 18;
const pct = (n, d) => (d === 0 ? '  n/a' : `${((100 * n) / d).toFixed(0)}%`);

/**
 * Render a case's text so a reader can audit it: anything invisible,
 * whitespace-like or homoglyph-prone is shown as an escape, everything else
 * (including native Indic script) is shown literally.
 */
const SHOW_ESCAPED = (cp) =>
	cp < 0x20 || // control
	cp === 0x00ad || // soft hyphen
	(cp >= 0x0300 && cp <= 0x036f) || // combining diacriticals
	(cp >= 0x0400 && cp <= 0x04ff) || // Cyrillic
	(cp >= 0x0370 && cp <= 0x03ff) || // Greek
	(cp >= 0x00c0 && cp <= 0x024f) || // Latin-1 letters + Latin Extended-A/B
	cp === 0x034f ||
	(cp >= 0x200b && cp <= 0x200f) ||
	cp === 0x2060 ||
	cp === 0xfeff ||
	(cp >= 0xfe00 && cp <= 0xfe0f);
const show = (text) => {
	let out = '';
	for (const ch of text) {
		const cp = ch.codePointAt(0);
		out += SHOW_ESCAPED(cp)
			? `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`
			: ch;
	}
	return out;
};

/** score[library][suiteKey] = hits (profane suites) or false positives (clean). */
const score = Object.fromEntries(
	names.map((n) => [n, Object.fromEntries(suites.map((s) => [s.key, 0]))]),
);
/** result[library][text] = boolean, for the axis rollups. */
const resultByText = Object.fromEntries(names.map((n) => [n, new Map()]));
/** Every evasion case remove-profanity missed, and every clean case it flagged. */
const rpMisses = [];
const rpFalsePositives = [];
/** tier -> number of evasion cases remove-profanity resolved at that tier. */
const tierCounts = new Map();

console.log(
	`remove-profanity battery — packs [${packNames.join(', ')}], ` +
		`${rpLemmas} lemmas, node ${process.version} on ${process.platform}/${process.arch}\n` +
		`generated ${new Date().toISOString()}\n` +
		`\nThis battery is designed and owned by this project. Nothing in it is taken from\n` +
		`another library's tests, README or issue tracker, and it deliberately includes\n` +
		`cases remove-profanity fails. Most evasion cases are generated by applying one\n` +
		`transform function per taxonomy axis to every language, so no author choice\n` +
		`decides which transforms a language receives. See benchmark/METHODOLOGY.md.`,
);

console.log('\n=== WHAT EACH LIBRARY CLAIMS ===');
console.log(
	'Scored primarily on the languages it claims. A miss on unclaimed ground is\n' +
		'reported as coverage not attempted; a false positive counts everywhere.\n',
);
for (const n of names) {
	const c = LIBRARY_CLAIMS[n];
	console.log(`${n} ${c.version}`);
	console.log(`  claims : ${c.claims}`);
	console.log(`  source : ${c.source}`);
	console.log(`  suites : ${c.packs.join(', ')}`);
}

console.log('\n\n=== BATTERY COMPOSITION — how each language suite was built ===');
console.log(
	'generated = one case per taxonomy axis, produced by the same transform\n' +
		'functions for every language. named = hand-written, for the axes a function\n' +
		'cannot express (morphology, transliteration spread, script doublets, lexicon).\n' +
		'A high named count relative to generated is what selective case-writing would\n' +
		'look like, so the numbers are printed rather than described.\n',
);
console.log(
	pad('pack', 8) +
		pad('control', 10) +
		pad('generated', 12) +
		pad('gen-native', 12) +
		pad('named', 8) +
		pad('total', 8) +
		pad('collapsed', 11) +
		'inapplicable axes',
);
for (const c of composition) {
	const total = c.counts.control + c.counts.generated + c.counts.generatedNative + c.counts.named;
	console.log(
		pad(c.code, 8) +
			pad(c.counts.control, 10) +
			pad(c.counts.generated, 12) +
			pad(c.counts.generatedNative, 12) +
			pad(c.counts.named, 8) +
			pad(total, 8) +
			pad(c.collapsed, 11) +
			(c.inapplicable.join(' ') || '(none)'),
	);
}
console.log(
	'\ncollapsed = a generated case that came out identical to another case in the\n' +
		'same suite and was counted once, not twice.',
);

let suiteNo = 0;
for (const suite of suites) {
	suiteNo += 1;
	const want = suite.kind === 'profane';
	console.log(
		`\n=== SUITE ${suiteNo}: ${suite.title} — want ${want ? 'HIT' : 'ok'} ===`,
	);
	console.log(
		pad('axis', 7) + pad('case', 35) + names.map((n) => pad(n, W)).join('') + 'text',
	);
	for (const c of suite.cases) {
		const row = names.map((n) => {
			const r = libs[n](c.text);
			resultByText[n].set(c.text, r === true);
			if (r === true) score[n][suite.key] += 1;
			const mark =
				r === 'ERR' ? 'ERR' : want ? (r === true ? 'HIT' : '.') : r === true ? 'FP!' : 'ok';
			return pad(mark, W);
		});
		// remove-profanity detail: which tier fired, and what it missed / flagged.
		const { matches } = rp.scan(c.text);
		if (want) {
			if (matches.length === 0) {
				rpMisses.push({ suite: suite.key, axis: c.axis, label: c.label, text: c.text, kind: c.kind });
			} else {
				for (const t of new Set(matches.map((m) => m.tier))) {
					tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
				}
			}
		} else if (matches.length > 0) {
			rpFalsePositives.push({
				suite: suite.key,
				axis: c.axis,
				label: c.label,
				text: c.text,
				matched: matches.map((m) => `${m.surface}→${m.lemma}/${m.tier}`).join(', '),
			});
		}
		console.log(pad(c.axis, 7) + pad(c.label, 35) + row.join('') + show(c.text));
	}
}

const evasionSuites = suites.filter((s) => s.kind === 'profane');
const cleanSuites = suites.filter((s) => s.kind === 'clean');
const sum = (lib, list) => list.reduce((a, s) => a + score[lib][s.key], 0);
const casesIn = (list) => list.reduce((a, s) => a + s.cases.length, 0);
const claimed = (lib, list) => list.filter((s) => claimedLangs[lib].has(s.lang));
const unclaimed = (lib, list) => list.filter((s) => !claimedLangs[lib].has(s.lang));

const enSuite = evasionSuites.find((s) => s.lang === 'en');

if (enSuite) {
	console.log('\n\n=== SCORECARD A — ENGLISH EVASION, HEAD TO HEAD ===');
	console.log(
		'THE number to compare libraries on. English is the only language all six\n' +
			'claim, so it is the only place where the same cases are scored against the\n' +
			'same advertised capability. The generated column is the subset produced by\n' +
			'the transform matrix, which no author choice touched.\n',
	);
	const gen = enSuite.cases.filter((c) => c.kind === 'generated');
	const named = enSuite.cases.filter((c) => c.kind === 'named');
	const ctrl = enSuite.cases.filter((c) => c.kind === 'control');
	const tally = (lib, list) => list.filter((c) => resultByText[lib].get(c.text)).length;
	console.log(
		pad('library', 20) +
			pad(`all /${enSuite.cases.length}`, 12) +
			pad('rate', 8) +
			pad(`generated /${gen.length}`, 16) +
			pad('rate', 8) +
			pad(`named /${named.length}`, 12) +
			pad(`control /${ctrl.length}`, 12),
	);
	const ranked = [...names].sort(
		(a, b) => tally(b, enSuite.cases) - tally(a, enSuite.cases),
	);
	for (const n of ranked) {
		console.log(
			pad(n, 20) +
				pad(tally(n, enSuite.cases), 12) +
				pad(pct(tally(n, enSuite.cases), enSuite.cases.length), 8) +
				pad(tally(n, gen), 16) +
				pad(pct(tally(n, gen), gen.length), 8) +
				pad(tally(n, named), 12) +
				pad(tally(n, ctrl), 12),
		);
	}

	console.log('\n--- per-axis, English: which axes each library resolves ---');
	console.log('(axis — cases; a library scores the number of that axis\'s cases it caught)\n');
	const byAxis = new Map();
	for (const c of enSuite.cases) {
		if (!byAxis.has(c.axis)) byAxis.set(c.axis, []);
		byAxis.get(c.axis).push(c);
	}
	console.log(pad('axis', 8) + pad('n', 4) + names.map((n) => pad(n, W)).join('') + 'description');
	for (const [axis, list] of byAxis) {
		const row = names
			.map((n) => pad(list.filter((c) => resultByText[n].get(c.text)).length, W))
			.join('');
		console.log(pad(axis, 8) + pad(list.length, 4) + row + TAXONOMY[axis]);
	}
}

console.log('\n\n=== SCORECARD B — EVASION ON EVERY LANGUAGE A LIBRARY CLAIMS ===');
console.log(
	'NOT a like-for-like comparison, and it must not be quoted as one: the\n' +
		'denominators differ, and remove-profanity is scored on ten languages no rival\n' +
		'contests. It answers a different question — "across everything this library\n' +
		'says it does, how much does it catch?" — and the per-suite detail below is\n' +
		'where the comparable numbers are.\n',
);
console.log(pad('library', 20) + pad('claimed suites', 42) + pad('cases', 8) + pad('caught', 8) + 'rate');
for (const n of names) {
	const list = claimed(n, evasionSuites);
	const total = casesIn(list);
	const got = sum(n, list);
	const langs = list.map((s) => s.lang).join(',') || '(none)';
	console.log(
		pad(n, 20) + pad(langs, 42) + pad(total, 8) + pad(got, 8) + pct(got, total),
	);
}

console.log('\n=== SCORECARD C — COVERAGE THE OTHER LIBRARIES DO NOT ATTEMPT ===');
console.log(
	'Evasion suites for languages the library never claimed. A zero here is not a\n' +
		'defeat — it is a language the library does not advertise. Shown so the\n' +
		'India-focused rows are read as coverage, not as losses.\n',
);
console.log(pad('library', 20) + pad('unclaimed suites', 42) + pad('cases', 8) + pad('caught', 8) + 'rate');
for (const n of names) {
	const list = unclaimed(n, evasionSuites);
	const total = casesIn(list);
	const got = sum(n, list);
	const langs = list.map((s) => s.lang).join(',') || '(none — claims every suite)';
	console.log(
		pad(n, 20) + pad(langs, 42) + pad(total, 8) + pad(got, 8) + pct(got, total),
	);
}

console.log('\n=== SCORECARD D — FALSE POSITIVES, COUNTED EVERYWHERE ===');
console.log(
	'All clean suites, claimed language or not: a filter that flags Malayalam prose\n' +
		"while claiming only English is still breaking its user's app. Every text here\n" +
		'is distinct — the runner throws if one is counted twice.\n',
);
console.log(pad('library', 20) + pad('clean cases', 14) + pad('false pos', 12) + 'FP rate');
for (const n of names) {
	const total = casesIn(cleanSuites);
	const fp = sum(n, cleanSuites);
	console.log(pad(n, 20) + pad(total, 14) + pad(fp, 12) + pct(fp, total));
}

console.log('\n=== PER-SUITE DETAIL ===');
console.log(pad('suite', 34) + names.map((n) => pad(n, W)).join(''));
for (const suite of suites) {
	const isProfane = suite.kind === 'profane';
	const label = `${isProfane ? 'caught' : 'false pos'}: ${suite.key} /${suite.cases.length}`;
	const row = names.map((n) => {
		const cell = String(score[n][suite.key]);
		return pad(claimedLangs[n].has(suite.lang) || !isProfane ? cell : `${cell} (n/c)`, W);
	});
	console.log(pad(label, 34) + row.join(''));
}
console.log('\n(n/c = the library does not claim that language; the miss is not counted against it)');

console.log('');
console.log(
	pad(`evasion cases /${casesIn(evasionSuites)} (all languages)`, 38) +
		names.map((n) => pad(sum(n, evasionSuites), W)).join(''),
);
console.log(
	'  ^ NOT a scorecard. Ten of the eleven suites are on ground five of the six\n' +
		'    libraries never claimed, so this row compares nothing. Scorecard A does.',
);
console.log(
	pad(`false positives /${casesIn(cleanSuites)}`, 38) +
		names.map((n) => pad(sum(n, cleanSuites), W)).join(''),
);

// Derived: what remove-profanity got wrong
//
// Both lists are computed from the run above. They are NOT a hand-maintained
// list of blessed exceptions, and no case in battery.mjs is annotated as an
// expected failure — which is the mechanism that stops a failing case from
// being quietly downgraded to "known" instead of being fixed or reported.

console.log('\n\n=== KNOWN GAPS — evasion cases remove-profanity MISSED (derived from this run) ===');
console.log(`${rpMisses.length} of ${casesIn(evasionSuites)} evasion cases missed.\n`);
console.log(pad('axis', 7) + pad('suite', 14) + pad('case', 34) + 'text');
for (const m of rpMisses) {
	console.log(pad(m.axis, 7) + pad(m.suite, 14) + pad(m.label, 34) + show(m.text));
}
const missByAxis = new Map();
for (const m of rpMisses) missByAxis.set(m.axis, (missByAxis.get(m.axis) ?? 0) + 1);
console.log('\nmisses per axis (axis — missed/total):');
for (const [axis, n] of [...missByAxis].sort()) {
	console.log(`  ${pad(axis, 8)} ${pad(`${n}/${axisUse.get(axis)}`, 8)} ${TAXONOMY[axis]}`);
}

// A missed E0 control is a WORD-LIST gap, not a transform gap: the plain,
// untransformed base form is not in the dictionary. Separating the two is the
// whole reason the controls are scored rather than hidden in a setup step, so
// the attribution is printed rather than left for a reader to work out.
{
	const controlMisses = rpMisses.filter((m) => m.axis === 'E0');
	console.log(
		`\ncontrol failures — base forms not listed at all (${controlMisses.length} of ` +
			`${axisUse.get('E0')} E0 cases). Every miss on a transform of one of these bases is\n` +
			'a word-list gap rather than a transform gap:',
	);
	if (controlMisses.length === 0) console.log('  (none — every declared base form is listed)');
	for (const m of controlMisses) {
		console.log(`  ${pad(m.suite, 14)} ${pad(m.label, 34)} ${show(m.text)}`);
	}
}

console.log('\n=== FALSE POSITIVES remove-profanity produced (derived from this run) ===');
if (rpFalsePositives.length === 0) {
	console.log(`0 of ${casesIn(cleanSuites)} clean cases flagged.`);
} else {
	console.log(`${rpFalsePositives.length} of ${casesIn(cleanSuites)} clean cases flagged.\n`);
	console.log(pad('axis', 7) + pad('suite', 14) + pad('case', 28) + pad('matched', 40) + 'text');
	for (const f of rpFalsePositives) {
		console.log(
			pad(f.axis, 7) + pad(f.suite, 14) + pad(f.label, 28) + pad(f.matched, 40) + show(f.text),
		);
	}
}

// Allowlist dependence
//
// An audit found that this battery's riskiest clean axis was testing the
// engine's allowlist rather than the axis it declared: for three caste terms
// the clean case was the exact phrase the pack allowlists ("the Chamar
// Regiment was raised in 1943") while ordinary use of the same term was a
// false positive. A case that only passes because its text contains an
// allowlist phrase is measuring the allowlist, and the reader deserves to
// know which ones those are without taking the author's word for it. This is
// computed from the shipped pack data, not maintained by hand.

{
	// Not "does the text contain an allow phrase" — that over-reports wildly,
	// because most of the shipped phrases suppress nothing and the whole-token
	// boundary rule is what keeps the case clean. The measurement is the
	// counterfactual: rebuild the matcher with every pack-wide and per-entry
	// allowlist emptied, and see which clean cases flip to a false positive.
	const stripped = packs.map((p) => ({
		...p,
		allowlist: [],
		entries: p.entries.map((e) => ({ ...e, allowlist: [] })),
	}));
	const rpNoAllow = createMatcher({ packs: stripped });
	const dependent = [];
	let alreadyFp = 0;
	for (const suite of cleanSuites) {
		for (const c of suite.cases) {
			const cleanNow = rp.isClean(c.text);
			if (!cleanNow) {
				alreadyFp += 1;
				continue;
			}
			if (!rpNoAllow.isClean(c.text)) {
				dependent.push({
					suite: suite.key,
					axis: c.axis,
					label: c.label,
					text: c.text,
					matched: rpNoAllow
						.scan(c.text)
						.matches.map((m) => `${m.surface}→${m.lemma}/${m.tier}`)
						.join(', '),
				});
			}
		}
	}
	const total = casesIn(cleanSuites);
	console.log('\n=== ALLOWLIST DEPENDENCE — clean cases that an allow phrase is carrying ===');
	console.log(
		'Measured by rebuilding the matcher with every allowlist emptied and re-running\n' +
			'the clean side. A case that flips to a false positive is a case the allowlist\n' +
			'is carrying; a case that stays clean is carried by the whole-token boundary\n' +
			'rule instead. An audit found the previous battery testing three caste terms\n' +
			'in the exact collocation each pack allowlists, which measured the allowlist\n' +
			'rather than the axis. This is how that is now visible instead of promised.\n',
	);
	console.log(
		`  ${pad('clean cases', 32)}${total}\n` +
			`  ${pad('false positive as shipped', 32)}${alreadyFp}\n` +
			`  ${pad('carried by an allowlist', 32)}${dependent.length}  (${pct(dependent.length, total)})\n` +
			`  ${pad('carried by the boundary rule', 32)}${total - alreadyFp - dependent.length}`,
	);
	if (dependent.length > 0) {
		console.log(
			`\n${pad('axis', 7) + pad('suite', 14) + pad('case', 28) + pad('what fires without it', 42)}text`,
		);
		for (const h of dependent) {
			console.log(
				pad(h.axis, 7) + pad(h.suite, 14) + pad(h.label, 28) + pad(h.matched, 42) + show(h.text),
			);
		}
		const byAxis = new Map();
		for (const h of dependent) byAxis.set(h.axis, (byAxis.get(h.axis) ?? 0) + 1);
		console.log('\nper clean axis (axis — allowlist-carried/total):');
		for (const [axis, n] of [...byAxis].sort()) {
			console.log(`  ${pad(axis, 6)} ${n}/${axisUse.get(axis)}`);
		}
	}
}

console.log('\n=== TIER COVERAGE — which matching tier resolved each caught evasion case ===');
console.log('(a case can be counted under more than one tier if it produced several matches)\n');
for (const tier of ['exact', 'masked', 'separated', 'skeleton']) {
	const n = tierCounts.get(tier) ?? 0;
	console.log(`  ${pad(tier, 12)} ${pad(n, 6)}${n === 0 ? '  <-- TIER NOT EXERCISED' : ''}`);
}

// Pack isolation: one pack alone vs every pack loaded
//
// A consumer may import a single subpath, so the single-pack configuration is
// a shipped configuration and has to be measured. It can differ in both
// directions: a pack alone may miss a word it borrows from a neighbour, and a
// pack alone is free of the other packs' allow phrases, which are global once
// loaded and can suppress a lemma that is another language's ordinary word.

if (packNames.length > 1) {
	console.log('\n\n=== PACK ISOLATION — <pack> alone vs all packs loaded ===');
	console.log(
		'delta = (alone) - (all loaded). Negative caught = the pack needs a neighbour.\n' +
			"Positive FP = another pack's entry fires on this language's clean text.\n" +
			"Negative FP = another pack's allow phrase is suppressing a match.\n",
	);
	console.log(
		pad('pack', 8) +
			pad('caught alone', 15) +
			pad('caught all', 13) +
			pad('delta', 8) +
			pad('FP alone', 11) +
			pad('FP all', 9) +
			'delta',
	);
	for (const suite of evasionSuites) {
		const code = suite.lang;
		const cleanSuite = cleanSuites.find((s) => s.key === `${code}-clean`);
		const solo = createMatcher({ packs: [AVAILABLE_PACKS[code]] });
		const soloHit = suite.cases.filter((c) => !solo.isClean(c.text)).length;
		const soloFp = cleanSuite.cases.filter((c) => !solo.isClean(c.text)).length;
		const allHit = score['remove-profanity'][suite.key];
		const allFp = score['remove-profanity'][cleanSuite.key];
		const d = (n) => (n > 0 ? `+${n}` : String(n));
		console.log(
			pad(code, 8) +
				pad(`${soloHit}/${suite.cases.length}`, 15) +
				pad(`${allHit}/${suite.cases.length}`, 13) +
				pad(d(soloHit - allHit), 8) +
				pad(`${soloFp}/${cleanSuite.cases.length}`, 11) +
				pad(`${allFp}/${cleanSuite.cases.length}`, 9) +
				d(soloFp - allFp),
		);
	}
}

// C14 — the dictionary sweep
//
// The largest clean-text measurement here, and the fairest single number in
// the document: every library claims English, so all six are on claimed
// ground. Reported apart from the headline totals because it would otherwise
// swamp them, and because it is an UPPER BOUND on false positives rather than
// a pure count — the dictionary genuinely contains a handful of profane
// English words. The "flagged by >= 4 libraries" / "flagged by exactly one"
// split is printed so a reader can separate consensus from idiosyncrasy
// without taking anyone's word for which is which.
//
// The corpus is deliberately wider than the headword list. An audit showed
// that `web2` alone cannot see `shuddered`, `calloused`, `chain-pull` or
// `can-polishing`, because it contains "shudder", "callous" and neither
// compound; the forms that actually collide are the INFLECTIONS and the
// COMPOUNDS, so the sweep covers headwords + regular inflections + `web2a`.

const DICT = '/usr/share/dict/web2';
const DICT_A = '/usr/share/dict/web2a';
let sweptDict = false;
if (!process.env.RP_SKIP_DICT && existsSync(DICT)) {
	sweptDict = true;
	const headwords = [
		...new Set(
			readFileSync(DICT, 'utf8')
				.split('\n')
				.map((w) => w.trim())
				.filter((w) => w.length > 0),
		),
	];
	/** Regular English inflections; over-produces non-words, which is harmless. */
	const inflect = (w) => {
		if (!/^[a-z]+$/.test(w) || w.length < 3) return [];
		const out = [`${w}s`, `${w}ly`];
		if (/(s|x|z|ch|sh)$/.test(w)) out.push(`${w}es`, `${w}ed`);
		if (/[^aeiou]y$/.test(w)) out.push(`${w.slice(0, -1)}ies`, `${w.slice(0, -1)}ied`);
		if (w.endsWith('e')) out.push(`${w}d`, `${w}r`, `${w}st`, `${w.slice(0, -1)}ing`);
		else out.push(`${w}ed`, `${w}ing`, `${w}er`, `${w}est`);
		return out;
	};
	const inflections = [];
	const compounds = [];
	const seen = new Set(headwords.map((w) => w.toLowerCase()));
	const level = process.env.RP_DICT ?? 'full';
	if (level === 'full') {
		for (const h of headwords) {
			for (const f of inflect(h.toLowerCase())) {
				if (!seen.has(f)) {
					seen.add(f);
					inflections.push(f);
				}
			}
		}
		if (existsSync(DICT_A)) {
			for (const line of readFileSync(DICT_A, 'utf8').split('\n')) {
				const w = line.trim();
				if (w.length > 0 && !seen.has(w.toLowerCase())) {
					seen.add(w.toLowerCase());
					compounds.push(w);
				}
			}
		}
	}
	const corpus = [...headwords, ...inflections, ...compounds];
	// Which slice a form came from, so the report can separate a hit on a REAL
	// dictionary entry from a hit on a form the inflection generator invented.
	// The generator deliberately over-produces ("naemorhedusest"), so a
	// skeleton collision with one of those is noise; a collision with a real
	// headword or a real compound is a false positive a user would meet.
	const originOf = new Map();
	for (const w of headwords) originOf.set(w, 'headword');
	for (const w of inflections) originOf.set(w, 'inflection');
	for (const w of compounds) originOf.set(w, 'compound');
	console.log(
		`\n\n=== C14 — dictionary sweep (${corpus.length} forms: ${headwords.length} web2 headwords` +
			`${level === 'full' ? ' + regular inflections + web2a compounds' : ''}) ===`,
	);
	const flagged = Object.fromEntries(names.map((n) => [n, []]));
	const t0 = performance.now();
	for (const w of corpus) {
		for (const n of names) {
			if (libs[n](w) === true) flagged[n].push(w);
		}
	}
	const sweepMs = performance.now() - t0;
	const votes = new Map();
	for (const n of names) for (const w of flagged[n]) votes.set(w, (votes.get(w) ?? 0) + 1);
	console.log(
		`swept in ${(sweepMs / 1000).toFixed(1)} s\n\n` +
			pad('library', 20) +
			pad('flagged', 10) +
			pad('rate', 10) +
			pad('consensus (>=4 libs)', 22) +
			'unique to this library',
	);
	for (const n of names) {
		const list = flagged[n];
		const consensus = list.filter((w) => votes.get(w) >= 4).length;
		const solo = list.filter((w) => votes.get(w) === 1).length;
		console.log(
			pad(n, 20) +
				pad(list.length, 10) +
				pad(`${((100 * list.length) / corpus.length).toFixed(3)}%`, 10) +
				pad(consensus, 22) +
				solo,
		);
	}

	if (level === 'full') {
		console.log(
			`\nSplit by what the form is. Only the first two columns are real English a\n` +
				'user could type; the third is the inflection generator over-producing, where\n' +
				'a collision is noise rather than a false positive.\n',
		);
		console.log(
			pad('library', 20) +
				pad(`headwords /${headwords.length}`, 20) +
				pad(`compounds /${compounds.length}`, 20) +
				`generated /${inflections.length}`,
		);
		for (const n of names) {
			const by = { headword: 0, compound: 0, inflection: 0 };
			for (const w of flagged[n]) by[originOf.get(w)] += 1;
			console.log(
				pad(n, 20) + pad(by.headword, 20) + pad(by.compound, 20) + by.inflection,
			);
		}
	}
	// Evenly spaced rather than the first 25: the word list is alphabetical, so
	// a head slice of obscenity's hits is 25 words beginning "anal-" and reads
	// as one family when it is not.
	const spacedSample = (list, k) => {
		if (list.length <= k) return list;
		const step = list.length / k;
		return Array.from({ length: k }, (_, i) => list[Math.floor(i * step)]);
	};
	console.log(
		'\nWords flagged by exactly one library (evenly spaced sample of up to 30) — the idiosyncratic set:',
	);
	for (const n of names) {
		const solo = flagged[n].filter((w) => votes.get(w) === 1);
		console.log(
			`  ${pad(n, 20)} ${solo.length === 0 ? '(none)' : `${solo.length} forms: ${spacedSample(solo, 30).join(' ')}`}`,
		);
	}
	console.log('\nWords every library flagged — the genuinely profane core:');
	const all = [...votes].filter(([, v]) => v === names.length).map(([w]) => w);
	console.log(`  ${all.length} forms: ${spacedSample(all, 40).join(' ')}`);
} else if (!process.env.RP_SKIP_DICT) {
	console.log(`\n\n=== C14 — dictionary sweep SKIPPED (${DICT} not present) ===`);
}

// Taxonomy coverage — every declared axis should have produced at least one
// measurement. C14 is instantiated by the sweep above rather than by a case.

const uninstantiated = unusedAxes.filter((a) => !(a === 'C14' && sweptDict));
console.log('\n\n=== TAXONOMY COVERAGE ===');
console.log(
	`${Object.keys(TAXONOMY).length} axes declared, ` +
		`${Object.keys(TAXONOMY).length - uninstantiated.length} instantiated in this run.`,
);
if (uninstantiated.length > 0) {
	console.log(`axes with no case: ${uninstantiated.join(', ')}`);
	console.log('(expected when RP_PACKS narrows the run or the sweep is skipped)');
}

// Performance
//
// Reported as the MEDIAN of several trials rather than a single timed run,
// because one run at 20k words is dominated by whichever trial collides with a
// GC — and the min/max of the same trials is printed beside it, so a reader can
// tell a real gap from one trial that collided with one. Corpora cover the
// scripts the packs actually serve — a Latin-only corpus hides the cost of the
// Indic path entirely. Every pack is loaded.
//
// This section runs LAST, in a process that has already pushed the whole
// battery through every library. That is deliberate and it is not neutral:
// measured in a fresh ASCII-only process this package's 20k-word Latin rows
// come out roughly half of what is printed here, and no rival's move at all.
// The published figure is the one a mixed-traffic application sees, which is
// the conservative direction for the library being defended.

if (!process.env.RP_SKIP_PERF) {
	const CORPORA = {
		ascii: 'the quick brown fox jumps over a lazy dog near riverbank today'.split(' '),
		prose: 'The Quick Brown Fox, jumping over 42 lazy dogs; NASA said "OK" — really?'.split(' '),
		devanagari: 'यह एक सामान्य वाक्य है जिसमें कोई गाली नहीं है और सब ठीक है'.split(' '),
		tamil: 'இது ஒரு சாதாரண வாக்கியம் இதில் எந்த கெட்ட வார்த்தையும் இல்லை'.split(' '),
		bengali: 'এটি একটি সাধারণ বাক্য যেখানে কোনো খারাপ শব্দ নেই এবং সব ঠিক আছে'.split(' '),
		gurmukhi: 'ਇਹ ਇੱਕ ਆਮ ਵਾਕ ਹੈ ਜਿਸ ਵਿੱਚ ਕੋਈ ਗਾਲ ਨਹੀਂ ਹੈ ਅਤੇ ਸਭ ਠੀਕ ਹੈ'.split(' '),
	};

	const mkText = (corpus, words, profaneEvery) => {
		const clean = CORPORA[corpus];
		const out = [];
		for (let i = 0; i < words; i++) {
			out.push(profaneEvery && i % profaneEvery === 0 ? 'fuck' : clean[i % clean.length]);
		}
		return out.join(' ');
	};

	const TRIALS = 7;
	/** {median, min, max} in ms per call, over TRIALS trials of `iters` calls. */
	function timeCheck(fn, text, iters) {
		const times = [];
		for (let t = 0; t < TRIALS; t++) {
			fn(text); // warm
			const t0 = performance.now();
			for (let i = 0; i < iters; i++) fn(text);
			times.push((performance.now() - t0) / iters);
		}
		times.sort((a, b) => a - b);
		return { median: times[TRIALS >> 1], min: times[0], max: times[TRIALS - 1] };
	}

	const perfTexts = {
		'short profane (10w)': { text: mkText('ascii', 10, 5), words: 10, iters: 3000 },
		'short clean (10w)': { text: mkText('ascii', 10), words: 10, iters: 3000 },
		'medium clean (1k w)': { text: mkText('ascii', 1000), words: 1000, iters: 200 },
		'medium profane (1k w)': { text: mkText('ascii', 1000, 100), words: 1000, iters: 200 },
		'large clean (20k w)': { text: mkText('ascii', 20000), words: 20000, iters: 20 },
		'large profane (20k w)': { text: mkText('ascii', 20000, 500), words: 20000, iters: 20 },
		'prose (20k w)': { text: mkText('prose', 20000), words: 20000, iters: 20 },
		'devanagari (20k w)': { text: mkText('devanagari', 20000), words: 20000, iters: 20 },
		'tamil (20k w)': { text: mkText('tamil', 20000), words: 20000, iters: 20 },
		'bengali (20k w)': { text: mkText('bengali', 20000), words: 20000, iters: 20 },
		'gurmukhi (20k w)': { text: mkText('gurmukhi', 20000), words: 20000, iters: 20 },
	};

	/** µs per 1,000 words — the size-normalized figure, from ms per call. */
	const perKw = (ms, words) => (ms * 1e6) / words;
	const sig = (v) => (v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : v.toFixed(0));

	// -- construction ------------------------------------------------------
	//
	// Cold is the first construction in this process (captured at module load,
	// before anything else ran); rebuild is the median of TRIALS further
	// constructions in the warm process. Both are reported because they answer
	// different questions and, for obscenity, they differ by an order of
	// magnitude.

	console.log('\n\n=== PERFORMANCE: construction (one-time, ms) ===');
	console.log(
		'Construction is amortized across every subsequent check: it is a real cost for a\n' +
			'serverless cold start and no cost at all for a long-lived chat or game server.\n' +
			`remove-profanity is built with all ${packNames.length} packs (${rpLemmas} lemmas).\n` +
			"leo-profanity has no constructor — its dictionary is a module singleton loaded at\n" +
			"import — so the figure is an explicit reload of the same 'en' list it already has.\n",
	);
	const buildW = 14;
	console.log(
		pad('library', 22) +
			pad('cold', buildW) +
			pad('rebuild med', buildW) +
			pad('rebuild min', buildW) +
			pad('rebuild max', buildW),
	);
	for (const n of names) {
		const t = timeCheck(BUILDERS[n], null, 1);
		console.log(
			pad(n, 22) +
				pad(coldBuildMs[n].toFixed(2), buildW) +
				pad(t.median.toFixed(2), buildW) +
				pad(t.min.toFixed(2), buildW) +
				pad(t.max.toFixed(2), buildW),
		);
	}

	// -- per check ---------------------------------------------------------

	const cells = {};
	for (const [tname, { text, iters }] of Object.entries(perfTexts)) {
		cells[tname] = {};
		for (const n of names) {
			try {
				cells[tname][n] = timeCheck(libs[n], text, iters);
			} catch {
				cells[tname][n] = null;
			}
		}
	}

	console.log(`\n\n=== PERFORMANCE: ms per check (median of ${TRIALS} trials) ===`);
	console.log(
		`remove-profanity has all ${packNames.length} packs loaded; every rival is in its\n` +
			'maximum claimed configuration, same as the accuracy sections.\n\n' +
			'How to read the "profane" rows. Every library here answers a boolean, and three\n' +
			'kinds of early exit are visible in the numbers:\n' +
			'  * allprofanity and @2toad stop the moment a token matches, so a 20k-word\n' +
			'    profane document costs them ~0.006 ms — three orders off their clean row.\n' +
			'  * remove-profanity walks its exact tier in chunks and judges each candidate\n' +
			'    the moment it appears, testing the allowlist only in a window around it,\n' +
			'    so a profane word near the top of a document is answered without scanning\n' +
			'    the rest. What no exit can skip is the per-text preparation that comes\n' +
			'    first — the code-unit array and its profile sweep, plus any fold the text\n' +
			'    actually needs — so its profane row sits at that floor rather than at\n' +
			'    ~0.006 ms; the early-exit anatomy block below prices each part.\n' +
			'  * obscenity and bad-words barely move at all.\n' +
			'The clean rows are the ones where nobody can exit early, and are the fairest\n' +
			'single comparison.\n',
	);
	console.log(pad('text', 24) + names.map((n) => pad(n, W)).join(''));
	for (const tname of Object.keys(perfTexts)) {
		const row = names.map((n) => {
			const c = cells[tname][n];
			return pad(c === null ? 'ERR' : c.median.toFixed(3), W);
		});
		console.log(pad(tname, 24) + row.join(''));
	}

	console.log(`\n=== PERFORMANCE: µs per 1,000 words (median of ${TRIALS} trials) ===`);
	console.log(
		'The same medians divided by document size, so rows of different lengths are\n' +
			'comparable at a glance. The 10-word rows run high for everyone because they are\n' +
			'dominated by fixed per-call overhead rather than by the text.\n',
	);
	console.log(pad('text', 24) + names.map((n) => pad(n, W)).join(''));
	for (const tname of Object.keys(perfTexts)) {
		const { words } = perfTexts[tname];
		const row = names.map((n) => {
			const c = cells[tname][n];
			return pad(c === null ? 'ERR' : sig(perKw(c.median, words)), W);
		});
		console.log(pad(tname, 24) + row.join(''));
	}

	console.log(`\n=== PERFORMANCE: spread, min–max ms across the ${TRIALS} trials ===`);
	console.log(
		'A median alone cannot tell a 2x gap from one trial colliding with a GC. Where the\n' +
			'min and max straddle another library\'s median, the ordering of that pair is not\n' +
			'a result.\n',
	);
	console.log(pad('text', 24) + names.map((n) => pad(n, W)).join(''));
	for (const tname of Object.keys(perfTexts)) {
		const row = names.map((n) => {
			const c = cells[tname][n];
			return pad(c === null ? 'ERR' : `${c.min.toFixed(3)}–${c.max.toFixed(3)}`, W);
		});
		console.log(pad(tname, 24) + row.join(''));
	}

	// -- spans, not booleans ----------------------------------------------
	//
	// Kept apart from the boolean grid on purpose: four of the five rivals
	// cannot return positions at all, so putting them in the same table would
	// invite a comparison that does not exist.

	console.log('\n\n=== PERFORMANCE: returning spans, not a boolean ===');
	console.log(
		'obscenity is the only rival that reports match positions, so scan() vs\n' +
			'getAllMatches() is the one like-for-like row for a consumer who needs to know\n' +
			'WHERE the match is — to censor it, to highlight it, or to log it. The two are\n' +
			'not equivalent in what they hand back: scan() returns lemma, surface, tier,\n' +
			'language, severity, categories and the span; getAllMatches() returns a term id\n' +
			'and indices, and the caller looks the word up itself. allprofanity,\n' +
			'leo-profanity, bad-words and @2toad have no equivalent call and are absent from\n' +
			'this table rather than scored zero.\n',
	);
	const spanFns = [(t) => rp.scan(t), (t) => obscenityMatcher.getAllMatches(t)];
	const SW = 20;
	console.log('rp = remove-profanity scan(); ob = obscenity getAllMatches().\n');
	console.log(
		pad('text', 24) +
			pad('rp ms', SW) +
			pad('ob ms', SW) +
			pad('rp µs/kw', SW) +
			pad('ob µs/kw', SW) +
			pad('rp min–max ms', SW) +
			pad('ob min–max ms', SW),
	);
	for (const tname of Object.keys(perfTexts)) {
		const { text, words, iters } = perfTexts[tname];
		const t = spanFns.map((f) => timeCheck(f, text, iters));
		console.log(
			pad(tname, 24) +
				t.map((c) => pad(c.median.toFixed(3), SW)).join('') +
				t.map((c) => pad(sig(perKw(c.median, words)), SW)).join('') +
				t.map((c) => pad(`${c.min.toFixed(3)}–${c.max.toFixed(3)}`, SW)).join(''),
		);
	}

	// -- early-exit anatomy ------------------------------------------------
	//
	// The claim under test: isClean() stops scanning at the first candidate it
	// can prove survives, and what it cannot skip is the per-text preparation
	// that precedes matching. Two measurements settle it without reading the
	// source. (1) Move the single profane word from the front of a 20k-word
	// document to the middle to the end: a filter that truly stops scanning at
	// the match gets slower as the word moves later. (2) Price the preparation
	// on its own — the code-unit array and profile, then baseFold, the latin
	// fold and the all-repeats collapse over it, exactly what `passesFor`
	// builds before matching starts.

	const at = (n, idx) => {
		const clean = CORPORA.ascii;
		const out = [];
		for (let i = 0; i < n; i++) out.push(i === idx ? 'fuck' : clean[i % clean.length]);
		return out.join(' ');
	};
	const anatomyClean = at(20000, -1);
	const eagerFolds = (t) => {
		const original = unitTextOf(t);
		const pass0 = baseFoldUnits(original);
		const out0 = unitTextOfResult(original, pass0);
		const pass1 = chainFolds(pass0, latinFoldUnits(out0));
		const out1 = unitTextOfResult(out0, pass1);
		return chainFolds(pass1, collapseAllRepeatsFoldUnits(out1)).output.length;
	};

	console.log('\n\n=== PERFORMANCE: early-exit anatomy (20k-word ASCII document) ===');
	console.log(
		'What isClean() actually saves, measured rather than asserted.\n' +
			'A single profane word is moved through a 20k-word clean document. leo-profanity\n' +
			'is shown as a control: it scans word by word and gets faster the earlier the\n' +
			'match sits. So does remove-profanity now, down to the floor its per-text\n' +
			'preparation sets — priced by the two fold rows.\n',
	);
	const AW = 36;
	const anatomy = [
		['isClean(), no match', (t) => rp.isClean(t), anatomyClean],
		['isClean(), profane at word 0', (t) => rp.isClean(t), at(20000, 0)],
		['isClean(), profane at word 10000', (t) => rp.isClean(t), at(20000, 10000)],
		['isClean(), profane at word 19999', (t) => rp.isClean(t), at(20000, 19999)],
		['scan(), no match', (t) => rp.scan(t), anatomyClean],
		['scan(), profane at word 0', (t) => rp.scan(t), at(20000, 0)],
		['eager fold phase alone, no match', eagerFolds, anatomyClean],
		['eager fold phase alone, profane', eagerFolds, at(20000, 0)],
		['leo.check(), no match', (t) => leo.check(t), anatomyClean],
		['leo.check(), profane at word 0', (t) => leo.check(t), at(20000, 0)],
		['leo.check(), profane at word 19999', (t) => leo.check(t), at(20000, 19999)],
	];
	console.log(pad('measurement', AW) + pad('median ms', 14) + pad('min–max ms', 20));
	for (const [label, fn, text] of anatomy) {
		const t = timeCheck(fn, text, 20);
		console.log(
			pad(label, AW) +
				pad(t.median.toFixed(3), 14) +
				pad(`${t.min.toFixed(3)}–${t.max.toFixed(3)}`, 20),
		);
	}
	console.log(
		'\nRead the three isClean() profane rows against the fold rows: the position-0 row\n' +
			'is the floor (preparation, then one window of the exact tier), and the gap to\n' +
			'the position-19999 row is the exact-tier walk that a late match still has to\n' +
			'pay. Nothing after the exact tier runs once a candidate survives.',
	);

	// -- dictionary scaling ------------------------------------------------
	//
	// The structural claim the whole section rests on: a check is a fixed
	// number of Aho-Corasick passes over the text, and an automaton searches
	// for every pattern at once, so the dictionary changes the automaton's
	// size and never the number of passes — cost O(text), not O(text × terms).
	// That is a claim about the SHAPE of the curve, and this block prints the
	// curve so a reader can check it rather than take it. It does not come out
	// flat, and the block says so. Always the full pack roster, independent of
	// RP_PACKS, so a narrowed run still prints the whole thing.

	console.log('\n\n=== PERFORMANCE: cost vs dictionary size (ms per isClean) ===');
	console.log(
		'One matcher per pack subset, same texts, built and timed back to back.\n' +
			'Under O(text × dictionary) — one pass per blacklisted term, which is how a\n' +
			'regex-per-word filter works — 4.8x the lemmas would cost about 4.8x the time.\n' +
			'It does not, and it is not flat either: read the marginal column, which is what\n' +
			'the next pack costs on top of the row above it.\n',
	);
	// A nested chain, so "marginal vs above" always means "what the packs added
	// on this row cost on top of the row above". `hi` alone is appended as a
	// reference, not a step in the chain, and gets no marginal.
	const SUBSETS = [
		['en', ['en'], true],
		['en+hi', ['en', 'hi'], true],
		['en+hi+ta+bn', ['en', 'hi', 'ta', 'bn'], true],
		['all 11', Object.keys(AVAILABLE_PACKS), true],
		['hi alone (ref)', ['hi'], false],
	];
	const scaleTexts = ['large clean (20k w)', 'prose (20k w)', 'devanagari (20k w)'];
	const DW = 20;
	console.log(
		pad('packs', 16) +
			pad('lemmas', 9) +
			scaleTexts.map((t) => pad(t, DW)).join('') +
			pad('marginal vs above', 20),
	);
	let prevAscii = null;
	for (const [label, keys, inChain] of SUBSETS) {
		const chosen = keys.map((k) => AVAILABLE_PACKS[k]);
		const m = createMatcher({ packs: chosen });
		const lemmas = chosen.reduce((n, p) => n + p.entries.length, 0);
		const timings = scaleTexts.map((tn) => {
			const { text, iters } = perfTexts[tn];
			return timeCheck((t) => m.isClean(t), text, iters).median;
		});
		const ascii = timings[0];
		const marginal =
			!inChain || prevAscii === null
				? '—'
				: `${(((ascii - prevAscii) / prevAscii) * 100).toFixed(0)}%`;
		if (inChain) prevAscii = ascii;
		console.log(
			pad(label, 16) +
				pad(String(lemmas), 9) +
				timings.map((v) => pad(v.toFixed(3), DW)).join('') +
				pad(marginal, 20),
		);
	}
	console.log(
		'\nThese rows are comparable to each other — same process, back to back — and NOT\n' +
			'to the grid at the top of the section, which was measured earlier in the run.\n' +
			'Two things in the shape are worth stating plainly. Lemma count does not drive\n' +
			'the cost: the 56-lemma Hindi pack ALONE costs more on pure ASCII than the\n' +
			'70-lemma English pack alone, because what a pack contributes is surface\n' +
			'patterns and live tiers, not headwords. And the curve flattens hard rather than\n' +
			'staying level: the first pack added to English is the expensive one, and the\n' +
			'nine packs after en+hi add 212 lemmas for a few percent between them.\n' +
			'"Sub-linear, and flat once the tiers are live" is the honest description of\n' +
			'this curve; "flat in dictionary size" is not.',
	);
}

console.log(
	`\nremove-profanity packs: [${packNames.join(', ')}] — ${rpLemmas} lemmas` +
		`\nnode ${process.version} on ${process.platform}/${process.arch}` +
		`\ngenerated ${new Date().toISOString()}`,
);
