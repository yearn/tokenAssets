export type PreviewMap = {
	svg?: string;
	png32?: string;
	png128?: string;
};

export type AssetFiles = {
	svg?: File;
	png32?: File;
	png128?: File;
};

export type AssetFileKind = keyof AssetFiles;

export function isObjectUrl(url?: string): url is string {
	return !!url && url.startsWith('blob:');
}

export function revokePreviewUrl(url?: string) {
	if (isObjectUrl(url)) URL.revokeObjectURL(url);
}

export function revokePreviewMap(preview: PreviewMap) {
	Object.values(preview).forEach(url => revokePreviewUrl(url));
}

export async function generatePngPreviews(svgFile: File): Promise<Pick<PreviewMap, 'png32' | 'png128'>> {
	const svgUrl = URL.createObjectURL(svgFile);
	try {
		const img = new Image();
		img.src = svgUrl;
		await img.decode().catch(() => undefined);

		return {
			png32: renderImageToPng(img, 32),
			png128: renderImageToPng(img, 128)
		};
	} finally {
		URL.revokeObjectURL(svgUrl);
	}
}

function renderImageToPng(img: HTMLImageElement, size: number) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;

	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	ctx.clearRect(0, 0, size, size);
	const scale = Math.min(size / img.width, size / img.height);
	const width = img.width * scale;
	const height = img.height * scale;
	const x = (size - width) / 2;
	const y = (size - height) / 2;
	ctx.drawImage(img, x, y, width, height);

	return canvas.toDataURL('image/png');
}

export async function dataUrlToFile(dataUrl: string, filename: string, type = 'image/png'): Promise<File> {
	const res = await fetch(dataUrl);
	const blob = await res.blob();
	return new File([blob], filename, {type});
}
