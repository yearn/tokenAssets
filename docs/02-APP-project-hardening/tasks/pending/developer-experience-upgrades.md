# Developer Experience Upgrades

## Goal

Strengthen linting, testing, and documentation so contributors can ship changes confidently across environments.

## Prerequisites

- [ ] Review current scripts in `package.json` and tooling expectations in `README.md` / `AGENTS.md`.

## Implementation Checklist

1. [x] Add ESLint with `@typescript-eslint` and `eslint-plugin-react`, including configs aligned with existing Prettier settings.
2. [x] Introduce `vitest` for unit testing shared utilities (PNG helpers, auth storage, etc.) and add example tests.
3. [x] Wire lint and test scripts into CI (document pipeline expectations even if CI config lives elsewhere).
4. [x] Update contributor docs to outline new commands (`bun lint`, `bun test`, `bun run lint`, etc.).
5. [x] Consider adding a pre-commit hook template (e.g., Husky or lint-staged) while keeping dependency footprint minimal.

### Agent Context

- Wave 1 task; work from the `project-hardening` integration branch parallel to shared utilities.
- Ensure ESLint/ Vitest configs include `src/shared/**/*` patterns created by the utilities task.
- Coordinate with other agents before adding opinionated lint rules that could block in-progress work; document any new required fixes.

## Validation Checklist

- [x] `bun typecheck`
- [x] `bun lint` (ESLint)
- [x] `bun test`
- [x] Documentation changes reviewed for accuracy and clarity.

## Completion Criteria

- ESLint enforces hook rules and surfaces accessibility issues.
- Testing framework exists with at least a starter suite covering utilities.
- Build/lint/test scripts work across Bun and Node environments.
- Contributor docs clearly describe the workflow and validation commands pass.

## Contributor Notes

- [ ] To fully complete the task you must make a commit to github branch `project-hardening`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Where did you have issues?
- How did you solve them.
- Be concise and information dense. This section will probably be read by an AI agent of similar knowledge of the world and of this codebase as you.
- What is important from your current context window that would be useful to save?
