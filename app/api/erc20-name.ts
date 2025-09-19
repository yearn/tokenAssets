import {decodeAbiString, getRpcUrl, isEvmAddress} from '@shared/evm';

export const config = { runtime: 'edge' };

export default async function (req: Request): Promise<Response> {
	if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
	try {
		const { chainId: chainIdRaw, address } = (await req.json()) as {
			chainId?: number | string;
			address?: string;
		};
		const chainIdStr = String(chainIdRaw || '').trim();
		const addr = String(address || '').trim();
		const chainId = Number(chainIdStr);
		if (!chainId || Number.isNaN(chainId))
			return new Response(JSON.stringify({ error: 'Invalid chainId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		if (!isEvmAddress(addr))
			return new Response(JSON.stringify({ error: 'Invalid address' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		const rpc = getRpcUrl(chainId);
		if (!rpc)
			return new Response(JSON.stringify({ error: 'No RPC configured for chain' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

		const payload = {
			jsonrpc: '2.0',
			id: Math.floor(Math.random() * 1e9),
			method: 'eth_call',
			params: [{ to: addr, data: '0x06fdde03' }, 'latest'],
		};
		const r = await fetch(rpc, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!r.ok) {
			const bodyText = await r.text().catch(() => '');
			return new Response(
				JSON.stringify({ error: `RPC HTTP ${r.status}`, details: bodyText?.slice?.(0, 300) }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			);
		}
		const j = await r.json().catch(async () => ({ raw: await r.text() }));
		if (j?.error) {
			return new Response(JSON.stringify({ error: j.error?.message || 'RPC error' }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		const result: string | undefined = (j as any)?.result;
		if (!result || result === '0x')
			return new Response(JSON.stringify({ error: 'Empty result' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
		const name = decodeAbiString(result);
		return new Response(JSON.stringify({ name }), { status: 200, headers: { 'Content-Type': 'application/json' } });
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e?.message || 'Lookup failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
