export const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || '/';

export async function apiFetch(path: string, init?: RequestInit) {
  const url = new URL(path, API_BASE_URL);
  const res = await fetch(url.toString(), init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

