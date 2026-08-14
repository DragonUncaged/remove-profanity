import { describe, it, expect } from 'vitest';
import { skeletonFold, skeletonKey } from '../src/folds/skeleton.js';

/** Assert every word in the group produces the same skeleton key. */
function expectConverge(words: string[]): void {
	const first = words[0]!;
	const key = skeletonKey(first);
	for (const word of words) {
		expect(skeletonKey(word), `${word} should converge with ${first}`).toBe(key);
	}
}

describe('skeletonKey — convergence', () => {
	it('bhenchod family converges', () => {
		expectConverge(['bhenchod', 'behenchod', 'bahanchod', 'bhainchod']);
	});

	it('madarchod family converges', () => {
		expectConverge(['madarchod', 'madharchod', 'maderchod']);
	});

	it('bhosdike family converges', () => {
		expectConverge(['bhosdike', 'bhosadike', 'bhosdiike']);
	});

	it('chutiya family converges', () => {
		expectConverge(['chutiya', 'chutia', 'chutya', 'chutiyaa']);
	});

	it('gandu family converges', () => {
		expectConverge(['gandu', 'gaandu', 'gandoo']);
	});

	it('digraph variants converge (zh/jh/j, kh/k, w/v, q/k, z/j)', () => {
		expectConverge(['zhagda', 'jhagda', 'jagda']);
		expectConverge(['khoon', 'kun']);
		expectConverge(['wada', 'vada']);
		expectConverge(['qatil', 'katil']);
		expectConverge(['zindagi', 'jindagi']);
	});

	it('ksh / kshh converge', () => {
		expectConverge(['kshatriya', 'kshhatriya']);
	});

	it('x expands to ks', () => {
		expectConverge(['xerox', 'kseroks']);
	});

	it('repeat runs collapse', () => {
		expectConverge(['bakwas', 'bakkkwas', 'baakwaas']);
		expectConverge(['chutiya', 'chutiyaaaa']);
	});
});

describe('skeletonKey — divergence', () => {
	it("chutney !== chutiya (the 'n' survives in the consonant skeleton)", () => {
		expect(skeletonKey('chutney')).not.toBe(skeletonKey('chutiya'));
	});

	it('gandhi/gandu MAY collide (allowed; handled by allowlists) — document current behavior', () => {
		// The spec explicitly permits this collision; this assertion only
		// documents that the current algorithm does collide here.
		expect(skeletonKey('gandhi')).toBe(skeletonKey('gandu'));
	});
});

describe('skeleton stages — word-initial rules', () => {
	it('drops h except word-initial', () => {
		// 'hindi' keeps its leading h …
		expect(skeletonKey('hindi').startsWith('h')).toBe(true);
		// … while medial h is dropped, so behen/bhen converge.
		expectConverge(['behen', 'bhen']);
	});

	it('drops vowels except word-initial (gandu→gnd, aand→and)', () => {
		expect(skeletonKey('gandu')).toBe('gnd');
		expect(skeletonKey('aand')).toBe('and');
	});
});

describe('skeleton stage 6 — charset and whitespace', () => {
	it('deletes non-[a-z ] characters', () => {
		expect(skeletonKey('gandu!!!')).toBe(skeletonKey('gandu'));
		expect(skeletonKey('gandu123')).toBe(skeletonKey('gandu'));
	});

	it('collapses whitespace runs to a single space', () => {
		expect(skeletonKey('saale   madarchod')).toBe(skeletonKey('saale madarchod'));
		expect(skeletonKey('saale madarchod')).toContain(' ');
		expect(skeletonKey('saale , madarchod')).toBe(skeletonKey('saale madarchod'));
	});

	it('empty input yields empty output and map', () => {
		expect(skeletonFold('')).toEqual({ output: '', map: [] });
	});
});

describe('skeletonFold — offset maps', () => {
	it('maps deletions correctly (gaandu → gnd)', () => {
		// g a a n d u  →  g(0) n(3) d(4)
		expect(skeletonFold('gaandu')).toEqual({ output: 'gnd', map: [0, 3, 4] });
	});

	it('maps expansions correctly (axe → aks, x expands to two units)', () => {
		// a x e → a(0) k(1) s(1); e dropped.
		expect(skeletonFold('axe')).toEqual({ output: 'aks', map: [0, 1, 1] });
	});

	it('maps digraph consumption to the token start (chutiya)', () => {
		// ch(0)→c→k, u dropped, t(3), i/y/a dropped.
		const { output, map } = skeletonFold('chutiya');
		expect(map).toHaveLength(output.length);
		expect(map[0]).toBe(0); // came from the 'ch' at index 0
		expect(map[output.length - 1]).toBe(3); // final consonant is the 't'
	});

	it('maps a two-word phrase back to original indices', () => {
		// 's a a l e ␣ m a d a r c h o d'
		//  0 1 2 3 4 5 6 7 8 9 ...
		const { output, map } = skeletonFold('saale madarchod');
		expect(output).toBe('sl mdrkd');
		expect(map).toEqual([0, 3, 5, 6, 8, 10, 11, 14]);
		// The skeleton of the second word maps back into 'madarchod'.
		const spaceAt = output.indexOf(' ');
		expect(map[spaceAt + 1]).toBe('saale '.length);
	});

	it('map always has one entry per output code unit', () => {
		for (const s of ['bhenchod', 'chutiyaaaa', 'saale   madarchod!', 'xx', '']) {
			const { output, map } = skeletonFold(s);
			expect(map).toHaveLength(output.length);
			for (const idx of map) {
				expect(idx).toBeGreaterThanOrEqual(0);
				expect(idx).toBeLessThan(Math.max(s.length, 1));
			}
		}
	});
});
