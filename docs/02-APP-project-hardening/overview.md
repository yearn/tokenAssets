# Project Hardening Overview

_Last updated: 2025-09-19_

## Key Priorities

- Break the upload workflow into smaller, testable modules and shared utilities to reduce the 1.1k-line `UploadComponent` and remove duplicated preview/state logic (`src/routes/upload.tsx:1-1139`).
- Harden the upload API surface with server-side address validation, reusable file validation helpers, and consistent metadata handling to prevent malformed submissions (`api/upload.ts:80-200`). **Status:** ✅ completed in `task/upload-api-hardening` (Wave 2) and merged into `chore/project-hardening`.
- Tighten OAuth and GitHub integration flows by keeping crypto-safe state generation and profile caching consolidated in the shared hook (`src/hooks/useGithubAuth.ts`) and dropping duplicated storage listeners from UI components.

## Execution Plan & Parallelisation

- Default branch for all improvement work: `project-hardening` (or the integration branch you designate). Agents should branch from / merge back into this integration branch unless explicitly instructed otherwise.

1. **Wave 1 — Foundations**
    1. `docs/project-hardening/tasks/completed/shared/shared-utilities-alignment.md`: establishes `src/shared/evm.ts`, `src/shared/api.ts`, and any common PNG helpers consumed downstream.
    2. `docs/project-hardening/tasks/pending/tooling/developer-experience-upgrades.md`: introduces lint/test tooling; can run alongside utilities because it touches configs and scripts only.

2. **Wave 2 — Service Layer** *(Wave complete)*
    1. `docs/project-hardening/tasks/pending/api/erc20-name-lookup.md`: adopts shared helpers for ABI decoding/address validation; depends on Wave 1 exports. *(In progress — coordinate with assigned agent.)*
    2. `docs/project-hardening/tasks/active/upload/upload-api-hardening.md`: reuses shared PNG/EVM helpers; may run in parallel with the ERC-20 task once both agents align on helper signatures (`decodeAbiString`, `isEvmAddress`, `readPng`). **Merged on 2025-09-19 into `chore/project-hardening`.**

3. **Wave 3 — Frontend Integration**
    1. `docs/project-hardening/tasks/active/upload/upload-workflow-refactor.md`: consumes revised API payloads/helpers from Waves 1 & 2; ensure agreed module paths (`src/shared/evm`, `src/shared/imagePreview`).
    2. `docs/project-hardening/tasks/pending/auth/auth-flow-hardening.md`: builds on the same shared helpers and any UX conventions defined earlier; can run concurrently with the upload refactor provided API error shapes are stable.

4. **Coordination / Tracking**
    1. `docs/project-hardening/review-tracker.md`: owned by the coordinating agent; stays active throughout, ensuring branch status, changelog, and cross-task validation.

> **Tip:** Before starting any wave, sync the `project-hardening` integration branch, review upstream PRs for in-flight tasks, and confirm helper module contracts noted in each task’s “Agent Context” section.

## Frontend SPA (`src/`)

### Upload workflow (`src/routes/upload.tsx`)

- Issue: The entire form, preview generation, PR modal, and API orchestration sit inside a single 1,100+ line component (`src/routes/upload.tsx:1-1139`), making it hard to reason about and test. The first token shares a separate code path from additional tokens, causing duplicated event handlers and preview renderers.

- Recommendation: Extract a `useUploadForm` hook to own the shared state (token arrays, chain assets, submission logic) and split the UI into `TokenAssetCard`, `ChainAssetCard`, `PreviewPanel`, and `ReviewDialog` components. This keeps render logic declarative and enables targeted unit tests.

---

- Issue: PNG preview generation logic is duplicated for chain and token flows (`src/routes/upload.tsx:158-223`) and relies on a stringified dependency array to watch file changes (`src/routes/upload.tsx:225-233`). It also re-instantiates `TextDecoder` per call (`src/routes/upload.tsx:129-131`) and does not revoke object URLs created in `onTokenFileChange` (`src/routes/upload.tsx:143-155`) after replacement.

- Recommendation: Move preview generation to a shared utility like `lib/imagePreview.ts` that returns both PNG sizes and handles cleanup with `try/finally` and `URL.revokeObjectURL`. Drive effects off explicit `File` references or IDs instead of `JSON.stringify` to remove unnecessary recalculations.

  ---

- Issue: Both the blur handlers that resolve ERC-20 names (`src/routes/upload.tsx:400-454`, `src/routes/upload.tsx:770-838`) duplicate async logic and mix UI effects with data fetching, while `fetchErc20Name` reimplements the ABI decoding already present in `api/erc20-name.ts`.

- Recommendation: Extract a shared helper for name resolution that lives in `src/shared/erc20.ts` and reuse it in both the component and the API. Wrap the async call in a cancellable hook using TanStack Query so stale responses do not update state.

---

- Issue: `buildFormData` (`src/routes/upload.tsx:262-308`) awaits PNG conversions sequentially and appends addresses under a shared key, which can desynchronise with the indexed `svg_*` fields if users leave gaps. The metadata builder later relies on array indexes staying in sync (`src/routes/upload.tsx:237-245`).
  
- Recommendation: Build an explicit array of `TokenSubmission` objects before serialisation, validate each entry, and use `Promise.all` to convert missing PNGs concurrently. Send structured JSON alongside the files (e.g., `body.append('tokens', JSON.stringify(tokens))`) so server-side parsing is deterministic.

---

- Issue: Toggle actions and manual DOM manipulations (`document.createElement('input')` on `src/routes/upload.tsx:604-618`) bypass React’s declarative model and complicate testing/accessibility.

- Recommendation: Replace manual input creation with hidden file inputs controlled via refs, and rely on controlled `Switch` components with accessible labelling (`aria-checked`, `aria-labelledby`).

### Auth components (`src/hooks/useGithubAuth.ts`, `src/components/GithubSignIn.tsx`, `src/components/Header.tsx`)

- Canonical auth state now lives in `src/hooks/useGithubAuth.ts`. The hook is browser-safe, generates crypto-backed OAuth state strings with a Math.random fallback, synchronises session storage, and keeps TanStack Query profile caches in sync across tabs.
- GitHub API access should flow through `src/api/client/github.ts` which wraps `/api/auth/github/me`, normalises profile data, and throws `GithubClientError` with status codes the hook can interpret.
- `GithubSignIn` surfaces sign-in/out actions, a cancellable pending dialog, and inline alert messaging driven by the hook. Avoid manual storage listeners or `alert` usage in other components.
- Downstream components (e.g., `Header`) should consume the hook rather than forcing remounts with `key`. This keeps dialogs stable and pending state visible during redirects.

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
