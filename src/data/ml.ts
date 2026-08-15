/**
 * Malayalam language pack (native script + romanized "Manglish").
 *
 * Severity rubric is the shared one (README); severity-1 coarse words are not
 * shipped, per the word-list policy in docs/language-packs.md.
 *
 * Malayalam is the most orthographically complicated of the four Dravidian
 * packs, and almost all of that complexity is handled *above* this file, in
 * `src/unicode/indic-scripts.ts`:
 *
 * - **Chillu letters** (ൻ ൺ ർ ൽ ൾ ൿ) are expanded to consonant + chandrakkala
 *   there, so the atomic spelling കുണ്ടൻ and the older ZWJ sequence
 *   കുണ്ടന്‍ reach one key. Nothing in this file has to list both.
 * - **Old vs reformed orthography** likewise: pre-reform ൻറ and reformed ന്റ
 *   converge on the same string once the chillu is expanded, so നായിൻറെ ≡
 *   നായിന്റെ with one dictionary entry. That is the only old/new difference
 *   that exists at the code-point level; the rest of the 1971 reform changed
 *   glyphs, not encoding.
 * - **No anusvara fold.** Telugu and Kannada fold nasal + virama onto ം;
 *   Malayalam must not, because it writes those clusters only as conjuncts.
 *   See the long note on MALAYALAM in indic-scripts.ts.
 *
 * What this file has to solve on its own:
 *
 * 1. **Malayalam minimal pairs that romanize identically.** പണ്ണി "fucked"
 *    and പന്നി "pig" are both "panni"; പറയൻ, the Paraya caste term, is
 *    spelled exactly like പറയാൻ "to say", one of the commonest verbs in the
 *    language. The first ships native-script-only; the second is not shipped
 *    at all.
 * 2. **Kerala place names.** കുന്ന- "hill" opens an unbounded set of
 *    toponyms (Kunnamkulam, Kunnathunad, Kunnathur…) that all begin with the
 *    romanization of കുണ്ണ. That is why കുണ്ണ is word mode: an allowlist can
 *    never be complete against an open set, so prefix mode is simply wrong
 *    there. Prefix mode is used once, on പൂറ്, where the trap set is closed.
 * 3. **No degemination expander.** ta.ts generates half-geminate spellings;
 *    doing that in Malayalam would turn പണ്ണി into പണി "work". The single
 *    clearest reason not to copy another pack's machinery.
 *
 * Deliberately EXCLUDED, and why:
 *   - പറയൻ — the Paraya caste term. Its romanization is identical to
 *     പറയാൻ "to say"; there is no allowlist that survives that. Adding this
 *     pack also forced the same drop on the ta side: its cognate பறையன் used
 *     to ship 'parayan', which censored Manglish "to say" outright. See
 *     docs/language-packs.md.
 *   - വെടി — slang for a sex worker, but also "gunshot" and "firecracker",
 *     which dominate.
 *   - ചെറ്റ — "despicable", but also a palm-leaf hut.
 *   - അണ്ടി — vulgar for testicle, but കശുവണ്ടി is the cashew nut.
 *   - പുല്ല്, കോപ്പ്, മൈലാഞ്ചി-tier mild vocabulary: below the bar.
 *   - നായാടി — the Nayadi community's own name; never a lemma.
 *
 * Romanizations dropped on purpose:
 *   'panni'   പന്നി "pig"
 *   'poor'    the English word; 'poori' the food; 'pooram' the festival
 *   'kundan'  a very common Hindi given name, and a jewellery style
 *   'naari'   Sanskrit/Hindi नारी "woman", a wholly neutral word. നാറി
 *             "stinker" is a real Malayalam insult, but no spelling of it
 *             survives that collision, so the lemma is not shipped at all.
 *             (The ta pack ships 'naari' for நாறி — flagged for review in
 *             docs/language-packs.md.)
 *   'cheruma' the community name, as opposed to the -ൻ abusive form
 *
 * Shared Dravidian roots. തായോളി, കൂതി and ഊമ്പ് are cognate with the ta
 * pack's தாயோலி, கூதி and ஊம்பு and share several romanizations. They ship
 * here in full anyway: a pack must be SELF-SUFFICIENT, because consumers
 * import one subpath at a time and a Malayalam-only consumer cannot be sent
 * to data/ta for its commonest expletives. The overlap costs nothing at scan
 * time — the matcher's overlap resolution keeps one candidate per span, which
 * test/malayalam-data.test.ts asserts directly.
 */
import type { LanguagePack, LemmaEntry } from '../types.js';

function ml(entry: Omit<LemmaEntry, 'language' | 'script'> & { script?: string }): LemmaEntry {
	return { language: 'ml', script: 'Mlym', ...entry };
}

const entries: LemmaEntry[] = [
	ml({
		lemma: 'പൂറ്',
		severity: 4,
		categories: ['sexual'],
		// 'poor' (English), 'poori' (the food) and 'pooram' (the Thrissur
		// festival) are all deliberately absent; only spellings that cannot be
		// read as any of them ship.
		romanizations: ['pooru', 'poorimon', 'poorimone', 'poorumon'],
		variants: ['പൂറി', 'പൂറ്റ്', 'പൂറിമോൻ'],
		matchMode: 'prefix',
		// The closed trap set: പൂരുരുട്ടാതി is a nakshatram and romanizes as
		// "pooruruttathi", which really does open with the 'pooru' prefix. The
		// native side is safe on its own (പൂറ് has റ, പൂരം has ര), but the
		// Latin side is not.
		allowlist: [
			'pooruruttathi',
			'pooradam',
			'pooram',
			'thrissur pooram',
			'poornima',
			'poorna',
			'poori',
		],
		skeletonSafe: false, // key "prmn" collides with പെരുമാൻ "perumaan"
	}),
	ml({
		lemma: 'പണ്ണ്',
		severity: 4,
		categories: ['sexual'],
		// Native script only, and this is the model case for the rule. The
		// romanization "panni" is indistinguishable from പന്നി "pig"; the
		// native spellings are not (ണ്ണ vs ന്ന).
		variants: ['പണ്ണി', 'പണ്ണുക', 'പണ്ണാൻ', 'പണ്ണിയ', 'പണ്ണൽ'],
	}),
	ml({
		lemma: 'തായോളി',
		severity: 4,
		categories: ['gendered', 'sexual'],
		// Cognate with ta.ts's தாயோலி and sharing its main romanization; see
		// the header note on why that overlap is deliberate.
		romanizations: ['thayoli', 'thayolli', 'thayoly'],
		variants: ['തായോളിമോൻ'],
		skeletonSafe: false, // key "tl" (2)
	}),
	ml({
		lemma: 'കൂതി',
		severity: 4,
		categories: ['sexual'],
		// Word mode, NOT prefix, and shipping only the ഊ spelling. Manglish
		// drops the vowel-length and retroflex distinctions that carry the
		// meaning here, so bare 'kuthi' is unusable: കുത്തി "stabbed", കുതിര
		// "horse", കുതിക്കുക "to leap" and കുത്തിയോട്ടം (the temple ritual) all
		// romanize onto it. That trap set has no end, which is the same reason
		// കുണ്ണ below is word mode. 'koothi' is safe — കൂത്ത് "the performance
		// art" is 'koothu', one letter away and allowlisted regardless.
		romanizations: ['koothi', 'koothiyil'],
		allowlist: ['koothu', 'koodiyattam', 'kuthira', 'kuthiravattam', 'kuthiyottam'],
		skeletonSafe: false, // key "kt" (2)
	}),
	ml({
		lemma: 'കൂത്തിച്ചി',
		severity: 4,
		categories: ['gendered', 'sexual'],
		romanizations: ['koothichi', 'koothichy', 'kuthichi'],
		skeletonSafe: false, // key "ktk" (3)
	}),
	ml({
		lemma: 'തേവിടിശ്ശി',
		severity: 4,
		categories: ['gendered', 'sexual'],
		romanizations: ['thevidissi', 'thevidisi', 'thevidichi'],
		skeletonSafe: false, // sweep: key "tvds" reaches "twodecker"
		// തേവരടിയാർ / devadasi is the (non-abusive) etymological source, as it
		// is for the ta pack's தேவடியா.
		allowlist: ['devadasi', 'devaradiyar'],
	}),
	ml({
		lemma: 'കുണ്ടൻ',
		severity: 4,
		categories: ['slur', 'gendered'],
		// Anti-gay slur. Native script only: "Kundan" is a very common Hindi
		// given name and the name of a jewellery style. The chillu fold means
		// the atomic ൻ and the older ന്‍ sequence both match.
		variants: ['കുണ്ടന്മാർ', 'കുണ്ടത്തരം'],
	}),

	// Caste slurs. Only the abusive -ൻ derivations are matched; the
	// community names (പുലയ, ചെറുമ, പറയ) are allowlisted, never listed.
	ml({
		lemma: 'പുലയൻ',
		severity: 4,
		categories: ['casteist', 'slur'],
		romanizations: ['pulayan', 'pulayanmar'],
		allowlist: [
			'pulaya',
			'pulayar',
			'pulaya community',
			'pulayanarkotta',
			'pulayanar kotta',
		],
		skeletonSafe: false, // key "pln" (3)
	}),
	ml({
		lemma: 'ചെറുമൻ',
		severity: 4,
		categories: ['casteist', 'slur'],
		// 'cheruma' (the community name) is not listed. The skeleton key is
		// the problem here: it is identical to skeleton("cheraman"), as in
		// Cheraman Perumal and the Cheraman Juma Masjid.
		romanizations: ['cheruman', 'cherumanmar'],
		allowlist: [
			'cheraman',
			'cheraman perumal',
			'cheraman juma masjid',
			'cheruma',
			'cherumar',
			'cherumakkal',
		],
		skeletonSafe: false, // key "krmn" == skeleton("cheraman")
	}),

	ml({
		lemma: 'കുണ്ണ',
		severity: 3,
		categories: ['sexual'],
		// Word mode ON PURPOSE — see the header. Every Kunna-/Kunnu- toponym
		// in Kerala opens with this romanization, and that set has no end, so
		// prefix mode here could never be defended by an allowlist.
		romanizations: ['kunna', 'kunne', 'kunnayude'],
		variants: ['കുണ്ണയിൽ', 'കുണ്ണയുടെ'],
		allowlist: [
			'kunnamkulam',
			'kunnathunad',
			'kunnathur',
			'kunnamthanam',
			'kunnukara',
			'kunnappally',
			'kunnu',
		],
		skeletonSafe: false, // key "kn" (2)
	}),
	ml({
		lemma: 'ഊമ്പ്',
		severity: 3,
		categories: ['sexual'],
		// Cognate with ta.ts's ஊம்பு; the Malayalam inflections are spelled
		// differently enough that no romanization is shared.
		romanizations: ['oombu', 'oombi', 'oomban', 'oombuka', 'oombiya'],
		variants: ['ഊമ്പി', 'ഊമ്പുക', 'ഊമ്പാൻ'],
	}),
	ml({
		lemma: 'കഴപ്പ്',
		severity: 3,
		categories: ['sexual'],
		romanizations: ['kazhappu', 'kazhappi', 'kazhapp'],
		variants: ['കഴപ്പി'],
		skeletonSafe: false, // key "kjp" (3)
	}),
	ml({
		lemma: 'കഴുവേറി',
		severity: 3,
		categories: ['general'],
		// "One fit for the gallows" — a classic and still-current Malayalam
		// abuse.
		romanizations: ['kazhuveri', 'kazhuveti', 'kazhuverimone'],
		variants: ['കഴുവേറ്റി', 'കഴുവേറിമോൻ'],
	}),
	// താഴ്ന്ന ജാതി ("low caste") was REMOVED on the caste-term
	// decision (2026-08-14): a category written about, not an epithet aimed at
	// a person. പുലയൻ and ചെറുമൻ, which are only ever epithets, stay.
	// See the epithet-versus-category test in docs/language-packs.md.
	ml({
		lemma: 'ആത്മഹത്യ ചെയ്യ്',
		severity: 3,
		categories: ['violence'],
		romanizations: ['aathmahathya cheyyu', 'atmahathya cheyyu', 'aatmahathya cheyy'],
		variants: ['ആത്മഹത്യ ചെയ്യൂ'],
	}),

	ml({
		lemma: 'മൈര്',
		severity: 2,
		categories: ['sexual', 'general'],
		// Cognate with ta.ts's மயிர், and carrying the same casualUse flag for
		// the same reason: it is also the ordinary word for body hair. The
		// Manglish spellings ('myre', 'mairu') differ from the Tanglish ones.
		romanizations: ['myre', 'mairu', 'myru', 'mairan', 'myran'],
		variants: ['മൈരൻ', 'മൈരേ', 'മൈരു'],
		casualUse: true,
		skeletonSafe: false, // keys "mr" (2) and "mrn" (3)
	}),
	ml({
		lemma: 'തെണ്ടി',
		severity: 2,
		categories: ['general'],
		romanizations: ['thendi', 'thendee', 'thendithanam'],
		variants: ['തെണ്ടിത്തരം'],
		skeletonSafe: false, // key "tnd" (3)
	}),
	ml({
		lemma: 'നായിന്റെ മോൻ',
		severity: 2,
		categories: ['general'],
		// The compound, never bare നായ "dog". Written pre-reform as
		// നായിൻറെ മോൻ — the chillu fold makes both spellings one key, which
		// test/malayalam-normalize.test.ts asserts directly.
		romanizations: ['nayinte mone', 'nayinte mon', 'naayinte mone'],
		variants: ['നായിന്റെ മോനെ'],
	}),
];

export const malayalam: LanguagePack = {
	language: 'ml',
	name: 'Malayalam + Manglish',
	entries,
	allowlist: [
		// Malayalam words a prefix entry or a short key would swallow.
		'pooruruttathi', // the nakshatram — opens with the പൂറ് prefix
		'pooradam',
		'pooram',
		'thrissur pooram',
		'poornima',
		'poori',
		'panni', // പന്നി "pig" — and why പണ്ണ് ships native-script-only
		// NOTE: 'parayan' (പറയാൻ "to say") is deliberately NOT allowlisted
		// here, even though it is the reason പറയൻ is not a lemma. An allow
		// entry is global once a pack is loaded, so it would suppress any
		// OTHER pack's claim on the token too. The ta pack's பறையன் used to
		// ship 'parayan'; that romanization was dropped at the source instead,
		// which is the fix that survives being loaded alone.
		// Kerala place names built on കുന്ന് "hill".
		'kunnamkulam',
		'kunnathunad',
		'kunnathur',
		'kunnamthanam',
		'kunnukara',
		'kunnappally',
		// Community names and history. Neutral usage is never censored.
		'pulaya',
		'pulayar',
		'pulayanarkotta',
		'cheruma',
		'cherumar',
		'cheraman',
		'cheraman perumal',
		'cheraman juma masjid',
		'devadasi',
		'devaradiyar',
		'dalit',
		// Ordinary English and Indian words that reach a Malayalam key.
		'kundan', // the given name, and the jewellery style
		'thendral', // "gentle breeze", a common given name
	],
};
