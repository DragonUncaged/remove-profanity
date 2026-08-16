/**
 * The MCP server core: a pure function from one JSON-RPC message to one
 * response (or `null`, for a notification). It owns no streams and no process
 * state, which is what makes it unit-testable by feeding it request objects —
 * `src/mcp/stdio.ts` is the thin part that moves bytes.
 *
 * The server is DUAL-ERA, because the protocol changed shape and real clients
 * are on both sides of the change:
 *
 *   * LEGACY (revision 2025-11-25 and earlier) opens with an `initialize`
 *     handshake that negotiates a version once for the connection.
 *   * MODERN (revision 2026-07-28) has no handshake at all. It is stateless:
 *     every request carries its protocol version in
 *     `params._meta["io.modelcontextprotocol/protocolVersion"]`, and
 *     `server/discover` replaces `initialize` as the way to ask what a server
 *     is. Modern results additionally carry `resultType`.
 *
 * Era is decided per request, from the presence of that `_meta` key, exactly
 * as the specification's dual-era server section describes. Nothing is
 * remembered between requests, so an interleaved mixture of both works.
 */

import {
	INTERNAL_ERROR,
	INVALID_PARAMS,
	INVALID_REQUEST,
	METHOD_NOT_FOUND,
	PARSE_ERROR,
	UNSUPPORTED_PROTOCOL_VERSION,
	errorResponse,
	isPlainObject,
	resultResponse,
	type JsonRpcId,
	type JsonRpcResponse,
} from './jsonrpc.js';
import { createRegistry, type MatcherRegistry } from './packs.js';
import { ToolInputError, buildTools, type Tool } from './tools.js';

export const SERVER_NAME = 'remove-profanity';
export const SERVER_TITLE = 'remove-profanity (Indic profanity filter)';

/**
 * Kept in step with `package.json` by `test/mcp-server.test.ts`, which reads
 * the manifest. A constant rather than a JSON import so the built server does
 * not need `resolveJsonModule` or a runtime file read.
 */
export const SERVER_VERSION = '1.0.1';

/** The one revision this server speaks with per-request metadata. */
export const MODERN_PROTOCOL_VERSION = '2026-07-28';

/**
 * Handshake revisions, newest first. An `initialize` naming one of these is
 * echoed back; anything else is answered with the newest, which is what the
 * legacy negotiation rule prescribes ("the server MUST respond with another
 * protocol version it supports").
 */
export const LEGACY_PROTOCOL_VERSIONS: readonly string[] = [
	'2025-11-25',
	'2025-06-18',
	'2025-03-26',
	'2024-11-05',
];

const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

const INSTRUCTIONS =
	'Offline profanity and abuse detection for English and ten Indian ' +
	'languages, in native script (Devanagari, Bengali, Gurmukhi, Gujarati, ' +
	'Odia, Tamil, Telugu, Kannada, Malayalam) and in romanized form ' +
	'(Hinglish, Banglish, Tanglish and the rest), including spellings the ' +
	'dictionary has never seen. Use scan_text when a decision needs a reason: ' +
	'it returns the matched surface, the lemma, the language, severity 0-4, ' +
	'categories and the character span. check_text is the cheap boolean, ' +
	'censor_text returns the masked text, list_languages reports the packs ' +
	'loaded. Every tool is read-only and purely local: the server reads no ' +
	'files, spawns no processes, makes no network calls, and has no way to ' +
	'add words or edit allowlists. It reports what a dictionary and a ' +
	'matching engine found; it does not classify toxicity, harassment, ' +
	'sarcasm or intent, and its output is a signal for your policy rather ' +
	'than a verdict.';

export interface McpServerOptions {
	/**
	 * Language packs to load. Undefined loads all eleven (~34 ms cold). Throws
	 * `UnknownLanguageError` for a code that is not one of the eleven.
	 */
	languages?: readonly string[];
	/** Injected by the tests; defaults to a registry built from `languages`. */
	registry?: MatcherRegistry;
}

export interface McpServer {
	/** Language codes this process serves, in load order. */
	readonly languages: readonly string[];
	/** Handle one parsed message. Returns null for notifications. */
	handleMessage(message: unknown): JsonRpcResponse | null;
	/**
	 * Handle one line of the stdio stream. Unparseable input becomes a -32700
	 * response rather than a thrown error, so a malformed line can never take
	 * the process — and with it the user's session — down.
	 */
	handleLine(line: string): JsonRpcResponse | null;
}

type Era = 'legacy' | 'modern';

export function createMcpServer(options: McpServerOptions = {}): McpServer {
	const registry = options.registry ?? createRegistry(options.languages);
	const tools: Tool[] = buildTools(registry.enabled);
	const byName = new Map(tools.map((t) => [t.name, t]));

	/**
	 * Modern results must carry `resultType`, and servers SHOULD identify
	 * themselves in every result's `_meta`. Legacy results carry neither: a
	 * legacy client has no schema slot for them, and their absence is exactly
	 * what a legacy client expects.
	 */
	const ok = (
		id: JsonRpcId,
		era: Era,
		result: Record<string, unknown>,
	): JsonRpcResponse =>
		resultResponse(
			id,
			era === 'modern'
				? {
						resultType: 'complete',
						...result,
						_meta: { [META_SERVER_INFO]: implementation() },
					}
				: result,
		);

	const implementation = (): Record<string, unknown> => ({
		name: SERVER_NAME,
		title: SERVER_TITLE,
		version: SERVER_VERSION,
	});

	const listTools = (): Record<string, unknown> => ({
		tools: tools.map((t) => ({
			name: t.name,
			title: t.title,
			description: t.description,
			inputSchema: t.inputSchema,
			outputSchema: t.outputSchema,
		})),
	});

	const callTool = (
		id: JsonRpcId,
		era: Era,
		params: Record<string, unknown>,
	): JsonRpcResponse => {
		const name = params['name'];
		if (typeof name !== 'string') {
			return errorResponse(
				id,
				INVALID_PARAMS,
				'tools/call requires a string "name" parameter.',
			);
		}
		const tool = byName.get(name);
		// The specification lists "unknown tool" as a protocol error rather than
		// a tool-execution one: no argument the model could pick would fix it.
		if (tool === undefined) {
			return errorResponse(id, INVALID_PARAMS, `Unknown tool: ${name}`, {
				available: tools.map((t) => t.name),
			});
		}
		const rawArgs = params['arguments'];
		if (rawArgs !== undefined && rawArgs !== null && !isPlainObject(rawArgs)) {
			return errorResponse(
				id,
				INVALID_PARAMS,
				'tools/call "arguments" must be an object when present.',
			);
		}
		const args = isPlainObject(rawArgs) ? rawArgs : {};

		try {
			const output = tool.handler(args, registry);
			return ok(id, era, {
				content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
				structuredContent: output,
				isError: false,
			});
		} catch (err) {
			// Bad arguments are reported to the MODEL, not to the transport, so it
			// can read the message and retry. Anything else is a genuine internal
			// failure and is still reported as a tool error rather than crashing:
			// one bad call must not end the session.
			const message =
				err instanceof ToolInputError
					? err.message
					: `${name} failed: ${err instanceof Error ? err.message : String(err)}`;
			return ok(id, era, {
				content: [{ type: 'text', text: message }],
				isError: true,
			});
		}
	};

	const initialize = (
		id: JsonRpcId,
		params: Record<string, unknown>,
	): JsonRpcResponse => {
		const requested = params['protocolVersion'];
		const negotiated =
			typeof requested === 'string' && LEGACY_PROTOCOL_VERSIONS.includes(requested)
				? requested
				: LEGACY_PROTOCOL_VERSIONS[0]!;
		return resultResponse(id, {
			protocolVersion: negotiated,
			capabilities: { tools: {} },
			serverInfo: implementation(),
			instructions: INSTRUCTIONS,
		});
	};

	const discover = (id: JsonRpcId): JsonRpcResponse =>
		resultResponse(id, {
			resultType: 'complete',
			supportedVersions: [MODERN_PROTOCOL_VERSION],
			capabilities: { tools: {} },
			instructions: INSTRUCTIONS,
			_meta: { [META_SERVER_INFO]: implementation() },
		});

	const dispatch = (
		id: JsonRpcId,
		method: string,
		params: Record<string, unknown>,
		era: Era,
	): JsonRpcResponse => {
		switch (method) {
			case 'initialize':
				return initialize(id, params);
			case 'server/discover':
				return discover(id);
			case 'ping':
				return ok(id, era, {});
			case 'tools/list':
				// No pagination: four tools fit in one page, so `nextCursor` is
				// always absent and any `cursor` the client sends is honoured by
				// returning the whole list, which is the only page there is.
				return ok(id, era, listTools());
			case 'tools/call':
				return callTool(id, era, params);
			default:
				return errorResponse(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
		}
	};

	const handleMessage = (message: unknown): JsonRpcResponse | null => {
		try {
			if (Array.isArray(message)) {
				// JSON-RPC batching was removed from MCP in revision 2025-06-18 and
				// does not exist in the modern revisions at all.
				return errorResponse(
					null,
					INVALID_REQUEST,
					'Batched JSON-RPC requests are not supported; send one message per line.',
				);
			}
			if (!isPlainObject(message)) {
				return errorResponse(
					null,
					INVALID_REQUEST,
					'A message must be a JSON object.',
				);
			}

			const rawId = message['id'];
			// No id at all = a notification. JSON-RPC forbids replying to one, so
			// unknown notifications are dropped rather than answered — a client
			// that sends notifications/initialized, /cancelled or /progress gets
			// silence, which is correct for all three.
			if (rawId === undefined) return null;

			if (rawId !== null && typeof rawId !== 'string' && typeof rawId !== 'number') {
				return errorResponse(null, INVALID_REQUEST, 'Request "id" must be a string or a number.');
			}
			// MCP narrows JSON-RPC here: an id MUST NOT be null.
			if (rawId === null) {
				return errorResponse(null, INVALID_REQUEST, 'Request "id" must not be null.');
			}
			const id: JsonRpcId = rawId;

			if (message['jsonrpc'] !== '2.0') {
				return errorResponse(id, INVALID_REQUEST, 'Expected "jsonrpc": "2.0".');
			}
			const method = message['method'];
			if (typeof method !== 'string') {
				return errorResponse(id, INVALID_REQUEST, 'Request "method" must be a string.');
			}

			const rawParams = message['params'];
			if (rawParams !== undefined && rawParams !== null && !isPlainObject(rawParams)) {
				return errorResponse(id, INVALID_PARAMS, 'Request "params" must be an object.');
			}
			const params = isPlainObject(rawParams) ? rawParams : {};

			const meta = isPlainObject(params['_meta']) ? params['_meta'] : undefined;
			const declared = meta?.[META_PROTOCOL_VERSION];
			if (declared === undefined) {
				return dispatch(id, method, params, 'legacy');
			}
			if (typeof declared !== 'string') {
				return errorResponse(
					id,
					INVALID_PARAMS,
					`_meta["${META_PROTOCOL_VERSION}"] must be a string.`,
				);
			}
			if (declared !== MODERN_PROTOCOL_VERSION) {
				// The client asked, in modern form, for a revision this server does
				// not speak in modern form. Naming what is supported is what lets it
				// retry rather than fail. `io.modelcontextprotocol/clientCapabilities`
				// is deliberately NOT enforced: the specification requires it, but no
				// tool here needs any client capability, so rejecting a request for
				// omitting it would break clients to prove a point.
				return errorResponse(
					id,
					UNSUPPORTED_PROTOCOL_VERSION,
					'Unsupported protocol version',
					{ supported: [MODERN_PROTOCOL_VERSION], requested: declared },
				);
			}
			return dispatch(id, method, params, 'modern');
		} catch (err) {
			// Last line of defence. A server that dies takes the user's session
			// with it, so every path out of here is a response.
			return errorResponse(
				null,
				INTERNAL_ERROR,
				`Internal error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	const handleLine = (line: string): JsonRpcResponse | null => {
		const trimmed = line.trim();
		if (trimmed.length === 0) return null;
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch (err) {
			return errorResponse(
				null,
				PARSE_ERROR,
				`Parse error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return handleMessage(parsed);
	};

	return { languages: registry.enabled, handleMessage, handleLine };
}
