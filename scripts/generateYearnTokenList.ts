import fs from 'fs';
import path from 'path';

// Types modeled after the Go structures
type TExternalERC20Token = {
	address: string;
	underlyingTokensAddresses: string[];
	name: string;
	symbol: string;
	type: string;
	display_name: string;
	display_symbol: string;
	description: string;
	icon: string;
	decimals: number;
};

type TYearnTokenData = {
	address: string;
	underlyingTokensAddresses: string[];
	type: string;
	name: string;
	symbol: string;
	displayName: string;
	displaySymbol: string;
	description: string;
	category: string;
	icon: string;
	decimals: number;
};

type TRemoteYearnTokens = Record<string, Record<string, TYearnTokenData>>; // chainID -> address -> token

// Token list output format (simplified)
interface ITokenListToken {
	address: string;
	chainId: number;
	name?: string;
	symbol?: string;
	decimals?: number;
	logoURI?: string;
}

// Blacklist support ---------------------------------------------------------
// 1. Built-in (kept intentionally empty here). Add hard-coded addresses if needed.
const BUILTIN_BLACKLIST: Record<number, string[]> = {
	1: [
		'0x13Cc8D626445c6fcCC548aAE172CBACF572EF5A4', //scam usdt
		'0x2dd4239206e6a4933e0cfe139950042ba6dcc7f0' //scam usdt
	]
};

// 2. Optional JSON file `scripts/yearn.blacklist.json` structure:
// {
//   "1": ["0xabc...", "0xdef..."],
//   "42161": ["0x..."]
// }
function loadExternalBlacklist(): Record<number, string[]> {
	try {
		const p = path.join(__dirname, 'yearn.blacklist.json');
		if (fs.existsSync(p)) {
			const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string[]>;
			const out: Record<number, string[]> = {};
			for (const k of Object.keys(raw)) {
				const n = Number(k);
				if (!Number.isNaN(n)) out[n] = raw[k];
			}
			return out;
		}
	} catch (e) {
		console.warn('Failed to load external blacklist:', (e as Error).message);
	}
	return {};
}

function buildBlacklistSets(): Record<number, Set<string>> {
	const combined: Record<number, Set<string>> = {};
	const ext = loadExternalBlacklist();
	const merged: Record<number, string[]> = {};
	const sources = [BUILTIN_BLACKLIST, ext];
	sources.forEach(src => {
		for (const chain of Object.keys(src)) {
			const chainNum = Number(chain);
			merged[chainNum] = [...(merged[chainNum] || []), ...src[chainNum]];
		}
	});
	for (const chain of Object.keys(merged)) {
		const chainNum = Number(chain);
		combined[chainNum] = new Set(merged[chainNum].map(a => a.toLowerCase()));
	}
	return combined;
}

const BLACKLIST = buildBlacklistSets();

function applyBlacklist(tokens: ITokenListToken[]): ITokenListToken[] {
	if (!Object.keys(BLACKLIST).length) return tokens; // fast path if empty
	return tokens.filter(t => {
		const set = BLACKLIST[t.chainId];
		if (!set) return true;
		return !set.has(t.address.toLowerCase());
	});
}

interface ITokenList {
	name: string;
	logoURI: string;
	keywords: string[];
	timestamp: string;
	version: {major: number; minor: number; patch: number};
	tokens: ITokenListToken[];
}

async function fetchJSON<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.json() as Promise<T>;
}

function uniqueTokens(tokens: ITokenListToken[]): ITokenListToken[] {
	const map = new Map<string, ITokenListToken>();
	for (const t of tokens) {
		const key = `${t.chainId}-${t.address.toLowerCase()}`;
		if (!map.has(key)) map.set(key, t);
	}
	return [...map.values()].sort((a, b) => a.chainId - b.chainId || a.address.localeCompare(b.address));
}

function assetLogoURI(chainIDStr: string, lowerAddr: string): string | undefined {
	const assetPath = path.join(__dirname, '..', 'tokens', chainIDStr, lowerAddr, 'logo-128.png');
	if (fs.existsSync(assetPath)) {
		return `https://raw.githubusercontent.com/yearn/tokenAssets/main/tokens/${chainIDStr}/${lowerAddr}/logo-128.png`;
	}
	return undefined;
}

async function fetchYearnTokens(): Promise<ITokenListToken[]> {
	const remote = await fetchJSON<TRemoteYearnTokens>('https://ydaemon.yearn.fi/tokens/all');
	const out: ITokenListToken[] = [];
	for (const chainIDStr of Object.keys(remote)) {
		const chainId = Number(chainIDStr);
		const perChain = remote[chainIDStr];
		// build lowercase index for underlying lookups
		const perChainLower: Record<string, TYearnTokenData> = {} as any;
		for (const addr of Object.keys(perChain)) {
			perChainLower[addr.toLowerCase()] = perChain[addr];
		}
		for (const address of Object.keys(perChain)) {
			const token = perChain[address];
			const lowerAddr = address.toLowerCase();
			if (lowerAddr === '0x0000000000000000000000000000000000000000') continue; // skip zero address
			out.push({
				address: address,
				chainId,
				name: token.name,
				symbol: token.symbol,
				decimals: token.decimals,
				logoURI: assetLogoURI(chainIDStr, lowerAddr)
			});
			for (const underlying of token.underlyingTokensAddresses || []) {
				const uLower = underlying.toLowerCase();
				if (uLower === '0x0000000000000000000000000000000000000000') continue;
				const meta = perChainLower[uLower];
				out.push({
					address: underlying,
					chainId,
					name: meta?.name,
					// meta may be undefined if underlying not in remote list
					symbol: meta?.symbol,
					decimals: meta?.decimals,
					logoURI: assetLogoURI(chainIDStr, uLower)
				});
			}
		}
	}
	return uniqueTokens(out);
}

async function buildYearnTokenList() {
	const tokensRaw = await fetchYearnTokens();
	const tokens = applyBlacklist(tokensRaw);
	const tokenList: ITokenList = {
		name: 'Yearn Token List',
		logoURI:
			'https://raw.githubusercontent.com/yearn/tokenassets/main/tokens/1/0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e/logo.svg',
		keywords: ['yearn', 'yfi', 'yvault', 'ytoken', 'ycurve', 'yprotocol', 'vaults'],
		timestamp: new Date().toISOString(),
		version: {major: 0, minor: 0, patch: 0},
		tokens
	};

	const outPath = path.join(__dirname, '..', 'tokenlists', 'yearn.tokenlist.json');
	fs.mkdirSync(path.dirname(outPath), {recursive: true});
	fs.writeFileSync(outPath, JSON.stringify(tokenList, null, 2));
	const removed = tokensRaw.length - tokens.length;
	console.log(`Saved Yearn token list with ${tokens.length} entries (removed ${removed} blacklisted) to ${outPath}`);
}

buildYearnTokenList().catch(e => {
	console.error(e);
	process.exit(1);
});
