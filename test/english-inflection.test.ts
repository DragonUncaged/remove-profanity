/**
 * The English suffix expander in `src/data/en.ts`.
 *
 * Before it, the pack listed `fuck` and missed `fucks`, `fucked`, `fucker` —
 * the largest recall gap in the pack. The expander closes it by generating
 * WHOLE TOKENS at module load; it does not touch the boundary rules. That
 * distinction is the whole design, so it is what this file pins:
 *
 *   1. the inflected forms are caught;
 *   2. the ordinary English words that share a stem are not (INFLECTION_EXCLUDE);
 *   3. a generated form buried inside a longer token is still not a match,
 *      which is what separates this from the boundary-relaxing approach that
 *      earns obscenity `shiitake`, `Moby Dick`, `cum laude`, `great tit` and
 *      `Penistone`;
 *   4. and the dictionary sweep is pinned exactly, so a future change to the
 *      orthography rules cannot quietly add a real word.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error - see test/punjabi-gujarati-dictionary.test.ts: this package
// has no @types/node, and the two functions used are re-typed below.
import { readFileSync as rawReadFileSync, existsSync as rawExistsSync } from 'node:fs';
import { createMatcher } from '../src/index.js';
import { english } from '../src/data/en.js';

const readFileSync = rawReadFileSync as (path: string, encoding: string) => string;
const existsSync = rawExistsSync as (path: string) => boolean;

const matcher = createMatcher({ packs: [english] });
const flags = (text: string): boolean => matcher.scan(text).matches.length > 0;

const surfaces = new Set(english.entries.flatMap((e) => [e.lemma, ...(e.variants ?? [])]));

describe('english inflection — recall', () => {
	// The gap the expander exists to close.
	for (const word of ['fucks', 'fucked', 'fucker', 'fuckers']) {
		it(`catches "${word}"`, () => {
			expect(flags(`what a ${word} mess`)).toBe(true);
		});
	}

	// One form per orthographic rule, so a broken rule fails loudly.
	const byRule: Array<[string, string]> = [
		['plain -s', 'cunts'],
		['sibilant -es', 'bitches'],
		['double-s stem', 'pisses'],
		['consonant + y -> -ies', 'pussies'],
		['consonant + y -> -ier', 'shittier'],
		['plain -ed / -ing / -er', 'wanked'],
		['silent e dropped', 'raped'],
		['CVC doubling', 'shitting'],
		['CVC doubling -er', 'shitter'],
		['-er word pluralizes only', 'motherfuckers'],
		['vowel-final noun', 'niggas'],
		['variant spelling inflects too', 'fukking'],
	];
	for (const [rule, word] of byRule) {
		it(`${rule}: "${word}"`, () => {
			expect(flags(`you ${word} thing`)).toBe(true);
		});
	}
});

describe('english inflection — the excluded ordinary words', () => {
	// Each of these is a real English word that a naive expander generates.
	// They are in INFLECTION_EXCLUDE, and they are why it exists.
	const excluded: Array<[string, string]> = [
		['cocked the hammer', 'cocked'],
		['cocking a snook', 'cocking'],
		['a cocker spaniel puppy', 'cocker'],
		['they dicker over the price', 'dicker'],
		['a titter ran through the room', 'titter'],
		['spiced rum for the holidays', 'spiced'],
		['spicing up the recipe', 'spicing'],
		['the Spicer family reunion', 'spicer'],
		['Negros Occidental in the Philippines', 'negros'],
	];
	for (const [sentence, form] of excluded) {
		it(`"${form}" is clean`, () => {
			expect(flags(sentence)).toBe(false);
			expect(surfaces.has(form), `"${form}" must not be a pack surface`).toBe(false);
		});
	}
});

describe('english inflection — whole tokens, not relaxed boundaries', () => {
	// Every one of these CONTAINS a generated form. Rivals that inflect by
	// substring flag them; this pack must not, and the reason is that the
	// expander only ever adds tokens.
	const traps: Array<[string, string]> = [
		['peacocks in the garden', 'cocks'],
		['shuttlecocks and rackets', 'cocks'],
		['he was cocksure about it', 'cocks'],
		['Dickson City, Pennsylvania', 'dicks'],
		['she felt harassed at work', 'assed'],
		['the motion was bypassed', 'assed'],
		['he surpassed every record', 'assed'],
		['the crowd amassed outside', 'assed'],
		['a black cummerbund', 'cummer'],
		['the titmouse at the feeder', 'tits'],
	];
	for (const [sentence, buried] of traps) {
		it(`"${sentence}" is clean (contains "${buried}")`, () => {
			expect(flags(sentence)).toBe(false);
		});
	}

	// The five obscenity is known to flag. None of them moved.
	for (const sentence of [
		'shiitake mushrooms on toast',
		'Moby Dick is a whale',
		'she graduated summa cum laude',
		'a great tit at the feeder',
		'Penistone Grammar School',
		'I live in Scunthorpe',
	]) {
		it(`"${sentence}" is still clean`, () => {
			expect(flags(sentence)).toBe(false);
		});
	}
});

// Same guard as test/punjabi-gujarati-dictionary.test.ts, scoped to the en
// pack alone: eyeballing generated word lists does not find the collisions,
// so the set is pinned exactly rather than bounded.

const DICT = '/usr/share/dict/words';
const haveDict = existsSync(DICT);

describe.skipIf(!haveDict)('english inflection — dictionary sweep', () => {
	const words = [
		...new Set(
			readFileSync(DICT, 'utf8')
				.split('\n')
				.map((w) => w.trim())
				.filter((w) => w.length > 0),
		),
	];

	it('flags exactly the pinned set of dictionary words', () => {
		const hits = words.filter((w) => flags(w)).sort();
		expect(hits).toEqual([
			// Pre-existing: lemmas and curated variants that are dictionary
			// headwords. None of these is the expander's doing.
			'Bastard',
			'Dick',
			'Negro',
			'ass',
			'bastard',
			'bitch',
			'boner',
			'boob',
			'bunghole',
			'cock',
			'coon',
			'cum',
			// Scots dialect for a gossip or godmother. Kept matched on the
			// same reasoning as "randi" in hi.ts: the profane reading is the
			// live one. Added by the expander.
			'cummer',
			'dick',
			'dingleberry',
			'hooker',
			// Added by the expander; "hooker" was already matched, rugby
			// position and all.
			'hookers',
			'kike',
			'negro',
			'nigger',
			'piss',
			// prick and pricks are the 2026-08-15 lexicon additions working:
			// the noun is the insult; the verb family (pricked / pricking /
			// pricker) is INFLECTION_EXCLUDE'd, mirroring cock.
			'prick',
			'pricks',
			'pussy',
			'rape',
			'raper', // added by the expander; the dictionary sense is the slur's
			'raping',
			'rapist',
			'slut',
			'slutter', // added by the expander; archaic, and the same pejorative
			'tit',
			'titty',
			'tosser',
			'twat',
			'wetback',
			'whore', // 2026-08-15 lexicon addition
		]);
	});

	it('every INFLECTION_EXCLUDE entry earns its place', () => {
		// A dead exclusion is maintenance cost plus a false sense of safety.
		// These are the excluded forms that are dictionary headwords: if one
		// stops being generated the exclusion should go, and if one stops
		// being excluded this file's clean traps fail.
		const dict = new Set(words);
		for (const form of ['cocked', 'cocking', 'cocker', 'dicker', 'titter', 'spiced', 'spicer', 'pricked', 'pricking', 'pricker']) {
			expect(dict.has(form), `"${form}" is an ordinary dictionary word`).toBe(true);
			expect(surfaces.has(form), `"${form}" must stay out of the pack`).toBe(false);
		}
	});
});
