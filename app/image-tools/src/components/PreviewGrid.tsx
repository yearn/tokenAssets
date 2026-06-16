import React from 'react';
import type {PreviewMap} from '../lib/imagePreview';

type Props = {
	preview: PreviewMap;
	label: string;
};

export const PreviewGrid: React.FC<Props> = ({preview, label}) => {
	return (
		<div className="rounded-md border bg-gray-50 p-3">
			<p className="mb-2 text-sm font-medium text-gray-700">Previews</p>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<PreviewTile
					title="SVG"
					src={preview.svg}
					alt={`${label} SVG preview`}
					imgClassName="max-h-28 max-w-28"
				/>
				<PreviewTile
					title="PNG 32x32"
					src={preview.png32}
					alt={`${label} 32px PNG preview`}
					imgClassName="h-8 w-8"
				/>
				<PreviewTile
					title="PNG 128x128"
					src={preview.png128}
					alt={`${label} 128px PNG preview`}
					imgClassName="h-32 w-32"
				/>
			</div>
		</div>
	);
};

type PreviewTileProps = {
	title: string;
	src?: string;
	alt: string;
	imgClassName: string;
};

const PreviewTile: React.FC<PreviewTileProps> = ({title, src, alt, imgClassName}) => {
	return (
		<div>
			<p className="mb-1 text-xs text-gray-600">{title}</p>
			<div className="flex aspect-square w-full max-w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
				{src ? (
					<img
						src={src}
						alt={alt}
						className={imgClassName}
					/>
				) : (
					<span className="text-xs text-gray-400">-</span>
				)}
			</div>
		</div>
	);
};
