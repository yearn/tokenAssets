import React, {useEffect, useState} from 'react';

import {
	broadcastAuthChange,
	readStoredToken,
	storeAuthState,
	clearStoredAuth,
	TOKEN_STORAGE_KEY,
	AUTH_CHANGE_EVENT,
	buildAuthorizeUrl
} from '../lib/githubAuth';

function randomState(len = 20) {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

export const GithubSignIn: React.FC = () => {
	const [token, setToken] = useState<string | null>(null);
	const [login, setLogin] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const updateToken = () => setToken(readStoredToken());
		updateToken();

		const onStorage = (event: StorageEvent) => {
			if (!event.key || event.key === TOKEN_STORAGE_KEY) updateToken();
		};
		const onAuthEvent = () => updateToken();
		window.addEventListener('storage', onStorage);
		window.addEventListener(AUTH_CHANGE_EVENT, onAuthEvent);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(AUTH_CHANGE_EVENT, onAuthEvent);
		};
	}, []);

	useEffect(() => {
		if (!token) {
			setLogin(null);
			return;
		}
		let cancelled = false;
		fetch('https://api.github.com/user', {
			headers: {Authorization: `Bearer ${token}`}
		})
			.then(r => (r.ok ? r.json() : null))
			.then(j => {
				if (!cancelled) setLogin(j?.login ?? null);
			})
			.catch(() => {
				if (!cancelled) setLogin(null);
			});
		return () => {
			cancelled = true;
		};
	}, [token]);

	const signIn = () => {
		const state = randomState();
		storeAuthState(state);
		const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			alert('Missing VITE_GITHUB_CLIENT_ID');
			return;
		}
		window.location.href = buildAuthorizeUrl(clientId, state);
	};

	const signOut = () => {
		clearStoredAuth();
		setToken(null);
		setLogin(null);
		broadcastAuthChange();
	};

	if (token) {
		return (
			<button
				onClick={signOut}
				className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
				title={login ? `Signed in as ${login}` : 'Signed in'}>
				{login ? `Sign out (${login})` : 'Sign out'}
			</button>
		);
	}

	return (
		<button
			onClick={signIn}
			className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
			Sign in with GitHub
		</button>
	);
};
