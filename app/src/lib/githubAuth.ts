const OAUTH_STATE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const TOKEN_STORAGE_KEY = 'github_token';
export const AUTH_STATE_STORAGE_KEY = 'auth_state';
export const AUTH_CHANGE_EVENT = 'github-auth-changed';
export const AUTH_PENDING_STORAGE_KEY = 'github_oauth_pending';
export const AUTH_ERROR_STORAGE_KEY = 'github_oauth_error';

export function buildAuthorizeUrl(clientId: string, state: string) {
	const url = new URL('https://github.com/login/oauth/authorize');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('state', state);
	url.searchParams.set('scope', 'public_repo');
	return url.toString();
}

export function createOAuthState(length = 32) {
	if (length <= 0) return '';
	const alphabet = OAUTH_STATE_ALPHABET;
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const randomValues = new Uint8Array(length);
		crypto.getRandomValues(randomValues);
		let out = '';
		for (let i = 0; i < length; i++) {
			out += alphabet[randomValues[i] % alphabet.length];
		}
		return out;
	}
	// Legacy fallback using Math.random (not cryptographically strong)
	let fallback = '';
	for (let i = 0; i < length; i++) {
		fallback += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return fallback;
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

export function storeAuthError(message: string) {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, message);
	} catch {}
}

export function readAuthError(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function clearAuthError() {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
	} catch {}
}

export function broadcastAuthChange() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
	try {
		window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_STORAGE_KEY }));
	} catch {}
}
