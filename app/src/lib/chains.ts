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

// Optional built-in public RPCs for convenience; env can override.
const DEFAULT_RPCS: Partial<Record<number, string>> = {
  1: 'https://cloudflare-eth.com',
  10: 'https://mainnet.optimism.io',
  100: 'https://rpc.gnosischain.com',
  137: 'https://polygon-rpc.com',
  250: 'https://rpc.ankr.com/fantom',
  42161: 'https://arb1.arbitrum.io/rpc',
  8453: 'https://mainnet.base.org',
  // 146, 747474, 80094 intentionally omitted without known public RPCs
};

export function getRpcUrl(chainId: number): string | undefined {
  // Prefer explicit env overrides
  const env = (import.meta as any).env || {};
  const k1 = `VITE_RPC_URI_FOR_${chainId}`;
  const k2 = `VITE_RPC_${chainId}`;
  const fromEnv = (env[k1] as string | undefined) || (env[k2] as string | undefined);
  if (fromEnv) return fromEnv;
  return DEFAULT_RPCS[chainId];
}

export function listKnownChains(): Array<{ id: number; name: string }> {
  return Object.entries(CHAIN_ID_TO_NAME)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.id - b.id);
}

export function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}
