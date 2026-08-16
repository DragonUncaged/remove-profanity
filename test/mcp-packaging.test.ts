/**
 * The MCP server's obligations to the rest of the package: the CLI, the pack
 * registry and matcher cache, the bin wiring in `package.json`, and the
 * dependency rule that keeps the server inert for everyone who does not run it.
 *
 * The import-graph test is the load-bearing one. `src/mcp/` sits ABOVE
 * `src/index.ts`: it imports the library, and nothing in `src/` outside it may
 * import back. The moment something does, `import 'remove-profanity'` starts
 * pulling in a JSON-RPC server, and the headline zero-dependency, no-network,
 * no-process claim stops being a property of the import graph and becomes a
 * promise nobody checks.
 */

import { describe, expect, it } from 'vitest';
// @ts-expect-error - see test/punjabi-gujarati-dictionary.test.ts: this package
// has no @types/node, and the functions used are re-typed below.
import { readFileSync as rawReadFileSync, readdirSync as rawReaddirSync } from 'node:fs';
import { ALL_LANGUAGE_CODES, createRegistry, UnknownLanguageError } from '../src/mcp/packs.js';
import { ENV_LANGUAGES, USAGE, parseArgs } from '../src/mcp/cli.js';
import { SERVER_VERSION, createMcpServer } from '../src/mcp/server.js';

const readFileSync = rawReadFileSync as (path: string, encoding: string) => string;
const readdirSync = rawReaddirSync as (
	path: string,
	options: { withFileTypes: true },
) => Array<{ name: string; isDirectory(): boolean }>;

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, unknown>;

function sourceFilesOutsideMcp(dir = 'src'): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			if (path === 'src/mcp') continue;
			found.push(...sourceFilesOutsideMcp(path));
		} else if (entry.name.endsWith('.ts')) {
			found.push(path);
		}
	}
	return found;
}

const mcpFiles = readdirSync('src/mcp', { withFileTypes: true })
	.filter((entry) => !entry.isDirectory() && entry.name.endsWith('.ts'))
	.map((entry) => entry.name);

describe('mcp dependency rule', () => {
	it('is one flat directory of TypeScript modules', () => {
		expect([...mcpFiles].sort()).toEqual([
			'cli.ts',
			'framing.ts',
			'jsonrpc.ts',
			'packs.ts',
			'server.ts',
			'stdio.ts',
			'tools.ts',
		]);
	});

	it('is imported by nothing under src/', () => {
		const files = sourceFilesOutsideMcp();
		// A sanity floor: if the walk ever returns nothing, the assertion below
		// would pass vacuously.
		expect(files.length).toBeGreaterThan(15);
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
				expect(`${file} imports ${match[1]}`).not.toMatch(/mcp\//);
			}
		}
	});

	it('imports the library through its public entry point, not its internals', () => {
		// The server is a consumer of `remove-profanity`. Reaching into
		// src/engine/ would make it a second one with different privileges, and
		// the layering would stop being checkable from the imports alone. The one
		// deep path allowed is `../data/<code>.js`, which is the per-language
		// subpath any consumer imports the same way.
		for (const file of mcpFiles) {
			const source = readFileSync(`src/mcp/${file}`, 'utf8');
			expect(`${file}: ${source}`).not.toMatch(/from '\.\.\/(engine|folds|unicode)\//);
		}
	});

	it('reaches no filesystem, process or network API', () => {
		// stdio.ts is the transport and legitimately owns `process`; nothing else
		// in the server may touch the host at all. No file here imports node: —
		// the transport declares the handful of `process` members it uses rather
		// than pulling in a module, which is also why the package needs no
		// @types/node.
		for (const file of mcpFiles) {
			const source = readFileSync(`src/mcp/${file}`, 'utf8');
			expect(`${file}: ${source}`).not.toMatch(/from 'node:/);
			expect(`${file}: ${source}`).not.toMatch(/\bfetch\s*\(/);
			expect(`${file}: ${source}`).not.toMatch(/\bnew (Worker|WebSocket)\b/);
			if (file !== 'stdio.ts') {
				// A member access, not the word "process" in a sentence.
				expect(`${file}: ${source}`).not.toMatch(/\bprocess\.[A-Za-z]/);
			}
		}
	});
});

describe('mcp packaging', () => {
	it('declares the bin at the built server', () => {
		expect(manifest['bin']).toEqual({
			'remove-profanity-mcp': './dist/mcp/stdio.js',
		});
	});

	it('ships it, via the dist entry that is already in files', () => {
		expect(manifest['files']).toContain('dist');
	});

	it('still has no runtime dependencies', () => {
		// The whole reason the protocol is hand-rolled rather than taken from
		// @modelcontextprotocol/sdk (4.3 MB, eleven runtime dependencies).
		const dependencies = manifest['dependencies'] as Record<string, string> | undefined;
		expect(dependencies === undefined || Object.keys(dependencies).length === 0).toBe(true);
		expect(manifest['peerDependencies']).toBeUndefined();
		expect(manifest['optionalDependencies']).toBeUndefined();
	});

	it('reports the same version the manifest declares', () => {
		expect(SERVER_VERSION).toBe(manifest['version']);
	});
});

describe('mcp cli', () => {
	const noEnv: Record<string, string | undefined> = {};

	it('defaults to every pack', () => {
		expect(parseArgs([], noEnv)).toEqual({ languages: undefined });
	});

	it('accepts --languages in both spellings, and -l', () => {
		for (const argv of [
			['--languages', 'hi,en'],
			['--languages=hi,en'],
			['-l', 'hi,en'],
			['-l', ' hi , en '],
		]) {
			expect(parseArgs(argv, noEnv).languages).toEqual(['hi', 'en']);
		}
	});

	it('reads the environment variable, and lets the flag win', () => {
		expect(parseArgs([], { [ENV_LANGUAGES]: 'ta,te' }).languages).toEqual(['ta', 'te']);
		expect(parseArgs(['-l', 'hi'], { [ENV_LANGUAGES]: 'ta,te' }).languages).toEqual(['hi']);
		expect(parseArgs([], { [ENV_LANGUAGES]: '   ' }).languages).toBeUndefined();
	});

	it('prints usage and version instead of serving', () => {
		expect(parseArgs(['--help'], noEnv).print).toBe(USAGE);
		expect(parseArgs(['-h'], noEnv).print).toBe(USAGE);
		expect(parseArgs(['--version'], noEnv).print).toBe(`${SERVER_VERSION}\n`);
		expect(USAGE).toContain('check_text');
		expect(USAGE).toContain(ALL_LANGUAGE_CODES.join(', '));
	});

	it('refuses an unknown option and a flag with nothing after it', () => {
		expect(parseArgs(['--danger'], noEnv).error).toBe('Unknown option: --danger');
		expect(parseArgs(['-l'], noEnv).error).toContain('needs a comma-separated list');
		expect(parseArgs(['-l', ','], noEnv).error).toBe('No language codes given.');
	});
});

describe('mcp registry', () => {
	it('loads all eleven packs by default, in a fixed order', () => {
		expect(createRegistry().enabled).toEqual([
			'hi',
			'en',
			'bn',
			'mr',
			'pa',
			'gu',
			'or',
			'ta',
			'te',
			'kn',
			'ml',
		]);
		expect(ALL_LANGUAGE_CODES).toHaveLength(11);
	});

	it('narrows to the named packs, in load order rather than argument order', () => {
		expect(createRegistry(['en', 'hi']).enabled).toEqual(['hi', 'en']);
	});

	it('refuses a code that is not one of the eleven', () => {
		expect(() => createRegistry(['hi', 'fr'])).toThrow(UnknownLanguageError);
		expect(() => createRegistry(['hi', 'fr'])).toThrow(/Unknown or disabled language "fr"/);
	});

	it('builds one matcher at startup and hands the same one back', () => {
		const registry = createRegistry(['hi', 'en']);
		const first = registry.matcherFor(undefined, 0);
		expect(registry.matcherFor(undefined, 0)).toBe(first);
		// Naming every loaded pack explicitly is the same request.
		expect(registry.matcherFor(['hi', 'en'], 0)).toBe(first);
		expect(registry.matcherFor(['en', 'hi'], 0)).toBe(first);
	});

	it('caches a narrowed matcher rather than rebuilding it per call', () => {
		const registry = createRegistry(['hi', 'en']);
		const hindiOnly = registry.matcherFor(['hi'], 0);
		expect(registry.matcherFor(['hi'], 0)).toBe(hindiOnly);
		expect(registry.matcherFor(['hi', 'hi'], 0)).toBe(hindiOnly);
		expect(registry.matcherFor(['hi'], 2)).not.toBe(hindiOnly);
		expect(registry.matcherFor(['en'], 0)).not.toBe(hindiOnly);
	});

	it('bounds the cache, so a client cannot walk the key space into memory', () => {
		const registry = createRegistry();
		const first = registry.matcherFor(['hi'], 1);
		// 16 entries fit; the 17th evicts the oldest, which is `first`.
		for (const code of ALL_LANGUAGE_CODES) {
			for (const severity of [1, 2] as const) {
				registry.matcherFor([code], severity);
			}
		}
		expect(registry.matcherFor(['hi'], 1)).not.toBe(first);
	});

	it('narrows for real — a hi-only matcher does not answer for en', () => {
		const registry = createRegistry(['hi', 'en']);
		expect(registry.matcherFor(['hi'], 0).isClean('what the f*ck')).toBe(true);
		expect(registry.matcherFor(['en'], 0).isClean('what the f*ck')).toBe(false);
	});

	it('applies minSeverity in the matcher, not as a filter on its output', () => {
		// It is not the same question: the matcher drops sub-threshold candidates
		// BEFORE overlap resolution, so a suppressed one can let an overlapping
		// candidate through that a post-filter would never see.
		const registry = createRegistry(['en']);
		expect(registry.matcherFor(['en'], 4).scan('what the f*ck').matches).toHaveLength(0);
		expect(registry.matcherFor(['en'], 3).scan('what the f*ck').matches).toHaveLength(1);
	});
});

describe('mcp server construction', () => {
	it('serves only the languages it was started with', () => {
		expect(createMcpServer({ languages: ['ta'] }).languages).toEqual(['ta']);
		expect(createMcpServer().languages).toEqual(ALL_LANGUAGE_CODES);
	});
});
