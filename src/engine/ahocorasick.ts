/**
 * Classic Aho-Corasick automaton over UTF-16 code units.
 *
 * The trie is built with per-node `Map<charCode, node>` children, then
 * compiled — states renumbered in BFS order, failure and output links
 * resolved — into typed arrays that the scan reads and nothing else:
 *
 *   - `symOf[code]` compresses the alphabet to the code units that occur in
 *     some pattern (symbol 0 = "in no pattern", which always leads to ROOT);
 *   - `dense[state * S + sym]` is the COMPLETE transition function
 *     (goto with failure already resolved) for the `denseStates` shallowest
 *     states — root and everything within `DENSE_DEPTH` of it. Ordinary text
 *     keeps the automaton within a step or two of the root (measured on the
 *     20k-word ASCII benchmark row with all packs loaded: depth 0/1/2/3 for
 *     22/49/24/5% of characters), so nearly every step is one typed-array
 *     read. A full table for all states would be ~8 MB per matcher; this is
 *     ~300 KB for the exact automaton;
 *   - deeper states keep only their trie edges, in one open-addressing hash
 *     keyed by `state * S + sym`, and follow `fail` on a miss until a dense
 *     state answers.
 *
 * `findAll` reports ALL occurrences of ALL patterns, including overlapping
 * ones, by following output links at every visited node.
 */

import { codeUnitAt, stringToCodeUnits } from '../unicode/code-units.js';

export interface AcMatch {
	/** Start index into the searched text (UTF-16 code units). */
	start: number;
	/** End index, exclusive. */
	end: number;
	/** Index into the patterns array passed to the constructor. */
	patternId: number;
}

const ROOT = 0;
/** States at this depth or less get a dense, fail-resolved transition row. */
const DENSE_DEPTH = 2;
const EMPTY = -1;

export class AhoCorasick {
	/** Pattern lengths in UTF-16 code units, indexed by patternId. */
	private readonly patternLengths: number[];
	/** The longest pattern, in code units (0 when there are none). */
	readonly maxPatternLength: number;
	/** terminal[n] = ids of patterns that end exactly at node n. */
	private readonly terminal: number[][];
	/**
	 * out[n] = nearest node on n's failure chain (excluding n itself) that is
	 * terminal, or ROOT when there is none. Following these links from any
	 * visited node yields every pattern ending at the current text position.
	 */
	private readonly out: Int32Array;
	/** fail[n] = longest proper suffix of n's path that is also a trie path. */
	private readonly fail: Int32Array;
	/** 1 when the node is terminal or has an output link — emit at this node. */
	private readonly emits: Uint8Array;
	/** Code unit → symbol; codes ≥ symOf.length are symbol 0 too. */
	private readonly symOf: Uint16Array;
	private readonly symbolCount: number;
	/** States [0, denseStates) have a full row in `dense`. */
	private readonly denseStates: number;
	private readonly dense: Int32Array;
	/** Open-addressing hash of the deep states' trie edges. */
	private readonly edgeKeys: Int32Array;
	private readonly edgeNext: Int32Array;
	private readonly edgeMask: number;
	/** 32 − log2(table size): Fibonacci hashing keeps the top bits. */
	private readonly edgeShift: number;

	constructor(patterns: string[]) {
		this.patternLengths = patterns.map((p) => p.length);
		let maxLen = 0;
		for (const p of patterns) if (p.length > maxLen) maxLen = p.length;
		this.maxPatternLength = maxLen;

		const children: Map<number, number>[] = [new Map()];
		const terminalOf: number[][] = [[]];
		const symbolOfCode = new Map<number, number>();
		let maxCode = -1;
		for (let pid = 0; pid < patterns.length; pid++) {
			const pattern = patterns[pid]!;
			// An empty pattern would "end" at the root before consuming any
			// input; it can never produce a meaningful span, so it is ignored.
			if (pattern.length === 0) continue;
			let node = ROOT;
			const len = pattern.length;
			for (let i = 0; i < len; i++) {
				const code = codeUnitAt(pattern, i);
				let next = children[node]!.get(code);
				if (next === undefined) {
					next = children.length;
					children.push(new Map());
					terminalOf.push([]);
					children[node]!.set(code, next);
					if (!symbolOfCode.has(code)) {
						symbolOfCode.set(code, symbolOfCode.size + 1); // 0 = in no pattern
						if (code > maxCode) maxCode = code;
					}
				}
				node = next;
			}
			terminalOf[node]!.push(pid);
		}

		// Failure and output links are resolved on the trie ids, before the
		// renumbering below.
		const total = children.length;
		const order: number[] = [ROOT];
		const depthOf = new Int32Array(total);
		const failOf = new Int32Array(total);
		const outOf = new Int32Array(total);
		for (let head = 0; head < order.length; head++) {
			const node = order[head]!;
			// BFS: failOf[node] was set when node's parent was processed, and
			// it is strictly shallower than node, so its output link is final.
			const failNode = failOf[node]!;
			outOf[node] =
				node !== ROOT && terminalOf[failNode]!.length > 0 ? failNode : outOf[failNode]!;
			for (const [code, child] of children[node]!) {
				depthOf[child] = depthOf[node]! + 1;
				let f = failNode;
				while (f !== ROOT && !children[f]!.has(code)) f = failOf[f]!;
				const viaFail = children[f]!.get(code);
				failOf[child] = node === ROOT || viaFail === undefined ? ROOT : viaFail;
				order.push(child);
			}
		}
		// New ids in BFS order, so "depth ≤ DENSE_DEPTH" is "id < denseStates".
		const newId = new Int32Array(total);
		for (let i = 0; i < total; i++) newId[order[i]!] = i;

		const symOf = new Uint16Array(maxCode + 1);
		for (const [code, sym] of symbolOfCode) symOf[code] = sym;
		const S = symbolOfCode.size + 1;

		// The arrays the scan reads, indexed by new id.
		const fail = new Int32Array(total);
		const out = new Int32Array(total);
		const terminal: number[][] = new Array<number[]>(total);
		const emits = new Uint8Array(total);
		for (let i = 0; i < total; i++) {
			const old = order[i]!;
			fail[i] = newId[failOf[old]!]!;
			out[i] = newId[outOf[old]!]!;
			terminal[i] = terminalOf[old]!;
			emits[i] = terminalOf[old]!.length > 0 || outOf[old] !== ROOT ? 1 : 0;
		}

		// dense[s][sym] = the COMPLETE transition: the child on that code, else
		// the transition of fail[s] on it — well-defined in BFS order because
		// fail[s] is shallower than s and so already filled.
		let denseStates = 0;
		while (denseStates < total && depthOf[order[denseStates]!]! <= DENSE_DEPTH) denseStates++;
		const dense = new Int32Array(denseStates * S);
		for (let s = 0; s < denseStates; s++) {
			const row = s * S;
			if (s !== ROOT) {
				const failRow = fail[s]! * S;
				dense.copyWithin(row, failRow, failRow + S);
			}
			for (const [code, child] of children[order[s]!]!) dense[row + symOf[code]!] = newId[child]!;
		}

		let deepEdges = 0;
		for (let s = denseStates; s < total; s++) deepEdges += children[order[s]!]!.size;
		let size = 16;
		let shift = 28;
		while (size < deepEdges * 2) {
			size *= 2;
			shift -= 1;
		}
		const edgeKeys = new Int32Array(size).fill(EMPTY);
		const edgeNext = new Int32Array(size);
		const mask = size - 1;
		for (let s = denseStates; s < total; s++) {
			for (const [code, child] of children[order[s]!]!) {
				const key = s * S + symOf[code]!;
				let h = hashKey(key, shift);
				while (edgeKeys[h] !== EMPTY) h = (h + 1) & mask;
				edgeKeys[h] = key;
				edgeNext[h] = newId[child]!;
			}
		}

		this.terminal = terminal;
		this.out = out;
		this.fail = fail;
		this.emits = emits;
		this.symOf = symOf;
		this.symbolCount = S;
		this.denseStates = denseStates;
		this.dense = dense;
		this.edgeKeys = edgeKeys;
		this.edgeNext = edgeNext;
		this.edgeMask = mask;
		this.edgeShift = shift;
	}

	/**
	 * Every occurrence of every pattern in `text`, overlapping included.
	 * Matches are emitted in order of their end index (then by decreasing
	 * pattern length at equal end positions, per output-link traversal).
	 */
	findAll(text: string): AcMatch[] {
		return this.findAllUnits(stringToCodeUnits(text), text.length);
	}

	/**
	 * `findAll` over the text's code units, `units[0 .. n)`. This is the form
	 * the matcher calls: it builds each pass's unit array once and runs every
	 * automaton and whole-token scan over it, so no per-character read here
	 * depends on which string representations the process has seen
	 * (`unicode/code-units.ts`).
	 */
	findAllUnits(units: Uint16Array, n: number): AcMatch[] {
		const matches: AcMatch[] = [];
		this.scanUnits(units, 0, n, ROOT, matches);
		return matches;
	}

	/**
	 * Scan `units[from, to)` starting in automaton state `state` (ROOT for a
	 * fresh scan), appending every match that ENDS inside the range to
	 * `sink`, and return the state after `to` — so a caller can scan a text
	 * in pieces and stop early, or scan a window: from ROOT, the automaton
	 * reports every occurrence that starts at or after `from`. Match order
	 * as `findAll`.
	 */
	scanUnits(units: Uint16Array, from: number, to: number, state: number, sink: AcMatch[]): number {
		const matches = sink;
		const { symOf, dense, denseStates, fail, emits, terminal, out, patternLengths } = this;
		const { edgeKeys, edgeNext, edgeMask, edgeShift } = this;
		const S = this.symbolCount;
		const symLimit = symOf.length;
		let node = state;
		for (let i = from; i < to; i++) {
			const code = units[i]!;
			const sym = code < symLimit ? symOf[code]! : 0;
			// Transition. A dense state answers in one read; a deep state
			// probes its edges and, on a miss, follows fail until a dense
			// state (or a deep state with the edge) answers.
			for (;;) {
				if (node < denseStates) {
					node = dense[node * S + sym]!;
					break;
				}
				const key = node * S + sym;
				let h = hashKey(key, edgeShift);
				let k = edgeKeys[h]!;
				while (k !== key && k !== EMPTY) {
					h = (h + 1) & edgeMask;
					k = edgeKeys[h]!;
				}
				if (k === key) {
					node = edgeNext[h]!;
					break;
				}
				node = fail[node]!;
			}
			if (emits[node] === 0) continue;

			// Emit patterns ending at this position: the current node first,
			// then every terminal node reachable via output links.
			for (
				let t = terminal[node]!.length > 0 ? node : out[node]!;
				t !== ROOT;
				t = out[t]!
			) {
				const pids = terminal[t]!;
				for (let k = 0; k < pids.length; k++) {
					const pid = pids[k]!;
					const end = i + 1;
					matches.push({
						start: end - patternLengths[pid]!,
						end,
						patternId: pid,
					});
				}
			}
		}
		return node;
	}
}

/** The automaton's start state, for `scanUnits`. */
export const AC_ROOT = ROOT;

/** Fibonacci hashing: the top `32 − shift` bits of key × 2^32/φ. */
function hashKey(key: number, shift: number): number {
	return Math.imul(key, 0x9e3779b1) >>> shift;
}
