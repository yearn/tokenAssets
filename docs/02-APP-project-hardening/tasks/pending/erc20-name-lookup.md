# ERC-20 Name Lookup Enhancements

## Goal

Consolidate ABI decoding between client and server, add caching, and make RPC configuration more robust for the ERC-20 name lookup endpoint.

## Prerequisites

- [x] Review `api/erc20-name.ts` and the client-side lookup logic in `src/routes/upload.tsx`.
- [x] Identify where shared utilities will live (e.g., `shared/erc20.ts`).

## Implementation Checklist

1. [x] Create `shared/erc20.ts` (or similar) exporting ABI decoding, address validation, and RPC selection helpers.
2. [x] Update both the API and client to import shared helpers instead of maintaining duplicate logic.
3. [x] Add an in-memory cache in the API endpoint keyed by `${chainId}:${address}` with a short TTL to reduce redundant RPC calls.
4. [x] Validate RPC URLs at startup (or first request) and surface a descriptive error when none are configured.
5. [x] Ensure the API distinguishes between RPC HTTP errors, contract errors, and empty results with clear status codes.
6. [x] Update client-side lookup to use AbortControllers or TanStack Query so cancelled requests do not update state.
7. [x] Document environment variable expectations for custom RPC URLs.

### Agent Context
- Wave 2 task; begin after Wave 1 finishes exporting shared helpers (`isEvmAddress`, `decodeAbiString`, `getRpcUrl`).
- Branch: `project-hardening`; pull latest shared modules before starting.
- Coordinate helper naming/paths with the API upload agent (`src/shared/evm`, `src/shared/rpc`).
- Capture new API response schema (error body structure, cache hit metadata) so frontend agents can adjust accordingly.

## Validation Checklist

- [x] `bun typecheck`
- [x] `bun build`
- [x] (If tests added) `bun test`
- [ ] Manual lookup via `curl` or `vercel dev` ensuring:
  - Repeated requests hit the cache (check logs or mock timings).
  - Invalid addresses return 400 with helpful messaging.
  - Missing RPC configuration returns actionable error.

## Completion Criteria

- Single shared module handles ABI decoding and address validation across client/server.
- API caching and error handling reduce load and improve feedback.
- Client lookup logic is cancellable and reuses shared helpers.
- Validation commands and manual checks succeed without regressions.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `project-hardening`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- API now returns `{name, cache}` on success and `{error: {code, message, details?}}` on failure. Codes cover invalid input, missing RPC config, RPC HTTP errors, JSON errors, empty result, and decode failures.
- Cache TTL/size/timeout are configurable via `ERC20_NAME_CACHE_TTL_MS`, `ERC20_NAME_CACHE_SIZE`, `ERC20_NAME_RPC_TIMEOUT_MS`; defaults are 5 minutes, 256 entries, and 10 seconds respectively.
- Client lookup keeps an AbortController per `(chainId,address)`; always guard `fetchErc20Name` callers with `try/catch` and skip updates when `isLookupAbort(err)` is true to avoid flashing errors during rapid edits.
