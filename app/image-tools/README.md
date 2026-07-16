# Image Tools App

A Next.js app for uploading token and chain assets and opening pull requests against this repository.

## Environment variables

### Browser

-   `NEXT_PUBLIC_GITHUB_OAUTH_BROKER_ORIGIN` — optional; defaults to `https://token-assets.yearn.fi`. The production
    broker uses its registered GitHub callback and safely returns users to approved preview origins.

### Server

-   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth App credentials used by the production broker.
-   `OAUTH_RETURN_ORIGINS` — optional comma-separated list of additional exact origins allowed after GitHub OAuth.
    The canonical production origin and private `dev-vm.tail197cc7.ts.net` preview host are already trusted.
-   `REPO_OWNER` and `REPO_NAME` — default to `yearn/tokenAssets`.
-   `ALLOW_REPO_OVERRIDE` — set to `true` only when intentionally targeting another repository from a fork deployment.
-   `RPC_URI_FOR_<chainId>` or `RPC_<chainId>` — optional RPC URLs used by `/api/erc20-name`. Legacy `VITE_RPC_*`
    names are temporarily accepted during deployment migration.

The GitHub OAuth App callback must be `https://token-assets.yearn.fi/api/auth/github/callback`. Preview sign-in starts
at the production `/api/auth/github/start` broker, which signs the requested app origin into OAuth state. GitHub then
returns to the registered production callback, and the broker returns the token in the URL fragment of the approved
preview or production `/auth/github/success` route.

### OAuth deployment transition

The pre-migration production Vite client starts GitHub OAuth with an unsigned nonce. The Next.js callback intentionally
does not accept that legacy state. An OAuth attempt started in an old or already-open Vite tab before the Next.js
deployment will fail after cutover; the user must refresh and start sign-in again. Deploy the Next.js frontend, OAuth
start route, and callback together so all newly started attempts use signed, expiring state.

## Commands

-   `bun dev` — Next.js development server at `http://127.0.0.1:3000`.
-   `bun build` — production Next.js build.
-   `bun preview` — serve the production build at `http://127.0.0.1:3000`.
-   `bun typecheck` / `bun lint` — TypeScript validation.
-   `bun test` — focused Bun tests for OAuth and upload behavior.

Node.js 20.9 or newer is required. Vercel should use `app/image-tools` as the project root and the Next.js framework
preset.

## App flow

1. The App Router serves the upload form.
2. GitHub sign-in uses the production OAuth broker and returns through `/auth/github/success`.
3. The client calls `POST /api/erc20-name` to resolve ERC-20 names through a server-only RPC.
4. Dropping an SVG generates 32×32 and 128×128 PNG previews in the browser.
5. `POST /api/upload` validates the multipart files and opens a GitHub pull request.

Git tree entries create missing directories implicitly. A chain `999` upload submits
`chains/999/{logo.svg,logo-32.png,logo-128.png}` even when `chains/999` does not exist yet.
