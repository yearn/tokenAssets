import {decodeAbiString, getRpcUrl, isEvmAddress} from '../src/shared/evm.js';
import {readEnv} from '../src/shared/env.js';

export const config = { runtime: 'nodejs' };

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
		params: [{to: address, data: '0x06fdde03'}, 'latest'],
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
			signal: controller.signal,
		});
	} catch (err: any) {
		clearTimeout(timeout);
		const isAbort = err?.name === 'AbortError';
		return errorResponse(502, 'RPC_REQUEST_FAILED', isAbort ? 'RPC request timed out' : 'RPC request failed', isAbort ? undefined : err?.message);
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
		return errorResponse(502, 'RPC_PARSE_ERROR', 'RPC response was not valid JSON', fallback?.slice?.(0, 300) || err?.message);
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
