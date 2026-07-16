import {afterEach, describe, expect, test} from 'bun:test';
import {buildChainAssetPaths, handleUpload, resolveTargetRepo, validateChainId} from './upload';

const ENV_KEYS = ['REPO_OWNER', 'REPO_NAME', 'ALLOW_REPO_OVERRIDE'] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

afterEach(() => {
	for (const key of ENV_KEYS) {
		const value = originalEnv[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe('upload repository targeting', () => {
	test('targets yearn/tokenAssets unless overrides are explicitly enabled', () => {
		process.env.REPO_OWNER = 'personal-fork';
		process.env.REPO_NAME = 'different-repo';
		delete process.env.ALLOW_REPO_OVERRIDE;

		expect(resolveTargetRepo()).toEqual({owner: 'yearn', repo: 'tokenAssets'});
	});

	test('honors an intentional repository override', () => {
		process.env.REPO_OWNER = 'personal-fork';
		process.env.REPO_NAME = 'different-repo';
		process.env.ALLOW_REPO_OVERRIDE = 'true';

		expect(resolveTargetRepo()).toEqual({owner: 'personal-fork', repo: 'different-repo'});
	});
});

test('chain 999 creates Git tree paths without requiring a directory entry', () => {
	expect(validateChainId('999')).toBe('999');
	expect(buildChainAssetPaths('999')).toEqual([
		'chains/999/logo.svg',
		'chains/999/logo-32.png',
		'chains/999/logo-128.png'
	]);
});

test('the documented btcm chain identifier is accepted', () => {
	expect(validateChainId('btcm')).toBe('btcm');
	expect(buildChainAssetPaths('btcm')).toEqual([
		'chains/btcm/logo.svg',
		'chains/btcm/logo-32.png',
		'chains/btcm/logo-128.png'
	]);
});

const INVALID_CHAIN_IDS = [
	'',
	'../../.github/workflows',
	'999/../../foo',
	'.',
	'..',
	'1\\foo',
	' 999 ',
	'\t999',
	'%2e%2e%2f.github',
	'999%2Ffoo',
	'arbitrum'
];

describe('chainId path validation', () => {
	for (const chainId of INVALID_CHAIN_IDS) {
		test(`rejects ${JSON.stringify(chainId)} for token and chain uploads before GitHub`, async () => {
			let githubCalls = 0;
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () => {
				githubCalls += 1;
				return new Response('{}', {status: 500});
			}) as unknown as typeof fetch;

			try {
				for (const target of ['token', 'chain'] as const) {
					const response = await handleUpload(buildUploadRequest(target, chainId));
					const body = (await response.json()) as {error?: string};

					expect(response.status).toBe(400);
					expect(body.error).toContain(chainId ? 'Invalid chainId' : 'Missing chainId');
					if (chainId) expect(body.error).toContain('expected decimal digits or "btcm"');
				}
				expect(githubCalls).toBe(0);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	}
});

function buildUploadRequest(target: 'token' | 'chain', chainId: string): Request {
	const itemId = 'security-test';
	const form = new FormData();
	form.set('target', target);
	form.set(
		'items',
		JSON.stringify([
			{
				id: itemId,
				chainId,
				...(target === 'token' ? {address: '0x0000000000000000000000000000000000000001'} : {})
			}
		])
	);
	form.set(
		`svg_${itemId}`,
		new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', {type: 'image/svg+xml'})
	);
	form.set(`png32_${itemId}`, pngFile(32, 'logo-32.png'));
	form.set(`png128_${itemId}`, pngFile(128, 'logo-128.png'));

	return new Request('http://localhost/api/upload', {
		method: 'POST',
		headers: {Authorization: 'Bearer test-token'},
		body: form
	});
}

function pngFile(size: number, name: string): File {
	const bytes = new Uint8Array(25);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, size);
	view.setUint32(20, size);
	return new File([bytes], name, {type: 'image/png'});
}
