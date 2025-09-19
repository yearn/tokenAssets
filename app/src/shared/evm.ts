import {readEnv} from './env';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;

export const DEFAULT_RPC_URLS: Readonly<Partial<Record<number, string>>> = Object.freeze({
  1: 'https://cloudflare-eth.com',
  10: 'https://mainnet.optimism.io',
  100: 'https://rpc.gnosischain.com',
  137: 'https://polygon-rpc.com',
  250: 'https://rpc.ankr.com/fantom',
  42161: 'https://arb1.arbitrum.io/rpc',
  8453: 'https://mainnet.base.org'
});

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

function normalizeHex(value: string): string {
  const trimmed = (value || '').trim();
  const withoutPrefix = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  if (withoutPrefix.length % 2 === 1) return `0${withoutPrefix}`;
  return withoutPrefix;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase();
  const len = Math.floor(normalized.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const byte = normalized.slice(i * 2, i * 2 + 2);
    const parsed = Number.parseInt(byte, 16);
    out[i] = Number.isFinite(parsed) ? parsed : 0;
  }
  return out;
}

function trimNulls(input: string): string {
  return input.replace(/\u0000+$/g, '');
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (!bytes.length) return '';
  if (!textDecoder) throw new Error('TextDecoder not available in this runtime');
  return trimNulls(textDecoder.decode(bytes));
}

export function isEvmAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  return ADDRESS_REGEX.test(address.trim());
}

export function getRpcUrl(chainId: number): string | undefined {
  if (!Number.isInteger(chainId)) return undefined;
  const keys = [`VITE_RPC_URI_FOR_${chainId}`, `VITE_RPC_${chainId}`, `RPC_URI_FOR_${chainId}`, `RPC_${chainId}`];
  for (const key of keys) {
    const fromEnv = readEnv(key);
    if (fromEnv) return fromEnv;
  }
  return DEFAULT_RPC_URLS[chainId];
}

export function decodeAbiString(resultHex: string): string {
  const hex = normalizeHex(resultHex);
  if (!hex) return '';
  if (hex.length >= 192) {
    const lenHex = hex.slice(64, 128);
    const declaredLength = Number.parseInt(lenHex || '0', 16);
    const maxBytes = Math.floor((hex.length - 128) / 2);
    const safeLength = Math.max(0, Math.min(declaredLength, maxBytes));
    const dataStart = 128;
    const dataEnd = dataStart + safeLength * 2;
    const dataHex = hex.slice(dataStart, dataEnd);
    return bytesToUtf8(hexToBytes(dataHex));
  }
  if (hex.length === 64) {
    const trimmedHex = hex.replace(/00+$/g, '');
    return bytesToUtf8(hexToBytes(trimmedHex));
  }
  return bytesToUtf8(hexToBytes(hex));
}
