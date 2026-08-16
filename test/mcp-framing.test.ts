/**
 * Newline framing for the stdio transport.
 *
 * A chunk from the OS has nothing to do with a message boundary: a large scan
 * request arrives in dozens of pieces, and small ones arrive glued together.
 * This is the part of a hand-rolled transport that breaks, so it is tested
 * apart from the process that uses it.
 */

import { describe, expect, it } from 'vitest';
import { MAX_LINE_CHARS, createLineSplitter } from '../src/mcp/framing.js';

describe('mcp line framing', () => {
	it('splits one chunk holding several messages', () => {
		expect(createLineSplitter().push('a\nb\nc\n')).toEqual(['a', 'b', 'c']);
	});

	it('holds a partial line until its newline arrives', () => {
		const lines = createLineSplitter();
		expect(lines.push('{"jsonrpc"')).toEqual([]);
		expect(lines.push(':"2.0"')).toEqual([]);
		expect(lines.push('}\n')).toEqual(['{"jsonrpc":"2.0"}']);
	});

	it('reassembles a message split one character at a time', () => {
		const lines = createLineSplitter();
		const message = '{"jsonrpc":"2.0","id":1,"method":"ping"}';
		const out: string[] = [];
		for (const char of `${message}\n`) out.push(...lines.push(char));
		expect(out).toEqual([message]);
	});

	it('emits complete lines and keeps the tail from the same chunk', () => {
		const lines = createLineSplitter();
		expect(lines.push('one\ntwo\nthr')).toEqual(['one', 'two']);
		expect(lines.push('ee\n')).toEqual(['three']);
	});

	it('preserves empty lines rather than swallowing them', () => {
		// handleLine ignores blank input; the splitter should not decide that.
		expect(createLineSplitter().push('a\n\nb\n')).toEqual(['a', '', 'b']);
	});

	it('keeps a stray carriage return for handleLine to trim', () => {
		expect(createLineSplitter().push('a\r\n')).toEqual(['a\r']);
	});

	it('flushes a final message that has no trailing newline', () => {
		const lines = createLineSplitter();
		expect(lines.push('done')).toEqual([]);
		expect(lines.flush()).toBe('done');
		expect(lines.flush()).toBe('');
	});

	it('discards a line that never ends, and says so once', () => {
		const lines = createLineSplitter(64);
		expect(lines.push('x'.repeat(65))).toEqual([]);
		expect(lines.overflowed()).toBe(true);
		// The flag is per-push, not sticky: the next chunk starts clean.
		expect(lines.push('ok\n')).toEqual(['ok']);
		expect(lines.overflowed()).toBe(false);
	});

	it('does not trip the ceiling on a long but terminated line', () => {
		const lines = createLineSplitter(64);
		expect(lines.push(`${'x'.repeat(60)}\n${'y'.repeat(60)}\n`)).toHaveLength(2);
		expect(lines.overflowed()).toBe(false);
	});

	it('defaults the ceiling well above any plausible message', () => {
		expect(MAX_LINE_CHARS).toBe(32 * 1024 * 1024);
	});
});
