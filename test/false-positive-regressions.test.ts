/**
 * One case per false positive fixed on this branch, in the sentence it was
 * reported in.
 *
 * Two sources feed this file. The caste-term cases come from the maintainer
 * decision of 2026-08-14 on the neutral use of caste terms: six descriptive
 * and varna terms were REMOVED, because a category written about is not an
 * epithet aimed at a person, and blocking it censors the discourse about
 * caste discrimination. The rest come from the repaired dictionary sweep
 * (test/all-packs-dictionary-sweep.test.ts) and the adversarial audit.
 *
 * Every case runs with ALL ELEVEN PACKS loaded, because that is where a fix
 * can be undone by another pack, and at the shipped defaults — the skeleton
 * tier stays ON (maintainer decision, same day), so a case passing here is the
 * lemma-level fix working, not the tier being switched off.
 */
import { describe, it, expect } from 'vitest';
import { createMatcher } from '../src/index.js';
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

const all = createMatcher({
	packs: [hindi, english, tamil, odia, bengali, marathi, telugu, kannada, malayalam, punjabi, gujarati],
});

/** The tier is on by default; these cases must pass with it on. */
it('runs with the skeleton tier at its shipped default', () => {
	expect(all.scan('bahanchod').matches[0]!.tier).toBe('skeleton');
});

describe('caste terms ruled neutral (2026-08-14) — removed, not downgraded', () => {
	// Removal, not a severity change: the default minSeverity is 0, so a
	// retained entry is still censored for a default consumer, and casualUse
	// only annotates.
	const cases: [string, string][] = [
		['ta கீழ்ஜாதி', 'கீழ்ஜாதி பற்றிய கட்டுரை'],
		['ta கீழ்ஜாதி romanized', 'the phrase keezh jathi means low caste'],
		['kn ಕೀಳು ಜಾತಿ', 'ಕೀಳು ಜಾತಿ ಎಂಬ ಪದ'],
		['kn ಕೀಳು ಜಾತಿ romanized', 'keelu jaati literally means low caste'],
		['ml താഴ്ന്ന ജാതി', 'താഴ്ന്ന ജാതി എന്ന പ്രയോഗം'],
		['ml താഴ്ന്ന ജാതി romanized', 'thazhnna jathi is the Malayalam phrase'],
		['te తక్కువ కులం', 'తక్కువ కులం అనే మాట'],
		['te తక్కువ కులం romanized', 'thakkuva kulam means low caste in Telugu'],
		['ta சூத்திரன்', 'சூத்திரன் என்பது ஒரு வர்ணம்'],
		['ta சூத்திரன் romanized', 'the soothiran varna in classical scripture'],
		['te శూద్రుడు', 'శూద్రుడు అనే వర్ణం'],
		['te శూద్రుడు romanized', 'the shudrudu varna is written about by historians'],
	];
	it.each(cases)('%s is clean: %j', (_label, text) => {
		expect(all.scan(text).matches).toEqual([]);
	});

	it('keeps every epithet on the ruled list', () => {
		// The sev-4-versus-sev-3 line in the data is NOT the rule — ଚଣ୍ଡାଳ is
		// carried at 3 and stays, because it IS chandal.
		for (const text of [
			'चमार',
			'chamar',
			'भंगी',
			'bhangi',
			'চাঁড়াল',
			'ଚଣ୍ଡାଳ',
			'చండాలుడు',
			'ਚੂਹੜਾ',
			'chuhra',
			'ਕੰਜਰ',
			'പുലയൻ',
			'ചെറുമൻ',
			'பறையன்',
			'பள்ளன்',
			'சக்கிலியன்',
			'பஞ்சமன்',
			'தோட்டி',
			'మాదిగోడు',
			'మాలోడు',
			'పంచముడు',
			'ઢેડ',
			'વાઘરી',
			'महाऱ्या',
			'मांग्या',
			'चांभाऱ्या',
		]) {
			expect(all.isClean(text), `${text} must stay matched`).toBe(false);
		}
	});

	it('leaves neech and chotolok alone — generic insults, out of scope', () => {
		expect(all.isClean('neech')).toBe(false);
		expect(all.isClean('ছোটলোক')).toBe(false);
	});
});

describe('skeleton-key collisions with ordinary English', () => {
	const cases: [string, string][] = [
		// The reported cases, each with the lemma that was flagging it.
		['శూద్రుడు / sdrd', 'she shuddered at the thought'],
		['கழிசடை / klsd', 'the shop is closed today'],
		['கழிசடை / klsd', 'his hands were calloused'],
		['கழிசடை / klsd', 'his hands were callused from the rope'],
		['கழிசடை / klsd', 'it is classed as a hazard'],
		['கழிசடை / klsd', 'coleseed oil comes from rapeseed'],
		['கேணப்பயல் / knpl', 'the chain-pull switch was broken'],
		['கேணப்பயல் / knpl', 'the can-polishing line runs all night'],
		['भोसड़ीके / bsdk', 'the cloth was besodden'],
		['बहनचोद / bnkd', 'a beancod is a small fishing boat'],
		['नामर्द / nmrd', 'a Nimrodian appetite for hunting'],
		// Found only by the repaired sweep, once inflected forms were swept:
		// three everyday words on the same key as beancod.
		['बहनचोद / bnkd', 'the ball bounced twice'],
		['बहनचोद / bnkd', 'he benched the heavier weight'],
		['बहनचोद / bnkd', 'the flowers were bunched together'],
		['चूत मारीके / ktmrk', 'the Catamarcan hills'],
		['बहन के लोड़े / bnkld', 'a bunkload of gear'],
		['चुदक्कड़ / kdkd', 'the caddiced larvae'],
		['मादरचोद / mdrkd', 'the motorcading convoy left'],
	];
	it.each(cases)('%s no longer flags: %j', (_label, text) => {
		expect(all.scan(text).matches).toEqual([]);
	});

	it('still catches the spellings the tier exists for', () => {
		// The fixes are per-lemma. The tier itself keeps doing its job: these
		// spellings are in no pack's romanization list and are caught only
		// because bnkd / bsdn are still in the skeleton index.
		for (const text of ['bahanchod', 'bhaenchhod', 'bhosadeena']) {
			const m = all.scan(text).matches[0];
			expect(m, text).toBeDefined();
			expect(m!.tier, text).toBe('skeleton');
		}
	});
});

describe('exact-tier collisions with ordinary words', () => {
	const cases: [string, string][] = [
		['कुत्ता — the Hindi word for dog', 'kutte ko khana do'],
		['कुत्ता — the Hindi word for dog', 'kutta bahut pyara hai'],
		['लంజ — lanjam is the Telugu for a bribe', 'lanjam means bribe in Telugu'],
		['దెంగు — dengu is how dengue is typed', 'dengu jwaram vachindi'],
		['चूतिया — the Chutia kingdom of Assam', 'the Chutia kingdom of Assam'],
		['चूतिया — the Chutia people', 'the Chutia people of upper Assam'],
		['दल्ला — dalle de verre is slab glass', 'a dalle de verre window'],
	];
	it.each(cases)('%s no longer flags: %j', (_label, text) => {
		expect(all.scan(text).matches).toEqual([]);
	});

	it('leaves the profanity those entries exist for matched', () => {
		for (const text of ['lanja', 'lanjakodaka', 'dengutha', 'chutiya', 'chutia', 'dalla']) {
			expect(all.isClean(text), `${text} must stay matched`).toBe(false);
		}
	});
});
