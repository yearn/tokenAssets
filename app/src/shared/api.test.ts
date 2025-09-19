import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {__clearEnvCacheForTesting} from './env';
import {buildApiUrl, getApiBaseUrl, resolveAppBaseUrl} from './api';

const originalEnv = {...process.env};
const mutatedKeys = new Set<string>();
const originalWindow = (globalThis as any).window;

function setEnv(key: string, value: string) {
  process.env[key] = value;
  mutatedKeys.add(key);
}

function clearEnv(key: string) {
  mutatedKeys.add(key);
  delete process.env[key];
}

function restoreWindow() {
  if (originalWindow === undefined) {
    delete (globalThis as any).window;
  } else {
    (globalThis as any).window = originalWindow;
  }
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
  restoreWindow();
  __clearEnvCacheForTesting();
});

describe('getApiBaseUrl', () => {
  it('returns explicit absolute base when provided', () => {
    setEnv('VITE_API_BASE_URL', 'https://api.test');
    expect(getApiBaseUrl()).toBe('https://api.test');
  });

  it('falls back to window origin when base is root', () => {
    setEnv('VITE_API_BASE_URL', '/');
    (globalThis as any).window = {location: {origin: 'https://app.test'}};
    expect(getApiBaseUrl()).toBe('https://app.test');
  });

  it('returns root when neither env nor window origin exist', () => {
    clearEnv('VITE_API_BASE_URL');
    clearEnv('API_BASE_URL');
    delete (globalThis as any).window;
    expect(getApiBaseUrl()).toBe('/');
  });
});

describe('buildApiUrl', () => {
  it('builds absolute URLs when base has protocol', () => {
    expect(buildApiUrl('/api/demo', 'https://app.test')).toBe('https://app.test/api/demo');
  });

  it('handles relative bases without duplicating slashes', () => {
    expect(buildApiUrl('api/demo', '/base')).toBe('/base/api/demo');
  });

  it('returns normalized path when base is root', () => {
    expect(buildApiUrl('api/demo', '/')).toBe('/api/demo');
  });
});

describe('resolveAppBaseUrl', () => {
  it('prefers APP_BASE_URL env', () => {
    setEnv('APP_BASE_URL', 'https://app.example');
    const req = {url: 'https://fallback.test/path'} as Request;
    expect(resolveAppBaseUrl(req)).toBe('https://app.example');
  });

  it('uses request origin when env missing', () => {
    clearEnv('APP_BASE_URL');
    const req = {url: 'https://fallback.test/path'} as Request;
    expect(resolveAppBaseUrl(req)).toBe('https://fallback.test');
  });

  it('falls back to general API base when nothing else available', () => {
    clearEnv('APP_BASE_URL');
    clearEnv('VITE_API_BASE_URL');
    clearEnv('API_BASE_URL');
    delete (globalThis as any).window;
    expect(resolveAppBaseUrl()).toBe('/');
  });
});
