# Upload → Ingestion → PR Feature Plan

This document outlines a minimal, efficient implementation to add a small web UI that lets users upload token/chain images, validates them, places them in the correct repo paths using the existing scripts, and opens a pull request with the changes. It mirrors the GitHub OAuth + PR creation flow described in `docs/github-auth-pr-flow.md` and adapts it to our Next.js setup.

## Goals

-   Simple frontend where a user sets variables (chainId, address/symbol, target) and drags/drops images.
-   “Sign in with GitHub” using OAuth; the client stores the user token in `sessionStorage` (as in the reference flow) and gates PR actions by sign‑in.
-   Server‑side handler saves images into `scripts/token-images-to-ingest/`, prepares a one‑off JSON entry, and runs the existing ingestion logic to place files in `tokens/` or `chains/`.
-   Uses the user’s GitHub OAuth token to create a branch/commit/PR via the GitHub Git Data API (no local `git push` required), with a clear summary and sample asset URLs.
-   Keep footprint small; reuse existing code and repo conventions.

## Scope & Constraints

-   Follow repo guidelines (formatting, naming, paths, sizes):
    -   `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
    -   `chains/<chainId>/` (or `chains/btcm/`) for chain logos (same filenames).
    -   PNGs must be exactly 32×32 and 128×128.
    -   Addresses lowercase for EVM; case-sensitive for Solana (`1151111081099710`).
-   Reuse `scripts/ingestTokens.js` and `scripts/token-images-to-ingest/` for ingestion.
-   Implement as Next.js pages + API routes under `_config/nodeAPI` to keep everything inside the existing dev/hosting surface.
-   Use environment variables for credentials; do not commit secrets.

## Architecture Overview

-   Frontend (Next.js app routes):

    -   Page at `/upload` with a small form and drag‑and‑drop.
    -   Inputs: `target` ("token" or "chain"), `chainId` (numeric or `btcm`), `address` (token only), `symbol`.
    -   Drag area accepts three files: `.svg`, `-32.png`, `-128.png`.
    -   Client validates obvious issues (presence of 3 files, extensions) before submit.
    -   GitHub sign‑in button (component) that initiates the OAuth flow and stores `github_token` in `sessionStorage` on success.

-   Auth flow (mirroring reference):

    -   Client: generate `auth_challenge` (state), redirect to `https://github.com/login/oauth/authorize?client_id=<NEXT_PUBLIC_GITHUB_CLIENT_ID>&state=<state>&scope=public_repo`.
    -   Server: `GET /api/auth/github/callback` exchanges `code` for a token and redirects to `/auth/github/success?token=...&state=...`.
    -   Client: success page verifies `state`, stores `github_token` in `sessionStorage`, returns to `/upload`.

-   API route (Next.js):

    -   Receives `multipart/form-data` with fields + files, and either `Authorization: Bearer <github_token>` or `token` in the form body.
    -   Writes files to `scripts/token-images-to-ingest/<slug>/`.
    -   Creates a temporary JSON (single entry) pointing to that folder.
    -   Runs ingestion via Node (`node scripts/ingestTokens.js <temp-json>`) for tokens.
    -   For chains, use a small helper (see “Chain ingestion” below) to mirror token ingest behavior into `chains/<chainId>/`.
    -   Reads the resulting target files (`tokens/...` or `chains/...`) and creates a GitHub branch/commit/PR using the Git Data API with the user’s token (no local git push).
    -   Cleans up the temporary `token-images-to-ingest/<slug>/` and the temp JSON file.

-   Git + GitHub PR flow:
    -   Uses GitHub REST Git Data API (via `fetch` or `@octokit/rest`):
        -   Resolve `default_branch` and base SHA.
        -   Create branch ref `refs/heads/<login>-<timestamp>` (or include chain/address context).
        -   Create blobs for each file (base64 content for PNGs/SVGs).
        -   Create a tree with paths under `tokens/` or `chains/`.
        -   Create a commit and update the branch ref.
        -   Open a PR into the default branch.
    -   Branch name: `<login>-upload-ingest-<chainId>[-<address>]-<timestamp>`.
    -   PR body includes chain/address context + sample URLs for quick review.

## Files To Add

-   `_config/nodeAPI/app/upload/page.tsx`: Upload form + drag‑and‑drop UI with signed‑in gating.
-   `_config/nodeAPI/app/api/upload/route.ts`: POST handler for uploads → ingestion → PR (accepts user token).
-   `_config/nodeAPI/app/api/auth/github/callback/route.ts`: OAuth callback → token exchange → redirect.
-   `_config/nodeAPI/app/auth/github/success/page.tsx`: Success page that stores token and returns to `/upload`.
-   `_config/nodeAPI/app/components/GithubSignIn.tsx`: Small client component to trigger OAuth and show signed‑in state.
-   `_config/nodeAPI/helpers/uploadValidation.ts`: Image validation (dimensions, extensions, sizes, safe names).
-   `_config/nodeAPI/helpers/git.ts`: Minimal helpers wrapping GitHub REST calls (resolve default branch, refs, blobs, trees, commits, PRs).
-   (Optional) `scripts/ingestChains.js`: Small counterpart to `ingestTokens.js` if we want to ingest chain logos via the same JSON flow; alternatively inline chain logic in the API route (see below).

## Data Flow

1. User fills the form and drops three files.
2. If not signed in, user clicks “Sign in with GitHub” and completes OAuth (token stored in `sessionStorage`).
3. Client uploads via `multipart/form-data` to `/api/upload` and includes the GitHub token (header or form field).
4. API validates images:
    - Extensions and MIME types: `.svg`, `.png`.
    - PNG dimensions: 32×32 and 128×128 (via `image-size` or minimal PNG header check).
    - Reasonable size caps (e.g., SVG ≤ 256 KB, PNGs ≤ 150 KB each).
5. Files written to `scripts/token-images-to-ingest/<slug>/` where `<slug>` = `${symbol || address}-${Date.now()}`.
6. Create a temp JSON alongside (e.g., `scripts/tmp-ingest-<slug>.json`) with either:
    - Token: `{ chainId, symbol, address, assetFolder: "./token-images-to-ingest/<slug>" }`
    - Chain: `{ chainId, symbol, target: "chain", assetFolder: "./token-images-to-ingest/<slug>" }`
7. Ingestion step:
    - Token: spawn `node scripts/ingestTokens.js scripts/tmp-ingest-<slug>.json`.
    - Chain: copy to `chains/<chainId>/` as `logo.svg`, `logo-32.png`, `logo-128.png` (either via a tiny `ingestChains.js` or inline in the API; same copy strategy as tokens).
8. Read the ingested output files and construct GitHub blobs/trees.
9. Create a branch, commit, and PR via GitHub REST (no local git push).
10. Return the PR URL to the client; cleanup temp assets + temp JSON.

## Implementation Steps

1. Frontend UI

-   Add `/upload` page in `_config/nodeAPI` with:
    -   Fields: `target` (select: token/chain), `chainId` (text/number), `address` (conditional), `symbol` (text).
    -   Drag‑and‑drop zone that enforces exactly three files with required names/extensions; show inline errors.
    -   On submit, POST `multipart/form-data` to `/api/upload` and show PR link on success.

2. API Handler

-   Parse `FormData` safely and normalize inputs according to conventions:
    -   Lowercase EVM addresses; preserve Solana case when `chainId === 1151111081099710`.
    -   Accept `chainId` as string to allow `btcm`.
-   Validate images server‑side (PNG dimensions, count, names) and reject with actionable messages.
-   Write files into `scripts/token-images-to-ingest/<slug>/`.
-   Generate one‑off JSON at `scripts/tmp-ingest-<slug>.json`.
-   Ingest:
    -   Token: `node scripts/ingestTokens.js scripts/tmp-ingest-<slug>.json`.
    -   Chain: copy into `chains/<chainId>/` (API route small helper or `scripts/ingestChains.js`).
-   GitHub REST (Git Data API) actions using the user token:
    -   Resolve `default_branch` and base SHA, then create `refs/heads/<login>-upload-<timestamp>`.
    -   Create blobs for `logo.svg`, `logo-32.png`, `logo-128.png` and a tree at the computed target path(s).
    -   Create a commit and update the ref.
    -   Open a PR titled `feat: add <symbol> assets on <chainId>`.
    -   Body includes:
        -   Title: `feat: add <symbol> assets on <chainId>`
        -   Chain/address context and paths added.
        -   Sample URLs (Next.js dev or production): `/api/token/<chainId>/<address>/logo-32.png` etc.
        -   Checklists for PNG sizes, naming, and formatting.
-   Cleanup temp files.

3. Chain Ingestion (two lightweight options)

-   EITHER: Add `scripts/ingestChains.js` mirroring `ingestTokens.js` but targeting `chains/<chainId>/` and skipping `address`.
-   OR: Inline a small `copyAndRenameImages` call in the API route for chain targets (avoids another script):
    -   `chains/<chainId>/logo.svg`
    -   `chains/<chainId>/logo-32.png`
    -   `chains/<chainId>/logo-128.png`

4. Configuration & Secrets

-   Required env vars (align with reference naming where applicable):
    -   `NEXT_PUBLIC_GITHUB_CLIENT_ID`: GitHub OAuth App Client ID (exposed to client).
    -   `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret (server‑side only).
    -   `URL`: Base URL for redirect in callback (e.g., `http://localhost:3000`).
    -   `REPO_OWNER`: e.g., `yearn`.
    -   `REPO_NAME`: `tokenAssets`.
    -   (Optional) `DEFAULT_BRANCH`: if not using the value from GitHub API.
-   For self‑hosting (Vercel): set these in project settings. Do not commit secrets.

5. Repo Hygiene

-   Do not commit temp JSON or `token-images-to-ingest` content.
-   Commit only the final `tokens/` or `chains/` assets.
-   Run `yarn format:check` at the root and `yarn --cwd _config/nodeAPI lint` after edits under `_config/nodeAPI`.

## Validation & Testing

-   Local dev:
    -   Start API: `yarn --cwd _config/nodeAPI dev`.
    -   Open `http://localhost:3000/upload` and submit a sample.
    -   Verify endpoint URLs locally: `/api/token/<chainId>/<address>/logo-32.png`.
    -   Run `yarn format:check` and `yarn --cwd _config/nodeAPI lint`.
-   Manual checks:
    -   Confirm both PNG sizes exist and load; ensure filenames are correct.
    -   Inspect created branch/PR; confirm only expected paths are changed.

## Error Handling & Security

-   Validate file count, names, types, and PNG dimensions server‑side.
-   Enforce size caps and reject overly large/complex SVGs.
-   Sanitize `symbol`, `address`, and `chainId` inputs; guard against path traversal.
-   Rate limit the upload endpoint (basic token bucket or per‑IP minute caps).
-   Limit concurrent ingestions; serialize file writes to `scripts/token-images-to-ingest`.
-   Use least‑privilege token; store only in env; never log secrets.

## Minimal Dependencies

-   Prefer GitHub REST via `fetch`; optionally use `@octokit/rest` for ergonomics.
-   `image-size` (or similar) for PNG dimension checks.
-   Keep code in `_config/nodeAPI` aligned with repo Prettier and ESLint.

## Future Enhancements (Optional)

-   Inline SVG optimization (SVGO) and automated PNG dimension fix (sharp/rsvg-convert) behind a toggle.
-   Multi‑asset batch uploads (multiple tokens per PR).
-   Support Solana address case preservation and automatic EVM checksum validation.
-   GitHub App flow (branch + PR without local git), creating blobs/trees directly via API for serverless environments.
-   Pre‑merge CI check to validate image sizes and naming in PRs.

## Rollout Plan

1. Implement GitHub OAuth endpoints (`/api/auth/github/callback`) and success page; add sign‑in button to `/upload`.
2. Implement `/upload` page and `/api/upload` route using user token and GitHub Git Data API for PRs.
3. Add chain ingestion (inline or separate script) to support `chains/<chainId>/`.
4. Add guards (rate limiting, size caps) and dimension validation.
5. Smoke test locally; share sample PRs.
6. If deploying, configure env vars and verify PR creation from the deployed instance.

## Acceptance Criteria

-   Users can submit three images + metadata and receive a PR link.
-   Assets land in the correct repo paths with correct filenames and dimensions.
-   PR body includes chain/address context and sample asset URLs.
-   No secrets or temp artifacts committed; formatting/lint passes.

## Notes & Variants

-   External contributors without push access:
    -   Optionally add fork‑and‑PR: use the user token to ensure a fork exists, create the branch/commit on the fork, and open a PR from `user:branch` → `yearn:default_branch`.
-   Server‑side state validation:
    -   For higher assurance, also validate `state` server‑side (sign and store a nonce in a cookie; verify in callback) as noted in the reference doc.
