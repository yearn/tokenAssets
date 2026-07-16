import {describe, expect, test} from 'bun:test';
import {completeGithubOAuthSignIn, createGithubOAuthNonce} from './githubAuth';

describe('GitHub OAuth completion', () => {
	test('stores a fragment token only for a pending flow with matching state', () => {
		const auth = createTestAuth({pending: true, storedState: 'expected-state'});
		const result = completeGithubOAuthSignIn('#token=github-token&state=expected-state', auth.dependencies);

		expect(result).toEqual({ok: true});
		expect(auth.storedTokens).toEqual(['github-token']);
		expect(auth.broadcasts).toBe(1);
		expect(auth.clearedPending).toBe(1);
		expect(auth.clearedState).toBe(1);
	});

	test('missing state never stores a token', () => {
		const auth = createTestAuth({pending: true, storedState: 'expected-state'});
		const result = completeGithubOAuthSignIn('#token=attacker-token', auth.dependencies);

		expect(result).toEqual({
			ok: false,
			error: 'GitHub sign-in could not be verified. Please start sign-in again.'
		});
		expect(auth.storedTokens).toEqual([]);
	});

	test('mismatched state never stores a token', () => {
		const auth = createTestAuth({pending: true, storedState: 'expected-state'});
		const result = completeGithubOAuthSignIn('#token=attacker-token&state=wrong-state', auth.dependencies);

		expect(result.ok).toBe(false);
		expect(auth.storedTokens).toEqual([]);
	});

	test('a matching state without a pending sign-in never stores a token', () => {
		const auth = createTestAuth({pending: false, storedState: 'expected-state'});
		const result = completeGithubOAuthSignIn('#token=attacker-token&state=expected-state', auth.dependencies);

		expect(result).toEqual({
			ok: false,
			error: 'No GitHub sign-in attempt is pending. Please start sign-in again.'
		});
		expect(auth.storedTokens).toEqual([]);
	});

	test('query-string token and state are not accepted', () => {
		const auth = createTestAuth({pending: true, storedState: 'expected-state'});
		const result = completeGithubOAuthSignIn('?token=attacker-token&state=expected-state', auth.dependencies);

		expect(result.ok).toBe(false);
		expect(auth.storedTokens).toEqual([]);
	});
});

test('OAuth nonce uses a 160-bit browser crypto value encoded as hex', () => {
	const first = createGithubOAuthNonce();
	const second = createGithubOAuthNonce();

	expect(first).toMatch(/^[a-f0-9]{40}$/);
	expect(second).toMatch(/^[a-f0-9]{40}$/);
	expect(second).not.toBe(first);
});

function createTestAuth({pending, storedState}: {pending: boolean; storedState: string | null}) {
	const state = {
		storedTokens: [] as string[],
		broadcasts: 0,
		clearedPending: 0,
		clearedState: 0
	};

	return {
		get storedTokens() {
			return state.storedTokens;
		},
		get broadcasts() {
			return state.broadcasts;
		},
		get clearedPending() {
			return state.clearedPending;
		},
		get clearedState() {
			return state.clearedState;
		},
		dependencies: {
			readStoredState: () => storedState,
			readAuthPending: () => pending,
			storeAuthToken: (token: string) => state.storedTokens.push(token),
			clearStoredState: () => {
				state.clearedState += 1;
			},
			clearAuthPending: () => {
				state.clearedPending += 1;
			},
			broadcastAuthChange: () => {
				state.broadcasts += 1;
			}
		}
	};
}
