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
			const origin = new URL((req as {url?: string}).url ?? '').origin;
			if (origin) return origin;
		} catch (_) {
			// ignore parse failure
		}
	}
	// Default fallback
	return '/';
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
			return new Response(JSON.stringify({error: 'Missing GitHub OAuth env vars'}), {
				status: 500,
				headers: {'Content-Type': 'application/json'}
			});
		}

		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
			body: JSON.stringify({client_id: clientId, client_secret: clientSecret, code})
		});
		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			return new Response(text, {status: 502});
		}
		const tokenJson = (await tokenRes.json()) as {access_token?: string};
		const accessToken = tokenJson.access_token;
		if (!accessToken) {
			return new Response(JSON.stringify({error: 'No access_token in response'}), {
				status: 502,
				headers: {'Content-Type': 'application/json'}
			});
		}

		const appBase = resolveAppBaseUrl(req);
		const redirect = new URL('/auth/github/success', appBase);
		redirect.searchParams.set('token', accessToken);
		redirect.searchParams.set('state', state);
		return Response.redirect(redirect.toString(), 302);
	} catch (e: any) {
		return new Response(JSON.stringify({error: e?.message || 'OAuth callback failed'}), {
			status: 500,
			headers: {'Content-Type': 'application/json'}
		});
	}
}
