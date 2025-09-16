# Repository Guidelines

## Project Structure & Module Organization

- Assets: `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
- Chains: `chains/<chainId>/` (numeric `chainId`).
- Image Upload App: `app/image-tools/`.
- Automation: `scripts/` (e.g., `ingestTokens.js`; inputs in `scripts/token-images-to-ingest/`).
- Root configs: `.editorconfig`, `.prettierrc`, `package.json`.

## Build, Test, and Development Commands

- Format: `yarn format` or `npm run format` — apply Prettier to repo.
- Format check: `yarn format:check` — verify formatting without changes.
- API dev (preview assets): `yarn --cwd _config/nodeAPI dev` — serves `/api/token/<chainId>/<address>/logo-32.png`.
- API build: `yarn --cwd _config/nodeAPI build` — type-check and build bundle.
- Ingest prepared images: `node scripts/ingestTokens.js ./scripts/tokensToInjest.json` — copies/renames into `tokens/`.

## Coding Style & Naming Conventions

- Indentation: tabs, width 4 (`.editorconfig`).
- Prettier: single quotes, semicolons, 120‑column width.
- Token asset files: exactly `logo.svg`, `logo-32.png`, `logo-128.png`.
- Addresses: EVM lowercase; Solana case‑sensitive (e.g., `1151111081099710`).
- Directories: numeric `chainId` (or `btcm`); addresses under the chain folder.

## Testing Guidelines

- No formal test suite. Validate via API preview:
  - Open `/api/token/<chainId>/<address>/logo-32.png`.
  - Ensure both PNGs exist and load; dimensions are exactly 32×32 and 128×128.
- Prefer PNGs in production; keep SVGs simple and optimized.

## Commit & Pull Request Guidelines

- Commits: conventional prefixes preferred (e.g., `chore:`, `fix:`).
- PRs must include:
  - Change summary and rationale.
  - Exact path(s) added/changed (e.g., `tokens/1/0xabc.../`).
  - Sample API URL(s) and, if helpful, screenshots of rendered PNGs.
  - Linked issues or context.

## Security & Configuration Tips

- Do not commit secrets or binaries outside `tokens/` and `_config/` build outputs.
- Optimize SVGs (small, simple paths).
- Ensure PNGs are precisely sized (32×32, 128×128).
- Unless explicitly requested, avoid editing anything under `/_config`.
