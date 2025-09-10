# GitHub Auth and PR Flow

This document explains how this repo implements “Sign in with GitHub” and how it creates a pull request with user changes. It’s intended as a guide to re‑implement a similar flow in another project.

## Overview

-   Frontend triggers GitHub OAuth, stores the token in `sessionStorage`, and gates PR actions based on sign‑in status.
-   Backend exchanges the OAuth `code` for an `access_token` and exposes a PR API that uses GitHub’s REST endpoints to create a branch, commit JSON changes, and open a PR.
-   Configuration relies on a few environment variables for OAuth and repo targeting.

Key files:

-   `packages/app/api/server.ts`
-   `packages/app/api/auth/github/callback.ts`
-   `packages/app/api/pr.tsx`
-   `packages/app/src/components/GithubSignIn.tsx`
-   `packages/app/src/routes/auth/github/Success.tsx`

## Endpoints

-   `GET /api/auth/github/callback`
    -   Exchanges the GitHub OAuth `code` for an access token.
    -   Redirects the user to the frontend success route with `token` and `state` in the querystring.
-   `POST /api/pr`
    -   Accepts `{ token, path, contents }`.
    -   Creates a branch, commit, and pull request via GitHub API.

Server wiring: `packages/app/api/server.ts`

```ts
serve({
	fetch(req) {
		const url = new URL(req.url);
		if (url.pathname === '/api/auth/github/callback') return githubCallback(req);
		if (url.pathname === '/api/pr') return pr(req);
		// ...
	},
	port: 3001
});
```

## OAuth Sign‑In Flow

1. Start OAuth (client)

-   File: `packages/app/src/components/GithubSignIn.tsx`
-   Generates an `auth_challenge` (state) and redirects to GitHub:

```ts
const auth_challenge = crypto.randomUUID();
sessionStorage.setItem('auth_challenge', auth_challenge);
window.location.href = `https://github.com/login/oauth/authorize?client_id=${
	import.meta.env.VITE_GITHUB_CLIENT_ID
}&state=${auth_challenge}&scope=public_repo`;
```

2. Callback (server)

-   File: `packages/app/api/auth/github/callback.ts`
-   Exchanges `code` for a token using `VITE_GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`:

```ts
const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
	method: 'POST',
	headers: {Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
	body: new URLSearchParams({
		client_id: process.env.VITE_GITHUB_CLIENT_ID!,
		client_secret: process.env.GITHUB_CLIENT_SECRET!,
		code
	})
});
```

-   Redirects to the frontend success route with `token` and `state`:

```ts
const redirect = new URL('/auth/github/success', process.env.URL || 'http://localhost:3000');
redirect.searchParams.set('token', tokenData.access_token ?? '');
redirect.searchParams.set('state', state);
return Response.redirect(redirect.toString(), 302);
```

3. Finalize sign‑in (client)

-   File: `packages/app/src/routes/auth/github/Success.tsx`
-   Verifies `state` against `auth_challenge` and stores the GitHub token in `sessionStorage`:

```ts
if (state !== sessionStorage.getItem('auth_challenge')) {
	/* error */
}
sessionStorage.setItem('github_token', token ?? '');
window.location.href = '/';
```

4. Signed‑in state and user fetch (client)

-   File: `packages/app/src/components/GithubSignIn.tsx`
-   Presence of `sessionStorage['github_token']` implies signed‑in; optionally fetches `GET https://api.github.com/user` for avatar/identity display.

## Pull Request Flow

1. Client prepares a change

-   UI layers prepare a `path` and `contents` (JSON) that represent the exact file and payload to change inside the repo.
-   Examples:
    -   Globals: `packages/app/src/components/Global.tsx`
    -   Collections: `packages/app/src/routes/Collection.tsx`
    -   Vaults: `packages/app/src/routes/Vault.tsx`
    -   Strategies: `packages/app/src/routes/Strategy.tsx`

2. Client POST → `/api/pr`

-   Body: `{ token: sessionStorage.getItem('github_token'), path, contents }`
-   The UI opens the returned PR URL on success.

3. Server creates branch, commit, and PR (GitHub REST)

-   File: `packages/app/api/pr.tsx`
-   Steps:

    -   Validate body and token.
    -   `GET /user` to validate and obtain `login` (username).
    -   `GET /repos/{owner}/{repo}` to fetch `default_branch`.
    -   `GET /repos/{owner}/{repo}/git/ref/heads/{default_branch}` to obtain base commit SHA.
    -   `POST /repos/{owner}/{repo}/git/refs` to create a new branch `refs/heads/{username}-{Date.now()}` from `baseSha`.
    -   `POST /repos/{owner}/{repo}/git/blobs` to create the blob for `contents`.
    -   `POST /repos/{owner}/{repo}/git/trees` to include the blob at `path` (mode `100644`, type `blob`).
    -   `POST /repos/{owner}/{repo}/git/commits` with the new tree and parent `baseSha`.
    -   `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` to point the branch to the new commit.
    -   `POST /repos/{owner}/{repo}/pulls` to open a PR from the new branch into the default branch.

-   Repo targets:
    -   `REPO_OWNER = process.env.REPO_OWNER || 'yearn'`
    -   `REPO_NAME = process.env.REPO_NAME || 'cms'`

## Configuration

-   `VITE_GITHUB_CLIENT_ID` (frontend + server) — GitHub OAuth App Client ID.
-   `GITHUB_CLIENT_SECRET` (server) — GitHub OAuth App Client Secret.
-   `URL` (server) — Base URL of the frontend used for the success redirect.
-   Optional: `REPO_OWNER`, `REPO_NAME` to direct PRs to a different repo.

Example env: `packages/app/.env.example`

```env
VITE_CDN_URL=
VITE_ASSETS_CDN_URL=https://cdn.jsdelivr.net/gh/yearn/tokenAssets@main
VITE_GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
URL=
```

## End‑to‑End Sequence

-   Client click → GitHub authorize using `client_id`, `state`, `scope=public_repo`.
-   GitHub redirects to `/api/auth/github/callback?code=...&state=...`.
-   Server exchanges code for token; redirects to `/auth/github/success?token=...&state=...`.
-   Client verifies state, stores `github_token`, and reloads.
-   Client POSTs `/api/pr` with `{ token, path, contents }`.
-   Server creates branch, blob, tree, commit, updates ref, and opens PR.
-   Client opens `pullRequestUrl`.

## Re‑Implementation Blueprint

Frontend

-   Sign‑in button:
    -   Generate `auth_challenge` with `crypto.randomUUID()` and save in `sessionStorage`.
    -   Redirect to `https://github.com/login/oauth/authorize?client_id=<VITE_GITHUB_CLIENT_ID>&state=<auth_challenge>&scope=public_repo`.
-   Success route:
    -   Read `token` and `state`, verify against `auth_challenge`.
    -   Save `github_token` to `sessionStorage` and navigate to the app.
-   Gating & UX:
    -   Consider a `useGithubUser()` hook that fetches `/user` for avatar and toggles PR buttons based on signed‑in status.
-   PR trigger:
    -   POST `/api/pr` with `{ token, path, contents }` and open returned `pullRequestUrl`.

Backend

-   `GET /api/auth/github/callback`:
    -   Validate env vars and presence of `code` + `state`.
    -   POST to `https://github.com/login/oauth/access_token`.
    -   Redirect to frontend success with `token` + `state`.
-   `POST /api/pr`:
    -   Validate token; fetch `GET /user`.
    -   Resolve default branch and base SHA; create branch; create blob/tree/commit; update ref; create PR; return PR URL.

## Security & Limitations

-   State validation is client‑side only:
    -   For higher assurance, also validate `state` server‑side (e.g., store a signed nonce in a cookie and compare on callback).
-   Token storage:
    -   `sessionStorage` is accessible to JS; for sensitive scenarios, use httpOnly cookies and a server‑side session.
-   Repository permissions:
    -   This flow creates a branch on the target repo; the user’s token needs push access. For external contributors, implement a fork‑and‑PR variant.
-   Scopes:
    -   Uses `public_repo`. Use `repo` if you need private repo access.

## Dev Setup Notes

-   API runs on port 3001 via Bun `serve()`; frontend runs on port 3000 via Vite.
-   In development, set your GitHub OAuth App callback URL to your API host, e.g., `http://localhost:3001/api/auth/github/callback` or your ngrok URL.
-   Scripts: `packages/app/package.json` (`dev`, `dev:client`, `dev:server`, `dev:all`). Optional `ngrok` runner in `packages/app/ngrok.ts`.
