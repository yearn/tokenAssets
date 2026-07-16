import {getUserLogin, openPrWithFilesForkAware} from './github';

const CANONICAL_OWNER = 'yearn';
const CANONICAL_REPO = 'tokenAssets';

type TokenUploadItem = {
	id: string;
	chainId: string;
	address: string;
};

type ChainUploadItem = {
	id: string;
	chainId: string;
};

class UploadValidationError extends Error {
	status = 400;
}

function validationError(message: string): never {
	throw new UploadValidationError(message);
}

const CHAIN_ID_PATTERN = /^(?:\d+|btcm)$/;

export function validateChainId(chainId: string, subject = 'asset'): string {
	if (!chainId) validationError(`Missing chainId for ${subject}`);
	if (!CHAIN_ID_PATTERN.test(chainId)) {
		validationError(`Invalid chainId for ${subject}; expected decimal digits or "btcm"`);
	}
	return chainId;
}

// Deploys triggered from personal forks should still open PRs against the
// canonical org repo unless an explicit override is opt-in via env flag.
export function resolveTargetRepo(): {owner: string; repo: string} {
	const envOwner = (process.env.REPO_OWNER as string)?.trim();
	const envRepo = (process.env.REPO_NAME as string)?.trim();
	const allowOverride = (process.env.ALLOW_REPO_OVERRIDE || '').toLowerCase() === 'true';

	const owner = allowOverride && envOwner ? envOwner : CANONICAL_OWNER;
	const repo = allowOverride && envRepo ? envRepo : CANONICAL_REPO;

	return {owner, repo};
}

function isPng(bytes: Uint8Array): boolean {
	return (
		bytes.length > 24 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

function readUInt32BE(arr: Uint8Array, offset: number): number {
	return (
		((arr[offset] << 24) >>> 0) +
		((arr[offset + 1] << 16) >>> 0) +
		((arr[offset + 2] << 8) >>> 0) +
		(arr[offset + 3] >>> 0)
	);
}

function pngDimensions(bytes: Uint8Array): {width: number; height: number} | null {
	if (!isPng(bytes)) return null;
	// PNG IHDR: width/height at offsets 16 and 20
	const width = readUInt32BE(bytes, 16);
	const height = readUInt32BE(bytes, 20);
	if (!width || !height) return null;
	return {width, height};
}

function isEvmAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim());
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		const sub = bytes.subarray(i, i + chunk);
		binary += String.fromCharCode(...sub);
	}
	// Encode in chunks to avoid exceeding the function argument limit for larger images.
	return btoa(binary);
}

function jsonResponse(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

export function buildChainAssetPaths(chainId: string): [string, string, string] {
	validateChainId(chainId, 'chain asset');
	return [`chains/${chainId}/logo.svg`, `chains/${chainId}/logo-32.png`, `chains/${chainId}/logo-128.png`];
}

function buildTokenAssetPaths(chainId: string, address: string): [string, string, string] {
	validateChainId(chainId, 'token');
	return [
		`tokens/${chainId}/${address}/logo.svg`,
		`tokens/${chainId}/${address}/logo-32.png`,
		`tokens/${chainId}/${address}/logo-128.png`
	];
}

function parseTokenItems(form: FormData, globalChainId: string): TokenUploadItem[] {
	const manifest = String(form.get('items') || '').trim();
	if (manifest) {
		let parsed: Array<Partial<TokenUploadItem>>;
		try {
			parsed = JSON.parse(manifest) as Array<Partial<TokenUploadItem>>;
		} catch {
			validationError('items must be valid JSON');
		}
		if (!Array.isArray(parsed)) validationError('items must be an array');
		return parsed.map((item, index) => ({
			id: String(item.id || '').trim() || String(index),
			chainId: String(item.chainId ?? globalChainId ?? ''),
			address: String(item.address || '').trim()
		}));
	}

	const addresses = (form.getAll('address') as string[]).map(address => String(address || '').trim()).filter(Boolean);
	return addresses.map((address, index) => ({
		id: String(index),
		chainId: String(form.get(`chainId_${index}`) || globalChainId || ''),
		address
	}));
}

function parseChainItems(form: FormData, globalChainId: string): ChainUploadItem[] {
	const manifest = String(form.get('items') || '').trim();
	if (manifest) {
		let parsed: Array<Partial<ChainUploadItem>>;
		try {
			parsed = JSON.parse(manifest) as Array<Partial<ChainUploadItem>>;
		} catch {
			validationError('items must be valid JSON');
		}
		if (!Array.isArray(parsed)) validationError('items must be an array');
		return parsed.map((item, index) => ({
			id: String(item.id || '').trim() || String(index),
			chainId: String(item.chainId ?? globalChainId ?? '')
		}));
	}

	return globalChainId ? [{id: '', chainId: globalChainId}] : [];
}

async function readRequiredAssetFiles(form: FormData, suffix: string) {
	const field = (name: string) => (suffix ? `${name}_${suffix}` : name);
	const svgF = form.get(field('svg')) as File | null;
	const png32F = form.get(field('png32')) as File | null;
	const png128F = form.get(field('png128')) as File | null;

	if (!svgF) validationError(`${field('svg')} required`);
	if (!svgF.type.includes('svg')) validationError(`${field('svg')} must be image/svg+xml`);
	if (!png32F || !png128F) validationError(`${field('png32')} and ${field('png128')} required`);
	if (!png32F.type.includes('png') || !png128F.type.includes('png')) {
		validationError(`${field('png32')} and ${field('png128')} must be image/png`);
	}

	const svgBytes = new Uint8Array(await svgF.arrayBuffer());
	const png32Bytes = new Uint8Array(await png32F.arrayBuffer());
	const png128Bytes = new Uint8Array(await png128F.arrayBuffer());

	const d32 = pngDimensions(png32Bytes);
	const d128 = pngDimensions(png128Bytes);
	if (!d32 || d32.width !== 32 || d32.height !== 32) validationError(`${field('png32')} must be 32x32`);
	if (!d128 || d128.width !== 128 || d128.height !== 128) validationError(`${field('png128')} must be 128x128`);

	return {svgBytes, png32Bytes, png128Bytes};
}

export async function handleUpload(req: Request): Promise<Response> {
	if (req.method !== 'POST') return new Response('Method Not Allowed', {status: 405});
	try {
		const auth = req.headers.get('authorization') || '';
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
		if (!token) return jsonResponse({error: 'Missing GitHub token'}, 401);

		const form = await req.formData();
		const target = String(form.get('target') || 'token');
		const globalChainId = String(form.get('chainId') || '');
		const prTitleOverride = String(form.get('prTitle') || '').trim();
		const prBodyOverride = String(form.get('prBody') || '').trim();

		const prFiles: Array<{path: string; contentBase64: string}> = [];
		const {owner, repo} = resolveTargetRepo();

		if (target === 'token') {
			const items = parseTokenItems(form, globalChainId);
			if (!items.length) validationError('At least one address required for token uploads');
			for (const item of items) {
				const chainId = validateChainId(item.chainId, `token ${item.id}`);
				if (!isEvmAddress(item.address)) validationError(`Invalid EVM address for token ${item.id}`);

				const {svgBytes, png32Bytes, png128Bytes} = await readRequiredAssetFiles(form, item.id);
				const addrLower = item.address.toLowerCase();
				const [svgPath, png32Path, png128Path] = buildTokenAssetPaths(chainId, addrLower);
				prFiles.push(
					{
						path: svgPath,
						contentBase64: toBase64(svgBytes)
					},
					{
						path: png32Path,
						contentBase64: toBase64(png32Bytes)
					},
					{
						path: png128Path,
						contentBase64: toBase64(png128Bytes)
					}
				);
			}
		} else if (target === 'chain') {
			const items = parseChainItems(form, globalChainId);
			if (!items.length) validationError('At least one chainId required for chain uploads');

			const seenChainIds = new Set<string>();
			for (const item of items) {
				validateChainId(item.chainId, `chain asset ${item.id}`);
				if (seenChainIds.has(item.chainId))
					validationError(`Duplicate chainId for chain asset ${item.chainId}`);
				seenChainIds.add(item.chainId);
			}

			for (const item of items) {
				const {svgBytes, png32Bytes, png128Bytes} = await readRequiredAssetFiles(form, item.id);
				const [svgPath, png32Path, png128Path] = buildChainAssetPaths(item.chainId);

				prFiles.push(
					{path: svgPath, contentBase64: toBase64(svgBytes)},
					{
						path: png32Path,
						contentBase64: toBase64(png32Bytes)
					},
					{
						path: png128Path,
						contentBase64: toBase64(png128Bytes)
					}
				);
			}
		} else {
			validationError('target must be token or chain');
		}

		const login = await getUserLogin(token).catch(() => 'user');
		const branchName = `${login}-image-tools-${target}-${Date.now()}`;

		// Build default PR title/body if not provided
		let prTitle = prTitleOverride;
		let prBody = prBodyOverride;
		if (!prTitle || !prBody) {
			if (target === 'token') {
				const items = parseTokenItems(form, globalChainId);
				const addressesForBody = items.map(item => item.address.toLowerCase()).filter(Boolean);
				const chainsForBody: string[] = items.map(item => item.chainId);
				const uniqueChains = Array.from(new Set(chainsForBody.filter(Boolean)));
				prTitle ||= `feat: add token assets (${addressesForBody.length})`;
				const directoryLocations = addressesForBody.flatMap((addr: string, i: number) => [
					`/tokens/${chainsForBody[i]}/${addr}/logo.svg`,
					`/tokens/${chainsForBody[i]}/${addr}/logo-32.png`,
					`/tokens/${chainsForBody[i]}/${addr}/logo-128.png`
				]);
				prBody ||= [
					`Chains: ${uniqueChains.join(', ')}`,
					`Addresses: ${addressesForBody.join(', ')}`,
					'',
					'Uploaded locations:',
					...directoryLocations.map(u => `- ${u}`)
				].join('\n');
			} else {
				const items = parseChainItems(form, globalChainId);
				const chainsForBody: string[] = items.map(item => item.chainId);
				prTitle ||= `feat: add chain assets (${chainsForBody.length})`;
				const directoryLocations = chainsForBody.flatMap(chainId => [
					`/chains/${chainId}/logo.svg`,
					`/chains/${chainId}/logo-32.png`,
					`/chains/${chainId}/logo-128.png`
				]);
				prBody ||= [
					`Chains: ${chainsForBody.join(', ')}`,
					'',
					'Uploaded locations:',
					...directoryLocations.map(u => `- ${u}`)
				].join('\n');
			}
		}

		const prUrl = await openPrWithFilesForkAware({
			token,
			baseOwner: owner,
			baseRepo: repo,
			branchName,
			commitMessage: prTitle,
			prTitle,
			prBody,
			files: prFiles
		});

		return jsonResponse({ok: true, prUrl}, 200);
	} catch (e: any) {
		console.error('[upload] failed', e instanceof Error ? e.message : e);
		return jsonResponse({error: e?.message || 'Upload failed'}, e?.status || 500);
	}
}
