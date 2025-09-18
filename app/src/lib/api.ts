// Resolve a safe absolute base URL for API calls.
// In production on Vercel, keep VITE_API_BASE_URL unset (or '/'), and we will use the current origin.
const RAW_BASE = (import.meta as any).env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (() => {
  // Prefer explicit absolute URL if provided.
  if (RAW_BASE && RAW_BASE !== '/' && /^https?:\/\//i.test(RAW_BASE)) return RAW_BASE;
  // Otherwise, fall back to current origin in the browser.
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  // Last resort for non-browser contexts.
  return 'http://localhost';
})();

export async function apiFetch(path: string, init?: RequestInit) {
  const url = new URL(path, API_BASE_URL);
  const res = await fetch(url.toString(), init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
