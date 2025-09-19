import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GithubClientError, fetchGithubProfile, PROFILE_QUERY_KEY} from '../github';

describe('fetchGithubProfile', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('returns a normalized profile payload', async () => {
		const response = new Response(
			JSON.stringify({login: 'octocat', name: 'The Octocat', avatar_url: 'octo.png', html_url: 'https://github.com/octocat'})
		);
		globalThis.fetch = vi.fn().mockResolvedValue(response);

		const profile = await fetchGithubProfile('token-123');

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/github/me', {
			headers: {
				Authorization: 'Bearer token-123',
				Accept: 'application/json'
			},
			signal: undefined
		});
		expect(profile).toEqual({login: 'octocat', name: 'The Octocat', avatarUrl: 'octo.png', htmlUrl: 'https://github.com/octocat'});
	});

	it('throws GithubClientError for 401 responses', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', {status: 401}));

		const promise = fetchGithubProfile('expired-token');
		await expect(promise).rejects.toBeInstanceOf(GithubClientError);
		await expect(promise).rejects.toMatchObject({status: 401});
	});

	it('throws GithubClientError for other errors with response text', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('Something went wrong', {status: 502}));

		const promise = fetchGithubProfile('token');
		await expect(promise).rejects.toBeInstanceOf(GithubClientError);
		await expect(promise).rejects.toMatchObject({status: 502, message: 'Something went wrong'});
	});
});

describe('PROFILE_QUERY_KEY', () => {
	it('is stable for cache lookups', () => {
		expect(PROFILE_QUERY_KEY).toEqual(['github', 'profile']);
	});
});
