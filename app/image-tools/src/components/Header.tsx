import React from 'react';
import {GithubSignIn} from './GithubSignIn';
import {useGithubAuthToken} from '../hooks/useGithubAuth';

export const Header: React.FC = () => {
	const token = useGithubAuthToken();

	return (
		<header className="border-b bg-white">
			<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
				<h1 className="text-xl font-semibold">Yearn Asset Repo Upload</h1>
				<GithubSignIn token={token} />
			</div>
		</header>
	);
};
