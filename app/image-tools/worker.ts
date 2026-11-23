import callback from './api/auth/github/callback';
import erc20Name from './api/erc20-name';
import health from './api/health';
import ping from './api/ping';
import upload from './api/upload';

const routes: Record<string, (req: Request) => Promise<Response>> = {
	'/api/auth/github/callback': callback,
	'/api/erc20-name': erc20Name,
	'/api/health': health,
	'/api/ping': ping,
	'/api/upload': upload
};

export default {
	async fetch(req: Request, env: {ASSETS: {fetch: (req: Request) => Promise<Response>}}): Promise<Response> {
		const handler = routes[new URL(req.url).pathname];
		return handler ? handler(req) : env.ASSETS.fetch(req);
	}
};
