/**
 * The bin, end to end: a real child process, real pipes, real newline framing.
 *
 * Everything about what a response SAYS is tested in `test/mcp-server.test.ts`
 * against the handler directly, because a failure there should name the rule
 * that broke rather than "the client did not connect". What is left for this
 * file is what only a process can prove: that the shebang survived the build,
 * that startup writes nothing to stdout, that stdout carries one JSON message
 * per line and nothing else, that a closed stdin ends the process, and that a
 * malformed line does not.
 *
 * Skipped when `dist/` has not been built — `npm test` runs before
 * `npm run build` in the acceptance gate, so a fresh checkout has no bin yet.
 */

import { describe, expect, it } from 'vitest';
// @ts-expect-error - see test/punjabi-gujarati-dictionary.test.ts: this package
// has no @types/node, and the functions used are re-typed below.
import { existsSync as rawExistsSync } from 'node:fs';
// @ts-expect-error - as above.
import { spawn as rawSpawn } from 'node:child_process';

const existsSync = rawExistsSync as (path: string) => boolean;

interface ChildStream {
	setEncoding(encoding: string): void;
	on(event: string, listener: (chunk: string) => void): void;
	write(chunk: string): void;
	end(): void;
}
interface Child {
	stdin: ChildStream;
	stdout: ChildStream;
	stderr: ChildStream;
	on(event: 'close', listener: (code: number | null) => void): void;
}
const spawn = rawSpawn as (
	command: string,
	args: string[],
	options: { stdio: string[] },
) => Child;

const BIN = 'dist/mcp/stdio.js';
const built = existsSync(BIN);

interface Run {
	stdout: string;
	stderr: string;
	code: number | null;
}

/** Send `input` to a fresh server process and collect everything it says. */
function run(input: string, args: string[] = []): Promise<Run> {
	return new Promise<Run>((resolve) => {
		// `process.execPath` is not typed here, and hard-coding `node` would test
		// whatever is on PATH rather than the interpreter running the suite —
		// but the shebang names `node`, so that is the honest thing to invoke.
		const child = spawn('node', [BIN, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('close', (code) => {
			resolve({ stdout, stderr, code: code as number | null });
		});
		child.stdin.write(input);
		child.stdin.end();
	});
}

const HANDSHAKE =
	'{"jsonrpc":"2.0","id":1,"method":"initialize","params":' +
	'{"protocolVersion":"2025-06-18","capabilities":{},' +
	'"clientInfo":{"name":"vitest","version":"1.0.0"}}}\n' +
	'{"jsonrpc":"2.0","method":"notifications/initialized"}\n';

function messages(stdout: string): Array<Record<string, unknown>> {
	const lines = stdout.split('\n').filter((line) => line.length > 0);
	return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe.skipIf(!built)('remove-profanity-mcp bin', () => {
	it('starts, handshakes, answers a tool call, and exits when stdin closes', async () => {
		const result = await run(
			`${HANDSHAKE}{"jsonrpc":"2.0","id":2,"method":"tools/call","params":` +
				'{"name":"check_text","arguments":{"text":"kya bh0sdike yaar"}}}\n',
		);
		expect(result.code).toBe(0);
		const out = messages(result.stdout);
		expect(out).toHaveLength(2);
		expect(out[0]!['id']).toBe(1);
		expect(out[1]!['id']).toBe(2);
		const structured = (out[1]!['result'] as Record<string, unknown>)[
			'structuredContent'
		] as Record<string, unknown>;
		expect(structured['clean']).toBe(false);
		expect(structured['matchCount']).toBe(1);
	});

	it('writes its startup banner to stderr, never to stdout', async () => {
		// The specification is absolute here: nothing may reach stdout that is not
		// a valid MCP message, and a stray banner desynchronizes every client.
		const result = await run(HANDSHAKE);
		expect(result.stderr).toContain('ready on stdio');
		expect(messages(result.stdout)).toHaveLength(1);
	});

	it('answers a notification with silence', async () => {
		const result = await run('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
		expect(result.stdout).toBe('');
		expect(result.code).toBe(0);
	});

	it('survives a malformed line and keeps serving the next one', async () => {
		const result = await run(
			`${HANDSHAKE}garbage {{{\n{"jsonrpc":"2.0","id":3,"method":"ping"}\n`,
		);
		expect(result.code).toBe(0);
		const out = messages(result.stdout);
		expect((out[1]!['error'] as Record<string, unknown>)['code']).toBe(-32700);
		expect(out[2]).toEqual({ jsonrpc: '2.0', id: 3, result: {} });
	});

	it('answers a final message that arrived without a trailing newline', async () => {
		const result = await run(`${HANDSHAKE}{"jsonrpc":"2.0","id":4,"method":"ping"}`);
		expect(messages(result.stdout)[1]).toEqual({ jsonrpc: '2.0', id: 4, result: {} });
	});

	it('emits one line per message, with no embedded newline in the payload', async () => {
		const result = await run(
			`${HANDSHAKE}{"jsonrpc":"2.0","id":5,"method":"tools/call","params":` +
				'{"name":"censor_text","arguments":{"text":"line one\\nbh0sdike\\nline three"}}}\n',
		);
		expect(result.stdout.split('\n').filter((l) => l.length > 0)).toHaveLength(2);
		const censored = (
			(messages(result.stdout)[1]!['result'] as Record<string, unknown>)[
				'structuredContent'
			] as Record<string, unknown>
		)['censored'];
		// The newlines survive the round trip as escaped `\n` inside the JSON.
		expect(censored).toBe('line one\n********\nline three');
	});

	it('narrows its packs from the command line', async () => {
		const result = await run(
			`${HANDSHAKE}{"jsonrpc":"2.0","id":6,"method":"tools/call","params":` +
				'{"name":"list_languages","arguments":{}}}\n',
			['--languages', 'hi,en'],
		);
		const structured = (messages(result.stdout)[1]!['result'] as Record<string, unknown>)[
			'structuredContent'
		] as Record<string, unknown>;
		expect(structured['defaultLanguages']).toEqual(['hi', 'en']);
	});

	it('refuses an unknown language on stderr and exits non-zero', async () => {
		const result = await run('', ['--languages', 'fr']);
		expect(result.code).toBe(2);
		expect(result.stdout).toBe('');
		expect(result.stderr).toContain('Unknown or disabled language "fr"');
	});

	it('prints usage to stdout for --help and exits 0', async () => {
		const result = await run('', ['--help']);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('check_text');
		expect(result.stdout).toContain('--languages');
	});
});
