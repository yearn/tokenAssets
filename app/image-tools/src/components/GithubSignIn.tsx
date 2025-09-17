import React, {Fragment, useEffect, useState} from 'react';
import {Dialog, Transition} from '@headlessui/react';

import {
	broadcastAuthChange,
	readStoredToken,
	storeAuthState,
	clearStoredAuth,
	TOKEN_STORAGE_KEY,
	AUTH_CHANGE_EVENT,
	buildAuthorizeUrl,
	markAuthPending,
	clearAuthPending,
	readAuthPending
} from '../lib/githubAuth';

function randomState(len = 20) {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

export const GithubSignIn: React.FC = () => {
	const [token, setToken] = useState<string | null>(null);
	const [connecting, setConnecting] = useState<boolean>(() => readAuthPending());
	const [login, setLogin] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const syncState = () => {
			setToken(readStoredToken());
			setConnecting(readAuthPending());
		};
		syncState();

		const onStorage = (event: StorageEvent) => {
			if (!event.key || event.key === TOKEN_STORAGE_KEY) syncState();
		};
		const onAuthEvent = () => syncState();
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
			setConnecting(false);
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
		markAuthPending();
		setConnecting(true);
		const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			alert('Missing VITE_GITHUB_CLIENT_ID');
			return;
		}
		window.location.href = buildAuthorizeUrl(clientId, state);
	};

	const signOut = () => {
		clearStoredAuth();
		clearAuthPending();
		setToken(null);
		setLogin(null);
		setConnecting(false);
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
	<>
		<button
			onClick={signIn}
			className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
			Sign in with GitHub
		</button>
		<Transition show={connecting && !token} as={Fragment} appear>
			<Dialog as="div" className="relative z-50" onClose={() => {
				clearAuthPending();
				setConnecting(false);
			}}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-200"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-150"
					leaveFrom="opacity-100"
					leaveTo="opacity-0">
					<div className="fixed inset-0 bg-black/30" aria-hidden="true" />
				</Transition.Child>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-200"
					enterFrom="opacity-0 scale-95"
					enterTo="opacity-100 scale-100"
					leave="ease-in duration-150"
					leaveFrom="opacity-100 scale-100"
					leaveTo="opacity-0 scale-95">
					<Dialog.Panel className="fixed inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
							<Dialog.Title className="text-lg font-medium text-gray-900">Connecting to GitHub…</Dialog.Title>
							<p className="mt-2 text-sm text-gray-600">
								We&apos;re redirecting you to GitHub to complete the sign-in.
							</p>
							<p className="mt-4 text-sm text-gray-500">
								If nothing happens, check that pop-ups are allowed and try again.
							</p>
						</div>
					</Dialog.Panel>
				</Transition.Child>
			</Dialog>
		</Transition>
	</>
	);
};
