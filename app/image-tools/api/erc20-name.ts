export const config = { runtime: 'edge' };

function isEvmAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim());
}

const DEFAULT_RPCS: Partial<Record<number, string>> = {
	1: 'https://cloudflare-eth.com',
	10: 'https://mainnet.optimism.io',
	100: 'https://rpc.gnosischain.com',
	137: 'https://polygon-rpc.com',
	250: 'https://rpc.ankr.com/fantom',
	42161: 'https://arb1.arbitrum.io/rpc',
	8453: 'https://mainnet.base.org',
};

function getRpcUrlFromEnv(chainId: number): string | undefined {
	const k1 = `VITE_RPC_URI_FOR_${chainId}`;
	const k2 = `VITE_RPC_${chainId}`;
	const val = (process.env as any)[k1] || (process.env as any)[k2];
	return (val as string | undefined) || DEFAULT_RPCS[chainId];
}

function decodeAbiString(resultHex: string): string {
	const hex = resultHex.startsWith('0x') ? resultHex.slice(2) : resultHex;
	if (hex.length >= 192) {
		const lenHex = hex.slice(64, 128);
		const len = parseInt(lenHex || '0', 16);
		const dataHex = hex.slice(128, 128 + len * 2);
		return Buffer.from(dataHex, 'hex').toString('utf8').replace(/\u0000+$/, '');
	}
	if (hex.length === 64) {
		const trimmed = hex.replace(/00+$/, '');
		return Buffer.from(trimmed, 'hex').toString('utf8').replace(/\u0000+$/, '');
	}
	return Buffer.from(hex, 'hex').toString('utf8').replace(/\u0000+$/, '');
}

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
		const rpc = getRpcUrlFromEnv(chainId);
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

