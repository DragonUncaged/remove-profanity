/**
 * The four tools, their JSON Schemas, and their handlers.
 *
 * Every tool here is READ-ONLY, and that is a security property rather than an
 * unfinished feature. A moderation service whose word list can be edited by
 * the model it is moderating for is a moderation service that can be talked
 * into switching itself off, so there is no tool to add a word, edit an
 * allowlist, load a file, change configuration, spawn a process or reach the
 * network. Text in, verdict out. A caller who needs custom terms uses the
 * library's `customWords` / `customAllowlist` directly. The reasoning is
 * repeated in `docs/mcp.md` so the omission reads as deliberate.
 *
 * Argument validation failures are reported as tool EXECUTION errors
 * (`isError: true`) rather than JSON-RPC errors, because the specification
 * reserves protocol errors for requests that break the `CallToolRequest` shape
 * and says input-validation errors should come back as content the model can
 * read and self-correct from. An unknown tool name, by contrast, is listed in
 * the specification as a protocol error and is raised as one in `server.ts`.
 */

import type { Category, MatchTier, ProfanityMatch, Severity } from '../index.js';
import type { LanguageSummary, MatcherRegistry } from './packs.js';
import { UnknownLanguageError } from './packs.js';

/** A JSON Schema object, kept loose: it is data we emit, never data we parse. */
export type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
	name: string;
	title: string;
	description: string;
	inputSchema: JsonSchema;
	outputSchema: JsonSchema;
}

/** What a handler produces: JSON that conforms to the tool's `outputSchema`. */
export type ToolOutput = Record<string, unknown>;

export type ToolHandler = (
	args: Record<string, unknown>,
	registry: MatcherRegistry,
) => ToolOutput;

export interface Tool extends ToolDefinition {
	handler: ToolHandler;
}

/**
 * Thrown by the argument readers below and turned into an `isError: true`
 * result by the caller. The message is written for a model to act on.
 */
export class ToolInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ToolInputError';
	}
}

// The argument readers are hand-written rather than driven by a JSON Schema
// validator: the schemas are small, and shipping a validator to check four of
// them would be more code than the four checks.

function readText(args: Record<string, unknown>): string {
	const value = args['text'];
	if (value === undefined) {
		throw new ToolInputError('Missing required argument "text" (a string).');
	}
	if (typeof value !== 'string') {
		throw new ToolInputError(
			`Argument "text" must be a string, received ${describe(value)}.`,
		);
	}
	return value;
}

function readLanguages(
	args: Record<string, unknown>,
	registry: MatcherRegistry,
): string[] | undefined {
	const value = args['languages'];
	if (value === undefined || value === null) return undefined;
	if (!Array.isArray(value)) {
		throw new ToolInputError(
			`Argument "languages" must be an array of language codes, received ${describe(value)}. ` +
				`Available: ${registry.enabled.join(', ')}.`,
		);
	}
	if (value.length === 0) {
		throw new ToolInputError(
			'Argument "languages" was an empty array. Omit it to use every loaded ' +
				`pack (${registry.enabled.join(', ')}), or name at least one code.`,
		);
	}
	const codes: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') {
			throw new ToolInputError(
				`Argument "languages" must contain only strings, found ${describe(item)}.`,
			);
		}
		codes.push(item);
	}
	return codes;
}

function readMinSeverity(args: Record<string, unknown>): Severity {
	const value = args['minSeverity'];
	if (value === undefined || value === null) return 0;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4) {
		throw new ToolInputError(
			`Argument "minSeverity" must be an integer 0-4, received ${describe(value)}.`,
		);
	}
	return value as Severity;
}

function readMask(args: Record<string, unknown>): string | undefined {
	const value = args['mask'];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new ToolInputError(
			`Argument "mask" must be a string, received ${describe(value)}.`,
		);
	}
	if (value.length === 0) {
		throw new ToolInputError('Argument "mask" must not be empty.');
	}
	return value;
}

function readKeepFirst(args: Record<string, unknown>): boolean | undefined {
	const value = args['keepFirst'];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'boolean') {
		throw new ToolInputError(
			`Argument "keepFirst" must be a boolean, received ${describe(value)}.`,
		);
	}
	return value;
}

function rejectUnknown(args: Record<string, unknown>, allowed: readonly string[]): void {
	for (const key of Object.keys(args)) {
		if (!allowed.includes(key)) {
			throw new ToolInputError(
				`Unknown argument "${key}". This tool accepts: ${allowed.join(', ')}.`,
			);
		}
	}
}

/** A short, safe rendering of a bad argument for the error message. */
function describe(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'an array';
	const type = typeof value;
	if (type === 'object') return 'an object';
	if (type === 'string') return 'a string';
	return `${type} ${String(value)}`;
}

/** Turn `UnknownLanguageError` into the model-readable form. */
function selectMatcher(
	registry: MatcherRegistry,
	codes: string[] | undefined,
	minSeverity: Severity,
): ReturnType<MatcherRegistry['matcherFor']> {
	try {
		return registry.matcherFor(codes, minSeverity);
	} catch (err) {
		if (err instanceof UnknownLanguageError) throw new ToolInputError(err.message);
		throw err;
	}
}

const CATEGORIES: readonly Category[] = [
	'slur',
	'casteist',
	'religious',
	'gendered',
	'sexual',
	'ableist',
	'violence',
	'general',
];

const TIERS: readonly MatchTier[] = ['exact', 'masked', 'separated', 'skeleton'];

function textProperty(action: string): JsonSchema {
	return { type: 'string', description: `The text to ${action}.` };
}

function languagesProperty(enabled: readonly string[]): JsonSchema {
	return {
		type: 'array',
		items: { type: 'string', enum: [...enabled] },
		minItems: 1,
		description:
			'Language packs to use for this call. Omit to use every pack this ' +
			`server loaded (${enabled.join(', ')}). Narrowing is not a filter on the ` +
			'results: it changes which dictionaries and allowlists are in play, so it ' +
			'both reduces cross-language false positives and can change which ' +
			'language a shared romanization is reported under. Call list_languages ' +
			'for the codes.',
	};
}

const MIN_SEVERITY_PROPERTY: JsonSchema = {
	type: 'integer',
	minimum: 0,
	maximum: 4,
	description:
		'Suppress matches below this severity. 0 (default) reports everything; ' +
		'0 = mild insult, 4 = extreme slur.',
};

const SEVERITY_PROPERTY: JsonSchema = {
	type: 'integer',
	minimum: 0,
	maximum: 4,
	description: '0 = mild insult, 4 = extreme slur.',
};

const LANGUAGES_USED_PROPERTY: JsonSchema = {
	type: 'array',
	items: { type: 'string' },
	description: 'The language packs actually used for this call, in load order.',
};

const MAX_SEVERITY_PROPERTY: JsonSchema = {
	type: ['integer', 'null'],
	minimum: 0,
	maximum: 4,
	description: 'Highest severity among the matches, or null when there are none.',
};

const MATCH_SCHEMA: JsonSchema = {
	type: 'object',
	properties: {
		surface: {
			type: 'string',
			description:
				'The exact slice of the INPUT text that matched — the obfuscated ' +
				'spelling as written, not the dictionary form.',
		},
		lemma: {
			type: 'string',
			description:
				'The canonical dictionary word the surface resolved to, in its ' +
				'native script where one exists.',
		},
		language: { type: 'string', description: 'ISO 639-1 code of the pack that owns the lemma.' },
		severity: SEVERITY_PROPERTY,
		categories: {
			type: 'array',
			items: { type: 'string', enum: [...CATEGORIES] },
			description: 'What kind of word it is.',
		},
		tier: {
			type: 'string',
			enum: [...TIERS],
			description:
				'How it was caught. exact/masked/separated all required a full ' +
				'dictionary hit and are high precision; skeleton is the phonetic ' +
				'recall tier and is the one worth reviewing rather than blocking on.',
		},
		casualUse: {
			type: 'boolean',
			description:
				'True for words often used conversationally rather than abusively ' +
				'(saala, chakka). Consider a lighter action for these.',
		},
		start: {
			type: 'integer',
			description:
				'Start offset into the INPUT string, in UTF-16 code units, inclusive.',
		},
		end: { type: 'integer', description: 'End offset, exclusive.' },
	},
	required: [
		'surface',
		'lemma',
		'language',
		'severity',
		'categories',
		'tier',
		'casualUse',
		'start',
		'end',
	],
	additionalProperties: false,
};

function matchToJson(match: ProfanityMatch): Record<string, unknown> {
	return {
		surface: match.surface,
		lemma: match.lemma,
		language: match.language,
		severity: match.severity,
		categories: match.categories,
		tier: match.tier,
		casualUse: match.casualUse,
		start: match.start,
		end: match.end,
	};
}

const CHECK_ARGS = ['text', 'languages', 'minSeverity'] as const;

function buildCheckText(enabled: readonly string[]): Tool {
	return {
		name: 'check_text',
		title: 'Check text for profanity',
		description:
			'Answer whether a piece of text is clean, and how many profane terms ' +
			'it contains. Covers English and ten Indian languages in native script ' +
			'and in romanized form (Hinglish, Banglish, Tanglish and the rest), and ' +
			'resolves evasions — leetspeak, Unicode homoglyphs, zero-width ' +
			'injection, letter stretching, interior masks like f*ck, spelled-out ' +
			's.h.i.t and chunk splits. Use scan_text instead when you need to know ' +
			'WHICH words matched, where, and how severe they are.',
		inputSchema: {
			type: 'object',
			properties: {
				text: textProperty('check'),
				languages: languagesProperty(enabled),
				minSeverity: MIN_SEVERITY_PROPERTY,
			},
			required: ['text'],
			additionalProperties: false,
		},
		outputSchema: {
			type: 'object',
			properties: {
				clean: { type: 'boolean', description: 'True when nothing matched.' },
				matchCount: { type: 'integer', description: 'Number of matches found.' },
				maxSeverity: MAX_SEVERITY_PROPERTY,
				languages: LANGUAGES_USED_PROPERTY,
			},
			required: ['clean', 'matchCount', 'maxSeverity', 'languages'],
			additionalProperties: false,
		},
		handler: (args, registry) => {
			rejectUnknown(args, CHECK_ARGS);
			const text = readText(args);
			const codes = readLanguages(args, registry);
			const minSeverity = readMinSeverity(args);
			const matcher = selectMatcher(registry, codes, minSeverity);
			// scan() rather than isClean(): the count is part of the answer, and
			// isClean()'s early exit stops at the first survivor without counting.
			const result = matcher.scan(text);
			return {
				clean: result.matches.length === 0,
				matchCount: result.matches.length,
				maxSeverity: result.maxSeverity,
				languages: codes === undefined ? [...registry.enabled] : resolveUsed(registry, codes),
			};
		},
	};
}

function buildScanText(enabled: readonly string[]): Tool {
	return {
		name: 'scan_text',
		title: 'Scan text and report every match',
		description:
			'Report every profane term in a piece of text: the exact surface as ' +
			'written, the dictionary lemma it resolved to, its language, severity ' +
			'0-4, categories, which matching tier caught it, and its character ' +
			'span in the input. This is the tool to use when a moderation decision ' +
			'needs a reason — the spans let you quote or highlight, the severity ' +
			'and categories let you apply a policy rather than a boolean, and the ' +
			'tier tells you whether the hit was an exact dictionary resolution or ' +
			'the phonetic recall tier.',
		inputSchema: {
			type: 'object',
			properties: {
				text: textProperty('scan'),
				languages: languagesProperty(enabled),
				minSeverity: MIN_SEVERITY_PROPERTY,
			},
			required: ['text'],
			additionalProperties: false,
		},
		outputSchema: {
			type: 'object',
			properties: {
				matches: { type: 'array', items: MATCH_SCHEMA },
				matchCount: { type: 'integer' },
				maxSeverity: MAX_SEVERITY_PROPERTY,
				languages: LANGUAGES_USED_PROPERTY,
			},
			required: ['matches', 'matchCount', 'maxSeverity', 'languages'],
			additionalProperties: false,
		},
		handler: (args, registry) => {
			rejectUnknown(args, CHECK_ARGS);
			const text = readText(args);
			const codes = readLanguages(args, registry);
			const minSeverity = readMinSeverity(args);
			const result = selectMatcher(registry, codes, minSeverity).scan(text);
			return {
				matches: result.matches.map(matchToJson),
				matchCount: result.matches.length,
				maxSeverity: result.maxSeverity,
				languages: codes === undefined ? [...registry.enabled] : resolveUsed(registry, codes),
			};
		},
	};
}

const CENSOR_ARGS = ['text', 'languages', 'minSeverity', 'mask', 'keepFirst'] as const;

function buildCensorText(enabled: readonly string[]): Tool {
	return {
		name: 'censor_text',
		title: 'Censor profanity in text',
		description:
			'Return the text with every match masked. Masking works in grapheme ' +
			'clusters, so Indic matches mask cleanly instead of leaving orphaned ' +
			'matras behind, and the untouched parts of the string are returned ' +
			'byte-for-byte as given.',
		inputSchema: {
			type: 'object',
			properties: {
				text: textProperty('censor'),
				languages: languagesProperty(enabled),
				minSeverity: MIN_SEVERITY_PROPERTY,
				mask: {
					type: 'string',
					minLength: 1,
					description: 'Masking character, repeated once per grapheme cluster. Default "*".',
				},
				keepFirst: {
					type: 'boolean',
					description:
						'Keep the first grapheme cluster of each match visible, so f*ck ' +
						'becomes f*** rather than ****. Default false.',
				},
			},
			required: ['text'],
			additionalProperties: false,
		},
		outputSchema: {
			type: 'object',
			properties: {
				censored: { type: 'string', description: 'The text with matches masked.' },
				matchCount: { type: 'integer' },
				maxSeverity: MAX_SEVERITY_PROPERTY,
				languages: LANGUAGES_USED_PROPERTY,
			},
			required: ['censored', 'matchCount', 'maxSeverity', 'languages'],
			additionalProperties: false,
		},
		handler: (args, registry) => {
			rejectUnknown(args, CENSOR_ARGS);
			const text = readText(args);
			const codes = readLanguages(args, registry);
			const minSeverity = readMinSeverity(args);
			const mask = readMask(args);
			const keepFirst = readKeepFirst(args);
			const matcher = selectMatcher(registry, codes, minSeverity);
			// scan() once and censor from its spans, so the reported count and the
			// returned string can never disagree.
			const result = matcher.scan(text);
			const censored = matcher.censor(text, {
				...(mask === undefined ? {} : { mask }),
				...(keepFirst === undefined ? {} : { keepFirst }),
			});
			return {
				censored,
				matchCount: result.matches.length,
				maxSeverity: result.maxSeverity,
				languages: codes === undefined ? [...registry.enabled] : resolveUsed(registry, codes),
			};
		},
	};
}

function buildListLanguages(): Tool {
	return {
		name: 'list_languages',
		title: 'List available language packs',
		description:
			'List the language packs this server loaded: the code to pass in a ' +
			'"languages" argument, the human-readable name, the scripts the pack ' +
			'covers, and how many lemmas it carries. Call this before narrowing ' +
			'any other tool to a subset of languages.',
		inputSchema: { type: 'object', additionalProperties: false },
		outputSchema: {
			type: 'object',
			properties: {
				languages: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							code: { type: 'string', description: 'ISO 639-1 code, e.g. "hi".' },
							name: { type: 'string', description: 'e.g. "Hindi + Hinglish".' },
							scripts: {
								type: 'array',
								items: { type: 'string' },
								description: 'ISO 15924 codes, e.g. ["Deva", "Latn"].',
							},
							lemmaCount: { type: 'integer' },
						},
						required: ['code', 'name', 'scripts', 'lemmaCount'],
						additionalProperties: false,
					},
				},
				defaultLanguages: {
					type: 'array',
					items: { type: 'string' },
					description:
						'What a call that omits "languages" uses — every loaded pack, in load order.',
				},
			},
			required: ['languages', 'defaultLanguages'],
			additionalProperties: false,
		},
		handler: (args, registry) => {
			rejectUnknown(args, []);
			return {
				languages: registry.summaries.map((s: LanguageSummary) => ({
					code: s.code,
					name: s.name,
					scripts: s.scripts,
					lemmaCount: s.lemmaCount,
				})),
				defaultLanguages: [...registry.enabled],
			};
		},
	};
}

/** The requested codes, deduplicated and put back into pack load order. */
function resolveUsed(registry: MatcherRegistry, codes: readonly string[]): string[] {
	return registry.enabled.filter((c) => codes.includes(c));
}

/**
 * The tool list, in the order `tools/list` reports it. The specification asks
 * for a deterministic order so clients can cache the list; this array is it.
 */
export function buildTools(enabled: readonly string[]): Tool[] {
	return [
		buildCheckText(enabled),
		buildScanText(enabled),
		buildCensorText(enabled),
		buildListLanguages(),
	];
}
