import React from 'react';
import {PreviewTriplet} from '../../features/upload/types';

const PREVIEW_ITEMS: Array<{key: keyof PreviewTriplet; label: string; className: string}> = [
	{key: 'svg', label: 'SVG', className: 'max-h-28 max-w-28'},
	{key: 'png32', label: 'PNG 32x32', className: 'h-8 w-8'},
	{key: 'png128', label: 'PNG 128x128', className: 'h-32 w-32'}
];

type PreviewPanelProps = {
	title?: string;
	preview: PreviewTriplet;
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({title = 'Previews', preview}) => (
	<div className="mt-4 rounded-md border bg-gray-50 p-3">
		<p className="mb-2 text-sm font-medium text-gray-700">{title}</p>
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{PREVIEW_ITEMS.map(item => {
				const src = preview[item.key];
				return (
					<div key={item.key}>
						<p className="mb-1 text-xs text-gray-600">{item.label}</p>
						<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
							{src ? (
								<img src={src} alt={item.label} className={item.className} />
							) : (
								<span className="text-xs text-gray-400">—</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	</div>
);
