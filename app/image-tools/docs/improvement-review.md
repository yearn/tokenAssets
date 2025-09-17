# Image Tools Improvement Review

_Last updated: 2025-09-17_

## Key Priorities

- Break the upload workflow into smaller, testable modules and shared utilities to reduce the 1.1k-line `UploadComponent` and remove duplicated preview/state logic (`src/routes/upload.tsx:1-1139`).
- Harden the upload API surface with server-side address validation, reusable file validation helpers, and consistent metadata handling to prevent malformed submissions (`api/upload.ts:80-200`).
- Tighten OAuth and GitHub integration flows by using crypto-safe state generation, caching the user profile, and centralising auth state updates to remove repeated storage/event wiring (`src/components/GithubSignIn.tsx:17-124`, `src/components/Header.tsx:6-27`).

## Execution Plan & Parallelisation

- Default branch for all improvement work: `improvement-review-implementation`. Agents should branch from / merge back into this integration branch unless explicitly instructed otherwise.

1. **Wave 1 — Foundations**
    1. `docs/tasks/shared-utilities-alignment.md`: establishes `src/shared/evm.ts`, `src/shared/api.ts`, and any common PNG helpers consumed downstream.
    2. `docs/tasks/developer-experience-upgrades.md`: introduces lint/test tooling; can run alongside utilities because it touches configs and scripts only.

2. **Wave 2 — Service Layer**
    1. `docs/tasks/api-erc20-enhancements.md`: adopts shared helpers for ABI decoding/address validation; depends on Wave 1 exports.
    2. `docs/tasks/api-upload-hardening.md`: reuses shared PNG/EVM helpers; may run in parallel with the ERC-20 task once both agents align on helper signatures (`decodeAbiString`, `isEvmAddress`, `readPng`).

3. **Wave 3 — Frontend Integration**
    1. `docs/tasks/upload-workflow-refactor.md`: consumes revised API payloads/helpers from Waves 1 & 2; ensure agreed module paths (`src/shared/evm`, `src/shared/imagePreview`).
    2. `docs/tasks/auth-flow-hardening.md`: builds on the same shared helpers and any UX conventions defined earlier; can run concurrently with the upload refactor provided API error shapes are stable.

4. **Coordination / Tracking**
    1. `docs/tasks/improvement-review-tracker.md`: owned by the coordinating agent; stays active throughout, ensuring branch status, changelog, and cross-task validation.

> **Tip:** Before starting any wave, sync the `improvement-review-implementation` branch, review upstream PRs for in-flight tasks, and confirm helper module contracts noted in each task’s “Agent Context” section.

## Frontend SPA (`src/`)

### Upload workflow (`src/routes/upload.tsx`)

- Issue: The entire form, preview generation, PR modal, and API orchestration sit inside a single 1,100+ line component (`src/routes/upload.tsx:1-1139`), making it hard to reason about and test. The first token shares a separate code path from additional tokens, causing duplicated event handlers and preview renderers.

- Recommendation: Extract a `useUploadForm` hook to own the shared state (token arrays, chain assets, submission logic) and split the UI into `TokenAssetCard`, `ChainAssetCard`, `PreviewPanel`, and `ReviewDialog` components. This keeps render logic declarative and enables targeted unit tests.

---

- Issue: PNG preview generation logic is duplicated for chain and token flows (`src/routes/upload.tsx:158-223`) and relies on a stringified dependency array to watch file changes (`src/routes/upload.tsx:225-233`). It also re-instantiates `TextDecoder` per call (`src/routes/upload.tsx:129-131`) and does not revoke object URLs created in `onTokenFileChange` (`src/routes/upload.tsx:143-155`) after replacement.

- Recommendation: Move preview generation to a shared utility like `lib/imagePreview.ts` that returns both PNG sizes and handles cleanup with `try/finally` and `URL.revokeObjectURL`. Drive effects off explicit `File` references or IDs instead of `JSON.stringify` to remove unnecessary recalculations.

  ---

- Issue: Both the blur handlers that resolve ERC-20 names (`src/routes/upload.tsx:400-454`, `src/routes/upload.tsx:770-838`) duplicate async logic and mix UI effects with data fetching, while `fetchErc20Name` reimplements the ABI decoding already present in `api/erc20-name.ts`.

- Recommendation: Extract a shared helper for name resolution that lives in `src/lib/erc20.ts` and reuse it in both the component and the API. Wrap the async call in a cancellable hook using TanStack Query so stale responses do not update state.

---

- Issue: `buildFormData` (`src/routes/upload.tsx:262-308`) awaits PNG conversions sequentially and appends addresses under a shared key, which can desynchronise with the indexed `svg_*` fields if users leave gaps. The metadata builder later relies on array indexes staying in sync (`src/routes/upload.tsx:237-245`).
  
- Recommendation: Build an explicit array of `TokenSubmission` objects before serialisation, validate each entry, and use `Promise.all` to convert missing PNGs concurrently. Send structured JSON alongside the files (e.g., `body.append('tokens', JSON.stringify(tokens))`) so server-side parsing is deterministic.

---

- Issue: Toggle actions and manual DOM manipulations (`document.createElement('input')` on `src/routes/upload.tsx:604-618`) bypass React’s declarative model and complicate testing/accessibility.

- Recommendation: Replace manual input creation with hidden file inputs controlled via refs, and rely on controlled `Switch` components with accessible labelling (`aria-checked`, `aria-labelledby`).

### Auth components (`src/components/GithubSignIn.tsx`, `src/components/Header.tsx`)

- Issue: OAuth state randomness relies on `Math.random` (`src/components/GithubSignIn.tsx:17-22`) and repeats storage synchronisation logic already handled in `Header` (`src/components/Header.tsx:6-27`).

- Recommendation: Use `crypto.getRandomValues` (with a fallback for older browsers) for the state string and centralise auth event subscription in a dedicated `useGithubAuth` hook consumed by both `Header` and `GithubSignIn`.

---

- Issue: `GithubSignIn` fetches the user profile directly from GitHub on every token change (`src/components/GithubSignIn.tsx:57-70`) without caching or cancellation, and errors fall back to `alert` usage (`src/components/GithubSignIn.tsx:77-90`).

- Recommendation: Provide a lightweight client wrapper over the repo’s API routes that proxy GitHub, cache the profile with TanStack Query (already bundled but unused), and surface non-blocking UI feedback instead of `alert`.

---

- Issue: `Header` re-mounts `GithubSignIn` using the `key` prop (`src/components/Header.tsx:27`), causing modal state to reset whenever auth changes.
  
- Recommendation: Pass the token down as props or via context so child components control their own state transitions without re-mounting.

## API Layer (`api/`)

### Upload endpoint (`api/upload.ts`)

- Issue: The endpoint expects matching `address`, `svg_*`, and `chainId_*` inputs but filters out empty addresses before iterating (`api/upload.ts:94-118`), which can desynchronise indexes and skip related files. No server-side address validation exists.

- Recommendation: Parse submissions based on `svg_*` indices, validate each entry (including an `isEvmAddress` check), and return structured error messages per asset. Reuse the same `TokenItem` schema the client uses to guarantee alignment.

---

- Issue: PNG validation and base64 encoding logic is duplicated for both token and chain flows (`api/upload.ts:120-165`, `api/upload.ts:166-200`).

- Recommendation: Extract reusable helpers (`readPng`, `assertPngDimensions`, `toRepoPath`) so both branches share the same validation surface and tests can cover them.

---

- Issue: The GitHub PR creation flow repeats blob/tree logic for direct and forked uploads (`api/github.ts:140-207`), leading to duplicated fetch sequences and no retry strategy.

- Recommendation: Build a shared helper that prepares the commit tree once, then injects owner/repo context. Introduce clearer error mapping (403 vs 409) and surface actionable feedback to the client (e.g., 409 → “sync fork”).

---

- Issue: Environment handling (`resolveTargetRepo`) depends on multiple env combinations but lacks diagnostics when misconfigured (`api/upload.ts:9-34`).

- Recommendation: Log the chosen target repo and return descriptive errors when overrides are ignored so deployments can be verified quickly.

### ERC-20 name endpoint (`api/erc20-name.ts`)

- Issue: Duplicate ABI decoding logic with the client and no caching or rate limiting (`api/erc20-name.ts:14-55`).
  
- Recommendation: Move the decoder to a shared utility, implement a simple in-memory cache for repeated lookups within the same request lifecycle, and allow RPC URL overrides via configuration tested at startup.

## Shared utilities & configuration

- Issue: `API_BASE_URL` falls back to `'http://localhost'` for non-browser contexts (`src/lib/api.ts:8-14`), which is incorrect when deployed to Vercel edge.
  
- Recommendation: Default to `'/'` and require explicit overrides, or accept the request origin via dependency injection.

---

- Issue: ABI decoding and EVM helpers are split between client and server (`src/routes/upload.tsx:112-131`, `api/erc20-name.ts:14-33`).
  
- Recommendation: Create `shared/evm.ts` (or reuse existing libs) to consolidate address validation, RPC configuration, and ABI decoding logic.

---

- Issue: `@tanstack/react-query` is bundled but unused beyond the provider (`src/main.tsx:4-12`), increasing bundle size unnecessarily.

- Recommendation: Either leverage it for name lookup/profile caching or remove the dependency and provider.

## Developer Experience

- Issue: There is no linting beyond TypeScript’s structural checks.

- Recommendation: Add an ESLint setup with `@typescript-eslint` and `eslint-plugin-react` to enforce hooks rules, dependency arrays, and accessibility best practices.

---

- Issue: PNG/SVG utilities and GitHub integration lack automated tests.

- Recommendation: Introduce `vitest` (already compatible with Vite) and cover `pngDimensions`, repo path builders, and auth storage utilities. Run the suite via CI to catch regressions.

---

- Issue: Build scripts rely on Bun, but contributors may still use Node.

- Recommendation: Document equivalent `npm` scripts or add package.json aliases so contributors without Bun can run builds.
