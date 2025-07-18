async function resolveNotFound(request: Request): Promise<Response> {
	const fallback = new URL(request.url).searchParams.get('fallback');
	if (fallback === 'true') {
		const baseURI = 'https://raw.githubusercontent.com/SmolDapp/tokenAssets/main/_config/nodeAPI/public';
		const result = await fetch(`${baseURI}/not-found.png`);
		return new Response(result.body, {
			headers: {'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, must-revalidate'}
		});
	}

	if (fallback) {
		const result = await fetch(fallback);
		const contentTypeFromFallback = result.headers.get('Content-Type');
		if (contentTypeFromFallback?.startsWith('image/')) {
			console.warn(`Using fallback image: ${fallback}`);
			return new Response(result.body, {
				headers: {
					'Content-Type': contentTypeFromFallback,
					'Cache-Control': 'public, max-age=86400, must-revalidate'
				}
			});
		}
	}
	return new Response('Not found', {status: 404});
}

type TChainContext = {
	params: {
		chainID: string;
		filename: string;
	};
};

export async function handleChainRequest(request: Request, context: TChainContext): Promise<Response> {
	const chainIDStr = (context?.params?.chainID || 1).toString();
	const fileName = (context?.params?.filename || '').toLowerCase();
	if (!['logo.svg', 'logo-32.png', 'logo-128.png'].includes(fileName)) {
		return await resolveNotFound(request);
	}

	const baseURI = 'https://raw.githubusercontent.com/SmolDapp/tokenAssets/main';
	const finalURI = `${baseURI}/chains/${chainIDStr}/${fileName}`;
	const result = await fetch(finalURI);
	if (result.ok) {
		if (fileName.endsWith('.svg')) {
			return new Response(result.body, {
				headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400, must-revalidate'}
			});
		}
		return new Response(result.body, {
			headers: {'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, must-revalidate'}
		});
	}

	return await resolveNotFound(request);
}
