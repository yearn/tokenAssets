export const config = {runtime: 'edge'};

import {readOAuthStateWithLegacyProductionFallback, resolveOAuthReturnTo} from '../../../src/server/githubOAuthState';

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

		const clientId = process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID;
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			return new Response(JSON.stringify({error: 'Missing GitHub OAuth env vars'}), {
				status: 500,
				headers: {'Content-Type': 'application/json'}
			});
		}
		let oauthState: Awaited<ReturnType<typeof readOAuthStateWithLegacyProductionFallback>>;
		let returnTo: string;
		try {
			oauthState = await readOAuthStateWithLegacyProductionFallback(state, clientSecret);
			returnTo = resolveOAuthReturnTo(oauthState.returnTo, process.env.OAUTH_RETURN_ORIGINS || '');
		} catch (error: any) {
			return new Response(JSON.stringify({error: error?.message || 'Invalid OAuth state'}), {
				status: 400,
				headers: {'Content-Type': 'application/json'}
			});
		}

		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code
			})
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

		const redirect = new URL('/auth/github/success', returnTo);
		redirect.hash = new URLSearchParams({token: accessToken, state: oauthState.nonce}).toString();
		return Response.redirect(redirect.toString(), 302);
	} catch (e: any) {
		return new Response(JSON.stringify({error: e?.message || 'OAuth callback failed'}), {
			status: 500,
			headers: {'Content-Type': 'application/json'}
		});
	}
}
