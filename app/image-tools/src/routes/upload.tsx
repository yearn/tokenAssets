import React, {useEffect, useMemo, useState} from 'react';
import {createRoute} from '@tanstack/react-router';
import {Switch} from '@headlessui/react';
import {AssetDropzone} from '../components/AssetDropzone';
import {PreviewGrid} from '../components/PreviewGrid';
import {PrReviewDialog} from '../components/PrReviewDialog';
import {SegmentedToggle} from '../components/SegmentedToggle';
import {StatusBanner, type StatusTone} from '../components/StatusBanner';
import {useGithubAuthToken} from '../hooks/useGithubAuth';
import {API_BASE_URL} from '../lib/api';
import {getRpcUrl, isEvmAddress, listKnownChains} from '../lib/chains';
import {
	type AssetFileKind,
	type AssetFiles,
	type PreviewMap,
	dataUrlToFile,
	generatePngPreviews,
	revokePreviewMap,
	revokePreviewUrl
} from '../lib/imagePreview';
import {clearUploadDraft, readUploadDraft, saveUploadDraft} from '../lib/uploadDraft';
import {rootRoute} from '../router';

type TokenItem = {
	id: string;
	chainId: string;
	address: string;
	name: string;
	genPng: boolean;
	files: AssetFiles;
	preview: PreviewMap;
	resolvingName: boolean;
	resolveError: string;
	addressValid?: boolean;
};

type ChainItem = {
	id: string;
	chainId: string;
	genPng: boolean;
	files: AssetFiles;
	preview: PreviewMap;
};

type PrMetadata = {
	title: string;
	body: string;
};

type StatusState = {
	tone: StatusTone;
	title: string;
	message?: string;
	prUrl?: string;
};

type UploadUrlParams = {
	mode?: 'token' | 'chain';
	chainId?: string;
	address?: string;
	name?: string;
};

const chainOptions = listKnownChains();

function createAssetId(): string {
	return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTokenItem(): TokenItem {
	return {
		id: createAssetId(),
		chainId: '',
		address: '',
		name: '',
		genPng: true,
		files: {},
		preview: {},
		resolvingName: false,
		resolveError: ''
	};
}

function createChainItem(): ChainItem {
	return {
		id: createAssetId(),
		chainId: '',
		genPng: true,
		files: {},
		preview: {}
	};
}

export const UploadComponent: React.FC = () => {
	const token = useGithubAuthToken();
	const [mode, setMode] = useState<'token' | 'chain'>('token');
	const [chainItems, setChainItems] = useState<ChainItem[]>(() => [createChainItem()]);
	const [tokenItems, setTokenItems] = useState<TokenItem[]>(() => [createTokenItem()]);
	const [reviewOpen, setReviewOpen] = useState(false);
	const [prTitle, setPrTitle] = useState('');
	const [prBody, setPrBody] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<StatusState | null>(null);
	const [draftReady, setDraftReady] = useState(false);

	const canSubmit = useMemo(() => {
		if (mode === 'chain') {
			return chainItems.every(item => {
				if (!item.chainId || !item.files.svg) return false;
				return item.genPng
					? !!item.preview.png32 && !!item.preview.png128
					: !!item.files.png32 && !!item.files.png128;
			});
		}

		return tokenItems.every(item => {
			if (!item.chainId || !isEvmAddress(item.address) || !item.files.svg) return false;
			return item.genPng
				? !!item.preview.png32 && !!item.preview.png128
				: !!item.files.png32 && !!item.files.png128;
		});
	}, [chainItems, mode, tokenItems]);

	const setTokenItem = (id: string, updater: (item: TokenItem) => TokenItem) => {
		setTokenItems(items => items.map(item => (item.id === id ? updater(item) : item)));
	};

	const setChainItem = (id: string, updater: (item: ChainItem) => ChainItem) => {
		setChainItems(items => items.map(item => (item.id === id ? updater(item) : item)));
	};

	const setTokenFile = (id: string, kind: AssetFileKind, file: File) => {
		const item = tokenItems.find(current => current.id === id);
		setTokenItem(id, current => applyFileToToken(current, kind, file));
		if (kind === 'svg' && item?.genPng) void generateTokenPngs(id, file);
	};

	const setChainFile = (id: string, kind: AssetFileKind, file: File) => {
		const item = chainItems.find(current => current.id === id);
		setChainItem(id, current => applyFileToChain(current, kind, file));
		if (kind === 'svg' && item?.genPng) void generateChainPngs(id, file);
	};

	const generateTokenPngs = async (id: string, svgFile: File) => {
		try {
			const pngPreview = await generatePngPreviews(svgFile);
			setTokenItem(id, item => ({...item, preview: {...item.preview, ...pngPreview}}));
		} catch (error: any) {
			setStatus({
				tone: 'error',
				title: 'Could not generate PNG previews',
				message: error?.message || 'Try a simpler SVG or upload PNG files manually.'
			});
		}
	};

	const generateChainPngs = async (id: string, svgFile: File) => {
		try {
			const pngPreview = await generatePngPreviews(svgFile);
			setChainItem(id, item => ({...item, preview: {...item.preview, ...pngPreview}}));
		} catch (error: any) {
			setStatus({
				tone: 'error',
				title: 'Could not generate PNG previews',
				message: error?.message || 'Try a simpler SVG or upload PNG files manually.'
			});
		}
	};

	useEffect(() => {
		let cancelled = false;
		const urlParams = readUploadUrlParams();

		const restoreDraft = async () => {
			try {
				const draft = await readUploadDraft();
				if (cancelled) return;

				if (!draft) {
					applyUploadUrlParams(urlParams, setMode, setChainItems, setTokenItems);
					return;
				}

				setMode(draft.mode);
				const restoredChainItems = restoreChainDraftItems(draft);
				const restoredTokenItems = (draft.tokenItems.length ? draft.tokenItems : [createTokenItem()]).map(
					item => ({
						...createTokenItem(),
						...item,
						preview: buildPreviewFromFiles(item.files),
						resolvingName: false,
						resolveError: '',
						addressValid: !item.address || isEvmAddress(item.address)
					})
				);
				setChainItems(applyUrlParamsToChainItems(restoredChainItems, urlParams));
				setTokenItems(applyUrlParamsToTokenItems(restoredTokenItems, urlParams));
				if (urlParams.mode) setMode(urlParams.mode);
				else if (urlParams.address) setMode('token');

				restoredChainItems.forEach(item => {
					if (item.genPng && item.files.svg) void generateChainPngs(item.id, item.files.svg);
				});
				draft.tokenItems.forEach(item => {
					if (item.genPng && item.files.svg) void generateTokenPngs(item.id, item.files.svg);
				});
			} catch {
				if (!cancelled) applyUploadUrlParams(urlParams, setMode, setChainItems, setTokenItems);
				// Draft restore is a convenience; keep the upload form usable if browser storage is unavailable.
			} finally {
				if (!cancelled) setDraftReady(true);
			}
		};

		void restoreDraft();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!draftReady) return;
		void saveUploadDraft({
			version: 1,
			savedAt: Date.now(),
			mode,
			chainItems: chainItems.map(item => ({
				id: item.id,
				chainId: item.chainId,
				genPng: item.genPng,
				files: item.files
			})),
			tokenItems: tokenItems.map(item => ({
				id: item.id,
				chainId: item.chainId,
				address: item.address,
				name: item.name,
				genPng: item.genPng,
				files: item.files
			}))
		});
	}, [chainItems, draftReady, mode, tokenItems]);

	const resolveTokenName = async (id: string) => {
		const item = tokenItems.find(current => current.id === id);
		if (!item || item.name || !item.chainId || !isEvmAddress(item.address)) return;

		setTokenItem(id, current => ({...current, resolvingName: true, resolveError: ''}));
		try {
			const name = await fetchErc20Name(item.chainId, item.address);
			setTokenItem(id, current => ({...current, name: current.name || name, resolvingName: false}));
		} catch {
			setTokenItem(id, current => ({
				...current,
				resolvingName: false,
				resolveError: 'Could not fetch token name. Please verify the chain and address.'
			}));
		}
	};

	const resetFirstAsset = () => {
		if (mode === 'token') {
			tokenItems.forEach(item => revokePreviewMap(item.preview));
			setTokenItems([createTokenItem()]);
			return;
		}

		chainItems.forEach(item => revokePreviewMap(item.preview));
		setChainItems([createChainItem()]);
	};

	const clearTokenItem = (id: string, preserveId = false) => {
		const item = tokenItems.find(current => current.id === id);
		if (item) revokePreviewMap(item.preview);
		setTokenItem(id, () => (preserveId ? {...createTokenItem(), id} : createTokenItem()));
	};

	const removeTokenItem = (id: string) => {
		const item = tokenItems.find(current => current.id === id);
		if (item) revokePreviewMap(item.preview);
		setTokenItems(items => items.filter(current => current.id !== id));
	};

	const clearChainItem = (id: string, preserveId = false) => {
		const item = chainItems.find(current => current.id === id);
		if (item) revokePreviewMap(item.preview);
		setChainItem(id, () => (preserveId ? {...createChainItem(), id} : createChainItem()));
	};

	const removeChainItem = (id: string) => {
		const item = chainItems.find(current => current.id === id);
		if (item) revokePreviewMap(item.preview);
		setChainItems(items => items.filter(current => current.id !== id));
	};

	const openReview = (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setStatus({
				tone: 'error',
				title: 'Sign in with GitHub first',
				message: 'GitHub access is required so the tool can create a branch and open a PR.'
			});
			return;
		}

		if (mode === 'chain' && hasDuplicateChainIds(chainItems)) {
			setStatus({
				tone: 'error',
				title: 'Duplicate chain IDs',
				message: 'Each chain asset in the same upload needs a unique chain ID.'
			});
			return;
		}

		const metadata = buildDefaultPrMetadata(mode, tokenItems, chainItems);
		setPrTitle(metadata.title);
		setPrBody(metadata.body);
		setReviewOpen(true);
	};

	const confirmAndSubmit = async () => {
		if (!token) return;
		setSubmitting(true);
		setStatus({tone: 'info', title: 'Creating PR', message: 'Uploading images and preparing a GitHub branch.'});

		try {
			const reqUrl = new URL('/api/upload', API_BASE_URL).toString();
			const form = await buildFormData({
				mode,
				chainItems,
				tokenItems,
				prMeta: {title: prTitle, body: prBody}
			});
			const res = await fetch(reqUrl, {method: 'POST', headers: {Authorization: `Bearer ${token}`}, body: form});
			if (!res.ok) {
				setStatus({tone: 'error', title: 'Upload failed', message: await readApiError(res)});
				return;
			}

			const json = await res.json();
			setStatus({
				tone: 'success',
				title: 'Pull request created',
				message: 'Review the generated PR on GitHub before merging.',
				prUrl: json?.prUrl
			});
			setReviewOpen(false);
			void clearUploadDraft();
			tokenItems.forEach(item => revokePreviewMap(item.preview));
			chainItems.forEach(item => revokePreviewMap(item.preview));
			setTokenItems([createTokenItem()]);
			setChainItems([createChainItem()]);
		} catch (error: any) {
			setStatus({tone: 'error', title: 'Upload failed', message: error?.message || 'Please try again.'});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			{status && (
				<StatusBanner
					tone={status.tone}
					title={status.title}
					message={status.message}
					onDismiss={() => setStatus(null)}
					action={
						status.prUrl ? (
							<a
								href={status.prUrl}
								target="_blank"
								rel="noreferrer"
								className="font-medium underline">
								Open PR
							</a>
						) : null
					}
				/>
			)}

			<form
				onSubmit={openReview}
				className="space-y-6 rounded-md border bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h2 className="text-sm font-medium text-gray-700">Asset type</h2>
					<SegmentedToggle
						className="w-full sm:max-w-xs"
						options={[
							{value: 'token', label: 'Token Asset'},
							{value: 'chain', label: 'Chain Asset'}
						]}
						value={mode}
						onChange={value => setMode(value as 'token' | 'chain')}
					/>
				</div>

				<div className="rounded-md border p-4">
					<div className="mb-4">
						<h3 className="text-base font-medium text-gray-900">First asset to add</h3>
					</div>

					{mode === 'token' ? (
						<TokenAssetCard
							item={tokenItems[0]}
							index={0}
							canRemove={false}
							onChange={setTokenItem}
							onFile={setTokenFile}
							onResolveName={resolveTokenName}
							onRemove={() => undefined}
							onClear={id => clearTokenItem(id)}
							onGeneratePngChange={(id, value) => {
								setTokenItem(id, item => ({...item, genPng: value}));
								const item = tokenItems.find(current => current.id === id);
								if (value && item?.files.svg) void generateTokenPngs(id, item.files.svg);
							}}
						/>
					) : (
						<ChainAssetCard
							item={chainItems[0]}
							index={0}
							canRemove={false}
							onChange={setChainItem}
							onFile={setChainFile}
							onRemove={() => undefined}
							onClear={id => clearChainItem(id)}
							onGeneratePngChange={(id, value) => {
								setChainItem(id, item => ({...item, genPng: value}));
								const item = chainItems.find(current => current.id === id);
								if (value && item?.files.svg) void generateChainPngs(id, item.files.svg);
							}}
						/>
					)}
					<div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
						<button
							type="button"
							className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
							onClick={resetFirstAsset}>
							Clear
						</button>
					</div>
				</div>

				{mode === 'token' &&
					tokenItems.slice(1).map((item, index) => (
						<TokenAssetCard
							key={item.id}
							item={item}
							index={index + 1}
							canRemove
							onChange={setTokenItem}
							onFile={setTokenFile}
							onResolveName={resolveTokenName}
							onRemove={removeTokenItem}
							onClear={id => clearTokenItem(id, true)}
							onGeneratePngChange={(id, value) => {
								setTokenItem(id, current => ({...current, genPng: value}));
								const current = tokenItems.find(candidate => candidate.id === id);
								if (value && current?.files.svg) void generateTokenPngs(id, current.files.svg);
							}}
						/>
					))}

				{mode === 'chain' &&
					chainItems.slice(1).map((item, index) => (
						<ChainAssetCard
							key={item.id}
							item={item}
							index={index + 1}
							canRemove
							onChange={setChainItem}
							onFile={setChainFile}
							onRemove={removeChainItem}
							onClear={id => clearChainItem(id, true)}
							onGeneratePngChange={(id, value) => {
								setChainItem(id, current => ({...current, genPng: value}));
								const current = chainItems.find(candidate => candidate.id === id);
								if (value && current?.files.svg) void generateChainPngs(id, current.files.svg);
							}}
						/>
					))}

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						onClick={() => {
							if (mode === 'token') setTokenItems(items => [...items, createTokenItem()]);
							else setChainItems(items => [...items, createChainItem()]);
						}}>
						{mode === 'token' ? '+ Add Token Asset' : '+ Add Chain Asset'}
					</button>
					<button
						type="submit"
						disabled={!canSubmit || !token || submitting}
						className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						title={!token ? 'Sign in with GitHub to enable' : ''}>
						Submit PR
					</button>
				</div>
			</form>

			<PrReviewDialog
				open={reviewOpen}
				title={prTitle}
				body={prBody}
				submitting={submitting}
				onTitleChange={setPrTitle}
				onBodyChange={setPrBody}
				onCancel={() => setReviewOpen(false)}
				onConfirm={confirmAndSubmit}
			/>
		</div>
	);
};

type TokenAssetCardProps = {
	item: TokenItem;
	index: number;
	canRemove: boolean;
	onChange: (id: string, updater: (item: TokenItem) => TokenItem) => void;
	onFile: (id: string, kind: AssetFileKind, file: File) => void;
	onGeneratePngChange: (id: string, value: boolean) => void;
	onResolveName: (id: string) => void;
	onRemove: (id: string) => void;
	onClear: (id: string) => void;
};

const TokenAssetCard: React.FC<TokenAssetCardProps> = ({
	item,
	index,
	canRemove,
	onChange,
	onFile,
	onGeneratePngChange,
	onResolveName,
	onRemove,
	onClear
}) => {
	const label = index === 0 ? 'token asset' : `token asset ${index + 1}`;

	return (
		<div className={index === 0 ? 'space-y-4' : 'rounded-md border p-4'}>
			{index > 0 && (
				<div className="mb-3">
					<div className="text-sm font-medium text-gray-700">Token Asset #{index + 1}</div>
				</div>
			)}
			<div className="space-y-4">
				<ChainInput
					value={item.chainId}
					onChange={value => onChange(item.id, current => ({...current, chainId: value}))}
					onBlur={() => onResolveName(item.id)}
				/>
				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700">Token Address</span>
					<input
						className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={item.address}
						onChange={event =>
							onChange(item.id, current => ({
								...current,
								address: event.target.value,
								addressValid: !event.target.value || isEvmAddress(event.target.value)
							}))
						}
						onBlur={() => onResolveName(item.id)}
						placeholder="0x..."
					/>
					{item.resolvingName && <p className="mt-1 text-xs text-gray-500">Fetching name...</p>}
					{item.resolveError && <p className="mt-1 text-xs text-red-600">{item.resolveError}</p>}
					{item.address && item.addressValid === false && (
						<p className="mt-1 text-xs text-red-600">Invalid EVM address format</p>
					)}
				</label>
				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700">Name (optional)</span>
					<input
						className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						value={item.name}
						onChange={event => onChange(item.id, current => ({...current, name: event.target.value}))}
						placeholder="auto-fills if resolvable"
					/>
				</label>
			</div>
			<AssetFileFields
				label={label}
				genPng={item.genPng}
				files={item.files}
				preview={item.preview}
				onFile={(kind, file) => onFile(item.id, kind, file)}
				onGeneratePngChange={value => onGeneratePngChange(item.id, value)}
			/>
			{index > 0 && (
				<div className="mt-4 flex justify-end gap-3 border-t border-gray-200 pt-4">
					<button
						type="button"
						className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						onClick={() => onClear(item.id)}>
						Clear
					</button>
					{canRemove && (
						<button
							type="button"
							className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
							onClick={() => onRemove(item.id)}>
							Remove
						</button>
					)}
				</div>
			)}
		</div>
	);
};

type ChainAssetCardProps = {
	item: ChainItem;
	index: number;
	canRemove: boolean;
	onChange: (id: string, updater: (item: ChainItem) => ChainItem) => void;
	onFile: (id: string, kind: AssetFileKind, file: File) => void;
	onGeneratePngChange: (id: string, value: boolean) => void;
	onRemove: (id: string) => void;
	onClear: (id: string) => void;
};

const ChainAssetCard: React.FC<ChainAssetCardProps> = ({
	item,
	index,
	canRemove,
	onChange,
	onFile,
	onGeneratePngChange,
	onRemove,
	onClear
}) => {
	const label = index === 0 ? 'chain asset' : `chain asset ${index + 1}`;

	return (
		<div className={index === 0 ? 'space-y-4' : 'rounded-md border p-4'}>
			{index > 0 && (
				<div className="mb-3">
					<div className="text-sm font-medium text-gray-700">Chain Asset #{index + 1}</div>
				</div>
			)}
			<ChainInput
				value={item.chainId}
				onChange={value => onChange(item.id, current => ({...current, chainId: value}))}
			/>
			<AssetFileFields
				label={label}
				genPng={item.genPng}
				files={item.files}
				preview={item.preview}
				onFile={(kind, file) => onFile(item.id, kind, file)}
				onGeneratePngChange={value => onGeneratePngChange(item.id, value)}
			/>
			{index > 0 && (
				<div className="mt-4 flex justify-end gap-3 border-t border-gray-200 pt-4">
					<button
						type="button"
						className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						onClick={() => onClear(item.id)}>
						Clear
					</button>
					{canRemove && (
						<button
							type="button"
							className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
							onClick={() => onRemove(item.id)}>
							Remove
						</button>
					)}
				</div>
			)}
		</div>
	);
};

type AssetFileFieldsProps = {
	label: string;
	genPng: boolean;
	files: AssetFiles;
	preview: PreviewMap;
	onFile: (kind: AssetFileKind, file: File) => void;
	onGeneratePngChange: (value: boolean) => void;
};

const AssetFileFields: React.FC<AssetFileFieldsProps> = ({
	label,
	genPng,
	files,
	preview,
	onFile,
	onGeneratePngChange
}) => {
	return (
		<div className="space-y-4">
			<AssetDropzone
				label={`Upload SVG for ${label}`}
				accept="image/svg+xml"
				previewUrl={preview.svg}
				previewAlt={`${label} SVG preview`}
				emptyText="Drag and drop SVG here"
				onFile={file => onFile('svg', file)}
			/>
			<div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
				<div className="flex items-center justify-between gap-3">
					<span className="text-sm text-gray-700">Generate PNGs</span>
					<Switch
						checked={genPng}
						onChange={onGeneratePngChange}
						className={`${
							genPng ? 'bg-blue-600' : 'bg-gray-200'
						} relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}>
						<span
							className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
								genPng ? 'translate-x-6' : 'translate-x-1'
							}`}
						/>
					</Switch>
				</div>
				{!genPng && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<FileInput
							label="PNG 32x32"
							file={files.png32}
							onFile={file => onFile('png32', file)}
						/>
						<FileInput
							label="PNG 128x128"
							file={files.png128}
							onFile={file => onFile('png128', file)}
						/>
					</div>
				)}
			</div>
			<PreviewGrid
				preview={preview}
				label={label}
			/>
		</div>
	);
};

type FileInputProps = {
	label: string;
	file?: File;
	onFile: (file: File) => void;
};

const FileInput: React.FC<FileInputProps> = ({label, file, onFile}) => {
	return (
		<label className="block">
			<span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
			<input
				type="file"
				accept="image/png"
				className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
				onChange={event => {
					const nextFile = event.target.files?.[0];
					if (nextFile) onFile(nextFile);
				}}
			/>
			{file && <span className="mt-1 block truncate text-xs text-gray-500">{file.name}</span>}
		</label>
	);
};

type ChainInputProps = {
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
};

const ChainInput: React.FC<ChainInputProps> = ({value, onChange, onBlur}) => {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-medium text-gray-700">Chain</span>
			<input
				className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				list="chains-list"
				value={value}
				onChange={event => onChange(event.target.value)}
				onBlur={onBlur}
				placeholder="enter/select chain"
			/>
			<datalist id="chains-list">
				{chainOptions.map(chain => (
					<option
						key={chain.id}
						value={String(chain.id)}>
						{chain.name}
					</option>
				))}
			</datalist>
		</label>
	);
};

function applyFileToToken(item: TokenItem, kind: AssetFileKind, file: File): TokenItem {
	revokePreviewUrl(item.preview[kind]);
	return {
		...item,
		files: {...item.files, [kind]: file},
		preview: {...item.preview, [kind]: URL.createObjectURL(file)}
	};
}

function applyFileToChain(item: ChainItem, kind: AssetFileKind, file: File): ChainItem {
	revokePreviewUrl(item.preview[kind]);
	return {
		...item,
		files: {...item.files, [kind]: file},
		preview: {...item.preview, [kind]: URL.createObjectURL(file)}
	};
}

function buildPreviewFromFiles(files: AssetFiles): PreviewMap {
	return {
		svg: files.svg ? URL.createObjectURL(files.svg) : undefined,
		png32: files.png32 ? URL.createObjectURL(files.png32) : undefined,
		png128: files.png128 ? URL.createObjectURL(files.png128) : undefined
	};
}

function restoreChainDraftItems(draft: Awaited<ReturnType<typeof readUploadDraft>>): ChainItem[] {
	if (!draft) return [createChainItem()];
	const draftItems =
		draft.chainItems && draft.chainItems.length
			? draft.chainItems
			: [
					{
						id: createAssetId(),
						chainId: draft.chainId || '',
						genPng: draft.chainGenPng ?? true,
						files: draft.chainFiles || {}
					}
			  ];

	return draftItems.map(item => ({
		...createChainItem(),
		...item,
		preview: buildPreviewFromFiles(item.files)
	}));
}

function readUploadUrlParams(): UploadUrlParams {
	if (typeof window === 'undefined') return {};

	const params = new URLSearchParams(window.location.search);
	const modeParam = readFirstSearchValue(params, ['mode', 'type', 'target']);
	const chainId = readFirstSearchValue(params, ['chain', 'chainId']);
	const address = readFirstSearchValue(params, ['address', 'token']);
	const name = readFirstSearchValue(params, ['name']);
	const mode = modeParam === 'chain' ? 'chain' : modeParam === 'token' || address ? 'token' : undefined;

	return {mode, chainId, address, name};
}

function readFirstSearchValue(params: URLSearchParams, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = params.get(key)?.trim();
		if (value) return value;
	}
	return undefined;
}

function applyUploadUrlParams(
	params: UploadUrlParams,
	setMode: React.Dispatch<React.SetStateAction<'token' | 'chain'>>,
	setChainItems: React.Dispatch<React.SetStateAction<ChainItem[]>>,
	setTokenItems: React.Dispatch<React.SetStateAction<TokenItem[]>>
) {
	setChainItems(items => applyUrlParamsToChainItems(items, params));
	setTokenItems(items => applyUrlParamsToTokenItems(items, params));
	if (params.mode) setMode(params.mode);
	else if (params.address) setMode('token');
}

function applyUrlParamsToChainItems(items: ChainItem[], params: UploadUrlParams): ChainItem[] {
	if (!params.chainId) return items;
	const [firstItem, ...restItems] = items.length ? items : [createChainItem()];
	return [{...firstItem, chainId: params.chainId}, ...restItems];
}

function applyUrlParamsToTokenItems(items: TokenItem[], params: UploadUrlParams): TokenItem[] {
	if (!params.chainId && !params.address && !params.name) return items;

	const [firstItem, ...restItems] = items.length ? items : [createTokenItem()];
	const nextAddress = params.address ?? firstItem.address;
	return [
		{
			...firstItem,
			chainId: params.chainId ?? firstItem.chainId,
			address: nextAddress,
			name: params.name ?? firstItem.name,
			addressValid: !nextAddress || isEvmAddress(nextAddress),
			resolveError: ''
		},
		...restItems
	];
}

function hasDuplicateChainIds(items: ChainItem[]): boolean {
	const chainIds = items.map(item => item.chainId.trim()).filter(Boolean);
	return new Set(chainIds).size !== chainIds.length;
}

async function fetchErc20Name(chainIdStr: string, address: string): Promise<string> {
	const cid = Number(chainIdStr);
	if (!cid || Number.isNaN(cid)) throw new Error('Invalid chain');

	try {
		const url = new URL('/api/erc20-name', API_BASE_URL).toString();
		const res = await fetch(url, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({chainId: cid, address})
		});
		if (!res.ok) throw new Error(await res.text());
		const json = await res.json();
		if (json?.name) return json.name as string;
	} catch {
		// Fall through to a direct RPC attempt for local development when the API is unavailable.
	}

	const rpc = getRpcUrl(cid);
	if (!rpc) throw new Error('No RPC configured for this chain');
	const payload = {
		jsonrpc: '2.0',
		id: Math.floor(Math.random() * 1e9),
		method: 'eth_call',
		params: [{to: address, data: '0x06fdde03'}, 'latest']
	};
	const res = await fetch(rpc, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(`RPC ${res.status}`);
	const json = await res.json();
	if (json?.error) throw new Error(json.error?.message || 'RPC error');
	const result: string | undefined = json?.result;
	if (!result || result === '0x') throw new Error('Empty result');
	return decodeAbiString(result);
}

function decodeAbiString(resultHex: string): string {
	const hex = resultHex.startsWith('0x') ? resultHex.slice(2) : resultHex;
	if (hex.length >= 192) {
		const lenHex = hex.slice(64, 128);
		const len = parseInt(lenHex || '0', 16);
		const dataHex = hex.slice(128, 128 + len * 2);
		return hexToUtf8(dataHex);
	}
	if (hex.length === 64) return hexToUtf8(hex.replace(/00+$/, ''));
	return hexToUtf8(hex);
}

function hexToUtf8(hex: string): string {
	const bytes = hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
	return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\u0000+$/, '');
}

function buildDefaultPrMetadata(mode: 'token' | 'chain', tokenItems: TokenItem[], chainItems: ChainItem[]): PrMetadata {
	if (mode === 'chain') {
		const chains = chainItems.map(item => item.chainId).filter(Boolean);
		const paths = chainItems.flatMap(item => [
			`/chain/${item.chainId}/logo.svg`,
			`/chain/${item.chainId}/logo-32.png`,
			`/chain/${item.chainId}/logo-128.png`
		]);
		return {
			title: `feat: add chain assets (${chains.length})`,
			body: [`Chains: ${chains.join(', ')}`, '', 'Uploaded locations:', ...paths.map(path => `- ${path}`)].join(
				'\n'
			)
		};
	}

	const addresses = tokenItems.map(item => item.address.toLowerCase()).filter(Boolean);
	const chains = tokenItems.map(item => item.chainId).filter(Boolean);
	const uniqueChains = Array.from(new Set(chains));
	const paths = tokenItems.flatMap(item => [
		`/token/${item.chainId}/${item.address.toLowerCase()}/logo.svg`,
		`/token/${item.chainId}/${item.address.toLowerCase()}/logo-32.png`,
		`/token/${item.chainId}/${item.address.toLowerCase()}/logo-128.png`
	]);

	return {
		title: `feat: add token assets (${addresses.length})`,
		body: [
			`Chains: ${uniqueChains.join(', ')}`,
			`Addresses: ${addresses.join(', ')}`,
			'',
			'Uploaded locations:',
			...paths.map(path => `- ${path}`)
		].join('\n')
	};
}

async function buildFormData(params: {
	mode: 'token' | 'chain';
	chainItems: ChainItem[];
	tokenItems: TokenItem[];
	prMeta: PrMetadata;
}) {
	const body = new FormData();
	body.append('target', params.mode);
	body.append('chainId', params.chainItems[0]?.chainId || '');
	body.append('prTitle', params.prMeta.title);
	body.append('prBody', params.prMeta.body);

	if (params.mode === 'chain') {
		const items = params.chainItems.map(item => ({
			id: item.id,
			chainId: item.chainId
		}));
		body.append('items', JSON.stringify(items));
		await Promise.all(
			params.chainItems.map(item => appendAssetFiles(body, item.id, item.files, item.preview, true))
		);
		return body;
	}

	const items = params.tokenItems.map(item => ({
		id: item.id,
		chainId: item.chainId,
		address: item.address
	}));
	body.append('items', JSON.stringify(items));
	await Promise.all(params.tokenItems.map(item => appendAssetFiles(body, item.id, item.files, item.preview, true)));
	return body;
}

async function appendAssetFiles(
	body: FormData,
	prefix: string,
	files: AssetFiles,
	preview: PreviewMap,
	usePrefix: boolean
) {
	const key = (name: AssetFileKind) => (usePrefix ? `${name}_${prefix}` : name);
	if (files.svg) body.append(key('svg'), files.svg);
	if (files.png32) body.append(key('png32'), files.png32);
	else if (preview.png32) body.append(key('png32'), await dataUrlToFile(preview.png32, 'logo-32.png'));
	if (files.png128) body.append(key('png128'), files.png128);
	else if (preview.png128) body.append(key('png128'), await dataUrlToFile(preview.png128, 'logo-128.png'));
}

async function readApiError(res: Response) {
	const contentType = res.headers.get('content-type') || '';
	try {
		if (contentType.includes('application/json')) {
			const json = await res.json();
			return json?.error || JSON.stringify(json);
		}
		return (await res.text()) || `HTTP ${res.status}`;
	} catch {
		return `HTTP ${res.status}`;
	}
}

export const UploadRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: UploadComponent
});
