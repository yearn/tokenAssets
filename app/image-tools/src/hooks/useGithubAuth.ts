import {useEffect, useState} from 'react';
import {AUTH_CHANGE_EVENT, TOKEN_STORAGE_KEY, readStoredToken} from '../lib/githubAuth';

export function useGithubAuthToken() {
	const [token, setToken] = useState<string | null>(() => readStoredToken());

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const syncToken = () => setToken(readStoredToken());
		const onStorage = (event: StorageEvent) => {
			if (!event.key || event.key === TOKEN_STORAGE_KEY) syncToken();
		};

		syncToken();
		window.addEventListener('storage', onStorage);
		window.addEventListener(AUTH_CHANGE_EVENT, syncToken);

		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(AUTH_CHANGE_EVENT, syncToken);
		};
	}, []);

	return token;
}
