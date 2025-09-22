# GitHub OAuth Callback Remediation Notes (since 9361f3cd)

## Background

The GitHub OAuth callback (`app/api/auth/github/callback.ts`) began hanging on Vercel with 504 timeouts. Starting with commit `9361f3cd6c4faea60b02869cde0db0fdc5fa0b05` (2025-09-19) we have iterated on the handler, its imports, and supporting client flow to recover the production login. The issue persists, and the latest build now fails with a `TypeError` rather than a timeout. This document captures the sequence of fixes, what each one attempted, and what we still observe.

## Timeline of Attempts

| Date (ET) | Commit | Summary of change | Intended effect | Observed result |
| --- | --- | --- | --- | --- |
| 2025-09-19 13:12 | `9361f3cd` (`fix: vercel runtime`) | Switched GitHub callback, ERC-20 lookup, and upload API routes to `runtime: 'nodejs'` while keeping shared helpers (`resolveAppBaseUrl`, `readEnv`). | Align the runtime with Vercel’s Node platform to avoid the 300s Edge timeout; rely on existing helpers for env + redirect handling. | Deploy still timed out; no additional logging available. |
| 2025-09-19 14:21 | `8d592ea6` (`fix: github connection modal`) | Hardened SPA auth hook/modals: sync storage state, allow cancelling pending flows, and better reset errors. | Reduce chances that a stale browser state was masking the callback response. | Front-end UX improved (modal dismisses correctly) but API timeout persisted. |
| 2025-09-19 14:35 | `76c5ec19` (`fix: update aliases`) | Updated Vite/TS config so `@shared/*` aliases resolve with explicit file extensions. | Ensure Node runtime bundling could still import shared modules after the runtime switch. | No change in runtime behaviour; still timing out. |
| 2025-09-19 14:44 | `4b674a63` (`fix: remove aliases from nodejs runtime files`) | Replaced `@shared/*` imports in serverless handlers with relative `../../../src/shared/*` paths. | Avoid alias resolution altogether in the Node runtime bundle. | Handler still timed out on Vercel. |
| 2025-09-19 15:14 | `e72d905a` (`fix: removed all imports from nodejs runtime`) | Inlined `readEnv`/`resolveAppBaseUrl` logic directly into the callback (and other API files) and refactored upload/lib code to drop shared imports. Added abort controller/timeouts. | Eliminate any reliance on bundler path resolution and add a 15s GitHub token request timeout. | Timeout persisted in production (15s abort confirmed locally), but still no visibility into the long hang. |
| 2025-09-19 15:43 | `552a8f89` (`fix: fix github issues`) | Reworked callback with structured error responses, timeout handling, and multiple base-URL fallbacks; expanded logging scaffolding (not yet emitting). | Surface clearer errors to diagnose the 504, confirm env availability, and guard against hung fetch calls. | Deploy continued to hang; logs still limited. |
| 2025-09-22 09:30 | `9b407a6b` (`fix: instrument GitHub OAuth callback`) | Added detailed logging (`logOAuth`), request/timeout instrumentation, configurable debug flag, and persisted debugging task doc. | Capture precise failure stage (missing code, env, timeout, GitHub non-200, JSON parse) via Vercel logs. | Logs show handler initialization, but new `req.headers.get` calls surfaced once Vercel recomputed bundle. |
| 2025-09-22 09:50 | `e72332c2` (`fix: sanitize GitHub OAuth error responses`) | Redacted sensitive data from logs, centralised JSON error builder, and tightened production-vs-debug output. | Make logs safe to share externally while still conveying failure details. | After redeploy, handler now throws before token exchange (see current error below). |
| 2025-09-22 10:11 | `9be995a8` (`fix: make evm test properly clear env vars for fallback testing`) | Not directly related to OAuth; ensures env-dependent tests are deterministic. | Keep shared env helpers deterministic during local validation. | No effect on OAuth issue. |

## Current Production Failure

```
TypeError: req.headers.get is not a function
    at Object.default (/vercel/path0/app/api/auth/github/callback.ts:76:32)
    at r (/opt/rust/nodejs.js:2:15577)
    at Server.<anonymous> (/opt/rust/nodejs.js:2:11600)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Server.<anonymous> (/opt/rust/nodejs.js:16:7632)
```

The stack references the Instrumentation build (`e72332c2`), specifically the lines that attempt to read request metadata:

```ts
const requestId = req.headers.get('x-request-id') || req.headers.get('x-vercel-id');
...
const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
```

Because `config.runtime` remains `nodejs`, Vercel invokes the handler with a Node/Edge hybrid. In this environment `req.headers` is a plain object (derived from Node’s `IncomingMessage`) and does not implement the Web `Headers` interface—so `.get()` is undefined.

## Analysis

- The shift from Edge → Node runtime resolved the original import limitations, but our handler signature (`(req: Request)`) and instrumentation assumed the Web Fetch API request, not the Node `IncomingMessage`/`NextApiRequest` object.
- Earlier versions (pre-instrumentation) only accessed `req.url`, which works because both request shapes expose the URL string. The new logging + base URL logic introduced `headers.get(...)`, which is valid for Edge `Request` but not for Node.
- As soon as the bundle with logging rolled out, execution now fails before hitting GitHub, producing the above `TypeError` and preventing further diagnosis of the original 504.

## Recommendations / Next Steps

1. **Harden request handling against both environments.** Replace direct `req.headers.get(...)` calls with a helper that supports Web `Headers` *and* Node header objects:

   ```ts
   function readHeader(req: Request | { headers?: any }, key: string): string | undefined {
     const headers = (req as any)?.headers;
     if (!headers) return undefined;
     if (typeof headers.get === 'function') return headers.get(key) ?? undefined;
     return headers[key] ?? headers[key.toLowerCase()];
   }
   ```

   Update all call sites (`requestId`, `x-forwarded-*` lookups) to use this shim. Alternatively, revert to Edge runtime where `Request` is guaranteed and re-introduce fetch-compatible dependencies.

2. **Confirm runtime requirements.** If we no longer rely on Node-only APIs, consider switching `config.runtime` back to `'edge'` so Vercel passes a standard `Request`. That change eliminates the header-shim complexity but will require verifying that shared modules compile under the Edge bundle.

3. **Reproduce locally with Vercel’s dev runtime.** Use `vercel dev` to run the callback under Node runtime and trigger the OAuth flow with a mock code to ensure the handler no longer throws before exchange.

4. **Re-enable logging post-fix.** Once the header access is guarded, redeploy and inspect logs captured by the instrumentation (`[oauth-callback] ...`). They should reveal whether the original 504 stemmed from missing env, GitHub timeout, or redirect construction.

5. **Document env expectations.** Cross-check Vercel project settings for:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `APP_BASE_URL` or `VERCEL_URL`
   Add them to `app/.env.local.example` if not already listed (partial coverage landed in `552a8f89`).

6. **Share this log with support/escalation teams.** The chronological record above should help external reviewers trace what has changed and why the current runtime fails before the GitHub call.

## Open Questions

- Do we still observe the 504 once the header accessor is fixed, or does the callback complete? This determines whether further GitHub/Vercel debugging is required.
- Should we keep instrumentation always-on (`GITHUB_OAUTH_DEBUG`) or gate it behind an env flag now that the error payloads are sanitised?
- Is there appetite to migrate the handler to the new `/app/api` route conventions (with `NextRequest`/`NextResponse`) to align with Next.js examples and reduce manual wiring?

---

# Review from ChatPGT-5-PRO

You’ve already found the proximate crash (`req.headers.get is not a function`) and the underlying mismatch (your handler assumes a Fetch `Request`, but Vercel’s Node runtime hands you a Node-style object sometimes). There are two more gotchas hiding in the current code path that can keep the callback from finishing even after you fix `headers.get`:

1. **`new URL(req.url)` may be fed a relative path in Node runtime.** On Vercel Node, `req.url` is often `"/api/auth/github/callback?..."`, which throws in `new URL(...)` unless you provide a base. Your try/catch returns a 400, but you currently crash *earlier* on `.headers.get`, so you haven’t hit this yet.

2. **Your SPA-wide rewrite can shadow APIs in some setups.** Your `vercel.json` rewrites `/(.*) → /` unconditionally. While Vercel’s file-system routing usually wins, it’s brittle. Make the rewrite explicitly *not* capture `/api/*`.

Below is a minimal, surgical set of patches that (a) harden header access, (b) build a full URL robustly, (c) keep log instrumentation intact, (d) eliminate the 300s hangs by ensuring the token request always resolves or times out, and (e) make your SPA rewrites API‑safe.

---

## 1) Harden the callback handler (headers + URL + token exchange)

**Key ideas**

- Use a tiny `getHeader` shim that works with both Web `Headers` and Node’s plain-object headers.
- Derive a *full* URL even when `req.url` is relative.
- Optionally include `redirect_uri` and use `application/x-www-form-urlencoded` for the GitHub token exchange (GitHub accepts JSON, but form-encoding behaves most consistently through proxies/CDNs).

> `app/api/auth/github/callback.ts` (replace the file with this tightened version)

```ts
export const config = {runtime: 'nodejs'};

function readEnv(key: string): string | undefined {
  const raw = (typeof process !== 'undefined' && process.env && process.env[key]) as string | undefined;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return v ? v : undefined;
}

const oauthDebugFlag = (readEnv('GITHUB_OAUTH_DEBUG') || '').toLowerCase();
const OAUTH_DEBUG = oauthDebugFlag ? ['1','true','on','yes'].includes(oauthDebugFlag) : true;
const IS_PRODUCTION = (readEnv('NODE_ENV') || readEnv('VERCEL_ENV') || 'development').toLowerCase() === 'production';

function logOAuth(event: string, details?: Record<string, unknown>) {
  if (!OAUTH_DEBUG) return;
  console.info(`[oauth-callback] ${new Date().toISOString()} ${event}${details ? ' ' + JSON.stringify(details) : ''}`);
}

function redactSecrets(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/access_token=[^&\s"']+/gi, 'access_token=[REDACTED]').replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"');
}

function normalizeBaseUrl(raw: string): string { return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; }

function getHeader(req: any, key: string): string | undefined {
  const h = req?.headers;
  if (!h) return undefined;
  const k = key.toLowerCase();
  if (typeof h.get === 'function') return h.get(key) ?? h.get(k) ?? undefined;
  const v = h[key] ?? h[k];
  return Array.isArray(v) ? v[0] : v;
}

function getRequestUrl(req: any): URL {
  const raw = (req as any)?.url;
  try {
    return new URL(raw);
  } catch {
    const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || 'localhost:5173';
    const proto = getHeader(req, 'x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const path = typeof raw === 'string' ? raw : '/api/auth/github/callback';
    return new URL(`${proto}://${host}${path}`);
  }
}

function resolveAppBase(req?: any): {url: string; source: string} {
  const appBaseExplicit = readEnv('APP_BASE_URL');
  if (appBaseExplicit && appBaseExplicit !== '/') return {url: appBaseExplicit, source: 'APP_BASE_URL'};
  const urlEnv = readEnv('URL'); if (urlEnv && urlEnv !== '/') return {url: urlEnv, source: 'URL'};
  const vercelUrl = readEnv('VERCEL_URL'); if (vercelUrl) return {url: normalizeBaseUrl(vercelUrl), source: 'VERCEL_URL'};
  if (req) {
    const u = getRequestUrl(req);
    if (u.origin && u.origin !== 'null') return {url: u.origin, source: 'request-url'};
    const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
    const proto = getHeader(req, 'x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    if (host) return {url: `${proto}://${host}`, source: 'request-headers'};
  }
  return {url: 'http://localhost:5173', source: 'fallback-default'};
}

function buildErrorResponse(status: number, message: string, debugData?: Record<string, unknown>): Response {
  const body: Record<string, unknown> = {error: message};
  if (!IS_PRODUCTION && debugData && Object.keys(debugData).length) body.debug = debugData;
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

export default async function (req: any): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getHeader(req, 'x-request-id') || getHeader(req, 'x-vercel-id') || undefined;
  const urlObj = getRequestUrl(req);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state') || '';
  const ctx = {reqId: requestId, hasCode: !!code, stateLength: state.length, queryKeys: Array.from(urlObj.searchParams.keys())};
  logOAuth('start', ctx);

  try {
    if (!code) {
      logOAuth('missing-code', {...ctx, durationMs: Date.now() - startedAt});
      return buildErrorResponse(400, 'Missing code');
    }

    const githubClientId = readEnv('GITHUB_CLIENT_ID') || readEnv('VITE_GITHUB_CLIENT_ID');
    const clientSecret = readEnv('GITHUB_CLIENT_SECRET');
    logOAuth('env-evaluated', {...ctx, hasClientId: !!githubClientId, hasClientSecret: !!clientSecret});
    if (!githubClientId || !clientSecret) {
      return buildErrorResponse(500, 'Missing GitHub OAuth env vars', {hasClientId: !!githubClientId, hasClientSecret: !!clientSecret});
    }

    const {url: appBase} = resolveAppBase(req);
    const redirectUri = new URL('/api/auth/github/callback', appBase).toString();

    const timeoutRaw = readEnv('GITHUB_OAUTH_TIMEOUT_MS');
    const t = timeoutRaw ? Number(timeoutRaw) : NaN;
    const tokenExchangeTimeoutMs = Number.isFinite(t) && t > 0 ? t : 8000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), tokenExchangeTimeoutMs);
    logOAuth('exchange-start', {...ctx, timeoutMs: tokenExchangeTimeoutMs});

    let tokenRes: Response;
    try {
      const body = new URLSearchParams({client_id: githubClientId, client_secret: clientSecret, code, redirect_uri: redirectUri});
      tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString(),
        signal: controller.signal
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isAbort = e?.name === 'AbortError';
      logOAuth('exchange-error', {...ctx, durationMs: Date.now() - startedAt, error: isAbort ? 'timeout' : (e?.message || 'fetch failed')});
      return buildErrorResponse(isAbort ? 504 : 502, isAbort ? 'GitHub token exchange timed out' : 'GitHub token exchange failed');
    }
    clearTimeout(timeoutId);

    logOAuth('exchange-response', {...ctx, durationMs: Date.now() - startedAt, status: tokenRes.status});
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      const preview = redactSecrets(text)?.slice(0, 200);
      logOAuth('exchange-non-ok', {...ctx, status: tokenRes.status, bodyPreview: preview});
      return buildErrorResponse(502, 'GitHub token request failed', {status: tokenRes.status, bodyPreview: preview});
    }

    const clone = tokenRes.clone();
    let tokenJson: {access_token?: string; error?: string} | undefined;
    try {
      tokenJson = (await tokenRes.json()) as any;
    } catch (parseErr: any) {
      const fallbackText = await clone.text();
      const preview = redactSecrets(fallbackText)?.slice(0, 200);
      logOAuth('exchange-parse-error', {...ctx, durationMs: Date.now() - startedAt, error: parseErr?.message || 'json parse', bodyPreview: preview});
      return buildErrorResponse(502, 'Invalid response from GitHub token exchange', {error: parseErr?.message || 'json parse', bodyPreview: preview});
    }

    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      logOAuth('missing-access-token', {...ctx, durationMs: Date.now() - startedAt, githubError: tokenJson?.error || null});
      return buildErrorResponse(502, 'No access_token in response', {hasErrorField: typeof tokenJson?.error === 'string'});
    }

    const {url: appBaseFinal, source} = resolveAppBase(req);
    const redirect = new URL('/auth/github/success', appBaseFinal);
    redirect.searchParams.set('token', accessToken);
    redirect.searchParams.set('state', state);
    logOAuth('redirect', {...ctx, durationMs: Date.now() - startedAt, appBase: appBaseFinal, appBaseSource: source});

    return Response.redirect(redirect.toString(), 302);
  } catch (e: any) {
    logOAuth('unhandled-error', {...ctx, durationMs: Date.now() - startedAt, error: e?.message || 'OAuth callback failed'});
    return buildErrorResponse(500, 'OAuth callback failed', {error: e?.message || 'OAuth callback failed', name: e?.name});
  }
}
```

**Why this matters**

- The shim avoids the `.get` crash on Node.
- `getRequestUrl` makes `new URL(...)` safe in both Edge and Node shapes.
- Form-encoding + explicit `redirect_uri` reduces the chance of an upstream hang on proxies.
- You still get the structured logs you added, so you’ll see whether the original 504 was env, network, or GitHub response.

---

## 2) Make the same header fix in `upload.ts` (defensive)

`upload.ts` also calls `req.headers.get('authorization')`. It may work in your local/dev, but it’s vulnerable to the same shape mismatch.

> `app/api/upload.ts` patch (only the top and header read)

```ts
export const config = {runtime: 'nodejs'};

import {getUserLogin, openPrWithFilesForkAware} from './github';
import {UploadValidationError, buildDefaultPrMetadata, buildPrFiles, parseUploadForm} from './_lib/upload';

function getHeader(req: any, key: string): string | undefined {
  const h = req?.headers; if (!h) return undefined;
  const k = key.toLowerCase();
  if (typeof h.get === 'function') return h.get(key) ?? h.get(k) ?? undefined;
  const v = h[key] ?? h[k];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: any): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', {status: 405});
  try {
    const auth = getHeader(req, 'authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return new Response(JSON.stringify({error: 'Missing GitHub token', code: 'AUTH_REQUIRED'}), {status: 401, headers: {'Content-Type':'application/json'}});
    const form = await req.formData();
    ...
```

---

## 3) Ensure SPA rewrites don’t swallow API routes

Your current `vercel.json` rewrites *everything* to `/`. Prefer one of these:

**Option A (clear and explicit):**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

**Option B (use filesystem handle):**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/" }
  ]
}
```

Either prevents an incidental rewrite from bypassing `/api/auth/github/callback`.

---

## 4) What probably caused the original 504s (and how this change helps)

- Most likely the function wasn’t *finishing*, not that GitHub was “down.” Before you added the timeout, a slow/blocked upstream exchange can sit until the platform-level timeout (Edge \~30s, Node \~10–60s depending on plan/region) and surface as 504. With the explicit `AbortController` + well-formed request, you’ll get a deterministic 504 or 502 **from your handler** within \~8s and a log line like `exchange-error timeout`.
- The subsequent `TypeError` masked any of that, so you never saw the instrumented logs. With the shim above, your logs will print (`start`, `env-evaluated`, `exchange-start`, …), and you’ll know exactly where it fails.

---

## 5) Quick local validation checklist

1. `vercel dev`
2. Navigate a real OAuth flow (or paste a `code=` you captured from GitHub once) to `http://localhost:3000/api/auth/github/callback?code=...&state=...`
3. Confirm terminal logs: `[oauth-callback] ... start → env-evaluated → exchange-start → exchange-response → redirect`
4. Ensure `/auth/github/success` stores the token and your SPA shows the signed-in state.
5. Exercise `/api/auth/github/me` with the token; it should return your profile JSON.
6. Run a pair of negative tests:

   - Missing/invalid envs → see `Missing GitHub OAuth env vars` from the handler.
   - Simulate a hung token exchange: set `GITHUB_OAUTH_TIMEOUT_MS=1` and see your 504 from the handler.

---

## 6) Optional hardening (nice-to-haves)

- **Keep debug gated**: leave `GITHUB_OAUTH_DEBUG` defaulting to `true` in non‑prod (as your code does), and set it to `false` in prod.
- **Server-side `state` verification**: you validate `state` in the client route; consider also rejecting on the server if a `STATE_SECRET`/HMAC-based state doesn’t match. Not required to fix the bug, but it upgrades your OAuth robustness.
- **Avoid token in query string**: today you pass `token` to `/auth/github/success` via URL. If you want to eliminate referer leakage entirely, set an `HttpOnly; Secure; SameSite=Lax` cookie in the callback and *omit* the `token` param. (This requires a tiny change to how the client reads the token, so I’m not bundling it into the minimal fix above.)

---

### What to expect after this patch

- The immediate `TypeError` is gone.
- If the original problem was the token exchange hanging, you’ll now see your instrumented `exchange-error timeout` within \~8s (or a clear non‑200 from GitHub).
- If it was an environment/config or rewrite issue, you’ll see `missing-env` or the callback will resolve correctly.

If you want, I can also provide a very small Vitest file that unit-tests `getHeader(...)` against both `Headers` and Node-ish objects so this doesn’t regress again.
