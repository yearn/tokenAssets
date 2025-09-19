import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const ENCODED_DYNAMIC_TEST =
	'0x' +
	'0000000000000000000000000000000000000000000000000000000000000020' +
	'0000000000000000000000000000000000000000000000000000000000000004' +
	'5465737400000000000000000000000000000000000000000000000000000000';

type HandlerModule = typeof import('../erc20-name');

declare const Response: typeof globalThis.Response;

declare const Request: typeof globalThis.Request;

function makeRequest(body: unknown) {
	return new Request('https://example.com/api/erc20-name', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function loadHandler(): Promise<HandlerModule> {
	return await import('../erc20-name');
}

function setRpcEnv(url?: string) {
	if (url) {
		process.env.VITE_RPC_URI_FOR_1 = url;
	} else {
		delete process.env.VITE_RPC_URI_FOR_1;
	}
}

describe('api/erc20-name', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		for (const key of Object.keys(process.env)) {
			if (key.startsWith('VITE_RPC_') || key.startsWith('ERC20_NAME_')) delete process.env[key];
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('returns name and caches result', async () => {
		setRpcEnv('https://rpc.example');
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({result: ENCODED_DYNAMIC_TEST}), {
				status: 200,
				headers: {'Content-Type': 'application/json'}
			})
		);
		vi.stubGlobal('fetch', mockFetch);
		const mod = await loadHandler();
		const {default: handler, __clearCacheForTesting} = mod;
		const first = await handler(makeRequest({chainId: 1, address: VALID_ADDRESS}));
		expect(first.status).toBe(200);
		const body1 = await first.json();
		expect(body1).toEqual({name: 'Test', cache: {hit: false, expiresAt: expect.any(Number)}});
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const second = await handler(makeRequest({chainId: 1, address: VALID_ADDRESS}));
		const body2 = await second.json();
		expect(second.status).toBe(200);
		expect(body2).toEqual({name: 'Test', cache: {hit: true, expiresAt: expect.any(Number)}});
		expect(mockFetch).toHaveBeenCalledTimes(1);
		__clearCacheForTesting();
	});

	it('returns 400 for invalid address', async () => {
		setRpcEnv('https://rpc.example');
		const mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		const {default: handler, __clearCacheForTesting} = await loadHandler();
		const res = await handler(makeRequest({chainId: 1, address: 'not-an-address'}));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('INVALID_ADDRESS');
		expect(mockFetch).not.toHaveBeenCalled();
		__clearCacheForTesting();
	});

	it('surfaces RPC HTTP errors with details', async () => {
		setRpcEnv('https://rpc.example');
		const mockFetch = vi.fn().mockResolvedValue(
			new Response('Internal error', {status: 500, headers: {'Content-Type': 'text/plain'}})
		);
		vi.stubGlobal('fetch', mockFetch);
		const {default: handler, __clearCacheForTesting} = await loadHandler();
		const res = await handler(makeRequest({chainId: 1, address: VALID_ADDRESS}));
		const body = await res.json();
		expect(res.status).toBe(502);
		expect(body.error.code).toBe('RPC_HTTP_ERROR');
		__clearCacheForTesting();
	});

	it('handles RPC JSON errors', async () => {
		setRpcEnv('https://rpc.example');
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({error: {message: 'execution reverted'}}), {
				status: 200,
				headers: {'Content-Type': 'application/json'}
			})
		);
		vi.stubGlobal('fetch', mockFetch);
		const {default: handler, __clearCacheForTesting} = await loadHandler();
		const res = await handler(makeRequest({chainId: 1, address: VALID_ADDRESS}));
		const body = await res.json();
		expect(res.status).toBe(502);
		expect(body.error.code).toBe('RPC_JSON_ERROR');
		__clearCacheForTesting();
	});

	it('returns error when RPC URL missing', async () => {
		setRpcEnv(undefined);
		const mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		const {default: handler, __clearCacheForTesting} = await loadHandler();
		const res = await handler(makeRequest({chainId: 999999, address: VALID_ADDRESS}));
		const body = await res.json();
		expect(res.status).toBe(500);
		expect(body.error.code).toBe('RPC_NOT_CONFIGURED');
		expect(mockFetch).not.toHaveBeenCalled();
		__clearCacheForTesting();
	});

	it('handles aborted RPC requests', async () => {
		setRpcEnv('https://rpc.example');
		const abortError = Object.assign(new Error('Aborted'), {name: 'AbortError'});
		const mockFetch = vi.fn().mockRejectedValue(abortError);
		vi.stubGlobal('fetch', mockFetch);
		const {default: handler, __clearCacheForTesting} = await loadHandler();
		const res = await handler(makeRequest({chainId: 1, address: VALID_ADDRESS}));
		const body = await res.json();
		expect(res.status).toBe(502);
		expect(body.error.code).toBe('RPC_REQUEST_FAILED');
		expect(body.error.message).toContain('timed out');
		__clearCacheForTesting();
	});
});
