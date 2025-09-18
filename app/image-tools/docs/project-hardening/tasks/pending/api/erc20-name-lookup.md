# ERC-20 Name Lookup Enhancements

## Goal

Consolidate ABI decoding between client and server, add caching, and make RPC configuration more robust for the ERC-20 name lookup endpoint.

## Prerequisites

- [ ] Review `api/erc20-name.ts` and the client-side lookup logic in `src/routes/upload.tsx`.
- [ ] Identify where shared utilities will live (e.g., `shared/erc20.ts`).

## Implementation Checklist

1. [ ] Create `shared/erc20.ts` (or similar) exporting ABI decoding, address validation, and RPC selection helpers.
2. [ ] Update both the API and client to import shared helpers instead of maintaining duplicate logic.
3. [ ] Add an in-memory cache in the API endpoint keyed by `${chainId}:${address}` with a short TTL to reduce redundant RPC calls.
4. [ ] Validate RPC URLs at startup (or first request) and surface a descriptive error when none are configured.
5. [ ] Ensure the API distinguishes between RPC HTTP errors, contract errors, and empty results with clear status codes.
6. [ ] Update client-side lookup to use AbortControllers or TanStack Query so cancelled requests do not update state.
7. [ ] Document environment variable expectations for custom RPC URLs.

### Agent Context
- Wave 2 task; begin after Wave 1 finishes exporting shared helpers (`isEvmAddress`, `decodeAbiString`, `getRpcUrl`).
- Branch: `project-hardening`; pull latest shared modules before starting.
- Coordinate helper naming/paths with the API upload agent (`src/shared/evm`, `src/shared/rpc`).
- Capture new API response schema (error body structure, cache hit metadata) so frontend agents can adjust accordingly.

## Validation Checklist

- [ ] `bun typecheck`
- [ ] `bun build`
- [ ] (If tests added) `bun test`
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

- Where did you have issues?
- How did you solve them?
- What is important from your current context window that would be useful to save?
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
