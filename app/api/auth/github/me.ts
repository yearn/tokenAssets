export const config = {runtime: 'edge'};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');
	headers.set('Cache-Control', 'no-store');
	return new Response(JSON.stringify(body), {...init, headers});
}

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== 'GET') {
		return jsonResponse({error: 'Method not allowed'}, {status: 405, headers: {Allow: 'GET'}});
	}

	const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return jsonResponse({error: 'Missing GitHub token'}, {status: 401});
	}

	const token = authHeader.slice('Bearer '.length).trim();
	if (!token) {
		return jsonResponse({error: 'Missing GitHub token'}, {status: 401});
	}

	try {
		const res = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json'
			}
		});

		if (res.status === 401 || res.status === 403) {
			return jsonResponse({error: 'Unauthorized'}, {status: res.status});
		}

		if (!res.ok) {
			const text = await res.text();
			return jsonResponse({error: text || 'Failed to fetch profile'}, {status: 502});
		}

		const data = (await res.json()) as {login: string; name?: string; avatar_url?: string; html_url?: string};
		return jsonResponse(
			{
				login: data.login,
				name: data.name ?? null,
				avatarUrl: data.avatar_url ?? null,
				htmlUrl: data.html_url ?? null
			},
			{status: 200}
		);
	} catch (error: any) {
		const message = typeof error?.message === 'string' ? error.message : 'Failed to contact GitHub';
		return jsonResponse({error: message}, {status: 500});
	}
}
