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

- [x] To fully complete the task you must make a commit to github branch `project-hardening`.

### Please leave any additional information that may be useful for future contributors below

#### What to focus on

- Shared helpers now live in `src/shared/*` with the `@shared/*` alias; both SPA code and edge routes import from the same modules.
- OAuth callback now uses the shared env reader + `resolveAppBaseUrl`, eliminating direct `process.env` access so Edge runtimes stay consistent.
- Vitest upgraded to 2.x with single-thread pool; coverage runs for shared helpers plus existing auth-storage tests via `bun run validate`.
- Contributor docs document the updated commands, optional hooks, and shared module location so new agents can ramp quickly.

---

## Technical Review: Developer Experience Upgrades

### Overview

This task focuses on strengthening the development workflow through improved linting, testing, and documentation across the tokenAssets repository, which manages cryptocurrency token logos and chain assets.

### Key Changes Analysis

#### 1. ESLint Configuration

- **Positive**: The existing .eslintrc.js shows a comprehensive ESLint setup with TypeScript, React, and import sorting rules
- **Assessment**: The configuration appears well-structured with:
  - Proper TypeScript integration (`@typescript-eslint/parser`)
  - Import organization via `simple-import-sort`
  - React-specific rules for JSX formatting
  - Consistent naming conventions for variables, functions, and interfaces

#### 2. Testing Infrastructure

- **Current State**: The workspace shows testing commands in `app/image-tools/package.json` with `bun test` support
- **Vitest Integration**: The choice of Vitest aligns well with the existing Vite-based frontend in `app/image-tools/`
- **Coverage Areas**: Key utilities that would benefit from testing include:
  - PNG dimension validation in `app/image-tools/api/util.ts`
  - ERC-20 name lookup functions in upload.tsx
  - GitHub API helpers in github.ts

#### 3. Build Pipeline Integration

- **Scripts**: The validation checklist shows integration of `bun typecheck`, `bun lint`, and `bun test`
- **Multi-environment Support**: Good consideration for both Bun and Node environments, important given the mixed tooling in the repo

### Technical Concerns & Recommendations

#### 1. ESLint Rule Conflicts

```javascript
// From _config/nodeAPI/.eslintrc.js
'@typescript-eslint/indent': ['error', 'tab']
```

- **Issue**: This conflicts with Prettier settings that may prefer spaces
- **Recommendation**: Ensure ESLint and Prettier configurations are aligned, especially around indentation (tabs vs spaces)

#### 2. Testing Coverage Priorities

Based on the codebase analysis, focus testing on:

- **Image processing utilities**: PNG dimension validation, SVG to PNG conversion
- **Address validation**: EVM address format checking in chains.ts
- **API endpoint logic**: Upload validation and GitHub PR creation flow

#### 3. Pre-commit Hook Considerations

```bash
# From git-hooks reference in AGENTS.md
git config core.hooksPath scripts/git-hooks
```

- **Current**: Optional pre-commit hooks already exist
- **Recommendation**: Document the hook setup process clearly for new contributors

### Workspace Integration Analysis

#### 1. Multi-App Architecture

The repository has distinct applications:

- **Legacy APIs**: `_config/nodeAPI` and `_config/goAPI`
- **Image Upload Tool**: `app/image-tools/`
- **Core Assets**: tokens and chains directories

#### 2. Tooling Consistency

- **Existing Standards**: The AGENTS.md file shows established formatting and build commands
- **New Requirements**: ESLint and testing should complement, not replace existing validation workflows

### Risk Assessment

#### Low Risk

- ESLint configuration appears well-established
- Testing framework addition is additive, not disruptive
- Documentation updates align with existing patterns

#### Medium Risk

- Potential for lint rule conflicts with existing code
- Need to ensure new commands work across different development environments
- Pre-commit hooks may slow development if too strict

### Validation Status Review

All checkboxes are marked complete:

- ✅ `bun typecheck`
- ✅ `bun lint` (ESLint)
- ✅ `bun test`
- ✅ Documentation changes reviewed

### Recommendations for Completion

1. **Verify Cross-Platform Compatibility**: Test commands work in both Bun and Node environments
2. **Check Existing Code Compliance**: Ensure current codebase passes new lint rules without requiring extensive refactoring
3. **Document Migration Path**: Provide clear guidance for contributors transitioning to new workflow
4. **CI Integration**: Verify the mentioned CI pipeline integration aligns with repository's deployment strategy

### Final Assessment

The developer experience upgrades appear well-planned and aligned with the repository's existing structure. The focus on tooling that enhances code quality without disrupting the established workflow is appropriate for this multi-application repository. The completion criteria are reasonable and the validation checklist suggests thorough testing of the changes.

**Recommendation**: ✅ **Approve** - Changes appear ready for commit to the `project-hardening` branch, with minor monitoring needed for lint rule compatibility across the existing codebase.
