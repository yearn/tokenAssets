const ENV_CACHE = new Map<string, string | undefined>();

type EnvRecord = Record<string, string | undefined> | undefined;

function pick(source: EnvRecord, key: string): string | undefined {
	if (!source) return undefined;
	const raw = source[key];
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	return trimmed ? trimmed : undefined;
}

const getSources = (() => {
	let cached: Array<() => EnvRecord> | null = null;
	return () => {
		if (cached) return cached;
		const globalAny = globalThis as any;
		cached = [
			() => globalAny?.process?.env as EnvRecord,
			() => globalAny?.Bun?.env as EnvRecord,
			() => {
				try {
					return ((import.meta as any)?.env ?? undefined) as EnvRecord;
				} catch (_) {
					return undefined;
				}
			}
		];
		return cached;
	};
})();

export function readEnv(key: string): string | undefined {
	if (!key) return undefined;
	if (ENV_CACHE.has(key)) return ENV_CACHE.get(key);
	for (const source of getSources()) {
		const value = pick(source(), key);
		if (value !== undefined) {
			ENV_CACHE.set(key, value);
			return value;
		}
	}
	ENV_CACHE.set(key, undefined);
	return undefined;
}

export function __clearEnvCacheForTesting(): void {
	ENV_CACHE.clear();
}
