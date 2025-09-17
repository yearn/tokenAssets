# Shared Utilities Alignment

## Goal
Centralise reusable helpers (EVM utilities, API base URL logic) to minimise duplication and ensure consistent behaviour across client and server.

## Prerequisites
- [x] Review `src/lib/api.ts`, `src/lib/chains.ts`, `api/erc20-name.ts`, and any new shared modules created in related tasks.
- [x] Confirm project structure for shared code (e.g., `src/shared` or root-level `shared/`).

## Implementation Checklist
1. [x] Decide on a shared directory accessible to both client and edge runtime (avoid Node-only APIs).
2. [x] Move address validation, ABI decoding, and RPC helpers into the shared module; update imports throughout the project.
3. [x] Revisit `API_BASE_URL` fallback logic to default to `'/'` or an injected origin; remove hardcoded `'http://localhost'`.
4. [x] Add unit tests for shared helpers (using `vitest`) covering address validation, ABI decoding, and API base selection.
5. [x] Update any documentation or README sections referencing environment variables or helper usage.
6. [x] Ensure shared code remains tree-shakeable and does not pull heavy dependencies into the client bundle.

### Agent Context
- Wave 1 task; start immediately on `improvement-review-implementation` before API/frontend refactors.
- Export helpers with the following signatures so downstream tasks can rely on them:
  - `isEvmAddress(address: string): boolean`
  - `decodeAbiString(resultHex: string): string`
  - `getRpcUrl(chainId: number): string | undefined`
  - Optional PNG helpers (`readPng`, `assertDimensions`) under `src/shared/image.ts`.
- Place modules under `src/shared/` and ensure both browser and Edge runtimes can import them (no Node-only APIs).

## Validation Checklist
- [x] `bun typecheck`
- [x] `bun build`
- [x] `bun test` (if unit tests implemented)
- [ ] Spot-check bundle (e.g., `bun build` output or Vite stats) to confirm no unexpected size regressions.

## Completion Criteria
- All duplicated helper logic is consolidated in shared modules with tests.
- API base URL logic works correctly in both browser and edge contexts.
- Documentation reflects new helper locations and usage patterns.
- Validation commands run cleanly.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `improvement-review-implementation`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Created `src/shared/env.ts`, `src/shared/evm.ts`, and `src/shared/api.ts` so both SPA and edge routes share identical helpers.
- `decodeAbiString` now uses `TextDecoder` and works without Node `Buffer`, unblocking edge runtimes.
- API base URL builder exports `buildApiUrl`; client switched to it for stable path joining when base is `'/'`.
- Added vitest with focused suites for EVM and API helpers; run via `bun run test` (maps to `vitest run`).
