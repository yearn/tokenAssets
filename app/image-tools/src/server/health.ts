export async function handleHealth(): Promise<Response> {
	return new Response(JSON.stringify({ok: true, service: 'image-tools-api'}), {
		status: 200,
		headers: {'Content-Type': 'application/json'}
	});
}
