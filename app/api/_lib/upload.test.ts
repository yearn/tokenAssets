import {describe, expect, it} from 'vitest';

import {UploadValidationError, buildDefaultPrMetadata, buildPrFiles, parseUploadForm} from './upload';

function createSvgBlob(): Blob {
	return new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], {type: 'image/svg+xml'});
}

function createPng32Blob(): Blob {
	// Create a minimal valid PNG file (32x32 pixel transparent PNG)
	const pngBytes = new Uint8Array([
		0x89,
		0x50,
		0x4e,
		0x47,
		0x0d,
		0x0a,
		0x1a,
		0x0a, // PNG signature
		0x00,
		0x00,
		0x00,
		0x0d, // IHDR chunk length (13 bytes)
		0x49,
		0x48,
		0x44,
		0x52, // IHDR
		0x00,
		0x00,
		0x00,
		0x20, // Width: 32 pixels
		0x00,
		0x00,
		0x00,
		0x20, // Height: 32 pixels
		0x08,
		0x06,
		0x00,
		0x00,
		0x00, // Bit depth: 8, Color type: 6 (RGBA), Compression: 0, Filter: 0, Interlace: 0
		0x8d,
		0x6f,
		0x26,
		0x53, // IHDR CRC
		0x00,
		0x00,
		0x00,
		0x0a, // IDAT chunk length (10 bytes)
		0x49,
		0x44,
		0x41,
		0x54, // IDAT
		0x78,
		0x9c,
		0x63,
		0x00,
		0x01,
		0x00,
		0x00,
		0x05,
		0x00,
		0x01, // Compressed data (empty 32x32 transparent image)
		0x0d,
		0x0a,
		0x2d,
		0xb4, // IDAT CRC
		0x00,
		0x00,
		0x00,
		0x00, // IEND chunk length (0 bytes)
		0x49,
		0x45,
		0x4e,
		0x44, // IEND
		0xae,
		0x42,
		0x60,
		0x82 // IEND CRC
	]);
	return new Blob([pngBytes], {type: 'image/png'});
}

function createPng128Blob(): Blob {
	// Create a minimal valid PNG file (128x128 pixel transparent PNG)
	const pngBytes = new Uint8Array([
		0x89,
		0x50,
		0x4e,
		0x47,
		0x0d,
		0x0a,
		0x1a,
		0x0a, // PNG signature
		0x00,
		0x00,
		0x00,
		0x0d, // IHDR chunk length (13 bytes)
		0x49,
		0x48,
		0x44,
		0x52, // IHDR
		0x00,
		0x00,
		0x00,
		0x80, // Width: 128 pixels
		0x00,
		0x00,
		0x00,
		0x80, // Height: 128 pixels
		0x08,
		0x06,
		0x00,
		0x00,
		0x00, // Bit depth: 8, Color type: 6 (RGBA), Compression: 0, Filter: 0, Interlace: 0
		0xc3,
		0x3e,
		0x61,
		0xcb, // IHDR CRC (updated for 128x128)
		0x00,
		0x00,
		0x00,
		0x0a, // IDAT chunk length (10 bytes)
		0x49,
		0x44,
		0x41,
		0x54, // IDAT
		0x78,
		0x9c,
		0x63,
		0x00,
		0x01,
		0x00,
		0x00,
		0x05,
		0x00,
		0x01, // Compressed data (empty 128x128 transparent image)
		0x0d,
		0x0a,
		0x2d,
		0xb4, // IDAT CRC
		0x00,
		0x00,
		0x00,
		0x00, // IEND chunk length (0 bytes)
		0x49,
		0x45,
		0x4e,
		0x44, // IEND
		0xae,
		0x42,
		0x60,
		0x82 // IEND CRC
	]);
	return new Blob([pngBytes], {type: 'image/png'});
}

function validAddress(index: number): string {
	return `0x${index.toString(16).padStart(40, '0')}`;
}

describe('parseUploadForm', () => {
	it('parses a single token submission with expected shape', async () => {
		const form = new FormData();
		form.set('target', 'token');
		form.append('address', validAddress(1));
		form.set('chainId', '1');
		form.set('chainId_0', '1');
		form.set('svg_0', createSvgBlob());
		form.set('png32_0', createPng32Blob());
		form.set('png128_0', createPng128Blob());

		const result = await parseUploadForm(form);
		if (result.target !== 'token') throw new Error('expected token upload result');
		expect(result.tokens).toHaveLength(1);
		expect(result.tokens[0]).toMatchObject({
			chainId: '1',
			address: validAddress(1),
			svgBase64: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
			png32Base64: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAACNbyZTAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
			png128Base64: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='
		});
	});

	it('throws UploadValidationError with field details for invalid address', async () => {
		const form = new FormData();
		form.set('target', 'token');
		form.append('address', 'not-an-address');
		form.set('chainId', '1');
		form.set('chainId_0', '1');
		form.set('svg_0', createSvgBlob());
		form.set('png32_0', createPng32Blob());
		form.set('png128_0', createPng128Blob());

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
