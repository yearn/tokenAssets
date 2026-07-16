# Repository Guidelines

## Project Structure & Module Organization

-   Assets: `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
-   Chains: `chains/<chainId>/` (numeric `chainId`).
-   Image Upload App: `app/image-tools/`.
-   Automation: `scripts/` (e.g., `ingestTokens.js`; inputs in `scripts/token-images-to-ingest/`).
-   Root configs: `.editorconfig`, `.prettierrc`, `package.json`.

## Build, Test, and Development Commands

-   Next.js dev: `bun dev` in `app/image-tools` (`http://127.0.0.1:3000`).
-   The Next.js server serves both the UI and API routes under `/api/*`.
-   Build/preview: `bun build` then `bun preview`.
-   Ingest assets: `node scripts/ingestTokens.js ./scripts/tokensToInjest.json` — copies prepared images into `tokens/`.

## Coding Style & Naming Conventions

-   Indentation: tabs, width 4 (`.editorconfig`).
-   Prettier: single quotes, semicolons, 120‑column width.
-   Token asset files: exactly `logo.svg`, `logo-32.png`, `logo-128.png`.
-   Addresses: EVM lowercase.
-   Directories: numeric `chainId`; addresses under the chain folder.

## Testing Guidelines

-   Run `bun test`, `bun typecheck`, and `bun build`. Validate against the Next.js server:
    -   OAuth callback: `/api/auth/github/callback` returns to `/auth/github/success`.
    -   ERC-20 name lookup: POST `/api/erc20-name` (Node.js).
    -   Upload + PR: POST `/api/upload` (Node.js) and confirm PR URL.
-   Ensure PNGs are exactly 32×32 and 128×128; keep SVGs optimized.

## Commit & Pull Request Guidelines

-   Commits: conventional prefixes preferred (e.g., `chore:`, `fix:`).
-   PRs must include:
    -   Change summary and rationale.
    -   Exact path(s) added/changed (e.g., `tokens/1/0xabc.../`).
    -   Sample API URL(s) and, if helpful, screenshots of rendered PNGs.
    -   Linked issues or context.

## Security & Configuration Tips

-   Do not commit secrets or binaries outside `tokens/` build outputs.
-   Optimize SVGs (small, simple paths).
-   Ensure PNGs are precisely sized (32×32, 128×128).
-   Unless explicitly requested, avoid editing anything under `/_config`.
