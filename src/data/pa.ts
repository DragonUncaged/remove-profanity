/**
 * Punjabi language pack (Gurmukhi script + romanized "Punglish").
 *
 * Severity rubric is the shared one (README):
 *   4 = extreme slurs and sexual-violence terms
 *   3 = strong profanity
 *   2 = moderate insults (many flagged casualUse)
 *   1 = mild but genuinely offensive insults
 *
 * Three things drive every design decision in this file; the long form is in
 * docs/language-packs.md.
 *
 * 1. **Punjabi overlaps hard with Hindi/Urdu, and this pack is nonetheless
 *    self-sufficient.** The overlap is real — ਮਾਦਰਚੋਦ, ਰੰਡੀ, ਗਾਂਡ, ਹਰਾਮੀ are
 *    the same words Hindi uses — and every one of their *Latin* spellings is
 *    also in the hi pack. They are repeated here anyway, deliberately, so
 *    that `import { punjabi } from 'remove-profanity/data/pa'` on its own
 *    gives full coverage of Punjabi profanity in both scripts. A consumer
 *    moderating Punjabi text must not have to know that some of its
 *    vocabulary happens to live in the Hindi pack.
 *
 *    What that costs, and why it is safe:
 *
 *      - **Nothing is lost to the duplicate-lemma discard.** `collectExact`
 *        drops a second candidate only when the LEMMA STRING is
 *        byte-identical; Gurmukhi ਮਾਦਰਚੋਦ and Devanagari मादरचोद are
 *        different strings, so with both packs loaded both candidates exist
 *        and normal overlap resolution applies. Pinned in
 *        test/punjabi-data.test.ts.
 *      - **The reported `language` on a shared Latin spelling depends on pack
 *        order** (equal severity, equal span → first pack wins). That is the
 *        accepted price of self-sufficiency, and it is an attribution
 *        difference, never a missed or spurious match.
 *      - **The allowlists came with the spellings.** Importing 'gand' without
 *        gandhi/uganda/gandalf, or 'harami' without the candlestick phrases,
 *        would have made a pa-only matcher fail on text hi handles fine.
 *        Every borrowed romanization brought its hi allowlist entries with
 *        it, and test/punjabi-scunthorpe.test.ts runs those traps against the
 *        pa pack ALONE.
 *
 *    Spellings hi deliberately DROPPED are not resurrected here: 'hijra',
 *    'kamini', 'lauda', 'laura', 'rand', 'sale', 'salon', 'salo' and
 *    'chhod' stay out, for the reasons hi.ts records.
 *
 * 2. **Gemination is dictionary-side, never a fold.** The addak ੱ marks a
 *    geminate consonant and Punjabi gemination is phonemic (ਪਤਾ "knowledge" /
 *    ਪੱਤਾ "leaf", ਦਸ "ten" / ਦੱਸ "tell"), so `indic-scripts.ts` deliberately
 *    leaves it alone. Casual typing drops it anyway, so `dropAddak()` below
 *    generates the addak-less spelling per lemma, with an exclusion set for
 *    the cases where the result is a real Punjabi word — the same shape as
 *    ta.ts's `degeminate()`.
 *
 * 3. **The skeleton tier is off for almost this whole pack.** Punjabi
 *    romanizations are short and consonant-sparse, and the keys they produce
 *    land squarely on ordinary English: knjr = "conjure", pnkd = "punched" /
 *    "panicked", fnkd = "funked", ktd, lk, fd, kr, rnd… Only ਭੈਣਚੋਦ ("bnkd"),
 *    ਭੋਸੜੀਕੇ ("bsdk") and ਮਾਦਰਚੋਦ ("mdrkd") keep skeleton matching — the
 *    three keys the hi pack already ships, with the same allowlists. Every
 *    other entry carries a trailing comment with its computed key and why it
 *    was switched off.
 *
 * No entry uses `matchMode: 'prefix'`. Prefix mode exists for Dravidian
 * agglutination; Punjabi marks case with free-standing postpositions
 * (ਦਾ / ਨੂੰ / ਤੋਂ), so the token boundary is a real boundary and relaxing it
 * would buy nothing but false positives.
 *
 * Deliberately EXCLUDED (not profanity, or hopelessly collision-prone):
 *   - ordinary insults with no real bite: ਖੋਤਾ (donkey), ਢੱਗਾ (ox),
 *     ਬਕਵਾਸ (nonsense), ਨਿਕੰਮਾ (useless), ਮੂਰਖ (fool).
 *   - words whose innocent sense dominates: ਰੰਨ (rural Punjabi for "wife" as
 *     often as a pejorative — and "Rann" is the Rann of Kutch), ਭਈਆ (means
 *     "brother" far more often than it is an anti-migrant slur), ਮੋਨਾ (a Sikh
 *     who cuts his hair, but also the given name Mona), ਭਾਪਾ (respectful as
 *     often as mocking).
 *   - romanizations that cannot be disambiguated:
 *       lun    "ਲੰਨ", but three letters and a live Chinese romanization and
 *              surname; the lemma ships native + 'lunn' + 'lund'.
 *       lucha  "ਲੁੱਚਾ", but also Spanish *lucha* / lucha libre; 'luchcha'
 *              and 'luchha' only.
 *       gasti  "ਗਸ਼ਤੀ", but also an Italian surname; 'gashti' only.
 *       luchi  "ਲੁੱਚੀ", but also the Bengali fried bread; 'luchchi' only.
 *   - severity-1 coarse words, matching the Hindi pack's bar.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

const ADDAK = 'ੱ'; // GURMUKHI ADDAK U+0A71

/**
 * Native-script de-gemination: drop the addak (ਫੁੱਡੀ → ਫੁਡੀ). This is the
 * "casual typing omits the addak" spelling variation, generated per lemma
 * instead of folded globally — the fold would collapse ਪਤਾ/ਪੱਤਾ and
 * ਦਸ/ਦੱਸ across the whole language.
 *
 * The exclusion set is the point: dropping the addak from any of these
 * produces a REAL Punjabi word, so the generated variant would be a
 * false-positive machine. None of them is reachable from a lemma currently in
 * the pack — they are pre-seeded guards, because the next lemma added is
 * exactly when this bites:
 *   ਪੱਤਾ → ਪਤਾ   "knowledge / address"
 *   ਦੱਸ  → ਦਸ    "ten"
 *   ਸੱਤ  → ਸਤ    "truth"
 *   ਕੱਲ  → ਕਲ    "art / yesterday"
 */
const ADDAK_EXCLUDE = new Set(['ਪਤਾ', 'ਦਸ', 'ਸਤ', 'ਕਲ']);

function dropAddak(word: string): string | null {
	if (!word.includes(ADDAK)) return null;
	const out = word.split(ADDAK).join('');
	return ADDAK_EXCLUDE.has(out) ? null : out;
}

function pa(entry: Omit<LemmaEntry, 'language' | 'script'>): LemmaEntry {
	return { language: 'pa', script: 'Guru', ...entry };
}

/**
 * Add the addak-less spelling of each native-script surface as a variant,
 * with global dedupe so no surface form is ever listed twice in the pack.
 */
function expandPack(list: LemmaEntry[]): LemmaEntry[] {
	const seen = new Set<string>();
	for (const e of list) {
		seen.add(e.lemma);
		for (const v of e.variants ?? []) seen.add(v);
		for (const r of e.romanizations ?? []) seen.add(r);
	}
	return list.map((e) => {
		const extra: string[] = [];
		for (const surface of [e.lemma, ...(e.variants ?? [])]) {
			if (/\s/.test(surface)) continue;
			const d = dropAddak(surface);
			if (d === null || seen.has(d)) continue;
			seen.add(d);
			extra.push(d);
		}
		if (extra.length === 0) return e;
		return { ...e, variants: [...(e.variants ?? []), ...extra] };
	});
}

const entries: LemmaEntry[] = [
	pa({
		lemma: 'ਭੈਣਚੋਦ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The bh- spellings all reduce to skeleton key "bnkd" — the same key
		// the hi pack ships for बहनचोद, with the same three English words
		// allowlisted. The p-/ph- spellings produce "pnkd" and "fnkd", which
		// are NOT safe, so they live on ਪੈਣਚੋਦ below with the tier switched off.
		romanizations: ['bhainchod', 'bainchod', 'bhanchod', 'bhaenchod'],
		variants: ['ਭੈਣ ਚੋਦ', 'ਭੈਣਚੋਦਾ'],
		// The last four came from the repaired sweep; the first three were
		// written by hand and were incomplete — "bounced", "benched" and
		// "bunched" are ordinary prose and were being flagged. 'boonked' is
		// the same key again, and used to be covered only by the collapsed
		// pass folding it onto 'bonked' — see the note on hi's बहनचोद.
		allowlist: [
			'banked',
			'bunked',
			'bonked',
			'boonked',
			'bounced',
			'benched',
			'bunched',
			'bunkoed',
			'beancod',
			'beancods',
			'beinked',
		],
	}),
	pa({
		lemma: 'ਪੈਣਚੋਦ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The Punjabi p-initial pronunciation of the word above, and the
		// commonest way it is actually typed. A separate lemma rather than a
		// variant so that its unsafe skeleton keys do not switch the tier off
		// for the bh- family too.
		romanizations: ['painchod', 'penchod', 'pehnchod', 'phainchod'],
		variants: ['ਪੈਣ ਚੋਦ'],
		skeletonSafe: false, // keys "pnkd" (punched, panicked, pinked) and "fnkd" (funked)
	}),
	pa({
		lemma: 'ਫੁੱਡੀ',
		severity: 4,
		categories: ['sexual'],
		// REVIEW: severity 4 puts this level with Tamil புண்டை rather than with
		// Hindi चूत, which the hi pack rates a 3. Punjabi register argues for
		// 4; a native speaker should confirm.
		// The Punjabi word, with no Hindi equivalent in the hi pack — this is
		// the entry the pack exists for. Retroflex ਡ is the usual spelling;
		// ਫੁੱਦੀ with dental ਦ is the common alternative, and dropAddak()
		// generates ਫੁਡੀ / ਫੁਦੀ from both.
		// 'fudi' deliberately excluded: four characters with no distinctive
		// consonant, and one keystroke from ordinary words in several
		// languages. 'phudi' keeps the aspirate that makes it Punjabi.
		romanizations: ['phuddi', 'phudi', 'fuddi', 'phuddo', 'phuddiye'],
		variants: ['ਫੁੱਦੀ', 'ਫੁੱਡੀਏ'],
		skeletonSafe: false, // key "fd" (2)
	}),
	pa({
		lemma: 'ਗਸ਼ਤੀ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// The nukta drop means ਗਸਤੀ (typed without the nukta, which is what
		// most people do) folds onto this automatically — no variant needed.
		romanizations: ['gashti', 'gashtee', 'gashtiye'],
		skeletonSafe: false, // key "gst" (3)
	}),
	pa({
		lemma: 'ਭੋਸੜੀਕੇ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// The Punjabi vocatives first, then the shared Latin family (also in
		// hi). Key "bsdk" from 'bhosdike' is what keeps this entry in the
		// skeleton tier; the Punjabi-only spellings are all 3-char keys.
		romanizations: [
			'bhosriye',
			'bhosdiye',
			'bhosdike',
			'bhosdi ke',
			'bhosadike',
			'bhoshdike',
			'bhosarike',
			'bhosdiwala',
			'bhosdiwale',
			'bhosadi',
			'bhonsdike',
		],
		variants: ['ਭੋਸੜੀ', 'ਭੋਸੜੀ ਕੇ', 'ਭੋਸੜਾ', 'ਭੋਸੜੀ ਵਾਲਾ'],
		// Sweep-sourced, key "bsdk": the same English words hi allowlists for
		// its भोसड़ीके.
		allowlist: [
			'besodden',
			'beshriek',
			'beshrieks',
			'beshrieked',
			'beshrieking',
			'basiarachnitis',
			'basiarachnoiditis',
		],
	}),
	pa({
		lemma: 'ਮਾਦਰਚੋਦ',
		severity: 4,
		categories: ['sexual', 'gendered'],
		// Shared with Hindi in both scripts. Devanagari मादरचोद cannot reach
		// Gurmukhi text, and the Latin family is repeated from hi so that
		// data/pa alone is sufficient.
		romanizations: [
			'madarchod',
			'madar chod',
			'maderchod',
			'madharchod',
			'madarchood',
			'madrchod',
			'motherchod',
			'madarchut',
			'madarchoot',
		],
		variants: ['ਮਾਦਰ ਚੋਦ', 'ਮਾਂ ਚੋਦ', 'ਮਾਂਚੋਦ'],
		// Sweep-sourced, key "mdrkd". hi carries these pack-wide; a pack that
		// repeats the Latin family has to repeat its allowlist too, or the
		// data/pa-only consumer keeps the false positives hi already fixed.
		allowlist: ['motorcading', 'matriciding'],
	}),
	pa({
		lemma: 'ਰੰਡੀ',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Known limitation carried over from the hi pack: "Randi" is also a
		// Western given name, and there is no allowlist for it — in Indian
		// text the slur reading dominates.
		romanizations: ['randi', 'rendi', 'randiye'],
		variants: ['ਰੰਡੀਏ'],
		skeletonSafe: false, // key "rnd" (3)
	}),

	// Caste slurs. Punjab has the highest Scheduled Caste population share
	// of any Indian state and caste abuse there is overwhelmingly typed in
	// Latin, so the Latin spellings stay (policy rule 2). In every case
	// the neutral community name is allowlisted, never matched.
	pa({
		lemma: 'ਚੂਹੜਾ',
		severity: 4,
		categories: ['casteist', 'slur'],
		// The Punjabi caste slur, with no Hindi-pack equivalent. ੜ is
		// romanized 'r' or 'd' about equally often.
		romanizations: ['chuhra', 'choohra', 'chuhda', 'chuhre', 'chuhreya'],
		variants: ['ਚੂਹੜੀ', 'ਚੂਹੜੇ'],
		// Balmiki / Valmiki / Mazhabi Sikh are the community's own names and
		// must never match; Chuhar Chak is a village in Moga district.
		allowlist: ['balmiki', 'valmiki', 'mazhabi', 'majhabi', 'chuhar', 'chuhar chak'],
		skeletonSafe: false, // key "kr" (2)
	}),
	pa({
		lemma: 'ਚਮਾਰ',
		severity: 4,
		categories: ['casteist', 'slur'],
		// Gurmukhi surface, the Punjabi ਚਮਿਆਰ spelling, and the shared Latin
		// one. The Chamar Regiment is allowlisted here as well as in hi.
		romanizations: ['chamar', 'chamiar', 'chamiara'],
		variants: ['ਚਮਿਆਰ'],
		allowlist: ['chamar regiment', 'ravidassia', 'ramdasia', 'ad dharmi'],
		skeletonSafe: false, // key "kmr" (3)
	}),
	pa({
		lemma: 'ਭੰਗੀ',
		severity: 4,
		categories: ['casteist', 'slur'],
		// The Bhangi Misl was one of the twelve Sikh confederacies and is a
		// constant subject of ordinary Punjabi history writing, hence the
		// allowlist — which matters more here than in hi, because Punjabi text
		// is where that phrase actually appears.
		romanizations: ['bhangi'],
		allowlist: ['bhangi misl', 'bhangi misal'],
		skeletonSafe: false, // key "bng" (3)
	}),

	pa({
		lemma: 'ਲੰਨ',
		severity: 3,
		categories: ['sexual'],
		// REVIEW: 'lun' was dropped as too short, which leaves 'lunn' carrying
		// the whole Latin side of the commonest Punjabi sexual insult — and
		// 'lunn' is itself a surname (the Sally Lunn bun, allowlisted). Worth
		// asking whether 'lun' should come back with an allowlist instead.
		// ਲੰਡ / 'lund' is the shared Indo-Aryan form and comes with the Lund
		// University allowlist that hi carries for it.
		romanizations: ['lunn', 'lund', 'laund'],
		variants: ['ਲੁੰਨ', 'ਲੰਡ'],
		allowlist: [
			'sally lunn',
			'lund university',
			'lunds',
			'lund sweden',
			'lund, sweden',
		],
		skeletonSafe: false, // keys "ln" (2) / "lnd" (3)
	}),
	pa({
		lemma: 'ਕੰਜਰ',
		severity: 3,
		categories: ['gendered', 'general'],
		// REVIEW: Kanjar is also the name of a denotified nomadic community in
		// Punjab and Rajasthan. In Punjabi the word is overwhelmingly a
		// general vulgar insult ("pimp / lowlife") rather than a caste
		// reference, which is why it is tagged gendered+general and not
		// casteist — but the collision is real, Kanjari is also a village in
		// Amritsar district, and policy rule 1 could argue for dropping the
		// Latin spellings. Ranked first in the flagged list.
		romanizations: ['kanjar', 'kanjra', 'kanjari', 'kanjariya', 'kanjro'],
		variants: ['ਕੰਜਰੀ', 'ਕੰਜਰਾ'],
		allowlist: ['kanjar community', 'kanjarbhat'],
		skeletonSafe: false, // key "knjr" == skeleton("conjure") / ("conjurer")
	}),
	pa({
		lemma: 'ਹਿਜੜਾ',
		severity: 3,
		categories: ['slur', 'gendered'],
		// Also a community self-identifier; severity reflects slur usage.
		// 'hijra' itself is deliberately NOT listed — it is the standard
		// English spelling of the Islamic Hijra and the community's own
		// neutral term. Same call the hi pack makes.
		romanizations: ['hijda', 'hijraa', 'hizra'],
		variants: ['ਹਿਜੜੇ', 'ਹੀਜੜਾ'],
		skeletonSafe: false, // keys "hjd" / "hjr" (3)
	}),
	pa({
		lemma: 'ਖੁਸਰਾ',
		severity: 3,
		categories: ['slur', 'gendered'],
		romanizations: ['khusra'],
		variants: ['ਖੁਸਰੇ'],
		skeletonSafe: false, // key "ksr" (3)
	}),
	pa({
		lemma: 'ਗਾਂਡ',
		severity: 3,
		categories: ['sexual'],
		// The bindi/tippi fold means mistypings of the nasal reach the same
		// key. The Latin family covers both ਗਾਂਡ and ਗਾਂਡੂ, which hi splits
		// into two entries at the same severity.
		romanizations: ['gaand', 'gand', 'gandu', 'gaandu', 'gandoo', 'ganduu'],
		variants: ['ਗਾਂਡੂ', 'ਗਾਂਡੁ'],
		allowlist: ['gandhi', 'uganda', 'gandalf', 'propaganda'],
		skeletonSafe: false, // key "gnd" (3) — also collides with gandhi
	}),
	pa({
		lemma: 'ਚੂਤ',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chut', 'choot'],
		allowlist: ['chutney', 'chutki', 'chutkule'],
		skeletonSafe: false, // key "kt" (2)
	}),
	pa({
		lemma: 'ਚੂਤੀਆ',
		severity: 3,
		categories: ['sexual', 'general'],
		// A separate entry rather than a ਚੂਤ variant, mirroring hi's split of
		// चूत and चूतिया — the Latin families are different words.
		romanizations: ['chutiya', 'chutia', 'chutya', 'chutiye', 'chootiya'],
		variants: ['ਚੁਤੀਆ', 'ਚੂਤੀਏ'],
		skeletonSafe: false, // key "kt" (2)
	}),
	pa({
		lemma: 'ਚੁਦਾਈ',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['chudai', 'chudayi'],
		variants: ['ਚੁਦਾਈਆ'],
		skeletonSafe: false, // key "kd" (2)
	}),
	pa({
		lemma: 'ਭੜੂਆ',
		severity: 3,
		categories: ['sexual', 'gendered'],
		romanizations: ['bhadwa', 'bhadva', 'bharwa', 'bharva', 'bhadua'],
		variants: ['ਭੜਵਾ', 'ਭੜੂਏ'],
		skeletonSafe: false, // keys "bdv" / "brv" (3)
	}),
	pa({
		lemma: 'ਕੁੱਤੀ',
		severity: 3,
		categories: ['gendered'],
		// dropAddak() adds ਕੁਤੀ. The romanization collides with कुटिया "hut" —
		// the known limitation hi documents, inherited along with the spelling.
		romanizations: ['kutiya', 'kutti', 'kuttiya'],
		variants: ['ਕੁੱਤੀਏ'],
		allowlist: ['kutti story'],
		skeletonSafe: false, // key "kt" (2)
	}),
	pa({
		lemma: 'ਲੌੜਾ',
		severity: 3,
		categories: ['sexual'],
		// 'laura' / 'lora' (Western names) and 'lauda' (Niki Lauda, Lauda Air)
		// stay excluded here exactly as in hi.
		romanizations: ['loda', 'lavda', 'lawda', 'laude', 'lodu', 'looda', 'lowda'],
		variants: ['ਲੌੜੇ', 'ਲੋੜਾ'],
		// Self-sufficiency, same as hi's लौड़ा: 'laude' is also the Latin
		// honorific, and this pack alone flagged "summa cum laude". Carrying
		// the romanization means carrying the phrase that fences it.
		allowlist: ['cum laude', 'magna cum laude', 'summa cum laude'],
		skeletonSafe: false, // key "ld" (2)
	}),

	pa({
		lemma: 'ਖਸਮਾਂ ਨੂੰ ਖਾਣੀ',
		severity: 2,
		categories: ['gendered'],
		// A widow-curse aimed at women ("may you devour your husbands") — the
		// most characteristic Punjabi gendered curse, and entirely absent from
		// the Hindi pack.
		romanizations: [
			'khasma nu khani',
			'khasman nu khani',
			'khasma nu khane',
			'khasma khani',
		],
		variants: ['ਖਸਮਾਂ ਨੂੰ ਖਾਣੇ', 'ਖਸਮ ਖਾਣੀ'],
	}),
	pa({
		lemma: 'ਲੁੱਚਾ',
		severity: 2,
		categories: ['sexual', 'general'],
		// 'lucha' and 'luchi' deliberately excluded (see the header).
		romanizations: ['luchcha', 'luchha', 'luchchi'],
		variants: ['ਲੁੱਚੀ', 'ਲੁੱਚੇ'],
		skeletonSafe: false, // key "lk" (2)
	}),
	pa({
		lemma: 'ਸੂਰ ਦਾ ਪੁੱਤ',
		severity: 2,
		categories: ['general'],
		romanizations: ['sur da putt', 'soor da putt', 'sur diya putta', 'soor de puttar'],
		variants: ['ਸੂਰ ਦੀ ਔਲਾਦ', 'ਸੂਰ ਦਿਆ ਪੁੱਤਾ'],
	}),
	pa({
		lemma: 'ਚੂਤੜ',
		severity: 2,
		categories: ['sexual'],
		romanizations: ['chutad', 'chuttad', 'chutadh'],
		skeletonSafe: false, // key "ktd" (3)
	}),
	pa({
		lemma: 'ਟੱਟੇ',
		severity: 2,
		categories: ['sexual'],
		romanizations: ['tatte', 'tatta'],
		variants: ['ਟੱਟਾ'],
		skeletonSafe: false, // key "t" (1)
	}),
	pa({
		lemma: 'ਹਰਾਮੀ',
		severity: 2,
		categories: ['general'],
		// ਹਰਾਮਜ਼ਾਦਾ is deliberately NOT folded in here: the hi pack rates
		// हरामज़ादा a 3, and a variant would ship it at 2.
		// "Harami" is also a candlestick pattern in trading — hence the
		// allowlist phrases, copied from hi along with the spelling.
		romanizations: ['harami', 'haraami', 'haramkhor', 'haraamkhor'],
		variants: ['ਹਰਾਮਖੋਰ', 'ਹਰਾਮੀਆ'],
		allowlist: ['bullish harami', 'bearish harami', 'harami candlestick'],
		casualUse: true,
		skeletonSafe: false, // key "hrm" (3)
	}),
	pa({
		lemma: 'ਕਮੀਨਾ',
		severity: 2,
		categories: ['general'],
		// 'kamini' excluded — common female given name. Same call as hi.
		romanizations: ['kamina', 'kameena', 'kaminey', 'kaminay'],
		variants: ['ਕਮੀਨੇ', 'ਕਮੀਨੀ'],
		casualUse: true,
		skeletonSafe: false, // key "kmn" (3)
	}),
	pa({
		lemma: 'ਸਾਲਾ',
		severity: 2,
		categories: ['general'],
		// Literally "brother-in-law" — hence casualUse, exactly as hi treats
		// साला. 'sale', 'salon' and 'salo' stay excluded: they are ordinary
		// English and Slavic words, and hi excludes them for the same reason.
		romanizations: ['saala', 'sala', 'saale', 'saaley'],
		variants: ['ਸਾਲੇ', 'ਸਾਲੀਆ'],
		casualUse: true,
		skeletonSafe: false, // key "sl" (2)
	}),

	pa({
		lemma: 'ਪੇਂਡੂ',
		severity: 1,
		categories: ['general'],
		// REVIEW: classist mockery ("peasant / hick") aimed at rural Punjabis.
		// Kept at severity 1 on the same reading that puts चपरी in the hi pack
		// — it has a target and a bite, unlike the merely-coarse words the
		// Tamil review dropped — but it is the closest call in this pack to
		// policy rule 3.
		romanizations: ['pendu', 'painddu'],
		variants: ['ਪੇਂਡੂਆ'],
		casualUse: true,
		skeletonSafe: false, // key "pnd" (3)
	}),
];

export const punjabi: LanguagePack = {
	language: 'pa',
	name: 'Punjabi + Punglish',
	entries: expandPack(entries),
	allowlist: [
		// Punjabi community names and caste vocabulary used neutrally.
		'jatt',
		'jat sikh',
		'jatt sikh',
		'ramgarhia',
		'ravidassia',
		'ramdasia',
		'ad dharmi',
		'mazhabi',
		'majhabi',
		'balmiki',
		'valmiki',
		'chamar regiment',
		'bhangi misl',
		'bhangi misal',
		'kanjar community',
		'kanjarbhat',
		// Punjabi place names and proper nouns a romanization reaches.
		'chuhar',
		'chuhar chak',
		// Allowlist phrases that came with the romanizations borrowed from
		// the hi pack. Without these a pa-ONLY matcher would censor
		// Gandhi, chutney and Lund University, which hi handles fine.
		'gandhi',
		'uganda',
		'gandalf',
		'propaganda',
		'chutney',
		'chutki',
		'chutkule',
		'lund university',
		'lunds',
		'lund sweden',
		'lund, sweden',
		'kutti story',
		'bullish harami',
		'bearish harami',
		'harami candlestick',
		'motorcade',
		'motorcades',
		'matricide',
		'matricides',
		'matricidal',
		// English words whose spelling or skeleton reaches a Punjabi key.
		'banked',
		'bunked',
		'bonked',
		'sally lunn',
		'conjure',
		'conjurer',
		'conjuror',
	],
};
