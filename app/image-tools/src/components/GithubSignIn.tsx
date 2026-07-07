import React, {Fragment, useEffect, useState} from 'react';
import {Dialog, Transition} from '@headlessui/react';

import {
	broadcastAuthChange,
	storeAuthState,
	clearStoredAuth,
	buildAuthorizeUrl,
	getGithubCallbackUrl,
	markAuthPending,
	clearAuthPending,
	readAuthPending
} from '../lib/githubAuth';
import {API_BASE_URL} from '../lib/api';

function randomState(len = 20) {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

type Props = {
	token: string | null;
};

export const GithubSignIn: React.FC<Props> = ({token}) => {
	const [connecting, setConnecting] = useState<boolean>(() => readAuthPending());
	const [configError, setConfigError] = useState('');
	const [login, setLogin] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		setConnecting(readAuthPending());
	}, [token]);

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
		const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			setConfigError('Missing GitHub client ID.');
			return;
		}
		setConfigError('');
		storeAuthState(state);
		markAuthPending();
		setConnecting(true);
		window.location.href = buildAuthorizeUrl(clientId, state, getGithubCallbackUrl(API_BASE_URL));
	};

	const signOut = () => {
		clearStoredAuth();
		clearAuthPending();
		setLogin(null);
		setConnecting(false);
		broadcastAuthChange();
	};

	if (token) {
		return (
			<div className="flex flex-col items-end">
				<button
					onClick={signOut}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
					title={login ? `Signed in as ${login}` : 'Signed in'}>
					{login ? `Sign out (${login})` : 'Sign out'}
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-end">
			<button
				onClick={signIn}
				className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
				Sign in with GitHub
			</button>
			{configError && <p className="mt-2 text-right text-xs text-red-600">{configError}</p>}
			<Transition
				show={connecting && !token}
				as={Fragment}
				appear>
				<Dialog
					as="div"
					className="relative z-50"
					onClose={() => {
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
						<div
							className="fixed inset-0 bg-black/30"
							aria-hidden="true"
						/>
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
								<Dialog.Title className="text-lg font-medium text-gray-900">
									Connecting to GitHub…
								</Dialog.Title>
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
		</div>
	);
};
