import type {ReactElement} from 'react';
import UploadPageClient from './page-client';

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstSearchValue(searchParams: SearchParams, keys: string[]): string | undefined {
	for (const key of keys) {
		const rawValue = searchParams[key];
		const value = (Array.isArray(rawValue) ? rawValue[0] : rawValue)?.trim();
		if (value) return value;
	}
	return undefined;
}

export default async function UploadPage({searchParams}: {searchParams: Promise<SearchParams>}): Promise<ReactElement> {
	const resolvedSearchParams = await searchParams;
	const modeParam = readFirstSearchValue(resolvedSearchParams, ['mode', 'type', 'target']);
	const chainId = readFirstSearchValue(resolvedSearchParams, ['chain', 'chainId']);
	const address = readFirstSearchValue(resolvedSearchParams, ['address', 'token']);
	const name = readFirstSearchValue(resolvedSearchParams, ['name']);
	const mode = modeParam === 'chain' ? 'chain' : modeParam === 'token' || address ? 'token' : undefined;

	return <UploadPageClient initialParams={{mode, chainId, address, name}} />;
}
