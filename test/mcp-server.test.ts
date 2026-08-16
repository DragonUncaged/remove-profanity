/**
 * The MCP server's request/response handling, tested by feeding `handleMessage`
 * and `handleLine` message objects directly rather than by driving a child
 * process. Everything the transport does is move bytes; everything that can be
 * wrong about a response is decided in `src/mcp/server.ts`, so a failure here
 * names the rule that broke instead of "the client did not connect".
 *
 * Covered: both protocol eras' handshakes, the tool listing, each tool's happy
 * path, an unknown tool, malformed JSON, a missing required argument, and the
 * ways a client can be wrong that must not end the process.
 */

import { describe, expect, it } from 'vitest';
import {
	LEGACY_PROTOCOL_VERSIONS,
	MODERN_PROTOCOL_VERSION,
	SERVER_NAME,
	SERVER_VERSION,
	createMcpServer,
	type McpServer,
} from '../src/mcp/server.js';
import type { JsonRpcResponse } from '../src/mcp/jsonrpc.js';

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';

// hi + en rather than all eleven: this suite builds a server per describe
// block and the two packs cover every assertion below in a fraction of the
// eleven-pack construction cost. `test/mcp-packaging.test.ts` covers the default.
const server: McpServer = createMcpServer({ languages: ['hi', 'en'] });

let nextId = 0;

function send(
	method: string,
	params?: Record<string, unknown>,
	target: McpServer = server,
): JsonRpcResponse | null {
	nextId += 1;
	return target.handleMessage({
		jsonrpc: '2.0',
		id: nextId,
		method,
		...(params === undefined ? {} : { params }),
	});
}

function resultOf(response: JsonRpcResponse | null): Record<string, unknown> {
	if (response === null || !('result' in response)) {
		throw new Error(`expected a result, got ${JSON.stringify(response)}`);
	}
	return response.result;
}

function errorOf(response: JsonRpcResponse | null): {
	code: number;
	message: string;
	data?: unknown;
} {
	if (response === null || !('error' in response)) {
		throw new Error(`expected an error, got ${JSON.stringify(response)}`);
	}
	return response.error;
}

function call(
	name: string,
	args: Record<string, unknown>,
	target: McpServer = server,
): Record<string, unknown> {
	return resultOf(send('tools/call', { name, arguments: args }, target));
}

/** A successful tool call's `structuredContent`, with the invariants checked. */
function structured(
	name: string,
	args: Record<string, unknown>,
	target: McpServer = server,
): Record<string, unknown> {
	const result = call(name, args, target);
	expect(result['isError']).toBe(false);
	const content = result['content'] as Array<Record<string, unknown>>;
	// The specification asks a tool returning structuredContent to also serialize
	// it into a text block, so clients that read only `content` lose nothing.
	expect(content).toHaveLength(1);
	expect(content[0]!['type']).toBe('text');
	expect(JSON.parse(content[0]!['text'] as string)).toEqual(result['structuredContent']);
	return result['structuredContent'] as Record<string, unknown>;
}

/** The text of a tool-execution error (`isError: true`). */
function toolError(name: string, args: Record<string, unknown>): string {
	const result = call(name, args);
	expect(result['isError']).toBe(true);
	const content = result['content'] as Array<Record<string, unknown>>;
	return content[0]!['text'] as string;
}

describe('mcp handshake — legacy initialize', () => {
	it('echoes a protocol version it supports', () => {
		for (const version of LEGACY_PROTOCOL_VERSIONS) {
			const result = resultOf(
				send('initialize', {
					protocolVersion: version,
					capabilities: {},
					clientInfo: { name: 'test', version: '1.0.0' },
				}),
			);
			expect(result['protocolVersion']).toBe(version);
		}
	});

	it('answers an unknown version with the newest one it does support', () => {
		// The legacy rule is "respond with another protocol version it supports",
		// not "reject" — a client that cannot live with the answer disconnects.
		for (const requested of ['1.0.0', '2099-01-01', MODERN_PROTOCOL_VERSION]) {
			const result = resultOf(send('initialize', { protocolVersion: requested }));
			expect(result['protocolVersion']).toBe(LEGACY_PROTOCOL_VERSIONS[0]);
		}
	});

	it('survives an initialize with no params at all', () => {
		const result = resultOf(send('initialize'));
		expect(result['protocolVersion']).toBe(LEGACY_PROTOCOL_VERSIONS[0]);
	});

	it('declares the tools capability, its identity and instructions', () => {
		const result = resultOf(send('initialize', { protocolVersion: '2025-06-18' }));
		expect(result['capabilities']).toEqual({ tools: {} });
		expect(result['serverInfo']).toMatchObject({
			name: SERVER_NAME,
			version: SERVER_VERSION,
		});
		expect(String(result['instructions'])).toContain('scan_text');
	});

	it('does not leak modern-only fields into a legacy result', () => {
		// A legacy client has no schema slot for `resultType` or a `_meta`
		// serverInfo, and its absence is exactly what a legacy client expects.
		const result = resultOf(send('initialize', { protocolVersion: '2025-06-18' }));
		expect(result['resultType']).toBeUndefined();
		expect(resultOf(send('tools/list'))['resultType']).toBeUndefined();
		expect(resultOf(send('tools/list'))['_meta']).toBeUndefined();
	});

	it('never responds to the initialized notification', () => {
		expect(
			server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		).toBeNull();
	});

	it('never responds to any other notification either', () => {
		for (const method of [
			'notifications/cancelled',
			'notifications/progress',
			'notifications/something/nobody/defined',
		]) {
			expect(server.handleMessage({ jsonrpc: '2.0', method, params: {} })).toBeNull();
		}
	});

	it('answers ping', () => {
		expect(resultOf(send('ping'))).toEqual({});
	});
});

describe('mcp handshake — modern server/discover', () => {
	const modern = (
		method: string,
		params: Record<string, unknown> = {},
	): JsonRpcResponse | null =>
		send(method, {
			...params,
			_meta: {
				[META_VERSION]: MODERN_PROTOCOL_VERSION,
				'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
				'io.modelcontextprotocol/clientCapabilities': {},
			},
		});

	it('reports supported versions, capabilities and identity', () => {
		const result = resultOf(modern('server/discover'));
		expect(result['resultType']).toBe('complete');
		expect(result['supportedVersions']).toEqual([MODERN_PROTOCOL_VERSION]);
		expect(result['capabilities']).toEqual({ tools: {} });
		expect(result['_meta']).toEqual({
			'io.modelcontextprotocol/serverInfo': {
				name: SERVER_NAME,
				title: expect.any(String),
				version: SERVER_VERSION,
			},
		});
	});

	it('stamps resultType and serverInfo on every modern result', () => {
		for (const method of ['ping', 'tools/list']) {
			const result = resultOf(modern(method));
			expect(result['resultType']).toBe('complete');
			expect(result['_meta']).toHaveProperty('io.modelcontextprotocol/serverInfo');
		}
		const call = resultOf(
			modern('tools/call', { name: 'check_text', arguments: { text: 'hello' } }),
		);
		expect(call['resultType']).toBe('complete');
	});

	it('rejects an unsupported modern version with -32022 and names what it has', () => {
		const response = send('tools/list', {
			_meta: { [META_VERSION]: '1900-01-01' },
		});
		const error = errorOf(response);
		expect(error.code).toBe(-32022);
		expect(error.message).toBe('Unsupported protocol version');
		expect(error.data).toEqual({
			supported: [MODERN_PROTOCOL_VERSION],
			requested: '1900-01-01',
		});
	});

	it('rejects a non-string protocol version as invalid params', () => {
		expect(errorOf(send('tools/list', { _meta: { [META_VERSION]: 2026 } })).code).toBe(
			-32602,
		);
	});

	it('does not require clientCapabilities, which it never reads', () => {
		// A deliberate deviation, documented in docs/mcp.md: the specification
		// makes the field mandatory, but no tool here needs a client capability,
		// so rejecting a request for omitting it would break clients to no end.
		const result = resultOf(
			send('tools/list', { _meta: { [META_VERSION]: MODERN_PROTOCOL_VERSION } }),
		);
		expect(result['resultType']).toBe('complete');
	});
});

describe('mcp tools/list', () => {
	it('lists exactly the four read-only tools, in a stable order', () => {
		const tools = resultOf(send('tools/list'))['tools'] as Array<Record<string, unknown>>;
		expect(tools.map((t) => t['name'])).toEqual([
			'check_text',
			'scan_text',
			'censor_text',
			'list_languages',
		]);
		// The listing is what an agent reads to decide what this server can do.
		// A mutating, filesystem, process or network tool appearing here is the
		// regression this assertion exists to catch.
		expect(tools).toHaveLength(4);
	});

	it('gives every tool a title, a description and both schemas', () => {
		const tools = resultOf(send('tools/list'))['tools'] as Array<Record<string, unknown>>;
		for (const tool of tools) {
			expect(typeof tool['title']).toBe('string');
			expect(String(tool['description']).length).toBeGreaterThan(40);
			const input = tool['inputSchema'] as Record<string, unknown>;
			const output = tool['outputSchema'] as Record<string, unknown>;
			expect(input['type']).toBe('object');
			expect(input['additionalProperties']).toBe(false);
			expect(output['type']).toBe('object');
		}
	});

	it('offers no pagination cursor, because four tools are one page', () => {
		expect(resultOf(send('tools/list'))['nextCursor']).toBeUndefined();
		// A client that sends a cursor anyway gets the only page there is.
		expect(
			(resultOf(send('tools/list', { cursor: 'anything' }))['tools'] as unknown[]).length,
		).toBe(4);
	});

	it('offers only the loaded languages in the languages enum', () => {
		const tools = resultOf(send('tools/list'))['tools'] as Array<Record<string, unknown>>;
		const scan = tools.find((t) => t['name'] === 'scan_text')!;
		const props = (scan['inputSchema'] as Record<string, unknown>)['properties'] as Record<
			string,
			Record<string, unknown>
		>;
		const items = props['languages']!['items'] as Record<string, unknown>;
		expect(items['enum']).toEqual(['hi', 'en']);
	});
});

describe('mcp tool — check_text', () => {
	it('reports clean text as clean', () => {
		expect(structured('check_text', { text: 'Mahatma Gandhi went to Scunthorpe' })).toEqual({
			clean: true,
			matchCount: 0,
			maxSeverity: null,
			languages: ['hi', 'en'],
		});
	});

	it('reports profane text with a count and the top severity', () => {
		expect(structured('check_text', { text: 'kya bh0sdike yaar' })).toEqual({
			clean: false,
			matchCount: 1,
			maxSeverity: 4,
			languages: ['hi', 'en'],
		});
	});

	it('honours minSeverity', () => {
		expect(structured('check_text', { text: 'what the f*ck' })['maxSeverity']).toBe(3);
		expect(structured('check_text', { text: 'what the f*ck', minSeverity: 4 })).toEqual({
			clean: true,
			matchCount: 0,
			maxSeverity: null,
			languages: ['hi', 'en'],
		});
	});

	it('narrows to the named packs and echoes which were used', () => {
		const englishOnly = structured('check_text', {
			text: 'kya bh0sdike yaar',
			languages: ['en'],
		});
		expect(englishOnly['languages']).toEqual(['en']);
		expect(englishOnly['clean']).toBe(true);
		expect(structured('check_text', { text: 'kya bh0sdike yaar', languages: ['hi'] })).toEqual(
			{ clean: false, matchCount: 1, maxSeverity: 4, languages: ['hi'] },
		);
	});

	it('reports languages in pack load order, however they were listed', () => {
		expect(
			structured('check_text', { text: 'hello', languages: ['en', 'hi', 'en'] })['languages'],
		).toEqual(['hi', 'en']);
	});
});

describe('mcp tool — scan_text', () => {
	it('reports the surface, lemma, language, severity, categories, tier and span', () => {
		const out = structured('scan_text', { text: 'kya bh0sdike yaar' });
		expect(out['matchCount']).toBe(1);
		expect(out['maxSeverity']).toBe(4);
		const matches = out['matches'] as Array<Record<string, unknown>>;
		expect(matches[0]).toEqual({
			surface: 'bh0sdike',
			lemma: 'भोसड़ीके',
			language: 'hi',
			severity: 4,
			categories: ['sexual', 'gendered'],
			tier: 'exact',
			casualUse: false,
			start: 4,
			end: 12,
		});
	});

	it('reports spans that slice the ORIGINAL input back out', () => {
		const text = 'what the f*ck is this bh0sdike nonsense';
		const matches = structured('scan_text', { text })['matches'] as Array<
			Record<string, unknown>
		>;
		expect(matches.length).toBeGreaterThan(1);
		for (const match of matches) {
			expect(text.slice(match['start'] as number, match['end'] as number)).toBe(
				match['surface'],
			);
		}
	});

	it('reports the tier, so a caller can treat recall hits differently', () => {
		const matches = structured('scan_text', { text: 'tu ek behenchod hai' })[
			'matches'
		] as Array<Record<string, unknown>>;
		expect(matches).toHaveLength(1);
		expect(matches[0]!['tier']).toBe('skeleton');
	});

	it('returns an empty match list rather than an error for clean text', () => {
		expect(structured('scan_text', { text: 'good morning' })).toEqual({
			matches: [],
			matchCount: 0,
			maxSeverity: null,
			languages: ['hi', 'en'],
		});
	});
});

describe('mcp tool — censor_text', () => {
	it('masks matches and leaves the rest byte-for-byte', () => {
		expect(structured('censor_text', { text: 'kya bh0sdike yaar' })).toEqual({
			censored: 'kya ******** yaar',
			matchCount: 1,
			maxSeverity: 4,
			languages: ['hi', 'en'],
		});
	});

	it('supports keepFirst', () => {
		expect(
			structured('censor_text', { text: 'what the f*ck', keepFirst: true })['censored'],
		).toBe('what the f***');
	});

	it('supports a custom mask character', () => {
		expect(structured('censor_text', { text: 'what the f*ck', mask: '#' })['censored']).toBe(
			'what the ####',
		);
	});

	it('returns clean text unchanged', () => {
		expect(structured('censor_text', { text: 'Scunthorpe United' })['censored']).toBe(
			'Scunthorpe United',
		);
	});

	it('masks in grapheme clusters, so Devanagari does not lose its matras', () => {
		const out = structured('censor_text', { text: 'तू बहनचोद है' })['censored'] as string;
		expect(out).toBe('तू ***** है');
	});
});

describe('mcp tool — list_languages', () => {
	it('reports the loaded packs with their names, scripts and lemma counts', () => {
		const out = structured('list_languages', {});
		expect(out['defaultLanguages']).toEqual(['hi', 'en']);
		const languages = out['languages'] as Array<Record<string, unknown>>;
		expect(languages.map((l) => l['code'])).toEqual(['hi', 'en']);
		// Hindi carries Latin-script lemmas as well as Devanagari ones, and the
		// scripts list reports what is actually in the pack rather than the one
		// script the language is named for.
		expect(languages[0]).toMatchObject({ code: 'hi', scripts: ['Deva', 'Latn'] });
		expect(languages[1]).toMatchObject({ code: 'en', scripts: ['Latn'] });
		expect(String(languages[0]!['name'])).toContain('Hindi');
		expect(languages[0]!['lemmaCount']).toBeGreaterThan(0);
	});

	it('takes no arguments and says so when given one', () => {
		expect(toolError('list_languages', { text: 'hello' })).toContain(
			'Unknown argument "text"',
		);
	});
});

describe('mcp errors — protocol level', () => {
	it('returns -32602 for an unknown tool, and names the ones it has', () => {
		const error = errorOf(send('tools/call', { name: 'delete_everything', arguments: {} }));
		expect(error.code).toBe(-32602);
		expect(error.message).toBe('Unknown tool: delete_everything');
		expect(error.data).toEqual({
			available: ['check_text', 'scan_text', 'censor_text', 'list_languages'],
		});
	});

	it('returns -32601 for an unknown method', () => {
		const error = errorOf(send('resources/list'));
		expect(error.code).toBe(-32601);
		expect(error.message).toBe('Method not found: resources/list');
	});

	it('returns -32700 for malformed JSON, with a null id', () => {
		for (const line of ['not json', '{"jsonrpc": ', '{oops}', '[1, 2']) {
			const error = errorOf(server.handleLine(line));
			expect(error.code).toBe(-32700);
		}
		const response = server.handleLine('not json')!;
		expect(response.id).toBeNull();
	});

	it('ignores a blank line', () => {
		expect(server.handleLine('')).toBeNull();
		expect(server.handleLine('   \t ')).toBeNull();
	});

	it('parses a line with trailing whitespace and a stray carriage return', () => {
		const response = server.handleLine('{"jsonrpc":"2.0","id":9,"method":"ping"}\r  ');
		expect(resultOf(response)).toEqual({});
	});

	it('rejects a batch rather than half-answering it', () => {
		const error = errorOf(server.handleLine('[{"jsonrpc":"2.0","id":1,"method":"ping"}]'));
		expect(error.code).toBe(-32600);
		expect(error.message).toContain('Batched');
	});

	it('rejects a message that is not an object', () => {
		for (const line of ['"hello"', '42', 'null', 'true']) {
			expect(errorOf(server.handleLine(line)).code).toBe(-32600);
		}
	});

	it('rejects a null, boolean or object id', () => {
		for (const id of [null, true, { a: 1 }, []]) {
			expect(errorOf(server.handleMessage({ jsonrpc: '2.0', id, method: 'ping' })).code).toBe(
				-32600,
			);
		}
	});

	it('rejects a wrong jsonrpc version and a non-string method', () => {
		expect(
			errorOf(server.handleMessage({ jsonrpc: '1.0', id: 1, method: 'ping' })).code,
		).toBe(-32600);
		expect(errorOf(server.handleMessage({ jsonrpc: '2.0', id: 1, method: 7 })).code).toBe(
			-32600,
		);
	});

	it('rejects non-object params', () => {
		expect(
			errorOf(server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'ping', params: 'x' }))
				.code,
		).toBe(-32602);
	});

	it('requires a string tool name and an object arguments', () => {
		expect(errorOf(send('tools/call', {})).code).toBe(-32602);
		expect(errorOf(send('tools/call', { name: 42 })).code).toBe(-32602);
		expect(errorOf(send('tools/call', { name: 'check_text', arguments: 'text' })).code).toBe(
			-32602,
		);
	});
});

describe('mcp errors — tool input, reported to the model', () => {
	// The specification reserves JSON-RPC errors for requests that break the
	// CallToolRequest shape and asks for input-validation failures to come back
	// as `isError: true` content, so the model can read the message and retry.
	it('reports a missing required argument', () => {
		expect(toolError('check_text', {})).toBe(
			'Missing required argument "text" (a string).',
		);
		expect(toolError('scan_text', {})).toContain('Missing required argument "text"');
		expect(toolError('censor_text', {})).toContain('Missing required argument "text"');
	});

	it('reports a wrongly typed text', () => {
		expect(toolError('check_text', { text: 42 })).toBe(
			'Argument "text" must be a string, received number 42.',
		);
		expect(toolError('check_text', { text: null })).toContain('must be a string');
	});

	it('reports a bad minSeverity', () => {
		for (const bad of [-1, 5, 2.5, 'high']) {
			expect(toolError('check_text', { text: 'hi', minSeverity: bad })).toContain(
				'must be an integer 0-4',
			);
		}
	});

	it('reports an unknown or disabled language, and names what is loaded', () => {
		const message = toolError('check_text', { text: 'hi', languages: ['fr'] });
		expect(message).toContain('Unknown or disabled language "fr"');
		expect(message).toContain('hi, en');
		// `ta` is a real pack, but this server was not started with it.
		expect(toolError('check_text', { text: 'hi', languages: ['ta'] })).toContain(
			'Unknown or disabled language "ta"',
		);
	});

	it('reports a malformed languages argument', () => {
		expect(toolError('check_text', { text: 'hi', languages: 'en' })).toContain(
			'must be an array',
		);
		expect(toolError('check_text', { text: 'hi', languages: [] })).toContain('empty array');
		expect(toolError('check_text', { text: 'hi', languages: [1] })).toContain(
			'only strings',
		);
	});

	it('reports bad censor options', () => {
		expect(toolError('censor_text', { text: 'hi', mask: '' })).toContain('must not be empty');
		expect(toolError('censor_text', { text: 'hi', mask: 3 })).toContain('must be a string');
		expect(toolError('censor_text', { text: 'hi', keepFirst: 'yes' })).toContain(
			'must be a boolean',
		);
	});

	it('rejects an argument the tool does not have', () => {
		expect(toolError('check_text', { text: 'hi', mask: '#' })).toContain(
			'Unknown argument "mask"',
		);
		expect(toolError('scan_text', { text: 'hi', regex: '.*' })).toContain(
			'Unknown argument "regex"',
		);
	});

	it('treats an omitted arguments object as an empty one', () => {
		// Some clients omit `arguments` for a no-parameter tool.
		const result = resultOf(send('tools/call', { name: 'list_languages' }));
		expect(result['isError']).toBe(false);
	});

	it('accepts an explicit null for every optional argument', () => {
		expect(
			structured('censor_text', {
				text: 'what the f*ck',
				languages: null,
				minSeverity: null,
				mask: null,
				keepFirst: null,
			})['censored'],
		).toBe('what the ****');
	});
});

describe('mcp — nothing takes the process down', () => {
	it('answers every hostile message shape with a response object', () => {
		const hostile: unknown[] = [
			undefined,
			null,
			0,
			'',
			[],
			{},
			{ jsonrpc: '2.0' },
			{ jsonrpc: '2.0', id: 1 },
			{ jsonrpc: '2.0', id: 1, method: 'tools/call' },
			{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'check_text' } },
			{ jsonrpc: '2.0', id: 1, method: '' },
			{ jsonrpc: '2.0', id: 1, method: 'ping', params: [] },
			{ jsonrpc: '2.0', id: '', method: 'ping' },
		];
		for (const message of hostile) {
			expect(() => server.handleMessage(message)).not.toThrow();
		}
	});

	it('handles a very large input without a special case', () => {
		const text = `${'clean words '.repeat(20_000)}bh0sdike`;
		const out = structured('check_text', { text });
		expect(out['clean']).toBe(false);
	});

	it('never emits a response containing a raw newline', () => {
		// The stdio framing is one message per line, so an embedded newline in a
		// tool's text would corrupt the stream. JSON.stringify escapes them.
		const response = call('scan_text', { text: 'line one\nbh0sdike\nline three' });
		expect(JSON.stringify(response)).not.toContain('\n');
	});
});

describe('mcp — the server is read-only', () => {
	it('exposes no tool that mutates, reads files, spawns or reaches the network', () => {
		const tools = resultOf(send('tools/list'))['tools'] as Array<Record<string, unknown>>;
		const forbidden =
			/\b(add|remove|delete|set|update|write|load|save|configure|exec|run|fetch|file|path|url)\b/i;
		for (const tool of tools) {
			expect(String(tool['name'])).not.toMatch(forbidden);
			const properties = ((tool['inputSchema'] as Record<string, unknown>)['properties'] ??
				{}) as Record<string, unknown>;
			for (const key of Object.keys(properties)) {
				expect(key).not.toMatch(forbidden);
			}
		}
	});

	it('cannot be talked into changing what a later call sees', () => {
		// There is no state to poison: the same call answers the same way after
		// every other call in this suite has run.
		expect(structured('check_text', { text: 'kya bh0sdike yaar' })).toEqual({
			clean: false,
			matchCount: 1,
			maxSeverity: 4,
			languages: ['hi', 'en'],
		});
	});
});
