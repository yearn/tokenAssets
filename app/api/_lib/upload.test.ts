import {beforeEach, describe, expect, it, vi} from 'vitest';

const imageModule = vi.hoisted(() => {
	let counter = 0;
	const mod = {
		readBinary: vi.fn(async () => new Uint8Array([0, 1, 2])),
		readPng: vi.fn(async () => ({bytes: new Uint8Array([3, 4, 5]), dimensions: {width: 32, height: 32}})),
		assertDimensions: vi.fn(),
		toBase64: vi.fn(() => `base64-${counter++}`),
		reset() {
			counter = 0;
			mod.readBinary.mockClear();
			mod.readPng.mockClear();
			mod.assertDimensions.mockClear();
			mod.toBase64.mockClear();
		}
	};
	return mod;
});

vi.mock('@shared/image', () => ({
	readBinary: imageModule.readBinary,
	readPng: imageModule.readPng,
	assertDimensions: imageModule.assertDimensions,
	toBase64: imageModule.toBase64
}));

import {UploadValidationError, buildDefaultPrMetadata, buildPrFiles, parseUploadForm} from './upload';

function createSvgBlob(): Blob {
	return new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], {type: 'image/svg+xml'});
}

function createPngBlob(): Blob {
	return new Blob([new Uint8Array([0, 1, 2, 3])], {type: 'image/png'});
}

function validAddress(index: number): string {
	return `0x${index.toString(16).padStart(40, '0')}`;
}

beforeEach(() => {
	imageModule.reset();
});

describe('parseUploadForm', () => {
	it('parses a single token submission with expected shape', async () => {
		const form = new FormData();
		form.set('target', 'token');
		form.append('address', validAddress(1));
		form.set('chainId', '1');
		form.set('chainId_0', '1');
		form.set('svg_0', createSvgBlob());
		form.set('png32_0', createPngBlob());
		form.set('png128_0', createPngBlob());

		const result = await parseUploadForm(form);
		if (result.target !== 'token') throw new Error('expected token upload result');
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0]).toMatchObject({
			chainId: '1',
			address: validAddress(1),
			svgBase64: 'base64-0',
			png32Base64: 'base64-1',
			png128Base64: 'base64-2'
		});
	});

	it('throws UploadValidationError with field details for invalid address', async () => {
		const form = new FormData();
		form.set('target', 'token');
		form.append('address', 'not-an-address');
		form.set('chainId', '1');
		form.set('chainId_0', '1');
		form.set('svg_0', createSvgBlob());
		form.set('png32_0', createPngBlob());
		form.set('png128_0', createPngBlob());

		const attempt = parseUploadForm(form);
		await expect(attempt).rejects.toBeInstanceOf(UploadValidationError);
		await expect(attempt).rejects.toMatchObject({
			details: expect.arrayContaining([
				expect.objectContaining({field: 'address', message: 'address must be a valid EVM address'})
			])
		});
	});
});

describe('buildPrFiles', () => {
	it('returns repository paths for token files', () => {
		const files = buildPrFiles({
			target: 'token',
			tokens: [
				{
					index: 0,
					chainId: '1',
					address: validAddress(1),
					svgBase64: 'svg',
					png32Base64: 'png32',
					png128Base64: 'png128'
				}
			],
			overrides: {}
		});

		expect(files.map(file => file.path)).toEqual([
			'tokens/1/0x0000000000000000000000000000000000000001/logo.svg',
			'tokens/1/0x0000000000000000000000000000000000000001/logo-32.png',
			'tokens/1/0x0000000000000000000000000000000000000001/logo-128.png'
		]);
	});
});

describe('buildDefaultPrMetadata', () => {
	it('generates default metadata when overrides are missing', () => {
		const metadata = buildDefaultPrMetadata(
			{
				target: 'token',
				tokens: [
					{
						index: 0,
						chainId: '1',
						address: validAddress(1),
						svgBase64: 'svg',
						png32Base64: 'png32',
						png128Base64: 'png128'
					}
				],
				overrides: {}
			},
			{}
		);

		expect(metadata.title).toContain('feat: add token assets');
		expect(metadata.body).toContain('Chains: 1');
		expect(metadata.body).toContain('/tokens/1/0x0000000000000000000000000000000000000001/logo.svg');
	});
});
