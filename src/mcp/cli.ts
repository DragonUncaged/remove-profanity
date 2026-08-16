/**
 * Command line and environment parsing for the `remove-profanity-mcp` bin.
 *
 * Separate from `stdio.ts` so it can be unit-tested: `stdio.ts` starts the
 * server the moment it is imported, which is what a bin should do and what a
 * test must not trigger.
 */

import { ALL_LANGUAGE_CODES } from './packs.js';
import { SERVER_NAME, SERVER_VERSION } from './server.js';

export const ENV_LANGUAGES = 'REMOVE_PROFANITY_LANGUAGES';

export const USAGE = `${SERVER_NAME}-mcp ${SERVER_VERSION}

Model Context Protocol server (stdio) for remove-profanity. Reads JSON-RPC 2.0
messages from stdin, one per line, and writes responses to stdout. It is meant
to be launched by an MCP client, not run by hand.

Options:
  -l, --languages <codes>  Comma-separated language packs to load.
                           Default: all eleven (~34 ms at startup).
                           Available: ${ALL_LANGUAGE_CODES.join(', ')}
  -h, --help               Print this and exit.
  -v, --version            Print the version and exit.

Environment:
  ${ENV_LANGUAGES}   Same as --languages; the flag wins if both are set.

Tools exposed, all read-only: check_text, scan_text, censor_text,
list_languages. The server reads no files, spawns no processes and makes no
network calls. Manual: docs/mcp.md.
`;

export interface CliOptions {
	/** Packs to load; undefined means all eleven. */
	languages: string[] | undefined;
	/** Text to print on stdout before exiting 0 (--help, --version). */
	print?: string;
	/** Message to print on stderr before exiting 2. */
	error?: string;
}

function parseCodes(value: string): string[] {
	return value
		.split(',')
		.map((code) => code.trim())
		.filter((code) => code.length > 0);
}

/**
 * Precedence: `--languages` beats `REMOVE_PROFANITY_LANGUAGES` beats "all
 * eleven". Codes are validated later, by `createRegistry`, which owns the list.
 */
export function parseArgs(
	argv: readonly string[],
	env: Record<string, string | undefined>,
): CliOptions {
	let languages: string[] | undefined;
	const fromEnv = env[ENV_LANGUAGES];
	if (fromEnv !== undefined && fromEnv.trim().length > 0) {
		languages = parseCodes(fromEnv);
	}

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === '-h' || arg === '--help') return { languages, print: USAGE };
		if (arg === '-v' || arg === '--version') {
			return { languages, print: `${SERVER_VERSION}\n` };
		}
		if (arg === '-l' || arg === '--languages') {
			const next = argv[i + 1];
			if (next === undefined) {
				return {
					languages,
					error: `${arg} needs a comma-separated list of language codes.`,
				};
			}
			languages = parseCodes(next);
			i++;
			continue;
		}
		if (arg.startsWith('--languages=')) {
			languages = parseCodes(arg.slice('--languages='.length));
			continue;
		}
		return { languages, error: `Unknown option: ${arg}` };
	}

	if (languages !== undefined && languages.length === 0) {
		return { languages: undefined, error: 'No language codes given.' };
	}
	return { languages };
}
