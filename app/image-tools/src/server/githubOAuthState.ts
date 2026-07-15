const CANONICAL_APP_ORIGIN = 'https://token-assets.yearn.fi';
const TRUSTED_PREVIEW_HOSTS = new Set(['dev-vm.tail197cc7.ts.net']);
const STATE_TTL_MS = 10 * 60 * 1000;
const NONCE_PATTERN = /^[a-z0-9]{20,80}$/i;

type OAuthStatePayload = {
	nonce: string;
	returnTo: string;
	expiresAt: number;
};

export function resolveOAuthReturnTo(value: string | null, additionalOrigins = ''): string {
	const candidate = new URL(value || CANONICAL_APP_ORIGIN);
	const configuredOrigins = additionalOrigins
		.split(',')
		.map(origin => origin.trim())
		.filter(Boolean)
		.map(origin => new URL(origin).origin);
	const isCanonical = candidate.origin === CANONICAL_APP_ORIGIN;
	const isConfigured = configuredOrigins.includes(candidate.origin);
	const isTrustedPreview =
		candidate.protocol === 'https:' &&
		TRUSTED_PREVIEW_HOSTS.has(candidate.hostname) &&
		!candidate.username &&
		!candidate.password;

	if (!isCanonical && !isConfigured && !isTrustedPreview) {
		throw new Error('Untrusted OAuth return URL');
	}

	return candidate.origin;
}

export async function createOAuthState(
	nonce: string,
	returnTo: string,
	secret: string,
	now = Date.now()
): Promise<string> {
	if (!NONCE_PATTERN.test(nonce)) throw new Error('Invalid OAuth state nonce');
	const payload: OAuthStatePayload = {nonce, returnTo, expiresAt: now + STATE_TTL_MS};
	const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	const signature = await sign(encodedPayload, secret);
	return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

export async function readOAuthState(state: string, secret: string, now = Date.now()): Promise<OAuthStatePayload> {
	const [encodedPayload, encodedSignature, ...rest] = state.split('.');
	if (!encodedPayload || !encodedSignature || rest.length) throw new Error('Invalid OAuth state');

	const key = await importSigningKey(secret);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		decodeBase64Url(encodedSignature),
		new TextEncoder().encode(encodedPayload)
	);
	if (!valid) throw new Error('Invalid OAuth state signature');

	const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as OAuthStatePayload;
	if (!NONCE_PATTERN.test(payload.nonce)) throw new Error('Invalid OAuth state nonce');
	if (!payload.returnTo || !Number.isFinite(payload.expiresAt) || payload.expiresAt < now) {
		throw new Error('Expired OAuth state');
	}
	return payload;
}

export async function readOAuthStateWithLegacyProductionFallback(
	state: string,
	secret: string,
	now = Date.now()
): Promise<OAuthStatePayload> {
	if (NONCE_PATTERN.test(state)) {
		return {nonce: state, returnTo: CANONICAL_APP_ORIGIN, expiresAt: now};
	}
	return readOAuthState(state, secret, now);
}

async function sign(value: string, secret: string): Promise<ArrayBuffer> {
	return crypto.subtle.sign('HMAC', await importSigningKey(secret), new TextEncoder().encode(value));
}

function importSigningKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(`token-assets-oauth-state:${secret}`),
		{name: 'HMAC', hash: 'SHA-256'},
		false,
		['sign', 'verify']
	);
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array): string {
	const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
	const padded = value
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
}
