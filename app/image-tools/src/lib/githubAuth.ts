export const TOKEN_STORAGE_KEY = 'github_token';
export const AUTH_STATE_STORAGE_KEY = 'auth_state';
export const AUTH_CHANGE_EVENT = 'github-auth-changed';
export const AUTH_PENDING_STORAGE_KEY = 'github_oauth_pending';
const DEFAULT_OAUTH_BROKER_ORIGIN = 'https://token-assets.yearn.fi';

type GithubOAuthCompletionDependencies = {
	readStoredState: () => string | null;
	readAuthPending: () => boolean;
	storeAuthToken: (token: string) => void;
	clearStoredState: () => void;
	clearAuthPending: () => void;
	broadcastAuthChange: () => void;
};

export type GithubOAuthCompletionResult = {ok: true} | {ok: false; error: string};

export function createGithubOAuthNonce(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function buildAuthorizeUrl(
	state: string,
	returnTo = window.location.origin,
	brokerOrigin = process.env.NEXT_PUBLIC_GITHUB_OAUTH_BROKER_ORIGIN || DEFAULT_OAUTH_BROKER_ORIGIN
) {
	const url = new URL('/api/auth/github/start', brokerOrigin);
	url.searchParams.set('state', state);
	url.searchParams.set('returnTo', returnTo);
	return url.toString();
}

export function readStoredToken(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return sessionStorage.getItem(TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function storeAuthState(state: string) {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, state);
	} catch {}
}

export function readStoredState(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return sessionStorage.getItem(AUTH_STATE_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function storeAuthToken(token: string) {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
	} catch {}
}

export function clearStoredState() {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
	} catch {}
}

export function clearStoredAuth() {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(TOKEN_STORAGE_KEY);
		sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
	} catch {}
}

export function readAuthPending(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return sessionStorage.getItem(AUTH_PENDING_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export function markAuthPending() {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_PENDING_STORAGE_KEY, 'true');
	} catch {}
}

export function clearAuthPending() {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_PENDING_STORAGE_KEY);
	} catch {}
}

export function broadcastAuthChange() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
	try {
		window.dispatchEvent(new StorageEvent('storage', {key: TOKEN_STORAGE_KEY}));
	} catch {}
}

export function completeGithubOAuthSignIn(
	fragment: string,
	dependencies: GithubOAuthCompletionDependencies = {
		readStoredState,
		readAuthPending,
		storeAuthToken,
		clearStoredState,
		clearAuthPending,
		broadcastAuthChange
	}
): GithubOAuthCompletionResult {
	try {
		if (!dependencies.readAuthPending()) {
			return {ok: false, error: 'No GitHub sign-in attempt is pending. Please start sign-in again.'};
		}
		if (!fragment.startsWith('#')) {
			return {ok: false, error: 'GitHub returned an invalid sign-in response. Please try again.'};
		}

		const params = new URLSearchParams(fragment.slice(1));
		const token = params.get('token');
		const returnedState = params.get('state');
		const storedState = dependencies.readStoredState();

		if (!token) {
			return {ok: false, error: 'GitHub did not return an access token. Please try again.'};
		}
		if (!returnedState || !storedState || returnedState !== storedState) {
			return {ok: false, error: 'GitHub sign-in could not be verified. Please start sign-in again.'};
		}

		dependencies.storeAuthToken(token);
		dependencies.broadcastAuthChange();
		return {ok: true};
	} finally {
		dependencies.clearAuthPending();
		dependencies.clearStoredState();
	}
}
