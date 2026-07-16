import {describe, expect, test} from 'bun:test';
import {createOAuthState, readOAuthState, resolveOAuthReturnTo} from './githubOAuthState';

const SECRET = 'test-client-secret';
const NOW = 1_800_000_000_000;
const NONCE = 'abcdefghijklmnopqrst';

describe('GitHub OAuth state', () => {
	test('round trips a signed state payload', async () => {
		const state = await createOAuthState(NONCE, 'https://dev-vm.tail197cc7.ts.net:8446', SECRET, NOW);
		const payload = await readOAuthState(state, SECRET, NOW + 1_000);

		expect(payload).toEqual({
			nonce: NONCE,
			returnTo: 'https://dev-vm.tail197cc7.ts.net:8446',
			expiresAt: NOW + 10 * 60 * 1_000
		});
	});

	test('accepts canonical, trusted preview, and configured exact origins', () => {
		expect(resolveOAuthReturnTo('https://token-assets.yearn.fi/path')).toBe('https://token-assets.yearn.fi');
		expect(resolveOAuthReturnTo('https://dev-vm.tail197cc7.ts.net:8446/path')).toBe(
			'https://dev-vm.tail197cc7.ts.net:8446'
		);
		expect(resolveOAuthReturnTo('http://localhost:3000/path', 'http://localhost:3000')).toBe(
			'http://localhost:3000'
		);
	});

	test('rejects unapproved origins and expired or tampered state', async () => {
		expect(() => resolveOAuthReturnTo('https://attacker.example')).toThrow('Untrusted OAuth return URL');
		const state = await createOAuthState(NONCE, 'https://token-assets.yearn.fi', SECRET, NOW);
		await expect(readOAuthState(state, SECRET, NOW + 11 * 60 * 1_000)).rejects.toThrow('Expired OAuth state');
		await expect(readOAuthState(`${state}x`, SECRET, NOW)).rejects.toThrow('Invalid OAuth state signature');
	});

	test('rejects the legacy unsigned production state', async () => {
		await expect(readOAuthState(NONCE, SECRET, NOW)).rejects.toThrow('Invalid OAuth state');
	});
});
