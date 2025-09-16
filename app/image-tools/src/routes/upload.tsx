import React, {Fragment, useEffect, useMemo, useState} from 'react';
import {createRoute} from '@tanstack/react-router';
import {rootRoute} from '../router';
import {GithubSignIn} from '../components/GithubSignIn';
import {API_BASE_URL} from '../lib/api';
import {Dialog, Switch, Transition} from '@headlessui/react';
import {getRpcUrl, isEvmAddress, listKnownChains} from '../lib/chains';
import {SegmentedToggle} from '../components/SegmentedToggle';

type TokenItem = {
	chainId: string;
	address: string;
	name?: string;
	genPng: boolean;
	files: {svg?: File; png32?: File; png128?: File};
	preview: {svg?: string; png32?: string; png128?: string};
	resolvingName?: boolean;
	resolveError?: string;
	addressValid?: boolean;
};

export const UploadComponent: React.FC = () => {
	const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('github_token'));
	const [mode, setMode] = useState<'token' | 'chain'>('token');
	const [chainId, setChainId] = useState('');
	const [chainGenPng, setChainGenPng] = useState(true);
	// Chain single
	const [chainFiles, setChainFiles] = useState<{svg?: File; png32?: File; png128?: File}>({});
	const [chainPreview, setChainPreview] = useState<{svg?: string; png32?: string; png128?: string}>({});
	// Token items
	const [tokenItems, setTokenItems] = useState<TokenItem[]>([
		{chainId: '', address: '', name: '', genPng: true, files: {}, preview: {}}
	]);

	// PR review modal state
	const [reviewOpen, setReviewOpen] = useState(false);
	const [prTitle, setPrTitle] = useState('');
	const [prBody, setPrBody] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const canSubmit = useMemo(() => {
		if (mode === 'chain') {
			if (!chainId) return false;
			if (!chainFiles.svg) return false;
			if (!chainGenPng && (!chainFiles.png32 || !chainFiles.png128)) return false;
			return true;
		}
		if (!tokenItems.length) return false;
		for (const it of tokenItems) {
			if (!it.chainId || !it.address || !it.files.svg) return false;
			if (!it.genPng && (!it.files.png32 || !it.files.png128)) return false;
		}
		return true;
	}, [chainId, mode, chainFiles, tokenItems, chainGenPng]);

	useEffect(() => {
		const handler = () => setToken(sessionStorage.getItem('github_token'));
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	}, []);

	// ---- Helpers: Token name lookup via JSON-RPC ----
	async function fetchErc20Name(chainIdStr: string, address: string): Promise<string> {
		const cid = Number(chainIdStr);
		if (!cid || Number.isNaN(cid)) throw new Error('Invalid chain');
		// Prefer server endpoint to avoid CORS and centralize env
		try {
			const url = new URL('/api/erc20-name', API_BASE_URL).toString();
			const res = await fetch(url, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({chainId: cid, address})
			});
			if (!res.ok) throw new Error(await res.text());
			const j = await res.json();
			if (j?.name) return j.name as string;
		} catch (e) {
			// fall through to direct RPC attempt
		}
		const rpc = getRpcUrl(cid);
		if (!rpc) throw new Error('No RPC configured for this chain');
		const data = '0x06fdde03';
		const payload = {
			jsonrpc: '2.0',
			id: Math.floor(Math.random() * 1e9),
			method: 'eth_call',
			params: [{to: address, data}, 'latest']
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
		// Dynamic string encoding: offset (32 bytes), length (32 bytes), data
		if (hex.length >= 192) {
			const lenHex = hex.slice(64, 128);
			const len = parseInt(lenHex || '0', 16);
			const dataHex = hex.slice(128, 128 + len * 2);
			return hexToUtf8(dataHex);
		}
		// Fallback: bytes32-like (padded)
		if (hex.length === 64) {
			return hexToUtf8(hex.replace(/00+$/, ''));
		}
		// Last resort: try to interpret whatever is there
		return hexToUtf8(hex);
	}

	function hexToUtf8(hex: string): string {
		const bytes = hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || [];
		return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\u0000+$/, '');
	}

	const onChainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		const name = e.target.name as 'svg' | 'png32' | 'png128';
		setChainFiles(prev => ({...prev, [name]: f}));
		const url = URL.createObjectURL(f);
		setChainPreview(p => ({...p, [name]: url}) as any);
	};

	const onTokenFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		const name = e.target.name as 'svg' | 'png32' | 'png128';
		setTokenItems(prev => {
			const arr = [...prev];
			const item = {...arr[index]};
			item.files = {...item.files, [name]: f};
			const url = URL.createObjectURL(f);
			item.preview = {...item.preview, [name]: url} as any;
			arr[index] = item;
			return arr;
		});
	};

	// Generate PNG previews for chain when requested
	useEffect(() => {
		async function makePngPreviews(svgFile: File) {
			const svgUrl = URL.createObjectURL(svgFile);
			const img = new Image();
			img.src = svgUrl;
			await img.decode().catch(() => {});
			const gen = async (size: number) => {
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d');
				if (!ctx) return '';
				ctx.clearRect(0, 0, size, size);
				const scale = Math.min(size / img.width, size / img.height);
				const w = img.width * scale;
				const h = img.height * scale;
				const x = (size - w) / 2;
				const y = (size - h) / 2;
				ctx.drawImage(img, x, y, w, h);
				return canvas.toDataURL('image/png');
			};
			const p32 = await gen(32);
			const p128 = await gen(128);
			setChainPreview(p => ({...p, png32: p32, png128: p128}));
			URL.revokeObjectURL(svgUrl);
		}
		if (mode === 'chain' && chainGenPng && chainFiles.svg) {
			makePngPreviews(chainFiles.svg);
		}
	}, [chainGenPng, chainFiles.svg, mode]);

	// Generate PNG previews for each token item
	useEffect(() => {
		if (mode !== 'token') return;
		tokenItems.forEach(async (it, idx) => {
			if (!it.genPng || !it.files.svg) return;
			const svgUrl = URL.createObjectURL(it.files.svg);
			const img = new Image();
			img.src = svgUrl;
			await img.decode().catch(() => {});
			const gen = async (size: number) => {
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d');
				if (!ctx) return '';
				ctx.clearRect(0, 0, size, size);
				const scale = Math.min(size / img.width, size / img.height);
				const w = img.width * scale;
				const h = img.height * scale;
				const x = (size - w) / 2;
				const y = (size - h) / 2;
				ctx.drawImage(img, x, y, w, h);
				return canvas.toDataURL('image/png');
			};
			const p32 = await gen(32);
			const p128 = await gen(128);
			setTokenItems(prev => {
				const arr = [...prev];
				const cur = arr[idx];
				if (cur.preview.png32 === p32 && cur.preview.png128 === p128) return prev;
				arr[idx] = {...cur, preview: {...cur.preview, png32: p32, png128: p128}};
				return arr;
			});
			URL.revokeObjectURL(svgUrl);
		});
	}, [
		JSON.stringify(
			tokenItems.map(i => ({
				svg: i.files.svg ? i.files.svg.name + ':' + i.files.svg.lastModified : '',
				gen: i.genPng
			}))
		),
		mode
	]);

	function buildDefaultPrMetadata() {
		if (mode === 'token') {
			const addressesForBody = tokenItems.map(i => (i.address?.toLowerCase?.() as string) || '').filter(Boolean);
			const chainsForBody = tokenItems.map(i => i.chainId || chainId || '').map(String);
			const uniqueChains = Array.from(new Set(chainsForBody.filter(Boolean)));
			const title = `feat: add token assets (${addressesForBody.length})`;
				const directoryLocations = addressesForBody.flatMap((addr, i) => [
					`/token/${chainsForBody[i]}/${addr}/logo.svg`,
					`/token/${chainsForBody[i]}/${addr}/logo-32.png`,
					`/token/${chainsForBody[i]}/${addr}/logo-128.png`
				]);
			const body = [
				`Chains: ${uniqueChains.join(', ')}`,
				`Addresses: ${addressesForBody.join(', ')}`,
				'',
				'Directory Location of uploaded logos:',
				...directoryLocations.map(u => `- ${u}`)
			].join('\n');
			return {title, body};
		} else {
			const title = `feat: add chain assets on ${chainId}`;
			const sampleUrls = [
				`/chain/${chainId}/logo.svg`,
				`/chain/${chainId}/logo-32.png`,
				`/chain/${chainId}/logo-128.png`
			];
			const body = [
				`Chain: ${chainId}`,
				'',
				'Directory Location of uploaded logos:',
				...sampleUrls.map(u => `- ${u}`)
			].join('\n');
			return {title, body};
		}
	}

	async function dataUrlToFile(dataUrl: string, filename: string, type = 'image/png'): Promise<File> {
		const res = await fetch(dataUrl);
		const blob = await res.blob();
		return new File([blob], filename, {type});
	}

	async function buildFormData(withPrMeta?: {title: string; body: string}) {
		const body = new FormData();
		body.append('target', mode);
		body.append('chainId', chainId);
		if (mode === 'token') {
			for (let i = 0; i < tokenItems.length; i++) {
				const it = tokenItems[i];
				body.append(`chainId_${i}`, it.chainId);
				if (it.address) body.append('address', it.address);
				if (it.files.svg) body.append(`svg_${i}`, it.files.svg);
				// Ensure PNGs are attached; if genPng is true and files are missing, use previews to create PNGs client-side.
				const needPng32 = !it.files.png32 && !!it.preview.png32;
				const needPng128 = !it.files.png128 && !!it.preview.png128;
				if (needPng32) body.append(`png32_${i}`, await dataUrlToFile(it.preview.png32!, 'logo-32.png'));
				if (needPng128) body.append(`png128_${i}`, await dataUrlToFile(it.preview.png128!, 'logo-128.png'));
				// Also include any user-provided PNGs
				if (it.files.png32) body.append(`png32_${i}`, it.files.png32);
				if (it.files.png128) body.append(`png128_${i}`, it.files.png128);
			}
		} else {
			if (chainFiles.svg) body.append('svg', chainFiles.svg);
			// Ensure chain PNGs are attached; generate from previews if needed.
			const needP32 = !chainFiles.png32 && !!chainPreview.png32;
			const needP128 = !chainFiles.png128 && !!chainPreview.png128;
			if (needP32) body.append('png32', await dataUrlToFile(chainPreview.png32!, 'logo-32.png'));
			if (needP128) body.append('png128', await dataUrlToFile(chainPreview.png128!, 'logo-128.png'));
			if (chainFiles.png32) body.append('png32', chainFiles.png32);
			if (chainFiles.png128) body.append('png128', chainFiles.png128);
		}
		if (withPrMeta) {
			body.append('prTitle', withPrMeta.title);
			body.append('prBody', withPrMeta.body);
		}
		return body;
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!token) return alert('Sign in with GitHub first.');
		const {title, body} = buildDefaultPrMetadata();
		setPrTitle(title);
		setPrBody(body);
		setReviewOpen(true);
	};

	async function confirmAndSubmit() {
		if (!token) return alert('Sign in with GitHub first.');
		setSubmitting(true);
		try {
			const reqUrl = new URL('/api/upload', API_BASE_URL).toString();
			const form = await buildFormData({title: prTitle, body: prBody});
			const res = await fetch(reqUrl, {method: 'POST', headers: {Authorization: `Bearer ${token}`}, body: form});
			if (!res.ok) {
				const ct = res.headers.get('content-type') || '';
				let msg = '';
				try {
					if (ct.includes('application/json')) {
						const j = await res.json();
						msg = j?.error || JSON.stringify(j);
					} else {
						msg = await res.text();
					}
				} catch {}
				alert(`Upload failed: ${msg || res.status}`);
				return;
			}
			const json = await res.json();
			if (json?.prUrl) {
				window.open(json.prUrl, '_blank');
			} else {
				alert('Upload complete, PR created.');
			}
			// Reset form state after successful PR creation
			setReviewOpen(false);
			setTokenItems([{chainId: '', address: '', name: '', genPng: true, files: {}, preview: {}}]);
			setChainId('');
			setChainGenPng(true);
			setChainFiles({});
			setChainPreview({});
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="mx-auto max-w-3xl">
			<form
				onSubmit={onSubmit}
				className="space-y-6 rounded-md border bg-white p-6 shadow-sm">
				{/* First asset card */}
				<div className="rounded-md border p-4">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-base font-medium text-gray-900">First asset to add</h3>
						<div className="flex items-center gap-2">
							<button
								type="button"
								className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
								onClick={() => {
									if (mode === 'token') {
										setTokenItems([
											{chainId: '', address: '', name: '', genPng: true, files: {}, preview: {}}
										]);
									} else {
										setChainId('');
										setChainGenPng(true);
										setChainFiles({});
										setChainPreview({});
									}
								}}>
								Clear
							</button>
							<SegmentedToggle
								className="max-w-xs"
								options={[
									{value: 'token', label: 'Token Asset'},
									{value: 'chain', label: 'Chain Asset'}
								]}
								value={mode}
								onChange={v => setMode(v as 'token' | 'chain')}
							/>
						</div>
					</div>
					<div className="space-y-4">
						<label className="block">
							<span className="mb-1 block text-sm font-medium text-gray-700">Chain</span>
							{mode === 'token' ? (
								<input
									className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
									list="chains-list"
									value={tokenItems[0]?.chainId || ''}
									onChange={e => {
										const v = e.target.value;
										setTokenItems(prev => [{...prev[0], chainId: v}, ...prev.slice(1)]);
									}}
									onBlur={async () => {
										const it = tokenItems[0];
										if (!it || !isEvmAddress(it.address) || it.name) return;
										const cid = Number(it.chainId || chainId);
										if (!cid || Number.isNaN(cid)) return;
										try {
											setTokenItems(prev => [
												{...prev[0], resolvingName: true, resolveError: ''},
												...prev.slice(1)
											]);
											const name = await fetchErc20Name(String(cid), it.address);
											setTokenItems(prev => [
												{
													...prev[0],
													resolvingName: false,
													name: prev[0].name || name,
													resolveError: ''
												},
												...prev.slice(1)
											]);
										} catch (err: any) {
											setTokenItems(prev => [
												{
													...prev[0],
													resolvingName: false,
													resolveError: 'Could not fetch token name. Please verify address.'
												},
												...prev.slice(1)
											]);
										}
									}}
									placeholder="enter/select chain"
								/>
							) : (
								<input
									className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
									list="chains-list"
									value={chainId}
									onChange={e => setChainId(e.target.value)}
									placeholder="enter/select chain"
								/>
							)}
							<datalist id="chains-list">
								{listKnownChains().map(c => (
									<option
										key={c.id}
										value={String(c.id)}>
										{c.name}
									</option>
								))}
							</datalist>
						</label>
						{mode === 'token' && (
							<>
								<label className="block">
									<span className="mb-1 block text-sm font-medium text-gray-700">Token Address</span>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={tokenItems[0]?.address || ''}
										onChange={e =>
											setTokenItems(prev => [
												{
													...prev[0],
													address: e.target.value,
													addressValid: isEvmAddress(e.target.value)
												},
												...prev.slice(1)
											])
										}
										onBlur={async () => {
											const it = tokenItems[0];
											if (!it || !isEvmAddress(it.address)) return;
											const cid = Number(it.chainId || chainId);
											if (!cid || Number.isNaN(cid)) return;
											try {
												setTokenItems(prev => [
													{...prev[0], resolvingName: true, resolveError: ''},
													...prev.slice(1)
												]);
												const name = await fetchErc20Name(String(cid), it.address);
												setTokenItems(prev => [
													{
														...prev[0],
														resolvingName: false,
														name: prev[0].name || name,
														resolveError: ''
													},
													...prev.slice(1)
												]);
											} catch (err: any) {
												setTokenItems(prev => [
													{
														...prev[0],
														resolvingName: false,
														resolveError:
															'Could not fetch token name. Please verify address.'
													},
													...prev.slice(1)
												]);
											}
										}}
										placeholder="0x..."
									/>
									{tokenItems[0]?.resolvingName && (
										<p className="mt-1 text-xs text-gray-500">Fetching name…</p>
									)}
									{tokenItems[0]?.resolveError && (
										<p className="mt-1 text-xs text-red-600">{tokenItems[0]?.resolveError}</p>
									)}
									{tokenItems[0]?.address && tokenItems[0]?.addressValid === false && (
										<p className="mt-1 text-xs text-red-600">Invalid EVM address format</p>
									)}
								</label>
								<label className="block">
									<span className="mb-1 block text-sm font-medium text-gray-700">
										Name (optional)
									</span>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={tokenItems[0]?.name || ''}
										onChange={e =>
											setTokenItems(prev => [
												{...prev[0], name: e.target.value},
												...prev.slice(1)
											])
										}
										placeholder="auto-fills if resolvable"
									/>
								</label>
							</>
						)}
						{/* SVG input row */}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							{/* Drop area */}
							<div className="sm:col-span-2">
								<div
									onDragOver={e => e.preventDefault()}
									onDrop={e => {
										e.preventDefault();
										const f = e.dataTransfer.files?.[0];
										if (!f) return;
										if (mode === 'token') {
											onTokenFileChange(0, {target: {files: [f], name: 'svg'}} as any);
										} else {
											onChainFileChange({target: {files: [f], name: 'svg'}} as any);
										}
									}}
									className="flex h-40 w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600">
									{mode === 'token' ? (
										tokenItems[0]?.preview.svg ? (
											<img
												src={tokenItems[0]?.preview.svg}
												className="max-h-36"
											/>
										) : (
											<span>Drag & Drop SVG here</span>
										)
									) : chainPreview.svg ? (
										<img
											src={chainPreview.svg}
											className="max-h-36"
										/>
									) : (
										<span>Drag & Drop SVG here</span>
									)}
								</div>
							</div>
							{/* Extras column */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-gray-700">Generate PNGs</span>
									<Switch
										checked={mode === 'token' ? !!tokenItems[0]?.genPng : chainGenPng}
										onChange={(v: boolean) => {
											if (mode === 'token')
												setTokenItems(prev => [{...prev[0], genPng: v}, ...prev.slice(1)]);
											else setChainGenPng(v);
										}}
										className={`${
											(mode === 'token' ? tokenItems[0]?.genPng : chainGenPng)
												? 'bg-blue-600'
												: 'bg-gray-200'
										} relative inline-flex h-6 w-11 items-center rounded-full transition`}>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
												(mode === 'token' ? tokenItems[0]?.genPng : chainGenPng)
													? 'translate-x-6'
													: 'translate-x-1'
											}`}
										/>
									</Switch>
								</div>
								<div>
									<button
										type="button"
										className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
										onClick={() => {
											const input = document.createElement('input');
											input.type = 'file';
											input.accept = 'image/svg+xml';
											input.onchange = (ev: any) => {
												const f = ev.target.files?.[0];
												if (!f) return;
												if (mode === 'token')
													onTokenFileChange(0, {target: {files: [f], name: 'svg'}} as any);
												else onChainFileChange({target: {files: [f], name: 'svg'}} as any);
											};
											input.click();
										}}>
										Browse SVG…
									</button>
								</div>
								{!(mode === 'token' ? tokenItems[0]?.genPng : chainGenPng) && (
									<div className="space-y-2">
										<label className="block text-xs text-gray-600">PNG 32x32</label>
										<input
											type="file"
											accept="image/png"
											onChange={e =>
												mode === 'token'
													? onTokenFileChange(0, {
															...e,
															target: {...e.target, name: 'png32'}
													  } as any)
													: onChainFileChange({
															...e,
															target: {...e.target, name: 'png32'}
													  } as any)
											}
										/>
										<label className="block text-xs text-gray-600">PNG 128x128</label>
										<input
											type="file"
											accept="image/png"
											onChange={e =>
												mode === 'token'
													? onTokenFileChange(0, {
															...e,
															target: {...e.target, name: 'png128'}
													  } as any)
													: onChainFileChange({
															...e,
															target: {...e.target, name: 'png128'}
													  } as any)
											}
										/>
									</div>
								)}
							</div>
						</div>
						{/* Previews for first card */}
						<div className="mt-4 rounded-md border bg-gray-50 p-3">
							<p className="mb-2 text-sm font-medium text-gray-700">Previews</p>
							<div className="grid grid-cols-3 gap-4">
								<div>
									<p className="mb-1 text-xs text-gray-600">SVG</p>
									<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
										{(mode === 'token' ? tokenItems[0]?.preview.svg : chainPreview.svg) ? (
											<img
												src={
													(mode === 'token'
														? tokenItems[0]?.preview.svg
														: chainPreview.svg) as string
												}
												alt="svg"
												className="max-h-28 max-w-28"
											/>
										) : (
											<span className="text-xs text-gray-400">—</span>
										)}
									</div>
								</div>
								<div>
									<p className="mb-1 text-xs text-gray-600">PNG 32x32</p>
									<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
										{(mode === 'token' ? tokenItems[0]?.preview.png32 : chainPreview.png32) ? (
											<img
												src={
													(mode === 'token'
														? tokenItems[0]?.preview.png32
														: chainPreview.png32) as string
												}
												alt="png32"
												className="h-8 w-8"
											/>
										) : (
											<span className="text-xs text-gray-400">—</span>
										)}
									</div>
								</div>
								<div>
									<p className="mb-1 text-xs text-gray-600">PNG 128x128</p>
									<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
										{(mode === 'token' ? tokenItems[0]?.preview.png128 : chainPreview.png128) ? (
											<img
												src={
													(mode === 'token'
														? tokenItems[0]?.preview.png128
														: chainPreview.png128) as string
												}
												alt="png128"
												className="h-32 w-32"
											/>
										) : (
											<span className="text-xs text-gray-400">—</span>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Additional token asset cards */}
				{mode === 'token' &&
					tokenItems.slice(1).map((it, idx) => (
						<div
							key={idx + 1}
							className="rounded-md border p-4">
							<div className="mb-3 flex items-center justify-between">
								<div className="text-sm font-medium text-gray-700">Token Asset #{idx + 2}</div>
								<div className="flex items-center gap-3">
									<button
										type="button"
										className="text-sm text-gray-600 hover:underline"
										onClick={() =>
											setTokenItems(p =>
												p.map((x, i) =>
													i === idx + 1
														? {
																chainId: '',
																address: '',
																name: '',
																genPng: true,
																files: {},
																preview: {}
														  }
														: x
												)
											)
										}>
										Clear
									</button>
									<button
										type="button"
										className="text-sm text-red-600 hover:underline"
										onClick={() => setTokenItems(p => p.filter((_, i) => i !== idx + 1))}>
										Remove
									</button>
								</div>
							</div>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<label className="block">
									<span className="mb-1 block text-sm font-medium text-gray-700">Chain</span>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										list="chains-list"
										value={it.chainId}
										onChange={e =>
											setTokenItems(prev =>
												prev.map((x, i) =>
													i === idx + 1 ? {...x, chainId: e.target.value} : x
												)
											)
										}
										onBlur={async () => {
											const item = tokenItems[idx + 1];
											if (!item || !isEvmAddress(item.address) || item.name) return;
											const cid = Number(item.chainId || chainId);
											if (!cid || Number.isNaN(cid)) return;
											try {
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {...x, resolvingName: true, resolveError: ''}
															: x
													)
												);
												const name = await fetchErc20Name(String(cid), item.address);
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {
																	...x,
																	resolvingName: false,
																	name: x.name || name,
																	resolveError: ''
															  }
															: x
													)
												);
											} catch (err: any) {
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {
																	...x,
																	resolvingName: false,
																	resolveError:
																		'Could not fetch token name. Please verify address.'
															  }
															: x
													)
												);
											}
										}}
										placeholder="enter/select chain"
									/>
								</label>
								<label className="block">
									<span className="mb-1 block text-sm font-medium text-gray-700">Token Address</span>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={it.address}
										onChange={e =>
											setTokenItems(prev =>
												prev.map((x, i) =>
													i === idx + 1
														? {
																...x,
																address: e.target.value,
																addressValid: isEvmAddress(e.target.value)
														  }
														: x
												)
											)
										}
										onBlur={async () => {
											const item = tokenItems[idx + 1];
											if (!item || !isEvmAddress(item.address)) return;
											const cid = Number(item.chainId || chainId);
											if (!cid || Number.isNaN(cid)) return;
											try {
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {...x, resolvingName: true, resolveError: ''}
															: x
													)
												);
												const name = await fetchErc20Name(String(cid), item.address);
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {
																	...x,
																	resolvingName: false,
																	name: x.name || name,
																	resolveError: ''
															  }
															: x
													)
												);
											} catch (err: any) {
												setTokenItems(prev =>
													prev.map((x, i) =>
														i === idx + 1
															? {
																	...x,
																	resolvingName: false,
																	resolveError:
																		'Could not fetch token name. Please verify address.'
															  }
															: x
													)
												);
											}
										}}
										placeholder="0x..."
									/>
									{it.resolvingName && <p className="mt-1 text-xs text-gray-500">Fetching name…</p>}
									{it.resolveError && <p className="mt-1 text-xs text-red-600">{it.resolveError}</p>}
									{it.address && it.addressValid === false && (
										<p className="mt-1 text-xs text-red-600">Invalid EVM address format</p>
									)}
								</label>
								<label className="block">
									<span className="mb-1 block text-sm font-medium text-gray-700">
										Name (optional)
									</span>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={it.name || ''}
										onChange={e =>
											setTokenItems(prev =>
												prev.map((x, i) => (i === idx + 1 ? {...x, name: e.target.value} : x))
											)
										}
										placeholder="auto-fills if resolvable"
									/>
								</label>
							</div>
							<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
								<div className="sm:col-span-2">
									<div
										onDragOver={e => e.preventDefault()}
										onDrop={e => {
											e.preventDefault();
											const f = e.dataTransfer.files?.[0];
											if (!f) return;
											onTokenFileChange(idx + 1, {target: {files: [f], name: 'svg'}} as any);
										}}
										className="flex h-40 w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600">
										{it.preview.svg ? (
											<img
												src={it.preview.svg}
												className="max-h-36"
											/>
										) : (
											<span>Drag & Drop SVG here</span>
										)}
									</div>
								</div>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm text-gray-700">Generate PNGs</span>
										<Switch
											checked={it.genPng}
											onChange={(v: boolean) =>
												setTokenItems(prev =>
													prev.map((x, i) => (i === idx + 1 ? {...x, genPng: v} : x))
												)
											}
											className={`${
												it.genPng ? 'bg-blue-600' : 'bg-gray-200'
											} relative inline-flex h-6 w-11 items-center rounded-full transition`}>
											<span
												className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
													it.genPng ? 'translate-x-6' : 'translate-x-1'
												}`}
											/>
										</Switch>
									</div>
									<button
										type="button"
										className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
										onClick={() => {
											const input = document.createElement('input');
											input.type = 'file';
											input.accept = 'image/svg+xml';
											input.onchange = (ev: any) => {
												const f = ev.target.files?.[0];
												if (!f) return;
												onTokenFileChange(idx + 1, {target: {files: [f], name: 'svg'}} as any);
											};
											input.click();
										}}>
										Browse SVG…
									</button>
									{!it.genPng && (
										<div className="space-y-2">
											<label className="block text-xs text-gray-600">PNG 32x32</label>
											<input
												type="file"
												accept="image/png"
												onChange={e =>
													onTokenFileChange(idx + 1, {
														...e,
														target: {...e.target, name: 'png32'}
													} as any)
												}
											/>
											<label className="block text-xs text-gray-600">PNG 128x128</label>
											<input
												type="file"
												accept="image/png"
												onChange={e =>
													onTokenFileChange(idx + 1, {
														...e,
														target: {...e.target, name: 'png128'}
													} as any)
												}
											/>
										</div>
									)}
								</div>
							</div>
							{/* Previews for additional token card */}
							<div className="mt-4 rounded-md border bg-gray-50 p-3">
								<p className="mb-2 text-sm font-medium text-gray-700">Previews</p>
								<div className="grid grid-cols-3 gap-4">
									<div>
										<p className="mb-1 text-xs text-gray-600">SVG</p>
										<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
											{it.preview.svg ? (
												<img
													src={it.preview.svg}
													alt="svg"
													className="max-h-28 max-w-28"
												/>
											) : (
												<span className="text-xs text-gray-400">—</span>
											)}
										</div>
									</div>
									<div>
										<p className="mb-1 text-xs text-gray-600">PNG 32x32</p>
										<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
											{it.preview.png32 ? (
												<img
													src={it.preview.png32}
													alt="png32"
													className="h-8 w-8"
												/>
											) : (
												<span className="text-xs text-gray-400">—</span>
											)}
										</div>
									</div>
									<div>
										<p className="mb-1 text-xs text-gray-600">PNG 128x128</p>
										<div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-md border bg-white">
											{it.preview.png128 ? (
												<img
													src={it.preview.png128}
													alt="png128"
													className="h-32 w-32"
												/>
											) : (
												<span className="text-xs text-gray-400">—</span>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					))}

				{mode === 'token' && (
					<div>
						<button
							type="button"
							className="mt-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
							onClick={() =>
								setTokenItems(prev => [
									...prev,
									{
										chainId: '',
										address: '',
										genPng: true,
										files: {},
										preview: {}
									}
								])
							}>
							+ Add Token Asset
						</button>
					</div>
				)}

				<div className="flex justify-end gap-3">
					<button
						type="submit"
						disabled={!canSubmit || !token}
						className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						title={!token ? 'Sign in with GitHub to enable' : ''}>
						Submit PR
					</button>
				</div>
			</form>

			{/* PR Review Modal */}
			<Transition
				show={reviewOpen}
				as={Fragment}>
				<Dialog
					as="div"
					className="relative z-50"
					onClose={() => (submitting ? null : setReviewOpen(false))}>
					<div
						className="fixed inset-0 bg-black/30"
						aria-hidden="true"
					/>
					<div className="fixed inset-0 flex items-center justify-center p-4">
						<Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
							<Dialog.Title className="text-lg font-semibold text-gray-900">
								Review PR Details
							</Dialog.Title>
							<p className="mt-1 text-sm text-gray-600">
								Edit the title and description before creating the PR.
							</p>
							<div className="mt-4 space-y-4">
								<div>
									<label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
									<input
										className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={prTitle}
										onChange={e => setPrTitle(e.target.value)}
									/>
								</div>
								<div>
									<label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
									<textarea
										rows={10}
										className="block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
										value={prBody}
										onChange={e => setPrBody(e.target.value)}
									/>
								</div>
							</div>
							<div className="mt-6 flex items-center justify-end gap-3">
								<button
									type="button"
									className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
									onClick={() => setReviewOpen(false)}
									disabled={submitting}>
									Cancel
								</button>
								<button
									type="button"
									className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
									onClick={confirmAndSubmit}
									disabled={submitting}>
									{submitting ? 'Submitting…' : 'Create PR'}
								</button>
							</div>
						</Dialog.Panel>
					</div>
				</Dialog>
			</Transition>
		</div>
	);
};

export const UploadRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: UploadComponent
});
