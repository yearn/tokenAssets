import {useCallback, useEffect, useMemo, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {GithubClientError, PROFILE_QUERY_KEY, fetchGithubProfile, type GithubProfile} from '../api/client/github';
import {
	AUTH_CHANGE_EVENT,
	AUTH_PENDING_STORAGE_KEY,
	AUTH_STATE_STORAGE_KEY,
	AUTH_ERROR_STORAGE_KEY,
	TOKEN_STORAGE_KEY,
	buildAuthorizeUrl,
	broadcastAuthChange,
	clearAuthError,
	clearAuthPending,
	clearStoredAuth,
	createOAuthState,
	markAuthPending,
	readAuthError,
	readAuthPending,
	readStoredToken,
	storeAuthError,
	storeAuthState
} from '../lib/githubAuth';

type UseGithubAuthResult = {
	token: string | null;
	profile: GithubProfile | null;
	login: string | null;
	isAuthenticated: boolean;
	isPending: boolean;
	isProfileLoading: boolean;
	error: string | null;
	signIn: () => void;
	signOut: () => void;
	retryProfile: () => Promise<GithubProfile | null>;
	dismissError: () => void;
	cancelPending: () => void;
};

function readClientId() {
	return import.meta.env.VITE_GITHUB_CLIENT_ID;
}

export function useGithubAuth(): UseGithubAuthResult {
	const queryClient = useQueryClient();
	const [token, setToken] = useState<string | null>(() => readStoredToken());
	const [isPending, setIsPending] = useState<boolean>(() => readAuthPending());
	const [error, setError] = useState<string | null>(() => readAuthError());

	const syncFromStorage = useCallback(() => {
		setToken(readStoredToken());
		setIsPending(readAuthPending());
		setError(readAuthError());
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		syncFromStorage();
		const handleStorage = (event: StorageEvent) => {
			if (
				!event.key ||
				event.key === TOKEN_STORAGE_KEY ||
				event.key === AUTH_PENDING_STORAGE_KEY ||
				event.key === AUTH_STATE_STORAGE_KEY ||
				event.key === AUTH_ERROR_STORAGE_KEY
			) {
				syncFromStorage();
			}
		};
		const handleAuthEvent = (_event: Event) => syncFromStorage();
		window.addEventListener('storage', handleStorage);
		window.addEventListener(AUTH_CHANGE_EVENT, handleAuthEvent);
		return () => {
			window.removeEventListener('storage', handleStorage);
			window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthEvent);
		};
	}, [syncFromStorage]);

	useEffect(() => {
		if (!token) {
			queryClient.removeQueries({queryKey: PROFILE_QUERY_KEY});
		}
	}, [token, queryClient]);

	const clearSession = useCallback(
		(message?: string) => {
			clearStoredAuth();
			clearAuthPending();
			setToken(null);
			setIsPending(false);
			queryClient.removeQueries({queryKey: PROFILE_QUERY_KEY});
			if (message) {
				storeAuthError(message);
				setError(message);
			} else {
				clearAuthError();
				setError(null);
			}
			broadcastAuthChange();
		},
		[queryClient]
	);

	const profileQuery = useQuery<GithubProfile, GithubClientError>({
		queryKey: PROFILE_QUERY_KEY,
		enabled: Boolean(token),
		queryFn: ({signal}) => fetchGithubProfile(token!, {signal}),
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 30,
		retry(failureCount: number, err: GithubClientError) {
			if (err instanceof GithubClientError && (err.status === 401 || err.status === 403)) return false;
			return failureCount < 2;
		}
	});

	useEffect(() => {
		if (!profileQuery.isSuccess) return;
		setIsPending(false);
		clearAuthPending();
		clearAuthError();
		setError(null);
	}, [profileQuery.isSuccess]);

	useEffect(() => {
		if (!profileQuery.isError || !profileQuery.error) return;
		setIsPending(false);
		clearAuthPending();
		const err = profileQuery.error;
		if (err instanceof GithubClientError && (err.status === 401 || err.status === 403)) {
			clearSession(err.message);
			return;
		}
		const message = err instanceof Error ? err.message : 'Failed to load GitHub profile.';
		storeAuthError(message);
		setError(message);
	}, [profileQuery.isError, profileQuery.error, clearSession]);

	const dismissError = useCallback(() => {
		clearAuthError();
		setError(null);
	}, []);

	const cancelPending = useCallback(() => {
		clearAuthPending();
		setIsPending(false);
	}, []);

	const signIn = useCallback(() => {
		if (typeof window === 'undefined') return;
		const clientId = readClientId();
		if (!clientId) {
			const message = 'GitHub client ID is not configured.';
			storeAuthError(message);
			setError(message);
			clearAuthPending();
			setIsPending(false);
			return;
		}
		const state = createOAuthState();
		storeAuthState(state);
		setIsPending(true);
		clearAuthError();
		setError(null);
		markAuthPending();
		window.location.href = buildAuthorizeUrl(clientId, state);
	}, []);

	const signOut = useCallback(() => {
		clearSession();
	}, [clearSession]);

	const retryProfile = useCallback(async () => {
		if (!token) return null;
		const result = await profileQuery.refetch();
		return result.data ?? null;
	}, [profileQuery, token]);

	const profile = profileQuery.data ?? null;
	const login = profile?.login ?? null;
	const isProfileLoading = profileQuery.isPending || profileQuery.isFetching;
	const isAuthenticated = Boolean(token);

	return useMemo(
		() => ({
			token,
			profile,
			login,
			isAuthenticated,
			isPending: isPending || isProfileLoading,
			isProfileLoading,
			error,
			signIn,
			signOut,
			retryProfile,
			dismissError,
			cancelPending
		}),
		[
			token,
			profile,
			login,
			isAuthenticated,
			isPending,
			isProfileLoading,
			error,
			signIn,
			signOut,
			retryProfile,
			dismissError,
			cancelPending
		]
	);
}
