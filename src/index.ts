/**
 * remove-profanity — India-first, evasion-resistant profanity filter.
 *
 * @example
 * ```ts
 * import { createMatcher } from 'remove-profanity';
 * import { hindi } from 'remove-profanity/data/hi';
 * import { english } from 'remove-profanity/data/en';
 *
 * const matcher = createMatcher({ packs: [hindi, english] });
 * matcher.isClean('hello world');          // true
 * matcher.scan('kya bh0sdike').matches;    // [{ lemma, severity, … }]
 * matcher.censor('kya bh0sdike');          // 'kya ********'
 * ```
 */

export { createMatcher } from './engine/matcher.js';
export { censorText } from './engine/censor.js';
export { skeletonKey } from './folds/skeleton.js';
export type {
	Category,
	CensorOptions,
	LanguagePack,
	LemmaEntry,
	Matcher,
	MatcherOptions,
	MatchTier,
	ProfanityMatch,
	ScanResult,
	Severity,
} from './types.js';
