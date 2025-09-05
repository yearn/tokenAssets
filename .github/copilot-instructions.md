# Copilot Instructions for tokenAssets

These guidelines help AI agents work effectively in this repository. Focus on accuracy of file operations and preserving existing patterns. Keep PRs minimal and purpose-driven.

## 🔭 Project Purpose

Single-source CDN-style repository of token + chain logo assets (PNG 32/128 + optional SVG) served via simple HTTP endpoints. Two delivery implementations exist:

-   Go server (`_config/goAPI/`): lightweight redirector + rate limiting.
-   Next.js server (`_config/nodeAPI/`): edge-friendly fetch & cache control + middleware for path normalization.
    Both ultimately redirect/fetch raw files from `main` branch of this repo on GitHub.

## 🗂 Key Directories

-   `tokens/<chainId>/<tokenAddress>/logo[-size].(png|svg)` canonical asset storage.
-   `chains/<chainId>/logo[-size].(png|svg)` chain logos.
-   `_config/goAPI/` Go gin server (rate limiting, redirects) files: `main.go`, `serveToken.go`, `serveChain.go`, `helpers.go`.
-   `_config/nodeAPI/` Next.js (App Router) with duplicated route handlers under both `/api/...` and non-`/api` forms (plus `middleware.ts` to rewrite). Build script copies assets into `public` for static export.
-   `scripts/ingestTokens.js` bulk helper to copy prepared images into `tokens/` structure using `scripts/tokensToInjest.json` spec.
-   `scripts/generateYearnTokenList.ts` builds a Yearn-focused token list from the yDaemon API and writes to `tokenlists/yearn.tokenlist.json`.
-   `tokenlists/` emitted JSON token lists (committed artifacts, not runtime output).
-   `scripts/yearn.blacklist.json` optional per-chain address blacklist merged with in-code `BUILTIN_BLACKLIST` during list generation.

## 🔄 Typical Workflows

1. Add a new token:
    - Prepare 3 files: `SYMBOL.svg`, `SYMBOL-32.png`, `SYMBOL-128.png` (square, optimized) and place in a new folder under `scripts/token-images-to-ingest`.
    - Add entry to `scripts/tokensToInjest.json`: `{"chainId":<number>,"symbol":"SYMBOL","address":"0x...","assetFolder":"./token-images-to-ingest/<folder>"}`.
    - Run: `node scripts/ingestTokens.js scripts/tokensToInjest.json` (ensure address lowercased for EVM; script enforces lowercase dest).
    - Commit newly created `tokens/<chainId>/<address>/logo*.{png,svg}`.
2. Add a chain logo: manually place `logo.svg`, `logo-32.png`, `logo-128.png` under `chains/<chainId>/`.
3. Local Node API dev: from repo root run `yarn --cwd _config/nodeAPI dev` (or `npm` equivalent). Build script (`build.sh`) copies `tokens` & `chains` numeric dirs into `public/` before Next dev/build.
4. Local Go server: `go run ./_config/goAPI` then query `http://localhost:8081/token/<chain>/<address>/logo-32.png`.
5. Generate Yearn token list:
    - (Optional) Update `scripts/yearn.blacklist.json` with addresses to exclude: `{ "1": ["0xaddr..."], "42161": ["0x..."] }` (case-insensitive; script lowercases internally).
    - Run `npm run generate:yearn` (root). This fetches `https://ydaemon.yearn.fi/tokens/all`, enriches with local logo URIs only if `tokens/<chain>/<addr>/logo-128.png` exists, applies blacklist, dedupes, and writes `tokenlists/yearn.tokenlist.json`.
    - Commit the updated list if changes (do not hand-edit generated JSON besides version bump if needed).

## 🌐 Served URL Patterns

Accepted file names only: `logo.svg`, `logo-32.png`, `logo-128.png`.
Token endpoints support both with and without `/api/`, e.g.:
`/api/token/1/0xabc.../logo-32.png` and `/token/1/0xabc.../logo-32.png`.
Chain endpoints similarly: `/api/chain/1/logo-32.png` etc.
Gas token sentinel: address `0xeeee...eeee` returns special gas icon or fallback.
Query param `?fallback=true` forces redirect/serve default placeholder. `?fallback=<url>` attempts remote image (validated by `Content-Type` starts with `image/`).

## 🛡 Rate Limiting (Go server)

Limiter key = Origin header. Allowlist if origin ends with any of: `http`, `.smold.app`, `http://localhost:` or empty origin. Others: token bucket 50 burst / ~1s refill.

## 🧱 Architectural Nuances

-   Indirection: Both servers reference raw GitHub URLs, so new assets become available only after merge into `main`. (Branch assets not served.)
-   Node implementation adds cache headers (shorter 60s for tokens; longer 86400 for chains) and MIME correctness for SVG vs PNG.
-   Route duplication (token vs tokens, chain vs chains) preserved intentionally for backward compatibility.
-   Addresses lowercased only when starting with `0x`; non-EVM (e.g., Solana directory named exactly) stays case sensitive.

## 🧪 Testing / Validation Tips

-   After ingest, verify paths exist: `ls tokens/<chain>/<addr>`.
-   Curl a token once deployed: `curl -I https://token-assets-one.vercel.app/api/token/1/<addr>/logo-32.png` → expect 301/308 then 200 from raw GitHub.
-   For Next local: ensure `public/tokens/<chain>/<addr>/logo-32.png` after dev start (copied by `build.sh`).

## 🔧 Conventions & Gotchas

-   Only three filenames are valid; any other filename triggers fallback logic.
-   Keep image sizes consistent (32x32 & 128x128); square canvas.
-   Do not rename helper functions; external logic may rely on current endpoint shapes.
-   Avoid adding heavy dependencies; serving is latency-focused.
-   When adding new route logic, mirror in both singular & plural forms for consistency.
-   Token list generator: skips zero address, only sets `logoURI` if corresponding `logo-128.png` exists, outputs lowercase addresses inside URL path.
-   Blacklist: combine hard-coded `BUILTIN_BLACKLIST` plus JSON file; removed count logged after generation.

## 📦 Dependency Notes

-   Go: gin, rate limiter (`golang.org/x/time/rate`), in-memory cache for limiter handles.
-   Node: Next.js App Router; minimal helpers only. Build script uses POSIX `find` to copy numeric directories.

## ✅ PR Guidance for Agents

-   Limit scope: asset additions or small server adjustments in separate commits.
-   For asset PRs: include only new `chains/` or `tokens/` subdirectories + updated list files if required.
-   Run prettier formatting if modifying JS/TS: `yarn format` (root) or `yarn --cwd _config/nodeAPI lint` before committing.
-   If updating token list: run `npm run generate:yearn`; include resulting JSON diff; avoid manual edits except deterministic version bump fields.

## 🙋 Clarity Gaps (Ask Maintainers If Needed)

-   Any planned deprecation of Go vs Node implementation.
-   Additional accepted fallback behaviors or cache TTL adjustments.

Refine this file if new patterns emerge (update both server layers, ingestion script changes, cache policy shifts).
