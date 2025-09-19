import React, {Fragment} from 'react';
import {Dialog, Transition} from '@headlessui/react';
import {useGithubAuth} from '../hooks/useGithubAuth';

export const GithubSignIn: React.FC = () => {
	const {
		isAuthenticated,
		login,
		signIn,
		signOut,
		isPending,
		isProfileLoading,
		error,
		dismissError,
		cancelPending
	} = useGithubAuth();

	const showPendingDialog = isPending && !isAuthenticated;

	return (
		<div className="flex flex-col items-end gap-2">
			{error ? (
				<div className="max-w-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
					<div className="flex items-start justify-between gap-2">
						<p className="font-medium">{error}</p>
						<button
							type="button"
							onClick={dismissError}
							className="text-xs font-semibold uppercase tracking-wide text-red-600" aria-label="Dismiss GitHub auth message">
							Dismiss
						</button>
					</div>
				</div>
			) : null}

			{isAuthenticated ? (
				<button
					onClick={signOut}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
					title={login ? `Signed in as ${login}` : 'Signed in'}>
					{login ? `Sign out (${login})` : 'Sign out'}
				</button>
			) : (
				<button
					onClick={signIn}
					disabled={isPending}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
					{isPending ? 'Connecting…' : 'Sign in with GitHub'}
				</button>
			)}

			<Transition show={showPendingDialog} as={Fragment} appear>
				<Dialog as="div" className="relative z-50" onClose={cancelPending}>
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
								{isProfileLoading ? (
									<p className="mt-4 text-sm text-gray-500">Loading your GitHub profile…</p>
								) : (
									<p className="mt-4 text-sm text-gray-500">
										If nothing happens, check that pop-ups are allowed and try again.
									</p>
								)}
								<button
									type="button"
									onClick={cancelPending}
									className="mt-6 inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
									Cancel
								</button>
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</Dialog>
			</Transition>
		</div>
	);
};
