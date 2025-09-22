# Frontend Platform Upgrades — Pending

_Date opened: 2025-03-18_

## 1. Replace ESLint/Prettier with Biome

- Source sample rules from `/home/ross/code/yearn/app-generator/template/biome.json` and adapt for the token assets app.
- Remove existing ESLint + Prettier configuration files and tooling hooks; update `package.json` scripts to use Biome for linting and formatting.
- Ensure CI/test documentation references the new commands (e.g., `biome check`, `biome format`).
- Validate that existing lint-staged or pre-commit hooks are updated to run Biome equivalents.

## 2. Inline GitHub Connect Loading State

- Replace the current modal shown on “Connect to GitHub” with an inline loading state on the button.
- Implement a spinner/disabled state while OAuth is in flight; ensure accessibility (ARIA live region or `aria-busy`).
- Confirm error handling still surfaces feedback without the modal (e.g., toast/banner).
- Update tests/screenshots if they assume the modal exists.

## 3. Use Upstream Branch as PR Base

- When creating PRs for token uploads, ensure the base branch is always `yearn/main`.
- If the contributor lacks push permissions, continue using their fork **only** for the head branch; the branch should still fork from the upstream base commit.
- Review `openPrWithFilesForkAware` and related helpers so branch contexts come from the upstream repo before creating forks.
- Add logging/assertions to surface when a fork fallback occurs, and document the expected behaviour in the upload task docs.

## Validation Checklist

- `bun run validate` after swapping to Biome.
- Manual OAuth smoke test to verify inline loading state.
- Dry-run upload submission to confirm PR targets `yearn/main`.

## Dependencies / Notes

- Coordinate with other agents touching GitHub helper utilities to avoid merge conflicts.
- Update `docs/02-APP-project-hardening/overview.md` once implementation begins to reflect the tooling change.
