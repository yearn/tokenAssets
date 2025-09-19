import {apiFetch as sharedApiFetch, buildApiUrl, getApiBaseUrl} from '@shared/api';

export const API_BASE_URL = getApiBaseUrl();

export {buildApiUrl, getApiBaseUrl};

export async function apiFetch(path: string, init?: RequestInit) {
	return sharedApiFetch(path, init);
}
