import React, { useEffect, useState } from 'react';
import { GithubSignIn } from './GithubSignIn';
import { AUTH_CHANGE_EVENT, TOKEN_STORAGE_KEY, readStoredToken } from '../lib/githubAuth';

export const Header: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setToken(readStoredToken());
    update();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === TOKEN_STORAGE_KEY) update();
    };
    const onAuth = () => update();
    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
    };
  }, []);

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Yearn Asset Repo Upload</h1>
        <GithubSignIn key={token ? 'signed-in' : 'signed-out'} />
      </div>
    </header>
  );
};
