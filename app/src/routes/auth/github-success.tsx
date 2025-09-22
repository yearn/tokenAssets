import {createRoute, useNavigate} from '@tanstack/react-router';
import React, {useEffect} from 'react';
import {
	broadcastAuthChange,
	clearAuthError,
	clearAuthPending,
	clearStoredAuth,
	clearStoredState,
	readStoredState,
	storeAuthError,
	storeAuthToken
} from '../../lib/githubAuth';
import {rootRoute} from '../../router';

const GithubSuccessComponent: React.FC = () => {
	const navigate = useNavigate();
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const token = params.get('token');
		const state = params.get('state');
		const expectedState = readStoredState();

		if (state) clearStoredState();
		clearAuthPending();

		if (!token) {
			clearStoredAuth();
			storeAuthError('GitHub did not return an access token. Please try signing in again.');
			broadcastAuthChange();
			navigate({to: '/'});
			return;
		}

		if (expectedState && state !== expectedState) {
			console.warn('OAuth state mismatch.');
			clearStoredAuth();
			storeAuthError('GitHub login could not be verified. Please try signing in again.');
		} else {
			storeAuthToken(token);
			clearAuthError();
		}

		broadcastAuthChange();
		navigate({to: '/'});
	}, [navigate]);

	return <p>Signing you in…</p>;
};

export const GithubSuccessRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/auth/github/success',
	component: GithubSuccessComponent
});
