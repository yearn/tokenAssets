const PNG_TYPE = 'image/png';

export type PngPreviewResult = {
	png32: File;
	png128: File;
	urls: {png32: string; png128: string};
};

function ensureFileName(baseName: string, size: number): string {
	if (!baseName) return `logo-${size}.png`;
	const normalized = baseName.replace(/\.svg$/i, '').replace(/[^a-z0-9-_]+/gi, '-');
	return `${normalized || 'logo'}-${size}.png`;
}

async function loadSvgImage(svgFile: File): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(svgFile);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		return image;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function drawImageToBlob(image: HTMLImageElement, size: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			reject(new Error('Unable to create 2D canvas context'));
			return;
		}
		ctx.clearRect(0, 0, size, size);
		const scale = Math.min(size / image.width, size / image.height);
		const width = image.width * scale;
		const height = image.height * scale;
		const offsetX = (size - width) / 2;
		const offsetY = (size - height) / 2;
		ctx.drawImage(image, offsetX, offsetY, width, height);
		canvas.toBlob(blob => {
			if (!blob) {
				reject(new Error('Failed to render PNG preview'));
				return;
			}
			resolve(blob);
		}, PNG_TYPE);
	});
}

export async function generatePngPreviews(svgFile: File, options?: {baseName?: string}): Promise<PngPreviewResult> {
	const baseName = options?.baseName ?? svgFile.name ?? 'logo.svg';
	const image = await loadSvgImage(svgFile);
	const [blob32, blob128] = await Promise.all([drawImageToBlob(image, 32), drawImageToBlob(image, 128)]);
	const png32 = new File([blob32], ensureFileName(baseName, 32), {type: PNG_TYPE});
	const png128 = new File([blob128], ensureFileName(baseName, 128), {type: PNG_TYPE});
	return {
		png32,
		png128,
		urls: {
			png32: URL.createObjectURL(png32),
			png128: URL.createObjectURL(png128)
		}
	};
}

export function makeObjectUrl(file?: File): string | undefined {
	if (!file) return undefined;
	return URL.createObjectURL(file);
}

export function revokeObjectUrls(urls: Array<string | undefined>): void {
	for (const url of urls) {
		if (url) URL.revokeObjectURL(url);
	}
}

export async function dataUrlToFile(dataUrl: string, filename: string, type = PNG_TYPE): Promise<File> {
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	return new File([blob], filename, {type});
}
