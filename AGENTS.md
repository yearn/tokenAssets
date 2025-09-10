# Repository Guidelines

## Project Structure & Module Organization

-   Source assets: `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
-   Chain metadata: `chains/<chainId>/` and `chains/btcm/` for Bitcoin.
-   API/hosting configs: `_config/` (`nodeAPI` for Next.js, `goAPI` for Go).
-   Automation: `scripts/` (e.g., `ingestTokens.js` and image inputs under `scripts/token-images-to-ingest/`).
-   Root configs: `.editorconfig`, `.prettierrc`, `package.json`.

## Build, Test, and Development Commands

-   Format (root): `yarn format` or `npm run format` — applies Prettier to the repo.
-   Check format: `yarn format:check` — verifies formatting without writing.
-   Next.js dev (API): `yarn --cwd _config/nodeAPI dev` — starts the local API for previewing assets.
-   Next.js build: `yarn --cwd _config/nodeAPI build` — type-checks and builds the API bundle.
-   Ingest assets: `node scripts/ingestTokens.js ./scripts/tokensToInjest.json` — copies/renames prepared images into `tokens/`.

## Coding Style & Naming Conventions

-   Indentation: tabs, width 4 (`.editorconfig`).
-   Prettier: single quotes, semicolons, 120 col width.
-   Asset files per token: `logo.svg`, `logo-32.png`, `logo-128.png`.
-   Addresses: lowercase for EVM chains; case‑sensitive for Solana (`1151111081099710`).
-   Directory names: numeric `chainId` (or `btcm`).

## Testing Guidelines

-   No formal test suite. Validate by:
    -   Running `yarn --cwd _config/nodeAPI dev` and fetching `/api/token/<chainId>/<address>/logo-32.png`.
    -   Ensuring both PNG sizes exist and load; prefer PNG for production.
    -   Running `yarn format:check` and `yarn --cwd _config/nodeAPI lint` when editing `_config/nodeAPI`.

## Commit & Pull Request Guidelines

-   Commit style: conventional prefixes preferred (`chore:`, `fix:`, etc.).
-   PRs must include: change summary, sample asset URL(s), and chain/address context.
-   For new tokens, show the exact path created (e.g., `tokens/1/0xabc.../`).
-   Link related issues when applicable; add screenshots of rendered PNGs if helpful.

## Security & Configuration Tips

-   Optimize SVGs (keep simple; large/complex SVGs hinder performance).
-   Ensure PNGs are exactly 32×32 and 128×128.
-   Do not commit secrets or binaries outside `tokens/` and `_config/` build outputs.
