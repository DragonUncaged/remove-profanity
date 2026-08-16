/**
 * Newline framing for the stdio transport.
 *
 * Separated from `stdio.ts` so it can be tested without a child process. It is
 * the one part of a hand-rolled transport that reliably breaks: a chunk from
 * the OS has nothing to do with a message boundary, so a 2 MB scan request
 * arrives in dozens of pieces and a small one can arrive glued to the next
 * three.
 */

/**
 * A line longer than this is treated as a stuck stream rather than a message:
 * the buffer is dropped and the caller is told. Without a ceiling, a peer that
 * never sends a newline grows the buffer until the process dies — the one
 * outcome this server is required not to have.
 */
export const MAX_LINE_CHARS = 32 * 1024 * 1024;

export interface LineSplitter {
	/** Complete lines in `chunk`, with any partial tail held for next time. */
	push(chunk: string): string[];
	/** Whatever is left when the stream ends; '' when the tail was empty. */
	flush(): string;
	/**
	 * True when the held tail just exceeded `MAX_LINE_CHARS` and was discarded.
	 * Checked after `push`, so the caller can report a parse error.
	 */
	overflowed(): boolean;
}

export function createLineSplitter(maxLineChars = MAX_LINE_CHARS): LineSplitter {
	let buffer = '';
	let overflow = false;

	return {
		push(chunk: string): string[] {
			overflow = false;
			buffer += chunk;
			const lines: string[] = [];
			let newline = buffer.indexOf('\n');
			while (newline >= 0) {
				lines.push(buffer.slice(0, newline));
				buffer = buffer.slice(newline + 1);
				newline = buffer.indexOf('\n');
			}
			if (buffer.length > maxLineChars) {
				buffer = '';
				overflow = true;
			}
			return lines;
		},
		flush(): string {
			const tail = buffer;
			buffer = '';
			return tail;
		},
		overflowed(): boolean {
			return overflow;
		},
	};
}
