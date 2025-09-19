import React from 'react';
import { GithubSignIn } from './GithubSignIn';

export const Header: React.FC = () => (
	<header className="border-b bg-white">
		<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<h1 className="text-xl font-semibold">Yearn Asset Repo Upload</h1>
			<GithubSignIn />
		</div>
	</header>
);
