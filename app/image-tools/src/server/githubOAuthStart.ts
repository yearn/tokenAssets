import {createOAuthState, resolveOAuthReturnTo} from './githubOAuthState';

export async function handleGithubOAuthStart(req: Request): Promise<Response> {
	try {
		if (req.method !== 'GET') return new Response('Method Not Allowed', {status: 405});

		const requestUrl = new URL(req.url);
		const nonce = requestUrl.searchParams.get('state') || '';
		const clientId = process.env.GITHUB_CLIENT_ID;
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;
		if (!clientId || !clientSecret) throw new Error('Missing GitHub OAuth env vars');

		const returnTo = resolveOAuthReturnTo(
			requestUrl.searchParams.get('returnTo'),
			process.env.OAUTH_RETURN_ORIGINS || ''
		);
		const state = await createOAuthState(nonce, returnTo, clientSecret);
		const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
		authorizeUrl.searchParams.set('client_id', clientId);
		authorizeUrl.searchParams.set('state', state);
		authorizeUrl.searchParams.set('scope', 'public_repo');
		authorizeUrl.searchParams.set('prompt', 'select_account');
		return Response.redirect(authorizeUrl.toString(), 302);
	} catch (e: any) {
		return new Response(JSON.stringify({error: e?.message || 'OAuth start failed'}), {
			status: 400,
			headers: {'Content-Type': 'application/json'}
		});
	}
}
