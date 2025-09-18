# Project Hardening Review Tracker

_Last updated: 2025-09-18_

## Integration Branch

- Primary integration branch: `chore/project-hardening`
- Default base branch: `main`
- Coordinator worktree: `/home/ross/code/yearn/tokenAssets/worktrees/coordinator`

## Active Tasks

None — kick off a task by creating `task/<slug>` from `chore/project-hardening`, provisioning a worktree under `/home/ross/code/yearn/tokenAssets/worktrees/`, and logging the assignment below.

| Task | Branch | Worktree | Agent | MCP `conversationId` | Status |
| --- | --- | --- | --- | --- | --- |

## Pending Task Queue (from overview)

- [ ] Shared Utilities Alignment — feature: Shared Core (`docs/project-hardening/tasks/completed/shared/shared-utilities-alignment.md`)
- [ ] Developer Experience Upgrades — feature: Tooling (`docs/project-hardening/tasks/pending/tooling/developer-experience-upgrades.md`)
- [ ] Upload API Hardening — feature: Upload Services (`docs/project-hardening/tasks/active/upload/upload-api-hardening.md`)
- [ ] Upload Workflow Refactor — feature: Upload UI (`docs/project-hardening/tasks/active/upload/upload-workflow-refactor.md`)
- [ ] ERC-20 Name Lookup Enhancements — feature: API (`docs/project-hardening/tasks/pending/api/erc20-name-lookup.md`)
- [ ] Auth Flow Hardening — feature: Authentication (`docs/project-hardening/tasks/pending/auth/auth-flow-hardening.md`)

## Completed Tasks

## Validation Expectations

- `bun typecheck`
- `bun lint`
- `bun build`
- `bun test` (when available)
- Manual smoke test via `vercel dev` covering upload flows and OAuth

## Coordination Notes

- Record MCP `conversationId`, branch, and worktree path in the Active Tasks table when an agent session is launched.
- Move tasks between Pending → Active → Completed as status changes; annotate entries with PR links once available.
- Cross-link updates to `docs/02-APP-project-hardening/overview.md` if task sequencing or scope shifts.
