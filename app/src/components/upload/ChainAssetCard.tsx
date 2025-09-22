import {Switch} from '@headlessui/react';
import React, {useCallback, useRef} from 'react';
import {ChainDraft, FileKind} from '../../features/upload/types';
import {PreviewPanel} from './PreviewPanel';

type ChainAssetCardProps = {
	title: string;
	actions?: React.ReactNode;
	draft: ChainDraft;
	chainListId: string;
	onChainIdChange(value: string): void;
	onToggleGenerate(enabled: boolean): void;
	onFileSelect(kind: FileKind, file?: File | null): void;
};

function classNames(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(' ');
}

export const ChainAssetCard: React.FC<ChainAssetCardProps> = ({
	title,
	actions,
	draft,
	chainListId,
	onChainIdChange,
	onToggleGenerate,
	onFileSelect
}) => {
	const svgInputRef = useRef<HTMLInputElement>(null);
	const png32InputRef = useRef<HTMLInputElement>(null);
	const png128InputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = useCallback(
		(kind: FileKind, file?: File | null) => {
			onFileSelect(kind, file ?? undefined);
		},
		[onFileSelect]
	);

	const handleSvgBrowse = useCallback(() => {
		svgInputRef.current?.click();
	}, []);

	const handleInputChange = useCallback(
		(kind: FileKind, event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			handleFileSelect(kind, file);
			event.target.value = '';
		},
		[handleFileSelect]
	);

	const handleSvgDrop = useCallback(
		(event: React.DragEvent<HTMLElement>) => {
			event.preventDefault();
			const dropped = event.dataTransfer.files?.[0];
			if (!dropped) return;
			handleFileSelect('svg', dropped);
		},
		[handleFileSelect]
	);

	return (
		<div className="rounded-md border p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-medium text-gray-900">{title}</h3>
				{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
			</div>

			<div className="mt-4 space-y-4">
				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700">Chain</span>
					<input
						list={chainListId}
						className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={draft.chainId}
						onChange={event => onChainIdChange(event.target.value)}
						placeholder="enter/select chain"
					/>
				</label>
			</div>

			<div className="mt-6 grid gap-4 sm:grid-cols-3">
				<div className="sm:col-span-2">
					<button
						type="button"
						onClick={handleSvgBrowse}
						onDragOver={event => event.preventDefault()}
						onDrop={handleSvgDrop}
						className="flex h-40 w-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600"
					>
						{draft.preview.svg ? (
							<img src={draft.preview.svg} alt="Chain SVG preview" className="max-h-36" />
						) : (
							<span>Drag &amp; Drop SVG here</span>
						)}
					</button>
					<input
						type="file"
						accept="image/svg+xml"
						ref={svgInputRef}
						className="hidden"
						onChange={event => handleInputChange('svg', event)}
					/>
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-gray-700">Generate PNGs</span>
						<Switch
							checked={draft.genPng}
							onChange={onToggleGenerate}
							className={classNames(
								draft.genPng ? 'bg-blue-600' : 'bg-gray-200',
								'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
							)}
						>
							<span
								className={classNames(
									draft.genPng ? 'translate-x-6' : 'translate-x-1',
									'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
								)}
							/>
						</Switch>
					</div>
					<button
						type="button"
						className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						onClick={handleSvgBrowse}
					>
						Browse SVG…
					</button>
					{!draft.genPng ? (
						<div className="space-y-2">
							<label className="block text-xs text-gray-600">
								PNG 32x32
								<input
									type="file"
									accept="image/png"
									ref={png32InputRef}
									onChange={event => handleInputChange('png32', event)}
								/>
							</label>
							<label className="block text-xs text-gray-600">
								PNG 128x128
								<input
									type="file"
									accept="image/png"
									ref={png128InputRef}
									onChange={event => handleInputChange('png128', event)}
								/>
							</label>
						</div>
					) : null}
				</div>
			</div>

			<PreviewPanel preview={draft.preview} />
		</div>
	);
};
