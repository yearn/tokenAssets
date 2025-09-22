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

// Inlined EVM utilities
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;

const DEFAULT_RPC_URLS: Readonly<Partial<Record<number, string>>> = Object.freeze({
	1: 'https://cloudflare-eth.com',
	10: 'https://mainnet.optimism.io',
	100: 'https://rpc.gnosischain.com',
	137: 'https://polygon-rpc.com',
	250: 'https://rpc.ankr.com/fantom',
	42161: 'https://arb1.arbitrum.io/rpc',
	8453: 'https://mainnet.base.org'
});

function isEvmAddress(address: string): boolean {
	if (typeof address !== 'string') return false;
	return ADDRESS_REGEX.test(address.trim());
}

function getRpcUrl(chainId: number): string | undefined {
	if (!Number.isInteger(chainId)) return undefined;
	const keys = [`VITE_RPC_URI_FOR_${chainId}`, `VITE_RPC_${chainId}`, `RPC_URI_FOR_${chainId}`, `RPC_${chainId}`];
	for (const key of keys) {
		const fromEnv = readEnv(key);
		if (fromEnv) return fromEnv;
	}
	return DEFAULT_RPC_URLS[chainId];
}

function normalizeHex(value: string): string {
	const trimmed = (value || '').trim();
	const withoutPrefix = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
	if (withoutPrefix.length % 2 === 1) return `0${withoutPrefix}`;
	return withoutPrefix;
}

function hexToBytes(hex: string): Uint8Array {
	const normalized = hex.toLowerCase();
	const len = Math.floor(normalized.length / 2);
	const out = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		const byte = normalized.slice(i * 2, i * 2 + 2);
		const parsed = Number.parseInt(byte, 16);
		out[i] = Number.isFinite(parsed) ? parsed : 0;
	}
	return out;
}

function trimNulls(input: string): string {
	return input.replace(/ +$/g, '');
}

function bytesToUtf8(bytes: Uint8Array): string {
	if (!bytes.length) return '';
	const textDecoder = new TextDecoder();
	return trimNulls(textDecoder.decode(bytes));
}

function decodeAbiString(resultHex: string): string {
	const hex = normalizeHex(resultHex);
	if (!hex) return '';
	// Dynamic ABI string: offset (ignored) + length + data bytes
	if (hex.length >= 192) {
		const lenHex = hex.slice(64, 128);
		const declaredLength = Number.parseInt(lenHex || '0', 16);
		const maxBytes = Math.floor((hex.length - 128) / 2);
		const safeLength = Math.max(0, Math.min(declaredLength, maxBytes));
		const dataStart = 128;
		const dataEnd = dataStart + safeLength * 2;
		const dataHex = hex.slice(dataStart, dataEnd);
		return bytesToUtf8(hexToBytes(dataHex));
	}
	// Fixed-size bytes32 padded payload
	if (hex.length === 64) {
		const trimmedHex = hex.replace(/00+$/g, '');
		return bytesToUtf8(hexToBytes(trimmedHex));
	}
	return bytesToUtf8(hexToBytes(hex));
}

export const config = {runtime: 'edge'};

const JSON_HEADERS = {'Content-Type': 'application/json'} as const;
const CACHE_TTL_MS = normalizePositiveInt(readEnv('ERC20_NAME_CACHE_TTL_MS'), 5 * 60 * 1000);
const CACHE_MAX_ENTRIES = normalizePositiveInt(readEnv('ERC20_NAME_CACHE_SIZE'), 256);
const RPC_TIMEOUT_MS = normalizePositiveInt(readEnv('ERC20_NAME_RPC_TIMEOUT_MS'), 10_000);

interface CacheEntry {
	value: string;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function __clearCacheForTesting(): void {
	cache.clear();
}

type ErrorBody = {error: {code: string; message: string; details?: string}};
type SuccessBody = {name: string; cache: {hit: boolean; expiresAt: number}};

type RequestBody = {chainId?: number | string; address?: string};

type RpcPayload = {
	jsonrpc: '2.0';
	id: number;
	method: 'eth_call';
	params: [{to: string; data: string}, 'latest'];
};

function normalizePositiveInt(input: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(String(input ?? '').trim(), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonResponse(status: number, body: ErrorBody | SuccessBody): Response {
	return new Response(JSON.stringify(body), {status, headers: JSON_HEADERS});
}

function errorResponse(status: number, code: string, message: string, details?: string): Response {
	return jsonResponse(status, {error: {code, message, details}});
}

function makeCacheKey(chainId: number, address: string): string {
	return `${chainId}:${address.toLowerCase()}`;
}

function getCachedName(chainId: number, address: string, now: number) {
	const key = makeCacheKey(chainId, address);
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (entry.expiresAt <= now) {
		cache.delete(key);
		return undefined;
	}
	return {name: entry.value, expiresAt: entry.expiresAt};
}

function pruneExpired(now: number) {
	for (const [key, entry] of cache.entries()) {
		if (entry.expiresAt <= now) cache.delete(key);
	}
}

function setCachedName(chainId: number, address: string, name: string, now: number): number {
	pruneExpired(now);
	const key = makeCacheKey(chainId, address);
	const expiresAt = now + CACHE_TTL_MS;
	cache.set(key, {value: name, expiresAt});
	if (cache.size > CACHE_MAX_ENTRIES) {
		const iterator = cache.keys();
		while (cache.size > CACHE_MAX_ENTRIES) {
			const next = iterator.next();
			if (next.done) break;
			cache.delete(next.value);
		}
	}
	return expiresAt;
}

function normalizeAddress(address: string): string {
	return address.trim().toLowerCase();
}

function ensureValidRpcUrl(chainId: number, rpcCandidate: string | undefined): string | Response {
	if (!rpcCandidate) {
		return errorResponse(
			500,
			'RPC_NOT_CONFIGURED',
			`No RPC configured for chain ${chainId}. Set VITE_RPC_URI_FOR_${chainId} or VITE_RPC_${chainId}.`
		);
	}
	try {
		const url = new URL(rpcCandidate);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return errorResponse(500, 'RPC_INVALID_PROTOCOL', `RPC URL for chain ${chainId} must use http or https`);
		}
		return url.toString();
	} catch (err: any) {
		return errorResponse(500, 'RPC_INVALID_URL', `RPC URL for chain ${chainId} is invalid`, err?.message);
	}
}

function buildRpcPayload(address: string): RpcPayload {
	return {
		jsonrpc: '2.0',
		id: Math.floor(Math.random() * 1e9),
		method: 'eth_call',
		params: [{to: address, data: '0x06fdde03'}, 'latest']
	};
}

export default async function (req: Request): Promise<Response> {
	if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
	let body: RequestBody;
	try {
		body = (await req.json()) as RequestBody;
	} catch (err: any) {
		return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON', err?.message);
	}
	const chainId = Number(body?.chainId);
	if (!Number.isInteger(chainId) || chainId <= 0) {
		return errorResponse(400, 'INVALID_CHAIN_ID', 'chainId must be a positive integer');
	}
	const rawAddress = String(body?.address ?? '').trim();
	if (!isEvmAddress(rawAddress)) {
		return errorResponse(400, 'INVALID_ADDRESS', 'Address must be a valid EVM address');
	}
	const canonicalAddress = normalizeAddress(rawAddress);
	const now = Date.now();
	const cached = getCachedName(chainId, canonicalAddress, now);
	if (cached) {
		return jsonResponse(200, {name: cached.name, cache: {hit: true, expiresAt: cached.expiresAt}});
	}
	const rpcCandidate = getRpcUrl(chainId);
	const rpc = ensureValidRpcUrl(chainId, rpcCandidate);
	if (rpc instanceof Response) return rpc;
	const payload = buildRpcPayload(canonicalAddress);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
	let rpcResponse: Response;
	try {
		rpcResponse = await fetch(rpc, {
			method: 'POST',
			headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
			body: JSON.stringify(payload),
			signal: controller.signal
		});
	} catch (err: any) {
		clearTimeout(timeout);
		const isAbort = err?.name === 'AbortError';
		return errorResponse(
			502,
			'RPC_REQUEST_FAILED',
			isAbort ? 'RPC request timed out' : 'RPC request failed',
			isAbort ? undefined : err?.message
		);
	}
	clearTimeout(timeout);
	if (!rpcResponse.ok) {
		const bodyText = await rpcResponse.text().catch(() => '');
		return errorResponse(
			502,
			'RPC_HTTP_ERROR',
			`RPC responded with HTTP ${rpcResponse.status}`,
			bodyText?.slice?.(0, 300)
		);
	}
	let rpcJson: any;
	try {
		rpcJson = await rpcResponse.json();
	} catch (err: any) {
		const fallback = await rpcResponse.text().catch(() => '');
		return errorResponse(
			502,
			'RPC_PARSE_ERROR',
			'RPC response was not valid JSON',
			fallback?.slice?.(0, 300) || err?.message
		);
	}
	if (rpcJson?.error) {
		const message = rpcJson.error?.message || 'RPC error';
		return errorResponse(502, 'RPC_JSON_ERROR', message);
	}
	const result: string | undefined = rpcJson?.result;
	if (!result || result === '0x') {
		return errorResponse(404, 'EMPTY_RESULT', 'Contract returned empty result');
	}
	let decoded: string;
	try {
		decoded = decodeAbiString(result);
	} catch (err: any) {
		return errorResponse(500, 'DECODE_ERROR', 'Failed to decode contract response', err?.message);
	}
	if (!decoded.trim()) {
		return errorResponse(404, 'EMPTY_RESULT', 'Contract returned empty name');
	}
	const expiresAt = setCachedName(chainId, canonicalAddress, decoded, now);
	return jsonResponse(200, {name: decoded, cache: {hit: false, expiresAt}});
}
