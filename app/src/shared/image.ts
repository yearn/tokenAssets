export type PngDimensions = {
	width: number;
	height: number;
};

const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(bytes: Uint8Array): boolean {
	if (bytes.length < PNG_SIGNATURE.length) return false;
	for (let i = 0; i < PNG_SIGNATURE.length; i++) {
		if (bytes[i] !== PNG_SIGNATURE[i]) return false;
	}
	return true;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
	return (
		((bytes[offset] << 24) >>> 0) +
		((bytes[offset + 1] << 16) >>> 0) +
		((bytes[offset + 2] << 8) >>> 0) +
		(bytes[offset + 3] >>> 0)
	);
}

export function getPngDimensions(bytes: Uint8Array): PngDimensions | null {
	if (!isPng(bytes)) return null;
	if (bytes.length < 24) return null;
	const width = readUInt32BE(bytes, 16);
	const height = readUInt32BE(bytes, 20);
	if (!width || !height) return null;
	return {width, height};
}

export function assertDimensions(
	label: string,
	dimensions: PngDimensions | null,
	expected: {width: number; height: number}
): void {
	if (!dimensions)
		throw new Error(`${label} must be a valid PNG file`);
	const {width, height} = dimensions;
	if (width !== expected.width || height !== expected.height) {
		throw new Error(
			`${label} must be ${expected.width}x${expected.height} (received ${width}x${height})`
		);
	}
}

async function blobToUint8(blob: Blob): Promise<Uint8Array> {
	const anyBlob = blob as unknown as {
		arrayBuffer?: () => Promise<ArrayBuffer>;
		stream?: () => ReadableStream<Uint8Array>;
		buffer?: ArrayBufferLike;
	};
	if (typeof anyBlob?.arrayBuffer === 'function') {
		const buffer = await anyBlob.arrayBuffer();
		return new Uint8Array(buffer);
	}
	if (typeof anyBlob?.stream === 'function') {
		const reader = anyBlob.stream().getReader();
		const chunks: Uint8Array[] = [];
		let done = false;
		while (!done) {
			const result = await reader.read();
			done = Boolean(result.done);
			if (result.value) chunks.push(result.value);
		}
		const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(chunk, offset);
			offset += chunk.length;
		}
		return merged;
	}
	if (anyBlob instanceof Uint8Array) return new Uint8Array(anyBlob);
	if (anyBlob?.buffer instanceof ArrayBuffer) return new Uint8Array(anyBlob.buffer);
	if (typeof Response !== 'undefined') {
		try {
			const response = new Response(blob);
			const buffer = await response.arrayBuffer();
			return new Uint8Array(buffer);
		} catch {
			// ignore and fall through
		}
	}
	throw new Error('Unable to read blob contents in this runtime');
}

export async function readPng(blob: Blob): Promise<{bytes: Uint8Array; dimensions: PngDimensions | null}> {
	const bytes = await blobToUint8(blob);
	return {bytes, dimensions: getPngDimensions(bytes)};
}

export async function readBinary(blob: Blob): Promise<Uint8Array> {
	return blobToUint8(blob);
}

export function toBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	if (typeof btoa !== 'undefined') return btoa(binary);
	throw new Error('Base64 encoding is not supported in this runtime');
}
