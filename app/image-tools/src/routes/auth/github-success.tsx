import React, {useEffect} from 'react';
import {createRoute, useNavigate} from '@tanstack/react-router';
import {rootRoute} from '../../router';
import {
	broadcastAuthChange,
	clearAuthPending,
	clearStoredState,
	readStoredState,
	storeAuthToken
} from '../../lib/githubAuth';

const GithubSuccessComponent: React.FC = () => {
	const navigate = useNavigate();
	useEffect(() => {
		const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
		const token = params.get('token');
		const state = params.get('state');
		const returnedState = readStoredState();
		clearAuthPending();
		const stateMatches = Boolean(state && returnedState && state === returnedState);
		if (!stateMatches) {
			console.warn('OAuth state mismatch.');
		} else if (token) {
			storeAuthToken(token);
			broadcastAuthChange();
		}
		if (state) clearStoredState();
		navigate({to: '/'});
	}, [navigate]);

	return <p>Signing you in…</p>;
};

export const GithubSuccessRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/auth/github/success',
	component: GithubSuccessComponent
});
