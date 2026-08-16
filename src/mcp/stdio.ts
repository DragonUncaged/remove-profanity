#!/usr/bin/env node
/**
 * The `remove-profanity-mcp` bin: the stdio binding, and nothing else.
 *
 * The transport is what the specification's stdio page describes — one
 * JSON-RPC message per line on stdin, one per line on stdout, never an
 * embedded newline (JSON.stringify escapes them, so this holds whatever the
 * input text contains), stderr free for diagnostics, and exit when stdin
 * closes. Every protocol decision lives in `server.ts`; this file moves bytes.
 *
 * This package has no `@types/node`, and adding one for a bin would put the
 * only entry in an otherwise empty dependency tree. The Node surface actually
 * used is a handful of `process` members, so it is declared locally instead —
 * the same convention the dictionary-sweep tests use for `node:fs`.
 */

import { parseArgs, USAGE } from './cli.js';
import { MAX_LINE_CHARS, createLineSplitter } from './framing.js';
import { createRegistry } from './packs.js';
import { SERVER_NAME, SERVER_VERSION, createMcpServer, type McpServer } from './server.js';

interface NodeReadable {
	setEncoding(encoding: string): void;
	on(event: 'data', listener: (chunk: string) => void): void;
	on(event: 'end', listener: () => void): void;
	on(event: 'error', listener: (err: unknown) => void): void;
	resume(): void;
}

interface NodeWritable {
	write(chunk: string): boolean;
	on(event: 'error', listener: (err: unknown) => void): void;
}

declare const process: {
	argv: string[];
	env: Record<string, string | undefined>;
	stdin: NodeReadable;
	stdout: NodeWritable;
	stderr: NodeWritable;
	exit(code?: number): never;
	exitCode: number | undefined;
};

function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function main(): void {
	const cli = parseArgs(process.argv.slice(2), process.env);
	if (cli.print !== undefined) {
		process.stdout.write(cli.print);
		return;
	}
	if (cli.error !== undefined) {
		process.stderr.write(`${cli.error}\n\n${USAGE}`);
		process.exitCode = 2;
		return;
	}

	let server: McpServer;
	try {
		// Build the matcher BEFORE the first request rather than inside it: the
		// eleven-pack construction is ~34 ms cold and a client's first tool call
		// should not pay for it. Doing it here, not lazily inside createMcpServer,
		// is also what makes a bad --languages fail loudly on stderr at startup.
		server = createMcpServer({ registry: createRegistry(cli.languages) });
	} catch (err) {
		process.stderr.write(`${messageOf(err)}\n`);
		process.exitCode = 2;
		return;
	}

	process.stderr.write(
		`${SERVER_NAME}-mcp ${SERVER_VERSION} ready on stdio; packs: ${server.languages.join(', ')}\n`,
	);

	// EPIPE on stdout means the client went away mid-write. Exiting quietly is
	// the right answer; an unhandled error event would print a stack trace over
	// a half-written message.
	process.stdout.on('error', () => {
		process.exit(0);
	});

	const emit = (response: unknown): void => {
		if (response === null) return;
		process.stdout.write(`${JSON.stringify(response)}\n`);
	};

	const lines = createLineSplitter();
	// setEncoding puts a StringDecoder in front of the stream, so a multi-byte
	// character split across two chunks is reassembled before it reaches us —
	// which matters when every other message is Devanagari.
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', (chunk: string) => {
		for (const line of lines.push(chunk)) emit(server.handleLine(line));
		if (lines.overflowed()) {
			emit({
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -32700,
					message: `Parse error: no newline within ${MAX_LINE_CHARS} characters; input discarded.`,
				},
			});
		}
	});
	process.stdin.on('error', (err: unknown) => {
		process.stderr.write(`stdin error: ${messageOf(err)}\n`);
		process.exit(1);
	});
	// A closed stdin is the portable shutdown signal, and the specification asks
	// servers to honour it so the client never has to escalate to a signal.
	process.stdin.on('end', () => {
		// A last message with no trailing newline is still a message.
		emit(server.handleLine(lines.flush()));
		process.exit(0);
	});
	process.stdin.resume();
}

main();
