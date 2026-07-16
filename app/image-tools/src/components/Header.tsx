'use client';

import React from 'react';
import {GithubSignIn} from './GithubSignIn';
import {useGithubAuthToken} from '../hooks/useGithubAuth';

export const Header: React.FC = () => {
	const token = useGithubAuthToken();

	return (
		<header className="border-b bg-white">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
				<h1 className="text-xl font-semibold">Yearn Asset Repo Upload</h1>
				<div className="flex items-center gap-2">
					<a
						href="https://github.com/yearn/tokenAssets"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
						aria-label="Open the yearn/tokenAssets repository on GitHub in a new tab">
						<svg
							viewBox="0 0 24 24"
							className="h-4 w-4"
							fill="currentColor"
							aria-hidden="true">
							<path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234C5.662 21.302 4.967 18.98 4.967 18.98c-.545-1.385-1.33-1.754-1.33-1.754-1.087-.744.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.419-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.301 1.23A11.5 11.5 0 0 1 12 5.621c1.02.005 2.047.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.475c0 .319.192.694.801.576C20.566 21.797 24 17.301 24 12 24 5.373 18.627 0 12 0Z" />
						</svg>
						GitHub
					</a>
					<GithubSignIn token={token} />
				</div>
			</div>
		</header>
	);
};
