import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  AUTH_CHANGE_EVENT,
  TOKEN_STORAGE_KEY,
  buildAuthorizeUrl,
  broadcastAuthChange,
  clearAuthPending,
  clearStoredAuth,
  clearStoredState,
  markAuthPending,
  readAuthPending,
  readStoredState,
  readStoredToken,
  storeAuthState,
  storeAuthToken
} from '../githubAuth';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('githubAuth helpers', () => {
  it('builds authorize URL with expected params', () => {
    const url = new URL(buildAuthorizeUrl('client', 'state'));
    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('scope')).toBe('public_repo');
  });

  it('stores and reads auth token/state safely', () => {
    expect(readStoredToken()).toBeNull();
    expect(readStoredState()).toBeNull();

    storeAuthToken('token');
    storeAuthState('state');

    expect(readStoredToken()).toBe('token');
    expect(readStoredState()).toBe('state');

    clearStoredAuth();
    clearStoredState();

    expect(readStoredToken()).toBeNull();
    expect(readStoredState()).toBeNull();
  });

  it('tracks pending auth state in session storage', () => {
    expect(readAuthPending()).toBe(false);
    markAuthPending();
    expect(readAuthPending()).toBe(true);
    clearAuthPending();
    expect(readAuthPending()).toBe(false);
  });

  it('broadcasts auth change events', () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_CHANGE_EVENT, listener);

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    broadcastAuthChange();

    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect(listener).toHaveBeenCalledTimes(1);

    const storageEventCounts = dispatchSpy.mock.calls.filter(([event]) =>
      event instanceof StorageEvent && event.key === TOKEN_STORAGE_KEY
    );
    expect(storageEventCounts.length).toBeGreaterThanOrEqual(1);
  });
});
