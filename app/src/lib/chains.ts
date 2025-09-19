import {getRpcUrl as getSharedRpcUrl, isEvmAddress as isSharedEvmAddress} from '@shared/evm';

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
	80094: 'Berachain',
};

export const getRpcUrl = getSharedRpcUrl;

export function listKnownChains(): Array<{ id: number; name: string }> {
	return Object.entries(CHAIN_ID_TO_NAME)
		.map(([id, name]) => ({ id: Number(id), name }))
		.sort((a, b) => a.id - b.id);
}

export const isEvmAddress = isSharedEvmAddress;
