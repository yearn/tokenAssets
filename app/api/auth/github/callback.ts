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

// Inlined app base URL resolution
function resolveAppBaseUrl(req?: Request): string {
	const explicit = readEnv('APP_BASE_URL');
	if (explicit && explicit !== '/') return explicit;

	if (req) {
		try {
			const url = new URL(req.url);
			const origin = url.origin;
			if (origin && origin !== 'null') return origin;
		} catch (_) {
			// ignore parse failure
		}
	}

	// For Vercel deployment, try to construct from headers
	if (req) {
		try {
			const host = req.headers.get('host');
			const protocol = req.headers.get('x-forwarded-proto') || 'https';
			if (host) {
				return `${protocol}://${host}`;
			}
		} catch (_) {
			// ignore parse failure
		}
	}

	// Last resort fallback
	return explicit || readEnv('VERCEL_URL') ? `https://${readEnv('VERCEL_URL')}` : 'http://localhost:5173';
}

export const config = {runtime: 'nodejs'};

export default async function (req: Request): Promise<Response> {
	try {
		const url = new URL(req.url);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state') || '';

		if (!code) {
			return new Response(JSON.stringify({error: 'Missing code'}), {
				status: 400,
				headers: {'Content-Type': 'application/json'}
			});
		}

		const clientId = readEnv('GITHUB_CLIENT_ID') ?? readEnv('VITE_GITHUB_CLIENT_ID');
		const clientSecret = readEnv('GITHUB_CLIENT_SECRET');

		if (!clientId || !clientSecret) {
			return new Response(
				JSON.stringify({
					error: 'Missing GitHub OAuth env vars',
					hasClientId: !!clientId,
					hasClientSecret: !!clientSecret
				}),
				{
					status: 500,
					headers: {'Content-Type': 'application/json'}
				}
			);
		}

		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

		try {
			const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
				body: JSON.stringify({client_id: clientId, client_secret: clientSecret, code}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!tokenRes.ok) {
				const text = await tokenRes.text();
				return new Response(
					JSON.stringify({
						error: 'GitHub token request failed',
						status: tokenRes.status,
						details: text
					}),
					{
						status: 502,
						headers: {'Content-Type': 'application/json'}
					}
				);
			}

			const tokenJson = (await tokenRes.json()) as {access_token?: string; error?: string};
			const accessToken = tokenJson.access_token;

			if (!accessToken) {
				return new Response(
					JSON.stringify({
						error: 'No access_token in response',
						details: tokenJson
					}),
					{
						status: 502,
						headers: {'Content-Type': 'application/json'}
					}
				);
			}

			const appBase = resolveAppBaseUrl(req);
			const redirect = new URL('/auth/github/success', appBase);
			redirect.searchParams.set('token', accessToken);
			redirect.searchParams.set('state', state);

			return Response.redirect(redirect.toString(), 302);
		} catch (fetchError: any) {
			clearTimeout(timeoutId);

			if (fetchError.name === 'AbortError') {
				return new Response(
					JSON.stringify({
						error: 'GitHub API request timed out'
					}),
					{
						status: 504,
						headers: {'Content-Type': 'application/json'}
					}
				);
			}

			throw fetchError;
		}
	} catch (e: any) {
		return new Response(
			JSON.stringify({
				error: e?.message || 'OAuth callback failed',
				name: e?.name,
				stack: e?.stack
			}),
			{
				status: 500,
				headers: {'Content-Type': 'application/json'}
			}
		);
	}
}
