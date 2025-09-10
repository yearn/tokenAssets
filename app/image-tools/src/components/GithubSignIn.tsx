import React, {useEffect, useState} from 'react';

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
		const t = sessionStorage.getItem('github_token');
		setToken(t);
		if (t) {
			fetch('https://api.github.com/user', {
				headers: {Authorization: `Bearer ${t}`}
			})
				.then(r => (r.ok ? r.json() : null))
				.then(j => setLogin(j?.login ?? null))
				.catch(() => setLogin(null));
		} else {
			setLogin(null);
		}
	}, []);

	const signIn = () => {
		const state = randomState();
		sessionStorage.setItem('auth_state', state);
		const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			alert('Missing VITE_GITHUB_CLIENT_ID');
			return;
		}
		const url = new URL('https://github.com/login/oauth/authorize');
		url.searchParams.set('client_id', clientId);
		url.searchParams.set('state', state);
		url.searchParams.set('scope', 'public_repo');
		window.location.href = url.toString();
	};

	const signOut = () => {
		sessionStorage.removeItem('github_token');
		sessionStorage.removeItem('auth_state');
		setToken(null);
		setLogin(null);
		// Broadcast to other tabs
		window.dispatchEvent(new StorageEvent('storage', {key: 'github_token'}));
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
