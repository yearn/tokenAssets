import React from 'react';
import {useGithubAuth} from '../hooks/useGithubAuth';

export const GithubSignIn: React.FC = () => {
	const {isAuthenticated, login, signIn, signOut, isPending, error, dismissError} = useGithubAuth();
	const isLoading = isPending;

	return (
		<div className="flex flex-col items-end gap-2">
			{error ? (
				<div
					className="max-w-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
					role="alert"
					aria-live="polite"
				>
					<div className="flex items-start justify-between gap-2">
						<p className="font-medium">{error}</p>
						<button
							type="button"
							onClick={dismissError}
							className="text-xs font-semibold uppercase tracking-wide text-red-600"
							aria-label="Dismiss GitHub auth message"
						>
							Dismiss
						</button>
					</div>
				</div>
			) : null}

			{isAuthenticated ? (
				<button
					type="button"
					onClick={signOut}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
					title={login ? `Signed in as ${login}` : 'Signed in'}
				>
					{login ? `Sign out (${login})` : 'Sign out'}
				</button>
			) : (
				<button
					type="button"
					onClick={signIn}
					disabled={isLoading}
					aria-busy={isLoading}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								className="h-4 w-4 animate-spin text-gray-500"
								aria-hidden="true"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
								/>
							</svg>
							<span>Connecting…</span>
						</>
					) : (
						<span>Sign in with GitHub</span>
					)}
				</button>
			)}
		</div>
	);
};
