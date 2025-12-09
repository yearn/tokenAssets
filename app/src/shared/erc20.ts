import {buildApiUrl} from './api';
import {decodeAbiString, getRpcUrl, isEvmAddress} from './evm';

export type Erc20LookupSource = 'api' | 'api-cache' | 'rpc';

export type Erc20LookupResult = {
	name: string;
	source: Erc20LookupSource;
	cacheHit: boolean;
};

export type LookupErrorCode =
	| 'INVALID_ADDRESS'
	| 'INVALID_CHAIN'
	| 'LOOKUP_FAILED'
	| 'RPC_NOT_CONFIGURED'
	| 'RPC_ERROR';

export class Erc20LookupError extends Error {
	readonly code?: LookupErrorCode;

	constructor(message: string, code?: LookupErrorCode) {
		super(message);
		this.name = 'Erc20LookupError';
		this.code = code;
	}
}

export type LookupOptions = {
	chainId: number;
	address: string;
	signal?: AbortSignal;
	fetchFn?: typeof fetch;
};

function isAbortError(error: unknown): boolean {
	const name = (error as {name?: string} | undefined)?.name;
	return name === 'AbortError' || name === 'CanceledError';
}

function normalizeAddress(address: string): string {
	return address.trim().toLowerCase();
}

function toLookupError(error: unknown, fallback?: LookupErrorCode): Erc20LookupError {
	if (error instanceof Erc20LookupError) return error;
	const message = error instanceof Error ? error.message : String(error ?? 'Lookup failed');
	return new Erc20LookupError(message, fallback);
}

export async function lookupErc20Name(options: LookupOptions): Promise<Erc20LookupResult> {
	const fetchFn = options.fetchFn ?? fetch;
	const address = normalizeAddress(options.address);
	if (!isEvmAddress(address)) throw new Erc20LookupError('Address must be a valid EVM address', 'INVALID_ADDRESS');
	if (!Number.isFinite(options.chainId)) throw new Erc20LookupError('Invalid chain ID', 'INVALID_CHAIN');

	const payload = {chainId: options.chainId, address};
	let apiFallbackError: Erc20LookupError | undefined;
	try {
		const apiResponse = await fetchFn(buildApiUrl('/api/erc20-name'), {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(payload),
			signal: options.signal
		});
		const json = await apiResponse.json().catch(async () => {
			const text = await apiResponse.text().catch(() => '');
			throw new Erc20LookupError(text || `Lookup failed with HTTP ${apiResponse.status}`, 'LOOKUP_FAILED');
		});
		if (!apiResponse.ok) {
			const err = new Erc20LookupError(
				json?.error?.message || `Lookup failed with HTTP ${apiResponse.status}`,
				'LOOKUP_FAILED'
			);
			if (apiResponse.status >= 500) apiFallbackError = err;
			throw err;
		}
		if (json?.error) throw new Erc20LookupError(json.error?.message || 'Lookup failed', 'LOOKUP_FAILED');
		if (typeof json?.name === 'string') {
			const cacheHit = Boolean(json?.cache?.hit);
			return {name: json.name, cacheHit, source: cacheHit ? 'api-cache' : 'api'};
		}
		throw new Erc20LookupError('Unexpected response from lookup API', 'LOOKUP_FAILED');
	} catch (error) {
		if (isAbortError(error)) throw error;
		if (!apiFallbackError && error instanceof Erc20LookupError) throw error;
		apiFallbackError = apiFallbackError || toLookupError(error, 'LOOKUP_FAILED');
	}

	const rpcUrl = getRpcUrl(options.chainId);
	if (!rpcUrl) throw new Erc20LookupError('No RPC configured for this chain', 'RPC_NOT_CONFIGURED');

	try {
		const rpcResponse = await fetchFn(rpcUrl, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: Math.floor(Math.random() * 1e9),
				method: 'eth_call',
				params: [{to: address, data: '0x06fdde03'}, 'latest']
			}),
			signal: options.signal
		});
		if (!rpcResponse.ok) throw new Erc20LookupError(`RPC HTTP ${rpcResponse.status}`, 'RPC_ERROR');
		const rpcJson = await rpcResponse.json();
		if (rpcJson?.error) throw new Erc20LookupError(rpcJson.error?.message || 'RPC error', 'RPC_ERROR');
		const result = rpcJson?.result;
		if (!result || typeof result !== 'string' || result === '0x') {
			throw new Erc20LookupError('Contract returned empty result', 'RPC_ERROR');
		}
		const decoded = decodeAbiString(result);
		if (!decoded.trim()) throw new Erc20LookupError('Contract returned empty result', 'RPC_ERROR');
		return {name: decoded, cacheHit: false, source: 'rpc'};
	} catch (error) {
		if (isAbortError(error)) throw error;
		const err = toLookupError(error, 'RPC_ERROR');
		if (apiFallbackError) err.message = `${err.message} (API fallback failed: ${apiFallbackError.message})`;
		throw err;
	}
}

export function isLookupAbort(error: unknown): boolean {
	return isAbortError(error);
}
