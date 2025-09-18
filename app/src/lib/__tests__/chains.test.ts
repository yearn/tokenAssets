import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

let chains: typeof import('../chains');

const ORIGINAL_ENV = {...import.meta.env};
const ORIGINAL_NODE_ENV = {...process.env};

beforeEach(async () => {
  vi.resetModules();
  Object.assign(import.meta.env, ORIGINAL_ENV);
  Object.assign(process.env, ORIGINAL_NODE_ENV);
  chains = await import('../chains');
});

afterEach(() => {
  vi.resetModules();
  Object.assign(import.meta.env, ORIGINAL_ENV);
  Object.assign(process.env, ORIGINAL_NODE_ENV);
});

describe('chains helpers', () => {
  it('lists chains in ascending order', () => {
    const ids = chains.listKnownChains().map(entry => entry.id);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);
  });

  it('validates EVM addresses', () => {
    expect(chains.isEvmAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    expect(chains.isEvmAddress('0X0000000000000000000000000000000000000000')).toBe(false);
    expect(chains.isEvmAddress('0xabc')).toBe(false);
    expect(chains.isEvmAddress('not-an-address')).toBe(false);
  });

  it('prefers environment-specific RPC overrides', async () => {
    (import.meta as any).env.VITE_RPC_URI_FOR_1 = 'https://example-rpc.io';
    process.env.VITE_RPC_URI_FOR_1 = 'https://example-rpc.io';
    chains = await import('../chains');
    expect((import.meta as any).env.VITE_RPC_URI_FOR_1).toBe('https://example-rpc.io');
    expect(chains.getRpcUrl(1)).toBe('https://example-rpc.io');
  });

  it('falls back to baked-in RPC defaults', () => {
    expect(chains.getRpcUrl(1)).toBeDefined();
    expect(chains.getRpcUrl(146)).toBeUndefined();
  });
});
