import React, {useId, useRef} from 'react';

type Props = {
	label: string;
	accept: string;
	previewUrl?: string;
	previewAlt: string;
	emptyText: string;
	onFile: (file: File) => void;
};

export const AssetDropzone: React.FC<Props> = ({label, accept, previewUrl, previewAlt, emptyText, onFile}) => {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const openPicker = () => inputRef.current?.click();
	const handleFile = (file?: File) => {
		if (file) onFile(file);
	};

	return (
		<div className="space-y-2">
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				accept={accept}
				className="sr-only"
				onChange={event => handleFile(event.target.files?.[0])}
			/>
			<div
				role="button"
				tabIndex={0}
				aria-label={label}
				onClick={openPicker}
				onKeyDown={event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						openPicker();
					}
				}}
				onDragOver={event => event.preventDefault()}
				onDrop={event => {
					event.preventDefault();
					handleFile(event.dataTransfer.files?.[0]);
				}}
				className="flex h-40 w-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
				{previewUrl ? (
					<img
						src={previewUrl}
						alt={previewAlt}
						className="max-h-36 max-w-full"
					/>
				) : (
					<span>{emptyText}</span>
				)}
			</div>
			<button
				type="button"
				className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				onClick={openPicker}>
				Browse SVG...
			</button>
		</div>
	);
};
