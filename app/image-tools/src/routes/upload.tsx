import React, { useMemo, useState, useEffect } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../router';
import { GithubSignIn } from '../components/GithubSignIn';
import { API_BASE_URL } from '../lib/api';
import { Switch } from '@headlessui/react';

export const UploadComponent: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('github_token'));
  const [files, setFiles] = useState<{ svg?: File; png32?: File; png128?: File }>({});
  const [meta, setMeta] = useState({ target: 'token', chainId: '', address: '', symbol: '' });
  const canSubmit = useMemo(() => !!files.svg && !!files.png32 && !!files.png128 && !!meta.chainId && (meta.target === 'chain' || !!meta.address), [files, meta]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const name = e.target.name;
    setFiles((prev) => ({ ...prev, [name]: f }));
  };

  useEffect(() => {
    const handler = () => setToken(sessionStorage.getItem('github_token'));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return alert('Sign in with GitHub first.');
    const body = new FormData();
    body.append('target', meta.target);
    body.append('chainId', meta.chainId);
    if (meta.target === 'token') {
      body.append('address', meta.address);
      body.append('symbol', meta.symbol);
    } else {
      body.append('symbol', meta.symbol);
    }
    if (files.svg) body.append('svg', files.svg);
    if (files.png32) body.append('png32', files.png32);
    if (files.png128) body.append('png128', files.png128);

    const res = await fetch(new URL('/api/upload', API_BASE_URL).toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      return alert(`Upload failed: ${t}`);
    }
    const json = await res.json();
    if (json?.prUrl) {
      window.open(json.prUrl, '_blank');
    } else {
      alert('Upload complete, PR created.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 rounded-md border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">{token ? 'Signed in with GitHub' : 'Not signed in'}</div>
          {!token && <GithubSignIn />}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-md border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Submit Asset Files</h2>
            <p className="text-sm text-gray-500">Upload logo.svg, logo-32.png, and logo-128.png</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Chain</span>
            <Switch
              checked={meta.target === 'token'}
              onChange={(v: boolean) => setMeta((m) => ({ ...m, target: v ? 'token' : 'chain' }))}
              className={`${meta.target === 'token' ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${meta.target === 'token' ? 'translate-x-6' : 'translate-x-1'}`} />
            </Switch>
            <span className="text-sm text-gray-700">Token</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Chain ID</span>
            <input
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={meta.chainId}
              onChange={(e) => setMeta((m) => ({ ...m, chainId: e.target.value }))}
              placeholder="1 or btcm"
            />
          </label>

          {meta.target === 'token' && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Address</span>
              <input
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={meta.address}
                onChange={(e) => setMeta((m) => ({ ...m, address: e.target.value }))}
                placeholder="0x..."
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Symbol</span>
            <input
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={meta.symbol}
              onChange={(e) => setMeta((m) => ({ ...m, symbol: e.target.value }))}
              placeholder="YFI"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">SVG</span>
            <input type="file" name="svg" accept="image/svg+xml" onChange={onFileChange} className="block w-full text-sm text-gray-700" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">PNG 32x32</span>
            <input type="file" name="png32" accept="image/png" onChange={onFileChange} className="block w-full text-sm text-gray-700" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">PNG 128x128</span>
            <input type="file" name="png128" accept="image/png" onChange={onFileChange} className="block w-full text-sm text-gray-700" />
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={!canSubmit || !token}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={!token ? 'Sign in with GitHub to enable' : ''}
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export const UploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: UploadComponent,
});
