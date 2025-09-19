# Repository Guidelines

## Project Structure & Module Organization

- Assets: `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
- Chains: `chains/<chainId>/` (numeric `chainId`).
- Image Upload App: `app/` (SPA + Vercel edge functions).
- Shared helpers: `app/src/shared/` (import via `@shared/*` from both SPA and edge code).
- Automation: `scripts/` (e.g., `ingestTokens.js`; inputs in `scripts/token-images-to-ingest/`).
- Root configs: `.editorconfig`, `.prettierrc`, `package.json`.

## Build, Test, and Development Commands

- SPA dev: `bun dev` in `app` (Vite on `http://localhost:5173`).
- Vercel dev: `vercel dev` in `app` (serves API under `/api/*`).
- Build/preview: `bun build` then `bun preview`.
- Type/lint: `bun run lint` or `bun run typecheck` (TS only).
- Tests: `bun run test` (Vitest, single-threaded; covers `@shared` helpers plus `/api/erc20-name`).
- Full sweep: `bun run validate` (`lint → typecheck → test`).
- Ingest assets: `node scripts/ingestTokens.js ./scripts/tokensToInjest.json` — copies prepared images into `tokens/`.

## Coding Style & Naming Conventions

- Indentation: tabs, width 4 (`.editorconfig`).
- Prettier: single quotes, semicolons, 120‑column width.
- Token asset files: exactly `logo.svg`, `logo-32.png`, `logo-128.png`.
- Addresses: EVM lowercase; Solana case‑sensitive (e.g., `1151111081099710`).
- Directories: numeric `chainId`; addresses under the chain folder.

## Testing Guidelines

- Unit tests: `bun run test` covers shared helpers (ABI decode, RPC selection, API base builders) and the `/api/erc20-name` edge handler (caching, error codes, timeout).
- Integration smoke: run `vercel dev` and validate:
  - OAuth callback: `/api/auth/github/callback` returns to `/auth/github/success`.
  - ERC-20 name lookup: POST `/api/erc20-name` (Edge).
  - Upload + PR: POST `/api/upload` (Edge) and confirm PR URL.
- Ensure PNGs are exactly 32×32 and 128×128; keep SVGs optimized.
- Configure ERC-20 lookup caching/timeouts via `ERC20_NAME_CACHE_TTL_MS`, `ERC20_NAME_CACHE_SIZE`, `ERC20_NAME_RPC_TIMEOUT_MS` when deploying edge functions.

## Commit & Pull Request Guidelines

- Commits: conventional prefixes preferred (e.g., `chore:`, `fix:`).
- PRs must include:
  - Change summary and rationale.
  - Exact path(s) added/changed (e.g., `tokens/1/0xabc.../`).
  - Sample API URL(s) and, if helpful, screenshots of rendered PNGs.
  - Linked issues or context.

## Security & Configuration Tips

- Do not commit secrets or binaries outside `tokens/` build outputs.
- Optimize SVGs (small, simple paths).
- Ensure PNGs are precisely sized (32×32, 128×128).
- Unless explicitly requested, avoid editing anything under `/_config`.
