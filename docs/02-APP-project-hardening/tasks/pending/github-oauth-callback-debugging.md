# GitHub OAuth Callback Debugging

> Tracking checklist for diagnosing and stabilizing the GitHub OAuth callback. Updated 2025-09-19.

## Diagnostics & Instrumentation

- [x] Locate active callback implementation and map dependencies (Next API route under `app/api/auth/github/callback.ts`).
- [x] Add request-scoped logging with timestamps, request IDs, and env provenance (guards secrets).
- [x] Record GitHub token exchange timing + response metadata, and surface parse errors/non-OK payloads.
- [ ] Capture request payload samples (sanitised) from production logs for manual replay.

## Environment & Configuration

- [x] Verify required secrets (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) and document fallback resolution order.
- [x] Resolve redirect base URL dynamically (`APP_BASE_URL`, `URL`, `VERCEL_URL`, or inferred host) to prevent bad redirects.
- [ ] Confirm Vercel project envs align with local `.env.local` (esp. `APP_BASE_URL` and `VITE_GITHUB_CLIENT_ID`).
- [ ] Add runbook instructions for refreshing GitHub OAuth credentials.

## Stability Fixes

- [x] Introduce abortable fetch with configurable timeout (default 8s) to avoid 504s on slow GitHub responses.
- [x] Return explicit 504 with actionable message when the token exchange times out.
- [x] Harden JSON handling on the token exchange (clone response, log preview, surface parse failures).
- [ ] Add automated regression test that stubs GitHub and asserts timeout/error paths.

## Validation

- [ ] Exercise callback end-to-end with valid GitHub credentials locally (`bun run dev`, front + API) <30s.
- [ ] Validate instrumentation + timeout behaviour in Vercel Preview logs.

## Follow-ups / Monitoring

- [ ] Decide whether to persist OAuth logs after debugging (toggle via `GITHUB_OAUTH_DEBUG`).
- [ ] Consider server-side `state` validation (nonce cookie + HMAC) for higher assurance.
- [ ] Evaluate retry/backoff on GitHub token exchange if intermittent timeouts persist.

