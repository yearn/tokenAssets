'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {ReactElement} from 'react';
import {useEffect, useRef, useState} from 'react';
import {completeGithubOAuthSignIn} from '../../../../src/lib/githubAuth';

export default function GithubSuccessPageClient(): ReactElement {
	const router = useRouter();
	const completed = useRef(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (completed.current) return;
		completed.current = true;

		const result = completeGithubOAuthSignIn(window.location.hash);
		window.history.replaceState(null, '', window.location.pathname);
		if (result.ok) router.replace('/');
		else setError(result.error);
	}, [router]);

	if (error) {
		return (
			<div
				role="alert"
				className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
				<h2 className="text-lg font-semibold">GitHub sign-in failed</h2>
				<p className="mt-2 text-sm">{error}</p>
				<Link
					href="/"
					className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium hover:bg-red-100">
					Return to the uploader
				</Link>
			</div>
		);
	}

	return <p>Signing you in…</p>;
}
