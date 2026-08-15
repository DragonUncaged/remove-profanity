/**
 * English language pack.
 *
 * Per spec the merely-sexual / medical / kink vocabulary is dropped (anal,
 * sex, sexy, nude, vagina, escort, bdsm, voyeur, suck, topless, twink, xx,
 * xxx, breast, penis, semen, rectum, clitoris, masturbate, intercourse,
 * fellatio, cunnilingus, bondage, domination, hentai and friends, the
 * paraphilia catalogue, etc.),
 * along with brand names (playboy, bangbros, babeland), shock-site memes
 * (goatse, tubgirl, 2g1c), film/novel titles (octopussy, lolita) and words
 * whose primary meaning is innocent (cornhole the lawn game, skeet shooting,
 * snatch, spunk, smut, hardcore, swastika — a sacred symbol in India — and
 * santorum, which targets a real person).
 *
 * What remains is real profanity: slurs (severity 4, category 'slur'),
 * strong profanity (3), vulgar insults and crude sexual slang (2), and mild
 * vulgarity (1). CSAM-adjacent keywords (pthc, pedobear, nambla) are out of
 * scope for a profanity filter and deliberately not included; "jailbait" is
 * kept as vulgar predatory slang.
 *
 * The delivered pack is ~65 lemmas rather than the spec's "~80–100": after
 * removing everything that is not profanity, padding the count
 * back up would have meant re-admitting sexual/medical vocabulary. Quality
 * over quantity.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function en(entry: Omit<LemmaEntry, 'language' | 'script'>): LemmaEntry {
	return { language: 'en', script: 'Latn', ...entry };
}

/**
 * English suffix expander: -s / -ed / -ing / -er.
 *
 * `fuck` was listed and `fucks`, `fucked`, `fucker` were not, which is the
 * single largest recall gap in this pack. Rivals close it by relaxing word
 * boundaries — matching the lemma anywhere inside a token — and pay for it
 * with `shiitake`, `Moby Dick`, `cum laude`, `great tit` and `Penistone`.
 * This closes it the other way: generate the inflected forms as WHOLE TOKENS
 * and keep matching them under the same Unicode-property word boundaries as
 * every other surface. Nothing about the boundary rules changes, so none of
 * that false-positive class is inherited.
 *
 * Same shape as `expandInflections` in `hi.ts` and `degeminate` in `ta.ts`:
 * it runs at module load inside the pack, and the engine never learns it
 * exists. Generated forms land in `variants`, and only `romanizations` feed
 * the skeleton tier (the `skeletonSafe` block of `createMatcher`), so — English having no
 * romanizations — everything here is exact-tier only.
 *
 * The residual risk is a generated form that is an ordinary English word;
 * INFLECTION_EXCLUDE below is that list, and it is what the dictionary sweep
 * in `test/english-inflection.test.ts` guards.
 */
const INFLECTION_EXCLUDE = new Set([
	// spic + -ed/-ing/-er is the spice family, which is not the slur.
	'spiced',
	'spicing',
	'spicer',
	// A hammer is cocked, a head is cocked, and a Cocker is a spaniel.
	'cocked',
	'cocking',
	'cocker',
	// "to dicker" is to haggle.
	'dicker',
	// "to titter" is to giggle.
	'titter',
	// A needle pricks, a conscience is pricked, a pricker is a gardening tool.
	// The noun is the insult; the verb family is ordinary English.
	'pricked',
	'pricking',
	'pricker',
	// Negros is a Philippine island and province; the English plural of the
	// slur is "negroes" anyway, which this expander does not generate.
	'negros',
]);

/**
 * Inflect one surface form. Returns [] for anything that is not a single
 * lowercase ASCII token, and for forms that are already inflected.
 */
function inflect(word: string): string[] {
	if (!/^[a-z]{3,}$/.test(word)) return [];
	// Already an inflected form — do not stack suffixes. A doubled `-ss` is
	// exempt because "ass" and "piss" are stems, not plurals.
	if (/(?:[^s]s|ed|ing)$/.test(word)) return [];

	const isVowel = (c: string): boolean => 'aeiou'.includes(c);
	const last = word[word.length - 1]!;
	const prev = word[word.length - 2]!;
	const out: string[] = [];

	// Plural / third person: sibilants take -es, consonant + y takes -ies.
	if (/(?:s|x|z|ch|sh)$/.test(word)) out.push(word + 'es');
	else if (last === 'y' && !isVowel(prev)) out.push(word.slice(0, -1) + 'ies');
	else out.push(word + 's');

	// An -er form is already agentive or comparative (wanker, hooker,
	// motherfucker): it pluralizes, it does not take verbal suffixes.
	if (word.endsWith('er')) return out;

	// Verbal stem for -ed / -er, and the (sometimes different) stem for -ing.
	let stem = word;
	let ingStem = word;
	if (last === 'e') {
		// Drop the silent e: rape -> raped/raping/raper. Not after a vowel or
		// y, where the e is part of the vowel (darkie, slanteye) and there is
		// no verbal reading at all.
		if (isVowel(prev) || prev === 'y') return out;
		stem = word.slice(0, -1);
		ingStem = stem;
	} else if (last === 'y' && !isVowel(prev)) {
		// pussy -> pussied/pussier, but pussying keeps the y.
		stem = word.slice(0, -1) + 'i';
	} else if (isVowel(last)) {
		// nigga, paki, bimbo, jigaboo: nouns, no verbal reading.
		return out;
	} else if (isVowel(prev) && !isVowel(word[word.length - 3]!) && !'cwxy'.includes(last)) {
		// Consonant-vowel-consonant doubles the final consonant:
		// shit -> shitted/shitting/shitter, cum -> cummed/cumming/cummer.
		stem = word + last;
		ingStem = stem;
	}
	out.push(stem + 'ed', ingStem + 'ing');
	// The agentive -er and its plural travel together: "fucker"/"fuckers".
	// If the -er form is an ordinary word so is its plural, so one exclusion
	// covers both rather than needing "cockers", "dickers", "titters" listed
	// separately.
	const agent = stem + 'er';
	if (!INFLECTION_EXCLUDE.has(agent)) out.push(agent, agent + 's');
	return out;
}

/**
 * Apply the expander across the pack, appending to `variants`. Deduped
 * globally: a generated form that is already some entry's surface is dropped,
 * because `test/data.test.ts` requires every surface in a pack to be unique
 * (and because the first entry to claim it is the curated one).
 */
function expandPack(list: LemmaEntry[]): LemmaEntry[] {
	const seen = new Set<string>();
	for (const e of list) {
		seen.add(e.lemma);
		for (const v of e.variants ?? []) seen.add(v);
	}
	return list.map((e) => {
		const expanded = [...(e.variants ?? [])];
		for (const base of [e.lemma, ...(e.variants ?? [])]) {
			for (const form of inflect(base)) {
				if (seen.has(form) || INFLECTION_EXCLUDE.has(form)) continue;
				seen.add(form);
				expanded.push(form);
			}
		}
		return expanded.length > 0 ? { ...e, variants: expanded } : e;
	});
}

const entries: LemmaEntry[] = [
	en({ lemma: 'nigger', severity: 4, categories: ['slur'], skeletonSafe: false, variants: ['niggr'] }),
	en({
		lemma: 'nigga',
		severity: 4,
		categories: ['slur'],
		// Reclaimed in-group usage is common — flagged casualUse; severity
		// stays honest for out-group use.
		casualUse: true,
		skeletonSafe: false,
	}),
	en({ lemma: 'faggot', severity: 4, categories: ['slur', 'gendered'], skeletonSafe: false }),
	en({ lemma: 'kike', severity: 4, categories: ['slur', 'religious'], skeletonSafe: false, allowlist: ['kike hernandez'] }),
	en({ lemma: 'spic', severity: 4, categories: ['slur'], skeletonSafe: false, allowlist: ['spic and span', 'spick and span'] }),
	en({ lemma: 'wetback', severity: 4, categories: ['slur'] }),
	en({
		lemma: 'coon',
		severity: 4,
		categories: ['slur'],
		allowlist: ['maine coon', 'coon cat', 'coon rapids'],
		skeletonSafe: false,
	}),
	en({ lemma: 'darkie', severity: 4, categories: ['slur'], skeletonSafe: false }),
	en({
		lemma: 'jigaboo',
		severity: 4,
		categories: ['slur'],
		variants: ['jiggaboo', 'jiggerboo'],
		skeletonSafe: false,
	}),
	en({
		lemma: 'beaner',
		severity: 4,
		categories: ['slur'],
		// The chunked tier would otherwise merge "should be an ER nurse" /
		// "be an ERS member" onto this lemma — the one natural English word
		// sequence the fragment-merge collision sweep found.
		allowlist: ['be an er', 'be an ers'],
		skeletonSafe: false,
	}),
	en({ lemma: 'paki', severity: 4, categories: ['slur'], skeletonSafe: false }),
	en({ lemma: 'raghead', severity: 4, categories: ['slur', 'religious'], skeletonSafe: false }),
	en({ lemma: 'towelhead', severity: 4, categories: ['slur', 'religious'] }),
	en({ lemma: 'honkey', severity: 4, categories: ['slur'], skeletonSafe: false }),
	en({ lemma: 'slanteye', severity: 4, categories: ['slur'] }),
	en({ lemma: 'tranny', severity: 4, categories: ['slur', 'gendered'], skeletonSafe: false }),

	en({
		lemma: 'negro',
		severity: 3,
		categories: ['slur'],
		// Also Spanish/Portuguese for "black" and part of place names.
		allowlist: ['rio negro', 'montenegro', 'negro league', 'negro leagues'],
		skeletonSafe: false,
	}),
	en({ lemma: 'shemale', severity: 3, categories: ['slur', 'gendered'], skeletonSafe: false }),
	en({ lemma: 'bulldyke', severity: 3, categories: ['slur', 'gendered'] }),
	en({ lemma: 'fudgepacker', severity: 3, categories: ['slur', 'gendered'] }),
	en({ lemma: 'poofter', severity: 3, categories: ['slur', 'gendered'], skeletonSafe: false }),
	en({ lemma: 'carpetmuncher', severity: 3, categories: ['slur', 'gendered'] }),
	en({
		lemma: 'fuck',
		severity: 3,
		categories: ['sexual', 'general'],
		variants: ['fucking', 'fuckin', 'fuk', 'fukk', 'fcuk', 'fvck', 'phuk', 'foock', 'dumbfuck', 'fuckface', 'muthafucka', 'mothafucka', 'muthafucker', 'mothafucker'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({
		lemma: 'motherfucker',
		severity: 3,
		categories: ['sexual', 'gendered'],
	}),
	en({
		lemma: 'fucktard',
		severity: 3,
		categories: ['ableist', 'general'],
		variants: ['fucktards'],
	}),
	en({
		lemma: 'cunt',
		severity: 3,
		categories: ['sexual', 'gendered'],
		skeletonSafe: false,
		// 'kunt' is also ordinary Dutch ("u kunt" = "you can") — accepted as
		// out-of-corpus for an English pack, same reasoning as 'fuk' (Afrikaans).
		variants: ['cvnt', 'kunt'],
	}),
	en({ lemma: 'twat', severity: 3, categories: ['sexual', 'gendered'], skeletonSafe: false }),
	en({ lemma: 'slut', severity: 3, categories: ['gendered', 'sexual'], skeletonSafe: false }),
	en({
		lemma: 'whore',
		severity: 3,
		categories: ['gendered', 'sexual'],
		skeletonSafe: false,
	}),
	en({ lemma: 'jailbait', severity: 3, categories: ['sexual'] }),
	en({
		lemma: 'rape',
		severity: 3,
		categories: ['sexual', 'violence'],
		// Kept for threat/harassment moderation despite legitimate discourse
		// uses; callers can filter by category.
		variants: ['raping', 'rapist'],
		skeletonSafe: false,
	}),

	en({
		lemma: 'bitch',
		severity: 2,
		categories: ['gendered'],
		variants: ['bitches', 'biatch', 'beeyotch', 'beyotch'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({
		lemma: 'asshole',
		severity: 2,
		categories: ['general'],
		variants: ['arsehole', 'azzhole'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({ lemma: 'assmunch', severity: 2, categories: ['general'] }),
	en({ lemma: 'bastard', severity: 2, categories: ['general'], casualUse: true }),
	en({ lemma: 'bollocks', severity: 2, categories: ['general'], casualUse: true }),
	en({ lemma: 'bullshit', severity: 2, categories: ['general'], casualUse: true }),
	en({
		lemma: 'shit',
		severity: 2,
		categories: ['general'],
		variants: ['shyt', 'shitbag'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({ lemma: 'shitty', severity: 2, categories: ['general'], casualUse: true, skeletonSafe: false }),
	en({ lemma: 'apeshit', severity: 2, categories: ['general'], casualUse: true }),
	en({ lemma: 'clusterfuck', severity: 2, categories: ['general'], casualUse: true }),
	en({ lemma: 'dick', severity: 2, categories: ['sexual'], casualUse: true, skeletonSafe: false, allowlist: ['moby dick'] }),
	en({
		lemma: 'cock',
		severity: 2,
		categories: ['sexual'],
		variants: ['cocks'],
		skeletonSafe: false,
	}),
	en({
		lemma: 'prick',
		severity: 2,
		categories: ['sexual', 'general'],
		// Mirrors cock: the noun ships, the verb family (pricked / pricking /
		// pricker — needles, consciences, gardening) is INFLECTION_EXCLUDE'd.
		variants: ['pricks'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({
		lemma: 'pussy',
		severity: 2,
		categories: ['sexual', 'gendered'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({
		lemma: 'wank',
		severity: 2,
		categories: ['sexual'],
		variants: ['wanker'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({ lemma: 'tosser', severity: 2, categories: ['general'], casualUse: true, skeletonSafe: false }),
	en({ lemma: 'jizz', severity: 2, categories: ['sexual'], skeletonSafe: false }),
	en({
		lemma: 'cum',
		severity: 2,
		categories: ['sexual'],
		variants: ['cumming'],
		allowlist: ['cum laude', 'magna cum', 'summa cum', 'cumming georgia', 'cumming, georgia', 'cumming street'],
		skeletonSafe: false,
	}),
	en({ lemma: 'schlong', severity: 2, categories: ['sexual'] }),
	en({ lemma: 'blowjob', severity: 2, categories: ['sexual'] }),
	en({ lemma: 'handjob', severity: 2, categories: ['sexual'] }),
	en({
		lemma: 'tit',
		severity: 2,
		categories: ['sexual'],
		variants: ['tits', 'titties', 'titty'],
		// The bird, and the idiom.
		allowlist: ['blue tit', 'great tit', 'coal tit', 'tit for tat', 'willow tit', 'marsh tit', 'crested tit', 'bearded tit', 'long-tailed tit'],
		skeletonSafe: false,
	}),
	en({
		lemma: 'hooker',
		severity: 2,
		categories: ['gendered', 'sexual'],
		// Also a rugby position — known limitation.
		skeletonSafe: false,
	}),
	en({
		lemma: 'bimbo',
		severity: 2,
		categories: ['gendered'],
		variants: ['bimbos'],
		skeletonSafe: false,
	}),
	en({ lemma: 'milf', severity: 2, categories: ['sexual', 'gendered'], skeletonSafe: false }),
	en({ lemma: 'camwhore', severity: 2, categories: ['gendered', 'sexual'] }),
	en({ lemma: 'camslut', severity: 2, categories: ['gendered', 'sexual'] }),
	en({ lemma: 'poontang', severity: 2, categories: ['sexual'] }),
	en({ lemma: 'punany', severity: 2, categories: ['sexual'], skeletonSafe: false }),
	en({ lemma: 'quim', severity: 2, categories: ['sexual'], skeletonSafe: false }),
	en({
		lemma: 'queef',
		severity: 2,
		categories: ['sexual'],
		variants: ['queaf'],
		skeletonSafe: false,
	}),
	en({
		lemma: 'splooge',
		severity: 2,
		categories: ['sexual'],
		variants: ['spooge'],
		skeletonSafe: false,
	}),

	en({ lemma: 'ass', severity: 1, categories: ['general'], casualUse: true, skeletonSafe: false }),
	en({ lemma: 'butthole', severity: 1, categories: ['general'], casualUse: true, skeletonSafe: false }),
	en({ lemma: 'bunghole', severity: 1, categories: ['general'] }),
	en({
		lemma: 'dingleberry',
		severity: 1,
		categories: ['general'],
		variants: ['dingleberries'],
	}),
	en({
		lemma: 'piss',
		severity: 1,
		categories: ['general'],
		variants: ['pissing'],
		casualUse: true,
		skeletonSafe: false,
	}),
	en({ lemma: 'boner', severity: 1, categories: ['sexual'], casualUse: true, skeletonSafe: false }),
	en({
		lemma: 'boob',
		severity: 1,
		categories: ['sexual'],
		variants: ['boobs'],
		casualUse: true,
		skeletonSafe: false,
	}),
];

export const english: LanguagePack = {
	language: 'en',
	name: 'English',
	entries: expandPack(entries),
	allowlist: [
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
	],
};
