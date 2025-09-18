# Project Hardening Review Tracker

_Last updated: 2025-09-18_

## Integration Branch

- Primary integration branch: `project-hardening`
- Default base branch: `main`

## Active Tasks

- [ ] Upload API Hardening — feature: Upload Services (`docs/project-hardening/tasks/active/upload/upload-api-hardening.md`)
- [ ] Upload Workflow Refactor — feature: Upload UI (`docs/project-hardening/tasks/active/upload/upload-workflow-refactor.md`)

## Pending Tasks

- [ ] ERC-20 Name Lookup Enhancements — feature: API (`docs/project-hardening/tasks/pending/api/erc20-name-lookup.md`)
- [ ] Auth Flow Hardening — feature: Authentication (`docs/project-hardening/tasks/pending/auth/auth-flow-hardening.md`)
- [ ] Developer Experience Upgrades — feature: Tooling (`docs/project-hardening/tasks/pending/tooling/developer-experience-upgrades.md`)

## Completed Tasks

- [x] Shared Utilities Alignment — feature: Shared Core (`docs/project-hardening/tasks/completed/shared/shared-utilities-alignment.md`)

## Validation Suite

- `bun typecheck`
- `bun lint`
- `bun build`
- `bun test` (when available)
- Manual smoke test via `vercel dev` covering upload flows and OAuth

## Coordination Notes

- Record MCP `conversationId` assignments and worktree paths alongside each task entry when agents are spawned.
- Update this tracker when task status changes (e.g., promote pending → active, add links to merged PRs).
- Cross-link updates to `docs/project-hardening/overview.md` when scope or sequencing shifts.
