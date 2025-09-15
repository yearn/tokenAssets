import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {dimensionsOfPng} from './util';
import sharp from 'sharp';
import {openPrWithFilesForkAware, getUserLogin} from './github';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env.local (preferred) or .env in app/image-tools
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envDefaultPath = path.join(__dirname, '..', '.env');
dotenv.config({path: fs.existsSync(envLocalPath) ? envLocalPath : envDefaultPath});

const app = express();
const port = Number(process.env.PORT || 5174);

// Debug flag can be enabled via CLI: `node api/index.ts --debug` (or `-d`)
const argv = process.argv.slice(2);
const DEBUG = argv.includes('--debug') || argv.includes('-d');

function log(...args: unknown[]) {
	if (DEBUG) console.log('[image-tools]', ...args);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: 5 * 1024 * 1024}});

const repoRoot = path.resolve(__dirname, '../../..');
const tokensRoot = path.join(repoRoot, 'tokens');
const chainsRoot = path.join(repoRoot, 'chains');
const stagingRoot = path.join(repoRoot, 'scripts', 'token-images-to-ingest');

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

// ---- Minimal chain RPC helpers for ERC-20 name lookup ----
const DEFAULT_RPCS: Partial<Record<number, string>> = {
	1: 'https://cloudflare-eth.com',
	10: 'https://mainnet.optimism.io',
	100: 'https://rpc.gnosischain.com',
	137: 'https://polygon-rpc.com',
	250: 'https://rpc.ankr.com/fantom',
	42161: 'https://arb1.arbitrum.io/rpc',
	8453: 'https://mainnet.base.org'
	// others can be provided via env
};

function getRpcUrlFromEnv(chainId: number): string | undefined {
	const k1 = `VITE_RPC_URI_FOR_${chainId}`;
	const k2 = `VITE_RPC_${chainId}`;
	const val = process.env[k1] || process.env[k2];
	return val || DEFAULT_RPCS[chainId];
}

function isEvmAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim());
}

function decodeAbiString(resultHex: string): string {
	const hex = resultHex.startsWith('0x') ? resultHex.slice(2) : resultHex;
	if (hex.length >= 192) {
		const lenHex = hex.slice(64, 128);
		const len = parseInt(lenHex || '0', 16);
		const dataHex = hex.slice(128, 128 + len * 2);
		return Buffer.from(dataHex, 'hex')
			.toString('utf8')
			.replace(/\u0000+$/, '');
	}
	if (hex.length === 64) {
		const trimmed = hex.replace(/00+$/, '');
		return Buffer.from(trimmed, 'hex')
			.toString('utf8')
			.replace(/\u0000+$/, '');
	}
	return Buffer.from(hex, 'hex')
		.toString('utf8')
		.replace(/\u0000+$/, '');
}

app.post('/api/erc20-name', async (req, res) => {
	try {
		const chainIdStr = String(req.body.chainId || '').trim();
		const address = String(req.body.address || '').trim();
		const chainId = Number(chainIdStr);
		if (!chainId || Number.isNaN(chainId)) return res.status(400).json({error: 'Invalid chainId'});
		if (!isEvmAddress(address)) return res.status(400).json({error: 'Invalid address'});
		const rpc = getRpcUrlFromEnv(chainId);
		if (!rpc) return res.status(400).json({error: 'No RPC configured for chain'});
		const payload = {
			jsonrpc: '2.0',
			id: Math.floor(Math.random() * 1e9),
			method: 'eth_call',
			params: [{to: address, data: '0x06fdde03'}, 'latest']
		};
		const r = await fetch(rpc, {
			method: 'POST',
			headers: {'Content-Type': 'application/json', Accept: 'application/json'},
			body: JSON.stringify(payload)
		});
		if (!r.ok) {
			let bodyText = '';
			try {
				bodyText = await r.text();
			} catch {}
			if (DEBUG)
				log('erc20-name RPC non-OK', {
					chainId,
					address,
					rpc,
					status: r.status,
					bodyText: bodyText?.slice?.(0, 300)
				});
			return res.status(502).json({error: `RPC HTTP ${r.status}`, details: bodyText?.slice?.(0, 300)});
		}
		const j = await r.json().catch(async () => ({raw: await r.text()}));
		if (j?.error) return res.status(502).json({error: j.error?.message || 'RPC error'});
		const result: string | undefined = j?.result;
		if (!result || result === '0x') return res.status(404).json({error: 'Empty result'});
		const name = decodeAbiString(result);
		return res.json({name});
	} catch (e: any) {
		res.status(500).json({error: e?.message || 'Lookup failed'});
	}
});

app.get('/api/health', (_req, res) => {
	res.json({ok: true, service: 'image-tools-api'});
});

app.get('/api/auth/github/callback', async (req, res) => {
	try {
		const code = req.query.code as string | undefined;
		const state = (req.query.state as string | undefined) || '';
		if (!code) return res.status(400).json({error: 'Missing code'});
		const clientId = process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID;
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;
		if (!clientId || !clientSecret) return res.status(500).json({error: 'Missing GitHub OAuth env vars'});

		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
			body: JSON.stringify({client_id: clientId, client_secret: clientSecret, code})
		});
		if (!tokenRes.ok) return res.status(502).send(await tokenRes.text());
		const tokenJson = (await tokenRes.json()) as {access_token?: string};
		const accessToken = tokenJson.access_token;
		if (!accessToken) return res.status(502).json({error: 'No access_token in response'});

		const appBase = process.env.APP_BASE_URL || 'http://localhost:5173';
		const redirect = new URL('/auth/github/success', appBase);
		redirect.searchParams.set('token', accessToken);
		redirect.searchParams.set('state', state);
		res.redirect(redirect.toString());
	} catch (e: any) {
		res.status(500).json({error: e?.message || 'OAuth callback failed'});
	}
});

app.post('/api/upload', upload.any(), async (req, res) => {
	try {
		const auth = req.header('authorization') || '';
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
		if (!token) return res.status(401).json({error: 'Missing GitHub token'});

		const target = String(req.body.target || 'token');
		const chainId = String(req.body.chainId || '').trim();
		const genPngGlobal = ['1', 'true', 'on', 'yes'].includes(String(req.body.genPng || '').toLowerCase());
		// Optional overrides for PR metadata from client
		const prTitleOverride = String(req.body.prTitle || '').trim();
		const prBodyOverride = String(req.body.prBody || '').trim();

		log('Incoming upload', {
			target,
			chainId,
			genPngGlobal,
			bodyKeys: Object.keys(req.body || {})
		});

		if (target === 'chain' && !chainId) return res.status(400).json({error: 'chainId required'});

		const filesArr = req.files as Express.Multer.File[];
		const fileMap = new Map<string, Express.Multer.File>();
		for (const f of filesArr) {
			fileMap.set(f.fieldname, f);
		}
		log(
			'Files received',
			filesArr.map(f => ({field: f.fieldname, type: f.mimetype, size: f.size}))
		);

		// Helper to generate png buffers from svg buffer
		async function genFromSvg(svgBuf: Buffer) {
			const b32 = await sharp(svgBuf, {density: 300})
				.resize(32, 32, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
				.png()
				.toBuffer();
			const b128 = await sharp(svgBuf, {density: 300})
				.resize(128, 128, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
				.png()
				.toBuffer();
			return {b32, b128};
		}

		const prFiles: Array<{path: string; contentBase64: string}> = [];

		const owner = process.env.REPO_OWNER || 'yearn';
		const repo = process.env.REPO_NAME || 'tokenAssets';

		if (target === 'token') {
			const addressesRaw = req.body.address;
			const addresses: string[] = Array.isArray(addressesRaw) ? addressesRaw : addressesRaw ? [addressesRaw] : [];
			if (!addresses.length)
				return res.status(400).json({error: 'At least one address required for token uploads'});

			for (let i = 0; i < addresses.length; i++) {
				const addr = String(addresses[i] || '').trim();
				if (!addr) return res.status(400).json({error: `Missing address at index ${i}`});
				const localChainId = String((req.body as any)[`chainId_${i}`] || chainId || '').trim();
				if (!localChainId) return res.status(400).json({error: `Missing chainId for token index ${i}`});
				const svgF = fileMap.get(`svg_${i}`);
				if (!svgF) return res.status(400).json({error: `svg_${i} required`});
				if (!svgF.mimetype.includes('svg'))
					return res.status(400).json({error: `svg_${i} must be image/svg+xml`});

				let png32buf = fileMap.get(`png32_${i}`)?.buffer;
				let png128buf = fileMap.get(`png128_${i}`)?.buffer;
				const localGenPng = ['1', 'true', 'on', 'yes'].includes(
					String((req.body as any)[`genPng_${i}`] ?? genPngGlobal).toLowerCase()
				);
				log('Token item', i, {addr, localChainId, localGenPng, hasPng32: !!png32buf, hasPng128: !!png128buf});
				if (localGenPng) {
					const g = await genFromSvg(svgF.buffer);
					png32buf = g.b32;
					png128buf = g.b128;
				}
				if (!png32buf || !png128buf)
					return res.status(400).json({error: `png32_${i} and png128_${i} required unless genPng=true`});
				const d32 = dimensionsOfPng(png32buf);
				const d128 = dimensionsOfPng(png128buf);
				if (!d32 || d32.width !== 32 || d32.height !== 32)
					return res.status(400).json({error: `png32_${i} must be 32x32`});
				if (!d128 || d128.width !== 128 || d128.height !== 128)
					return res.status(400).json({error: `png128_${i} must be 128x128`});

				const slug = [Date.now(), localChainId, addr].join('-');
				const stagingDir = path.join(stagingRoot, slug);
				ensureDir(stagingDir);
				fs.writeFileSync(path.join(stagingDir, `logo.svg`), svgF.buffer as Uint8Array);
				fs.writeFileSync(path.join(stagingDir, `logo-32.png`), png32buf as Uint8Array);
				fs.writeFileSync(path.join(stagingDir, `logo-128.png`), png128buf as Uint8Array);

				const destDir = path.join(tokensRoot, String(localChainId), addr.toLowerCase());
				ensureDir(destDir);
				fs.writeFileSync(path.join(destDir, 'logo.svg'), svgF.buffer as Uint8Array);
				fs.writeFileSync(path.join(destDir, 'logo-32.png'), png32buf as Uint8Array);
				fs.writeFileSync(path.join(destDir, 'logo-128.png'), png128buf as Uint8Array);

				prFiles.push(
					{
						path: path.posix.join('tokens', String(localChainId), addr.toLowerCase(), 'logo.svg'),
						contentBase64: fs.readFileSync(path.join(destDir, 'logo.svg')).toString('base64')
					},
					{
						path: path.posix.join('tokens', String(localChainId), addr.toLowerCase(), 'logo-32.png'),
						contentBase64: fs.readFileSync(path.join(destDir, 'logo-32.png')).toString('base64')
					},
					{
						path: path.posix.join('tokens', String(localChainId), addr.toLowerCase(), 'logo-128.png'),
						contentBase64: fs.readFileSync(path.join(destDir, 'logo-128.png')).toString('base64')
					}
				);
			}
		} else {
			const svg = fileMap.get('svg');
			if (!svg) return res.status(400).json({error: 'svg required'});
			if (!svg.mimetype.includes('svg')) return res.status(400).json({error: 'svg must be image/svg+xml'});

			let png32buf = fileMap.get('png32')?.buffer;
			let png128buf = fileMap.get('png128')?.buffer;
			if (genPngGlobal) {
				const g = await genFromSvg(svg.buffer);
				png32buf = g.b32;
				png128buf = g.b128;
			}
			log('Chain item', {chainId, genPngGlobal, hasPng32: !!png32buf, hasPng128: !!png128buf});
			if (!png32buf || !png128buf)
				return res.status(400).json({error: 'png32 and png128 required unless genPng=true'});
			const d32 = dimensionsOfPng(png32buf);
			const d128 = dimensionsOfPng(png128buf);
			if (!d32 || d32.width !== 32 || d32.height !== 32)
				return res.status(400).json({error: 'png32 must be 32x32'});
			if (!d128 || d128.width !== 128 || d128.height !== 128)
				return res.status(400).json({error: 'png128 must be 128x128'});

			const slug = [Date.now(), chainId, 'chain'].join('-');
			const stagingDir = path.join(stagingRoot, slug);
			ensureDir(stagingDir);
			fs.writeFileSync(path.join(stagingDir, `logo.svg`), svg.buffer as Uint8Array);
			fs.writeFileSync(path.join(stagingDir, `logo-32.png`), png32buf as Uint8Array);
			fs.writeFileSync(path.join(stagingDir, `logo-128.png`), png128buf as Uint8Array);

			const destDir = path.join(chainsRoot, String(chainId));
			ensureDir(destDir);
			fs.writeFileSync(path.join(destDir, 'logo.svg'), svg.buffer as Uint8Array);
			fs.writeFileSync(path.join(destDir, 'logo-32.png'), png32buf as Uint8Array);
			fs.writeFileSync(path.join(destDir, 'logo-128.png'), png128buf as Uint8Array);

			prFiles.push(
				{
					path: path.posix.join('chains', String(chainId), 'logo.svg'),
					contentBase64: fs.readFileSync(path.join(destDir, 'logo.svg')).toString('base64')
				},
				{
					path: path.posix.join('chains', String(chainId), 'logo-32.png'),
					contentBase64: fs.readFileSync(path.join(destDir, 'logo-32.png')).toString('base64')
				},
				{
					path: path.posix.join('chains', String(chainId), 'logo-128.png'),
					contentBase64: fs.readFileSync(path.join(destDir, 'logo-128.png')).toString('base64')
				}
			);
		}

		// Prepare files for PR commit
		// owner/repo already set above
		const login = await getUserLogin(token).catch(() => 'user');
		const branchName = `${login}-image-tools-${target}-${Date.now()}`;

		const addressesForBody: string[] = (
			Array.isArray(req.body.address) ? req.body.address : req.body.address ? [req.body.address] : []
		)
			.map((a: string) => a?.toLowerCase?.() || a)
			.filter(Boolean);
		const chainsForBody: string[] = addressesForBody.map((_, i) =>
			String((req.body as any)[`chainId_${i}`] || chainId || '')
		);
		const uniqueChains = Array.from(new Set(chainsForBody.filter(Boolean)));
		const title =
			prTitleOverride ||
			(target === 'token'
				? `feat: add token assets (${addressesForBody.length})`
				: `feat: add chain assets on ${chainId}`);
		const baseUrl = process.env.API_BASE_URL || 'http://localhost:5174';
		const directoryLocations =
			target === 'token'
				? addressesForBody.flatMap((addr: string, i: number) => [
						`/token/${chainsForBody[i]}/${addr}/logo.svg`,
						`/token/${chainsForBody[i]}/${addr}/logo-32.png`,
						`/token/${chainsForBody[i]}/${addr}/logo-128.png`
				  ])
				: [`/chain/${chainId}/logo.svg`, `/chain/${chainId}/logo-32.png`, `/chain/${chainId}/logo-128.png`];
		const prBody =
			prBodyOverride ||
			[
				target === 'token'
					? `Chains: ${uniqueChains.join(', ')}\nAddresses: ${addressesForBody.join(', ')}`
					: `Chain: ${chainId}`,
				'',
				'Uploaded locations:',
				...directoryLocations.map(u => `- ${u}`)
			].join('\n');

		log('Opening PR', {owner, repo, target, filesCount: prFiles.length});
		const prUrl = await openPrWithFilesForkAware({
			token,
			baseOwner: owner,
			baseRepo: repo,
			branchName,
			commitMessage: title,
			prTitle: title,
			prBody,
			files: prFiles
		});

		res.json({ok: true, prUrl});
	} catch (e: any) {
		console.error('[image-tools] Upload failed', e?.stack || e);
		res.status(500).json({error: e?.message || 'Upload failed'});
	}
});

app.listen(port, () => {
	console.log(`[image-tools] API listening on http://localhost:${port}`);
});
