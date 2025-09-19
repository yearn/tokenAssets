# Auth Flow Hardening

## Goal
Improve GitHub OAuth UX and security by centralising auth state management, using cryptographically strong state values, and reducing redundant profile fetch logic.

## Prerequisites
- [x] Review `src/components/GithubSignIn.tsx`, `src/components/Header.tsx`, and `src/lib/githubAuth.ts`.
- [ ] Ensure ability to run GitHub OAuth locally via `vercel dev` (requires valid env vars).

## Implementation Checklist
1. [x] Add a `useGithubAuth` hook in `src/hooks` that encapsulates token storage, pending state, and event handling.
2. [x] Refactor `Header` and `GithubSignIn` to consume the hook instead of duplicating storage listeners; remove the `key` prop remount pattern.
3. [x] Replace `randomState` with a `crypto.getRandomValues`-based implementation and keep a safe fallback for legacy browsers.
4. [x] Introduce an `api/client/github.ts` wrapper that fetches the signed-in user via an internal route (or at least centralises fetch + error handling).
5. [x] Cache the profile lookup with TanStack Query (already bundled) or a simple memo to avoid refetch loops.
6. [x] Swap `alert` calls for non-blocking UI feedback (e.g., inline status, toast component) so flows remain accessible.
7. [x] Ensure auth pending dialogs close deterministically on success/failure and that storage events are cleaned up on unmount.

### Agent Context
- Wave 3 task; depends on Waves 1 & 2 for shared helper placement and API error structure.
- Operate on the `project-hardening` integration branch and reuse the shared `useGithubAuth` hook location chosen in this task (coordinate with upload refactor agent).
- Expect GitHub profile fetches to route through a new client wrapper (`api/client/github.ts`) that may be shared with other components.
- Document any UI messaging changes so other frontend areas can adopt consistent language.

## Validation Checklist
- [x] `bun typecheck`
- [x] `bun build`
- [ ] Manual OAuth round-trip via `vercel dev` verifying:
  - Successful login updates header without remounting components.
  - Profile name caches and persists on reload.
  - Sign-out clears tokens and pending state.
- [ ] Confirm no console warnings about state mismatch or unhandled promise rejections.

## Completion Criteria
- Auth state is managed through a single hook with strong typing and cleanup.
- OAuth state parameter uses crypto-grade randomness.
- UI feedback avoids modal lockups and redundant fetches.
- Validation checklist commands complete without errors and manual tests pass.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `project-hardening`.
- TanStack Query now handles GitHub profile caching; 401/403 responses trigger `clearSession` and surface a dismissible inline alert in `GithubSignIn`.
- OAuth state strings rely on `crypto.getRandomValues` with a Math.random fallback; see `app/src/lib/__tests__/githubAuth.test.ts`.
- Next step: run an end-to-end OAuth round trip via `vercel dev`, verify storage cleanup across tabs, and record the outcome here.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?
