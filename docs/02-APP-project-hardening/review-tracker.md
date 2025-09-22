# Project Hardening Review Tracker

_Last updated: 2025-09-19_

## Integration Branch

- Primary integration branch: `chore/project-hardening`
- Default base branch: `main`
- Coordinator worktree: `/home/ross/code/yearn/tokenAssets/worktrees/coordinator`

## Active Tasks

| Task | Branch | Worktree | Agent | MCP `conversationId` | Status |
| --- | --- | --- | --- | --- | --- |
| Auth Flow Hardening | task/auth-flow-hardening | /home/ross/code/yearn/tokenAssets/worktrees/task-auth-flow-hardening | Codex Task Agent | N/A | In progress |
| ERC-20 Name Lookup Enhancements | task/erc20-name-lookup | /home/ross/code/yearn/tokenAssets/worktrees/task-erc20-name-lookup | Codex Task Agent | N/A | In progress |

## Next Task Recommendation

- Finish auth UX polish: run the manual OAuth smoke test (`vercel dev`) and capture the outcome in `auth-flow-hardening.md`.
- Stay synced with the ERC-20 agent so shared GitHub helpers and error contracts remain compatible.
- Once auth hardening is signed off, review the Wave 4 backlog and line up the next integration task.

## Pending Task Queue (from overview)

- [x] Shared Utilities Alignment — feature: Shared Core (`docs/project-hardening/tasks/completed/shared/shared-utilities-alignment.md`)
- [x] Developer Experience Upgrades — feature: Tooling (`docs/project-hardening/tasks/pending/tooling/developer-experience-upgrades.md`)
- [x] Upload API Hardening — feature: Upload Services (`docs/project-hardening/tasks/active/upload/upload-api-hardening.md`)
- [x] Upload Workflow Refactor — feature: Upload UI (`docs/project-hardening/tasks/active/upload/upload-workflow-refactor.md`)
- [x] ERC-20 Name Lookup Enhancements — feature: API (`docs/project-hardening/tasks/pending/api/erc20-name-lookup.md`)
- [x] Auth Flow Hardening — feature: Authentication (`docs/project-hardening/tasks/pending/auth/auth-flow-hardening.md`)

## Completed Tasks

All Tasks completed.

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
