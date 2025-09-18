# Upload Workflow Refactor

## Goal

Re-architect the upload route so the form state, preview generation, and PR review flow are modular, testable, and free of duplicated logic.

## Prerequisites

- [ ] Read `docs/project-hardening/overview.md` and the existing implementation in `src/routes/upload.tsx`.
- [ ] Confirm you can run dev tooling: `bun typecheck`, `bun build`, and `vercel dev` (optional for manual QA).

## Implementation Checklist

1. [ ] Sketch a component tree separating form state (hook) from presentation components (`TokenAssetCard`, `ChainAssetCard`, `PreviewPanel`, `ReviewDialog`).
2. [ ] Create a `useUploadForm` hook that owns shared state, validation, and PR metadata building. Ensure the hook exposes methods for adding/removing assets and triggering submission.
3. [ ] Extract preview generation utilities into `src/lib/imagePreview.ts`, handling canvas cleanup and object URL revocation.
4. [ ] Replace inline `fetchErc20Name` logic with shared helpers (to be implemented via `shared/erc20.ts` per companion task) and ensure async calls are cancellable (AbortController or TanStack Query).
5. [ ] Update JSX to use the new components, remove direct DOM manipulations (`document.createElement`), and make file inputs controlled via refs.
6. [ ] Rework `buildFormData` to operate on an explicit array of submission objects and use `Promise.all` to process PNG conversions concurrently.
7. [ ] Ensure validation errors surface inline with accessible messaging and disable submission until requirements are met.
8. [ ] Delete or reduce the legacy logic from `src/routes/upload.tsx` after migration, keeping the file focused on route wiring.

### Agent Context
- Wave 3 task; begin after foundational and service-layer waves merge into the `project-hardening` integration branch.
- Import shared helpers from `src/shared/evm` (`isEvmAddress`, `decodeAbiString`) and `src/shared/image` (`generatePngPreviews`, `assertDimensions`).
- Expect `/api/upload` to return structured errors (`{ error: string, details?: string[] }`) and `/api/erc20-name` to surface cache metadata; update client handling accordingly.
- Coordinate with the auth hardening agent if shared hooks/components (e.g., `useGithubAuth`) live in a common module to avoid divergent implementations.

## Validation Checklist

- [ ] `bun typecheck`
- [ ] `bun lint` (alias for typecheck; keep in workflow)
- [ ] `bun build`
- [ ] Manual smoke test in `vercel dev` or `bun dev`: token upload (with generated PNGs), manual PNG upload path, and chain mode.
- [ ] Confirm generated PR metadata matches the new submission object ordering (inspect network request payload).

## Completion Criteria

- The route file is reduced to lightweight composition; heavy logic lives in hooks/utilities.
- Preview generation and ERC-20 lookup logic are shared and free of duplication.
- Upload submission handles sparse inputs deterministically and matches server expectations.
- All validation commands in the checklist succeed without errors.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `project-hardening`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?
