import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {__clearEnvCacheForTesting} from './env';
import {DEFAULT_RPC_URLS, decodeAbiString, getRpcUrl, isEvmAddress} from './evm';

const originalEnv = {...process.env};
const mutatedKeys = new Set<string>();

function setEnv(key: string, value: string) {
	process.env[key] = value;
	mutatedKeys.add(key);
}

beforeEach(() => {
	__clearEnvCacheForTesting();
});

afterEach(() => {
	for (const key of mutatedKeys) {
		const original = originalEnv[key];
		if (original === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = original;
		}
	}
	mutatedKeys.clear();
	__clearEnvCacheForTesting();
});

describe('isEvmAddress', () => {
	it('accepts canonical hex addresses', () => {
		expect(isEvmAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
		expect(isEvmAddress(' 0X1234567890ABCDEF1234567890ABCDEF12345678 ')).toBe(true);
	});

	it('rejects malformed addresses', () => {
		expect(isEvmAddress('0x1234')).toBe(false);
		expect(isEvmAddress('not-an-address')).toBe(false);
		expect(isEvmAddress('0xZZ34567890abcdef1234567890abcdef12345678')).toBe(false);
	});
});

describe('decodeAbiString', () => {
	it('decodes dynamic ABI encoded strings', () => {
		const dynamic =
			'0x' +
			'0000000000000000000000000000000000000000000000000000000000000020' +
			'0000000000000000000000000000000000000000000000000000000000000004' +
			'5465737400000000000000000000000000000000000000000000000000000000';
		expect(decodeAbiString(dynamic)).toBe('Test');
	});

	it('decodes bytes32 padded strings', () => {
		const fixed = '0x5465737400000000000000000000000000000000000000000000000000000000';
		expect(decodeAbiString(fixed)).toBe('Test');
	});

	it('returns empty string for empty payloads', () => {
		expect(decodeAbiString('0x')).toBe('');
	});
});

describe('getRpcUrl', () => {
	it('prefers env overrides when available', () => {
		setEnv('VITE_RPC_URI_FOR_1', 'https://custom.rpc');
		expect(getRpcUrl(1)).toBe('https://custom.rpc');
	});

	it('falls back to known defaults', () => {
		// Temporarily unset any env vars for 8453 to test the fallback
		const envKeys = ['VITE_RPC_URI_FOR_8453', 'VITE_RPC_8453', 'RPC_URI_FOR_8453', 'RPC_8453'];
		const originalValues: Record<string, string | undefined> = {};

		envKeys.forEach(key => {
			originalValues[key] = process.env[key];
			delete process.env[key];
			mutatedKeys.add(key);
		});

		// Clear cache after unsetting env vars
		__clearEnvCacheForTesting();

		expect(getRpcUrl(8453)).toBe(DEFAULT_RPC_URLS[8453]);

		// Restore original values
		envKeys.forEach(key => {
			if (originalValues[key] !== undefined) {
				process.env[key] = originalValues[key];
			}
		});
		__clearEnvCacheForTesting();
	});

	it('returns undefined when nothing available', () => {
		expect(getRpcUrl(999999)).toBeUndefined();
	});
});
