export const CHAIN_ID_TO_NAME: Record<number, string> = {
	1: 'Ethereum',
	10: 'Optimism',
	100: 'GnosisChain',
	137: 'Polygon',
	146: 'Sonic',
	250: 'Fantom',
	8453: 'Base',
	42161: 'Arbitrum',
	747474: 'Katana',
	80094: 'Berachain'
};

export function listKnownChains(): Array<{id: number; name: string}> {
	return Object.entries(CHAIN_ID_TO_NAME)
		.map(([id, name]) => ({id: Number(id), name}))
		.sort((a, b) => a.id - b.id);
}

export function isEvmAddress(addr: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}
