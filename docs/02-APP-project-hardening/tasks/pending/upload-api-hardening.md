# Upload API Hardening

## Goal

Make `api/upload.ts` resilient by validating submissions deterministically, sharing PNG helpers, and simplifying the GitHub PR creation flow.

## Prerequisites

- [x] Read `api/upload.ts` and `api/github.ts` to understand current flow.
- [x] Confirm environment variables for GitHub access are available for local testing.

## Implementation Checklist

1. [x] Define shared helpers (e.g., `parseTokenSubmissions`, `assertPngDimensions`, `toRepoPath`) in a local module to remove duplicated loops.
2. [x] Validate each submission entry with an `isEvmAddress` check (reuse shared util once built) and return per-entry error messages.
3. [x] Ensure file parsing aligns by iterating over indexed `svg_*` fields instead of relying on filtered address arrays.
4. [x] Extract PNG reading/validation into reusable functions used by both token and chain branches.
5. [x] Refactor GitHub PR creation to reuse a single code path for blob/tree creation; minimise duplication between direct and fork flows.
6. [x] Add structured logging or error messages around `resolveTargetRepo` so misconfiguration is obvious.
7. [x] Update tests or add new ones (with `vitest`) covering `pngDimensions` and submission parsing.

### Agent Context

- Wave 2 task; start once shared utilities expose `isEvmAddress`, `decodeAbiString`, and PNG helpers (`readPng`, `assertDimensions`).
- Work off the `project-hardening` integration branch and sync with the ERC-20 agent on shared module names/exports under `src/shared/`.
- Define the expected request/response contract (error payload shape, success schema) and communicate changes to frontend agents.
- If additional helper functions are created here, document them in the shared utilities README/comment for downstream reuse.

## Validation Checklist

- [x] `bun typecheck`
- [x] `bun build`
- [x] (If vitest added) `bun test` or equivalent.
- [ ] Manual API test via `vercel dev`:
  - Successful token upload request returns PR URL.
  - Malformed address returns descriptive JSON error without 500.
  - Chain upload validates PNG dimensions correctly.
- [ ] Review logs to ensure target repo resolution output is present and correct.

## Completion Criteria

- `api/upload.ts` delegates parsing/validation to helpers with unit coverage.
- Address and PNG validation catches invalid inputs early with clear responses.
- GitHub PR creation code is unified and easier to maintain.
- Validation checklist commands and manual API checks complete successfully.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `project-hardening`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?

#### Notes

- Centralised form parsing + PNG checks in `app/api/_lib/upload.ts`; consistent repo logging now emitted from `resolveTargetRepo()`.
- Added vitest suites for shared image helpers (`app/src/shared/image.test.ts`) and upload form parsing (`app/api/_lib/upload.test.ts`); manual `vercel dev` smoke validation still pending.
