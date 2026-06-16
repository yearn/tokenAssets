import type {AssetFiles} from './imagePreview';

export type TokenDraftItem = {
	id: string;
	chainId: string;
	address: string;
	name: string;
	genPng: boolean;
	files: AssetFiles;
};

export type ChainDraftItem = {
	id: string;
	chainId: string;
	genPng: boolean;
	files: AssetFiles;
};

export type UploadDraft = {
	version: 1;
	savedAt: number;
	mode: 'token' | 'chain';
	chainItems?: ChainDraftItem[];
	chainId?: string;
	chainGenPng?: boolean;
	chainFiles?: AssetFiles;
	tokenItems: TokenDraftItem[];
};

const DB_NAME = 'image-tools-upload-draft';
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'current';

export async function readUploadDraft(): Promise<UploadDraft | null> {
	const db = await openDraftDb();
	if (!db) return null;
	return requestResult<UploadDraft | undefined>(
		db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DRAFT_KEY)
	).then(result => result ?? null);
}

export async function saveUploadDraft(draft: UploadDraft): Promise<void> {
	const db = await openDraftDb();
	if (!db) return;
	await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft, DRAFT_KEY));
}

export async function clearUploadDraft(): Promise<void> {
	const db = await openDraftDb();
	if (!db) return;
	await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(DRAFT_KEY));
}

function openDraftDb(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
