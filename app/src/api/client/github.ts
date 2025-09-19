export type GithubProfile = {
	login: string;
	name?: string | null;
	avatarUrl?: string | null;
	htmlUrl?: string | null;
};

export const PROFILE_QUERY_KEY = ['github', 'profile'] as const;

export class GithubClientError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'GithubClientError';
		this.status = status;
	}
}

export async function fetchGithubProfile(token: string, options?: { signal?: AbortSignal }): Promise<GithubProfile> {
	const res = await fetch('/api/auth/github/me', {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json'
		},
		signal: options?.signal
	});

	if (res.status === 401 || res.status === 403) {
		throw new GithubClientError('GitHub session expired. Please sign in again.', res.status);
	}

	if (!res.ok) {
		const text = await res.text();
		throw new GithubClientError(text || 'Failed to load GitHub profile.', res.status);
	}

	const data = (await res.json()) as {
		login: string;
		name?: string | null;
		avatarUrl?: string | null;
		avatar_url?: string | null;
		htmlUrl?: string | null;
		html_url?: string | null;
	};
	const avatarUrl = data.avatarUrl ?? data.avatar_url ?? null;
	const htmlUrl = data.htmlUrl ?? data.html_url ?? null;
	return {
		login: data.login,
		name: data.name ?? null,
		avatarUrl,
		htmlUrl
	};
}
