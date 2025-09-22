import {Buffer} from 'node:buffer';
import {describe, expect, it} from 'vitest';
import {assertDimensions, getPngDimensions, readPng, toBase64} from './image';

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

function decodeBase64(base64: string): Uint8Array {
	const buffer = Buffer.from(base64, 'base64');
	return Uint8Array.from(buffer);
}

describe('getPngDimensions', () => {
	it('extracts dimensions from a valid PNG buffer', () => {
		const bytes = decodeBase64(PNG_1X1_BASE64);
		expect(getPngDimensions(bytes)).toEqual({width: 1, height: 1});
	});

	it('returns null when buffer does not start with PNG signature', () => {
		const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(getPngDimensions(bytes)).toBeNull();
	});
});

describe('assertDimensions', () => {
	it('does not throw when dimensions match', () => {
		expect(() => assertDimensions('token.png', {width: 1, height: 1}, {width: 1, height: 1})).not.toThrow();
	});

	it('throws when dimensions are missing or invalid', () => {
		expect(() => assertDimensions('token.png', null, {width: 1, height: 1})).toThrow(
			'token.png must be a valid PNG file'
		);
	});

	it('throws when dimensions mismatch expected size', () => {
		expect(() => assertDimensions('token.png', {width: 2, height: 2}, {width: 1, height: 1})).toThrow(
			'token.png must be 1x1 (received 2x2)'
		);
	});
});

describe('readPng', () => {
	it('reads a Blob and returns bytes and dimensions', async () => {
		const bytes = decodeBase64(PNG_1X1_BASE64);
		const blob = {
			arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
			type: 'image/png'
		} as unknown as Blob;
		const result = await readPng(blob);
		expect(Array.from(result.bytes)).toEqual(Array.from(bytes));
		expect(result.dimensions).toEqual({width: 1, height: 1});
	});
});

describe('toBase64', () => {
	it('encodes bytes to a base64 string', () => {
		const bytes = decodeBase64(PNG_1X1_BASE64);
		expect(toBase64(bytes)).toBe(PNG_1X1_BASE64);
	});
});
