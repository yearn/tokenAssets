function readEnv(key: string): string | undefined {
	if (typeof process !== 'undefined' && process.env) {
		const value = process.env[key];
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed ? trimmed : undefined;
		}
	}
	return undefined;
}

function normalizeBaseUrl(raw: string): string {
	return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function resolveAppBase(req: Request): string {
	const appBaseExplicit = readEnv('APP_BASE_URL');
	if (appBaseExplicit && appBaseExplicit !== '/') return appBaseExplicit;

	const urlEnv = readEnv('URL');
	if (urlEnv && urlEnv !== '/') return urlEnv;

	const vercelUrl = readEnv('VERCEL_URL');
	if (vercelUrl) return normalizeBaseUrl(vercelUrl);

	const current = new URL(req.url);
	const protocol = current.protocol || 'https:';
	return `${protocol}//${current.host}`;
}

function logAuthorize(event: string, details?: Record<string, unknown>) {
	const payload = details ? JSON.stringify(details) : '';
	console.info(`[oauth-authorize] ${new Date().toISOString()} ${event}${payload ? ' ' + payload : ''}`);
}

export const config = {runtime: 'edge'};

export default async function authorize(req: Request): Promise<Response> {
	const githubClientId = readEnv('GITHUB_CLIENT_ID') || readEnv('VITE_GITHUB_CLIENT_ID');
	if (!githubClientId) {
		logAuthorize('missing-client-id');
		return new Response('Missing GitHub client id', {status: 500});
	}

	const requestUrl = new URL(req.url);
	const providedState = requestUrl.searchParams.get('state') || '';
	const clientIdFromQuery = requestUrl.searchParams.get('client_id');
	const state = providedState && providedState.trim().length ? providedState : crypto.randomUUID();

	if (clientIdFromQuery && clientIdFromQuery !== githubClientId) {
		logAuthorize('client-id-mismatch', {
			githubClientIdPrefix: githubClientId.slice(0, 6),
			clientIdFromQueryPrefix: clientIdFromQuery.slice(0, 6)
		});
		return new Response('GitHub client id mismatch', {status: 400});
	}

	const base = resolveAppBase(req);
	const redirectUri = new URL('/api/auth/github/callback', base).toString();

	logAuthorize('redirect', {
		stateLength: state.length,
		clientIdPrefix: githubClientId.slice(0, 6),
		base,
		redirectUri
	});

	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', githubClientId);
	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('scope', 'public_repo');
	authorizeUrl.searchParams.set('state', state);

	return Response.redirect(authorizeUrl.toString(), 302);
}
