export const config = { runtime: 'edge' };

export default async function (): Promise<Response> {
	return new Response(JSON.stringify({ ok: true, service: 'image-tools' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

