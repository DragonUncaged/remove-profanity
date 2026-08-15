/**
 * The battery: taxonomy first, then cases derived from it.
 *
 * This file is DATA. `compare.mjs` is the runner. Nothing here is copied from
 * another profanity library's test files, README examples or issue tracker —
 * see METHODOLOGY.md for why that mattered enough to rebuild from scratch.
 *
 * There are two kinds of case, and the distinction is the point of the file.
 *
 * 1. **GENERATED** cases. `LATIN_MATRIX` and `NATIVE_MATRIX` are lists of
 *    transform *functions*, one per taxonomy axis. The runner applies the
 *    WHOLE list to EVERY language, with no per-language selection of any kind.
 *    A transform that this package fails is applied to all eleven languages
 *    exactly as a transform it passes is. This is mechanical, so it cannot be
 *    steered: there is no place in the file where an author chooses which
 *    transforms a language receives.
 *
 *    The first version of this battery did choose, and an adversarial audit
 *    found that the chosen slice was almost exactly the set of transforms the
 *    engine passes — 15 of 20 replicated axes were 100% passes, while 17 of
 *    the 34 axes left English-only were 100% failures. That asymmetry, not any
 *    individual case, was what turned 64% on English into an 85% headline. The
 *    matrix below exists so that failure mode is structurally impossible.
 *
 * 2. **NAMED** cases. Written by hand, one list per language, for the axes a
 *    transform function cannot express: a language's own morphology, its
 *    transliteration spread, its script's spelling doublets, and lexicon
 *    breadth. The runner prints the named-case count per language next to the
 *    generated count, so any imbalance is visible in the output rather than
 *    buried in the source.
 *
 * Every case is `[axis, label, text]` and the axis is a key in `TAXONOMY`. The
 * runner throws on a case citing an undeclared axis and reports any axis with
 * no case, so the derivation is checkable rather than merely claimed.
 *
 * Cases this package FAILS are deliberately present and are not marked as
 * such. The runner derives the failure list from the run, so no case can be
 * quietly downgraded to "expected" after the fact.
 *
 * Invisible characters are written as `\uXXXX` escapes, never pasted, so that
 * a reader can audit what a case actually contains.
 */

// PART 1 — THE TAXONOMY
//
// Evasion axes (E*, S*) describe a way of writing profanity that a filter is
// supposed to see through. Script axes (S*) are the Indic-specific ones: they
// are not evasion at all, they are the several *correct* ways a script lets
// you spell one word, which a filter must unify or lose.
//
// Clean axes (C*) describe a way of writing something innocent that a filter
// is liable to flag.
//
// Two rules govern how the axes themselves are worded, both of them fixes for
// defects an audit found in the first version:
//
//   * **No axis is split at an implementation boundary.** The first taxonomy
//     had "Cyrillic homoglyphs, the common set (а е о р с х у і ѕ)" and
//     "…beyond the common set (к т м н в)" as separate axes. "The common set"
//     was not a fact about attackers; it was this engine's lookup table
//     transcribed, and the split weighted the covered half four to one. The
//     axes here split on *attacker* behaviour instead — minimal substitution
//     (one letter, the way a person types it) versus maximal substitution (the
//     way a homoglyph converter does it) — which is a distinction that exists
//     independently of any filter.
//
//   * **No axis description carries the defender's verdict.** The first
//     taxonomy annotated three axes "(declared non-goal)" and described
//     another as "an inflection, not a listed surface" — the engine's policy
//     and the engine's dictionary, written into what is supposed to be a
//     description of attacker behaviour. The non-goals are still declared, but
//     in METHODOLOGY.md where policy belongs, and the cases still score as
//     misses.

export const TAXONOMY = {
	// Evasion: control
	E0: 'Control — the plain base form in a sentence, no transform. Proves the base is listed at all.',

	// Evasion: character substitution
	'E1.1': 'Substitution — leet digits, minimal (the first letter that has a conventional digit form)',
	'E1.2': 'Substitution — leet digits, maximal (every letter that has one)',
	'E1.3': 'Substitution — leet punctuation as letters (@ $ ! | ( +)',
	'E1.4': 'Substitution — Cyrillic lookalikes, minimal (one vowel)',
	'E1.5': 'Substitution — Cyrillic lookalikes, maximal (every letter with a lookalike)',
	'E1.6': 'Substitution — Greek lookalikes, minimal (one vowel)',
	'E1.7': 'Substitution — Greek lookalikes, maximal',
	'E1.8': 'Substitution — Mathematical Alphanumeric Symbols',
	'E1.9': 'Substitution — Enclosed Alphanumerics, circled (ⓐ–ⓩ)',
	'E1.10': 'Substitution — Enclosed Alphanumerics, parenthesized (⒜–⒵)',
	'E1.11': 'Substitution — fullwidth forms (ａ–ｚ)',
	'E1.12': 'Substitution — Latin-1 Supplement accented letters (á ç é í ñ ó ú ý)',
	'E1.13': 'Substitution — Latin Extended-A/B letters (ā ċ đ ē ġ ı ł ń ō ř ş ţ ū ż)',
	'E1.14': 'Substitution — small capitals and modifier letters (ꜰᴜᴄᴋ)',
	'E1.15': 'Substitution — a digit standing for a vowel it does not conventionally encode (f4ck)',

	// Evasion: character insertion
	'E2.1': 'Insertion — zero-width and format characters (ZWSP, ZWNJ)',
	'E2.2': 'Insertion — one combining mark',
	'E2.3': 'Insertion — a combining mark on every letter',
	'E2.4': 'Insertion — combining grapheme joiner and variation selectors',
	'E2.5': 'Insertion — one interior non-letter',
	'E2.6': 'Insertion — two or more interior non-letters (f..uck, fu**ck)',
	'E2.7': 'Insertion — an interior emoji or pictograph',

	// Evasion: repetition
	'E3.1': 'Repetition — medial vowel stretch (fuuuuck)',
	'E3.2': 'Repetition — terminal letter stretch (shittt)',
	'E3.3': 'Repetition — initial doubling (ffuck)',
	'E3.4': 'Repetition — every letter doubled (ffuucckk)',
	'E3.5': 'Repetition — stretching a letter that the base already writes doubled',

	// Evasion: masking
	'E4.1': 'Masking — one mask character, interior',
	'E4.2': 'Masking — two mask characters, interior',
	'E4.3': 'Masking — three or more mask characters',
	'E4.4': 'Masking — the non-asterisk mask characters (# @ $ %)',
	'E4.5': 'Masking — a mask at a token edge',

	// Evasion: segmentation
	'E5.1': 'Segmentation — space-separated single letters',
	'E5.2': 'Segmentation — dot-separated single letters',
	'E5.3': 'Segmentation — hyphen-separated single letters',
	'E5.4': 'Segmentation — newline-separated single letters',
	'E5.5': 'Segmentation — separators outside the common set (/ , |)',
	'E5.6': 'Segmentation — a standalone single letter adjacent to the run',
	'E5.7': 'Segmentation — a spelled-out run of an inflected form',
	'E5.8': 'Segmentation — a spelled-out run of fewer than four letters',
	'E5.9': 'Segmentation — split into two multi-letter chunks (fu ck)',
	'E5.10': 'Segmentation — split into three or more multi-letter chunks',

	// Evasion: case
	'E6.1': 'Case — all caps',
	'E6.2': 'Case — alternating caps',
	'E6.3': 'Case — title case',

	// Evasion: script mixing
	'E7.1': 'Script mixing — native-script head, Latin tail (माdarchod)',
	'E7.2': 'Script mixing — Latin head, native-script tail',

	// Evasion: morphology
	'E8.1': 'Morphology — plural / inflected form',
	'E8.2': 'Morphology — participial and verbal forms',
	'E8.3': 'Morphology — compounding',
	'E8.4': 'Morphology — Indo-Aryan oblique, vocative and genitive inflection',
	'E8.5': 'Morphology — Dravidian / Odia agglutinated case suffix on a stem',

	// Evasion: transliteration
	'E9.1': 'Transliteration spread — vowel length and quality (aa/a, o/u)',
	'E9.2': 'Transliteration spread — aspiration (bh/b, ph/f, ch/c)',
	'E9.3': 'Transliteration spread — gemination and retroflex/dental choice',
	'E9.4': 'Transliteration spread — regional convention (Kolkata vs Dhaka, Punjabi p-/ph-)',

	// Evasion: embedding
	'E10.1': 'Embedding — hashtag',
	'E10.2': 'Embedding — @-handle',
	'E10.3': 'Embedding — URL path',
	'E10.4': 'Embedding — email local part',
	'E10.5': 'Embedding — adjacent emoji run',
	'E10.6': 'Embedding — concatenated into a longer token (#FuckThis)',
	'E10.7': 'Embedding — surrounding markdown, quotes and brackets',

	// Evasion: lexicon
	E11: 'Lexicon breadth — a plain, untransformed term a list for that language is expected to carry',

	// Evasion: orthographic respelling
	'E12.1': 'Respelling — vowel deletion / disemvowelling (fck, sht, btch)',
	'E12.2': 'Respelling — phonetic, consonant (ck→k, c→k, s→z, f→ph)',
	'E12.3': 'Respelling — phonetic, vowel (i→y, u→oo)',

	// Evasion: combined transforms
	'E13.1': 'Combination — mask plus leet',
	'E13.2': 'Combination — mask plus homoglyph',
	'E13.3': 'Combination — stretch plus leet',
	'E13.4': 'Combination — segmentation plus case',
	'E13.5': 'Combination — zero-width insertion plus leet',
	'E13.6': 'Combination — three transforms at once',

	// Script-specific unification (Indic)
	'S1.1': 'Script — anusvara / conjunct-nasal doublet (ముణ్డ ≡ ముండ, ગાન્ડ ≡ ગાંડ)',
	'S1.2': 'Script — candrabindu and nukta optionality',
	'S1.3': 'Script — Gurmukhi tippi/bindi pair and dropped addak',
	'S1.4': 'Script — Malayalam chillu encodings and the pre-reform / reformed ṉṟa pair',
	'S1.5': 'Script — Bengali khanda ta, ঙ্ক/ংক, nasal doublets',
	'S1.6': 'Script — Tamil grantha/native doublet, aytham prefix',
	'S1.7': 'Script — Marathi eyelash reph doublet (महाऱ्या ≡ महार्या)',
	'S2.1': 'Script — ZWJ / ZWNJ injected around a virama',
	'S2.2': 'Script — doubled virama / halant / hosonto',

	// Clean traps
	C1: 'Clean — an English word containing a profane ENGLISH substring (the Scunthorpe class)',
	C2: 'Clean — an English word, inflection or compound whose consonant SKELETON collides with a lemma (the class only a dictionary sweep finds)',
	C3: 'Clean — Indian proper nouns, place names and surnames',
	C4: 'Clean — community names, varna/category terms and religious identities in neutral, academic or self-referential use',
	C5: 'Clean — cross-language collision: profane in one language, ordinary in another',
	C6: 'Clean — acronyms and initialisms (bait for the separated tier)',
	C7: 'Clean — technical strings, identifiers, hashes and code (bait for the leet fold)',
	C8: 'Clean — numbers, dates and versions (bait for digit folding)',
	C9: 'Clean — ordinary prose in the pack’s own native script',
	C10: 'Clean — minimal pairs inside one language (vowel length, gemination, retroflex/dental)',
	C11: 'Clean — text containing mask characters used normally (C#, 100%, $PATH)',
	C12: 'Clean — innocent spelled-out or hyphenated runs (b a s s guitar, q w e r t y, T-shirt)',
	C13: 'Clean — ordinary ROMANIZED Indian-language prose (the register this package is built for, and the one it is most likely to break)',
	C14: 'Clean — bulk sweep of /usr/share/dict/words, its regular inflections and the compound list (reported separately, not in the headline totals)',
};

// PART 2 — WHAT EACH LIBRARY CLAIMS
//
// Read off each package's own README and package.json at the versions pinned
// in benchmark/package.json. A library is scored primarily on the languages it
// claims; a MISS on a language it never claimed is reported as "not attempted"
// rather than as a defeat. A FALSE POSITIVE counts everywhere, claimed or not,
// because a filter that flags Malayalam prose while claiming only English is
// still breaking its user's app.
//
// `packs` are the ISO codes of this battery's per-language suites that the
// library claims. `setup` puts the library into its maximum claimed
// configuration — the way a user who wanted that coverage would configure it.

export const LIBRARY_CLAIMS = {
	'remove-profanity': {
		version: 'this repo',
		claims: 'en, hi, bn, mr, pa, gu, or, ta, te, kn, ml (11 packs). Evasion: leet, Unicode confusables, fullwidth, math alphanumerics, enclosed alphanumerics, zero-width injection, letter stretch, masking, spelled-out words, phonetic skeleton.',
		source: 'README.md of this repository',
		packs: ['en', 'hi', 'bn', 'mr', 'pa', 'gu', 'or', 'ta', 'te', 'kn', 'ml'],
	},
	allprofanity: {
		version: '2.4.0',
		claims: 'en, hi, bn, ta, te, fr, de, es, pt-BR, el (10 languages; loadIndianLanguages() loads hi/bn/ta/te). Evasion: leet, masked words, stretched letters, spaced-out spelling, fullwidth, homoglyph, zero-width injection.',
		source: 'README.md §"Multi-Language & Flexibility" and package.json description',
		packs: ['en', 'hi', 'bn', 'ta', 'te'],
	},
	obscenity: {
		version: '0.4.6',
		claims: 'en only ("Robust, extensible profanity filter"; ships englishDataset). Evasion: the recommended transformer set — confusables, leet, character collapsing — plus `?` wildcards in its pattern DSL.',
		source: 'README.md and package.json description',
		packs: ['en'],
	},
	'leo-profanity': {
		version: '1.9.0',
		claims: 'en (default), fr, ru via loadDictionary(). No evasion resistance claimed; it is a word list with an exact-token check.',
		source: 'README.md §"Usage" comment "support languages: en, fr, ru"',
		packs: ['en'],
	},
	'bad-words': {
		version: '4.1.5',
		claims: 'en only ("A javascript filter for bad words"). No evasion resistance claimed.',
		source: 'package.json description; README.md has no language section',
		packs: ['en'],
	},
	'@2toad/profanity': {
		version: '3.3.0',
		claims: 'en, ar, de, es, fr, hi, it, ja, ko, pt, ru, zh (12 locales). No evasion resistance claimed beyond whole-word matching. Run with languages:[en,hi] AND unicodeWordBoundaries:true — at its default ASCII \\b boundary a Devanagari entry cannot match at all.',
		source: 'supported-languages.md; README.md §languages; profanity-options for unicodeWordBoundaries',
		packs: ['en', 'hi'],
	},
};

// PART 3 — THE TRANSFORM MATRIX
//
// One entry per language-independent evasion axis. The runner applies every
// entry to every language. `fn(word)` returns the transformed text, or `null`
// when the transform does not apply to that word (no leet-mappable letter, no
// doubled letter, too short); the runner then tries the language's next base
// form, and reports the axes that came out inapplicable for a language rather
// than silently omitting them.
//
// The character tables are the standard Unicode confusable sets and the
// standard leet conventions. They were NOT read off `src/folds/latin.ts`; the
// point of the exercise is that the battery does not know what the engine
// covers.

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const VOWELS = 'aeiou';

/** a→U+XXXX, b→U+XXXX+1, … for the contiguous alphabetic blocks. */
const rangeMap = (start) =>
	Object.fromEntries([...LOWER].map((c, i) => [c, String.fromCodePoint(start + i)]));

const MATH_BOLD = rangeMap(0x1d41a); // 𝐚–𝐳
const CIRCLED = rangeMap(0x24d0); // ⓐ–ⓩ
const PARENTHESIZED = rangeMap(0x249c); // ⒜–⒵
const FULLWIDTH = rangeMap(0xff41); // ａ–ｚ

const LEET_DIGIT = { a: '4', b: '8', e: '3', g: '9', i: '1', l: '1', o: '0', s: '5', t: '7', z: '2' };
const LEET_PUNCT = { a: '@', c: '(', i: '!', l: '|', s: '$', t: '+' };

/** Latin → Cyrillic lookalikes. The whole set, not a filter's subset. */
const CYRILLIC = {
	a: 'а', c: 'с', d: 'ԁ', e: 'е', h: 'һ', i: 'і',
	j: 'ј', k: 'к', m: 'м', o: 'о', p: 'р', s: 'ѕ',
	t: 'т', x: 'х', y: 'у',
};
/** Latin → Greek lookalikes. */
const GREEK = {
	a: 'α', b: 'β', e: 'ε', i: 'ι', k: 'κ', m: 'μ',
	n: 'η', o: 'ο', p: 'ρ', t: 'τ', u: 'υ', v: 'ν',
	x: 'χ', y: 'γ',
};
/** Latin → Latin-1 Supplement accented letters. */
const LATIN1 = { a: 'á', c: 'ç', e: 'é', i: 'í', n: 'ñ', o: 'ó', u: 'ú', y: 'ý' };
/** Latin → Latin Extended-A/B letters. */
const LATIN_EXT = {
	a: 'ā', c: 'ċ', d: 'đ', e: 'ē', g: 'ġ', i: 'ı',
	l: 'ł', n: 'ń', o: 'ō', r: 'ř', s: 'ş', t: 'ţ',
	u: 'ū', z: 'ż',
};
/** Latin → small capitals and modifier letters. */
const SMALL_CAPS = {
	a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ',
	g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ',
	m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', r: 'ʀ', s: 'ꜱ',
	t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', y: 'ʏ', z: 'ᴢ',
};

const mapAll = (w, map) => {
	if (![...w].some((c) => map[c] !== undefined)) return null;
	return [...w].map((c) => map[c] ?? c).join('');
};
const mapFirst = (w, map) => {
	for (let i = 0; i < w.length; i++) {
		if (map[w[i]] !== undefined) return w.slice(0, i) + map[w[i]] + w.slice(i + 1);
	}
	return null;
};
const mapFirstVowel = (w, map) => {
	for (let i = 0; i < w.length; i++) {
		if (VOWELS.includes(w[i]) && map[w[i]] !== undefined) {
			return w.slice(0, i) + map[w[i]] + w.slice(i + 1);
		}
	}
	return null;
};
const firstVowelAt = (w) => [...w].findIndex((c) => VOWELS.includes(c));
const replaceAt = (w, i, s) => w.slice(0, i) + s + w.slice(i + 1);
const insertAt = (w, i, s) => w.slice(0, i) + s + w.slice(i);
const spaced = (w, sep) => [...w].join(sep);
const titled = (w) => w[0].toUpperCase() + w.slice(1);
/** Interior positions only: never index 0 and never the last index. */
const interior = (w, k) => (w.length >= k + 2 ? 1 : null);

/**
 * The Latin transform matrix. `[axis, label, fn]`, applied to every language.
 *
 * Nothing here is conditioned on the language, and nothing is conditioned on
 * what any filter catches. The list order follows the taxonomy order.
 */
export const LATIN_MATRIX = [
	['E1.1', 'leet digit, minimal', (w) => mapFirst(w, LEET_DIGIT)],
	['E1.2', 'leet digits, maximal', (w) => mapAll(w, LEET_DIGIT)],
	['E1.3', 'leet punctuation', (w) => mapAll(w, LEET_PUNCT)],
	['E1.4', 'cyrillic lookalike, one vowel', (w) => mapFirstVowel(w, CYRILLIC)],
	['E1.5', 'cyrillic lookalikes, maximal', (w) => mapAll(w, CYRILLIC)],
	['E1.6', 'greek lookalike, one vowel', (w) => mapFirstVowel(w, GREEK)],
	['E1.7', 'greek lookalikes, maximal', (w) => mapAll(w, GREEK)],
	['E1.8', 'math bold', (w) => mapAll(w, MATH_BOLD)],
	['E1.9', 'circled letters', (w) => mapAll(w, CIRCLED)],
	['E1.10', 'parenthesized letters', (w) => mapAll(w, PARENTHESIZED)],
	['E1.11', 'fullwidth', (w) => mapAll(w, FULLWIDTH)],
	['E1.12', 'latin-1 accents', (w) => mapAll(w, LATIN1)],
	['E1.13', 'latin extended-A/B', (w) => mapAll(w, LATIN_EXT)],
	['E1.14', 'small capitals', (w) => mapAll(w, SMALL_CAPS)],
	['E1.15', 'digit 4 for the first vowel', (w) => {
		const i = firstVowelAt(w);
		return i < 0 ? null : replaceAt(w, i, '4');
	}],

	['E2.1', 'zero width space inside', (w) => (interior(w, 1) === null ? null : insertAt(w, 2, '\u200B'))],
	['E2.2', 'one combining acute', (w) => {
		const i = firstVowelAt(w);
		return i < 0 ? null : insertAt(w, i + 1, '\u0301');
	}],
	['E2.3', 'combining acute on every letter', (w) => [...w].map((c) => c + '\u0301').join('')],
	['E2.4', 'combining grapheme joiner', (w) => (interior(w, 1) === null ? null : insertAt(w, 2, '\u034F'))],
	['E2.5', 'one interior dot', (w) => (interior(w, 1) === null ? null : insertAt(w, 2, '.'))],
	['E2.6', 'two interior dots', (w) => (w.length < 5 ? null : insertAt(insertAt(w, 3, '.'), 1, '.'))],
	['E2.7', 'interior emoji', (w) => (interior(w, 1) === null ? null : insertAt(w, 2, '\u{1F525}'))],

	['E3.1', 'medial vowel stretch', (w) => {
		const i = firstVowelAt(w);
		return i < 0 ? null : replaceAt(w, i, w[i].repeat(5));
	}],
	['E3.2', 'terminal stretch', (w) => w + w[w.length - 1].repeat(3)],
	['E3.3', 'initial doubling', (w) => w[0] + w],
	['E3.4', 'every letter doubled', (w) => [...w].map((c) => c + c).join('')],
	['E3.5', 'stretch an already-doubled letter', (w) => {
		for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return replaceAt(w, i, w[i].repeat(4));
		return null;
	}],

	['E4.1', 'one interior mask', (w) => (w.length < 4 ? null : replaceAt(w, 2, '*'))],
	['E4.2', 'two interior masks', (w) => (w.length < 4 ? null : replaceAt(replaceAt(w, 1, '*'), 2, '*'))],
	['E4.3', 'three interior masks', (w) => (w.length < 5 ? null : replaceAt(replaceAt(replaceAt(w, 1, '*'), 2, '*'), 3, '*'))],
	['E4.4', 'hash mask', (w) => (w.length < 4 ? null : replaceAt(w, 2, '#'))],
	['E4.5', 'mask at the leading edge', (w) => replaceAt(w, 0, '*')],

	['E5.1', 'space-separated letters', (w) => spaced(w, ' ')],
	['E5.2', 'dot-separated letters', (w) => spaced(w, '.')],
	['E5.3', 'hyphen-separated letters', (w) => spaced(w, '-')],
	['E5.4', 'newline-separated letters', (w) => spaced(w, '\n')],
	['E5.5', 'slash-separated letters', (w) => spaced(w, '/')],
	['E5.6', 'standalone letter beside the run', (w) => `u r a ${spaced(w, ' ')}`],
	['E5.7', 'run of an inflected form', (w) => spaced(w + 's', ' ')],
	['E5.8', 'run shorter than four letters', (w) => (w.length < 4 ? spaced(w, ' ') : null)],
	['E5.9', 'split into two chunks', (w) => (w.length < 4 ? null : `${w.slice(0, 2)} ${w.slice(2)}`)],
	['E5.10', 'split into three chunks', (w) => (w.length < 6 ? null : `${w.slice(0, 2)} ${w.slice(2, 4)} ${w.slice(4)}`)],

	['E6.1', 'all caps', (w) => w.toUpperCase()],
	['E6.2', 'alternating caps', (w) => [...w].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join('')],
	['E6.3', 'title case', (w) => titled(w)],

	['E10.1', 'hashtag', (w) => `#${w} trending now`],
	['E10.2', 'at-handle', (w) => `hey @${w} look`],
	['E10.3', 'url path', (w) => `https://example.com/${w}-page`],
	['E10.4', 'email local part', (w) => `write to ${w}@example.com`],
	['E10.5', 'adjacent emoji run', (w) => `${w} \u{1F525}\u{1F525}\u{1F525}`],
	['E10.6', 'concatenated into a longer token', (w) => `#${titled(w)}This`],
	['E10.7', 'markdown emphasis', (w) => `**${w}**`],

	['E12.1', 'vowel deletion', (w) => {
		const out = [...w].filter((c) => !VOWELS.includes(c)).join('');
		return out.length >= 3 && out.length < w.length ? out : null;
	}],
	['E12.2', 'phonetic respelling, consonant', (w) => {
		if (w.includes('ck')) return w.replace('ck', 'k');
		if (w.includes('ph')) return w.replace('ph', 'f');
		if (w.includes('c')) return w.replace('c', 'k');
		if (w.includes('ss')) return w.replace('ss', 'zz');
		if (w.includes('s')) return w.replace('s', 'z');
		if (w.includes('f')) return w.replace('f', 'ph');
		// The romanized-Indic half of the same behaviour: an aspirated or
		// retroflex consonant written the other conventional way round.
		if (w.includes('th')) return w.replace('th', 't');
		if (w.includes('gh')) return w.replace('gh', 'g');
		if (w.includes('kh')) return w.replace('kh', 'k');
		if (w.includes('j')) return w.replace('j', 'z');
		if (w.includes('v')) return w.replace('v', 'w');
		if (w.includes('d')) return w.replace('d', 'dh');
		return null;
	}],
	['E12.3', 'phonetic respelling, vowel', (w) => {
		if (w.includes('i')) return w.replaceAll('i', 'y');
		if (w.includes('u')) return w.replace('u', 'oo');
		if (w.includes('a')) return w.replace('a', 'aa');
		return null;
	}],

	['E13.1', 'mask plus leet', (w) => {
		const leet = mapFirst(w, LEET_DIGIT);
		return leet === null || leet.length < 4 ? null : replaceAt(leet, 2, '*');
	}],
	['E13.2', 'mask plus homoglyph', (w) => {
		const hg = mapFirstVowel(w, CYRILLIC);
		return hg === null || hg.length < 4 ? null : replaceAt(hg, 2, '*');
	}],
	['E13.3', 'stretch plus leet', (w) => {
		const leet = mapFirst(w, LEET_DIGIT);
		if (leet === null) return null;
		const i = firstVowelAt(leet);
		return i < 0 ? leet + leet[leet.length - 1].repeat(3) : replaceAt(leet, i, leet[i].repeat(4));
	}],
	['E13.4', 'segmentation plus case', (w) => spaced(w.toUpperCase(), ' ')],
	['E13.5', 'zero-width plus leet', (w) => {
		const leet = mapFirst(w, LEET_DIGIT);
		return leet === null || leet.length < 3 ? null : insertAt(leet, 2, '\u200B');
	}],
	['E13.6', 'three transforms at once', (w) => {
		const leet = mapFirst(w, LEET_DIGIT);
		if (leet === null || leet.length < 4) return null;
		const i = firstVowelAt(leet);
		const stretched = i < 0 ? leet : replaceAt(leet, i, leet[i].repeat(3));
		return replaceAt(stretched, stretched.length - 2, '*').toUpperCase();
	}],
];

/**
 * The native-script transform matrix, applied to every language that has one.
 * Insertion points are grapheme boundaries (Intl.Segmenter in the runner), so
 * a matra or a virama sequence is never split down the middle.
 */
export const NATIVE_MATRIX = [
	['E2.1', 'ZWNJ inside the word', (g) => (g.length < 2 ? null : [...g.slice(0, 1), '\u200C', ...g.slice(1)].join(''))],
	['E2.4', 'variation selector inside', (g) => (g.length < 2 ? null : [...g.slice(0, 1), '\uFE0F', ...g.slice(1)].join(''))],
	['E2.5', 'one interior dot', (g) => (g.length < 2 ? null : [...g.slice(0, 1), '.', ...g.slice(1)].join(''))],
	['E3.1', 'grapheme stretch', (g) => (g.length < 2 ? null : [...g.slice(0, 1), g[1], g[1], g[1], ...g.slice(1)].join(''))],
	['E4.1', 'one interior mask', (g) => (g.length < 3 ? null : [...g.slice(0, 1), '*', ...g.slice(2)].join(''))],
	['E10.1', 'hashtag', (g) => `#${g.join('')}`],
];

// PART 4 — THE LANGUAGE SUITES
//
// Per language:
//
//   latin   romanized base words the LATIN_MATRIX is applied to, in order.
//           A transform takes the first base it applies to.
//   native  native-script base words the NATIVE_MATRIX is applied to.
//   mix     the two script-mixing cases (E7.1, E7.2). These cannot be
//           generated: splitting a native word and appending a romanized tail
//           needs a romanization, which is data, not a function.
//   sentences  two E0 controls in running text, on top of the bare-word
//           controls the runner generates from `latin` and `native`.
//   named   hand-written cases for the axes a transform cannot express:
//           morphology, transliteration spread, script doublets, lexicon.
//   clean   the clean traps. C5 cross-language collisions live in
//           CROSS_LANGUAGE_SUITE instead, so no text is counted twice.
//
// On the caste terms. The packs deliberately flag the caste EPITHETS —
// chamar, bhangi, paraiyan, pulayan, chuhra, madigodu and their siblings —
// and deliberately do NOT flag the varna and category terms (shudra,
// "low caste", soothiran), which were removed from the packs on 2026-08-14
// precisely so that writing ABOUT caste is not censored. The battery follows
// that line rather than blurring it: the epithets are scored as intended hits
// under E11, and C4 tests the community self-names, the varna terms and
// anti-caste discourse. The earlier version of this battery put the epithets
// on the clean side wrapped in the one collocation each pack allowlists
// ("the Chamar Regiment was raised in 1943"), which measured the allowlist
// rather than the axis; the runner now prints an ALLOWLIST DEPENDENCE section
// so that failure mode is visible instead of asserted away.

export const LANGUAGE_SUITES = {
	en: {
		name: 'english',
		latin: ['fuck', 'shit', 'bitch', 'asshole', 'ass'],
		native: [],
		mix: [],
		sentences: [
			['plain fuck in a sentence', 'oh fuck this whole situation'],
			['plain asshole in a sentence', 'he parked like an asshole again'],
		],
		named: [
			['E5.9', 'split at a morpheme boundary', 'you absolute mother fucker'],
			['E5.10', 'three-word split', 'mo ther fuc ker'],
			['E8.1', 'plural', 'he gives no fucks at all'],
			['E8.2', 'present participle', 'that meeting was fucking pointless'],
			['E8.2', 'past participle', 'the build is totally fucked'],
			['E8.3', 'compound', 'what a fuckface'],
			['E8.3', 'compound, shit', 'stop being such a shitbag'],
			['E12.2', 'ph for f', 'phuck off'],
			['E12.2', 'zz for ss', 'total azzhole'],
			['E12.2', 'k for c', 'what a kunt'],
			['E12.3', 'y for i', 'this is shyt'],
			['E12.3', 'ia for i', 'she called me a biatch'],
			['E11', 'lexicon: cunt', 'what an absolute cunt'],
			['E11', 'lexicon: bastard', 'you complete bastard'],
			['E11', 'lexicon: whore', 'he called her a whore'],
			['E11', 'lexicon: slut', 'slut is a slur'],
			['E11', 'lexicon: prick', 'what a prick'],
			['E11', 'lexicon: twat', 'total twat'],
			['E11', 'lexicon: wanker', 'what a wanker'],
			['E11', 'lexicon: motherfucker', 'you motherfucker'],
		],
		clean: [
			['C1', 'scunthorpe', 'Scunthorpe United drew at home'],
			['C1', 'penistone', 'Penistone Grammar School'],
			['C1', 'assumption', 'under that assumption the model holds'],
			['C1', 'assassin', 'an assassin appears in the third act'],
			['C1', 'assess', 'we will assess the damage tomorrow'],
			['C1', 'assign', 'assign the ticket to the on-call engineer'],
			['C1', 'assistant', 'the assistant registrar signed it'],
			['C1', 'bassist', 'the bassist tuned up before the set'],
			['C1', 'bassinet', 'a wicker bassinet by the window'],
			['C1', 'classic', 'a classic case of overreach'],
			['C1', 'compassion', 'she showed real compassion'],
			['C1', 'harassment', 'the harassment policy was updated'],
			['C1', 'passage', 'read the passage aloud'],
			['C1', 'cocktail', 'a cocktail of bad decisions'],
			['C1', 'shuttlecock', 'the shuttlecock landed in the net'],
			['C1', 'peacock', 'a peacock crossed the lawn'],
			['C1', 'cockpit', 'the cockpit voice recorder survived'],
			['C1', 'cocker spaniel', 'a cocker spaniel puppy'],
			['C1', 'dickens', 'reading Dickens over the holidays'],
			['C1', 'moby dick', 'Moby Dick is a whale'],
			['C1', 'hitchcock', 'a Hitchcock retrospective'],
			['C1', 'cumulative', 'the cumulative effect is large'],
			['C1', 'cum laude', 'she graduated summa cum laude'],
			['C1', 'cumin', 'add a teaspoon of cumin'],
			['C1', 'grass', 'the grass needs cutting again'],
			['C1', 'analysis', 'the analysis was inconclusive'],
			['C1', 'therapist', 'I booked a therapist for Tuesday'],
			['C1', 'scrape', 'be careful, that will scrape the paint'],
			['C1', 'grapes', 'a bowl of green grapes'],
			['C1', 'hancock', 'the Hancock Tower in Boston'],
			['C1', 'great tit', 'a great tit at the feeder'],
			['C1', 'titter', 'a titter ran round the room'],
			['C1', 'shiitake', 'add shiitake to the broth'],
			['C1', 'sextant', 'he read the sextant at dawn'],
			['C1', 'uranus', 'Uranus has thirteen rings'],
			['C1', 'specialist', 'ask a specialist about it'],
			['C1', 'cockburn', 'Cockburn Street in Edinburgh'],
			['C1', 'titicaca', 'Lake Titicaca is in Peru'],
			['C1', 'middlesex', 'Middlesex County cricket'],
			['C1', 'arsenal', 'Arsenal beat Chelsea on Saturday'],
			['C1', 'clitheroe', 'Clitheroe Castle in Lancashire'],
			['C1', 'buttress', 'a flying buttress holds the wall'],

			// C2 is the one axis whose instances come OUT of the C14 sweep rather
			// than out of a native speaker's head — that is what the axis is for.
			// The path is add-only: a word the sweep shows being flagged is added
			// here so it is visible in the headline totals, never removed because
			// it fails. See METHODOLOGY.md, "The one sanctioned feedback path".
			['C2', 'besodden', 'the cloth was besodden'],
			['C2', 'beancod', 'a beancod is a small fishing boat'],
			['C2', 'classed', 'it is classed as a hazard'],
			['C2', 'nimrodian', 'a Nimrodian appetite for hunting'],
			['C2', 'closed', 'the shop is closed today'],
			['C2', 'coleseed', 'coleseed oil comes from rapeseed'],
			['C2', 'dalle', 'a dalle de verre window'],
			['C2', 'beinked', 'the page was beinked'],
			['C2', 'shuddered', 'she shuddered at the thought'],
			['C2', 'shuddered again', 'the train shuddered to a halt'],
			['C2', 'calloused', 'his hands were calloused from work'],
			['C2', 'callused', 'the callused palm of a farmer'],
			['C2', 'calloused figurative', 'a calloused indifference to detail'],
			['C2', 'chain-pull', 'the chain-pull switch was broken'],
			['C2', 'can-polishing', 'can-polishing is a finishing step'],
			['C2', 'closed-coil', 'a closed-coil armature winding'],
			['C2', 'banked', 'the committee banked the funds'],
			['C2', 'bounced', 'the cheque bounced last week'],
			['C2', 'benched', 'the keeper was benched for a game'],
			['C2', 'bunched', 'the fabric bunched at the seam'],
			['C2', 'motorcade', 'the presidential motorcade passed'],
			['C2', 'spiced', 'a spiced pear tart'],
			['C2', 'cocker', 'the cocker of the hammer stuck'],
			['C2', 'dicker', 'they dicker over the price'],

			['C6', 'agency initialisms', 'the F.B.I. and the C.I.A. agreed'],
			['C6', 'rsvp', 'R.S.V.P. by Friday, e.g. today'],
			['C6', 'country initialism', 'made in the U.S.A.'],
			['C6', 'clock initialisms', 'between 9 a.m. and 5 p.m.'],
			['C6', 'degrees', 'a Ph.D. thesis and a B.Tech degree'],
			['C6', 'institute', 'she studied at I.I.T. Madras'],
			['C6', 'un agency', 'the U.N.E.S.C.O. delegation arrived'],
			['C6', 'broadcaster', 'the B.B.C. World Service'],
			['C6', 'atm', 'the A.T.M. pin is four digits'],
			['C6', 'space agency', 'N.A.S.A. confirmed the launch window'],

			['C7', 'git command', 'git commit -m "fix the parser"'],
			['C7', 'semver prerelease', 'upgrade to v1.2.3-rc4'],
			['C7', 'hex colour', 'the accent is #f0ff00'],
			['C7', 'sql', 'SELECT * FROM users WHERE id = 5'],
			['C7', 'printf', 'printf("%s\\n", buf)'],
			['C7', 'md5 digest', 'md5 5f4dcc3b5aa765d61d8327deb882cf99'],
			['C7', 'aws key shape', 'AKIA5H1TXXXXXXXXXXXX'],
			['C7', 'hex literal', 'the mask is 0x1a2b3c'],
			['C7', 'ipv6', 'bind to fe80::1 please'],
			['C7', 's3 uri', 's3://bucket/key/part-0000'],
			['C7', 'shell env', 'echo $PATH && echo $HOME'],
			['C7', 'npm install', 'npm i -D vitest typescript'],
			['C7', 'base64', 'the payload is c2hpdA== in base64'],
			['C7', 'docker tag', 'docker pull node:22-alpine3.19'],
			['C7', 'uuid', 'id 3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
			['C7', 'regex', 'match /^[a-z0-9_]{4,}$/i against the slug'],
			['C7', 'null pointer', 'a null pointer dereference'],
			['C7', 'randint', 'call random.randint(0, 10)'],

			['C8', 'date bc', 'this happened in 500 BC'],
			['C8', 'leet number', 'the score was 1337 points'],
			['C8', 'money', 'that will be 100 rupees and 50 paise'],
			['C8', 'room number', 'meet me in Room 4B'],
			['C8', 'ip address', 'the gateway is 192.168.1.1'],
			['C8', 'http status', 'the server returned error code 500'],
			['C8', 'duration', 'the timeout is 45s'],
			['C8', 'iso date', 'the release is dated 2026-08-15'],
			['C8', 'phone', 'call +44 20 7946 0958'],
			['C8', 'version', 'we shipped 2.0.1 last night'],

			['C11', 'sharp languages', 'C# and F# are .NET languages'],
			['C11', 'percentage', '100% cotton, 50% off'],
			['C11', 'ampersand brand', 'AT&T raised prices'],
			['C11', 'price', '$5 off your first order'],
			['C11', 'perl-ish assignment', 'a$$ = 5 in that dialect'],
			['C11', 'hashtag with percent', '50% off #sale today'],
			['C11', 'shell glob', 'rm -i *.tmp in that folder'],
			['C11', 'markdown bold', 'wrap it in **bold** for emphasis'],

			['C12', 'bass guitar spelled', 'b a s s guitar lessons'],
			['C12', 'keyboard row', 'the top row is q w e r t y'],
			['C12', 'initials in a name', 'Dr. A. B. Smith will see you'],
			['C12', 'spelling a word out', 'it is spelled c a t s'],
			['C12', 'hyphenated words', 'T-shirt, e-mail, x-ray, co-op'],
			['C12', 'letters recited', 'the letters a b c d e f'],
			['C12', 'spelling hello', 'spell it out: h e l l o'],
			['C12', 'phonetic drill', 'repeat after me: p a p e r'],
		],
	},

	hi: {
		name: 'hindi + hinglish',
		latin: ['chutiya', 'madarchod', 'bhosdike', 'gandu'],
		native: ['मादरचोद', 'बहनचोद'],
		mix: [
			['E7.1', 'devanagari head, latin tail', 'माdarchod'],
			['E7.2', 'latin head, devanagari tail', 'madarचोद'],
		],
		sentences: [
			['devanagari in a sentence', 'तू एक मादरचोद है'],
			['romanized in a sentence', 'tu ek chutiya hai yaar'],
		],
		named: [
			['E8.4', 'oblique plural', 'chutiyon ki baat mat karo'],
			['E8.4', 'vocative', 'aa gaya chutiye'],
			['E8.3', 'derived noun', 'ye kya chutiyapa hai'],
			['E9.1', 'vowel-length variant', 'behenchod kahin ka'],
			['E9.1', 'unlisted vowel variant', 'bahnchod'],
			['E9.2', 'aspiration variant', 'bhainchod'],
			['E9.3', 'gemination variant', 'bhosadike'],
			['E11', 'abbreviation', 'abe bsdk'],
			['E11', 'spaced abbreviation', 'abe b s d k'],
			['E11', 'caste epithet', 'chamar'],
			['E11', 'caste epithet 2', 'bhangi'],
			['S1.2', 'nukta optional', 'भोसडीके'],
			['S2.1', 'ZWJ around a virama', 'बहन\u200Dचोद'],
			['S2.2', 'doubled halant', 'मादर््चोद'],
		],
		clean: [
			['C3', 'gandhi', 'Mahatma Gandhi visited the mill'],
			['C3', 'gandhinagar', 'Gandhinagar is the capital of Gujarat'],
			['C3', 'thackeray', 'Bal Thackeray founded the party'],
			['C3', 'chandigarh', 'Chandigarh was designed by Le Corbusier'],
			['C3', 'kanpur', 'Kanpur is on the Ganges'],
			['C3', 'lodhi garden', 'Lodhi Garden in central Delhi'],
			['C3', 'gandak river', 'the Gandak river floods each monsoon'],
			['C3', 'chandni chowk', 'Chandni Chowk is always crowded'],
			['C4', 'valmiki samaj', 'the Valmiki samaj held a gathering'],
			['C4', 'dalit bahujan', 'Dalit and Bahujan writers met'],
			['C4', 'annihilation of caste', 'Ambedkar wrote Annihilation of Caste'],
			['C4', 'varna in texts', 'the varna scheme appears in classical texts'],
			['C4', 'shudra category', 'shudra is a varna category, not an insult'],
			['C4', 'caste discrimination', 'caste discrimination in hiring is illegal'],
			['C4', 'meena community', 'the Meena community of Rajasthan'],
			['C4', 'bsp', 'the Bahujan Samaj Party contested the seat'],
			['C9', 'search on google', 'गूगल पर खोजें'],
			['C9', 'the owner arrived', 'मालिक आ गया'],
			['C9', 'capital of india', 'भारत की राजधानी दिल्ली है'],
			['C9', 'a good day', 'यह एक अच्छा दिन है'],
			['C9', 'i like speaking hindi', 'मुझे हिंदी बोलना पसंद है'],
			['C9', 'children going to school', 'बच्चे स्कूल जा रहे हैं'],
			['C9', 'it may rain', 'आज बारिश हो सकती है'],
			['C9', 'book on the table', 'किताब मेज़ पर रखी है'],
			['C10', 'chutney', 'chutney recipe please'],
			['C10', 'pakki', 'baat pakki ho gayi'],
			['C10', 'chhod', 'woh naukri chhod raha hai'],
			['C10', 'launde', 'mere launde aa gaye'],
			['C10', 'chuha', 'ghar mein chuha hai'],
			['C10', 'gandh', 'phoolon ki gandh achhi hai'],
			['C10', 'khaana', 'khaana taiyaar hai'],
			['C10', 'chaat', 'chaat aur golgappe khaayenge'],
			['C13', 'dog, romanized', 'kutte ko khana do'],
			['C13', 'office tomorrow', 'mujhe kal office jana hai'],
			['C13', 'good book', 'yeh kitab bahut achhi hai'],
			['C13', 'how are you', 'bhai tum kaise ho'],
			['C13', 'going out', 'chalo bahar ghumne chalte hain'],
			['C13', 'cold water', 'paani thanda hai abhi'],
			['C13', 'mother cooked', 'maa ne khana banaya hai'],
			['C13', 'drive slowly', 'gaadi dheere chalao yaar'],
			['C13', 'all fine', 'sab theek hai na'],
			['C13', 'sms english', 'gud morning bro'],
			['C13', 'breakfast', 'nashta taiyaar hai'],
		],
	},

	bn: {
		name: 'bengali + banglish',
		latin: ['khanki', 'banchot', 'bokachoda', 'magi'],
		native: ['খানকি', 'বানচোত'],
		mix: [
			['E7.1', 'bengali head, latin tail', 'খানki'],
			['E7.2', 'latin head, bengali tail', 'khanকি'],
		],
		sentences: [
			['native in a sentence', 'তুই একটা খানকি'],
			['romanized in a sentence', 'tui ekta banchot'],
		],
		named: [
			['E8.4', 'genitive inflection', 'khankir chele'],
			['E8.3', 'native compound', 'বেজম্মা ছেলে'],
			['E9.1', 'vowel-length variant', 'baanchod'],
			['E9.2', 'aspiration variant', 'banchod'],
			['E9.4', 'kolkata romanization', 'choda'],
			['E9.4', 'dhaka romanization', 'chuda'],
			['E11', 'lexicon: shuor', 'shuor er baccha'],
			['E11', 'lexicon: chandal', 'চাঁড়াল'],
			['S1.5', 'bare-ন spelling', 'বানচোত'],
			['S1.5', 'ঙ্ক spelling', 'খাঙ্কি'],
			['S1.5', 'nasal doublet', 'বেজম্মা'],
			['S1.2', 'nukta variant', 'ল্যাওডা'],
			['S2.2', 'doubled hosonto', 'বাঞ্্চোত'],
			['S2.1', 'ZWJ around hosonto', 'বান\u200Dচোত'],
		],
		clean: [
			['C3', 'tagore', 'Rabindranath Tagore wrote the anthem'],
			['C3', 'sundarbans', 'the Sundarbans mangrove forest'],
			['C3', 'murshidabad', 'Murshidabad was the Nawabi capital'],
			['C3', 'bardhaman', 'Bardhaman district in West Bengal'],
			['C3', 'howrah bridge', 'Howrah Bridge carries the traffic'],
			['C3', 'santiniketan', 'Santiniketan was founded by Tagore'],
			['C4', 'namasudra', 'the Namasudra reform movement grew'],
			['C4', 'matua', 'the Matua community of Bengal'],
			['C4', 'baul', 'Baul singers of Birbhum performed'],
			['C4', 'bengali muslim peasantry', 'the Bengali Muslim peasantry organised'],
			['C9', 'peace', 'শান্তি নিকেতন'],
			['C9', 'bengal', 'বাংলা ভাষা আমার'],
			['C9', 'khanda ta', 'হঠাৎ বৃষ্টি এলো'],
			['C9', 'ya-phala', 'সত্য কথা বলো'],
			['C9', 'ba-phala', 'বিশ্ব শান্তি দিবস'],
			['C9', 'ordinary bengali', 'কলকাতা শহর খুব সুন্দর'],
			['C9', 'i like reading', 'আমি বই পড়তে ভালোবাসি'],
			['C9', 'clear sky', 'আজ আকাশ পরিষ্কার'],
			['C10', 'warehouse', 'গুদাম ঘর ভরা'],
			['C10', 'jaggery', 'গুড় দিয়ে চা'],
			['C10', 'wealth', 'ধন সম্পদ বেড়েছে'],
			['C10', 'house', 'বাড়ি যাব এখন'],
			['C10', 'increase', 'বাড়া ভাত'],
			['C10', 'year vs sal tree', 'সাল ২০২৪ শুরু'],
			['C10', 'moon', 'চাঁদ উঠেছে আকাশে'],
			['C13', 'i am well', 'ami bhalo achhi'],
			['C13', 'where are you going', 'tumi kothay jachcho'],
			['C13', 'it will rain', 'aaj bristi hobe'],
			['C13', 'going home', 'bari jabo ekhon'],
			['C13', 'i like books', 'boi porte bhalo lage'],
			['C13', 'have tea', 'cha kheye nao'],
			['C13', 'my name', 'amar naam Rahul'],
			['C13', 'kolkata to dhaka', 'kolkata theke dhaka jabo'],
		],
	},

	mr: {
		name: 'marathi',
		latin: ['zavadya', 'bhadvya', 'halkat', 'aayzavya'],
		native: ['भडव्या', 'आयझव्या'],
		mix: [
			['E7.1', 'devanagari head, latin tail', 'झवाdya'],
			['E7.2', 'latin head, devanagari tail', 'zavaड्या'],
		],
		sentences: [
			['native in a sentence', 'तू एक नंबरचा भडव्या आहेस'],
			['romanized in a sentence', 'to ek halkat manus aahe'],
		],
		named: [
			['E8.4', 'oblique', 'गांडीत'],
			['E8.4', 'vocative', 'झवाड्या'],
			['E8.4', 'genitive', 'भोसडीच्या'],
			['E9.2', 'aspiration variant', 'jhavadya'],
			['E9.1', 'vowel variant', 'ayzavya'],
			['E9.3', 'caste epithet romanized', 'maharya'],
			['E9.3', 'caste epithet romanized 2', 'chambharya'],
			['E11', 'lexicon: yedzavya', 'येडझव्या'],
			['E11', 'lexicon: randechya', 'रांडेच्या'],
			['S1.7', 'eyelash reph', 'महाऱ्या'],
			['S1.7', 'plain र spelling', 'महार्या'],
			['S1.1', 'nasal plus virama', 'गाण्डीत'],
			['S2.1', 'ZWNJ around a virama', 'भड\u200Cव्या'],
		],
		clean: [
			['C3', 'karhad', 'कऱ्हाड तालुका'],
			['C3', 'maharashtra day', 'महाराष्ट्र राज्य स्थापना दिन'],
			['C3', 'tilak', 'Lokmanya Tilak edited Kesari'],
			['C3', 'nashik', 'Nashik hosts the Kumbh Mela'],
			['C3', 'shivneri', 'Shivneri fort near Junnar'],
			['C3', 'ratnagiri alphonso', 'Ratnagiri Alphonso mangoes are exported'],
			['C4', 'mang samaj', 'मांग समाजाची बैठक झाली'],
			['C4', 'mahar samaj', 'महार समाजाचा इतिहास लिहिला गेला'],
			['C4', 'chambhar samaj', 'चांभार समाजाची सभा भरली'],
			['C4', 'ambedkar mhow', 'Ambedkar was born in Mhow'],
			['C4', 'satyashodhak', 'the Satyashodhak Samaj challenged caste'],
			['C9', 'i speak marathi', 'मी मराठी बोलतो'],
			['C9', 'rain in pune', 'पुणे शहरात पाऊस पडतो आहे'],
			['C9', 'holiday today', 'आज सुट्टी आहे'],
			['C9', 'book on the table', 'पुस्तक टेबलावर आहे'],
			['C9', 'i like tea', 'मला चहा आवडतो'],
			['C10', 'earthworm', 'गांडूळ खत तयार आहे'],
			['C10', 'dog', 'कुत्रा भुंकतो आहे'],
			['C10', 'soon', 'लवकर या घरी'],
			['C10', 'on rent', 'भाड्याने घर मिळेल का'],
			['C10', 'contrastive ळ', 'काळ आणि काल वेगळे आहेत'],
			['C13', 'earthworm roman', 'gandul khat vapara'],
			['C13', 'i know marathi', 'mala marathi yete'],
			['C13', 'how are you', 'kasa aahes tu'],
			['C13', 'no school today', 'aaj shala nahi'],
			['C13', 'have you eaten', 'jevan zhala ka'],
			['C13', 'drive slowly', 'gaadi hallu chalav'],
			['C13', 'read the book', 'pustak vach ani sang'],
			['C7', 'variable name', 'the variable zav_dy is unused'],
		],
	},

	pa: {
		name: 'punjabi + punglish',
		latin: ['phuddi', 'kanjar', 'gashti', 'madarchod'],
		native: ['ਫੁੱਡੀ', 'ਮਾਦਰਚੋਦ'],
		mix: [
			['E7.1', 'gurmukhi head, latin tail', 'ਕੰjar'],
			['E7.2', 'latin head, gurmukhi tail', 'phuਡੀ'],
		],
		sentences: [
			['gurmukhi in a sentence', 'ਤੂੰ ਇੱਕ ਫੁੱਡੀ ਹੈਂ'],
			['romanized in a sentence', 'oye madarchod idhar aa'],
		],
		named: [
			['E9.4', 'punjabi p-initial form', 'painchod'],
			['E9.2', 'aspiration variant', 'fuddi'],
			['E9.1', 'vowel variant', 'phudi'],
			['E11', 'curse phrase', 'khasma nu khani'],
			['E11', 'caste epithet romanized', 'chuhra'],
			['E11', 'caste epithet romanized 2', 'chamar'],
			['E8.4', 'oblique', 'ਕੰਜਰਾਂ ਦੀ ਗੱਲ'],
			['S1.3', 'addak dropped', 'ਫੁਡੀ'],
			['S1.3', 'tippi for bindi', 'ਕੰਜਰ'],
			['S1.3', 'adak bindi', 'ਕਁਜਰ'],
			['S1.2', 'nukta omitted', 'ਗਸਤੀ'],
			['S2.1', 'ZWNJ in gurmukhi', 'ਕੰ\u200Cਜਰ'],
		],
		clean: [
			['C3', 'amritsar', 'Amritsar has the Golden Temple'],
			['C3', 'ludhiana', 'Ludhiana is a hosiery hub'],
			['C3', 'bathinda', 'Bathinda has a thermal plant'],
			['C3', 'anandpur sahib', 'Anandpur Sahib hosts Hola Mohalla'],
			['C3', 'harike wetland', 'the Harike wetland attracts migratory birds'],
			['C4', 'jatt sikh', 'Jatt Sikh farmers protested the bills'],
			['C4', 'mazhabi', 'Mazhabi Sikh regiment history is documented'],
			['C4', 'ramgarhia', 'the Ramgarhia carpenters of Amritsar'],
			['C4', 'saini', 'Saini community leaders met in Jalandhar'],
			['C4', 'labana', 'Labana traders travelled the Grand Trunk Road'],
			['C9', 'greeting', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'],
			['C9', 'capital', 'ਪੰਜਾਬ ਦੀ ਰਾਜਧਾਨੀ ਚੰਡੀਗੜ੍ਹ ਹੈ'],
			['C9', 'reading a book', 'ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹ ਰਿਹਾ ਹਾਂ'],
			['C9', 'good weather', 'ਅੱਜ ਮੌਸਮ ਚੰਗਾ ਹੈ'],
			['C9', 'going to school', 'ਸਾਨੂੰ ਸਕੂਲ ਜਾਣਾ ਹੈ'],
			['C10', 'patta minimal pair', 'ਮੈਨੂੰ ਪਤਾ ਹੈ'],
			['C10', 'dass minimal pair', 'ਦਸ ਬੰਦੇ ਆਏ'],
			['C10', 'nukta word', 'ਸ਼ਹਿਰ ਵਿੱਚ ਬਹੁਤ ਭੀੜ ਹੈ'],
			['C10', 'cold water', 'ਪਾਣੀ ਠੰਢਾ ਹੈ'],
			['C13', 'how are you', 'tusi kive ho'],
			['C13', 'going home', 'main ghar ja riha haan'],
			['C13', 'eat the roti', 'roti kha lai'],
			['C13', 'good weather', 'aaj mausam changa hai'],
			['C13', 'drive slowly', 'gaddi hauli chalao'],
			['C13', 'our village', 'sada pind vadda hai'],
			['C7', 'config flag', 'the phudFlag config is deprecated'],
		],
	},

	gu: {
		name: 'gujarati',
		latin: ['bhosdina', 'chhinal', 'madarchod', 'baylo'],
		native: ['ભોસડીના', 'છિનાળ'],
		mix: [
			['E7.1', 'gujarati head, latin tail', 'ભોસdina'],
			['E7.2', 'latin head, gujarati tail', 'bhosડીના'],
		],
		sentences: [
			['gujarati in a sentence', 'તું એક ભોસડીના છે'],
			['romanized in a sentence', 'tu ek bhosdina che'],
		],
		named: [
			['E9.1', 'vowel variant', 'bhosadina'],
			['E9.2', 'aspiration variant', 'bosdina'],
			['E11', 'caste epithet romanized', 'dhed'],
			['E11', 'caste epithet romanized 2', 'vaghri'],
			['E11', 'phrase', 'randno dikro'],
			['E8.3', 'compound', 'ભોસડીનો દીકરો'],
			['S1.1', 'conjunct for anusvara', 'ગાન્ડ'],
			['S1.1', 'anusvara spelling', 'ભોંસડીના'],
			['S1.2', 'candrabindu', 'ભોઁસડીના'],
			['S2.1', 'ZWNJ in gujarati', 'ભોસ\u200Cડીના'],
			['S2.2', 'doubled virama', 'ગાન્્ડ'],
		],
		clean: [
			['C3', 'rajkot', 'Rajkot is in Saurashtra'],
			['C3', 'bhavnagar', 'Bhavnagar port handles cargo'],
			['C3', 'narmada dam', 'the Narmada dam raised the reservoir'],
			['C3', 'randal mata', 'રાંદલ માતાનો મંડપ'],
			['C3', 'dwarka', 'Dwarka is a pilgrimage town'],
			['C4', 'vankar', 'the Vankar community of Gujarat weaves patola'],
			['C4', 'meghwal', 'Meghwal weavers work in Kutch'],
			['C4', 'devipujak', 'the Devipujak samaj met in Ahmedabad'],
			['C4', 'valmiki samaj gu', 'Valmiki samaj members joined the march'],
			['C9', 'capital', 'ગુજરાતની રાજધાની ગાંધીનગર છે'],
			['C9', 'it will rain', 'આજે વરસાદ પડશે એવું લાગે છે'],
			['C9', 'i like tea', 'મને ચા ભાવે છે'],
			['C9', 'book on the table', 'પુસ્તક ટેબલ પર છે'],
			['C10', 'gandu vs gandum', 'એ સાવ ગાંડું છે'],
			['C10', 'gando', 'ગાંડો માણસ છે'],
			['C10', 'kutir', 'આ કુટીર ઉદ્યોગ છે'],
			['C10', 'lavad', 'લવાદ નિમાયો'],
			['C10', 'halku', 'હલકું વજન છે'],
			['C10', 'visarga', 'મને દુઃખ થયું'],
			['C10', 'loan vowel', 'મેં કૉલ કર્યો'],
			['C13', 'how are you', 'tame kem cho'],
			['C13', 'going home', 'hu ghare jaun chu'],
			['C13', 'it will rain', 'aaje varsad padshe'],
			['C13', 'i like tea', 'mane chai bhave che'],
			['C13', 'drive slowly', 'gadi dhime chalavo'],
			['C13', 'read the book', 'pustak vancho ane kaho'],
			['C7', 'dhcp', 'the dhcpd lease expired'],
		],
	},

	or: {
		name: 'odia + odlish',
		latin: ['maghia', 'baanda', 'gaandi', 'randi'],
		native: ['ମାଘିଆ', 'ଗାଣ୍ଡି'],
		mix: [
			['E7.1', 'odia head, latin tail', 'ମାଘia'],
			['E7.2', 'latin head, odia tail', 'maghଆ'],
		],
		sentences: [
			['native in a sentence', 'ତୁ ଏକ ମାଘିଆ'],
			['romanized in a sentence', 'tu ekta maghia'],
		],
		named: [
			['E8.5', 'attached case suffix', 'ତୋ ଗାଣ୍ଡିରେ'],
			['E8.5', 'agglutinated romanized', 'gaandire'],
			['E8.3', 'native compound', 'ଭଉଣୀଘିଆ'],
			['E9.1', 'vowel variant', 'maghiaa'],
			['E11', 'borrowed layer', 'randi puo'],
			['E11', 'lexicon: chandal', 'ଚଣ୍ଡାଳ'],
			['S1.1', 'anusvara spelling', 'ଗାଂଡି'],
			['S1.2', 'candrabindu spelling', 'ଗାଁଡି'],
			['S1.2', 'nukta-less spelling', 'ହିଜଡା'],
			['S2.1', 'halant plus ZWJ', 'ଗାଣ୍\u200Dଡି'],
			['S2.2', 'doubled halant', 'ଗାଣ୍୍ଡି'],
		],
		clean: [
			['C3', 'bhubaneswar', 'Bhubaneswar is the temple city'],
			['C3', 'konark', 'the Konark sun temple faces the sea'],
			['C3', 'sambalpur', 'Sambalpur is known for its ikat'],
			['C3', 'chilika', 'Chilika lake hosts migratory birds'],
			['C4', 'sabar community', 'the Sabar tribal community of Odisha'],
			['C4', 'jagannath servitors', 'the Jagannath temple servitors organise the rath'],
			['C4', 'bhima bhoi', 'the Bhima Bhoi tradition rejected caste hierarchy'],
			['C9', 'odia language name', 'ଓଡ଼ିଆ ଆମର ମାତୃଭାଷା'],
			['C9', 'priya with yya', 'ମୋର ପ୍ରିୟ ବନ୍ଧୁ'],
			['C9', 'ordinary odia', 'ଜଗନ୍ନାଥ ମନ୍ଦିର ପୁରୀରେ ଅଛି'],
			['C9', 'good weather', 'ଆଜି ପାଗ ଭଲ ଅଛି'],
			['C10', 'gandiva bow', 'ଅର୍ଜୁନଙ୍କ ଗାଣ୍ଡିବ ଧନୁ'],
			['C10', 'bandi cart', 'ବାଣ୍ଡି ଗାଡ଼ିରେ ଯାଉଛି'],
			['C10', 'bandage', 'ହାତରେ ବାଣ୍ଡେଜ ବାନ୍ଧିଲା'],
			['C10', 'pudina', 'ପୁଦିନା ଚଟଣି'],
			['C10', 'biana', 'ବିଆଣ ଦିନ ପାଖେଇ ଆସିଲା'],
			['C10', 'randa widow', 'ରଣ୍ଡା ସ୍ତ୍ରୀଲୋକ'],
			['C10', 'magiba to beg', 'ସେ ଭିକ ମାଗିବାକୁ ଗଲା'],
			['C10', 'magha month', 'ମାଘ ମାସର ଶୀତ'],
			['C10', 'hasa vs hansa', 'ପିଲାଟି ହସୁଛି'],
			['C13', 'i am going home', 'mu ghara jauchi'],
			['C13', 'how are you', 'tume kemiti achha'],
			['C13', 'weather is fine', 'aji pagha bhala achi'],
			['C13', 'eating rice', 'bhata khaiba pain basila'],
			['C13', 'mint chutney', 'pudina chatani bhala lage'],
		],
	},

	ta: {
		name: 'tamil + tanglish',
		latin: ['pundai', 'thevidiya', 'soothu', 'poolu'],
		native: ['புண்டை', 'தேவிடியா'],
		mix: [
			['E7.1', 'tamil head, latin tail', 'புண்dai'],
			['E7.2', 'latin head, tamil tail', 'punண்டை'],
		],
		sentences: [
			['native in a sentence', 'நீ ஒரு புண்டை'],
			['romanized in a sentence', 'nee oru pundai da'],
		],
		named: [
			['E8.5', 'agglutinated native', 'சூத்துல'],
			['E8.5', 'agglutinated romanized', 'soothula'],
			['E9.1', 'vowel variant', 'poondai'],
			['E9.2', 'aspiration variant', 'thevdiya'],
			['E9.3', 'degeminated spelling', 'சகிலி'],
			['E11', 'caste epithet', 'avan oru paraiyan'],
			['E11', 'lexicon: ommala', 'ommala'],
			['S1.6', 'grantha spelling', 'ஜாதி'],
			['S1.6', 'aytham prefix', 'ஃபுண்டை'],
			['S1.6', 'ன/ந confusion', 'பறையந்'],
			['S2.1', 'pulli plus ZWJ', 'புண்\u200Dடை'],
			['S2.2', 'doubled pulli', 'புண்்டை'],
		],
		clean: [
			['C3', 'madurai', 'Madurai has the Meenakshi temple'],
			['C3', 'coimbatore', 'Coimbatore is a textile centre'],
			['C3', 'kanchipuram', 'Kanchipuram silk is handwoven'],
			['C3', 'pudukkottai', 'Pudukkottai was a princely state'],
			['C3', 'nilgiris', 'the Nilgiris get heavy rain'],
			['C4', 'paraiyar community', 'Paraiyar community leaders met the collector'],
			['C4', 'parai drum', 'the parai is a traditional drum'],
			['C4', 'poramboke land', 'poramboke land records were digitised'],
			['C4', 'devendrakula', 'the Devendrakula Vellalar renaming was notified'],
			['C4', 'vanniyar', 'Vanniyar community politics shaped the alliance'],
			['C4', 'soothiran varna', 'soothiran is a varna term in the texts'],
			['C9', 'todi raga', 'தோடி ராகம்'],
			['C9', 'capital of tamil nadu', 'தமிழ்நாடு தலைநகரம் சென்னை'],
			['C9', 'i speak tamil', 'நான் தமிழ் பேசுகிறேன்'],
			['C9', 'it will rain', 'இன்று மழை பெய்யும்'],
			['C9', 'book on the table', 'புத்தகம் மேசையில் உள்ளது'],
			['C10', 'kuthirai', 'குதிரை ஓடுகிறது'],
			['C10', 'koothir', 'கூதிர் காலம் வந்தது'],
			['C10', 'pundarikam', 'புண்டரீகம் என்றால் தாமரை'],
			['C10', 'suthu', 'சுத்து பார்க்கலாம்'],
			['C10', 'soodhu', 'சூது ஆடாதே'],
			['C10', 'minimal pairs', 'மணம் மற்றும் மனம்'],
			['C13', 'i speak tamil', 'naan tamil pesuren'],
			['C13', 'how are you', 'neenga eppadi irukeenga'],
			['C13', 'it will rain', 'innaiku mazhai varum'],
			['C13', 'food is ready', 'saapadu ready achu'],
			['C13', 'horse race', 'kuthirai race in Chennai'],
			['C13', 'greeting', 'vanakkam nanba eppadi iruka'],
			['C13', 'going home', 'naan veetuku poren'],
		],
	},

	te: {
		name: 'telugu + tenglish',
		latin: ['lanja', 'dengu', 'modda', 'pooku', 'lanjakoduku'],
		native: ['లంజ', 'లంజకొడుకు', 'గుద్ద'],
		mix: [
			['E7.1', 'telugu head, latin tail', 'లంja'],
			['E7.2', 'latin head, telugu tail', 'lanజ'],
		],
		sentences: [
			['native in a sentence', 'నువ్వు ఒక లంజ'],
			['romanized in a sentence', 'nuvvu oka lanja ra'],
		],
		named: [
			['E8.5', 'agglutinated native', 'లంజకొడుకు'],
			['E8.5', 'agglutinated romanized', 'dengutha'],
			['E9.1', 'vowel variant', 'lanjaa'],
			['E9.2', 'aspiration variant', 'lanjha'],
			['E11', 'caste epithet', 'వాడు ఒక మాదిగోడు'],
			['E11', 'religious slur', 'turaka'],
			['E11', 'lexicon: munda', 'ముండ'],
			['S1.1', 'anusvara doublet', 'ముణ్డ'],
			['S2.1', 'ZWNJ in telugu', 'లం\u200Cజ'],
			['S2.2', 'doubled virama', 'గుద్్ద'],
		],
		clean: [
			['C3', 'vijayawada', 'Vijayawada is on the Krishna river'],
			['C3', 'warangal', 'Warangal has the Thousand Pillar Temple'],
			['C3', 'tirupati', 'Tirupati draws millions of pilgrims'],
			['C3', 'godavari', 'the Godavari delta is fertile'],
			['C4', 'madiga dandora', 'the Madiga Dandora movement demanded sub-quotas'],
			['C4', 'mala mahanadu', 'the Mala Mahanadu conference was held'],
			['C4', 'sanyasi', 'the sanyasi left the village at dawn'],
			['C4', 'shudra varna', 'shudra is a varna in the classical scheme'],
			['C4', 'kapu reservation', 'the Kapu community reservation demand continues'],
			['C9', 'panchami', 'పంచమి తిథి ఈరోజు మొదలు'],
			['C9', 'moon rose', 'చంద్రుడు ఉదయించాడు'],
			['C9', 'vowels recited', 'అ ఆ ఇ ఈ ఉ ఊ'],
			['C9', 'capital', 'ఆంధ్రప్రదేశ్ రాజధాని అమరావతి'],
			['C9', 'i speak telugu', 'నేను తెలుగు మాట్లాడతాను'],
			['C10', 'randi = come', 'వచ్చి రండి'],
			['C10', 'chandalam = awful', 'ఇది చండాలంగా ఉంది'],
			['C10', 'gadida = donkey', 'గాడిద బరువు మోసింది'],
			['C10', 'modaka sweet', 'మోదకం వినాయకుడికి ఇష్టం'],
			['C13', 'i speak telugu', 'nenu telugu matladatanu'],
			['C13', 'how are you', 'meeru ela unnaru'],
			['C13', 'it will rain', 'ee roju vana padutundi'],
			['C13', 'have you eaten', 'annam tinnava'],
			['C13', 'drive slowly', 'bandi nemmadiga nadupu'],
			['C13', 'bribe', 'lancham teesukovadam neram'],
			['C13', 'dengue fever', 'dengu jwaram vachindi'],
			['C6', 'apsrtc initials', 'the A. P. S. R. T. C. bus to Vijayawada'],
		],
	},

	kn: {
		name: 'kannada + kanglish',
		latin: ['bevarsi', 'soole', 'tullu', 'boli'],
		native: ['ಸೂಳೆ', 'ಮುಂಡೆಮಗ', 'ಕುಂಡಿ'],
		mix: [
			['E7.1', 'kannada head, latin tail', 'ಸೂle'],
			['E7.2', 'latin head, kannada tail', 'sooಳೆ'],
		],
		sentences: [
			['native in a sentence', 'ನೀನು ಒಬ್ಬ ಸೂಳೆ'],
			['romanized in a sentence', 'nin ajji soolemaga'],
		],
		named: [
			['E8.5', 'agglutinated native', 'ತುಲ್ಲಿನ'],
			['E8.3', 'compound abuse', 'ಬೋಳಿಮಗನೆ'],
			['E9.1', 'vowel variant', 'soole maga'],
			['E9.2', 'aspiration variant', 'bewarsi'],
			['E11', 'religious slur', 'turuka'],
			['E11', 'lexicon: munde', 'ಮುಂಡೆ'],
			['S1.1', 'anusvara doublet', 'ಮುಣ್ಡೆಮಗ'],
			['S2.1', 'ZWNJ in kannada', 'ಸೂ\u200Cಳೆ'],
			['S2.2', 'doubled virama', 'ಮುಣ್್ಡೆ'],
		],
		clean: [
			['C3', 'mysuru', 'Mysuru palace is lit on Dasara'],
			['C3', 'hubballi', 'Hubballi is a railway junction'],
			['C3', 'chikkamagaluru', 'Chikkamagaluru grows coffee'],
			['C3', 'hampi', 'Hampi was the Vijayanagara capital'],
			['C4', 'holeya chalavadi', 'Holeya and Chalavadi communities petitioned'],
			['C4', 'madiga karnataka', 'the Madiga community in north Karnataka organised'],
			['C4', 'lingayat vokkaliga', 'Lingayat and Vokkaliga politics decided the seat'],
			['C4', 'keelu jaati phrase', 'ಕೀಳು ಜಾತಿ ಎಂಬ ಪದ ತಾರತಮ್ಯದ ಬಗ್ಗೆ ಬರೆಯುವಾಗ ಬರುತ್ತದೆ'],
			['C9', 'vowels recited', 'ಅ ಆ ಇ ಈ ಉ ಊ'],
			['C9', 'capital', 'ಬೆಂಗಳೂರು ಕರ್ನಾಟಕದ ರಾಜಧಾನಿ'],
			['C9', 'i speak kannada', 'ನಾನು ಕನ್ನಡ ಮಾತನಾಡುತ್ತೇನೆ'],
			['C9', 'it may rain', 'ಇಂದು ಮಳೆ ಬರಬಹುದು'],
			['C10', 'bolisu = to shave', 'ಅವನು ತಲೆ ಬೋಳಿಸಿದ'],
			['C10', 'bolisikondu', 'ತಲೆ ಬೋಳಿಸಿಕೊಂಡ'],
			['C10', 'naayi = dog', 'ನಾಯಿ ಬೊಗಳಿತು'],
			['C13', 'i speak kannada', 'naanu kannada matadthini'],
			['C13', 'how are you', 'neevu hegiddira'],
			['C13', 'it may rain', 'indu male barabahudu'],
			['C13', 'have you eaten', 'oota aayta'],
			['C13', 'read the book', 'pustaka odi nodi'],
			['C13', 'drive slowly', 'gaadi nidhaanavagi chalaisi'],
			['C6', 'bmtc initials', 'B. M. T. C. bus number 500'],
		],
	},

	ml: {
		name: 'malayalam + manglish',
		latin: ['thayoli', 'pooru', 'kundan', 'myru'],
		native: ['പൂറ്', 'തായോളി'],
		mix: [
			['E7.1', 'malayalam head, latin tail', 'പൂru'],
			['E7.2', 'latin head, malayalam tail', 'thayoളി'],
		],
		sentences: [
			['native in a sentence', 'നീ ഒരു പൂറ്'],
			['romanized in a sentence', 'nee oru thayoli aanu'],
		],
		named: [
			['E8.5', 'agglutinated native', 'പൂറിമോൻ'],
			['E9.1', 'vowel variant', 'thayolli'],
			['E9.3', 'gemination variant', 'thayoly'],
			['E11', 'caste epithet', 'അവൻ ഒരു പുലയൻ'],
			['E11', 'lexicon: kundan', 'അവൻ കുണ്ടൻ ആണ്'],
			['S1.4', 'zwj chillu', 'കുണ്ടന്\u200D'],
			['S1.4', 'atomic chillu', 'കുണ്ടൻ'],
			['S1.4', 'pre-reform nta', 'നായിൻറെ മോൻ'],
			['S1.4', 'reformed nta', 'നായിന്റെ മോൻ'],
			['S2.2', 'doubled chandrakkala', 'പൂറ്്'],
		],
		clean: [
			['C3', 'kozhikode', 'Kozhikode has a long beach road'],
			['C3', 'alappuzha', 'Alappuzha is known for its backwaters'],
			['C3', 'kunnathunad', 'Kunnathunad taluk lies in Ernakulam'],
			['C3', 'palakkad', 'Palakkad has a fort and a gap in the Ghats'],
			['C4', 'pulaya welfare', 'the Pulaya community welfare board met'],
			['C4', 'ezhava reform', 'the Ezhava community reform movement grew under Narayana Guru'],
			['C4', 'namboothiri', 'Namboothiri households kept the old rites'],
			['C4', 'cheraman masjid', 'the Cheraman Juma Masjid stands at Kodungallur'],
			['C9', 'pooruruttathi', 'pooruruttathi nakshatram'],
			['C9', 'capital', 'കേരളത്തിന്റെ തലസ്ഥാനം തിരുവനന്തപുരം'],
			['C9', 'pre-reform prose', 'എൻറെ പേര് രാജു'],
			['C9', 'zwj chillu prose', 'അവന്\u200D വന്നു'],
			['C9', 'vowels recited', 'അ ആ ഇ ഈ ഉ ഊ'],
			['C10', 'panni native', 'പന്നി കാട്ടിലുണ്ട്'],
			['C10', 'pani = work', 'പണി തീർന്നു'],
			['C10', 'pooram native', 'തൃശ്ശൂർ പൂരം കാണാൻ പോയി'],
			['C13', 'i speak malayalam', 'njan malayalam parayum'],
			['C13', 'how are you', 'ningal engane und'],
			['C13', 'it will rain', 'innu mazha varum'],
			['C13', 'ate rice', 'chooru kazhichu'],
			['C13', 'going home', 'veettil pokunnu ippol'],
			['C13', 'read the book', 'pusthakam vayikkanam'],
			['C6', 'apj initials', 'A. P. J. Abdul Kalam'],
		],
	},
};

/**
 * PART 5 — CROSS-LANGUAGE COLLISIONS
 *
 * Their own suite, because they are the class this project has actually been
 * bitten by — 'chinali' versus the Chinali people of Himachal, 'parayan'
 * versus Malayalam "to say" — and because they only exist when several packs
 * are loaded together. A per-pack clean suite cannot express them: the word is
 * innocent in the pack whose suite it would sit in, and profane in a different
 * one.
 *
 * Every text here appears in NO per-language suite. The runner asserts that
 * across all clean suites no text is used twice, so the clean count is a count
 * of distinct texts. The previous version of this file counted 367 "cases"
 * of which 60 were the same text repeated two to four times; the assertion
 * exists so that cannot recur silently.
 */
export const CROSS_LANGUAGE_SUITE = {
	name: 'cross-language collisions',
	clean: [
		['C5', 'chinali people', 'the Chinali people of Himachal Pradesh'],
		['C5', 'parayan to say (ml)', 'avan parayan thudangi'],
		['C5', 'lanja taluka (mr)', 'Lanja taluka is in Ratnagiri district'],
		['C5', 'lanjigarh (or)', 'Lanjigarh is in Kalahandi district'],
		['C5', 'panni = pig (ml)', 'panni is Malayalam for pig'],
		['C5', 'tulu language (kn)', 'Tulu is a Dravidian language of the coast'],
		['C5', 'tulu nadu', 'the Tulu Nadu heritage festival opened'],
		['C5', 'tuluva culture', 'Tuluva culture gave us Yakshagana'],
		['C5', 'boli = speech (hi)', 'usne apni boli badal li'],
		['C5', 'banda aceh', 'Banda Aceh in Indonesia'],
		['C5', 'magia nera (it)', 'magia nera is Italian for black magic'],
		['C5', 'sule surname (mr)', 'Supriya Sule spoke in Parliament'],
		['C5', 'baddi town (hp)', 'Baddi is in Himachal Pradesh'],
		['C5', 'dengue (en)', 'dengue fever cases are rising'],
		['C5', 'dengue virus (en)', 'the dengue virus spreads via mosquitoes'],
		['C5', 'harami candlestick (ja)', 'a bullish harami candlestick formed'],
		['C5', 'mangya nickname (mr)', 'Mangya is my friend from college'],
		['C5', 'kunnamkulam (kl)', 'Kunnamkulam municipality passed the budget'],
		['C5', 'pooram festival (kl)', 'the Thrissur Pooram festival draws crowds'],
		['C5', 'poornima (name)', 'Poornima spoke at the event'],
		['C5', 'mahar regiment', 'the Mahar Regiment paraded at Saugor'],
		['C5', 'chuhar chak (pb)', 'Chuhar Chak is in Moga district'],
		['C5', 'lund university (se)', 'Lund University is in Sweden'],
		['C5', 'gandiva bow', 'the Gandiva bow of Arjuna'],
		['C5', 'rockdale county (us)', 'Rockdale County, Georgia'],
		['C5', 'sally lunn (uk)', 'a Sally Lunn bun with jam'],
		['C5', 'gandum = wheat (fa)', 'gandum is the Persian word for wheat'],
		['C5', 'gasht = patrol (fa)', 'gasht means patrol in Persian'],
		['C5', 'the magi (en)', 'the Magi brought gifts'],
		['C5', 'maggi noodles', 'Maggi noodles for dinner'],
		['C5', 'sunni muslim', 'he is a Sunni Muslim'],
		['C5', 'shia crescent', 'the Shia communities of Lucknow'],
		['C5', 'kundan jewellery', 'a Kundan jewellery set'],
		['C5', 'soothsayer (en)', 'the soothsayer spoke at dawn'],
		['C5', 'therukoothu (ta)', 'therukoothu is a folk theatre form'],
		['C5', 'mayiladuthurai (tn)', 'Mayiladuthurai district was carved out'],
		['C5', 'pallavaram (tn)', 'Pallavaram is near Chennai'],
		['C5', 'thoothukudi (tn)', 'Thoothukudi port handles containers'],
		['C5', 'kanjurmarg (mh)', 'Kanjurmarg station is on the central line'],
		['C5', 'kanjhawala (dl)', 'Kanjhawala is in north-west Delhi'],
		['C5', 'chodaganga (od)', 'Anantavarman Chodaganga built the temple'],
		['C5', 'chodavaram (ap)', 'Chodavaram is in Anakapalli district'],
		['C5', 'chutia kingdom (as)', 'the Chutia kingdom ruled upper Assam'],
		['C5', 'bhosari (mh)', 'Bhosari MIDC is in Pimpri-Chinchwad'],
		['C5', 'asha bhosle', 'Asha Bhosle sang the title track'],
		['C5', 'randive surname (mh)', 'Randive is a Maharashtrian surname'],
		['C5', 'chodankar surname (goa)', 'Chodankar is a Goan surname'],
		['C5', 'suar town (up)', 'Suar is a town in Rampur district'],
		['C5', 'mundgod (ka)', 'Mundgod hosts a Tibetan settlement'],
		['C5', 'gudur (ap)', 'Gudur is in Nellore district'],
		['C5', 'kundapura (ka)', 'Kundapura is in Udupi district'],
		['C5', 'chandannagar (wb)', 'Chandannagar was a French colony'],
		['C5', 'gandevi (gj)', 'Gandevi is in Navsari district'],
		['C5', 'gandhidham (gj)', 'Gandhidham was built for refugees'],
		['C5', 'modakurichi (tn)', 'Modakurichi is in Erode district'],
		['C5', 'chamba himachal', 'Chamba town sits above the Ravi'],
		['C5', 'lunda tribe', 'the Lunda people live in Zambia'],
		['C5', 'randers denmark', 'Randers is a Danish city'],
		['C5', 'phuket thailand', 'we flew to Phuket for a week'],
		['C5', 'chinaware', 'the chinaware was chipped'],
		['C5', 'maghreb', 'the Maghreb region of Africa'],
		['C5', 'bandanna', 'he wore a bandanna'],
		['C5', 'conjure', 'a magician can conjure anything'],
		['C5', 'banquet hall', 'a banquet hall booking for Saturday'],
		['C5', 'catamaran', 'a catamaran race today'],
		['C5', 'chandelier', 'the chandelier was dusty'],
		['C5', 'poundal', 'a poundal is a unit of force'],
		['C5', 'tullibardine', 'Tullibardine is a Scotch distillery'],
		['C5', 'hellcat', 'the Grumman Hellcat flew from carriers'],
		['C5', 'kitemark', 'the kitemark certification was renewed'],
		['C5', 'reindict', 'the grand jury may reindict the defendant'],
		['C5', 'modern art', 'a modern art museum opened'],
		['C5', 'motorcade odia', 'the motorcade turned onto the ring road'],
		['C5', 'salon booking', 'hair salon booking for Thursday'],
		['C5', 'item on a list', 'an item on the list is missing'],
		// Surfaced by the C14 sweep: a real web2a compound (a Brazilian plant
		// name) whose first token is the Tamil lemma's romanization. Added under
		// the add-only feed rule in METHODOLOGY.md, same as the C2 entries.
		['C5', 'lanyard (en)', 'wear your lanyard at all times'],
		['C5', 'punditry (en)', 'endless election punditry'],
		['C5', 'beavers (en)', 'the beavers built a dam'],
		['C5', 'country (en)', 'country roads take me home'],
		['C5', 'poori (in)', 'poori masala for breakfast'],
		['C5', 'poor (en)', 'poor unemployment figures again'],
		['C5', 'umbu-rana (bot.)', 'umbu-rana is a Brazilian shrub'],
		['C5', 'sign off', 'love you xx'],
	],
};
