# Edge Runtime Review – GitHub APIs

_Date: 2025-03-18_

## Scope
- `app/api/auth/github/callback.ts`
- `app/api/erc20-name.ts`
- `app/api/upload.ts`

## Findings
- All three handlers execute entirely on Web-standard APIs (Fetch, AbortController, URL, TextDecoder/FormData) and no longer rely on Node-only globals.
- `erc20-name.ts` uses `setTimeout` for the RPC AbortController guard; Edge supports this pattern and the timer is always cleared, so no leaking handles.
- `upload.ts` now shields environment lookups behind `readEnv`, preventing reference errors when `process` is undefined in Edge.
- Shared helpers in `app/api/_lib/upload.ts` fall back to browser-safe primitives when `Buffer` is absent, so the Edge runtime remains compatible. Large uploads may stress the `btoa` fallback if payloads exceed a few KB; monitor if PR payload size grows significantly.
- No further refactors are required before or after the switch. If we ever return to the Node runtime, the code paths remain valid because the helpers still read from `process.env` when available.

## Follow-up
- None required today. Re-test the upload flow in production once deployed to confirm GitHub PR creation still succeeds with the Edge networking stack.
