import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildApiUrl} from '../../lib/api';
import {generatePngPreviews, makeObjectUrl} from '../../lib/imagePreview';
import {lookupErc20Name, isLookupAbort} from '@shared/erc20';
import {isEvmAddress} from '@shared/evm';
import {listKnownChains} from '../../lib/chains';
import {
	ChainDraft,
	ReviewMetadata,
	SubmitResult,
	TokenDraft,
	UploadMode,
	FileKind
} from './types';

const DEFAULT_REVIEW: ReviewMetadata = {title: '', body: ''};
const KNOWN_CHAINS = listKnownChains();

type HookOptions = {
	initialMode?: UploadMode;
};

type ReviewState = {
	open: boolean;
	metadata: ReviewMetadata;
};

function randomId(prefix: string): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
	return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function createTokenDraft(): TokenDraft {
	return {
		id: randomId('token'),
		chainId: '',
		address: '',
		name: '',
		genPng: true,
		files: {},
		generated: {},
		preview: {},
		resolvingName: false,
		resolveError: undefined
	};
}

function createChainDraft(): ChainDraft {
	return {
		chainId: '',
		genPng: true,
		files: {},
		generated: {},
		preview: {}
	};
}

function normalize(value: string): string {
	return (value || '').trim();
}

function normalizeAddress(address: string): string {
	return normalize(address).toLowerCase();
}

function computeTokenMetadata(tokens: TokenDraft[]): ReviewMetadata {
	const addresses = tokens.map(token => normalizeAddress(token.address)).filter(Boolean);
	const chains = tokens.map(token => normalize(token.chainId)).filter(Boolean);
	const uniqueChains = Array.from(new Set(chains));
	const title = `feat: add token assets (${addresses.length})`;
	const bodyLines: string[] = [];
	bodyLines.push(`Chains: ${uniqueChains.join(', ') || 'n/a'}`);
	bodyLines.push(`Addresses: ${addresses.join(', ') || 'n/a'}`);
	bodyLines.push('');
	bodyLines.push('Uploaded locations:');
	tokens.forEach((token, index) => {
		const chainId = normalize(token.chainId) || 'unknown-chain';
		const address = normalizeAddress(token.address) || `token-${index}`;
		bodyLines.push(`- /tokens/${chainId}/${address}/logo.svg`);
		bodyLines.push(`- /tokens/${chainId}/${address}/logo-32.png`);
		bodyLines.push(`- /tokens/${chainId}/${address}/logo-128.png`);
	});
	return {title, body: bodyLines.join('\n')};
}

function computeChainMetadata(chain: ChainDraft): ReviewMetadata {
	const chainId = normalize(chain.chainId) || 'unknown-chain';
	const body = [
		`Chain: ${chainId}`,
		'',
		'Uploaded locations:',
		`- /chains/${chainId}/logo.svg`,
		`- /chains/${chainId}/logo-32.png`,
		`- /chains/${chainId}/logo-128.png`
	].join('\n');
	return {title: `feat: add chain assets on ${chainId}`, body};
}

function makeReviewMetadata(mode: UploadMode, tokens: TokenDraft[], chain: ChainDraft): ReviewMetadata {
	return mode === 'token' ? computeTokenMetadata(tokens) : computeChainMetadata(chain);
}

type SubmitOptions = {token: string};

export function useUploadForm(options?: HookOptions) {
	const [mode, setMode] = useState<UploadMode>(options?.initialMode ?? 'token');
	const [tokens, setTokens] = useState<TokenDraft[]>([createTokenDraft()]);
	const [chain, setChain] = useState<ChainDraft>(createChainDraft());
	const [review, setReview] = useState<ReviewState>({open: false, metadata: DEFAULT_REVIEW});
	const [submitting, setSubmitting] = useState(false);
	const reviewErrorRef = useRef<string | null>(null);
	const lookupControllers = useRef<Map<string, AbortController>>(new Map());
	const previewUrls = useRef<Set<string>>(new Set());

	const registerUrl = useCallback((url?: string) => {
		if (!url) return undefined;
		previewUrls.current.add(url);
		return url;
	}, []);

	const revokeUrl = useCallback((url?: string) => {
		if (!url) return;
		if (previewUrls.current.has(url)) {
			URL.revokeObjectURL(url);
			previewUrls.current.delete(url);
		}
	}, []);

	const revokeTokenPreviews = useCallback(
		(token: TokenDraft) => {
			revokeUrl(token.preview.svg);
			revokeUrl(token.preview.png32);
			revokeUrl(token.preview.png128);
		},
		[revokeUrl]
	);

	const revokeChainPreviews = useCallback(
		(current: ChainDraft) => {
			revokeUrl(current.preview.svg);
			revokeUrl(current.preview.png32);
			revokeUrl(current.preview.png128);
		},
		[revokeUrl]
	);

	useEffect(() => () => {
		lookupControllers.current.forEach(controller => controller.abort());
		lookupControllers.current.clear();
		previewUrls.current.forEach(url => URL.revokeObjectURL(url));
		previewUrls.current.clear();
	}, []);

	const updateToken = useCallback((id: string, mutator: (draft: TokenDraft) => TokenDraft) => {
		setTokens(prev => prev.map(token => (token.id === id ? mutator(token) : token)));
	}, []);

	const updateChain = useCallback((mutator: (draft: ChainDraft) => ChainDraft) => {
		setChain(prev => mutator(prev));
	}, []);

	const addToken = useCallback(() => {
		setTokens(prev => [...prev, createTokenDraft()]);
	}, []);

	const removeToken = useCallback(
		(id: string) => {
			setTokens(prev => {
				if (prev.length === 1) return prev;
				const target = prev.find(token => token.id === id);
				if (target) revokeTokenPreviews(target);
				return prev.filter(token => token.id !== id);
			});
		},
		[revokeTokenPreviews]
	);

	const setTokenField = useCallback(
		(id: string, patch: Partial<Omit<TokenDraft, 'id'>>) => {
			updateToken(id, current => ({...current, ...patch}));
		},
		[updateToken]
	);

	const setChainField = useCallback(
		(patch: Partial<ChainDraft>) => {
			updateChain(current => ({...current, ...patch}));
		},
		[updateChain]
	);

	const resetTokenDraft = useCallback(
		(id: string) => {
			setTokens(prev =>
				prev.map(token => {
					if (token.id !== id) return token;
					revokeTokenPreviews(token);
					const next = createTokenDraft();
					return {...next, id};
				})
			);
		},
		[revokeTokenPreviews]
	);

	const resetChainDraft = useCallback(() => {
		setChain(current => {
			revokeChainPreviews(current);
			return createChainDraft();
		});
	}, [revokeChainPreviews]);

	const resetTokenFiles = useCallback(
		(id: string, keys: FileKind[]) => {
			updateToken(id, current => {
				const next: TokenDraft = {...current};
				keys.forEach(key => {
					revokeUrl(next.preview[key]);
					next.preview = {...next.preview, [key]: undefined};
					next.files = {...next.files, [key]: undefined};
					next.generated = {...next.generated, [key]: undefined};
				});
				return next;
			});
		},
		[revokeUrl, updateToken]
	);

	const resetChainFiles = useCallback(
		(keys: FileKind[]) => {
			setChain(current => {
				const next: ChainDraft = {...current};
				keys.forEach(key => {
					revokeUrl(next.preview[key]);
					next.preview = {...next.preview, [key]: undefined};
					next.files = {...next.files, [key]: undefined};
					next.generated = {...next.generated, [key]: undefined};
				});
				return next;
			});
		},
		[revokeUrl]
	);

	const handleTokenFileChange = useCallback(
		async (id: string, kind: FileKind, file?: File | null) => {
			const actual = file ?? undefined;
			if (!actual) {
				resetTokenFiles(id, [kind]);
				return;
			}

			if (kind === 'svg') {
				updateToken(id, current => {
					revokeUrl(current.preview.svg);
					revokeUrl(current.preview.png32);
					revokeUrl(current.preview.png128);
					return {
						...current,
						files: {...current.files, svg: actual},
						generated: {...current.generated, png32: undefined, png128: undefined},
						preview: {
							...current.preview,
							svg: registerUrl(makeObjectUrl(actual)),
							png32: undefined,
							png128: undefined
						}
					};
				});

				const draft = tokens.find(token => token.id === id);
				if (!draft?.genPng) return;
				try {
					const result = await generatePngPreviews(actual, {baseName: actual.name});
					updateToken(id, current => {
						if (current.files.svg !== actual || !current.genPng) return current;
						revokeUrl(current.preview.png32);
						revokeUrl(current.preview.png128);
						return {
							...current,
							generated: {
								...current.generated,
								png32: result.png32,
								png128: result.png128
							},
							preview: {
								...current.preview,
								png32: registerUrl(result.urls.png32),
								png128: registerUrl(result.urls.png128)
							}
						};
					});
				} catch (error) {
					console.error('Failed to generate PNG previews', error);
				}
			} else {
				updateToken(id, current => {
					const next = {...current};
					const key = kind;
					revokeUrl(next.preview[key]);
					next.preview = {...next.preview, [key]: registerUrl(makeObjectUrl(actual))};
					next.files = {...next.files, [key]: actual};
					next.generated = {...next.generated, [key]: undefined};
					return next;
				});
			}
		},
		[registerUrl, resetTokenFiles, revokeUrl, tokens, updateToken]
	);

	const handleChainFileChange = useCallback(
		async (kind: FileKind, file?: File | null) => {
			const actual = file ?? undefined;
			if (!actual) {
				resetChainFiles([kind]);
				return;
			}

			if (kind === 'svg') {
				setChain(current => {
					revokeChainPreviews(current);
					return {
						...current,
						files: {...current.files, svg: actual},
						generated: {...current.generated, png32: undefined, png128: undefined},
						preview: {
							...current.preview,
							svg: registerUrl(makeObjectUrl(actual)),
							png32: undefined,
							png128: undefined
						}
					};
				});

 			const draft = chain;
 			if (!draft.genPng) return;
 			try {
 				const result = await generatePngPreviews(actual, {baseName: actual.name});
 				setChain(current => {
 					if (current.files.svg !== actual || !current.genPng) return current;
 					revokeUrl(current.preview.png32);
 					revokeUrl(current.preview.png128);
 					return {
 						...current,
 						generated: {
 							...current.generated,
 							png32: result.png32,
 							png128: result.png128
 						},
 						preview: {
 							...current.preview,
 							png32: registerUrl(result.urls.png32),
 							png128: registerUrl(result.urls.png128)
 						}
 					};
 				});
 			} catch (error) {
 				console.error('Failed to generate chain PNG previews', error);
 			}
			} else {
				setChain(current => {
					revokeUrl(current.preview[kind]);
					return {
						...current,
						files: {...current.files, [kind]: actual},
						generated: {...current.generated, [kind]: undefined},
						preview: {...current.preview, [kind]: registerUrl(makeObjectUrl(actual))}
					};
				});
			}
		},
		[chain, registerUrl, resetChainFiles, revokeChainPreviews, revokeUrl]
	);

	const setTokenGenPng = useCallback(
		(id: string, enabled: boolean) => {
			updateToken(id, current => {
				if (current.genPng === enabled) return current;
				const next = {...current, genPng: enabled};
				if (!enabled) {
					revokeUrl(next.preview.png32);
					revokeUrl(next.preview.png128);
					next.preview = {...next.preview, png32: undefined, png128: undefined};
					next.generated = {...next.generated, png32: undefined, png128: undefined};
				}
				return next;
			});
			if (enabled) {
				const draft = tokens.find(token => token.id === id);
				if (draft?.files.svg) {
					generatePngPreviews(draft.files.svg, {baseName: draft.files.svg.name})
						.then(result => {
							updateToken(id, current => {
								if (!current.genPng || current.files.svg !== draft.files.svg) return current;
								revokeUrl(current.preview.png32);
								revokeUrl(current.preview.png128);
								return {
									...current,
									generated: {
										...current.generated,
										png32: result.png32,
										png128: result.png128
									},
									preview: {
										...current.preview,
										png32: registerUrl(result.urls.png32),
										png128: registerUrl(result.urls.png128)
									}
								};
							});
						})
						.catch(error => console.error('Failed to generate PNG previews', error));
				}
			}
		},
		[registerUrl, revokeUrl, tokens, updateToken]
	);

	const setChainGenPng = useCallback(
		(enabled: boolean) => {
			setChain(current => {
				if (current.genPng === enabled) return current;
				const next = {...current, genPng: enabled};
				if (!enabled) {
					revokeUrl(next.preview.png32);
					revokeUrl(next.preview.png128);
					next.preview = {...next.preview, png32: undefined, png128: undefined};
					next.generated = {...next.generated, png32: undefined, png128: undefined};
				}
				return next;
			});
			if (enabled && chain.files.svg) {
				generatePngPreviews(chain.files.svg, {baseName: chain.files.svg.name})
					.then(result => {
						setChain(current => {
							if (!current.genPng || current.files.svg !== chain.files.svg) return current;
							revokeUrl(current.preview.png32);
							revokeUrl(current.preview.png128);
							return {
								...current,
								generated: {
									...current.generated,
									png32: result.png32,
									png128: result.png128
								},
								preview: {
									...current.preview,
									png32: registerUrl(result.urls.png32),
									png128: registerUrl(result.urls.png128)
								}
							};
						});
					})
					.catch(error => console.error('Failed to generate chain PNG previews', error));
			}
		},
		[chain.files.svg, registerUrl, revokeUrl]
	);

	const resolveTokenName = useCallback(
		async (id: string) => {
			const draft = tokens.find(token => token.id === id);
			if (!draft) return;
			const chainId = Number.parseInt(draft.chainId, 10);
			if (!chainId || !isEvmAddress(draft.address)) return;
			const key = `${chainId}:${draft.address.toLowerCase()}`;
			const existing = lookupControllers.current.get(key);
			if (existing) existing.abort();
			const controller = new AbortController();
			lookupControllers.current.set(key, controller);
			setTokenField(id, {resolvingName: true, resolveError: undefined});
			try {
				const result = await lookupErc20Name({chainId, address: draft.address, signal: controller.signal});
				setTokenField(id, {
					name: tokens.find(token => token.id === id)?.name || result.name,
					resolvingName: false,
					resolveError: undefined
				});
			} catch (error) {
				if (isLookupAbort(error)) return;
				const message = error instanceof Error ? error.message : 'Lookup failed';
				setTokenField(id, {resolvingName: false, resolveError: message});
			} finally {
				const active = lookupControllers.current.get(key);
				if (active === controller) lookupControllers.current.delete(key);
			}
		},
		[setTokenField, tokens]
	);

	const canSubmit = useMemo(() => {
		if (mode === 'chain') {
			if (!normalize(chain.chainId)) return false;
			if (!chain.files.svg) return false;
			if (!chain.genPng) {
				if (!chain.files.png32) return false;
				if (!chain.files.png128) return false;
			}
			return true;
		}
		if (!tokens.length) return false;
		return tokens.every(token => {
			if (!normalize(token.chainId)) return false;
			if (!isEvmAddress(token.address)) return false;
			if (!token.files.svg) return false;
			if (!token.genPng) {
				if (!token.files.png32) return false;
				if (!token.files.png128) return false;
			}
			return true;
		});
	}, [mode, chain, tokens]);

	const openReview = useCallback(() => {
		setReview({open: true, metadata: makeReviewMetadata(mode, tokens, chain)});
		reviewErrorRef.current = null;
	}, [mode, tokens, chain]);

	const closeReview = useCallback(() => {
		setReview(prev => ({...prev, open: false}));
	}, []);

	const setReviewMetadata = useCallback((metadata: ReviewMetadata) => {
		setReview(prev => ({...prev, metadata}));
	}, []);

	const buildFormData = useCallback(
		(metadata?: ReviewMetadata) => {
			const body = new FormData();
			body.append('target', mode);
			if (mode === 'token') {
				body.append('chainId', '');
				tokens.forEach((token, index) => {
					body.append(`chainId_${index}`, normalize(token.chainId));
					if (token.address) body.append('address', normalizeAddress(token.address));
					if (token.files.svg) body.append(`svg_${index}`, token.files.svg);
					const png32 = token.files.png32 ?? token.generated.png32;
					const png128 = token.files.png128 ?? token.generated.png128;
					if (png32) body.append(`png32_${index}`, png32);
					if (png128) body.append(`png128_${index}`, png128);
				});
			} else {
				body.append('chainId', normalize(chain.chainId));
				if (chain.files.svg) body.append('svg', chain.files.svg);
				const png32 = chain.files.png32 ?? chain.generated.png32;
				const png128 = chain.files.png128 ?? chain.generated.png128;
				if (png32) body.append('png32', png32);
				if (png128) body.append('png128', png128);
			}
			if (metadata) {
				body.append('prTitle', metadata.title);
				body.append('prBody', metadata.body);
			}
			return body;
		},
		[mode, tokens, chain]
	);

	const resetForm = useCallback(() => {
		tokens.forEach(revokeTokenPreviews);
		revokeChainPreviews(chain);
		setTokens([createTokenDraft()]);
		setChain(createChainDraft());
		setReview({open: false, metadata: DEFAULT_REVIEW});
		reviewErrorRef.current = null;
	}, [chain, revokeChainPreviews, revokeTokenPreviews, tokens]);

	const submit = useCallback(
		async (options: SubmitOptions): Promise<SubmitResult> => {
			setSubmitting(true);
			try {
				const metadata = review.metadata;
				const form = buildFormData(metadata);
				const response = await fetch(buildApiUrl('/api/upload'), {
					method: 'POST',
					headers: {Authorization: `Bearer ${options.token}`},
					body: form
				});
				const contentType = response.headers.get('content-type') || '';
				if (!response.ok) {
					let message = `Upload failed (${response.status})`;
					try {
						if (contentType.includes('application/json')) {
							const json = await response.json();
							message = json?.error || JSON.stringify(json);
						} else {
							message = await response.text();
						}
					} catch (_) {
						// ignore parsing errors
					}
					reviewErrorRef.current = message;
					throw new Error(message);
				}
				const json = contentType.includes('application/json') ? await response.json() : undefined;
				resetForm();
				return (json as SubmitResult | undefined) ?? {};
			} finally {
				setSubmitting(false);
			}
		},
		[buildFormData, resetForm, review.metadata]
	);

	return {
		mode,
		setMode,
		tokens,
		chain,
		knownChains: KNOWN_CHAINS,
		addToken,
		removeToken,
		setTokenField,
		resetTokenDraft,
		setChainField,
		resetChainDraft,
		handleTokenFileChange,
		handleChainFileChange,
		setTokenGenPng,
		setChainGenPng,
		resolveTokenName,
		canSubmit,
		review,
		reviewError: reviewErrorRef.current,
		openReview,
		closeReview,
		setReviewMetadata,
		submitting,
		submit,
		resetForm
	};
}
