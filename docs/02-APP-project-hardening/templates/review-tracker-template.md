# Project Hardening Tracker Template

## Goal

Coordinate completion of the Image Tools hardening plan by sequencing scoped task documents and centralising validation across the shared branch.

## Prerequisites

- [ ] Read `docs/project-hardening/overview.md` and all task documents in `docs/project-hardening/tasks/`.
- [ ] Ensure the branch `project-hardening` (or your chosen integration branch) exists locally and on the remote if collaboration is needed.

## Implementation Checklist

1. [ ] Create (or verify) the working branch `project-hardening` (or your chosen integration branch) from the latest `main` or agreed base; push it to the remote for shared access.
2. [ ] Have each task executed in an order that minimizes conflicts. If some can be run simultaneously because they they minimally intersect, group them:
   - Task 1
   - Task 2
   - Task 3
   - Task 4
3. [ ] After each task merges into the integration branch, re-run repository-wide checks and resolve conflicts before tackling the next task.
4. [ ] Maintain a running changelog summarising merged work inside `docs/project-hardening/overview.md` or a dedicated section.
5. [ ] When all tasks are complete, prepare a final PR from `project-hardening` (or your integration branch) to the primary target branch.

## Validation Checklist

- [ ] `bun typecheck`
- [ ] `bun lint`
- [ ] `bun test` (if introduced by tasks)
- [ ] `bun build`
- [ ] Manual end-to-end smoke test via `vercel dev` covering token uploads, chain uploads, and OAuth login.
- [ ] Verify no outstanding TODOs or unchecked items remain in task documents.

## Completion Criteria

- All sub-task documents are marked complete with linked PRs merged into the integration branch.
- Repository builds, lints, and tests succeed on the integration branch.
- Final PR from the integration branch is ready with summary of improvements and validation evidence.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to the `project-hardening` integration branch.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?
