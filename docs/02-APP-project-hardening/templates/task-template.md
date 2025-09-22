# <Task Title>

## Goal

Describe the desired outcome and why it matters.

## Prerequisites

- [ ] List any documents to read or tools to configure before starting.

## Implementation Checklist

1. [ ] Break the work into ordered, actionable steps.
2. [ ] Include references to files or modules where changes are required.
3. [ ] Note any coordination with other tasks or shared utilities.

## Validation Checklist

- [ ] Enumerate commands (typecheck, lint, tests, builds) that must pass.
- [ ] Call out any manual QA steps or verifications.

## Completion Criteria

- Summarise the conditions that must be true before calling the task complete.
- Point to deliverables (code modules updated, docs written, etc.).

## Agent Guidelines and pre-requisites

- Confirm that there is a branch and worktree available for you to work in that is named after the current task. The worktree should be in the /worktrees folder at the root of the directory. If either of these do not exist, please create them. Work exclusively in that branch and worktree.
- You do not need to ask permission to make changes in that worktree and branch unless the required commands are outside of you current permissions (shell commands, network access, etc.). You should not need to interface with remote repos.
- Do your best to finish the entire task so it can be submitted as one commit.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `<branchName>`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?
