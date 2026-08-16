/**
 * JSON-RPC 2.0 message shapes and the error codes MCP assigns meaning to.
 *
 * Hand-rolled rather than taken from `@modelcontextprotocol/sdk`: this package
 * advertises zero runtime dependencies on the README, in the npm description
 * and in the comparison table, and the SDK would falsify that for every
 * consumer — including the overwhelming majority who never run the server.
 * The stdio binding is one newline-delimited JSON object per message, which is
 * a small enough surface to own outright.
 *
 * `src/mcp/` sits ABOVE `src/index.ts` in the dependency graph: it may import
 * the library, and nothing in `src/` outside this directory may import it. The
 * server is therefore inert for anyone who does not run the bin. `docs/mcp.md`
 * is the manual.
 */

/** MCP narrows JSON-RPC: an id MUST be a string or an integer, never null. */
export type JsonRpcId = string | number;

export interface JsonRpcErrorObject {
	code: number;
	message: string;
	data?: unknown;
}

export interface JsonRpcResultResponse {
	jsonrpc: '2.0';
	id: JsonRpcId;
	result: Record<string, unknown>;
}

export interface JsonRpcErrorResponse {
	jsonrpc: '2.0';
	/** null only where the request id could not be read at all. */
	id: JsonRpcId | null;
	error: JsonRpcErrorObject;
}

export type JsonRpcResponse = JsonRpcResultResponse | JsonRpcErrorResponse;

// Standard JSON-RPC 2.0 codes.
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

/**
 * MCP-specific, from the `-32020…-32099` block the specification reserves for
 * itself. Only this one is reachable here: the server declares no required
 * client capability, so `MissingRequiredClientCapability` (-32021) can never
 * fire, and `HeaderMismatch` (-32020) is HTTP-only.
 */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

export function errorResponse(
	id: JsonRpcId | null,
	code: number,
	message: string,
	data?: unknown,
): JsonRpcErrorResponse {
	const error: JsonRpcErrorObject = { code, message };
	if (data !== undefined) error.data = data;
	return { jsonrpc: '2.0', id, error };
}

export function resultResponse(
	id: JsonRpcId,
	result: Record<string, unknown>,
): JsonRpcResultResponse {
	return { jsonrpc: '2.0', id, result };
}

/** True for a non-null, non-array object — what `params` and `_meta` must be. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
