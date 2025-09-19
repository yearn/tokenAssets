import {assertDimensions, readBinary, readPng, toBase64} from '@shared/image';
import {isEvmAddress} from '@shared/evm';

export type UploadTarget = 'token' | 'chain';

export type UploadErrorDetail = {
	field: string;
	message: string;
	index?: number;
	code?: string;
};

export class UploadValidationError extends Error {
	readonly status: number;
	readonly details: UploadErrorDetail[];
	readonly code?: string;

	constructor(message: string, options?: {status?: number; details?: UploadErrorDetail[]; code?: string}) {
		super(message);
		this.name = 'UploadValidationError';
		this.status = options?.status ?? 400;
		this.details = options?.details ?? [];
		this.code = options?.code;
	}
}

export type TokenAsset = {
	index: number;
	chainId: string;
	address: string;
	svgBase64: string;
	png32Base64: string;
	png128Base64: string;
};

export type ChainAsset = {
	chainId: string;
	svgBase64: string;
	png32Base64: string;
	png128Base64: string;
};

type PrOverrides = {title?: string; body?: string};

export type UploadParseResult =
	| {target: 'token'; tokens: TokenAsset[]; overrides: PrOverrides}
	| {target: 'chain'; chain: ChainAsset; overrides: PrOverrides};

function normalizeString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function getLatestFile(form: FormData, key: string): Blob | undefined {
	const entries = form.getAll(key);
	for (let i = entries.length - 1; i >= 0; i--) {
		const candidate = entries[i];
		if (
			(candidate && typeof (candidate as any).arrayBuffer === 'function') ||
			candidate instanceof Blob
		) {
			return candidate as unknown as Blob;
		}
	}
	return undefined;
}

function collectTokenIndexes(form: FormData): number[] {
	const indexes = new Set<number>();
	for (const key of form.keys()) {
		const match = key.match(/^(?:chainId|svg|png32|png128)_(\d+)$/);
		if (match) indexes.add(Number.parseInt(match[1], 10));
	}
	return Array.from(indexes).sort((a, b) => a - b);
}

type PendingToken = {
	index: number;
	chainId: string;
	address: string;
	svg: Blob;
	png32: Blob;
	png128: Blob;
};

async function buildTokenAssets(form: FormData): Promise<TokenAsset[]> {
	const globalChainId = normalizeString(form.get('chainId'));
	const addressesQueue = (form.getAll('address') as Array<FormDataEntryValue>)
		.map(value => normalizeString(value as string))
		.filter(Boolean);
	const tokenIndexes = collectTokenIndexes(form);

	const errors: UploadErrorDetail[] = [];
	const pendings: PendingToken[] = [];
	let addressCursor = 0;

	for (const index of tokenIndexes) {
		let hasError = false;
		const rawChainId = normalizeString(form.get(`chainId_${index}`)) || globalChainId;
		const address = addressesQueue[addressCursor] || '';
		if (!rawChainId) {
			errors.push({index, field: `chainId_${index}`, message: 'chainId is required'});
			hasError = true;
		}
		if (!address) {
			errors.push({index, field: 'address', message: 'address is required'});
			hasError = true;
		} else if (!isEvmAddress(address)) {
			errors.push({index, field: 'address', message: 'address must be a valid EVM address'});
			hasError = true;
		}

		const svg = getLatestFile(form, `svg_${index}`);
		if (!svg) {
			errors.push({index, field: `svg_${index}`, message: 'svg file is required'});
			hasError = true;
		} else if (!svg.type.includes('svg')) {
			errors.push({index, field: `svg_${index}`, message: 'svg file must be image/svg+xml'});
			hasError = true;
		}

		const png32 = getLatestFile(form, `png32_${index}`);
		if (!png32) {
			errors.push({index, field: `png32_${index}`, message: 'png32 file is required'});
			hasError = true;
		} else if (!png32.type.includes('png')) {
			errors.push({index, field: `png32_${index}`, message: 'png32 file must be image/png'});
			hasError = true;
		}

		const png128 = getLatestFile(form, `png128_${index}`);
		if (!png128) {
			errors.push({index, field: `png128_${index}`, message: 'png128 file is required'});
			hasError = true;
		} else if (!png128.type.includes('png')) {
			errors.push({index, field: `png128_${index}`, message: 'png128 file must be image/png'});
			hasError = true;
		}

		if (!hasError) {
			pendings.push({
				index,
				chainId: rawChainId,
				address: address.toLowerCase(),
				svg: svg!,
				png32: png32!,
				png128: png128!,
			});
		}

		if (address) addressCursor += 1;
	}

	if (pendings.length === 0) {
		if (errors.length) {
			throw new UploadValidationError('Invalid token submission', {details: errors});
		}
		throw new UploadValidationError('At least one token submission required', {
			status: 400,
			code: 'TOKEN_SUBMISSION_MISSING'
		});
	}

	if (errors.length) {
		throw new UploadValidationError('Invalid token submission', {details: errors});
	}

	const tokens: TokenAsset[] = [];
	for (const pending of pendings) {
		try {
			const svgBytes = await readBinary(pending.svg);
			const png32Info = await readPng(pending.png32);
			assertDimensions(`token[${pending.index}].png32`, png32Info.dimensions, {width: 32, height: 32});
			const png128Info = await readPng(pending.png128);
			assertDimensions(`token[${pending.index}].png128`, png128Info.dimensions, {width: 128, height: 128});

			tokens.push({
				index: pending.index,
				chainId: pending.chainId,
				address: pending.address,
				svgBase64: toBase64(svgBytes),
				png32Base64: toBase64(png32Info.bytes),
				png128Base64: toBase64(png128Info.bytes)
			});
		} catch (err: any) {
			throw new UploadValidationError(err?.message || 'Failed to process token assets', {
				details: [{
					index: pending.index,
					field: 'files',
					message: err?.message || 'Failed to process token assets'
				}]
			});
		}
	}

	return tokens;
}

async function buildChainAsset(form: FormData): Promise<ChainAsset> {
	const chainId = normalizeString(form.get('chainId'));
	if (!chainId) {
		throw new UploadValidationError('chainId is required for chain uploads', {
			details: [{field: 'chainId', message: 'chainId is required'}],
			code: 'CHAIN_ID_MISSING'
		});
	}

	const svg = getLatestFile(form, 'svg');
	const png32 = getLatestFile(form, 'png32');
	const png128 = getLatestFile(form, 'png128');

	const details: UploadErrorDetail[] = [];
	if (!svg) details.push({field: 'svg', message: 'svg file is required'});
	else if (!svg.type.includes('svg')) details.push({field: 'svg', message: 'svg file must be image/svg+xml'});
	if (!png32) details.push({field: 'png32', message: 'png32 file is required'});
	else if (!png32.type.includes('png')) details.push({field: 'png32', message: 'png32 file must be image/png'});
	if (!png128) details.push({field: 'png128', message: 'png128 file is required'});
	else if (!png128.type.includes('png')) details.push({field: 'png128', message: 'png128 file must be image/png'});

	if (details.length) {
		throw new UploadValidationError('Invalid chain submission', {details});
	}

	try {
		const svgBytes = await readBinary(svg!);
		const png32Info = await readPng(png32!);
		assertDimensions('chain.png32', png32Info.dimensions, {width: 32, height: 32});
		const png128Info = await readPng(png128!);
		assertDimensions('chain.png128', png128Info.dimensions, {width: 128, height: 128});

		return {
			chainId,
			svgBase64: toBase64(svgBytes),
			png32Base64: toBase64(png32Info.bytes),
			png128Base64: toBase64(png128Info.bytes)
		};
	} catch (err: any) {
		throw new UploadValidationError(err?.message || 'Failed to process chain assets', {
			details: [{field: 'files', message: err?.message || 'Failed to process chain assets'}]
		});
	}
}

function extractOverrides(form: FormData): PrOverrides {
	const title = normalizeString(form.get('prTitle'));
	const body = normalizeString(form.get('prBody'));
	return {
		title: title || undefined,
		body: body || undefined
	};
}

export async function parseUploadForm(form: FormData): Promise<UploadParseResult> {
	const targetRaw = normalizeString(form.get('target'));
	const target: UploadTarget = targetRaw === 'chain' ? 'chain' : 'token';
	const overrides = extractOverrides(form);

	if (target === 'token') {
		const tokens = await buildTokenAssets(form);
		return {target: 'token', tokens, overrides};
	}
	const chain = await buildChainAsset(form);
	return {target: 'chain', chain, overrides};
}

export function toRepoPath(...segments: string[]): string {
	return segments.map(segment => segment.replace(/^\/+|\/+$/g, '')).join('/');
}

export function buildPrFiles(result: UploadParseResult): Array<{path: string; contentBase64: string}> {
	if (result.target === 'token') {
		return result.tokens.flatMap(token => [
			{path: toRepoPath('tokens', token.chainId, token.address, 'logo.svg'), contentBase64: token.svgBase64},
			{path: toRepoPath('tokens', token.chainId, token.address, 'logo-32.png'), contentBase64: token.png32Base64},
			{path: toRepoPath('tokens', token.chainId, token.address, 'logo-128.png'), contentBase64: token.png128Base64}
		]);
	}
	return [
		{path: toRepoPath('chains', result.chain.chainId, 'logo.svg'), contentBase64: result.chain.svgBase64},
		{path: toRepoPath('chains', result.chain.chainId, 'logo-32.png'), contentBase64: result.chain.png32Base64},
		{path: toRepoPath('chains', result.chain.chainId, 'logo-128.png'), contentBase64: result.chain.png128Base64}
	];
}

export function buildDefaultPrMetadata(
	result: UploadParseResult,
	overrides: PrOverrides
): {title: string; body: string} {
	if (result.target === 'token') {
		const tokens = [...result.tokens].sort((a, b) => a.index - b.index);
		const addresses = tokens.map(t => t.address);
		const chains = Array.from(new Set(tokens.map(t => t.chainId)));
		const defaultTitle = `feat: add token assets (${tokens.length})`;
		const locations = tokens.flatMap(t => [
			`/tokens/${t.chainId}/${t.address}/logo.svg`,
			`/tokens/${t.chainId}/${t.address}/logo-32.png`,
			`/tokens/${t.chainId}/${t.address}/logo-128.png`
		]);
		const defaultBody = [
			`Chains: ${chains.join(', ') || 'n/a'}`,
			`Addresses: ${addresses.join(', ') || 'n/a'}`,
			'',
			'Uploaded locations:',
			...locations.map(loc => `- ${loc}`)
		].join('\n');
		return {
			title: overrides.title || defaultTitle,
			body: overrides.body || defaultBody
		};
	}
	const chainId = result.chain.chainId;
	const defaultTitle = `feat: add chain assets on ${chainId}`;
	const locations = [
		`/chains/${chainId}/logo.svg`,
		`/chains/${chainId}/logo-32.png`,
		`/chains/${chainId}/logo-128.png`
	];
	const defaultBody = [`Chain: ${chainId}`, '', 'Uploaded locations:', ...locations.map(loc => `- ${loc}`)].join('\n');
	return {
		title: overrides.title || defaultTitle,
		body: overrides.body || defaultBody
	};
}
