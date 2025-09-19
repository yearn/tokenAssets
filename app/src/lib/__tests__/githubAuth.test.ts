import {describe, expect, it, vi, afterEach} from 'vitest';
import {createOAuthState} from '../githubAuth';

const ALPHABET = /^[a-zA-Z0-9]+$/;

describe('createOAuthState', () => {
	const originalMathRandom = Math.random;

	afterEach(() => {
		Math.random = originalMathRandom;
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('generates a state string using crypto.getRandomValues when available', () => {
		const getRandomValues = vi.fn((buffer: Uint8Array) => {
			buffer.set([1, 25, 52, 99]);
			return buffer;
		});
		vi.stubGlobal('crypto', {getRandomValues} as unknown as Crypto);

		const state = createOAuthState(4);

		expect(getRandomValues).toHaveBeenCalledTimes(1);
		expect(state).toHaveLength(4);
		expect(ALPHABET.test(state)).toBe(true);
	});

	it('falls back to Math.random when crypto is not available', () => {
		vi.stubGlobal('crypto', undefined as unknown as Crypto);
		const increments = [0.05, 0.1, 0.9, 0.2];
		let index = 0;
		Math.random = () => increments[index++ % increments.length];

		const state = createOAuthState(4);

		expect(state).toHaveLength(4);
		expect(ALPHABET.test(state)).toBe(true);
	});

	it('returns an empty string when length is zero or negative', () => {
		expect(createOAuthState(0)).toBe('');
		expect(createOAuthState(-10)).toBe('');
	});
});
