import React, { useEffect, useState } from 'react';
import { GithubSignIn } from './GithubSignIn';

export const Header: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const t = sessionStorage.getItem('github_token');
    setToken(t);
    const onStorage = () => setToken(sessionStorage.getItem('github_token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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

