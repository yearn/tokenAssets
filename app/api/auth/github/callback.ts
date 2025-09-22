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

function resolveAppBase(req?: Request): {url: string; source: string} {
	const appBaseExplicit = readEnv('APP_BASE_URL');
	if (appBaseExplicit && appBaseExplicit !== '/') return {url: appBaseExplicit, source: 'APP_BASE_URL'};

	const urlEnv = readEnv('URL');
	if (urlEnv && urlEnv !== '/') return {url: urlEnv, source: 'URL'};

	const vercelUrl = readEnv('VERCEL_URL');
	if (vercelUrl) return {url: normalizeBaseUrl(vercelUrl), source: 'VERCEL_URL'};

	if (req) {
		try {
			const parsed = new URL(req.url);
			if (parsed.origin && parsed.origin !== 'null') return {url: parsed.origin, source: 'request-url'};
		} catch (_) {
			// ignore parse failure
		}
		const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
		const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
		if (host) return {url: `${proto}://${host}`, source: 'request-headers'};
	}

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

export default async function (req: Request): Promise<Response> {
	const startedAt = Date.now();
	const requestId = req.headers.get('x-request-id') || req.headers.get('x-vercel-id') || undefined;
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(req.url);
	} catch (parseErr: any) {
		logOAuth('invalid-request-url', {requestId, error: parseErr?.message || 'unable to parse'});
		return buildErrorResponse(400, 'Invalid request URL', {
			error: parseErr?.message || 'failed to parse request url'
		});
	}
	const code = parsedUrl.searchParams.get('code');
	const state = parsedUrl.searchParams.get('state') || '';
	const logContextBase = {
		reqId: requestId,
		queryKeys: Array.from(parsedUrl.searchParams.keys()),
		hasCode: Boolean(code),
		stateLength: state.length
	};
	logOAuth('start', logContextBase);
	try {
		if (!code) {
			logOAuth('missing-code', {...logContextBase, durationMs: Date.now() - startedAt});
			return buildErrorResponse(400, 'Missing code');
		}

		const githubClientId = readEnv('GITHUB_CLIENT_ID');
		const viteClientId = readEnv('VITE_GITHUB_CLIENT_ID');
		const clientId = githubClientId ?? viteClientId;
		const clientIdSource = githubClientId ? 'GITHUB_CLIENT_ID' : viteClientId ? 'VITE_GITHUB_CLIENT_ID' : null;
		const clientSecret = readEnv('GITHUB_CLIENT_SECRET');
		logOAuth('env-evaluated', {
			...logContextBase,
			clientIdSource,
			hasClientSecret: Boolean(clientSecret)
		});
		if (!clientId || !clientSecret) {
			logOAuth('missing-env', {...logContextBase, durationMs: Date.now() - startedAt});
			return buildErrorResponse(500, 'Missing GitHub OAuth env vars', {
				hasClientId: !!clientId,
				hasClientSecret: !!clientSecret
			});
		}

		const timeoutRaw = readEnv('GITHUB_OAUTH_TIMEOUT_MS');
		const timeoutParsed = timeoutRaw ? Number(timeoutRaw) : NaN;
		const tokenExchangeTimeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : 8000;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), tokenExchangeTimeoutMs);
		logOAuth('exchange-start', {...logContextBase, timeoutMs: tokenExchangeTimeoutMs});

		let tokenRes: Response;
		try {
			tokenRes = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
				body: JSON.stringify({client_id: clientId, client_secret: clientSecret, code}),
				signal: controller.signal
			});
		} catch (fetchError: any) {
			clearTimeout(timeoutId);
			const isAbort = fetchError?.name === 'AbortError';
			logOAuth('exchange-error', {
				...logContextBase,
				durationMs: Date.now() - startedAt,
				error: isAbort ? 'timeout' : fetchError?.message || 'fetch failed'
			});
			if (isAbort) {
				return buildErrorResponse(504, 'GitHub token exchange timed out');
			}
			throw fetchError;
		}
		clearTimeout(timeoutId);
		logOAuth('exchange-response', {
			...logContextBase,
			durationMs: Date.now() - startedAt,
			status: tokenRes.status
		});
		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			const bodyPreview = redactSecrets(text)?.slice(0, 200);
			logOAuth('exchange-non-ok', {
				...logContextBase,
				status: tokenRes.status,
				bodyPreview
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
				bodyPreview
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
				githubError: tokenJson?.error || null
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
			appBaseSource
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
