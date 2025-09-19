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

## Claude Technical Review

**Commit:** `84469c30` - "feat: upload api hardening"  
**Review Date:** 2025-09-19  
**Files Changed:** 8 files (+810, -235 lines)

### Architecture & Design ✅

**Excellent modularisation**: The refactoring successfully extracts shared logic into `app/api/_lib/upload.ts`, eliminating duplication between token and chain upload paths. The separation of concerns is clean:

- Form parsing and validation → `parseUploadForm()`
- PNG dimension checking → shared `@shared/image` utilities  
- GitHub operations → unified flow in `github.ts`
- Error handling → structured `UploadValidationError` class

**Type safety improvements**: Strong TypeScript contracts with discriminated unions (`UploadParseResult`) and comprehensive error detail structures provide excellent developer experience and runtime safety.

### Implementation Quality ✅

**Robust validation logic**: The address validation using `isEvmAddress()` and PNG dimension assertions prevent invalid submissions early. The indexed field parsing (`collectTokenIndexes()`) is more reliable than the previous filtered array approach.

**Error handling excellence**: The `UploadValidationError` class provides structured field-level error details with HTTP status codes and optional error codes, enabling precise frontend error display.

**GitHub API consolidation**: The `commitFilesToBranch()` and `loadBranchContext()` functions eliminate code duplication between direct and fork workflows, making the codebase more maintainable.

### Testing Coverage ✅

**Comprehensive test suite**: 32 tests across 5 test files provide good coverage:

- Image utilities: PNG signature validation, dimension checking, base64 encoding
- Upload parsing: Form data extraction, validation error handling, file path generation  
- Mocking strategy: Clean vi.mock setup for shared dependencies

**Test quality**: Tests cover both happy path and error scenarios with realistic data (valid EVM addresses, proper PNG blobs).

### Code Quality ✅

**Clean abstractions**: Functions have single responsibilities and clear names. The `normalizeString()` utility handles form data inconsistencies elegantly.

**Logging improvements**: Repository resolution now includes structured logging with context (`owner`, `repo`, `reason`, `allowOverride`), improving debuggability.

**Edge runtime compatibility**: Proper use of edge-compatible APIs and base64 encoding throughout.

### Security Considerations ✅

**Input validation**: All user inputs are validated (addresses, chain IDs, file formats). PNG dimension checks prevent malformed image attacks.

**Error message safety**: Validation errors provide helpful details without exposing internal system information.

### Minor Observations

1. **Missing manual validation**: The checklist indicates `vercel dev` smoke testing is still pending - recommend completing before merge.

2. **Test dependency**: Heavy use of mocked `@shared/image` module in tests - consider integration tests with real PNG files for additional confidence.

3. **Error code consistency**: Some validation errors have codes (`TOKEN_SUBMISSION_MISSING`) while others don't - consider standardizing.

### Verdict: ✅ APPROVED

This implementation successfully addresses all task requirements with high code quality, comprehensive testing, and robust error handling. The modular design will ease future maintenance and extensibility. The commit is ready for integration into the `project-hardening` branch pending completion of manual API validation.
