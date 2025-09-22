// Inlined environment variable reading
function readEnv(key: string): string | undefined {
	if (typeof process !== 'undefined' && process.env) {
		const raw = process.env[key];
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			return trimmed ? trimmed : undefined;
		}
	}
	return undefined;
}

const oauthDebugFlag = (readEnv('GITHUB_OAUTH_DEBUG') || '').toLowerCase();
const OAUTH_DEBUG = oauthDebugFlag ? ['1', 'true', 'on', 'yes'].includes(oauthDebugFlag) : true;
const runtimeEnv = (readEnv('NODE_ENV') || readEnv('VERCEL_ENV') || 'development').toLowerCase();
const IS_PRODUCTION = runtimeEnv === 'production';

function logOAuth(event: string, details?: Record<string, unknown>) {
	if (!OAUTH_DEBUG) return;
	const payload = details ? JSON.stringify(details) : '';
	console.info(`[oauth-callback] ${new Date().toISOString()} ${event}${payload ? ' ' + payload : ''}`);
}

const seenCodes = new Map<string, number>(); // code -> expiresAt
const CODE_SEEN_TTL_MS = 2 * 60_000;

function codeAlreadySeen(code: string): boolean {
	const now = Date.now();
	for (const [storedCode, expiresAt] of seenCodes) {
		if (expiresAt <= now) {
			seenCodes.delete(storedCode);
		}
	}
	const expiresAt = seenCodes.get(code);
	if (expiresAt && expiresAt > now) {
		return true;
	}
	seenCodes.set(code, now + CODE_SEEN_TTL_MS);
	return false;
}

let clientIdPrefixesLogged = false;
function logClientIdPrefixesOnce() {
	if (clientIdPrefixesLogged || !OAUTH_DEBUG) return;
	const githubClientId = readEnv('GITHUB_CLIENT_ID');
	const viteClientId = readEnv('VITE_GITHUB_CLIENT_ID');
	if (!githubClientId && !viteClientId) return;
	clientIdPrefixesLogged = true;
	logOAuth('env-client-id-prefixes', {
		githubClientIdPrefix: githubClientId ? githubClientId.slice(0, 6) : null,
		viteGithubClientIdPrefix: viteClientId ? viteClientId.slice(0, 6) : null,
		prefixesMatch: githubClientId && viteClientId ? githubClientId === viteClientId : null
	});
}

function redactSecrets(raw?: string | null): string | undefined {
	if (!raw) return undefined;
	return raw
		.replace(/access_token=[^&\s"']+/gi, 'access_token=[REDACTED]')
		.replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"');
}

function normalizeBaseUrl(raw: string): string {
	if (!raw) return raw;
	return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getHeader(req: any, key: string): string | undefined {
	const headers = (req as any)?.headers;
	if (!headers) return undefined;
	const lower = key.toLowerCase();
	if (typeof headers.get === 'function') {
		const value = headers.get(key) ?? headers.get(lower);
		return value ?? undefined;
	}
	const value = headers[key] ?? headers[lower];
	if (Array.isArray(value)) return value[0];
	return typeof value === 'string' ? value : undefined;
}

function getRequestUrl(req: any): URL {
	const raw = (req as any)?.url;
	if (typeof raw === 'string') {
		try {
			return new URL(raw);
		} catch (_) {
			// fall through to header-derived reconstruction
		}
	}
	const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || 'localhost:5173';
	const proto = getHeader(req, 'x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
	const path = typeof raw === 'string' && raw.startsWith('/') ? raw : '/api/auth/github/callback';
	return new URL(`${proto}://${host}${path}`);
}

function resolveAppBase(req?: any): {url: string; source: string} {
	if (req) {
		const parsed = getRequestUrl(req);
		if (parsed.origin && parsed.origin !== 'null') return {url: parsed.origin, source: 'request-url'};
		const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
		const proto = getHeader(req, 'x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
		if (host) return {url: `${proto}://${host}`, source: 'request-headers'};
	}

	const appBaseExplicit = readEnv('APP_BASE_URL');
	if (appBaseExplicit && appBaseExplicit !== '/') return {url: appBaseExplicit, source: 'APP_BASE_URL'};

	const urlEnv = readEnv('URL');
	if (urlEnv && urlEnv !== '/') return {url: urlEnv, source: 'URL'};

	const vercelUrl = readEnv('VERCEL_URL');
	if (vercelUrl) return {url: normalizeBaseUrl(vercelUrl), source: 'VERCEL_URL'};

	return {url: 'http://localhost:5173', source: 'fallback-default'};
}

function buildErrorResponse(status: number, message: string, debugData?: Record<string, unknown>): Response {
	const body: Record<string, unknown> = {error: message};
	if (!IS_PRODUCTION && debugData && Object.keys(debugData).length) {
		body.debug = debugData;
	}
	return new Response(JSON.stringify(body), {
		status,
		headers: {'Content-Type': 'application/json'}
	});
}

export const config = {runtime: 'nodejs'};

export default async function (req: any): Promise<Response> {
	const startedAt = Date.now();
	const requestId = getHeader(req, 'x-request-id') || getHeader(req, 'x-vercel-id') || undefined;
	const parsedUrl = getRequestUrl(req);
	const code = parsedUrl.searchParams.get('code');
	const state = parsedUrl.searchParams.get('state') || '';
	const logContextBase = {
		reqId: requestId,
		queryKeys: Array.from(parsedUrl.searchParams.keys()),
		hasCode: Boolean(code),
		stateLength: state.length
	};
	logOAuth('start', logContextBase);
	logClientIdPrefixesOnce();
	try {
		if (!code) {
			logOAuth('missing-code', {...logContextBase, durationMs: Date.now() - startedAt});
			return buildErrorResponse(400, 'Missing code');
		}

		const codePrefix = code.slice(0, 8);
		if (codeAlreadySeen(code)) {
			logOAuth('duplicate-code', {
				...logContextBase,
				durationMs: Date.now() - startedAt,
				codePrefix
			});
			return buildErrorResponse(400, 'OAuth code already used', {codePrefix});
		}

		const githubClientId = readEnv('GITHUB_CLIENT_ID');
		const viteClientId = readEnv('VITE_GITHUB_CLIENT_ID');
		const clientId = githubClientId || viteClientId;
		const clientIdSource = githubClientId ? 'GITHUB_CLIENT_ID' : viteClientId ? 'VITE_GITHUB_CLIENT_ID' : 'missing';
		const clientSecret = readEnv('GITHUB_CLIENT_SECRET');
		logOAuth('env-evaluated', {
			...logContextBase,
			hasClientId: Boolean(clientId),
			hasClientSecret: Boolean(clientSecret),
			clientIdSource,
			githubClientIdPrefix: githubClientId ? githubClientId.slice(0, 6) : null,
			viteGithubClientIdPrefix: viteClientId ? viteClientId.slice(0, 6) : null,
			clientIdsMatch: githubClientId && viteClientId ? githubClientId === viteClientId : null
		});
		if (!clientId || !clientSecret) {
			logOAuth('missing-env', {...logContextBase, durationMs: Date.now() - startedAt});
			return buildErrorResponse(500, 'Missing GitHub OAuth env vars', {
				hasClientId: !!clientId,
				hasClientSecret: !!clientSecret
			});
		}

		const {url: appBase} = resolveAppBase(req);
		const redirectUri = new URL('/api/auth/github/callback', appBase).toString();

		const timeoutRaw = readEnv('GITHUB_OAUTH_TIMEOUT_MS');
		const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : NaN;
		const tokenExchangeTimeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : 8000;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), tokenExchangeTimeoutMs);
		logOAuth('exchange-start', {
			...logContextBase,
			timeoutMs: tokenExchangeTimeoutMs,
			redirectUri,
			codePrefix,
			clientIdSource
		});

		let tokenRes: Response;
		try {
			const body = new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: redirectUri
			});
			tokenRes = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: body.toString(),
				signal: controller.signal
			});
		} catch (fetchError: any) {
			clearTimeout(timeoutId);
			const isAbort = fetchError?.name === 'AbortError';
			logOAuth('exchange-error', {
				...logContextBase,
				durationMs: Date.now() - startedAt,
				error: isAbort ? 'timeout' : fetchError?.message || 'fetch failed',
				codePrefix,
				clientIdSource
			});
			return buildErrorResponse(isAbort ? 504 : 502, isAbort ? 'GitHub token exchange timed out' : 'GitHub token exchange failed');
		}
		clearTimeout(timeoutId);
		logOAuth('exchange-response', {
			...logContextBase,
			durationMs: Date.now() - startedAt,
			status: tokenRes.status,
			codePrefix,
			clientIdSource
		});
		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			const bodyPreview = redactSecrets(text)?.slice(0, 200);
			logOAuth('exchange-non-ok', {
				...logContextBase,
				status: tokenRes.status,
				bodyPreview,
				codePrefix,
				clientIdSource
			});
			return buildErrorResponse(502, 'GitHub token request failed', {
				status: tokenRes.status,
				bodyPreview
			});
		}

		const tokenResClone = tokenRes.clone();
		let tokenJson: {access_token?: string; error?: string} | undefined;
		try {
			tokenJson = (await tokenRes.json()) as {access_token?: string; error?: string};
		} catch (parseErr: any) {
			const fallbackText = await tokenResClone.text();
			const bodyPreview = redactSecrets(fallbackText)?.slice(0, 200);
			logOAuth('exchange-parse-error', {
				...logContextBase,
				durationMs: Date.now() - startedAt,
				error: parseErr?.message || 'unable to parse json',
				bodyPreview,
				codePrefix,
				clientIdSource
			});
			return buildErrorResponse(502, 'Invalid response from GitHub token exchange', {
				error: parseErr?.message || 'unable to parse json',
				bodyPreview
			});
		}

		const accessToken = tokenJson?.access_token;
		if (!accessToken) {
			logOAuth('missing-access-token', {
				...logContextBase,
				durationMs: Date.now() - startedAt,
				githubError: tokenJson?.error || null,
				codePrefix,
				clientIdSource,
				redirectUri
			});
			return buildErrorResponse(502, 'No access_token in response', {
				hasErrorField: typeof tokenJson?.error === 'string'
			});
		}

		const {url, source: appBaseSource} = resolveAppBase(req);
		const redirect = new URL('/auth/github/success', url);
		redirect.searchParams.set('token', accessToken);
		redirect.searchParams.set('state', state);
		logOAuth('redirect', {
			...logContextBase,
			durationMs: Date.now() - startedAt,
			appBase: url,
			appBaseSource,
			codePrefix,
			clientIdSource
		});

		return Response.redirect(redirect.toString(), 302);
	} catch (e: any) {
		logOAuth('unhandled-error', {
			...logContextBase,
			durationMs: Date.now() - startedAt,
			error: e?.message || 'OAuth callback failed'
		});
		return buildErrorResponse(500, 'OAuth callback failed', {
			error: e?.message || 'OAuth callback failed',
			name: e?.name
		});
	}
}
