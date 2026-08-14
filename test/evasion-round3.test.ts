/**
 * Round-3 evasion work (2026-08-15): closing the English evasion gap at zero
 * false-positive cost. Every mechanism added in this round ships with the
 * adversarial clean traps that justify it, in this file:
 *
 *   1. lexicon and variant additions (whore, prick, kunt, shyt, shitbag);
 *   2. confusable-table gaps (parenthesized letters, small capitals, Latin
 *      Extended diacritics, the full Cyrillic/Greek lookalike sets);
 *   3. newline and slash as separated-tier separators;
 *   4. hashtag camelCase splitting (#FuckThis);
 *   5. the digit-fold guard rework (5hit / 5h17 fold; 45s / 500 / A55 don't);
 *   6. leet digits as masked-tier wildcards (f4ck, 5h*t);
 *   7. combining-mark stripping on Latin bases only (f́úćḱ), with the
 *      eleven-pack proof that Indic orthography is untouched;
 *   8. chunk merging (fu.ck, b.it.ch, as sh ole, mo ther fuc ker);
 *   9. initial-doubling through the collapsed tier (ffuck, ffuucckk);
 *  10. three interior masks (b***h);
 *  11. interior emoji as a deletable mask (fu🔥ck).
 *
 * The DELIBERATE misses of this round are pinned at the bottom with the
 * collision that keeps each one out. Deleting a pin there without reading its
 * reason is how a false positive ships.
 */
import { describe, expect, it } from 'vitest';
import { createMatcher } from '../src/index.js';
import { latinFold, stripLatinMarksFold } from '../src/folds/latin.js';
import type { LanguagePack } from '../src/types.js';
import { english } from '../src/data/en.js';
import { hindi } from '../src/data/hi.js';
import { tamil } from '../src/data/ta.js';
import { odia } from '../src/data/or.js';
import { bengali } from '../src/data/bn.js';
import { marathi } from '../src/data/mr.js';
import { telugu } from '../src/data/te.js';
import { kannada } from '../src/data/kn.js';
import { malayalam } from '../src/data/ml.js';
import { punjabi } from '../src/data/pa.js';
import { gujarati } from '../src/data/gu.js';

const ALL_PACKS: LanguagePack[] = [
	english,
	hindi,
	tamil,
	odia,
	bengali,
	marathi,
	telugu,
	kannada,
	malayalam,
	punjabi,
	gujarati,
];

// Default packs, like the other evasion suites; the clean traps additionally
// run against ALL eleven packs, because a trap that only holds against two
// packs is not a trap.
const matcher = createMatcher({ packs: [hindi, english] });
const all = createMatcher({ packs: ALL_PACKS });

const flagged = (text: string): void => {
	expect(matcher.isClean(text), `expected ${JSON.stringify(text)} to flag`).toBe(false);
};
const clean = (text: string): void => {
	const result = all.scan(text);
	expect(
		result.matches,
		`expected ${JSON.stringify(text)} to stay clean (all packs)`,
	).toEqual([]);
};

describe('lexicon additions', () => {
	it.each([
		'he called her a whore',
		'what a prick',
		'you pricks',
		'whores and whoring',
		'what a kunt',
		'this is shyt',
		'stop being such a shitbag',
		'foock off',
	])('%s flags', flagged);

	it.each([
		// The verb family stays ordinary English (INFLECTION_EXCLUDE).
		'she pricked her finger on the needle',
		'a pricking sensation',
		'the pricker attachment for the drill',
		'a pin-prick of light', // known limitation: bare "prick" token flags
	])('%s — prick verb family stays clean', (text) => {
		// "pin-prick" contains the standalone token "prick", which the pack
		// deliberately matches (same stance as cock / hooker). Only the
		// inflected verb forms are asserted clean.
		if (!text.includes('pin-prick')) clean(text);
	});
});

describe('confusable-table additions', () => {
	it.each([
		['cyrillic к in fuск', 'fuскer said it'],
		['cyrillic maximal сһuтіуа', 'сһuтіуа'],
		['greek κ in fυcκ', 'fυcκ'],
		['greek maximal chυτιγα', 'chυτιγα'],
		['parenthesized ⒡⒰⒞⒦', '⒡⒰⒞⒦'],
		['small capitals ꜰᴜᴄᴋ', 'ꜰᴜᴄᴋ'],
		['latin extended fūċk', 'fūċk'],
		['latin extended ċhūţıyā', 'ċhūţıyā'],
	])('%s flags', (_label, text) => flagged(text));

	it('enclosed alphanumeric supplement folds too', () => {
		// 🄵🅄🄲🄺 (squared F U C K, U+1F130 block).
		flagged('\u{1F135}\u{1F144}\u{1F132}\u{1F13A}');
	});

	it.each([
		'résumé and café are ordinary words',
		'the Señor and the piñata',
		'Škoda and Žižek visited Łódź', // diacritics fold, nothing profane appears
		'5μm tolerance on the part',
	])('%s stays clean', clean);
});

describe('newline and slash separated runs', () => {
	it.each([
		['newlines', 'f\nu\nc\nk'],
		['slashes', 'f/u/c/k'],
		['newlines, hindi', 'c\nh\nu\nt\ni\ny\na'],
		['slashes, hindi', 'c/h/u/t/i/y/a'],
	])('%s: %j flags', (_label, text) => flagged(text));

	it.each([
		'the ban\nkids saw was upheld',
		'options: n/a and a/b and y/o',
		'https://example.com/a/b/c',
		'i/o bound work',
		'w/e happens, happens',
		'items:\na\nb\nc\nd\ne',
	])('%s stays clean', clean);
});

describe('hashtag camelCase splitting', () => {
	it.each([
		['#FuckThis', '#FuckThis'],
		['#FuckThisShit', '#FuckThisShit'],
		['lowercase head', '#thisIsShit'],
		['allcaps fragment', '#FUCKThis'],
		['at-handle', 'hey @FuckFace look'],
		['hindi', '#ChutiyaThis'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		'#SussexDowns walking group',
		'#ClassicCars meet on Sunday',
		'#Scunthorpe United won',
		'#MobyDick reading club', // allow phrase seen across the fragment seam
		'#CummingGeorgia local news',
		'#GreatTitSightings at the feeder',
		'#Hitchcock retrospective',
		'#McDonald opening hours',
		'C# and F# are .NET languages', // marker must START its token
		'email user@example.com today',
		'the accent is #f0ff00',
		'#throwback to 2019',
		'#DickensFair this weekend', // Dickens is not a surface; no fragment is
	])('%s stays clean', clean);
});

describe('digit-fold guard (5hit family)', () => {
	it.each([
		['leading substitution digit', '5hit happens'],
		['maximal digits', '5h17'],
		['stretch plus leet', '5hiiiit'],
		['zero-width plus leet', '5h​it'],
		['leading digit, hindi', '9andu'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		// The number-ish tokens the old guard existed for, all still clean.
		'the timeout is 45s',
		'this happened in 500 BC',
		'the score was 1337 points',
		'meet me in Room 4B',
		'the 1st, 2nd and 3rd items',
		'a 3D model on a 4x4 grid',
		'the mask is 0x1a2b3c',
		'the server returned error code 500',
		'45 rpm records from the 80s and 90s',
		// The shapes the new guard was specifically screened against.
		'postal code K1A 4S5', // digit-letter-digit must not fold to "ass"
		'take the A55 near Chester', // letter-led tokens keep literal adjacency
		'le train de 17h30', // two leading digits stay blocked
		'the 5h30m mark of the stream',
		'v1.2.3-rc4 shipped',
		'id 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
		'md5 5f4dcc3b5aa765d61d8327deb882cf99',
	])('%s stays clean', clean);
});

describe('leet digits as masked-tier wildcards (f4ck family)', () => {
	it.each([
		['digit for a vowel it does not encode', 'f4ck'],
		['digit mask, hindi', 'ch4tiya'],
		['digit mask plus classic mask', '5h*t'],
		['digit mask with stray letter', 'w4nk'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		// Interior-digit tokens from real text: too short, or nothing aligns.
		'a T2T genome assembly',
		'b2b and p2p and o2o markets',
		'sk8er boi lyrics',
		'l33t speak archive',
		'covid19 case counts', // trailing digit = trailing mask, rejected
		'a 24bit and a 16bit image',
		'win32 and utf8 and float64 types',
		'SW1A 1AA is the palace postcode',
		'plate KA01AB1234 was towed',
		'4chan threads', // bare leading digit-mask needs a second mask
		'2fast4u mate',
		'2hit combo in the corner',
		'call 911 now',
		'AKIA5H1TXXXXXXXXXXXX', // 20-unit token, no 20-unit surface
		'gr8 job m8',
	])('%s stays clean', clean);
});

describe('combining marks on Latin bases', () => {
	it.each([
		['acute on every letter', 'f́úćḱ'],
		['combining grapheme joiner', 'fu͏ck'],
		['cgj, hindi', 'ch͏utiya'],
		['acutes, hindi', 'ćh́út́íýá'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it('strips marks ONLY after ASCII Latin letters', () => {
		// After a Devanagari base the same code points survive the fold.
		const onLatin = stripLatinMarksFold('f́');
		expect(onLatin.output).toBe('f');
		const onDeva = stripLatinMarksFold('क́');
		expect(onDeva.output).toBe('क́');
	});

	it('leaves every native-script surface of all eleven packs byte-identical', () => {
		for (const pack of ALL_PACKS) {
			for (const entry of pack.entries) {
				for (const s of [entry.lemma, ...(entry.variants ?? [])]) {
					if (/^[\x00-\x7f]*$/.test(s)) continue;
					expect(stripLatinMarksFold(s).output, `${pack.language}: ${s}`).toBe(s);
					// And through the whole composed pass-1 fold: no Indic
					// character may be rewritten by the round-3 additions.
					// (latinFold has always been a near-no-op on Indic text.)
					expect(latinFold(s).output, `${pack.language}: ${s}`).toBe(s);
				}
			}
		}
	});

	it.each(['café au lait', 'a naïve résumé', 'El Niño arrived'])(
		'%s stays clean',
		clean,
	);
});

describe('chunk merging (fu.ck, as sh ole)', () => {
	it.each([
		['one interior dot', 'fu.ck'],
		['one interior dot, hindi', 'ch.utiya'],
		['two interior dots', 'b.it.ch'],
		['two interior dots, hindi', 'c.hu.tiya'],
		['hyphens', 'fu-ck'],
		['three space chunks', 'as sh ole'],
		['three space chunks, hindi', 'ch ut iya'],
		['four space chunks', 'mo ther fuc ker'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		'as if that would work',
		'h e l l o there', // all-single runs stay the separated tier's
		'hell o there',
		'so fu manchu appears',
		'an item on the list',
		'those who re-elected him', // binding separator at the run boundary
		'the re-do of the re-cap',
		'in re Gault was decided in 1967',
		'sa re ga and ma in order', // whole-run equality: gaandma is nothing
		'GA and MA are states',
		'she should be an ER nurse', // the collision sweep's one natural hit
		'he wants to be an ERS member',
		'T-shirt, e-mail, x-ray, co-op',
		'e.g. this and i.e. that and a.k.a. it',
		'U.S.A. and U.K. and R.S.V.P.',
		'a Ph.D. and a B.Tech',
		'the chain-pull switch',
		'Dr. A. B. Smith arrived',
		'the r-value and the p-value',
		'college lo da', // 2-chunk space merges are a deliberate miss — see below
		'wait a bit ch',
	])('%s stays clean', clean);
});

describe('initial doubling through the collapsed tier', () => {
	it.each([
		['initial doubling', 'ffuck'],
		['every letter doubled', 'ffuucckk'],
		['initial doubling, hindi', 'cchutiya'],
		['every letter doubled, hindi', 'cchhuuttiiyyaa'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		// Word-internal doubles: the stretch gate the collapsed tier keeps.
		'assess the aggressive bookkeeper',
		'the balloon and the coffee',
		'baat pakki ho gayi',
		'woh naukri chhod raha hai',
		'He was rapping on stage',
		'school ki chuttiya shuru ho gayi',
		// Words that legitimately BEGIN doubled.
		'the aardvark and the llama',
		'Lloyds of London',
		'oops, the eels escaped',
		'oolong tea please',
		'Aaron and the Ffestiniog railway',
	])('%s stays clean', clean);
});

describe('three interior masks', () => {
	it.each([
		['b***h', 'b***h'],
		['hindi, c***iya', 'c***iya'],
	])('%s flags', (_label, text) => flagged(text));

	it.each([
		'the M*A*S*H finale aired',
		'a$$ = 5 in that dialect',
		'wrap it in **bold** for emphasis',
		'*fine* then, have it your way',
		'see the footnote marker word* here',
		'rm -i *.tmp in that folder',
		'the p***word field', // no surface aligns; masks stay masks
	])('%s stays clean', clean);
});

describe('interior emoji as a deletable mask', () => {
	it.each([
		['fire emoji', 'fu\u{1F525}ck'],
		['fire emoji, hindi', 'ch\u{1F525}utiya'],
		['two emoji', 'fu\u{1F525}\u{1F525}ck'],
	])('%s: %s flags', (_label, text) => flagged(text));

	it.each([
		'the fire\u{1F525}works show',
		'good\u{1F44D}job team',
		'love❤️letter drafts',
		'a\u{1F525}b testing',
		'nice™ product',
	])('%s stays clean', clean);
});

describe('deliberate misses of this round, each with its collision', () => {
	// Every entry here is a recall case that was ATTEMPTED and dropped because
	// the mechanism that would catch it also catches the innocent text beside
	// it. The clean text is the pin; the miss is the price.
	it.each([
		// Edge masks: markdown italic phrases donate leading-mask tokens
		// ("*hit save*" → "*hit"), footnote asterisks donate trailing ones
		// ("boo*" → boob, "wan*" → wank). No lock separates them from *uck.
		['*uck', 'markdown: *hit save and close* / boo* footnote'],
		['fuc*', 'same collision, trailing side'],
		['f***', 'one visible letter is below the masked-tier floor'],
		// Two space-separated chunks: structurally identical to adjacent short
		// words — "lo da" (Telugu locative + vocative), "ga and" (sargam, US
		// states) — so two-chunk merges need a binding separator.
		['fu ck', 'college lo da / sa re ga and ma'],
		['ch utiya', 'same rule, hindi'],
		// Disemvowelling: FCK is a football club (FC København/Köln).
		['fck', 'FCK match reports'],
		// Documented since round 1; unchanged.
		['u r a s h i t', 'single letters beside a run stay unclaimed'],
		['a s s', 'three-letter runs are below the separated-tier floor'],
		['fu(k', '"Hello (um, maybe)" — ( is not c'],
	])('%s stays a miss (%s)', (text) => {
		expect(matcher.isClean(text)).toBe(true);
	});

	it('the italic-phrase and footnote shapes those misses protect stay clean', () => {
		clean('*hit save and close* to finish');
		clean('the crowd went boo* (see note)');
		clean('a wan* smile');
	});
});
