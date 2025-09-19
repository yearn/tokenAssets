import {readEnv} from './env';

const ABSOLUTE_URL = /^https?:\/\//i;

function ensureLeadingSlash(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function resolveExplicitBase(): string | undefined {
  const candidates = ['VITE_API_BASE_URL', 'API_BASE_URL'];
  for (const key of candidates) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

export function getApiBaseUrl(): string {
  const explicit = resolveExplicitBase();
  if (explicit && explicit !== '/') return explicit;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return explicit || '/';
}

export function buildApiUrl(path: string, base: string = getApiBaseUrl()): string {
  const normalizedPath = ensureLeadingSlash(path);
  if (ABSOLUTE_URL.test(base)) return new URL(normalizedPath, base).toString();
  if (!base || base === '/') return normalizedPath;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}${normalizedPath}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const url = buildApiUrl(path);
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function resolveAppBaseUrl(req?: Request): string {
  const explicit = readEnv('APP_BASE_URL');
  if (explicit && explicit !== '/') return explicit;
  if (req) {
    try {
      const origin = new URL((req as {url?: string}).url ?? '').origin;
      if (origin) return origin;
    } catch (_) {
      // ignore parse failure
    }
  }
  return explicit || getApiBaseUrl();
}
