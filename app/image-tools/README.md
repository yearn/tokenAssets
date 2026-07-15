# Image Tools App

A lightweight SPA + Vercel Functions app for uploading token/chain assets and opening GitHub PRs into this repository.

## Environment Variables (Dev/Prod)

-   Client (exposed to browser)
    -   `VITE_GITHUB_OAUTH_BROKER_ORIGIN` — optional; defaults to `https://token-assets.yearn.fi`, whose registered
        callback brokers sign-in back to approved preview origins.
    -   `VITE_API_BASE_URL` — optional; default same-origin. Set only if the API lives on another origin.
    -   `VITE_RPC_URI_FOR_<chainId>` — optional RPC URLs used by `/api/erc20-name`.
-   Server (Vercel Functions)
    -   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth App credentials used by the production broker.
    -   `OAUTH_RETURN_ORIGINS` — optional comma-separated list of additional exact origins allowed after GitHub OAuth.
        The canonical production origin and the private `dev-vm.tail197cc7.ts.net` preview host are already trusted.
    -   `REPO_OWNER` (default `yearn`), `REPO_NAME` (default `tokenAssets`).
    -   `ALLOW_REPO_OVERRIDE` — set to `true` only if you intentionally want to target a non-yearn repo when deploying
        from a fork.
-   GitHub OAuth App callback must be configured to the deployed API callback URL:
    `https://<api-domain>/api/auth/github/callback`. The client intentionally does not send a `redirect_uri`; GitHub
    uses the callback URL registered on the OAuth App. The signed OAuth state then safely returns the user to the
    production or approved preview origin that started sign-in.

## Commands

-   `bun dev` — Vite dev server for the SPA (http://localhost:5173).
-   `vercel dev` — Runs API routes and serves the SPA locally (recommended for full flow).
-   `bun build` / `bun preview` — Build and preview the SPA.
-   `bun typecheck` — TypeScript type checks (acts as lightweight lint).
-   `bun lint` — Alias to type checks.

## App Flow (What Calls What)

1. Open the site — SPA loads; no API calls by default.
2. Sign in with GitHub — Browser starts at the production OAuth broker, which signs the requested app origin into the OAuth state before redirecting to GitHub. GitHub always returns to the registered production `/api/auth/github/callback` (Edge), which verifies the state, exchanges the code, and safely returns to `/auth/github/success` on the original production or preview origin.
3. Enter chain/address — Client may call `POST /api/erc20-name` (Edge) to resolve ERC‑20 name.
4. Drop SVG — Client generates PNG previews (32×32, 128×128) via Canvas.
5. Submit PR — Client posts multipart form to `POST /api/upload` (Node.js) with `svg`, `png32`, and `png128`. The function validates sizes and opens a PR via GitHub API. GitHub's tree API creates missing token or chain directories from the submitted file paths.

## Notes

-   PNGs are generated client‑side and validated on the server.
-   Keep SVGs simple/optimized; ensure PNGs are exactly 32×32 and 128×128.
