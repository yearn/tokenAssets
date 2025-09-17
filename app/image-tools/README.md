# Image Tools App

A lightweight SPA + Vercel Functions app for uploading token/chain assets and opening GitHub PRs into this repository.

## Environment Variables (Dev/Prod)

- Client (exposed to browser)
  - `VITE_GITHUB_CLIENT_ID` — GitHub OAuth App client ID.
  - `VITE_API_BASE_URL` — optional; default same-origin. Set only if the API lives on another origin.
  - `VITE_RPC_URI_FOR_<chainId>` — optional RPC URLs used by `/api/erc20-name`.
- Server (Vercel Functions)
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — same GitHub OAuth App used by the client.
  - `APP_BASE_URL` — optional; default request origin. Only set if SPA and API are on different origins.
  - `REPO_OWNER` (default `yearn`), `REPO_NAME` (default `tokenAssets`).
  - `ALLOW_REPO_OVERRIDE` — set to `true` only if you intentionally want to target a non-yearn repo when deploying from a fork.
- GitHub OAuth App callback must match the current domain: `https://<domain>/api/auth/github/callback` (or `http://localhost:3000/...` for `vercel dev`).

## Commands

- `bun dev` — Vite dev server for the SPA (http://localhost:5173).
- `vercel dev` — Runs API routes and serves the SPA locally (recommended for full flow).
- `bun build` / `bun preview` — Build and preview the SPA.
- `bun typecheck` — TypeScript type checks (acts as lightweight lint).
- `bun lint` — Alias to type checks.

## App Flow (What Calls What)

1) Open the site — SPA loads; no API calls by default.
2) Sign in with GitHub — Browser goes to GitHub OAuth; upon approval GitHub redirects to `/api/auth/github/callback` (Edge). The function exchanges the code for a token and redirects to `/auth/github/success` where the token is stored.
3) Enter chain/address — Client may call `POST /api/erc20-name` (Edge) to resolve ERC‑20 name.
4) Drop SVG — Client generates PNG previews (32×32, 128×128) via Canvas.
5) Submit PR — Client posts multipart form to `POST /api/upload` (Edge) with `svg`, `png32`, and `png128`. The function validates sizes and opens a PR via GitHub API.

## Notes

- PNGs are generated client‑side and validated on the server.
- Keep SVGs simple/optimized; ensure PNGs are exactly 32×32 and 128×128.
